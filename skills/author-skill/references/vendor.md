# Vendor an official skill

`npx skills` only fetches. Copy the published files into `skills/<name>/` by hand and commit them. Do not edit `SKILL.md` or the other files the publisher wrote.

Add a `SOURCE` file beside the skill with the URL, the revision, and the license the publisher stated. The Pre-requisites and Decisions tables in `SKILL.md` are this repo's additions, not part of the upstream package. Set our tables and any other file this repo added in that directory aside before a later fetch, then put them back.

`evals.ts` must check that the official `SKILL.md` is present and that it still contains the publisher's name. Do not rewrite the publisher's body to point at our tables.

## Staying current

The committed pin is the skill agents run. Upstream moving does not change a machine. `./apply` does not refresh skills. `evals.ts` checks the pin and a sentence from the publisher. It does not fetch upstream.

A newer revision is a normal change. Fetch that revision, replace only the publisher's files, restore our Pre-requisites and Decisions tables, and re-decide any row the diff affects. Then run `./evals.ts`. Do not commit a floating branch name.

A plugin this repo only names, and does not vendor, is not installed by the harness. When the repo starts using it, vendor the skill the same way. Do not point agents at a copy that lives on one computer.

A scheduled check that opens a pull request when a pin moves is not part of this repo. Add it only when a person asks. The pull request still follows this file.
