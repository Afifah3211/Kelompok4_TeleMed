# Arsitektur Berbasis Kebutuhan Pengguna TeleMed

## Prinsip

- Pasien mengelola konsultasinya sendiri dan mengirim gambar pendukung hanya melalui chat konsultasi miliknya.
- Dokter hanya menangani antrean yang ditugaskan kepadanya; chat serta gambar lampiran terkait konsultasi itu.
- Apoteker menerima resep yang dibuat dokter dan hanya mengelola penyiapan/penyerahan obat. Apoteker tidak membuka rekam medis atau lampiran konsultasi.
- Admin mengelola akun dan audit operasional. Hak admin tidak otomatis memberi akses ke isi rekam medis.
- Backend menjadi sumber kebenaran untuk identitas, kepemilikan, dan izin; menyembunyikan tombol pada frontend saja tidak cukup.

## Peran dan kebutuhan

| Peran | Boleh | Tidak boleh |
|---|---|---|
| Pasien | Mengubah profil sendiri, membuat/membatalkan konsultasi sendiri, mengirim pesan dan gambar melalui chat konsultasi sendiri, membaca EMR dan resep milik sendiri | Melihat pasien lain, mengubah EMR/resep dokter, mengirim pesan/gambar ke konsultasi orang lain |
| Dokter | Melihat antrean yang ditugaskan, membaca data klinis dan chat konsultasi tersebut, membalas pesan atau gambar, membuat EMR/resep | Melihat antrean dokter lain, mengubah profil medis pasien, menelusuri file global tanpa konteks konsultasi |
| Apoteker | Melihat resep yang perlu diproses, melihat rincian obat dan instruksi resep, mengubah status penyiapan/penyerahan, mengelola stok | Membaca EMR, keluhan, dokumen pasien, atau mengubah diagnosis/resep |
| Admin | Mengelola akun dan status akses, melihat audit log serta status operasional backup | Membuka isi konsultasi, EMR, atau file klinis tanpa proses akses khusus yang diaudit |

## Alur klinis dan file

1. Pasien memilih dokter, waktu, metode (Chat atau Video Call), dan menjelaskan keluhan saat booking.
2. Untuk metode Chat, pasien dan dokter yang ditugaskan bertukar pesan dan dapat mengirim lampiran gambar. Metode Video Call saat ini hanya memiliki tampilan demo; streaming langsung belum tersedia dan tidak membuat kanal chat/lampiran.
3. Pesan dan metadata lampiran disimpan di PostgreSQL pada `chat_messages`; gambar disimpan sebagai object di MinIO. Nginx Edge melayani URL gambar bertanda tangan dan cache, bukan app server.
4. API memeriksa bahwa pengakses adalah pasien pemilik konsultasi atau dokter yang ditugaskan. Konsultasi selesai/dibatalkan hanya dapat dibaca dan tidak menerima pesan baru.
5. Dokter menyimpan EMR. Bila obat diresepkan, dokter memilih obat dari katalog farmasi dan mengisi jumlah unit stok, aturan pakai, serta catatan untuk apoteker.
6. Dalam satu transaksi backend, sistem menyimpan EMR, item resep terstruktur, resep berstatus `Menunggu Penyiapan`, dan status konsultasi `Selesai`. Jika transaksi gagal, semua perubahan dibatalkan.
7. Apoteker melihat antrean resep dari endpoint resep; tidak ada pesan pribadi dokter-ke-apoteker. Dashboard apoteker memperbarui antrean berkala. Apoteker memproses status berurutan dari `Menunggu Penyiapan` ke `Sedang Diramu`, lalu `Selesai / Sudah Diambil`. Stok baru dikurangi saat resep ditandai sudah diserahkan.
8. Pasien membaca resep dan status penyerahannya dari akunnya sendiri; dashboard pasien juga memperbarui status secara berkala.

## Catatan implementasi

Compose memakai `frontend` (React/Nginx), `backend` (FastAPI), `db` (PostgreSQL), `minio` (object storage), dan `backup`. Tidak ada file explorer global. Endpoint chat menerbitkan URL CDN singkat hanya setelah otorisasi konsultasi. Jangan publikasikan URL bertanda tangan karena URL tersebut menjadi bearer link sementara.

Resep baru hanya diterbitkan sebagai bagian dari penyimpanan EMR melalui endpoint rekam medis. Setiap item harus menunjuk ke `medicines.id`; nama dan unit diambil dari katalog backend, bukan dipercaya dari input browser. Relasi resep tersimpan pada `prescriptions.medical_record_id`, `consultation_id`, `patient_id`, dan `doctor_id`; rincian obat tersimpan pada `prescription_items`. API apoteker hanya mengelola antrean resep dan stok, bukan membaca tabel EMR.

File lama yang pernah diunggah melalui endpoint global sebelum alur chat diterapkan tidak mempunyai relasi pesan yang dapat dipercaya. File tersebut tidak ditampilkan di chat dan jangan dikaitkan otomatis ke pasien; hapus hanya setelah dipastikan merupakan file uji yang tidak dibutuhkan.
