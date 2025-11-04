import os
import logging
import json
import re
from flask import request, Response
from flask_cors import cross_origin
import jwt
from datetime import datetime
from googleapiclient.errors import HttpError
from .utils import get_drive_folder_id, get_drive_service, DriveFolderType
import flasklib.config as config
from flasklib.config import get_jwt_audience

logger = logging.getLogger(__name__)

BACKUP_PREFIX = "backup"

def register_routes(app):
    @app.route("/backup-list/<database_id>", methods=["GET"])
    @cross_origin(origins=config.ALLOWED_ORIGINS, supports_credentials=True)
    def list_backups(database_id):
        logger.debug("🔹 list_backups called for database_id=%s", database_id)
        try:
            # 🔹 JWT authentication
            auth_header = request.headers.get("Authorization", "")
            token = auth_header.split(" ")[1] if " " in auth_header else None
            if not token:
                logger.warning("❌ No token provided")
                return Response(json.dumps({"error": "No token provided"}), status=401, mimetype="application/json")

            audience = get_jwt_audience(database_id)
            decoded = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"], audience=audience)
            role = decoded.get("app_metadata", {}).get("role")
            if role not in ["admin", "dev"]:
                logger.warning("❌ Forbidden role: %s", role)
                return Response(json.dumps({"error": "Forbidden"}), status=403, mimetype="application/json")

            # 🔹 Récupération du dossier Drive
            folder_type = DriveFolderType.BACKUP  # On liste les backups
            folder_id = get_drive_folder_id(database_id, folder_type)
            logger.debug("🔹 folder_id=%s", folder_id)
            drive_service = get_drive_service(database_id, folder_type)

            # 🔹 Liste des fichiers dans le dossier Drive
            results = drive_service.files().list(
                q=f"'{folder_id}' in parents and trashed = false and name contains '{BACKUP_PREFIX}_{database_id}'",
                fields="files(id, name, createdTime)",
                orderBy="createdTime desc"
            ).execute()

            files = results.get("files", [])
            pattern = re.compile(rf"{BACKUP_PREFIX}_{database_id}_(\d{{8}}T\d{{6}})\.sql", re.IGNORECASE)

            for f in files:
                name = f.get("name", "")
                match = pattern.search(name)
                if match:
                    ts_str = match.group(1)
                    f["backup_time"] = datetime.strptime(ts_str, "%Y%m%dT%H%M%S").isoformat()
                else:
                    f["backup_time"] = None
                    logger.debug("⚠️ Failed to parse timestamp from filename '%s'", name)

            return Response(
                json.dumps({"status": "success", "backups": files}),
                mimetype="application/json"
            )

        except jwt.ExpiredSignatureError:
            logger.warning("❌ Token expired")
            return Response(json.dumps({"error": "Token expired"}), status=401, mimetype="application/json")
        except jwt.InvalidTokenError as e:
            logger.warning("❌ Invalid token: %s", e)
            return Response(json.dumps({"error": str(e)}), status=401, mimetype="application/json")
        except HttpError as e:
            status = e.resp.status
            msg = str(e)
            if status == 403:
                msg = "Google Drive access denied. Check token and folder permissions."
            elif status == 404:
                msg = f"Drive folder not found: {folder_id}"
            logger.error("❌ HttpError %s: %s", status, msg)
            return Response(json.dumps({"error": msg}), status=status, mimetype="application/json")
        except Exception as e:
            logger.exception("❌ Backup list failed for database %s", database_id)
            return Response(
                json.dumps({"status": "error", "error": f"Unexpected error: {str(e)}"}),
                status=500,
                mimetype="application/json"
            )
