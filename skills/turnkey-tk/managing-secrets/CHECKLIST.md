# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

CLI: `tk 0.7.0` at `/tmp/tk-0.7.0/tk-aarch64-apple-darwin-v0.7.0/tk` (`tk` is not on PATH). Help checked: `secret` (`import`, `export`, `list`, `env`, `delete`). `import` requires `--name` and repeatable `--property`, and reads `--from-file` or a prompt or stdin. `export` is exactly one of `--name` or `--id`, plus optional `--out` (new file, mode 0600) and repeatable `--context`. `list` is `--limit` (default 50), `--cursor`, repeatable `--property` (every property must match), and `--name-prefix`; values are never returned. `env` requires `--name-prefix` and/or `--property`. `delete` is exactly one of `--name` or `--id`. These flags match vendored and main `docs/secrets.md` for v0.7.0.

Docs: `skills/turnkey-tk/docs/secrets.md`, `skills/turnkey-tk/managing-secrets/SKILL.md`, and https://github.com/tkhq/tk/blob/main/docs/secrets.md. Main `docs/secrets.md` matches tag v0.7.0. The skill forbids wallet and private-key export. There is no update command: properties are immutable, names are unique, import strips one trailing newline, and rotation is delete then import after a pending delete completes.

Sibling intakes already force profiles, tag ids, the export column, homes, and the single sidecar startup command when that answer is not "other". This intake decides the rest of the layout. Do not print secret values, paths inside the repo, or personal data.

Coverage: answers name every prefix, the `consensus` level and any other static properties, the import path that never prints a value, where bytes may be written, who may approve, and whether a pending export is rerun from the same credential and home or a pending delete is waited then replaced. Policy text stays in the managing-policies answers; this file only supplies the names and properties those conditions match.

## Questions

1. Which name prefixes does this layout use (select all that apply), with `secret env` taking the segment after the last `/` as the variable name?
- `service/`
- one other prefix you will name
- several prefixes, one per scope
- a name with no slash, so the whole name is the variable
- no `secret env`; export by `--name` or `--id` only
- other

2. Will every secret carry exactly one immutable `consensus` property, `unilateral` or `approval`, chosen per secret inside the bootstrap export column and never holding a secret value? Answer yes, no, or other.
- yes
- no
- other

3. Which extra static properties are bound at import (select all that apply), listing each `key=value` in the answer and never a secret value?
- `scope` equal to an isolation boundary
- `env` equal to a short environment name
- further keys you will list
- none
- other

4. Can you list every secret as name, `consensus`, extra properties, and an absolute source path outside the repo, with no values? Answer yes, no, or other.
- yes
- no
- other

5. How is each value supplied so it is never printed or committed (select all that apply), waiting on a pending import instead of repeating it?
- `--from-file` outside the git worktree
- a pipe that does not enter the transcript
- a hidden TTY prompt
- `--non-interactive`, so a missing file fails instead of prompting
- accept that one trailing newline is stripped
- refuse import if the only copy is in chat
- other

6. Do any source bytes contain a newline, a NUL, or a single quote, which `secret env` refuses, leaving those names on `secret export --out` only? Answer yes, no, or other.
- yes
- no
- other

7. Where may an exported value be written (select all that apply), excluding stdout in the agent transcript and `jq .data.value`?
- a new `--out` file, mode 0600, outside git
- the consuming process environment only
- JSON `data.env` inside that process
- human dotenv sourced only by that process
- nowhere during intake
- other

8. Which selectors build a `secret env` set beyond a sidecar startup command that is already fixed (select all that apply)? The prefix selects, and the export policy authorizes.
- `--name-prefix` from question 1
- `--property consensus=unilateral`
- further `--property` equalities that must all match
- no startup `secret env`
- on-demand `secret export` by name
- on-demand `secret export` by id
- other

9. Must approval-gated secrets stay out of that startup filter, since an approval match exits 1 with `approval_required` and prints no values? Answer yes, no, or other.
- yes
- no
- other

10. Who may vote on a pending export or deletion (select all that apply), with the export finished by rerunning the same command rather than reading `activity wait`?
- the non-root approver named by the monitoring-activities answers, via `activity approve --id`
- that same human in the console or mobile app
- `activity reject --id` to abandon
- `activity wait --id` on a pending delete before the replacement import
- not a root user, because a root vote does not prove the policy
- other

11. Will the pending export be finished by the same profile, credential file, and HOME that submitted it, rather than a new pending export from another machine? Answer yes, no, or other.
- yes
- no
- other

12. Do two or more agents need distinct tags and a `scope` property so a shared prefix does not authorize them, with the cross-export required to 403? Answer yes, no, or other.
- yes, and list profile, tag, and scope per agent
- no
- other

13. Is this a first import or a rotation (select all that apply), knowing the name stays taken until a pending delete completes?
- first import only
- `secret delete --name`, then import the same name and properties
- `secret delete --id`
- wait while delete is `pending` before import
- rotate the credential at its provider before replacing the secret
- do not delete anything
- other

14. Should acceptance run only as the non-root agent profile with `--message-format json`, unilateral export `completed` and `data.out`, and approval export left `pending` until a non-root vote? Answer yes, no, or other.
- yes
- no
- other

15. Do any exports pass repeatable `--context key=value` on that request only, knowing sample export policies do not read context? Answer yes, no, or other.
- yes
- no
- other

16. Should metadata checks use `secret list` with the same prefix and property filters, paging on `--cursor` until `nextCursor` is null, and never print values? Answer yes, no, or other.
- yes
- no
- other

17. Will source files and `--out` paths stay outside this repo, with the handoff limited to policy ids, secret ids, names, properties, pending activity ids, and the exact `secret env` or `secret export` command? Answer yes, no, or other.
- yes
- no
- other

Answering these is sufficient for that skill.
