---
name: bootstrap
description: >
  Decide the open Pre-requisites and Decisions tables in every skill from the machine and
  this Herdr setup, ask the ten questions that close the most remaining decisions, and repeat
  for /bootstrap --level 1, 2, or 3. Then implement only from the loaded skills and the URLs
  those skills already cite.
---

# Bootstrap

Purpose: the questioning procedure that resolves every open Decisions table with the human, then builds what the answers select.
Change when: the rounds, the question count, the scoring, or the implementation limit changes.
Not for: the decisions themselves (each skill's Decisions table), how to control Herdr (`skills/herdr/SKILL.md`).

Stand up a system from the skills in this repo. Decide first. Implement after the last round.

## Level

`/bootstrap --level 1|2|3` is how many questioning rounds to run. `1` is one round, `2` is two, `3` is three. No level means `1`. Stop when that many rounds have been asked. A later round happens only when the level allows it and a decision is still open.

## Already decided

Do this before round 1, and again after each round's answers are written.

Read the machine, then this repo. Run the pre-requisites table of each skill the task needs, then read the files its Decisions table names. Add `AGENTS.md` for whether the machine is good. Do not set a test override. Do not print a secret. In this repo, read `CONTRIBUTING.md`, `README.md`, `AGENTS.md`, `config.toml`, `apply`, and `Containerfile`.

A decision is already made only when that evidence forces one of its options, or the field already holds that value. Write the chosen option under the decision. A decision already recorded stays closed. Anything else stays open. One forced option, or it stays open.

Do this for every `skills/**/SKILL.md` Decisions table.

## One round

Score every open decision. For one decision, look at each of its options and count how many other open decisions that option would close, in every skill. An option closes another decision when that decision's text leaves only one option, or says that option is impossible or already decided. The decision's score is the smallest of those counts, then the largest as a tie-break. An answer should remove decisions no matter which remaining option the user picks.

Ask the 10 open decisions with the highest scores. If fewer than 10 are open, ask those. Same score: the skill path that sorts first, then the higher row in the table. Ask them together. Use the options already written. Add none.

Write each reply against that decision. Then run Already decided again so the new answers close whatever they force.

That is one round.

## Implement

After the last round, build the system the chosen options select.

Load a skill only when a chosen decision requires it. Read that `SKILL.md` from start to finish, then only the files that skill names. Set the exact field each decided row names: a `config.toml` key, a policy field, a flag, or an argument. Do not write a field the table does not name.

Implement from those files alone. Open a URL only when one of those files contains it. A link on the fetched page is not a new source. Do not search the web. Do not use a command, flag, or path those files do not list.

After the build, prove the install: run the pre-requisites table again, run `./apply` twice (`changed` is `false` and `backup_path` is `null` on the second run), and run `skills/run-evals/run-evals.sh --parallel 1` so a local model scores one eval.

If an open decision blocks the next step, stop and name it. A secret or a key stays on the `tk` path in `AGENTS.md`.
