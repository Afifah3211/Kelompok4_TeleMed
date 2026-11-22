# Arsitektur Peran TeleMed

## Peran yang didukung

| Peran | Tanggung jawab utama |
|---|---|
| Pasien | Mengelola profil, membuat konsultasi, mengirim chat/lampiran pada konsultasi sendiri, dan membaca rekam medis serta resep sendiri. |
| Dokter | Menangani konsultasi yang ditugaskan, mengirim chat, menyimpan rekam medis, dan menulis resep untuk pasien yang diperiksa. |
| Admin | Mengelola akun pasien/dokter serta memeriksa audit dan status operasional. |

Tidak ada akun atau dashboard apoteker dalam aplikasi saat ini.

## Alur resep

1. Dokter menulis nama obat, jumlah, dan aturan pakai saat menyimpan rekam medis.
2. Backend menyimpan rekam medis, resep, dan rincian resep secara transaksional.
3. Resep berstatus `Diterbitkan`; status ini berarti resep diterbitkan oleh dokter, bukan sudah disiapkan atau diserahkan oleh farmasi.
4. Pasien membaca resep pada riwayat medisnya. Data resep tetap terhubung dengan pasien, dokter, konsultasi, dan rekam medis.

Tabel `prescriptions` dan `prescription_items` tetap diperlukan untuk alur dokter-pasien. Katalog stok `medicines`, relasi katalog pada item resep, catatan apoteker, tabel profil `pharmacists`, dan status proses farmasi tidak digunakan dan dihapus melalui migrasi startup. Nama obat tersimpan sebagai snapshot teks pada item resep agar riwayat lama tetap terbaca.

## Akses dan privasi

- Pasien hanya membaca rekam medis, resep, dan percakapan miliknya.
- Dokter hanya membaca data klinis dan konsultasi yang ditugaskan kepadanya.
- Admin mengelola akun dan operasional; akses ke isi data klinis tetap mengikuti endpoint dan audit.
- Backend menjadi sumber kebenaran untuk identitas, kepemilikan data, dan izin. Menyembunyikan tombol pada frontend saja tidak cukup.
- Akun apoteker lama dan pesan yang pernah dikirim akun tersebut dibersihkan saat migrasi; referensi audit tetap menyimpan nama pelaku dan tidak menghapus catatan audit.
