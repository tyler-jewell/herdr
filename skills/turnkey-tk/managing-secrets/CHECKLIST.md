# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

The official file is `SKILL.md`. This checklist is not part of that package.

## Questions

1. Are Turnkey Secrets used to store or inject secrets for this workload?
- Yes. Import, export, or inject secrets via `tk secret` with static `consensus` properties.
- No. No secrets are stored or exported in this workflow.

2. How are secret values delivered to the consuming process without entering transcripts or git?
- Injected at process startup with `tk secret env --name-prefix service/ --property consensus=unilateral`.
- Written on demand to a mode-`0600` file outside the repository with `tk secret export --out`.
- Imported only in this run from `--from-file` or stdin outside the repository; no export runs now.

3. Do multiple agents require isolated secret scopes within the organization?
- No. One shared `agent` tag and `service/` prefix cover the workload.
- Yes. Bind an immutable `scope` property at import and scope each agent tag's export policy to its own `scope` value.
