#!/bin/bash
set -euo pipefail

# ======================================================
# Mapping des variables ALWAYSDATA vers le format générique
# ======================================================

# Charger d'abord les variables d'environnement
ALWAYSDATA_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$ALWAYSDATA_SCRIPT_DIR/env.sh"
export ROOT_DIR=$ALWAYSDATA_SCRIPT_DIR/../..

# ======================================================
# Variables génériques utilisées par le script principal
# ======================================================

# Si tu utilises un tunnel SSH, DBHOST devient localhost
if [[ "${USE_SSH_TUNNEL-}" == "1" ]]; then
    export DBHOST="localhost"
else
    # Host Alwaysdata exact pour connexions directes
    export DBHOST="postgresql-kinocaen.alwaysdata.net"
fi
    export DBPORT="${ALWAYSDATA_DBPORT:-5432}"

export DBNAME=$ALWAYSDATA_DBNAME
export DBUSER=$ALWAYSDATA_DBUSER
export DBPASSWORD=$ALWAYSDATA_DBPASSWORD
export SSLMODE=${ALWAYSDATA_SSLMODE:-require}
export AUTHENTICATED_ROLE=$DBUSER
export ANONYMOUS_ROLE=$DBUSER


# ======================================================
# Commande PSQL compatible Alwaysdata
# ======================================================

# Encodage éventuel des caractères spéciaux du mot de passe pour l'URL
ENCODED_PASSWORD=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$DBPASSWORD'''))")

export PSQL="psql postgresql://$DBUSER:$ENCODED_PASSWORD@$DBHOST:$DBPORT/$DBNAME?sslmode=require --set=client_encoding=UTF8 --set ON_ERROR_STOP=on"

echo "📌 Commande PSQL générée :"
echo "$PSQL"
