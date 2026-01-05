#!/usr/bin/env bash
set -euo pipefail

# Variables (à définir avant ou via export)
# USER_EMAIL="ton_email@example.com"
# USER_PASSWORD="ton_mot_de_passe"
# DB_NAME="COSTUMERIE_JULIE_NEON"
# FLASK_URL_BASE="https://inventory-service.alwaysdata.net"

USER_EMAIL=julie.pro.costumerie@gmail.com
USER_PASSWORD=Jpc@2026
DB_NAME="COSTUMERIE_JULIE_NEON"
FLASK_URL_BASE="https://inventory-service.alwaysdata.net"

echo "Requesting token for database $DB_NAME..."

RESPONSE=$(curl --noproxy "*" -s -X POST "$FLASK_URL_BASE/login/$DB_NAME" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}")

echo "RAW RESPONSE: $RESPONSE"

# Extraction du token avec jq
TOKEN=$(echo "$RESPONSE" | jq -r '.access_token' 2>/dev/null || echo "")

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Failed to retrieve token!"
  exit 1
fi

echo "✅ Token retrieved successfully"
echo "Token: $TOKEN"  # tu peux supprimer cette ligne pour ne pas l'afficher
