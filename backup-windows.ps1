# PowerShell Version für Windows Task Scheduler
$DB_SOURCE = "\\wsl$\\docker-desktop-data\data\docker\volumes\highfish-data\_data\highfish.db"
$BACKUP_DIR = "C:\backups\highfish-db"
$DATE = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BACKUP_FILE = Join-Path $BACKUP_DIR "highfish_$DATE.db"

if (-not (Test-Path $DB_SOURCE)) {
    Write-Error "Quell-DB nicht gefunden: $DB_SOURCE"
    exit 1
}

Copy-Item $DB_SOURCE $BACKUP_FILE -Force
$SIZE = "{0:N2} MB" -f ((Get-Item $BACKUP_FILE).Length / 1MB)
Write-Host "✅ Backup erfolgreich: $BACKUP_FILE ($SIZE)"

# Alte Backups löschen (>30 Tage)
Get-ChildItem $BACKUP_DIR -Filter "highfish_*.db" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force
Write-Host "🧹 Alte Backups bereinigt"
