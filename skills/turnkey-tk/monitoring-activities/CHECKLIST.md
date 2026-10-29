# Checklist

Purpose: the live decision list for this skill. Decide every item before using the skill.
Change when: the skill, its CLI, or its docs change, or an item gets an `answered:` line.
Not for: the skill itself (`SKILL.md`), the questioning procedure (`skills/herdr/bootstrap.md`).

The official file is `SKILL.md`. This checklist is not part of that package.

## Questions

1. Is there a pending or uncertain Turnkey activity to inspect, approve, reject, or wait on?
- Yes. Resume by activity ID after verifying organization, activity type, and intent parameters.
- No. Every mutation is unilateral or already completed.

2. How does the human approver cast votes on `ACTIVITY_STATUS_CONSENSUS_NEEDED` activities?
- With `tk --profile approver activity approve --id` (or `reject --id`) after checking `activity get`.
- In the Turnkey dashboard or mobile app while the submitter waits or reruns.

3. How is the approved operation completed after consensus is reached?
- Rerun the exact `tk secret export`, `tk secret env`, or `tk session provision` command from the same credential and `HOME`.
- Run `tk activity wait --id` as the submitter profile for any other mutation type.
