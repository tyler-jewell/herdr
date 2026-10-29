// Purpose: small process and file helpers shared by evals.ts, checks.ts, agent.ts, and results.ts.
// Change when: two or more of those files need the same helper.
// Not for: eval logic (checks.ts, agent.ts), result rows and rendering (results.ts), the sandbox (evals.ts).

export const ROOT = decodeURIComponent(new URL(".", import.meta.url).pathname).replace(/\/$/, "");
export const RAW_SETUP = "https://raw.githubusercontent.com/tyler-jewell/herdr/main/setup.ts";
export const DENO_FLAGS = "--reload --allow-run --allow-read --allow-write --allow-net --allow-env";

export class Fail extends Error {}

export function fail(message: string): never {
  console.log(`FAIL ${message}`);
  throw new Fail(message);
}

export function ok(name: string): void {
  console.log(`ok ${name}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function text(path: string): string {
  return Deno.readTextFileSync(path);
}

export function has(path: string, needle: string): boolean {
  try {
    return text(path).includes(needle);
  } catch {
    return false;
  }
}

export async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function onPath(bin: string): Promise<boolean> {
  for (const dir of (Deno.env.get("PATH") ?? "").split(":")) {
    if (dir && await exists(`${dir}/${bin}`)) return true;
  }
  return false;
}

export async function command(
  bin: string,
  args: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const out = await new Deno.Command(bin, { args, cwd: opts.cwd, env: opts.env, stdout: "piped", stderr: "piped" }).output();
    return {
      code: out.code,
      stdout: new TextDecoder().decode(out.stdout),
      stderr: new TextDecoder().decode(out.stderr),
    };
  } catch (err) {
    return { code: 127, stdout: "", stderr: err instanceof Deno.errors.NotFound ? "not found" : String(err) };
  }
}

export async function sameBytes(a: string, b: string): Promise<boolean> {
  try {
    const [x, y] = await Promise.all([Deno.readFile(a), Deno.readFile(b)]);
    return x.length === y.length && x.every((byte, i) => byte === y[i]);
  } catch {
    return false;
  }
}

export async function findPaths(dir: string, pred: (path: string, name: string, isDir: boolean) => boolean): Promise<string[]> {
  const found: string[] = [];
  try {
    for await (const ent of Deno.readDir(dir)) {
      const path = `${dir}/${ent.name}`;
      if (pred(path, ent.name, ent.isDirectory)) found.push(path);
      if (ent.isDirectory) found.push(...await findPaths(path, pred));
    }
  } catch {
    // A missing directory has nothing in it.
  }
  return found;
}

// Every file in the repo: git's view on a checkout (tracked plus new, minus ignored), else a walk of the
// copy evals.ts shipped into the sandbox, which is exactly that list.
export async function repoFiles(): Promise<string[]> {
  const listed = await command("git", ["-C", ROOT, "ls-files", "-co", "--exclude-standard"]);
  if (listed.code === 0) {
    const files: string[] = [];
    for (const rel of new Set(listed.stdout.split("\n").filter(Boolean))) {
      if (await exists(`${ROOT}/${rel}`)) files.push(rel);
    }
    return files;
  }
  return (await findPaths(ROOT, (_p, _n, isDir) => !isDir)).map((path) => path.slice(ROOT.length + 1));
}

// The files that must carry a Purpose / Change when / Not for header: every repo file except skill files
// (which keep their published format) and the results rows. Under skills/, only our CHECKLIST.md and
// bootstrap.md files count.
export async function ownedFiles(): Promise<string[]> {
  const files = await repoFiles();
  const upstream = /^skills\/(?!.*\/(CHECKLIST\.md|bootstrap\.md)$)/;
  const exempt = new Set(["evals.jsonl"]);
  const kept: string[] = [];
  for (const rel of files) {
    if (upstream.test(rel) || exempt.has(rel) || !await exists(`${ROOT}/${rel}`)) continue;
    kept.push(rel);
  }
  return kept;
}
