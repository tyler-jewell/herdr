---
name: using-ssh
description: Give an agent SSH access (git over SSH, remote hosts) with a Turnkey-held Ed25519 key served by tk ssh agent, so no private key is on disk. Use to register a key, start the agent, or point git or ssh at the socket; not for commit signing (signing-git-commits).
---

> **Pre-requisites** and **Decisions** are this repo's. The rest is the published skill.

## Pre-requisites

| # | Check | Command | Pass |
|---|---|---|---|
| 1 | `tk` present | `command -v tk` | prints a path |
| 2 | Workflow present | `test -f skills/turnkey-tk/using-ssh/SKILL.md` | exit 0 |

## Decisions

| Decision | Field | Options | Default |
|---|---|---|---|
| Q1: Who holds the signing credential and runs `ssh keys add` plus `ssh agent start`? | Turnkey `tk` policy | profile `agent`, consensus `user.id == AGENT_USER_ID`; profile `broker` only, consensus `user.id == BROKER_USER_ID`, no `agents-sign-*`; the application gets the socket; several broker user ids, one ALLOW each on the same `PRIVATE_KEY_ID`, never the shared `broker` tag; other | profile `agent`, consensus `user.id == AGENT_USER_ID` |
| Q2: Which caller may create the key and the policy? If `admin` does not exist yet, stop; organization bootstrap is a different questionnaire. | Turnkey `tk` policy | saved profile `admin`; the `TURNKEY_ORGANIZATION_ID`, `TURNKEY_API_PUBLIC_KEY`, and `TURNKEY_API_PRIVATE_KEY` bundle and no `--profile`; not available yet; other | saved profile `admin` |
| Q3: What should happen to the Ed25519 key and the local registry? The same `--name` registers the existing key and does not create a second one. | Turnkey `tk` policy | root runs `ssh keys create --name` (default name `agent-ssh` unless the answer names another); the daemon `HOME` runs `ssh keys add --private-key-id PRIVATE_KEY_ID`; leave the registration and only `ssh keys list`; `ssh keys remove --key` forgets the local entry and leaves the Turnkey key unchanged; other | root runs `ssh keys create --name` (default name `agent-ssh` unless the answer names another) |
| Q4: What signing policy should root create? Use one allow-always policy per key and signer user id, because allow-once fails every connection. | Turnkey `tk` policy | one `agents-sign-ssh` ALLOW for `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2` and `private_key.id == PRIVATE_KEY_ID`, consensus `AGENT_USER_ID`; one named ALLOW per broker user id on that same `PRIVATE_KEY_ID`, such as `broker-1-sign-ssh`; the policy already exists; do not create another; skip because the broker principal already holds signing under its credential DENY; other | one `agents-sign-ssh` ALLOW for `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2` and `private_key.id == PRIVATE_KEY_ID`, consensus `AGENT_USER_ID` |
| Q5: How does the daemon load its API credential? A profile daemon needs no restart after that profile's API key is rotated; a `TURNKEY_*` daemon does. | Turnkey `tk` policy | `--profile agent` or `--profile broker` from the registry under the daemon `HOME`; the `TURNKEY_*` bundle and no profile; other | `--profile agent` or `--profile broker` from the registry under the daemon `HOME` |
| Q6: Which `HOME` is used for both `ssh keys add` and `ssh agent start`? A different home sees an empty registry. | Turnkey `tk` policy | the process default home; one pinned `HOME` shared by register and start; a service account whose home differs from the operator and must be pinned; other | the process default home |
| Q7: Which registered keys should that daemon serve? | Turnkey `tk` policy | every SSH key in that `HOME` registry; one `ssh agent start --key` fingerprint; a repeated `--key` list named in the answer; other | every SSH key in that `HOME` registry |
| Q8: What will clients do with the served key? | Turnkey `tk` policy | Git fetch or push over SSH; SSH login to remote hosts; `ssh-keygen -Y sign -n git` through this socket; register and serve only, no client yet; local verify only (`ssh-add -L` and `ssh-keygen -Y`); other | Git fetch or push over SSH |
| Q9: Where is the public key line installed, outside `tk`? Compare it with `ssh public-key` before calling it done. | Turnkey `tk` policy | remote `authorized_keys`; the git host SSH key settings for this account; a local public `IdentityFile` only; not installed yet; other | remote `authorized_keys` |
| Q10: Which destination constraint should `ssh agent start` use? Hostnames in an allowed-hosts file are reported, not matched. | Turnkey `tk` policy | none; `--allowed-hosts-file` only, so SSH logins and no `-Y sign`; the same socket with `--allowed-hosts-file` and `--allow-namespace git`; two daemons: a login socket without `--allow-namespace`, plus `--allow-namespace git --socket` for a git socket; other | none |
| Q11: If an allowed-hosts file is used, where do the host keys come from? Check `ssh-keyscan` output against published fingerprints before trusting it. | Turnkey `tk` policy | `ssh-keyscan` of hosts named in the answer; an existing `known_hosts`-format file whose path is in the answer; not used; other | `ssh-keyscan` of hosts named in the answer |
| Q12: Will any client forward or relay the socket (`ssh -A`, `ssh -R`, `socat`, or a pre-8.9 forward)? An 8.9+ forward arrives bound and gets neither login nor namespace signatures. | Turnkey `tk` policy | no; yes, and that socket must not carry `--allow-namespace`; yes, but only an `--allow-namespace` socket shared inside one OS user, container, or VM mount and never relayed past it; other | no |
| Q13: Are the SSH clients that must log in through a constrained agent OpenSSH 8.9 or newer? `--allowed-hosts-file` refuses clients that do not send `session-bind@openssh.com`. | Turnkey `tk` policy | yes; no; other | yes |
| Q14: Which Unix socket path should the daemon bind? | Turnkey `tk` policy | default `~/.config/turnkey/ssh-agent.sock` under the daemon `HOME`; one custom `--socket` named in the answer; the default login socket plus a second git socket such as `~/.config/turnkey/ssh-git.sock`; other | default `~/.config/turnkey/ssh-agent.sock` under the daemon `HOME` |
| Q15: What socket mode should `ssh agent start` use? Socket access is signing authority. | Turnkey `tk` policy | default `600`; `660` for a supplemental group named in the answer; other | default `600` |
| Q16: Which pid file should `start`, `status`, and `stop` share? | Turnkey `tk` policy | the default next to the default socket; `SOCKET.pid` because `--socket` is set and `--pid-file` is omitted; an explicit `--pid-file` passed to all three; other | the default next to the default socket |
| Q17: How should callers point at the agent without changing machine SSH config? | Turnkey `tk` policy | per-command `-o IdentityAgent=… -o IdentitiesOnly=yes -o IdentityFile=` the public key; `git config core.sshCommand` in one repository only; `SSH_AUTH_SOCK` in that process environment; do not write `~/.ssh/config` or a private key; other | per-command `-o IdentityAgent=… -o IdentitiesOnly=yes -o IdentityFile=` the public key |
| Q18: How should Git commit signing relate to this socket? Direct `gpg.ssh.program=tk` is signing-git-commits and needs no socket. | Turnkey `tk` policy | out of scope; no `--allow-namespace`; in scope; `gpg.ssh.program=ssh-keygen` and `--allow-namespace git`; no commit signing; other | out of scope; no `--allow-namespace` |
| Q19: Which global flags should every `tk` call in this setup use? Do not pick a new API base URL; reuse the one bootstrap stored, if any. | Turnkey `tk` policy | `--profile` as pinned, and that profile's API base URL; `--organization-id`; `--api-base-url` equal to the already stored URL; `--non-interactive` or `TK_NON_INTERACTIVE`; `--message-format json`; other | `--profile` as pinned, and that profile's API base URL |
| Q20: What must succeed before handoff? On refusal, do not restart the daemon as root. | Turnkey `tk` policy | `ssh agent status` reports pid, socket, and fingerprints; `ssh-add -L` shows `ssh-ed25519` and `turnkey:PRIVATE_KEY_ID`; `ssh-keygen -Y sign` and `check-novalidate` exit 0; `whoami` succeeds as the daemon profile in that `HOME`; root runs `activity list` and `policy evaluations --activity-id` only after a failed signature; other | `ssh agent status` reports pid, socket, and fingerprints |
| Q21: Can the current Apple container test host this agent? The test has no `--ssh`, a read-only root, no host mount, and a tmpfs home, and `./apply` must not change SSH. | Turnkey `tk` policy | yes; no; other | yes |

---


# Using SSH

Result: an agent that authenticates to git hosts and remote machines with an
Ed25519 key that exists only inside Turnkey. `tk ssh agent` answers the
OpenSSH agent protocol on a Unix socket and turns each challenge into a
policy-checked signing activity under the agent's own credential.

Inputs: the root profile (`admin`), the `agent` profile and `AGENT_USER_ID` from
[provisioning-agent-identity](../provisioning-agent-identity/SKILL.md), and the host or git host that will hold the public key.

## Reference

- [ssh](../docs/ssh-agent.md): `ssh keys`, `ssh public-key`, and `ssh agent` records and default paths.
- [resources](../docs/resources.md): the `policy create` record that scopes signing to one `private_key.id`.
- [activities](../docs/activities.md): `activity list` and `policy evaluations` on a failed signing activity.

## Rules

- Root creates the Turnkey private key once with `ssh keys create`, which
  also registers it in root's own registry. The agent host registers the
  same id with `ssh keys add`, which needs nothing but the id. The private
  key never leaves Turnkey and there is nothing to back up on the host.
- The signing policy is allow-always, scoped by `private_key.id`
  (`agents-sign-ssh` in [policy-patterns.md](../references/policy-patterns.md)).
  SSH waits for the signature synchronously, so an approval-gated policy
  makes every connection fail, not wait.
- Socket access is signing authority. The socket lives in the principal's own
  home and is never forwarded off the host; under the broker path it is
  shared with the application alone, read-only, and nothing else crosses.
- Rotating the agent's API key needs no daemon restart when the daemon
  runs from a profile; one started from the `TURNKEY_*` environment must
  be restarted.
- The registry is `~/.config/turnkey/tk.config.toml` under the `HOME` of the
  process that runs `ssh keys add` and `ssh agent start`. Pin `HOME` and
  `--profile` explicitly where the daemon runs; a service with a different
  home sees an empty registry.
- Host-key verification stays on. `tk` replaces the client key, not the
  trust in the server.
- When a signing broker holds signing, do not create `agents-sign-*` policies;
  run this workflow as the broker principal, tagged `BROKER_TAG` under the
  [deploying-signing-broker](../deploying-signing-broker/SKILL.md) credential DENY.
  Step 2 names `BROKER_USER_ID` for `AGENT_USER_ID`; step 4 starts `tk ssh agent`
  under the broker's `HOME`; the application gets only the socket.

## Instructions

1. **Create the private key.** Root, once:

   <!-- example: ssh.create-key -->
   ```sh
   tk --profile admin --message-format json ssh keys create --name agent-ssh
   ```

   Set `PRIVATE_KEY_ID` to the record's `privateKeyId`; the policy and the
   agent host both need it. Rerunning with the same name registers the
   existing key instead of creating a second one.

2. **Allow the agent to sign with that key.** Root:

   <!-- shared: agents-sign-ssh -->
   <!-- example: ssh.policy -->
   ```sh
   tk --profile admin --message-format json policy create --name agents-sign-ssh --effect allow \
     --consensus "approvers.any(user, user.id == '${AGENT_USER_ID}')" \
     --condition "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2' && private_key.id == '${PRIVATE_KEY_ID}'"
   ```

   One policy per key. A key without a matching policy is still listed by
   the agent, and every signature with it is refused.

3. **Register the key and publish the public half.** The agent, in the home
   the daemon will use:

   <!-- example: ssh.register -->
   ```sh
   tk --profile agent --message-format json ssh keys add --private-key-id PRIVATE_KEY_ID
   tk --profile agent --message-format json ssh public-key --key PRIVATE_KEY_ID | jq -r .publicKey > ./agent-ssh.pub
   ```

   Install `agent-ssh.pub` where the server expects it: the
   remote `authorized_keys`, or the git host's SSH key settings for the
   agent's account. That step is manual and outside `tk`.

4. **Start the agent.** The agent identity, with `--profile` explicit:

   <!-- example: ssh.agent-start -->
   ```sh
   tk --profile agent --message-format json ssh agent start
   export SSH_AUTH_SOCK=~/.config/turnkey/ssh-agent.sock
   tk --profile agent --message-format json ssh agent status
   ```

   `agent_started` carries `pid`, `socket`, and the `keys` fingerprints it
   serves; `agent_status_report` repeats them while it runs. An unattended
   deployment passes `--key SSH_FINGERPRINT` so the daemon serves one key;
   custom socket and pid-file paths are in [ssh](../docs/ssh-agent.md#agent).

   Optionally, pin the destinations; no Turnkey policy can see the host a
   challenge came from. The daemon then signs an SSH login only after the
   client's `session-bind@openssh.com` names a host key in the file, and
   git's `ssh-keygen -Y sign -n git` (`gpg.ssh.program=ssh-keygen`) only in
   an `--allow-namespace` namespace on an unbound connection, a tk
   extension. An OpenSSH 8.9+ `ssh -A` forward arrives bound and gets
   neither; a relay (`ssh -R`, `socat`, a pre-8.9 forward) sends no bind, so
   share an `--allow-namespace` socket only with the one boundary that signs
   git (another OS user, or one container or VM through a mount) and never
   forward or relay it beyond that boundary.
   `gpg.ssh.program=tk` needs no socket ([signing-git-commits](../signing-git-commits/SKILL.md)); see [ssh](../docs/ssh-agent.md#destination-constraints).
   Check `ssh-keyscan` output against the host's published fingerprints, and
   drop `--allow-namespace git` when git does not sign through the socket:

   <!-- example: ssh.constrain -->
   ```sh
   ssh-keyscan github.com > ~/.config/turnkey/ssh-allowed-hosts
   tk --profile agent --message-format json ssh agent stop
   tk --profile agent --message-format json ssh agent start --allowed-hosts-file ~/.config/turnkey/ssh-allowed-hosts --allow-namespace git
   ```

   To forward or relay the login socket, keep `--allow-namespace` off it and sign git from `ssh-git.sock`, step 5's verify socket:

   <!-- example: ssh.constrain-forwarded -->
   ```sh
   tk --profile agent --message-format json ssh agent stop
   tk --profile agent --message-format json ssh agent start --allowed-hosts-file ~/.config/turnkey/ssh-allowed-hosts
   tk --profile agent --message-format json ssh agent start --allowed-hosts-file ~/.config/turnkey/ssh-allowed-hosts --allow-namespace git --socket ~/.config/turnkey/ssh-git.sock
   ```

5. **Point clients at the socket and verify.** Per repository, or per
   connection:

   ```sh
   SSH_OPTS="-o IdentityAgent=~/.config/turnkey/ssh-agent.sock -o IdentitiesOnly=yes -o IdentityFile=./agent-ssh.pub"
   git config core.sshCommand "ssh $SSH_OPTS"
   ssh $SSH_OPTS user@host
   ```

   `IdentitiesOnly` with the public key file stops ssh from offering keys it
   finds on disk, so only the Turnkey key is ever presented.

   Verify the chain without a server, with OpenSSH tools only:

   <!-- example: ssh.verify -->
   ```sh
   ssh-add -L
   ssh-keygen -Y sign -n git -U -f ./agent-ssh.pub ./payload.txt
   ssh-keygen -Y check-novalidate -n git -f ./agent-ssh.pub -s ./payload.txt.sig < ./payload.txt
   ```

   `ssh-add -L` lists each served key as `ssh-ed25519 ... turnkey:PRIVATE_KEY_ID`.
   The sign step writes `payload.txt.sig` through the socket; the check
   step accepts it. Both exit `0` or the key is not usable yet.

6. **Hand off.** Report `PRIVATE_KEY_ID`, the fingerprint and public key
   line, the policy id, the socket path, and the exact `start` command the
   agent's process runs. Stop.

## Verified by

| Examples | Test |
|---|---|
| ssh.create-key, ssh.policy, ssh.register, ssh.agent-start, ssh.verify | ssh_agent::using_ssh_register_serve_sign |
| ssh.agent-start | ssh_agent::agent_serves_every_registered_key_and_reports_its_lifecycle |
| ssh.constrain | ssh_agent_destinations::constrained_agent_signs_only_allowed_namespaces_and_reports_them |
| ssh.constrain | ssh_agent_destinations::constrained_agent_gates_ssh_userauth_by_server_host_key |
| ssh.constrain-forwarded | ssh_agent_destinations::constrained_agent_refuses_a_forwarded_hop |
| ssh.constrain-forwarded | ssh_agent_destinations::constrained_agent_signs_only_allowed_namespaces_and_reports_them |
| ssh.register | ssh::ssh_key_register_list_print_and_remove_by_every_name |

## Troubleshooting

- `ssh agent start` exits `1` with `invalid_input` "the registry holds no
  SSH keys" or "no registered SSH key matches": step 3 was skipped or ran
  under another `HOME`. Register in the home the daemon uses.
- `ssh agent status` exits `1` with `command_error` "ssh-agent is not
  running": nothing holds the pid file. Start it; if `--socket` or
  `--pid-file` were given at start, give them here too.
- `ssh agent start` exits `1` with `command_error` "ssh-agent is already
  running on": stop that one first, or start on another `--socket`.
- `ssh-keygen -Y sign` or `ssh` fails with "agent refused operation" while
  `ssh-add -L` lists the key: check for the signing activity first. As root,
  run `tk --profile admin --message-format json activity list --limit 5`.
- A failed `SIGN_RAW_PAYLOAD` activity exists: Turnkey denied the signature.
  As root, run
  `tk --profile admin --message-format json policy evaluations --activity-id ACTIVITY_ID`
  on it; the usual cause is a policy scoped to a different `private_key.id`
  or a consensus that names the wrong user. Do not start the daemon as root
  instead.
- No `SIGN_RAW_PAYLOAD` activity exists: the daemon, started from a profile,
  could not reload its credential for that signature. The registry under
  its `HOME` is unreadable or does not parse, its `--profile` was deleted or
  no longer selects a credential for the key's organization, or the
  profile's API key file is unreadable. In the daemon's `HOME`, run
  `tk --profile agent --message-format json whoami`; the daemon signs again
  once that succeeds, with no restart.
- No activity, `whoami` succeeds, and `--allowed-hosts-file` is set: the
  daemon refused a pre-8.9 client, an unlisted host key, a failed bind, an
  8.9+ client's forwarded hop, or `-Y sign` bound or outside
  `--allow-namespace`.
- `ssh keys add` exits `1` with `invalid_input` naming another curve: the
  id is an existing non-Ed25519 key. Create one with step 1.
- The key is served but the server rejects it: the public key line is not
  installed on that host or account; compare it with `ssh public-key`.

## Related Skills

- [signing-git-commits](../signing-git-commits/SKILL.md): sign commits with
  the same registered key, or with an OpenPGP key.
- [managing-identities](../managing-identities/SKILL.md): the agent user,
  its profile, and rotating its API key.
- [managing-policies](../managing-policies/SKILL.md): debugging the
  `agents-sign-ssh` scope with `policy evaluations`.
- [provisioning-session-agent](../provisioning-session-agent/SKILL.md):
  when the agent's key expires and renews.
- [sidecar-patterns](../sidecar-patterns/SKILL.md): where the daemon and
  socket live when the agent runs in its own OS user or container.
