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

files = sorted(glob.glob(os.path.join(RES, "summary_*_*vu.json")))
if not files:
    print(f"[!] Belum ada file benchmark CDN/origin di {RES}")
    print("    Jalankan stress test CDN terlebih dahulu:")
    print("    .\\run_stress.ps1 -Tag cdn -Script stress_cdn.js -Mode cdn")
    print("    .\\run_stress.ps1 -Tag origin -Script stress_cdn.js -Mode direct")
    exit(0)

records_by_vu = {}
for f in files:
    match = re.search(r"summary_(cdn|origin)_(\d+)vu\.json", f)
    if not match:
        continue
    mode = match.group(1)
    vu = int(match.group(2))
    with open(f, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    m = data.get("metrics", {})
    row = records_by_vu.setdefault(vu, {"vu": vu})
    if mode == "cdn":
        row["cdn_p95"] = val(m.get("cdn_proxy_latency", {}), "p(95)")
        row["cdn_avg"] = val(m.get("cdn_proxy_latency", {}), "avg")
        row["cdn_rps"] = val(m.get("cdn_requests", {}), "rate")
        row["cdn_err_pct"] = val(m.get("cdn_error_rate", {}), "rate") * 100
        hits = val(m.get("cdn_cache_hits", {}), "count")
        misses = val(m.get("cdn_cache_misses", {}), "count")
        row["cache_hit_pct"] = (hits / (hits + misses) * 100) if hits + misses else 0
    else:
        row["direct_p95"] = val(m.get("direct_minio_latency", {}), "p(95)")
        row["direct_avg"] = val(m.get("direct_minio_latency", {}), "avg")
        row["direct_rps"] = val(m.get("direct_minio_requests", {}), "rate")
        row["direct_err_pct"] = val(m.get("direct_minio_error_rate", {}), "rate") * 100

records = sorted(records_by_vu.values(), key=lambda row: row["vu"])
incomplete = [row["vu"] for row in records if "cdn_p95" not in row or "direct_p95" not in row]
if incomplete:
    print(f"[!] Hasil belum berpasangan untuk VU {incomplete}; jalankan mode cdn dan direct untuk level yang sama.")
records = [row for row in records if "cdn_p95" in row and "direct_p95" in row]
if not records:
    raise SystemExit("Belum ada pasangan hasil CDN dan direct untuk dibandingkan.")
for row in records:
    for metric in ("cdn_p95", "cdn_avg", "cdn_rps", "cdn_err_pct", "cache_hit_pct", "direct_p95", "direct_avg", "direct_rps", "direct_err_pct"):
        row.setdefault(metric, 0)

records.sort(key=lambda r: r["vu"])
vus = [r["vu"] for r in records]

fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(18, 5))

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

# Plot 2: Asset GET throughput (RPS)
ax2.plot(vus, [r["cdn_rps"] for r in records], "g-o", label="CDN Edge (req/s)", linewidth=2)
ax2.plot(vus, [r["direct_rps"] for r in records], "r-o", label="Direct MinIO (req/s)", linewidth=2)
ax2.set_title("Throughput GET Aset", fontsize=12, fontweight="bold")
ax2.set_xlabel("Virtual Users (VU)")
ax2.set_ylabel("Request / Detik")
ax2.grid(True, linestyle="--", alpha=0.5)
ax2.legend()

# Plot 3: Error rates and cache hit rate
ax3.plot(vus, [r["cdn_err_pct"] for r in records], "g-o", label="CDN error (%)", linewidth=2)
ax3.plot(vus, [r["direct_err_pct"] for r in records], "r-o", label="Direct MinIO error (%)", linewidth=2)
ax3.plot(vus, [r["cache_hit_pct"] for r in records], "b--s", label="CDN cache HIT (%)", linewidth=1.5)
ax3.set_title("Error Rate & Cache", fontsize=12, fontweight="bold")
ax3.set_xlabel("Virtual Users (VU)")
ax3.set_ylabel("Persen (%)")
ax3.set_ylim(bottom=0)
ax3.grid(True, linestyle="--", alpha=0.5)
ax3.legend()

plt.tight_layout()
png_out = os.path.join(RES, "grafik_cdn_comparison.png")
plt.savefig(png_out, dpi=150)
print(f"[OK] Grafik tersimpan di: {png_out}")

csv_out = os.path.join(RES, "ringkasan_cdn_comparison.csv")
with open(csv_out, "w", newline="", encoding="utf-8") as fh:
    writer = csv.writer(fh)
    writer.writerow(["VU", "CDN_p95_ms", "CDN_avg_ms", "Direct_p95_ms", "Direct_avg_ms", "CDN_Throughput_rps", "Direct_Throughput_rps", "CDN_Error_pct", "Direct_Error_pct", "Cache_HIT_pct"])
    for r in records:
        writer.writerow([r["vu"], round(r["cdn_p95"], 2), round(r["cdn_avg"], 2), round(r["direct_p95"], 2), round(r["direct_avg"], 2), round(r["cdn_rps"], 2), round(r["direct_rps"], 2), round(r["cdn_err_pct"], 2), round(r["direct_err_pct"], 2), round(r["cache_hit_pct"], 2)])
print(f"[OK] Ringkasan CSV tersimpan di: {csv_out}")
