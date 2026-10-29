// Purpose: the behavior checks, run inside the sandbox by `./evals.ts`: apply, setup.ts, live Herdr,
//   identity, file headers, and the results rows.
// Change when: behavior is added or changed (a new OS path, refusal, exit code, report field, handoff),
//   or a repo rule becomes checkable. Check what a command does, never the wording of a doc.
// Not for: the sandbox itself (evals.ts), the agent eval (agent.ts), row shapes (results.ts).

import { command, DENO_FLAGS, exists, Fail, fail, findPaths, has, ok, ownedFiles, repoFiles, ROOT, sameBytes, sleep, text } from "./lib.ts";
import { evalDefs, evalRows, latestRows, readmeWithResults, renderResults, rowError } from "./results.ts";

if (Deno.env.get("HERDR_SANDBOX") !== "1") {
  console.log("FAIL checks.ts runs only inside the sandbox. Run ./evals.ts.");
  Deno.exit(1);
}

const tmp = await Deno.makeTempDir();
const home = Deno.env.get("HOME") ?? "";

async function runApply(dir: string, os: string, out: string, extra: Record<string, string> = {}): Promise<number> {
  const ran = await command(`${ROOT}/apply`, [], {
    env: { ...Deno.env.toObject(), HERDR_SETUP_HOME: dir, HERDR_SETUP_OS: os, HERDR_SETUP_SKIP_INSTALL: "1", HERDR_SETUP_SKIP_RELOAD: "1", ...extra },
  });
  await Deno.writeTextFile(out, ran.stdout);
  return ran.code;
}

function assertStatus(code: number, want: number, file: string, name: string, status: string): void {
  if (code !== want) fail(`${name}: exit ${code}, want ${want}`);
  if (!has(file, `"status": "${status}"`)) fail(`${name}: status is not ${status}`);
}

// deno run setup.ts with a fake home and no install or reload. Returns its one JSON line.
// deno-lint-ignore no-explicit-any
async function runSetup(path: string, dir: string, extra: Record<string, string> = {}, args: string[] = []): Promise<{ code: number; json: any }> {
  const env: Record<string, string> = { ...Deno.env.toObject(), HERDR_SETUP_HOME: dir, HERDR_SETUP_SKIP_INSTALL: "1", HERDR_SETUP_SKIP_RELOAD: "1", ...extra };
  if (!("HERDR_ENV" in extra)) delete env.HERDR_ENV;
  const ran = await command("deno", ["run", "--quiet", ...DENO_FLAGS.split(" "), path, ...args], { env });
  try {
    return { code: ran.code, json: JSON.parse(ran.stdout) };
  } catch {
    return { code: ran.code, json: {} };
  }
}

async function offline(): Promise<void> {
  // Every file this repo owns says what it is for and when to change it.
  for (const rel of await ownedFiles()) {
    const head = text(`${ROOT}/${rel}`).split("\n").slice(0, 16).join("\n");
    if (!/Purpose:/.test(head) || !/Change when:/.test(head) || !/Not for:/.test(head)) fail(`headers: ${rel} has no Purpose / Change when / Not for header`);
  }
  ok("headers");

  // No person in any file, the results rows included. The one exception is this repo's own GitHub slug.
  // Not people: the reserved example domain, no-reply service senders, and an OpenSSH extension name.
  const notPerson = (addr: string) => /@example\.(com|org)$|^noreply@|^session-bind@openssh\.com$/.test(addr);
  const person = new RegExp(["ty", "ler|je", "well|gm", "ail\\.com"].join(""), "i");
  for (const rel of await repoFiles()) {
    if (/^skills\/(turnkey-tk|container|herdr|ponytail)\//.test(rel) && !/(CHECKLIST|bootstrap)\.md$/.test(rel)) continue;
    const body = text(`${ROOT}/${rel}`).replaceAll("github.com/tyler-jewell/herdr", "").replaceAll("githubusercontent.com/tyler-jewell/herdr", "");
    if (person.test(body)) fail(`identity: ${rel} identifies a person`);
    if (/\/Users\/[A-Za-z]/.test(body)) fail(`identity: ${rel} has a home path`);
    for (const match of body.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
      if (!notPerson(match[0])) fail(`identity: ${rel} has an email address`);
    }
  }
  ok("identity");

  // Rows are only what the pipeline wrote: each one valid, and the README block rendered from them.
  const defs = evalDefs();
  const setupVersion = text(`${ROOT}/apply`).match(/^SETUP_VERSION=(.*)$/m)?.[1] ?? "";
  if (!defs.versions.some((v) => v.setup === setupVersion)) fail(`results: evals.json has no evals for setup ${setupVersion}`);
  for (const [n, row] of evalRows().entries()) {
    const why = rowError(row, defs);
    if (why) fail(`results: evals.jsonl row ${n + 1}: ${why}`);
  }
  const readme = text(`${ROOT}/README.md`);
  if (readmeWithResults(readme, renderResults(latestRows(), defs.judge_fields)) !== readme) fail("results: the README results block is not what evals.jsonl renders");
  ok("results");

  const ver = setupVersion;
  if (!has(`${ROOT}/config.toml`, `# herdr-setup: ${ver}`)) fail(`stamp: config.toml is not stamped herdr-setup: ${ver}`);
  ok("stamp");

  let code = await runApply(`${tmp}/fresh`, "Darwin", `${tmp}/fresh.json`);
  assertStatus(code, 0, `${tmp}/fresh.json`, "fresh", "applied");
  if (!has(`${tmp}/fresh.json`, '"changed": true')) fail("fresh: expected changed true");
  if (!await sameBytes(`${ROOT}/config.toml`, `${tmp}/fresh/.config/herdr/config.toml`)) fail("fresh: config bytes differ");
  ok("fresh");

  code = await runApply(`${tmp}/fresh`, "Darwin", `${tmp}/again.json`);
  assertStatus(code, 0, `${tmp}/again.json`, "idempotent", "applied");
  if (!has(`${tmp}/again.json`, '"changed": false') || !has(`${tmp}/again.json`, '"backup_path": null')) fail("idempotent: second run changed or backed up");
  ok("idempotent");

  await Deno.writeTextFile(`${tmp}/fresh/.config/herdr/config.toml`, "onboarding = true\n");
  code = await runApply(`${tmp}/fresh`, "Darwin", `${tmp}/drift.json`);
  assertStatus(code, 0, `${tmp}/drift.json`, "drift", "applied");
  if (!await sameBytes(`${ROOT}/config.toml`, `${tmp}/fresh/.config/herdr/config.toml`)) fail("drift: config was not replaced");
  const bak = await findPaths(`${tmp}/fresh/.config/herdr`, (_p, name) => name.startsWith("config.toml.bak."));
  if (!bak.length || !has(bak[0], "onboarding = true")) fail("drift: the old config was not backed up");
  ok("drift");

  code = await runApply(`${tmp}/linux`, "Linux", `${tmp}/linux.json`);
  assertStatus(code, 0, `${tmp}/linux.json`, "linux", "applied");
  if (!await exists(`${tmp}/linux/.config/herdr/config.toml`)) fail("linux: config missing");
  ok("linux");

  code = await runApply(`${tmp}/win`, "MINGW64_NT", `${tmp}/win.json`, { HERDR_SETUP_APPDATA: `${tmp}/win/AppData/Roaming` });
  assertStatus(code, 0, `${tmp}/win.json`, "windows", "applied");
  if (!await exists(`${tmp}/win/AppData/Roaming/herdr/config.toml`)) fail("windows: config missing");
  ok("windows");

  code = await runApply(`${tmp}/odd`, "Plan9", `${tmp}/odd.json`);
  assertStatus(code, 1, `${tmp}/odd.json`, "unknown-os", "failed");
  if (await exists(`${tmp}/odd/.config/herdr`)) fail("unknown-os: wrote a config");
  ok("unknown-os");

  await Deno.mkdir(`${tmp}/ro/.config`, { recursive: true });
  await Deno.chmod(`${tmp}/ro/.config`, 0o555);
  code = await runApply(`${tmp}/ro`, "Darwin", `${tmp}/ro.json`);
  await Deno.chmod(`${tmp}/ro/.config`, 0o755);
  assertStatus(code, 1, `${tmp}/ro.json`, "unwritable", "failed");
  if (await exists(`${tmp}/ro/.config/herdr/config.toml`)) fail("unwritable: wrote a config");
  ok("unwritable");

  await Deno.mkdir(`${tmp}/bin`, { recursive: true });
  code = await runApply(`${tmp}/noherdr`, "Darwin", `${tmp}/noherdr.json`, {
    PATH: `${tmp}/bin:/usr/bin:/bin`,
    HERDR_SETUP_SKIP_INSTALL: "0",
    HERDR_SETUP_INSTALL_CMD: "echo installer-broke >&2; exit 9",
  });
  assertStatus(code, 2, `${tmp}/noherdr.json`, "installer", "partial");
  if (!has(`${tmp}/noherdr.json`, "installer-broke")) fail("installer: log missing from report");
  if (!await sameBytes(`${ROOT}/config.toml`, `${tmp}/noherdr/.config/herdr/config.toml`)) fail("installer: config was not written");
  ok("installer");

  const setup = await runSetup(`${ROOT}/setup.ts`, `${tmp}/setup-home`);
  if (setup.code !== 0 || setup.json.required !== true || !String(setup.json.prompt).includes("/bootstrap")) fail(`setup: exit ${setup.code}, or no required /bootstrap prompt`);
  if (setup.json.handoff !== "printed") fail("setup: outside Herdr the handoff is not printed");
  ok("setup");

  // A machine with no checkout: setup.ts alone, cloned from a local repo instead of GitHub.
  const origin = `${tmp}/origin`;
  await command("cp", ["-R", `${ROOT}/.`, origin]);
  const git = (...args: string[]) => command("git", ["-c", "user.email=tester@example.com", "-c", "user.name=tester", "-C", origin, ...args]);
  await git("init", "-q", "-b", "main");
  await git("add", "-A");
  if ((await git("commit", "-q", "-m", "setup")).code !== 0) fail("setup-remote: could not commit the origin");
  const head = (await git("rev-parse", "HEAD")).stdout.trim();
  await Deno.mkdir(`${tmp}/solo`);
  await Deno.copyFile(`${ROOT}/setup.ts`, `${tmp}/solo/setup.ts`);
  const solo = (dir: string) => runSetup(`${tmp}/solo/setup.ts`, dir, { HERDR_SETUP_REPO: `${origin}#main` });
  const harness = `${tmp}/remote-home/.herdr/harness`;
  let remote = await solo(`${tmp}/remote-home`);
  if (remote.code !== 0 || remote.json.harness?.path !== harness || remote.json.harness?.revision !== head) fail("setup-remote: did not clone and apply the origin revision");
  remote = await solo(`${tmp}/remote-home`);
  if (remote.code !== 0 || remote.json.apply?.changed !== false) fail("setup-remote: second run is not idempotent");
  await Deno.writeTextFile(`${harness}/hand-edit`, "x\n");
  remote = await solo(`${tmp}/remote-home`);
  if (remote.code !== 1 || !String(remote.json.message).includes("local changes")) fail("setup-remote: a hand-edited harness was not refused");
  await Deno.mkdir(`${tmp}/stray-home/.herdr/harness/keep`, { recursive: true });
  remote = await solo(`${tmp}/stray-home`);
  if (remote.code !== 1 || !await exists(`${tmp}/stray-home/.herdr/harness/keep`)) fail("setup-remote: a stray harness folder was not refused and kept");
  ok("setup-remote");
}

async function live(): Promise<void> {
  if ((await command("id", ["-u"])).stdout.trim() === "0") fail("live: refused as root");
  try {
    await Deno.writeTextFile("/etc/herdr-sandbox-probe", "");
    fail("live: root filesystem is writable");
  } catch (err) {
    if (err instanceof Fail) throw err;
  }
  const env = { ...Deno.env.toObject(), PATH: `${home}/.local/bin:${Deno.env.get("PATH") ?? ""}` };
  const herdr = (...args: string[]) => command("herdr", args, { env });

  const applied = await command(`${ROOT}/apply`, [], { env });
  await Deno.writeTextFile(`${tmp}/live.json`, applied.stdout);
  assertStatus(applied.code, 0, `${tmp}/live.json`, "live-apply", "applied");
  if (!has(`${tmp}/live.json`, '"install": "installed"')) fail("live-apply: Herdr was not installed");
  if (!has(`${tmp}/live.json`, '"reload": "skipped"')) fail("live-apply: reload was tried with no server running");
  if (!await sameBytes(`${ROOT}/config.toml`, `${home}/.config/herdr/config.toml`)) fail("live-apply: installed config is not the repo file");
  ok("live-apply");

  const log = await Deno.open(`${tmp}/server.log`, { write: true, create: true });
  const server = new Deno.Command("herdr", { args: ["server"], env, stdout: "piped", stderr: "piped" }).spawn();
  server.stdout.pipeTo(log.writable, { preventClose: true }).catch(() => {});
  server.stderr.pipeTo(new WritableStream({ write: (chunk) => void log.write(chunk) })).catch(() => {});
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) {
    ready = (await herdr("status", "server", "--json")).stdout.includes('"running":true');
    if (!ready) await sleep(500);
  }
  if (!ready) fail("live-config: server did not start");
  if (/unknown (key|field)|invalid config|error:.*config/i.test(await Deno.readTextFile(`${tmp}/server.log`).catch(() => ""))) fail("live-config: server rejected config.toml");
  const again = await command(`${ROOT}/apply`, [], { env });
  if (again.code !== 0 || !again.stdout.includes('"reload": "reloaded"')) fail("live-config: apply did not reload the running server");
  ok("live-config");

  const manifests = await herdr("server", "agent-manifests", "--json");
  for (const kind of ["pi", "claude", "codex", "grok", "opencode"]) {
    if (!manifests.stdout.includes(kind)) fail(`live-agents: Herdr does not detect ${kind}`);
  }
  ok("live-agents");

  const ws = await herdr("workspace", "create", "--cwd", home, "--label", "checks", "--no-focus");
  const pane = ws.stdout.match(/"pane_id"\s*:\s*"([^"]*)"/)?.[1] ?? "";
  if (!pane) fail("live-core: workspace create returned no pane");
  if ((await herdr("pane", "run", pane, "printf herdr-core-ok")).code !== 0) fail("live-core: pane run failed");
  if ((await herdr("pane", "wait-output", pane, "--match", "herdr-core-ok", "--timeout", "15000")).code !== 0) fail("live-core: pane output missing");
  ok("live-core");

  // setup.ts as if run in that pane.
  const inPane = { HERDR_ENV: "1", HERDR_PANE_ID: pane, PATH: env.PATH };
  const panes = async () => ((await herdr("pane", "list")).stdout.match(/"pane_id"/g) ?? []).length;
  let handed = await runSetup(`${ROOT}/setup.ts`, `${tmp}/handoff-home`, inPane);
  if (handed.code !== 0 || handed.json.handoff !== "needs-kind" || !handed.json.kinds?.includes("pi")) fail("setup-handoff: no kind did not list the kinds");
  const before = await panes();
  handed = await runSetup(`${ROOT}/setup.ts`, `${tmp}/handoff-home`, inPane, ["--agent", "claude"]);
  if (handed.code !== 1 || handed.json.handoff !== "failed" || !String(handed.json.handoff_detail).startsWith("agent start")) fail("setup-handoff: a missing agent did not fail at agent start");
  if (await panes() !== before) fail("setup-handoff: the failed agent pane was left open");
  ok("setup-handoff");

  // A new pane gets the server's environment, so setup.ts must pass Pi's own directory through.
  const piDir = `${tmp}/pi-forward`;
  await Deno.mkdir(piDir);
  handed = await runSetup(`${ROOT}/setup.ts`, `${tmp}/handoff-home`, { ...inPane, PI_CODING_AGENT_DIR: piDir, PI_OFFLINE: "1" }, ["--agent", "pi"]);
  if (handed.code !== 0 || handed.json.handoff !== "started") fail(`env-forward: pi did not start: ${handed.json.handoff_detail ?? handed.json.message}`);
  // Pi writes settings.json into its directory as soon as it starts, so the file proves which one it used.
  let used = false;
  for (let i = 0; i < 20 && !used; i++) {
    used = await exists(`${piDir}/settings.json`);
    if (!used) await sleep(500);
  }
  await herdr("pane", "close", handed.json.pane);
  if (!used) fail("env-forward: the agent pane did not get PI_CODING_AGENT_DIR");
  ok("env-forward");

  const repo = `${home}/repo`;
  await command("git", ["init", "-q", "-b", "main", repo]);
  await Deno.writeTextFile(`${repo}/README`, "a\n");
  await command("git", ["-C", repo, "add", "README"]);
  await command("git", ["-c", "user.email=tester@example.com", "-c", "user.name=tester", "-C", repo, "commit", "-q", "-m", "setup"]);
  if ((await herdr("worktree", "create", "--cwd", repo, "--branch", "checks", "--no-focus", "--trust-repository")).code !== 0) fail("live-worktree: worktree create failed");
  if (!(await findPaths(`${home}/.herdr/worktrees`, (_p, name, isDir) => isDir && name.startsWith("checks"))).length) fail("live-worktree: worktree is not under ~/.herdr/worktrees");
  ok("live-worktree");

  if ((await herdr("server", "stop")).code !== 0) fail("live-stop: server stop failed");
  ok("live-stop");
}

let code = 0;
try {
  await offline();
  await live();
  console.log("pass");
} catch (err) {
  code = 1;
  if (!(err instanceof Fail)) console.log(`FAIL unexpected: ${err instanceof Error ? err.message : err}`);
  console.log("fail");
} finally {
  await Deno.remove(tmp, { recursive: true }).catch(() => {});
}
Deno.exit(code);
