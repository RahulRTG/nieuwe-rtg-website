#!/bin/bash
# Zet een verse websessie meteen aan het werk: afhankelijkheden klaar en de
# ontwikkelserver draaiend op poort 3000. Alleen in de externe omgeving; op een
# eigen machine bepaal je zelf wanneer de server aan gaat.
#
# Veilig om vaker te draaien: staat er al iets op 3000, dan blijft dat staan.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# Het project draait op de standaardbibliotheek van Node; alleen stripe staat
# als optionele afhankelijkheid genoteerd. install is daarmee kort en veilig.
npm install --no-audit --no-fund >/dev/null 2>&1 || true

leeft() {
  curl -fsS -o /dev/null --max-time 2 http://127.0.0.1:3000/api/ready 2>/dev/null
}

if leeft; then
  echo "Ontwikkelserver draaide al op http://localhost:3000"
  exit 0
fi

# npm start is server/trio.js: drie servers achter een poortwachter die een
# omgevallen server zelf herstart. Losgekoppeld starten, zodat de hook klaar is
# terwijl de server blijft draaien.
LOG="${TMPDIR:-/tmp}/rtg-server.log"
setsid nohup npm start >"$LOG" 2>&1 </dev/null &
disown || true

# Even wachten tot hij antwoordt: de trio heeft een paar seconden nodig.
for _ in $(seq 1 30); do
  if leeft; then
    echo "Ontwikkelserver draait op http://localhost:3000"
    exit 0
  fi
  sleep 1
done

echo "Ontwikkelserver kwam niet binnen 30 seconden omhoog; zie $LOG" >&2
exit 0
