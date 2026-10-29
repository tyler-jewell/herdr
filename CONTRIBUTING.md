# Contributing

This file is the change file. Which file a rule belongs in is the hard rule at the top of `AGENTS.md`. Do not restate machine setup here.

These rules apply to every change, including changes made by an agent. A change that does not follow them is not done.

The point of this repo is that every machine using this setup runs the same Herdr config. `./apply` is how a change leaves git and lands on a machine. A patch that edits a live config, documents a manual step, or only updates one computer is incomplete.

## No personal information

This repo does not identify a person. No legal name, email address, account name, location, hostname, or home path. A change that adds one is not done. `test.sh` checks the files this repo writes.

An upstream skill stays as that project published it. Do not add a person to it.

## Goals

1. One script, `apply`, works on macOS, Linux, and Windows Git Bash. An OS it cannot handle exits with `status: failed` and a `next` step. It does not write a guessed path.
2. One config, `config/config.toml`. Machines converge by copying that file. They do not merge.
3. `./apply` is idempotent. A second run on a good machine reports `changed: false` and writes no backup.
4. Replacing a different existing config always keeps a backup first. If the backup cannot be written, the live file stays.
5. Failure and partial success always print the JSON report, including `next`.
6. A machine you claim is updated meets the good-machine definition in `AGENTS.md`. "It should be fine" is not that definition.
7. Every client that uses this setup gets the change by running `./apply` from a current checkout. Shipping the git commit is not shipping the setup.

## Skills

Every tool or service this repo uses has its skill in `skills/`. Version control, deploy, containers, secrets, and anything added later. An agent reads that skill before using the tool. A skill that lives only on one computer does not count.

Use the official skill when one exists. Cloudflare work uses the Cloudflare skills plugin. Stripe work uses the Stripe skills plugin. The same goes for any other service. Do not rewrite an official skill. Those two are examples of the rule. This repo does not use them today.

When you need a skill that is not already in this repo, fetch it with `npx skills`, then copy it into `skills/` by hand and commit it. `npx skills` is only how you fetch. The committed copy is the one agents use.

When no skill exists, write one in `skills/` and commit it. Follow `skills/author-skill/SKILL.md` to do that. Every skill this repo writes follows the format of `skills/turnkey-tk`. That skill is clean, modern, and very powerful.

Each skill has one `CHECKLIST.md` beside its `SKILL.md`. That file is the live decision list for the skill. Update it in the same change when the skill's commands or docs change. Do not copy it into another file. `test.sh` checks that it is there. `CHECKLIST.md` is not part of an upstream package. `tk skills install` refuses a package it did not write, so set those files aside before an install and put them back after.

`skills/herdr/bootstrap.md` is the questioning procedure for those checklists. Change the rounds, the question count, or the implementation limit there. It has no `CHECKLIST.md` of its own. Do not copy the procedure into another file.

`skills/herdr/SKILL.md` is the official Herdr skill from `herdrdev/herdr` tag `v0.9.5`. Leave it as published. `skills/herdr/bootstrap.md` and `skills/herdr/CHECKLIST.md` are this repo's files beside it. Set those aside before replacing the official file, then put them back. `test.sh` checks the official file is there.

## Required for every change

- Behavior changes land in `apply` or `config/config.toml`, not in a side path.
- When the applied config's meaning changes, bump `SETUP_VERSION` in `apply` and the `herdr-setup:` line in `config/config.toml` together. Old machines stay identifiable until they apply.
- Keys must be real Herdr config keys from <https://herdr.dev/docs/config-reference/>. Do not invent keys. Herdr silently falls back on invalid values and the machine looks configured when it is not.
- `skills/container` is the official Apple container skill from `apple/container`, including its references. Do not replace it with a rewrite. `test.sh` checks that it is there. The independent reviewer reads it when a change touches the container runtime. Container commands stay the ones that skill lists.
- `skills/turnkey-tk` is the tk 0.7.0 package from `tk skills install --into skills` (<https://github.com/tkhq/tk>). Leave the files the installer wrote, including `turnkey-tk.json`. Do not add another way to handle secrets or keys. `test.sh` checks this.
- `./test.sh` is the only test. Do not add a second test file. The argument is the arch, and the default is `macos`. `macos` is this Mac: the script builds `sandbox/Containerfile` and runs the checks as uid 1000 in a read-only Apple container with no host mounts and no capabilities. The live half installs Herdr there and checks config, agents, and core commands. An arch that does not exist yet fails. It does not guess another runtime. Add a check in `test.sh` for new behavior (a new OS path, a new refusal, a new exit code, a new arch). Do not point the checks at the host home. stdout is four sections, `test`, `memory`, `system`, `result`, including when the test fails. Container pull and boot output is not part of that log. As each step finishes, `test.sh` appends a Server-Sent Event to `test.events.sse`. That file is the chronological stream. Do not treat it as the report, and do not commit it.
- `./test.sh` rewrites `badges/commit.svg`, `badges/tests.svg`, and `badges/time.svg` from that run: pass or fail for the tree under test (latest commit, local changes included), the number of cases that ran, and the wall-clock seconds including container startup. Do not edit those numbers by hand.
- `./test.sh` passes before the change is done.
- Say which systems you ran. The test script is mandatory. A real `./apply` on a machine you can use is required when the change affects install, reload, or a live path.
- After the change is on `main`, run `./apply` on each Herdr machine you are responsible for, and keep the JSON. A machine you cannot reach stays listed as not updated. Do not claim the herd is current.

## Out of scope

- Herdr product bugs. Report those upstream.
- Dotfiles other than this Herdr config.
- Per-machine exceptions inside `config.toml`. If a machine truly needs a different value, stop and ask. Silent forks are how the herd splits.
- Force-pushing `main`. A failing test is fixed in the repo and re-run. It is not fixed on one computer.

## Pull requests

Explain the setting in one paragraph: what a person sees in Herdr, and why it is the default for every machine. Paste the test result. List machines where `./apply` has already been run, and machines still pending.

Review is the independent reviewer named in the Agents section of `AGENTS.md`.

Agents do not merge their own change and then hand-edit a client to match. The client runs `./apply`.
