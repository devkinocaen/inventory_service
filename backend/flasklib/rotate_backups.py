from dateutil.relativedelta import relativedelta
from datetime import datetime, timedelta
from googleapiclient.errors import HttpError
import logging

logger = logging.getLogger(__name__)

def rotate_backups(drive_service, folder_id, database_id, backup_prefix="backup"):
    # 🔹 Lister tous les backups existants
    results = drive_service.files().list(
        q=f"'{folder_id}' in parents and trashed = false and name contains '{backup_prefix}_{database_id}'",
        fields="files(id, name, createdTime)",
        orderBy="createdTime desc"
    ).execute()
    
    files = results.get("files", [])
    if not files:
        logger.info("🔹 Aucun backup trouvé dans le dossier %s pour %s", folder_id, database_id)
        return

    backups = []
    for f in files:
        name = f["name"]
        file_id = f.get("id")
        if not file_id:
            logger.warning("⚠️ Backup sans ID ignoré: %s", name)
            continue
        try:
            ts_str = name.replace(f"{backup_prefix}_{database_id}_", "").replace(".sql", "")
            backup_time = datetime.strptime(ts_str, "%Y%m%dT%H%M%S")
            backups.append({"id": file_id, "name": name, "time": backup_time})
        except Exception:
            logger.warning("⚠️ Nom de backup non conforme ignoré: %s", name)
            continue

    # 🔹 Garder les fichiers selon la stratégie
    now = datetime.now()
    keep = set()

    # --- Phase 1a : backups toutes les 3 min pour les 2 dernières heures ---
    cutoff_2h = now - timedelta(hours=2)
    last_kept = None
    for b in sorted(backups, key=lambda x: x["time"], reverse=True):
        if b["time"] >= cutoff_2h:
            if not last_kept or (last_kept - b["time"]).total_seconds() >= 3*60:
                keep.add(b["id"])
                last_kept = b["time"]

    # --- Phase 1b : backups toutes les 2h pour le reste des 24h ---
    cutoff_24h = now - timedelta(hours=24)
    last_kept = None
    for b in sorted(backups, key=lambda x: x["time"], reverse=True):
        if cutoff_2h > b["time"] >= cutoff_24h:
            if not last_kept or (last_kept - b["time"]).total_seconds() >= 2*3600:
                keep.add(b["id"])
                last_kept = b["time"]

    # --- Phase 2 : backups 1/jour pendant 7 jours ---
    cutoff_7d = now - relativedelta(days=7)
    daily = {}
    for b in backups:
        if b["time"] < cutoff_24h and b["time"] >= cutoff_7d:
            day = b["time"].date()
            if day not in daily:
                daily[day] = b["id"]
                keep.add(b["id"])

    # --- Phase 3 : 1/semaine pendant 4 semaines ---
    cutoff_4w = now - relativedelta(weeks=4)
    weeks = {}
    for b in backups:
        if b["time"] < cutoff_7d and b["time"] >= cutoff_4w:
            week = b["time"].isocalendar()[1]
            year = b["time"].year
            if (year, week) not in weeks:
                weeks[(year, week)] = b["id"]
                keep.add(b["id"])

    # --- Phase 4 : 1/mois ---
    months = {}
    for b in backups:
        if b["time"] < cutoff_4w:
            month = b["time"].month
            year = b["time"].year
            if (year, month) not in months:
                months[(year, month)] = b["id"]
                keep.add(b["id"])

    # --- Phase 5 : 1/an ---
    years = {}
    for b in backups:
        year = b["time"].year
        if year not in years and b["time"] < now - relativedelta(months=12):
            years[year] = b["id"]
            keep.add(b["id"])

    # 🔹 Supprimer les fichiers non conservés
    for b in backups:
        if b["id"] not in keep:
            try:
                drive_service.files().delete(fileId=b["id"]).execute()
                logger.info("🗑️ Deleted old backup: %s", b["name"])
            except HttpError as e:
                if e.resp.status == 404:
                    logger.warning("⚠️ Backup déjà supprimé (ignoré): %s", b["name"])
                else:
                    logger.warning("⚠️ Échec suppression %s: %s", b["name"], e)
