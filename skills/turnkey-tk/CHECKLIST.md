# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

The official file is `SKILL.md`. This checklist is not part of that package.

## Questions

1. Is Turnkey (`tk`) in scope for this system?
- Yes. Follow `SKILL.md` and the selected child workflows.
- No. Stop and do not run `tk` commands.

2. Which agent credential route does this system use?
- Expiring session keys minted by a separate provisioner (`provisioning-session-agent`).
- One never-expiring key generated on the agent host (`provisioning-agent-identity`).
- None. Only organization administration or read-only inspection is in scope.

3. Which approval model governs secret exports and session key minting?
- Unilateral export and unilateral minting.
- Human approval for export and unilateral minting.
- Unilateral export and human approval for minting.
- Human approval for both export and minting.

4. Who holds signing authority for SSH or Git commits?
- A separate signing broker principal (`deploying-signing-broker` or `using-ssh` as `broker`).
- The agent principal directly (`using-ssh` or `signing-git-commits` as `agent`).
- No SSH or Git signing is in scope.
