# Checklist

Purpose: the live decision list for this skill. Decide every item before using the skill. The official skill is `skills/parallel-eval/SKILL.md` and `skills/parallel-eval/references/`.

## Questions

1. Which parallelism level applies?
   - default: 20 (capped by the skill)
   - user-set: `PARALLEL_LEVEL` env var, must be ≤ 20
   - answered: default 20, capped at 20

2. How is the sandbox image built and cached?
   - build from `Containerfile` via `container build` if image not present
   - reuse existing image if already built (check via `container image inspect`)
   - answered: build if missing, reuse if present

3. What isolation flags are fixed per the container skill checklist?
   - `--user 1000:1000`
   - `--cap-drop ALL`
   - `--read-only` root filesystem
   - `--tmpfs /tmp:size=256M,mode=1777`
   - `--tmpfs /home/tester:size=1024M,mode=1777`
   - no host-home or bind mounts
   - answered: all of the above, per `skills/container/CHECKLIST.md`

4. How are repo files transferred into the container?
   - tar pipe from host into container's `/home/tester/src`
   - `--no-xattrs` to avoid extended attributes issues
   - `COPYFILE_DISABLE=1` environment variable
   - answered: tar pipe as implemented in `evals.ts`

5. What does each worker run inside the container?
   - `deno run --quiet --allow-run --allow-read --allow-write --allow-net --allow-env ./evals.ts macos --agent`
   - the agent produces one `ROW <json>` line on stdout
   - the worker captures and parses this line
   - answered: as above

6. How are parallel workers coordinated?
   - spawn N concurrent `container run` processes, each with a unique name
   - wait for all N to complete via status checks
   - if MATRIX has more entries than PARALLEL_LEVEL, cycle through matrix entries in round-robin batches of PARALLEL_LEVEL
   - answered: concurrent spawning with batch round-robin

7. What constitutes a successful run?
   - each worker produces a valid `ROW <json>` line
   - the row passes `rowError` validation (results.ts)
   - the row is appended to `evals.jsonl`
   - README.md and results.svg are regenerated
   - answered: all workers must succeed; if any fail, the skill reports which and exits non-zero

8. How are results aggregated after all workers complete?
   - all rows are appended to `evals.jsonl` (one per commit)
   - `readmeBlock` from `render.ts` regenerates the README results block
   - `heatmapSvg` from `render.ts` regenerates results.svg from all rows
   - a summary JSON is printed to stdout with: total rows, setup version, model info, metric averages, capability distribution
   - answered: as above

9. What cleanup is performed after the skill runs?
   - `container stop <name>` for each worker container
   - `container delete <name>` for each worker container
   - `container prune` to remove leftover stopped test containers
   - any temp files or partial results are discarded
   - answered: full container cleanup

10. How does the skill handle timeouts per container?
    - each container has a timeout of `CONTAINER_TIMEOUT` ms (default 300000 = 5 min)
    - if a container exceeds its timeout, it is stopped and marked as failed
    - the failure is recorded in the summary but does not stop other workers
    - answered: per-container timeout with graceful failure

11. What environment variables are passed into each container?
    - `HOME=/home/tester`
    - `USER=tester`
    - `HERDR_SANDBOX=1`
    - `DENO_NO_UPDATE_CHECK=1`
    - `HERDR_EVAL_MODEL_URL` (if --agent mode, pointing to llama-server gateway)
    - `HERDR_EVAL_*` any additional eval-related env vars the user sets
    - answered: subset matching `evals.ts` env setup plus any user overrides

12. Can the skill run on Linux as well as macOS?
    - macOS: uses `container` CLI (apple/container)
    - Linux: uses `docker` CLI
    - the skill detects which runtime is available and uses the appropriate commands
    - answered: yes, skill supports both macOS (container) and Linux (docker) runtimes