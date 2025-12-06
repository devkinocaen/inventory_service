#!/bin/bash
set -euo pipefail

# ===========================================
# Charger la config commune
# ===========================================


CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(( $# )) || { echo "❌ Usage: $0 <DB_CONFIG>"; exit 1; }
source "$CURRENT_SCRIPT_DIR/load_db_config.sh" $1

echo "🔄 Vidage de toutes les tables de la base '${DBNAME}'..."

#DB_CLIENT="neon"
# ===========================================
# Tables de la base reservable
# (ordre compatible avec contraintes FK)
# ===========================================
TABLES=(
  reservable_booking
  reservable_style_link
  reservable_color_link
  reservable_batch_link
  reservable_batch
  reservable
  reservable_subcategory
  reservable_category
  reservable_style
  storage_location
  booking_reference
  organization_person
  organization
  person
  color
  app_config
)

# ===========================================
# Boucle de suppression
# ===========================================
for table in "${TABLES[@]}"; do
  echo "🔄 Vidage de la table inventory.$table"
  $PSQL -c "TRUNCATE TABLE inventory.$table RESTART IDENTITY CASCADE;"
done

echo "✅ Toutes les tables ont été vidées et séquences réalignées avec succès."
