#!/bin/bash
set -euo pipefail

# ===========================================
# Charger la config commune
# ===========================================
CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(( $# )) || { echo "❌ Usage: $0 <DB_CONFIG>"; exit 1; }
source "$CURRENT_SCRIPT_DIR/load_db_config.sh" $1

SQL_SCRIPTS_DIR="$ROOT_DIR/sql"
POLICIES_FILE="$SQL_SCRIPTS_DIR/auth/policies.yaml"

# ===========================================
# Fonctions utilitaires
# ===========================================
get_role_list() {
  local role="$1"
  local key="$2"
  awk -v r="  $role:" -v k="    $key:" '
    $0 == r { in_role=1; next }
    in_role && $0 ~ k {
      gsub(k,"")
      if ($0 ~ /\[/) { gsub(/[\[\],]/,""); print $0; in_list=0; next }
      in_list=1; next
    }
    in_list && $0 ~ /^    [a-z]+:/ { in_list=0 } # stop at next key
    in_list && $0 ~ /-[[:space:]]*/ {
      sub(/.*-[[:space:]]*/,"")
      print
    }
  ' "$POLICIES_FILE" | tr '\n' ' ' | xargs
}

# ===========================================
# Tables du schéma
# ===========================================
tables="app_config person organization storage_location reservable_style reservable_category reservable_subcategory size_type size reservable reservable_style_link reservable_batch reservable_batch_link booking_reference reservable_booking"

roles="dev admin viewer anon"
perms="select insert update delete"

# ===========================================
# Application des politiques
# ===========================================
for table in $tables; do
  echo "📦 Table: $table"
  $PSQL -q -c "ALTER TABLE inventory.$table ENABLE ROW LEVEL SECURITY;"
  
  for role in $roles; do
    for perm in $perms; do
      list=$(get_role_list "$role" "$perm")
      [[ -z "$list" ]] && continue
      
      if echo "$list" | grep -qw "all"; then
        allowed=1
      else
        echo "$list" | grep -qw "$table" && allowed=1 || allowed=0
      fi
      
      if [[ $allowed -eq 1 ]]; then
        case "$perm" in
          select)
            $PSQL -q -c "GRANT SELECT ON inventory.$table TO $role;"
            $PSQL -q -c "CREATE POLICY IF NOT EXISTS ${table}_${perm}_${role} ON inventory.$table FOR SELECT TO $role USING (true);" ;;
          insert)
            $PSQL -q -c "GRANT INSERT ON inventory.$table TO $role;"
            $PSQL -q -c "CREATE POLICY IF NOT EXISTS ${table}_${perm}_${role} ON inventory.$table FOR INSERT TO $role WITH CHECK (true);" ;;
          update)
            $PSQL -q -c "GRANT UPDATE ON inventory.$table TO $role;"
            $PSQL -q -c "CREATE POLICY IF NOT EXISTS ${table}_${perm}_${role} ON inventory.$table FOR UPDATE TO $role USING (true) WITH CHECK (true);" ;;
          delete)
            $PSQL -q -c "GRANT DELETE ON inventory.$table TO $role;"
            $PSQL -q -c "CREATE POLICY IF NOT EXISTS ${table}_${perm}_${role} ON inventory.$table FOR DELETE TO $role USING (true);" ;;
        esac
      fi
    done
  done
done

echo "✅ Droits RLS appliqués selon $POLICIES_FILE (compatible Bash 3)"
