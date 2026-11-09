/**
 * ============================================================================
 * MODUL 3: INCIDENT ALERT GATEWAY & JWT RBAC AUTH (Express.js - Port 8083)
 * ============================================================================
 * Filosofi Bisnis Pabrik:
 * 1. Bertindak sebagai "Pos Satpam / Papan Sirine Pusat".
 * 2. Sekaligus menjadi "Loket Penerbit Kartu ID Pabrik" (Stateless JWT Token)
 *    untuk ke-4 jabatan (PLANT_MANAGER, WAREHOUSE_STAFF, PRODUCTION_OPERATOR,
 *    MAINTENANCE_TECH).
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8083;

// Kunci rahasia bersama (Shared JWT Secret) yang sama di Express, Golang, & NestJS
// Jembatan Laravel: Sepadan dengan `APP_KEY` atau `JWT_SECRET` di file `.env`
const JWT_SECRET = process.env.JWT_SECRET || 'smartfactory-super-secret-key-2026';

app.use(cors());
app.use(express.json());

// ----------------------------------------------------------------------------
// FUNGSI PEMBUAT & PEMBACA TOKEN JWT (HMAC-SHA256)
// Jembatan Laravel:
// Di microservices, setiap backend bisa memverifikasi tanda tangan kriptografi
// token JWT ini secara mandiri tanpa perlu query ke tabel `users`!
// ----------------------------------------------------------------------------
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generateJwtToken(payload) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400, // Berlaku 24 jam
    }),
  );
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${header}.${body}.${signature}`;
}

function verifyJwtToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (signature !== expectedSig) return null;

  try {
    const decoded = JSON.parse(Buffer.from(body, 'base64').toString('utf8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// [FEAT-5.1] MIDDLEWARE PENGECEK ROLE JABATAN DI EXPRESS.JS
// Jembatan Laravel: Sepadan dengan `->middleware('role:MAINTENANCE_TECH,PLANT_MANAGER')`
// ----------------------------------------------------------------------------
function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    let userRole = req.headers['x-user-role'];
    let userName = req.headers['x-user-name'] || 'User';

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const claims = verifyJwtToken(token);
      if (!claims) {
        return res.status(401).json({
          success: false,
          message: 'Token JWT tidak valid atau sudah kedaluwarsa (401 Unauthorized)!',
        });
      }
      userRole = claims.role;
      userName = claims.name;
    }

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Akses Ditolak (403 Forbidden)! Jabatan Anda (${userRole || 'GUEST'}) tidak diizinkan mengakses fitur ini. Hanya untuk: ${allowedRoles.join(' / ')}.`,
      });
    }

    req.user = { name: userName, role: userRole };
    next();
  };
}

// ----------------------------------------------------------------------------
// PENYIMPANAN DATA INSIDEN (In-Memory Store)
// ----------------------------------------------------------------------------
let incidents = [
  {
    id: 1,
    source: 'SYSTEM',
    severity: 'INFO',
    message: 'Sistem Papan Sirine SmartFactory aktif dan siap menerima laporan.',
    is_resolved: false,
    resolved_by: null,
    resolved_at: null,
    created_at: new Date().toISOString(),
  },
];

let nextIncidentId = 2;

// ----------------------------------------------------------------------------
// ENDPOINT CEK KESEHATAN SERVER
// ----------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  return res.status(200).json({
    service: 'incident-gateway',
    status: 'UP',
    active_incidents_count: incidents.filter((item) => !item.is_resolved).length,
  });
});

// ----------------------------------------------------------------------------
// [FEAT-5.1] ENDPOINT PENERBIT TOKEN JWT UNTUK ROLE SWITCHER (POST /api/auth/token)
// ----------------------------------------------------------------------------
app.post('/api/auth/token', (req, res) => {
  const { name, role } = req.body || {};
  const validRoles = [
    'PLANT_MANAGER',
    'WAREHOUSE_STAFF',
    'PRODUCTION_OPERATOR',
    'MAINTENANCE_TECH',
  ];

  const selectedRole = validRoles.includes(role) ? role : 'PLANT_MANAGER';
  const selectedName = name || 'Staff SmartFactory';

  const token = generateJwtToken({
    name: selectedName,
    role: selectedRole,
  });

  return res.status(200).json({
    success: true,
    role: selectedRole,
    name: selectedName,
    token,
  });
});

// ----------------------------------------------------------------------------
// [FEAT-1.2] TAMPILKAN DAFTAR ALARM (GET /api/incidents) - Bebas dilihat semua role
// ----------------------------------------------------------------------------
app.get('/api/incidents', (req, res) => {
  const { status } = req.query;

  let result = [...incidents].sort((a, b) => b.id - a.id);

  if (status === 'OPEN') {
    result = result.filter((item) => item.is_resolved === false);
  } else if (status === 'RESOLVED') {
    result = result.filter((item) => item.is_resolved === true);
  }

  return res.status(200).json({
    success: true,
    total: result.length,
    active_count: incidents.filter((item) => !item.is_resolved).length,
    data: result,
  });
});

// ----------------------------------------------------------------------------
// [FEAT-1.1] TERIMA LAPORAN INSIDEN BARU (POST /api/incidents)
// Ditembak otomatis oleh Golang (Port 8081) atau NestJS (Port 8082)
// ----------------------------------------------------------------------------
app.post('/api/incidents', (req, res) => {
  const { source, severity, message } = req.body;

  if (!source || !message) {
    return res.status(400).json({
      success: false,
      message: 'Field "source" (asal modul) dan "message" (pesan bahaya) wajib diisi!',
    });
  }

  const newIncident = {
    id: nextIncidentId++,
    source: String(source).toUpperCase(),
    severity: String(severity || 'CRITICAL').toUpperCase(),
    message: String(message),
    is_resolved: false,
    resolved_by: null,
    resolved_at: null,
    created_at: new Date().toISOString(),
  };

  incidents.push(newIncident);

  console.log(
    `🔔 [ALARM BARU - ${newIncident.source}] (${newIncident.severity}): ${newIncident.message}`,
  );

  return res.status(201).json({
    success: true,
    message: 'Alarm insiden berhasil dicatat dan disiarkan ke dashboard.',
    data: newIncident,
  });
});

// ----------------------------------------------------------------------------
// [FEAT-1.3 & FEAT-5.2] TANDAI INSIDEN SELESAI (PATCH /api/incidents/:id/resolve)
// DIKUNCI DENGAN RBAC: Hanya boleh diakses oleh MAINTENANCE_TECH atau PLANT_MANAGER!
// ----------------------------------------------------------------------------
app.patch(
  '/api/incidents/:id/resolve',
  requireRoles('MAINTENANCE_TECH', 'PLANT_MANAGER'),
  (req, res) => {
    const incidentId = parseInt(req.params.id, 10);
    const { resolved_by } = req.body || {};

    const incident = incidents.find((item) => item.id === incidentId);

    if (!incident) {
      return res.status(404).json({
        success: false,
        message: `Insiden dengan ID #${incidentId} tidak ditemukan.`,
      });
    }

    incident.is_resolved = true;
    incident.resolved_by = resolved_by || req.user?.name || 'Teknisi Maintenance';
    incident.resolved_at = new Date().toISOString();

    console.log(
      `✅ [RESOLVED] Insiden #${incident.id} telah diselesaikan oleh ${incident.resolved_by}`,
    );

    return res.status(200).json({
      success: true,
      message: `Insiden #${incident.id} berhasil ditandai selesai oleh ${incident.resolved_by}.`,
      data: incident,
    });
  },
);

app.listen(PORT, () => {
  console.log(`🚨 [Incident Gateway] Pos Alarm Pabrik menyala di http://localhost:${PORT}`);
});
