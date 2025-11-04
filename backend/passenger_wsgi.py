# passenger_wsgi.py
import sys
import os

# Ajouter le dossier courant au path Python
sys.path.insert(0, os.path.dirname(__file__))

# Import de l'app Flask
from app_flask import app

# Alwaysdata et Gunicorn attendent un objet nommé "application"
application = app
