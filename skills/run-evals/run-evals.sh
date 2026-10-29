#!/usr/bin/env bash
# Purpose: run the Herdr agent eval N times (1..100) in parallel, each in its own git worktree and
#   isolated container, then merge the result rows and re-render README.md and results.svg once.
# Change when: how workers are isolated, how N is chosen, or how rows are merged changes.
# Not for: what the eval is or how it is scored (evals.json, agent.ts), the sandbox (Containerfile, evals.ts).
#
# Usage:
#   skills/run-evals/run-evals.sh                 # smart: one full wave at detected capacity
#   skills/run-evals/run-evals.sh --parallel 1    # one eval
#   skills/run-evals/run-evals.sh --parallel 100  # 100 evals, in waves of the safe concurrency
#   skills/run-evals/run-evals.sh --dry-run       # show the plan, run nothing
#   skills/run-evals/run-evals.sh --preflight     # checks only, under 5 seconds
set -euo pipefail

ROOT="$(git -C "$(cd "$(dirname "$0")" && pwd)" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "FAIL not inside a git checkout" >&2; exit 1; }

PARALLEL=""
CONCURRENCY=""
RUNTIME=""
MODEL_URL="${HERDR_EVAL_MODEL_URL:-}"
MAX_CAP="${RUN_EVALS_MAX:-100}"
DRY=0
JSON=0
PREFLIGHT_ONLY=0
IMAGE="herdr-sandbox"

usage() {
  sed -n '6,15p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --parallel)     PARALLEL="${2:-}"; shift 2 ;;
    --parallel=*)   PARALLEL="${1#*=}"; shift ;;
    --concurrency)  CONCURRENCY="${2:-}"; shift 2 ;;
    --concurrency=*) CONCURRENCY="${1#*=}"; shift ;;
    --runtime)      RUNTIME="${2:-}"; shift 2 ;;
    --max)          MAX_CAP="${2:-}"; shift 2 ;;
    --dry-run)      DRY=1; shift ;;
    --json)         JSON=1; shift ;;
    --preflight)    PREFLIGHT_ONLY=1; shift ;;
    -h|--help)      usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

# ── Deno: prefer PATH, fall back to the standard installer location ─────────────────
DENO="$(command -v deno 2>/dev/null || true)"
[ -n "$DENO" ] || { [ -x "$HOME/.deno/bin/deno" ] && DENO="$HOME/.deno/bin/deno"; }
DENO_BIN="$(dirname "${DENO:-/usr/local/bin/deno}")"

# ── Runtime and model endpoint ─────────────────────────────────────────────────────
detect_runtime() {
  if [ -n "$RUNTIME" ]; then echo "$RUNTIME"; return; fi
  if [ "$(uname -s)" = "Darwin" ] && command -v container >/dev/null 2>&1; then echo "macos"; return; fi
  if command -v docker >/dev/null 2>&1; then echo "linux"; return; fi
  echo ""
}
RUNTIME="$(detect_runtime)"
[ -n "$RUNTIME" ] || { echo "FAIL no container runtime (container or docker) on PATH" >&2; exit 1; }
RUNNER="container"; [ "$RUNTIME" = "linux" ] && RUNNER="docker"

if [ -z "$MODEL_URL" ]; then
  if [ "$RUNTIME" = "macos" ]; then MODEL_URL="http://192.168.64.1:9931/v1"
  else MODEL_URL="http://host.docker.internal:9931/v1"; fi
fi

# ── System detection ──────────────────────────────────────────────────────────────
detect_cpus() {
  if [ "$(uname -s)" = "Darwin" ]; then sysctl -n hw.ncpu 2>/dev/null || echo 4
  else nproc 2>/dev/null || echo 4; fi
}
detect_ram_gb() {
  local bytes=0
  if [ "$(uname -s)" = "Darwin" ]; then bytes="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
  else bytes="$(awk '/MemTotal/{print $2*1024}' /proc/meminfo 2>/dev/null || echo 0)"; fi
  echo $(( bytes / 1024 / 1024 / 1024 ))
}

CPUS="$(detect_cpus)"
RAM_GB="$(detect_ram_gb)"
PER_EVAL_GB=4          # evals.ts runs each sandbox with --memory 4g
HOST_RESERVE_GB=8      # OS plus one loaded model on the llama-server
MEM_SLOTS=$(( (RAM_GB - HOST_RESERVE_GB) / PER_EVAL_GB ))
[ "$MEM_SLOTS" -lt 1 ] && MEM_SLOTS=1
CPU_SLOTS=$(( CPUS / 2 ))
[ "$CPU_SLOTS" -lt 1 ] && CPU_SLOTS=1
SAFE=$(( MEM_SLOTS < CPU_SLOTS ? MEM_SLOTS : CPU_SLOTS ))
[ "$SAFE" -gt "$MAX_CAP" ] && SAFE="$MAX_CAP"
[ "$SAFE" -lt 1 ] && SAFE=1

# ── Preflight: every check finishes fast ──────────────────────────────────────────
IMAGE_OK=0; MODEL_OK=0; CLEAN_OK=0; RUNTIME_OK=0; DENO_OK=0
run_preflight() {
  [ -n "$DENO" ] && DENO_OK=1
  if [ "$RUNTIME" = "macos" ]; then
    if "$RUNNER" system status 2>/dev/null | grep -qi "status.*running"; then RUNTIME_OK=1; fi
  else
    if "$RUNNER" info >/dev/null 2>&1; then RUNTIME_OK=1; fi
  fi
  if "$RUNNER" image ls 2>/dev/null | grep -q "^$IMAGE"; then IMAGE_OK=1; fi
  if curl -sf --max-time 2 "$MODEL_URL/models" >/dev/null 2>&1; then MODEL_OK=1; fi
  # Ignore the three files a recorded run writes, exactly as evals.ts does.
  dirty="$(git -C "$ROOT" status --porcelain | awk '{print $2}' | grep -vE '^(evals\.jsonl|README\.md|results\.svg)$' || true)"
  if [ -z "$dirty" ]; then CLEAN_OK=1; fi
}

if [ "$PREFLIGHT_ONLY" = 1 ] || [ "$DRY" = 1 ]; then
  run_preflight
  if [ "$JSON" = 1 ]; then
    printf '{"deno":%s,"runtime":%s,"image":%s,"model_server":%s,"clean_tree":%s}\n' \
      "$([ $DENO_OK = 1 ] && echo true || echo false)" \
      "$([ $RUNTIME_OK = 1 ] && echo true || echo false)" \
      "$([ $IMAGE_OK = 1 ] && echo true || echo false)" \
      "$([ $MODEL_OK = 1 ] && echo true || echo false)" \
      "$([ $CLEAN_OK = 1 ] && echo true || echo false)"
  else
    echo "preflight:"
    echo "  $([ $DENO_OK = 1 ] && echo ok || echo FAIL) deno ${DENO:-}"
    echo "  $([ $RUNTIME_OK = 1 ] && echo ok || echo FAIL) $RUNNER runtime ($RUNTIME)"
    echo "  $([ $IMAGE_OK = 1 ] && echo ok || echo 'warn') image $IMAGE$([ $IMAGE_OK = 1 ] || echo ' (will build on first run)')"
    echo "  $([ $MODEL_OK = 1 ] && echo ok || echo FAIL) model server $MODEL_URL"
    echo "  $([ $CLEAN_OK = 1 ] && echo ok || echo FAIL) clean git tree"
  fi
  [ "$PREFLIGHT_ONLY" = 1 ] && { [ $DENO_OK = 1 ] && [ $RUNTIME_OK = 1 ] && [ $MODEL_OK = 1 ] && [ $CLEAN_OK = 1 ] && exit 0 || exit 1; }
fi

# ── Decide the number: total runs, simultaneous workers, waves ────────────────────
requested="${PARALLEL:-$SAFE}"
case "$requested" in ''|*[!0-9]*) echo "FAIL --parallel must be a whole number 1..100" >&2; exit 2 ;; esac
[ "$requested" -lt 1 ] && { echo "FAIL --parallel must be at least 1" >&2; exit 2; }
[ "$requested" -gt 100 ] && { echo "FAIL --parallel must be at most 100" >&2; exit 2; }
RUNS="$requested"

conc="${CONCURRENCY:-$SAFE}"
case "$conc" in ''|*[!0-9]*) echo "FAIL --concurrency must be a whole number" >&2; exit 2 ;; esac
[ "$conc" -lt 1 ] && conc=1
[ "$conc" -gt "$RUNS" ] && conc="$RUNS"
[ "$conc" -gt "$SAFE" ] && conc="$SAFE"
CONC="$conc"
WAVES=$(( (RUNS + CONC - 1) / CONC ))

plan_text() {
  echo "run-evals plan:"
  echo "  machine:        $CPUS cpus, $RAM_GB GB ram"
  echo "  per eval:       ${PER_EVAL_GB} GB, host reserve ${HOST_RESERVE_GB} GB"
  echo "  safe concurrency: $SAFE"
  echo "  runs:           $RUNS"
  echo "  concurrent:     $CONC"
  echo "  waves:          $WAVES"
  echo "  runtime:        $RUNTIME ($RUNNER)"
  echo "  model server:   $MODEL_URL"
}

if [ "$DRY" = 1 ]; then
  if [ "$JSON" = 1 ]; then
    printf '{"cpus":%d,"ram_gb":%d,"per_eval_gb":%d,"host_reserve_gb":%d,"safe_concurrency":%d,"runs":%d,"concurrency":%d,"waves":%d,"runtime":"%s","model_server":"%s"}\n' \
      "$CPUS" "$RAM_GB" "$PER_EVAL_GB" "$HOST_RESERVE_GB" "$SAFE" "$RUNS" "$CONC" "$WAVES" "$RUNTIME" "$MODEL_URL"
  else
    plan_text
  fi
  exit 0
fi

run_preflight
[ $DENO_OK = 1 ] || { echo "FAIL deno not found (install from https://deno.com)" >&2; exit 1; }
[ $RUNTIME_OK = 1 ] || { echo "FAIL $RUNNER runtime not running" >&2; exit 1; }
[ $MODEL_OK = 1 ] || { echo "FAIL model server not reachable at $MODEL_URL/models" >&2; exit 1; }
[ $CLEAN_OK = 1 ] || { echo "FAIL commit first: --agent records one commit's behavior" >&2; git -C "$ROOT" status --short >&2; exit 1; }

if [ $IMAGE_OK != 1 ]; then
  echo "building $IMAGE once..."
  ctx="$(mktemp -d)"
  "$RUNNER" build --tag "$IMAGE" --file "$ROOT/Containerfile" "$ctx" >/dev/null 2>&1 || { echo "FAIL image build failed" >&2; rm -rf "$ctx"; exit 1; }
  rm -rf "$ctx"
fi

# ── Execute in waves, one git worktree per worker ────────────────────────────────
WORK="$(mktemp -d "${TMPDIR:-/tmp}/run-evals.XXXXXX")"
cleanup() {
  for wt in "$WORK"/wt-*; do
    [ -d "$wt" ] && git -C "$ROOT" worktree remove --force "$wt" >/dev/null 2>&1 || true
  done
  git -C "$ROOT" worktree prune >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

run_one() {
  local n="$1" wt="$WORK/wt-$1" out="$WORK/out-$1.log" rows="$WORK/rows-$1.jsonl" rc=0 before after
  : > "$rows"
  if ! git -C "$ROOT" worktree add --detach "$wt" HEAD >"$WORK/wt-$n.log" 2>&1; then
    echo "worker $n: worktree add failed (see $WORK/wt-$n.log)" >&2
    return 1
  fi
  before="$(wc -l < "$wt/evals.jsonl" 2>/dev/null | tr -d ' ' || echo 0)"
  [ -n "$before" ] || before=0
  ( cd "$wt" && PATH="$DENO_BIN:$PATH" HERDR_EVAL_MODEL_URL="$MODEL_URL" \
      "$DENO" run --quiet --allow-run --allow-read --allow-write --allow-net --allow-env \
      ./evals.ts "$RUNTIME" --agent ) >"$out" 2>&1 || rc=$?
  after="$(wc -l < "$wt/evals.jsonl" 2>/dev/null | tr -d ' ' || echo 0)"
  [ -n "$after" ] || after=0
  if [ "$after" -gt "$before" ]; then
    tail -n +$((before + 1)) "$wt/evals.jsonl" > "$rows"
  fi
  git -C "$ROOT" worktree remove --force "$wt" >/dev/null 2>&1 || true
  printf 'worker %d: rc=%d rows=%d\n' "$n" "$rc" "$((after - before))"
  return "$rc"
}

echo "=== run-evals: $RUNS run(s), $CONC at a time, $WAVES wave(s) ==="
plan_text
echo

FAILED=0
STARTED=0
for (( w = 0; w < WAVES; w++ )); do
  pids=()
  for (( k = 0; k < CONC; k++ )); do
    STARTED=$(( STARTED + 1 ))
    [ "$STARTED" -gt "$RUNS" ] && break
    run_one "$STARTED" &
    pids+=($!)
  done
  for pid in "${pids[@]}"; do
    wait "$pid" || FAILED=$(( FAILED + 1 ))
  done
done

# ── Merge rows and render once ────────────────────────────────────────────────────
: > "$WORK/merged.jsonl"
for f in "$WORK"/rows-*.jsonl; do [ -s "$f" ] && cat "$f" >> "$WORK/merged.jsonl"; done
ROWS=0
if [ -s "$WORK/merged.jsonl" ]; then
  ROWS="$(wc -l < "$WORK/merged.jsonl" | tr -d ' ')"
  cat "$WORK/merged.jsonl" >> "$ROOT/evals.jsonl"
  "$DENO" run --quiet --allow-read --allow-write --allow-env "$ROOT/render.ts" >/dev/null 2>&1 \
    || echo "WARN render.ts failed; re-run: deno run --allow-read --allow-write --allow-env render.ts" >&2
fi

OK=$(( RUNS - FAILED ))
echo
echo "=== run-evals summary ==="
echo "  runs:        $RUNS"
echo "  concurrent:  $CONC"
echo "  waves:       $WAVES"
echo "  succeeded:   $OK"
echo "  failed:      $FAILED"
echo "  rows merged: $ROWS"
if [ "$JSON" = 1 ]; then
  printf '{"runs":%d,"concurrency":%d,"waves":%d,"succeeded":%d,"failed":%d,"rows_merged":%d}\n' \
    "$RUNS" "$CONC" "$WAVES" "$OK" "$FAILED" "$ROWS"
fi
[ "$FAILED" -eq 0 ] && [ "$ROWS" -gt 0 ] && exit 0
exit 1
