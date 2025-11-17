import sys
import os

# Chemin vers le projet
project_home = os.path.dirname(__file__)
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# --- Forcer le venv Python ---
venv_path = os.path.join(project_home, "venv")
sys.path.insert(0, os.path.join(venv_path, "lib/python3.12/site-packages"))  # adapte la version
sys.prefix = venv_path
sys.exec_prefix = venv_path

# Import de l'application Flask
from app_flask import app

# Passenger attend un objet nommé "application"
application = app
