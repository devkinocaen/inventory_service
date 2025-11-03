#!/bin/bash
set -euo pipefail

# ======================================================
# Variables d'environnement brutes pour Neon
# ======================================================
# Chemin absolu du dossier du script
NEON_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo NEON_SCRIPT_DIR: $NEON_SCRIPT_DIR

if [ -z "${DB_CONFIG}" ]; then
  echo "❌ La variable DB_CONFIG n'est pas définie ou est vide"
  exit 1
else
  echo "✅ DB_CONFIG existe et vaut : $DB_CONFIG"
  source "$NEON_SCRIPT_DIR/$DB_CONFIG/env.sh"
fi


# Construire le nom de la variable
VAR_HOST="${DB_CONFIG}_DBHOST"
VAR_HOST_DIRECT="${DB_CONFIG}_DBHOST_DIRECT"
VAR_PASSWORD="${DB_CONFIG}_DBPASSWORD"

# Récupérer la valeur réelle via déréférencement indirect
export NEON_DBHOST="${!VAR_HOST}"
export NEON_DBHOST_DIRECT="${!VAR_HOST_DIRECT}"
export NEON_DBPASSWORD="${!VAR_PASSWORD}"


export NEON_DBPORT=5432
export NEON_DBNAME="neondb"           # base exacte dans l'URL
export NEON_DBUSER="neondb_owner"     # user exact dans l'URL
export NEON_SSLMODE="require"


# Debug
echo "✅ NEON_DBHOST: $NEON_DBHOST"
