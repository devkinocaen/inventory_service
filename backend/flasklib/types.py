import json
from psycopg.types.json import Json
from datetime import datetime, date, time, timedelta
import uuid

def get_sql_value(name: str, typ: str, params: dict):
    if name not in params:
        raise ValueError(f"Missing parameter: {name}")

    value = params[name]

    # 🔹 Comportement conditionnel selon le type
    if typ in ("text", "varchar", "char"):
        # On NE convertit pas les chaînes vides en NULL
        if value is None or value in ("{}", "null", "None"):
            return None
        return str(value)
    else:
        # Pour les autres types, la chaîne vide est considérée comme NULL
        if value in (None, "", "{}", "null", "None"):
            return None

    if typ in ("integer", "int4"):
        return int(value)
    elif typ in ("numeric", "float", "float8", "double precision"):
        return float(value)
    elif typ == "boolean":
        if isinstance(value, bool):
            return value
        val_lower = str(value).lower()
        if val_lower in ("true", "1", "t"):
            return True
        elif val_lower in ("false", "0", "f"):
            return False
        else:
            raise ValueError(f"Cannot convert {value!r} to boolean")
    elif typ in ("text", "varchar", "char"):
        return str(value)
    elif typ in ("json", "jsonb"):
        if isinstance(value, (dict, list)):
            return Json(value, dumps=json.dumps)
        if isinstance(value, str):
            return Json(json.loads(value), dumps=json.dumps)
    elif typ in ("timestamptz", "timestamp with time zone"):
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            v = value.strip().lower()
            if v.endswith("z"):
                v = v[:-1] + "+00:00"
            return datetime.fromisoformat(v)
    elif typ == "date":
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            return date.fromisoformat(value)
    elif typ == "time":
        if isinstance(value, time):
            return value
        if isinstance(value, str):
            return time.fromisoformat(value)
    elif typ == "interval":
        if isinstance(value, timedelta):
            return value
        if isinstance(value, str):
            parts = value.strip().split()
            if len(parts) == 2:
                days = int(parts[0])
                h, m, s = map(int, parts[1].split(":"))
                return timedelta(days=days, hours=h, minutes=m, seconds=s)
    elif typ == "uuid":
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))

    return value
