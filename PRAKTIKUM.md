# Deliverable Praktikum TeleMed

Status di bawah menunjukkan artefak kode/dokumen yang tersedia. Screenshot dan metrik runtime harus diambil saat menjalankan project; file source saja tidak membuktikan hasil runtime.

## Pertemuan 1 — Planning dan setup

- [x] Spesifikasi arsitektur: [ARCHITECTURE_SPEC.md](ARCHITECTURE_SPEC.md)
- [x] Dokumen DRP awal dan target RTO/RPO: [DRP_RECOVERY_PLAN.md](recovery/DRP_RECOVERY_PLAN.md)
- [x] Frontend React/Vite dan backend FastAPI/PostgreSQL
- [ ] Simpan screenshot aplikasi yang berjalan di `http://localhost:8080`
- [ ] Catat URL/commit repositori Git untuk bukti push

## Pertemuan 2 — Docker

- [x] Frontend dan backend Dockerfile serta Compose multi-container
- [x] Volume database, backup, WAL, dan MinIO
- [ ] Simpan `docker compose ps` dan screenshot layanan sehat
- [ ] Simpan bukti upload/restore volume setelah container direstart

## Pertemuan 3 — Stress test

Skrip: [k6/stress.js](k6/stress.js), runner: [run_stress.ps1](run_stress.ps1). Jalankan 10, 100, 500, dan 1000 VU satu per satu, amati resource host, dan hentikan jika laptop kehabisan resource. Default durasi tahan adalah 1 menit; ubah `-Hold` menjadi `2m` atau `3m` untuk memenuhi durasi yang ditetapkan pengajar.

```powershell
.\run_stress.ps1 -Tag noscale -Hold 1m
```

- [x] Skrip mencatat latency, throughput, dan error rate ke summary JSON
- [x] Plot ringkasan tersedia di `k6/plot_results.py`
- [ ] Simpan hasil tiap level dan catat level pertama yang melampaui threshold/gagal
- [ ] Lengkapi analisis bottleneck berdasarkan metrik CPU, memori, DB, dan log

## Pertemuan 4 — Disaster Recovery

- [x] Backup terjadwal: `backup/crontab` dan `backup/scripts/`
- [x] Latihan penghapusan tabel dan pemulihan snapshot: [dr_test.ps1](dr_test.ps1)
- [x] Prosedur DRP PostgreSQL: [recovery/DRP_RECOVERY_PLAN.md](recovery/DRP_RECOVERY_PLAN.md)
- [ ] Jalankan latihan hanya pada data demo; simpan output/screenshot sebelum, saat insiden, dan setelah restore
- [ ] Catat RTO aktual dan RPO aktual (timestamp backup/WAL serta selisih data)

## Pertemuan 5 — File management dan CDN lokal

- [x] MinIO dengan volume `minio_data`; gambar chat diunggah lewat `backend/app/routers/chat.py`
- [x] Nginx proxy/cache gambar chat dengan URL HMAC bertenggat waktu ada di `nginx.conf`; unggah tersedia di composer chat pasien/dokter
- [x] Skrip beban aset: `k6/stress_cdn.js`; visualisasi: `k6/plot_cdn.py`
- [x] Skrip CDN memakai URL bertanda tangan dari API; mode CDN dan origin dijalankan terpisah agar angkanya tidak saling membebani
- [ ] Jalankan `.\run_stress.ps1 -Tag cdn -Script stress_cdn.js -Mode cdn`
- [ ] Jalankan `.\run_stress.ps1 -Tag origin -Script stress_cdn.js -Mode direct`
- [ ] Buat grafik dengan `python k6/plot_cdn.py` (runner CDN membatasi ke 10, 100, 500 VU)
- [ ] Jalankan benchmark pada beban yang disepakati dan simpan summary, grafik, serta CSV
- [ ] Bandingkan latency/throughput direct MinIO dengan jalur Nginx CDN dan catat error rate
- [ ] Simpan screenshot upload, akses aset, dan status cache (`X-Cache-Status` MISS lalu HIT)

## Setup lokal

Ikuti bagian prasyarat dan setup di [README.md](README.md). Siapkan `.env` dan `secrets/backup_key.txt` sebelum `docker compose up -d --build`; file rahasia tidak boleh masuk repository.

## Urutan demo dan screenshot Pertemuan 5

Buat folder `laporan/bukti-pertemuan-5/`. Pastikan tidak ada password, isi dokumen medis nyata, atau nilai `signature` pada URL CDN yang terbaca; signature adalah link akses sementara. Gunakan akun dan file demo.

1. **Tampilkan stack final.** Jalankan `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`, lalu `docker compose ps`. Ambil screenshot `01-container-sehat.png` yang menampilkan `frontend`, `backend`, `db`, `backup`, dan `minio` dalam kondisi sehat.
2. **Tampilkan storage terpisah.** Buka `http://localhost:9001`, login memakai `MINIO_ACCESS_KEY` dan `MINIO_SECRET_KEY` dari `.env`, lalu buka bucket `telemed-files` dan objek yang baru diupload. Ambil `02-minio-object.png`. Compose development hanya membuka console pada loopback.
3. **Tunjukkan alur pasien ke dokter.** Login sebagai pasien, buat konsultasi Chat dengan Dokter Sarah, lalu kirim pesan dan gambar dummy melalui composer chat. Login sebagai Dokter Sarah dan buka konsultasi yang sama untuk melihat pesan serta gambar tersebut. Ambil screenshot dari kedua sisi.
4. **Buktikan gambar lewat edge/cache.** Di chat, buka gambar yang dikirim. Buka DevTools → Network dan aktifkan **Disable cache**. Pilih request `/files/chat/...`; pastikan status 200 serta header `X-CDN-Node` dan `X-Cache-Status`. Ulangi request URL yang sama untuk membuktikan cache HIT. Jangan tampilkan query signature URL pada laporan.
5. **Jalankan benchmark origin.** Dari PowerShell di root project, jalankan `.\run_stress.ps1 -Tag origin -Script stress_cdn.js -Mode direct`. Skrip menyiapkan konsultasi Chat dan gambar dummy melalui API chat sebelum mengukur URL aset. Simpan screenshot terminal setelah tes selesai.
6. **Jalankan benchmark CDN.** Jalankan `.\run_stress.ps1 -Tag cdn -Script stress_cdn.js -Mode cdn`. Simpan tampilan akhir sebagai `07-k6-cdn.png`. Skrip menjalankan 10, 100, 500 VU dengan hold default 1 menit. Jangan gabungkan hasil dari run dengan kondisi laptop yang berbeda tanpa mencatat perbedaannya.
7. **Buat artefak perbandingan.** Jika Matplotlib belum tersedia, jalankan `python -m pip install matplotlib`; lalu `python k6/plot_cdn.py`. Ambil `08-grafik-perbandingan.png` dari `k6/results/grafik_cdn_comparison.png` dan lampirkan `ringkasan_cdn_comparison.csv`. Grafik memisahkan latency p95/rata-rata, throughput GET, error rate, dan persentase cache HIT.
8. **Tuliskan hasil, bukan klaim awal.** Isi tabel per VU dengan CDN p95, origin p95, CDN/origin req/s, error rate, dan cache HIT. Catat batas pertama yang melambat/gagal, penggunaan CPU/memori host, serta alasan bila nilai CDN lebih baik atau lebih buruk. Hasil baru dianggap bukti setelah file summary, grafik, dan screenshot disimpan.
