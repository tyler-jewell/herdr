# Agents

This file is the guide for setting up Herdr with Tyler's setup. Read it before installing, editing, or "fixing" Herdr on a machine. Changes to the setup follow `CONTRIBUTING.md`. There is no second agent guide.

Herdr the product is documented at <https://herdr.dev/agent-guide.md> and <https://herdr.dev/docs/>. This repo is the personal config. When they disagree, the product docs win for how Herdr works, and this repo wins for which settings belong on Tyler's machines.

## Set up a machine

1. Clone `https://github.com/tyler-jewell/herdr` onto the machine. Run `./apply` from that checkout. Do not paste the config into place yourself.
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

- Do not hand-edit the live `config.toml`. The next `./apply` will replace it. Put the change in this repo first (`CONTRIBUTING.md`), then apply.
- Do not reinstall Herdr when `install` is `present`.
- `apply` installs Herdr only when the binary is missing, using the official installer (`https://herdr.dev/install.sh`, or `install.ps1` from Git Bash). A failed install must not be papered over by copying binaries from another machine.
- A backup is the previous config, for reading. Do not merge it back. The repo file is the setup.
- Test overrides (`HERDR_SETUP_HOME`, `HERDR_SETUP_OS`, `HERDR_SETUP_APPDATA`, `HERDR_SETUP_SKIP_INSTALL`, `HERDR_SETUP_SKIP_RELOAD`, `HERDR_SETUP_INSTALL_CMD`) are for `tests/apply_test.sh`. Never set them on a real machine.
- WSL is Linux. Native Windows is Git Bash. PowerShell alone cannot host `./apply`.
- Do not configure shells, git, editors, or SSH in this repo. Those are out of scope. Herdr keys, theme, sidebar, toasts, worktrees, and server defaults in `config/config.toml` are in scope.

## Prove it

From a checkout:

```sh
./tests/apply_test.sh
```

On the machine you just set up, run `./apply` a second time. `changed` must be `false` and `backup_path` must be `null`.
