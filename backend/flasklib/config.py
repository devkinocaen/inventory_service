import os
import json
import logging
import sys
from zoneinfo import ZoneInfo  # Python 3.9+

DEBUG = os.environ.get("FLASK_DEBUG", "0").lower() in ("1", "true")

# 🔹 Charger la configuration une seule fois au démarrage
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_CONFIG_PATH = os.path.join(BASE_DIR, "..", "databases.json")
    

logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG if DEBUG else logging.INFO)

# JWT
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")
JWT_ISSUER = os.environ.get("JWT_ISSUER", "https://auth.render.com")

# DB defaults
DBUSER = os.environ.get("DBUSER")
DBNAME = os.environ.get("DBNAME")
DBPORT = int(os.environ.get("DB_PORT", 5432))


# CORS allowed origins
ALLOWED_ORIGINS = [
    "http://localhost:8000",
    "http://127.0.0.1:5000",
    "https://inventory-service.vercel.app",
    "https://inventory-service-bice.vercel.app",
    "https://costumeriejulie.vercel.app",
    "https://costumerie-alex.vercel.app"
]


# Google Drive / Service Account
GOOGLE_SERVICE_ACCOUNT_FILE = os.environ.get(
    "GOOGLE_SERVICE_ACCOUNT_JSON",
    os.path.join(os.path.dirname(__file__), "../../gcloud/restauredb-48ba8f00618e.json")
)

GOOGLE_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]

# 🔹 Fuseau horaire local
LOCAL_TZ = ZoneInfo(os.environ.get("LOCAL_TZ", "Europe/Paris"))



# 🔹 Charger les configs de base
with open(DB_CONFIG_PATH, "r") as f:
    DATABASES = json.load(f)

def get_db_config(baseid: str):
    """
    Renvoie la configuration correspondant à baseid
    depuis le fichier databases.json.
    """
    for db in DATABASES:
        if db["baseid"] == baseid:
            return db
    abort(404, description=f"Base '{baseid}' non trouvée dans databases.json")
    
# Récupérer la config de la base pour connaître le rôle JWT attendu
def get_jwt_audience(baseid: str):
    db_conf = get_db_config(baseid)
    return db_conf.get("auth_role", "authenticated")
