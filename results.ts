// Purpose: the shape of eval results: reading evals.json and evals.jsonl, metrics from a Pi session,
//   row validation, and the README results block.
// Change when: a row field, a metric, a validation rule, or the results table changes.
// Not for: running an agent (agent.ts), behavior checks (checks.ts), the sandbox (evals.ts).
//
// evals.jsonl has no header of its own. Each line is one EvalRow, appended only by `./evals.ts macos --agent`
// from the judge's structured verdict and the metrics read from the sessions it carries. Never edit it by hand.

import { ROOT, text } from "./lib.ts";

export const GRADES = ["A", "B", "C", "D", "F"];
export const README_START = "<!-- results:start -->";
export const README_END = "<!-- results:end -->";

export type Tokens = { input: number; output: number; cache_read: number; cache_write: number; total: number };
export type Metrics = {
  seconds: number;
  agent_seconds: number;
  turns: number;
  tool_calls: number;
  tool_errors: number;
  tools: Record<string, number>;
  tokens: Tokens;
  compactions: number;
  slowest_turn_seconds: number;
};
// A Pi session file, one parsed JSON entry per line.
export type Session = Record<string, unknown>[];
export type CapabilityGrade = { name: string; grade: string; evidence: string };
export type JudgeFields = { domain: string[]; task_type: string[]; outcome: string[]; capability: string[] };
export type Defs = {
  about: string;
  models: { agent: string; judge: string };
  judge_fields: JudgeFields;
  versions: { setup: string; evals: { id: string; prompt: string }[] }[];
};
export type Verdict = {
  grade: string;
  domain: string;
  task_type: string;
  outcome: string;
  capabilities: CapabilityGrade[];
  depth: string;
  reason: string;
  findings: string[];
};
export type EvalRow = Verdict & {
  at: string;
  setup: string;
  revision: string;
  eval: string;
  prompt: string;
  harness: string;
  where: string;
  model: string;
  run: Metrics & { session: Session };
  judge: Metrics & { model: string; session: Session };
};

export function evalDefs(): Defs {
  return JSON.parse(text(`${ROOT}/evals.json`)) as Defs;
}

export function evalRows(): EvalRow[] {
  let body = "";
  try {
    body = text(`${ROOT}/evals.jsonl`);
  } catch {
    return [];
  }
  return body.split("\n").filter(Boolean).map((line) => JSON.parse(line) as EvalRow);
}

// The latest row per setup version, eval, and model. Older rows stay in the file as history.
export function latestRows(rows = evalRows()): EvalRow[] {
  const latest = new Map<string, EvalRow>();
  for (const row of rows) latest.set(`${row.setup}|${row.eval}|${row.model}`, row);
  return [...latest.values()];
}

export function parseSession(raw: string): Session {
  return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

// Everything comes from Pi's own session entries: usage per assistant message, tool calls, timestamps.
// The entry timestamp is when a message finished; message.timestamp is when it started.
export function sessionMetrics(session: Session, seconds: number): Metrics {
  const tokens: Tokens = { input: 0, output: 0, cache_read: 0, cache_write: 0, total: 0 };
  const tools: Record<string, number> = {};
  let turns = 0;
  let toolCalls = 0;
  let toolErrors = 0;
  let compactions = 0;
  let slowest = 0;
  let first = 0;
  let last = 0;
  let previous = 0;
  for (const entry of session) {
    if (entry.type === "compaction") compactions += 1;
    if (entry.type !== "message") continue;
    // deno-lint-ignore no-explicit-any
    const message = entry.message as any;
    const at = Date.parse(String(entry.timestamp)) || Number(message.timestamp);
    if (!first) first = at;
    last = at;
    if (message.role === "assistant") {
      turns += 1;
      if (previous) slowest = Math.max(slowest, (at - previous) / 1000);
      const usage = message.usage ?? {};
      tokens.input += usage.input ?? 0;
      tokens.output += usage.output ?? 0;
      tokens.cache_read += usage.cacheRead ?? 0;
      tokens.cache_write += usage.cacheWrite ?? 0;
      tokens.total += usage.totalTokens ?? 0;
      for (const block of message.content ?? []) {
        if (block.type !== "toolCall") continue;
        toolCalls += 1;
        tools[block.name] = (tools[block.name] ?? 0) + 1;
      }
    }
    if (message.role === "toolResult" && message.isError) toolErrors += 1;
    previous = at;
  }
  return {
    seconds,
    agent_seconds: Math.round((last - first) / 1000),
    turns,
    tool_calls: toolCalls,
    tool_errors: toolErrors,
    tools,
    tokens,
    compactions,
    slowest_turn_seconds: Math.round(slowest),
  };
}

// Why a verdict is not usable, or null. The judge may only choose from judge_fields.
export function verdictError(verdict: Verdict, fields: JudgeFields): string | null {
  if (!GRADES.includes(verdict.grade)) return "grade is not A-F";
  if (!fields.domain.includes(verdict.domain)) return `domain ${verdict.domain} is not in judge_fields`;
  if (!fields.task_type.includes(verdict.task_type)) return `task_type ${verdict.task_type} is not in judge_fields`;
  if (!fields.outcome.includes(verdict.outcome)) return `outcome ${verdict.outcome} is not in judge_fields`;
  if (!Array.isArray(verdict.capabilities) || !verdict.capabilities.length) return "no capability grades";
  for (const cap of verdict.capabilities) {
    if (!fields.capability.includes(cap.name)) return `capability ${cap.name} is not in judge_fields`;
    if (!GRADES.includes(cap.grade) || !cap.evidence) return `capability ${cap.name} has no grade or evidence`;
  }
  if (!verdict.reason || !Array.isArray(verdict.findings)) return "no reason or findings";
  return null;
}

// Why a stored row is not valid, or null: defined eval, usable verdict, and metrics equal to its sessions.
export function rowError(row: EvalRow, defs: Defs): string | null {
  const defined = defs.versions.find((v) => v.setup === row.setup)?.evals.find((e) => e.id === row.eval);
  if (!defined || defined.prompt !== row.prompt) return "not a defined eval and prompt";
  const verdict = verdictError(row, defs.judge_fields);
  if (verdict) return verdict;
  for (const [name, part] of [["run", row.run], ["judge", row.judge]] as const) {
    const { session, ...recorded } = part;
    const { model: _model, ...metrics } = recorded as Metrics & { model?: string };
    if (JSON.stringify(sessionMetrics(session, part.seconds)) !== JSON.stringify(metrics)) return `${name} metrics do not match its session`;
  }
  return null;
}

// The README results block: latest run per model, then model by capability.
export function renderResults(rows: EvalRow[], fields: JudgeFields): string {
  const lines = [README_START, "", "Rendered by `./evals.ts macos --agent` from `evals.jsonl`: the latest run per setup, eval, and model. Do not edit.", ""];
  if (!rows.length) {
    lines.push("No scored runs yet.", "", README_END);
    return lines.join("\n");
  }
  lines.push(
    "| setup | eval | model | grade | domain | outcome | seconds | turns | tool calls | tokens in | tokens out | cache read | judge | judge seconds | judge tokens |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const row of rows) {
    const r = row.run;
    lines.push(`| ${row.setup} | ${row.eval} | ${row.model} | ${row.grade} | ${row.domain} | ${row.outcome} | ${r.seconds} | ${r.turns} | ${r.tool_calls} | ${r.tokens.input} | ${r.tokens.output} | ${r.tokens.cache_read} | ${row.judge.model} | ${row.judge.seconds} | ${row.judge.tokens.total} |`);
  }
  const caps = fields.capability.filter((name) => rows.some((row) => row.capabilities.some((cap) => cap.name === name)));
  lines.push("", `| model | ${caps.join(" | ")} |`, `| --- | ${caps.map(() => "---").join(" | ")} |`);
  for (const model of [...new Set(rows.map((row) => row.model))]) {
    const grade = (name: string) => rows.filter((row) => row.model === model).flatMap((row) => row.capabilities).filter((cap) => cap.name === name).at(-1)?.grade ?? "";
    lines.push(`| ${model} | ${caps.map(grade).join(" | ")} |`);
  }
  lines.push("", README_END);
  return lines.join("\n");
}

export function readmeWithResults(readme: string, block: string): string {
  const start = readme.indexOf(README_START);
  const end = readme.indexOf(README_END);
  if (start < 0 || end < start) throw new Error("README.md has no results markers");
  return readme.slice(0, start) + block + readme.slice(end + README_END.length);
}
