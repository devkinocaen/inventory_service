#!/bin/bash

# Vérifie que le fichier de sortie est fourni en argument
if [ $# -ne 1 ]; then
  echo "Usage: $0 fichier_sortie.txt"
  exit 1
fi

output_file="$1"

# Vide ou crée le fichier de sortie
> "$output_file"

# Parcourt tous les fichiers *.css dans le dossier courant
for file in *.css; do
  # Vérifie que le fichier existe (au cas où il n'y aurait aucun .css)
  [ -e "$file" ] || continue

  echo "file:$file" >> "$output_file"
  cat "$file" >> "$output_file"
  echo "" >> "$output_file"  # ligne vide entre fichiers
done
