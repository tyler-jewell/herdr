// One public entry. deno run --allow-run --allow-read --allow-write --allow-net setup.ts
// Loads this setup by running apply, then hands an agent the required prompt.

const PROMPT =
  "Work with the human on /bootstrap. /bootstrap is required. Follow skills/herdr/bootstrap.md.";

function emit(body: unknown): void {
  console.log(JSON.stringify(body));
}

function fail(message: string, next: string): never {
  emit({ status: "failed", exit_code: 1, message, next });
  Deno.exit(1);
}

function dirname(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut <= 0 ? "/" : path.slice(0, cut);
}

function localRoot(): string | null {
  const url = import.meta.url;
  if (!url.startsWith("file:")) return null;
  const raw = decodeURIComponent(new URL(url).pathname).replaceAll("\\", "/");
  const path = /^\/[A-Za-z]:\//.test(raw) ? raw.slice(1) : raw;
  return dirname(path);
}

function remoteRepo(url: string): { clone: string; ref: string } | null {
  const match = url.match(
    /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(.+)\/setup\.ts$/,
  );
  if (!match) return null;
  const ref = decodeURIComponent(match[3]).replace(/^refs\/(heads|tags)\//, "");
  if (!ref) return null;
  return {
    clone: `https://github.com/${match[1]}/${match[2]}.git`,
    ref,
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function checkout(): Promise<string> {
  const local = localRoot();
  if (local && await exists(`${local}/apply`)) return local;

  const remote = remoteRepo(import.meta.url);
  if (!remote) {
    fail(
      "setup.ts is not in a checkout and its URL is not a raw setup.ts file.",
      "Run deno on this file from a checkout, or deno run its raw URL.",
    );
  }
  const home = Deno.env.get("HERDR_SETUP_HOME") || Deno.env.get("HOME") || Deno.env.get("USERPROFILE");
  if (!home) fail("HOME is unset.", "Set HOME and run setup.ts again.");
  const dest = `${home.replaceAll("\\", "/")}/.herdr/harness`;
  if (await exists(`${dest}/apply`)) {
    if (await exists(`${dest}/.git`)) {
      await new Deno.Command("git", {
        args: ["-C", dest, "pull", "--ff-only"],
        stdout: "null",
        stderr: "null",
      }).output().catch(() => {});
    }
    return dest;
  }
  if (await exists(dest)) {
    await Deno.remove(dest, { recursive: true });
  }

  await Deno.mkdir(dirname(dest), { recursive: true });
  const clone = new Deno.Command("git", {
    args: ["clone", "--depth", "1", "--branch", remote.ref, remote.clone, dest],
  });
  const cloned = await clone.output();
  if (cloned.code !== 0 || !(await exists(`${dest}/apply`))) {
    fail(
      "could not clone the checkout for setup.ts.",
      "Clone the repo and run deno on setup.ts from that checkout.",
    );
  }
  return dest;
}

const root = await checkout();
const apply = new Deno.Command(`${root}/apply`, {
  cwd: root,
  stdout: "piped",
  stderr: "piped",
});
const ran = await apply.output();
if (ran.stderr.length > 0) {
  await Deno.stderr.write(ran.stderr);
}
const text = new TextDecoder().decode(ran.stdout).trim();
let report: unknown;
try {
  report = JSON.parse(text);
} catch {
  fail(
    "apply did not print JSON.",
    "Re-run setup.ts from a checkout and read the apply output.",
  );
}
if (ran.code !== 0 && ran.code !== 2) {
  emit(report);
  Deno.exit(ran.code);
}
emit({ apply: report, prompt: PROMPT, required: true });
Deno.exit(ran.code);
