import os
import io
import json
from flask import request, Response, send_file
import jwt
from flask_cors import cross_origin
from googleapiclient.http import MediaIoBaseDownload
from googleapiclient.errors import HttpError
from PIL import Image
from .utils import get_drive_service
from .config import logger, JWT_SECRET, get_jwt_audience, ALLOWED_ORIGINS


def register_routes(app):
    @app.route("/drive/photo/<database_id>/<file_id>", methods=["GET", "OPTIONS"])
    @cross_origin(
        origins=ALLOWED_ORIGINS,
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "OPTIONS"]
    )
    def serve_photo(database_id, file_id):  # <-- database_id ajouté
        if request.method == "OPTIONS":
            return Response(status=200)

        drive_url = f"https://drive.google.com/file/d/{file_id}/"

        try:
            # 🔹 Téléchargement depuis Google Drive
            drive_service = get_drive_service(database_id)
            request_drive = drive_service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request_drive)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            fh.seek(0)

            # 🔹 Détecter le format réel
            img = Image.open(fh)
            img_format = img.format.upper() if img.format else "JPEG"

            # 🔹 MIME
            format_to_mime = {
                "PNG": "image/png",
                "JPEG": "image/jpeg",
                "JPG": "image/jpeg",
                "GIF": "image/gif",
                "WEBP": "image/webp",
                "TIFF": "image/tiff",
                "TIF": "image/tiff",
                "BMP": "image/bmp",
                "ICO": "image/x-icon",
                "JP2": "image/jp2",
                "JPEG2000": "image/jp2",
            }
            mime = format_to_mime.get(img_format, "application/octet-stream")

            # 🔹 Nom de fichier côté serveur
            ext_map = {
                "JPEG": "jpg", "JPG": "jpg",
                "PNG": "png",
                "GIF": "gif",
                "WEBP": "webp",
                "TIFF": "tiff",
                "TIF": "tif",
                "BMP": "bmp",
                "ICO": "ico",
                "JP2": "jp2",
                "JPEG2000": "jp2",
            }
            filename = f"{file_id}.{ext_map.get(img_format, 'bin')}"

            logger.debug(f"✅ Image téléchargée : {filename} ({mime})")

            # 🔹 Ré-écriture dans un BytesIO pour send_file
            out = io.BytesIO()
            img.save(out, format=img_format)
            out.seek(0)

            return send_file(out, mimetype=mime, download_name=filename)

        except jwt.ExpiredSignatureError:
            return Response(json.dumps({
                "error": "Token expired",
                "drive_url": drive_url
            }), status=401, mimetype="application/json")

        except jwt.InvalidTokenError as e:
            return Response(json.dumps({
                "error": f"Invalid token: {str(e)}",
                "drive_url": drive_url
            }), status=401, mimetype="application/json")

        except HttpError as e:
            status_code = e.resp.status
            msg = {
                404: f"Google Drive: file not found (id={file_id})",
                403: f"Google Drive: access denied (id={file_id})"
            }.get(status_code, f"Google Drive error ({status_code}): {str(e)}")
            logger.warning(f"{msg} — {drive_url}")
            return Response(json.dumps({
                "error": msg,
                "drive_url": drive_url
            }), status=status_code, mimetype="application/json")

        except Exception as e:
            logger.exception(f"Failed to serve Drive photo — {drive_url}")
            return Response(json.dumps({
                "error": f"Internal server error: {str(e)}",
                "drive_url": drive_url
            }), status=500, mimetype="application/json")
