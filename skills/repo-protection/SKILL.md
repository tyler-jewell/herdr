---
name: repo-protection
description: >
  Keep a public git repository readable, cloneable, and forkable, while only
  an authenticated admin can change it, and only with a verified signature.
  Use when bootstrapping that lock or checking it still matches the committed
  policy. Not for adding a collaborator, and not for printing or storing a key.
---

> **Pre-requisites** and **Decisions** are this repo's. The rest is the published skill.

## Pre-requisites

| # | Check | Command | Pass |
|---|---|---|---|
| 1 | `gh` present | `command -v gh` | prints a path |
| 2 | Authenticated | `gh auth status` | logged in |
| 3 | Policy present | `test -f references/policy.json` | exit 0 |

## Decisions

| Decision | Field | Options | Default |
|---|---|---|---|
| Push access | `references/policy.json` ruleset | admin, collaborator, public | admin |
| Public read | repository visibility | public, private | public |
| Commit signature | `references/policy.json` signed-history | required, none | required |
| Force push | `references/policy.json` non_fast_forward | forbidden, default-branch-only | forbidden |
| `main` movement | `references/policy.json` pull_request rule | PR + status checks, direct | PR + status checks |
| Tags | `references/policy.json` immutable-tags | immutable, mutable | immutable |
| Machine signing | `git config` | SSH, none | SSH |
| Workflow token | `.github/workflows/*.yml` `permissions` | read, write | read |

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
