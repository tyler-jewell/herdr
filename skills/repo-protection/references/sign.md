# Sign on this machine

Read <https://github.com/github/docs/blob/3c5bf3cf00fe45d10ea24a5a42011bbd84cbcef2/content/authentication/managing-commit-signature-verification/about-commit-signature-verification.md>. The machine is ready when all of these hold:

- `git config --get commit.gpgsign` is `true`.
- `git config --get gpg.format` is `ssh`.
- `git config --get user.signingkey` is set. Leave `gpg.ssh.program` as it is when it is already set.
- `GET /user/ssh_signing_keys` lists that public key. When it does not, `POST /user/ssh_signing_keys` with the public key and a title. That call needs the token scope `admin:ssh_signing_key`. Ask the person to approve the scope. Do not print a token or a private key, and do not commit the public key.
- The commit you just pushed has `verified: true` and `reason: valid` from `GET /repos/{owner}/{repo}/commits/{sha}`.

A local `git log` check can fail while the host check succeeds, because this machine may have no allowed signers file. The host check is the one that counts.
