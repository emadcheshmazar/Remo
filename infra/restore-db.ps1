# Restores the RWMS postgres database from a dump produced by backup-db.ps1.
# DESTRUCTIVE: replaces existing data in the rwms database (--clean drops
# existing objects before recreating them). Confirms before running.
#   powershell -ExecutionPolicy Bypass -File infra\restore-db.ps1 -BackupFile infra\backups\rwms_20260708_120000.dump

param(
    [Parameter(Mandatory = $true)][string]$BackupFile
)

$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\.."

if (-not (Test-Path $BackupFile)) { throw "Backup file not found: $BackupFile" }

Write-Warning "This will REPLACE all data in the 'rwms' database with the contents of: $BackupFile"
$confirm = Read-Host "Type YES to continue"
if ($confirm -ne "YES") { Write-Output "Aborted."; exit 1 }

$containerPath = "/tmp/restore.dump"
docker compose cp $BackupFile "db:${containerPath}"
if ($LASTEXITCODE -ne 0) { throw "Failed to copy backup into the db container" }

docker compose exec -T db pg_restore -U rwms -d rwms --clean --if-exists $containerPath
$restoreExit = $LASTEXITCODE

docker compose exec -T db rm -f $containerPath

if ($restoreExit -ne 0) { throw "pg_restore exited with code $restoreExit" }

Write-Output "Restore complete from $BackupFile"
