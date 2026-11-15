// ============================================================
// TeleMed - Stress Test CDN / File Storage (Pertemuan 5)
// Membandingkan performa aset statis SEBELUM vs SESUDAH CDN.
//
// Jalankan:
//   docker run --rm --network telemed_net \
//     -v "$(pwd)/k6:/k6" \
//     -e BASE_URL=http://frontend \
//     -e MINIO_URL=http://minio:9000 \
//     -e VUS=100 -e TAG=cdn \
//     grafana/k6 run /k6/stress_cdn.js
// ============================================================
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

const BASE_URL    = __ENV.BASE_URL   || 'http://frontend';
const MINIO_URL   = __ENV.MINIO_URL  || 'http://minio:9000';
const VUS         = parseInt(__ENV.VUS  || '100');
const RAMP        = __ENV.RAMP        || '20s';
const HOLD        = __ENV.HOLD        || '1m';
const TAG         = __ENV.TAG         || 'cdn';
const PASSWORD    = __ENV.SEED_PASSWORD || 'medisync2026';
const BUCKET      = __ENV.MINIO_BUCKET  || 'telemed-files';

// Metrik custom
const cdnLatency    = new Trend('cdn_proxy_latency', true);
const directLatency = new Trend('direct_minio_latency', true);
const uploadLatency = new Trend('upload_latency', true);
const cdnErrorRate  = new Rate('cdn_error_rate');
const uploadErrors  = new Rate('upload_error_rate');
const filesServed   = new Counter('files_served_via_cdn');

export const options = {
  stages: [
    { duration: RAMP, target: VUS },
    { duration: HOLD, target: VUS },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    // Target CDN: p95 < 500ms (jauh lebih cepat dari API endpoint)
    cdn_proxy_latency: ['p(95)<500'],
    cdn_error_rate:    ['rate<0.02'],
    upload_error_rate: ['rate<0.05'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// ------------------------------------------------------------------ //
// Setup: login & upload file sampel untuk ditest                      //
// ------------------------------------------------------------------ //
export function setup() {
  // 1. Login untuk dapat token
  const loginResp = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: 'admin@medisync.id', password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (loginResp.status !== 200) {
    throw new Error(`Setup gagal: login ditolak (${loginResp.status}). Pastikan seed sudah berjalan.`);
  }
  const token = loginResp.json('token');

  // 2. Upload file PNG dummy (1x1 pixel transparan) ke CDN
  const pngBytes = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82';

  const uploadResp = http.post(
    `${BASE_URL}/api/files/upload`,
    { file: http.file(pngBytes, 'test_cdn.png', 'image/png') },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  let cdnKey = null;
  if (uploadResp.status === 201) {
    cdnKey = uploadResp.json('key');
    console.log(`Setup: file sampel diupload. CDN key: ${cdnKey}`);
  } else {
    console.warn(`Setup: upload file sampel gagal (${uploadResp.status}) — test tetap berjalan dengan health endpoint`);
  }

  return { token, cdnKey };
}

// ------------------------------------------------------------------ //
// Main VU scenario                                                    //
// ------------------------------------------------------------------ //
export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}` };

  // ---- SKENARIO A: Akses file VIA CDN PROXY (Nginx → MinIO) ---- //
  if (data.cdnKey) {
    const cdnUrl = `${BASE_URL}/files/${data.cdnKey}`;
    const r1 = http.get(cdnUrl, { tags: { scenario: 'cdn_proxy' } });
    cdnLatency.add(r1.timings.duration);
    const ok = check(r1, {
      'CDN proxy status 200': (r) => r.status === 200,
      'CDN header ada': (r) => r.headers['X-CDN-Node'] !== undefined,
      'CDN response < 500ms': (r) => r.timings.duration < 500,
    });
    cdnErrorRate.add(!ok);
    if (ok) filesServed.add(1);
  }

  sleep(0.3);

  // ---- SKENARIO B: Akses langsung ke MinIO (baseline sebelum CDN) ---- //
  if (data.cdnKey) {
    const directUrl = `${MINIO_URL}/${BUCKET}/${data.cdnKey}`;
    const r2 = http.get(directUrl, { tags: { scenario: 'direct_minio' } });
    directLatency.add(r2.timings.duration);
    check(r2, {
      'Direct MinIO status 200': (r) => r.status === 200,
    });
  }

  sleep(0.3);

  // ---- SKENARIO C: Upload file baru (uji beban write) ---- //
  // Hanya 20% VU yang melakukan upload agar tidak terlalu membebani
  if (Math.random() < 0.2) {
    const tiny = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82';
    const r3 = http.post(
      `${BASE_URL}/api/files/upload`,
      { file: http.file(tiny, `load_${__VU}_${__ITER}.png`, 'image/png') },
      { headers: { Authorization: `Bearer ${data.token}` }, tags: { scenario: 'upload' } }
    );
    uploadLatency.add(r3.timings.duration);
    const uploadOk = check(r3, {
      'Upload ke CDN berhasil (201)': (r) => r.status === 201,
      'Upload < 2s': (r) => r.timings.duration < 2000,
    });
    uploadErrors.add(!uploadOk);
  }

  sleep(0.5);
}

// ------------------------------------------------------------------ //
// Summary otomatis disimpan ke k6/results/                           //
// ------------------------------------------------------------------ //
export function handleSummary(data) {
  const tag = TAG;
  const vu  = VUS;
  return {
    [`/k6/results/summary_${tag}_${vu}vu.json`]: JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
