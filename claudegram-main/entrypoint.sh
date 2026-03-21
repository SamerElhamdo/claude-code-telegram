#!/bin/sh
set -e

# Fix runtime volume permissions (named volumes mount as root:root)
chown -R node:node /workspace /data 2>/dev/null || true

# Drop to non-root user (required for --dangerously-skip-permissions)
exec su-exec node "$@"
