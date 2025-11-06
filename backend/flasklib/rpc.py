import os
import json
from psycopg.types.json import Json
import logging
import pprint
from flask import request, jsonify, Response
from flask_cors import cross_origin
import jwt
from .db import get_conn, log_notices, get_function_prototype
from .types import get_sql_value
from .json_encoder import CustomJSONEncoder
import psycopg
import flasklib.config as config
from .config import DBUSER, JWT_SECRET, get_jwt_audience


logger = logging.getLogger(__name__)


def register_routes(app):
    @app.route("/rpc/<database_id>/<function_name>", methods=["POST"])
    @cross_origin(origins=config.ALLOWED_ORIGINS, supports_credentials=True)
    def rpc(database_id, function_name):
        logger.debug("➡️ RPC called for function: %s on database: %s", function_name, database_id)
        try:
            # 🔹 Récupération du token
            auth_header = request.headers.get("Authorization", "")
            token = auth_header.split(" ")[1] if " " in auth_header else None
            logger.debug("🔹 Authorization header: %s", auth_header)
            if not token:
                raise ValueError("No token provided")

            try:
                decoded = jwt.decode(
                    token,
                    JWT_SECRET,
                    algorithms=["HS256"],
                    audience=get_jwt_audience(database_id)
                )
            except jwt.ExpiredSignatureError:
                return jsonify({"data": None, "error": "Token expired"}), 401
            except jwt.InvalidAudienceError:
                return jsonify({"data": None, "error": "Invalid audience in token"}), 401
            except jwt.InvalidSignatureError:
                return jsonify({"data": None, "error": "Invalid token signature"}), 401
            except jwt.DecodeError:
                return jsonify({"data": None, "error": "Malformed token"}), 401
            except Exception as e:
                return jsonify({"data": None, "error": f"Token verification failed: {str(e)}"}), 401
            
            logger.debug("🔑 JWT decoded claims: %s", decoded)

            # 🔹 Connexion sur la base demandée
            conn = get_conn(database_id.upper())
            conn.autocommit = False
            cur = conn.cursor()
            params = request.get_json() or {}
            logger.debug("🔹 RPC params received: %s", params)

            # --- Transaction manuelle ---
            cur.execute("BEGIN;")

            # --- SET ROLE et claims pour RLS ---
            rls_role = decoded.get("role")
            if not rls_role:
                raise ValueError("JWT missing required 'role' claim for RLS")

            try:
                cur.execute(f"SET ROLE {rls_role};")
            except psycopg.errors.UndefinedObject as e:
                raise ValueError(f"RLS role '{rls_role}' not found in database: {str(e)}")

            claims_json = json.dumps(decoded).replace("'", "''")
            cur.execute(f"SET LOCAL request.jwt.claims = '{claims_json}';")
            cur.execute("SET client_min_messages TO notice;")

            # --- Prototype fonction ---
            proto = get_function_prototype(cur, function_name, "inventory")
            if not proto:
                raise ValueError(f"Function {function_name} not found in {database_id}")
            logger.debug("🧩 Contenu de proto pour %s :\n%s", function_name, pprint.pformat(proto))

            sql_args = []
            placeholders = []

            PG_TYPE_MAP = {
                "smallint": "integer",
                "integer": "integer",
                "text": "text",
                "boolean": "boolean",
                "json": "json",
                "jsonb": "jsonb",
                "timestamp with time zone": "timestamptz",
                "timestamp without time zone": "timestamp",
            }

            for arg in proto["arguments"]:
                val = get_sql_value(arg["name"], arg["type"], params)
                pg_type = PG_TYPE_MAP.get(arg["type"], arg["type"])

                # 🔹 envelopper Json/Jsonb
                if pg_type in ("json", "jsonb") and val is not None and not isinstance(val, Json):
                    val = Json(val, dumps=json.dumps)

                # 🔹 conversion explicite des autres types
                if pg_type == "integer" and val is not None:
                    val = int(val)
                elif pg_type == "text" and val is not None:
                    val = str(val)
                elif pg_type == "boolean" and val is not None:
                    val = bool(val)
                elif pg_type in ("timestamptz", "timestamp") and val is not None:
                    val = val

                sql_args.append(val)

                # 🔹 cast explicite PostgreSQL
                if val is None:
                    placeholders.append("%s")
                elif pg_type in ("json", "jsonb", "integer", "text", "boolean",
                                 "timestamptz", "timestamp", "uuid"):
                    placeholders.append(f"%s::{pg_type}")
                else:
                    placeholders.append("%s")

            schema_name = proto.get("schema_name", "public")
            sql = f"SELECT * FROM {schema_name}.{function_name}({', '.join(placeholders)});"
            logger.debug("🔹 Final SQL: %s", sql)

            # --- Exécution sécurisée avec SAVEPOINT ---
            cur.execute("SAVEPOINT sp_rpc;")
            result = None
            try:
                cur.execute(sql, sql_args)
                log_notices(conn)

                if cur.description:
                    rows = cur.fetchall()
                    columns = [desc[0] for desc in cur.description]
                    result = [dict(zip(columns, row)) for row in rows]
                else:
                    result = None

                cur.execute("RELEASE SAVEPOINT sp_rpc;")
                cur.execute("COMMIT;")

            except (psycopg.errors.UniqueViolation, psycopg.errors.RaiseException) as e:
                cur.execute("ROLLBACK TO SAVEPOINT sp_rpc;")
                logger.warning("⚠️ Exception levée depuis PostgreSQL: %s", e)
                cur.execute("ROLLBACK;")
                error_msg = str(e)
                if "Le couple prénom/nom" in error_msg:
                    user_friendly_msg = error_msg.split("Le couple prénom/nom")[-1].strip()
                    user_friendly_msg = f"Le participant {user_friendly_msg}"
                else:
                    user_friendly_msg = error_msg
                return Response(
                    response=json.dumps({"data": None, "error": user_friendly_msg}, cls=CustomJSONEncoder),
                    status=400,
                    mimetype="application/json"
                )

            except psycopg.errors.ForeignKeyViolation as e:
                cur.execute("ROLLBACK TO SAVEPOINT sp_rpc;")
                logger.warning("🔒 Foreign key violation: %s", e)
                cur.execute("ROLLBACK;")
                return Response(
                    response=json.dumps({"data": None, "error": f"Foreign key violation: {str(e)}"}, cls=CustomJSONEncoder),
                    status=400,
                    mimetype="application/json"
                )

            except psycopg.errors.InsufficientPrivilege as e:
                cur.execute("ROLLBACK TO SAVEPOINT sp_rpc;")
                logger.warning("🔒 RLS violation / insufficient privilege: %s", e)
                cur.execute("ROLLBACK;")
                return Response(
                    response=json.dumps({"data": None, "error": "Violation RLS: opération refusée"}, cls=CustomJSONEncoder),
                    status=403,
                    mimetype="application/json"
                )

            except Exception as e:
                cur.execute("ROLLBACK TO SAVEPOINT sp_rpc;")
                logger.exception("❌ RPC execution failed")
                cur.execute("ROLLBACK;")
                error_detail = {
                    "message": str(e),
                    "type": type(e).__name__,
                    "sql": sql,
                    "args": [
                        {"name": arg["name"], "type": arg["type"],
                         "value": repr(get_sql_value(arg["name"], arg["type"], params))}
                        for arg in proto.get("arguments", [])
                    ]
                }
                return Response(
                    response=json.dumps({"data": None, "error": error_detail}, cls=CustomJSONEncoder),
                    status=500,
                    mimetype="application/json"
                )

            finally:
                try:
                    cur.execute(f"SET ROLE {DBUSER};")
                except Exception as e:
                    logger.warning("⚠️ Impossible de remettre le rôle DBUSER: %s", e)
                cur.close()
                conn.close()

            logger.debug("🔹 RPC result: %s", result)
            return Response(
                response=json.dumps({"data": result, "error": None}, cls=CustomJSONEncoder),
                status=200,
                mimetype="application/json"
            )

        except Exception as e:
            logger.exception("❌ RPC %s failed on database %s", function_name, database_id)
            return Response(
                response=json.dumps({"data": None, "error": str(e)}, cls=CustomJSONEncoder),
                status=500,
                mimetype="application/json"
            )
