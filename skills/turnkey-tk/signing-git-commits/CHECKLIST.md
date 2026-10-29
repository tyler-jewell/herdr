# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

CLI: `tk 0.7.0` from `/tmp/tk-bin/tk` (`tk` is not on `PATH`). Help only, no agent started. Confirmed groups: `wallet create` (`--input-json` or `--input-file` only), `gpg keys` (`create` requires `--wallet-id` and `--user-id` and registers an existing key for that user id; `add` requires `--key` when the wallet holds more than one PGP key; `export` prints an armored public block whose self-certification is signed; `list`, `remove`), `gpg sign` (`--key`, `--file`, `--output`), `gpg agent serve` (foreground, requires `--key`, `--socket`, `--socket-mode` default `600`), `ssh keys` (`create --name`, `add --private-key-id`, `list`, `remove --key`), `ssh public-key` (`--key`), `ssh git-sign` (ssh-keygen-shaped args only; Git calls this, the skill does not), `ssh agent start` (`--key` repeatable, `--allowed-hosts-file`, `--allow-namespace` repeatable, `--socket`, `--pid-file`, `--socket-mode` default `600`), `git co-author` (one message file), `policy create`, `activity wait` (`--timeout` default `60`). There is no `tk broker` subcommand. Local `git version 2.54.0 (Apple Git-157)`; `git hook list commit-msg` exits 0. `gpg` is absent. `ssh-keygen` is `/usr/bin/ssh-keygen`.

Pinned names from the other questionnaires, not re-chosen here: root profile `admin` (bootstrapping-organization, provisioning-session-agent); agent profile `agent` and `AGENT_USER_ID` (provisioning-agent-identity, provisioning-session-agent); provisioner profile `provisioner` (provisioning-session-agent); broker profile `broker`, tag `broker`, and `BROKER_USER_ID` (managing-policies, sidecar-patterns). SSH key id is `PRIVATE_KEY_ID`. OpenPGP wallet id is `WALLET_ID` and fingerprint is `FINGERPRINT` (managing-policies). Do not bootstrap the organization, pick an API base URL, or invent a personal mailbox.

Docs: vendored `skills/turnkey-tk/docs/git-signing.md` and `docs/gpg-signing.md`; tag https://github.com/tkhq/tk/blob/v0.7.0/docs/git-signing.md ; main https://github.com/tkhq/tk/blob/main/docs/git-signing.md . Skill: `skills/turnkey-tk/signing-git-commits/SKILL.md`.

## Gaps

Main `docs/git-signing.md` adds `git hook list commit-msg` and says Git older than 2.54 ignores `hook.turnkey-co-author` with no error, and it uses a committer form `Name (agent) <local-part+agent@domain>`. The vendored page and skill still show the hook without that version check and use `Agent <agent@example.com>`. This host's Git is already 2.54.0. Main `docs/gpg-signing.md` leads GitHub registration with a paste or `gh gpg-key add` and says earlier commits become Verified only after the user-id email is verified. Global git config already has `user.name`, `user.email`, `user.signingkey`, `commit.gpgsign`, `gpg.format`, and `gpg.ssh.program`, so `--global` would replace that signer. `test.ts` runs one Apple `container run` with no `--ssh`, `--read-only`, `--cap-drop ALL`, user `1000:1000`, tmpfs `/tmp` and `/home/tester`, and no host mount; that guest has git, not GnuPG or `tk`, and cannot see a host socket. The broker is a process layout in deploying-signing-broker, not a `tk` subcommand.

## Questions

Answer every question. Yes/no/other means those three lines. Otherwise select every line that applies, including other when the concrete value is not listed. Put ids and literals in the answer, not in the repo. Do not read a committer identity from the repo or from tool output.

1. Which keys sign commits and tags? Select every key this git setup will use.
   - OpenPGP only, wallet `WALLET_ID` and fingerprint `FINGERPRINT`
   - SSH Ed25519 only, `PRIVATE_KEY_ID`
   - both, each with its own allow-always policy
   - neither; do not configure git signing
   - other

2. Which program does git call for each selected key? One path per key type.
   - direct OpenPGP: `gpg.format=openpgp` and `gpg.program` is the `tk-sign` wrapper or an absolute `tk`
   - direct SSH: `gpg.format=ssh` and `gpg.ssh.program` is an absolute path to `tk` or the wrapper
   - SSH agent: `gpg.ssh.program=ssh-keygen` and `SSH_AUTH_SOCK` on a using-ssh socket started with `--allow-namespace git`
   - GPG broker socket: `TK_GPG_AGENT_SOCK` set, `gpg.program=tk`, no `TK_PROFILE` and no `agents-sign-*`
   - other

3. Which host may hold the Turnkey API credential that git signing uses? The credential-free choice means git sees only a socket and a public key.
   - same OS user and `HOME` as git, profile `agent`
   - a different `HOME` than git, so the wrapper also exports `HOME` to the registry directory
   - CI only, with `TURNKEY_ORGANIZATION_ID`, `TURNKEY_API_PUBLIC_KEY`, and `TURNKEY_API_PRIVATE_KEY` already set, plus `TURNKEY_SSH_KEY_ID` for SSH
   - only the broker host or the SSH-agent host
   - not this Mac and not the Apple test container
   - other

4. Can the current Apple container test host this signer? It is one `container run` with no `--ssh`, a read-only root, no host mount, uid 1000, and tmpfs homes, and this host has no `gpg`.
   - yes
   - no
   - other

5. Where may git signing config be written? A runtime env map does not expand `$HOME`, `$FINGERPRINT`, or `$(command -v tk)`.
   - this repository only, without `--global`, and do not commit it
   - the agent process only, via `GIT_CONFIG_COUNT` and `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n`
   - replace the OS user's global git config
   - CI job env only
   - do not change git config
   - other

6. Must the existing global signer stay in place? Those global keys are already set, and `--global` would replace them.
   - yes
   - no
   - other

7. What should be signed automatically?
   - `commit.gpgsign true`, tags only when someone runs `git tag -s`
   - `commit.gpgsign true` and `tag.gpgsign true`
   - no automatic flags; only explicit `git commit -S` or `git tag -s`
   - other

8. Should the co-author hook be installed? It runs `tk git co-author` and adds `Co-authored-by: Turnkey <noreply@turnkey.com>`; main docs require Git 2.54 or newer, which this host has.
   - yes, global, then confirm with `git hook list commit-msg`
   - yes, only in the agent `GIT_CONFIG_*` overlay
   - no
   - other

9. Which committer literal may be passed as a single-quoted `--user-id` and as `user.name` / `user.email`? Do not write a personal mailbox into the repo.
   - a role `Name <email>` the operator supplies outside the repo
   - the main form `Name (agent) <local-part+agent@domain>`, supplied outside the repo
   - sandbox only, `Tester <tester@example.com>` inside the container and not on a Turnkey key
   - refuse until the operator supplies the literal
   - other

10. How is the OpenPGP key obtained? `wallet create` takes only `--input-json` or `--input-file`; the empty wallet is `{"walletName":"gpg","accounts":[]}`.
   - new empty wallet, then `gpg keys create --wallet-id WALLET_ID --user-id`
   - existing `WALLET_ID` and a new user id
   - existing `WALLET_ID` and `FINGERPRINT`, `gpg keys add` only
   - no OpenPGP key
   - other

11. Does that wallet already hold a key for this exact user id? If yes, `gpg keys create` registers it and does not mint a second fingerprint.
   - yes
   - no
   - other

12. How is the SSH signing key chosen? `ssh public-key` with no `--key` is only safe when one key is registered.
   - `ssh keys add --private-key-id PRIVATE_KEY_ID` in this `HOME` if it is missing, then `ssh public-key`
   - several keys, so `ssh public-key --key` with a fingerprint or `PRIVATE_KEY_ID`
   - CI sets `TURNKEY_SSH_KEY_ID` and adds that id
   - no SSH key yet; stop and finish using-ssh first
   - not using SSH signing
   - other

13. Which allow-always policy should profile `admin` create? Git waits synchronously, so an allow-once policy is not usable.
   - `agents-sign-gpg` on `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2` and `wallet.id == WALLET_ID`, consensus `user.id == AGENT_USER_ID`
   - `agents-sign-ssh` on that activity and `private_key.id == PRIVATE_KEY_ID`, same consensus
   - already exists; do not create another
   - skip; the broker principal holds signing under its own ALLOW and credential DENY
   - other

14. What should the `tk-sign` wrapper export? Git passes no `tk` flags, so the profile cannot be a git argument.
   - `TK_PROFILE=agent` only
   - `TK_PROFILE=agent` and `HOME` pinned to the directory that holds the profile and the key registry
   - no wrapper; CI uses `gpg.program=tk` with `TK_PROFILE` or the `TURNKEY_*` bundle
   - no wrapper; git uses `ssh-keygen` or `TK_GPG_AGENT_SOCK`
   - also `TK_GPG_PROGRAM` or `TK_SSH_KEYGEN_PROGRAM` because `gpg` or `ssh-keygen` is not on `PATH`
   - other

15. How should `git verify-commit` succeed on the machine that made the commit?
   - import and `echo "$FINGERPRINT:6:" | gpg --import-ownertrust` into `$HOME/.config/turnkey/tk/gnupg` mode `700`
   - the human GnuPG home instead of that path
   - an `allowed_signers` line pairing the committer email with the SSH public key, plus `gpg.ssh.allowedSignersFile`
   - local verification is not required
   - other

16. Is a hosting provider "Verified" badge in scope? This workflow's success check is local verification only.
   - no
   - yes for OpenPGP, after `gpg keys export`, by a paste or `gh gpg-key add`, and only once that user-id email is verified on the account
   - yes for SSH, by adding the public key in the host UI
   - hand off those steps and make no badge claim
   - other

17. Which commits should this setup cover?
   - this herdr checkout only
   - every repo the agent commits
   - CI of this repo only
   - agent commits only, while human commits keep the current signer
   - other

18. Should `test.ts` stay unsigned, with `tester@example.com` only inside that container and never on a Turnkey key?
   - yes
   - no
   - other

19. Which missing tools may be installed outside the repo, with no binary or key committed?
   - GnuPG
   - `tk` 0.7.0 on the agent `PATH`
   - neither; stop until `tk` and, for OpenPGP, `gpg` are already present
   - other

20. If `wallet create` returns `pending`, what should happen?
   - `activity wait --id` as `admin` with the default 60s timeout, then read `WALLET_ID`
   - the same wait with a longer `--timeout` named in the answer
   - do not create a wallet
   - an existing `WALLET_ID` will be supplied
   - other

21. Can the process that holds the signing credential reach Turnkey on the network? A workspace-write sandbox has no network unless that is turned on.
   - yes
   - no
   - other

22. What must be true before handoff? Do not print private key material.
   - `git verify-commit HEAD` exits 0 on the machine that signed
   - the report names `WALLET_ID` or `PRIVATE_KEY_ID`, the fingerprint, the policy id, and where git config was written
   - signing was not attempted
   - other

## Coverage

Together with using-ssh and deploying-signing-broker, these answers choose OpenPGP, SSH, or both; direct `tk`, an SSH agent socket, or a GPG broker socket; whether `--allow-namespace git` is required; where the public key is published; whether the co-author trailer is installed; and which host may hold the signing credential. They also say when the current Apple container test cannot host that signer. Organization bootstrap, the three disjoint tags, and the approval cell stay in their own questionnaires. Policy names stay `agents-sign-gpg` and `agents-sign-ssh` unless the broker file names `brokers-sign-gpg` or a per-broker SSH ALLOW.

answering these is sufficient for that skill.
