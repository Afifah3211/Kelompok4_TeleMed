"""
k6/plot_cdn.py — Visualisasi Hasil Benchmark CDN vs Direct Storage (Pertemuan 5)

Membandingkan:
  1. Latency CDN Proxy (Nginx Caching) vs Direct Storage (MinIO)
  2. Throughput & Error Rate
Menghasilkan:
  - k6/results/grafik_cdn_comparison.png
  - k6/results/ringkasan_cdn_comparison.csv

Pemakaian (dari ROOT project):
  python k6/plot_cdn.py
"""
import glob
import json
import os
import re
import csv
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

RES = os.path.join(os.path.dirname(__file__), "results")

def val(metric, key):
    if not metric:
        return 0
    v = metric.get("values", metric)
    return v.get(key, 0)

files = sorted(glob.glob(os.path.join(RES, "summary_cdn_*vu.json")))
if not files:
    print(f"[!] Belum ada file summary_cdn_*vu.json di {RES}")
    print("    Jalankan stress test CDN terlebih dahulu:")
    print("    .\\run_stress.ps1 -Tag cdn -Script stress_cdn.js")
    exit(0)

records = []
for f in files:
    match = re.search(r"summary_cdn_(\d+)vu\.json", f)
    if not match:
        continue
    vu = int(match.group(1))
    with open(f, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    m = data.get("metrics", {})
    
    cdn_p95 = val(m.get("cdn_proxy_latency", {}), "p(95)")
    cdn_avg = val(m.get("cdn_proxy_latency", {}), "avg")
    direct_p95 = val(m.get("direct_minio_latency", {}), "p(95)")
    direct_avg = val(m.get("direct_minio_latency", {}), "avg")
    upload_avg = val(m.get("upload_latency", {}), "avg")
    rps = val(m.get("http_reqs", {}), "rate")
    err = val(m.get("http_req_failed", {}), "rate") * 100

    records.append({
        "vu": vu,
        "cdn_p95": cdn_p95,
        "cdn_avg": cdn_avg,
        "direct_p95": direct_p95,
        "direct_avg": direct_avg,
        "upload_avg": upload_avg,
        "rps": rps,
        "err_pct": err,
    })

records.sort(key=lambda r: r["vu"])
vus = [r["vu"] for r in records]

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

# Plot 1: CDN vs Direct Storage Response Time (p95 & avg)
ax1.plot(vus, [r["cdn_p95"] for r in records], "g-o", label="CDN Proxy (p95)", linewidth=2)
ax1.plot(vus, [r["cdn_avg"] for r in records], "g--s", label="CDN Proxy (avg)", linewidth=1.5)
ax1.plot(vus, [r["direct_p95"] for r in records], "r-o", label="Direct MinIO (p95)", linewidth=2)
ax1.plot(vus, [r["direct_avg"] for r in records], "r--s", label="Direct MinIO (avg)", linewidth=1.5)
ax1.set_title("Performa Response Time: CDN vs Direct MinIO", fontsize=12, fontweight="bold")
ax1.set_xlabel("Virtual Users (VU)")
ax1.set_ylabel("Latency (ms)")
ax1.grid(True, linestyle="--", alpha=0.5)
ax1.legend()

# Plot 2: Throughput (RPS)
ax2.plot(vus, [r["rps"] for r in records], "b-o", label="Total Throughput (req/s)", linewidth=2)
ax2.set_title("Throughput Pengiriman File Statis", fontsize=12, fontweight="bold")
ax2.set_xlabel("Virtual Users (VU)")
ax2.set_ylabel("Request / Detik")
ax2.grid(True, linestyle="--", alpha=0.5)
ax2.legend()

plt.tight_layout()
png_out = os.path.join(RES, "grafik_cdn_comparison.png")
plt.savefig(png_out, dpi=150)
print(f"[OK] Grafik tersimpan di: {png_out}")

csv_out = os.path.join(RES, "ringkasan_cdn_comparison.csv")
with open(csv_out, "w", newline="", encoding="utf-8") as fh:
    writer = csv.writer(fh)
    writer.writerow(["VU", "CDN_p95_ms", "CDN_avg_ms", "Direct_p95_ms", "Direct_avg_ms", "Throughput_rps", "Error_Rate_pct"])
    for r in records:
        writer.writerow([r["vu"], round(r["cdn_p95"], 2), round(r["cdn_avg"], 2), round(r["direct_p95"], 2), round(r["direct_avg"], 2), round(r["rps"], 2), round(r["err_pct"], 2)])
print(f"[OK] Ringkasan CSV tersimpan di: {csv_out}")
