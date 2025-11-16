#!/usr/bin/env bash
set -euo pipefail

# ===========================================
# 0️⃣ Charger la config commune
# ===========================================
CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(( $# )) || { echo "❌ Usage: $0 <DB_CONFIG>"; exit 1; }
source "$CURRENT_SCRIPT_DIR/load_db_config.sh" $1

SQL_SCRIPTS_DIR=$ROOT_DIR/sql
SQL_TEST_SCRIPTS_DIR=$SQL_SCRIPTS_DIR/tests

# ===========================================
# 1️⃣ Supprimer les données existantes
# ===========================================
source $CURRENT_SCRIPT_DIR/truncate_all.sh
$PSQL -f $SQL_SCRIPTS_DIR/init_db.sql $1

# ===========================================
# 2️⃣ Création des lieux de stockage
# ===========================================
echo "▶ Étape 2 : Création des lieux de stockage..."
$PSQL -f $SQL_TEST_SCRIPTS_DIR/insert_storage_locations.sql

# ===========================================
# 3️⃣ Création des références de réservation
# ===========================================
echo "▶ Étape 3 : Création des références de réservation..."
$PSQL -f $SQL_TEST_SCRIPTS_DIR/insert_booking_references.sql

# ===========================================
# 4️⃣ Création des personnes
# ===========================================
echo "▶ Étape 4 : Création des personnes..."
CSV_PERSON_FILE="$SQL_SCRIPTS_DIR/tests/persons_data.csv"

# Créer la table temporaire et charger le CSV
$PSQL <<SQL
DROP TABLE IF EXISTS persons_temp_raw;

CREATE TEMP TABLE persons_temp_raw (
    first_name text,
    last_name text,
    email text,
    phone text
);

\copy persons_temp_raw FROM '$CSV_PERSON_FILE' CSV HEADER;

-- Nettoyage : suppression des lignes avec champs obligatoires vides
DELETE FROM persons_temp_raw
WHERE first_name IS NULL OR trim(first_name) = ''
   OR last_name IS NULL OR trim(last_name) = '';
SQL

# Appel du script PL/pgSQL qui insère dans inventory.person
$PSQL -f "$SQL_TEST_SCRIPTS_DIR/insert_persons.sql"

# ===========================================
# 5️⃣ Création des organisations
# ===========================================
echo "▶ Étape 5 : Création des organisations..."
CSV_ORG_FILE="$SQL_SCRIPTS_DIR/tests/organizations_data.csv"

# Créer la table temporaire et charger le CSV
$PSQL <<SQL
DROP TABLE IF EXISTS organizations_temp_raw;

CREATE TEMP TABLE organizations_temp_raw (
    name text,
    address text
);

\copy organizations_temp_raw FROM '$CSV_ORG_FILE' CSV HEADER;

-- Nettoyage : suppression des lignes avec champs obligatoires vides
DELETE FROM organizations_temp_raw
WHERE name IS NULL OR trim(name) = '';
SQL

# Appel du script PL/pgSQL qui insère dans inventory.organization
$PSQL -f "$SQL_TEST_SCRIPTS_DIR/insert_organizations.sql"

# ===========================================
# 6️⃣ Création des réservables (costumes & accessoires)
# ===========================================
echo "▶ Étape 6 : Création des réservables..."
CSV_RESERVABLE_FILE="$SQL_SCRIPTS_DIR/tests/reservables_data.csv"

$PSQL <<SQL
-- Suppression de la table temporaire si elle existe
DROP TABLE IF EXISTS reservable_temp_raw;

-- Création de la table temporaire correspondant au CSV simplifié
CREATE TEMP TABLE reservable_temp_raw (
    name text,
    size text,
    price_per_day text,
    description text,
    photo1 text,
    photo2 text,
    photo3 text
);

-- Import des données CSV
\copy reservable_temp_raw FROM '$CSV_RESERVABLE_FILE' CSV HEADER;

-- Nettoyage : suppression des lignes avec champs obligatoires vides
DELETE FROM reservable_temp_raw
WHERE name IS NULL OR trim(name) = ''
   OR size IS NULL OR trim(size) = '';

SQL

# Appel du script PL/pgSQL qui insère dans inventory.reservable
$PSQL -f "$SQL_TEST_SCRIPTS_DIR/insert_reservables.sql"


# ===========================================
# 7️⃣ Création des batches et liens
# ===========================================
echo "▶ Étape 7 : Création des batches et liens..."
$PSQL -f $SQL_TEST_SCRIPTS_DIR/insert_batches_and_links.sql

# ===========================================
# 8️⃣ Création des réservations factices
# ===========================================
echo "▶ Étape 8 : Création des réservations factices..."
$PSQL -f $SQL_TEST_SCRIPTS_DIR/insert_reservable_bookings.sql

# ===========================================
# 9️⃣ Réalignement des séquences
# ===========================================
echo "▶ Étape 9 : Mise à jour des séquences..."
$PSQL -f "$SQL_SCRIPTS_DIR/realign_serials.sql"

echo "✅ Script d'initialisation Costumerie terminé avec succès."
