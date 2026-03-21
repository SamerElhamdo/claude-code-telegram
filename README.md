# Claude Code Telegram Bot – Dokploy Setup

Telegram bot that lets you control **Claude Code** (Claude Code CLI) from your phone, deployed on **Dokploy**. Based on [Claudegram](https://claudegram.com).

---

## 1. What this project does

- **Run Claude Code in Docker** on your server (via Dokploy).
- **Connect it to Telegram** so you can:
  - Chat with Claude about code or general questions.
  - Let Claude work inside a mounted project folder on the server.
  - Send images / PDFs or voice messages and get analysis.
- **GitHub integration** — Persistent `gh` and `git` auth via `GH_TOKEN`; optional GitHub MCP for PRs, issues, and repo search.
- **Multiple sessions in parallel** — Use Telegram groups with Forum Topics for independent sessions per topic.

---

## 2. Project structure

```
.
├── Dockerfile          # Builds the image (copies claudegram-main, installs gh, claude-code)
├── docker-compose.yml  # Defines the claude-telegram service
├── .env.example        # Environment variables template (copy to .env)
├── README.md           # This guide
└── claudegram-main/    # Claudegram source (bundled in this repo)
    ├── src/
    ├── package.json
    └── ...
```

The Dockerfile copies from the local `claudegram-main/` folder — no `git clone` at build time.

---

## 3. Prerequisites

- A running **Dokploy** instance connected to your server.
- A **Telegram** account.
- An **Anthropic** account with API key or Claude Code OAuth token.

---

## 4. Get required tokens/IDs

### 4.1 Create a Telegram bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot`.
3. Choose a name and a unique username.
4. Copy and save the **bot token** – you will use it as `TELEGRAM_BOT_TOKEN`.

### 4.2 Get your Telegram User ID

1. Open [@userinfobot](https://t.me/userinfobot).
2. Copy the displayed **ID** – you will use it in `ALLOWED_USER_IDS`.

### 4.3 Get Anthropic credentials

You can authenticate Claude in **one** of two ways:

- **Option A – Anthropic API key (simpler):**
  1. Go to [console.anthropic.com](https://console.anthropic.com/).
  2. Create an API key.
  3. Use it as `ANTHROPIC_API_KEY`.

- **Option B – Claude Code OAuth token (for Claude Pro/Max users):**
  1. On your local machine run:
     ```bash
     claude login
     claude setup-token
     ```
  2. Copy the generated token (starts with `sk-ant-oat01-...`).
  3. Use it as `CLAUDE_CODE_OAUTH_TOKEN`.

Only **one** of `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` should be set.

---

## 5. Configure `.env`

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in at least:

   - `TELEGRAM_BOT_TOKEN` – from BotFather.
   - `ALLOWED_USER_IDS` – your Telegram ID (or comma‑separated list).
   - **One** of:
     - `ANTHROPIC_API_KEY`
     - `CLAUDE_CODE_OAUTH_TOKEN`

3. Optionally adjust:

   - `DANGEROUS_MODE` – keep `false` for safety (recommended).
   - `TRANSCRIBE_ENABLED` + `GROQ_API_KEY` – to enable voice message transcription.
   - `TTS_ENABLED` + `OPENAI_API_KEY` – to let the bot reply with audio.
   - `GH_TOKEN` + `GITHUB_MCP_ENABLED` – for persistent GitHub auth (gh, git, MCP).

### Environment variables reference

| Variable              | Required | Description                                             |
|-----------------------|----------|---------------------------------------------------------|
| `TELEGRAM_BOT_TOKEN`  | Yes      | Bot token from BotFather                               |
| `ALLOWED_USER_IDS`    | Yes      | Comma‑separated Telegram IDs allowed to use the bot    |
| `ANTHROPIC_API_KEY`   | Yes\*    | Anthropic API key (if not using OAuth token)           |
| `CLAUDE_CODE_OAUTH_TOKEN` | Yes\*| OAuth token from `claude setup-token` (if not using API key) |
| `DANGEROUS_MODE`      | No       | `false` by default (auto‑approve tools when `true`)    |
| `STREAMING_MODE`      | No       | `streaming` (default) or `wait`                        |
| `GROQ_API_KEY`        | No       | For Whisper transcription of voice messages            |
| `TRANSCRIBE_ENABLED`  | No       | `true` to enable voice‑to‑text                         |
| `TTS_ENABLED`         | No       | `true` to enable text‑to‑speech replies                |
| `OPENAI_API_KEY`      | No       | Used when `TTS_ENABLED=true`                           |
| `GH_TOKEN`            | No       | GitHub PAT – gh and git auth (persists across redeploys) |
| `GITHUB_MCP_ENABLED`  | No       | `true` to enable GitHub MCP (PRs, issues, search)      |
| `DOKPLOY_MCP_ENABLED` | No       | `true` + `DOKPLOY_URL` + `DOKPLOY_API_KEY` for Dokploy MCP |

(\*) Exactly one of `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` must be provided.

---

## 6. Deploy on Dokploy

You have two options.

### 6.1 Using Docker Compose (paste file)

1. In Dokploy → **Create Service** → **Docker Compose**.
2. Paste the contents of `docker-compose.yml`.
3. In the **Environment Variables** section, add all keys from your `.env`.
4. Click **Deploy**.

### 6.2 Using a GitHub repository

1. Push this folder (with `Dockerfile`, `docker-compose.yml`, `.env.example`, `README.md`) to GitHub.
2. In Dokploy → **Create Service** → **Application**.
3. Choose **Docker Compose** and link your repository.
4. Set the environment variables from `.env` in Dokploy.
5. Click **Deploy**.

---

## 7. Mounting your project files (optional but recommended)

By default, the container has its own internal `/workspace` volume.  
To let Claude work on real projects on your server, edit the `volumes` section in `docker-compose.yml`:

```yaml
services:
  claude-telegram:
    volumes:
      - workspace:/workspace          # default internal volume
      # Add this line to mount a real folder from your server:
      # - /path/on/server:/workspace
```

Example:

```yaml
volumes:
  workspace:
    driver: local
  data:
    driver: local
```

---

## 8. Using the bot

Once the service is running and healthy:

- Open your Telegram bot (the one from BotFather).
- Chat normally in text → **Claude Code** will reply using your configured model.
- Send `/project` → choose or change the active project folder.
- Send an **image** or **PDF** → Claude will analyze its content.
- Send a **voice message** (if `TRANSCRIBE_ENABLED=true`) → it is transcribed and answered.
- `/plan`, `/explore`, `/loop` — different agent modes for complex tasks.
- `/sessions`, `/resume`, `/continue` — manage and restore sessions.

### Parallel sessions (Forum Topics)

Use a Telegram **group with Forum Topics** enabled. Each topic = independent session. You can run different tasks in parallel (e.g. topic "frontend" and topic "backend" at the same time).

---

## 9. GitHub integration (optional)

Set `GH_TOKEN` and optionally `GITHUB_MCP_ENABLED=true` to give Claude persistent GitHub access:

- **gh** — Authenticated via `GH_TOKEN`; no `gh auth login` needed after each deploy.
- **git** — Push/commit using the same token in remote URLs.
- **GitHub MCP** — Create PRs, issues, search repos via MCP tools.

Create a [Personal Access Token](https://github.com/settings/tokens) with scopes: `repo`, `read:org`, and optionally `workflow`. Add to `.env`:

```env
GH_TOKEN=ghp_xxxxxxxxxxxx
GITHUB_MCP_ENABLED=true
```

---

## 10. Notes & security

- The bot uses **long polling** – no public IP or open port is required.
- Volumes ensure data persists between restarts (sessions, workspace, etc.).
- Keep `ALLOWED_USER_IDS` restricted to **your IDs only** – anyone with access to the bot can indirectly run commands through Claude.
- Keep `DANGEROUS_MODE=false` unless you know exactly what you are doing.
