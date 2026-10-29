# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

CLI: `tk 0.7.0` at `/tmp/tk-bin/tk` (`tk --version`). Not on `PATH` and not installed into a home directory. Help checked: `profile`, `whoami`, `secret env` (needs `--name-prefix` or `--property`), `session` (`status` default `--warn-before 48h`, `request --replace`, `provision` default `--expires-in 7d`, `activate`), `ssh agent start` (default `--socket-mode 600`), and `gpg agent serve` (foreground, requires `--key`, default `--socket-mode 600`). `profile delete` help says credential files are kept.

Docs: vendored `skills/turnkey-tk/sidecar-patterns/SKILL.md`, `docs/sessions.md`, `docs/secrets.md`, `docs/ssh-agent.md`, `docs/gpg-signing.md`, `docs/authentication.md`. Main: https://github.com/tkhq/tk/blob/main/skills/sidecar-patterns/SKILL.md . Release: https://github.com/tkhq/tk/releases/tag/v0.7.0 .

This questionnaire relies on the `7d` and `48h` defaults only when provisioning-session-agent already selected "omit the flag"; otherwise the sidecar passes that file's lifetime, warn window, and tick. It relies on this binary keeping credential files on `profile set` and `profile delete`; main deletes the stored copy unless another profile uses it. Secret names, properties, and export policies stay in managing-secrets and managing-policies. Signing-key registration stays in using-ssh, signing-git-commits, and deploying-signing-broker. The Apple test container (uid 1000, read-only root, tmpfs `HOME=/home/tester`, no host mount, short lived) cannot keep a credential on the read-only root or after exit. A process there may receive an environment or a socket; it is not a profile HOME.

## Questions

1. Which parts of this skill should the deployment stand up?
- startup `tk secret env` into the process environment, never a file the agent can read
- a renewal loop for an expiring session profile
- no renewal loop, because the agent is the long-lived route
- an SSH socket as the agent user
- an OpenPGP broker socket for commit signing
- an independent expiry alert that uses no Turnkey credential
- none until a durable sidecar exists
- other

2. Which separation model is in force, with one HOME and one process tree per principal, knowing host root can still read every boundary?
- separate OS users, the default
- separate containers or Compose services
- one VM or sandbox per principal
- shared numeric uid for the application and broker only, with separate HOMEs, process trees, and mounts
- the test container runs the workload only, and every credential HOME stays outside it
- the test container is the credential store (not allowed)
- other

3. Which recorded foundation profile names are pinned, with `HOME` and `TK_PROFILE`, for each process? Do not re-decide organization id, tags, or policy text.
- agent profile name equal to the role slug in managing-identities, HOME durable and outside the test tmpfs
- provisioner profile name from that questionnaire, on a sidecar HOME that does not contain the agent profile
- broker profile name from that questionnaire, HOME and registry not mounted into the agent
- revoker profile name, if revoke runs on this same deployment, on its own HOME
- a process inside the test container with no profile, receiving env or a socket only
- stop, because a credential HOME would be the read-only root or the test tmpfs
- other

4. How does each principal get `tk`, with `tk --version` and a file-type check from that principal's shell? A missing bind-mount target becomes an empty directory.
- installed in the image
- a read-only host bind
- both image and bind
- not installed in the test container
- other

5. Do the agent and provisioner already exist with the mint policies from provisioning-session-agent, and do the export policies and secrets from managing-secrets already exist? This file does not choose the mint row or the secret inventory.
- yes
- no, profile `agent` is missing
- no, profile `provisioner` is missing
- no, profile `broker` is missing
- no, the secret import is missing
- not applicable, because this agent is long-lived and injects no secrets
- other

6. Is startup the recorded managing-secrets selector, sourced into the process and not written to a file? The skill example is `--profile agent --message-format json secret env --name-prefix service/ --property consensus=unilateral`, which prints `data.env`.
- yes, that example, JSON `data.env`
- yes, the prefix and every `--property` already recorded in managing-secrets
- human dotenv instead of JSON `data.env`
- no `secret env`
- other

7. If `secret env` exits 1 with `approval_required`, what happens?
- fail startup and keep approval-gated secrets out of this prefix
- approve, then rerun the same command before the process starts
- move those secrets to a later on-demand export
- no matching secret needs approval
- other

8. Which renewal halves run, each with its own profile, state file, and lock, with `provision` only as the provisioner and the lifetime, `--warn-before`, and tick taken from provisioning-session-agent unless other states a broker-specific override?
- `status`, `request`, and `activate` as the agent OS user
- the same three as the broker OS user
- `session provision` only as the provisioner
- `whoami` as that principal after activate
- no renewal loop
- other

9. Where are the agent user id and, if a broker renews, the broker user id stored so provision can run when `session request` returns `data.userId` null?
- persisted outside the agent process, on the durable agent HOME
- injected at start, not only inside the test tmpfs
- the broker id is not persisted, so a broker must not renew
- no expiring principal, so no id is required for renewal
- other

10. How does the public key reach the provisioner? The provisioner binds the request to the expected organization, user id, and lifetime before it mints.
- an authenticated handoff
- a shared volume or file with only the public key and user id, still checked against those three
- the provisioner reads the agent's profile directory (not allowed)
- no handoff, because there is no renewal loop
- other

11. Is renewal one locked state machine per principal, with the public key and state written atomically, and `--replace` only after the mint activity is rejected? Two timers must not both request.
- yes, and the state-file path and lock path are stated under other
- yes, same rule as provisioning-session-agent, paths stated under other
- no
- no renewal loop
- other

12. How is the SSH socket exposed, given default `--socket-mode` `600`, `--allowed-hosts-file` when anything else can reach it, and `--allow-namespace` only on the one git-signing boundary, never forwarded or relayed?
- no SSH agent
- directory mode `0700`, socket mode `600`, one `--key`, `SSH_AUTH_SOCK` set
- directory `0750` and `--socket-mode 660` for a supplemental group
- any wider reach, so `--allowed-hosts-file` is required and `--allow-namespace` stays off this socket
- a second socket, `--allow-namespace git`, shared with exactly one git-signing boundary
- other

13. How are commits signed?
- no commit signing
- GPG broker only
- `--allow-namespace git` on a socket shared with exactly one git-signing boundary, never forwarded or relayed
- `gpg.ssh.program=tk` with no socket
- other

14. What is the OpenPGP socket model, given default mode `600`, with the agent receiving `TK_GPG_AGENT_SOCK` and the public key but never the broker profile, registry, or credential?
- no broker
- group model, broker-owned socket `--socket-mode 660`, agent supplemental group, runtime mounted read-only
- shared-uid model, socket mode `600`, runtime mounted read-only
- the broker serves exactly one registered fingerprint
- the agent process holds the signing profile (outside this skill)
- broker failure falls back to another signer (not allowed)
- other

15. Will the renewal loop, not the agent, alert with no Turnkey credential when `session status` reports `session_expiring` twice, a mint stays `pending` past the lead, or a mint is rejected? Include `details.publicKey`, `details.expiresAt`, and the activity id.
- yes, channel stated under other
- yes, but drop a trigger or field, stated under other
- no alert
- no renewal loop, so no expiry alert from this skill
- other

16. What supervises the processes?
- systemd timers with `User=` per renewed principal and one provisioner unit
- Compose services with separate HOME volumes
- the agent entrypoint sources `data.env` and then execs the agent
- an LLM runtime hook whose secrets command is `secret env`
- foreground `gpg agent serve` under a supervisor that delivers SIGTERM and removes the socket
- nothing supervised yet
- other

17. Which manual gates must pass before the agent is left unattended?
- separation and HOMEs match the model, and the test container holds no credential
- SSH and broker socket owner and mode match the model
- the timer fires and a short `--expires-in` renews through the loop
- a stopped loop alerts, and a stopped broker fails `git commit -S`
- secrets are only in the process environment
- none, because this host is still only the short-lived test container
- other

18. Should every unattended `tk` call set `--non-interactive` and `--message-format json`, and should a local profile delete be treated as not revoking the key?
- yes, and rely on 0.7.0 keeping the stored credential file
- no
- other

These answers choose the sidecar shape (secret env, SSH socket, GPG socket, or none), the socket mode, where the renewal loop and its lock run, and that every credential HOME is a durable path rather than the test container's read-only root. Long-lived versus session, expiry, anchor discard, and which key ids a revoker deletes stay in the other three files.

Answering these is sufficient for that skill.
