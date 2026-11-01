// ============================================================
// TeleMed - Stress Test (Pertemuan 3) - k6
// Jalankan per level: VUS=10, 100, 500, 1000
// Lihat run_stress.ps1 untuk cara menjalankan.
// ============================================================
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://frontend';
const VUS = parseInt(__ENV.VUS || '10');
const RAMP = __ENV.RAMP || '30s';
const HOLD = __ENV.HOLD || '1m';
const TAG = __ENV.TAG || 'run';
const PASSWORD = __ENV.SEED_PASSWORD || 'medisync2026';
const THINK = parseFloat(__ENV.THINK || '0.5');   // detik, jeda antar request

const errorRate = new Rate('app_error_rate');
const readLatency = new Trend('read_latency', true);
const writeLatency = new Trend('write_latency', true);
const loginLatency = new Trend('login_latency', true);
const served = new Counter('served_by_instance');

export const options = {
  stages: [
    { duration: RAMP, target: VUS },   // naik bertahap
    { duration: HOLD, target: VUS },   // tahan di beban puncak
    { duration: '10s', target: 0 },    // turun
  ],
  // Threshold HANYA penanda lulus/gagal. Tidak ada abortOnFail
  // supaya titik gagal tetap tercatat sampai tes selesai.
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
    app_error_rate: ['rate<0.05'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const USERS = {
  pasien: { username: 'budi@email.com', password: PASSWORD },
  dokter: { username: 'dr.andi@medisync.id', password: PASSWORD },
  admin: { username: 'admin@medisync.id', password: PASSWORD },
};

function login(u) {
  const res = http.post(`${BASE_URL}/api/auth/login`,
    JSON.stringify(u), { headers: { 'Content-Type': 'application/json' } });
  loginLatency.add(res.timings.duration);
  if (res.status !== 200) return null;
  return res.json('token');
}

// Login SEKALI di setup (bcrypt itu mahal, jangan ikut mengukur login 1000x kecuali sengaja)
export function setup() {
  const tokens = {};
  for (const [role, cred] of Object.entries(USERS)) {
    tokens[role] = login(cred);
    if (!tokens[role]) throw new Error(`Setup gagal: login ${role} ditolak. Seed sudah jalan?`);
  }
  return tokens;
}

function auth(token) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
}

function get(path, token, name) {
  const res = http.get(`${BASE_URL}${path}`, { ...auth(token), tags: { name } });
  readLatency.add(res.timings.duration);
  const ok = check(res, { [`${name} 200`]: (r) => r.status === 200 });
  errorRate.add(!ok);
  return res;
}

export default function (tokens) {
  const roll = Math.random();

  // 1) health + hitung instance backend yang melayani (bukti load balancing)
  const h = http.get(`${BASE_URL}/api/health`, { tags: { name: 'health' } });
  check(h, { 'health 200': (r) => r.status === 200 });
  errorRate.add(h.status !== 200);
  if (h.status === 200) {
    const inst = h.json('instance');
    if (inst) served.add(1, { instance: inst });
  }

  if (roll < 0.45) {
    // Pasien: lihat jadwal & rekam medis miliknya
    get('/api/consultations', tokens.pasien, 'pasien_consultations');
    get('/api/medical-records', tokens.pasien, 'pasien_records');
  } else if (roll < 0.80) {
    // Dokter: lihat antrean & rekam medis
    get('/api/consultations', tokens.dokter, 'dokter_consultations');
    get('/api/medical-records', tokens.dokter, 'dokter_records');
  } else if (roll < 0.90) {
    // Admin: audit log (query paling berat: tabel besar + ORDER BY)
    get('/api/audit-logs?limit=100', tokens.admin, 'admin_audit');
  } else if (roll < 0.97) {
    // Frontend statis lewat nginx
    const r = http.get(`${BASE_URL}/`, { tags: { name: 'static_index' } });
    errorRate.add(!check(r, { 'index 200': (x) => x.status === 200 }));
  } else {
    // WRITE: booking konsultasi (menulis ke PostgreSQL)
    const body = JSON.stringify({
      doctor_id: 1,
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      type: 'Video Telekonsultasi',
      complaint: 'k6 load test',
    });
    const res = http.post(`${BASE_URL}/api/consultations`, body,
      { ...auth(tokens.pasien), tags: { name: 'pasien_booking' } });
    writeLatency.add(res.timings.duration);
    errorRate.add(!check(res, { 'booking 201': (r) => r.status === 201 }));
  }

  sleep(THINK * (0.5 + Math.random()));
}

export function handleSummary(data) {
  const out = { stdout: textSummary(data, { indent: ' ', enableColors: false }) };
  out[`/k6/results/summary_${TAG}_${VUS}vu.json`] = JSON.stringify(data, null, 2);
  return out;
}
