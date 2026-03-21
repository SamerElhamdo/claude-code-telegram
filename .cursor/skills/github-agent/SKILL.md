---
name: github-agent
description: Claudegram GitHub integration with dedicated org account. Use when setting up or troubleshooting GH_TOKEN, GITHUB_MCP_ENABLED, gh, git, or GitHub MCP in the Telegram bot.
---

# GitHub Agent Integration (Claudegram)

## Overview

Claudegram can use a dedicated GitHub org account for the agent. One PAT covers: **gh** (CLI), **git** (push/commit), and **GitHub MCP** (structured API tools).

## Setup

1. **Create PAT**: GitHub → Settings → Developer settings → Personal access tokens  
   - Scopes: `repo` (full), `read:org`, `workflow` (if using Actions)

2. **Environment variables** (`.env` or docker-compose):
   ```
   GH_TOKEN=ghp_xxxxxxxxxxxx
   GITHUB_MCP_ENABLED=true
   ```
   - `GITHUB_TOKEN` is optional; it defaults to `GH_TOKEN` when unset in docker-compose.

3. **Validation**: When `GITHUB_MCP_ENABLED=true`, either `GITHUB_TOKEN` or `GH_TOKEN` must be set.

## Tool order

For GitHub tasks:

- **MCP first**: `create_pull_request`, `create_file`, `search_repositories` — structured, fewer round-trips
- **gh second**: `gh pr create`, `gh repo clone`, `gh issue list` — when MCP doesn’t fit
- **git last**: `git commit`, `git push` — for direct repo ops; use `https://$GITHUB_TOKEN@github.com/org/repo.git` for remote when pushing

## Troubleshooting

- **gh not authenticated after redeploy**: Ensure `GH_TOKEN` is in docker-compose `environment` and persists across restarts.
- **MCP fails**: Confirm `GITHUB_MCP_ENABLED=true` and `@modelcontextprotocol/server-github` is reachable via `npx`.
