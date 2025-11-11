#!/usr/bin/env bash
set -euo pipefail

# ===========================================
# Charger la config commune
# ===========================================
CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(( $# )) || { echo "❌ Usage: $0 <DB_CONFIG>"; exit 1; }
source "$CURRENT_SCRIPT_DIR/load_db_config.sh" $1
SQL_SCRIPTS_DIR=$ROOT_DIR/sql
SQL_TEST_SCRIPTS_DIR=$SQL_SCRIPTS_DIR/tests

# ===========================================
# Supprimer les données déjà ajoutées
# ===========================================
source $CURRENT_SCRIPT_DIR/truncate_all.sh
$PSQL -f $SQL_SCRIPTS_DIR/init_db.sql $1

echo "▶ Étape 1 : Création des organisations..."
$PSQL -f $SQL_TEST_SCRIPTS_DIR/insert_organizations.sql

echo "▶ Étape 2 : Création des lieux de stockage..."
$PSQL -f $SQL_TEST_SCRIPTS_DIR/insert_storage_locations.sql

echo "▶ Étape 3 : Création des références de réservation..."
$PSQL -f $SQL_TEST_SCRIPTS_DIR/insert_booking_references.sql

echo "▶ Étape 4 : Création des participants/persons..."
$PSQL -f $SQL_TEST_SCRIPTS_DIR/insert_persons.sql

echo "▶ Étape 5 : Création des réservables (costumes & accessoires)..."
CSV_RESERVABLE_FILE="$SQL_SCRIPTS_DIR/tests/reservables_data.csv"

# 1️⃣ Créer la table temporaire et charger le CSV
$PSQL <<SQL
DROP TABLE IF EXISTS reservable_temp_raw;

CREATE TEMP TABLE reservable_temp_raw (
    name text,
    inventory_type text,
    status text,
    owner_id text,
    manager_id text,
    storage_location_id text,
    category text,
    subcategory text,
    size_label text,
    gender text,
    price_per_day text,   -- texte pour accepter toutes les valeurs CSV
    description text,
    photo_url1 text,
    photo_url2 text,
    photo_url3 text,
    privacy text          -- texte, casté ensuite
);



\copy reservable_temp_raw FROM '$CSV_RESERVABLE_FILE' CSV HEADER;

-- Nettoyage : suppression des lignes avec champs obligatoires vides
DELETE FROM reservable_temp_raw
WHERE name IS NULL OR trim(name) = ''
   OR inventory_type IS NULL OR trim(inventory_type) = '';
SQL

# 2️⃣ Appel du script PL/pgSQL qui insère dans inventory.reservable
$PSQL -f "$SQL_SCRIPTS_DIR/tests/insert_reservables.sql"



echo "▶ Étape 6 : Création des batches et liens..."
$PSQL -f $SQL_TEST_SCRIPTS_DIR/insert_batches_and_links.sql

echo "▶ Étape 7 : Création des réservations factices..."
$PSQL -f $SQL_TEST_SCRIPTS_DIR/insert_reservable_bookings.sql

echo "▶ Étape 8 : Mise à jour des séquences..."
$PSQL -f "$SQL_SCRIPTS_DIR/realign_serials.sql"

echo "✅ Script d'initialisation costumerie terminé avec succès."
