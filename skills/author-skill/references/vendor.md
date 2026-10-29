# Vendor an official skill

`npx skills` only fetches. Copy the published files into `skills/<name>/` by hand and commit them. Do not edit `SKILL.md` or the other files the publisher wrote.

Add a `SOURCE` file beside the skill with the URL, the revision, and the license the publisher stated. `CHECKLIST.md` is this repo's decision list, not part of the upstream package. Set `CHECKLIST.md` and any other file this repo added in that directory aside before a later fetch, then put them back.

`test.sh` must check that the official `SKILL.md` is present and that it still contains the publisher's name. Do not rewrite the skill to point at the checklist.
