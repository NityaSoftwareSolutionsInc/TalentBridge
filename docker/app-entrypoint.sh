#!/bin/sh
set -e
# Named volumes remount over the image dir and are often root-owned.
# Ensure the nextjs user can write uploaded resumes.
mkdir -p /data/uploads
chown -R nextjs:nodejs /data/uploads || true
chmod -R u+rwX /data/uploads || true
exec su-exec nextjs "$@"
