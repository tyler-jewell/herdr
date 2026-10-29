# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

The official file is `SKILL.md`. This checklist is not part of that package.

## Questions

1. Is a separate OpenPGP signing broker in scope?
- Yes. Deploy the application, `broker`, and `provisioner` in separate isolation boundaries.
- No. The agent signs directly or no OpenPGP signing is used.

2. Which boundary separation model hosts the application, broker, and provisioner?
- Separate OS users on one host with distinct `HOME` directories.
- Separate containers, VMs, or sandboxes sharing only the read-only broker runtime directory.
- Not used. No signing broker is deployed.

3. Which Unix socket mode exposes `tk gpg agent serve` to the application?
- Mode `0660` with a shared supplemental group on the runtime directory.
- Mode `0600` with a shared numeric UID and separate `HOME` and filesystem mounts.
- Not used. No signing broker is deployed.
