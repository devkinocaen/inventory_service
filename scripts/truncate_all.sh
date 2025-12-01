#!/bin/bash
set -euo pipefail

# ===========================================
# Charger la config commune
# ===========================================


CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(( $# )) || { echo "❌ Usage: $0 <DB_CONFIG>"; exit 1; }
source "$CURRENT_SCRIPT_DIR/load_db_config.sh" $1

echo "🔄 Vidage de toutes les tables de la base '${DBNAME}'..."

DB_CLIENT="neon"
# ===========================================
# Tables de la base reservable
# (ordre compatible avec contraintes FK)
# ===========================================
TABLES=(
  reservable_booking
  reservable_batch
  reservable_style_link
  reservable
  reservable_subcategory
  reservable_category
  reservable_style
  storage_location
  booking_reference
  organization
  person
  app_config
)

# ===========================================
# Boucle de suppression
# ===========================================
for table in "${TABLES[@]}"; do
  echo "🔄 Vidage de inventory.$table ($DB_CLIENT)"
  if [[ "$DB_CLIENT" == *render* ]]; then
    # --- Variante Render (pas de TRUNCATE CASCADE autorisé)
    $PSQL -c "DELETE FROM inventory.$table;"

    # Reset séquence si colonne SERIAL
    id_col=$($PSQL -Atc "SELECT column_name FROM information_schema.columns WHERE table_name='$table' AND column_default LIKE 'nextval(%' LIMIT 1;")
    if [ -n "$id_col" ]; then
      seq_name=$($PSQL -Atc "SELECT pg_get_serial_sequence('inventory.$table', '$id_col');")
      if [ -n "$seq_name" ]; then
        echo "🔄 Reset sequence $seq_name"
        $PSQL -c "SELECT setval('$seq_name', COALESCE((SELECT MAX($id_col) FROM inventory.$table), 0) + 1, false);"
      fi
    fi
  else
    # --- Variante locale ou Neon
    $PSQL -c "TRUNCATE TABLE inventory.$table RESTART IDENTITY CASCADE;"
  fi
done

echo "✅ Toutes les tables ont été vidées et séquences réalignées avec succès."
