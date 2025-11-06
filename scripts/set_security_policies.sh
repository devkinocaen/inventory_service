#!/bin/bash
set -euo pipefail

# ===========================================
# Charger la config commune
# ===========================================
CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(( $# )) || { echo "❌ Usage: $0 <DB_CONFIG>"; exit 1; }
source "$CURRENT_SCRIPT_DIR/load_db_config.sh" $1

SQL_SCRIPTS_DIR="$ROOT_DIR/sql"
POLICIES_FILE="$SQL_SCRIPTS_DIR/auth/policies.yaml"

# --- Tables du schema actuel ---
tables=(
  app_config
  person
  organization
  storage_location
  reservable_style
  reservable_category
  reservable_subcategory
  size_type
  size
  reservable
  reservable_style_link
  reservable_batch
  reservable_batch_link
  booking_reference
  reservable_booking
)

# --- Séquences associées ---
sequences=(
  "app_config_id_seq"
  "person_id_seq"
  "organization_id_seq"
  "storage_location_id_seq"
  "reservable_style_id_seq"
  "reservable_category_id_seq"
  "reservable_subcategory_id_seq"
  "size_type_id_seq"
  "size_id_seq"
  "reservable_id_seq"
  "reservable_batch_id_seq"
  "booking_reference_id_seq"
  "reservable_batch_link_batch_id_seq"
  "reservable_batch_link_reservable_id_seq"
  "reservable_booking_id_seq"
)

# --- Grant sur séquences ---
for seq in "${sequences[@]}"; do
  echo "GRANT usage/select/update sur $seq..."
  $PSQL -v ON_ERROR_STOP=1 -q -c "GRANT USAGE, SELECT, UPDATE ON SEQUENCE inventory.$seq TO $AUTHENTICATED_ROLE;" || true
done

# --- Réinitialiser droits existants et supprimer policies ---
for table in "${tables[@]}"; do
  echo "📌 Réinitialisation des droits sur $table"
  $PSQL -v ON_ERROR_STOP=1 -q -c "REVOKE ALL ON inventory.$table FROM $ANONYMOUS_ROLE, $AUTHENTICATED_ROLE;"

  policies=$(echo "SELECT policyname FROM pg_policies WHERE schemaname='inventory' AND tablename='${table}';" | $PSQL -t)
  for pol in $policies; do
    [[ -z "$pol" ]] && continue
    echo "DROP POLICY IF EXISTS \"$pol\" ON inventory.\"$table\";" | $PSQL
  done
done
