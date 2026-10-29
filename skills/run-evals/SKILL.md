---
name: run-evals
description: >
  Run the Herdr agent eval one time or many (up to 100) in parallel, inside isolated
  containers. Detect the machine first, choose the concurrency from RAM and CPUs, run each
  eval in its own git worktree, merge the result rows, and re-render README.md and
  results.svg once. Not for changing what is evaluated (evals.json) or the sandbox
  (Containerfile, evals.ts).
---

# run-evals

Purpose: run `./evals.ts <runtime> --agent` N times at once and land every result row in `evals.jsonl`.
Change when: how workers are isolated, how N is chosen, or how rows are merged changes.
Not for: the eval definition (`evals.json`), the scoring (`agent.ts`, `REVIEWER.md`), the sandbox (`Containerfile`, `evals.ts`).

## Pre-requisites

Run these before the skill. Every check finishes in under five seconds.

| # | Check | Command | Pass |
|---|---|---|---|
| 1 | Deno installed | `deno --version` | prints a version |
| 2 | Inside a checkout | `git rev-parse --show-toplevel` | prints a path |
| 3 | Clean tree | `git status --porcelain` | prints nothing |
| 4 | Container runtime | `container system status` (macOS) / `docker info` (Linux) | `status running` |
| 5 | Sandbox image | `container image ls herdr-sandbox` | name listed, or first run builds it |
| 6 | Model server | `curl -sf --max-time 2 "$HERDR_EVAL_MODEL_URL/models"` | HTTP 200 |

`./skills/run-evals/run-evals.sh --preflight` runs all six and exits nonzero if any fails.

## Decisions

Each decision names the exact thing to set. Pick one option, then pass the flag.

| Decision | Field | Options | Default |
|---|---|---|---|
| How many evals to run | `--parallel N` | 1–100 | the safe concurrency (see below) |
| Workers at the same time | `--concurrency C` | 1–100, capped at safe | `min(N, safe)` |
| Runtime | `--runtime` | `macos`, `linux` | auto-detected |
| Model endpoint | `HERDR_EVAL_MODEL_URL` | any URL | `http://192.168.64.1:9931/v1` (macOS) |
| Machine cap | `RUN_EVALS_MAX` | 1–100 | 100 |
| Output | `--json` | text, json | text |

## Decide the number from the machine

Pull the machine's numbers first, then choose N. Each command is instant.

```bash
# macOS
sysctl -n hw.ncpu          # CPUs
sysctl -n hw.memsize       # RAM in bytes
# Linux
nproc                      # CPUs
awk '/MemTotal/{print $2*1024}' /proc/meminfo   # RAM in bytes
```

`run-evals.sh` turns those into a safe concurrency:

```text
per_eval_gb   = 4                       # evals.ts runs each sandbox with --memory 4g
host_reserve  = 8                       # OS plus one loaded model on the llama-server
mem_slots     = max(1, (ram_gb - host_reserve) / per_eval_gb)
cpu_slots     = max(1, cpus / 2)
safe          = min(mem_slots, cpu_slots, RUN_EVALS_MAX, 100)
```

If `--parallel N` is larger than `safe`, the runs go in `ceil(N / safe)` waves. That is how
`--parallel 100` works on a machine that can host only a few at once. The model server is the
real bottleneck when it runs with `--models-max 1`: concurrent workers share one loaded model,
so raising concurrency past `safe` buys queueing, not speed.

Show the plan without running anything:

```bash
./skills/run-evals/run-evals.sh --dry-run
```

## Run it

```bash
# Smart default: one full wave at the detected safe concurrency.
./skills/run-evals/run-evals.sh

# One eval.
./skills/run-evals/run-evals.sh --parallel 1

# One hundred evals, in waves of the safe concurrency.
./skills/run-evals/run-evals.sh --parallel 100

# Cap the machine at 3 workers and run 6 evals (2 waves).
./skills/run-evals/run-evals.sh --parallel 6 --concurrency 3

# Machine-readable summary.
./skills/run-evals/run-evals.sh --parallel 2 --json
```

## How it works

1. Preflight, then detect CPUs and RAM, then compute `safe`, `N`, `concurrency`, and waves.
2. Build `herdr-sandbox` once if it is missing.
3. For each run, create a detached `git worktree` at `HEAD`. The worktree is a clean checkout,
   so `evals.ts`'s one-run-per-commit check passes and no two workers write the same file.
4. In each worktree, run `./evals.ts <runtime> --agent`. Each run gets its own sandbox:
   `--user 1000:1000`, `--cap-drop ALL`, `--read-only`, tmpfs `/tmp` and `/home/tester`,
   no host mounts.
5. After each wave, take the row each run appended to its worktree's `evals.jsonl`.
6. Append every collected row to the real `evals.jsonl`, then run `render.ts` once to rewrite
   the README results block and `results.svg`.
7. Remove the worktrees and print a summary.

## Isolation

- One worktree per worker: no shared `evals.jsonl`, `README.md`, or `results.svg`.
- One container per worker: read-only root, no capabilities, tmpfs home, no host mounts.
- The only host files that change are `evals.jsonl`, `README.md`, and `results.svg`, written
  once at the end by the orchestrator.

## Failures

- A failed worker is counted; the rest keep running. Rows from successful workers are still merged.
- Exit code is `0` only when every run succeeded and at least one row was merged.
- A run that dies early may leave a container named `herdr-test-<pid>`. Inspect with
  `container ls -a` and remove the ones you own with `container stop <name> && container delete <name>`.

## Related

- `skills/container` — build, run, and clean up the sandbox image.
- `skills/herdr` — control panes and agents when driving a live session.
- `evals.ts`, `agent.ts`, `results.ts`, `render.ts` — the eval itself.
