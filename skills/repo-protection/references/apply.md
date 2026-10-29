# Apply the lock

The policy file is the source. The host is a copy. Read the ruleset docs at <https://github.com/github/docs/blob/82fb420ff85c1b3e66035c4f902bac339de3dd2d/content/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets.md> before changing a rule. Do not follow a link from that page to a new source.

Use `gh api` against the repository the person administers. Refuse a repository the person does not administer. Leave a fork's upstream alone.

## Rulesets

`GET /repos/{owner}/{repo}/rulesets` lists what the host has. Match on `name`.

Build each body from the policy object. Remove `bypass`. Set `bypass_actors` from it:

- `none` is `[]`.
- `authenticated-user` is one actor: `actor_id` from `gh api user --jq .id`, `actor_type` `User`, `bypass_mode` `always`.

Do not write that id into the repository. A missing name is `POST /repos/{owner}/{repo}/rulesets`. An existing name is `PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}` with the same body. A host ruleset whose name is not in the policy is reported and left in place.

## Repository settings

`PATCH /repos/{owner}/{repo}` with the `repository` object. Do not send `allow_forking`. A public personal repository rejects that field, and forking stays available.

`PUT /repos/{owner}/{repo}/actions/permissions` with the `actions` object. Send real booleans.

`PUT /repos/{owner}/{repo}/actions/permissions/workflow` with the `workflow_permissions` object.

Do not turn off secret scanning or push protection when the host already has them on.

## Refuse

Do not add a collaborator, invitation, deploy key, Actions secret, or environment. Do not add a `pull_request` workflow trigger. A fork pull request would run on a self-hosted runner. Do not delete the default branch. Do not disable the ruleset to make a push succeed.

## Prove

On a new branch, three pushes:

- A signed fast-forward is accepted. The host may say the update rule was bypassed. That bypass is the admin's, and it does not bypass `signed-history`.
- An unsigned commit is rejected with `Commits must have verified signatures.`
- A rewritten tip is rejected with `Cannot force-push to this branch`.

Delete that branch. The admin bypasses deletion of a non-default branch. `DELETE /repos/{owner}/{repo}/git/refs/heads/<default>` stays rejected.
