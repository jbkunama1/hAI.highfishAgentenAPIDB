#!/bin/sh
BACKUP_DIR="/backup"
DB_PATH="${DB_PATH:-/data/highfish.db}"
KEEP=3
mkdir -p "$BACKUP_DIR"
DAY=$(date +%u)
DUMP_FILE="$BACKUP_DIR/dump_${DAY}.sql"
ls -1t "$BACKUP_DIR"/dump_*.sql 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
sqlite3 "$DB_PATH" ".dump" > "$DUMP_FILE"
