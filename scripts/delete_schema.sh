#!/usr/bin/env bash
set -euo pipefail

# ===========================================
# Charger la config commune
# ===========================================
CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(( $# )) || { echo "❌ Usage: $0 <DB_CONFIG>"; exit 1; }
source "$CURRENT_SCRIPT_DIR/load_db_config.sh" $1

SQL_SCRIPTS_DIR="$ROOT_DIR/sql"


# Supprimer toutes les fonctions existantes (optionnel)
$PSQL -f "$SQL_SCRIPTS_DIR/drop_all_functions.sql"

echo "Suppression des triggers et fonctions..."
$PSQL -v ON_ERROR_STOP=1 -q -c "DROP TRIGGER IF EXISTS trg_check_category_consistency ON reservable;"
$PSQL -v ON_ERROR_STOP=1 -q -c "DROP TRIGGER IF EXISTS update_app_config_timestamp ON app_config;"
$PSQL -v ON_ERROR_STOP=1 -q -c "DROP FUNCTION IF EXISTS check_reservable_category_consistency();"

echo "Suppression des tables..."
tables=(
    "app_config"
    "person"
    "color"
    "organization"
    "organization_person"
    "storage_location"
    "reservable_style"
    "booking_reference"
    "reservable_category"
    "reservable_subcategory"
    "size_type"
    "size"
    "reservable"
    "reservable_style_link"
    "reservable_batch"
    "reservable_batch_link"
    "reservable_booking"
    "reservable_color"
)


for table in "${tables[@]}"; do
    echo "Dropping table $table..."
    $PSQL -v ON_ERROR_STOP=1 -q -c "DROP TABLE IF EXISTS inventory.$table CASCADE;"
done

echo "Suppression des types ENUM..."
enums=(
    "reservable_gender"
    "privacy_type"
    "reservable_type"
    "reservable_status"
    "reservable_batch_status"
    "reservable_quality"
)

for enum in "${enums[@]}"; do
    echo "Dropping type $enum..."
    $PSQL -v ON_ERROR_STOP=1 -q -c "DROP TYPE IF EXISTS inventory.$enum;"
done

echo "✅ Toutes les tables et types ont été supprimés."
