import logging
import sys
from flask import Flask
from flask_cors import CORS
from flasklib.json_encoder import CustomJSONEncoder
from flasklib import init_routes
import flasklib.config as config

# ========================
# Logging
# ========================
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG if config.DEBUG else logging.INFO)

# ========================
# Flask app
# ========================
app = Flask(__name__)

# Config JSON encoder
app.json_encoder = CustomJSONEncoder

# Config CORS
CORS(app, supports_credentials=True, origins=config.ALLOWED_ORIGINS)

# Monte toutes les routes définies dans flasklib
init_routes(app)

# ========================
# Entrypoint
# ========================
if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    logger.info("⚡ Flask app starting on port %d", port)
    app.run(host="0.0.0.0", port=port, debug=config.DEBUG)
