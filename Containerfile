# Purpose: the sandbox image for ./evals.ts: Debian with what a non-root Herdr install needs, Deno to run
#   checks.ts and agent.ts, and Pi for the agent eval.
# Change when: a tool the sandbox needs is added, removed, or re-pinned.
# Not for: isolation flags (evals.ts), what runs inside (checks.ts, agent.ts), Herdr itself (apply installs it).
FROM docker.io/library/debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git bash unzip xz-utils && rm -rf /var/lib/apt/lists/*
# Deno under /usr/local so uid 1000 can run it.
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s -- --yes --no-modify-path 2>&1
# Node from nodejs.org (Pi needs 20.6 or newer; Debian ships 18), then Pi from npm, both pinned.
ARG NODE_VERSION=22.12.0
RUN arch=$(dpkg --print-architecture | sed 's/amd64/x64/') && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${arch}.tar.xz" | tar -xJ -C /usr/local --strip-components=1
RUN npm install -g @mariozechner/pi-coding-agent@0.73.1 && npm cache clean --force
# A name for uid 1000, so the shell and git find a user.
RUN useradd -u 1000 -M -d /home/tester -s /bin/bash tester

USER tester
WORKDIR /home/tester
