# oauth_setup.py
# use python oauth_setup.py --credentials ./secrets/my_creds.json --token ./secrets/my_token.json

import argparse
import sys
from google_auth_oauthlib.flow import InstalledAppFlow

# ⚡ Changer le scope pour accès complet au Drive
SCOPES = ["https://www.googleapis.com/auth/drive"]  # drive complet

def main():
    parser = argparse.ArgumentParser(description="Setup Google OAuth and generate token.json")
    parser.add_argument("--credentials", default="credentials.json", help="Chemin vers le fichier credentials.json")
    parser.add_argument("--token", default="token.json", help="Chemin de sortie du token.json")

    # Si aucun argument n’est fourni, afficher l’aide
    if len(sys.argv) == 1:
        parser.print_help()
        sys.exit(0)

    args = parser.parse_args()

    flow = InstalledAppFlow.from_client_secrets_file(args.credentials, SCOPES)
    creds = flow.run_local_server(port=8080)

    # Sauvegarde du token
    with open(args.token, "w") as token_file:
        token_file.write(creds.to_json())

    print(f"✅ Token généré et sauvegardé dans {args.token}")
    print("ℹ️ Ce token a maintenant accès à tous les dossiers Drive accessibles par ce compte OAuth.")

if __name__ == "__main__":
    main()
