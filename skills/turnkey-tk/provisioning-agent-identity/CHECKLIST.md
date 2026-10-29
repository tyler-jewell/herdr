# Checklist

Purpose: the live decision list for this skill. Decide every item before using the skill.
Change when: the skill, its CLI, or its docs change, or an item gets an `answered:` line.
Not for: the skill itself (`SKILL.md`), the questioning procedure (`skills/herdr/bootstrap.md`).

The official file is `SKILL.md`. This checklist is not part of that package.

## Questions

1. Should this agent be provisioned with a single never-expiring API key?
- Yes. Generate the key on the agent host, register its public half on a user tagged `agent`, and apply `agents-no-credentials`.
- No. The agent uses expiring session keys (`provisioning-session-agent`) or no agent credential is needed.

2. Does the `agents-no-credentials` DENY policy already exist on the `agent` tag?
- Yes. Verify with `tk policy get` that it denies `activity.resource == 'CREDENTIAL'` for `AGENT_TAG`.
- No. Create `agents-no-credentials` as `admin` before handing off the agent profile.

3. How is the provisioned agent credential verified on the agent host?
- Run `tk --profile agent whoami`, confirm `api-key register` returns HTTP 403 (`unauthorized`), and confirm `api-key list` shows one permanent key.
- Stop if the agent host cannot run `whoami` or self-registration is not denied.
