#!/bin/bash
set -euo pipefail

# ===========================================
# Charger la config commune
# ===========================================
CURRENT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"


export FLASK_DEBUG=1

export PATH=/usr/local/pgsql/bin/:$PATH

source "$CURRENT_SCRIPT_DIR/../deploy/local/env_flask.sh"
bash "$CURRENT_SCRIPT_DIR/../deploy/local/start_flask.sh"

