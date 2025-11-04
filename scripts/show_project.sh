#!/bin/bash

# Vérifie qu'un chemin est passé en argument
if [ -z "$1" ]; then
  echo "Usage: $0 <chemin>"
  exit 1
fi

ROOT="$1"

find "$ROOT" \
  \( -type d \( -name node_modules -o -name .git -o -name dist -o -name build -o -name venv -o -name __pycache__ \) -prune \) -o \
  ! -name '.*' -print \
| sed -e "s|^$ROOT/||" \
      -e 's|[^/]*/|│   |g' \
      -e 's|│   \([^│]\)|├── \1|'
