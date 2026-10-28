#!/bin/sh
# Behavioral checks for ./apply. No network. No real home directory.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_status() {
  code=$1
  want=$2
  file=$3
  if [ "$code" -ne "$want" ]; then
    printf 'expected exit %s, got %s\n' "$want" "$code" >&2
    cat "$file" >&2
    fail "exit code"
  fi
  grep -q "\"status\": \"$(printf '%s' "$4")\"" "$file" || {
    cat "$file" >&2
    fail "status $4"
  }
}

run() {
  home=$1
  os=${2:-Darwin}
  out=$3
  shift 3
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

# Fresh machine: config appears and the report says applied.
code=$(run "$TMP/fresh" Darwin "$TMP/fresh.json")
assert_status "$code" 0 "$TMP/fresh.json" applied
grep -q '"changed": true' "$TMP/fresh.json" || fail "fresh should change"
grep -q 'herdr-setup: 1' "$TMP/fresh/.config/herdr/config.toml" || fail "stamp missing"
cmp -s "$ROOT/config/config.toml" "$TMP/fresh/.config/herdr/config.toml" || fail "fresh bytes differ"

# Second run: same file, no backup.
code=$(run "$TMP/fresh" Darwin "$TMP/again.json")
assert_status "$code" 0 "$TMP/again.json" applied
grep -q '"changed": false' "$TMP/again.json" || fail "second run should be unchanged"
grep -q '"backup_path": null' "$TMP/again.json" || fail "second run backed up"
find "$TMP/fresh/.config/herdr" -name 'config.toml.bak.*' | grep -q . && fail "unexpected backup"

# Drift: previous file is kept, then replaced with the repo file.
printf 'onboarding = true\n' >"$TMP/fresh/.config/herdr/config.toml"
code=$(run "$TMP/fresh" Darwin "$TMP/drift.json")
assert_status "$code" 0 "$TMP/drift.json" applied
grep -q '"changed": true' "$TMP/drift.json" || fail "drift should change"
cmp -s "$ROOT/config/config.toml" "$TMP/fresh/.config/herdr/config.toml" || fail "drift not replaced"
bak=$(find "$TMP/fresh/.config/herdr" -name 'config.toml.bak.*')
[ -n "$bak" ] || fail "missing backup"
grep -q 'onboarding = true' "$bak" || fail "backup lost the old config"

# Linux uses the same path shape.
code=$(run "$TMP/linux" Linux "$TMP/linux.json")
assert_status "$code" 0 "$TMP/linux.json" applied
[ -f "$TMP/linux/.config/herdr/config.toml" ] || fail "linux path"

# Windows Git Bash uses APPDATA.
set +e
HERDR_SETUP_HOME="$TMP/win" \
  HERDR_SETUP_OS="MINGW64_NT" \
  HERDR_SETUP_APPDATA="$TMP/win/AppData/Roaming" \
  HERDR_SETUP_SKIP_INSTALL=1 \
  HERDR_SETUP_SKIP_RELOAD=1 \
  "$ROOT/apply" >"$TMP/win.json" 2>"$TMP/win.err"
code=$?
set -e
assert_status "$code" 0 "$TMP/win.json" applied
[ -f "$TMP/win/AppData/Roaming/herdr/config.toml" ] || fail "windows path"

# Unknown OS: write nothing, tell the agent what to do.
set +e
HERDR_SETUP_HOME="$TMP/odd" \
  HERDR_SETUP_OS="Plan9" \
  HERDR_SETUP_SKIP_INSTALL=1 \
  HERDR_SETUP_SKIP_RELOAD=1 \
  "$ROOT/apply" >"$TMP/odd.json" 2>"$TMP/odd.err"
code=$?
set -e
assert_status "$code" 1 "$TMP/odd.json" failed
grep -q '"next":' "$TMP/odd.json" || fail "missing next"
[ ! -d "$TMP/odd/.config/herdr" ] || fail "unknown OS wrote a config"

# Unwritable parent: live tree untouched.
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
chmod 755 "$TMP/ro/.config"
assert_status "$code" 1 "$TMP/ro.json" failed
grep -q 'Nothing was written' "$TMP/ro.json" || fail "unwritable next step"
[ ! -f "$TMP/ro/.config/herdr/config.toml" ] || fail "wrote despite permissions"

# Installer failed: config still lands, exit 2, agent gets the log.
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
assert_status "$code" 2 "$TMP/noherdr.json" partial
grep -q 'installer-broke' "$TMP/noherdr.json" || fail "install log missing from report"
cmp -s "$ROOT/config/config.toml" "$TMP/noherdr/.config/herdr/config.toml" || fail "partial did not write config"

# Stamp in the repo file must match SETUP_VERSION in apply.
ver=$(sed -n 's/^SETUP_VERSION=//p' "$ROOT/apply")
grep -q "herdr-setup: $ver" "$ROOT/config/config.toml" || fail "stamp and SETUP_VERSION diverged"

printf 'ok\n'
