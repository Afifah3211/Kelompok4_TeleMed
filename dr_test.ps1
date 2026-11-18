# ============================================================
# TeleMed DR Test Script - Kelompok 4
# Jalankan: .\dr_test.ps1
# Script ini otomatis: login -> snapshot -> simulasi -> recovery
# ============================================================

$BASE_URL = "http://localhost:8080"
$ADMIN_USER = "admin@medisync.id"
$ADMIN_PASS = if ($env:SEED_PASSWORD) { $env:SEED_PASSWORD } else { "medisync2026" }

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  MEDISYNC DR TEST - Kelompok 4 Telemedicine" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# ── STEP 0: Login untuk dapatkan token ───────────────────────
Write-Host ""
Write-Host "[STEP 0] Login sebagai admin..." -ForegroundColor Yellow

$loginBody = @{ username = $ADMIN_USER; password = $ADMIN_PASS } | ConvertTo-Json
$loginResp = Invoke-RestMethod -Method POST -Uri "$BASE_URL/api/auth/login" `
    -ContentType "application/json" -Body $loginBody

$TOKEN = $loginResp.token
if (-not $TOKEN) {
    Write-Host "GAGAL login! Cek apakah container sudah berjalan." -ForegroundColor Red
    exit 1
}
Write-Host "Login BERHASIL." -ForegroundColor Green

$headers = @{ Authorization = "Bearer $TOKEN" }

# ── STEP 1: Cek status awal ───────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "[STEP 1] STATUS AWAL DATABASE (NORMAL)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$status1 = Invoke-RestMethod -Method GET -Uri "$BASE_URL/api/drp/status" -Headers $headers
Write-Host "Status: $($status1.incident.status)" -ForegroundColor Green
Write-Host "Medical Records: $($status1.table_counts.medical_records)" -ForegroundColor Green
Write-Host "Users: $($status1.table_counts.users)" -ForegroundColor Green
Write-Host ($status1 | ConvertTo-Json -Depth 5)

# ── STEP 2: Buat Snapshot PITR ────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "[STEP 2] MEMBUAT SNAPSHOT PITR (PRE-INCIDENT)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$snapshot = Invoke-RestMethod -Method POST -Uri "$BASE_URL/api/drp/snapshot" -Headers $headers
$SNAPSHOT_ID = $snapshot.snapshot_id

Write-Host "Snapshot ID: $SNAPSHOT_ID" -ForegroundColor Green
Write-Host "Medical Records saat snapshot: $($snapshot.stats_at_snapshot.medical_records)" -ForegroundColor Green
Write-Host ($snapshot | ConvertTo-Json -Depth 5)

# ── STEP 3: Simulasi Insiden (DROP TABLE) ────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Red
Write-Host "[STEP 3] SIMULASI INSIDEN: DROP TABLE medical_records" -ForegroundColor Red
Write-Host "============================================================" -ForegroundColor Red

$recoveryClock = [System.Diagnostics.Stopwatch]::StartNew()
$incident = Invoke-RestMethod -Method POST -Uri "$BASE_URL/api/drp/simulate-drop" -Headers $headers
Write-Host "Records yang hilang: $($incident.records_lost)" -ForegroundColor Red
Write-Host "Pesan: $($incident.message)" -ForegroundColor Red
Write-Host ($incident | ConvertTo-Json -Depth 5)

# ── STEP 4: Verifikasi Insiden ────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Red
Write-Host "[STEP 4] VERIFIKASI STATUS PASCA-INSIDEN" -ForegroundColor Red
Write-Host "============================================================" -ForegroundColor Red

$status2 = Invoke-RestMethod -Method GET -Uri "$BASE_URL/api/drp/status" -Headers $headers
Write-Host "Status: $($status2.incident.status)" -ForegroundColor Red
Write-Host "Medical Records: $($status2.table_counts.medical_records)" -ForegroundColor Red
Write-Host ($status2 | ConvertTo-Json -Depth 5)

# Tunggu sebentar
Start-Sleep -Seconds 2

# ── STEP 5: Eksekusi Recovery ─────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host "[STEP 5] EKSEKUSI POINT-IN-TIME RECOVERY" -ForegroundColor Yellow
Write-Host "  Snapshot: $SNAPSHOT_ID" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow

$recovery = Invoke-RestMethod -Method POST -Uri "$BASE_URL/api/drp/recover/$SNAPSHOT_ID" -Headers $headers
$recoveryClock.Stop()
$rtoSeconds = [math]::Round($recoveryClock.Elapsed.TotalSeconds, 2)
Write-Host "Recovery Status: $($recovery.recovery_status)" -ForegroundColor Green
Write-Host "Records dipulihkan: $($recovery.recovered_records)" -ForegroundColor Green
Write-Host "Data Loss: $($recovery.data_loss)" -ForegroundColor Green
Write-Host "RPO Tercapai: $($recovery.rpo_achieved)" -ForegroundColor Green
Write-Host ($recovery | ConvertTo-Json -Depth 5)

# ── STEP 6: Verifikasi Recovery ───────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "[STEP 6] VERIFIKASI PASCA-RECOVERY" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

$status3 = Invoke-RestMethod -Method GET -Uri "$BASE_URL/api/drp/status" -Headers $headers
Write-Host "Status: $($status3.incident.status)" -ForegroundColor Green
Write-Host "Medical Records: $($status3.table_counts.medical_records)" -ForegroundColor Green
Write-Host ($status3 | ConvertTo-Json -Depth 5)

# ── RINGKASAN ─────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  RINGKASAN DR TEST" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Snapshot ID       : $SNAPSHOT_ID" -ForegroundColor White
Write-Host "Records sebelum   : $($snapshot.stats_at_snapshot.medical_records)" -ForegroundColor White
Write-Host "Records hilang    : $($incident.records_lost)" -ForegroundColor Red
Write-Host "Records dipulihkan: $($recovery.recovered_records)" -ForegroundColor Green
Write-Host "Data Loss         : $($recovery.data_loss)" -ForegroundColor White
Write-Host "RPO Tercapai      : $($recovery.rpo_achieved)" -ForegroundColor Green
Write-Host "Waktu recovery    : $rtoSeconds detik" -ForegroundColor White
Write-Host "RTO Tercapai      : $($rtoSeconds -le 300) (target <= 300 detik)" -ForegroundColor White
Write-Host ""
if ($recovery.rpo_achieved -eq $true) {
    Write-Host "HASIL: DR TEST BERHASIL - Zero Data Loss!" -ForegroundColor Green
} else {
    Write-Host "HASIL: Sebagian data terpulihkan." -ForegroundColor Yellow
}
Write-Host "============================================================" -ForegroundColor Cyan
