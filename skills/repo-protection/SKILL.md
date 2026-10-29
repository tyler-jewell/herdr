---
name: repo-protection
description: >
  Keep a public git repository readable, cloneable, and forkable, while only
  an authenticated admin can change it, and only with a verified signature.
  Use when bootstrapping that lock or checking it still matches the committed
  policy. Not for adding a collaborator, and not for printing or storing a key.
---

# Repository lock

Strangers can read, clone, and fork. A change lands only from the authenticated admin, and only as a verified signature. The committed policy is the lock. A setting that exists only on the host is not the lock.

Read [policy.json](references/policy.json) once. Then load only the row this request matches.

## Which step

| Request sounds like | Load |
|---|---|
| Put the lock on the repository, or make the live rules match the file | [apply.md](references/apply.md) |
| Sign commits on this machine | [sign.md](references/sign.md) |
| Someone wants write access, a deploy key, an Actions secret, or a fork workflow on a self-hosted runner | Stop. The policy does not allow it. |

## References

| Reference | Read when |
|---|---|
| [policy.json](references/policy.json) | always, once |
| [apply.md](references/apply.md) | changing or checking the host rules |
| [sign.md](references/sign.md) | this machine's commits |

## Vocabulary

| Term | Meaning |
|---|---|
| policy | `references/policy.json`, the lock to apply |
| authenticated admin | the account `gh api user` returns. The only bypass actor |
| verified signature | the host reports `verified: true` and `reason: valid` |
| probe | a throwaway branch used to prove a push is accepted or rejected, then deleted |
