# One public entry

Open <https://www.agentready.org> and the spec that site names: <https://github.com/agentready-org/standard>. Read the part about an agent being able to act. Do not paste it.

The entry is one TypeScript file. A stranger runs it with one command: `deno run` on the file, or `deno run` on its raw URL. Do not add a second entry. Do not add a Python file or a shell script for that entry.

The script loads the basics of the product. Then it hands an agent one explicit prompt. The prompt says what the human and the agent do next. Do not leave that step implied. Do not invent a grade, a secret, or a config key.

If agentready.org later publishes its own skill, vendor that package and stop using this file for the same job.
