#!/bin/bash
set -e

# ===========================================
# Charger la config commune
# ===========================================
CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(( $# )) || { echo "❌ Usage: $0 <DB_CONFIG>"; exit 1; }
source "$CURRENT_SCRIPT_DIR/load_db_config.sh" $1


# Charger la fonction test_integrity depuis le fichier SQL (la création de fonction)
$PSQL -f $SQL_SCRIPTS_DIR/tests/integrity_test.sql

# Lancer la fonction test_integrity() dans une transaction avec rollback
$PSQL -c "BEGIN; SELECT test_integrity(); ROLLBACK;"

echo "Script terminé avec succès."
