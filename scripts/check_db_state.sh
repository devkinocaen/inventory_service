 #!/bin/bash
set -euo pipefail

CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

(( $# )) || { echo "❌ Usage: $0 <DB_CONFIG>"; exit 1; }
source "$CURRENT_SCRIPT_DIR/load_db_config.sh" $1

SQL_SCRIPTS_DIR=$ROOT_DIR/sql


# Exécuter le script de vérification
$PSQL -f $SQL_SCRIPTS_DIR/check_db_state.sql

echo "Vérification de l'état de la base terminée avec succès."


# Récupérer la taille et l'afficher
DB_SIZE=$($PSQL -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));")

# Récupérer la taille actuelle en bytes pour le calcul
DB_SIZE_BYTES=$($PSQL -t -c "SELECT pg_database_size(current_database());")

# Quota Free Tier Neon : 0.5 GB = 524288000 bytes
MAX_QUOTA_BYTES=$((512 * 1024 * 1024))  # 512 MB en bytes

# Calculer l'espace libre estimé
FREE_BYTES=$((MAX_QUOTA_BYTES - DB_SIZE_BYTES))

# Afficher en MB et GB
FREE_MB=$((FREE_BYTES / 1024 / 1024))
FREE_GB=$(awk "BEGIN {printf \"%.2f\", $FREE_BYTES/1024/1024/1024}")

echo "Espace occupé :$DB_SIZE -- Espace libre estimé : $FREE_MB MB (~$FREE_GB GB)"

