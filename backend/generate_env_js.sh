#!/bin/bash
set -e

# Usage : ./generate_env_js.sh ./frontend/public/js/env-config.js
OUTPUT_FILE="${1:-./frontend/public/js/env-config.js}"
bash frontend/public/resources/generate_env_js.sh $OUTPUT_FILE
