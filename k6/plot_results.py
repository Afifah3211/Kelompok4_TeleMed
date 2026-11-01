"""
Gabungkan hasil summary_<tag>_<vu>vu.json jadi grafik laporan Pertemuan 3:
Throughput (req/s), Response Time (avg & p95), Error Rate vs jumlah VU.

Pemakaian (dari ROOT project):
    pip install matplotlib
    python k6/plot_results.py noscale            # satu skenario
    python k6/plot_results.py noscale autoscale  # bandingkan dua skenario
Output: k6/results/grafik_<tag...>.png + ringkasan_<tag...>.csv
"""
import glob, json, os, re, sys, csv
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

RES = os.path.join(os.path.dirname(__file__), "results")

def val(metric, key):
    v = metric.get("values", metric)  # k6 lama: {"values": {...}}, k6 baru: datar
    return v.get(key)

def load(tag):
    rows = []
    for f in glob.glob(os.path.join(RES, f"summary_{tag}_*vu.json")):
        vu = int(re.search(rf"summary_{re.escape(tag)}_(\d+)vu", f).group(1))
        m = json.load(open(f))["metrics"]
        rows.append({
            "vu": vu,
            "throughput": val(m["http_reqs"], "rate"),
            "avg_ms": val(m["http_req_duration"], "avg"),
            "p95_ms": val(m["http_req_duration"], "p(95)"),
            "p99_ms": val(m["http_req_duration"], "p(99)"),
            "error_pct": (val(m["http_req_failed"], "rate") or 0) * 100,
            "total_reqs": val(m["http_reqs"], "count"),
        })
    return sorted(rows, key=lambda r: r["vu"])

tags = sys.argv[1:] or ["noscale"]
data = {t: load(t) for t in tags}
for t, rows in data.items():
    if not rows:
        sys.exit(f"Tidak ada file summary_{t}_*vu.json di {RES}")

fig, ax = plt.subplots(1, 3, figsize=(16, 4.6))
for t, rows in data.items():
    x = [r["vu"] for r in rows]
    ax[0].plot(x, [r["throughput"] for r in rows], marker="o", label=t)
    ax[1].plot(x, [r["p95_ms"] for r in rows], marker="o", label=f"{t} p95")
    ax[1].plot(x, [r["avg_ms"] for r in rows], marker="x", linestyle="--", label=f"{t} avg")
    ax[2].plot(x, [r["error_pct"] for r in rows], marker="o", label=t)

ax[0].set_title("Throughput"); ax[0].set_ylabel("request / detik")
ax[1].set_title("Response Time"); ax[1].set_ylabel("ms")
ax[2].set_title("Error Rate"); ax[2].set_ylabel("% request gagal")
for a in ax:
    a.set_xlabel("Virtual Users (VU)"); a.grid(alpha=.3); a.legend()
    a.set_xscale("log")
plt.tight_layout()
name = "_".join(tags)
png = os.path.join(RES, f"grafik_{name}.png")
plt.savefig(png, dpi=150)

out = os.path.join(RES, f"ringkasan_{name}.csv")
with open(out, "w", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["skenario", "VU", "throughput_rps", "avg_ms", "p95_ms", "p99_ms", "error_pct", "total_requests"])
    for t, rows in data.items():
        for r in rows:
            w.writerow([t, r["vu"], round(r["throughput"], 2), round(r["avg_ms"], 1),
                        round(r["p95_ms"], 1), round(r["p99_ms"], 1), round(r["error_pct"], 2), int(r["total_reqs"])])
print("OK ->", png, "dan", out)
