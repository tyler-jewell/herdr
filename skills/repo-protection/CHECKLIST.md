# Checklist

This is the live checklist for this skill. Decide every item before using the skill. The lock is `skills/repo-protection/references/policy.json`.

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
- a signature the host verifies
- no signature
answered: a signature the host verifies

4. May a branch be force-pushed?
- no
- yes, except the default branch
answered: no

5. How does the default branch move?
- a pull request, squash or rebase, after the status checks named in the policy
- a direct push
- a merge commit
answered: a pull request, squash or rebase, after the status checks named in the policy

6. Who may create, move, or delete a tag?
- the admin creates a tag, and nobody moves or deletes one
- anyone with write access may move a tag
answered: the admin creates a tag, and nobody moves or deletes one

7. How does this machine sign?
- SSH, with `commit.gpgsign` true and the public key registered on the account
- unsigned
answered: SSH, with `commit.gpgsign` true and the public key registered on the account

8. What may the workflow token do?
- read the repository, and it cannot approve a review
- write the repository
answered: read the repository, and it cannot approve a review
