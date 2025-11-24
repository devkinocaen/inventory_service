#!/bin/bash
# ===========================================
# Chargement de la configuration DB
# ===========================================

# Si ce script est exécuté directement (pas sourcé), on l’interdit
# car il doit être utilisé avec `source`.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "❌ Ce script doit être sourcé :"
    echo "   source $0 <DB_CONFIG>"
    exit 1
fi

# ===========================================
# Vérification du premier argument
# ===========================================
if [ $# -lt 1 ]; then
    echo "❌ Usage : source $BASH_SOURCE <DB_CONFIG>"
    echo "   Exemple : source $BASH_SOURCE costumerie_caen"
    return 1
fi

DB_CONFIG="$(echo "$1" | tr '[:lower:]' '[:upper:]')"

# ------------------------------------------------------------
# Si l'argument contient un "/", on split en PROVIDER/CONFIG
# ------------------------------------------------------------
if [[ "$1" == *"/"* ]]; then
    # Ex: pg/mybase  →  DB_PROVIDER="pg", DB_CONFIG="MYBASE"
    RAW_PROVIDER="${1%%/*}"
    RAW_CONFIG="${1#*/}"

    DB_PROVIDER="$(echo "$RAW_PROVIDER" | tr '[:lower:]' '[:upper:]')"
    DB_CONFIG="$(echo "$RAW_CONFIG" | tr '[:lower:]' '[:upper:]')"
fi

# ===========================================
# Détermination du répertoire courant
# ===========================================
CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ===========================================
# Charger la config commune
# ===========================================
source "$CURRENT_SCRIPT_DIR/../backend/config.sh"

# ===========================================
# Déterminer le dossier de config
# ===========================================
DB_CONFIG_DIR="$CURRENT_SCRIPT_DIR/../databases/$DB_PROVIDER/$DB_CONFIG"

if [ ! -d "$DB_CONFIG_DIR" ]; then
    echo "❌ Le dossier de configuration n'existe pas : $DB_CONFIG_DIR"
    return 1
fi

#echo "🧩 DB_CONFIG = $DB_CONFIG"
#echo "📁 Dossier de configuration : $DB_CONFIG_DIR"
