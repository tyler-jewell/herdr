# Checklist

Purpose: the live decision list for this skill. Decide every item before using the skill.
Change when: the skill, its CLI, or its docs change, or an item gets an `answered:` line.
Not for: the skill itself (`SKILL.md`), the questioning procedure (`skills/herdr/bootstrap.md`).

## Questions

1. Does the subject's own org publish a skill or plugin for it?
- Yes. Vendor that package. Do not write a second one.
- No. Write one from the URLs that org names.

2. Is the subject "control Herdr panes"?
- Yes. Use the official `herdr` skill. Do not author another.
- No. The new skill must not call `herdr`.

3. Where does the committed copy live?
- `skills/<name>/` in the checkout, with `CHECKLIST.md` beside `SKILL.md`.
- Only on one computer. That does not count. Commit it.
