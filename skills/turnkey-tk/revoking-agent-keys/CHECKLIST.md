# Checklist

Purpose: the live decision list for this skill. Decide every item before using the skill.
Change when: the skill, its CLI, or its docs change, or an item gets an `answered:` line.
Not for: the skill itself (`SKILL.md`), the questioning procedure (`skills/herdr/bootstrap.md`).

CLI: `tk 0.7.0` at `/tmp/tk-bin/tk` (`tk --version`). Not on `PATH` and not installed into a home directory. Help checked: `profile` (`create`, `set`, `delete`), `user` (`tag create`, `create`, `get`, `delete`), `policy` (`create`, `update`, `evaluations`), `api-key` (`list`, `delete`), `whoami`, and `activity get`. `api-key delete` requires `--user-id` and at least one `--id`. `api-key list` requires exactly one of `--user-id` or `--all-users`, and at most one of `--expiring-within`, `--expired`, or `--long-lived`. `policy update` takes only `--input-json` or `--input-file`. `profile delete` help says credential files are kept. `whoami` is how a deleted key is proved dead.

Docs: vendored `skills/turnkey-tk/revoking-agent-keys/SKILL.md`, `docs/authentication.md`, `docs/resources.md`, `docs/activities.md`. Main: https://github.com/tkhq/tk/blob/main/skills/revoking-agent-keys/SKILL.md and https://github.com/tkhq/tk/blob/main/docs/authentication.md . Release: https://github.com/tkhq/tk/releases/tag/v0.7.0 .

This questionnaire relies on the 0.7.0 binary, which keeps stored credential files on `profile set` and `profile delete`. Main deletes that stored copy unless another profile uses it. Neither local delete nor `profile delete` revokes a Turnkey key; only `api-key delete` does. It does not rely on `session provision`'s `7d` default or `session status`'s `48h` default. Organization id, quorum, the `agent` / `provisioner` / `broker` tag ids, and existing policy bodies stay in bootstrapping-organization, managing-identities, and managing-policies. The delete ALLOW cannot match on tags, an empty `in []` is not a stand-in, and a root-quorum user is never listed. The Apple test container (uid 1000, read-only root, tmpfs `HOME=/home/tester`, no host mount, short lived) cannot keep the revoker credential on the read-only root or after exit.

## Questions

1. Should the revoker profile, `revoker` tag, and revoker user be created now, before any agent exists, with the delete ALLOW written only after `user get` returns real non-root user ids?
- yes
- no, create them at the first revoke
- other

2. Which recorded foundation profile name does the revoker use, and where does its HOME live? Do not re-decide the organization or the agent tag, and do not put this private key in the repo or on the test container's read-only root.
- profile name `revoker`, the slug from managing-identities if that questionnaire selected a revoker
- a different short role slug, stated under other
- generated on a dedicated revoker host under `~/.config/turnkey/tk/api-keys/`
- generated on an operator laptop in that same directory, outside git
- `TURNKEY_API_PRIVATE_KEY` in a secret store outside git, with no profile file
- not generated until the first revoke
- stop, because the only HOME would be the test tmpfs or the read-only root
- other

3. May root, using the profile name chosen in bootstrapping-organization, sign only the revoker tag, the revoker user, and the delete policy, and never the workload?
- yes, and root is already that profile on a machine outside the repo
- yes, but a second root-quorum member must `activity approve` before those creates finish
- no, root is not available, so stop until it is
- other

4. Will more than one non-root user share the `revoker` tag so any of them matches `approvers.any(user, user.tags.contains(REVOKER_TAG))`?
- yes
- no, exactly one revoker user
- other

5. Will the revoker user carry only the `revoker` tag, and never `agent`, `broker`, or `provisioner`? A credential DENY on those tags overrides this ALLOW.
- yes
- no
- other

6. Which users may later be quoted in the ALLOW `user_id` list? Resolve each with `user get` and show it before the policy is written.
- session agents that keep an anchor key
- long-lived non-root agent users
- non-root provisioners
- non-root brokers
- no root-quorum user, ever
- other

7. Use one policy named `revoker-delete-agent-keys` whose condition is `ACTIVITY_TYPE_DELETE_API_KEYS` and `activity.params.user_id in [...]`, instead of one policy per user?
- yes
- no, one policy per user, names stated under other
- other

8. When another agent user appears, may root extend that list only by `policy update` JSON (`policyCondition` rewritten, same policy id)? There is no flag form for the condition.
- yes
- no, create a new policy instead of updating
- other

9. Which keys may a later `api-key delete --user-id` remove? List first; nothing deletes by public key or by tag.
- keys with non-null `expiresAt` (the session key, not the anchor)
- every key except the never-expiring anchor
- one leaked key id taken from `api-key list --user-id`
- several ids via repeated `--id` on one delete
- only keys selected with `--expired`
- only keys selected with `--long-lived`
- other

10. If delete returns `api_error` 400 "missing valid credential", which fallbacks are allowed? That is the user's last permanent key.
- register a replacement key, then delete the old id
- root `user delete` of that non-root user, through managing-identities
- leave the last permanent key in place
- other

11. Is cutting off the whole user in scope for a later incident, knowing the revoker cannot do that and root must?
- yes
- no
- other

12. What may trigger a later revoke?
- a scoped task finished
- a suspected leak of an agent credential
- `whoami` or a sidecar still succeeding after a supposed delete
- expiry alone is enough and delete is exceptional
- other

13. After a session key is revoked, must provisioning-session-agent mint a new key before that agent runs again? The anchor stays, and the local key file is not the revoke.
- yes
- no
- other

14. Which results prove the key is dead?
- `deleteApiKeysResult.apiKeyIds` names the id
- `whoami` with the deleted key returns `unauthorized`
- the sidecar stops signing
- if `whoami` still works, `activity get` shows pending or a different key id
- on 403, `policy evaluations --activity-id` for that activity
- other

15. On `unauthorized` 403, which responses are forbidden?
- widening the condition to every user
- deleting with the root profile
- putting an `agent`, `broker`, or `provisioner` tag on the revoker
- deleting the local key file, or `profile delete`, and treating that as revocation
- other

16. Should the revoker host run `profile create --profile-name` with no `--api-key-file`, so only `data.publicKey` is handed to root, and must `--profile revoker whoami` show `REVOKER_USER_ID` before any `api-key delete`?
- yes
- no
- other

17. Should every unattended `tk` call set `--non-interactive` and `--message-format json`?
- yes
- no
- other

18. What may the handoff record, with no private key and no personal name?
- `REVOKER_USER_ID`, the revoker profile name, and where that HOME lives
- the policy id and the covered agent user ids
- each deleted key id when a delete happens
- that the test container is not the revoker credential store
- nothing, not even ids
- other

These answers name who revokes (a `revoker`-tagged user, not root, except a later user delete), which key ids `api-key delete` may cut, and the `whoami` proof that the deleted key is unauthorized. Lifetime, anchor discard, the renewal loop, and socket layout stay in the provisioning and sidecar files.

Answering these is sufficient for that skill.
