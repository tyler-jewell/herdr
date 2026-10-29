# Checklist

This is the live checklist for this skill. Decide every item before using the skill. Update this file when the skill, its CLI, or its docs change.

CLI: `tk 0.7.0` from `/tmp/tk-bin/tk` (`tk` is not on `PATH`). Help only. `tk broker` is not a subcommand (`unrecognized subcommand`, exit 2). The broker is a process layout: foreground `tk gpg agent serve --key FINGERPRINT --socket PATH --socket-mode MODE`, with global `--non-interactive`. Also confirmed: `gpg keys add` (`--wallet-id`, and `--key` when the wallet holds more than one PGP key), `gpg keys export` (armored public block; the self-certification is signed, so an approval policy blocks it), `policy create` (`--effect` `allow` or `deny`, `--consensus`, `--condition`, `--notes`), `session request` (`--profile-name`, optional `--replace`), `session provision` (`--user-id`, `--public-key`, `--expires-in` default `7d`, optional `--label`), `session activate`, `session status` (`--warn-before` default `48h`), and `git co-author` (one message file). User and profile creation stay in provisioning-session-agent. Local git is 2.54.0. `gpg` is absent on this host.

Pinned names: root profile `admin`; broker profile `broker`, tag `broker`, and `BROKER_USER_ID`; provisioner profile `provisioner` and `PROVISIONER_USER_ID`; agent profile `agent` and `AGENT_USER_ID` must not receive an ALLOW on this wallet. OpenPGP ids are `WALLET_ID` and `FINGERPRINT` from signing-git-commits. SSH `PRIVATE_KEY_ID` is not served here; SSH through a broker is using-ssh as the broker principal. Do not bootstrap the organization, invent tags, or choose a second mint consensus.

Docs: vendored `skills/turnkey-tk/docs/gpg-signing.md`, `docs/git-signing.md`, `docs/sessions.md`; the same paths on https://github.com/tkhq/tk/blob/v0.7.0/docs/ and https://github.com/tkhq/tk/blob/main/docs/ . Skill: `skills/turnkey-tk/deploying-signing-broker/SKILL.md`.

## Gaps

The skill body matches v0.7.0: three principals, one OpenPGP fingerprint, `brokers-no-credentials` plus `brokers-sign-gpg` on `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2` and one `WALLET_ID`, no export policy, socket mode `660` or `600`. Main `docs/git-signing.md` requires Git 2.54 or newer for `hook.turnkey-co-author` and uses `Name (agent)` with a plus-tagged address. Main `docs/sessions.md` deletes a previous key file on `session activate` only when it is tk's copy under `~/.config/turnkey/tk/api-keys/` and no other profile uses it. `test.ts` is one Apple `container run` with no `--ssh`, uid `1000:1000`, `--cap-drop ALL`, a read-only root, tmpfs homes, and no host mount, so it cannot mount a shared runtime directory or give the broker and the provisioner separate homes. Mounts, ownership, supervision, broker loss, and the renewal timer are manual gates.

## Questions

Answer every question. Yes/no/other means those three lines. Otherwise select every line that applies. Put paths, digests, uids, and durations in the answer, not in the repo. The application never receives the broker profile, registry, or API credential.

1. Which signing work is in scope for this layout? SSH is not configured by this skill.
   - OpenPGP Git commits through `gpg agent serve`
   - the same socket also used for credential-free OpenPGP signatures that are not commits
   - SSH as well, which must follow using-ssh as profile `broker`
   - do not deploy a broker
   - other

2. What isolation boundary does each principal get? Separate OS users are the default, and no ports are published.
   - three OS users on one host
   - one container, VM, or sandbox per principal
   - application and broker share one numeric uid and nothing else, and the provisioner is a third boundary
   - the current Apple test container only
   - other

3. Can the current Apple container test host this broker? It has no `--ssh`, a read-only root, no host mount, and one uid, while this layout needs a shared socket directory and separate homes.
   - yes
   - no
   - other

4. Which socket model grants signing authority? `gpg agent serve --socket-mode` defaults to `600`.
   - mode `660`, broker uid, supplemental group `10000`, application `group_add`
   - mode `600` because application and broker are one numeric uid
   - other

5. Which numeric ids should be used?
   - application `1000:1000`, broker `10000:10000`, provisioner `10001`, as in the skill example
   - three distinct uids named in the answer
   - one shared uid for application and broker, plus a different provisioner uid
   - other

6. Do `WALLET_ID` and `FINGERPRINT` already exist? Skip the agent signing policy in signing-git-commits when this broker holds the key.
   - yes; supply both out of band and do not create another key
   - no; create the empty wallet and OpenPGP key there first
   - the wallet exists, but profile `broker` has not run `gpg keys add` yet
   - other

7. What broker identity should be used? Creating the user is provisioning-session-agent with tag `broker` and profile name `broker`.
   - new user and new tag `broker`
   - existing tag `broker`, new user
   - existing `BROKER_USER_ID`; only renew its session and serve
   - other

8. Will profile `admin` create `brokers-no-credentials` before any broker key exists, then `brokers-sign-gpg` for `BROKER_USER_ID` and `WALLET_ID`, with no export ALLOW?
   - yes
   - no
   - other

9. Will `session provision` use the mint consensus and the three provisioner policies already chosen for profile `provisioner`, only adding `BROKER_USER_ID` to the mint target list?
   - yes
   - no
   - other

10. What session lifetime and warn window should the broker timer use? Warn must be shorter than the lifetime and the lifetime must not exceed the mint ALLOW cap (`1s` to `365d`).
    - the same `--expires-in` and `--warn-before` already chosen for the agent session
    - `--expires-in 7d` and `--warn-before 48h`
    - a custom pair named in the answer
    - other

11. Where does the renewal state machine run? `request`, `status`, and `activate` stay in the broker boundary; `provision` stays in the provisioner boundary.
    - a host timer outside the application
    - a person runs that same split, with no timer
    - no renewal until the first key is near expiry
    - other

12. How do the non-secret public API key and `BROKER_USER_ID` reach the provisioner? The provisioner must not read the broker `HOME`.
    - an authenticated channel checked against the expected user id, organization, and lifetime
    - a file outside both homes and not on the application mount, still checked against those three
    - not decided
    - other

13. Where is `BROKER_USER_ID` persisted outside the application?
    - a host file the application cannot mount
    - the provisioner home only
    - both the host file and the provisioner home
    - other

14. Which host is allowed to hold the broker profile, registry, and API credential?
    - the broker boundary only
    - the provisioner boundary
    - the application boundary
    - a host other than the Apple test container
    - other

15. Which host paths hold homes, the writable runtime directory, the worktree, and the armored public key? Homes are mode `0700`; the runtime is `0770` under the group model and `0700` under the shared uid; the public key directory is world-readable.
    - `/opt/tk-app-home`, `/opt/tk-app-workspace`, `/opt/tk-gpg-broker`, `/opt/tk-gpg-runtime`, `/opt/tk-gpg-public`, and `/opt/tk-provisioner`
    - a dedicated prefix named in the answer, with those same modes
    - other

16. What images and runtime limits apply?
    - pinned application digest with `tk`, Git, and GnuPG; pinned broker digest; read-only root; `cap_drop: [ALL]`; broker `tmpfs` on `/tmp`; no published ports
    - OS users or VMs with no images, and the same read-only root and dropped capabilities
    - other

17. How does the application wait for the broker? `depends_on` is not readiness, and after shutdown the owned socket must be gone before a replacement starts.
    - start only after the path is a Unix socket with the model's owner, group, and mode
    - a supervisor that forwards SIGTERM to `tk` and requires that socket to be gone
    - both of those
    - `depends_on` or a sleep only
    - other

18. How is Git pointed at the socket? Import only after `show-only` finds exactly one `pub:`, the following `fpr:` is `FINGERPRINT`, and no `sec:` or `ssb:`.
    - `gpg.program` is `tk`, `TK_GPG_AGENT_SOCK` is set, and no `TK_PROFILE`
    - the same, plus `TK_GPG_PROGRAM` because `gpg` is not on `PATH`
    - `GIT_CONFIG_*` and a private `GNUPGHOME` because a human shares the OS user and `HOME`
    - other

19. Should the application install the co-author hook? Main docs require Git 2.54 or newer on every committing process, which this Mac has and the image may not.
    - yes, and `git hook list commit-msg` shows `turnkey-co-author`
    - no
    - the same choice as signing-git-commits, installed only in the application environment
    - other

20. Which committer identity should Git and the key user id use? Do not store a personal mailbox in the repo.
    - the user id already inside `FINGERPRINT`, unchanged
    - the main form `Name (agent)` and a plus-tagged address, supplied outside the repo and already on the key
    - a new key because that user-id email is not verified on the git host
    - other

21. Where is the armored public key published? `gpg keys export` runs as profile `broker` and proves the ALLOW.
    - `/opt/tk-gpg-public/FINGERPRINT.asc`, mounted read-only into the application
    - also a paste or `gh gpg-key add`, with no badge claim until the email is verified
    - not published beyond the broker home
    - other

22. Must socket loss fail closed, with no application credential and no second signing path?
    - yes
    - no
    - other

23. Which gates must pass before handoff?
    - the application mount is only the read-only runtime and the public key
    - the broker alone can write its home and the runtime
    - the provisioner alone has its home
    - a signed commit verifies
    - stopping the broker makes signing fail, and a restart plus a rotation can sign again
    - defer the manual gates
    - other

## Coverage

These answers fix the three boundaries, the `660` or `600` socket, the pinned `WALLET_ID` and `FINGERPRINT`, policies `brokers-no-credentials` and `brokers-sign-gpg`, the provisioner split, and the host that may hold the broker credential. Signing-git-commits chooses OpenPGP versus SSH and the direct signer; using-ssh chooses `--allow-namespace git`, `--allowed-hosts-file`, and where an SSH public key is published. This file chooses the GPG broker socket, the armored public key path, the co-author hook on the application, and when the Apple container test cannot host the layout.

answering these is sufficient for that skill.
