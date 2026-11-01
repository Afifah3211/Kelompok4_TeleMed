#!/usr/bin/env bash
# ============================================================
# TeleMed - Autoscaler sederhana untuk Docker Compose
# Skala service `backend` naik/turun berdasarkan rata-rata CPU
# (dihitung relatif terhadap LIMIT CPU container, bukan core host).
#
# Jalankan dari ROOT project (di WSL / Git Bash):
#   chmod +x scripts/autoscale.sh
#   ./scripts/autoscale.sh
#
# Atur lewat environment variable, contoh:
#   MIN=1 MAX=5 UP=60 DOWN=20 INTERVAL=10 ./scripts/autoscale.sh
# Hasil dicatat ke autoscale.log (CSV) -> bisa dibuat grafik buat laporan.
# ============================================================
set -u

SERVICE="${SERVICE:-backend}"
MIN="${MIN:-1}"                 # replika minimum
MAX="${MAX:-5}"                 # replika maksimum
UP="${UP:-60}"                  # scale OUT jika rata-rata CPU > UP %
DOWN="${DOWN:-20}"              # scale IN  jika rata-rata CPU < DOWN %
INTERVAL="${INTERVAL:-10}"      # detik antar pengecekan
COOLDOWN="${COOLDOWN:-40}"      # detik jeda setelah scaling (cegah flapping)
LIMIT_CPUS="${LIMIT_CPUS:-0.5}" # HARUS sama dengan deploy.resources.limits.cpus di compose
COMPOSE_FILES="${COMPOSE_FILES:--f docker-compose.yml}"
LOG_FILE="${LOG_FILE:-autoscale.log}"

compose() { docker compose $COMPOSE_FILES "$@"; }

[ -f "$LOG_FILE" ] || echo "timestamp,replicas,avg_cpu_pct_of_limit,action" > "$LOG_FILE"
last_scale=0

echo "[autoscale] service=$SERVICE min=$MIN max=$MAX up>${UP}% down<${DOWN}% interval=${INTERVAL}s"

while true; do
  ids=$(compose ps -q "$SERVICE" 2>/dev/null)
  n=$(printf '%s\n' "$ids" | grep -c . || true)

  if [ "$n" -eq 0 ]; then
    echo "[autoscale] belum ada container $SERVICE, menunggu..."
    sleep "$INTERVAL"; continue
  fi

  # CPUPerc docker = persen dari 1 core host (bisa >100). Bagi LIMIT_CPUS => persen dari limit container.
  avg=$(docker stats --no-stream --format '{{.CPUPerc}}' $ids 2>/dev/null \
        | tr -d '%' \
        | awk -v lim="$LIMIT_CPUS" '{s+=$1;c++} END{ if(c) printf "%.1f", (s/c)/lim; else print 0 }')

  now=$(date +%s)
  action="hold"
  target=$n

  if [ $((now - last_scale)) -ge "$COOLDOWN" ]; then
    if awk "BEGIN{exit !($avg > $UP)}" && [ "$n" -lt "$MAX" ]; then
      target=$((n + 1)); action="scale_out"
    elif awk "BEGIN{exit !($avg < $DOWN)}" && [ "$n" -gt "$MIN" ]; then
      target=$((n - 1)); action="scale_in"
    fi
  fi

  ts=$(date '+%Y-%m-%d %H:%M:%S')
  echo "$ts,$n,$avg,$action" >> "$LOG_FILE"
  echo "[$ts] replicas=$n avgCPU=${avg}% -> $action"

  if [ "$target" -ne "$n" ]; then
    echo "[autoscale] $SERVICE: $n -> $target"
    compose up -d --no-deps --no-recreate --scale "$SERVICE=$target" "$SERVICE" >/dev/null 2>&1
    last_scale=$(date +%s)
  fi

  sleep "$INTERVAL"
done
