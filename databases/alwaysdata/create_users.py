#!/usr/bin/env python3
import os
import csv
import sys
import json
import bcrypt
import pg8000
import ssl

# ======================================================
# Parsing des arguments
# ======================================================
args = sys.argv[1:]

NO_PROXY = False
CSV_FILE = None

for arg in args:
    if arg in ("--no-proxy", "-n"):
        NO_PROXY = True
    else:
        CSV_FILE = arg

if not CSV_FILE:
    print(f"Usage: {sys.argv[0]} [--no-proxy] <fichier.csv>")
    sys.exit(1)

if not os.path.isfile(CSV_FILE):
    print(f"❌ Fichier CSV {CSV_FILE} introuvable")
    sys.exit(1)

# ======================================================
# Désactivation des proxies si demandé
# ======================================================
if NO_PROXY:
    for var in ["HTTP_PROXY", "http_proxy", "HTTPS_PROXY", "https_proxy", "ALL_PROXY", "all_proxy"]:
        if var in os.environ:
            print(f"⚠️ Désactivation de la variable d'environnement {var}")
            os.environ[var] = ""

# ======================================================
# Config DB
# ======================================================
DBHOST = os.environ.get("ALWAYSDATA_DBHOST")
DBPORT = int(os.environ.get("ALWAYSDATA_DBPORT", 5432))
DBNAME = os.environ.get("ALWAYSDATA_DBNAME")
DBUSER = os.environ.get("ALWAYSDATA_DBUSER")
DBPASSWORD = os.environ.get("ALWAYSDATA_DBPASSWORD")

if not all([DBHOST, DBPORT, DBNAME, DBUSER, DBPASSWORD]):
    print("❌ Veuillez définir ALWAYSDATA_DBHOST, ALWAYSDATA_DBNAME, ALWAYSDATA_DBUSER, ALWAYSDATA_DBPASSWORD")
    sys.exit(1)

def get_conn():
    ssl_context = ssl.create_default_context()
    return pg8000.connect(
        user=DBUSER,
        password=DBPASSWORD,
        host=DBHOST,
        port=DBPORT,
        database=DBNAME,
        ssl_context=ssl_context
    )

# ======================================================
# Utilitaires
# ======================================================
use_crypto = os.environ.get("WITH_CRYPTO", "1").lower() not in ("0", "false")
print(f"🔐 WITH_CRYPTO = {use_crypto}")

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode(), salt).decode()

def user_exists(conn, email: str) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM auth.users WHERE email=%s", (email,))
        return cur.fetchone() is not None

def ensure_user_deleted(conn, email: str):
    """Supprime un utilisateur existant et son profil (via ON DELETE CASCADE)."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM auth.users WHERE email = %s", (email,))
    conn.commit()

def create_user(conn, email: str, password: str, role: str) -> str:
    pw_to_store = hash_password(password) if use_crypto else password
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO auth.users (email, encrypted_password, role)
            VALUES (%s, %s, %s)
            RETURNING id
        """, (email, pw_to_store, role))
        user_id = cur.fetchone()[0]
    conn.commit()
    return str(user_id)

def insert_user_profile(conn, user_id: str, role: str):
    extra_data = {"app_metadata": {"role": role}}
    payload = json.dumps(extra_data)
    print(f"💾 DEBUG SQL payload pour {user_id}: {payload}")

    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO auth.user_profiles (user_id, raw_user_meta_data)
            VALUES (%s, %s::jsonb)
            ON CONFLICT (user_id)
            DO UPDATE SET raw_user_meta_data = EXCLUDED.raw_user_meta_data
        """, (user_id, payload))
    conn.commit()

# ======================================================
# Lecture CSV et création utilisateurs
# ======================================================
with get_conn() as conn:
    with open(CSV_FILE, newline="") as csvfile:
        reader = csv.reader(csvfile)
        first_row = next(reader)
        if "email" in first_row and "password" in first_row:
            pass  # header déjà lu
        else:
            csvfile.seek(0)
            reader = csv.reader(csvfile)

        for row in reader:
            if not row or row[0].startswith("#"):
                continue
            if len(row) < 3:
                print(f"❌ Ligne invalide : {row}")
                continue
            email, password, role = row
            print(f"=== Création: {email} (rôle {role}) ===")

            try:
                if user_exists(conn, email):
                    print(f"⚠️ L'utilisateur {email} existe déjà. Suppression avant recréation.")
                    ensure_user_deleted(conn, email)

                user_id = create_user(conn, email, password, role)
                insert_user_profile(conn, user_id, role)
                print(f"✅ {email} créé avec UUID {user_id} et rôle {role}\n")

            except Exception as e:
                conn.rollback()
                print(f"❌ Erreur pour {email}: {e}\n")
