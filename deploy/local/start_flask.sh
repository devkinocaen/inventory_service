#!/bin/bash

export FLASK_APP_DIR=`pwd`/backend

# Se placer dans le dossier deploy/local
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

echo SCRIPT_DIR: $SCRIPT_DIR

# Activer l'environnement virtuel
if [ ! -d "venv" ]; then
  echo "❌ Environnement virtuel non trouvé, lance d'abord env_flask.sh"
  exit 1
fi
source venv/bin/activate
# pip uninstall -y psycopg
pip install -r ${FLASK_APP_DIR}/requirements.txt


# Lancer le serveur Flask
export FLASK_PORT=5000
python3 ${FLASK_APP_DIR}/app_flask.py &
FLASK_PID=$!

echo "✅ Serveur Flask démarré sur http://localhost:$FLASK_PORT"

# Fonction pour arrêter le serveur Render
cleanup_render() {
  echo "Arrêt du serveur Render Flask..."
  kill "$FLASK_PID" 2>/dev/null
  wait "$FLASK_PID" 2>/dev/null
  echo "Serveur Render arrêté."
}
trap cleanup_render SIGINT SIGTERM EXIT

# Bloquer le script pour garder le serveur vivant
echo "Appuyez sur Ctrl+C pour arrêter le serveur..."
wait "$FLASK_PID"
