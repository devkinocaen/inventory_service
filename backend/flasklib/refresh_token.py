import json
import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

TOKEN_PATH = "./token.json"
SCOPES = ["https://www.googleapis.com/auth/drive"]

def get_drive_service():
    if not os.path.exists(TOKEN_PATH):
        raise FileNotFoundError("Token JSON file not found.")

    # Charger le token existant
    with open(TOKEN_PATH, "r") as f:
        data = json.load(f)

    creds = Credentials(
        token=data.get("token"),
        refresh_token=data.get("refresh_token"),
        token_uri=data.get("token_uri"),
        client_id=data.get("client_id"),
        client_secret=data.get("client_secret"),
        scopes=data.get("scopes")
    )

    # Vérifier si le token est expiré
    if not creds.valid or creds.expired:
        print("🔄 Token expired, refreshing...")
        creds.refresh(Request())  # <-- corrigé

        # Mettre à jour le fichier JSON avec le nouveau token et expiry
        data["token"] = creds.token
        data["expiry"] = creds.expiry.isoformat() if creds.expiry else None
        with open(TOKEN_PATH, "w") as f:
            json.dump(data, f, indent=2)
        print("✅ Token refreshed")

    # Créer le service Drive
    service = build("drive", "v3", credentials=creds)
    return service
