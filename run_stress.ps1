# ============================================================
# TeleMed - Jalankan stress test bertahap (PowerShell)
# Pemakaian (dari ROOT project, aplikasi harus sudah jalan):
#   .\run_stress.ps1 -Tag noscale               # 1 replika, tanpa autoscaler
#   .\run_stress.ps1 -Tag autoscale             # dengan autoscale.sh di WSL
#   .\run_stress.ps1 -Tag cdn -Script stress_cdn.js   # Pertemuan 5: CDN test
# ============================================================
param(
  [string]$Tag    = "noscale",
  [string]$Script = "stress.js",
  [int[]]$Levels  = @(10, 100, 500, 1000),
  [string]$Hold   = "1m",
  [int]$CooldownSec = 45
)

New-Item -ItemType Directory -Force -Path "k6/results" | Out-Null
$k6dir = (Resolve-Path "k6").Path

# CDN test: batasi ke 3 level (file statis lebih ringan dari API)
if ($Script -eq "stress_cdn.js") {
  if ($Levels -contains 1000) {
    Write-Host "CDN stress test: membatasi ke 10, 100, 500 VU (file statis lebih cepat)" -ForegroundColor Yellow
    $Levels = @(10, 100, 500)
  }
}

foreach ($v in $Levels) {
  Write-Host "`n===== $Tag : $v VU | Script: $Script =====" -ForegroundColor Cyan
  docker run --rm --network telemed_net `
    -v "${k6dir}:/k6" `
    -e BASE_URL=http://frontend `
    -e MINIO_URL=http://minio:9000 `
    -e MINIO_BUCKET=telemed-files `
    -e VUS=$v -e TAG=$Tag -e HOLD=$Hold `
    -e K6_WEB_DASHBOARD=true `
    -e K6_WEB_DASHBOARD_EXPORT="/k6/results/${Tag}_${v}vu.html" `
    grafana/k6 run /k6/$Script
  Write-Host "Selesai $v VU. Istirahat $CooldownSec detik biar sistem adem..." -ForegroundColor Yellow
  Start-Sleep -Seconds $CooldownSec
}

Write-Host "`nSemua level selesai. Buat grafik gabungan:  python k6/plot_results.py $Tag" -ForegroundColor Green
