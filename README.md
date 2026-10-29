# herdr

![commit status](badges/commit.svg)
![tests run](badges/tests.svg)
![test seconds](badges/time.svg)

A bare-bones starter harness for [Herdr](https://herdr.dev): the same panes, keys, theme, worktrees, and sidebar on the next computer. This repo is that config and the script that copies it. It does not ship the Herdr binary.

```text
deno run --allow-run --allow-read --allow-write --allow-net setup.ts
```

`deno` must be on `PATH`. From a checkout, that runs `./apply`, then prints one JSON object. The `prompt` field is the required `/bootstrap` text. The script does not start an agent.

`./test.ts` rewrites the status block and the pills below. That block is the last local test, not a step you must pass before setup. Do not edit it by hand.

<!-- status:start -->
## Status

| | |
| --- | --- |
| result | pass |
| cases | 32 |
| seconds | 19 |
| revision | 3678409+ |
| setup | 1 |

### Harness

One public script applies this Herdr config on a computer, then hands an agent the required /bootstrap prompt.

![capability heatmap](badges/evals.svg)

### Progress

| t | kind | name | status | detail |
| --- | --- | --- | --- | --- |
| 0s | run | arch | ok | macos |
| 0s | run | container-system | start |  |
| 0s | run | image-build | start | herdr-sandbox |
| 2s | run | image-build | ok | herdr-sandbox |
| 2s | run | container | start | herdr-test-16917 |
| 3s | run | container | ok | herdr-test-16917 |
| 5s | check | arch | ok |  |
| 5s | check | events | ok |  |
| 5s | check | skill | ok |  |
| 5s | check | herdr-skill | ok |  |
| 5s | check | ponytail | ok |  |
| 5s | check | repo-protection | ok |  |
| 5s | check | skills-rule | ok |  |
| 5s | check | checklist | ok |  |
| 5s | check | bootstrap | ok |  |
| 5s | check | identity | ok |  |
| 5s | check | reviewer | ok |  |
| 5s | check | models | ok |  |
| 5s | check | evals | ok |  |
| 5s | check | setup | ok |  |
| 5s | check | tk | ok |  |
| 5s | check | pills | ok |  |
| 5s | check | status | ok |  |
| 5s | check | fresh | ok |  |
| 5s | check | idempotent | ok |  |
| 5s | check | drift | ok |  |
| 5s | check | linux | ok |  |
| 5s | check | windows | ok |  |
| 5s | check | unknown-os | ok |  |
| 5s | check | unwritable | ok |  |
| 5s | check | installer | ok |  |
| 5s | check | stamp | ok |  |
| 17s | check | live-apply | ok |  |
| 19s | check | live-config | ok |  |
| 19s | check | live-agents | ok |  |
| 19s | check | live-core | ok |  |
| 19s | check | live-worktree | ok |  |
| 19s | check | live-stop | ok |  |
| 19s | result | suite | pass |  |

### Memory

```text
container herdr-test-16917
memory 146.0 MiB / 1024.0 MiB
cpu_usec 1430195
pids 2
net_rx 29963764
net_tx 300659
block_read 120872960
block_write 0
```

### System

```text
container 1.5.0, arm64, cpus 8, running 2/2, images 6

disk:
TYPE           TOTAL  ACTIVE  SIZE     RECLAIMABLE
Images         6      2       7.48 GB  4.38 GB (59%)
Containers     2      2       4.02 GB  0 B (0%)
Local Volumes  0      0       0 B      0 B (0%)
```

### Grades

| model | where | skill-calling/bootstrap |
| --- | --- | --- |
| qwen2.5-coder-3b-instruct-q8_0 | local | D |
| grok-4.7 | cloud | A |
<!-- status:end -->

## Highlights

- No first-run onboarding wizard.
- Headless agent panes are 160×50.
- Login shells, so PATH is the normal one.
- Git worktrees under `~/.herdr/worktrees`.
- Prefix `ctrl+b`, plus ctrl+alt focus, tabs, splits, and zoom.
- Catppuccin, following the terminal light/dark appearance.
- Sidebar shows machine, workspace, tab, agent, and state. Toasts still show over SSH.

## Try it

macOS, Linux, Windows Git Bash, or WSL. WSL is Linux. PowerShell alone cannot host `./apply`. The raw URL of `setup.ts` (`https://raw.githubusercontent.com/<owner>/<repo>/<ref>/setup.ts`) shallow-clones that ref to `~/.herdr/harness` when `apply` is not already beside the script. That path needs `git` on `PATH`.

| Exit | Meaning |
| --- | --- |
| `0` | The config file on disk is this setup. A server that was already running has loaded it only when `reload` is `reloaded`. |
| `2` | The file is in place and Herdr is missing. Install from <https://herdr.dev/docs/install/> and run `./apply` again. Do not rewrite the config while doing that. |
| `1` | Not applied. Do what `next` says. |

Run `./apply` a second time on a good machine. `changed` is false and `backup_path` is null.

Do not hand-edit `~/.config/herdr/config.toml` (or `%APPDATA%\herdr\config.toml` on Windows). The next `./apply` replaces it. Do not reinstall Herdr when `install` is already `present`.

## Defaults

`config/config.toml` (`herdr-setup: 1`) is a small override, not a dump of every Herdr default. The same file lands on every machine.

| You see | Why |
| --- | --- |
| No first-run onboarding | The file is the setup. A wizard would diverge per computer. |
| Agent panes with no client are 160×50 | A headless session still gets a wide terminal. |
| Login shells; a new pane follows the current directory | PATH stays normal, including macOS `path_helper` and Homebrew. |
| Git worktrees under `~/.herdr/worktrees` | Every machine puts worktrees in the same directory. |
| SSH keepalive and connection reuse for `herdr --remote` | Herdr keeps a private SSH config for that. It is not a shared list of hosts. |
| Prefix `ctrl+b`, plus ctrl+alt focus (`h` `j` `k` `l`), tabs, splits, and zoom | The prefix keeps the tmux habit. The ctrl+alt chords are the set Herdr documents as safe across terminals. |
| Catppuccin, following light (`catppuccin-latte`) and dark | One theme, matching the terminal appearance. |
| Borders always on, status as symbols, title `{hostname}: {workspace}` | You can see which machine and workspace you are in. |
| Sidebar: state, machine, workspace, tab, then agent and state | The headline states are working, blocked, and done. The sidebar can also show idle and unknown. |
| In-app toasts, bottom-right, after 1s | They still show over SSH. |

Anything this file does not set is product behavior: <https://herdr.dev/docs/> and <https://herdr.dev/agent-guide.md>.

## Map

Open the file that matches the job.

| Path | Role |
| --- | --- |
| `setup.ts` | The one public script. Runs `apply`, then hands an agent `/bootstrap`. |
| `apply` | Copies `config/config.toml` onto the machine. Prints one JSON report. |
| `config/config.toml` | The config `apply` copies. The `herdr-setup` stamp must match `SETUP_VERSION` in `apply`. |
| `AGENTS.md` | How an agent sets a machine up. Read this README first for current status. |
| `CONTRIBUTING.md` | Rules for changing the setup. No personal information in the repo. |
| `test.ts` | The only test. `./test.ts` (`macos`) uses an Apple container. `./test.ts linux` uses Docker. It rewrites the status block and the pills. |
| `.github/workflows/test.yml` | `macos` on the self-hosted `mac-studio` runner. `linux` on `ubuntu-latest`. |
| `agents/independent-reviewer.md` | Reviews a change, or scores an agent run. |
| `evals/results.json` | Score source. `agents/models.md` and `badges/evals.svg` are rendered from it. |
| `skills/` | One directory per tool. `skills/turnkey-tk` is the upstream tk package, left as published. `skills/ponytail` is required for every change. `skills/repo-protection` is the repository lock and commit signing. |
| `badges/` | Pills for the last local test: result, cases, seconds. |

## Change it

1. Change `config/config.toml`, bump `SETUP_VERSION` in `apply` and the `herdr-setup` stamp together, then run `./apply`. Do not edit the live file.
2. Run `./test.ts` before sending a change. `deno` must be on `PATH`. The report stays in four sections even when the test fails.
3. Do not hand-edit the live config. Do not reinstall Herdr when `install` is already `present`.
4. Push a branch. GitHub rejects unsigned commits, force-push, and a direct push to `main`. Merge after the linux and macos checks pass.
5. Secrets go through `tk` only. Do not put a key in the repo.
