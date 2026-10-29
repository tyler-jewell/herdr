---
name: parallel-eval
description: A skill for running multiple agent evals in parallel inside isolated containers on macOS.
---
# parallel-eval

Run multiple agent evals in parallel inside isolated containers, collecting and aggregating results. Accepts a matrix of models, judges, and eval prompts. Wraps the `./evals.ts macos --agent` flow with container parallelism (default 20). Change when: the parallelism level, model/judge matrix, or eval configuration changes. Not for: single-agent eval (use `./evals.ts` directly), modifying the sandbox isolation (evals.ts handles that), or repo config changes (AGENTS.md, CONTRIBUTING.md).

## Quick start

```bash
# Run 20 parallel evals with the default model/eval matrix:
container skill run parallel-eval

# Run 10 parallel evals with a custom model matrix:
PARALLEL_LEVEL=10 \
  AGENT_MODEL=Qwen3.6-35B-A3B-Q4_K_M \
  JUDGE_MODEL=gpt-oss-20b-MXFP4 \
  ./container skill run parallel-eval

# Run with a custom eval prompt ID:
EVAL_ID=one-question PARALLEL_LEVEL=5 \
  ./container skill run parallel-eval
```

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `PARALLEL_LEVEL` | `20` | Maximum number of containers to run in parallel |
| `AGENT_MODEL` | from `evals.json` `models.agent` | The local model the agent Pi uses |
| `JUDGE_MODEL` | from `evals.json` `models.judge` | The model the judge uses for scoring |
| `EVAL_ID` | `one-question` | Which eval prompt from `evals.json` versions to use |
| `CONTAINER_IMAGE` | `herdr-sandbox` | The Containerfile-built image name |
| `CONTAINER_TIMEOUT` | `300000` | Per-container timeout in milliseconds (5 min) |

## How it works

1. **Reads configuration** from `evals.json`, `metrics.json`, `capabilities.json` in the repo root.
2. **Builds the sandbox image** from `Containerfile` if not already present (uses `container build`).
3. **Spawns N worker processes** (where N = `PARALLEL_LEVEL`, max 20), each in its own Apple container with:
   - `--user 1000:1000`
   - `--read-only` root filesystem
   - `--tmpfs /tmp:size=256M,mode=1777`
   - `--tmpfs /home/tester:size=1024M,mode=1777`
   - No host mounts (ephemeral only)
4. **Each worker**:
   - Copies the repo tree into the container's `/home/tester/src`
   - Runs `./evals.ts macos --agent` inside the container
   - The agent produces one JSON row (Verdict & metrics)
   - The worker writes its row to a temporary file
5. **After all workers complete**:
   - Aggregates all rows into `evals.jsonl` (appending, preserving order)
   - Regenerates `README.md` results block from `latestPerCommit`
   - Regenerates `results.svg` heatmap from all rows
   - Prints a summary JSON report

## Matrix configuration

The skill supports a `$MATRIX` environment variable that specifies comma-separated combinations to run. Each entry is `agent_model,judge_model,eval_id`. If `$MATRIX` is omitted, the skill uses the single config from `evals.json` models and `EVAL_ID`, running `PARALLEL_LEVEL` repetitions of the same combo.

Example:
```bash
MATRIX="Qwen3.6-35B-A3B-Q4_K_M,gpt-oss-20b-MXFP4,one-question \
      Nemotron-3.5-Q8_0,gpt-oss-20b-MXFP4,one-question" \
  PARALLEL_LEVEL=2 \
  ./container skill run parallel-eval
```

This would run 2 parallel evals with 2 different model/judge/eval combinations, for a total of 2 runs (since PARALLEL_LEVEL=2 and MATRIX has 2 entries).

If MATRIX has more entries than PARALLEL_LEVEL, the skill runs PARALLEL_LEVEL at a time in a round-robin fashion until all matrix entries are exhausted.

## Isolation guarantees

- Each container gets its own namespace (PID, network, mount)
- Read-only root filesystem + tmpfs home means no persistent changes inside any container
- No host-home or bind mounts — the container cannot touch the host's config, secrets, or dotfiles
- After `container stop` and `container delete`, the container's filesystem is gone
- The only host-side artifacts are: `evals.jsonl` (appended rows), `README.md` (updated results block), `results.svg` (regenerated heatmap)

## Result aggregation

After all N rows are collected:
- `evals.jsonl` has N new rows appended (one per commit)
- `README.md` results block reflects the latest commit across all runs
- `results.svg` heatmap shows scores/metrics from all runs, newest commit per setup
- The skill prints a summary with: rows recorded, setup version, model used, average metrics, capability score distribution

## Cleanup

After the skill completes, each container is stopped and deleted via `container stop <name>` and `container delete <name>`. A `container prune` removes any leftover stopped test containers.

## Related skills

- `skills/container` — lower-level container orchestration (build, run, stop, delete)
- `skills/herdr/bootstrap` — the bootstrap procedure an agent follows on a new machine
- `skills/turnkey-tk` — secret/key handling when secrets are needed (this skill avoids host-home mounts)