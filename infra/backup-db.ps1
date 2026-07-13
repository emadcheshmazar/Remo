# Dumps the RWMS postgres database to a timestamped file under infra/backups.
# The dump is produced *inside* the db container with pg_dump, then copied out
# via `docker compose cp` (never piped through PowerShell redirection, which
# can silently corrupt binary output). Run manually or via a scheduled task:
#   powershell -ExecutionPolicy Bypass -File infra\backup-db.ps1

param(
    [string]$BackupDir = "$PSScriptRoot\backups",
    [int]$KeepLast = 30
)

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\.."

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$containerPath = "/tmp/rwms_$timestamp.dump"
$hostPath = Join-Path $BackupDir "rwms_$timestamp.dump"

docker compose exec -T db pg_dump -U rwms -Fc -d rwms -f $containerPath
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }

docker compose cp "db:${containerPath}" $hostPath
if ($LASTEXITCODE -ne 0) { throw "Failed to copy backup out of the db container" }

docker compose exec -T db rm -f $containerPath

$size = (Get-Item $hostPath).Length
if ($size -eq 0) { throw "Backup file is empty — something went wrong" }

Write-Output "Backup saved: $hostPath ($size bytes)"

# Retention: keep only the most recent $KeepLast dumps
Get-ChildItem $BackupDir -Filter "rwms_*.dump" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $KeepLast |
    Remove-Item -Force
