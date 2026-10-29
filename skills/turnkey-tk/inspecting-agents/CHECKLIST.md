# Checklist

Purpose: the live decision list for this skill. Decide every item before using the skill.
Change when: the skill, its CLI, or its docs change, or an item gets an `answered:` line.
Not for: the skill itself (`SKILL.md`), the questioning procedure (`skills/herdr/bootstrap.md`).

The official file is `SKILL.md`. This checklist is not part of that package.

## Questions

1. Is a read-only audit of Turnkey agents, keys, secrets, policies, or activities requested?
- Yes. Run read-only `list`, `get`, and `evaluations` commands and cite each command, page count, and field.
- No. Do not run an inspection pass.

2. Which credential runs the inspection queries?
- The `admin` profile on the operator machine.
- A dedicated read-only or non-root profile in the organization.
- The `TURNKEY_ORGANIZATION_ID`, `TURNKEY_API_PUBLIC_KEY`, and `TURNKEY_API_PRIVATE_KEY` environment bundle.

3. Which API-key inventory pass should run?
- All keys per tagged user via `api-key list --user-id`, plus organization-wide `--long-lived` and `--expiring-within 48h`.
- Only keys for the specific user IDs named in the request.
- Skip API-key listing and inspect only activities, policies, or secret metadata.
