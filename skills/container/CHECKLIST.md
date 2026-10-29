# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

CLI ran: `/opt/homebrew/bin/container --version` printed `container CLI version 1.5.0 (build: release, commit: unspecified)`. `container system status` reports server version 1.5.0 as well. Latest GitHub release is 1.6.1 (23 Oct 2026): https://github.com/apple/container/releases/latest and https://github.com/apple/container/releases/tag/1.6.1 (`k8s` renamed to `cluster`).

Docs used: https://github.com/apple/container/blob/main/docs/how-to.md (current branch, not a release), https://github.com/apple/container/blob/main/docs/networking.md, https://github.com/apple/container/blob/main/docs/container-machine.md, https://github.com/apple/container/blob/1.6.1/docs/command-reference.md, https://github.com/apple/container/blob/1.6.1/docs/volumes.md, and https://github.com/apple/container/blob/1.6.1/docs/container-system-config.md. Skill text is `skills/container/SKILL.md` plus `skills/container/references/`.

## Coverage

These questions close every standing configuration this skill can stand up on the installed 1.5.0 CLI and on the 1.6.1 command reference: `system start` roots, kernel install, and timeout; merged `config.toml` sections `build`, `container`, `dns`, `kernel`, `network`, `registry`, and `vminit`; builder CPU, memory, and builder DNS; image build platform, tag, cache, output, and build secrets; registry scheme and login; `run` or `create` versus `machine` versus experimental `k8s` or `cluster`; process user, capabilities, read-only root, masked and read-only paths, init, runtime handler, and kernel; DNS (`--dns`, `--dns-domain`, `--dns-option`, `--dns-search`, `--no-dns`, `[dns]`, `system dns create` including `--localhost`, and `--network` `alias=`); publish and `--publish-socket`; arch, platform, and Rosetta; named volumes (size and journal), anonymous volumes, binds, tmpfs, and machine home mounts; container CPU, memory, ulimit, and shm; lifetime with no restart policy; logs; teardown; and how a later `tk` workload receives secrets without a host-home mount. This 1.5.0 CLI and the 1.6.1 reference have no `--restart` and no `container restart`, so that family is decided in the lifetime question rather than by a flag. Later test archs stay one image and one container job, with no host VM and no second runtime. `tk` is the only secrets path and is not installed as a product requirement inside the test image. Global `--debug` / `CONTAINER_DEBUG` and shell completions are per invocation, not a standing service configuration. Network attachment exists only at `run` or `create` (there is no network connect).

## Questions

1. Which `container` CLI should this host run? Multi-select.
- keep Homebrew 1.5.0 (`k8s` and `clean` exist; no `commit`; no `cluster`; `run --arch` defaults to `arm64`; `machine create` has no `--user`)
- install the signed 1.6.1 package (`cluster` replaces `k8s`; the command reference adds `commit` and `machine create --user`, `--uid`, `--gid`, and `--home`; `run --arch` defaults from the image, else the host)
- track `main` newer than 1.6.1
- other

2. How should `container system start` be invoked? Multi-select.
- default app, install, and log roots, and the kernel-install prompt (unset `--log-root` uses the macOS log facility)
- `--disable-kernel-install` with default roots
- `--enable-kernel-install` with default roots
- custom `--app-root`, `--install-root`, and/or `--log-root`
- a non-default `--timeout` while waiting for the API
- call `system start` even when `system status` already says running
- other

3. Which `~/.config/container/config.toml` keys are set and then loaded with `system stop` and `system start`? Multi-select.
- none; keep the merged defaults shown by `container system property list`
- `[dns] domain`
- `[container] cpus` and/or `memory` (documented defaults are 4 CPUs and 1g when `run` omits `--cpus` and `--memory`)
- `[build] cpus`, `memory`, `rosetta`, and/or `image` (documented builder defaults are 2 CPUs, 2048MB, and Rosetta on)
- `[network] subnet` and/or `subnetv6` for networks created without `--subnet` or `--subnet-v6`
- `[registry] domain` other than the documented default `docker.io`
- `[kernel] binaryPath`, `url`, and `digest`, and/or `[vminit] image`
- other

4. Which workload shapes may this skill stand up here? Multi-select.
- one application container via `container run` or `container create` (this repo's test is one image and one job)
- no Compose; a shell script of `run -d` on `default` with domain-qualified names
- a `container machine` instead of `run`
- both the test container and a separate machine
- experimental cluster: `k8s` on 1.5.0 or `cluster` on 1.6.1
- system, builder, and registry only, with no workload container
- a host VM or a second runtime (this repo forbids both)
- other

5. If a cluster is created, which flags define it? Multi-select.
- do not create a cluster
- 1.5.0 `k8s create` (default name `k8s-dev`, default kindest node image, optional `--cni`, no `--workers` on this CLI)
- 1.6.1 `cluster create` with default `--workers 0`, name `cluster-dev`, and bundled kindnet
- 1.6.1 `--workers` greater than 0
- `--cni` set to a manifest path, or `--cni NONE`
- `--rm`, and/or `write-config` to a kubeconfig other than the default
- `load-image` of the local tag, with `--platform` when the image is multi-arch, and `--node` only when not every node should receive it
- other

6. Where does the image come from? Multi-select.
- `container build -t` of `sandbox/Containerfile` (`debian:bookworm-slim`, user tester uid 1000)
- `container image pull` over the chosen scheme, with `--platform`, `--arch`, or `--os` when only one variant is wanted
- `container image load --input` of an OCI tar, using `--force` only if the archive contains invalid members
- an already-present local tag only
- `container image tag` to another reference before run or push
- `container image save --output` of one platform for offline copy
- `container commit` (present in the 1.6.1 command reference; not in this 1.5.0 CLI, and the skill's migration table still says there is no commit)
- other

7. Which build platform, file, and tag policy apply? Multi-select.
- host arm64, an explicit `-t`, and `-f` pointing at `sandbox/Containerfile` (omitting `-t` tags a new UUID)
- `--platform linux/amd64`, and/or repeated `--platform` to build a multi-arch index
- `--arch` and `--os` instead of `--platform`, or `CONTAINER_DEFAULT_PLATFORM`
- `--target` and/or `--build-arg` on this same Containerfile
- `--output` left at `type=oci`, or set to `type=tar` or `type=local` with an optional `dest`
- other

8. Which build cache, progress, and builder-channel settings apply? Multi-select.
- use the build cache, and `--progress plain` (this 1.5.0 CLI hangs on build `--quiet`)
- `--no-cache`
- `--pull` so the base image is refreshed
- `--progress auto` or `tty` instead of `plain`
- `--ssh default` into the build (that is the only supported `--ssh` value)
- leave `--vsock-port` at 8088
- other

9. How is the builder sized, given DNS, and left afterward? Multi-select.
- start it on demand and do not pass `-c` or `-m` (1.6.1 documents 2 CPUs and 2048MB; this 1.5.0 `build` and `builder start` help does not print those defaults)
- `container builder start --cpus` and `--memory` before the build
- builder `--dns`, `--dns-domain`, `--dns-option`, and/or `--dns-search`
- set `-c` and `-m` only on `container build`, not on `builder start`
- `container builder stop`, or `builder delete` (`--force` if it is still running), after each build
- `[build] rosetta = false` so the builder does not emulate non-arm64
- other

10. Which registry access is required? Multi-select.
- none; local tag only
- anonymous pull or push over https with no stored login
- `container registry login` over https, with `--password-stdin` so the password is not written into the repo
- `--scheme http` on login and on the pull, push, build, or run that contacts that registry
- `container image push` after login, limited with `--platform`, `--arch`, or `--os` when only one variant is pushed
- leave `--max-concurrent-downloads` at 3 on pull, run, machine create, and cluster or k8s create
- other

11. Which process identity does the guest use? Multi-select.
- `run` and `exec --user 1000:1000`, matching tester in the Containerfile (the current test)
- the image `USER`, with no `--user`
- root (uid 0)
- numeric `--uid` and `--gid` instead of `--user`
- `container machine run` as the host user, or `machine run --root`
- 1.6.1 `machine create --user`, `--uid`, `--gid`, and/or `--home` (this 1.5.0 `machine create` help has none of those)
- other

12. Which root filesystem, capability, and path-hide profile applies to `run` or `create`? Multi-select.
- `--read-only`, `--cap-drop ALL`, and the runtime's default masked and read-only paths (the current test)
- writable root and default capabilities
- `--cap-add` of named capabilities, on a writable or read-only root
- `--masked-path` and/or `--read-only-path`, or `NONE` to clear the defaults and any earlier values
- the container-machine profile (all capabilities, no masked paths, home mounted, passwordless sudo), which is not this repo's test job
- other

13. Which mounts exist inside a `run` or `create` container? Multi-select.
- no `-v` and no bind `--mount`; `--tmpfs /tmp:size=256M,mode=1777` and `--tmpfs /home/tester:size=512M,mode=1777` (the current test)
- a named volume via `-v name:path[:ro]` or `--mount type=volume,source=,target=`
- a host bind via `-v host:path[:ro]` or `--mount type=bind` (`virtiofs` is the bind alias)
- an anonymous volume (`-v /path` or `--mount type=volume` with no source), deleted by name later because `--rm` does not remove it
- `--shm-size` different from the default `/dev/shm` tmpfs
- no bind of the host home directory
- other

14. If a named volume is used, how is it created and removed? Multi-select.
- do not create a volume
- `volume create` at the default sparse ext4 size (documented maximum about 512GiB) and default `journal=ordered`
- `-s` or `--opt size=`, and `--opt journal=` of `ordered`, `writeback`, or `journal`, with an optional `:size` journal suffix
- `volume delete` of named volumes, and/or `volume prune` (prune deletes data immediately)
- other

15. How do repo files enter the test guest? Multi-select.
- a tar stream piped to `container exec -i` (the current test; nothing on the host is mounted)
- `container copy` while the container is running (`container:path` on one side)
- a bind or a named volume
- files already copied into the image at build time
- other

16. Which network does the container attach to? Multi-select.
- implicit `default` vmnet created by `system start`, with no `--network`
- `container network create` and then `--network` of that name
- `--internal` so the new network is host-only
- `--subnet` and/or `--subnet-v6`, or the `[network]` defaults when those flags are omitted
- a `--plugin` other than `container-network-vmnet`
- `--network` options `mac=` and/or `mtu=` on the attachment
- other

17. How is the workload reached from the host or from another container? Multi-select.
- container IP from `container inspect` only
- `-p` with a host port, an optional host IP such as `127.0.0.1` or `[::1]`, and an optional `/tcp` or `/udp`
- `<name>.<dns-domain>` on the `default` network only
- `--publish-socket` `host_path:container_path`
- no publish and no listener (the current test job)
- other

18. What DNS setup do you want? Multi-select.
- none: `--no-dns` or IP-only, and no `[dns] domain`
- write `[dns] domain`, restart services, then `sudo container system dns create` for that domain
- that same domain plus `--network` `alias=` exact names and/or a leading-dot subtree (at most 32 aliases, fixed at create, not honored on a `--localhost` domain)
- `system dns create --localhost` so that domain redirects to the host
- per-container `--dns`, `--dns-domain`, `--dns-option`, and/or `--dns-search`
- IP-only because the container is on a `network create` network (no name lookup; issue 1809)
- other

19. How does the process stay up, given there is no `--restart` and no `container restart`? Multi-select.
- `run -d --name`, then `stop` (`--signal`, `--time` default 5 seconds) and `delete`
- `run --rm`, foreground or detached
- `container create`, then `container start` with `--attach` and/or `--interactive` when those streams are needed
- host launchd supervising `container run` or `container start`
- a container machine, where init is PID 1; `machine set` applies on the next `machine stop` and `machine run`, and `set-default` only if later commands omit `-n`
- `kill --signal` instead of a graceful `stop`
- other

20. Which resource limits apply to the running container, separate from the builder? Multi-select.
- omit `--cpus` and `--memory` and take the CLI / `[container]` defaults (documented as 4 CPUs and 1g)
- `--cpus` and `--memory` on `run` or `create`
- `--ulimit` `type=soft[:hard]` on `run`, `create`, or `exec`
- `--memory` only, leaving CPU default
- `machine create` or `machine set` `cpus` and `memory` (machine memory defaults to half of host memory) and no `run` limits
- other

21. Which architecture and translation settings apply for this image and for later test archs? Multi-select.
- host arm64 only, still this one image and one `container run`, with no `--arch` and no `--rosetta`
- `run --arch`, `--os`, or `--platform` (1.5.0 `--arch` defaults to `arm64`; 1.6.1 docs default from the image, else the host)
- `--rosetta` on `run` so x86-64 userland can execute
- pull, save, or push a single `--platform` variant of the same image
- one `container machine` per distro (the skill allows this; this repo's test plan does not)
- a second runtime or a host VM (this repo forbids both)
- other

22. Which kernel and nested-virtualization settings apply? Multi-select.
- the default kernel installed at `system start`; no `--virtualization` and no `--kernel`
- `container system kernel set --recommended`, or `--tar` with `--digest` and `--binary` for `--arch arm64` or `amd64`
- per-container `--kernel` and/or repeatable `--kernel-arg`
- `--virtualization` on `run` or `create` (requires host and guest support)
- `machine create` or `machine set` `virtualization=true` plus a `CONFIG_KVM=y` kernel (M3 or later and macOS 15 or later; the default kernel has no KVM)
- other

23. Which init, entrypoint, and runtime handler does `run` or `create` use? Multi-select.
- the image entrypoint and the default runtime `container-runtime-linux`, with no `--init`
- `--init` using the default init image
- `--init-image` set to a custom init image
- `--entrypoint` and/or command arguments replacing the image command
- `--runtime` set to a handler other than the default (this repo allows no second runtime)
- other

24. Which environment and host-agent settings are passed into `run` or `exec`? Multi-select.
- no `--ssh`; `-e` only for `HOME=/home/tester`, `USER=tester`, and, on `exec`, the test's `HERDR_SANDBOX` and `PATH`
- `--env-file` for non-secret process environment
- `--ssh`, which forwards the host agent (a container machine does this even without the flag)
- `--workdir` other than the image default
- `-i` without `-t` for the tar-to-exec stream, or `-t` when a TTY is required
- other

25. How does a later `tk` workload receive secrets inside a container this skill starts? Multi-select.
- this test image does not install `tk`, and the current job has no secret
- `tk` runs in the guest, and key material is injected by `tk` into a tmpfs or a container-managed volume, never by a bind of the host home
- a build `--secret` of `id=...,env=` or `id=...,src=` that is not copied into image environment or layers
- a host-home mount or `--ssh` so the guest can use host keys (this repo forbids that for secrets)
- other

26. Which observations must succeed on a run? Multi-select.
- `container logs`, plus `logs --boot` when the boot log matters (`-f` and `-n` only when following or tailing)
- `container inspect` for state and IP, and `container ls -a` because `ls` hides stopped containers
- `container stats --format json --no-stream`
- `container system status --format json` and `container system df`
- `container system logs` with `--last` (default 5m) and/or `--follow`
- `container builder status` when a build fails with no clear image error
- other

27. What is left behind after the job? Multi-select.
- `stop` and `delete` only the named container; leave the system service running and the image cached
- also `container prune` of stopped containers
- also `image prune` (dangling only, or `--all` for every unreferenced image) and/or `image delete`
- also `volume prune` and/or `network prune` (prune keeps the default network)
- also `builder delete`, and/or `container clean` while a container is still running
- `machine stop` and `machine delete` when a machine was created (delete removes its storage)
- `k8s delete --name` or `cluster delete --name` when a cluster was created
- other

Answering all of these is sufficient to build any container configuration this skill supports.
