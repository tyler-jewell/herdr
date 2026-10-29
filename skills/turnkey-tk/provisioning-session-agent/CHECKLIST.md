# Checklist

Purpose: the live decision list for this skill. Decide every item before using the skill.
Change when: the skill, its CLI, or its docs change, or an item gets an `answered:` line.
Not for: the skill itself (`SKILL.md`), the questioning procedure (`skills/herdr/bootstrap.md`).

The official file is `SKILL.md`. This checklist is not part of that package.

## Questions

1. Which session-credential operation is in scope?
- First provisioning: create the session agent (with discarded `--anchor-key`), the `provisioner` user, the three provisioner policies, and run one renewal.
- Renewal or recovery only: run `session status`, `session request`, `session provision`, and `session activate` without recreating users or policies.
- Not used. The agent uses a long-lived key (`provisioning-agent-identity`) or no agent credential is needed.

2. What session lifetime and warning window govern renewal?
- Default `7d` lifetime (`--expires-in 7d`) and `48h` warning window (`--warn-before 48h`), within the policy's `expiration_seconds` cap.
- Short-lived `24h` lifetime (`--expires-in 24h`) and `6h` warning window (`--warn-before 6h`), within the policy's `expiration_seconds` cap.

3. Does `session provision` complete unilaterally or require human approval?
- Unilaterally under the `provisioner` profile within the policy lifetime cap.
- With human approval from a `human-approver` user before `session provision` is rerun and `session activate` switches the key.
