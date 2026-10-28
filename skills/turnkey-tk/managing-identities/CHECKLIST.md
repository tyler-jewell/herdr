# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

CLI: `tk 0.7.0` (`/tmp/tk-bin/tk --version`). Help checked for `profile`, `login`, `whoami`, `auth`, `user`, `user tag`, `api-key`, and `activity`. Latest release tag is `v0.7.0`. Flag-form `user create` names keys `{userName}-key` and `{userName}-anchor`, always sends no phone, and leaves authenticators and `oauthProviders` empty. `api-key register`, `user update`, and `user tag update` take only `--input-json` or `--input-file`.

Docs:

- Vendored skill: `skills/turnkey-tk/managing-identities/SKILL.md`
- Vendored docs: `skills/turnkey-tk/docs/resources.md`, `skills/turnkey-tk/docs/authentication.md`, `skills/turnkey-tk/docs/commands.md`, `skills/turnkey-tk/references/cli-convention.md`
- Main skill and authentication: https://github.com/tkhq/tk/blob/main/skills/managing-identities/SKILL.md and https://github.com/tkhq/tk/blob/main/docs/authentication.md
- Release: https://github.com/tkhq/tk/releases/tag/v0.7.0

Coverage: Answering this file closes the non-root identity set these skills can name: tags (`agent`, `provisioner`, `human-approver`, `revoker`, `broker`, and extra scope tags), users, tag attachment, P-256 API keys, profile names, where those profiles live, key rotation, and user or key revocation. On this binary a local credential file outlives `profile delete`. Unreleased `main` may delete the stored copy; session renewal, policy text, and signing stay in their own skills.

## Questions

1. Where does the acting root credential come from?

- an existing local profile named `admin`
- another existing profile whose name is a role slug
- the full `TURNKEY_ORGANIZATION_ID`, `TURNKEY_API_PUBLIC_KEY`, and `TURNKEY_API_PRIVATE_KEY` bundle, with no profile
- the root profile is not on this machine yet; stop and bootstrap
- other

2. Which organization should each new profile store?

- the organization already saved on the admin profile
- one organization id you will supply, stored with `profile create` or `profile set`
- that id only as a per-command `--organization-id` override
- a different organization id per profile, listed by role slug
- other

3. Which API base URL should those profiles store?

- `https://api.turnkey.com`
- a non-default URL you will supply outside the repo
- the URL already saved on the admin profile
- other

4. Which tags should be created before any user, if `user tag list` does not already show them? Select all that apply.

- `agent`
- `provisioner`
- `human-approver`
- `revoker`
- `broker`
- one extra role-slug tag per isolation boundary you will name
- no tags, so users stay untagged
- other

5. Which of those names already exist and must be reused instead of created?

- none
- all of them
- only the names you will list
- stop if any chosen name already exists
- other

6. Which non-root users should be created now, using role slugs only? Select all that apply.

- `agent`
- `provisioner`
- `revoker`
- `human-approver`
- `broker`
- additional role slugs you will list
- no users yet, tags only
- other

7. If a chosen user name already exists, what should happen?

- stop
- reuse that user id and do not create another
- pick a different role slug you will give
- other

8. How should each new user be attached to tags?

- one `--tag-name` equal to the user slug
- one shared tag for every user
- repeatable `--tag-name` with the set you will list
- `--tag` ids from `user tag list`, because a name may match more than one tag
- create untagged, then replace `userTagIds` with `user update`
- other

9. May any new user be added to the root quorum? `user create` cannot do that.

- no; every new user stays non-root
- yes; a role slug you will name is added later in the dashboard
- do not create users until that decision is made
- other

10. Should Turnkey store an email or a phone on these users? Neither value may be written into the repo.

- omit both, and do not pass `--email`
- set an email later, outside the repo
- set a phone later, outside the repo, through `user create` JSON only
- other

11. Which non-API credentials should a user hold?

- API keys only; authenticators and `oauthProviders` stay empty
- also a WebAuthn authenticator, which requires `user create` JSON
- also an OAuth provider, through that JSON
- both an authenticator and an OAuth provider, through that JSON
- other

12. How many users does one create activity hold?

- one user, using the flag form
- several users, in one JSON `users` array
- other

13. What is the initial API-key lifetime?

- one never-expiring P-256 key
- an expiring key plus `--anchor-key`; the anchor's private half is generated on the `user create` machine and discarded
- never-expiring keys for every non-agent role, and expiring-plus-anchor for `agent`
- long-lived keys only here; expiring renewal stays in the session skill
- other

14. If a key expires, what lifetime should `--expires-in` use?

- `30m`
- `48h`
- `7d`
- `30d`
- a custom `Nd`, `Nh`, or `Nm` value you will write
- not applicable
- other

15. Where is each live private key generated?

- on that user's host with `profile create`, registering only the public key
- on the admin host with `api-key generate --output`, then `profile set` on the user host
- the anchor on the admin host and the live key on the user host
- the CI environment bundle only, with no profile file
- hosts use profiles and CI uses the environment bundle
- other

16. What profile name should each new credential use?

- the same role slug as the Turnkey user
- a host-qualified slug you will list
- no new profile, only a key file
- no new profile and no key file; environment bundle only
- other

17. Where is that profile stored?

- `$HOME/.config/turnkey` on that host, not in git
- a pinned `HOME` outside the repo, named by role
- not applicable, because there is no profile file
- other

18. After `profile create`, how should the host select the profile?

- `login --profile-name`, and continue only when `whoami` `userId` matches
- `profile use`, which checks the file and does not contact Turnkey
- `auth status` only, which does not contact Turnkey
- leave the previous active profile
- not applicable
- other

19. Which curve and API key name should registration use?

- P-256 and `{userName}-key`, which is what the flag form writes
- P-256, `{userName}-key` at creation and a slug you will give on rotation, set only in register JSON
- P-256 and a slug template you will give, which requires JSON because the flags cannot set `apiKeyName`
- other

20. How many registered API keys should each user hold after the first successful `whoami`?

- exactly one live key
- one live key plus the discarded anchor
- two live keys, primary and standby, before any old id is deleted
- one live key, after deleting every extra id that `api-key list --user-id` shows
- other

21. When should a registered key be rotated?

- on compromise only
- on a cadence you will name
- register a replacement but keep the old id until you say to delete it
- do not rotate here; revoke only by deleting the user
- other

22. The documented `api-key register` JSON sets no expiry. What should the replacement key's lifetime be?

- never-expiring, as that JSON is written
- do not register an expiring replacement here; the session skill mints it
- not applicable, because keys are not rotated
- other

23. What is the local credential-file lifetime on this `tk` 0.7.0 binary? `profile delete` reports `credentialFilesDeleted: false` and leaves the file; `profile set` stores the path you gave and reports `previousApiKeyFile`.

- keep every file
- after `whoami`, delete the old file yourself
- keep the original file you passed even if a later `main` binary sets `previousApiKeyFileRemoved` or `credentialFilesDeleted`
- other

24. If `whoami` fails after `profile set`, which file is restored?

- `data.previousApiKeyFile`, which this 0.7.0 binary has not removed
- the original file you passed, because a later `main` binary may already have removed the stored copy
- do not switch back; stop and inspect the registration activity
- other

25. Who may run `api-key delete`?

- the root profile only
- root, or a `revoker` user through the revoking-agent-keys skill
- the key owner
- either root or the owner
- other

26. What should happen to a retired or compromised non-root user?

- `user get`, confirm `userName` and `userTags`, confirm the user is not in the root quorum, then `user delete`
- delete every API key and keep the user
- `user delete`, then `profile delete` on each host; on 0.7.0 that still does not revoke a Turnkey key
- remove the user from a tag with `user tag update` and keep the user
- delete every key and then delete the user
- other

27. May a non-root user hold more than one of `agent`, `provisioner`, `human-approver`, `revoker`, and `broker`?

- no; those tags stay disjoint
- only a root user may also hold `human-approver`
- a named overlap you will list; otherwise stop
- other

28. If `user create` or `api-key register` returns `pending`, what should happen before `profile set` or `login`?

- `activity wait --timeout 60` as root, then continue
- `activity get` only, and stop for the monitoring-activities skill
- treat `pending` as failure and do not switch the profile
- it is not expected, because this root vote already meets quorum
- other

Answering these is sufficient for that skill's configuration space.
