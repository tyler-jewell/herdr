# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

CLI: `tk 0.7.0` from `/tmp/tk-bin/tk` (`tk` is not on `PATH`). Help only: no `ssh agent start`, and no key or registry was written. `tk ssh` has `keys` (`create --name`, `add --private-key-id`, `list`, `remove --key`), `public-key` (`--key`), `git-sign`, and `agent` (`start`, `stop`, `status`). `ssh agent start` takes repeatable `--key`, `--allowed-hosts-file`, repeatable `--allow-namespace`, `--socket`, `--pid-file`, and `--socket-mode` (default `600`). With `--socket` and no `--pid-file`, the pid file is `SOCKET.pid`. `stop` and `status` take only `--socket` and `--pid-file`. `policy create` and `policy evaluations --activity-id` exist. `tk broker --help` exits 2: unrecognized subcommand. Local git is 2.54.0. `gpg` is absent. `ssh-keygen` is `/usr/bin/ssh-keygen`.

Pinned names from the other questionnaires: root profile `admin`; agent profile `agent` and `AGENT_USER_ID`; broker profile `broker`, tag `broker`, and `BROKER_USER_ID`; provisioner profile `provisioner`. The Ed25519 id these files share is `PRIVATE_KEY_ID`. OpenPGP `WALLET_ID` and `FINGERPRINT` belong to signing-git-commits and deploying-signing-broker. Do not bootstrap the organization or choose an API base URL here.

Docs: vendored `skills/turnkey-tk/docs/ssh-agent.md`; tag https://github.com/tkhq/tk/blob/v0.7.0/docs/ssh-agent.md ; main https://github.com/tkhq/tk/blob/main/docs/ssh-agent.md (same command text as the tag). Skill: `skills/turnkey-tk/using-ssh/SKILL.md`.

## Gaps

`ssh-agent.md` on main matches v0.7.0 aside from skill-link prefixes. `./apply` must not change SSH, git, or shells. `evals.ts` starts Apple `container run` with no `--ssh`, user `1000:1000`, `--cap-drop ALL`, a read-only root, tmpfs homes, and no host mount, so that guest cannot see a host agent socket or the Mac `~/.config/turnkey`. Publishing the public key is manual and outside `tk`. An approval-gated policy is unusable because SSH waits for the signature. `gpg.ssh.program=tk` needs no socket and is signing-git-commits. A broker that serves SSH is this skill run as profile `broker`, not a `tk broker` command. `--allow-namespace` signs `ssh-keygen -Y sign` on any connection with no session bind, so a relay cannot be told from local use.

## Questions

Answer every question. Yes/no/other means those three lines. Otherwise select every line that applies. Put paths, fingerprints, and host names in the answer, not in the repo. Never write a private key.

1. Who holds the signing credential and runs `ssh keys add` plus `ssh agent start`?
   - profile `agent`, consensus `user.id == AGENT_USER_ID`
   - profile `broker` only, consensus `user.id == BROKER_USER_ID`, no `agents-sign-*`; the application gets the socket
   - several broker user ids, one ALLOW each on the same `PRIVATE_KEY_ID`, never the shared `broker` tag
   - other

2. Which caller may create the key and the policy? If `admin` does not exist yet, stop; organization bootstrap is a different questionnaire.
   - saved profile `admin`
   - the `TURNKEY_ORGANIZATION_ID`, `TURNKEY_API_PUBLIC_KEY`, and `TURNKEY_API_PRIVATE_KEY` bundle and no `--profile`
   - not available yet
   - other

3. What should happen to the Ed25519 key and the local registry? The same `--name` registers the existing key and does not create a second one.
   - root runs `ssh keys create --name` (default name `agent-ssh` unless the answer names another)
   - the daemon `HOME` runs `ssh keys add --private-key-id PRIVATE_KEY_ID`
   - leave the registration and only `ssh keys list`
   - `ssh keys remove --key` forgets the local entry and leaves the Turnkey key unchanged
   - other

4. What signing policy should root create? Use one allow-always policy per key and signer user id, because allow-once fails every connection.
   - one `agents-sign-ssh` ALLOW for `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2` and `private_key.id == PRIVATE_KEY_ID`, consensus `AGENT_USER_ID`
   - one named ALLOW per broker user id on that same `PRIVATE_KEY_ID`, such as `broker-1-sign-ssh`
   - the policy already exists; do not create another
   - skip because the broker principal already holds signing under its credential DENY
   - other

5. How does the daemon load its API credential? A profile daemon needs no restart after that profile's API key is rotated; a `TURNKEY_*` daemon does.
   - `--profile agent` or `--profile broker` from the registry under the daemon `HOME`
   - the `TURNKEY_*` bundle and no profile
   - other

6. Which `HOME` is used for both `ssh keys add` and `ssh agent start`? A different home sees an empty registry.
   - the process default home
   - one pinned `HOME` shared by register and start
   - a service account whose home differs from the operator and must be pinned
   - other

7. Which registered keys should that daemon serve?
   - every SSH key in that `HOME` registry
   - one `ssh agent start --key` fingerprint
   - a repeated `--key` list named in the answer
   - other

8. What will clients do with the served key?
   - Git fetch or push over SSH
   - SSH login to remote hosts
   - `ssh-keygen -Y sign -n git` through this socket
   - register and serve only, no client yet
   - local verify only (`ssh-add -L` and `ssh-keygen -Y`)
   - other

9. Where is the public key line installed, outside `tk`? Compare it with `ssh public-key` before calling it done.
   - remote `authorized_keys`
   - the git host SSH key settings for this account
   - a local public `IdentityFile` only
   - not installed yet
   - other

10. Which destination constraint should `ssh agent start` use? Hostnames in an allowed-hosts file are reported, not matched.
    - none
    - `--allowed-hosts-file` only, so SSH logins and no `-Y sign`
    - the same socket with `--allowed-hosts-file` and `--allow-namespace git`
    - two daemons: a login socket without `--allow-namespace`, plus `--allow-namespace git --socket` for a git socket
    - other

11. If an allowed-hosts file is used, where do the host keys come from? Check `ssh-keyscan` output against published fingerprints before trusting it.
    - `ssh-keyscan` of hosts named in the answer
    - an existing `known_hosts`-format file whose path is in the answer
    - not used
    - other

12. Will any client forward or relay the socket (`ssh -A`, `ssh -R`, `socat`, or a pre-8.9 forward)? An 8.9+ forward arrives bound and gets neither login nor namespace signatures.
    - no
    - yes, and that socket must not carry `--allow-namespace`
    - yes, but only an `--allow-namespace` socket shared inside one OS user, container, or VM mount and never relayed past it
    - other

13. Are the SSH clients that must log in through a constrained agent OpenSSH 8.9 or newer? `--allowed-hosts-file` refuses clients that do not send `session-bind@openssh.com`.
    - yes
    - no
    - other

14. Which Unix socket path should the daemon bind?
    - default `~/.config/turnkey/ssh-agent.sock` under the daemon `HOME`
    - one custom `--socket` named in the answer
    - the default login socket plus a second git socket such as `~/.config/turnkey/ssh-git.sock`
    - other

15. What socket mode should `ssh agent start` use? Socket access is signing authority.
    - default `600`
    - `660` for a supplemental group named in the answer
    - other

16. Which pid file should `start`, `status`, and `stop` share?
    - the default next to the default socket
    - `SOCKET.pid` because `--socket` is set and `--pid-file` is omitted
    - an explicit `--pid-file` passed to all three
    - other

17. How should callers point at the agent without changing machine SSH config?
    - per-command `-o IdentityAgent=… -o IdentitiesOnly=yes -o IdentityFile=` the public key
    - `git config core.sshCommand` in one repository only
    - `SSH_AUTH_SOCK` in that process environment
    - do not write `~/.ssh/config` or a private key
    - other

18. How should Git commit signing relate to this socket? Direct `gpg.ssh.program=tk` is signing-git-commits and needs no socket.
    - out of scope; no `--allow-namespace`
    - in scope; `gpg.ssh.program=ssh-keygen` and `--allow-namespace git`
    - no commit signing
    - other

19. Which global flags should every `tk` call in this setup use? Do not pick a new API base URL; reuse the one bootstrap stored, if any.
    - `--profile` as pinned, and that profile's API base URL
    - `--organization-id`
    - `--api-base-url` equal to the already stored URL
    - `--non-interactive` or `TK_NON_INTERACTIVE`
    - `--message-format json`
    - other

20. What must succeed before handoff? On refusal, do not restart the daemon as root.
    - `ssh agent status` reports pid, socket, and fingerprints
    - `ssh-add -L` shows `ssh-ed25519` and `turnkey:PRIVATE_KEY_ID`
    - `ssh-keygen -Y sign` and `check-novalidate` exit 0
    - `whoami` succeeds as the daemon profile in that `HOME`
    - root runs `activity list` and `policy evaluations --activity-id` only after a failed signature
    - other

21. Can the current Apple container test host this agent? The test has no `--ssh`, a read-only root, no host mount, and a tmpfs home, and `./apply` must not change SSH.
    - yes
    - no
    - other

## Coverage

These answers name the principal (`agent` or `broker`), the allow-always scope on `PRIVATE_KEY_ID`, the daemon `HOME`, the keys served, the socket path, mode, and pid file, whether `--allowed-hosts-file` and `--allow-namespace git` are set, where the public half is published, and how clients pass `IdentityAgent` or `SSH_AUTH_SOCK`. Signing-git-commits decides OpenPGP versus this SSH key and the co-author trailer. Deploying-signing-broker does not serve SSH; an SSH broker is this skill's broker principal. The Apple-container answer says when that test cannot host the daemon.

answering these is sufficient for that skill.
