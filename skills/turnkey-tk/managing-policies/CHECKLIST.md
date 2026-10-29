# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

The official file is `SKILL.md`. This checklist is not part of that package.

## Questions

1. Which policy operation is in scope?
- Create or update the policy set for the selected agent route, secret exports, signing keys, or revoker.
- Inspect a denied or pending activity with `tk policy evaluations --activity-id` without changing policies.
- None. All required policies already exist and match character for character.

2. How should new policies be applied by `admin`?
- Individually with `tk policy create`, skipping any policy whose stored effect, condition, and consensus already match.
- In one batch with `tk policy create-batch --input-file` from a JSON policy list outside the repository.
- Update an existing policy ID in place with `tk policy update --input-json`.

3. How is the policy change verified before handoff?
- Run one allowed operation and one operation that must return HTTP 403 (`unauthorized`) using the non-root profile.
- Read `tk policy get` and `tk policy evaluations` only, because no non-root runtime credential exists yet.
