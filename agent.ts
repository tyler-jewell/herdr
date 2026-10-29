// Purpose: the agent eval, run inside the sandbox by `./evals.ts macos --agent`. Pi runs the eval prompt
//   inside Herdr on the local agent model, then Pi on the local judge model grades the whole session with
//   REVIEWER.md. Prints one result row as `ROW <json>`.
// Change when: how the agent is started, prompted, or judged changes.
// Not for: which evals exist or which models run (evals.json), the grading rules (REVIEWER.md),
//   row shapes (results.ts), the sandbox (evals.ts).

import { command, findPaths, ROOT, sleep, text } from "./lib.ts";
import { capabilityDefs, computeMetrics, evalDefs, judgeMetrics, parseSession, type Session, type Verdict, verdictError } from "./results.ts";

const say = (line: string) => console.log(line);
const home = Deno.env.get("HOME") ?? "";
const endpoint = Deno.env.get("HERDR_EVAL_MODEL_URL") ?? "";
const defs = evalDefs();
const setup = text(`${ROOT}/apply`).match(/^SETUP_VERSION=(.*)$/m)?.[1] ?? "";
const item = defs.versions.find((v) => v.setup === setup)?.evals[0];
if (Deno.env.get("HERDR_SANDBOX") !== "1" || !endpoint || !item) {
  say("FAIL agent.ts runs only inside the sandbox, with HERDR_EVAL_MODEL_URL and an eval for this setup version. Run ./evals.ts macos --agent.");
  Deno.exit(1);
}
const env = { ...Deno.env.toObject(), PATH: `${home}/.local/bin:${Deno.env.get("PATH") ?? ""}` };

async function piSession(dir: string): Promise<Session> {
  const files = await findPaths(dir, (_p, name) => name.endsWith(".jsonl"));
  if (files.length !== 1) throw new Error(`expected one Pi session in ${dir}, found ${files.length}`);
  return parseSession(await Deno.readTextFile(files[0]));
}

// Every file in the sandbox's writable folders, by size and modification time, minus the harness's own state
// (Pi's directory, the judge's, Herdr's). Compared before and after the prompt, it is what the run changed.
async function snapshot(): Promise<Map<string, string>> {
  const skip = [`${home}/pi/`, `${home}/judge/`, `${home}/.config/herdr/`];
  const files = new Map<string, string>();
  for (const root of [home, "/tmp"]) {
    for (const path of await findPaths(root, (_p, _n, isDir) => !isDir)) {
      if (skip.some((dir) => path.startsWith(dir))) continue;
      const stat = await Deno.lstat(path).catch(() => null);
      if (stat) files.set(path, `${stat.size} ${stat.mtime?.getTime()}`);
    }
  }
  return files;
}

function changedFiles(before: Map<string, string>, after: Map<string, string>): string[] {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths].filter((p) => before.get(p) !== after.get(p)).map((p) => p.replace(home, "~")).sort();
}

// Paths inside the sandbox are the only machine detail in a session. Keep them short and neutral.
function scrub(session: Session): Session {
  return JSON.parse(JSON.stringify(session).replaceAll(home, "~"));
}

try {
  // Herdr through this repo's own entry, as on any machine.
  const applied = await command(`${ROOT}/apply`, [], { env });
  if (applied.code !== 0) throw new Error(`apply: ${applied.stdout.trim()}`);

  // Pi is configured only through its own files, and joined to Herdr by Herdr's built-in integration.
  const piDir = `${home}/pi`;
  await Deno.mkdir(piDir);
  await Deno.writeTextFile(`${piDir}/models.json`, JSON.stringify({
    providers: {
      local: {
        baseUrl: endpoint,
        api: "openai-completions",
        apiKey: "local",
        compat: { supportsDeveloperRole: false, supportsReasoningEffort: false },
        models: [defs.models.agent, defs.models.judge].map((id) => ({ id, reasoning: true, contextWindow: 65536 })),
      },
    },
  }));
  await Deno.writeTextFile(`${piDir}/settings.json`, JSON.stringify({ defaultProvider: "local", defaultModel: defs.models.agent }));
  const piEnv = { ...env, PI_CODING_AGENT_DIR: piDir, PI_OFFLINE: "1" };
  if ((await command("herdr", ["integration", "install", "pi"], { env: piEnv })).code !== 0) throw new Error("herdr integration install pi failed");

  // The agent works in its own copy, so nothing it does can reach what the judge reads.
  const work = `${home}/work`;
  await command("cp", ["-R", `${ROOT}/.`, work]);

  const h = (...args: string[]) => command("herdr", ["--session", "eval", ...args], { env: piEnv });
  new Deno.Command("herdr", { args: ["--session", "eval", "server"], env: piEnv, stdout: "null", stderr: "null" }).spawn();
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    up = (await h("status", "server", "--json")).stdout.includes('"running":true');
    if (!up) await sleep(250);
  }
  if (!up) throw new Error("the eval Herdr session did not start");
  const pane = JSON.parse((await h("workspace", "create", "--cwd", work, "--label", "eval", "--no-focus")).stdout).result.root_pane.pane_id;
  const started = await h("agent", "start", "eval", "--kind", "pi", "--pane", pane, "--timeout", "300000");
  if (started.code !== 0) throw new Error(`agent start: ${started.stderr.trim()}`);
  say(`agent: pi on ${defs.models.agent}, eval ${item.id}: ${item.prompt}`);
  const before = await snapshot();
  const t0 = Date.now();
  const prompted = await h("agent", "prompt", "eval", item.prompt, "--wait", "--timeout", "1800000");
  if (prompted.code !== 0) throw new Error(`agent prompt: ${prompted.stderr.trim()}`);
  // Pi can report idle while it still compacts or holds queued input. Wait until its screen settles.
  for (let i = 0; i < 360; i++) {
    const screen = (await h("agent", "read", "eval", "--source", "recent-unwrapped", "--lines", "30")).stdout;
    if (!/Auto-compacting|Queued message|Working\.\.\./.test(screen)) break;
    await sleep(5000);
  }
  const seconds = Math.round((Date.now() - t0) / 1000);
  const changed = changedFiles(before, await snapshot());
  const session = scrub(await piSession(`${piDir}/sessions`));
  const metrics = computeMetrics(session, seconds, changed);
  await h("server", "stop");
  say(`run: ${JSON.stringify(metrics)}${changed.length ? ` changed: ${changed.join(", ")}` : ""}`);

  // The judge reads REVIEWER.md, the docs, and the whole session, with read-only tools, from the clean tree.
  const judgeDir = `${home}/judge`;
  await Deno.mkdir(`${judgeDir}/sessions`, { recursive: true });
  const logPath = `${judgeDir}/session.jsonl`;
  await Deno.writeTextFile(logPath, session.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
  const caps = capabilityDefs();
  const required = caps.filter((c) => c.required).map((c) => c.id);
  const optional = caps.filter((c) => !c.required).map((c) => c.id);
  const ask = [
    "You are the independent reviewer. Read REVIEWER.md in this directory and do what its \"Score an agent run\" section says. capabilities.json has each capability's rubric and the 1-10 scale.",
    `The run: eval ${item.id}, prompt exactly: ${item.prompt}`,
    `Model under test: ${defs.models.agent} (local), harness Pi inside Herdr.`,
    `The whole Pi session log, one JSON entry per line: ${logPath}`,
    `Measured from the run: ${JSON.stringify(metrics)}${changed.length ? `; files it changed: ${changed.join(", ")}` : "; it changed no files"}`,
    "Reply with only one JSON object and nothing else, with exactly these keys:",
    "score (integer 1-10, the whole run),",
    `capabilities (an object of integer 1-10 scores: always ${required.join(", ")}; also any of ${optional.join(", ")} that the session exercised),`,
    "evidence (an object with one short line per scored capability, naming the log entry),",
    `labels ({domain: one of ${defs.labels.domain.join(" ")}; task_type: one of ${defs.labels.task_type.join(" ")}; outcome: one of ${defs.labels.outcome.join(" ")}}),`,
    "depth (how much of the log you read), reason (a few lines), findings (a list of strings, each naming a log entry or file).",
  ].join("\n");
  const judgeArgs = ["-p", "--model", `local/${defs.models.judge}`, "--tools", "read,grep,find,ls", "--session-dir", `${judgeDir}/sessions`];
  const j0 = Date.now();
  let verdict: Verdict | null = null;
  let why = "";
  for (let attempt = 0; attempt < 2 && !verdict; attempt++) {
    const prompt = attempt === 0 ? ask : `That reply is not usable: ${why}. Reply with only the JSON object.`;
    const judged = await command("pi", [...judgeArgs, ...(attempt ? ["--continue"] : []), prompt], { cwd: ROOT, env: piEnv });
    const raw = judged.stdout.slice(judged.stdout.indexOf("{"), judged.stdout.lastIndexOf("}") + 1);
    try {
      const parsed = JSON.parse(raw) as Verdict;
      why = verdictError(parsed, defs.labels, caps) ?? "";
      if (!why) verdict = parsed;
    } catch {
      why = `no JSON object in the reply (${judged.stderr.trim().slice(0, 200) || judged.stdout.trim().slice(0, 200)})`;
    }
  }
  if (!verdict) throw new Error(`judge: ${why}`);
  const judgeSession = scrub(await piSession(`${judgeDir}/sessions`));
  const judge = { model: defs.models.judge, metrics: judgeMetrics(judgeSession, Math.round((Date.now() - j0) / 1000)) };
  say(`score: ${verdict.score}/10 (${verdict.labels.domain}, ${verdict.labels.task_type}, ${verdict.labels.outcome}). ${verdict.reason}`);
  say(`capabilities: ${Object.entries(verdict.capabilities).map(([id, n]) => `${id} ${n}`).join(", ")}`);
  say(`judge: ${judge.model}, ${JSON.stringify(judge.metrics)}`);

  // Only the known verdict fields, so nothing extra the judge wrote reaches the row.
  const scored = Object.keys(verdict.capabilities);
  const row = {
    setup, eval: item.id, prompt: item.prompt, harness: "pi", model: defs.models.agent, metrics,
    score: verdict.score,
    capabilities: Object.fromEntries(scored.map((id) => [id, verdict!.capabilities[id]])),
    evidence: Object.fromEntries(scored.map((id) => [id, verdict!.evidence[id]])),
    labels: { domain: verdict.labels.domain, task_type: verdict.labels.task_type, outcome: verdict.labels.outcome },
    depth: verdict.depth ?? "", reason: verdict.reason, findings: verdict.findings,
    changed_files: changed, judge, sessions: { agent: session, judge: judgeSession },
  };
  console.log(`ROW ${JSON.stringify(row)}`);
  Deno.exit(0);
} catch (err) {
  say(`FAIL agent: ${err instanceof Error ? err.message : err}`);
  Deno.exit(1);
}
