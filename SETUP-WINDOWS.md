# Windows Setup für automatisches 24h DB Backup

## 1. Backup-Verzeichnis erstellen (als Admin in PowerShell)
New-Item -ItemType Directory -Force -Path "C:\backups\highfish-db"

## 2. Docker Volume Pfad ermitteln
# Der SQLite DB Pfad im Docker Volume:
# Windows: \\wsl$\\docker-desktop-data\data\docker\volumes\highfish-data\_data\highfish.db
# Oder über: docker volume inspect highfish-data

## 3. PowerShell Backup-Skript erstellen (backup-windows.ps1)
## 4. Task Scheduler Eintrag erstellen (als Admin in PowerShell)
`powershell
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-ExecutionPolicy Bypass -File C:\path\to\backup-windows.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -TaskName "HighFish-DB-Backup" -Action $action -Trigger $trigger -RunLevel Highest -Force
`

✅ Windows Task für tägliches Backup um 02:00 Uhr erstellt
