# MediSync: Sistem Manajemen Telemedis 🏥💻
> **Dokumen Kebutuhan Produk (PRD) & Spesifikasi Desain • Versi 1.0 (Kelompok 4 TeleMed)**

MediSync adalah platform telemedis berbasis web modern yang dirancang untuk menghubungkan pasien dengan dokter spesialis secara aman, cepat, dan terpercaya. Dilengkapi dengan Rekam Medis Elektronik (EMR) berfitur *Soft Delete*, pencatatan audit forensik (*Audit Log*), dan pencadangan data otomatis berstandar *Aturan 3-2-1*.

---

## 🎨 Panduan Warna & Desain Antarmuka (PRD Standard)

| Peran Warna | Kode Hex | Penggunaan Utama |
|---|---|---|
| **Biru Medis (Primary)** | `#1D4ED8` | Header navigasi, tombol aksi utama, badge fokus, dan link. Memberi kesan profesional, sehat, dan terpercaya. |
| **Hijau Tosca (Accent)** | `#0F766E` | Status *"Selesai"*, tanda berhasil, aksen konsultasi, dan ikon-ikon kesehatan. |
| **Putih Bersih (Surface)** | `#FFFFFF` | Latar belakang kartu informasi dan formulir agar kontras dan mudah dibaca. |
| **Clean Background** | `#F8FAFC` | Latar belakang aplikasi yang bersih, modern, dan tidak melelahkan mata. |
| **Merah Aksen (Danger/Delete)** | `#DC2626` | Penanda khusus aksi *Soft Delete* dan log penghapusan data penting. |

---

## 🚀 Fitur Utama Sesuai Dokumen PRD

### 1. Sistem Login & Hak Akses Berbasis Peran (RBAC)
- **Pasien**: Melihat rekam medis pribadi, menjadwalkan konsultasi online, dan masuk ke ruang telemedis virtual.
- **Dokter**: Memantau antrean pasien hari ini, mengisi formulir konsultasi aktif, menerbitkan e-Prescription (resep obat), dan mengelola arsip rekam medis.
- **Admin IT / Klinik**: Mengelola akun pengguna klinis, memantau *Audit Log* sistem secara *real-time*, dan mengawasi pencadangan data *3-2-1*.

### 2. Halaman Pasien (Patient Dashboard)
- Sapaan selamat datang interaktif & ringkasan profil kesehatan (Golongan Darah, NIK, Riwayat Alergi).
- **Konsultasi Mendatang**: Daftar janji temu lengkap dengan nama dokter, tanggal, jam, status antrean, dan tombol biru **'Gabung'**.
- **Ruang Telemedis Virtual**: Simulasi *video call* terenkripsi (256-bit HIPAA compliant), kontrol kamera/mikrofon, pengatur durasi panggilan, serta fitur obrolan langsung (*live chat*).
- **Riwayat Pemeriksaan**: Tabel data rapi berisi tanggal pemeriksaan, dokter pemeriksa, diagnosis ICD-10, resep obat, serta rincian lengkap EMR.

### 3. Halaman Dokter & Rekam Medis (Doctor EMR)
- **Tata Letak Split-Screen**:
  - **Kolom Kiri**: Daftar antrean pasien hari ini (*Jadwal Hari Ini*) dengan aksen warna tosca `#0F766E` pada status konsultasi.
  - **Kolom Kanan**: Formulir Konsultasi Aktif yang memuat Tanda-Tanda Vital (Tekanan Darah, Nadi, Suhu, Berat Badan), input bersih untuk **'Keluhan'**, **'Diagnosis'** (dengan preset cepat ICD-10), **'Tindakan'**, dan **'Resep Obat'**.
  - Tombol biru utama: **'Simpan Rekam Medis'**.
- **Fitur Soft Delete EMR**:
  - Data rekam medis yang dihapus tidak benar-benar hilang dari database fisik (ditandai `is_deleted = true`, lengkap dengan timestamp dan nama dokter penanggung jawab).
  - Tersedia tab *Arsip & Pemulihan* untuk melihat dan memulihkan kembali data yang telah di-*soft delete*.

### 4. Halaman Admin & Log Keamanan (Admin Audit Logs & Backup 3-2-1)
- **Catatan Aktivitas (Audit Trail Logs)**:
  - Struktur tabel beresolusi tinggi dengan kolom: `Tanggal & Waktu`, `IP Address`, `ID Pengguna`, `Aksi`, `Tabel Data`, dan `ID Data`.
  - Bilah pencarian (*search bar*) cerdas dan filter tanggal di atas tabel.
  - Aksen merah halus (`#DC2626`) khusus untuk aksi **DELETE** / penghapusan data.
  - Fitur ekspor log ke format CSV untuk audit kepatuhan.
- **Kelola Pengguna**: Penambahan dan aktivasi/nonaktivasi akun dokter, pasien, dan staf klinik.
- **Pencadangan Otomatis (Aturan 3-2-1)**:
  - **3 Salinan Data**: Salinan Utama (SSD NVMe Production), Salinan Sekunder Lokal (NAS RAID-10), dan Salinan Offsite Terpisah (Cloud S3 Encrypted Glacier).
  - **2 Media Berbeda**: Flash SSD & Dedicated NAS Storage.
  - **1 Lokasi Terpisah (Offsite)**: Cloud Disaster Recovery dengan enkripsi AES-256.
  - Tombol **"Lakukan Backup Sekarang"** yang langsung memicu pencadangan snapshot terenkripsi yang dapat diunduh.

---

## 🛠️ Tumpukan Teknologi (Tech Stack)

- **Frontend & UI**: React 19, Vite 6, Modern Vanilla CSS Design Tokens, Lucide Icons.
- **State & Storage**: React Context API dengan sinkronisasi otomatis `localStorage` (data persisten).
- **Standar Kode & Tipografi**: Google Fonts (`Inter` & `Plus Jakarta Sans`).

---

## 💻 Panduan Menjalankan Proyek Secara Lokal

### Prasyarat
- [Node.js](https://nodejs.org/) versi 18 atau yang lebih baru.
- npm atau yarn / pnpm.

### 1. Klon Repositori
```bash
git clone https://github.com/<USERNAME>/Kelompok4_TeleMed.git
cd Kelompok4_TeleMed
```

### 2. Instal Dependensi
```bash
npm install
```

### 3. Jalankan Server Pengembangan (Dev Server)
```bash
npm run dev
```
Buka browser dan akses alamat: `http://localhost:3000/`

### 4. Build untuk Lingkungan Produksi
```bash
npm run build
npm run preview
```

---

## 👥 Pengembang
- **Kelompok 4 TeleMed** - Sistem Manajemen Telemedis (MediSync v1.0)
