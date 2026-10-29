# Agents

## Which file

Hard rule. One question, one file. No exceptions and no copies.

Is this about a machine, or about a change?

- A machine: setup, `./apply`, the JSON report, or whether that computer is good. It belongs in `AGENTS.md` only.
- A change: editing the repo, tests, merge, or rolling a change out. It belongs in `CONTRIBUTING.md` only.
- Calling an agent: the Agents section. The agent's job belongs in its own file.

A sentence about both gets split. Each file keeps its own sentence. Do not paste a rule into the other file. Point at it.

This file is the machine file. Read it before installing or fixing Herdr on a computer.

Herdr the product is documented at <https://herdr.dev/agent-guide.md> and <https://herdr.dev/docs/>. This repo is the config. When they disagree, the product docs win for how Herdr works, and this repo wins for which settings belong on a machine.

## Set up a machine

A new machine starts with `setup.ts`. That script runs `./apply`, then hands an agent the prompt to work with the human on `/bootstrap`. That handoff is required. How scripts are written is `CONTRIBUTING.md`.

1. Use a checkout of this repo on the machine. Run `./apply` from that checkout. Do not paste the config into place yourself.
2. Read the JSON object on stdout. Ignore the urge to treat a friendly log line as success.
3. Stop when you can say which of these is true.

A machine is good when all of these hold:

- `./apply` exits `0`.
- `status` is `applied`.
- `setup_version` matches `SETUP_VERSION` in `apply` and the `herdr-setup:` stamp in `config/config.toml`.
- The file at `config_path` is byte-for-byte the repo's `config/config.toml`.
- `reload` is `reloaded`, or there is no Herdr server running yet. If `reload` is `failed`, the file is right and a live session may be stale. Follow `next`.

`exit 0` means the file on disk is this setup. It does not mean a server that was already running has loaded it, unless `reload` is `reloaded`.

## Report fields

| Field | Meaning |
| --- | --- |
| `status` | `applied`, `partial`, or `failed`. |
| `exit_code` | `0` applied, `2` config written but Herdr missing, `1` config not applied. |
| `setup_version` | The generation of the config this script writes. |
| `os` | Value used to pick the path (`uname -s`, unless a test override is set). |
| `config_path` | Destination. macOS and Linux: `$HOME/.config/herdr/config.toml`. Windows Git Bash: `%APPDATA%\herdr\config.toml`. |
| `written` | `true` when the destination matches the repo file. |
| `changed` | `true` when this run replaced or created it. |
| `backup_path` | Previous file, if one existed and differed. `null` when nothing was replaced. |
| `herdr` | Binary path, or `null`. |
| `install` | `present`, `installed`, `failed`, or `skipped`. |
| `reload` | `reloaded`, `failed`, or `skipped`. |
| `reload_detail` | Short installer or reload output when something failed. |
| `message` | What happened. |
| `next` | The only follow-up. `null` when none is required. |

`partial` (`exit 2`): the config is already correct. Install Herdr from <https://herdr.dev/docs/install/> and run `./apply` again. Do not rewrite the config while doing that.

`failed` (`exit 1`): nothing you wanted is applied, or the script refused to risk the existing file. Do what `next` says. Do not invent a config path for an OS the script rejected.

## Rules while setting up

- Do not hand-edit the live `config.toml`. The next `./apply` replaces it. A change to the setup is `CONTRIBUTING.md`, then `./apply` on this machine.
- Do not reinstall Herdr when `install` is `present`.
- `apply` installs Herdr only when the binary is missing, using the official installer (`https://herdr.dev/install.sh`, or `install.ps1` from Git Bash). A failed install must not be papered over by copying binaries from another machine.
- A backup is the previous config, for reading. Do not merge it back. The repo file is the setup.
- Test overrides (`HERDR_SETUP_HOME`, `HERDR_SETUP_OS`, `HERDR_SETUP_APPDATA`, `HERDR_SETUP_SKIP_INSTALL`, `HERDR_SETUP_SKIP_RELOAD`, `HERDR_SETUP_INSTALL_CMD`) exist so `test.ts` can use a fake home. Never set them on a real machine.
- WSL is Linux. Native Windows is Git Bash. PowerShell alone cannot host `./apply`.
- On a machine, run `./apply` and stop. Do not change shells, git, editors, SSH, or anything else.
- A secret or a key is handled only with `tk` (<https://github.com/tkhq/tk>). Read `skills/turnkey-tk/SKILL.md` and follow it. Do not print the value, and do not put it in this repo or in any other store.
- When a skill is used, decide every item in that skill's `CHECKLIST.md` before acting. The checklist is the decision list. Do not invent a setup the checklist does not allow.
- Open checklist items for a new system are decided by `skills/herdr/bootstrap.md` before that system is built.
- Controlling Herdr panes is `skills/herdr/SKILL.md`. Follow it. Do not paste it.

## Prove it

On the machine you just set up, run `./apply` a second time. `changed` must be `false` and `backup_path` must be `null`.

## Agents

### Independent reviewer

File: `agents/independent-reviewer.md`

When: a change needs a review, or a Herdr agent run needs a score. A person can start it, or CI/CD can start it. The job is the same either way.

How: give the agent that file and the change, or the run (prompt, context, turn limit, and reply). Do not set the depth or the grade. The agent reads the source-of-truth docs named in that file, each one whole, before it reviews. When the change touches the container runtime, it also reads `skills/container/SKILL.md` whole. Do not paste that skill. A score is recorded in `agents/models.md`.
