#!/bin/bash

set -euo pipefail

# ===========================================
# Lire les paramètres --browser
# ===========================================
BROWSER=""

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --browser)
      BROWSER="$2"
      shift 2
      ;;
    *)
      echo "Usage: $0 [--browser chrome|firefox|safari]"
      exit 1
      ;;
  esac
done


# ===========================================
# Charger la config commune
# ===========================================

source ./backend/config.sh

export FRONTEND_ROOT='frontend/public'
echo pwd: `pwd`
# Vérifier dossier public/html5 (on sert html5 comme root local)
if [ ! -d "$FRONTEND_ROOT" ]; then
  echo "Erreur : le dossier '$FRONTEND_ROOT' est introuvable."
  exit 1
fi

# Fonction de nettoyage pour serveur HTTP
cleanup() {
  echo "Arrêt du serveur HTTP local..."
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  echo "Serveur HTTP arrêté."
}
trap cleanup SIGINT SIGTERM EXIT

# Vérifier port 8000 et tuer l'ancien serveur si nécessaire
if lsof -i :8000 &>/dev/null; then
  echo "Un serveur HTTP est déjà en cours sur le port 8000. Arrêt..."
  OLD_PID=$(lsof -ti :8000)
  kill "$OLD_PID" 2>/dev/null || true
  sleep 1
fi

echo 'generate env_config'
OUT_ENV_CONFIG_JS_FILE=$FRONTEND_ROOT/js/env-config.js
bash "./backend/generate_env_js.sh" "$OUT_ENV_CONFIG_JS_FILE"

# Démarrer serveur HTTP LOCAL depuis public/html5/ (root = public/html5)
cd $FRONTEND_ROOT || exit 1
python3 -m http.server 8000 &
SERVER_PID=$!
cd - >/dev/null  # retour au répertoire initial

# Construire URL finale (comme Vercel : racine = contenu de html5)
BASE_URL="http://localhost:8000"
FINAL_URL="$BASE_URL/index.html"

echo "On charge : $FINAL_URL"


# Ouvrir navigateur
OS_TYPE=$(uname)

open_in_browser() {
  case "$1" in
    chrome)
      if [[ "$OS_TYPE" == "Darwin" ]]; then
        open -a "Google Chrome" "$FINAL_URL"
      elif [[ "$OS_TYPE" == MINGW* || "$OS_TYPE" == CYGWIN* ]]; then
        cmd.exe /c start chrome "$FINAL_URL"
      else
        google-chrome "$FINAL_URL" 2>/dev/null || xdg-open "$FINAL_URL"
      fi
      ;;
    firefox)
      if [[ "$OS_TYPE" == "Darwin" ]]; then
        open -a "Firefox" "$FINAL_URL"
      elif [[ "$OS_TYPE" == MINGW* || "$OS_TYPE" == CYGWIN* ]]; then
        cmd.exe /c start firefox "$FINAL_URL"
      else
        firefox "$FINAL_URL" 2>/dev/null || xdg-open "$FINAL_URL"
      fi
      ;;
    safari)
      if [[ "$OS_TYPE" == "Darwin" ]]; then
        open -a "Safari" "$FINAL_URL"
      else
        echo "Safari n'est pas dispo sur $OS_TYPE"
      fi
      ;;
    *)
      if [[ "$OS_TYPE" == MINGW* || "$OS_TYPE" == CYGWIN* ]]; then
        cmd.exe /c start "$FINAL_URL"
      else
        xdg-open "$FINAL_URL" 2>/dev/null || open "$FINAL_URL"
      fi
      ;;
  esac
}
open_in_browser "$BROWSER"

# Attendre serveur HTTP
wait "$SERVER_PID"
