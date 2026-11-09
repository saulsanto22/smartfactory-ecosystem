/**
 * ============================================================================
 * MODUL 3: INCIDENT ALERT GATEWAY (Express.js - Port 8083)
 * ============================================================================
 * Filosofi Bisnis Pabrik:
 * Bertindak sebagai "Pos Satpam / Papan Sirine Pusat".
 * Modul Gudang (Golang) dan Modul Mesin (NestJS) akan menembak ke server ini
 * setiap kali terjadi kondisi darurat (Stok Kritis atau OEE Mesin Anjlok).
 *
 * Jembatan Logika Laravel:
 * - File `server.js` ini adalah gabungan antara `public/index.php` (titik masuk),
 *   `app/Http/Kernel.php` (konfigurasi middleware global), dan `routes/api.php`.
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8083;

// ----------------------------------------------------------------------------
// 1. GLOBAL MIDDLEWARE
// Jembatan Laravel:
// - `cors()` = sepadan dengan `config/cors.php` (HandleCors middleware) agar
//   nantinya Frontend Angular (Port 4200) diizinkan menembak API ini.
// - `express.json()` = sepadan dengan fitur otomatis Laravel saat membaca
//   `$request->all()` dari body JSON. Tanpa baris ini, Express tidak bisa
//   membaca body JSON yang dikirim oleh Golang atau NestJS!
// ----------------------------------------------------------------------------
app.use(cors());
app.use(express.json());

// ----------------------------------------------------------------------------
// 2. PENYIMPANAN DATA INSIDEN (In-Memory Store untuk Kecepatan Tinggi)
// Filosofi Pabrik:
// Papan sirine membutuhkan baca-tulis super cepat (RAM) tanpa membebani I/O disk.
// Kita siapkan 1 data contoh (Seeder awal) agar saat dites langsung terlihat bentuknya.
// ----------------------------------------------------------------------------
let incidents = [
  {
    id: 1,
    source: 'SYSTEM',          // Asal laporan: 'WAREHOUSE' | 'PRODUCTION' | 'SYSTEM'
    severity: 'INFO',          // Tingkat bahaya: 'INFO' | 'WARNING' | 'CRITICAL'
    message: 'Sistem Papan Sirine SmartFactory aktif dan siap menerima laporan.',
    is_resolved: false,        // Status: false = Alarm Menyala, true = Sudah Ditangani
    resolved_by: null,         // Nama teknisi yang menyelesaikan
    resolved_at: null,         // Waktu diselesaikan
    created_at: new Date().toISOString()
  }
];

// Counter Auto-Increment ID (sepadan dengan AUTO_INCREMENT di MySQL)
let nextIncidentId = 2;

// ----------------------------------------------------------------------------
// 3. ENDPOINT CEK KESEHATAN SERVER (Healthcheck)
// ----------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  // Jembatan Laravel: sepadan dengan `return response()->json([...], 200);`
  return res.status(200).json({
    service: 'incident-gateway',
    status: 'UP',
    active_incidents_count: incidents.filter(item => !item.is_resolved).length
  });
});

// ----------------------------------------------------------------------------
// 4. [FEAT-1.2] TAMPILKAN DAFTAR ALARM (GET /api/incidents)
// Jembatan Laravel:
// - `req.query.status` sepadan dengan `$request->query('status')` di Controller.
// - Kita urutkan dari ID terbesar ke terkecil (`b.id - a.id`), sepadan dengan
//   `Incident::orderBy('id', 'desc')->get()` di Eloquent.
// ----------------------------------------------------------------------------
app.get('/api/incidents', (req, res) => {
  const { status } = req.query; // Opsional: ?status=OPEN atau ?status=RESOLVED

  let result = [...incidents].sort((a, b) => b.id - a.id);

  if (status === 'OPEN') {
    result = result.filter(item => item.is_resolved === false);
  } else if (status === 'RESOLVED') {
    result = result.filter(item => item.is_resolved === true);
  }

  return res.status(200).json({
    success: true,
    total: result.length,
    active_count: incidents.filter(item => !item.is_resolved).length,
    data: result
  });
});

// ----------------------------------------------------------------------------
// 5. [FEAT-1.1] TERIMA LAPORAN INSIDEN BARU (POST /api/incidents)
// Filosofi Pabrik:
// Endpoint ini yang akan ditembak otomatis di belakang layar oleh:
// - Golang (Port 8081) saat `stock < min_stock`
// - NestJS (Port 8082) saat `oee_score < 65%`
//
// Jembatan Laravel:
// - `const { source, severity, message } = req.body` sepadan dengan
//   `$request->only(['source', 'severity', 'message'])`.
// - Pengecekan `if (!source || !message)` sepadan dengan `$request->validate(...)`.
// ----------------------------------------------------------------------------
app.post('/api/incidents', (req, res) => {
  const { source, severity, message } = req.body;

  // Validasi input wajib (HTTP 422 Unprocessable Entity / 400 Bad Request)
  if (!source || !message) {
    return res.status(400).json({
      success: false,
      message: 'Field "source" (asal modul) dan "message" (pesan bahaya) wajib diisi!'
    });
  }

  const newIncident = {
    id: nextIncidentId++,
    source: String(source).toUpperCase(),              // contoh: 'WAREHOUSE' atau 'PRODUCTION'
    severity: String(severity || 'CRITICAL').toUpperCase(), // default 'CRITICAL'
    message: String(message),
    is_resolved: false,
    resolved_by: null,
    resolved_at: null,
    created_at: new Date().toISOString()
  };

  incidents.push(newIncident);

  console.log(`🔔 [ALARM BARU - ${newIncident.source}] (${newIncident.severity}): ${newIncident.message}`);

  // HTTP 201 Created (persis seperti saat Eloquent Model::create() berhasil di Laravel)
  return res.status(201).json({
    success: true,
    message: 'Alarm insiden berhasil dicatat dan disiarkan ke dashboard.',
    data: newIncident
  });
});

// ----------------------------------------------------------------------------
// 6. [FEAT-1.3] TANDAI INSIDEN SELESAI / RESOLVE (PATCH /api/incidents/:id/resolve)
// Filosofi Pabrik:
// Saat teknisi selesai memperbaiki mesin atau staf gudang sudah mengisi stok,
// mereka menekan tombol "Resolve" di layar monitor untuk mematikan sirine.
//
// Jembatan Laravel:
// - `:id` di Express sama dengan `{id}` di `Route::patch('/incidents/{id}/resolve')`.
// - PENTING (Jebakan Tipe Data JS vs PHP):
//   Di PHP, `"1" == 1` bernilai true (loose comparison). Di JavaScript modern,
//   kita wajib memakai `===` (strict comparison), dan `req.params.id` selalu
//   berupa String. Jadi wajib diubah ke Integer memakai `parseInt(req.params.id, 10)`.
// ----------------------------------------------------------------------------
app.patch('/api/incidents/:id/resolve', (req, res) => {
  const incidentId = parseInt(req.params.id, 10);
  const { resolved_by } = req.body || {};

  // Cari data di array (sepadan dengan `Incident::find($id)` di Laravel)
  const incident = incidents.find(item => item.id === incidentId);

  if (!incident) {
    return res.status(404).json({
      success: false,
      message: `Insiden dengan ID #${incidentId} tidak ditemukan.`
    });
  }

  incident.is_resolved = true;
  incident.resolved_by = resolved_by || 'Teknisi Maintenance';
  incident.resolved_at = new Date().toISOString();

  console.log(`✅ [RESOLVED] Insiden #${incident.id} telah diselesaikan oleh ${incident.resolved_by}`);

  return res.status(200).json({
    success: true,
    message: `Insiden #${incident.id} berhasil ditandai selesai.`,
    data: incident
  });
});

// ----------------------------------------------------------------------------
// 7. MENJALANKAN SERVER (Sepadan dengan `php artisan serve --port=8083`)
// ----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚨 [Incident Gateway] Pos Alarm Pabrik menyala di http://localhost:${PORT}`);
});
