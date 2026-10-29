---
name: author-skill
description: >
  Write or vendor a project-agnostic skill from a public subject. Use when
  the user says "develop a skill centered around" a site, spec, or tool,
  including agentready.org. Do not use it to control Herdr panes.
---

> **Pre-requisites** and **Decisions** are this repo's. The rest is the published skill.

## Pre-requisites

| # | Check | Command | Pass |
|---|---|---|---|
| 1 | Inside a checkout | `git rev-parse --show-toplevel` | prints a path |
| 2 | Skills directory | `test -d skills` | exit 0 |

## Decisions

| Decision | Field | Options | Default |
|---|---|---|---|
| Source of truth | upstream package | vendor official, write from cited URLs | vendor if it exists |
| Herdr control | skill to call | official `herdr`, none | official `herdr` |
| Destination | `skills/<name>/` | any path | `skills/<name>/` |

---


# Author a skill

A skill produced here stands on its own. It names no repository, hostname, or person. It stays valid inside a Herdr pane and outside one.

Read [research.md](references/research.md) once. Then load only the row this request matches.

## Which step

| Request sounds like | Load |
|---|---|
| The subject publishes an official skill or plugin | [vendor.md](references/vendor.md) |
| "develop a skill centered around X", and no official skill exists | [write.md](references/write.md) |
| A URL this skill already cites has changed | [write.md](references/write.md) |

## Herdr

Controlling panes, tabs, or agents is the official `herdr` skill (`skills/herdr/SKILL.md` in a checkout that vendors it, or `npx skills add herdrdev/herdr --skill herdr`). Do not copy that skill. A new skill calls `herdr` only when its subject is Herdr itself, and then it points at that official skill and its `HERDR_ENV=1` check.

## References

| Reference | Read when |
|---|---|
| [research.md](references/research.md) | always, once |
| [vendor.md](references/vendor.md) | an official package exists |
| [write.md](references/write.md) | this repo must write the skill |

## Vocabulary

| Term | Meaning |
|---|---|
| official | published by the subject's own site or the GitHub org that site names |
| third-party | a similar name from any other org; not a substitute for official |
| value-add | the procedure: what to open, what to decide, what to refuse. Not a copy of the upstream text |
