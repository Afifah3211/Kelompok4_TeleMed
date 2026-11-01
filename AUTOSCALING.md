# Dokumen Autoscaling & Load Balancing - Platform TeleMed

Dokumen ini menjelaskan arsitektur, konfigurasi parameter, prosedur operasional, analisis keterbatasan, serta rasionalitas desain mekanisme autoscaling dan load balancing pada platform TeleMed.

---

## 1. Arsitektur Autoscaling & Load Balancing

Mekanisme penskalaan horizontal pada sistem ini memanfaatkan tiga pilar utama:
1. **Stateless Backend Replicas**: Aplikasi FastAPI tidak menyimpan sesi atau state di memori lokal container (autentikasi berbasis stateless JWT, transaksi persisted di PostgreSQL, dan inisialisasi database aman dari race condition dengan PostgreSQL Advisory Lock).
2. **Reverse Proxy & Dynamic Load Balancer (Nginx)**: Menggunakan Nginx resolver internal Docker (`127.0.0.11`) dengan TTL dinamis (`valid=5s`) untuk mendistribusikan trafik HTTP secara merata (*Round-Robin*) ke seluruh IP container replika backend yang aktif.
3. **Host-Level Metrics Monitor (`scripts/autoscale.sh`)**: Skrip bash yang berjalan di environment host/WSL untuk memantau penggunaan CPU relatif terhadap limit container dan mengorkestrasi perintah `docker compose up -d --scale backend=N`.

### Diagram Alur Arsitektur

```text
       ┌────────────────────────────────────────────────────────┐
       │             KLIEN / PENGGUNA TELEMEDIS                 │
       └───────────────────────────┬────────────────────────────┘
                                   │ HTTP Request (Port 8080)
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                FRONTEND (Nginx Reverse Proxy)          │
       │  - Port 8080 -> 80                                     │
       │  - Docker Resolver: 127.0.0.11 valid=5s                │
       │  - Upstream dinamis: http://backend:8000               │
       └───────┬───────────────────┬───────────────────┬────────┘
               │ (Round-Robin)     │ (Round-Robin)     │ (Round-Robin)
               ▼                   ▼                   ▼
       ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
       │   backend_1   │   │   backend_2   │   │   backend_N   │
       │ FastAPI (8000)│   │ FastAPI (8000)│   │ FastAPI (8000)│
       │  CPU: max 0.5 │   │  CPU: max 0.5 │   │  CPU: max 0.5 │
       │  RAM: 512 MB  │   │  RAM: 512 MB  │   │  RAM: 512 MB  │
       └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
               │                   │                   │
               └─────────────┬─────┴───────────────────┘
                             │ Asyncpg Connection Pool
                             ▼
       ┌────────────────────────────────────────────────────────┐
       │                DATABASE (PostgreSQL 16)                │
       │  - State Storage (Users, Records, Audit, Prescriptions)│
       │  - Seed Concurrency: pg_advisory_lock(42)              │
       │  - WAL Archiving & Point-In-Time-Recovery (PITR)       │
       └────────────────────────────────────────────────────────┘

       ▲                                                        │
       │ docker compose up -d --scale backend=N                 │ docker stats
       │                                                        ▼
┌──────┴────────────────────────────────────────────────────────────────┐
│           AUTOSCALER HOST DAEMON (`scripts/autoscale.sh`)             │
│ - Hitung rata-rata CPU % relatif terhadap limit container (0.5 core)  │
│ - Threshold: Scale-out > 60%, Scale-in < 20%                          │
│ - Menjaga replika antara MIN=1 dan MAX=5                              │
│ - Log aktivitas ke `autoscale.log` (CSV)                              │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 2. Parameter Autoscaler

Konfigurasi autoscaler dapat diatur melalui environment variable saat menjalankan `scripts/autoscale.sh`:

| Variabel | Default | Satuan | Deskripsi |
|---|---|---|---|
| `SERVICE` | `backend` | String | Nama service Docker Compose yang dipantau dan diskalakan. |
| `MIN` | `1` | Integer | Jumlah replika minimum (batas bawah scale-in). |
| `MAX` | `5` | Integer | Jumlah replika maksimum (batas atas scale-out). |
| `UP` | `60` | Persen (`%`) | Ambang batas rata-rata CPU container untuk memicu **scale-out** (`+1 replika`). |
| `DOWN` | `20` | Persen (`%`) | Ambang batas rata-rata CPU container untuk memicu **scale-in** (`-1 replika`). |
| `INTERVAL` | `10` | Detik | Frekuensi polling metrik CPU dari `docker stats`. |
| `COOLDOWN` | `40` | Detik | Waktu tunggu minimal setelah aksi scaling sebelum boleh melakukan scaling berikutnya (mencegah *flapping* atau osilasi cepat). |
| `LIMIT_CPUS` | `0.5` | Cores | Batas alokasi CPU per container. Nilai ini **harus sinkron** dengan `deploy.resources.limits.cpus` di `docker-compose.yml`. |
| `LOG_FILE` | `autoscale.log` | File Path | Lokasi file log pencatatan riwayat metrik dan aksi dalam format CSV. |

> **Catatan Perhitungan CPU**: Perintah `docker stats` mengembalikan metrik CPU relatif terhadap 1 core host fisik (misalnya beban 50% pada container dengan limit 0.5 core akan dilaporkan sebagai 25% oleh docker stats). `scripts/autoscale.sh` secara otomatis menormalisasi nilai tersebut: `(s / c) / LIMIT_CPUS` sehingga nilai yang dibandingkan dengan `UP` dan `DOWN` benar-benar merepresentasikan kapasitas container yang terpakai.

---

## 3. Cara Menjalankan

### Persyaratan
- Docker Desktop aktif dengan integrasi WSL / Linux terminal.
- Pastikan stack utama telah berjalan:
  ```bash
  docker compose up -d
  ```

### Menjalankan Skrip Autoscaler
Dari direktori root proyek di terminal WSL atau Git Bash:
```bash
# Berikan izin eksekusi
chmod +x scripts/*.sh

# Jalankan dengan parameter default
./scripts/autoscale.sh
```

### Menjalankan dengan Parameter Kustom
```bash
MIN=2 MAX=5 UP=70 DOWN=25 INTERVAL=5 COOLDOWN=30 ./scripts/autoscale.sh
```

---

## 4. Cara Membaca `autoscale.log`

Setiap siklus pemeriksaan CPU mencatat satu baris baru ke file `autoscale.log` dalam format CSV:

```csv
timestamp,replicas,avg_cpu_pct_of_limit,action
2026-11-02 02:10:00,1,12.4,hold
2026-11-02 02:10:10,1,78.2,scale_out
2026-11-02 02:10:50,2,44.1,hold
2026-11-02 02:11:00,2,15.8,scale_in
```

### Kolom Log:
1. **`timestamp`**: Waktu pemeriksaan (format `YYYY-MM-DD HH:MM:SS`).
2. **`replicas`**: Jumlah container replika backend yang aktif pada saat itu.
3. **`avg_cpu_pct_of_limit`**: Rata-rata utilisasi CPU container relatif terhadap limit container (%).
4. **`action`**: Aksi yang diambil oleh autoscaler:
   - `hold`: Beban CPU berada dalam rentang normal (`DOWN <= CPU <= UP`) atau masih dalam periode `COOLDOWN`.
   - `scale_out`: CPU melebihi ambang batas `UP` dan replika belum mencapai `MAX`. Jumlah replika dinaikkan 1.
   - `scale_in`: CPU di bawah ambang batas `DOWN` dan replika belum mencapai `MIN`. Jumlah replika diturunkan 1.

Anda dapat memantau log secara real-time dengan perintah:
```bash
tail -f autoscale.log
```

---

## 5. Pengujian Load Balancing

Untuk memverifikasi bahwa Nginx berhasil mendistribusikan beban ke seluruh replika backend yang sedang aktif, jalankan skrip demo:

```bash
chmod +x scripts/demo_loadbalancing.sh
./scripts/demo_loadbalancing.sh
```

Skrip ini akan mengirimkan 30 request berturut-turut ke endpoint `http://localhost:8080/api/health` dan membaca field `instance` (berisi hostname / Container ID) yang dikembalikan oleh FastAPI.

Contoh output pengujian ketika backend diskalakan ke 3 replika:
```text
============================================================
 TeleMed - Pengujian Load Balancing (Round-Robin via Nginx)
 Target   : http://localhost:8080/api/health
 Requests : 30
============================================================

Mengirim 30 request: .............................. Selesai!

--- Distribusi Trafik Per Instance Backend ---
Container Instance ID     | Jumlah Hit | Persentase
--------------------------+------------+------------
0a1b2c3d4e5f              | 10         | 33.3%     
1b2c3d4e5f6a              | 10         | 33.3%     
2c3d4e5f6a1b              | 10         | 33.3%     
--------------------------+------------+------------
TOTAL                     | 30         | 100.0%    

✅ STATUS: Load balancing BERHASIL aktif! (3 instance berbeda merespons secara bergantian).
```

---

## 6. Keterbatasan Kejujuran Sistem (Honest Limitations)

1. **Reaktif, Bukan Prediktif**:
   Autoscaler berbasis ambang batas CPU hanya bereaksi *setelah* beban CPU melampaui batas (`UP > 60%`). Sistem tidak memiliki algoritma *predictive scaling* (misalnya machine learning atau analisis tren beban) sehingga pada lonjakan mendadak (*traffic spike*), beberapa request awal mungkin mengalami kenaikan latensi sebelum replika baru siap melayani.
2. **Latensi Scale-Out (~10–20 Detik)**:
   Proses scale-out membutuhkan waktu untuk membuat container baru, menjalankan runtime Python, inisialisasi connection pool asyncpg, dan melewati masa start-period healthcheck Docker sebelum Nginx memasukkan container baru ke pool routing DNS.
3. **Autoscaler Berjalan di Host/WSL (Bukan di Cluster Orchestration Engine)**:
   Skrip `autoscale.sh` dieksekusi di level host/laptop dan bukan agen bawaan Docker daemon. Jika terminal atau host tertutup, autoscaling otomatis terhenti (meskipun container yang sudah ada tetap berjalan).
4. **Batasan Fisik Hardware Host (Laptop)**:
   Meskipun backend dapat di-scale hingga 5 replika, seluruh container tersebut tetap berbagi inti CPU fisik dan memori RAM yang sama pada laptop pengembang. Penskalaan horizontal pada single node memberikan keuntungan isolasi konkurensi Uvicorn, namun tidak menambah kapasitas komputasi fisik total mesin.

---

## 7. Mengapa Tidak Menggunakan Kubernetes HPA?

Keputusan untuk menggunakan **Docker Compose + Nginx Dynamic DNS Resolver + Shell Autoscaler** dibandingkan **Kubernetes Horizontal Pod Autoscaler (HPA)** didasarkan pada pertimbangan rekayasa berikut:

1. **Overhead Sumber Daya Ringan**:
   Kubernetes memerlukan komponen *control plane* (API Server, etcd, controller-manager, scheduler, kubelet, kube-proxy, dan metrics-server) yang menghabiskan 1.5–3 GB RAM hanya untuk sistem dasar. Pada lingkungan laptop/pengembangan lokal, overhead ini memakan sumber daya yang seharusnya dialokasikan untuk database dan aplikasi medis.
2. **Prinsip Kesederhanaan & *Occam's Razor***:
   Arsitektur TeleMed Kelompok 4 dirancang agar dapat dijalankan dan dievaluasi secara instan oleh siapa saja menggunakan satu perintah `docker compose up -d` tanpa memerlukan instalasi Minikube, Kind, kubectl, Helm, atau konfigurasi Ingress Controller yang rumit.
3. **Transparansi Mekanisme**:
   Dengan skrip `autoscale.sh` dan konfigurasi Nginx resolver `127.0.0.11`, setiap langkah evaluasi metrik, normalisasi CPU limit, dan distribusi IP round-robin terlihat jelas baris demi baris, sehingga memudahkan proses audit akademik dan pembelajaran arsitektur sistem terdistribusi.
