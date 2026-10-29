# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

CLI: `tk 0.7.0` at `/tmp/tk-0.7.0/tk-aarch64-apple-darwin-v0.7.0/tk` (`tk` is not on PATH). Help checked: `activity` (`list`, `get`, `approve`, `reject`, `wait`), `policy evaluations`, `secret export`, `secret env`, `secret delete`, and `session provision`. `approve` and `reject` take `--id` and no reason. `wait` takes `--id` and `--timeout` (default 60). `activity list` takes `--limit` (default 50), `--cursor`, repeatable `--status` (`pending`, `completed`, `rejected`, `failed`; `pending` also matches created, consensus-needed, and authenticators-needed), repeatable `--type`, and `--since` (client-side walk, newest first). `policy evaluations` requires `--activity-id`.

Docs: vendored `skills/turnkey-tk/docs/activities.md` and https://github.com/tkhq/tk/blob/main/docs/activities.md both show repeatable `--status`, repeatable `--type`, and `--since`. The monitoring skill on main and in the vendored package still says to filter status and type locally because "the command has no filters." Trust the binary and `docs/activities.md`. Secret subcommands match v0.7.0. No live vote was run.

Sibling intakes already name the organization, the human approver, the vote channel, and whether a mint or a user create is expected to be pending. This loop decides what it will touch, who may vote, and whether each class ends by wait, reject, or a rerun.

Coverage: answers name the submitter and approver, the consensus count, the intent checks, how an id is found with the real list filters, when to wait, when to reject, and that a secret value comes only from rerunning `secret export` or `secret env` as the same credential and home. Rejection is final. Values are never copied into the transcript.

## Questions

1. Which activity classes may this loop approve, reject, or wait on? Select all that apply.
- `secret export`
- `secret env`
- `secret delete`
- `session provision` or another API-key registration
- raw-payload sign, SSH, or Git signing
- user create, update, or delete
- policy create, update, or delete
- wallet create
- other

2. How many organizations will this loop serve (select all that apply), without assuming a profile's saved organization when an override is selected?
- the one organization bootstrap recorded
- an explicit `--organization-id` on every call
- several organizations, each with its own submitter and approver profiles
- other

3. Which identity runs `activity wait` and any secret or session rerun? Select all that apply.
- the submitter profile identities already named for that user
- a separate profile per agent
- the `TURNKEY_ORGANIZATION_ID`, `TURNKEY_API_PUBLIC_KEY`, and `TURNKEY_API_PRIVATE_KEY` bundle with no profile
- other

4. Who may cast `activity approve` and `activity reject` (select all that apply), using role slugs and user ids rather than personal names?
- the non-root user tagged `human-approver`
- that same human in the console or mobile app, not `tk`
- every user on `HUMAN_APPROVER_TAG`
- a root-quorum member
- other

5. How many distinct approver votes must land before the loop treats the activity as approved (select all that apply)? The submitter's own vote already counts.
- whatever consensus the managing-policies answers stored, not a hardcoded count
- one additional human vote
- a count you will state
- root quorum alone is enough
- other

6. May a root credential satisfy the vote when a human-approver is the intended checker, knowing a root vote also meets the root quorum? Answer yes, no, or other.
- yes
- no
- other

7. Before `activity approve`, which intent fields must match an allow-list you will supply (select all that apply)? Target tags are not policy-visible.
- organization id
- activity `type`
- for a key registration, `userId`, `publicKey`, and lifetime
- for a secret, name or id, plus any `--context` keys
- for a signature, private-key or wallet id and the payload hash
- for a key delete, target `userId` and API key ids
- other

8. What should the loop do when those checks fail (select all that apply), given rejection is final and `reject` has no reason flag?
- `activity reject` and stop
- leave it pending and hand off
- `activity get` again and ask a human
- other

9. How does the loop learn the activity id (select all that apply), using the server flags even though the skill text says there are no filters?
- the id already on the pending command record
- `activity list` with repeatable `--status`, including `pending`
- `activity list` with repeatable `--type`
- `activity list --since` with a window you will name
- `--limit` and `--cursor` until `data.nextCursor` is null
- do not filter status or type only in `jq`
- other

10. On `submission_unknown` or `network_uncertain`, when may the original mutation be submitted again (select all that apply)? Match `type` and the intent parameters.
- only after the filtered list shows no matching activity
- never resubmit; only wait on an id already in hand
- other

11. Who runs `activity wait`, and with what `--timeout` (select all that apply)? Exit 0 with `completed` stops the wait, and `wait_timeout` means run the same wait again.
- submitter profile, 60 seconds, then the same wait
- submitter profile, a longer timeout you will name
- approver profile waits
- do not wait; only poll with `activity get`
- other

12. On repeated `wait_timeout` while status stays consensus-needed, what should happen (select all that apply), without resubmitting the original mutation?
- report the activity id and the user ids that have not voted
- keep waiting
- `activity reject`
- other

13. On `api_error` with `ACTIVITY_STATUS_REJECTED` or `ACTIVITY_STATUS_FAILED`, what should the submitter do? Select all that apply.
- stop and report the id and status
- submit a new activity
- try `activity approve` anyway
- other

14. After a human approves a `secret export` or `secret env`, how is the value obtained (select all that apply)? `activity wait` does not return the secret value.
- rerun the same secret command as the same credential and the same home directory
- do not read a value from `data.activity.result`
- do not print the value in the transcript
- other

15. If `secret env` exits `approval_required` with several `details.pending` activities, what is in scope? Select all that apply.
- approve every listed activity, then rerun the same `secret env`
- approve only names you will list
- `activity reject` the rest
- leave them and fail startup, when the sidecar answer says so
- other

16. For a pending `session provision`, what should the loop do after the vote (select all that apply)? Provision detects its own pending work.
- rerun `session provision` with the same `--user-id`, `--public-key`, and `--expires-in`
- only `activity wait`, then `session activate`
- both, in that order
- other

17. Where do the approver credential and the submitter credential live? Select all that apply.
- same Unix user and `HOME`
- different machines
- approver only in the Turnkey console or mobile app, not `tk`
- other

18. Should every unattended command use `--message-format json` and `--non-interactive`, since JSON output does not prompt? Answer yes, no, or other.
- yes
- no
- other

19. When a vote is still missing, who must be told, and with what (select all that apply), including no secret value and no private key?
- the human-approver role, with activity id, type, and an intent summary
- nobody until `wait_timeout`
- other

20. How should a pending secret activity older than the documented sweep be treated (select all that apply)? Pending export state is swept after 8 hours, and the activity expires after 24.
- leave it
- `activity reject` at a cutoff you will name
- approve only if still `ACTIVITY_STATUS_CONSENSUS_NEEDED` and the intent still matches
- other

21. When `activity approve` stays `pending` or returns `unauthorized`, what is read before another vote? Select all that apply.
- `data.activity.votes[].userId` and `selection`
- `policy evaluations --activity-id`
- stop without switching the vote to root
- other

Answering these is sufficient for that skill.
