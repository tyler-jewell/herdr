---
name: bootstrap
description: >
  Decide open skill checklists from the machine and this Herdr setup, ask the
  ten questions that close the most remaining items, and repeat for
  /bootstrap --level 1, 2, or 3. Then implement only from the loaded skills
  and the URLs those skills already cite.
---

# Bootstrap

Purpose: the questioning procedure that decides every open `CHECKLIST.md` item with the human, then builds what the answers select.
Change when: the rounds, the question count, the scoring, or the implementation limit changes.
Not for: the decisions themselves (each skill's `CHECKLIST.md`), how to control Herdr (`skills/herdr/SKILL.md`).

Stand up a system from the skills in this repo. Decide first. Implement after the last round.

## Level

`/bootstrap --level 1|2|3` is how many questioning rounds to run. `1` is one round, `2` is two, `3` is three. No level means `1`. Stop when that many rounds have been asked. A later round happens only when the level allows it and an item is still open.

## Already decided

Do this before round 1, and again after each round's answers are written.

Read the machine, then this repo. On the machine, run only the commands and read only the files the checklists name, plus `AGENTS.md` for whether the machine is good. Do not set a test override. Do not print a secret. In this repo, read `CONTRIBUTING.md`, `README.md`, `AGENTS.md`, `config.toml`, `apply`, and `Containerfile`.

An item is already answered only when that evidence forces one of its choices, or the item itself names that choice as the current setup. Under the question, write `answered: ` and the choice text. Leave the other choices. An item that already has an `answered:` line stays closed. Anything else stays open. One forced choice, or it stays open.

Do this for every `skills/**/CHECKLIST.md`.

## One round

Score every open item. For one item, look at each of its choices and count how many other open items that choice would close, in every checklist. A choice closes another item when the other item's text leaves only one choice, or says that choice is impossible or already decided. The item's score is the smallest of those counts, then the largest as a tie-break. An answer should remove items no matter which remaining choice the user picks.

Ask the 10 open items with the highest scores. If fewer than 10 are open, ask those. Same score: the checklist path that sorts first, then the lower question number. Ask them together. Use the choices already written. Add none.

Write each reply as `answered: ` under that question. Then run Already decided again so the new answers close whatever they force.

That is one round.

## Implement

After the last round, build the system the answered items select.

Load a skill only when an answered item requires it. Read that `SKILL.md` from start to finish, then only the files that skill names.

Implement from those files alone. Open a URL only when one of those files contains it. A link on the fetched page is not a new source. Do not search the web. Do not use a command, flag, or path those files do not list.

If an open item blocks the next step, stop and name the item. A secret or a key stays on the `tk` path in `AGENTS.md`.
