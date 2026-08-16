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
: "${RTG_BACKUP_ONCE:=0}"
: "${RTG_BACKUP_PUBLIC_CERT_FILE:=}"
: "${RTG_BACKUP_OFFSITE_DIR:=}"

geheel_getal() {
  case "$2" in ''|*[!0-9]*) echo "[backup] $1 moet een geheel getal zijn" >&2; exit 78 ;; esac
}
geheel_getal RTG_BACKUP_INTERVAL "$RTG_BACKUP_INTERVAL"
geheel_getal RTG_BACKUP_RETENTION_DAYS "$RTG_BACKUP_RETENTION_DAYS"
[ "$RTG_BACKUP_INTERVAL" -ge 300 ] || { echo "[backup] interval moet minstens 300 seconden zijn" >&2; exit 78; }
[ -r "$PGPASSWORD_FILE" ] || { echo "[backup] databasegeheim ontbreekt" >&2; exit 78; }
if [ -n "$RTG_BACKUP_PUBLIC_CERT_FILE" ]; then
  command -v openssl >/dev/null 2>&1 || { echo "[backup] OpenSSL ontbreekt; versleutelde back-up kan niet starten" >&2; exit 69; }
  [ -r "$RTG_BACKUP_PUBLIC_CERT_FILE" ] || { echo "[backup] publieke back-upcertificaat ontbreekt" >&2; exit 78; }
  openssl x509 -in "$RTG_BACKUP_PUBLIC_CERT_FILE" -noout >/dev/null 2>&1 || {
    echo "[backup] publieke back-upcertificaat is ongeldig" >&2; exit 78;
  }
fi
PGPASSWORD="$(tr -d '\r\n' < "$PGPASSWORD_FILE")"
export PGHOST PGUSER PGDATABASE PGPASSWORD

mkdir -p /backups/postgres /backups/app
chmod 700 /backups /backups/postgres /backups/app 2>/dev/null || true
# Resten van een hard afgebroken vorige ronde kunnen juist nog plaintext zijn.
# Er draait één sidecar, dus geen enkele .tmp hoort bij een levende tweede taak.
find /backups/postgres /backups/app -maxdepth 1 -type f -name '.*.tmp' -exec rm -f {} \;

versleutel() {
  bron="$1"; doel="$2"
  openssl cms -encrypt -binary -aes-256-gcm -in "$bron" -out "$doel" -outform DER "$RTG_BACKUP_PUBLIC_CERT_FILE"
  openssl cms -cmsout -inform DER -in "$doel" -noout >/dev/null
  rm -f "$bron"
}

kopieer_offsite() {
  stempel="$1"; pg_doel="$2"; app_doel="$3"; som="$4"
  [ -n "$RTG_BACKUP_OFFSITE_DIR" ] || return 0
  [ "$RTG_BACKUP_OFFSITE_DIR" != "/backups" ] || { echo "[backup] off-site doel is gelijk aan de lokale back-upmap" >&2; return 78; }
  mkdir -p "$RTG_BACKUP_OFFSITE_DIR"
  tijdelijk="$RTG_BACKUP_OFFSITE_DIR/.${stempel}.$$"
  doel="$RTG_BACKUP_OFFSITE_DIR/$stempel"
  [ ! -e "$doel" ] || { echo "[backup] off-site set $stempel bestaat al; overschrijven geweigerd" >&2; return 73; }
  rm -rf "$tijdelijk"
  mkdir -p "$tijdelijk/postgres" "$tijdelijk/app"
  cp "$pg_doel" "$tijdelijk/postgres/$(basename "$pg_doel")"
  [ -n "$app_doel" ] && cp "$app_doel" "$tijdelijk/app/$(basename "$app_doel")"
  cp "$som" "$tijdelijk/$(basename "$som")"
  (cd "$tijdelijk" && sha256sum -c "$(basename "$som")" >/dev/null)
  printf '%s\n' "$stempel" > "$tijdelijk/.complete"
  find "$tijdelijk" -type f -exec chmod 400 {} \; 2>/dev/null || true
  chmod 500 "$tijdelijk" 2>/dev/null || true
  mv "$tijdelijk" "$doel"
  # Deze boom wordt nooit door RTG opgeschoond. Het opslagplatform hoort hier
  # zelf WORM/Object Lock/retention op af te dwingen.
  echo "[backup] off-site write-once kopie: $doel"
}

maak_backup() {
  stempel="$(date -u +%Y%m%dT%H%M%SZ)"
  pg_tmp="/backups/postgres/.${stempel}.dump.tmp"
  pg_doel="/backups/postgres/${stempel}.dump"
  app_tmp=""
  app_doel=""

  ruim_tijdelijk_op() {
    rm -f "$pg_tmp"
    [ -n "$app_tmp" ] && rm -f "$app_tmp"
  }
  trap ruim_tijdelijk_op EXIT HUP INT TERM

  rm -f "$pg_tmp"
  pg_dump --format=custom --compress=6 --no-owner --no-privileges --file="$pg_tmp"
  pg_restore --list "$pg_tmp" >/dev/null
  if [ -n "$RTG_BACKUP_PUBLIC_CERT_FILE" ]; then
    pg_doel="$pg_doel.cms"
    versleutel "$pg_tmp" "$pg_doel"
  else
    mv "$pg_tmp" "$pg_doel"
  fi

  app_dag="$(find /app-data/backups -mindepth 2 -maxdepth 2 -name .complete -type f 2>/dev/null | sort | tail -n 1 || true)"
  if [ -n "$app_dag" ]; then
    app_bron="$(dirname "$app_dag")"
    app_tmp="/backups/app/.${stempel}.tar.gz.tmp"
    app_doel="/backups/app/${stempel}.tar.gz"
    rm -f "$app_tmp"
    tar -czf "$app_tmp" -C "$app_bron" .
    tar -tzf "$app_tmp" >/dev/null
    if [ -n "$RTG_BACKUP_PUBLIC_CERT_FILE" ]; then
      app_doel="$app_doel.cms"
      versleutel "$app_tmp" "$app_doel"
    else
      mv "$app_tmp" "$app_doel"
    fi
    (cd /backups && sha256sum "postgres/$(basename "$pg_doel")" "app/$(basename "$app_doel")") > "/backups/${stempel}.sha256"
  else
    echo "[backup] waarschuwing: nog geen atomisch afgeronde app-back-up gevonden" >&2
    (cd /backups && sha256sum "postgres/$(basename "$pg_doel")") > "/backups/${stempel}.sha256"
  fi

  kopieer_offsite "$stempel" "$pg_doel" "$app_doel" "/backups/${stempel}.sha256"

  find /backups/postgres /backups/app -type f ! -name '.*.tmp' -mtime "+$RTG_BACKUP_RETENTION_DAYS" -exec rm -f {} \;
  find /backups -maxdepth 1 -type f -name '*.sha256' -mtime "+$RTG_BACKUP_RETENTION_DAYS" -exec rm -f {} \;
  trap - EXIT HUP INT TERM
  ruim_tijdelijk_op
  label=""
  [ -n "$RTG_BACKUP_PUBLIC_CERT_FILE" ] && label=" (AES-256-GCM versleuteld)"
  echo "[backup] compleet: $stempel$label"
}

while :; do
  maak_backup
  [ "$RTG_BACKUP_ONCE" = "1" ] && exit 0
  sleep "$RTG_BACKUP_INTERVAL"
done
