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
$PSQL -f $SQL_TEST_SCRIPTS_DIR/insert_reservables.sql

echo "▶ Étape 6 : Création des batches et liens..."
$PSQL -f $SQL_TEST_SCRIPTS_DIR/insert_batches_and_links.sql

echo "▶ Étape 7 : Création des réservations factices..."
$PSQL -f $SQL_TEST_SCRIPTS_DIR/insert_reservable_bookings.sql

echo "▶ Étape 8 : Mise à jour des séquences..."
$PSQL -f "$SQL_TEST_SCRIPTS_DIR/realign_serials.sql"

echo "✅ Script d'initialisation costumerie terminé avec succès."
