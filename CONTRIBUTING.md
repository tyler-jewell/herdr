# Contributing

This file is the change file. Which file a rule belongs in is the hard rule at the top of `AGENTS.md`. Do not restate machine setup here.

These rules apply to every change, including changes made by an agent. A change that does not follow them is not done.

The point of this repo is that every machine using this setup runs the same Herdr config. `./apply` is how a change leaves git and lands on a machine. A patch that edits a live config, documents a manual step, or only updates one computer is incomplete.

## Principles

- **KISS**: Keep it simple. No clever tricks. Prefer obvious over clever.
- **SSOT**: Single Source of Truth. Each fact lives in exactly one place. If you need it elsewhere, point to it.
- **DRY**: Don't repeat yourself. Duplication breeds drift.
- **No cruft**: If a file, code, or doc is not pulling its weight, remove it. Better to have less than to have noise.
- **No file is a good file**: If something doesn't need to exist, delete it. Every file must earn its keep.
- **Take what they give us**: Never add ad-hoc setup, conventions, or scaffolding. When using an official tool, package, or installer, take its structure as-is. Don't invent our own patterns on top of theirs.

## No personal information

This repo does not identify a person. No legal name, email address, account name, location, hostname, or home path. A change that adds one is not done. `evals.ts` checks the files this repo writes.

An upstream skill stays as that project published it. Do not add a person to it.

## Goals

1. One config, `config.toml`, applied across macOS, Linux, and Windows Git Bash via `./apply`. Machines converge by copying that file, never merging.
2. `./apply` is idempotent and safe: it backs up any differing live config before replacing it, refuses unknown OS paths, and always emits the JSON report defined in `AGENTS.md`.
3. Every machine you claim is updated meets the good-machine definition in `AGENTS.md` by running `./apply` from a current checkout. Shipping the git commit is not shipping the setup.

## Skills

Every tool or service this repo uses has its skill in `skills/`. An agent reads that skill before using the tool. A skill that lives only on one computer does not count.

Use the official upstream skill when one exists and leave its published files untouched ("Take what they give us"):

- `skills/turnkey-tk`: the `tk` 0.7.0 package from `tk skills install --into skills` (<https://github.com/tkhq/tk>), including `turnkey-tk.json`, tracked in `skills/turnkey-tk.SOURCE`. Do not add another way to handle secrets or keys.
- `skills/container`: the official Apple container skill from `apple/container`, including its `references/`.
- `skills/herdr/SKILL.md`: the official Herdr skill from `herdrdev/herdr` tag `v0.9.5`, tracked in `skills/herdr/SOURCE`.
- `skills/ponytail/SKILL.md`: pinned and licensed in `skills/ponytail/SOURCE`. How a published skill stays current is `skills/author-skill/references/vendor.md`.

When you need a third-party skill that is not already in this repo, fetch it with `npx skills`, then copy it into `skills/` by hand and commit it. `npx skills` is only how you fetch; the committed copy is the one agents use.

When no upstream skill exists, write one in `skills/` and commit it. Follow `skills/author-skill/SKILL.md` to do that. Every skill this repo writes follows the format of `skills/turnkey-tk`.

Each skill has one `CHECKLIST.md` beside its `SKILL.md`. That file is our live decision list for the skill; update it in the same change when the skill's commands or docs change. Do not copy it into another file. Because `CHECKLIST.md` (and `skills/herdr/bootstrap.md`) are our files beside upstream packages, set them aside before running an upstream installer or update and put them back after.

`skills/herdr/bootstrap.md` is the questioning procedure for those checklists. Change the rounds, the question count, or the implementation limit there. It has no `CHECKLIST.md` of its own. Do not copy the procedure into another file.

## Scripts

Script in TypeScript. Follow `skills/agent-ready/SKILL.md`. Do not add a Python file or a shell script beside `apply`.

`setup.ts` is the one public script (`deno run --allow-run --allow-read --allow-write --allow-net setup.ts` from a checkout or raw URL). It runs `apply`, then hands an agent the prompt to work with the human on `/bootstrap`. That handoff is required. Do not add a second public script.

## Evals (no traditional tests)

**There are no traditional unit/integration tests in this repo. Only evaluations (evals).**

- **Single runner**: `evals.ts` is the only eval runner. Do not add a second runner or eval file. The argument is the arch, and the default is `macos`. `macos` builds `sandbox` and runs the checks as uid 1000 in a read-only Apple container with no host mounts and no capabilities. `linux` runs those same checks in Docker with the same image and isolation. The live half installs Herdr inside the container and checks config, agents, and core commands. Any other arch fails without guessing a runtime. `.github/workflows/test.yml` runs `macos` on the self-hosted `mac-studio` runner and `linux` on hosted `ubuntu-latest`. Add an evaluation in `evals.ts` for new behavior (a new OS path, a new refusal, a new exit code, a new arch). Do not point checks at the host home. stdout is four sections (`test`, `memory`, `system`, `result`), even when an eval fails. As each step finishes, `evals.ts` appends a Server-Sent Event to `eval.events.sse`. That file is the chronological stream; do not treat it as the report, and do not commit it.
- **Badges**: `./evals.ts` rewrites `badges/commit.svg`, `badges/tests.svg`, and `badges/time.svg` from that run: pass or fail for the working tree (latest commit plus local changes), the number of cases that ran, and wall-clock seconds including container startup. Do not edit those numbers by hand.
- **README status**: `./evals.ts` rewrites the status block in `README.md` from that same run: the value list, every step, the memory sample, the system summary, and the grade table. The value list is only scored agent runs from `eval-results.json`. A core check is not value. Do not edit that block by hand, and do not put a home path or an account in it.
- **Eval data**: Evals are `eval-results.json`: one matrix per `SETUP_VERSION`, then a domain, then its evals, then one grade per model (`local` or `cloud`). A new setup version gets its own entry and does not inherit grades. `./evals.ts` renders every version into `agents/models.md`, `badges/evals.svg`, and the README value tally on every run. Add a score only for a run that was scored by `agents/independent-reviewer.md`. Do not invent a grade, and do not edit the rendered table or heatmap by hand.
- **Must pass**: `./evals.ts` must pass before the change is done. When a change affects install, reload, or a live path, also run a real `./apply` on a machine you can use and report which systems ran.

## Required for every change

- Follow `skills/ponytail/SKILL.md` on every change.
- Follow `skills/repo-protection/SKILL.md` for the repository lock. The committed policy (`skills/repo-protection/references/policy.json`) is the source of truth. Do not leave the lock only on the host.
- Behavior changes land in `apply` or `config.toml`, not in a side path.
- Keys in `config.toml` must be real Herdr config keys from <https://herdr.dev/docs/config-reference/>. Do not invent keys.
- When the applied config's meaning changes, bump `SETUP_VERSION` in `apply` and the `herdr-setup:` line in `config.toml` together, and add the new version entry to `eval-results.json`.
- After the change is on `main`, run `./apply` on each Herdr machine you are responsible for, and keep the JSON. A machine you cannot reach stays listed as not updated.

## Out of scope

- Herdr product bugs. Report those upstream.
- Dotfiles other than this Herdr config.
- Per-machine exceptions inside `config.toml`. If a machine truly needs a different value, stop and ask. Silent forks are how the herd splits.
- Unsigned commits, force-pushes, or moved/deleted tags on any branch. GitHub rejects unauthenticated, unsigned, or non-fast-forward pushes. The public can read, clone, and fork; a fork is a different repository.

## Pull requests and merging

Signed commits are required on all branches. The authenticated repository owner can merge signed commits directly into `main` or via a pull request after evals pass; unauthenticated, unsigned, or force-pushes are rejected by the repository ruleset.

When opening a pull request or recording a change, explain the setting in one paragraph: what a person sees in Herdr, and why it is the default for every machine. Paste the `./evals.ts` result. List machines where `./apply` has already been run, and machines still pending.

Review uses the independent reviewer named in the Agents section of `AGENTS.md`.

Agents do not merge their own change and then hand-edit a client to match. The client runs `./apply`.
