# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

CLI: `tk 0.7.0` at `/tmp/tk-bin/tk` (`tk --version`). Not on `PATH` and not installed into a home directory. Help checked: `profile` (`create`, `set`, `delete`), `user` (`create`, `tag`, `get`), `login`, `whoami`, `api-key` (`register`, `list`, `delete`), and `activity wait` (default timeout 60s). `profile create` writes a fresh P-256 file under `~/.config/turnkey/tk/api-keys/` unless `--api-key-file` is set, and it does not contact Turnkey. `profile delete` help says credential files are kept. `profile set --api-key-file` uses that file from now on. `user create` omits expiry when `--expires-in` is omitted; `--anchor-key` is a separate never-expiring key whose private half is generated on the machine that runs `user create` and discarded. Flag form names the registered key `{userName}-key`.

Docs: vendored `skills/turnkey-tk/provisioning-agent-identity/SKILL.md`, `docs/authentication.md`, `docs/resources.md`, `docs/activities.md`. Main: https://github.com/tkhq/tk/blob/main/skills/provisioning-agent-identity/SKILL.md and https://github.com/tkhq/tk/blob/main/docs/authentication.md . Release: https://github.com/tkhq/tk/releases/tag/v0.7.0 .

This questionnaire relies on the 0.7.0 binary, which keeps stored credential files on `profile set` and `profile delete`. Main's authentication doc deletes that stored copy unless another profile uses it; do not follow main. It does not rely on `session provision`'s `7d` default or `session status`'s `48h` default, because this route never calls `session`. Organization id, quorum, API base URL, the `agent` tag id, and the body of `agents-no-credentials` are not re-asked; they stay in bootstrapping-organization, managing-identities, and managing-policies. The Apple test container (uid 1000, read-only root, tmpfs `HOME=/home/tester`, no host mount, short lived) cannot keep a credential on the read-only root or after exit.

## Questions

1. Is this the long-lived route: one never-expiring API key, no session provisioner, and no `--expires-in`?
- yes
- no, stop and use provisioning-session-agent
- other

2. Which recorded foundation profile and user names does this run use, and where does the agent HOME live? Organization id, quorum, tag ids, and policy text stay in bootstrapping-organization, managing-identities, and managing-policies, and the test container cannot keep a credential on its read-only root or tmpfs home.
- root profile name chosen in bootstrapping-organization, on an operator machine only
- agent profile name equal to the role slug chosen in managing-identities
- agent user name equal to that same slug, so the key name is `{slug}-key`
- a different short role slug for this user and profile, stated under other
- durable HOME outside this repo, credential under `~/.config/turnkey/tk/api-keys/`
- a durable volume mounted as that HOME, not the test tmpfs
- the workload may exec inside the test container, but the profile HOME is not that tmpfs
- stop, because the only HOME would be the test tmpfs or the read-only root
- other

3. Should the tag be the existing `agent` tag from bootstrap, created with `user tag create --name agent` only when `user tag list` has no tag of that name, and never a second tag or a guessed `--tag` id?
- yes
- no
- other

4. May this user carry any tag besides `agent`? The credential DENY selects that tag, not the user name.
- no, pass only `--tag-name agent`
- no, and do not pass `--tag`
- yes, extra tags are required, so stop
- other

5. How many long-lived users share that tag and the same DENY, each with its own user name and profile name?
- this is the first user on the tag
- this is an additional user on the tag
- this user must not share the tag, so stop
- other

6. How is the P-256 key produced? Only `data.publicKey` may leave the agent host, and it is never a secret value in the repo.
- `profile create` on the agent host with no `--api-key-file`
- `--api-key-file` only for a file that already exists on that host and is never committed
- stop if the key would be generated on the root machine and copied over
- other

7. Should `user create` omit `--email`, `--expires-in`, and `--anchor-key`, so the one kept private key has `expiresAt` null? Discarding an anchor private half is the session route, not this one.
- yes, omit all three
- set a non-personal email and still omit expiry and `--anchor-key`
- the key must expire or an anchor private half must be discarded, so use provisioning-session-agent
- other

8. What should this run do with `agents-no-credentials` if managing-policies already chose that DENY? Do not rewrite its condition here.
- create it only when `policy list` has no such name, using the recorded `agent` tag id
- if the name exists, continue only when `policy get` shows deny, `activity.resource == 'CREDENTIAL'`, and that tag id
- stop if the name exists but was not checked
- other

9. What if `user create` returns `pending`?
- `activity wait --id` for the default 60 seconds, and continue only when completed
- a non-root human approver must `activity approve` before that wait
- stop on rejected or failed, and do not create the DENY yet
- other

10. Is a `TURNKEY_*` bundle set on the agent host?
- no, prove the identity with `--profile` only
- yes, a full bundle, so unset it before `login` and `whoami`
- yes, a partial bundle, which must be unset before any command
- other

11. Who checks that `whoami` `data.userId` equals the created user id?
- the agent host, after `login --profile-name`, with `--profile` set to this agent
- the operator, using only the user id the agent host returns
- stop if that host cannot run `whoami`
- other

12. What must acceptance show before handoff, run as the agent profile rather than root?
- `api-key register` returns `code` `unauthorized` and `httpStatus` 403
- `api-key list --user-id` then shows exactly one key, the same public key, and `expiresAt` null
- any other outcome, and do not hand off
- also `policy evaluations --activity-id` for that register activity
- other

13. If that self-registration returns `completed` or `pending`, what is the recovery order?
- fix the DENY, rerun the register, then as root `api-key delete` every unauthorized id and rotate
- delete the extra key before fixing the DENY
- stop, and do not delete or rotate
- other

14. Which capabilities does this run grant?
- identity only; exports, signing, and SSH stay in their own skills
- none, because this agent must use an expiring session key
- other

15. Should every unattended `tk` call set `--non-interactive` (or `TK_NON_INTERACTIVE`) and `--message-format json`? A TTY prompt cannot be answered inside the test container.
- yes
- no
- other

16. On this binary, do `profile delete` and `profile set` leave the stored credential file in place, so neither is revocation? Main would remove the stored copy; this run must not assume that.
- yes, rely on 0.7.0 keeping the file
- no, follow main and expect the stored file to disappear
- other

17. What may the handoff record, with no private key and no personal name?
- user id, `agent` tag id, profile name, host role, DENY policy id, and the acceptance codes
- those plus the public key, still outside the repo
- where HOME lives, and that the test container is not the credential store
- nothing, not even ids
- other

These answers choose a tagged non-root long-lived user, the foundation profile name, a HOME that is not the test container's read-only root or tmpfs, a single never-expiring key whose private half stays on that host, no discarded anchor, and the shared credential DENY proved by the agent's own `whoami` and a 403 self-registration. Renewal, the provisioner host, sockets, and revoke stay in the other three files.

Answering these is sufficient for that skill.
