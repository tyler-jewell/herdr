// Purpose: draw the results from evals.jsonl: the README results block (summary, per-commit charts,
//   latest numbers) and results.svg (the heatmap of every score and metric per commit).
// Change when: what the README or the heatmap shows, or how it looks, changes.
// Not for: computing or validating results (results.ts), recording a run (evals.ts).

import { type Capability, type EvalRow, type Metric } from "./results.ts";

export const README_START = "<!-- results:start -->";
export const README_END = "<!-- results:end -->";

const short = (commit: string) => commit.slice(0, 7);
const fmt = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : String(n));

// One row per commit for the chart series, oldest first. With one eval and one model this is every run.
function byCommit(rows: EvalRow[]): EvalRow[] {
  const seen = new Map<string, EvalRow>();
  for (const row of rows) seen.set(row.commit, row);
  return [...seen.values()];
}

function chart(title: string, axis: string, labels: string[], series: { kind: "line" | "bar"; values: number[] }[], max?: number): string {
  const lines = [
    "```mermaid",
    "xychart-beta",
    `  title "${title}"`,
    `  x-axis [${labels.map((l) => `"${l}"`).join(", ")}]`,
    `  y-axis "${axis}"${max === undefined ? "" : ` 0 --> ${max}`}`,
    ...series.map((s) => `  ${s.kind} [${s.values.join(", ")}]`),
    "```",
  ];
  return lines.join("\n");
}

export function readmeBlock(rows: EvalRow[], metrics: Metric[], capabilities: Capability[]): string {
  const out = [README_START, ""];
  if (!rows.length) {
    out.push("No scored runs yet. `./evals.ts macos --agent` records one for the current commit.", "", README_END);
    return out.join("\n");
  }
  const series = byCommit(rows);
  const latest = series.at(-1)!;
  const labels = series.map((r) => short(r.commit));
  out.push(
    `**Latest:** \`${latest.eval}\` scored **${latest.score}/10** at \`${short(latest.commit)}\`. ${latest.model} ran it in ${latest.metrics.wall_seconds} s with ${latest.metrics.tool_calls} tool calls, judged by ${latest.judge.model}.`,
    "",
    chart("Judge score per commit", "score", labels, [{ kind: "line", values: series.map((r) => r.score) }], 10),
    "",
    "![Every score and metric per commit](results.svg)",
    "",
    chart("Wall time per commit", "seconds", labels, [{ kind: "bar", values: series.map((r) => r.metrics.wall_seconds) }]),
    "",
    chart("Tokens per commit (bar: input, line: output)", "tokens", labels, [
      { kind: "bar", values: series.map((r) => r.metrics.input_tokens) },
      { kind: "line", values: series.map((r) => r.metrics.output_tokens) },
    ]),
    "",
    `| Capability (1-10) | \`${short(latest.commit)}\` |`,
    "| --- | --- |",
    ...capabilities.filter((c) => c.id in latest.capabilities).map((c) => `| ${c.name}${c.required ? "" : " (optional)"} | ${latest.capabilities[c.id]} |`),
    "",
    `| Metric | \`${short(latest.commit)}\` | Better |`,
    "| --- | --- | --- |",
    ...metrics.map((m) => `| ${m.name} (${m.unit}) | ${latest.metrics[m.id]} | ${m.better} |`),
    "",
    "Rendered by `./evals.ts macos --agent` from `evals.jsonl`, one run per commit. Do not edit.",
    "",
    README_END,
  );
  return out.join("\n");
}

export function readmeWithBlock(readme: string, block: string): string {
  const start = readme.indexOf(README_START);
  const end = readme.indexOf(README_END);
  if (start < 0 || end < start) throw new Error("README.md has no results markers");
  return readme.slice(0, start) + block + readme.slice(end + README_END.length);
}

// 1-10 from red through amber to green.
function scoreColor(score: number): string {
  const stops = ["#cf222e", "#e16f24", "#d4a72c", "#8ac926", "#2da44e", "#1a7f37"];
  return stops[Math.min(stops.length - 1, Math.max(0, Math.round(((score - 1) / 9) * (stops.length - 1))))];
}

// A metric against the other commits in its column: best is green, worst is amber.
function metricColor(value: number, column: number[], better: "lower" | "higher"): string {
  const lo = Math.min(...column), hi = Math.max(...column);
  if (lo === hi) return "#d1e7d6";
  const t = better === "lower" ? (value - lo) / (hi - lo) : (hi - value) / (hi - lo);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${mix(0x9b, 0xf2)},${mix(0xd8, 0xc6)},${mix(0xa8, 0x6e)})`;
}

const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export function heatmapSvg(rows: EvalRow[], metrics: Metric[], capabilities: Capability[]): string {
  const series = byCommit(rows).reverse();
  const cols: { label: string; value: (r: EvalRow) => number | undefined; color: (v: number) => string }[] = [
    { label: "Score", value: (r) => r.score, color: scoreColor },
    ...capabilities.map((c) => ({ label: c.name, value: (r: EvalRow) => r.capabilities[c.id], color: scoreColor })),
    ...metrics.map((m) => {
      const column = series.map((r) => r.metrics[m.id]);
      return { label: m.name, value: (r: EvalRow) => r.metrics[m.id], color: (v: number) => metricColor(v, column, m.better) };
    }),
  ];
  const left = 86, top = 150, cell = 52, gap = 3;
  const width = left + cols.length * cell + 16;
  const height = top + Math.max(series.length, 1) * cell + 44;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="-apple-system,Segoe UI,Helvetica,Arial,sans-serif" role="img" aria-label="Every score and metric per commit">`,
    "<!-- Purpose: the results heatmap shown in README.md. Change when: never by hand; render.ts writes it. Not for: anything else. -->",
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`,
    `<text x="${left + gap}" y="${top - 128}" font-size="11" fill="#57606a">capabilities: judge 1-10</text>`,
    `<text x="${left + (capabilities.length + 1) * cell + gap}" y="${top - 128}" font-size="11" fill="#57606a">metrics: green is the best commit</text>`,
  ];
  cols.forEach((col, i) => {
    const x = left + i * cell + cell / 2;
    parts.push(`<text transform="translate(${x},${top - 8}) rotate(-50)" font-size="11" fill="#24292f">${esc(col.label)}</text>`);
  });
  series.forEach((row, r) => {
    const y = top + r * cell;
    parts.push(`<text x="${left - 8}" y="${y + cell / 2 + 4}" text-anchor="end" font-size="12" font-family="SFMono-Regular,Menlo,monospace" fill="#24292f">${short(row.commit)}</text>`);
    cols.forEach((col, i) => {
      const v = col.value(row);
      const x = left + i * cell;
      parts.push(`<rect x="${x + gap}" y="${y + gap}" width="${cell - 2 * gap}" height="${cell - 2 * gap}" rx="4" fill="${v === undefined ? "#eaeef2" : col.color(v)}"/>`);
      parts.push(`<text x="${x + cell / 2}" y="${y + cell / 2 + 4}" text-anchor="middle" font-size="12" fill="${v === undefined ? "#8c959f" : "#1f2328"}">${v === undefined ? "–" : fmt(v)}</text>`);
    });
  });
  if (!series.length) parts.push(`<text x="${left}" y="${top + 30}" font-size="12" fill="#57606a">No scored runs yet.</text>`);
  parts.push(`<text x="${left + gap}" y="${height - 14}" font-size="11" fill="#57606a">One row per commit, newest first. Empty: not exercised. Rendered from evals.jsonl.</text>`, "</svg>", "");
  return parts.join("\n");
}
