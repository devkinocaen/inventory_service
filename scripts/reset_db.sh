#!/usr/bin/env bash
set -euo pipefail


CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
(( $# )) || { echo "❌ Usage: $0 <DB_CONFIG>"; exit 1; }
source "$CURRENT_SCRIPT_DIR/load_db_config.sh" $1


# ===============================================================================
# Préalables pour creer et connecter une nouvelle base neon au server:
# ===============================================================================
#1. configurer une nouvelle base neon, et stocker les acces dans un fichier env.sh dans un sous dossier de connexion/neon/ en respectant la convention de prefixe NOUVELLEBASE_(nomvariable)
#1b. copier les variables d'environnement dans les variables d'environnement du service GUnicorn sous render.com
#2. configurer users.sh avec les utilisateurs et leur droits dans un fichier users.sh dans le meme sous dossier de connexion/neon/
#3. referencer la base dans connexion/neon/databases.csv
#4. creer les dossiers backups / magasin / shooting_locations dans un Goolge Drive avec accès au compte de service google
#5. ajouter la nouvelle base a la matrix dans le fichier .github/workflows/backup.yml

#initialiser le nom de la base (doit etre identique au sous dossier neon dans lequel on a mis les variables d'acces)


SQL_SCRIPTS_DIR="$ROOT_DIR/sql"

: "${PSQL:?Veuillez définir la commande psql dans config.sh}"
: "${ROOT_DIR:?Veuillez définir ROOT_DIR dans config.sh}"
: "${DBUSER:?Veuillez définir DBUSER dans config.sh}"

# Entier de contrôle : lancer les étapes <= STEP
STEP=${STEP:-0}   # par défaut tout est exécuté

echo "🔢 STEP = $STEP"
# Vérifie que STEP est un entier
if ! [[ "$STEP" =~ ^[0-9]+$ ]]; then
    echo "❌ STEP doit être un entier : $STEP"
    exit 1
fi

# Vérifie que les fichiers SQL existent
for f in "$SQL_SCRIPTS_DIR/init_db.sql" "$SQL_SCRIPTS_DIR/init_db.sql" "$SQL_SCRIPTS_DIR/create_triggers.sql" "$SQL_SCRIPTS_DIR/realign_serials.sql";  do
    [ -f "$f" ] || { echo "❌ Fichier SQL introuvable : $f"; exit 1; }
done


echo PSQL: $PSQL

# Étape 1 : Création des tables
if [ "$STEP" -le 1 ]; then
    bash "$CURRENT_SCRIPT_DIR/delete_schema.sh" $DB_CONFIG
    echo "▶ Étape 1 : Création des tables..."
    echo "🔹 Current PostgreSQL user: ${DBUSER}"
    $PSQL -c "SELECT current_user;"
    $PSQL -c "SET ROLE ${DBUSER};"
    $PSQL -c "SELECT current_user;"

    $PSQL -f "$SQL_SCRIPTS_DIR/schema.sql"
    $PSQL -f "$SQL_SCRIPTS_DIR/init_db.sql"
    echo "📋 Tables existantes dans le schema public :"
    $PSQL -c "\dt public.*"
fi


# Étape 2 : Réinitialisation des fonctions
if [ "$STEP" -le 2 ]; then
    echo "▶ Étape 2 : Réinitialisation des fonctions..."
    bash "$CURRENT_SCRIPT_DIR/reset_functions.sh" $DB_CONFIG
fi


# Étape 3 : Création des triggers
if [ "$STEP" -le 3 ]; then
    echo "▶ Étape 3 : Création des triggers..."
    $PSQL -f "$SQL_SCRIPTS_DIR/create_triggers.sql"
fi


if [ "${NO_AUTH:-0}" = "1" ]; then
    echo "⚠️ NO_AUTH=1 → Auth désactivée, l'étape 4 est ignorée."
else


    # Étape 4 : Configuration Auth / Utilisateurs
    if [ "$STEP" -le 4 ]; then
            echo "▶▶ Étape 4: Set custom config Auth / Users script for ${DB_PROVIDER}/${DB_CONFIG}..."
        if [ -f "$CURRENT_SCRIPT_DIR/../databases/${DB_PROVIDER}/create_auth.sh" ]; then
            bash "$CURRENT_SCRIPT_DIR/../databases/${DB_PROVIDER}/create_auth.sh" ${DB_CONFIG}
        else
            echo "$CURRENT_SCRIPT_DIR/../databases/${DB_PROVIDER}/create_auth.sh" n existe pas
            exit 1
        fi
    fi

    if [ "$STEP" -le 5 ]; then
        echo "▶▶ Étape 5: Application des policies de sécurité..."
        bash "$CURRENT_SCRIPT_DIR/set_security_policies.sh" $DB_CONFIG
    fi
    
    if [ "$STEP" -le 6 ]; then
        echo "▶▶ Étape 6: Application des policies de sécurité sur les fonctions..."
        bash "$CURRENT_SCRIPT_DIR/set_basic_function_policies.sh" $DB_CONFIG
        # bash "$CURRENT_SCRIPT_DIR/set_function_policies.sh"
    fi

fi

# Étape 8 : réaligner les serials si besoin
if [ "$STEP" -le 7 ]; then
    echo "▶ Étape 7 : Mise à jour des séquences..."

    # Création de la fonction
    $PSQL -f "$SQL_SCRIPTS_DIR/realign_serials.sql"

    # Appel de la fonction avec rôle "authenticated"
    $PSQL -c "SELECT public.realign_serials('$AUTHENTICATED_ROLE');"
fi

echo "🎉 Provisioning terminé avec succès."
