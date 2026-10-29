# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

CLI: `tk 0.7.0` at `/tmp/tk-0.7.0/tk-aarch64-apple-darwin-v0.7.0/tk` (`tk` is not on PATH). Help checked: `user list` (`--tag` only), `user tag list`, `user get`, `api-key list` (exactly one of `--user-id` or `--all-users`, and at most one of `--expiring-within`, `--expired`, or `--long-lived`), `activity list` and `activity get`, `secret list`, `policy list`, `policy get`, and `policy evaluations`. `activity list` has repeatable `--status`, repeatable `--type`, and `--since`, matching https://github.com/tkhq/tk/blob/main/docs/activities.md. `secret list` never returns values. No live list was run.

Docs: vendored `skills/turnkey-tk/inspecting-agents/SKILL.md`, `docs/resources.md`, `docs/activities.md`, `docs/secrets.md`. The skill body matches main aside from package link depth. `user list`, `user tag list`, `policy list`, and `api-key list` return one response. `activity list` and `secret list` page with `--limit` and `--cursor`.

Sibling intakes already name profiles, tag ids, and which users were created. This intake decides the read-only report. Do not approve, reject, wait, create, delete, export, or run `secret env` here. Do not print secret values or private keys.

Coverage: answers name the reader profile, the exact tags and users, each API-key pass, how far activity and secret pages are read, which votes and policy texts are included, the mint join, and that secret values are never listed. Each line of the report cites the command, the pages read, and the field.

## Questions

1. Which identity will run every read? Select all that apply.
- a profile literally named `admin`
- another profile name you will give
- the `TURNKEY_ORGANIZATION_ID`, `TURNKEY_API_PUBLIC_KEY`, and `TURNKEY_API_PRIVATE_KEY` bundle and no profile
- a separate profile per organization
- other

2. How many organizations will this report cover? Select all that apply.
- one organization, the active profile only
- one organization, with `--organization-id` on every command
- several organizations, each with its own profile
- other

3. Is this run forbidden to approve, reject, wait, create, delete, register, export, or run `secret env`, while still allowed to hand pending ids to monitoring-activities? Answer yes, no, or other.
- yes
- no
- other

4. Which tag names must `user tag list` resolve by exact `tagName` before any user or policy search (select all that apply)? Policy text contains tag ids, not names.
- `agent`
- `provisioner`
- `human-approver`
- `revoker`
- `broker`
- other

5. If a requested tag name matches nothing, what happens (select all that apply), with no substring match on the tag name?
- stop and report the empty name
- print the full `tagId` and `tagName` list and wait
- continue with the other tags only
- other

6. Which users are in scope for keys, votes, and policy text? Select all that apply.
- every user from `user list --tag` for each tag in question 4
- only user names you will list
- only user ids you will list
- every user in the organization
- other

7. Which API-key passes should run, each as its own command because expiry modes cannot combine (select all that apply)? `--expiring-within` also includes keys that are already expired.
- `--user-id` and no expiry mode for each user in question 6
- `--all-users --long-lived`
- `--all-users --expiring-within`
- `--all-users --expired`
- per-user `--expired`
- other

8. What single duration should `--expiring-within` use (select all that apply), such as `30m`, `2h`, `24h`, or `7d`?
- `24h`
- `48h`
- `7d`
- `2h`
- do not run that pass
- other

9. Which permanent-key findings should the report call out (select all that apply)? `expiresAt` is a Unix-millisecond string, or null when the key never expires.
- a session-route agent with not exactly one never-expiring key
- a long-lived-route agent whose single runtime key is not permanent
- both of those
- neither; list `expiresAt` only
- other

10. Which activity statuses belong in the report (select all that apply)? `pending` also matches created, consensus-needed, and authenticators-needed.
- `pending` only
- also `completed`
- also `rejected`
- also `failed`
- other

11. How far should activity and secret pages be read before answering "none" (select all that apply)? An empty page after a full page is the end.
- `--limit 50` until `data.nextCursor` is null, including a final empty page
- a different `--limit` you will name, still until a null cursor
- first page only
- other

12. Should pending age be `now` minus `createdAt.seconds`, and should `--since` apply to that report (select all that apply)? Age is not time spent pending, and `--since` walks newest first until a page is older.
- age that way, no `--since`
- age that way, plus `--since 24h`
- age that way, plus `--since 7d`
- no age; ids and status only
- other

13. Which repeatable `--type` values, if any, narrow the pending list (select all that apply), keeping those flags on every page?
- no type filter
- `ACTIVITY_TYPE_CREATE_API_KEYS_V2`
- `ACTIVITY_TYPE_CREATE_USERS_V4`
- `ACTIVITY_TYPE_EXPORT_SECRETS`
- `ACTIVITY_TYPE_DELETE_SECRETS`
- `ACTIVITY_TYPE_DELETE_API_KEYS`
- `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2`
- other

14. Which activities get `activity get --id` for `votes[].userId` and `votes[].selection` (select all that apply)? `selection` is `VOTE_SELECTION_APPROVED` or `VOTE_SELECTION_REJECTED`.
- every id from the full status walk
- only ids you will supply
- only ids whose type is in question 13
- do not fetch votes
- other

15. How should a missing approver be stated (select all that apply), without voting from this report?
- the first vote is the submitter, then name whoever `consensus` lists and `votes` does not
- votes only, no policy read
- also `policy evaluations --activity-id` for those ids
- other

16. Which secret metadata filters apply (select all that apply), never running `secret export` or `secret env` and never printing secret values?
- `secret list` only
- repeatable `--property` pairs you will list; every property must match
- one `--name-prefix` you will name
- unfiltered metadata, still paged to a null cursor
- other

17. May static property values appear in the report, as labels such as `consensus=unilateral` and not as secret values? Answer yes, no, or other.
- yes
- no
- other

18. What may the policy candidate search match on (select all that apply), knowing an empty id matches every policy and `contains` is not a dependency graph?
- resolved tag ids only
- user ids from question 6 only
- both, and skip the search if either string is empty
- also `policy get --id` for policy ids you will list
- other

19. Before saying a policy governs a tag or user, what must be read (select all that apply), including whether the id is an approver, a target, or both?
- `consensus` and `condition` of each `contains` candidate
- the candidate `policyId` and `effect` are enough
- also `policy evaluations` for a named activity
- other

20. How should mint attribution work (select all that apply), joining `credential.publicKey` only and never inferring a minter from other voters?
- `ACTIVITY_TYPE_CREATE_API_KEYS_V2` and `ACTIVITY_TYPE_CREATE_USERS_V4` only, both `--type` flags on every page
- `--since 7d` only when the key is known to be recent, and drop `--since` before answering "unknown"
- no match across every page is "unknown"
- include the public key in the report and never a private key
- other

21. What must each hand-off line include (select all that apply), after which the run stops?
- the answer
- the command
- pages read, as `N of N`
- the field the answer came from
- pending ids, permanent-key findings, and "unknown" minters listed explicitly
- a statement that secret values were not listed
- other

Answering these is sufficient for that skill.
