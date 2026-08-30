#!/bin/bash
# Automatisches 24h SQLite Backup für HighFish API DB

set -e

# Konfiguration
DB_SOURCE="/var/lib/docker/volumes/highfish-data/_data/highfish.db"
BACKUP_DIR="/mnt/backups/highfish-db"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/highfish_${DATE}.db"

# Backup-Verzeichnis erstellen falls nicht vorhanden
mkdir -p "$BACKUP_DIR"

# Prüfen ob Quell-DB existiert
if [ ! -f "$DB_SOURCE" ]; then
    echo "❌ Fehler: Quell-Datenbank nicht gefunden: $DB_SOURCE"
    exit 1
fi

# Backup durchführen (cp reicht für SQLite bei kleinen DBs)
cp "$DB_SOURCE" "$BACKUP_FILE"

# Erfolg prüfen
if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup erfolgreich: $BACKUP_FILE ($SIZE)"
else
    echo "❌ Backup fehlgeschlagen"
    exit 1
fi

# Alte Backups löschen (älter als 30 Tage)
find "$BACKUP_DIR" -name "highfish_*.db" -mtime +30 -delete 2>/dev/null
echo "🧹 Alte Backups (>30 Tage) bereinigt"
