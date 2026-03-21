#!/bin/sh
set -e

# Fix runtime volume permissions (named volumes mount as root:root)
chown -R node:node /cursogram/workspace /home/node/.claudegram 2>/dev/null || true

# Drop to non-root user
exec su-exec node "$@"
