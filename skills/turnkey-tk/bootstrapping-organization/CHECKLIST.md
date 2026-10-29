# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

The official file is `SKILL.md`. This checklist is not part of that package.

## Questions

1. Is the Turnkey organization already bootstrapped with the `admin` root profile and disjoint role tags?
- No. Run `bootstrapping-organization` now.
- Yes. `tk --profile admin whoami` already succeeds and the tags exist; skip bootstrap.
- Not used. Turnkey is not in scope.

2. How is the `admin` root credential created on the operator machine?
- Generate a fresh P-256 key with `tk profile create --profile-name admin` and register its public key in the dashboard.
- Use an existing P-256 key file outside the repository with `--api-key-file`.
- Already registered and verified with `tk --profile admin whoami`.

3. Which user carries the `human-approver` tag?
- The acting root user returned by `whoami`.
- A separate existing user in the organization, identified by user ID.
- None. Every policy in this organization is unilateral.
