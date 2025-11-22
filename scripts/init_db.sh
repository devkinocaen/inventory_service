#!/usr/bin/env bash
set -euo pipefail


# ===========================================
# Charger la config commune
# ===========================================
CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(( $# )) || { echo "❌ Usage: $0 <DB_CONFIG>"; exit 1; }
source "$CURRENT_SCRIPT_DIR/load_db_config.sh" $1

SQL_SCRIPTS_DIR="$ROOT_DIR/sql"


# Vérifie que les fichiers SQL existent
for f in "$SQL_SCRIPTS_DIR/init_db.sql";  do
    [ -f "$f" ] || { echo "❌ Fichier SQL introuvable : $f"; exit 1; }
done


echo "🔹 Current PostgreSQL user: ${DBUSER}"
$PSQL -c "SELECT current_user;"
# SET ROLE avec guillemets (protège si DBUSER contient des tirets)
$PSQL -c "SET ROLE \"${DBUSER}\";"
$PSQL -c "SELECT current_user;"
$PSQL -c "SET client_encoding = 'UTF8';"
$PSQL -f "$SQL_SCRIPTS_DIR/init_db.sql"
