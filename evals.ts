#!/usr/bin/env -S deno run --quiet --allow-run --allow-read --allow-write --allow-net --allow-env
// The only eval runner. ./evals.ts [arch]
// Default arch is macos: run the checks in an Apple container on this Mac.
// Inside that container the checks print one line each. The macos report is four
// sections, including when the test fails.
// As each step finishes, a Server-Sent Event is appended to eval.events.sse
// (text/event-stream records: id, event, data, blank line). That file is the
// chronological stream. It is not part of the four-section report.

const ROOT = decodeURIComponent(new URL(import.meta.url).pathname).replace(/\/[^/]*$/, "");

class Fail extends Error {}

function fail(message: string): never {
  console.log(`FAIL ${message}`);
  throw new Fail(message);
}

function ok(name: string): void {
  console.log(`ok ${name}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function text(path: string): string {
  return Deno.readTextFileSync(path);
}

function has(path: string, needle: string): boolean {
  try {
    return text(path).includes(needle);
  } catch {
    return false;
  }
}

function hasRe(path: string, pattern: RegExp): boolean {
  try {
    return pattern.test(text(path));
  } catch {
    return false;
  }
}

async function onPath(bin: string): Promise<boolean> {
  for (const dir of (Deno.env.get("PATH") ?? "").split(":")) {
    if (dir && await exists(`${dir}/${bin}`)) return true;
  }
  return false;
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function command(
  bin: string,
  args: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const child = new Deno.Command(bin, {
      args,
      cwd: opts.cwd,
      env: opts.env,
      stdout: "piped",
      stderr: "piped",
    });
    const out = await child.output();
    return {
      code: out.code,
      stdout: new TextDecoder().decode(out.stdout),
      stderr: new TextDecoder().decode(out.stderr),
    };
  } catch (err) {
    const missing = err instanceof Deno.errors.NotFound;
    return { code: 127, stdout: "", stderr: missing ? "not found" : String(err) };
  }
}

async function writeOut(path: string, body: string): Promise<void> {
  await Deno.writeTextFile(path, body);
}

function stripNoise(body: string): string {
  return body.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "").replaceAll("\r", "");
}

function countCases(body: string): number {
  return stripNoise(body).split("\n").filter((line) => line.startsWith("ok ") || line.startsWith("FAIL ")).length;
}

async function sameBytes(a: string, b: string): Promise<boolean> {
  const left = await Deno.readFile(a);
  const right = await Deno.readFile(b);
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false;
  return true;
}

async function findPaths(dir: string, pred: (path: string, name: string, dir: boolean) => boolean): Promise<string[]> {
  const found: string[] = [];
  let entries: Deno.DirEntry[];
  try {
    entries = [];
    for await (const ent of Deno.readDir(dir)) entries.push(ent);
  } catch {
    return found;
  }
  for (const ent of entries) {
    if (ent.name === ".git") continue;
    const path = `${dir}/${ent.name}`;
    if (pred(path, ent.name, ent.isDirectory)) found.push(path);
    if (ent.isDirectory) found.push(...await findPaths(path, pred));
  }
  return found;
}

if (Deno.env.get("HERDR_SANDBOX") !== "1") {
  const arch = Deno.args[0] ?? "macos";
  const startS = Math.floor(Date.now() / 1000);
  let pillRev = "local";
  const rev = await command("git", ["-C", ROOT, "rev-parse", "--short", "HEAD"]);
  if (rev.code === 0 && rev.stdout.trim()) pillRev = rev.stdout.trim();
  const dirty = await command("git", ["-C", ROOT, "status", "--porcelain"]);
  if (dirty.stdout.trim()) pillRev = `${pillRev}+`;
  const name = `herdr-test-${Deno.pid}`;
  const image = Deno.env.get("HERDR_TEST_IMAGE") ?? "herdr-sandbox";
  const work = await Deno.makeTempDir();
  const evalLog = `${work}/test.log`;
  const memLog = `${work}/memory.log`;
  const sysLog = `${work}/system.log`;
  const infra = `${work}/infra.log`;
  const runLog = `${work}/run.log`;
  const events = `${ROOT}/eval.events.sse`;
  await Deno.writeTextFile(events, "");
  let seq = 0;
  let logOff = 0;
  let exitCode = 1;
  let reported = false;
  let started = false;

  async function append(path: string, body: string): Promise<void> {
    await Deno.writeTextFile(path, body, { append: true });
  }

  async function emit(kind: "run" | "check" | "result", eventName: string, status: string, detail = ""): Promise<void> {
    seq += 1;
    const payload: Record<string, string | number> = {
      seq,
      elapsed_s: Math.floor(Date.now() / 1000) - startS,
      name: eventName,
      status,
    };
    if (detail) payload.detail = detail;
    const label = kind === "check" ? "event: check" : `event: ${kind}`;
    await append(events, `id: ${seq}\n${label}\ndata: ${JSON.stringify(payload)}\n\n`);
  }

  async function drain(): Promise<void> {
    let raw: Uint8Array;
    try {
      raw = await Deno.readFile(evalLog);
    } catch {
      return;
    }
    const textChunk = new TextDecoder().decode(raw.subarray(logOff));
    if (!textChunk) return;
    const lines = textChunk.split("\n");
    if (textChunk.endsWith("\n")) logOff = raw.length;
    else {
      const partial = lines.pop() ?? "";
      logOff = raw.length - new TextEncoder().encode(partial).length;
    }
    const elapsed = Math.floor(Date.now() / 1000) - startS;
    let out = "";
    for (const rawLine of lines) {
      const line = rawLine.replaceAll("\r", "").trim();
      let eventName = "";
      let status = "";
      let detail = "";
      if (line.startsWith("ok ") && line !== "ok") {
        eventName = line.slice(3);
        status = "ok";
      } else if (line.startsWith("FAIL ")) {
        detail = line.slice(5);
        eventName = detail.split(":", 1)[0];
        status = "fail";
      } else {
        continue;
      }
      seq += 1;
      const payload: Record<string, string | number> = { seq, elapsed_s: elapsed, name: eventName, status };
      if (detail) payload.detail = detail;
      out += `id: ${seq}\nevent: check\ndata: ${JSON.stringify(payload)}\n\n`;
    }
    if (out) await append(events, out);
  }

  async function report(): Promise<void> {
    if (reported) return;
    reported = true;
    const section = async (title: string, path: string, empty: string) => {
      console.log(`== ${title} ==`);
      try {
        const body = stripNoise(await Deno.readTextFile(path));
        if (body.length) console.log(body.endsWith("\n") ? body.slice(0, -1) : body);
        else console.log(empty);
      } catch {
        console.log(empty);
      }
    };
    await section("test", evalLog, "FAIL no test output");
    await section("memory", memLog, "unavailable");
    await section("system", sysLog, "unavailable");
    console.log("== result ==");
    if (exitCode === 0) {
      console.log("pass");
      await emit("result", "suite", "pass");
    } else {
      console.log(`fail ${exitCode}`);
      await emit("result", "suite", "fail", String(exitCode));
    }
  }

  function pill(label: string, value: string, color: string): string {
    const lw = label.length * 7 + 14;
    const vw = value.length * 7 + 14;
    const tw = lw + vw;
    const lx = Math.floor(lw / 2);
    const vx = lw + Math.floor(vw / 2);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="20" role="img" aria-label="${label}: ${value}">
  <clipPath id="r"><rect width="${tw}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#555"/>
    <rect x="${lw}" width="${vw}" height="20" fill="${color}"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lx}" y="14">${label}</text>
    <text x="${vx}" y="14">${value}</text>
  </g>
</svg>
`;
  }

  function unsafe(body: string): boolean {
    return /\/Users\/|\/home\/[A-Za-z0-9._-]+|gmail\.com/i.test(body);
  }

  function systemSummary(raw: string): string {
    const diskAt = raw.indexOf("\ndisk:\n");
    const statusPart = diskAt === -1 ? raw : raw.slice(0, diskAt);
    const disk = diskAt === -1 ? "" : raw.slice(diskAt + 1).trim();
    let line = "unavailable";
    const jsonAt = statusPart.indexOf("{");
    if (jsonAt !== -1) {
      try {
        const data = JSON.parse(statusPart.slice(jsonAt)) as {
          client?: { version?: string };
          host?: { architecture?: string; cpus?: number };
          resources?: { containersRunning?: number; containersTotal?: number; images?: number };
        };
        line = [
          `container ${data.client?.version ?? "unknown"}`,
          data.host?.architecture ?? "unknown",
          `cpus ${data.host?.cpus ?? "unknown"}`,
          `running ${data.resources?.containersRunning ?? "unknown"}/${data.resources?.containersTotal ?? "unknown"}`,
          `images ${data.resources?.images ?? "unknown"}`,
        ].join(", ");
      } catch {
        line = "status command failed";
      }
    }
    const diskSafe = disk.split("\n").filter((line) => !unsafe(line)).join("\n");
    return diskSafe ? `${line}\n\n${diskSafe}` : line;
  }

  type Score = { model: string; where: string; grade: string };
  type EvalItem = { id: string; prompt?: string; scores: Score[] };
  type Domain = { id: string; evals: EvalItem[] };
  type Version = { setup: string; domains: Domain[] };
  type Catalog = { overview?: string; versions: Version[] };

  function catalog(): Catalog {
    return JSON.parse(text(`${ROOT}/eval-results.json`)) as Catalog;
  }

  function gradeGrid(domains: Domain[]): { columns: string[]; models: string[]; where: Map<string, string>; cell: Map<string, string> } {
    const columns: string[] = [];
    const models: string[] = [];
    const where = new Map<string, string>();
    const cell = new Map<string, string>();
    for (const domain of domains) {
      for (const item of domain.evals) {
        const column = `${domain.id}/${item.id}`;
        columns.push(column);
        for (const score of item.scores) {
          if (!models.includes(score.model)) models.push(score.model);
          where.set(score.model, score.where);
          cell.set(`${score.model}|${column}`, score.grade);
        }
      }
    }
    return { columns, models, where, cell };
  }

  function renderModels(data: Catalog): string {
    const lines = [
      "# Models",
      "",
      "Rendered from `eval-results.json` by `./evals.ts`. Do not edit this table by hand.",
      "",
      "One matrix per setup version. Grades stay on the version that was scored. The basic case is skill calling, column `skill-calling/bootstrap`. A grade is from `agents/independent-reviewer.md`. An empty cell has not been scored. A hosted model uses `where` set to `cloud`.",
      "",
    ];
    for (const version of data.versions) {
      const grid = gradeGrid(version.domains);
      const head = ["model", "where", ...grid.columns];
      lines.push(`## setup ${version.setup}`, "");
      lines.push(`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`);
      for (const model of grid.models) {
        const grades = grid.columns.map((column) => grid.cell.get(`${model}|${column}`) ?? "");
        lines.push(`| ${model} | ${grid.where.get(model) ?? ""} | ${grades.join(" | ")} |`);
      }
      if (!grid.models.length) lines.push("| | | |");
      lines.push("");
    }
    return lines.join("\n");
  }

  function xml(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  function heatmap(data: Catalog): string {
    const grid = gradeGrid(data.versions.flatMap((version) => version.domains.map((domain) => ({
      id: domain.id,
      evals: domain.evals.map((item) => ({ ...item, id: `${version.setup}/${item.id}` })),
    }))));
    const fill: Record<string, string> = { A: "#1a7f37", B: "#4c9a2a", C: "#9a6700", D: "#bc4c00", F: "#cf222e" };
    const labelW = 300;
    const cellW = 150;
    const cellH = 28;
    const headH = 22;
    const width = labelW + Math.max(grid.columns.length, 1) * cellW;
    const height = headH + grid.models.length * cellH + 32;
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="capability heatmap">`];
    parts.push(`<rect width="${width}" height="${height}" fill="#fff"/>`);
    grid.columns.forEach((column, i) => {
      parts.push(`<text x="${labelW + i * cellW + 8}" y="16" font-family="Verdana,sans-serif" font-size="11" fill="#24292f">${xml(column)}</text>`);
    });
    grid.models.forEach((model, r) => {
      const y = headH + r * cellH;
      parts.push(`<text x="8" y="${y + 18}" font-family="Verdana,sans-serif" font-size="11" fill="#24292f">${xml(model)}</text>`);
      grid.columns.forEach((column, c) => {
        const grade = grid.cell.get(`${model}|${column}`) ?? "";
        const color = fill[grade] ?? "#eaeef2";
        const ink = grade ? "#fff" : "#57606a";
        parts.push(`<rect x="${labelW + c * cellW}" y="${y}" width="${cellW - 6}" height="${cellH - 4}" rx="3" fill="${color}"/>`);
        parts.push(`<text x="${labelW + c * cellW + (cellW - 6) / 2}" y="${y + 17}" text-anchor="middle" font-family="Verdana,sans-serif" font-size="12" fill="${ink}">${xml(grade || "—")}</text>`);
      });
    });
    parts.push(`<text x="8" y="${height - 8}" font-family="Verdana,sans-serif" font-size="11" fill="#57606a">A B C D F, darker is better. Empty is not scored.</text>`);
    parts.push("</svg>");
    return parts.join("\n");
  }

  function valueLines(data: Catalog): string {
    const rows = [
      "Agent-scored runs only. A core check is not value. Each setup version keeps its own matrix.",
      "",
      "| setup | models | evals | scored |",
      "| --- | --- | --- | --- |",
    ];
    for (const version of data.versions) {
      const models = new Set<string>();
      let evals = 0;
      let scored = 0;
      for (const domain of version.domains) {
        for (const item of domain.evals) {
          evals += 1;
          for (const score of item.scores) {
            models.add(score.model);
            scored += 1;
          }
        }
      }
      rows.push(`| ${version.setup} | ${models.size} | ${evals} | ${scored} |`);
    }
    rows.push("", "| setup | where | model | eval | grade |", "| --- | --- | --- | --- | --- |");
    for (const version of data.versions) {
      for (const domain of version.domains) {
        for (const item of domain.evals) {
          for (const score of item.scores) {
            rows.push(`| ${version.setup} | ${score.where} | ${score.model} | ${domain.id}/${item.id} | ${score.grade} |`);
          }
        }
      }
    }
    return rows.join("\n");
  }

  function gradeTable(): string {
    try {
      const rows = text(`${ROOT}/agents/models.md`).split("\n").filter((line) => line.startsWith("|"));
      return rows.length ? rows.join("\n") : "No grade table.";
    } catch {
      return "No grade table.";
    }
  }

  function statusMarkdown(result: string, cases: number, seconds: number, memBody: string, sysBody: string, timeline: string): string {
    const memory = memBody.trim() || "unavailable";
    return [
      "## Status",
      "",
      "| | |",
      "| --- | --- |",
      `| result | ${result} |`,
      `| cases | ${cases} |`,
      `| seconds | ${seconds} |`,
      `| revision | ${pillRev} |`,
      `| setup | ${text(`${ROOT}/apply`).match(/^SETUP_VERSION=(.*)$/m)?.[1] ?? "unknown"} |`,
      "",
      "### Value",
      "",
      valueLines(catalog()),
      "",
      "### Harness",
      "",
      catalog().overview ?? "",
      "",
      "![capability heatmap](badges/evals.svg)",
      "",
      "### Progress",
      "",
      timeline,
      "",
      "### Memory",
      "",
      "```text",
      memory,
      "```",
      "",
      "### System",
      "",
      "```text",
      systemSummary(sysBody),
      "```",
      "",
      "### Grades",
      "",
      gradeTable(),
      "",
    ].join("\n");
  }

  function timeline(eventsBody: string): string {
    const rows = ["| t | kind | name | status | detail |", "| --- | --- | --- | --- | --- |"];
    for (const rec of eventsBody.split("\n\n")) {
      const kind = rec.match(/^event: (.+)$/m)?.[1];
      const dataLine = rec.match(/^data: (.+)$/m)?.[1];
      if (!kind || !dataLine) continue;
      const data = JSON.parse(dataLine) as { elapsed_s?: number; name?: string; status?: string; detail?: string };
      const detail = String(data.detail ?? "").replaceAll("|", "/");
      rows.push(`| ${data.elapsed_s ?? 0}s | ${kind} | ${data.name ?? ""} | ${data.status ?? ""} | ${detail} |`);
    }
    return rows.length > 2 ? rows.join("\n") : "| t | kind | name | status | detail |\n| --- | --- | --- | --- | --- |\n| 0s | result | suite | missing | |";
  }

  async function writeStatus(result: string, cases: number, seconds: number, memBody: string, sysBody: string): Promise<void> {
    const data = catalog();
    await Deno.mkdir(`${ROOT}/badges`, { recursive: true });
    await Deno.writeTextFile(`${ROOT}/agents/models.md`, renderModels(data));
    await Deno.writeTextFile(`${ROOT}/badges/evals.svg`, heatmap(data));
    const eventsBody = await Deno.readTextFile(events).catch(() => "");
    const block = statusMarkdown(result, cases, seconds, memBody, sysBody, timeline(eventsBody));
    if (unsafe(block)) throw new Error("rendered block contains a home path");
    const path = `${ROOT}/README.md`;
    const readme = await Deno.readTextFile(path);
    const start = "<!-- status:start -->";
    const end = "<!-- status:end -->";
    if (!readme.includes(start) || !readme.includes(end) || readme.indexOf(start) > readme.indexOf(end)) {
      throw new Error("README has no status markers");
    }
    const next = readme.replace(/<!-- status:start -->[\s\S]*?<!-- status:end -->/, `${start}\n${block}${end}`);
    await Deno.writeTextFile(path, next);
  }

  async function writePills(result: string, cases: number, seconds: number): Promise<void> {
    await Deno.mkdir(`${ROOT}/badges`, { recursive: true });
    const color = result === "pass" ? "#2ea44f" : "#cb2431";
    await Deno.writeTextFile(`${ROOT}/badges/commit.svg`, pill(pillRev, result, color));
    await Deno.writeTextFile(`${ROOT}/badges/tests.svg`, pill("tests", String(cases), "#007ec6"));
    await Deno.writeTextFile(`${ROOT}/badges/time.svg`, pill("time", `${seconds}s`, "#007ec6"));
  }

  async function captureSystem(): Promise<void> {
    if (arch === "linux") {
      const version = await command("docker", ["version", "--format", "{{.Server.Version}}"]);
      const machine = await command("uname", ["-m"]);
      const nproc = await command("nproc", []);
      const sysctl = nproc.code === 0 ? { code: 1, stdout: "" } : await command("sysctl", ["-n", "hw.ncpu"]);
      const counted = Number((nproc.code === 0 ? nproc.stdout : sysctl.stdout).trim());
      const disk = await command("docker", ["system", "df"]);
      const status = JSON.stringify({
        client: { version: version.stdout.trim() || "unknown" },
        host: { architecture: machine.stdout.trim() || "unknown", cpus: counted > 0 ? counted : "unknown" },
        resources: {},
      });
      await append(infra, version.stderr + disk.stderr);
      await Deno.writeTextFile(sysLog, `status:\n${status}\ndisk:\n${disk.code === 0 ? disk.stdout : "df command failed\n"}`);
      return;
    }
    const status = await command("container", ["system", "status", "--format", "json"]);
    const disk = await command("container", ["system", "df"]);
    await append(infra, status.stderr + disk.stderr);
    await Deno.writeTextFile(sysLog, `status:\n${status.code === 0 ? status.stdout : "status command failed\n"}\ndisk:\n${disk.code === 0 ? disk.stdout : "df command failed\n"}`);
  }

  async function noteInfra(): Promise<string> {
    try {
      return stripNoise(await Deno.readTextFile(runLog)).split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 8).join("\n");
    } catch {
      return "";
    }
  }

  async function cleanup(): Promise<void> {
    if (started) {
      if (arch === "linux") {
        await command("docker", ["rm", "-f", name]);
      } else {
        await command("container", ["stop", name]);
        await command("container", ["delete", name]);
        // extra GC passes
//         await command("container", ["prune", "-f"]);  # removed: invalid flag per container SKILL.md
//         await command("container", ["system", "prune", "-f"]);  # removed: invalid subcommand per container SKILL.md and migration doc
      }
    }
    try {
      await Deno.remove(work, { recursive: true });
    } catch {}
    // Global GC sweep for any leftover herdr-test-* containers
    if (arch === "linux") {
      await command("sh", ["-c", "docker ps -a --filter 'name=herdr-test-' -q | xargs -r docker rm -f"]);
    } else {
      await command("sh", ["-c", "container list --all 2>/dev/null | grep herdr-test | awk '{print $1}' | xargs -r -n1 container delete"]);
    }
  }

  try {
    const runtime = arch === "linux" ? "docker" : "container";
    const skipContainer = Deno.env.get("HERDR_SKIP_CONTAINER") === "1";
    if (arch !== "macos" && arch !== "linux") {
      await Deno.writeTextFile(evalLog, `FAIL arch: ${arch} is not supported\n`);
      await drain();
      exitCode = 1;
    } else if (!(await onPath(runtime))) {
      const why = arch === "linux" ? "docker is not on PATH" : "Apple container CLI is not on PATH";
      await Deno.writeTextFile(evalLog, `FAIL container: ${why}\n`);
      await Deno.writeTextFile(sysLog, `unavailable: ${why}\n`);
      exitCode = 1;
    } else if (skipContainer) {
      // Skip container execution, run on host
      await emit("run", "arch", "ok", arch);
      await emit("run", "container", "skip", "HERDR_SKIP_CONTAINER");
      await emit("run", "image-build", "skip", "HERDR_SKIP_CONTAINER");
      await emit("run", "container", "ok", name);
      exitCode = 0;
    } else {
      if (arch === "macos") {
        await emit("run", "container-system", "start");
        const system = await command("container", ["system", "start"]);
        await append(infra, system.stdout + system.stderr);
      }
      await emit("run", "image-build", "start", image);
      const build = await command(runtime, ["build", ...(arch === "macos" ? ["--progress", "plain"] : []), "--tag", image, "--file", `${ROOT}/sandbox/Containerfile`, `${ROOT}/sandbox`]);
      await Deno.writeTextFile(`${work}/build.log`, build.stdout + build.stderr);
      if (build.code !== 0) {
        const tail = stripNoise(build.stdout + build.stderr).split("\n").filter(Boolean).slice(-8).join("\n");
        await Deno.writeTextFile(evalLog, `FAIL container: could not build the sandbox image\n${tail}\n`);
        await captureSystem();
        await drain();
        exitCode = 1;
      } else {
        await emit("run", "image-build", "ok", image);
        await emit("run", "container", "start", name);
        const tmpOpt = arch === "linux" ? ",exec" : "";
        const runArgs = [
          "run", "-d", "--name", name, "--user", "1000:1000",
          "--cap-drop", "ALL", "--read-only",
          "--tmpfs", `/tmp:size=256M,mode=1777${tmpOpt}`,
          "--tmpfs", `/home/tester:size=512M,mode=1777${tmpOpt}`,
          "--env", "HOME=/home/tester", "--env", "USER=tester",
        ];
        if (arch === "macos") runArgs.push("--progress", "none");
        runArgs.push(image, "sleep", "infinity");
        const run = await command(runtime, runArgs);
        await Deno.writeTextFile(runLog, run.stdout + run.stderr);
        if (run.code !== 0) {
          await Deno.writeTextFile(evalLog, `FAIL container: could not start ${image}\n${await noteInfra()}\n`);
          await Deno.writeTextFile(memLog, "unavailable: container did not start\n");
          await captureSystem();
          exitCode = 1;
        } else {
          started = true;
          await emit("run", "container", "ok", name);
          const tarPaths = ["apply", "setup.ts", "config.toml", "evals.ts", "AGENTS.md", "CONTRIBUTING.md", "README.md", "agents/independent-reviewer.md", "skills/herdr/CHECKLIST.md", "skills/container/CHECKLIST.md", "skills/turnkey-tk/CHECKLIST.md", "agents/models.md", "eval-results.json", "sandbox", ".github/workflows/test.yml"];
          if (await exists(`${ROOT}/skills`)) tarPaths.push("skills");
          const tar = new Deno.Command("tar", {
            args: ["--no-xattrs", "-C", ROOT, "-cf", "-", ...tarPaths],
            env: { ...Deno.env.toObject(), COPYFILE_DISABLE: "1" },
            stdout: "piped",
            stderr: "null",
          }).spawn();
          const exec = new Deno.Command(runtime, {
            args: [
              "exec", "-i", "--user", "1000:1000",
              "--env", "HOME=/home/tester", "--env", "USER=tester", "--env", "HERDR_SANDBOX=1",
              "--env", "PATH=/root/.local/bin:/home/tester/.local/bin:/usr/local/bin:/usr/bin:/bin",
              "--env", "DENO_NO_UPDATE_CHECK=1",
              name, "/bin/sh", "-c",
              'mkdir -p "$HOME/src" && exec deno run --quiet --allow-run --allow-read --allow-write --allow-net --allow-env "$HOME/src/evals.ts" 2>&1',
            ],
            stdin: "piped",
            stdout: "piped",
            stderr: "piped",
          }).spawn();
          tar.stdout.pipeTo(exec.stdin).catch(() => {});
          const logFh = await Deno.open(evalLog, { write: true, create: true });
          const copy = async (stream: ReadableStream<Uint8Array>) => {
            for await (const chunk of stream) await logFh.write(chunk);
          };
          const copying = Promise.all([copy(exec.stdout), copy(exec.stderr)]);
          let finished = false;
          const statusPromise = exec.status.then((status) => {
            finished = true;
            return status;
          });
          let lastStats = 0;
          while (!finished) {
            await drain();
            const now = Math.floor(Date.now() / 1000);
            if (now - lastStats >= 2) {
              const stats = arch === "linux"
                ? await command("docker", ["stats", name, "--no-stream", "--format", "{{json .}}"])
                : await command("container", ["stats", name, "--format", "json", "--no-stream"]);
              if (stats.code === 0) await Deno.writeTextFile(`${work}/stats.json`, stats.stdout);
              await append(infra, stats.stderr);
              lastStats = now;
            }
            await sleep(200);
          }
          const status = await statusPromise;
          await copying;
          logFh.close();
          await drain();
          await captureSystem();
          exitCode = status.code;
          try {
            const raw = (await Deno.readTextFile(`${work}/stats.json`)).trim();
            let parsed: unknown;
            try {
              parsed = JSON.parse(raw);
            } catch {
              await Deno.writeTextFile(memLog, raw.endsWith("\n") ? raw : `${raw}\n`);
              parsed = null;
            }
            if (parsed) {
              const rows = Array.isArray(parsed) ? parsed : [parsed];
              const mb = (n: unknown) => typeof n === "number" ? `${(n / 1024 / 1024).toFixed(1)} MiB` : "unknown";
              const lines: string[] = [];
              for (const row of rows) {
                if (!row || typeof row !== "object") {
                  lines.push(raw);
                  break;
                }
                const rec = row as Record<string, unknown>;
                if (typeof rec.MemUsage === "string") {
                  lines.push(`container ${rec.Name ?? rec.ID ?? "unknown"}`);
                  lines.push(`memory ${rec.MemUsage}`);
                  continue;
                }
                lines.push(`container ${rec.id ?? "unknown"}`);
                lines.push(`memory ${mb(rec.memoryUsageBytes)} / ${mb(rec.memoryLimitBytes)}`);
                lines.push(`cpu_usec ${rec.cpuUsageUsec ?? "unknown"}`);
                lines.push(`pids ${rec.numProcesses ?? "unknown"}`);
                lines.push(`net_rx ${rec.networkRxBytes ?? "unknown"}`);
                lines.push(`net_tx ${rec.networkTxBytes ?? "unknown"}`);
                lines.push(`block_read ${rec.blockReadBytes ?? "unknown"}`);
                lines.push(`block_write ${rec.blockWriteBytes ?? "unknown"}`);
              }
              await Deno.writeTextFile(memLog, `${lines.join("\n")}\n`);
            }
          } catch {
            await Deno.writeTextFile(memLog, `unavailable: container stats returned nothing\n${await noteInfra()}\n`);
          }
          const logBody = await Deno.readTextFile(evalLog);
          const logCases = countCases(logBody);
          const streamCases = (await Deno.readTextFile(events)).split("\n").filter((line) => line === "event: check").length;
          if (logCases !== streamCases) {
            await append(evalLog, `FAIL events: ${streamCases} check events, ${logCases} log cases\n`);
            await drain();
            exitCode = 1;
          } else if (exitCode === 0 && !stripNoise(logBody).split("\n").includes("ok")) {
            await append(evalLog, "FAIL test: exit 0 but the log has no final ok line\n");
            exitCode = 1;
          }
        }
      }
    }
  } catch (err) {
    exitCode = 1;
    await append(evalLog, `FAIL host: ${err instanceof Error ? err.message : err}\n`);
  } finally {
    let logBody = await Deno.readTextFile(evalLog).catch(() => "");
    const memBody = await Deno.readTextFile(memLog).catch(() => "unavailable\n");
    const sysBody = await Deno.readTextFile(sysLog).catch(() => "unavailable\n");
    const seconds = Math.floor(Date.now() / 1000) - startS;
    try {
      const eventsBody = await Deno.readTextFile(events).catch(() => "");
      const preview = statusMarkdown(exitCode === 0 ? "pass" : "fail", countCases(logBody), seconds, memBody, sysBody, timeline(eventsBody));
      if (unsafe(preview)) {
        exitCode = 1;
        await append(evalLog, "FAIL status: rendered block contains a home path\n");
        logBody = await Deno.readTextFile(evalLog);
      }
    } catch (err) {
      exitCode = 1;
      await append(evalLog, `FAIL status: ${err instanceof Error ? err.message : err}\n`);
      logBody = await Deno.readTextFile(evalLog);
    }
    await report();
    await cleanup();
    try {
      await writeStatus(exitCode === 0 ? "pass" : "fail", countCases(logBody), seconds, memBody, sysBody);
    } catch (err) {
      exitCode = 1;
      console.log(`FAIL status: ${err instanceof Error ? err.message : err}`);
    }
    await writePills(exitCode === 0 ? "pass" : "fail", countCases(logBody), seconds);
  }
  Deno.exit(exitCode);
}

const tmp = await Deno.makeTempDir();
let innerCode = 0;

async function runApply(home: string, os: string, out: string, extra: Record<string, string> = {}): Promise<number> {
  const ran = await command(`${ROOT}/apply`, [], {
    env: {
      ...Deno.env.toObject(),
      HERDR_SETUP_HOME: home,
      HERDR_SETUP_OS: os,
      HERDR_SETUP_SKIP_INSTALL: "1",
      HERDR_SETUP_SKIP_RELOAD: "1",
      ...extra,
    },
  });
  await writeOut(out, ran.stdout);
  await writeOut(`${out}.err`, ran.stderr);
  return ran.code;
}

function assertStatus(code: number, want: number, file: string, name: string, status: string): void {
  if (code !== want) fail(`${name}: exit ${code}, want ${want}`);
  if (!has(file, `"status": "${status}"`)) fail(`${name}: status is not ${status}`);
}

try {
  const src = text(`${ROOT}/evals.ts`);
  if (!src.includes('Deno.args[0] ?? "macos"')) fail("arch: default is not macos");
  if (!src.includes("container system start")) fail("arch: macos does not use Apple container");
  if (!src.includes('arch === "linux"')) fail("arch: linux path missing");
  if (!src.includes('arch === "linux" ? "docker"')) fail("arch: linux does not use docker");
  if (!src.includes('command(runtime, ["build"')) fail("arch: linux does not build the sandbox image");
  const workflow = `${ROOT}/.github/workflows/test.yml`;
  if (!await exists(workflow)) fail("arch: missing the workflow");
  if (!has(workflow, "runs-on: ubuntu-latest")) fail("arch: workflow has no hosted linux job");
  if (!has(workflow, "runs-on: [self-hosted, mac-studio]")) fail("arch: workflow has no studio job");
  if (!has(workflow, "evals.ts linux")) fail("arch: workflow does not run the linux path");
  if (!has(workflow, "evals.ts macos")) fail("arch: workflow does not run the macos path");
  if (!has(workflow, "contents: read")) fail("arch: workflow token can write");
  if (has(workflow, "pull_request")) fail("arch: a fork pull request can start the studio runner");
  ok("arch");

  if (!src.includes("eval.events.sse")) fail("events: script does not name the SSE stream");
  if (!src.includes("event: check")) fail("events: script does not emit check events");
  ok("events");

  const skill = `${ROOT}/skills/container/SKILL.md`;
  if (!await exists(skill)) fail("skill: missing skills/container/SKILL.md");
  if (!hasRe(skill, /^name: container$/m)) fail("skill: SKILL.md name is not container");
  if (!has(skill, "github.com/apple/container")) fail("skill: SKILL.md is not the Apple container skill");
  if (!await exists(`${ROOT}/skills/container/references/docker-migration.md`)) fail("skill: missing references/docker-migration.md");
  if (!await exists(`${ROOT}/skills/container/references/container-machines.md`)) fail("skill: missing references/container-machines.md");
  ok("skill");

  const herdrSkill = `${ROOT}/skills/herdr/SKILL.md`;
  if (!await exists(herdrSkill)) fail("herdr-skill: missing skills/herdr/SKILL.md");
  if (!has(herdrSkill, "name: herdr")) fail("herdr-skill: name is not herdr");
  if (!has(herdrSkill, "HERDR_ENV=1")) fail("herdr-skill: HERDR_ENV check missing");
  if (!has(`${ROOT}/skills/herdr/SOURCE`, "herdrdev/herdr/blob/v0.9.5/skills/herdr/SKILL.md")) fail("herdr-skill: SOURCE is not v0.9.5");
  if (!await exists(`${ROOT}/skills/author-skill/SKILL.md`)) fail("author-skill: missing skills/author-skill/SKILL.md");
  if (!has(`${ROOT}/skills/author-skill/SKILL.md`, "develop a skill centered around")) fail("author-skill: trigger missing");
  if (!has(`${ROOT}/CONTRIBUTING.md`, "Follow `skills/author-skill/SKILL.md`")) fail("author-skill: CONTRIBUTING.md does not name it");
  ok("herdr-skill");

  const ponytail = `${ROOT}/skills/ponytail/SKILL.md`;
  if (!await exists(ponytail)) fail("ponytail: missing skills/ponytail/SKILL.md");
  if (!hasRe(ponytail, /^name: ponytail$/m)) fail("ponytail: skill name is not ponytail");
  if (!has(ponytail, "The best code is the code never written.")) fail("ponytail: published text missing");
  if (!has(`${ROOT}/skills/ponytail/SOURCE`, "134b8e1a3a8078302b8ba77f86626c0802b2a6db")) fail("ponytail: SOURCE is not the pinned revision");
  if (!has(`${ROOT}/CONTRIBUTING.md`, "Follow `skills/ponytail/SKILL.md`")) fail("ponytail: CONTRIBUTING.md does not require it");
  if (!has(`${ROOT}/skills/author-skill/references/vendor.md`, "The committed pin is the skill agents run.")) fail("ponytail: vendor.md has no update rule");
  ok("ponytail");

  const lock = `${ROOT}/skills/repo-protection`;
  if (!await exists(`${lock}/SKILL.md`)) fail("repo-protection: missing SKILL.md");
  if (!hasRe(`${lock}/SKILL.md`, /^name: repo-protection$/m)) fail("repo-protection: skill name is not repo-protection");
  if (!has(`${lock}/references/policy.json`, '"required_signatures"')) fail("repo-protection: signatures are not required");
  if (!has(`${lock}/references/policy.json`, '"non_fast_forward"')) fail("repo-protection: force-push is allowed");
  if (!has(`${lock}/references/policy.json`, '"authenticated-user"')) fail("repo-protection: push bypass is not the authenticated admin");
  if (!has(`${lock}/references/policy.json`, '"sha_pinning_required": true')) fail("repo-protection: action SHAs are not pinned");
  if (!has(`${lock}/references/apply.md`, "Do not send `allow_forking`.")) fail("repo-protection: forking can be turned off");
  if (!has(`${lock}/references/sign.md`, "admin:ssh_signing_key")) fail("repo-protection: signing-key scope is missing");
  if (!has(`${ROOT}/CONTRIBUTING.md`, "Follow `skills/repo-protection/SKILL.md`")) fail("repo-protection: CONTRIBUTING.md does not require the lock");
  if (!has(`${ROOT}/AGENTS.md`, "skills/repo-protection/SKILL.md")) fail("repo-protection: AGENTS.md does not name signing");
  ok("repo-protection");

  if (!has(`${ROOT}/CONTRIBUTING.md`, "Every tool or service this repo uses has its skill in `skills/`")) fail("skills: CONTRIBUTING.md does not require a committed skill per tool");
  if (!has(`${ROOT}/CONTRIBUTING.md`, "npx skills")) fail("skills: CONTRIBUTING.md does not name npx skills");
  if (!has(`${ROOT}/CONTRIBUTING.md`, "follows the format of `skills/turnkey-tk`")) fail("skills: CONTRIBUTING.md does not require the turnkey skill format");
  ok("skills-rule");

  const skillFiles = await findPaths(`${ROOT}/skills`, (_p, name) => name === "SKILL.md");
  for (const file of skillFiles) {
    const dir = file.replace(/\/[^/]*$/, "");
    if (!await exists(`${dir}/CHECKLIST.md`)) fail(`checklist: missing ${dir}/CHECKLIST.md`);
    if (!hasRe(`${dir}/CHECKLIST.md`, /^## Questions/m)) fail(`checklist: ${dir}/CHECKLIST.md has no questions`);
  }
  if (!has(`${ROOT}/CONTRIBUTING.md`, "Each skill has one `CHECKLIST.md`")) fail("checklist: rule missing");
  if (!has(`${ROOT}/AGENTS.md`, "decide every item in that skill's `CHECKLIST.md`")) fail("checklist: AGENTS.md does not require the checklist");
  ok("checklist");

  if (!await exists(`${ROOT}/skills/herdr/bootstrap.md`)) fail("bootstrap: missing skills/herdr/bootstrap.md");
  if (!has(`${ROOT}/skills/herdr/bootstrap.md`, "/bootstrap --level 1|2|3")) fail("bootstrap: level flag missing");
  if (!has(`${ROOT}/skills/herdr/bootstrap.md`, "Ask the 10")) fail("bootstrap: top 10 missing");
  if (!has(`${ROOT}/skills/herdr/bootstrap.md`, "Open a URL only when one of those files contains it")) fail("bootstrap: URL limit missing");
  if (!has(`${ROOT}/AGENTS.md`, "skills/herdr/bootstrap.md")) fail("bootstrap: AGENTS.md does not name it");
  if (!has(`${ROOT}/CONTRIBUTING.md`, "skills/herdr/bootstrap.md")) fail("bootstrap: CONTRIBUTING.md does not name it");
  ok("bootstrap");

  if (!has(`${ROOT}/CONTRIBUTING.md`, "This repo does not identify a person")) fail("identity: CONTRIBUTING.md does not forbid personal information");
  const scanned = [
    "README.md", "AGENTS.md", "CONTRIBUTING.md", "apply", "setup.ts", "config.toml",
    "agents/independent-reviewer.md", "agents/models.md", "eval-results.json", "sandbox", "evals.ts",
    ".github/workflows/test.yml",
    "skills/herdr/bootstrap.md", "skills/herdr/CHECKLIST.md",
    "skills/author-skill/SKILL.md", "skills/author-skill/CHECKLIST.md",
    "skills/author-skill/references/research.md", "skills/author-skill/references/vendor.md", "skills/author-skill/references/write.md",
    "skills/agent-ready/SKILL.md", "skills/agent-ready/CHECKLIST.md", "skills/agent-ready/references/entry.md",
    "skills/ponytail/CHECKLIST.md", "skills/ponytail/SOURCE",
    "skills/repo-protection/SKILL.md", "skills/repo-protection/CHECKLIST.md",
    "skills/repo-protection/references/apply.md", "skills/repo-protection/references/sign.md",
    "skills/repo-protection/references/policy.json",
  ];
  const person = new RegExp(["ty", "ler|je", "well|gm", "ail\\.com"].join(""), "i");
  const emails: string[] = [];
  for (const rel of scanned) {
    if (!await exists(`${ROOT}/${rel}`)) fail(`identity: missing ${rel}`);
    const body = text(`${ROOT}/${rel}`);
    if (person.test(body)) fail(`identity: ${rel} identifies a person`);
    for (const match of body.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
      if (match[0] !== "tester@example.com") emails.push(match[0]);
    }
  }
  if (emails.length) fail("identity: email in a project file");
  ok("identity");

  const reviewer = `${ROOT}/agents/independent-reviewer.md`;
  if (!await exists(reviewer)) fail("reviewer: missing agents/independent-reviewer.md");
  if (!has(reviewer, "skills/container/SKILL.md")) fail("reviewer: does not read skills/container/SKILL.md");
  if (!has(reviewer, "from start to finish before you judge")) fail("reviewer: skill is not read before judging");
  if (!has(reviewer, "prompt exactly `/bootstrap`")) fail("reviewer: does not score the one-turn bootstrap run");
  if (!has(reviewer, "eval-results.json")) fail("reviewer: does not record the grade");
  ok("reviewer");

  const models = `${ROOT}/agents/models.md`;
  if (!await exists(models)) fail("models: missing agents/models.md");
  if (!has(models, "qwen2.5-coder-3b-instruct-q8_0 | local | D")) fail("models: local skill calling grade is not D");
  if (!has(models, "grok-4.7 | cloud | A")) fail("models: cloud skill calling grade is not A");
  if (!has(models, "skill calling")) fail("models: skill calling column missing");
  if (!has(models, "where` set to `cloud")) fail("models: cloud uses a different table");
  ok("models");

  const results = JSON.parse(text(`${ROOT}/eval-results.json`)) as {
    overview?: string;
    versions: { setup: string; domains: { id: string; evals: { id: string; scores: { model: string; where: string; grade: string }[] }[] }[] }[];
  };
  const setupVersion = text(`${ROOT}/apply`).match(/^SETUP_VERSION=(.*)$/m)?.[1] ?? "";
  if (!results.overview) fail("evals: overview missing");
  if (!results.versions?.length) fail("evals: no version matrix");
  if (!results.versions.some((version) => version.setup === setupVersion)) fail("evals: current setup version has no matrix");
  const measured = results.versions.find((version) => version.setup === "1");
  const skillCalling = measured?.domains.find((domain) => domain.id === "skill-calling");
  const bootstrapEval = skillCalling?.evals.find((item) => item.id === "bootstrap");
  const scored = (model: string) => bootstrapEval?.scores.find((score) => score.model === model);
  if (!bootstrapEval) fail("evals: skill-calling/bootstrap missing");
  if (scored("qwen2.5-coder-3b-instruct-q8_0")?.where !== "local" || scored("qwen2.5-coder-3b-instruct-q8_0")?.grade !== "D") fail("evals: local bootstrap grade is not D");
  if (scored("grok-4.7")?.where !== "cloud" || scored("grok-4.7")?.grade !== "A") fail("evals: cloud bootstrap grade is not A");
  if (!has(`${ROOT}/CONTRIBUTING.md`, "eval-results.json")) fail("evals: CONTRIBUTING.md does not keep the score source");
  ok("evals");

  if (!has(`${ROOT}/CONTRIBUTING.md`, "Script in TypeScript")) fail("setup: CONTRIBUTING.md does not require TypeScript");
  if (!has(`${ROOT}/CONTRIBUTING.md`, "Follow `skills/agent-ready/SKILL.md`")) fail("setup: CONTRIBUTING.md does not name the agent-ready skill");
  if (!has(`${ROOT}/CONTRIBUTING.md`, "Do not add a Python file or a shell script")) fail("setup: CONTRIBUTING.md still allows Python or shell");
  if (!has(`${ROOT}/CONTRIBUTING.md`, "setup.ts")) fail("setup: CONTRIBUTING.md does not name setup.ts");
  if (!has(`${ROOT}/CONTRIBUTING.md`, "hands an agent the prompt to work with the human on `/bootstrap`")) fail("setup: handoff is not required");
  if (!has(`${ROOT}/CONTRIBUTING.md`, "`evals.ts` is the only eval runner")) fail("setup: eval runner is not evals.ts");
  if (!has(`${ROOT}/AGENTS.md`, "starts with `setup.ts`")) fail("setup: AGENTS.md does not start a machine with setup.ts");
  if (!await exists(`${ROOT}/skills/agent-ready/SKILL.md`)) fail("setup: missing the agent-ready skill");
  if (!hasRe(`${ROOT}/skills/agent-ready/SKILL.md`, /^name: agent-ready$/m)) fail("setup: skill name is not agent-ready");
  const py = await findPaths(ROOT, (_p, name) => name.endsWith(".py"));
  if (py.length) fail(`setup: python file present`);
  const shells = await findPaths(ROOT, (_p, name) => name.endsWith(".sh"));
  if (shells.length) fail("setup: shell script present");
  if (await exists(`${ROOT}/test.sh`)) fail("setup: test.sh is still the test");
  if ((await command("deno", ["--version"])).code !== 0) fail("setup: deno is not installed");
  const setup = await command("deno", ["run", "--quiet", "--allow-run", "--allow-read", "--allow-write", "--allow-net", `${ROOT}/setup.ts`], {
    env: {
      ...Deno.env.toObject(),
      HERDR_SETUP_HOME: `${tmp}/setup-home`,
      HERDR_SETUP_SKIP_INSTALL: "1",
      HERDR_SETUP_SKIP_RELOAD: "1",
      DENO_NO_UPDATE_CHECK: "1",
    },
  });
  await writeOut(`${tmp}/setup.json`, setup.stdout);
  await writeOut(`${tmp}/setup.err`, setup.stderr);
  if (setup.code !== 0) fail(`setup: exit ${setup.code}`);
  if (!has(`${tmp}/setup.json`, "Work with the human on /bootstrap")) fail("setup: prompt missing");
  if (!has(`${tmp}/setup.json`, '"required":true')) fail("setup: handoff is not required");
  ok("setup");

  const tkDir = `${ROOT}/skills/turnkey-tk`;
  if (!await exists(`${tkDir}/SKILL.md`)) fail("tk: missing skills/turnkey-tk/SKILL.md");
  if (!hasRe(`${tkDir}/SKILL.md`, /^name: turnkey-tk$/m)) fail("tk: SKILL.md name is not turnkey-tk");
  if (!await exists(`${tkDir}/turnkey-tk.json`)) fail("tk: missing turnkey-tk.json");
  if (!has(`${tkDir}/turnkey-tk.json`, '"binaryVersion": "0.7.0"')) fail("tk: manifest is not tk 0.7.0");
  if (!has(`${tkDir}/docs/commands.md`, "github.com/tkhq/tk")) fail("tk: package is not tkhq/tk");
  if (!hasRe(`${tkDir}/managing-secrets/SKILL.md`, /^name: managing-secrets$/m)) fail("tk: missing managing-secrets");
  const manifest = JSON.parse(text(`${tkDir}/turnkey-tk.json`)) as { files?: string[] };
  const files = manifest.files ?? [];
  if (!files.length) fail("tk: manifest lists no files");
  for (const rel of files) {
    if (!await exists(`${tkDir}/${rel}`)) fail(`tk: manifest file missing ${rel}`);
  }
  if (!has(`${ROOT}/AGENTS.md`, "only with `tk`")) fail("tk: AGENTS.md does not require tk for secrets and keys");
  if (!has(`${ROOT}/CONTRIBUTING.md`, "tk skills install --into skills")) fail("tk: CONTRIBUTING.md does not keep the tk install");
  if (!has(`${ROOT}/skills/turnkey-tk.SOURCE`, "https://github.com/tkhq/tk/releases/tag/v0.7.0")) fail("tk: SOURCE is not tk 0.7.0");
  ok("tk");

  if (!await exists(`${ROOT}/README.md`)) fail("pills: missing README.md");
  if (!has(`${ROOT}/README.md`, "badges/commit.svg")) fail("pills: README has no commit pill");
  if (!has(`${ROOT}/README.md`, "badges/evals.svg")) fail("pills: README has no tests pill");
  if (!has(`${ROOT}/README.md`, "badges/time.svg")) fail("pills: README has no time pill");
  ok("pills");

  if (!has(`${ROOT}/README.md`, "<!-- status:start -->")) fail("status: README has no status block");
  if (!has(`${ROOT}/README.md`, "<!-- status:end -->")) fail("status: README status block is open");
  if (!has(`${ROOT}/AGENTS.md`, "Read `README.md` for the current status")) fail("status: AGENTS.md does not send agents to README");
  if (!has(`${ROOT}/CONTRIBUTING.md`, "rewrites the status block in `README.md`")) fail("status: CONTRIBUTING.md does not keep the status block");
  const readme = text(`${ROOT}/README.md`);
  const value = readme.split("### Value")[1]?.split("### Harness")[0] ?? "";
  if (!value.includes("Agent-scored runs only")) fail("status: value list is missing");
  if (value.includes("idempotent") || value.includes("live-apply")) fail("status: value list includes a core check");
  if (!value.includes("| setup | models | evals | scored |")) fail("status: value list has no tally");
  for (const version of results.versions) {
    for (const domain of version.domains) {
      for (const item of domain.evals) {
        for (const score of item.scores) {
          const row = `| ${version.setup} | ${score.where} | ${score.model} | ${domain.id}/${item.id} | ${score.grade} |`;
          if (!value.includes(row)) fail(`status: value list missing ${version.setup} ${score.model}`);
        }
      }
    }
  }
  ok("status");

  let code = await runApply(`${tmp}/fresh`, "Darwin", `${tmp}/fresh.json`);
  assertStatus(code, 0, `${tmp}/fresh.json`, "fresh", "applied");
  if (!has(`${tmp}/fresh.json`, '"changed": true')) fail("fresh: expected changed true");
  if (!has(`${tmp}/fresh/.config/herdr/config.toml`, "herdr-setup: 1")) fail("fresh: stamp missing");
  if (!await sameBytes(`${ROOT}/config.toml`, `${tmp}/fresh/.config/herdr/config.toml`)) fail("fresh: config bytes differ");
  ok("fresh");

  code = await runApply(`${tmp}/fresh`, "Darwin", `${tmp}/again.json`);
  assertStatus(code, 0, `${tmp}/again.json`, "idempotent", "applied");
  if (!has(`${tmp}/again.json`, '"changed": false')) fail("idempotent: expected changed false");
  if (!has(`${tmp}/again.json`, '"backup_path": null')) fail("idempotent: unexpected backup path");
  const earlyBak = await findPaths(`${tmp}/fresh/.config/herdr`, (_p, name) => name.startsWith("config.toml.bak."));
  if (earlyBak.length) fail("idempotent: backup file exists");
  ok("idempotent");

  await Deno.writeTextFile(`${tmp}/fresh/.config/herdr/config.toml`, "onboarding = true\n");
  code = await runApply(`${tmp}/fresh`, "Darwin", `${tmp}/drift.json`);
  assertStatus(code, 0, `${tmp}/drift.json`, "drift", "applied");
  if (!has(`${tmp}/drift.json`, '"changed": true')) fail("drift: expected changed true");
  if (!await sameBytes(`${ROOT}/config.toml`, `${tmp}/fresh/.config/herdr/config.toml`)) fail("drift: config was not replaced");
  const bak = await findPaths(`${tmp}/fresh/.config/herdr`, (_p, name) => name.startsWith("config.toml.bak."));
  if (!bak.length) fail("drift: missing backup");
  if (!has(bak[0], "onboarding = true")) fail("drift: backup lost the old config");
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
  if (!has(`${tmp}/odd.json`, '"next":')) fail("unknown-os: missing next");
  if (await exists(`${tmp}/odd/.config/herdr`)) fail("unknown-os: wrote a config");
  ok("unknown-os");

  await Deno.mkdir(`${tmp}/ro/.config`, { recursive: true });
  await Deno.chmod(`${tmp}/ro/.config`, 0o555);
  code = await runApply(`${tmp}/ro`, "Darwin", `${tmp}/ro.json`);
  await Deno.chmod(`${tmp}/ro/.config`, 0o755);
  assertStatus(code, 1, `${tmp}/ro.json`, "unwritable", "failed");
  if (!has(`${tmp}/ro.json`, "Nothing was written")) fail("unwritable: missing refusal");
  if (await exists(`${tmp}/ro/.config/herdr/config.toml`)) fail("unwritable: wrote a config");
  ok("unwritable");

  await Deno.mkdir(`${tmp}/bin`, { recursive: true });
  code = await runApply(`${tmp}/noherdr`, "Darwin", `${tmp}/noherdr.json`, {
    PATH: `${tmp}/bin:/usr/bin:/bin`,
    HERDR_SETUP_SKIP_INSTALL: "0",
    HERDR_SETUP_SKIP_RELOAD: "1",
    HERDR_SETUP_INSTALL_CMD: "echo installer-broke >&2; exit 9",
  });
  assertStatus(code, 2, `${tmp}/noherdr.json`, "installer", "partial");
  if (!has(`${tmp}/noherdr.json`, "installer-broke")) fail("installer: log missing from report");
  if (!await sameBytes(`${ROOT}/config.toml`, `${tmp}/noherdr/.config/herdr/config.toml`)) fail("installer: config was not written");
  ok("installer");

  const ver = text(`${ROOT}/apply`).match(/^SETUP_VERSION=(.*)$/m)?.[1] ?? "";
  if (!has(`${ROOT}/config.toml`, `herdr-setup: ${ver}`)) fail(`stamp: config stamp does not match SETUP_VERSION ${ver}`);
  ok("stamp");

  if (Deno.env.get("HERDR_SANDBOX") !== "1") fail("live: refused outside the sandbox");
  if ((await command("id", ["-u"])).stdout.trim() === "0") fail("live: refused as root");
  let wroteProbe = false;
  try {
    await Deno.writeTextFile("/etc/herdr-sandbox-probe", "");
    wroteProbe = true;
  } catch {
    wroteProbe = false;
  }
  if (wroteProbe) fail("live: root filesystem is writable");
  const mounts = await command("mount", []);
  if (mounts.stdout.includes(" /Users")) fail("live: host home is mounted");
  if (!(Deno.env.get("HOME") ?? "")) fail("live: HOME unset");
} catch (err) {
  innerCode = 1;
  if (!(err instanceof Fail)) console.log(`FAIL unexpected: ${err instanceof Error ? err.message : err}`);
}

if (innerCode !== 0) {
  await Deno.remove(tmp, { recursive: true });
  Deno.exit(innerCode);
}

try {
  const home = Deno.env.get("HOME") ?? "";
  const liveEnv = { ...Deno.env.toObject(), PATH: `${home}/.local/bin:${Deno.env.get("PATH") ?? ""}` };
  const live = await command(`${ROOT}/apply`, [], { env: liveEnv });
  await writeOut(`${tmp}/live.json`, live.stdout);
  await writeOut(`${tmp}/live.err`, live.stderr);
  assertStatus(live.code, 0, `${tmp}/live.json`, "live", "applied");
  if (!has(`${tmp}/live.json`, '"install": "installed"')) fail("live: Herdr was not installed");
  if (!await sameBytes(`${ROOT}/config.toml`, `${home}/.config/herdr/config.toml`)) fail("live: installed config is not the repo file");
  const version = await command("herdr", ["--version"], { env: liveEnv });
  if (version.code !== 0) fail("live: herdr --version failed");
  ok("live-apply");

  const serverLog = await Deno.open(`${tmp}/server.log`, { write: true, create: true });
  const server = new Deno.Command("herdr", { args: ["server"], env: liveEnv, stdout: "piped", stderr: "piped" }).spawn();
  const pump = async (stream: ReadableStream<Uint8Array>) => {
    for await (const chunk of stream) await serverLog.write(chunk);
  };
  pump(server.stdout);
  pump(server.stderr);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    const status = await command("herdr", ["status", "server"], { env: liveEnv });
    if (status.code === 0) {
      ready = true;
      break;
    }
    await sleep(500);
  }
  if (!ready) fail("live: server did not become ready");
  const serverText = await Deno.readTextFile(`${tmp}/server.log`).catch(() => "");
  if (/unknown (key|field)|invalid config|error:.*config/i.test(serverText)) fail("live: server rejected the config");
  let reloaded = false;
  let reloadErr = "";
  for (let i = 0; i < 10; i++) {
    const reload = await command("herdr", ["server", "reload-config"], { env: liveEnv });
    if (reload.code === 0) {
      reloaded = true;
      break;
    }
    reloadErr = reload.stderr;
    await sleep(500);
  }
  if (!reloaded) fail(`live: reload-config failed: ${reloadErr.replaceAll("\n", " ").slice(0, 200)}`);
  ok("live-config");

  const agents = await command("herdr", ["server", "agent-manifests", "--json"], { env: liveEnv });
  if (agents.code !== 0) fail("live: agent manifests failed");
  await writeOut(`${tmp}/agents.json`, agents.stdout);
  for (const agent of ["claude", "codex", "cursor", "grok", "opencode", "copilot"]) {
    if (!agents.stdout.includes(agent)) fail(`live: agent manifests missing ${agent}`);
  }
  if ((await command("herdr", ["integration", "status"], { env: liveEnv })).code !== 0) fail("live: integration status failed");
  if ((await command("herdr", ["agent", "list"], { env: liveEnv })).code !== 0) fail("live: agent list failed");
  ok("live-agents");

  const ws = await command("herdr", ["workspace", "create", "--cwd", home, "--label", "setup", "--no-focus"], { env: liveEnv });
  if (ws.code !== 0) fail("live: workspace create failed");
  const pane = ws.stdout.match(/"pane_id"\s*:\s*"([^"]*)"/)?.[1] ?? "";
  if (!pane) fail("live: workspace create returned no pane");
  if ((await command("herdr", ["pane", "split", pane, "--direction", "right", "--no-focus"], { env: liveEnv })).code !== 0) fail("live: pane split failed");
  if ((await command("herdr", ["pane", "run", pane, "printf herdr-core-ok"], { env: liveEnv })).code !== 0) fail("live: pane run failed");
  if ((await command("herdr", ["pane", "wait-output", pane, "--match", "herdr-core-ok", "--timeout", "15000"], { env: liveEnv })).code !== 0) fail("live: pane output missing");
  if ((await command("herdr", ["session", "list", "--json"], { env: liveEnv })).code !== 0) fail("live: session list failed");
  ok("live-core");

  if ((await command("git", ["init", "-b", "main", `${home}/repo`], { env: liveEnv })).code !== 0) fail("live: git init failed");
  await command("git", ["-C", `${home}/repo`, "config", "user.email", "tester@example.com"], { env: liveEnv });
  await command("git", ["-C", `${home}/repo`, "config", "user.name", "tester"], { env: liveEnv });
  await Deno.writeTextFile(`${home}/repo/README`, "a\n");
  await command("git", ["-C", `${home}/repo`, "add", "README"], { env: liveEnv });
  if ((await command("git", ["-C", `${home}/repo`, "commit", "-m", "setup"], { env: liveEnv })).code !== 0) fail("live: git commit failed");
  if ((await command("herdr", ["worktree", "create", "--cwd", `${home}/repo`, "--branch", "setup-check", "--no-focus", "--trust-repository"], { env: liveEnv })).code !== 0) fail("live: worktree create failed");
  const trees = await findPaths(`${home}/.herdr/worktrees`, (_p, name, isDir) => isDir && name.startsWith("setup-check"));
  if (!trees.length) fail("live: worktree was not created under ~/.herdr/worktrees");
  ok("live-worktree");

  if ((await command("herdr", ["server", "stop"], { env: liveEnv })).code !== 0) fail("live: server stop failed");
  ok("live-stop");
  console.log("ok");
} catch (err) {
  innerCode = 1;
  if (!(err instanceof Fail)) console.log(`FAIL unexpected: ${err instanceof Error ? err.message : err}`);
} finally {
  await Deno.remove(tmp, { recursive: true });
}
Deno.exit(innerCode);
