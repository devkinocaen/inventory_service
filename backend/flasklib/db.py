import logging
import psycopg
from psycopg.errors import OperationalError
from flask import jsonify
import os

from .types import get_sql_value
from .config import get_db_config  # <-- import depuis config.py

logger = logging.getLogger(__name__)

DEBUG = os.environ.get("FLASK_DEBUG", "0") in ("1", "true", "True")


def get_conn(database_id: str = "BASETEST_AD"):
    """
    Ouvre une connexion PostgreSQL à partir de databases.json
    """
    logger.debug("🔹 get_conn called for database_id=%s", database_id)
    try:
        cfg = get_db_config(database_id)
        logger.debug(f"config: {cfg}")
        logger.debug(
            "🔹 DB config: host=%s, dbname=%s, user=%s, password=%s",
            cfg["host"], cfg["dbname"], cfg["user"], "***" if cfg["password"] else None
        )

        endpoint_id = cfg["host"].split(".")[0] if cfg["host"] else "unknown"

        # Détection automatique du provider Neon
        host = cfg["host"].lower()
        is_neon = "neon.tech" in host or "neon.build" in host

        # Port : Neon et Alwaysdata utilisent 5432
        port = int(cfg.get("port", 5432))

        # Construction du DSN
        dsn = (
            f"postgresql://{cfg['user']}:{cfg['password']}@{cfg['host']}:{port}/{cfg['dbname']}?sslmode=require"
        )

        # Ajout d’une option spécifique Neon (endpoint)
        if is_neon:
            dsn += f"&options=endpoint%3D{endpoint_id}"

        # Timeout universel
        dsn += "&connect_timeout=10"

        logger.debug("🔹 DSN constructed: %s", dsn.replace(cfg["password"], "***"))

        # Tentative de connexion
        try:
            conn = psycopg.connect(dsn, autocommit=True)
            logger.debug("✅ Connection established")

        except OperationalError as oe:
            msg_text = str(oe)
            if "password authentication failed" in msg_text:
                logger.error("❌ Password authentication failed for user %s", cfg['user'])
                raise RuntimeError(f"Password authentication failed for user {cfg['user']}")
            else:
                msg = msg_text.split("\n")[0]
                logger.error("❌ Database connection failed: %s", msg)
                raise RuntimeError(f"Database connection failed: {msg}")

        except Exception as conn_ex:
            raise RuntimeError(f"Unexpected connection error: {str(conn_ex)}") from conn_ex

        # Définir le paramètre app.debug côté serveur
        with conn.cursor() as cur:
            cur.execute(f"SET app.debug = {'true' if DEBUG else 'false'};")
            logger.debug("🔹 SET app.debug executed")

        return conn

    except Exception as e:
        logger.exception("❌ get_conn failed for database_id=%s", database_id)
        raise


def log_notices(conn):
    """Affiche les notices PostgreSQL dans les logs."""
    notices = getattr(conn, "notices", [])
    for notice in notices:
        logger.info("⚠️ PostgreSQL NOTICE: %s", notice.strip())
    notices.clear()


def get_function_prototype(cur, function_name, schema='public'):
    """Récupère la signature d’une fonction SQL via get_function_prototype()."""
    cur.execute(
        "SELECT function_name, schema_name, arguments, return_type "
        "FROM public.get_function_prototype(%s, %s);",
        (function_name, schema)
    )
    row = cur.fetchone()
    if not row:
        return None
    func_name, schema_name, arguments_str, return_type = row
    args = []
    if arguments_str:
        for arg in arguments_str.split(","):
            parts = arg.strip().split()
            if len(parts) >= 2:
                name = parts[0]
                typ = " ".join(parts[1:])
                args.append({"name": name, "type": typ})
    return {
        "function_name": func_name,
        "schema_name": schema_name,
        "arguments": args,
        "return_type": return_type
    }
