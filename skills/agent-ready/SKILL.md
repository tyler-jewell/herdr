---
name: agent-ready
description: >
  Write the one public TypeScript entry an agent can run. Use when adding a
  script, installer, or public command. Not for controlling Herdr panes, and
  not a substitute for an official skill the subject publishes.
---

> **Pre-requisites** and **Decisions** are this repo's. The rest is the published skill.

## Pre-requisites

| # | Check | Command | Pass |
|---|---|---|---|
| 1 | Deno installed | `deno --version` | prints a version |
| 2 | Inside a checkout | `git rev-parse --show-toplevel` | prints a path |

## Decisions

| Decision | Field | Options | Default |
|---|---|---|---|
| Entry language | file extension | `.ts`, `.sh`, `.py` | `.ts` |
| After the basics | handoff prompt | explicit prompt, log line, nothing | explicit prompt |
| Official skill | source | vendor official, ours | vendor if it exists |

---


# Agent-ready entry

An agent needs one command it can run. That command is one TypeScript file. There is no official AgentReady skill. The standard is the site and the spec it names.

Read [entry.md](references/entry.md) once before adding or changing that file.

## Which step

| Request sounds like | Load |
|---|---|
| Add a script, installer, or public command | [entry.md](references/entry.md) |
| The subject publishes an official skill or plugin | Stop. Vendor that package. Do not rewrite it. |

## References

| Reference | Read when |
|---|---|
| [entry.md](references/entry.md) | always, once |

## Vocabulary

| Term | Meaning |
|---|---|
| entry | the one TypeScript file a stranger runs |
| handoff | the explicit prompt the entry gives an agent after the basics load |
| official | published by the subject's own site or the GitHub org that site names |
