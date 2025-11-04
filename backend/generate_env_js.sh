#!/bin/bash
set -e

# Usage : ./generate_env.sh ./frontend/public/js/env-config.js
OUTPUT_FILE="${1:-./frontend/public/js/env-config.js}"


mkdir -p "$(dirname "$OUTPUT_FILE")"


# Écriture du fichier env-config.js
cat > "$OUTPUT_FILE" <<EOF
window.ENV = {
  DB_CLIENT: "${DB_CLIENT}",
  BASE_PATH: "${BASE_PATH}",
  API_REST_URLS: [
    "http://127.0.0.1:5000",
    "$ALWAYS_DATA_API_REST_URL",
    "$RENDER_API_REST_URL"
  ],
  SERVICE_WAKEUP_INTERVAL: 720
};
EOF

echo "✅ env-config.js généré avec les bases depuis $CSV_FILE dans $OUTPUT_FILE"
