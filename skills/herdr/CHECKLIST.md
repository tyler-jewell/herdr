# Checklist

Purpose: the live decision list for this skill. Decide every item before using the skill.
Change when: the skill, its CLI, or its docs change, or an item gets an `answered:` line.
Not for: the skill itself (`SKILL.md`), the questioning procedure (`skills/herdr/bootstrap.md`).

The official file is `SKILL.md`. This checklist is not part of that package.

## Questions

1. Is this agent inside a Herdr pane (`HERDR_ENV=1`)?
- Yes. Follow `SKILL.md`.
- No. Say so and stop. Do not control the focused session from outside.

2. Did the user ask for a new workspace, tab, or worktree?
- No. Use a sibling pane in the current tab.
- Yes. Create only the topology they named.

3. Which agent kind should start?
- The kind the user named.
- No kind was named. Run `herdr agent` and ask. Do not pick one.
