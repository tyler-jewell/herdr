# Sign on this machine

Read <https://github.com/github/docs/blob/3c5bf3cf00fe45d10ea24a5a42011bbd84cbcef2/content/authentication/managing-commit-signature-verification/about-commit-signature-verification.md>.

`./apply` only manages Herdr's `config.toml` and never modifies git or SSH settings. When configuring or verifying commit signing on a machine, secret and key material is handled through `tk` (`skills/turnkey-tk/SKILL.md`) or the machine's existing SSH signer (`gpg.ssh.program`). Never print a private key or token, and never commit a key into this repository.

A machine is ready to sign commits when all of these hold:

- `git config --get commit.gpgsign` is `true`.
- `git config --get gpg.format` is `ssh`.
- `git config --get user.signingkey` is set, and any configured `gpg.ssh.program` (such as `tk` or the host SSH signer) is preserved.
- `GET /user/ssh_signing_keys` lists that public key. If missing, register it via `POST /user/ssh_signing_keys` after asking the human to approve the `admin:ssh_signing_key` token scope.
- `GET /repos/{owner}/{repo}/commits/{sha}` reports `verified: true` and `reason: valid` on the pushed commit (host verification is authoritative even if local `git log --show-signature` lacks an allowed-signers file).
