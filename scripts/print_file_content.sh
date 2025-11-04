#!/bin/bash


# Liste des extensions à traiter
extensions=("txt" "js" "css" "sh" "sql" "yml" "py")  # ajouter ou retirer des extensions si besoin


# Vérifie que le dossier et le fichier de sortie sont fournis en arguments
if [ $# -ne 2 ]; then
  echo "Usage: $0 dossier_de_travail fichier_sortie.txt"
  exit 1
fi

input_dir="$1"
output_file="$2"

# Vérifie que le dossier existe
if [ ! -d "$input_dir" ]; then
  echo "Erreur : le dossier '$input_dir' n'existe pas."
  exit 1
fi

# Vide ou crée le fichier de sortie
> "$output_file"

# Construction de la commande find avec les extensions
find_command=(find "$input_dir" -type f)
if [ ${#extensions[@]} -gt 0 ]; then
  find_command+=("(")
  for i in "${!extensions[@]}"; do
    find_command+=(-name "*.${extensions[i]}")
    # Ajouter -o sauf pour le dernier
    if [ $i -lt $((${#extensions[@]} - 1)) ]; then
      find_command+=(-o)
    fi
  done
  find_command+=(")")
fi

# Exécution de la commande find
"${find_command[@]}" | while read -r file; do
  # Path relatif par rapport au dossier de travail
  rel_path="${file#$input_dir/}"
  echo "file: $rel_path" >> "$output_file"
  cat "$file" >> "$output_file"
  echo "" >> "$output_file"  # ligne vide entre fichiers
done
