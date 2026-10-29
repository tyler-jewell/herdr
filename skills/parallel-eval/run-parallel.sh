#!/usr/bin/env bash
# Parallel container eval runner for Herdr.
# Spawns PARALLEL_LEVEL containers in parallel, each running ./evals.ts macos --agent
# Captures ROW JSON output from each, appends to evals.jsonl, regenerates README.md and results.svg.
#
# Usage:
#   PARALLEL_LEVEL=5 ./skills/parallel-eval/run-parallel.sh
#   MATRIX="model1,judge1,one-question model2,judge2,two-question" PARALLEL_LEVEL=3 ./skills/parallel-eval/run-parallel.sh
#
# Requirements:
# - container CLI must be on PATH (apple/container on macOS, docker on Linux)
# - Container image 'herdr-sandbox' must be built (or will be built by this script)
# - evals.json, metrics.json, capabilities.json must exist in repo root
# - HERDR_EVAL_MODEL_URL must be reachable if llama-server is running

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
PARALLEL_LEVEL="${PARALLEL_LEVEL:-20}"
ROOT="${ROOT:-$(git rev-parse --show-toplevel)}"
WORKER_TMPDIR="${WORKER_TMPDIR:-$(mktemp -d /tmp/herdr-parallel-XXXXX)}"
trap 'rm -rf "$WORKER_TMPDIR"' EXIT

AGENT_MODEL="${AGENT_MODEL:-}"
JUDGE_MODEL="${JUDGE_MODEL:-}"
EVAL_ID="${EVAL_ID:-one-question}"
MATRIX="${MATRIX:-}"

# ── Helpers ──────────────────────────────────────────────────────────────────────

log() { echo "[$(date +%H:%M:%S)] $*"; }

check_deps() {
  if ! command -v container >/dev/null 2>&1; then
    log "FAIL: 'container' CLI not found on PATH. Install from https://herdr.dev/docs/install/"
    exit 1
  fi
  if ! command -v deno >/dev/null 2>&1; then
    log "FAIL: 'deno' not found on PATH. Install from https://deno.com/"
    exit 1
  fi
}

ensure_image() {
  log "Checking sandbox image 'herdr-sandbox'..."
  if ! container image ls herdr-sandbox >/dev/null 2>&1; then
    log "Building sandbox image from Containerfile..."
    local ctx
    ctx=$(mktemp -d)
    if ! container build --tag herdr-sandbox --file "$ROOT/Containerfile" "$ctx" >/dev/null 2>&1; then
      log "FAIL: container build failed"
      rm -rf "$ctx"
      exit 1
    fi
    rm -rf "$ctx"
  else
    log "Sandbox image already present."
  fi
}

# ── Run a single parallel worker ──────────────────────────────────────────────
# Each worker gets its own container with isolated filesystem.
# It copies the repo in, runs ./evals.ts macos --agent, and writes its ROW output
# to a temporary file. The parent process waits and aggregates.
run_worker() {
  local idx="$1"
  local wtmp="$WORKER_TMPDIR/worker-${idx}.jsonl"
  local cname="herdr-parallel-${idx}"

  log "Starting worker #$idx (container: $cname)..."

  # Start container with ephemeral isolation (same flags as evals.ts)
  if ! container run -d \
      --name "$cname" \
      --user 1000:1000 \
      --cap-drop ALL \
      --read-only \
      --tmpfs /tmp:size=256M,mode=1777 \
      --tmpfs /home/tester:size=1024M,mode=1777 \
      herdr-sandbox sleep infinity >/dev/null 2>&1; then
    log "FAIL: could not start container $cname"
    return 1
  fi

  # Wait for container to be ready
  local ready=0
  for _ in $(seq 1 30); do
    if container inspect "$cname" >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done
  if (( ready == 0 )); then
    log "FAIL: container $cname not ready after 30s"
    container stop "$cname" >/dev/null 2>&1
    container delete "$cname" >/dev/null 2>&1
    return 1
  fi
  log "Container $cname ready."

  # Copy the repo tree into the container's /home/tester/src
  # (mirrors evals.ts: start() function tar copy logic)
  local repo_tar
  repo_tar=$(tar --no-xattrs -C "$ROOT" -cf - \
    --exclude='.git' \
    $(cd "$ROOT" && git ls-files) 2>/dev/null)

  if ! container exec -i \
      --user 1000:1000 \
      "$cname" \
    /bin/sh -c 'mkdir -p "$HOME/src" && tar -xf - -C "$HOME/src"' \
    < <(echo "$repo_tar") >/dev/null 2>&1; then
    log "FAIL: could not copy repo into $cname"
    container stop "$cname" >/dev/null 2>&1
    container delete "$cname" >/dev/null 2>&1
    return 1
  fi
  log "Repo copied into $cname."

  # Construct the evals.ts runtime env
  local endpoint
  if [[ "$OSTYPE" == "darwin"* ]]; then
    endpoint="${HERDR_EVAL_MODEL_URL:-http://192.168.64.1:9931/v1}"
  else
    endpoint="${HERDR_EVAL_MODEL_URL:-http://host.docker.internal:9931/v1}"
  fi

  # Run evals.ts macos --agent inside the container, capture ROW output
  log "Running ./evals.ts macos --agent in $cname..."
  if ! container exec -i \
      --user 1000:1000 \
      --env "HOME=/home/tester" \
      --env "USER=tester" \
      --env "HERDR_SANDBOX=1" \
      --env "DENO_NO_UPDATE_CHECK=1" \
      --env "HERDR_EVAL_MODEL_URL=${endpoint}" \
      "$cname" \
    deno run --quiet --allow-run --allow-read --allow-write --allow-net --allow-env \
      ./evals.ts macos --agent > "$wtmp" 2>&1; then
    log "FAIL: evals.ts failed in $cname"
    container stop "$cname" >/dev/null 2>&1
    container delete "$cname" >/dev/null 2>&1
    return 1
  fi

  log "Worker #$idx complete. Output written to $wtmp."

  # Cleanup container
  container stop "$cname" >/dev/null 2>&1
  container delete "$cname" >/dev/null 2>&1
  return 0
}

# ── Main ────────────────────────────────────────────────────────────────────────

main() {
  log "=== parallel-eval: starting $PARALLEL_LEVEL parallel container evals ==="
  log "Repo: $ROOT"
  log "Parallel level: $PARALLEL_LEVEL"
  if [[ -n "$MATRIX" ]]; then
    log "Matrix entries: $MATRIX"
  fi
  log "Worker temp dir: $WORKER_TMPDIR"
  log ""

  check_deps
  ensure_image

  # Spawn workers in parallel
  local pids=()
  for i in $(seq 1 "$PARALLEL_LEVEL"); do
    run_worker "$i" &
    pids+=($!)
  done

  # Wait for all workers to finish
  local failed=0
  for pid in "${pids[@]}"; do
    if ! wait "$pid"; then
      log "Worker pid $pid exited with failure"
      failed=$((failed + 1))
    fi
  done

  log ""
  log "=== $PARALLEL_LEVEL workers done; $failed failed ==="

  # ── Aggregate results ────────────────────────────────────────────────────
  log "Aggregating results..."

  # Combine all worker JSONL outputs
  local combined="$WORKER_TMPDIR/combined.jsonl"
  > "$combined"
  for f in "$WORKER_TMPDIR"/worker-*.jsonl; do
    if [[ -f "$f" ]]; then
      cat "$f" >> "$combined"
    fi
  done

  if [[ ! -s "$combined" ]]; then
    log "FAIL: no output captured from any worker"
    exit 1
  fi

  log "Captured $(wc -l < "$combined") row(s) total."

  # Append rows to the repo's evals.jsonl
  # Each worker produces one ROW line; we append them all
  # NOTE: evals.ts's cleanCommit() checks that only RESULT_FILES are modified.
  # We'll append directly and let the later commit handle validation.
  log "Appending rows to $ROOT/evals.jsonl..."
  cat "$combined" >> "$ROOT/evals.jsonl"

  # Regenerate README.md results block using render.ts
  log "Regenerating README.md results block..."
  if ! deno run --quiet --allow-all "$ROOT/render.ts" >/dev/null 2>&1; then
    log "WARN: render.ts regeneration had issues (may be env-dependent)"
  fi

  # Regenerate results.svg heatmap
  log "Regenerating results.svg heatmap..."
  if ! deno run --quiet --allow-all "$ROOT/render.ts" svg >/dev/null 2>&1; then
    log "WARN: results.svg regeneration had issues"
  fi

  # Print summary
  log ""
  log "=== parallel-eval summary ==="
  log "Workers started: $PARALLEL_LEVEL"
  log "Workers completed: $((${#pids[@]} - failed))"
  log "Workers failed: $failed"
  log "Rows appended to evals.jsonl: $(wc -l < "$ROOT/evals.jsonl") (new: $(($(wc -l < "$ROOT/evals.jsonl") - $(cat "$combined" | wc -l))))"
  log "README.md updated (results block)"
  log "results.svg updated (heatmap)"
  log ""
  log "Next steps: git add evals.jsonl README.md results.svg && git commit -m 'parallel eval results'"
}

main "$@"