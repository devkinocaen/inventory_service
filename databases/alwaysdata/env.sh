#!/bin/bash
set -euo pipefail

# ======================================================
# Variables d'environnement brutes pour ALWAYSDATA
# ======================================================
# Chemin absolu du dossier du script
ALWAYSDATA_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo ALWAYSDATA_SCRIPT_DIR: $ALWAYSDATA_SCRIPT_DIR

if [ -z "${DB_CONFIG}" ]; then
  echo "❌ La variable DB_CONFIG n'est pas définie ou est vide"
  exit 1
else
  echo "✅ DB_CONFIG existe et vaut : $DB_CONFIG"
  source "$ALWAYSDATA_SCRIPT_DIR/$DB_CONFIG/env.sh"
fi


# Construire le nom de la variable
VAR_DBNAME="${DB_CONFIG}_DBNAME"
VAR_HOST="${DB_CONFIG}_DBHOST"
VAR_USER="${DB_CONFIG}_DBUSER"
VAR_PASSWORD="${DB_CONFIG}_DBPASSWORD"

# Récupérer la valeur réelle via déréférencement indirect
export ALWAYSDATA_DBUSER="${!VAR_USER}"
export ALWAYSDATA_DBNAME="${!VAR_DBNAME}"
export ALWAYSDATA_DBHOST="${!VAR_HOST}"
export ALWAYSDATA_DBPASSWORD="${!VAR_PASSWORD}"


export ALWAYSDATA_DBPORT=5432
export ALWAYSDATA_SSLMODE="require"


# Debug
echo "✅ ALWAYSDATA_DBHOST: $ALWAYSDATA_DBHOST"
