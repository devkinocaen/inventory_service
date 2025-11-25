#!/bin/bash
set -e

# Usage : ./generate_env_js.sh ./frontend/public/js/env-config.js
OUTPUT_FILE="${1:-./frontend/public/js/env-config.js}"

# 🔹 Récupère le nom de la branche (fallback pour Vercel)
if git rev-parse --git-dir > /dev/null 2>&1; then
    APP_VERSION=$(git rev-parse --abbrev-ref HEAD || echo "unknown")
else
    APP_VERSION="${VERCEL_GIT_COMMIT_REF:-unknown}"
fi

mkdir -p "$(dirname "$OUTPUT_FILE")"

# 🔹 Écriture du fichier env-config.js
cat > "$OUTPUT_FILE" <<EOF
window.ENV = {
  APP_NAME: "${APP_NAME}",
  APP_VERSION: "${APP_VERSION}",
  DB_CLIENT: "${DB_CLIENT}",
  BASE_PATH: "${BASE_PATH}",

  // Variables spécifiques à chaque site Vercel
  DB_NAME: "${EXPORTER_DB_NAME}",
  HEADER_IMAGE_URL: "${HEADER_IMAGE_URL}",

  // URLs API déjà présentes dans ta version
  API_REST_URLS: [
    "http://127.0.0.1:5000",
    "$ALWAYS_DATA_API_REST_URL",
    "$RENDER_API_REST_URL"
  ],

  SERVICE_WAKEUP_INTERVAL: 720
};
EOF

echo "✅ env-config.js généré : DB_NAME=$EXPORTER_DB_NAME HEADER_IMAGE_URL=$HEADER_IMAGE_URL → $OUTPUT_FILE"
