FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    git \
    bash \
    curl \
    python3 \
    py3-pip \
    ffmpeg \
    && apk add --no-cache --repository https://dl-cdn.alpinelinux.org/alpine/edge/community \
    github-cli \
    && npm install -g @anthropic-ai/claude-code@latest

WORKDIR /app

# كسر الكاش باستخدام الرابط العشوائي
ADD "https://www.random.org/cgi-bin/randbyte?nbytes=10&format=h" skipcache

# نسخ المشروع من المجلد المحلي claudegram-main
COPY claudegram-main/. .

# Install dependencies
RUN npm install

# Build TypeScript
RUN npm run build

# Create workspace directory and fix permissions for non-root user
RUN mkdir -p /workspace /data && \
    chmod -R a+rX /usr/local/lib/node_modules && \
    chmod a+x /usr/local/bin/node /usr/local/bin/claude 2>/dev/null || true && \
    chown -R node:node /app /workspace /data

# Configure Claude Code
ENV CLAUDE_USE_BUNDLED_EXECUTABLE=true
ENV NODE_ENV=production

# Switch to non-root user (required for --dangerously-skip-permissions)
USER node

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "console.log('ok')" || exit 1

CMD ["npm", "start"]
