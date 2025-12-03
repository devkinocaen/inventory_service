#!/bin/bash

# Désactiver les proxys éventuels
unset HTTP_PROXY
unset http_proxy
unset HTTPS_PROXY
unset https_proxy
unset ALL_PROXY
unset all_proxy
unset NO_PROXY
unset no_proxy

export CURRENT_DIR=`pwd`

export FLASK_APP_DIR=${CURRENT_DIR}/backend
export LOCAL_DEPLOY_DIR=${CURRENT_DIR}/deploy/local
cd $LOCAL_DEPLOY_DIR

echo CURRENT_DIR: $CURRENT_DIR

# Créer un environnement virtuel Python dans le dossier render
python3 -m venv venv

# Activer l'environnement
source venv/bin/activate

# Installer les dépendances nécessaires
pip install --upgrade pip

pip install -r ${FLASK_APP_DIR}/requirements.txt

echo on charge la config du server: ${FLASK_APP_DIR}/config.sh
source ${FLASK_APP_DIR}/config.sh


cd $CURRENT_DIR

echo "✅ Environnement Flask prêt et activé."

