---
name: revoking-agent-keys
description: Revoke a Turnkey agent's API key before it expires with tk through a non-root revoker user scoped to an explicit set of agent users. Use when you want to revoke a key after a scoped task is complete or when a credential may have leaked; not for routine key rotation or for deleting a whole user.
---

> **Pre-requisites** and **Decisions** are this repo's. The rest is the published skill.

## Pre-requisites

| # | Check | Command | Pass |
|---|---|---|---|
| 1 | `tk` present | `command -v tk` | prints a path |
| 2 | Workflow present | `test -f skills/turnkey-tk/revoking-agent-keys/SKILL.md` | exit 0 |

## Decisions

| Decision | Field | Options | Default |
|---|---|---|---|
| Q1: Should the revoker profile, `revoker` tag, and revoker user be created now, before any agent exists, with the delete ALLOW written only after `user get` returns real non-root user ids? | Turnkey `tk` policy | yes; no, create them at the first revoke; other | yes |
| Q2: Which recorded foundation profile name does the revoker use, and where does its HOME live? Do not re-decide the organization or the agent tag, and do not put this private key in the repo or on the test container's read-only root. | Turnkey `tk` policy | profile name `revoker`, the slug from managing-identities if that questionnaire selected a revoker; a different short role slug, stated under other; generated on a dedicated revoker host under `~/.config/turnkey/tk/api-keys/`; generated on an operator laptop in that same directory, outside git; `TURNKEY_API_PRIVATE_KEY` in a secret store outside git, with no profile file; not generated until the first revoke; stop, because the only HOME would be the test tmpfs or the read-only root; other | profile name `revoker`, the slug from managing-identities if that questionnaire selected a revoker |
| Q3: May root, using the profile name chosen in bootstrapping-organization, sign only the revoker tag, the revoker user, and the delete policy, and never the workload? | Turnkey `tk` policy | yes, and root is already that profile on a machine outside the repo; yes, but a second root-quorum member must `activity approve` before those creates finish; no, root is not available, so stop until it is; other | yes, and root is already that profile on a machine outside the repo |
| Q4: Will more than one non-root user share the `revoker` tag so any of them matches `approvers.any(user, user.tags.contains(REVOKER_TAG))`? | Turnkey `tk` policy | yes; no, exactly one revoker user; other | yes |
| Q5: Will the revoker user carry only the `revoker` tag, and never `agent`, `broker`, or `provisioner`? A credential DENY on those tags overrides this ALLOW. | Turnkey `tk` policy | yes; no; other | yes |
| Q6: Which users may later be quoted in the ALLOW `user_id` list? Resolve each with `user get` and show it before the policy is written. | Turnkey `tk` policy | session agents that keep an anchor key; long-lived non-root agent users; non-root provisioners; non-root brokers; no root-quorum user, ever; other | session agents that keep an anchor key |
| Q7: Use one policy named `revoker-delete-agent-keys` whose condition is `ACTIVITY_TYPE_DELETE_API_KEYS` and `activity.params.user_id in [...]`, instead of one policy per user? | Turnkey `tk` policy | yes; no, one policy per user, names stated under other; other | yes |
| Q8: When another agent user appears, may root extend that list only by `policy update` JSON (`policyCondition` rewritten, same policy id)? There is no flag form for the condition. | Turnkey `tk` policy | yes; no, create a new policy instead of updating; other | yes |
| Q9: Which keys may a later `api-key delete --user-id` remove? List first; nothing deletes by public key or by tag. | Turnkey `tk` policy | keys with non-null `expiresAt` (the session key, not the anchor); every key except the never-expiring anchor; one leaked key id taken from `api-key list --user-id`; several ids via repeated `--id` on one delete; only keys selected with `--expired`; only keys selected with `--long-lived`; other | keys with non-null `expiresAt` (the session key, not the anchor) |
| Q10: If delete returns `api_error` 400 "missing valid credential", which fallbacks are allowed? That is the user's last permanent key. | Turnkey `tk` policy | register a replacement key, then delete the old id; root `user delete` of that non-root user, through managing-identities; leave the last permanent key in place; other | register a replacement key, then delete the old id |
| Q11: Is cutting off the whole user in scope for a later incident, knowing the revoker cannot do that and root must? | Turnkey `tk` policy | yes; no; other | yes |
| Q12: What may trigger a later revoke? | Turnkey `tk` policy | a scoped task finished; a suspected leak of an agent credential; `whoami` or a sidecar still succeeding after a supposed delete; expiry alone is enough and delete is exceptional; other | a scoped task finished |
| Q13: After a session key is revoked, must provisioning-session-agent mint a new key before that agent runs again? The anchor stays, and the local key file is not the revoke. | Turnkey `tk` policy | yes; no; other | yes |
| Q14: Which results prove the key is dead? | Turnkey `tk` policy | `deleteApiKeysResult.apiKeyIds` names the id; `whoami` with the deleted key returns `unauthorized`; the sidecar stops signing; if `whoami` still works, `activity get` shows pending or a different key id; on 403, `policy evaluations --activity-id` for that activity; other | `deleteApiKeysResult.apiKeyIds` names the id |
| Q15: On `unauthorized` 403, which responses are forbidden? | Turnkey `tk` policy | widening the condition to every user; deleting with the root profile; putting an `agent`, `broker`, or `provisioner` tag on the revoker; deleting the local key file, or `profile delete`, and treating that as revocation; other | widening the condition to every user |
| Q16: Should the revoker host run `profile create --profile-name` with no `--api-key-file`, so only `data.publicKey` is handed to root, and must `--profile revoker whoami` show `REVOKER_USER_ID` before any `api-key delete`? | Turnkey `tk` policy | yes; no; other | yes |
| Q17: Should every unattended `tk` call set `--non-interactive` and `--message-format json`? | Turnkey `tk` policy | yes; no; other | yes |
| Q18: What may the handoff record, with no private key and no personal name? | Turnkey `tk` policy | `REVOKER_USER_ID`, the revoker profile name, and where that HOME lives; the policy id and the covered agent user ids; each deleted key id when a delete happens; that the test container is not the revoker credential store; nothing, not even ids; other | `REVOKER_USER_ID`, the revoker profile name, and where that HOME lives |

---


# Revoking agent keys

Expiry is the main control on an agent's key. Turnkey does not know when a
task ends, so nothing revokes a key on its own; `api-key delete` revokes it
at once. Revoke through a scoped revoker user, never with root: root signs
only to create the revoker and its policy.

## Reference

- [resources](../docs/resources.md): `user`, `user tag`, `api-key`, and `policy create` records and flags.
- [authentication](../docs/authentication.md): `profile create` and `whoami` records.
- [activities](../docs/activities.md): `activity get` and `policy evaluations` on a refused or pending delete.

## Rules

- Deleting a local key file revokes nothing. Only `api-key delete` does.
- Turnkey keeps one permanent credential per user. Deleting a user's last
  non-expiring key fails with `api_error` 400. A session agent keeps its
  anchor key, so deleting its session key succeeds. To cut a user off
  entirely, delete the user with
  [managing-identities](../managing-identities/SKILL.md).
- Policy sees `activity.params.user_id` and `activity.params.api_key_ids` on
  `ACTIVITY_TYPE_DELETE_API_KEYS`, not the target's tags. The revoker ALLOW
  lists every target user id; resolve each with `user get` before writing it.
  Never list a root-quorum user.
- The revoker carries only the `revoker` tag. Deleting a key is a
  `CREDENTIAL` activity, so the credential DENY on the `agent`, `broker`, or
  `provisioner` tag overrides the revoker ALLOW.
- A leaked revoker credential can delete keys on the listed users and do
  nothing else: no signing, minting, or export.

## Instructions

Inputs: the root profile (`admin`), `AGENT_USER_ID` for each agent user to
cover (one quoted entry each in the `in [...]` list), and the host that runs
the revoker.

1. **Create the revoker's profile and tag.** On the revoker host, generate
   its credential and send `data.publicKey` (`PUBLIC_KEY`) to root:

   <!-- example: revoking.profile-create -->
   ```sh
   tk --message-format json --organization-id ORG_UUID profile create --profile-name revoker
   ```

   Root creates the tag and sets `REVOKER_TAG` to
   `data.activity.result.createUserTagResult.userTagId`:

   <!-- example: revoking.tag-create -->
   ```sh
   tk --profile admin --message-format json user tag create --name revoker
   ```

2. **Create the revoker user.** Root.

   <!-- example: revoking.user-create -->
   ```sh
   tk --profile admin --message-format json user create --user-name revoker --tag-name revoker --public-key PUBLIC_KEY
   ```

   Set `REVOKER_USER_ID` to `data.activity.result.createUsersResult.userIds[0]`.

3. **Allow deletion on the listed agents.** Root. Show each id from
   `user get` first:

   <!-- example: revoking.policy -->
   ```sh
   tk --profile admin --message-format json user get --id AGENT_USER_ID
   tk --profile admin --message-format json policy create --name revoker-delete-agent-keys --effect allow \
     --consensus "approvers.any(user, user.tags.contains('${REVOKER_TAG}'))" \
     --condition "activity.type == 'ACTIVITY_TYPE_DELETE_API_KEYS' && activity.params.user_id in ['${AGENT_USER_ID}']"
   ```

   A new agent user is added to this list, as to the provisioner's mint
   ALLOW.

4. **Revoke.** Revoker host. List first and
   pick the key to cut off; on a session agent it is the key with a non-null
   `expiresAt`:

   <!-- example: revoking.delete -->
   ```sh
   tk --profile revoker --message-format json api-key list --user-id AGENT_USER_ID
   tk --profile revoker --message-format json api-key delete --user-id AGENT_USER_ID --id API_KEY_ID
   ```

   Proceed when `data.activity.result.deleteApiKeysResult.apiKeyIds` names
   `API_KEY_ID`. The deleted key now fails `whoami` with `unauthorized`; a
   sidecar holding it stops signing.

5. **Hand off.** Report `REVOKER_USER_ID`, the policy id, the covered agent
   user ids, and each deleted key id. A revoked session agent resumes only
   after a new key is provisioned. Stop.

## Verified by

| Examples | Test |
|---|---|
| revoking.profile-create, revoking.tag-create, revoking.user-create, revoking.policy, revoking.delete | api_keys::revoking_agent_keys_scoped_revoker_deletes_listed_session_key |
| revoking.policy, revoking.delete | api_keys::revoking_agent_keys_credential_deny_blocks_tagged_revoker |

## Troubleshooting

- `api-key delete` fails `unauthorized` 403: the target user is not in the
  ALLOW's list, or the revoker also carries a tag with the credential DENY.
  Check with `policy evaluations` when an activity id exists. Do not widen
  the condition to every user; do not fall back to root.
- `api-key delete` fails `api_error` 400 "missing valid credential": the key
  is the user's last permanent credential. Register a replacement first, or
  delete the user.
- `whoami` with the deleted key still succeeds: the delete is pending or ran
  against another key id. `activity get` the delete and compare ids.

## Related Skills

- [managing-identities](../managing-identities/SKILL.md): rotate a key
  without losing access, or delete the whole user.
- [provisioning-session-agent](../provisioning-session-agent/SKILL.md): mint
  the next session key after a revocation.
- [managing-policies](../managing-policies/SKILL.md): debug a denied
  revocation.
- [inspecting-agents](../inspecting-agents/SKILL.md): list which agents hold
  keys and when each expires.
