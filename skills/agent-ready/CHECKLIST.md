# Agent-ready decisions

Purpose: the live decision list for this skill. Decide every item before using the skill.
Change when: the skill, its CLI, or its docs change, or an item gets an `answered:` line.
Not for: the skill itself (`SKILL.md`), the questioning procedure (`skills/herdr/bootstrap.md`).

## Questions

1. What is the public entry?
- one TypeScript file, run with one `deno run` command
- a shell script
- a Python script

2. What does the entry hand the agent after the basics load?
- one explicit prompt the human and the agent work through
- a log line with no prompt
- nothing

3. Does agentready.org publish an official skill yet?
- no, follow this skill and the URLs it cites
- yes, vendor that package and do not rewrite it
