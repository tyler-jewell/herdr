#!/usr/bin/env -S deno run --quiet --allow-run --allow-read --allow-write --allow-net --allow-env
// Purpose: the one eval runner, on the host. Builds the sandbox from Containerfile, runs it locked down
//   (uid 1000, read-only root, no capabilities, tmpfs home, no host mounts), copies this tree in, and runs
//   checks.ts (default), an interactive shell (--shell), or agent.ts (--agent, which appends to evals.jsonl).
// Change when: the sandbox's isolation, runtime, copy, or modes change.
// Not for: what is checked (checks.ts), how the agent eval runs (agent.ts), row shapes (results.ts).
//
// ./evals.ts [macos|linux] [--shell|--agent]

import { command, DENO_FLAGS, onPath, repoFiles, ROOT } from "./lib.ts";
import { evalDefs, evalRows, latestRows, readmeWithResults, renderResults, rowError } from "./results.ts";

const arch = Deno.args[0] ?? "macos";
const mode = Deno.args[1] ?? "";
if (!["macos", "linux"].includes(arch) || !["", "--shell", "--agent"].includes(mode)) {
  console.log("usage: ./evals.ts [macos|linux] [--shell|--agent]");
  Deno.exit(2);
}
const runtime = arch === "linux" ? "docker" : "container";
if (!await onPath(runtime)) {
  console.log(`FAIL ${runtime} is not on PATH`);
  Deno.exit(1);
}
const image = "herdr-sandbox";
const name = `herdr-test-${Deno.pid}`;
// The sandbox reaches the host's llama-server through its gateway. See CONTRIBUTING.md, Evals.
const endpoint = Deno.env.get("HERDR_EVAL_MODEL_URL") ?? `http://${arch === "linux" ? "host.docker.internal" : "192.168.64.1"}:9931/v1`;
const env = [
  "--user", "1000:1000",
  "--env", "HOME=/home/tester", "--env", "USER=tester", "--env", "HERDR_SANDBOX=1", "--env", "DENO_NO_UPDATE_CHECK=1",
  "--env", "PATH=/home/tester/.local/bin:/usr/local/bin:/usr/bin:/bin",
  ...(mode === "--agent" ? ["--env", `HERDR_EVAL_MODEL_URL=${endpoint}`] : []),
];

async function cleanup(): Promise<void> {
  if (arch === "linux") await command("docker", ["rm", "-f", name]);
  else {
    await command("container", ["stop", name]);
    await command("container", ["delete", name]);
  }
}

async function start(): Promise<void> {
  if (arch === "macos") await command("container", ["system", "start"]);
  // Build from an empty context: the image needs nothing from this tree.
  const context = await Deno.makeTempDir();
  const build = await command(runtime, ["build", "--tag", image, "--file", `${ROOT}/Containerfile`, context]);
  await Deno.remove(context);
  if (build.code !== 0) throw new Error(`could not build the sandbox image:\n${(build.stdout + build.stderr).trim().split("\n").slice(-8).join("\n")}`);
  const tmpfs = arch === "linux" ? ",exec" : "";
  const run = await command(runtime, [
    "run", "-d", "--name", name, "--user", "1000:1000", "--memory", "4g",
    "--cap-drop", "ALL", "--read-only",
    "--tmpfs", `/tmp:size=256M,mode=1777${tmpfs}`,
    "--tmpfs", `/home/tester:size=1024M,mode=1777${tmpfs}`,
    ...(arch === "linux" ? ["--add-host", "host.docker.internal:host-gateway"] : []),
    image, "sleep", "infinity",
  ]);
  if (run.code !== 0) throw new Error(`could not start the sandbox: ${run.stderr.trim()}`);
  // Copy the repo in as git sees it. The agent eval never sees earlier results.
  const files = (await repoFiles()).filter((rel) => mode !== "--agent" || rel !== "evals.jsonl");
  const tar = new Deno.Command("tar", { args: ["--no-xattrs", "-C", ROOT, "-cf", "-", ...files], env: { ...Deno.env.toObject(), COPYFILE_DISABLE: "1" }, stdout: "piped", stderr: "null" }).spawn();
  const unpack = new Deno.Command(runtime, {
    args: ["exec", "-i", ...env, name, "/bin/sh", "-c", 'mkdir -p "$HOME/src" && tar -xf - -C "$HOME/src"'],
    stdin: "piped", stdout: "null", stderr: "piped",
  }).spawn();
  tar.stdout.pipeTo(unpack.stdin).catch(() => {});
  const unpacked = await unpack.output();
  if (unpacked.code !== 0) throw new Error(`could not copy the tree into the sandbox: ${new TextDecoder().decode(unpacked.stderr).trim()}`);
}

function inSandbox(script: string, stdout: "inherit" | "piped"): Deno.ChildProcess {
  return new Deno.Command(runtime, {
    args: ["exec", "-i", ...env, "--workdir", "/home/tester/src", name, "deno", "run", "--quiet", ...DENO_FLAGS.split(" "), script],
    stdin: "null", stdout, stderr: "inherit",
  }).spawn();
}

// The agent eval prints progress and one `ROW <json>` line. Only a valid row is appended, then rendered.
async function agent(): Promise<number> {
  const child = inSandbox("agent.ts", "piped");
  let row = "";
  let buffer = "";
  for await (const chunk of child.stdout.pipeThrough(new TextDecoderStream())) {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("ROW ")) row = line.slice(4);
      else console.log(line);
    }
  }
  const status = await child.status;
  if (status.code !== 0 || !row) return status.code || 1;
  const revision = (await command("git", ["-C", ROOT, "rev-parse", "--short", "HEAD"])).stdout.trim();
  const dirty = (await command("git", ["-C", ROOT, "status", "--porcelain"])).stdout.trim() ? "+" : "";
  const parsed = JSON.parse(row);
  const full = { at: new Date().toISOString(), revision: revision + dirty, ...parsed };
  const defs = evalDefs();
  const why = rowError(full, defs);
  if (why) {
    console.log(`FAIL agent: the row is not valid (${why}); nothing was recorded`);
    return 1;
  }
  await Deno.writeTextFile(`${ROOT}/evals.jsonl`, JSON.stringify(full) + "\n", { append: true });
  const readme = await Deno.readTextFile(`${ROOT}/README.md`);
  await Deno.writeTextFile(`${ROOT}/README.md`, readmeWithResults(readme, renderResults(latestRows(evalRows()), defs.judge_fields)));
  console.log(`recorded: evals.jsonl row ${evalRows().length}, README results updated`);
  return 0;
}

let code = 1;
try {
  await start();
  if (mode === "--shell") {
    Deno.addSignalListener("SIGINT", () => {});
    console.log("herdr sandbox: uid 1000, read-only root, no capabilities, no host mounts. The tree is in ~/src. Exit to delete it.");
    console.log(`  try: deno run ${DENO_FLAGS} ~/src/setup.ts`);
    const tty = new Deno.Command(runtime, { args: ["exec", "-it", ...env, "--workdir", "/home/tester/src", name, "bash", "-l"], stdin: "inherit", stdout: "inherit", stderr: "inherit" }).spawn();
    code = (await tty.status).code;
  } else if (mode === "--agent") {
    code = await agent();
  } else {
    code = (await inSandbox("checks.ts", "inherit").status).code;
  }
} catch (err) {
  console.log(`FAIL ${err instanceof Error ? err.message : err}`);
} finally {
  await cleanup();
}
Deno.exit(code);
