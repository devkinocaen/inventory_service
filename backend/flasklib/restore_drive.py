import os
import re
import json
import subprocess
import logging
import psycopg
import tempfile
from psycopg.rows import dict_row
from psycopg import sql
from io import StringIO
from flask import request, Response
from flask_cors import cross_origin
import jwt
from googleapiclient.http import MediaIoBaseDownload
from .db import get_db_config
from .utils import get_drive_folder_id, get_drive_service, DriveFolderType
from .config import logger, ALLOWED_ORIGINS, JWT_SECRET, get_jwt_audience

logger = logging.getLogger(__name__)

# Ordre de restauration pour éviter les FK : parents avant enfants
RESTORE_ORDER = [
    # 🔹 Config globale
    "public.app_config",

    # 🔹 Personnes et organisations
    "public.person",
    "public.organization",

    # 🔹 Stockage
    "public.storage_location",

    # 🔹 Styles et tailles
    "public.size_type",
    "public.size",
    "public.reservable_style",

    # 🔹 Catégories et sous-catégories
    "public.reservable_category",
    "public.reservable_subcategory",

    # 🔹 Types et statuts
    "public.reservable_type",
    "public.reservable_status",

    # 🔹 Objets réservable
    "public.reservable",

    # 🔹 Liens N:N styles <-> objets
    "public.reservable_style_link",

    # 🔹 Références de booking
    "public.booking_reference",

    # 🔹 Réservations
    "public.reservable_booking"
]

# Ordre de purge pour éviter les FK : enfants avant parents
TRUNCATE_ORDER = [
    # 🔹 Réservations et liens N:N
    "public.reservable_booking",
    "public.reservable_style_link",

    # 🔹 Objets réservable
    "public.reservable",

    # 🔹 Références de booking
    "public.booking_reference",

    # 🔹 Styles et tailles
    "public.reservable_style",
    "public.size",
    "public.size_type",

    # 🔹 Catégories et sous-catégories
    "public.reservable_subcategory",
    "public.reservable_category",

    # 🔹 Types et statuts
    "public.reservable_status",
    "public.reservable_type",

    # 🔹 Stockage
    "public.storage_location",

    # 🔹 Organisations et personnes
    "public.organization",
    "public.person",

    # 🔹 Config globale
    "public.app_config"
]

# Séquences à réinitialiser après purge
SEQUENCES = [
    "app_config_id_seq",
    "person_id_seq",
    "organization_id_seq",
    "storage_location_id_seq",
    "reservable_style_id_seq",
    "size_type_id_seq",
    "size_id_seq",
    "reservable_category_id_seq",
    "reservable_subcategory_id_seq",
    "reservable_type_id_seq",
    "reservable_status_id_seq",
    "reservable_id_seq",
    "reservable_style_link_reservable_id_seq",  # si besoin
    "booking_reference_id_seq",
    "reservable_booking_id_seq"
]



def disable_user_triggers(cur, table: str):
    """
    Désactive tous les triggers utilisateur (non-système) pour une table donnée.
    """
    cur.execute(f"""
    DO $$
    DECLARE t RECORD;
    BEGIN
        FOR t IN
            SELECT tgname
            FROM pg_trigger
            WHERE tgrelid = '{table}'::regclass
              AND NOT tgisinternal
        LOOP
            EXECUTE format('ALTER TABLE {table} DISABLE TRIGGER %I;', t.tgname);
        END LOOP;
    END$$;
    """)

def enable_user_triggers(cur, table: str):
    """
    Réactive tous les triggers utilisateur (non-système) pour une table donnée.
    """
    cur.execute(f"""
    DO $$
    DECLARE t RECORD;
    BEGIN
        FOR t IN
            SELECT tgname
            FROM pg_trigger
            WHERE tgrelid = '{table}'::regclass
              AND NOT tgisinternal
        LOOP
            EXECUTE format('ALTER TABLE {table} ENABLE TRIGGER %I;', t.tgname);
        END LOOP;
    END$$;
    """)
    
def restore_strict(local_file, cur):
    """Restore complet en mode strict en utilisant le curseur passé"""
    logger.info(f"🔹 Démarrage de restore_strict pour {local_file}")

    # Lire le dump et isoler uniquement les COPY des tables souhaitées
    table_lines = {table: [] for table in RESTORE_ORDER}
    with open(local_file, "r", encoding="utf-8") as f:
        keep_table = None
        for line in f:
            line_strip = line.strip()
            # début d'un bloc COPY
            m = re.match(r"COPY (\S+) \(", line_strip)
            if m and m.group(1) in TABLES:
                keep_table = m.group(1)
                table_lines[keep_table].append(line)
                continue

            if keep_table:
                table_lines[keep_table].append(line)
                if line_strip == r"\.":
                    keep_table = None  # fin du bloc

    # Restore table par table
    for table in RESTORE_ORDER:
        lines = table_lines[table]
        if not lines:
            continue

        disable_user_triggers(cur, table)

        # Extraire colonnes depuis la ligne COPY
        header = lines[0]
        cols = None
        parts = header.split("(")
        if len(parts) == 2:
            cols = [c.strip() for c in parts[1].split(")")[0].split(",")]

        # Insérer toutes les lignes
        for line in lines[1:]:
            if line.strip() == r"\.":
                continue
            raw_values = line.rstrip("\n").split("\t")
            # remplacer '\N' par None
            values = [None if v == r"\N" else v for v in raw_values]

            if cols and len(values) != len(cols):
                logger.warning(
                    f"Ligne ignorée pour {table}, colonnes={len(cols)} valeurs={len(values)}: {values}"
                )
                continue  # skip si nombre de valeurs différent du nombre de colonnes

            col_list = ", ".join(cols) if cols else "*"
            placeholders = ", ".join(["%s"] * len(values))
            query = f"INSERT INTO {table} ({col_list}) VALUES ({placeholders})"
            cur.execute(query, tuple(values))

        enable_user_triggers(cur, table)
        logger.info(f"✅ Table {table} restaurée avec succès")

    logger.info("✔ Restore strict terminé avec succès")



def restore_tolerant(local_file, cur):
    """Restore complet en mode tolérant aux différences de schéma"""
    logger.info(f"🔹 Démarrage de restore_tolerant pour {local_file}")

    # 🔹 Récupérer colonnes actuelles pour chaque table
    table_columns = {}
    for table in TABLES:
        schema, tbl = table.split(".")
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema=%s AND table_name=%s
        """, (schema, tbl))
        table_columns[table] = [row[0] for row in cur.fetchall()]

    # Lire le dump et isoler uniquement les COPY des tables souhaitées
    table_lines = {table: [] for table in RESTORE_ORDER}
    with open(local_file, "r", encoding="utf-8") as f:
        keep_table = None
        for line in f:
            line_strip = line.strip()
            m = re.match(r"COPY (\S+) \(", line_strip)
            if m and m.group(1) in TABLES:
                keep_table = m.group(1)
                table_lines[keep_table].append(line)
                continue
            if keep_table:
                table_lines[keep_table].append(line)
                if line_strip == r"\.":
                    keep_table = None  # fin du bloc

    # 🔹 Restaurer table par table
    for table in RESTORE_ORDER:
        lines = table_lines[table]
        if not lines:
            continue

        disable_user_triggers(cur, table)

        # Extraire colonnes depuis la ligne COPY
        header = lines[0]
        dump_cols = None
        parts = header.split("(")
        if len(parts) == 2:
            dump_cols = [c.strip() for c in parts[1].split(")")[0].split(",")]

        # Colonnes finales à insérer = intersection dump_cols / table_columns
        if dump_cols:
            valid_cols = [c for c in dump_cols if c in table_columns[table]]
        else:
            valid_cols = table_columns[table]

        col_list_str = ", ".join(valid_cols)
        placeholders_str = ", ".join(["%s"] * len(valid_cols))

        # Insérer toutes les lignes
        for line in lines[1:]:
            if line.strip() == r"\.":
                continue
            raw_values = line.rstrip("\n").split("\t")
            # remplacer '\N' par None
            values = [None if v == r"\N" else v for v in raw_values]

            # filtrer uniquement les colonnes existantes
            if dump_cols:
                # construire mapping dump_col -> valeur
                col_value_map = dict(zip(dump_cols, values))
                values_final = [col_value_map.get(c) for c in valid_cols]
            else:
                values_final = values[:len(valid_cols)]

            cur.execute(
                f"INSERT INTO {table} ({col_list_str}) VALUES ({placeholders_str})",
                tuple(values_final)
            )

        enable_user_triggers(cur, table)
        logger.info(f"✅ Table {table} restaurée avec succès (tolérant)")

    logger.info("✔ Restore tolerant terminé avec succès")



def truncate_tables(cur):
    """🔹 Purge toutes les tables dans l'ordre correct avec RESTART IDENTITY CASCADE"""
    for table in TRUNCATE_ORDER:
        cur.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE;")
    logger.info("✔ Toutes les tables purgées dans l'ordre correct")

def realign_sequences(cur):
    """🔹 Réaligner toutes les séquences après restauration (uniquement pour les tables sauvegardées)"""
    for seq in SEQUENCES:
        # Exemple : shooting_location_id_seq -> shooting_location
        table = seq.rsplit("_id_seq", 1)[0]
        try:
            cur.execute(f"""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name=%s
                AND column_default LIKE 'nextval%';
            """, (table,))
            columns = cur.fetchall()
            for (col,) in columns:
                cur.execute(f"""
                    SELECT setval(
                        pg_get_serial_sequence('{table}', '{col}'),
                        COALESCE(MAX({col}),0)+1,
                        false
                    ) FROM {table};
                """)
            logger.info(f"✔ Séquence(s) réalignée(s) pour {table}")
        except Exception as e:
            logger.warning(f"⚠ Impossible de réaligner la séquence pour {table}: {e}")

def get_backup_version(dump_path):
    """Extrait schema_version depuis le dump, si présent."""
    backup_version = None
    with open(dump_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    try:
        start_idx = next(i for i, line in enumerate(lines) if line.startswith("COPY public.app_config"))
    except StopIteration:
        return None

    # lire la première ligne du bloc COPY
    i = start_idx + 1
    while i < len(lines) and lines[i].strip() != r"\.":
        row = lines[i].rstrip("\n").split("\t")
        if len(row) >= 6:  # index 5 = schema_version
            backup_version = row[5] or None
            break
        i += 1

    return backup_version


def get_current_versions(conn):
    """Récupère schema_version et app_version depuis la base actuelle."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT schema_version, app_version
            FROM public.app_config
            LIMIT 1;
        """)
        result = cur.fetchone()
        if result:
            return result[0], result[1]  # (schema_version, app_version)
        else:
            return None, None




def register_routes(app):
    @app.route("/restore/<database_id>", methods=["POST"])
    @cross_origin(origins=["*"], supports_credentials=True)
    def restore_database(database_id):
        import tempfile
        import subprocess

        local_file = f"/tmp/{database_id}_restore.sql"
        conn = None
        try:
            auth_header = request.headers.get("Authorization", "")
            token = auth_header.split(" ")[1] if " " in auth_header else None
            if not token:
                return Response(json.dumps({"error": "No token provided"}), status=401, mimetype="application/json")
            decoded = jwt.decode(   token,
                                    JWT_SECRET,
                                    algorithms=["HS256"],
                                    audience=get_jwt_audience(database_id)
                                )
            user_role = decoded.get("app_metadata", {}).get("role")
            if user_role not in ["admin", "dev"]:
                return Response(json.dumps({"error": "Forbidden"}), status=403, mimetype="application/json")

            params = request.get_json() or {}
            file_id = params.get("drive_file_id")
            strict_mode = params.get("strict", False)
            if not file_id:
                return Response(json.dumps({"error": "drive_file_id required"}), status=400, mimetype="application/json")

            drive_service = get_drive_service(database_id, DriveFolderType.BACKUP)
            folder_id = get_drive_folder_id(database_id, DriveFolderType.BACKUP)
            file_metadata = drive_service.files().get(fileId=file_id, fields="id, name, parents").execute()
            if folder_id not in file_metadata.get("parents", []):
                return Response(json.dumps({"error": "File not in correct backup folder"}), status=400, mimetype="application/json")

            request_drive = drive_service.files().get_media(fileId=file_id)
            with open(local_file, "wb") as f:
                done = False
                downloader = MediaIoBaseDownload(f, request_drive)
                while not done:
                    _, done = downloader.next_chunk()

            cfg = get_db_config(database_id)
            conn = psycopg.connect(
                host=cfg["host"], port=cfg["port"], user=cfg["user"],
                password=cfg["password"], dbname=cfg["dbname"]
            )
            conn.autocommit = False
            
            # 🔹 Point de restore global
            with conn.cursor() as cur:
                cur.execute("SAVEPOINT pre_restore;")

            backup_version = get_backup_version(local_file)
            current_schema_version, current_app_version = get_current_versions(conn)

            logger.info(f"🔹 Backup schema_version: {backup_version}")
            logger.info(f"🔹 Current schema_version: {current_schema_version}, app_version: {current_app_version}")
            logger.info(f"🔹 strict_mode flag: {strict_mode}")

            mode_str = None

            with conn.cursor() as cur:
                # 1️⃣ Truncate toutes les tables
                truncate_tables(cur)

                # 2️⃣ Restore en fonction du mode
                if strict_mode:
                    if backup_version is None:
                        logger.error("🔹 Impossible de déterminer backup_version, mode strict échoue")
                        raise Exception("backup_version introuvable, restore strict impossible")
                    elif backup_version != current_schema_version:
                        logger.error(f"🔹 Version du backup différente de la version courante, rollback obligatoire "
                                     f"(backup {backup_version} vs current {current_schema_version})")
                        raise Exception(f"Version mismatch: backup {backup_version} vs current {current_schema_version}")
                    else:
                        logger.info("🔹 Mode strict activé, versions identiques, restauration en cours")
                        restore_strict(local_file, cur)
                        mode_str = "strict"
                else:
                    if backup_version is None:
                        logger.warning("🔹 backup_version introuvable, bascule automatique en mode tolérant")
                    else:
                        logger.info("🔹 Mode tolérant activé")
                    restore_tolerant(local_file, cur)
                    mode_str = "tolerant"

                # 3️⃣ Réaligner toutes les séquences après restauration
                realign_sequences(cur)

                # 4️⃣ Remettre app_config aux versions pré-restore
                cur.execute("""
                    UPDATE public.app_config
                    SET schema_version = %s,
                        app_version = %s
                """, (current_schema_version, current_app_version))

            logger.info(f"🔹 Restore terminé en mode: {mode_str}")


            conn.commit()
            return Response(json.dumps({
                "status": "success",
                "mode": mode_str,
                "schema": {"current": current_schema_version, "backup": backup_version}
            }), mimetype="application/json")

        except Exception as e:
            if conn:
                conn.rollback()  # 🔹 rollback global
            logger.exception("Restore execution failed")
            return Response(json.dumps({"error": str(e)}), status=500, mimetype="application/json")
        finally:
            if conn:
                conn.close()
