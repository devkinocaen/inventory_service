#!/usr/bin/env bash
set -euo pipefail


if [ $# -lt 1 ]; then
    echo "❌ Usage : $0 <DB_CONFIG>"
    echo "   Exemple : $0 kinocaen"
    exit 1
fi

DB_CONFIG="$(echo "$1" | tr '[:lower:]' '[:upper:]')"

# Charger les variables Supabase depuis env.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/env.sh"

# Vérifie que Python 3 est installé
command -v python3 >/dev/null 2>&1 || { echo "❌ Python3 requis"; exit 1; }

CSV_FILE=

if [ -z "${DB_CONFIG}" ]; then
  echo "❌ La variable DB_CONFIG n'est pas définie ou est vide"
  exit 1
else
  CSV_FILE="$SCRIPT_DIR/$DB_CONFIG/users.csv"
fi

if [ -f "$CSV_FILE" ]; then
    # Appelle le script Python
    python3 "$SCRIPT_DIR/create_users.py" --no-proxy $CSV_FILE
else
    echo "⚠️ Aucun fichier users.csv trouvé, création des utilisateurs ignorée."
fi
