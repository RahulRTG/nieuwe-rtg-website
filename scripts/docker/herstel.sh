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
: "${RTG_BACKUP_PRIVATE_KEY_FILE:=/run/secrets/backup_private_key}"

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
[ -r "$dump.cms" ] && dump="$dump.cms"
[ -r "$app.cms" ] && app="$app.cms"
[ -r "$dump" ] || { echo "[herstel] PostgreSQL-dump ontbreekt: $dump" >&2; exit 66; }
[ -r "$som" ] || { echo "[herstel] controlesom ontbreekt: $som" >&2; exit 66; }

# Eerst ALLES valideren en uitpakken; pas daarna raakt dit script de database
# en de datamap aan. De sha256-regels zijn relatief aan /backups, zodat dezelfde
# set ook in de write-once off-site map zelfstandig te verifiëren is.
(cd /backups && sha256sum -c "$(basename "$som")")
stage="/tmp/rtg-herstel-$RTG_RESTORE_STAMP"
mkdir -p "$stage"
if [ "${dump##*.}" = "cms" ]; then
  command -v openssl >/dev/null 2>&1 || { echo "[herstel] OpenSSL ontbreekt" >&2; exit 69; }
  [ -r "$RTG_BACKUP_PRIVATE_KEY_FILE" ] || { echo "[herstel] offline back-upprivesleutel ontbreekt" >&2; exit 78; }
  ontsleuteld_dump="$stage/database.dump"
  openssl cms -decrypt -binary -inform DER -in "$dump" -inkey "$RTG_BACKUP_PRIVATE_KEY_FILE" -out "$ontsleuteld_dump"
  dump="$ontsleuteld_dump"
  if [ -r "$app" ]; then
    ontsleuteld_app="$stage/app.tar.gz"
    openssl cms -decrypt -binary -inform DER -in "$app" -inkey "$RTG_BACKUP_PRIVATE_KEY_FILE" -out "$ontsleuteld_app"
    app="$ontsleuteld_app"
  fi
fi
pg_restore --list "$dump" >/dev/null
uitpak="$stage/app-data"
mkdir -p "$uitpak"
if [ -r "$app" ]; then
  tar -tzf "$app" >/dev/null
  tar -tzf "$app" | while IFS= read -r naam; do
    case "$naam" in /*|../*|*/../*|*/..) echo "[herstel] onveilig pad in app-archief: $naam" >&2; exit 65 ;; esac
  done
  # Controleer typen VOOR extractie. Een symlink die eerst wordt uitgepakt kan
  # anders een later archiefitem buiten de tijdelijke map laten schrijven.
  # Alleen gewone bestanden en mappen horen in een RTG-app-back-up; links,
  # devices, sockets en andere speciale typen worden allemaal geweigerd.
  tar -tvzf "$app" | while IFS= read -r regel; do
    case "$regel" in
      -*) ;;
      d*) ;;
      *) echo "[herstel] onveilig bestandstype in app-archief: ${regel%% *}" >&2; exit 65 ;;
    esac
  done
  tar -xzf "$app" -C "$uitpak"
  # Tweede verdedigingslaag voor tar-varianten met afwijkende lijstuitvoer.
  if find "$uitpak" -type l -print -quit | grep -q .; then
    echo "[herstel] symlinks in app-archief worden geweigerd" >&2
    exit 65
  fi
  [ -f "$uitpak/.complete" ] || { echo "[herstel] app-back-up mist .complete" >&2; exit 65; }
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
  cp -a "$uitpak"/. /app-data/
fi

echo "[herstel] compleet: $RTG_RESTORE_STAMP; start de app en controleer /api/ready, inloggen en een echte naam"
