import os
import logging
import json
from flask import Response
from flask_cors import cross_origin
import flasklib.config as config

logger = logging.getLogger(__name__)

def register_routes(app):
    @app.route("/databases", methods=["GET"])
    @cross_origin(origins=config.ALLOWED_ORIGINS, supports_credentials=True)
    def list_databases():
        """
        🔹 Renvoie la liste des bases disponibles dans databases.json
        (baseid + basename)
        """
        logger.debug("🔹 list_databases called")

        try:
            # 🔹 Lecture du fichier databases.json
            json_path = os.path.join(os.path.dirname(__file__), "..", "databases.json")
            json_path = os.path.abspath(json_path)
            logger.debug(f"📄 Reading database list from {json_path}")

            if not os.path.exists(json_path):
                logger.error("❌ databases.json not found at %s", json_path)
                return Response(json.dumps({"error": "databases.json not found"}), status=404, mimetype="application/json")

            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            # 🔹 Extraction des infos utiles
            databases = [{"baseid": d.get("baseid"), "basename": d.get("basename")} for d in data]

            logger.debug("✅ %d databases found", len(databases))
            return Response(
                json.dumps({"status": "success", "databases": databases}, ensure_ascii=False, indent=2),
                mimetype="application/json"
            )

        except Exception as e:
            logger.exception("❌ list_databases failed")
            return Response(
                json.dumps({"status": "error", "error": f"Unexpected error: {str(e)}"}),
                status=500,
                mimetype="application/json"
            )
