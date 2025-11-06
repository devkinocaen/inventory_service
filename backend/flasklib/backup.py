import os
import logging
import subprocess
import json
import jwt
import psycopg
from flask import request, Response
from flask_cors import cross_origin
from datetime import datetime, timedelta
from dateutil import parser
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError
from .utils import get_drive_folder_id, get_drive_service, DriveFolderType
from .db import get_db_config
from flasklib.rotate_backups import rotate_backups
import flasklib.config as config
from flasklib.config import get_jwt_audience

logger = logging.getLogger(__name__)

BACKUP_PREFIX = "backup"

def register_routes(app):
    @app.route("/backup/<database_id>", methods=["POST"])
    @cross_origin(origins=config.ALLOWED_ORIGINS, supports_credentials=True)
    def backup_database(database_id):
        dump_file = None
        try:
            # 🔹 JWT authentication
            auth_header = request.headers.get("Authorization", "")
            token = auth_header.split(" ")[1] if " " in auth_header else None
            if not token:
                return Response(json.dumps({"error": "No token provided"}), status=401, mimetype="application/json")

            audience = get_jwt_audience(database_id)
            decoded = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"], audience=audience)
            role = decoded.get("app_metadata", {}).get("role")
            if role not in ["admin", "dev"]:
                return Response(json.dumps({"error": "Forbidden"}), status=403, mimetype="application/json")
            
            # 🔹 DB config & Drive folder
            db_cfg = get_db_config(database_id)
            folder_id = get_drive_folder_id(database_id, DriveFolderType.BACKUP)

            # 🔹 Check si backup nécessaire
            try:
                with psycopg.connect(
                    host=db_cfg["host"],
                    port=db_cfg["port"],
                    user=db_cfg["user"],
                    password=db_cfg["password"],
                    dbname=db_cfg["dbname"],
                    sslmode="require"
                ) as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT last_data_export, updated_at FROM inventory.app_config WHERE id = 1")
                        row = cur.fetchone()
                        last_export, updated_at = row if row else (None, None)

                        logger.debug("🔹 last_data_export raw: %s (%s), updated_at raw: %s (%s)",
                                     last_export, type(last_export), updated_at, type(updated_at))

                        # Si les deux dates sont présentes
                        if last_export is not None and updated_at is not None:
                            # Comparaison avec granularité 1 minute
                            if last_export >= (updated_at - timedelta(minutes=1)):
                                logger.info(
                                    "⚠️ Backup skipped: last_data_export (%s) ≥ updated_at (%s) - within 1 min granularity",
                                    last_export, updated_at
                                )
                                return Response(
                                    json.dumps({"status": "skipped", "reason": "Backup already up-to-date"}),
                                    mimetype="application/json",
                                    status=200
                                )
                        else:
                            logger.info("ℹ️ last_data_export ou updated_at est None, backup sera effectué par défaut.")

            except Exception as e:
                logger.warning("⚠️ Failed to check last_data_export: %s", e)
                # En cas d'erreur de lecture, on continue pour effectuer le backup

            # 🔹 Dump PostgreSQL (tables + données)
            ts = datetime.now(tz=config.LOCAL_TZ).strftime("%Y%m%dT%H%M%S")
            dump_file = f"/tmp/{BACKUP_PREFIX}_{database_id}_{ts}.sql"

            tables = [
                "inventory.reservable_booking",
                "inventory.reservable_style_link",
                "inventory.reservable",
                "inventory.booking_reference",
                "inventory.reservable_style",
                "inventory.size",
                "inventory.size_type",
                "inventory.reservable_subcategory",
                "inventory.reservable_category",
                "inventory.organization",
                "inventory.person",
                "inventory.storage_location",
                "inventory.app_config"
            ]


            cmd = [
                "pg_dump",
                "-h", db_cfg["host"],
                "-p", str(db_cfg["port"]),
                "-U", db_cfg["user"],
                "-d", db_cfg["dbname"],
                "-F", "p",
                "--no-owner",
                "--no-acl",
                "--data-only",
                "--verbose"
            ]

            # 🔹 Activer SSL via l'environnement
            env = os.environ.copy()
            env["PGPASSWORD"] = db_cfg["password"]
            env["PGSSLMODE"] = "require"

            for t in tables:
                cmd.extend(["--table", t])


            # 🔹 Log version et chemin de pg_dump
            try:
                pg_dump_version = subprocess.run(
                    ["pg_dump", "--version"], capture_output=True, text=True, env=env
                ).stdout.strip()
                pg_dump_path = subprocess.run(
                    ["which", "pg_dump"], capture_output=True, text=True, env=env
                ).stdout.strip()
                logger.info("🔹 pg_dump path: %s", pg_dump_path)
                logger.info("🔹 pg_dump version: %s", pg_dump_version)
            except Exception as e:
                logger.warning("⚠️ Impossible de récupérer la version de pg_dump: %s", e)

            # 🔹 Exécuter le dump
            logger.info("🔹 Running pg_dump for database %s", database_id)
            try:
                result = subprocess.run(
                    cmd,
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    env=env
                )
                # Écrire le dump dans le fichier
                with open(dump_file, "wb") as f:
                    f.write(result.stdout)
                logger.info("✅ Dump finished: %s", dump_file)

            except subprocess.CalledProcessError as e:
                stdout_msg = e.stdout.decode() if e.stdout else ""
                stderr_msg = e.stderr.decode() if e.stderr else ""

                # Vérifie si l'erreur vient d'un mismatch de version
                if "server version" in stdout_msg or "server version" in stderr_msg:
                    try:
                        pg_dump_version = subprocess.run(
                            ["pg_dump", "--version"], capture_output=True, text=True
                        ).stdout.strip()
                    except Exception:
                        pg_dump_version = "inconnue"

                    user_message = (
                        "Erreur : version de pg_dump incompatible avec la version du serveur PostgreSQL.\n"
                        f"pg_dump version: {pg_dump_version}\n"
                        "Mettez à jour pg_dump ou utilisez la version correspondant au serveur.\n"
                        f"Détails serveur: {stderr_msg.strip()}"
                    )
                else:
                    user_message = f"pg_dump failed:\n{stderr_msg.strip()}"

                logger.error("pg_dump failed:\n%s", stderr_msg)
                return Response(
                    json.dumps({"error": user_message}),
                    status=500,
                    mimetype="application/json"
                )

            # 🔹 Upload sur Google Drive
            drive_service = get_drive_service(database_id, DriveFolderType.BACKUP)
            file_metadata = {"name": f"{BACKUP_PREFIX}_{database_id}_{ts}.sql", "parents": [folder_id]}
            media = MediaFileUpload(dump_file, mimetype="application/sql")
            file = drive_service.files().create(
                body=file_metadata,
                media_body=media,
                fields="id,name",
                supportsAllDrives=True
            ).execute()

            logger.info("✅ Backup uploaded to Drive: %s", file.get("name"))
            

            # 🔹 Mise à jour de last_data_export dans app_config
            try:
                with psycopg.connect(
                    host=db_cfg["host"],
                    port=db_cfg["port"],
                    user=db_cfg["user"],
                    password=db_cfg["password"],
                    dbname=db_cfg["dbname"],
                    sslmode="require"
                ) as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            UPDATE inventory.app_config
                            SET last_data_export = %s,
                                updated_at = %s
                            WHERE id = 1
                            """,
                            (datetime.now(tz=config.LOCAL_TZ), datetime.now(tz=config.LOCAL_TZ))
                        )



                logger.info("🕒 inventory.app_config.last_data_export updated successfully")
            except Exception as e:
                logger.warning("⚠️ Failed to update last_data_export: %s", e)

            
            # 🔹 Rotation différentielle des backups
            try:
                rotate_backups(drive_service, folder_id, database_id)
            except Exception as e:
                logger.warning("⚠️ Backup rotation failed: %s", e)
                
            return Response(json.dumps({"status": "success", "file": file.get("name"), "id": file.get("id")}), mimetype="application/json")

        except FileNotFoundError as e:
            # Cas où le dossier Google Drive ou le token n'existe pas
            logger.error("❌ %s", e)
            return Response(
                json.dumps({"error": f"Google Drive folder or token not found: {e}"}),
                status=404,
                mimetype="application/json"
            )

        except HttpError as e:
            logger.exception("Google Drive upload failed")
            return Response(
                json.dumps({"error": f"Google Drive API error: {e}"}),
                status=e.resp.status,
                mimetype="application/json"
            )

        except jwt.ExpiredSignatureError:
            return Response(
                json.dumps({"error": "Token expired"}),
                status=401,
                mimetype="application/json"
            )

        except jwt.InvalidTokenError as e:
            return Response(
                json.dumps({"error": f"Invalid token: {e}"}),
                status=401,
                mimetype="application/json"
            )

        except Exception as e:
            logger.exception("Unexpected error")
            return Response(
                json.dumps({"error": f"Unexpected error: {str(e)}"}),
                status=500,
                mimetype="application/json"
            )

        finally:
            if dump_file and os.path.exists(dump_file):
                try:
                    os.remove(dump_file)
                    logger.debug("✅ Temporary dump file removed: %s", dump_file)
                except Exception as e:
                    logger.warning("⚠️ Failed to remove temporary dump file: %s", e)
