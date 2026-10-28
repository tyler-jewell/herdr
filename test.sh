#!/bin/sh
# The only test. ./test.sh [arch]
# Default arch is macos: run the checks in an Apple container on this Mac.
# Inside that container the checks print one line each. The macos report is four
# sections, including when the test fails.
set -u

ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)

# Host entry. The container sets HERDR_SANDBOX=1 and runs this file again.
if [ "${HERDR_SANDBOX:-}" != 1 ]; then
  arch=${1:-macos}
  start_s=$(date +%s)
  ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
  # Revision under test, including a local change the commit does not have yet.
  pill_rev=$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || printf 'local')
  if [ -n "$(git -C "$ROOT" status --porcelain 2>/dev/null)" ]; then
    pill_rev="${pill_rev}+"
  fi
  NAME="herdr-test-$$"
  IMAGE="${HERDR_TEST_IMAGE:-herdr-sandbox}"
  WORK=$(mktemp -d)
  TEST_LOG="$WORK/test.log"
  MEM_LOG="$WORK/memory.log"
  SYS_LOG="$WORK/system.log"
  INFRA="$WORK/infra.log"
  RUN_LOG="$WORK/run.log"
  exit_code=1
  done_report=0
  started=0

  strip_noise() {
    sed -e $'s/\033\\[[0-9;]*[[:alpha:]]//g' -e 's/\r//g'
  }

  report() {
    [ "$done_report" -eq 1 ] && return 0
    done_report=1
    printf '== test ==\n'
    if [ -s "$TEST_LOG" ]; then
      strip_noise <"$TEST_LOG"
    else
      printf 'FAIL no test output\n'
    fi
    printf '== memory ==\n'
    if [ -s "$MEM_LOG" ]; then
      strip_noise <"$MEM_LOG"
    else
      printf 'unavailable\n'
    fi
    printf '== system ==\n'
    if [ -s "$SYS_LOG" ]; then
      strip_noise <"$SYS_LOG"
    else
      printf 'unavailable\n'
    fi
    printf '== result ==\n'
    if [ "$exit_code" -eq 0 ]; then
      printf 'pass\n'
    else
      printf 'fail %s\n' "$exit_code"
    fi
  }

  count_cases() {
    if [ ! -s "$TEST_LOG" ]; then
      printf '0'
      return 0
    fi
    strip_noise <"$TEST_LOG" | awk '
      /^ok / { n++ }
      /^FAIL / { n++ }
      END { print n + 0 }
    '
  }

  write_pill() {
    label=$1
    value=$2
    color=$3
    out=$4
    lw=$((${#label} * 7 + 14))
    vw=$((${#value} * 7 + 14))
    tw=$((lw + vw))
    lx=$((lw / 2))
    vx=$((lw + vw / 2))
    cat >"$out" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" width="$tw" height="20" role="img" aria-label="$label: $value">
  <clipPath id="r"><rect width="$tw" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="$lw" height="20" fill="#555"/>
    <rect x="$lw" width="$vw" height="20" fill="$color"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="$lx" y="14">$label</text>
    <text x="$vx" y="14">$value</text>
  </g>
</svg>
EOF
  }

  write_pills() {
    result=$1
    cases=$2
    seconds=$3
    color="#cb2431"
    [ "$result" = "pass" ] && color="#2ea44f"
    mkdir -p "$ROOT/badges"
    write_pill "$pill_rev" "$result" "$color" "$ROOT/badges/commit.svg"
    write_pill "tests" "$cases" "#007ec6" "$ROOT/badges/tests.svg"
    write_pill "time" "${seconds}s" "#007ec6" "$ROOT/badges/time.svg"
  }

  note_infra() {
    # Only the run error. System-start chatter stays out of the test log.
    if [ -s "$RUN_LOG" ]; then
      strip_noise <"$RUN_LOG" | awk 'NF && NR <= 8 { print }'
    fi
  }

  cleanup() {
    if [ "$started" -eq 1 ] && command -v container >/dev/null 2>&1; then
      container stop "$NAME" >>"$INFRA" 2>&1 || true
      container delete "$NAME" >>"$INFRA" 2>&1 || true
    fi
    rm -rf "$WORK"
  }

  trap 'trap - EXIT; report; cases=$(count_cases); result=fail; [ "$exit_code" -eq 0 ] && result=pass; cleanup; write_pills "$result" "$cases" "$(( $(date +%s) - start_s ))"; exit "$exit_code"' EXIT

  # shortcut: macos is the only arch, add the next one beside this arm when it exists
  case $arch in
    macos) ;;
    *)
      printf 'FAIL arch: %s is not supported\n' "$arch" >"$TEST_LOG"
      exit_code=1
      exit 1
      ;;
  esac

  if ! command -v container >/dev/null 2>&1; then
    printf 'FAIL container: Apple container CLI is not on PATH\n' >"$TEST_LOG"
    printf 'unavailable: container CLI is not installed\n' >"$SYS_LOG"
    exit_code=1
    exit 1
  fi

  container system start >>"$INFRA" 2>&1 || true

  capture_system() {
    {
      printf 'status:\n'
      container system status --format json 2>>"$INFRA" || printf 'status command failed\n'
      printf '\ndisk:\n'
      container system df 2>>"$INFRA" || printf 'df command failed\n'
    } >"$SYS_LOG" 2>>"$INFRA" || true
  }

  # Image build is root only so the runtime user is not. Runtime is a separate
  # machine: non-root, no capabilities, read-only root, no host mounts.
  # --quiet hangs this container CLI. Plain progress stays in the build log.
  if ! container build --progress plain --tag "$IMAGE" --file "$ROOT/sandbox/Containerfile" "$ROOT/sandbox" >"$WORK/build.log" 2>&1; then
    printf 'FAIL container: could not build the sandbox image\n' >"$TEST_LOG"
    strip_noise <"$WORK/build.log" | tail -n 8 >>"$TEST_LOG"
    capture_system
    exit_code=1
    exit 1
  fi

  if ! container run -d \
    --name "$NAME" \
    --progress none \
    --user 1000:1000 \
    --cap-drop ALL \
    --read-only \
    --tmpfs /tmp:size=256M,mode=1777 \
    --tmpfs /home/tester:size=512M,mode=1777 \
    --env HOME=/home/tester \
    --env USER=tester \
    "$IMAGE" \
    sleep infinity >>"$RUN_LOG" 2>&1; then
    printf 'FAIL container: could not start %s\n' "$IMAGE" >"$TEST_LOG"
    note_infra >>"$TEST_LOG"
    printf 'unavailable: container did not start\n' >"$MEM_LOG"
    capture_system
    exit_code=1
    exit 1
  fi
  started=1

  # Send only the setup files in. Nothing on the host is mounted.
  # skills/ is part of the assertion. Omit it when absent so the test can fail the check.
  tar_paths="apply config test.sh AGENTS.md CONTRIBUTING.md README.md agents/independent-reviewer.md sandbox/Containerfile"
  [ -d "$ROOT/skills" ] && tar_paths="$tar_paths skills"
  # shellcheck disable=SC2086
  COPYFILE_DISABLE=1 tar --no-xattrs -C "$ROOT" -cf - $tar_paths \
    | container exec -i \
      --user 1000:1000 \
      --env HOME=/home/tester \
      --env USER=tester \
      --env HERDR_SANDBOX=1 \
      --env PATH=/home/tester/.local/bin:/usr/local/bin:/usr/bin:/bin \
      "$NAME" \
      /bin/sh -c 'mkdir -p "$HOME/src" && tar -C "$HOME/src" -xf - && exec /bin/sh "$HOME/src/test.sh"' \
      >"$TEST_LOG" 2>&1 &
  test_pid=$!
  while kill -0 "$test_pid" 2>/dev/null; do
    container stats "$NAME" --format json --no-stream >"$WORK/stats.json" 2>>"$INFRA" || true
    sleep 2
  done &
  stats_pid=$!
  wait "$test_pid"
  exit_code=$?
  wait "$stats_pid" 2>/dev/null || true
  capture_system

  if [ -s "$WORK/stats.json" ] && command -v python3 >/dev/null 2>&1; then
    python3 - "$WORK/stats.json" >"$MEM_LOG" 2>>"$INFRA" <<'PY' || cp "$WORK/stats.json" "$MEM_LOG"
import json, sys
path = sys.argv[1]
raw = open(path, encoding="utf-8").read().strip()
try:
    data = json.loads(raw)
except Exception:
    sys.stdout.write(raw + ("\n" if raw and not raw.endswith("\n") else ""))
    raise SystemExit(0)
rows = data if isinstance(data, list) else [data]

def mb(n):
    if not isinstance(n, (int, float)):
        return "unknown"
    return "%.1f MiB" % (n / 1024 / 1024)

for row in rows:
    if not isinstance(row, dict):
        print(raw)
        raise SystemExit(0)
    print("container %s" % row.get("id", "unknown"))
    print("memory %s / %s" % (mb(row.get("memoryUsageBytes")), mb(row.get("memoryLimitBytes"))))
    print("cpu_usec %s" % row.get("cpuUsageUsec", "unknown"))
    print("pids %s" % row.get("numProcesses", "unknown"))
    print("net_rx %s" % row.get("networkRxBytes", "unknown"))
    print("net_tx %s" % row.get("networkTxBytes", "unknown"))
    print("block_read %s" % row.get("blockReadBytes", "unknown"))
    print("block_write %s" % row.get("blockWriteBytes", "unknown"))
PY
  elif [ -s "$WORK/stats.json" ]; then
    cp "$WORK/stats.json" "$MEM_LOG"
  else
    printf 'unavailable: container stats returned nothing\n' >"$MEM_LOG"
    note_infra >>"$MEM_LOG"
  fi

  # A passing test.sh ends with a line that is exactly "ok".
  if [ "$exit_code" -ne 0 ]; then
    exit "$exit_code"
  fi
  if ! grep -qx 'ok' "$TEST_LOG"; then
    printf 'FAIL test: exit 0 but the log has no final ok line\n' >>"$TEST_LOG"
    exit_code=1
    exit 1
  fi
  exit 0
fi

TMP=$(mktemp -d)
failed=0

cleanup() {
  rm -rf "$TMP"
}

trap 'code=$?; trap - EXIT; cleanup; if [ "$failed" -eq 0 ]; then printf "FAIL unexpected: line %s\n" "$LINENO"; code=1; fi; exit "$code"' EXIT

fail() {
  printf 'FAIL %s\n' "$1"
  failed=1
  exit 1
}

assert_status() {
  code=$1
  want=$2
  file=$3
  name=$4
  status=$5
  if [ "$code" -ne "$want" ]; then
    fail "$name: exit $code, want $want"
  fi
  if ! grep -q "\"status\": \"$status\"" "$file"; then
    fail "$name: status is not $status"
  fi
}

run() {
  home=$1
  os=$2
  out=$3
  set +e
  HERDR_SETUP_HOME="$home" \
    HERDR_SETUP_OS="$os" \
    HERDR_SETUP_SKIP_INSTALL=1 \
    HERDR_SETUP_SKIP_RELOAD=1 \
    "$ROOT/apply" >"$out" 2>"$out.err"
  code=$?
  set -e
  printf '%s' "$code"
}

set -e

# Default arch is macos, and that arch is the Apple container path in this file.
grep -q 'arch=${1:-macos}' "$ROOT/test.sh" || fail "arch: default is not macos"
grep -q 'container system start' "$ROOT/test.sh" || fail "arch: macos does not use Apple container"
printf 'ok arch\n'

# Official skill from apple/container. Required before this repo's container workflow.
skill="$ROOT/skills/container/SKILL.md"
[ -f "$skill" ] || fail "skill: missing skills/container/SKILL.md"
grep -q '^name: container$' "$skill" || fail "skill: SKILL.md name is not container"
grep -q 'github.com/apple/container' "$skill" || fail "skill: SKILL.md is not the Apple container skill"
[ -f "$ROOT/skills/container/references/docker-migration.md" ] || fail "skill: missing references/docker-migration.md"
[ -f "$ROOT/skills/container/references/container-machines.md" ] || fail "skill: missing references/container-machines.md"
printf 'ok skill\n'

# Every tool or service has a skill committed under skills/. The rule lives in CONTRIBUTING.md.
grep -q 'Every tool or service this repo uses has its skill in `skills/`' "$ROOT/CONTRIBUTING.md" || fail "skills: CONTRIBUTING.md does not require a committed skill per tool"
grep -q 'npx skills' "$ROOT/CONTRIBUTING.md" || fail "skills: CONTRIBUTING.md does not name npx skills"
printf 'ok skills-rule\n'

# Project files do not identify a person. Upstream skills are not part of this scan.
grep -q 'This repo does not identify a person' "$ROOT/CONTRIBUTING.md" || fail "identity: CONTRIBUTING.md does not forbid personal information"
for f in README.md AGENTS.md CONTRIBUTING.md apply config/config.toml agents/independent-reviewer.md sandbox/Containerfile test.sh; do
  [ -f "$ROOT/$f" ] || fail "identity: missing $f"
  if grep -Ei 'ty''ler|je''well|gm''ail\.com' "$ROOT/$f" >/dev/null; then
    fail "identity: $f identifies a person"
  fi
done
emails=$(grep -E -h -o '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' \
  "$ROOT/README.md" "$ROOT/AGENTS.md" "$ROOT/CONTRIBUTING.md" "$ROOT/apply" \
  "$ROOT/config/config.toml" "$ROOT/agents/independent-reviewer.md" \
  "$ROOT/sandbox/Containerfile" "$ROOT/test.sh" | grep -v '^tester@example.com$' || true)
[ -z "$emails" ] || fail "identity: email in a project file"
printf 'ok identity\n'

# The reviewer uses the container skill when a change touches that runtime.
reviewer="$ROOT/agents/independent-reviewer.md"
[ -f "$reviewer" ] || fail "reviewer: missing agents/independent-reviewer.md"
grep -q 'skills/container/SKILL.md' "$reviewer" || fail "reviewer: does not read skills/container/SKILL.md"
grep -q 'from start to finish before you judge' "$reviewer" || fail "reviewer: skill is not read before judging"
printf 'ok reviewer\n'

# Official tk package from tkhq/tk, installed by `tk skills install`. The only secrets and keys path.
tk_dir="$ROOT/skills/turnkey-tk"
tk_skill="$tk_dir/SKILL.md"
[ -f "$tk_skill" ] || fail "tk: missing skills/turnkey-tk/SKILL.md"
grep -q '^name: turnkey-tk$' "$tk_skill" || fail "tk: SKILL.md name is not turnkey-tk"
[ -f "$tk_dir/turnkey-tk.json" ] || fail "tk: missing turnkey-tk.json"
grep -q '"binaryVersion": "0.7.0"' "$tk_dir/turnkey-tk.json" || fail "tk: manifest is not tk 0.7.0"
grep -q 'github.com/tkhq/tk' "$tk_dir/docs/commands.md" || fail "tk: package is not tkhq/tk"
grep -q '^name: managing-secrets$' "$tk_dir/managing-secrets/SKILL.md" || fail "tk: missing managing-secrets"
awk '
  /"files"/ { infiles = 1; next }
  infiles && /\]/ { exit }
  infiles {
    gsub(/[",]/, "")
    gsub(/^[[:space:]]+|[[:space:]]+$/, "")
    if ($0 != "") print
  }
' "$tk_dir/turnkey-tk.json" >"$TMP/tk-files"
[ -s "$TMP/tk-files" ] || fail "tk: manifest lists no files"
while IFS= read -r rel; do
  [ -f "$tk_dir/$rel" ] || fail "tk: manifest file missing $rel"
done <"$TMP/tk-files"
grep -q 'only with `tk`' "$ROOT/AGENTS.md" || fail "tk: AGENTS.md does not require tk for secrets and keys"
grep -q 'tk skills install --into skills' "$ROOT/CONTRIBUTING.md" || fail "tk: CONTRIBUTING.md does not keep the tk install"
grep -q 'https://github.com/tkhq/tk/releases/tag/v0.7.0' "$ROOT/skills/turnkey-tk.SOURCE" || fail "tk: SOURCE is not tk 0.7.0"
printf 'ok tk\n'

# README pills: last run's result, case count, and seconds. The wrapper fills the svg files.
readme="$ROOT/README.md"
[ -f "$readme" ] || fail "pills: missing README.md"
grep -q 'badges/commit.svg' "$readme" || fail "pills: README has no commit pill"
grep -q 'badges/tests.svg' "$readme" || fail "pills: README has no tests pill"
grep -q 'badges/time.svg' "$readme" || fail "pills: README has no time pill"
printf 'ok pills\n'

code=$(run "$TMP/fresh" Darwin "$TMP/fresh.json")
assert_status "$code" 0 "$TMP/fresh.json" fresh applied
grep -q '"changed": true' "$TMP/fresh.json" || fail "fresh: expected changed true"
grep -q 'herdr-setup: 1' "$TMP/fresh/.config/herdr/config.toml" || fail "fresh: stamp missing"
cmp -s "$ROOT/config/config.toml" "$TMP/fresh/.config/herdr/config.toml" || fail "fresh: config bytes differ"
printf 'ok fresh\n'

code=$(run "$TMP/fresh" Darwin "$TMP/again.json")
assert_status "$code" 0 "$TMP/again.json" idempotent applied
grep -q '"changed": false' "$TMP/again.json" || fail "idempotent: expected changed false"
grep -q '"backup_path": null' "$TMP/again.json" || fail "idempotent: unexpected backup path"
find "$TMP/fresh/.config/herdr" -name 'config.toml.bak.*' | grep -q . && fail "idempotent: backup file exists"
printf 'ok idempotent\n'

printf 'onboarding = true\n' >"$TMP/fresh/.config/herdr/config.toml"
code=$(run "$TMP/fresh" Darwin "$TMP/drift.json")
assert_status "$code" 0 "$TMP/drift.json" drift applied
grep -q '"changed": true' "$TMP/drift.json" || fail "drift: expected changed true"
cmp -s "$ROOT/config/config.toml" "$TMP/fresh/.config/herdr/config.toml" || fail "drift: config was not replaced"
bak=$(find "$TMP/fresh/.config/herdr" -name 'config.toml.bak.*')
[ -n "$bak" ] || fail "drift: missing backup"
grep -q 'onboarding = true' "$bak" || fail "drift: backup lost the old config"
printf 'ok drift\n'

code=$(run "$TMP/linux" Linux "$TMP/linux.json")
assert_status "$code" 0 "$TMP/linux.json" linux applied
[ -f "$TMP/linux/.config/herdr/config.toml" ] || fail "linux: config missing"
printf 'ok linux\n'

set +e
HERDR_SETUP_HOME="$TMP/win" \
  HERDR_SETUP_OS="MINGW64_NT" \
  HERDR_SETUP_APPDATA="$TMP/win/AppData/Roaming" \
  HERDR_SETUP_SKIP_INSTALL=1 \
  HERDR_SETUP_SKIP_RELOAD=1 \
  "$ROOT/apply" >"$TMP/win.json" 2>"$TMP/win.err"
code=$?
set -e
assert_status "$code" 0 "$TMP/win.json" windows applied
[ -f "$TMP/win/AppData/Roaming/herdr/config.toml" ] || fail "windows: config missing"
printf 'ok windows\n'

set +e
HERDR_SETUP_HOME="$TMP/odd" \
  HERDR_SETUP_OS="Plan9" \
  HERDR_SETUP_SKIP_INSTALL=1 \
  HERDR_SETUP_SKIP_RELOAD=1 \
  "$ROOT/apply" >"$TMP/odd.json" 2>"$TMP/odd.err"
code=$?
set -e
assert_status "$code" 1 "$TMP/odd.json" unknown-os failed
grep -q '"next":' "$TMP/odd.json" || fail "unknown-os: missing next"
[ ! -d "$TMP/odd/.config/herdr" ] || fail "unknown-os: wrote a config"
printf 'ok unknown-os\n'

mkdir -p "$TMP/ro/.config"
chmod 555 "$TMP/ro/.config"
set +e
HERDR_SETUP_HOME="$TMP/ro" \
  HERDR_SETUP_OS="Darwin" \
  HERDR_SETUP_SKIP_INSTALL=1 \
  HERDR_SETUP_SKIP_RELOAD=1 \
  "$ROOT/apply" >"$TMP/ro.json" 2>"$TMP/ro.err"
code=$?
set -e
chmod 755 "$TMP/ro/.config" || true
assert_status "$code" 1 "$TMP/ro.json" unwritable failed
grep -q 'Nothing was written' "$TMP/ro.json" || fail "unwritable: missing refusal"
[ ! -f "$TMP/ro/.config/herdr/config.toml" ] || fail "unwritable: wrote a config"
printf 'ok unwritable\n'

mkdir -p "$TMP/bin"
set +e
PATH="$TMP/bin:/usr/bin:/bin" \
  HERDR_SETUP_HOME="$TMP/noherdr" \
  HERDR_SETUP_OS="Darwin" \
  HERDR_SETUP_SKIP_RELOAD=1 \
  HERDR_SETUP_INSTALL_CMD="echo installer-broke >&2; exit 9" \
  "$ROOT/apply" >"$TMP/noherdr.json" 2>"$TMP/noherdr.err"
code=$?
set -e
assert_status "$code" 2 "$TMP/noherdr.json" installer partial
grep -q 'installer-broke' "$TMP/noherdr.json" || fail "installer: log missing from report"
cmp -s "$ROOT/config/config.toml" "$TMP/noherdr/.config/herdr/config.toml" || fail "installer: config was not written"
printf 'ok installer\n'

ver=$(sed -n 's/^SETUP_VERSION=//p' "$ROOT/apply")
grep -q "herdr-setup: $ver" "$ROOT/config/config.toml" || fail "stamp: config stamp does not match SETUP_VERSION $ver"
printf 'ok stamp\n'

# Real setup. Only the macos arch sets HERDR_SANDBOX, and only inside the container as uid 1000.
[ "${HERDR_SANDBOX:-}" = 1 ] || fail "live: refused outside the sandbox"
[ "$(id -u)" -eq 0 ] && fail "live: refused as root"
touch /etc/herdr-sandbox-probe 2>/dev/null && fail "live: root filesystem is writable"
mount | grep -q ' /Users' && fail "live: host home is mounted"
[ -n "${HOME:-}" ] || fail "live: HOME unset"

export PATH="$HOME/.local/bin:$PATH"
set +e
"$ROOT/apply" >"$TMP/live.json" 2>"$TMP/live.err"
code=$?
set -e
assert_status "$code" 0 "$TMP/live.json" live applied
grep -q '"install": "installed"' "$TMP/live.json" || fail "live: Herdr was not installed"
cmp -s "$ROOT/config/config.toml" "$HOME/.config/herdr/config.toml" || fail "live: installed config is not the repo file"
command -v herdr >/dev/null 2>&1 || fail "live: herdr is not on PATH"
herdr --version >"$TMP/version.txt" 2>"$TMP/version.err" || fail "live: herdr --version failed"
printf 'ok live-apply\n'

herdr server >"$TMP/server.log" 2>&1 &
ready=0
i=0
while [ "$i" -lt 40 ]; do
  if herdr status server >"$TMP/status.txt" 2>"$TMP/status.err"; then
    ready=1
    break
  fi
  i=$((i + 1))
  sleep 0.5
done
[ "$ready" -eq 1 ] || fail "live: server did not become ready"
grep -Ei 'unknown (key|field)|invalid config|error:.*config' "$TMP/server.log" && fail "live: server rejected the config"
reload_ok=0
i=0
while [ "$i" -lt 10 ]; do
  if herdr server reload-config >"$TMP/reload.txt" 2>"$TMP/reload.err"; then
    reload_ok=1
    break
  fi
  i=$((i + 1))
  sleep 0.5
done
if [ "$reload_ok" -ne 1 ]; then
  detail=$(tr '\n' ' ' <"$TMP/reload.err" | cut -c 1-200)
  fail "live: reload-config failed: $detail"
fi
printf 'ok live-config\n'

herdr server agent-manifests --json >"$TMP/agents.json" 2>"$TMP/agents.err" || fail "live: agent manifests failed"
for agent in claude codex cursor grok opencode copilot; do
  grep -q "$agent" "$TMP/agents.json" || fail "live: agent manifests missing $agent"
done
herdr integration status >"$TMP/integrations.txt" 2>"$TMP/integrations.err" || fail "live: integration status failed"
herdr agent list >"$TMP/agent-list.txt" 2>"$TMP/agent-list.err" || fail "live: agent list failed"
printf 'ok live-agents\n'

herdr workspace create --cwd "$HOME" --label setup --no-focus >"$TMP/ws.json" 2>"$TMP/ws.err" || fail "live: workspace create failed"
pane=$(sed -n 's/.*"pane_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$TMP/ws.json" | head -n 1)
[ -n "$pane" ] || fail "live: workspace create returned no pane"
herdr pane split "$pane" --direction right --no-focus >"$TMP/split.json" 2>"$TMP/split.err" || fail "live: pane split failed"
herdr pane run "$pane" 'printf herdr-core-ok' >"$TMP/run.txt" 2>"$TMP/run.err" || fail "live: pane run failed"
herdr pane wait-output "$pane" --match herdr-core-ok --timeout 15000 >"$TMP/wait.txt" 2>"$TMP/wait.err" || fail "live: pane output missing"
herdr session list --json >"$TMP/sessions.json" 2>"$TMP/sessions.err" || fail "live: session list failed"
printf 'ok live-core\n'

git init -b main "$HOME/repo" >"$TMP/git.txt" 2>&1 || fail "live: git init failed"
git -C "$HOME/repo" config user.email tester@example.com
git -C "$HOME/repo" config user.name tester
printf 'a\n' >"$HOME/repo/README"
git -C "$HOME/repo" add README
git -C "$HOME/repo" commit -m setup >"$TMP/git.txt" 2>&1 || fail "live: git commit failed"
herdr worktree create --cwd "$HOME/repo" --branch setup-check --no-focus --trust-repository >"$TMP/wt.json" 2>"$TMP/wt.err" || fail "live: worktree create failed"
find "$HOME/.herdr/worktrees" -type d -name 'setup-check*' | grep -q . || fail "live: worktree was not created under ~/.herdr/worktrees"
printf 'ok live-worktree\n'

herdr server stop >"$TMP/stop.txt" 2>"$TMP/stop.err" || fail "live: server stop failed"
printf 'ok live-stop\n'

trap - EXIT
cleanup
printf 'ok\n'
exit 0
