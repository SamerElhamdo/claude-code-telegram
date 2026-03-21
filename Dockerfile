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

# Clone claudegram
RUN git clone https://github.com/mdnahidhossain-kk/claudegram.git .

# Install dependencies
RUN npm install

# Build TypeScript
RUN npm run build

# Create workspace directory
RUN mkdir -p /workspace /data

# Configure Claude Code to use API key (non-interactive)
ENV CLAUDE_USE_BUNDLED_EXECUTABLE=true
ENV NODE_ENV=production

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "console.log('ok')" || exit 1

CMD ["npm", "start"]
