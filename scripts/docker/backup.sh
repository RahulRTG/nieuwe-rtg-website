#!/bin/sh
# Volledige self-hosted back-up: een gevalideerde PostgreSQL-dump plus de
# laatste door de app atomisch afgeronde bestandsback-up. Uitvoer staat buiten
# de containers in RTG_BACKUP_HOST_DIR (standaard ./backups).
set -eu
umask 077

: "${PGHOST:=postgres}"
: "${PGUSER:=rtg}"
: "${PGDATABASE:=rtg}"
: "${PGPASSWORD_FILE:=/run/secrets/postgres_password}"
: "${RTG_BACKUP_INTERVAL:=86400}"
: "${RTG_BACKUP_RETENTION_DAYS:=30}"

geheel_getal() {
  case "$2" in ''|*[!0-9]*) echo "[backup] $1 moet een geheel getal zijn" >&2; exit 78 ;; esac
}
geheel_getal RTG_BACKUP_INTERVAL "$RTG_BACKUP_INTERVAL"
geheel_getal RTG_BACKUP_RETENTION_DAYS "$RTG_BACKUP_RETENTION_DAYS"
[ "$RTG_BACKUP_INTERVAL" -ge 300 ] || { echo "[backup] interval moet minstens 300 seconden zijn" >&2; exit 78; }
[ -r "$PGPASSWORD_FILE" ] || { echo "[backup] databasegeheim ontbreekt" >&2; exit 78; }
PGPASSWORD="$(tr -d '\r\n' < "$PGPASSWORD_FILE")"
export PGHOST PGUSER PGDATABASE PGPASSWORD

mkdir -p /backups/postgres /backups/app
chmod 700 /backups /backups/postgres /backups/app 2>/dev/null || true

maak_backup() {
  stempel="$(date -u +%Y%m%dT%H%M%SZ)"
  pg_tmp="/backups/postgres/.${stempel}.dump.tmp"
  pg_doel="/backups/postgres/${stempel}.dump"

  rm -f "$pg_tmp"
  pg_dump --format=custom --compress=6 --no-owner --no-privileges --file="$pg_tmp"
  pg_restore --list "$pg_tmp" >/dev/null
  mv "$pg_tmp" "$pg_doel"

  app_dag="$(find /app-data/backups -mindepth 2 -maxdepth 2 -name .complete -type f 2>/dev/null | sort | tail -n 1 || true)"
  if [ -n "$app_dag" ]; then
    app_bron="$(dirname "$app_dag")"
    app_tmp="/backups/app/.${stempel}.tar.gz.tmp"
    app_doel="/backups/app/${stempel}.tar.gz"
    rm -f "$app_tmp"
    tar -czf "$app_tmp" -C "$app_bron" .
    tar -tzf "$app_tmp" >/dev/null
    mv "$app_tmp" "$app_doel"
    sha256sum "$pg_doel" "$app_doel" > "/backups/${stempel}.sha256"
  else
    echo "[backup] waarschuwing: nog geen atomisch afgeronde app-back-up gevonden" >&2
    sha256sum "$pg_doel" > "/backups/${stempel}.sha256"
  fi

  find /backups/postgres /backups/app -type f ! -name '.*.tmp' -mtime "+$RTG_BACKUP_RETENTION_DAYS" -exec rm -f {} \;
  find /backups -maxdepth 1 -type f -name '*.sha256' -mtime "+$RTG_BACKUP_RETENTION_DAYS" -exec rm -f {} \;
  echo "[backup] compleet: $stempel"
}

while :; do
  maak_backup
  sleep "$RTG_BACKUP_INTERVAL"
done
