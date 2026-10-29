# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

CLI: `tk 0.7.0` (`/tmp/tk-bin/tk --version`; nothing named `tk` was on `PATH`). Help checked: `profile` (`create`, `set`, `delete`, `use`), `login`, `whoami`, `auth`, `user`, `user tag`, and `activity`. Latest release is still `v0.7.0`. On this binary, `profile create --api-key-file` stores that path in place, the file `curve` must be `p256`, and `data.nextStep` always says to register the public key and then log in. Unreleased `main` copies the file under `~/.config/turnkey/tk/api-keys/`, also accepts `API_KEY_CURVE_P256`, and says only `login` when the file already existed.

Docs:

- Vendored skill: `skills/turnkey-tk/bootstrapping-organization/SKILL.md`
- Vendored docs: `skills/turnkey-tk/docs/authentication.md`, `skills/turnkey-tk/docs/resources.md`, `skills/turnkey-tk/references/cli-convention.md`, `skills/turnkey-tk/references/approval-models.md`
- Main skill and authentication: https://github.com/tkhq/tk/blob/main/skills/bootstrapping-organization/SKILL.md and https://github.com/tkhq/tk/blob/main/docs/authentication.md
- Release: https://github.com/tkhq/tk/releases/tag/v0.7.0
- Dashboard, organization creation only: https://app.turnkey.com

Coverage: Answering this file closes organization creation, the root-quorum size, dashboard registration of the root public key, the root profile name and API base URL, the three disjoint tags, one tagged human approver, and the export-and-minting cell. It does not create non-root users, policies, secrets, or signing keys. `revoker` and `broker` tags are left to later skills.

## Questions

1. Does a Turnkey organization already exist for this bootstrap?

- no; create one in the dashboard first
- yes, and it has no users beyond the root quorum
- yes, and it already has users or tags
- other

2. What root quorum will the dashboard use before any `tk` mutation?

- 1 of 1
- 2 of 2
- 2 of 3
- 3 of 5
- another threshold you will state as numbers only
- other

3. Will the API key registered for this profile belong to a root user whose single vote meets that quorum?

- yes
- no; other root users must approve first
- no; this user is not in the root quorum
- other

4. Which API base URL should the root profile store?

- `https://api.turnkey.com`
- a non-default URL you will supply outside the repo
- not decided; stop before `profile create`
- other

5. How should the root credential be created? The private key stays on the operator machine and is never printed.

- `profile create` generates a P-256 key and writes it under `$HOME/.config/turnkey/tk/api-keys/`
- an existing file outside the repo whose `curve` is `p256`, which this binary uses in place
- stop; the only file uses `API_KEY_CURVE_P256`, which `tk` 0.7.0 rejects
- other

6. Where is that root public key registered? This skill does not register the root user with `user create`.

- in the dashboard, by pasting `data.publicKey` onto the root user and not letting the browser generate a different key
- already on that root user, so the next command is `login`
- not registered, and the dashboard is unavailable; stop
- other

7. What profile name should be saved? `login` with no `--profile-name` selects `default`, not `admin`.

- `admin`
- `default`
- another short role slug you will give
- other

8. Which existing dashboard user receives the public key?

- the sole root user
- a root user identified by user id only
- not chosen yet; stop
- other

9. Where may that root profile live?

- this operator machine only, under `$HOME/.config/turnkey`, never in git
- this machine plus one other operator host, each with its own file
- nowhere a CI job or an agent can read
- other

10. Is a `TURNKEY_*` bundle set in the shell that will run `tk`?

- no
- yes, the full organization, public key, and private key bundle
- yes, a partial bundle that must be unset before `login`
- other

11. How will the operator obtain the `tk` 0.7.0 binary?

- the official install script, which installs the current latest release
- a 0.7.0 binary already present, and do not run `tk update`
- other

12. Who is the one human approver tagged in this run?

- the same root user `whoami` returns
- a different existing user, given by user id only
- no such user yet; stop and do not invent one
- nobody, because every later grant is unilateral
- other

13. How will that approver vote on later activities? Select all that apply.

- `tk activity approve`
- the dashboard console
- the mobile app
- not applicable
- other

14. May `user update` replace that approver's tag list with only `human-approver`? `userTagIds` replaces the whole set.

- yes; they have no tags to keep
- no; they already have other tags, so stop
- they have no user id yet
- other

15. What should happen for the tag names `agent`, `provisioner`, and `human-approver`?

- create all three empty tags
- reuse each name that `user tag list` already shows and record its id
- stop if any of the three names already exists
- other

16. Confirm the disjoint-tag rule for this organization.

- nobody holds more than one of the three
- the only exception is a root user who holds `human-approver` and neither of the other two
- some user must hold two, so do not bootstrap
- other

17. Which export column should be recorded before any policy is written?

- every export needs a human
- every export is unilateral
- both, selected later per secret
- no secrets, so the export column is unused
- other

18. Which minting row should be recorded?

- minting needs a human
- minting is unilateral, with the lifetime cap pinned later
- no minting row, because every agent is long-lived
- not decided; stop before handoff
- other

19. Which first-agent route should later workflows assume? This bootstrap creates no agent.

- one long-lived key
- expiring session keys minted by a provisioner
- both routes
- do not decide a route yet
- other

20. Is one shared `agent` tag enough for the first isolation boundary?

- yes, for one agent
- yes, several agents may share it
- no; each boundary needs its own tag, created later
- other

21. Will a non-root user be available later to test consensus? A root approver also satisfies the root quorum.

- yes, a separate non-root approver will exist
- no, only the root user will approve
- add that non-root user before any policy
- other

22. If tag create or `user update` returns `pending`, what does that mean here?

- the root quorum is not yet met; wait for the other root votes, and do not resubmit
- a policy already gates the mutation; hand off to monitoring-activities
- unexpected; stop
- other

23. Where should the handoff be kept? It is the organization id, root profile name, root user id, three tag ids, approver user id, quorum, API base URL, and approval cell.

- operator notes outside the repo
- this chat only
- do not store it
- other

Answering these is sufficient for that skill's configuration space.
