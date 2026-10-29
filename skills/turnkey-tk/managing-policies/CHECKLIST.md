# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

CLI: `tk 0.7.0` at `/tmp/tk-0.7.0/tk-aarch64-apple-darwin-v0.7.0/tk` (`tk` is not on PATH). Help checked: `policy` (`list`, `get`, `create`, `create-batch`, `update`, `delete`, `evaluations`) and `user get`. `policy create` is `--name`, `--effect allow|deny`, `--condition`, `--consensus`, `--notes`, or exactly one of `--input-json` / `--input-file`. Batch and update are JSON only. Update fields are `policyId`, `policyEffect`, `policyCondition`, `policyConsensus`, `policyNotes`. `policy delete` takes repeatable `--id`. `policy evaluations` takes `--activity-id`.

Docs: vendored `skills/turnkey-tk/managing-policies/SKILL.md`, `references/policy-language.md`, `references/policy-patterns.md`, `references/approval-models.md`; main copies at https://github.com/tkhq/tk/blob/main/skills/references/policy-language.md and `policy-patterns.md`. Those policy pages match tag v0.7.0 aside from package link depth. This skill does not install chain rules (`eth.tx`, `solana.tx`), approval-gated Git or SSH signing, mint targets chosen by tag, property checks on secret delete, or conditions on `secret export --context`.

Sibling intakes already force the organization, root profile, disjoint tags, the export column and minting row, mint target ids, session lifetime, the long-lived credential DENY, which signing resource exists, and the revoker delete-list shape. Do not re-decide those here. Ids are resolved at apply time with `user tag list` and `user get`; do not invent personal names, emails, or secret values.

Coverage: answers name effect, consensus form, condition language, and the resources this set may touch (secret export, raw-payload sign, create user, delete key, plus the other activity types in the language table), whether each grant is unilateral or approval, which containment DENYs are still missing, and how create, batch, update, delete, and a non-root allow/403 test are run. Together with the secret layout's property keys, that is any policy set this skill can express.

## Questions

1. Which effects may appear on policies this run writes? Every policy still needs an effect when it is created.
- allow
- deny
- both, each policy named with one effect
- other

2. Which consensus forms may be used (select all that apply), using tag ids or user ids and never tag names, emails, or aliases?
- allow-always: `approvers.any(user, user.tags.contains('TAG_ID'))`
- allow-once: that clause `&&` a second `approvers.any` on another tag
- one `approvers.any(user, user.id == 'USER_ID')` per principal
- `approvers.filter(user, user.tags.contains('TAG_ID')).count() >= N` (state N)
- omit consensus so the expression is true
- `credentials` fields (`id`, `user_id`, `type`, `public_key`)
- other

3. Must every allow-once consensus include a clause the submitter already satisfies, so the activity can sit pending instead of failing at submission? Answer yes, no, or other.
- yes
- no
- other

4. Which condition language may a policy use (select all that apply), staying inside `policy-language.md` and excluding chain namespaces?
- `activity.type ==` a full `ACTIVITY_TYPE_*` name
- `activity.resource` and `activity.action` (`CREATE`, `UPDATE`, `DELETE`, `EXPORT`, `IMPORT`, `SIGN`)
- `in` lists and `&&` / `||`
- `!` only around a parenthesized expression
- numeric `<`, `>`, `<=`, `>=`
- `any`, `all`, `contains`, `filter`, and `count`
- `secret.static_properties['KEY'] == 'value'` as strings, export activities only
- omit condition so the expression is true
- other

5. Which resources may this set grant or deny (select all that apply), including only types the written expressions may mention?
- secret export (`ACTIVITY_TYPE_EXPORT_SECRETS`)
- raw-payload sign (`ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2`)
- create API keys (`ACTIVITY_TYPE_CREATE_API_KEYS_V2`), including `session provision`
- delete API keys (`ACTIVITY_TYPE_DELETE_API_KEYS`)
- create users (`ACTIVITY_TYPE_CREATE_USERS_V4`)
- update or delete users
- secret import or secret delete
- policy create, update, or delete
- user-tag create, update, or delete
- none beyond policies sibling skills already required
- other

6. For secret export, which property predicates apply (select all that apply), using the bootstrap export column and extra keys named by the secrets intake?
- `secret.static_properties['consensus'] == 'unilateral'`
- `secret.static_properties['consensus'] == 'approval'`
- further static-property equalities whose keys and values secrets intake names
- no export policy in this run
- other

7. Is unilateral versus human approval taken only from the recorded export column and minting row, keeping the lifetime cap on a unilateral mint? Answer yes, no, or other.
- yes
- no
- other

8. For signing, how is the resource pinned (select all that apply), with one policy per resource type and the sibling choice of SSH, OpenPGP, broker, or none left as-is?
- `private_key.id ==` one id, and not a shared `broker` tag
- `wallet.id ==` one id, in a separate policy
- `private_key.tags`
- `wallet_account.address`
- no signing policy in this run
- other

9. For create-API-key and delete-key conditions, which parameter pins are required (select all that apply), given target tags are not policy-visible? State N in seconds when you pick a cap.
- `activity.params.user_id in ['...']` of non-root ids only
- ALLOW uses `api_keys.all(k, k.expiration_seconds <= N)`, which also rejects a missing expiry
- DENY uses `api_keys.any(k, k.expiration_seconds > N)`
- `activity.params.api_key_ids` on delete
- no create-key and no delete-key condition in this run
- other

10. Which containment DENYs are still missing after the session and long-lived identity answers (select all that apply)? A DENY overrides every ALLOW.
- agent tag on `activity.resource == 'CREDENTIAL'`
- provisioner tag on `activity.type != 'ACTIVITY_TYPE_CREATE_API_KEYS_V2'`
- one self-mint DENY per provisioner user id
- one outside-set DENY whose `user_id` list matches the ALLOW exactly
- broker tag on `CREDENTIAL`, with no export ALLOW and no `agent` ALLOW on its wallet
- none; those policies already match and must not be replaced
- other

11. May consensus name a root-quorum user as the only approver, knowing that vote also satisfies the root quorum and does not prove the policy? Answer yes, no, or other.
- yes
- no
- other

12. Will root store `condition` and `consensus` character for character, interpolating only `${UPPER_SNAKE}` ids, and test from a non-root credential with one allowed call and one 403? Answer yes, no, or other.
- yes
- no
- other

13. How is the set applied (select all that apply), skipping a name whose stored effect, condition, and consensus already match?
- `policy create` flags, including `--notes` when you supply notes
- `policy create-batch` from `{"policies":[...]}` using `policyName`, `effect`, `condition`, `consensus`, `notes`
- `policy update` JSON with `policyId` and only `policyEffect`, `policyCondition`, `policyConsensus`, `policyNotes`
- `policy delete` with repeatable `--id`
- canonical pattern names from policy-patterns
- other

14. Which denials must stay even if that blocks a requested activity? Select all that apply.
- do not delete a containment DENY to make an activity succeed
- do not allow `activity.action == 'SIGN'` without a resource id
- do not omit the condition on an agent or provisioner ALLOW
- do not mint with a create-API-key condition that lacks the target id list
- do not put `wallet.id` and `private_key.id` in one condition
- other

15. What does the handoff include? Select all that apply.
- each policy id, name, effect, condition, and consensus
- notes
- the allowed call and the 403 call, with profiles named
- `policy evaluations --activity-id` when a denial or pending vote has an activity id
- other

Answering these is sufficient for that skill.
