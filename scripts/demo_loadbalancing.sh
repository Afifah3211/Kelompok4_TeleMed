#!/usr/bin/env bash
# ============================================================
# TeleMed - Demo Load Balancing HTTP ke Replika Backend
# Mengirim 30 request ke Nginx frontend (http://localhost:8080/api/health)
# dan menghitung distribusi trafik per container 'instance'.
# ============================================================
set -euo pipefail

TARGET_URL="${1:-http://localhost:8080/api/health}"
TOTAL_REQUESTS="${2:-30}"

echo "============================================================"
echo " TeleMed - Pengujian Load Balancing (Round-Robin via Nginx)"
echo " Target   : $TARGET_URL"
echo " Requests : $TOTAL_REQUESTS"
echo "============================================================"
echo ""

responses=()
instances=()

echo -n "Mengirim $TOTAL_REQUESTS request: "
for i in $(seq 1 "$TOTAL_REQUESTS"); do
  # Ambil output JSON
  res=$(curl -s --max-time 3 "$TARGET_URL" || true)
  if [ -n "$res" ]; then
    # Ekstrak nilai instance menggunakan sed/grep/awk (kompatibel tanpa jq)
    inst=$(echo "$res" | grep -o '"instance":"[^"]*"' | cut -d':' -f2 | tr -d '"' || true)
    if [ -n "$inst" ]; then
      instances+=("$inst")
      echo -n "."
    else
      echo -n "x"
    fi
  else
    echo -n "E"
  fi
  # Jeda mikro agar Nginx resolver mendistribusikan request
  sleep 0.05
done
echo " Selesai!"
echo ""

if [ ${#instances[@]} -eq 0 ]; then
  echo "ERROR: Tidak ada respons berhasil dari $TARGET_URL."
  echo "Pastikan seluruh container aktif ('docker compose ps')."
  exit 1
fi

echo "--- Distribusi Trafik Per Instance Backend ---"
printf "%-25s | %-10s | %-10s\n" "Container Instance ID" "Jumlah Hit" "Persentase"
echo "--------------------------+------------+------------"

# Hitung jumlah per instance unik
unique_instances=$(printf "%s\n" "${instances[@]}" | sort -u)
total_success=${#instances[@]}

for u in $unique_instances; do
  count=$(printf "%s\n" "${instances[@]}" | grep -Fx "$u" | wc -l)
  pct=$(awk -v c="$count" -v t="$total_success" 'BEGIN { printf "%.1f%%", (c/t)*100 }')
  printf "%-25s | %-10s | %-10s\n" "$u" "$count" "$pct"
done

echo "--------------------------+------------+------------"
printf "%-25s | %-10s | %-10s\n" "TOTAL" "$total_success" "100.0%"
echo ""

distinct_count=$(echo "$unique_instances" | wc -l)
if [ "$distinct_count" -gt 1 ]; then
  echo "✅ STATUS: Load balancing BERHASIL aktif! ($distinct_count instance berbeda merespons secara bergantian)."
else
  echo "ℹ️ STATUS: Hanya 1 instance yang merespons. Jika sedang di-scale, pastikan Nginx resolver me-resolve multiple IP."
fi
