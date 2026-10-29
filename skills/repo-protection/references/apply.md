# Apply the lock

`references/policy.json` is the source of truth. Read the GitHub ruleset documentation at <https://github.com/github/docs/blob/82fb420ff85c1b3e66035c4f902bac339de3dd2d/content/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets.md> before changing a rule. Do not follow links from that page.

Use `gh api` against the repository the authenticated user administers. Refuse any repository the user does not administer, and never touch a fork's upstream.

## Rulesets

List current rulesets with `GET /repos/{owner}/{repo}/rulesets` and match by `name`.

For each ruleset in `references/policy.json`, replace `bypass` with `bypass_actors`:

- `"none"` becomes `[]` (`signed-history` and `immutable-tags` allow no bypass, even for the admin).
- `"authenticated-user"` becomes `[{ "actor_id": <id from gh api user --jq .id>, "actor_type": "User", "bypass_mode": "always" }]` (`only-owner-pushes`, `main`, and `only-owner-creates-tags`).

Never commit the numeric `actor_id` into the repository. Create missing rulesets with `POST /repos/{owner}/{repo}/rulesets` and update existing ones with `PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}`. Report any extra host ruleset and leave it in place.

## Repository and Actions settings

- `PATCH /repos/{owner}/{repo}` with `repository`. Do not send `allow_forking`. A public personal repository rejects that field, and forking stays enabled.
- `PUT /repos/{owner}/{repo}/actions/permissions` with `actions` (real booleans).
- `PUT /repos/{owner}/{repo}/actions/permissions/workflow` with `workflow_permissions`.
- Leave secret scanning and push protection enabled when already active on the host.

## Refuse

Never add a collaborator, invitation, deploy key, Actions secret, environment, or `pull_request` workflow trigger (which would let a fork run code on a self-hosted runner). Never delete `main` or weaken `signed-history` or `immutable-tags`.

## Prove

On a throwaway probe branch, verify three pushes:

1. A signed fast-forward push succeeds (`only-owner-pushes` and `main` allow `authenticated-user` bypass, while `signed-history` still enforces verified signatures and fast-forward updates).
2. An unsigned commit is rejected with `Commits must have verified signatures.`
3. A force-push is rejected with `Cannot force-push to this branch`.

Delete the probe branch when done.
