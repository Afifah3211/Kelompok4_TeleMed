# ============================================================
# TeleMed - Jalankan stress test bertahap (PowerShell)
# Pemakaian (dari ROOT project, aplikasi harus sudah jalan):
#   .\run_stress.ps1 -Tag noscale        # 1 replika backend, tanpa autoscaler
#   .\run_stress.ps1 -Tag autoscale      # autoscale.sh jalan di WSL
# ============================================================
param(
  [string]$Tag = "noscale",
  [int[]]$Levels = @(10, 100, 500, 1000),
  [string]$Hold = "1m",
  [int]$CooldownSec = 45
)

New-Item -ItemType Directory -Force -Path "k6/results" | Out-Null
$k6dir = (Resolve-Path "k6").Path

foreach ($v in $Levels) {
  Write-Host "`n===== $Tag : $v VU =====" -ForegroundColor Cyan
  docker run --rm --network telemed_net `
    -v "${k6dir}:/k6" `
    -e BASE_URL=http://frontend -e VUS=$v -e TAG=$Tag -e HOLD=$Hold `
    -e K6_WEB_DASHBOARD=true `
    -e K6_WEB_DASHBOARD_EXPORT="/k6/results/${Tag}_${v}vu.html" `
    grafana/k6 run /k6/stress.js
  Write-Host "Selesai $v VU. Istirahat $CooldownSec detik biar sistem adem..." -ForegroundColor Yellow
  Start-Sleep -Seconds $CooldownSec
}

Write-Host "`nSemua level selesai. Buat grafik gabungan:  python k6/plot_results.py $Tag" -ForegroundColor Green
