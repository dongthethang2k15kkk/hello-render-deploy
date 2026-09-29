param(
  [string]$EnvironmentFile = ".env",
  [string]$OutputDirectory = "backups"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is required for this backup helper. Install Docker on the machine that runs the command, or use your PostgreSQL provider's export tool."
}

if (-not $env:DATABASE_URL) {
  if (-not (Test-Path -LiteralPath $EnvironmentFile)) {
    throw "DATABASE_URL is not set and $EnvironmentFile does not exist."
  }
  $databaseLine = Get-Content -LiteralPath $EnvironmentFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
  if (-not $databaseLine) { throw "DATABASE_URL is missing from $EnvironmentFile." }
  $env:DATABASE_URL = ($databaseLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
}

if ($env:DATABASE_URL -notmatch '^postgres(ql)?://') {
  throw "DATABASE_URL must be a PostgreSQL connection string."
}

$backupDirectory = [IO.Path]::GetFullPath((Join-Path $PWD $OutputDirectory))
[IO.Directory]::CreateDirectory($backupDirectory) | Out-Null
$env:BACKUP_NAME = "game-shop-$([DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))-utc.dump"

docker run --rm `
  --env DATABASE_URL `
  --env BACKUP_NAME `
  --mount "type=bind,source=$backupDirectory,target=/backups" `
  postgres:17-bookworm `
  sh -c 'pg_dump --dbname="$DATABASE_URL" --format=custom --compress=9 --no-owner --no-acl --file="/backups/$BACKUP_NAME"'

if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE." }
$backupFile = Join-Path $backupDirectory $env:BACKUP_NAME
if (-not (Test-Path -LiteralPath $backupFile)) { throw "Backup file was not created." }
Write-Output "Backup created: $backupFile"
