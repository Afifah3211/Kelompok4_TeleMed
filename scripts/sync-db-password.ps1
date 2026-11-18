<#
Synchronize the PostgreSQL role password with POSTGRES_PASSWORD/PGPASSWORD in .env.
Safe for an existing Docker volume: changes the DB role through the local socket;
does not remove volumes or database data.
#>
$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot

$ComposeFiles = @('-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml')
$EnvPath = Join-Path $ProjectRoot '.env'
if (-not (Test-Path -LiteralPath $EnvPath)) {
  throw 'File .env tidak ditemukan di folder utama project.'
}

$EnvValues = @{}
foreach ($Line in Get-Content -LiteralPath $EnvPath) {
  if ($Line -match '^\s*([^#=\s]+)\s*=\s*(.*)\s*$') {
    $EnvValues[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'")
  }
}

$DbUser = $EnvValues['POSTGRES_USER']
$DbName = $EnvValues['POSTGRES_DB']
$DbPassword = $EnvValues['POSTGRES_PASSWORD']
if ([string]::IsNullOrWhiteSpace($DbUser) -or [string]::IsNullOrWhiteSpace($DbName) -or [string]::IsNullOrWhiteSpace($DbPassword)) {
  throw 'POSTGRES_USER, POSTGRES_DB, dan POSTGRES_PASSWORD harus terisi di .env.'
}
if ($DbUser -ne $EnvValues['PGUSER'] -or $DbName -ne $EnvValues['PGDATABASE'] -or $DbPassword -ne $EnvValues['PGPASSWORD']) {
  throw 'Nilai POSTGRES_* dan PG* harus sama. Samakan USER, DATABASE, dan PASSWORD di .env lalu jalankan lagi.'
}

Write-Host 'Menyalakan PostgreSQL dan MinIO...'
& docker compose @ComposeFiles up -d db minio
if ($LASTEXITCODE -ne 0) { throw 'Gagal menyalakan service db/minio.' }

$Ready = $false
for ($Attempt = 1; $Attempt -le 60; $Attempt++) {
  & docker compose @ComposeFiles exec -T db pg_isready -h /var/run/postgresql -U $DbUser -d $DbName *> $null
  if ($LASTEXITCODE -eq 0) {
    $Ready = $true
    break
  }
  Start-Sleep -Seconds 2
}
if (-not $Ready) { throw 'PostgreSQL belum siap setelah 120 detik. Periksa: docker compose logs db' }

# Use the container-local Unix socket so this does not depend on the old TCP password.
$SqlUser = $DbUser.Replace('"', '""')
$SqlPassword = $DbPassword.Replace("'", "''")
$Sql = 'ALTER ROLE "{0}" WITH PASSWORD ''{1}'';' -f $SqlUser, $SqlPassword
Write-Host 'Menyamakan password role PostgreSQL dengan konfigurasi .env...'
& docker compose @ComposeFiles exec -T db psql -w -h /var/run/postgresql -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -c $Sql
if ($LASTEXITCODE -ne 0) {
  throw 'Gagal memperbarui password role. Tidak ada volume atau data yang dihapus.'
}

Write-Host 'Menyalakan ulang aplikasi dengan konfigurasi .env terbaru...'
& docker compose @ComposeFiles up -d --build --force-recreate backend backup frontend
if ($LASTEXITCODE -ne 0) { throw 'Password database sudah diperbarui, tetapi ada service aplikasi yang gagal dinyalakan.' }

Write-Host 'Selesai. pgAdmin: Host 127.0.0.1, Port 5433, Database sesuai POSTGRES_DB, User sesuai POSTGRES_USER.'
Write-Host 'Gunakan password dari POSTGRES_PASSWORD di .env. Tidak ada volume yang dihapus.'
