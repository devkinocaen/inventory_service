#!/usr/bin/env bash
set -euo pipefail

# ===========================================
# Charger la config commune
# ===========================================
CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(( $# )) || { echo "❌ Usage: $0 <DB_CONFIG>"; exit 1; }
source "$CURRENT_SCRIPT_DIR/load_db_config.sh" $1
SQL_SCRIPTS_DIR=$ROOT_DIR/sql


CSV_PROJECT_FILE="$SQL_SCRIPTS_DIR/tests/project_data.csv"
CSV_EQUIPMENT_FILE="$SQL_SCRIPTS_DIR/tests/equipment_data.csv"
CSV_PARTICIPANT_FILE="$SQL_SCRIPTS_DIR/tests/participant_data.csv"
CSV_SHOOTING_LOCATION_FILE="$SQL_SCRIPTS_DIR/tests/shooting_location_data.csv"


# Supprimer les données déjà ajoutées
source $CURRENT_SCRIPT_DIR/truncate_all.sh


echo "Lancement de l'initialisation des tables..."


$PSQL -f $SQL_SCRIPTS_DIR/init_tabs.sql

$PSQL -f $SQL_SCRIPTS_DIR/tests/insert_event.sql


echo "Création des lieux de tournage à partir de $CSV_SHOOTING_LOCATION_FILE..."

$PSQL <<SQL
-- On nettoie l''ancienne table temporaire
DROP TABLE IF EXISTS shooting_location_temp_raw;

-- Table temporaire permissive
CREATE TEMP TABLE shooting_location_temp_raw (
    name text,
    address text,
    geographic_area text,
    photo_url text
);

-- Chargement CSV brut (ne plante pas si lignes vides)
\copy shooting_location_temp_raw FROM '$CSV_SHOOTING_LOCATION_FILE' CSV HEADER;

-- Supprime immédiatement les lignes avec colonnes vides ou URL invalides
DELETE FROM shooting_location_temp_raw
WHERE name IS NULL OR trim(name) = ''
   OR address IS NULL OR trim(address) = ''
   OR geographic_area IS NULL OR trim(geographic_area) = ''
   OR photo_url IS NULL OR trim(photo_url) = ''
   OR photo_url !~* '^https?://';

-- Insert final
INSERT INTO shooting_location (name, address, geographic_area)
SELECT DISTINCT name, address, geographic_area
FROM shooting_location_temp_raw
ON CONFLICT (name) DO NOTHING;

-- Mise à jour des photos JSON avec captions par défaut
UPDATE shooting_location sl
SET photos = sub.photo_array
FROM (
    SELECT
        name,
        json_agg(
            json_build_object(
                'url', photo_url,
                'caption', caption
            )
        ) AS photo_array
    FROM (
        SELECT
            name,
            photo_url,
            'Vue ' || row_number() OVER (PARTITION BY name ORDER BY photo_url) AS caption
        FROM shooting_location_temp_raw
    ) t
    GROUP BY name
) AS sub
WHERE sl.name = sub.name;

-- Contrôle final
SELECT name, jsonb_array_length(photos) AS nb_photos
FROM shooting_location
ORDER BY name;
SQL


echo "Création des participants à partir de $CSV_PARTICIPANT_FILE..."

$PSQL <<SQL
-- On nettoie d abord
DROP TABLE IF EXISTS participant_data_temp;

-- Table temporaire qui reflète les colonnes du CSV
CREATE TEMP TABLE participant_data_temp (
    import_id      text,
    last_name      text,
    first_name     text,
    email          text,
    mobile_phone   text,
    project_owner  boolean,
    other_skills   text,
    photo_url      text
);

-- Chargement du CSV
\copy participant_data_temp(import_id,last_name,first_name,email,mobile_phone,project_owner,other_skills,photo_url) \
FROM '$CSV_PARTICIPANT_FILE' CSV HEADER;

-- Script qui fait l’insert avec le role_id
\i $SQL_SCRIPTS_DIR/tests/insert_participants.sql

-- Petit contrôle
SELECT COUNT(*) FROM participant;
SQL


$PSQL -f $SQL_SCRIPTS_DIR/tests/insert_sponsors.sql
$PSQL -f $SQL_SCRIPTS_DIR/tests/insert_participant_skills.sql
$PSQL -f $SQL_SCRIPTS_DIR/tests/insert_participant_sessions.sql


echo "Création des équipements a partir de $CSV_EQUIPMENT_FILE..."

$PSQL <<SQL
DROP TABLE IF EXISTS equipment_data_temp;
CREATE TEMP TABLE equipment_data_temp (
    name text,
    description text,
    notes text,
    type_id int
);

\copy equipment_data_temp(name, description, notes, type_id) FROM '$CSV_EQUIPMENT_FILE' CSV HEADER;

\i $SQL_SCRIPTS_DIR/tests/insert_equipments.sql
SELECT COUNT(*) FROM equipment;
SQL


echo "Création des projects a partir de $CSV_PROJECT_FILE..."

$PSQL <<SQL
DROP TABLE IF EXISTS project_data_temp;
CREATE TEMP TABLE project_data_temp (
    short_title text,
    title text,
    pitch text
);

\copy project_data_temp(short_title, title, pitch) FROM '$CSV_PROJECT_FILE' CSV HEADER;
\i $SQL_SCRIPTS_DIR/tests/insert_projects.sql
SELECT COUNT(*) FROM project;
SQL


$PSQL -f $SQL_SCRIPTS_DIR/tests/insert_equipment_mag.sql
$PSQL -f $SQL_SCRIPTS_DIR/tests/insert_equipment_participants.sql
$PSQL -f $SQL_SCRIPTS_DIR/tests/insert_editing_stations.sql
$PSQL -f $SQL_SCRIPTS_DIR/tests/insert_equipment_bookings.sql
$PSQL -f $SQL_SCRIPTS_DIR/tests/insert_editing_station_bookings.sql


echo "▶ Étape 8 : Mise à jour des séquences..."
$PSQL -f "$SQL_SCRIPTS_DIR/realign_serials.sql"


echo "Script terminé avec succès."
