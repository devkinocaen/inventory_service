# app/routes.py
import logging
from flask import request, jsonify
from flask_cors import cross_origin
from .db import get_conn
from .auth import login as auth_login, verify as auth_verify, signup as auth_signup
import flasklib.config as config

logger = logging.getLogger(__name__)

def register_routes(app):
    @app.route("/login", methods=["POST"])
    @app.route("/login/<database_id>", methods=["POST"])
    @cross_origin(origins=config.ALLOWED_ORIGINS, supports_credentials=True)
    def login_route(database_id=None):
        return auth_login(database_id)

    @app.route("/signup", methods=["POST"])
    @app.route("/signup/<database_id>", methods=["POST"])
    @cross_origin(origins=config.ALLOWED_ORIGINS, supports_credentials=True)
    def signup_route(database_id=None):
        return auth_signup(database_id)

    @app.route("/verify", methods=["POST"])
    def verify_route():
        return auth_verify()

    @app.route("/query", methods=["POST"])
    def query():
        sql = request.json.get("sql") if request.json else None
        if not sql:
            return jsonify({"error": "No SQL provided"}), 400
        conn = cur = None
        try:
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(sql)
            if cur.description:
                columns = [desc[0] for desc in cur.description]
                rows = [dict(zip(columns, row)) for row in cur.fetchall()]
                result = {"rows": rows}
            else:
                conn.commit()
                result = {"rows_affected": cur.rowcount}
            return jsonify(result)
        except Exception as e:
            logger.exception("Query failed")
            return jsonify({"error": str(e)}), 500
        finally:
            if cur:
                cur.close()
            if conn:
                conn.close()

    @app.route("/health")
    def health():
        return jsonify({"status": "ok check github"}), 200

    @app.route("/cors-test", methods=["GET"])
    def cors_test():
        return jsonify({
            "status": "ok",
            "allowed_origins": config.ALLOWED_ORIGINS
        }), 200

    @app.route("/")
    def root():
        return jsonify({"status": "Auth + SQL proxy service running"}), 200
