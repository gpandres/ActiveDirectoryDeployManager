#!/bin/sh
# Read the DB password secret as root, then drop privileges to
# the unprivileged "app" user before exec'ing node. This avoids
# the Compose-non-Swarm limitation where secret file mode/uid
# directives are silently ignored and the file ends up owned
# root:root 0660, unreadable by a non-root app user.
set -e

if [ -n "$DB_PASS_FILE" ] && [ -r "$DB_PASS_FILE" ]; then
  DB_PASS="$(cat "$DB_PASS_FILE")"
  export DB_PASS
  unset DB_PASS_FILE
fi

# Hand off to node as "app". su-exec is alpine's tiny gosu-equivalent.
exec su-exec app:app node src/server.js
