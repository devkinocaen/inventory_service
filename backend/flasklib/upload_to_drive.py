import os
import json
import logging
from flask import Flask, request, Response
from flask_cors import cross_origin
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError
from .utils import get_drive_service, get_drive_folder_id, DriveFolderType
import flasklib.config as config
import mimetypes
from werkzeug.utils import secure_filename


# 🔹 Récupère le type de dossier Drive à utiliser depuis le JSON POST
#   - data.get("folder_type", "BACKUP") : on lit la clé "folder_type" dans le JSON reçu
#       si elle n'existe pas, on prend "BACKUP" par défaut.
#   - .upper() : on convertit en majuscules pour matcher exactement les valeurs de l'énum DriveFolderType
#
# Options possibles pour folder_type (valeurs de l'énum DriveFolderType) :
#   - "BACKUP"             : dossier réservé aux backups de bases de données
#   - "SHOOTING_LOCATION"  : dossier réservé aux images / documents liés aux lieux de tournage
#   - "EQUIPMENT"          : dossier réservé aux images / documents liés à l’équipement
#   - "COSTUMES"          : dossier réservé aux images / documents liés à la costumerie
#
# Exemple JSON POST :
#   { "file_path": "/tmp/myfile.sql", "folder_type": "BACKUP" }
#   { "file_path": "/tmp/photo.jpg", "folder_type": "SHOOTING_LOCATION" }
#   { "file_path": "/tmp/equip.pdf", "folder_type": "EQUIPMENT" }
#
# Cette valeur sera ensuite convertie en DriveFolderType avec :
#   folder_type = DriveFolderType[folder_type_str]
# et passée à get_drive_folder_id(database_id, folder_type) pour déterminer le dossier cible.


MAX_FILE_SIZE = 300 * 1024  # 300 Ko
CHUNK_SIZE = 16 * 1024      # 16 Ko par lecture

logger = logging.getLogger(__name__)

def register_routes(app: Flask):
    @app.route("/upload_to_drive/<database_id>", methods=["POST", "OPTIONS"])
    @cross_origin(origins=config.ALLOWED_ORIGINS, supports_credentials=True)
    def upload_to_drive(database_id):
        try:
            file = request.files.get("file")
            folder_type_str = request.form.get("folder_type", "BACKUP").upper()  # BACKUP par défaut

            if not file:
                return Response(
                    json.dumps({"error": "No file uploaded"}),
                    status=400,
                    mimetype="application/json"
                )

            # 🔹 Validation folder_type
            try:
                folder_type = DriveFolderType[folder_type_str]
            except KeyError:
                return Response(
                    json.dumps({"error": f"Invalid folder_type: {folder_type_str}"}),
                    status=400,
                    mimetype="application/json"
                )

            # 🔹 Récupère le dossier Google Drive
            folder_id = get_drive_folder_id(database_id, folder_type)
            drive_service = get_drive_service(database_id,folder_id )

            # 🔹 Détecte le type MIME
            mime_type, _ = mimetypes.guess_type(file.filename)
            if not mime_type:
                mime_type = "application/octet-stream"

            # 🔹 Sécurise le nom de fichier et prépare le chemin temporaire
            filename = secure_filename(file.filename)
            local_path = os.path.join("/tmp", filename)
            
            # 🔹 Écriture par chunks avec contrôle de taille
            total_read = 0
            with open(local_path, "wb") as f_out:
                while True:
                    chunk = file.stream.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    total_read += len(chunk)
                    if total_read > MAX_FILE_SIZE:
                        f_out.close()
                        os.remove(local_path)
                        # ⚠ renvoyer JSON d'erreur
                        return Response(
                            json.dumps({
                                "status": "error",
                                "error": f"File too large: exceeds {MAX_FILE_SIZE // 1024} KB"
                            }),
                            mimetype="application/json"
                        )
                    f_out.write(chunk)

            # 🔹 Upload vers Google Drive
            file_metadata = {"name": filename, "parents": [folder_id]}
            media = MediaFileUpload(local_path, mimetype=mime_type)

            uploaded_file = drive_service.files().create(
                body=file_metadata,
                media_body=media,
                fields="id,name",
                supportsAllDrives=True
            ).execute()

            drive_url = f"https://drive.google.com/file/d/{uploaded_file['id']}/view?usp=drive_link"

            # 🔹 Nettoyage
            os.remove(local_path)

            # 🔹 Réponse JSON avec conservation du folder_type
            return Response(
                json.dumps({
                    "status": "success",
                    "file_name": uploaded_file["name"],
                    "file_id": uploaded_file["id"],
                    "folder_type": folder_type.value,
                    "drive_url": drive_url,
                    "file_size": total_read
                }),
                mimetype="application/json"
            )

        except HttpError as e:
            logger.exception("❌ Google Drive upload failed")
            return Response(
                json.dumps({"error": f"Google Drive API error: {e}"}),
                status=e.resp.status,
                mimetype="application/json"
            )

        except Exception as e:
            logger.exception("❌ Unexpected error")
            return Response(
                json.dumps({"error": str(e)}),
                status=500,
                mimetype="application/json"
            )
