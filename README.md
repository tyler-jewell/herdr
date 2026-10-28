# herdr

Public, personal Herdr setup for [tyler-jewell](https://github.com/tyler-jewell).

This is a dotfiles repo for [Herdr](https://herdr.dev), the terminal multiplexer coding agents run in. One script applies this setup to the computer it is run on: macOS, Linux, Windows Git Bash, or WSL, on any machine.

```sh
git clone https://github.com/tyler-jewell/herdr.git
cd herdr
./apply
```

`./apply` prints one JSON object and exits `0` when `config/config.toml` is now the Herdr config on that machine. Exit `2` means the file is in place and Herdr itself is still missing. Exit `1` means the file was not applied. The `next` field says what to do. Do not guess past it.

The script is the only way this setup reaches a machine. Editing `~/.config/herdr/config.toml` (or `%APPDATA%\herdr\config.toml` on Windows) by hand drifts that computer off the herd. Change `config/config.toml`, bump the setup version, and run `./apply` again.

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
| `apply` | The only setup entry point. |
| `config/config.toml` | The config that `apply` copies. |
| `AGENTS.md` | How an agent sets a machine up with this repo. |
| `CONTRIBUTING.md` | Rules for changing the setup. |
| `tests/apply_test.sh` | Checks apply against a fake home directory. |

Run `./tests/apply_test.sh` before sending a change.
