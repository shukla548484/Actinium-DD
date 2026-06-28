# Setup local PostgreSQL for Actinium-DD (Windows).
$ErrorActionPreference = "Stop"
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $Dir "..\..")

Write-Host "=== Actinium-DD — Windows PostgreSQL setup ==="

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Error "Install Docker Desktop first: https://www.docker.com/products/docker-desktop/"
}

Set-Location $RepoRoot
docker compose -f docker-compose.fleet.yml up -d

$EnvFile = Join-Path $Dir "fleet.local.env"
$Example = Join-Path $Dir "fleet.local.env.example"
if (-not (Test-Path $EnvFile)) {
  Copy-Item $Example $EnvFile
  Write-Host "Created fleet.local.env — edit VESSEL_ID before first use."
}

Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim().Trim('"'), "Process")
  }
}

Set-Location $RepoRoot
npx prisma migrate deploy

Write-Host "=== Setup complete ==="
Write-Host "Edit $EnvFile then run start-actinium-dd.bat"
