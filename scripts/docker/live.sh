#!/bin/sh
# Herhaalbare live-uitrol voor één Linux-host. Keurt en gebruikt uitsluitend
# een immutable CI-image, bewaart het huidige image als rollback en zet dat terug
# als de nieuwe app niet binnen de deadline ready wordt.
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
LIVE_ENV="${RTG_LIVE_ENV_FILE:-$ROOT/deploy/live.env}"
STATE="$ROOT/.rtg-live-release"
ROLLBACK_STATE="$ROOT/.rtg-live-rollback"
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
PRODUCTIE_ENV="${RTG_ENV_FILE:-$ROOT/.env.productie}"
APP_URL="$(awk -F= '$1 == "APP_URL" { sub(/^[^=]*=/, ""); print; exit }' "$PRODUCTIE_ENV" 2>/dev/null)"

compose() {
  # shellcheck disable=SC2086 -- $COMPOSE is een vaste reeks argumenten uit ROOT.
  RTG_IMAGE="$IMAGE" RTG_APP_IMAGE="$IMAGE" RTG_BACKUP_IMAGE="$BACKUP_IMAGE" $COMPOSE "$@"
}

# Een kandidaat draait onder een afzonderlijke Compose-projectnaam. Zelfs als
# iemand later per ongeluk een kandidaatservice dezelfde naam geeft als een
# productiedienst, kan Compose daardoor nooit de live container recreëren of
# aan het live data-/queuenetwerk hangen.
KEUR_PROJECT=""
keur_compose() {
  [ -n "$KEUR_PROJECT" ] || { echo "[live] interne fout: keurproject ontbreekt" >&2; return 70; }
  RTG_IMAGE="$IMAGE" RTG_APP_IMAGE="$IMAGE" RTG_BACKUP_IMAGE="$BACKUP_IMAGE" \
    docker compose --project-name "$KEUR_PROJECT" --env-file "$LIVE_ENV" \
    -f "$ROOT/docker-compose.yml" -f "$ROOT/docker-compose.live.yml" "$@"
}

keur_opruimen() {
  if [ -n "$KEUR_PROJECT" ]; then
    keur_compose --profile release down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
  if [ -n "${RTG_KEUR_ENV_FILE:-}" ]; then rm -f "$RTG_KEUR_ENV_FILE"; fi
  if [ -n "${RTG_KEUR_MOTOR_STATE_KEY_FILE:-}" ]; then rm -f "$RTG_KEUR_MOTOR_STATE_KEY_FILE"; fi
}

wacht_ready() {
  teller=0
  while [ "$teller" -lt 60 ]; do
    # Alleen het TCP-doel is loopback. URL, Host, SNI, hostnamecontrole en de
    # publieke trustketen blijven APP_URL; een self-signed ACME-tussenstand kan
    # de release dus nooit meer gezond verklaren.
    if node "$ROOT/scripts/publieke-tls-proef.js" "$APP_URL" \
      --connect-host=127.0.0.1 --readiness-only --stil >/dev/null 2>&1; then return 0; fi
    teller=$((teller + 1))
    sleep 2
  done
  return 1
}

probe_lokaal() {
  node "$ROOT/scripts/publieke-tls-proef.js" "$APP_URL" \
    --connect-host=127.0.0.1 --stil
}

geldige_rollbackset() {
  node -e 'const r=/^sha256:[a-f0-9]{64}$/;const h=/^[a-f0-9]{64}$/;process.exit(r.test(process.argv[1])&&r.test(process.argv[2])&&h.test(process.argv[3])?0:1)' \
    "$1" "$2" "$3" &&
    docker image inspect "$1" >/dev/null 2>&1 && docker image inspect "$2" >/dev/null 2>&1 &&
    [ "$(docker run --rm --entrypoint sha256sum "$1" /app/release-bewijs.json 2>/dev/null | awk '{print $1}')" = "$3" ]
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
    # Nog vóór de eerste Docker-aanroep: alleen een schone HEAD met READY en
    # een vooraf intern gekeurd kandidaatimage. Deze stap bouwt niets meer.
    vrijgave="$(node scripts/live-vrijgave.js)"
    release_commit="$(printf '%s\n' "$vrijgave" | sed -n '1p')"
    kandidaat="$(printf '%s\n' "$vrijgave" | sed -n '2p')"
    kandidaat_id="$(printf '%s\n' "$vrijgave" | sed -n '3p')"
    kandidaat_backup="$(printf '%s\n' "$vrijgave" | sed -n '4p')"
    kandidaat_backup_id="$(printf '%s\n' "$vrijgave" | sed -n '5p')"
    bewijs_pin="$(printf '%s\n' "$vrijgave" | sed -n '6p')"
    export RTG_RELEASE_COMMIT="$release_commit"
    export RTG_RELEASE_BEWIJS_SHA256="$bewijs_pin"
    RTG_LIVE_ENV_FILE="$LIVE_ENV" node scripts/docker/controle.js --publiek
    compose config --quiet
    [ "$(docker image inspect --format='{{.Id}}' "$kandidaat")" = "$kandidaat_id" ] || {
      echo "[live] het lokale kandidaatimage wijkt af van zijn READY-bewijs" >&2; exit 65;
    }
    [ "$(docker image inspect --format='{{.Id}}' "$kandidaat_backup")" = "$kandidaat_backup_id" ] || {
      echo "[live] het lokale kandidaat-backupimage wijkt af van zijn bewijs" >&2; exit 65;
    }
    app_id="$(compose ps -q app 2>/dev/null || true)"
    vorig=""
    if [ -n "$app_id" ]; then vorig="$(docker inspect --format='{{.Image}}' "$app_id" 2>/dev/null || true)"; fi
    vorig_backup=""
    backup_id="$(compose ps -q backup 2>/dev/null || true)"
    if [ -n "$backup_id" ]; then vorig_backup="$(docker inspect --format='{{.Image}}' "$backup_id" 2>/dev/null || true)"; fi
    vorige_pin=""
    if [ -n "$vorig" ]; then
      [ -n "$vorig_backup" ] || { echo "[live] bestaande release mist een immutable backupimage; uitrol geweigerd" >&2; exit 65; }
      vorige_pin="$(docker run --rm --entrypoint sha256sum "$vorig" /app/release-bewijs.json 2>/dev/null | awk '{print $1}')"
      geldige_rollbackset "$vorig" "$vorig_backup" "$vorige_pin" || {
        echo "[live] bestaande release heeft geen volledige immutable rollbackset" >&2; exit 65;
      }
      printf '%s\n%s\n%s\n' "$vorig" "$vorig_backup" "$vorige_pin" > "$ROLLBACK_STATE"
    else
      [ "$(lees RTG_EERSTE_UITROL)" = "BEVESTIGD-ZONDER-ROLLBACK" ] || {
        echo "[live] eerste uitrol heeft geen rollbackdoel; zet RTG_EERSTE_UITROL=BEVESTIGD-ZONDER-ROLLBACK bewust in deploy/live.env" >&2
        exit 78
      }
      echo "[live] expliciet eerste-uitrolbeleid actief: bij falen worden kandidaatdiensten gestopt" >&2
      rm -f "$ROLLBACK_STATE"
    fi
    vrijgave_na="$(node scripts/live-vrijgave.js)"
    [ "$vrijgave_na" = "$vrijgave" ] || {
      echo "[live] releasebron, READY of kandidaatbewijs veranderde vóór de wissel" >&2
      exit 65
    }
    # Image-ID's zijn immutable; een verplaatste lokale tag kan hier niets meer
    # verwisselen tussen controle en `compose up`.
    IMAGE="$kandidaat"
    BACKUP_IMAGE="$kandidaat_backup"
    start_status=0
    compose up -d --no-build postgres redis motor app sentinel backup || start_status=$?
    if [ "$start_status" -eq 0 ] && wacht_ready && probe_lokaal; then
      printf '%s\n%s\n%s\n' "$kandidaat_id" "$kandidaat_backup_id" "$bewijs_pin" > "$STATE"
      echo "[live] klaar: $kandidaat ($kandidaat_id) op $APP_URL"
    else
      echo "[live] nieuwe release werd niet ready" >&2
      if [ -n "$vorig" ]; then
        IMAGE="$vorig"
        BACKUP_IMAGE="$vorig_backup"
        RTG_RELEASE_BEWIJS_SHA256="$vorige_pin"
        export RTG_RELEASE_BEWIJS_SHA256
        rollback_status=0
        compose up -d --no-build motor app sentinel backup || rollback_status=$?
        if [ "$rollback_status" -eq 0 ] && wacht_ready && probe_lokaal; then
          printf '%s\n%s\n%s\n' "$vorig" "$vorig_backup" "$vorige_pin" > "$STATE"
          echo "[live] automatisch naar de volledige immutable rollbackset teruggezet" >&2
        else echo "[live] ook de rollback werd niet ready; incidentingreep vereist" >&2; fi
      else
        compose stop app motor sentinel backup >/dev/null 2>&1 || true
        echo "[live] eerste kandidaat gestopt; er was volgens expliciet beleid nog geen vorige release" >&2
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
    # Haal een NIET-PUBLIEKE CI-kandidaat op en keur precies dat image
    # in een eigen Compose-project met vluchtige database, cache en queue. Het
    # neemt geen app/motor-servicenaam, productievolume of publieke poort over.
    # Pas een latere `live:deploy`, na READY, wisselt.
    cd "$ROOT"
    umask 077
    bewijs_map="$ROOT/.release"
    bewijs_doel="$bewijs_map/golive-bewijs.json"
    mkdir -p "$bewijs_map"
    rm -f "$bewijs_map/live-kandidaat.json" "$bewijs_map/live-kandidaat-image-bewijs.json" \
      "$bewijs_map/live-kandidaat-runtime-bewijs.json" "$bewijs_map/pg-bewijs.json" \
      "$bewijs_map/keur.env" "$bewijs_map/keur-motor-state.key"
    release_commit="$(node scripts/live-kandidaat-bron.js)"
    release="$(printf '%s' "$release_commit" | cut -c1-12)"
    KEUR_PROJECT="rtg-keur-$release"
    RTG_KEUR_ENV_FILE="$bewijs_map/keur.env"
    RTG_KEUR_MOTOR_STATE_KEY_FILE="$bewijs_map/keur-motor-state.key"
    export RTG_KEUR_ENV_FILE RTG_KEUR_MOTOR_STATE_KEY_FILE
    node scripts/keur-omgeving.js "$RTG_KEUR_ENV_FILE" "$RTG_KEUR_MOTOR_STATE_KEY_FILE"
    RTG_KEUR_MOTOR_EXPECT_GENESIS="$(awk -F= '$1 == "RTG_MOTOR_EXPECT_GENESIS" { print $2; exit }' "$RTG_KEUR_ENV_FILE")"
    export RTG_KEUR_MOTOR_EXPECT_GENESIS
    trap 'keur_opruimen' EXIT
    trap 'exit 129' HUP
    trap 'exit 130' INT
    trap 'exit 143' TERM
    export RTG_RELEASE_COMMIT="$release_commit"
    RTG_LIVE_ENV_FILE="$LIVE_ENV" node scripts/docker/controle.js --publiek
    keur_compose config --quiet
    # Productie keurt uitsluitend de unieke, in CI gebouwde en ondertekende
    # registrykandidaten. Een lokale herbouw kan dezelfde broncommit noemen
    # maar andere base-imagebytes bevatten en is daarom geen uitrolinvoer.
    kandidaat="$(lees RTG_CANDIDATE_IMAGE)"
    kandidaat_backup="$(lees RTG_CANDIDATE_BACKUP_IMAGE)"
    [ -n "$kandidaat" ] && [ -n "$kandidaat_backup" ] || {
      echo "[live] RTG_CANDIDATE_IMAGE en RTG_CANDIDATE_BACKUP_IMAGE ontbreken" >&2
      exit 78
    }
    docker pull "$kandidaat"
    docker pull "$kandidaat_backup"
    kandidaat_id="$(docker image inspect --format='{{.Id}}' "$kandidaat")"
    kandidaat_backup_id="$(docker image inspect --format='{{.Id}}' "$kandidaat_backup")"
    kandidaat_registry="$(docker image inspect --format='{{index .RepoDigests 0}}' "$kandidaat")"
    backup_registry="$(docker image inspect --format='{{index .RepoDigests 0}}' "$kandidaat_backup")"
    kandidaat_repo="${kandidaat%:*}"
    backup_repo="${kandidaat_backup%:*}"
    case "$kandidaat_registry" in "$kandidaat_repo"@sha256:*) ;; *)
      echo "[live] kandidaat heeft geen bij zijn registry horende immutable digest" >&2; exit 65;; esac
    case "$backup_registry" in "$backup_repo"@sha256:*) ;; *)
      echo "[live] backupkandidaat heeft geen bij zijn registry horende immutable digest" >&2; exit 65;; esac
    kandidaat_digest="${kandidaat_registry#*@}"
    backup_digest="${backup_registry#*@}"
    # Verifieer de digest en de getekende herkomst VOORDAT code of zelfs een
    # hulpprogramma uit het kandidaatimage wordt uitgevoerd. De geverifieerde
    # hostkopie van het inhoudsbewijs kwam uit hetzelfde CI-artefact.
    image_inhoud="$(node -e 'const j=require(process.argv[1]);process.stdout.write(j.inhoudSha256||"")' \
      "$bewijs_map/image-release-bewijs.json")"
    case "$image_inhoud" in *[!a-f0-9]*|'')
      echo "[live] CI-artefact mist een geldige runtime-inhoudshash" >&2; exit 65;; esac
    [ "${#image_inhoud}" -eq 64 ] || {
      echo "[live] CI-artefact mist een geldige runtime-inhoudshash" >&2; exit 65;
    }
    node scripts/imageherkomst.js --controle --eis-kandidaat \
      --herkomst=.release/herkomst.json --sbom=.release/sbom.json \
      --image="$kandidaat" --draait="$kandidaat_digest" --commit="$release_commit" \
      --bewijs-inhoud="$image_inhoud"
    node scripts/imageherkomst.js --controle --eis-kandidaat \
      --herkomst=.release/herkomst-backup.json --sbom=.release/sbom-backup.json \
      --image="$kandidaat_backup" --draait="$backup_digest" --commit="$release_commit" \
      --bewijs-inhoud="$image_inhoud"
    docker run --rm --entrypoint node "$kandidaat_registry" \
      scripts/release-bewijs.js --controle /app/release-bewijs.json
    bewijs_tmp="$(mktemp "$bewijs_map/.image-bewijs.XXXXXX")"
    docker run --rm --entrypoint cat "$kandidaat_registry" /app/release-bewijs.json > "$bewijs_tmp"
    ingebakken_inhoud="$(node -e 'const j=require(process.argv[1]);process.stdout.write(j.inhoudSha256||"")' \
      "$bewijs_tmp")"
    [ "$ingebakken_inhoud" = "$image_inhoud" ] || {
      rm -f "$bewijs_tmp"
      echo "[live] ingebakken runtimebewijs wijkt af van de getekende CI-herkomst" >&2
      exit 65
    }
    cmp -s "$bewijs_tmp" "$bewijs_map/image-release-bewijs.json" || {
      rm -f "$bewijs_tmp"
      echo "[live] ingebakken runtimebewijs wijkt byte-voor-byte af van het CI-imageartefact" >&2
      exit 65
    }
    mv "$bewijs_tmp" "$bewijs_map/live-kandidaat-image-bewijs.json"
    IMAGE="$kandidaat_registry"
    BACKUP_IMAGE="$backup_registry"
    # De kandidaat krijgt een eigen projectvolume. Alleen deze expliciete
    # golive-handeling initialiseert het; `up` en een restart doen dat nooit.
    keur_compose run --rm --no-deps --entrypoint /app/rtg-motor keurmotor init-state
    keur_compose --profile release up -d --no-build --wait \
      keurpostgres keurredis keurclamav keurmotor keurapp
    if ! keur_compose exec -T keurapp node scripts/sonde.js http://127.0.0.1:3000; then
      echo "[live] het werkelijk gestarte kandidaatproces zakte voor zijn SLO-reis" >&2
      exit 1
    fi
    keurapp_container="$(keur_compose ps -q keurapp)"
    keurapp_image_id="$(docker inspect --format='{{.Image}}' "$keurapp_container")"
    node scripts/live-kandidaat.js --runtime-bewijs --commit="$release_commit" \
      --verwachte-image-id="$kandidaat_id" --image-id="$keurapp_image_id" \
      --image-verwijzing="$kandidaat" --image-digest="$kandidaat_digest" \
      --inhoud-sha256="$image_inhoud"
    # Herhaal de duurzaamheidsproef IN exact het kandidaatimage. De gecommitte
    # testboom is alleen-lezen gemount; een broncheck na de ronde sluit ook een
    # wijziging tijdens deze langdurige proef uit.
    pg_status=0
    pg_uitvoer="$(keur_compose run --rm --no-deps \
      --volume "$ROOT/test:/app/test:ro" \
      keurapp node scripts/pgtoetsen.js --bewijs-stdout 2>&1)" || pg_status=$?
    printf '%s\n' "$pg_uitvoer" | sed '/^RTG_PG_BEWIJS_JSON=/d'
    pg_json="$(printf '%s\n' "$pg_uitvoer" | sed -n 's/^RTG_PG_BEWIJS_JSON=//p')"
    [ -n "$pg_json" ] || {
      echo "[live] kandidaat gaf geen commitgebonden PostgreSQL/Redis-bewijs terug" >&2
      exit 70
    }
    bewijs_tmp="$(mktemp "$bewijs_map/.pg-bewijs.XXXXXX")"
    printf '%s\n' "$pg_json" > "$bewijs_tmp"
    if ! node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(j.formaat!=="rtg-pg-bewijs-v1"||j.geslaagd!==true||j.tapVolledig!==true||j.mislukt!==0||j.geannuleerd!==0||j.overgeslagen!==0||j.todo!==0)process.exit(1)' "$bewijs_tmp"; then
      rm -f "$bewijs_tmp"
      echo "[live] ontvangen PostgreSQL/Redis-bewijs heeft een ongeldig contract" >&2
      exit 70
    fi
    mv "$bewijs_tmp" "$bewijs_map/pg-bewijs.json"
    [ "$pg_status" -eq 0 ] || {
      exit "$pg_status"
    }
    status=0
    uitvoer="$(keur_compose run --rm --no-deps \
      keurgolive node scripts/golive.js --bewijs-stdout 2>&1)" || status=$?
    printf '%s\n' "$uitvoer" | sed '/^RTG_GOLIVE_BEWIJS_JSON=/d'
    bewijs_json="$(printf '%s\n' "$uitvoer" | sed -n 's/^RTG_GOLIVE_BEWIJS_JSON=//p')"
    [ -n "$bewijs_json" ] || {
      echo "[live] go-live-keuring gaf geen geldig overdraagbaar bewijs terug" >&2
      exit 70
    }
    bewijs_tmp="$(mktemp "$bewijs_map/.golive-bewijs.XXXXXX")"
    printf '%s\n' "$bewijs_json" > "$bewijs_tmp"
    if ! node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(j.formaat!=="rtg-golive-bewijs-v1"||typeof j.geslaagd!=="boolean"||!Number.isInteger(j.blokkers))process.exit(1)' "$bewijs_tmp"; then
      rm -f "$bewijs_tmp"
      echo "[live] ontvangen go-live-bewijs heeft een ongeldig contract" >&2
      exit 70
    fi
    mv "$bewijs_tmp" "$bewijs_doel"
    echo "[live] go-live-bewijs host-side bewaard: .release/golive-bewijs.json"
    [ "$status" -eq 0 ] || exit "$status"
    keur_opruimen
    trap - EXIT HUP INT TERM
    release_commit_na="$(node scripts/live-kandidaat-bron.js)"
    [ "$release_commit_na" = "$release_commit" ] || {
      echo "[live] releasebron veranderde tijdens de kandidaatkeuring" >&2; exit 65;
    }
    node scripts/live-kandidaat.js --maak --commit="$release_commit" \
      --image-verwijzing="$kandidaat" --image-digest="$kandidaat_digest" \
      --image-id="$kandidaat_id" --backup-verwijzing="$kandidaat_backup" \
      --backup-digest="$backup_digest" --backup-id="$kandidaat_backup_id"
    echo "[live] kandidaat is intern groen; maak nu PRODUCTION_STATUS=READY vóór live:deploy"
    ;;
  probe)
    [ -n "$APP_URL" ] || { echo "[live] APP_URL ontbreekt in $PRODUCTIE_ENV" >&2; exit 78; }
    cd "$ROOT"
    mkdir -p .release
    # Bind het externe TLS-bewijs aan de commit uit het werkelijk draaiende,
    # read-only imagebewijs. Een losse werkboom-HEAD zegt niet wat er live staat.
    probe_commit="$(compose exec -T app node -e '
      const j=require("/app/release-bewijs.json");
      const c=String(j&&j.bron&&j.bron.commit||"").toLowerCase();
      if(!/^[a-f0-9]{40,64}$/.test(c))process.exit(1);
      process.stdout.write(c);
    ' 2>/dev/null)" || { echo "[live] draaiend image gaf geen geldige releasecommit" >&2; exit 65; }
    RTG_RELEASE_COMMIT="$probe_commit" node scripts/publieke-tls-proef.js "$APP_URL" \
      --eis-release-commit --bewijs=.release/publieke-tls-bewijs.json
    node scripts/sonde.js "$APP_URL"
    node scripts/rand.js "$APP_URL"
    ;;
  backup)
    compose run --rm -e RTG_BACKUP_ONCE=1 backup
    ;;
  rollback)
    [ -r "$ROLLBACK_STATE" ] || { echo "[live] geen bewezen rollbackset beschikbaar" >&2; exit 66; }
    IMAGE="$(sed -n '1p' "$ROLLBACK_STATE")"
    BACKUP_IMAGE="$(sed -n '2p' "$ROLLBACK_STATE")"
    RTG_RELEASE_BEWIJS_SHA256="$(sed -n '3p' "$ROLLBACK_STATE")"
    export RTG_RELEASE_BEWIJS_SHA256
    geldige_rollbackset "$IMAGE" "$BACKUP_IMAGE" "$RTG_RELEASE_BEWIJS_SHA256" || {
      echo "[live] rollbackset of zijn bewijs-pin is beschadigd" >&2; exit 65;
    }
    compose up -d --no-build motor app sentinel backup
    wacht_ready && probe_lokaal
    printf '%s\n%s\n%s\n' "$IMAGE" "$BACKUP_IMAGE" "$RTG_RELEASE_BEWIJS_SHA256" > "$STATE"
    echo "[live] volledige immutable rollbackset actief"
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
