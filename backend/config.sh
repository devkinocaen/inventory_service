#!/bin/bash

CONFIG_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

export ROOT_DIR=$CONFIG_DIR/..
export GOOGLE_TOKEN_JSON_FOLDER=$ROOT_DIR/services/gcloud/secrets


export FLASK_WITH_CRYPTO=1

export DB_PROVIDER="neon" # ou alwaysdata ou supabase
export DEPLOYMENT_ENV="local" # local, render ou alwaysdata

# configurer l'environnement de deploiement du server
source "$CONFIG_DIR/../deploy/$DEPLOYMENT_ENV/env.sh"

# Configurer l'environnement PostgreSQL seulement si DB_CONFIG est définie
if [[ -n "${DB_CONFIG:-}" ]]; then
  source "$CONFIG_DIR/../databases/$DB_PROVIDER/config.sh"
fi


export ALWAYS_DATA_API_REST_URL=https://inventory-service.alwaysdata.net
export RENDER_API_REST_URL=https://inventory-service-tz0g.onrender.com



