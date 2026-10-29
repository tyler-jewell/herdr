# herdr

![commit status](badges/commit.svg)
![tests run](badges/tests.svg)
![test seconds](badges/time.svg)

Pills are rewritten by `./test.ts`. They describe that run: pass or fail for the latest commit with local changes included, how many test cases ran, and the total seconds including container startup.

This is a setup repo for [Herdr](https://herdr.dev), the terminal multiplexer coding agents run in. One public script sets up the computer it is run on: macOS, Linux, Windows Git Bash, or WSL, on any machine.

```text
deno run --allow-run --allow-read --allow-write --allow-net setup.ts
```

Run that from a checkout, or point `deno run` at the raw URL of `setup.ts`. The script runs `./apply`, then hands an agent the prompt to work with the human on `/bootstrap`. That handoff is required.

`./apply` is the step that copies the config. It prints one JSON object and exits `0` when `config/config.toml` is now the Herdr config on that machine. Exit `2` means the file is in place and Herdr itself is still missing. Exit `1` means the file was not applied. The `next` field says what to do. Do not guess past it.

The public script is the way this setup reaches a machine. Editing `~/.config/herdr/config.toml` (or `%APPDATA%\herdr\config.toml` on Windows) by hand drifts that computer off the herd. Change `config/config.toml`, bump the setup version, and run `./apply` again.

## What it sets

`config/config.toml` is the opinionated config. It is a small override, not a dump of every Herdr default:

- Skip first-run onboarding.
- 160×50 headless size for agent panes with no client attached.
- Login shells, so new panes see the normal PATH.
- Git worktrees under `~/.herdr/worktrees`.
- Prefix `ctrl+b`, plus the ctrl+alt chords Herdr documents as safe across terminals.
- Catppuccin, following the terminal light/dark appearance.
- Borders on, status by symbol and color, window title `{hostname}: {workspace}`.
- Sidebar rows show machine, workspace, tab, agent, and state.
- In-app toasts, which still work over SSH.

Product behavior that this file does not cover lives in the Herdr docs: <https://herdr.dev/docs/>.

## Layout

| Path | Role |
| --- | --- |
| `setup.ts` | The one public script. Runs `apply`, then hands an agent `/bootstrap`. |
| `apply` | Copies `config/config.toml` onto the machine. |
| `config/config.toml` | The config that `apply` copies. |
| `AGENTS.md` | How an agent sets a machine up with this repo. |
| `CONTRIBUTING.md` | Rules for changing the setup. |
| `test.ts` | The only test. Default arch `macos` runs the checks in an Apple container. |
| `agents/independent-reviewer.md` | Reviews a change. A person or CI/CD can call it. |
| `agents/models.md` | Local and cloud models, and the grades they have earned. |
| `skills/turnkey-tk` | Official `tk` skill. Secrets and keys go through `tk` only. |
| `badges/` | Pills for the last local test: result, cases, seconds. |

Run `./test.ts` before sending a change. `deno` must be on `PATH`. The report stays in four sections even when the test fails.
