---
name: sidecar-patterns
description: Run tk beside an unattended agent so the agent process holds only what it needs: separate credential stores, a renewal loop outside the agent, secrets injected at startup, an SSH socket per OS user, commit signing through a broker socket, and an operator alert that does not depend on the agent's own credential. Use when deploying an agent that uses tk on a VM or in a container, or when a deployment keeps losing its session key; not for choosing policies or approval models.
---

> **Pre-requisites** and **Decisions** are this repo's. The rest is the published skill.

## Pre-requisites

| # | Check | Command | Pass |
|---|---|---|---|
| 1 | `tk` present | `command -v tk` | prints a path |
| 2 | Workflow present | `test -f skills/turnkey-tk/sidecar-patterns/SKILL.md` | exit 0 |

## Decisions

| Decision | Field | Options | Default |
|---|---|---|---|
| Q1: Which parts of this skill should the deployment stand up? | Turnkey `tk` policy | startup `tk secret env` into the process environment, never a file the agent can read; a renewal loop for an expiring session profile; no renewal loop, because the agent is the long-lived route; an SSH socket as the agent user; an OpenPGP broker socket for commit signing; an independent expiry alert that uses no Turnkey credential; none until a durable sidecar exists; other | startup `tk secret env` into the process environment, never a file the agent can read |
| Q2: Which separation model is in force, with one HOME and one process tree per principal, knowing host root can still read every boundary? | Turnkey `tk` policy | separate OS users, the default; separate containers or Compose services; one VM or sandbox per principal; shared numeric uid for the application and broker only, with separate HOMEs, process trees, and mounts; the test container runs the workload only, and every credential HOME stays outside it; the test container is the credential store (not allowed); other | separate OS users, the default |
| Q3: Which recorded foundation profile names are pinned, with `HOME` and `TK_PROFILE`, for each process? Do not re-decide organization id, tags, or policy text. | Turnkey `tk` policy | agent profile name equal to the role slug in managing-identities, HOME durable and outside the test tmpfs; provisioner profile name from that questionnaire, on a sidecar HOME that does not contain the agent profile; broker profile name from that questionnaire, HOME and registry not mounted into the agent; revoker profile name, if revoke runs on this same deployment, on its own HOME; a process inside the test container with no profile, receiving env or a socket only; stop, because a credential HOME would be the read-only root or the test tmpfs; other | agent profile name equal to the role slug in managing-identities, HOME durable and outside the test tmpfs |
| Q4: How does each principal get `tk`, with `tk --version` and a file-type check from that principal's shell? A missing bind-mount target becomes an empty directory. | Turnkey `tk` policy | installed in the image; a read-only host bind; both image and bind; not installed in the test container; other | installed in the image |
| Q5: Do the agent and provisioner already exist with the mint policies from provisioning-session-agent, and do the export policies and secrets from managing-secrets already exist? This file does not choose the mint row or the secret inventory. | Turnkey `tk` policy | yes; no, profile `agent` is missing; no, profile `provisioner` is missing; no, profile `broker` is missing; no, the secret import is missing; not applicable, because this agent is long-lived and injects no secrets; other | yes |
| Q6: Is startup the recorded managing-secrets selector, sourced into the process and not written to a file? The skill example is `--profile agent --message-format json secret env --name-prefix service/ --property consensus=unilateral`, which prints `data.env`. | Turnkey `tk` policy | yes, that example, JSON `data.env`; yes, the prefix and every `--property` already recorded in managing-secrets; human dotenv instead of JSON `data.env`; no `secret env`; other | yes, that example, JSON `data.env` |
| Q7: If `secret env` exits 1 with `approval_required`, what happens? | Turnkey `tk` policy | fail startup and keep approval-gated secrets out of this prefix; approve, then rerun the same command before the process starts; move those secrets to a later on-demand export; no matching secret needs approval; other | fail startup and keep approval-gated secrets out of this prefix |
| Q8: Which renewal halves run, each with its own profile, state file, and lock, with `provision` only as the provisioner and the lifetime, `--warn-before`, and tick taken from provisioning-session-agent unless other states a broker-specific override? | Turnkey `tk` policy | `status`, `request`, and `activate` as the agent OS user; the same three as the broker OS user; `session provision` only as the provisioner; `whoami` as that principal after activate; no renewal loop; other | `status`, `request`, and `activate` as the agent OS user |
| Q9: Where are the agent user id and, if a broker renews, the broker user id stored so provision can run when `session request` returns `data.userId` null? | Turnkey `tk` policy | persisted outside the agent process, on the durable agent HOME; injected at start, not only inside the test tmpfs; the broker id is not persisted, so a broker must not renew; no expiring principal, so no id is required for renewal; other | persisted outside the agent process, on the durable agent HOME |
| Q10: How does the public key reach the provisioner? The provisioner binds the request to the expected organization, user id, and lifetime before it mints. | Turnkey `tk` policy | an authenticated handoff; a shared volume or file with only the public key and user id, still checked against those three; the provisioner reads the agent's profile directory (not allowed); no handoff, because there is no renewal loop; other | an authenticated handoff |
| Q11: Is renewal one locked state machine per principal, with the public key and state written atomically, and `--replace` only after the mint activity is rejected? Two timers must not both request. | Turnkey `tk` policy | yes, and the state-file path and lock path are stated under other; yes, same rule as provisioning-session-agent, paths stated under other; no; no renewal loop; other | yes, and the state-file path and lock path are stated under other |
| Q12: How is the SSH socket exposed, given default `--socket-mode` `600`, `--allowed-hosts-file` when anything else can reach it, and `--allow-namespace` only on the one git-signing boundary, never forwarded or relayed? | Turnkey `tk` policy | no SSH agent; directory mode `0700`, socket mode `600`, one `--key`, `SSH_AUTH_SOCK` set; directory `0750` and `--socket-mode 660` for a supplemental group; any wider reach, so `--allowed-hosts-file` is required and `--allow-namespace` stays off this socket; a second socket, `--allow-namespace git`, shared with exactly one git-signing boundary; other | no SSH agent |
| Q13: How are commits signed? | Turnkey `tk` policy | no commit signing; GPG broker only; `--allow-namespace git` on a socket shared with exactly one git-signing boundary, never forwarded or relayed; `gpg.ssh.program=tk` with no socket; other | no commit signing |
| Q14: What is the OpenPGP socket model, given default mode `600`, with the agent receiving `TK_GPG_AGENT_SOCK` and the public key but never the broker profile, registry, or credential? | Turnkey `tk` policy | no broker; group model, broker-owned socket `--socket-mode 660`, agent supplemental group, runtime mounted read-only; shared-uid model, socket mode `600`, runtime mounted read-only; the broker serves exactly one registered fingerprint; the agent process holds the signing profile (outside this skill); broker failure falls back to another signer (not allowed); other | no broker |
| Q15: Will the renewal loop, not the agent, alert with no Turnkey credential when `session status` reports `session_expiring` twice, a mint stays `pending` past the lead, or a mint is rejected? Include `details.publicKey`, `details.expiresAt`, and the activity id. | Turnkey `tk` policy | yes, channel stated under other; yes, but drop a trigger or field, stated under other; no alert; no renewal loop, so no expiry alert from this skill; other | yes, channel stated under other |
| Q16: What supervises the processes? | Turnkey `tk` policy | systemd timers with `User=` per renewed principal and one provisioner unit; Compose services with separate HOME volumes; the agent entrypoint sources `data.env` and then execs the agent; an LLM runtime hook whose secrets command is `secret env`; foreground `gpg agent serve` under a supervisor that delivers SIGTERM and removes the socket; nothing supervised yet; other | systemd timers with `User=` per renewed principal and one provisioner unit |
| Q17: Which manual gates must pass before the agent is left unattended? | Turnkey `tk` policy | separation and HOMEs match the model, and the test container holds no credential; SSH and broker socket owner and mode match the model; the timer fires and a short `--expires-in` renews through the loop; a stopped loop alerts, and a stopped broker fails `git commit -S`; secrets are only in the process environment; none, because this host is still only the short-lived test container; other | separation and HOMEs match the model, and the test container holds no credential |
| Q18: Should every unattended `tk` call set `--non-interactive` and `--message-format json`, and should a local profile delete be treated as not revoking the key? | Turnkey `tk` policy | yes, and rely on 0.7.0 keeping the stored credential file; no; other | yes, and rely on 0.7.0 keeping the stored credential file |

---


# Sidecar patterns

Result: a deployment where the agent reads its secrets once at startup, a separate renewal
loop keeps the agent's expiring credential fresh, SSH goes through a socket, git signs
commits through a broker's socket, and an operator hears about an expired credential from
something other than the agent. Every `tk` step in this workflow is a command another workflow already documents; this workflow fixes where each one runs and what state it keeps.

## Reference

- [sessions](../docs/sessions.md): the four `session` commands and their records.
- [secrets](../docs/secrets.md): `secret env` and pending exports.
- [ssh-agent](../docs/ssh-agent.md): the agent socket and its lifecycle.
- [gpg-signing](../docs/gpg-signing.md): `gpg agent serve` and the client socket.
- [authentication](../docs/authentication.md): the `whoami` record and how `HOME` and `TK_PROFILE` select a profile.

## Rules

- Separation means one boundary (a container, VM, sandbox, or OS user), one
  `HOME`, one process tree, and one set of mounts per principal; the agent's
  profile and the provisioner's profile never share a credential directory.
  Separate OS users are the default. Under the shared-uid socket model the
  application and broker share a numeric uid and nothing else, and the
  application mounts the broker's runtime directory read-only. Host root can
  still read every boundary; no boundary is a secrecy boundary against the host.
- The renewal loop is the single writer of the agent's profile. Its agent-side
  half (status, request, activate) runs as the agent's OS user on a timer outside
  the agent's own control loop; its provisioner-side half (provision) runs as the
  provisioner. Both hold a lock while they run, update their state file atomically,
  and persist the agent's user id so renewal works after the current key has expired.
- Secrets go from `tk secret env` into the authorized process's environment.
  No file the agent can read holds a plaintext value; no transcript does.
- The public-key handoff from agent to provisioner is not secret but must
  be authenticated: the provisioner binds the request to the expected
  organization, agent user id, and lifetime before it mints anything.
- The SSH socket is signing authority. Bind it under the agent's `HOME`,
  mode-restricted to that OS user or a supplemental group for clients under another
  uid. A socket anything else can reach takes `--allowed-hosts-file`, which signs only
  SSH logins to listed host keys and refuses `ssh-keygen -Y sign`
  ([using-ssh](../using-ssh/SKILL.md)). Only a socket shared with its one
  git-signing boundary carries `--allow-namespace`; never forward it over SSH
  or relay it beyond that boundary.
- The OpenPGP socket is signing authority too. The broker alone holds the signing
  profile and serves one fingerprint. The agent's
  boundary gets the socket and the public key, never the broker's profile or
  registry, and the agent's own profile has no signing policy on that wallet.
- Alert on expiry from the loop, not from the agent: an expired agent cannot.
- A deployment that stages no provider secrets by hand still holds Turnkey
  credential files. Treat the host as secret-bearing.

## Instructions

Inputs: the agent profile (`agent`) and its persisted user id (`AGENT_USER_ID`), the
provisioner profile (`provisioner`) on the sidecar, the scope prefix (`service/`), the
chosen approval cell, and the key lifetime and renewal lead time. Prerequisites: the
agent and provisioner exist with their minting policies
([provisioning-session-agent](../provisioning-session-agent/SKILL.md)), and the
export policies and secrets exist
([managing-secrets](../managing-secrets/SKILL.md) steps 1 and 2).

1. **Lay out the principals.** Decide, and record, which OS user, `HOME`,
   and profile each of these runs as: the agent process, the renewal loop
   (its agent half as `agent`, its provisioner half as `provisioner`), the
   SSH daemon (as `agent`), and the GPG broker (as `broker`). Install `tk` in
   the image or as a read-only host mount and check `tk --version` from each
   principal's shell; a missing binary at a bind-mount path becomes an empty
   directory, so check the file type, not just the path.

2. **Start the agent with its environment.** The agent's entrypoint runs,
   before the agent code starts:

   <!-- shared: secret-env-startup -->
   <!-- example: sidecar.startup-env -->
   ```sh
   tk --profile agent --message-format json secret env --name-prefix service/ --property consensus=unilateral
   ```

   Source `data.env` into the process and start it. Exit `1` with
   `approval_required` means an approval-gated secret is in the selection;
   keep those out of startup paths and fetch them on demand instead.

3. **Run the renewal loop.** On a timer shorter than the lifetime minus the
   lead time, once per expiring principal: `agent` and `broker` each run it
   as their own OS user with their own profile, state file, and lock. `status`,
   `request`, and `activate` run as that principal with its `HOME`; `provision`
   runs on the sidecar as the provisioner, reading the public key and user id
   from the handoff:

   <!-- example: sidecar.renew -->
   ```sh
   tk --message-format json session status --profile-name agent --warn-before 1h
   tk --message-format json session request --profile-name agent
   tk --profile provisioner --message-format json session provision --user-id AGENT_USER_ID --public-key PUBLIC_KEY --expires-in 4h
   tk --message-format json session activate --profile-name agent
   ```

   The tick is a state machine, not a script that runs all four lines:

   | Observed | Do |
   |---|---|
   | `session status` exits `0` | nothing; the key is healthy |
   | exits `1` with `session_expiring` and no pending request | `session request`; save `data.publicKey`; if `data.userId` is `null` use the persisted `AGENT_USER_ID` |
   | a pending request exists | `session provision`; `pending` means a human must approve; `alreadyRegistered: true` or `completed` means proceed |
   | provision completed | `session activate`, then `whoami` as that principal |
   | activate fails `unauthorized` | the key is not registered yet; leave the request in place and try next tick |
   | the mint activity was rejected | `session request --replace`, alert (step 6), start over next tick |

   Persist the state and the request's public key in one file written
   atomically; lock the whole tick so two timers cannot both request. Deleting
   an old key file locally revokes nothing; the anchor key stays.

4. **Serve SSH from a socket.** As the agent principal, in a directory only
   that user can enter, serving one pinned key:

   <!-- example: sidecar.ssh-agent -->
   ```sh
   install -d -m 0700 /run/agent
   tk --profile agent --message-format json ssh agent start --key SSH_FINGERPRINT --socket /run/agent/ssh.sock --pid-file /run/agent/ssh.pid
   # Clients under another uid: share the directory and socket with a supplemental group.
   install -d -m 0750 -g agents /run/agent
   tk --profile agent --message-format json ssh agent start --key SSH_FINGERPRINT --socket /run/agent/ssh.sock --pid-file /run/agent/ssh.pid --socket-mode 660
   ```

   Export `SSH_AUTH_SOCK=/run/agent/ssh.sock` in the agent's environment.
   The daemon picks up the key step 3 activates on its next signature.
   Registration is in [using-ssh](../using-ssh/SKILL.md).

5. **Sign commits through the broker.** Run `gpg agent serve` as `broker` per
   [deploying-signing-broker](../deploying-signing-broker/SKILL.md). It serves one
   `--key` on a socket in a runtime directory the agent side mounts read-only:
   `--socket-mode 660` shared through the agent's supplemental group, or `600` under
   the shared-uid model. The agent side gets `TK_GPG_AGENT_SOCK` and the public key,
   and none of the broker's profile, registry, or credential. A missing socket fails signing closed.

6. **Alert independently.** The loop, not the agent, raises an alert when
   `session status` reports `session_expiring` twice in a row, when a mint
   stays `pending` past the lead time, or when a mint is rejected. Include
   `details.publicKey`, `details.expiresAt`, and the activity id. The
   alert path uses no Turnkey credential.

7. **Gate the deployment.** Before the agent is left unattended, check by hand:

   | Check | Expect |
   |---|---|
   | separation | the model in force: separate OS users, or under the shared-uid model one uid for agent and broker with separate `HOME`s, process trees, and mounts |
   | `HOME`s | the agent's holds only its own profile; the sidecar's holds only the provisioner's |
   | SSH socket directory | `0700` to the agent's user, or `0750` to the shared group with a `0660` socket |
   | broker socket | its model: `0660` owned by the broker and the shared group, or `0600` owned by the shared uid |
   | timer | fires |
   | forced expiry (`--expires-in` shorter than the tick) | renews through the loop |
   | loop stopped | the alert fires |
   | `git commit -S` on the agent side | verifies with the broker up, fails with it stopped |
   | secrets | in the process environment and in no file |

8. **Hand off.** Report the principals table, the timer interval and lead
   time, the state file and lock paths, the socket path, the signing
   fingerprint, the alert channel, and the gate results. Stop.

## Runtime examples

These place steps, not requirements. Example: `systemd` timers run step 3 as one unit
per renewed principal, `User=agent` and `User=broker`, for status, request, and activate,
and one `User=provisioner` unit for provision. Example: a Docker Compose deployment gives
the agent and the sidecar separate services and `HOME` volumes, sharing one only for the
public handoff. Example: an LLM runtime hook runs step 2 as its secrets command.

## Verified by

| Examples | Test |
|---|---|
| sidecar.startup-env | secrets::managing_secrets_env_and_rotation |
| sidecar.renew | sessions::session_loop_rotates_an_agent_profile_and_reports_status |
| sidecar.renew | sessions::provisioning_session_agent_recovers_after_expiry |
| sidecar.renew | sessions::provisioning_session_agent_human_mint_unilateral_export |
| sidecar.ssh-agent | ssh_agent::using_ssh_register_serve_sign |

Step 7 is a manual deployment gate; the suite does not prove OS isolation,
timers, mounts, or alert delivery.

## Troubleshooting

- `session request` reports `data.userId: null`: the agent's key has already expired.
  Provision with the persisted `AGENT_USER_ID`; activation still verifies with the new key.
- `session request` fails `invalid_input` naming a pending request: a
  previous tick requested and did not finish. Provision that request; use
  `--replace` only after its activity was rejected.
- `whoami` succeeds from the shell but the agent process gets
  `unauthorized`: it runs with a different `HOME` or `TK_PROFILE`. Pin both.
- `secret env` exits `1` with `approval_required` at boot: an
  approval-gated secret matched the prefix. Add `--property consensus=unilateral`
  or move that secret to an on-demand export.
- Two ticks both requested keys: the loop passes `--replace` unconditionally.
  Add a lock and drop `--replace`; without `--replace` the second `session request` fails `invalid_input` while one is pending.

## Related Skills

- [provisioning-session-agent](../provisioning-session-agent/SKILL.md): the policies and the first provisioning this loop renews.
- [managing-secrets](../managing-secrets/SKILL.md): importing the values step 2 reads.
- [using-ssh](../using-ssh/SKILL.md): registering the key the socket serves.
- [deploying-signing-broker](../deploying-signing-broker/SKILL.md): the broker, its socket, and the client configuration behind step 5.
- [monitoring-activities](../monitoring-activities/SKILL.md): approving a pending mint the loop reports.
