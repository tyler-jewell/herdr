// Purpose: the agent eval, run inside the sandbox by `./evals.ts macos --agent`. Pi runs the eval prompt
//   inside Herdr on the local agent model, then Pi on the local judge model grades the whole session with
//   REVIEWER.md. Prints one result row as `ROW <json>`.
// Change when: how the agent is started, prompted, or judged changes.
// Not for: which evals exist or which models run (evals.json), the grading rules (REVIEWER.md),
//   row shapes (results.ts), the sandbox (evals.ts).

import { command, findPaths, ROOT, sleep, text } from "./lib.ts";
import { evalDefs, parseSession, type Session, sessionMetrics, type Verdict, verdictError } from "./results.ts";

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
  const session = scrub(await piSession(`${piDir}/sessions`));
  const run = { ...sessionMetrics(session, seconds), session };
  await h("server", "stop");
  say(`run: ${run.seconds}s, ${run.turns} turns, ${run.tool_calls} tool calls ${JSON.stringify(run.tools)}, tokens ${JSON.stringify(run.tokens)}`);

  // The judge reads REVIEWER.md, the docs, and the whole session, with read-only tools, from the clean tree.
  const judgeDir = `${home}/judge`;
  await Deno.mkdir(`${judgeDir}/sessions`, { recursive: true });
  const logPath = `${judgeDir}/session.jsonl`;
  await Deno.writeTextFile(logPath, session.map((entry) => JSON.stringify(entry)).join("\n") + "\n");
  const { session: _s, ...measured } = run;
  const f = defs.judge_fields;
  const ask = [
    "You are the independent reviewer. Read REVIEWER.md in this directory and do what its \"Score an agent run\" section says.",
    `The run: eval ${item.id}, prompt exactly: ${item.prompt}`,
    `Model under test: ${defs.models.agent} (local), harness Pi inside Herdr.`,
    `The whole Pi session log, one JSON entry per line: ${logPath}`,
    `Measured from that log: ${JSON.stringify(measured)}`,
    "Reply with only one JSON object and nothing else, with exactly these keys:",
    `grade (one of A B C D F), domain (one of ${f.domain.join(" ")}), task_type (one of ${f.task_type.join(" ")}), outcome (one of ${f.outcome.join(" ")}),`,
    `capabilities (a list of {name, grade, evidence}, name one of ${f.capability.join(" ")}, only those the session exercised),`,
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
      why = verdictError(parsed, f) ?? "";
      if (!why) verdict = parsed;
    } catch {
      why = `no JSON object in the reply (${judged.stderr.trim().slice(0, 200) || judged.stdout.trim().slice(0, 200)})`;
    }
  }
  if (!verdict) throw new Error(`judge: ${why}`);
  const judgeSession = scrub(await piSession(`${judgeDir}/sessions`));
  const judge = { model: defs.models.judge, ...sessionMetrics(judgeSession, Math.round((Date.now() - j0) / 1000)), session: judgeSession };
  say(`grade: ${verdict.grade} (${verdict.domain}, ${verdict.task_type}, ${verdict.outcome}). ${verdict.reason}`);
  say(`capabilities: ${verdict.capabilities.map((cap) => `${cap.name} ${cap.grade}`).join(", ")}`);
  say(`judge: ${judge.model}, ${judge.seconds}s, ${judge.turns} turns, tokens ${JSON.stringify(judge.tokens)}`);

  const { grade, domain, task_type, outcome, capabilities, depth = "", reason, findings } = verdict;
  const picked = { grade, domain, task_type, outcome, capabilities: capabilities.map(({ name, grade, evidence }) => ({ name, grade, evidence })), depth, reason, findings };
  const row = { setup, eval: item.id, prompt: item.prompt, harness: "pi", where: "local", model: defs.models.agent, ...picked, run, judge };
  console.log(`ROW ${JSON.stringify(row)}`);
  Deno.exit(0);
} catch (err) {
  say(`FAIL agent: ${err instanceof Error ? err.message : err}`);
  Deno.exit(1);
}
