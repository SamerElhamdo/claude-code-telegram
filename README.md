# Claude Code Telegram Bot – Dokploy + Ollama

Telegram bot that runs **Claude Code** (Claude Code CLI) on your server and talks to **Ollama** (local or cloud models) via **LiteLLM**. Deploy the full stack on **Dokploy** with one Docker Compose file.

---

## 1. What this project does

- Runs **Ollama** and **LiteLLM** in Docker so the bot uses Anthropic-compatible API calls against your chosen Ollama model.
- Runs **Claude Code** in a container and connects it to **Telegram** so you can:
  - Chat with the model about code or general questions.
  - Let it work inside a mounted project folder on the server.
  - Send images, PDFs, or voice messages and get analysis.

All services communicate on the internal Docker network; no public API keys are required for the model backend (only for Telegram and optional features).

---

## 2. Project layout

```
.
├── Dockerfile           # Builds the bot image (claude-code + claudegram)
├── docker-compose.yml   # Ollama + LiteLLM + claude-telegram
├── .env.example         # Environment variables template (copy to .env)
├── docs/
│   └── DOKPLOY-OLLAMA-LITELLM-TESTING.md   # Post-deploy test commands
└── README.md            # This guide
```

---

## 3. Prerequisites

- A **Dokploy** instance on your server.
- A **Telegram** account (for the bot and your user ID).
- No Anthropic account or API key; the backend is **Ollama only** (via LiteLLM).

---

## 4. Get required tokens and IDs

### 4.1 Create a Telegram bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot`.
3. Choose a name and a unique username.
4. Copy and save the **bot token** → use it as `TELEGRAM_BOT_TOKEN`.

### 4.2 Get your Telegram user ID

1. Open [@userinfobot](https://t.me/userinfobot).
2. Copy the **ID** → use it in `ALLOWED_USER_IDS` (comma-separated if you add more users).

---

## 5. Configure environment variables

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set at least:

   - **`TELEGRAM_BOT_TOKEN`** – from BotFather.
   - **`ALLOWED_USER_IDS`** – your Telegram ID (or comma-separated list).

   For the Ollama + LiteLLM backend:

   - **`ANTHROPIC_API_KEY`** – use a placeholder, e.g. `sk-dummy-key` (requests go to LiteLLM, not Anthropic).
   - **`ANTHROPIC_BASE_URL`** – must be `http://litellm:4000` so the bot talks to LiteLLM on the internal Docker network.
   - **`LITELLM_MASTER_KEY`** – optional; default in the stack is `sk-dummy-key`. Change it in both `.env` and the LiteLLM service if you set a custom key.

3. Optional:

   - `DANGEROUS_MODE` – keep `false` in production.
   - `TRANSCRIBE_ENABLED` + `GROQ_API_KEY` – voice message transcription.
   - `TTS_ENABLED` + `OPENAI_API_KEY` – text-to-speech replies.

### Environment variables reference

| Variable                 | Required | Description |
|--------------------------|----------|-------------|
| `TELEGRAM_BOT_TOKEN`     | Yes      | Bot token from BotFather |
| `ALLOWED_USER_IDS`      | Yes      | Comma-separated Telegram user IDs allowed to use the bot |
| `ANTHROPIC_API_KEY`     | Yes*     | Placeholder (e.g. `sk-dummy-key`) when using Ollama via LiteLLM |
| `ANTHROPIC_BASE_URL`     | Yes*     | `http://litellm:4000` so the bot uses LiteLLM inside Docker |
| `LITELLM_MASTER_KEY`    | No       | Master key for LiteLLM (default `sk-dummy-key`) |
| `DANGEROUS_MODE`        | No       | `false` by default (auto-approve tools when `true`) |
| `STREAMING_MODE`       | No       | `streaming` (default) or `wait` |
| `GROQ_API_KEY`         | No       | For Whisper voice transcription |
| `TRANSCRIBE_ENABLED`   | No       | `true` to enable voice-to-text |
| `TTS_ENABLED`          | No       | `true` to enable text-to-speech replies |
| `OPENAI_API_KEY`       | No       | Used when `TTS_ENABLED=true` |

\* For this setup you must set `ANTHROPIC_API_KEY` (placeholder) and `ANTHROPIC_BASE_URL=http://litellm:4000`.

---

## 6. Set the Ollama model in Docker Compose

In `docker-compose.yml`, the **litellm** service builds a config that maps Anthropic-style model names to an Ollama model. Replace the placeholder with your actual model name (e.g. `qwen2.5-coder:7b` or `qwen3:cloud`).

Find the two occurrences of `ollama/اسم_النموذج_الخاص_بك` (or the current placeholder) and set them to your model, for example:

- `ollama/qwen2.5-coder:7b`
- `ollama/llama3.2:latest`
- `ollama/qwen3:cloud` (if you use Ollama Cloud and have authenticated once; see below)

Redeploy after changing the Compose file.

---

## 7. Deploy on Dokploy

1. In Dokploy → **Create Service** → **Docker Compose**.
2. Paste the contents of `docker-compose.yml` (with your Ollama model name set as in section 6).
3. In **Environment Variables**, add the variables from your `.env` (at least `TELEGRAM_BOT_TOKEN`, `ALLOWED_USER_IDS`, `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, and optionally `LITELLM_MASTER_KEY` and others).
4. Click **Deploy** and wait until all three containers (ollama, litellm, claude-telegram) are running.

---

## 8. One-time Ollama setup (pull model and optional cloud auth)

If your chosen model is not yet pulled, or it is a cloud model (e.g. `qwen3:cloud`) that requires login:

1. Open a shell in the **ollama** container (Dokploy terminal for the service, or on the server: `docker exec -it ollama bash`).
2. Pull and run the model (this may prompt for cloud auth):
   ```bash
   ollama run qwen2.5-coder:7b
   ```
   Or for a cloud model:
   ```bash
   ollama run qwen3:cloud
   ```
   Follow any on-screen login steps; credentials are stored in the container’s volume.
3. When the model is loaded and you see the chat prompt, exit with `Ctrl+D`. The model stays available and auth is persisted via the `ollama_data` volume.

---

## 9. Mounting your project files (optional)

By default the bot uses an internal `/workspace` volume. To work on a real folder on the server, add a bind mount under the **claude-telegram** service in `docker-compose.yml`:

```yaml
volumes:
  - workspace:/workspace
  - data:/data
  - /path/on/server:/workspace   # override with your project path
```

---

## 10. Using the bot

- Open your Telegram bot (from BotFather).
- Send a text message → the bot replies using the Ollama model via LiteLLM.
- Send **/project** to choose or change the active project folder.
- Send an **image** or **PDF** for analysis.
- If voice is enabled, send a **voice message** to get transcription and a reply.

---

## 11. Testing and troubleshooting

See **`docs/DOKPLOY-OLLAMA-LITELLM-TESTING.md`** for:

- Checking container status.
- Testing Ollama and LiteLLM from the host or from inside the network.
- Viewing bot logs.
- Verifying Telegram and fixing common issues.

---

## 12. Security notes

- The bot uses **long polling**; no public webhook URL or open port is needed for Telegram.
- Volumes keep data (Ollama models, workspace, sessions) across restarts.
- Restrict **`ALLOWED_USER_IDS`** to people you trust; anyone with access can use the bot and thus the model and workspace.
- Keep **`DANGEROUS_MODE=false`** unless you explicitly want automatic approval of tool use.
