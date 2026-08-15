#!/bin/sh
# Herstelt exact één door backup.sh gemaakte set. Dit script is opzettelijk
# destructief en daarom alleen bereikbaar via het Compose-profiel "ops", met
# twee onderling afhankelijke bevestigingswaarden.
set -eu
umask 077

: "${PGHOST:=postgres}"
: "${PGUSER:=rtg}"
: "${PGDATABASE:=rtg}"
: "${PGPASSWORD_FILE:=/run/secrets/postgres_password}"
: "${RTG_RESTORE_STAMP:=}"
: "${RTG_RESTORE_CONFIRM:=}"

case "$RTG_RESTORE_STAMP" in
  ????????T??????Z) ;;
  *) echo "[herstel] RTG_RESTORE_STAMP moet YYYYMMDDTHHMMSSZ zijn" >&2; exit 78 ;;
esac
[ "$RTG_RESTORE_CONFIRM" = "HERSTEL-$RTG_RESTORE_STAMP" ] || {
  echo "[herstel] bevestiging ontbreekt; verwacht HERSTEL-$RTG_RESTORE_STAMP" >&2
  exit 78
}
[ -r "$PGPASSWORD_FILE" ] || { echo "[herstel] databasegeheim ontbreekt" >&2; exit 78; }

dump="/backups/postgres/$RTG_RESTORE_STAMP.dump"
app="/backups/app/$RTG_RESTORE_STAMP.tar.gz"
som="/backups/$RTG_RESTORE_STAMP.sha256"
[ -r "$dump" ] || { echo "[herstel] PostgreSQL-dump ontbreekt: $dump" >&2; exit 66; }
[ -r "$som" ] || { echo "[herstel] controlesom ontbreekt: $som" >&2; exit 66; }

# Eerst ALLES valideren en uitpakken; pas daarna raakt dit script de database
# en de datamap aan. De sha256-regels bevatten absolute /backups-paden, precies
# zoals backup.sh ze heeft aangemaakt.
(cd / && sha256sum -c "$som")
pg_restore --list "$dump" >/dev/null
stage="/tmp/rtg-herstel-$RTG_RESTORE_STAMP"
mkdir -p "$stage"
if [ -r "$app" ]; then
  tar -tzf "$app" >/dev/null
  tar -xzf "$app" -C "$stage"
  [ -f "$stage/.complete" ] || { echo "[herstel] app-back-up mist .complete" >&2; exit 65; }
fi

PGPASSWORD="$(tr -d '\r\n' < "$PGPASSWORD_FILE")"
export PGHOST PGUSER PGDATABASE PGPASSWORD
pg_isready -d postgres >/dev/null

echo "[herstel] controles geslaagd; herstel $RTG_RESTORE_STAMP start"
dropdb --if-exists --force "$PGDATABASE"
createdb "$PGDATABASE"
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$PGDATABASE" "$dump"

if [ -r "$app" ]; then
  # De back-up bevat alleen expliciet toegestane runtimebestanden en -mappen.
  # De map backups blijft staan; zo wist herstel nooit zijn eigen bron.
  find /app-data -mindepth 1 -maxdepth 1 ! -name backups -exec rm -rf -- {} +
  cp -a "$stage"/. /app-data/
fi

echo "[herstel] compleet: $RTG_RESTORE_STAMP; start de app en controleer /api/ready, inloggen en een echte naam"
