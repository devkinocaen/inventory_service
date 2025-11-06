# app/auth.py
import os
import re
import logging
from flask import request, jsonify
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from .db import get_conn
from .config import get_db_config, JWT_SECRET

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)



def login(database_id=None):
    data = request.get_json(force=True) or {}
    email = data.get("email")
    password = data.get("password")

    logger.debug("Login attempt for database: %s, email: %s", database_id, email)

    if not email or not password:
        logger.warning("Missing email or password")
        return jsonify({"error": "Email and password required"}), 400

    use_crypto = os.environ.get("WITH_CRYPTO", "1").lower() not in ("0", "false")
    logger.debug("Using bcrypt crypto: %s", use_crypto)

    # 🔹 Récupère config base
    db_config = get_db_config(database_id.upper() if database_id else "")
    auth_role = db_config.get("auth_role", "authenticated")
    jwt_audience = auth_role
    jwt_issuer = db_config.get("issuer", "https://fallback.issuer")
    DBUSER = db_config.get("user")

    conn = None
    try:
        conn = get_conn(database_id) if database_id else get_conn()
        check_get_function_prototype_exists(conn)

        cur = conn.cursor()
        logger.debug("Connected to DB, setting role %s", DBUSER)
        cur.execute(f"SET ROLE {DBUSER};")

        # 🔹 Vérifie si les viewers sont autorisés
        cur.execute("SELECT viewer_allowed FROM inventory.app_config LIMIT 1;")
        viewer_allowed = cur.fetchone()
        viewer_allowed = viewer_allowed and viewer_allowed[0]

        # 🔹 Cherche l'utilisateur avancé
        cur.execute("""
            SELECT u.id, u.email, p.raw_user_meta_data->'app_metadata'->>'role' AS role, u.encrypted_password
            FROM auth.users u
            LEFT JOIN auth.user_profiles p ON u.id = p.user_id
            WHERE u.email = %s
        """, (email,))
        row = cur.fetchone()

        if row:
            user_id, user_email, user_role, db_password = row
        else:
            logger.info("No advanced user found for email: %s, checking participants for basic role viewer...", email)
            cur.close()
            return jsonify({"error": "Viewer login disabled"}), 403

        cur.close()

        # 🔹 Validation mot de passe
        if use_crypto:
            valid = bcrypt.checkpw(password.encode(), db_password.encode())
        else:
            valid = password == db_password

        if not valid:
            logger.warning("Invalid password for user %s", email)
            return jsonify({"error": "Invalid credentials"}), 401

        # 🔹 Création du JWT
        now = datetime.now(timezone.utc)
        exp = now + timedelta(hours=1 if user_role == "viewer" else 2)
        claims = {
            "sub": str(user_id),
            "role": auth_role,
            "app_metadata": {"role": user_role},
            "email": user_email,
            "aud": jwt_audience,
            "iss": jwt_issuer,
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp())
        }

        if user_role == "viewer":
            claims["app_metadata"].update({
                "first_name": first_name,
                "last_name": last_name
            })

        token = jwt.encode(claims, JWT_SECRET, algorithm="HS256")
        if isinstance(token, bytes):
            token = token.decode("utf-8")

        logger.info("Login successful for user %s", email)
        user_resp = {"id": str(user_id), "email": user_email, "role": user_role}
        if user_role == "viewer":
            user_resp.update({"first_name": first_name, "last_name": last_name})

        return jsonify({
            "access_token": token,
            "token_type": "bearer",
            "expires_in": 3600,
            "user": user_resp
        })

    except Exception as e:
        logger.exception("Login failed for user %s", email)
        return jsonify({"error": "Login failed"}), 500

    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def verify(database_id=None):
    data = request.get_json(force=True) or {}
    token = data.get("token")
    if not token:
        return jsonify({"error": "No token provided"}), 400

    db_config = get_db_config(database_id.upper() if database_id else "")
    jwt_audience = db_config.get("auth_role", "authenticated")
    jwt_issuer = db_config.get("issuer", "https://fallback.issuer")

    try:
        decoded = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            audience=jwt_audience,
            issuer=jwt_issuer
        )
        return jsonify({"valid": True, "claims": decoded})
    except Exception as e:
        logger.warning("Token verification failed: %s", e)
        return jsonify({"valid": False, "error": str(e)}), 401


def check_get_function_prototype_exists(conn):
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT COUNT(*) 
                FROM pg_proc p
                JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE p.proname = 'get_function_prototype' 
                AND n.nspname = 'public';
            """)
            exists = cur.fetchone()[0] > 0
            if not exists:
                raise RuntimeError(
                    "Structure de base inadaptée au client, la fonction get_function_prototype n'est pas implémentée."
                )
    except Exception as e:
        if "Structure de base inadaptée" in str(e):
            raise
        else:
            raise RuntimeError(
                "Erreur lors de la vérification de la fonction get_function_prototype"
            ) from e
