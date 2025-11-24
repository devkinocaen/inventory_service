# app/auth.py
import os
import re
import logging
import json
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
        cur.execute(f"SET ROLE \"{DBUSER}\";")

        # 🔹 Vérifie si les viewers sont autorisés
        cur.execute("SELECT viewer_allowed FROM inventory.app_config LIMIT 1;")
        viewer_allowed = cur.fetchone()
        viewer_allowed = viewer_allowed and viewer_allowed[0]

        cur.execute("""
            SELECT 
                u.id,
                u.email,
                p.raw_user_meta_data->'app_metadata'->>'first_name',
                p.raw_user_meta_data->'app_metadata'->>'last_name',
                u.encrypted_password,
                u.role
            FROM auth.users u
            LEFT JOIN auth.user_profiles p ON u.id = p.user_id
            WHERE u.email = %s
        """, (email,))
        row = cur.fetchone()


        if row:
            user_id, user_email, first_name, last_name, db_password, user_role = row
            logger.info("row: %s", row)
            logger.info("user found for email: %s, with role: %s", email, user_role)

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



def signup(database_id=None):
    data = request.get_json(force=True) or {}
    db_config = get_db_config(database_id.upper() if database_id else "")
    auth_role = db_config.get("auth_role", "authenticated")
    jwt_audience = auth_role
    jwt_issuer = db_config.get("issuer", "https://fallback.issuer")
    DBUSER = db_config.get("user")

    email = data.get("email")
    password = data.get("password")
    first_name = data.get("firstName")
    last_name = data.get("lastName")
    phone = data.get("phone")
    address = data.get("address")
    organization = data.get("organization")
    role = data.get("role")
    logger.info("signup data %s", json.dumps(data))

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    if not first_name or not last_name:
        return jsonify({"error": "First name and last name required"}), 400

    conn = None
    try:
        conn = get_conn(database_id)
        cur = conn.cursor()
        cur.execute(f'SET ROLE "{DBUSER}";')
        cur.execute("BEGIN;")  # démarre explicitement la transaction
        cur.execute("SAVEPOINT sp_signup;")

        # Vérifie si email existant
        cur.execute("SELECT id FROM auth.users WHERE email = %s", (email,))
        if cur.fetchone():
            cur.execute("ROLLBACK TO SAVEPOINT sp_signup;")
            raise Exception(f"Email déjà enregistré: {email}")

        # Hash et insert user avec rôle viewer
        encrypted_password = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

        cur.execute("""
            INSERT INTO auth.users (email, encrypted_password, role)
            VALUES (%s, %s, %s)
            RETURNING id;
        """, (
            email,
            encrypted_password,
            "viewer"
        ))

        user_id = cur.fetchone()[0]


        # Mettre à jour user_profiles avec raw_user_meta_data = {"app_metadata": {"role": p_role}}
        cur.execute("""
            UPDATE auth.user_profiles
            SET raw_user_meta_data = %s
            WHERE user_id = %s;
        """, (
            json.dumps({"app_metadata": {
                    "role": "viewer",
                    "first_name": first_name,
                    "last_name": last_name
                }
            }),
            user_id
        ))
                
        # Création / rattachement personne + organisation via create_account
        cur.execute("""
            SELECT * FROM inventory.create_account(
                p_first_name := %s,
                p_last_name := %s,
                p_email := %s,
                p_phone := %s,
                p_organization_name := %s,
                p_organization_address := %s,
                p_role := %s
            );
        """, (first_name, last_name, email, phone, organization, address, role))

        person_id, organization_id = cur.fetchone()


        # Tout est OK → commit
        cur.execute("RELEASE SAVEPOINT sp_signup;")
        conn.commit()

        # Génération du token JWT
        now = datetime.now(timezone.utc)
        exp = now + timedelta(hours=2)
        claims = {
            "sub": str(user_id),
            "role": "viewer",
            "app_metadata": {"role": "viewer"},
            "email": email,
            "aud": "viewer",
            "iss": jwt_issuer,
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp())
        }
        token = jwt.encode(claims, JWT_SECRET, algorithm="HS256")
        if isinstance(token, bytes):
            token = token.decode()

        return jsonify({
            "access_token": token,
            "token_type": "bearer",
            "expires_in": 7200,
            "user": {
                "id": str(user_id),
                "email": email,
                "role": "viewer",
                "first_name": first_name,
                "last_name": last_name,
                "person_id": person_id,
                "organization_id": organization_id
            }
        }), 200

    except Exception as e:
        if conn:
            conn.rollback()  # rollback si erreur
        logger.exception("❌ Signup failed")
        return jsonify({"error": str(e)}), 500

    finally:
        if conn:
            conn.close()
