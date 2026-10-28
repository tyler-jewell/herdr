# Contributing

These rules apply to every change, including changes made by an agent. A change that does not follow them is not done.

The point of this repo is that Tyler's computers run the same Herdr setup. `./apply` is how a change leaves git and lands on a machine. A patch that edits a live config, documents a manual step, or only updates one computer is incomplete.

## Goals

1. One script, `apply`, works on macOS, Linux, and Windows Git Bash. An OS it cannot handle exits with `status: failed` and a `next` step. It does not write a guessed path.
2. One config, `config/config.toml`. Machines converge by copying that file. They do not merge.
3. `./apply` is idempotent. A second run on a good machine reports `changed: false` and writes no backup.
4. Replacing a different existing config always keeps a backup first. If the backup cannot be written, the live file stays.
5. Failure and partial success always print the JSON report, including `next`.
6. A machine is good only after `./apply` exits `0` and the destination file matches `config/config.toml`. "It should be fine" is not a good machine.
7. Every client that uses this setup gets the change by running `./apply` from a current checkout. Shipping the git commit is not shipping the setup.

## Required for every change

- Behavior changes land in `apply` or `config/config.toml`, not in a side path.
- When the applied config's meaning changes, bump `SETUP_VERSION` in `apply` and the `herdr-setup:` line in `config/config.toml` together. Old machines stay identifiable until they apply.
- Keys must be real Herdr config keys from <https://herdr.dev/docs/config-reference/>. Do not invent keys. Herdr silently falls back on invalid values and the machine looks configured when it is not.
- `./tests/apply_test.sh` passes. Add a check for new branch behavior (a new OS path, a new refusal, a new exit code).
- Say which systems you ran. The test script is mandatory. A real `./apply` on a machine you can use is required when the change affects install, reload, or a live path.
- After the change is on `main`, run `./apply` on each Herdr machine you are responsible for, and keep the JSON. A machine you cannot reach stays listed as not updated. Do not claim the herd is current.

## Out of scope

- Herdr product bugs. Report those upstream.
- Dotfiles other than this Herdr config.
- Per-machine exceptions inside `config.toml`. If a machine truly needs a different value, stop and ask. Silent forks are how the herd splits.
- Force-pushing `main`, or editing a machine's config as a shortcut around a failing test.

## Pull requests

Explain the setting in one paragraph: what a person sees in Herdr, and why it is the default for every machine. Paste the test result. List machines where `./apply` has already been run, and machines still pending.

Agents do not merge their own change and then hand-edit a client to match. The client runs `./apply`.
