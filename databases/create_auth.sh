#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
    echo "❌ Usage : $0 <DB_CONFIG>"
    echo "   Exemple : $0 kinocaen"
    exit 1
fi

DB_CONFIG="$(echo "$1" | tr '[:lower:]' '[:upper:]')"

echo DB_CONFIG: $DB_CONFIG

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

$PSQL -f $SCRIPT_DIR/auth.sql
bash "$SCRIPT_DIR/create_users.sh" $DB_CONFIG
