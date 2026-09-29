param(
  [Parameter(Mandatory = $true)]
  [string]$ConnectionFile,
  [string]$EnvironmentFile = ".env"
)

$ErrorActionPreference = "Stop"
$connectionPath = (Resolve-Path -LiteralPath $ConnectionFile).Path
$environmentPath = (Resolve-Path -LiteralPath $EnvironmentFile).Path
$databaseUrl = (Get-Content -LiteralPath $connectionPath -Raw).Trim()

if ($databaseUrl -notmatch '^postgres(ql)?://') {
  throw "The connection file does not contain a PostgreSQL URL."
}

$backupDirectory = Join-Path $PWD ".local-cache/database-env-backups"
[IO.Directory]::CreateDirectory($backupDirectory) | Out-Null
$backupPath = Join-Path $backupDirectory "$([DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))-utc.env"
Copy-Item -LiteralPath $environmentPath -Destination $backupPath

$replacement = 'DATABASE_URL="' + $databaseUrl + '"'
$found = $false
$updated = foreach ($line in Get-Content -LiteralPath $environmentPath) {
  if ($line -match '^DATABASE_URL=') {
    $found = $true
    $replacement
  } else {
    $line
  }
}
if (-not $found) { $updated = @($replacement) + $updated }

[IO.File]::WriteAllLines($environmentPath, $updated, [Text.UTF8Encoding]::new($false))
Remove-Item -LiteralPath $connectionPath
Write-Output "DATABASE_URL updated. Previous environment file saved under ignored local cache."
