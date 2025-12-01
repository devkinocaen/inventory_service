#!/bin/bash

CONFIG_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

export ROOT_DIR=$CONFIG_DIR/..
export GOOGLE_TOKEN_JSON_FOLDER=$ROOT_DIR/services/gcloud/secrets


export FLASK_WITH_CRYPTO=1

#export DB_PROVIDER="alwaysdata" # ou neon ou supabase
: "${DB_PROVIDER:=alwaysdata}"
export DB_PROVIDER

export DEPLOYMENT_ENV="local" # local, render ou alwaysdata

# configurer l'environnement de deploiement du server
source "$CONFIG_DIR/../deploy/$DEPLOYMENT_ENV/env.sh"

# Configurer l'environnement PostgreSQL seulement si DB_CONFIG est définie
if [[ -n "${DB_CONFIG:-}" ]]; then
  source "$CONFIG_DIR/../databases/$DB_PROVIDER/config.sh"
fi

export APP_NAME=Costumerie

export ALWAYS_DATA_API_REST_URL=https://inventory-service.alwaysdata.net
export RENDER_API_REST_URL=https://inventory-service-tz0g.onrender.com

export HEADER_IMAGE_URL='/images/bandeau_costumerie_julie.png'
#export EXPORTER_DB_NAME='COSTUMERIE_CAEN_NEON'
#export HEADER_IMAGE_URL='./images/bandeau_costumerie_alex.png'
#export EXPORTER_DB_NAME='COSTUMERIE_ALEX_NEON'
