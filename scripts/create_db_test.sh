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

$PSQL <<SQL
-- ===========================================
-- 1️⃣ Table temporaire + import CSV
-- ===========================================
DROP TABLE IF EXISTS persons_temp_raw;

CREATE TEMP TABLE persons_temp_raw (
    first_name text,
    last_name text,
    email text,
    phone text
);

\copy persons_temp_raw FROM '$CSV_PERSON_FILE' CSV HEADER;

DELETE FROM persons_temp_raw
WHERE first_name IS NULL OR trim(first_name) = ''
   OR last_name IS NULL OR trim(last_name) = '';

-- ===========================================
-- 2️⃣ Appel du script d’insertion
-- ===========================================
\ir $SQL_TEST_SCRIPTS_DIR/insert_persons.sql

SQL

# ===========================================
# 5️⃣ Création des organisations
# ===========================================
echo "▶ Étape 5 : Création des organisations..."
CSV_ORG_FILE="$SQL_SCRIPTS_DIR/tests/organizations_data.csv"

# Exécution dans UNE SEULE session psql
$PSQL -v ON_ERROR_STOP=1 <<SQL
\echo '➡ Création de la table temporaire organizations_temp_raw'

DROP TABLE IF EXISTS organizations_temp_raw;

CREATE TEMP TABLE organizations_temp_raw (
    name text NOT NULL,
    address text
);

\echo '➡ Import du CSV'
\copy organizations_temp_raw FROM '$CSV_ORG_FILE' CSV HEADER;

\echo '➡ Nettoyage des entrées vides'
DELETE FROM organizations_temp_raw
WHERE name IS NULL OR trim(name) = '';

\echo '➡ Appel du script insert_organizations.sql'
\ir $SQL_TEST_SCRIPTS_DIR/insert_organizations.sql

SQL

echo "✔ Étape 5 terminée."

# ===========================================
# 6️⃣ Création des réservables (costumes & accessoires)
# ===========================================
echo "▶ Étape 6 : Création des réservables..."
CSV_RESERVABLE_FILE="$SQL_SCRIPTS_DIR/tests/reservables_data.csv"

$PSQL -v ON_ERROR_STOP=1 <<SQL
\echo '➡ Suppression de la table temporaire'
DROP TABLE IF EXISTS reservable_temp_raw;

\echo '➡ Création de la table temporaire reservable_temp_raw'
CREATE TEMP TABLE reservable_temp_raw (
    name text NOT NULL,
    size text NOT NULL,
    price_per_day text,
    description text,
    photo1 text,
    photo2 text,
    photo3 text
);

\echo '➡ Import du CSV'
\copy reservable_temp_raw FROM '$CSV_RESERVABLE_FILE' CSV HEADER;

\echo '➡ Nettoyage des entrées invalides'
DELETE FROM reservable_temp_raw
WHERE name IS NULL OR trim(name) = ''
   OR size IS NULL OR trim(size) = '';

\echo '➡ Exécution du script insert_reservables.sql'
\ir $SQL_TEST_SCRIPTS_DIR/insert_reservables.sql

SQL

echo "✔ Étape 6 terminée."


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
