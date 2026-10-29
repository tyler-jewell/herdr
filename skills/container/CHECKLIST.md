# Checklist

This is the live checklist for this skill. Decide every item before using the skill. The official skill is `skills/container/SKILL.md` and `skills/container/references/`.

## Questions

1. Which workload shape and image source apply?
- one application container built from `sandbox/Containerfile` (`debian:bookworm-slim`) via `container build` and started with `container run`
- a persistent `container machine` VM or experimental `container cluster`
answered: one application container built from `sandbox/Containerfile` (`debian:bookworm-slim`) via `container build` and started with `container run`

2. Which user and capability profile does the container run under?
- non-root `--user 1000:1000` with `--cap-drop ALL` and `--read-only` root filesystem
- root (UID 0) or retained Linux capabilities
answered: non-root `--user 1000:1000` with `--cap-drop ALL` and `--read-only` root filesystem

3. Which mounts and file transfers are allowed inside the container?
- ephemeral `--tmpfs` mounts (`/tmp` and `/home/tester`) and tar piped over `container exec -i`, with no host-home or bind mounts
- host bind mounts (`-v` or `--mount type=bind`) or named volumes
answered: ephemeral `--tmpfs` mounts (`/tmp` and `/home/tester`) and tar piped over `container exec -i`, with no host-home or bind mounts

4. How may secrets or keys reach a container workload?
- no secrets in the eval sandbox; when a workload needs secrets, inject them via `tk` into ephemeral storage, never via host-home mounts or `--ssh`
- mount the host home directory or forward the host SSH agent
answered: no secrets in the eval sandbox; when a workload needs secrets, inject them via `tk` into ephemeral storage, never via host-home mounts or `--ssh`

5. How is the container cleaned up after the run?
- `container stop` and `container delete` the named container, then prune leftover stopped test containers
- leave stopped containers or volumes behind
answered: `container stop` and `container delete` the named container, then prune leftover stopped test containers
