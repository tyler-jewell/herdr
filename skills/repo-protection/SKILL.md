---
name: repo-protection
description: >
  Keep a public git repository readable, cloneable, and forkable, while only
  an authenticated admin can change it, and only with a verified signature.
  Use when bootstrapping that lock or checking it still matches the committed
  policy. Not for adding a collaborator, and not for printing or storing a key.
---

# Repository lock

The public can read, clone, and fork. Only the authenticated admin can push or merge, and every commit on every branch must have a verified signature with no force-pushes and immutable tags. `references/policy.json` is the source of truth.

Read [policy.json](references/policy.json) once, then load only the reference matching the task:

| Task | Reference |
|---|---|
| Apply or verify repository rulesets and settings | [apply.md](references/apply.md) |
| Configure or verify commit signing on this machine | [sign.md](references/sign.md) |
| Add a collaborator, deploy key, Actions secret, or `pull_request` trigger | Stop. The policy forbids it. |

## Vocabulary

| Term | Meaning |
|---|---|
| policy | `references/policy.json`, the committed lock |
| authenticated admin | the account `gh api user` returns (`authenticated-user` bypass actor) |
| verified signature | GitHub reports `verified: true` and `reason: valid` |
| probe | a throwaway branch used to verify push enforcement, then deleted |
