import logging
import os
import sys
import json
from enum import Enum

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.auth.transport.requests import Request  # <-- nécessaire pour refresh
import flasklib.config as config
from .config import get_db_config

logger = logging.getLogger(__name__)


SCOPES = ["https://www.googleapis.com/auth/drive"]  # scope complet


def log_notices(conn):
    """
    Récupère et log les notices PostgreSQL depuis la connexion psycopg v3.
    """
    try:
        notices = getattr(conn, "notices", None)
        if not notices:
            return
        for notice in notices:
            logger.info("⚠️ PostgreSQL NOTICE: %s", notice.strip())
        notices.clear()
    except AttributeError:
        logger.debug("🔹 Notices not available in this psycopg version")


def get_drive_service(database_id: str, folder_type: "DriveFolderType" = None):
    """
    Crée le service Google Drive via le token utilisateur correspondant à la base database_id.
    
    - Récupère le token depuis config.py (DATABASES)
    - folder_type optionnel pour vérifier l'accès à un dossier spécifique
    - Utilise la variable d'environnement GOOGLE_TOKEN_JSON_FOLDER pour localiser le token
    """
    try:
        db_conf = get_db_config(database_id)

        # 🔹 token JSON
        token_filename = db_conf.get("gdrive_token")
        token_folder = os.environ.get("GOOGLE_TOKEN_JSON_FOLDER")
        if not token_filename or not token_folder:
            raise FileNotFoundError(f"Token JSON missing for {database_id}")

        token_path = os.path.join(token_folder, token_filename)
        if not os.path.exists(token_path):
            raise FileNotFoundError(f"Token JSON not found for {database_id} at {token_path}")

        # 🔹 lecture token
        with open(token_path, "r") as f:
            token_data = json.load(f)

        creds = Credentials(
            token=token_data.get("token"),
            refresh_token=token_data.get("refresh_token"),
            token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=token_data.get("client_id"),
            client_secret=token_data.get("client_secret"),
            scopes=SCOPES
        )

        # 🔹 refresh si nécessaire
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())

        service = build("drive", "v3", credentials=creds)

        # 🔹 Vérification accès folder si folder_type fourni
        if folder_type:
            folder_map = {
                DriveFolderType.BACKUP: "gdrive_backup_id",
                DriveFolderType.INVENTORY: "gdrive_inventory_id",
            }
            folder_key = folder_map.get(folder_type)
            folder_id = db_conf.get(folder_key)
            if folder_id:
                try:
                    perms = service.permissions().list(
                        fileId=folder_id,
                        fields="permissions(role,type,emailAddress)"
                    ).execute()
                    has_write = any(p["role"] in ["writer", "owner"] for p in perms.get("permissions", []))
                    if not has_write:
                        raise PermissionError(
                            f"User token for {database_id} does not have write access to folder {folder_id}"
                        )
                except HttpError as e:
                    raise RuntimeError(
                        f"Failed to fetch permissions for folder {folder_id} using {database_id}: {e}"
                    ) from e

        logger.info("✅ Using user Drive credentials for %s", database_id)
        return service

    except Exception as e:
        raise RuntimeError(f"Unable to initialize Google Drive service for {database_id}: {e}") from e

        

class DriveFolderType(Enum):
    BACKUP = "backup"
    INVENTORY = "inventory"
    
def get_drive_folder_id(database_id: str, folder_type: DriveFolderType = DriveFolderType.BACKUP) -> str:
    """
    Retourne le folder Google Drive correspondant à un type de fichier pour une base donnée.
    Lève une exception si le dossier n'existe pas réellement dans Google Drive.
    """
    db_conf = get_db_config(database_id)

    # 🔹 Récupère l'ID du dossier depuis la config de la base
    folder_map = {
        DriveFolderType.BACKUP: "gdrive_backup_id",
        DriveFolderType.INVENTORY: "gdrive_inventory_id",
    }
    folder_key = folder_map.get(folder_type)
    folder_id = db_conf.get(folder_key)

    if not folder_id:
        raise ValueError(
            f"Missing Google Drive folder ID for database {database_id} "
            f"and type {folder_type.name} (expected key: {folder_key})"
        )

    # 🔹 Vérification via l’API Drive
    drive_service = get_drive_service(database_id, folder_type=folder_type)
    try:
        drive_service.files().get(fileId=folder_id, fields="id,name").execute()
        logger.debug("✅ Google Drive folder exists: %s (%s - %s)", folder_id, database_id, folder_type.value)
        return folder_id

    except HttpError as e:
        if e.resp.status == 404:
            raise FileNotFoundError(
                f"Google Drive folder not found for database '{database_id}' "
                f"and type '{folder_type.value}' (id={folder_id})"
            ) from e
        else:
            raise
