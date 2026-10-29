# Write the skill

Use this when research found no official skill.

Put it at `skills/<name>/SKILL.md`. Match the shape of `skills/turnkey-tk`: frontmatter `name` and `description`, one short introduction, a table that routes the request to one reference, and a vocabulary table. The description states when to use the skill and one case that is not this skill.

Load a reference only when that step needs it. Point at the upstream URLs research recorded. Do not paste a spec, dataset, or README the URL already publishes. The value is the procedure: which URL to open, which decision is still open, and what to refuse.

Add `CHECKLIST.md` beside `SKILL.md`. It lists the decisions the skill cannot make alone, each with choices. Update it in the same change as the skill.

Keep the skill project-agnostic. No repository path, hostname, home path, account, or secret. It must make sense in a checkout that is not this one.

Herdr compatibility is the markdown skill itself. Do not require Herdr to be installed. Do not call `herdr` unless the subject is Herdr, and then point at the official `herdr` skill instead of restating its commands.
