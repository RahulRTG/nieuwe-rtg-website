#!/bin/sh
# Expliciete, eenmalige operatorhandeling. Normale start/restart roept dit
# script nooit aan en maakt dus nooit een nieuwe geldwaarheid.
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
ENV_PAD="${RTG_PRODUCTIE_ENV_FILE:-$ROOT/.env.productie}"
LIVE_ENV="${RTG_LIVE_ENV_FILE:-$ROOT/deploy/live.env}"
SLEUTEL_PAD="${RTG_MOTOR_STATE_KEY_SECRET_FILE:-}"
if [ -z "$SLEUTEL_PAD" ] && [ -r "$LIVE_ENV" ]; then
  SLEUTEL_PAD="$(awk -F= '$1 == "RTG_MOTOR_STATE_KEY_SECRET_FILE" { sub(/^[^=]*=/, ""); print; exit }' "$LIVE_ENV")"
fi
SLEUTEL_PAD="${SLEUTEL_PAD:-$ROOT/.rtg-secrets/motor_state_key}"
case "$ENV_PAD" in /*) ;; *) ENV_PAD="$ROOT/$ENV_PAD" ;; esac
case "$SLEUTEL_PAD" in /*) ;; *) SLEUTEL_PAD="$ROOT/$SLEUTEL_PAD" ;; esac

compose() {
  RTG_ENV_FILE="$ENV_PAD" RTG_MOTOR_STATE_KEY_SECRET_FILE="$SLEUTEL_PAD" \
    docker compose --env-file "$ENV_PAD" -f "$ROOT/docker-compose.yml" "$@"
}

motor_id="$(compose ps -q motor 2>/dev/null || true)"
if [ -n "$motor_id" ] && [ "$(docker inspect --format='{{.State.Running}}' "$motor_id")" = "true" ]; then
  echo "[motor-init] stop eerst de actieve motor; initialisatie is uitsluitend offline toegestaan" >&2
  exit 73
fi

genesis="$(node "$ROOT/scripts/motor-initialisatie.js" --env="$ENV_PAD" --sleutel="$SLEUTEL_PAD")"
compose run --rm --no-deps --entrypoint /app/rtg-motor \
  -e "RTG_MOTOR_EXPECT_GENESIS=$genesis" motor init-state
echo "[motor-init] geldvolume eenmalig gemaakt en gebonden aan $genesis"
