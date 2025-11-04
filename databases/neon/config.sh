#!/bin/bash
set -euo pipefail

# ======================================================
# Mapping des variables Neon vers le format générique
# ======================================================

# Charger d'abord les variables d'environnement

NEON_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo NEON_SCRIPT_DIR: $NEON_SCRIPT_DIR
source "$NEON_SCRIPT_DIR/env.sh"


# Variables génériques utilisées par le script principal
export DBHOST=$NEON_DBHOST
export DBPORT=$NEON_DBPORT
export DBNAME=$NEON_DBNAME
export DBUSER=$NEON_DBUSER
export DBPASSWORD=$NEON_DBPASSWORD
unset DBANONKEY
export SSLMODE=$NEON_SSLMODE

export AUTHENTICATED_ROLE='authenticated'
export ANONYMOUS_ROLE='anon'


# Commande PSQL compatible Neon SNI
 
export PSQL="psql postgresql://$DBUSER:$DBPASSWORD@$DBHOST:$DBPORT/$DBNAME?sslmode=$SSLMODE&channel_binding=require --set ON_ERROR_STOP=on"
