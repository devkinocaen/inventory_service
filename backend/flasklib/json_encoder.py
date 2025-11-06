import json
from datetime import datetime, date, timedelta
from decimal import Decimal

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, timedelta):
            days = obj.days
            seconds = obj.seconds
            hours, remainder = divmod(seconds, 3600)
            minutes, sec = divmod(remainder, 60)
            parts = []
            if days != 0:
                parts.append(f"{days} days")
            parts.append(f"{hours:02}:{minutes:02}:{sec:02}")
            return ' '.join(parts)
        if isinstance(obj, Decimal):
            return float(obj)  # <-- conversion Decimal → float
        return super().default(obj)

