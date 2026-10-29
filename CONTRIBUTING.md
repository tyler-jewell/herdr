# Contributing

Purpose: the rules for changing this repo, for people and agents alike. A change that breaks one is not done.
Change when: a rule for editing, checking, evaluating, or merging changes.
Not for: setting up or fixing a machine (`AGENTS.md`), what the project is (`README.md`).

Every agent working in this repo reads this file and then `README.md` at the start of its session, before any change. Which file a rule belongs in is the hard rule at the top of `AGENTS.md`.

The point of this repo is that every machine runs the same Herdr config. `./apply` is how a change leaves git and lands on a machine. A patch that edits a live config, documents a manual step, or updates only one computer is incomplete.

## Principles

- **KISS**: Keep it simple. Prefer obvious over clever.
- **SSOT**: Each fact lives in exactly one place. Elsewhere, point to it.
- **DRY**: Don't repeat yourself. Duplication breeds drift.
- **No cruft**: If a file, line of code, or doc is not pulling its weight, remove it.
- **No file is a good file**: Every file must earn its keep.
- **Take what they give us**: When using an official tool, package, or installer, take its structure as-is. Don't invent patterns on top of it.

## Layout

The repo is flat. Add a folder only when an upstream tool requires one: `skills/` for agent skills, `.github/` for CI. Each file has one purpose. When a file starts doing a second job, split it.

Every file this repo owns opens with three lines, in its own comment syntax:

- **Purpose:** what it is for, in one sentence.
- **Change when:** the only reasons to edit it.
- **Not for:** what belongs elsewhere, naming that file.

Markdown puts them in its first paragraph. `evals.json` puts them in its `about` field. There are two exceptions. Skill files keep their published format, though our own `skills/herdr/bootstrap.md` and `skills/run-evals/SKILL.md` carry the header. `evals.jsonl` holds rows only, and its header lives in `results.ts`. `checks.ts` enforces this.

## Integration targets

Build for two integrations, in this order. Use what each one ships, especially its built-in integrations, before writing anything of our own:

1. **Herdr itself.** Its commands, its real config keys, its agent detection, and its built-in integrations (`herdr integration install <kind>`). Do not rebuild what Herdr already does.
2. **Pi, the bare-bones coding harness** (`pi`, Herdr kind `pi`). Configure it only through its own files under `PI_CODING_AGENT_DIR` (`models.json`, `settings.json`), and connect it with Herdr's built-in `pi` integration.

Every agent eval runs Pi inside Herdr, and the judge is Pi too. Both use local models, so an eval needs no cloud account and no key. We assume a change that works with Herdr and Pi also works for at least 95% of the other harnesses Herdr supports (Grok, Claude, opencode, and the rest). Add harness-specific code only after a scored run shows that harness failing where Pi passes.

## No personal information

This repo identifies no person: no legal name, email address, account name, location, hostname, or home path. That includes the sessions inside `evals.jsonl`. The one exception is this repo's own GitHub slug, inside its raw and clone URLs, because the one-command setup must name where it comes from. `checks.ts` scans every file. An upstream skill stays as that project published it.

## Goals

1. One config, `config.toml`, applied across macOS, Linux, and Windows Git Bash by `./apply`. Machines converge by copying that file, never by merging.
2. `./apply` is idempotent and safe. It backs up a differing live config before replacing it, refuses unknown OS paths, and always prints the JSON report defined in `AGENTS.md`.
3. A machine you claim is updated meets the good-machine definition in `AGENTS.md`, by running `./apply` from a current checkout. Shipping the commit is not shipping the setup.

## Skills

Every tool or service this repo uses has its skill in `skills/`. An agent reads that skill before using the tool. A skill that lives only on one computer does not count.

Use the official upstream skill when one exists, and leave its published files untouched. Each one records its origin in its `SOURCE` file:

- `skills/turnkey-tk`: the `tk` 0.7.0 package from `tk skills install --into skills` (<https://github.com/tkhq/tk>), including `turnkey-tk.json`. Do not add another way to handle secrets or keys.
- `skills/container`: the official Apple container skill from `apple/container`, including its `references/`.
- `skills/herdr/SKILL.md`: the official Herdr skill from `herdrdev/herdr` tag `v0.9.5`.
- `skills/ponytail/SKILL.md`: pinned and licensed. How a published skill stays current is `skills/author-skill/references/vendor.md`.

To add a third-party skill, fetch it with `npx skills`, copy it into `skills/` by hand, and commit it. When no upstream skill exists, write one with `skills/author-skill/SKILL.md`, in the format of `skills/turnkey-tk`.

Every skill opens with two tables before its body. **Pre-requisites** lists the checks an agent runs before using the skill; each command finishes in under five seconds. **Decisions** lists each choice, the exact field to set (a `config.toml` key, a policy field, a flag, or an argument), its options, and the default. A decision that changes no field does not belong in the table. `skills/herdr/bootstrap.md` is the questioning procedure for those tables; change rounds, question count, or the implementation limit there. Our tables are our files beside upstream packages, so set them aside before running an upstream installer or update, and put them back after.

## Scripts

Script in TypeScript (Deno), following `skills/agent-ready/SKILL.md`. `apply` is the one shell script, because it must run before anything else exists. Do not add a Python file or another shell script.

| File | Job |
| --- | --- |
| `setup.ts` | The one public entry. Its command is in `AGENTS.md`. Do not add a second one. |
| `evals.ts` | The one eval runner, on the host: the sandbox and its modes. |
| `checks.ts` | Behavior checks, inside the sandbox. |
| `agent.ts` | The agent eval, inside the sandbox. |
| `results.ts` | Row shapes, metrics, validation, and the README results block. |
| `lib.ts` | Helpers two or more of those share. |

## Evals

There are no unit tests, only evals.

- **Checks.** `./evals.ts` (default `macos`) builds `Containerfile` and runs `checks.ts` as uid 1000, in an Apple container with a read-only root, no capabilities, a tmpfs home, and no host mounts. `./evals.ts linux` runs the same image and checks in Docker. `.github/workflows/test.yml` runs both on every push. They must pass before a change is done.
- **What to check.** Add a check when behavior is added or changed: a new OS path, refusal, exit code, report field, or handoff. Check what a command does, never the wording of a doc. Never point a check at the host home.
- **Shell.** `./evals.ts macos --shell` opens the same sandbox with the tree in `~/src`, so you can try a change by hand. It records nothing.
- **Agent eval.** `./evals.ts macos --agent` runs locally, never in CI. Inside the sandbox, `agent.ts` installs Herdr with `./apply` and runs the eval prompt with Pi inside Herdr on the agent model. Then Pi on the judge model scores the whole session with `REVIEWER.md`, using read-only tools. The copy the agent gets never includes `evals.jsonl`. Both models come from one llama-server on the host, in router mode, reachable from the sandbox at its gateway:

  ```text
  llama-server --models-dir <models folder> --models-max 1 --host 127.0.0.1,192.168.64.1 --port 9931 -c 65536 --jinja
  ```

  `HERDR_EVAL_MODEL_URL` overrides the address. On macOS, the application firewall must allow incoming connections to `llama-server`.
- **Definitions.** `evals.json` holds each eval as an `id` and a `prompt` per setup version. It also holds the two model ids and the `judge_fields` option lists. An eval does not say what it tests; the judge decides from the work and may only choose from those lists. Extend a list when a run needs an option it lacks. There is one eval, `one-question`. Add another only for a reason a scored run gave you.
- **Results.** Each scored run appends one row to `evals.jsonl`, carrying:
  - the verdict: grade, domain, task type, outcome, a grade with evidence per capability, depth, reason, and findings;
  - both whole Pi sessions, the agent's and the judge's;
  - the metrics measured from each session: seconds, turns, tool calls by name, tool errors, tokens (input, output, cache read, cache write), and compactions.

  Then `evals.ts` re-renders the results block in `README.md` from the latest row per model. Never edit `evals.jsonl` or that block by hand, not even to fix a number; fix the code and run again. `checks.ts` fails when a row's metrics differ from its sessions, or when the block differs from what the rows render. A new setup version gets its own rows and inherits no grade.
- **Live machines.** When a change affects install, reload, or a live path, also run a real `./apply` on a machine you can use, and report which systems ran.

## Required for every change

- Follow `skills/ponytail/SKILL.md`.
- Follow `skills/repo-protection/SKILL.md` for the repository lock. The committed policy, `skills/repo-protection/references/policy.json`, is the source of truth. Do not leave the lock only on the host.
- Behavior lands in `apply` or `config.toml`, not in a side path.
- Keys in `config.toml` are real Herdr keys from <https://herdr.dev/docs/config-reference/>. Do not invent keys.
- When the applied config's meaning changes, bump `SETUP_VERSION` in `apply` and the `herdr-setup:` stamp in `config.toml` together, and add that version to `evals.json`.
- After the change is on `main`, run `./apply` on each Herdr machine you are responsible for, and keep the JSON. A machine you cannot reach stays listed as not updated.

## Out of scope

- Herdr product bugs. Report those upstream.
- Dotfiles other than this Herdr config.
- Per-machine exceptions in `config.toml`. If a machine truly needs a different value, stop and ask. Silent forks are how the herd splits.
- Unsigned commits, force-pushes, and moved or deleted tags, on any branch. GitHub rejects them. The public can read, clone, and fork; a fork is a different repository.

## Pull requests and merging

Commits are signed on every branch. The authenticated owner merges signed commits into `main`, directly or by pull request, after the evals pass.

A pull request explains the setting in one paragraph: what a person sees in Herdr, and why it is the default for every machine. Paste the `./evals.ts` result. List the machines where `./apply` has run and those still pending. Review uses `REVIEWER.md`.

Agents do not merge their own change and then hand-edit a client to match. The client runs `./apply`.
