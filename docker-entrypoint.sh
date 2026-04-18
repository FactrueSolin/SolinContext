#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/app/data}"
PROMPT_ASSET_DB_PATH="${PROMPT_ASSET_DB_PATH:-$DATA_DIR/app.db}"

mkdir -p "$DATA_DIR"
export DATA_DIR
export PROMPT_ASSET_DB_PATH

if [ "$(id -u)" = "0" ]; then
    chown -R nextjs:nodejs "$DATA_DIR"
    exec gosu nextjs "$@"
fi

exec "$@"
