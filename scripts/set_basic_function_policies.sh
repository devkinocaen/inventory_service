#!/bin/bash
set -euo pipefail


# ===========================================
# Charger la config commune
# ===========================================
CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(( $# )) || { echo "❌ Usage: $0 <DB_CONFIG>"; exit 1; }
source "$CURRENT_SCRIPT_DIR/load_db_config.sh" $1


TARGET_OWNER="neondb_owner"   # 🔹 le rôle dont tu veux modifier les fonctions

# 🔹 Récupérer toutes les fonctions dans le schéma public avec leur propriétaire
functions=$($PSQL -t -A -F "|" -c "
SELECT n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS signature,
       r.rolname AS owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner
WHERE n.nspname = 'public';
")

# 🔹 Boucle sur les fonctions
while IFS="|" read -r func owner; do
    # Ne traiter que les fonctions appartenant à TARGET_OWNER
    if [[ "$owner" != "$TARGET_OWNER" ]]; then
        echo "⚠ Ignorer $func (non propriétaire : $owner)"
        continue
    fi

    echo "⚡ Mettre SECURITY DEFINER sur $func"
    echo "ALTER FUNCTION $func SECURITY DEFINER;" | $PSQL
done <<< "$functions"

echo "✅ Toutes les fonctions de $TARGET_OWNER dans le schéma public sont passées en SECURITY DEFINER."

# 🔹 Droits sur le schéma public
echo "⚡ Application des droits sur le schéma public"
echo "GRANT USAGE ON SCHEMA public TO $ANONYMOUS_ROLE, $AUTHENTICATED_ROLE;" | $PSQL
echo "GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO $ANONYMOUS_ROLE, $AUTHENTICATED_ROLE;" | $PSQL
echo "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO $ANONYMOUS_ROLE, $AUTHENTICATED_ROLE;" | $PSQL

echo "✅ Droits anon/authenticated appliqués sur le schéma et les fonctions."
