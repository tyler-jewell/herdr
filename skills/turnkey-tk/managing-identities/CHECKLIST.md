# Checklist

Purpose: the live decision list for this skill. Decide every item before using the skill.
Change when: the skill, its CLI, or its docs change, or an item gets an `answered:` line.
Not for: the skill itself (`SKILL.md`), the questioning procedure (`skills/herdr/bootstrap.md`).

The official file is `SKILL.md`. This checklist is not part of that package.

## Questions

1. Which identity lifecycle operation is needed?
- Create a non-root user, attach its role tag, and register the public key generated on its host.
- Rotate an existing user's API key by generating a replacement on its host, registering it, verifying `whoami`, and deleting the old key.
- Revoke a compromised or retired non-root user or API key.
- None. Existing users and profiles already match the system.

2. Where is the user's private key generated and stored?
- On the target host under `$HOME/.config/turnkey` via `tk profile create` or `tk api-key generate`, never in git.
- In a CI secret store for the `TURNKEY_*` environment bundle, with no profile file on disk.
- Not applicable because this run only revokes an existing key or user.

3. How is a retired or compromised non-root identity cut off?
- Delete only the affected API key IDs with `tk api-key delete` after replacement or via `revoking-agent-keys`.
- Delete the entire non-root user with `tk user delete` after confirming `user get` shows a non-root user.
- Not applicable because no revocation is requested.
