#!/bin/bash
set -e


# ===========================================
# Charger la config commune
# ===========================================
CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(( $# )) || { echo "❌ Usage: $0 <DB_CONFIG>"; exit 1; }
source "$CURRENT_SCRIPT_DIR/load_db_config.sh" $1

SQL_SCRIPTS_DIR="$ROOT_DIR/sql"


# Supprimer toutes les fonctions existantes (optionnel)
$PSQL -f "$SQL_SCRIPTS_DIR/drop_all_functions.sql"

# Vérifie s'il y a des fichiers function_*.sql dans le dossier
files_found=false
for file in $SQL_SCRIPTS_DIR/functions/*.sql; do
  if [ -f "$file" ]; then
    files_found=true
    break
  fi
done

if [ "$files_found" = false ]; then
  echo "⚠️ Aucun fichier *.sql trouvé dans $SQL_SCRIPTS_DIR/functions"
  exit 0
fi

echo "📌 Import des fonctions"

for file in "$SQL_SCRIPTS_DIR/functions"/*.sql; do
  fname=$(basename "$file" .sql)
  echo "📌 Import de la fonction : $fname"
  # Import SQL
  $PSQL -f "$file" > /dev/null

done


echo "✅ Toutes les fonctions sont importées."
