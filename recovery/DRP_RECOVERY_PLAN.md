# Disaster Recovery Plan (DRP) — TeleMed

## Tujuan dan cakupan

DRP praktikum ini menguji **pemulihan seluruh database PostgreSQL** dari dump logis. Latihan dijalankan pada satu laptop dan satu service PostgreSQL, tanpa server/VPS tambahan. Agar data aplikasi yang sedang dipakai tidak rusak, dump dipulihkan ke database uji terisolasi bernama `telemed_dr_restore_<timestamp>` pada service PostgreSQL yang sama. Database sumber `telemed` dan volume `pgdata` tidak dihapus.

Ini adalah **full-database restore drill**, bukan uji server/host mati, high availability, failover, atau PITR berbasis WAL. Tidak ada klaim bahwa aplikasi otomatis berpindah host.

## Arsitektur dan penyimpanan

| Komponen | Fungsi | Batas perlindungan |
|---|---|---|
| Volume Docker `pgdata` | Menjaga data saat container PostgreSQL diganti/restart | Tidak melindungi dari kerusakan host/disk yang sama |
| `pg_dump -Fc` di `/backups/dump` | Backup logis database tiap 6 jam dan backup manual | RPO terjadwal mengikuti dump terakhir yang dapat direstore |
| `pg_basebackup` di `/backups/base` | Backup fisik harian | Belum digunakan dalam prosedur restore praktikum |
| Arsip WAL di volume `wal_archive` | Menyimpan segmen WAL PostgreSQL | Arsip WAL tersedia, tetapi restore PITR dari base + WAL belum diuji |
| Salinan terenkripsi di `./offsite` | Salinan file dump/base/WAL, AES-256-CBC | Folder berada di host yang sama; bukan offsite geografis dan tak tahan host hilang |
| Volume MinIO `minio_data` | Menyimpan aset upload | Belum dicakup oleh backup PostgreSQL; perlu rencana backup objek tersendiri |

Jadwal yang dikonfigurasi: dump logis tiap 6 jam, base backup harian, sync file terenkripsi tiap 5 menit, retensi lokal 7 hari, retensi salinan folder 30 hari, dan pemeriksaan integritas harian. Salinan `./offsite` sebaiknya disebut **salinan lokal tambahan**, bukan pemenuhan aturan 3-2-1.

## Target dan cara menyatakan hasil

| Ukuran | Target praktikum | Interpretasi |
|---|---:|---|
| RTO | ≤ 5 menit untuk restore dump penuh ke database uji | Ukur dari mulai pembuatan database pemulihan sampai pemeriksaan tabel dan jumlah baris selesai. Catat nilai aktual; jangan menganggap target tercapai sebelum pengukuran. |
| RPO | ≤ 6 jam untuk skenario memakai dump terjadwal | Perkiraan berdasarkan jadwal dump, bukan jaminan. Verifikasi umur dan keberhasilan dump yang dipakai. |
| RPO latihan restore | 0 perubahan relatif terhadap dump yang baru dibuat | Berlaku hanya karena dump latihan dibuat segera sebelum restore drill; bukan RPO produksi dan bukan bukti PITR. |

`archive_timeout=60s` bukan bukti RPO 60 detik. RPO sekecil itu hanya boleh diklaim setelah pemulihan dari base backup dan seluruh rangkaian WAL diuji sampai target waktu.

## Skenario DR yang diuji

**Skenario:** database sumber dianggap mengalami kehilangan total; tim harus membangun ulang database dari backup. Untuk mencegah risiko pada data demo aktif, kehilangan disimulasikan dengan membuat database pemulihan kosong yang terisolasi, lalu merestore seluruh dump ke sana. Skrip membandingkan seluruh nama tabel publik dan jumlah baris setiap tabel antara sumber saat snapshot dan hasil restore.

**Batas simulasi:** database sumber tetap hidup dan tidak dihapus; API/frontend tidak dibuat mati. Karena itu, laporan menyebutnya uji pemulihan database penuh ke database pemulihan terisolasi, bukan uji kehilangan host atau outage seluruh sistem.

## Prosedur menjalankan DR restore drill

1. Jalankan Docker Compose dan tunggu service `db` serta `backup` aktif/healthy.
2. Pastikan tidak ada perubahan data aplikasi selama latihan, agar perbandingan jumlah baris merepresentasikan isi snapshot.
3. Dari PowerShell pada root repository, jalankan `./dr_test.ps1`.
4. Skrip meminta container `backup` membuat `pg_dump -Fc` ke `/backups/dr-test`, memeriksa arsip, lalu membuat database uji kosong.
5. Skrip merestore seluruh dump menggunakan `pg_restore`, membandingkan seluruh tabel dan jumlah baris, mengukur durasi restore+validasi, lalu menghapus database uji.
6. Simpan output terminal dan screenshot. Jalankan `docker compose ... ps` setelahnya untuk membuktikan service tetap berjalan.

Untuk mempertahankan database hasil restore agar diperiksa di pgAdmin, jalankan:

```powershell
$env:DR_TEST_KEEP_DB = '1'
.\dr_test.ps1
Remove-Item Env:DR_TEST_KEEP_DB
```

Database pemulihan akan bernama `telemed_dr_restore_<timestamp>`. Hapus database latihan tersebut secara manual setelah dokumentasi selesai; jangan hapus `telemed` atau volume `pgdata`.

## Kriteria sukses dan bukti laporan

- Dump penuh berhasil dibuat dan lolos pemeriksaan daftar arsip `pg_restore --list`.
- Restore ke database uji selesai tanpa error.
- Seluruh tabel publik dan jumlah baris sama dengan snapshot sumber.
- Durasi restore+validasi aktual tercatat dan dibandingkan dengan target RTO 300 detik.
- Waktu dump tercatat; RPO latihan dilabeli relatif terhadap dump latihan. RPO terjadwal dilaporkan terpisah.
- Screenshot: service Compose sehat, log pembuatan dump, tahap restore, hasil validasi, durasi/RTO, dan (opsional) database hasil restore di pgAdmin.

DRP yang berjalan saat ini memiliki **backup otomatis dan restore yang dipicu manual**. Ia tidak mendeteksi bencana lalu memulihkan layanan sendiri. Jika seluruh host rusak, salinan lokal `./offsite` dapat ikut hilang; skenario itu berada di luar cakupan uji praktikum ini.
