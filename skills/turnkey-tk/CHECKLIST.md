# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

CLI: `tk 0.7.0` (`/tmp/tk-bin/tk --version`; `tk` was not on `PATH`). Latest release tag is still `v0.7.0` (2026-10-16). `tk --help` lists `activity`, `ssh`, `request`, `user`, `policy`, `api-key`, `wallet`, `sign`, `secret`, `session`, `gpg`, `git`, `skills`, `update`, `login`, `whoami`, `auth`, and `profile`. On this binary, `tk skills install` never replaces an existing destination. `Cargo.toml` on `main` (`dd7a4d35`, 2026-10-27) still says `0.7.0`, but that tree copies `--api-key-file` under `~/.config/turnkey/tk/api-keys/` and can delete the stored copy on `profile set` (`previousApiKeyFileRemoved`) and `profile delete` (`credentialFilesDeleted`) when no other profile uses it. This binary does neither: `profile set` uses the given path in place, and `profile delete` keeps credential files.

Docs:

- Vendored index: `skills/turnkey-tk/SKILL.md` (package digest `75e972750d716af7e801e2562ea7d57017aadb664b37d132db096c6db9a4ab06`)
- Vendored authentication: `skills/turnkey-tk/docs/authentication.md`
- Release: https://github.com/tkhq/tk/releases/tag/v0.7.0
- Main index and authentication: https://github.com/tkhq/tk/blob/main/skills/SKILL.md and https://github.com/tkhq/tk/blob/main/docs/authentication.md
- Main versus tag: https://github.com/tkhq/tk/compare/v0.7.0...main

Coverage: Answering this file selects the first child workflow and the organization facts those workflows assume: whether an organization must be created, whether one root vote is enough, the API base URL, the profile-name set, where profiles live (never in git), which tags and non-root users already exist, how long credential files are kept, the approval cell, the credential route, and which of policies, secrets, sessions, SSH, Git signing, a broker, revoke, or inspect comes next. It does not choose policy text, secret values, socket modes, git config, or renewal timers.

## Questions

1. Does a Turnkey organization have to be created before any `tk` command?

- no organization yet; create it in the dashboard and stop until an organization id exists
- an organization exists and has never been bootstrapped
- an organization exists and a root profile already passes `whoami`
- an organization exists and already has tags or non-root users
- other

2. Will the acting root user's single vote already meet the dashboard root quorum?

- yes
- no, at least one other root member must approve before a mutation completes
- the threshold is not set yet; stop before any mutation
- other

3. Which API base URL should every new profile store?

- `https://api.turnkey.com`
- one non-default URL supplied outside the repo, stored by `profile create` or `profile set`
- do not persist a URL; pass `--api-base-url` only on the commands that need it
- other

4. Where may profile registries and credential files live? `tk` ignores `XDG_CONFIG_HOME` and requires `HOME`.

- only under `$HOME/.config/turnkey` on each host, never in git
- a pinned `HOME` outside the repo for each role, still under that `.config/turnkey` path
- no files; CI uses the `TURNKEY_ORGANIZATION_ID`, `TURNKEY_API_PUBLIC_KEY`, and `TURNKEY_API_PRIVATE_KEY` bundle
- hosts use that directory and CI uses the bundle
- other

5. Which profile names must exist, using role slugs only? Select all that apply.

- `admin`
- `default`
- `agent`
- `provisioner`
- `revoker`
- `approver`
- `broker`
- another role slug you will list
- other

6. Which tags already exist or must exist before a child skill runs? Select all that apply.

- `agent`
- `provisioner`
- `human-approver`
- `revoker`
- `broker`
- one extra scope tag per isolation boundary, which you will name
- none yet
- other

7. Do any non-root users exist yet?

- no, the root quorum only
- yes; list their role slugs, not personal names
- tags exist but no non-root users
- unknown; stop and run `user list` before creating anyone
- other

8. What is the local credential-file lifetime after a profile stops using a key? This binary keeps files; unreleased `main` may delete a stored copy under `api-keys` when no other profile uses it.

- keep every file, and do not expect `tk` 0.7.0 to remove it
- delete the old file yourself only after `whoami` succeeds on the replacement
- keep the original file outside `api-keys` so a later `main` binary cannot be the only copy
- other

9. Which approval cell should later policies use?

- a human for both export and minting
- unilateral export and human minting
- human export and unilateral minting
- unilateral export and unilateral minting
- long-lived agents only, so record the export column and no minting row
- both export columns, chosen per secret later
- other

10. Which credential route should agents use? Leave exact lifetimes to the session skill.

- long-lived non-expiring key only
- expiring session keys minted by a provisioner
- both routes
- no agent credential yet
- other

11. Which child skill runs first?

- bootstrapping-organization
- managing-identities
- managing-policies
- provisioning-agent-identity
- provisioning-session-agent
- managing-secrets
- revoking-agent-keys
- monitoring-activities
- inspecting-agents
- using-ssh
- signing-git-commits
- deploying-signing-broker
- sidecar-patterns
- other

12. Which later capabilities are in scope? Select all that apply. Do not decide their policy text, sockets, or git config here.

- Turnkey secrets
- SSH
- Git commit or tag signing
- a GPG signing broker
- a scoped revoker
- inspect only
- none yet
- wallets, chain signing, or broadcasting, which this package does not cover
- other

13. Who holds signing authority if signing is in scope?

- the agent user
- a separate broker principal
- no signing
- not decided, so do not load a signing skill yet
- other

14. Where will the agent run `tk`? This only picks a workflow.

- an interactive machine that shares `HOME` with a human
- an interactive machine whose agent has its own `HOME`
- an unattended host or CI job
- a container or sidecar split from the application
- no runtime yet
- other

15. Can a person approve activities while the agent is running?

- yes, from the dashboard, the mobile app, or `tk activity approve`
- no; unattended work must not wait on a person
- mixed; some grants are unilateral and some need a person
- other

16. May any secret or private key be written into git or this repo?

- no; Turnkey via `tk` is the only store
- no secret is needed
- other

17. Which operating systems will run the `tk` 0.7.0 binary? Select all that apply.

- macOS Apple silicon
- Linux aarch64
- Linux x86_64
- a host with no 0.7.0 build, such as Intel macOS or Windows
- not decided
- other

18. Where should the handoff be kept: organization id, whether one root vote is enough, API base URL, profile names, tag ids, and the approval cell?

- operator notes outside the repo
- this chat only
- do not store it
- other

Answering these is sufficient for that skill's configuration space.
