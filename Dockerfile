FROM node:20-bookworm-slim AS base

# Install system dependencies (Debian for Cursor CLI compatibility)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    bash \
    curl \
    python3 \
    python3-pip \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI (from GitHub's package)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Install Cursor CLI (installs to ~/.local/bin)
RUN curl https://cursor.com/install -fsS | bash
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /app

# كسر الكاش باستخدام الرابط العشوائي
ADD "https://www.random.org/cgi-bin/randbyte?nbytes=10&format=h" skipcache

# نسخ المشروع من المجلد المحلي claudegram-main
COPY claudegram-main/. .

# Install dependencies
RUN npm install

# Build TypeScript
RUN npm run build

# Create Cursogram workspace (data volume mounts at ~/.claudegram at runtime)
RUN mkdir -p /cursogram/workspace

# Create non-root user and copy Cursor CLI for node (agent is a symlink to ~/.local/share)
# Must copy the full cursor-agent dir so symlinks resolve under node's HOME
ARG NODE_USER=node
RUN mkdir -p /home/${NODE_USER}/.local/bin /home/${NODE_USER}/.local/share \
    && cp -a /root/.local/share/cursor-agent /home/${NODE_USER}/.local/share/ \
    && CURSOR_VER=$(ls /root/.local/share/cursor-agent/versions/ 2>/dev/null | head -1) \
    && if [ -n "$CURSOR_VER" ]; then \
         ln -sf /home/${NODE_USER}/.local/share/cursor-agent/versions/${CURSOR_VER}/cursor-agent /home/${NODE_USER}/.local/bin/agent; \
       fi \
    && chown -R ${NODE_USER}:${NODE_USER} /home/${NODE_USER} /app /cursogram

# Entrypoint to fix volume permissions (must run as root during build)
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

USER ${NODE_USER}
ENV PATH="/home/${NODE_USER}/.local/bin:${PATH}"
ENV HOME=/home/${NODE_USER}

ENV NODE_ENV=production

# Container runs as root so entrypoint can chown; it then exec's as node
USER root
ENTRYPOINT ["/docker-entrypoint.sh"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "console.log('ok')" || exit 1

# Ensure PATH with agent is passed to node user (su may not inherit full env)
CMD ["su", "node", "-c", "export PATH=/home/node/.local/bin:$PATH && cd /app && npm start"]
