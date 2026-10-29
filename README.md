# herdr

![commit status](badges/commit.svg)
![tests run](badges/tests.svg)
![test seconds](badges/time.svg)

This is the setup repo for [Herdr](https://herdr.dev). The status block is the current state of the harness. `./test.ts` rewrites that block and the pills. Do not edit them by hand.

<!-- status:start -->
## Status

| | |
| --- | --- |
| result | pass |
| cases | 31 |
| seconds | 18 |
| revision | 4012451+ |
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
| 3s | run | image-build | ok | herdr-sandbox |
| 3s | run | container | start | herdr-test-15310 |
| 4s | run | container | ok | herdr-test-15310 |
| 6s | check | arch | ok |  |
| 6s | check | events | ok |  |
| 6s | check | skill | ok |  |
| 6s | check | herdr-skill | ok |  |
| 6s | check | ponytail | ok |  |
| 6s | check | skills-rule | ok |  |
| 6s | check | checklist | ok |  |
| 6s | check | bootstrap | ok |  |
| 6s | check | identity | ok |  |
| 6s | check | reviewer | ok |  |
| 6s | check | models | ok |  |
| 6s | check | evals | ok |  |
| 6s | check | setup | ok |  |
| 6s | check | tk | ok |  |
| 6s | check | pills | ok |  |
| 6s | check | status | ok |  |
| 6s | check | fresh | ok |  |
| 6s | check | idempotent | ok |  |
| 6s | check | drift | ok |  |
| 6s | check | linux | ok |  |
| 6s | check | windows | ok |  |
| 6s | check | unknown-os | ok |  |
| 6s | check | unwritable | ok |  |
| 6s | check | installer | ok |  |
| 6s | check | stamp | ok |  |
| 16s | check | live-apply | ok |  |
| 18s | check | live-config | ok |  |
| 18s | check | live-agents | ok |  |
| 18s | check | live-core | ok |  |
| 18s | check | live-worktree | ok |  |
| 18s | check | live-stop | ok |  |
| 18s | result | suite | pass |  |

### Memory

```text
container herdr-test-15310
memory 145.6 MiB / 1024.0 MiB
cpu_usec 1271199
pids 2
net_rx 29951621
net_tx 266089
block_read 120750080
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

## Set up

One public script sets up the computer it is run on: macOS, Linux, Windows Git Bash, or WSL.

```text
deno run --allow-run --allow-read --allow-write --allow-net setup.ts
```

Run that from a checkout, or point `deno run` at the raw URL of `setup.ts`. The script runs `./apply`, then hands an agent the prompt to work with the human on `/bootstrap`. That handoff is required.

`./apply` copies the config and prints one JSON object. Exit `0` means `config/config.toml` is now the Herdr config. Exit `2` means the file is in place and Herdr itself is still missing. Exit `1` means the file was not applied. The `next` field says what to do. Do not guess past it.

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
| `AGENTS.md` | How an agent sets a machine up with this repo. Read `README.md` first for current status. |
| `CONTRIBUTING.md` | Rules for changing the setup. |
| `test.ts` | The only test. `macos` uses an Apple container. `linux` uses Docker. It rewrites the status block. |
| `.github/workflows/test.yml` | Runs that test on the self-hosted studio runner and on hosted Linux. |
| `agents/independent-reviewer.md` | Reviews a change, or scores an agent run. |
| `evals/results.json` | Domains, evals, and the local and cloud grade for each. The score source. |
| `agents/models.md` | Grade table rendered from `evals/results.json`. |
| `badges/evals.svg` | Capability heatmap rendered from the same file. |
| `skills/` | One skill per tool. Official packages stay as published. `skills/ponytail` is required for every change. |
| `badges/` | Pills for the last local test: result, cases, seconds. |

Run `./test.ts` before sending a change. `deno` must be on `PATH`. The report stays in four sections even when the test fails. The status block above is the record of that run.
