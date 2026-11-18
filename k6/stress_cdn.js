// ============================================================
// TeleMed - Stress Test CDN / File Storage (Pertemuan 5)
// Membandingkan akses origin MinIO langsung dengan akses melalui edge CDN.
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
const MODE        = __ENV.MODE        || 'cdn'; // cdn | direct
const PASSWORD    = __ENV.SEED_PASSWORD || 'medisync2026';
const BUCKET      = __ENV.MINIO_BUCKET  || 'telemed-files';

// Metrik custom
const cdnLatency    = new Trend('cdn_proxy_latency', true);
const directLatency = new Trend('direct_minio_latency', true);
const cdnErrorRate  = new Rate('cdn_error_rate');
const directErrorRate = new Rate('direct_minio_error_rate');
const filesServed   = new Counter('files_served_via_cdn');
const cacheHits     = new Counter('cdn_cache_hits');
const cacheMisses   = new Counter('cdn_cache_misses');
const cdnRequests   = new Counter('cdn_requests');
const directRequests = new Counter('direct_minio_requests');

export const options = {
  stages: [
    { duration: RAMP, target: VUS },
    { duration: HOLD, target: VUS },
    { duration: '10s', target: 0 },
  ],
  thresholds: MODE === 'direct'
    ? { direct_minio_error_rate: ['rate<0.02'] }
    : {
        cdn_proxy_latency: ['p(95)<500'],
        cdn_error_rate: ['rate<0.02'],
      },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// ------------------------------------------------------------------ //
// Setup: patient books a chat consultation and uploads a sample image //
// ------------------------------------------------------------------ //
export function setup() {
  // 1. Login untuk dapat token
  const loginResp = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: 'budi@email.com', password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (loginResp.status !== 200) {
    throw new Error(`Setup gagal: login ditolak (${loginResp.status}). Pastikan seed sudah berjalan.`);
  }
  const token = loginResp.json('token');

  // Create a real consultation context so the tested attachment follows
  // the same authorization flow as the patient and assigned doctor.
  const scheduledAt = new Date(Date.now() + 2 * 86400000).toISOString();
  const bookingResp = http.post(
    `${BASE_URL}/api/consultations`,
    JSON.stringify({
      doctor_id: 2,
      scheduled_at: scheduledAt,
      type: 'Chat',
      complaint: 'k6 CDN image benchmark',
    }),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (bookingResp.status !== 201) {
    throw new Error(`Setup gagal: pembuatan konsultasi ditolak (${bookingResp.status})`);
  }
  const consultationId = bookingResp.json('id');

  // Upload PNG dummy melalui fitur chat yang sama dengan frontend.
  const pngBytes = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82';

  const uploadResp = http.post(
    `${BASE_URL}/api/chat/consultations/${consultationId}/messages`,
    {
      message: 'k6 image CDN benchmark',
      image: http.file(pngBytes, 'test_cdn.png', 'image/png'),
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  let cdnUrl = null;
  if (uploadResp.status === 201) {
    cdnUrl = uploadResp.json('attachment.url');
    console.log(`Setup: gambar chat diunggah untuk konsultasi #${consultationId}`);
  } else {
    throw new Error(`Setup gagal: upload gambar chat ditolak (${uploadResp.status})`);
  }

  const cdnKey = cdnUrl.split('?')[0].replace(/^\/files\//, '');
  return { cdnKey, cdnUrl };
}

// ------------------------------------------------------------------ //
// Main VU scenario                                                    //
// ------------------------------------------------------------------ //
export default function (data) {
  if (MODE === "direct") {
    const directUrl = MINIO_URL + "/" + BUCKET + "/" + data.cdnKey;
    const res = http.get(directUrl, { tags: { scenario: "direct_minio" } });
    directRequests.add(1);
    directLatency.add(res.timings.duration);
    const ok = res.status === 200;
    check(res, { "Direct MinIO status 200": () => ok });
    directErrorRate.add(!ok);
  } else {
    const res = http.get(BASE_URL + data.cdnUrl, { tags: { scenario: "cdn_proxy" } });
    cdnRequests.add(1);
    cdnLatency.add(res.timings.duration);
    const ok = res.status === 200;
    check(res, {
      "CDN proxy status 200": (r) => r.status === 200,
      "CDN header ada": (r) => r.headers["X-CDN-Node"] !== undefined,
      "Cache status ada": (r) => ["HIT", "MISS"].includes(r.headers["X-Cache-Status"]),
      "CDN response < 500ms": (r) => r.timings.duration < 500,
    });
    cdnErrorRate.add(!ok);
    if (ok) filesServed.add(1);
    if (res.headers["X-Cache-Status"] === "HIT") cacheHits.add(1);
    if (res.headers["X-Cache-Status"] === "MISS") cacheMisses.add(1);
  }
  sleep(0.3);
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
