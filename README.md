# 🏭 SmartFactory Ecosystem — Polyglot Microservices (MES & Andon System)

![CI/CD Pipeline](https://github.com/saulsanto22/smartfactory-ecosystem/actions/workflows/ci-cd.yml/badge.svg)

Ekosistem **Manufacturing Execution System (MES) Lite & Real-Time Andon Board** berbasis arsitektur **Polyglot Microservices** untuk mendigitalisasi operasional lantai pabrik (*Shop Floor*): pemantauan stok gudang kritis, kalkulasi efisiensi mesin (**OEE - Overall Equipment Effectiveness**), pelaporan dokumen audit **PDF**, unggah bukti fisik (*Single & Multiple File Upload*), serta pengamanan hak akses lintas layanan (**Stateless JWT RBAC**).

---

## 🏗️ Arsitektur Sistem & Alasan Pemilihan Teknologi

```text
  [ OPERATOR & MANAGER DASHBOARD — Angular Standalone + Tailwind CSS (:4200) ]
            |                             |                             |
            | 1. Mutasi Stok / Single     | 2. Kalkulasi OEE / Multi    | 3. Monitor & Resolve
            |    Upload & Cetak PDF       |    Upload & Cetak PDF       |    Sirine Insiden
            v                             v                             v
  +-----------------------+     +-----------------------+     +-----------------------+
  |   WAREHOUSE SERVICE   |     |      OEE SERVICE      |     |   INCIDENT GATEWAY    |
  |  Golang + Gin (:8081) |     | NestJS + TS (:8082)   |     |  Express.js (:8083)   |
  +-----------------------+     +-----------------------+     +-----------------------+
            |                             |                             ^
            |  Auto-Webhook (Goroutine)   |  Auto-Webhook (Async Fetch) |
            |  jika Stock < MinStock      |  jika OEE < 65%             |
            +-----------------------------+-----------------------------+
```

| Service | Port | Tech Stack | Tanggung Jawab Bisnis & Studi Kasus Teknis |
| :--- | :--- | :--- | :--- |
| **`warehouse-service`** | `8081` | **Golang** (Gin + GORM + `gofpdf`) | Menangani transaksi *barcode scanner* Gudang (`IN`/`OUT`) berkecepatan tinggi, **Single File Upload** (Foto Barang/Surat Jalan), **Cetak PDF Cepat (`gofpdf`)**, dan memicu webhook via **Goroutine** saat stok menyentuh batas kritis (`stock < min_stock`). |
| **`oee-service`** | `8082` | **NestJS** (TypeScript + TypeORM + `Multer` + `PDFKit`) | Menghitung rumus **OEE** ($\text{Availability} \times \text{Performance} \times \text{Quality}$), menangani **Multiple File Upload** (`photos[]` maks 5 foto bukti *reject*/kerusakan), **Streaming PDF Audit (`PDFKit`)**, dan memicu alarm otomatis jika `OEE < 65%`. |
| **`incident-gateway`** | `8083` | **Express.js** (Node.js + `crypto` HMAC-SHA256) | Gerbang penerima alarm darurat (*Andon Hub*) *non-blocking* sekaligus penerbit token **Stateless JWT RBAC** untuk 4 jabatan pabrik. |
| **`operator-dashboard`** | `4200` | **Angular 18** (Standalone + Tailwind CSS) | Layar kendali terpusat (*Control Room*) untuk memantau sirine insiden, mutasi stok gudang, rapor OEE mesin, unggah file, unduh PDF, dan simulasi pergantian 4 jabatan (*Role Switcher*). |
| **`mysql-db`** | `3307` *(Host)*<br>`3306` *(Docker)* | **MySQL 8.0** | Penyimpanan relasional persisten untuk data inventori gudang (`materials`) dan riwayat produksi mesin (`production_logs`). |

---

## 🔐 Matriks Hak Akses Jabatan (Stateless JWT RBAC)

Setiap request perubahan data diverifikasi menggunakan tanda tangan **JWT HMAC-SHA256** (`Authorization: Bearer <token>`) pada masing-masing backend:

| Role Jabatan | Gudang (`Golang :8081`)<br>Tambah & Mutasi Stok | Produksi (`NestJS :8082`)<br>Hitung OEE & Multi-Upload | Alarm (`Express :8083`)<br>Resolve Insiden | Lihat Data & Unduh PDF |
| :--- | :---: | :---: | :---: | :---: |
| **`PLANT_MANAGER`** | ✅ Diizinkan | ✅ Diizinkan | ✅ Diizinkan | ✅ Diizinkan |
| **`WAREHOUSE_STAFF`** | ✅ Diizinkan | ❌ `403 Forbidden` | ❌ `403 Forbidden` | ✅ Diizinkan |
| **`PRODUCTION_OPERATOR`** | ❌ `403 Forbidden` | ✅ Diizinkan | ❌ `403 Forbidden` | ✅ Diizinkan |
| **`MAINTENANCE_TECH`** | ❌ `403 Forbidden` | ❌ `403 Forbidden` | ✅ Diizinkan | ✅ Diizinkan |

---

## 🚀 Cara Menjalankan Seluruh Ekosistem

### Opsi 1: Menjalankan Serentak dengan Docker Compose (1 Perintah)
Pastikan Docker Desktop / Docker Engine menyala, lalu jalankan dari root folder proyek:

```bash
docker compose up --build
```

### Opsi 2: Menjalankan untuk Pengembangan Lokal (Per Modul)
1. **Nyalakan Database MySQL via Docker:**
   ```bash
   docker compose up -d mysql-db
   ```
2. **Nyalakan Modul 3 — Incident Gateway (`Port 8083`):**
   ```bash
   cd incident-gateway && npm run dev
   ```
3. **Nyalakan Modul 1 — Warehouse Service (`Port 8081`):**
   ```bash
   cd warehouse-service && go run main.go
   ```
4. **Nyalakan Modul 2 — OEE Service (`Port 8082`):**
   ```bash
   cd oee-service && npm run dev
   ```
5. **Nyalakan Modul 4 — Operator Dashboard (`Port 4200`):**
   ```bash
   cd operator-dashboard && npm start
   ```
   Buka browser di **`http://localhost:4200`**.

---

## 📡 Ringkasan Endpoint API Utama

### 1. Warehouse Service (`Golang` — `http://localhost:8081`)
- `GET /api/materials` — Daftar stok bahan baku gudang.
- `POST /api/materials` — Registrasi barang baru + **Single File Upload** (`multipart/form-data`, field `image`).
- `POST /api/materials/mutate` — Mutasi stok `IN` / `OUT` (otomatis menembak alarm jika `stock < min_stock`).
- `GET /api/materials/export/pdf` — **Download PDF** Laporan Stok & Status Bahan Baku Gudang (`gofpdf`).

### 2. OEE Service (`NestJS` — `http://localhost:8082`)
- `GET /api/oee` — Riwayat hasil kalkulasi OEE seluruh mesin.
- `POST /api/oee/calculate` — Kalkulasi OEE + **Multiple File Upload** (`multipart/form-data`, field `photos[]` maks 5 file).
- `GET /api/oee/export/pdf` — **Download PDF** Rapor Audit Efisiensi Mesin (`PDFKit` Stream).

### 3. Incident Gateway (`Express.js` — `http://localhost:8083`)
- `POST /api/auth/token` — Penerbit token JWT untuk simulasi 4 jabatan RBAC.
- `GET /api/incidents` — Daftar alarm insiden pabrik (`OPEN` & `RESOLVED`).
- `POST /api/incidents` — Endpoint webhook penerima alarm otomatis dari Golang & NestJS.
- `PATCH /api/incidents/:id/resolve` — Menandai insiden selesai ditangani teknisi.

---

## 🔄 Arsitektur CI/CD Pipeline (GitHub Actions)

Repositori ini dilengkapi pipeline otomatis di [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) yang berjalan setiap kali ada `push` atau `pull_request` ke branch `main`:

1. **4 Parallel CI Jobs (Uji Kompilasi Serentak):**
   - `ci-incident-gateway` — Menguji dependensi & sintaks **Express.js**.
   - `ci-warehouse-service` — Menjalankan *static analysis* (`go vet`) & kompilasi binary **Golang**.
   - `ci-oee-service` — Menguji kompilasi TypeScript & Decorator **NestJS** (`tsc`).
   - `ci-operator-dashboard` — Menguji *production build* **Angular 18 Standalone**.
2. **1 Gatekeeper CD Job (`cd-docker-delivery`):**
   - Hanya berjalan apabila ke-4 job CI di atas lulus (`needs: [...]`), bertugas memvalidasi skema `docker-compose.yml` dan membangun seluruh *Docker Image* kontainer pabrik.

