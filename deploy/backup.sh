#!/bin/sh
# Dump the local content-intel database and keep the 7 newest files.
set -eu

export PGHOST=127.0.0.1
export PGPORT=5433
export PGUSER="${POSTGRES_USER:-}"
export PGPASSWORD="${POSTGRES_PASSWORD:-}"
export PGDATABASE="${POSTGRES_DB:-}"

DEST=/backups
mkdir -p "$DEST"

dump_once() {
  stamp=$(date -u +%Y%m%d-%H%M)
  pg_dump -h 127.0.0.1 -p 5433 -Fc -f "$DEST/content_intel-${stamp}.dump"
  find "$DEST" -maxdepth 1 -type f -name 'content_intel-*.dump' | sort -r | awk 'NR>7' | while IFS= read -r old; do
    rm -f "$old"
  done
}

dump_once || echo "backup failed" >&2
while true; do
  sleep 86400
  dump_once || echo "backup failed" >&2
done
