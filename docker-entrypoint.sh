#!/bin/bash
set -e
# Ensure volumes are writable by node (named volumes mount as root)
chown -R node:node /cursogram/workspace /home/node/.claudegram 2>/dev/null || true
exec "$@"
