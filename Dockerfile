FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    git \
    bash \
    curl \
    python3 \
    py3-pip \
    ffmpeg \
    su-exec \
    && apk add --no-cache --repository https://dl-cdn.alpinelinux.org/alpine/edge/community \
    github-cli \
    && npm install -g @anthropic-ai/claude-code@latest \
    && chmod -R a+rx /usr/local/lib/node_modules/@anthropic-ai

WORKDIR /app

# كسر الكاش باستخدام الرابط العشوائي
ADD "https://www.random.org/cgi-bin/randbyte?nbytes=10&format=h" skipcache

# نسخ المشروع من المجلد المحلي claudegram-main
COPY claudegram-main/. .

# Install dependencies
RUN npm install

# Build TypeScript
RUN npm run build

# Create workspace directory
RUN mkdir -p /workspace /data

# Copy and configure entrypoint
COPY claudegram-main/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Configure Claude Code
ENV CLAUDE_USE_BUNDLED_EXECUTABLE=true
ENV NODE_ENV=production

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "console.log('ok')" || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "start"]
