# Full database restore rehearsal for TeleMed.
# Safe by design: the source database and Docker volumes are not deleted or modified.
# Run from the repository root after the Compose stack is healthy:
#   .\dr_test.ps1
# Keep the isolated restored database for inspection:
#   $env:DR_TEST_KEEP_DB = '1'; .\dr_test.ps1; Remove-Item Env:DR_TEST_KEEP_DB

$ErrorActionPreference = 'Stop'
$composeFiles = @('-f', 'docker-compose.yml', '-f', 'docker-compose.dev.yml')

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' TELEMED - FULL DATABASE RESTORE DRILL' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host 'Skenario: restore dump penuh ke database pemulihan terisolasi.' -ForegroundColor Yellow
Write-Host 'Database sumber dan volume utama tidak dihapus.' -ForegroundColor Green

docker compose @composeFiles ps db backup
if ($LASTEXITCODE -ne 0) {
    throw 'Tidak dapat memeriksa service Compose. Pastikan Docker Desktop aktif dan jalankan dari folder project.'
}

if ($env:DR_TEST_KEEP_DB -eq '1') {
    docker compose @composeFiles exec -T -e DR_TEST_KEEP_DB=1 backup /scripts/dr_restore_drill.sh
} else {
    docker compose @composeFiles exec -T backup /scripts/dr_restore_drill.sh
}
if ($LASTEXITCODE -ne 0) {
    throw 'DR restore drill gagal. Lihat pesan error di atas; database sumber tidak disentuh oleh skrip.'
}

Write-Host ''
Write-Host 'DR restore drill selesai. Simpan output terminal ini sebagai bukti laporan.' -ForegroundColor Green
