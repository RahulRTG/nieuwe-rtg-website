#!/bin/sh
# Herhaalbare live-uitrol voor één Linux-host. Bouwt een immutable release-
# image, bewaart het huidige image als rollback en zet dat automatisch terug
# als de nieuwe app niet binnen de deadline ready wordt.
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
LIVE_ENV="${RTG_LIVE_ENV_FILE:-$ROOT/deploy/live.env}"
STATE="$ROOT/.rtg-live-release"
COMPOSE="docker compose --env-file $LIVE_ENV -f $ROOT/docker-compose.yml -f $ROOT/docker-compose.live.yml"

gebruik() {
  echo "Gebruik: scripts/docker/live.sh check|deploy|owner|golive|status|probe|backup|rollback|restore <timestamp>"
}

[ -r "$LIVE_ENV" ] || {
  echo "[live] $LIVE_ENV ontbreekt; kopieer deploy/live.env.example en vul de externe back-upmap in" >&2
  exit 78
}

# De waarde komt uit een door onszelf beheerd bestand met alleen KEY=value;
# geen shell-evaluatie en geen `source` van configuratie.
lees() {
  sleutel="$1"
  awk -F= -v k="$sleutel" '$1 == k { sub(/^[^=]*=/, ""); print; exit }' "$LIVE_ENV"
}

IMAGE="$(lees RTG_IMAGE)"
[ -n "$IMAGE" ] || IMAGE="rtg-app:live"
[ -r "$STATE" ] && IMAGE="$(sed -n '1p' "$STATE")"
BACKUP_IMAGE="rtg-backup:live"
[ -r "$STATE" ] && [ -n "$(sed -n '2p' "$STATE")" ] && BACKUP_IMAGE="$(sed -n '2p' "$STATE")"
DOMAIN="$(awk -F= '$1 == "APP_URL" { sub(/^[^=]*=/, ""); print; exit }' "$ROOT/.env.productie" 2>/dev/null | sed 's#^https://##;s#/.*$##')"

compose() {
  # shellcheck disable=SC2086 -- $COMPOSE is een vaste reeks argumenten uit ROOT.
  RTG_IMAGE="$IMAGE" RTG_BACKUP_IMAGE="$BACKUP_IMAGE" $COMPOSE "$@"
}

wacht_ready() {
  teller=0
  while [ "$teller" -lt 60 ]; do
    if curl --fail --silent --show-error --insecure https://127.0.0.1/api/ready >/dev/null 2>&1; then return 0; fi
    teller=$((teller + 1))
    sleep 2
  done
  return 1
}

opdracht="${1:-}"
case "$opdracht" in
  check)
    cd "$ROOT"
    RTG_LIVE_ENV_FILE="$LIVE_ENV" node scripts/docker/controle.js --publiek
    compose config --quiet
    ;;
  deploy)
    cd "$ROOT"
    RTG_LIVE_ENV_FILE="$LIVE_ENV" node scripts/docker/controle.js --publiek
    compose config --quiet
    app_id="$(compose ps -q app 2>/dev/null || true)"
    vorig=""
    if [ -n "$app_id" ]; then vorig="$(docker inspect --format='{{.Image}}' "$app_id" 2>/dev/null || true)"; fi
    if [ -n "$vorig" ]; then docker image tag "$vorig" rtg-app:rollback; fi
    release="$(git rev-parse --short=12 HEAD 2>/dev/null || date -u +%Y%m%dT%H%M%SZ)"
    nieuw="rtg-app:release-$release"
    nieuw_backup="rtg-backup:release-$release"
    echo "[live] bouw $nieuw"
    docker build --pull --tag "$nieuw" "$ROOT"
    echo "[live] bouw $nieuw_backup"
    docker build --pull --target backup-runtime --tag "$nieuw_backup" "$ROOT"
    IMAGE="$nieuw"
    BACKUP_IMAGE="$nieuw_backup"
    compose up -d --no-build postgres redis motor app backup
    if wacht_ready; then
      printf '%s\n%s\n' "$nieuw" "$nieuw_backup" > "$STATE"
      echo "[live] klaar: $nieuw op https://$DOMAIN"
    else
      echo "[live] nieuwe release werd niet ready" >&2
      if docker image inspect rtg-app:rollback >/dev/null 2>&1; then
        IMAGE="rtg-app:rollback"
        compose up -d --no-build motor app
        echo "[live] automatisch teruggezet naar rtg-app:rollback" >&2
      fi
      exit 1
    fi
    ;;
  status)
    compose ps
    ;;
  owner)
    cd "$ROOT"
    RTG_LIVE_ENV_FILE="$LIVE_ENV" node scripts/eigenaar-claim.js
    # Het claimscript verwijdert de bootstrapwaarde uit het host-secret. Een
    # recreate is nodig omdat een bestaand containerproces secrets niet herlaadt.
    compose up -d --no-build --force-recreate app
    wacht_ready
    echo "[live] eigenaar geclaimd en eenmalige bootstrapdeur gesloten"
    ;;
  golive)
    # Op de host is `postgres` bewust niet bereikbaar. Keur daarom in de
    # draaiende app-container, met dezelfde secrets en hetzelfde datavolume.
    compose exec -T app node scripts/golive.js
    ;;
  probe)
    [ -n "$DOMAIN" ] || { echo "[live] APP_URL ontbreekt in .env.productie" >&2; exit 78; }
    cd "$ROOT"
    node scripts/sonde.js "https://$DOMAIN"
    node scripts/rand.js "https://$DOMAIN"
    ;;
  backup)
    compose run --rm -e RTG_BACKUP_ONCE=1 backup
    ;;
  rollback)
    docker image inspect rtg-app:rollback >/dev/null
    IMAGE="rtg-app:rollback"
    compose up -d --no-build motor app
    wacht_ready
    printf '%s\n' "$IMAGE" > "$STATE"
    echo "[live] rollback actief"
    ;;
  restore)
    stamp="${2:-}"
    case "$stamp" in ????????T??????Z) ;; *) echo "[live] geef de exacte back-uptimestamp" >&2; exit 78 ;; esac
    private="${RTG_BACKUP_PRIVATE_KEY_FILE:-}"
    [ -r "$private" ] || {
      echo "[live] sluit het offline medium aan en zet RTG_BACKUP_PRIVATE_KEY_FILE op de privésleutel" >&2
      exit 78
    }
    echo "[live] stop eerst schrijvers en herstel daarna $stamp"
    compose stop app motor backup
    RTG_BACKUP_PRIVATE_KEY_FILE="$private" RTG_RESTORE_STAMP="$stamp" RTG_RESTORE_CONFIRM="HERSTEL-$stamp" compose --profile ops run --rm herstel
    compose up -d postgres redis motor app backup
    wacht_ready
    echo "[live] herstel klaar; controleer nu expliciet een bestaande login en echte naam"
    ;;
  *) gebruik; exit 64 ;;
esac
