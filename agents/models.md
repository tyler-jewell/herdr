# Models

Grades for models that have run a Herdr agent. `where` is `local` or `cloud`. A cell is a grade from `agents/independent-reviewer.md`, or empty when that model has not been scored. Do not invent a grade.

`skill calling` is the basic case: one turn, prompt exactly `/bootstrap`, context only `skills/herdr/bootstrap.md`.

| model | where | skill calling |
| --- | --- | --- |
| qwen2.5-coder-3b-instruct-q8_0 | local | D |

That local run returned the skill text and did not start the skill's first step. No cloud model has a grade yet. A cloud model uses this same table with `where` set to `cloud`.
