# Checklist

Purpose: the live decision list for this skill. Decide every item before using the skill. The lock is `skills/repo-protection/references/policy.json`.
Change when: the skill, its CLI, or its docs change, or an item gets an `answered:` line.
Not for: the skill itself (`SKILL.md`), the questioning procedure (`skills/herdr/bootstrap.md`).

## Questions

1. Who may push or delete a branch?
- only the authenticated admin
- any collaborator
- the public
answered: only the authenticated admin

2. Can the public read, clone, and fork?
- yes
- no
answered: yes

3. What does a new commit need?
- a signature the host verifies (`signed-history` ruleset with `bypass: "none"`)
- no signature
answered: a signature the host verifies (`signed-history` ruleset with `bypass: "none"`)

4. May a branch be force-pushed?
- no (`non_fast_forward` enforced on all branches with `bypass: "none"`)
- yes, except the default branch
answered: no (`non_fast_forward` enforced on all branches with `bypass: "none"`)

5. How does `main` move?
- pull request (`merge`, `squash`, or `rebase`) after `linux` and `macos` status checks, with `authenticated-user` bypass allowed for signed fast-forward commits
- unsigned or force-pushed commits
answered: pull request (`merge`, `squash`, or `rebase`) after `linux` and `macos` status checks, with `authenticated-user` bypass allowed for signed fast-forward commits

6. Who may create, move, or delete a tag?
- the authenticated admin creates tags, and nobody moves or deletes a tag (`immutable-tags` has `bypass: "none"`)
- anyone with write access may move a tag
answered: the authenticated admin creates tags, and nobody moves or deletes a tag (`immutable-tags` has `bypass: "none"`)

7. How does this machine sign commits?
- SSH signing (`commit.gpgsign = true`, `gpg.format = ssh`) using `tk` for Turnkey-managed keys or the machine's configured `gpg.ssh.program`, with the public key registered on GitHub and without `./apply` mutating git config
- unsigned commits or keys stored in the repository
answered: SSH signing (`commit.gpgsign = true`, `gpg.format = ssh`) using `tk` for Turnkey-managed keys or the machine's configured `gpg.ssh.program`, with the public key registered on GitHub and without `./apply` mutating git config

8. What may the workflow token do?
- read the repository (`contents: read`), with action SHA pinning required and no pull-request review approval
- write the repository
answered: read the repository (`contents: read`), with action SHA pinning required and no pull-request review approval
