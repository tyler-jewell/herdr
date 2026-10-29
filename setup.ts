// Purpose: the one public entry. Clones this repo if it is not a checkout, runs apply, then hands an agent
//   the required /bootstrap prompt (inside a Herdr pane with --agent <kind>: starts that agent beside it).
// Change when: how a machine gets this repo, how apply is run, or the handoff changes.
// Not for: what lands on the machine (apply, config.toml), the bootstrap procedure (skills/herdr/bootstrap.md).
//
// deno run --reload --allow-run --allow-read --allow-write --allow-net --allow-env setup.ts [--agent <kind>]

const PROMPT =
  "Work with the human on /bootstrap. /bootstrap is required. Follow skills/herdr/bootstrap.md.";
const AGENT = "bootstrap";

function emit(body: unknown): void {
  console.log(JSON.stringify(body));
}

function fail(message: string, next: string): never {
  emit({ status: "failed", exit_code: 1, message, next });
  Deno.exit(1);
}

async function run(
  bin: string,
  args: string[],
  cwd?: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const out = await new Deno.Command(bin, { args, cwd, stdout: "piped", stderr: "piped" }).output();
    const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes).trim();
    return { code: out.code, stdout: decode(out.stdout), stderr: decode(out.stderr) };
  } catch (err) {
    return { code: 127, stdout: "", stderr: err instanceof Deno.errors.NotFound ? `${bin} not found` : String(err) };
  }
}

function agentKind(): string | null {
  const at = Deno.args.indexOf("--agent");
  if (at < 0) return null;
  const kind = Deno.args[at + 1];
  if (!kind || kind.startsWith("-")) fail("--agent needs a kind.", "Run setup.ts again with --agent <kind>, the kind the human named.");
  return kind;
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
  // HERDR_SETUP_REPO is a test override (clone source#ref) so evals.ts can clone without the network.
  const override = Deno.env.get("HERDR_SETUP_REPO");
  if (override) {
    const [clone, ref] = override.split("#");
    return { clone, ref: ref || "main" };
  }
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
  if (await exists(dest)) {
    if (!await exists(`${dest}/apply`)) {
      fail(
        `${dest} exists but is not a checkout of this setup.`,
        `Move ${dest} aside, then run setup.ts again. Nothing was deleted.`,
      );
    }
    if (await exists(`${dest}/.git`)) {
      const dirty = await run("git", ["-C", dest, "status", "--porcelain"]);
      if (dirty.code !== 0 || dirty.stdout) {
        fail(
          `${dest} has local changes.`,
          `The harness is a managed copy. Move ${dest} aside, then run setup.ts again. A change to the setup goes through the repo.`,
        );
      }
      const pull = await run("git", ["-C", dest, "pull", "--ff-only"]);
      if (pull.code !== 0) {
        fail(
          `could not update ${dest}: ${pull.stderr.split("\n")[0]}`,
          `Fix the network or move ${dest} aside, then run setup.ts again. The harness was not updated.`,
        );
      }
    }
    return dest;
  }

  await Deno.mkdir(dirname(dest), { recursive: true });
  const cloned = await run("git", ["clone", "--depth", "1", "--branch", remote.ref, remote.clone, dest]);
  if (cloned.code !== 0 || !(await exists(`${dest}/apply`))) {
    fail(
      "could not clone the checkout for setup.ts.",
      "Clone the repo and run deno on setup.ts from that checkout.",
    );
  }
  return dest;
}

// Herdr is controlled only from inside a Herdr pane (skills/herdr/SKILL.md).
async function handoff(root: string, herdr: string, kind: string | null): Promise<Record<string, unknown>> {
  if (Deno.env.get("HERDR_ENV") !== "1") {
    return {
      handoff: "printed",
      next: "Give the prompt to an agent, or start herdr and run this same command in a Herdr pane with --agent <kind>.",
    };
  }
  if (!kind) {
    const help = await run(herdr, ["agent"]);
    const kinds = `${help.stdout}\n${help.stderr}`.match(/kinds:\s*(\S+)/)?.[1]?.split("|") ?? [];
    return {
      handoff: "needs-kind",
      kinds,
      next: "Ask the human which agent kind to start, then run this same command again with --agent <kind>.",
    };
  }
  const failed = (step: string, detail: string) => ({
    handoff: "failed",
    handoff_detail: `${step}: ${detail.split("\n").slice(0, 5).join(" ")}`,
    next: `Fix that, then run this same command again. Or give the prompt to a ${kind} agent yourself.`,
  });
  // A new pane gets the server's environment, not ours. Pass Pi's own settings through.
  const env = ["PI_CODING_AGENT_DIR", "PI_OFFLINE"].flatMap((key) => {
    const value = Deno.env.get(key);
    return value ? ["--env", `${key}=${value}`] : [];
  });
  const split = await run(herdr, ["pane", "split", "--current", "--direction", "right", "--cwd", root, "--no-focus", ...env]);
  let pane = "";
  try {
    pane = JSON.parse(split.stdout).result.pane.pane_id;
  } catch {
    return failed("pane split", split.stderr || split.stdout);
  }
  const start = await run(herdr, ["agent", "start", AGENT, "--kind", kind, "--pane", pane]);
  if (start.code !== 0) {
    await run(herdr, ["pane", "close", pane]);
    return failed("agent start", start.stderr || start.stdout);
  }
  const prompt = await run(herdr, ["agent", "prompt", AGENT, PROMPT]);
  if (prompt.code !== 0) return failed("agent prompt", prompt.stderr || prompt.stdout);
  return {
    handoff: "started",
    agent: AGENT,
    pane,
    next: `Answer the ${AGENT} agent in pane ${pane}.`,
  };
}

const kind = agentKind();
const root = await checkout();
// Native Windows cannot execute apply directly. Git Bash supplies sh.
const windows = Deno.build.os === "windows";
const ran = await run(windows ? "sh" : `${root}/apply`, windows ? [`${root}/apply`] : [], root);
if (ran.code === 127 && windows) {
  fail("sh is not on PATH.", "Run setup.ts from Git Bash, or from WSL (that path is Linux).");
}
if (ran.stderr) console.error(ran.stderr);
let report: { herdr?: string | null };
try {
  report = JSON.parse(ran.stdout);
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
const revision = await run("git", ["-C", root, "rev-parse", "HEAD"]);
const harness = { path: root, revision: revision.code === 0 ? revision.stdout : null };
const handed = report.herdr ? await handoff(root, report.herdr, kind) : {
  handoff: "printed",
  next: "Install Herdr (see apply.next), then run this same command in a Herdr pane with --agent <kind>.",
};
emit({ apply: report, harness, prompt: PROMPT, required: true, ...handed });
Deno.exit(handed.handoff === "failed" ? 1 : ran.code);
