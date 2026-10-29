// Purpose: the shape of eval results: the config files (evals.json, metrics.json, capabilities.json),
//   metrics computed from a run, verdict and row validation, and reading evals.jsonl.
// Change when: a row field, how a metric is computed, or a validation rule changes.
// Not for: drawing results (render.ts), running an agent (agent.ts), behavior checks (checks.ts).
//
// evals.jsonl has no header of its own. Each line is one EvalRow for one commit, appended only by
// `./evals.ts macos --agent` from the judge's verdict and the metrics measured from the run. Never edit it.

import { ROOT, text } from "./lib.ts";

export type Session = Record<string, unknown>[];
export type Metric = { id: string; name: string; unit: string; better: "lower" | "higher"; how: string };
export type Capability = { id: string; name: string; required: boolean; look_for: string };
export type Labels = { domain: string[]; task_type: string[]; outcome: string[] };
export type Defs = {
  about: string;
  models: { agent: string; judge: string };
  labels: Labels;
  versions: { setup: string; evals: { id: string; prompt: string }[] }[];
};
export type Verdict = {
  score: number;
  capabilities: Record<string, number>;
  evidence: Record<string, string>;
  labels: { domain: string; task_type: string; outcome: string };
  depth: string;
  reason: string;
  findings: string[];
};
export type JudgeRecord = { model: string; metrics: Record<string, number> };
export type EvalRow = Verdict & {
  commit: string;
  at: string;
  setup: string;
  eval: string;
  prompt: string;
  harness: string;
  model: string;
  metrics: Record<string, number>;
  changed_files: string[];
  judge: JudgeRecord;
  sessions: { agent: Session; judge: Session };
};

export const evalDefs = (): Defs => JSON.parse(text(`${ROOT}/evals.json`));
export const metricDefs = (): Metric[] => JSON.parse(text(`${ROOT}/metrics.json`)).metrics;
export const capabilityDefs = (): Capability[] => JSON.parse(text(`${ROOT}/capabilities.json`)).capabilities;
export const capabilityScale = (): { range: string; meaning: string }[] => JSON.parse(text(`${ROOT}/capabilities.json`)).scale;

export function evalRows(): EvalRow[] {
  let body = "";
  try {
    body = text(`${ROOT}/evals.jsonl`);
  } catch {
    return [];
  }
  return body.split("\n").filter(Boolean).map((line) => JSON.parse(line) as EvalRow);
}

// The newest row per commit, eval, and model, in the order the commits were first recorded.
export function latestPerCommit(rows = evalRows()): EvalRow[] {
  const latest = new Map<string, EvalRow>();
  for (const row of rows) latest.set(`${row.commit}|${row.eval}|${row.model}`, row);
  return [...latest.values()];
}

export function parseSession(raw: string): Session {
  return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

// Every metric in metrics.json, computed from Pi's own session entries plus the two numbers only the
// harness knows: wall time and the files the run changed. Entry timestamps are when a message finished.
export function computeMetrics(session: Session, wallSeconds: number, changedFiles: string[]): Record<string, number> {
  let turns = 0, toolCalls = 0, failed = 0, repeated = 0, input = 0, output = 0, compactions = 0;
  let promptAt = 0, firstReplyAt = 0;
  const seen = new Set<string>();
  for (const entry of session) {
    if (entry.type === "compaction") compactions += 1;
    if (entry.type !== "message") continue;
    // deno-lint-ignore no-explicit-any
    const message = entry.message as any;
    const at = Date.parse(String(entry.timestamp)) || Number(message.timestamp);
    if (message.role === "user" && !promptAt) promptAt = at;
    if (message.role === "toolResult" && message.isError) failed += 1;
    if (message.role !== "assistant") continue;
    turns += 1;
    if (!firstReplyAt) firstReplyAt = at;
    input += (message.usage?.input ?? 0) + (message.usage?.cacheRead ?? 0);
    output += message.usage?.output ?? 0;
    for (const block of message.content ?? []) {
      if (block.type !== "toolCall") continue;
      toolCalls += 1;
      const key = `${block.name} ${JSON.stringify(block.arguments)}`;
      if (seen.has(key)) repeated += 1;
      seen.add(key);
    }
  }
  const computed: Record<string, number> = {
    wall_seconds: wallSeconds,
    first_action_seconds: promptAt && firstReplyAt ? Math.round((firstReplyAt - promptAt) / 1000) : 0,
    turns,
    tool_calls: toolCalls,
    failed_tool_calls: failed,
    repeated_tool_calls: repeated,
    input_tokens: input,
    output_tokens: output,
    compactions,
    files_changed: changedFiles.length,
  };
  // metrics.json is the list. Nothing computed may be missing from it, and nothing in it may go uncomputed.
  const ids = metricDefs().map((m) => m.id);
  const extra = Object.keys(computed).filter((id) => !ids.includes(id));
  const missing = ids.filter((id) => !(id in computed));
  if (extra.length || missing.length) throw new Error(`metrics.json and results.ts disagree: extra ${extra}, missing ${missing}`);
  return Object.fromEntries(ids.map((id) => [id, computed[id]]));
}

const isScore = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 10;

// Why a judge's verdict is not usable, or null. Required capabilities always; optional only from the list.
export function verdictError(verdict: Verdict, labels: Labels, capabilities: Capability[]): string | null {
  if (!isScore(verdict.score)) return "score is not an integer from 1 to 10";
  const ids = capabilities.map((c) => c.id);
  const scored = Object.keys(verdict.capabilities ?? {});
  for (const cap of capabilities.filter((c) => c.required)) {
    if (!scored.includes(cap.id)) return `required capability ${cap.id} is not scored`;
  }
  for (const id of scored) {
    if (!ids.includes(id)) return `capability ${id} is not in capabilities.json`;
    if (!isScore(verdict.capabilities[id])) return `capability ${id} is not an integer from 1 to 10`;
    if (!verdict.evidence?.[id]) return `capability ${id} has no evidence`;
  }
  for (const key of ["domain", "task_type", "outcome"] as const) {
    if (!labels[key].includes(verdict.labels?.[key])) return `label ${key} ${verdict.labels?.[key]} is not in evals.json`;
  }
  if (!verdict.reason || !Array.isArray(verdict.findings)) return "no reason or findings";
  return null;
}

// Why a stored row is not valid, or null: a real commit, a defined eval, a usable verdict, and metrics
// equal to what its sessions and changed files compute.
export function rowError(row: EvalRow): string | null {
  if (!/^[0-9a-f]{40}$/.test(row.commit)) return "commit is not a full git hash";
  const defined = evalDefs().versions.find((v) => v.setup === row.setup)?.evals.find((e) => e.id === row.eval);
  if (!defined || defined.prompt !== row.prompt) return "not a defined eval and prompt";
  const verdict = verdictError(row, evalDefs().labels, capabilityDefs());
  if (verdict) return verdict;
  const agent = computeMetrics(row.sessions.agent, row.metrics.wall_seconds, row.changed_files);
  if (JSON.stringify(agent) !== JSON.stringify(row.metrics)) return "metrics do not match the agent session";
  const judge = judgeMetrics(row.sessions.judge, row.judge.metrics.wall_seconds);
  if (JSON.stringify(judge) !== JSON.stringify(row.judge.metrics)) return "judge metrics do not match the judge session";
  return null;
}

// The judge's own cost: the subset of metrics that apply to a read-only grading session.
export function judgeMetrics(session: Session, wallSeconds: number): Record<string, number> {
  const all = computeMetrics(session, wallSeconds, []);
  return { wall_seconds: all.wall_seconds, turns: all.turns, tool_calls: all.tool_calls, input_tokens: all.input_tokens, output_tokens: all.output_tokens };
}
