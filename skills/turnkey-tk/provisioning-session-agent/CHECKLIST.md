# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

CLI: `tk 0.7.0` at `/tmp/tk-bin/tk` (`tk --version`). Not on `PATH` and not installed into a home directory. Help checked: `profile` (`create`, `set`, `delete`), `user` (`create`, `get`), `session` (`request`, `provision`, `activate`, `status`), `whoami`, `login`, `activity` (`get`, `approve`), and `api-key delete`. `session provision --expires-in` defaults to `7d` (examples `7d`, `48h`, `30m`; docs bound `1s`–`365d`). `session status --warn-before` defaults to `48h`. `session request` has `--replace`. `user create --anchor-key` registers a never-expiring key whose private half is generated on that machine and discarded. `profile delete` help says credential files are kept.

Docs: vendored `skills/turnkey-tk/provisioning-session-agent/SKILL.md` and `docs/sessions.md`. Main: https://github.com/tkhq/tk/blob/main/skills/provisioning-session-agent/SKILL.md and https://github.com/tkhq/tk/blob/main/docs/sessions.md . Release: https://github.com/tkhq/tk/releases/tag/v0.7.0 .

This questionnaire relies on those two defaults only when an answer says to omit the flag. A shorter lifetime than `7d`, or a warn window other than `48h`, must be passed explicitly, and the warn window must be shorter than the lifetime. It relies on this binary keeping credential files across `profile set` and `profile delete`; main deletes the stored copy unless another profile uses it, and vendored `sessions.md` deletes a previous key file only if `tk` generated it. Deleting a local file still revokes nothing. Organization id, quorum, API base URL, tag ids, the minting row, the lifetime cap in seconds, and the containment policy bodies stay in bootstrapping-organization, managing-identities, and managing-policies. Do not recreate a user or replace a policy on renewal. The Apple test container (uid 1000, read-only root, tmpfs `HOME=/home/tester`, no host mount, short lived) cannot keep a credential, the pending file `~/.config/turnkey/tk/sessions/pending/<profile>.json`, or `AGENT_USER_ID` on the read-only root or after exit.

## Questions

1. Which branch should run? If the user or the mint policies already exist, do not select first provisioning.
- first provisioning (profile, user, provisioner, missing policies, login, then one renew)
- renewal only (the four `session` commands; do not recreate the user or replace a policy)
- recovery after expiry (`whoami` unauthorized and `session request` shows `userId` null)
- recovery of a rejected or stale local request
- stop, because a second process already has a pending request and must not `--replace`
- other

2. Which recorded foundation profile names does this run use, and where does each HOME live? Organization id, quorum, tag ids, and policy text are not re-decided here, and the test container cannot keep a credential on its read-only root or tmpfs home.
- root profile name chosen in bootstrapping-organization, operator machine only, and only for first provisioning
- root already finished, so this run does not use it
- agent profile name equal to the role slug chosen in managing-identities
- provisioner profile name equal to the provisioner slug chosen there
- a broker profile name, if this target is a broker rather than the agent
- durable agent HOME outside this repo, not shared with the provisioner
- durable provisioner HOME on another user, container, or host
- the workload may exec inside the test container, but neither credential HOME is that tmpfs
- stop, because the agent or provisioner HOME would be the test tmpfs or the read-only root
- other

3. Who may the mint ALLOW name? Every id is shown with `user get` first, must be a non-root user carrying the recorded `agent` or `broker` tag, and a root-quorum id is a mismatch.
- one new user on the `agent` tag
- one new user on the `broker` tag
- one existing non-root user already tagged `agent` or `broker`
- several existing non-root users sharing one ALLOW, listed under other by id
- policies already pin this set and must not be rewritten
- other

4. What lifetime should `user create --expires-in` and `session provision --expires-in` use, given the cap already chosen in managing-policies must be at least this long and at most 365 days, and omitting the flag mints `7d`?
- `1h`
- `4h`
- `24h`
- `7d`, passed explicitly (also the CLI default if the flag is omitted)
- `30d`
- omit `--expires-in` and accept the `7d` default, only if the recorded cap is at least `604800`
- other, a duration from `1s` to `365d`

5. What `session status --warn-before` should the loop pass, shorter than the lifetime, knowing that omitting the flag uses `48h`?
- `15m`
- `1h`
- `6h`
- `24h`
- `48h`, passed explicitly
- omit `--warn-before` and accept the `48h` default
- other

6. How should the single-writer loop tick on the agent host? The tick must be shorter than the lifetime minus the warning window.
- cron about every 15 minutes
- an in-process sleep loop about every hour
- an external scheduler about every hour
- systemd or launchd at the warning interval
- an operator runs the renew commands by hand
- no loop, because this is a long-lived key (stop this skill)
- other

7. On first `user create`, may the operator pass `--anchor-key` and discard that private half immediately on the operator machine? Turnkey requires one long-lived credential; the session profile must not keep the anchor.
- yes, discard the anchor private half
- no, keep the anchor private half (that is a second live credential, outside this skill)
- no `--anchor-key`, so an expiring-only create is expected to fail until an anchor exists
- not first provisioning, so do not create another anchor
- other

8. Which containment policies should this run create only when the name is missing? Use the mint row and cap from managing-policies; do not widen the ALLOW to every user.
- `agents-no-credentials`, `provisioners-nothing-else`, and one `provisioners-no-self-keys` for this provisioner
- none; those names already exist and must not be replaced
- only the subset named under other
- other

9. Where do `AGENT_USER_ID` and the pending session file survive restarts? After expiry, `session request` reports `userId` null and will not rediscover the id.
- default `~/.config/turnkey` on a durable agent HOME
- a volume mounted only as that HOME
- user id injected at start, plus a volume for `api-keys` and `sessions/pending`
- stop, because the only copy would be the test tmpfs
- other

10. How do `data.publicKey` and `data.userId` cross to the provisioner? The provisioner accepts a key only for the expected organization, user id, and lifetime.
- an authenticated local socket between the two users
- a signed file on a volume that is neither credential store
- a person copies the two fields
- an existing authenticated channel, named under other
- the provisioner reads the agent profile directory (not allowed)
- other

11. Who approves a human mint via `activity approve --id`, the console, or the mobile app, never the agent container, skipping this when managing-policies recorded unilateral mint?
- a `human-approver` profile outside the container
- the Turnkey console or mobile app
- not applicable, because minting is unilateral
- other

12. What `--label` should `session provision` use?
- omit it and accept `session-EXPIRES_IN-UNIX_SECONDS`
- a short role label with no personal name, stated under other
- other

13. Should the loop hold one lock, refuse a second `session request`, and pass `--replace` only after a rejected mint? A second process must not `--replace`.
- yes
- no
- other

14. After a rejected or stale request, what should recovery do?
- the provisioner resubmits the same public key and the human approves that activity
- the agent host runs `session request --profile-name … --replace`, then renews again
- alert and stop
- other

15. Should every unattended `tk` call set `--non-interactive` (or `TK_NON_INTERACTIVE`) and `--message-format json`, and should `activate` be followed by `whoami` as that profile before the old generated key file is treated as gone?
- yes
- no
- other

16. Which API can both homes reach? Use the base URL already stored by bootstrapping-organization; do not pick a new organization.
- the URL already on those profiles, including the default `https://api.turnkey.com`
- the same custom `--api-base-url` already recorded at bootstrap, from both homes
- the agent or provisioner cannot reach the API, so stop
- other

17. What may the handoff record, with no private key and no personal name?
- `AGENT_USER_ID`, `PROVISIONER_USER_ID`, both profile names, both hosts, and where each HOME lives
- the mint row name, each policy id, and the current `expiresAt` from `session status`
- the exact renew commands, the timer interval, and any mint activity id still pending
- that the test container is not a credential store
- nothing, not even ids
- other

These answers choose an expiring session rather than a long-lived key, the tag and target ids already recorded, an explicit expiry that fits the recorded cap, whether the anchor private half is discarded, the provisioner host and its separate HOME, the renewal tick, and the single-writer lock with `--replace` only after rejection. Secret injection, socket mode, and `api-key delete` stay in the sidecar and revoking files.

Answering these is sufficient for that skill.
