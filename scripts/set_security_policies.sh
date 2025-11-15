#!/bin/bash
set -euo pipefail

# ===========================================
# Charger la config commune
# ===========================================
CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(( $# )) || { echo "❌ Usage: $0 <DB_CONFIG> [--debug] [-v]"; exit 1; }

DB_CONFIG="$1"
shift || true

DEBUG=0
VERBOSE=0
for arg in "$@"; do
    case "$arg" in
        --debug) DEBUG=1 ;;
        -v) VERBOSE=1 ;;
    esac
done

source "$CURRENT_SCRIPT_DIR/load_db_config.sh" "$DB_CONFIG"

SQL_SCRIPTS_DIR="$ROOT_DIR/sql"
POLICIES_FILE="$SQL_SCRIPTS_DIR/auth/policies.yaml"

echo AUTHENTICATED_ROLE: $AUTHENTICATED_ROLE

# ===========================================
# Fonctions utilitaires
# ===========================================
log_debug() {
    [[ $DEBUG -eq 1 ]] && echo "DEBUG: $*" >&2
}

get_role_list() {
  local role="$1"
  local perm="$2"
  local value

  value=$(grep "^${role}.${perm}=" "$POLICIES_FILE" | cut -d '=' -f 2-)

  log_debug "ROLE='$role' PERM='$perm' RAW='$value'"

  # Vide ou absent -> none
  if [[ -z "$value" ]]; then
    echo "none"
    return
  fi

  # all ou none -> direct
  if [[ "$value" == "all" || "$value" == "none" ]]; then
    echo "$value"
    return
  fi

  # Sinon c’est une liste CSV -> on la renvoie telle quelle (espace-séparée)
  echo "$value" | tr ',' ' '
}


# ===========================================
# Tables et rôles
# ===========================================
tables="app_config person organization storage_location reservable_style reservable_category reservable_subcategory size_type size reservable reservable_style_link reservable_batch reservable_batch_link booking_reference reservable_booking"
roles="dev admin viewer anon"
perms="select insert update delete"

# ===========================================
# Application des politiques
# ===========================================
for table in $tables; do
  $PSQL -q -c "ALTER TABLE inventory.$table ENABLE ROW LEVEL SECURITY;"

  [[ $VERBOSE -eq 1 ]] && echo -e "\n📦 Table: $table"

  for role in $roles; do
    crud_line="$role : "
    for perm in $perms; do
      list=$(get_role_list "$role" "$perm")
      if [[ "$list" == "all" ]]; then
        allowed="✔"
      elif [[ "$list" == "none" ]] || [[ -z "$list" ]]; then
        allowed="✖"
      elif echo "$list" | grep -qw "$table"; then
        allowed="✔"
      else
        allowed="✖"
      fi

      if [[ "$allowed" == "✔" ]]; then
        case "$perm" in
          select)
            $PSQL -q -c "GRANT SELECT ON inventory.$table TO $AUTHENTICATED_ROLE;"
            $PSQL -q -c "DROP POLICY IF EXISTS ${table}_${perm}_${role} ON inventory.$table;"
            $PSQL -q -c "CREATE POLICY ${table}_${perm}_${role} ON inventory.$table FOR SELECT TO $AUTHENTICATED_ROLE USING (get_user_role() = '$role');" ;;
          insert)
            $PSQL -q -c "GRANT INSERT ON inventory.$table TO $AUTHENTICATED_ROLE;"
            $PSQL -q -c "DROP POLICY IF EXISTS ${table}_${perm}_${role} ON inventory.$table;"
            $PSQL -q -c "CREATE POLICY ${table}_${perm}_${role} ON inventory.$table FOR INSERT TO $AUTHENTICATED_ROLE WITH CHECK (get_user_role() = '$role');" ;;
          update)
            $PSQL -q -c "GRANT UPDATE ON inventory.$table TO $AUTHENTICATED_ROLE;"
            $PSQL -q -c "DROP POLICY IF EXISTS ${table}_${perm}_${role} ON inventory.$table;"
            $PSQL -q -c "CREATE POLICY ${table}_${perm}_${role} ON inventory.$table FOR UPDATE TO $AUTHENTICATED_ROLE USING (get_user_role() = '$role') WITH CHECK (get_user_role() = '$role');" ;;
          delete)
            $PSQL -q -c "GRANT DELETE ON inventory.$table TO $AUTHENTICATED_ROLE;"
            $PSQL -q -c "DROP POLICY IF EXISTS ${table}_${perm}_${role} ON inventory.$table;"
            $PSQL -q -c "CREATE POLICY ${table}_${perm}_${role} ON inventory.$table FOR DELETE TO $AUTHENTICATED_ROLE USING (get_user_role() = '$role');" ;;
        esac
      fi

      crud_line+="$perm=$allowed "
    done

    [[ $VERBOSE -eq 1 ]] && echo "  $crud_line"
  done
done

echo "✅ Droits RLS appliqués selon $POLICIES_FILE"
