#!/bin/bash
# Startwikkel voor de launchd-service op macOS.
#
# Waarom er een wikkel tussen zit en launchd niet gewoon node aanroept:
#
#  1. GEHEIMEN HOREN NIET IN HET PLIST. Een plist in /Library/LaunchDaemons is
#     voor iedereen op de machine leesbaar (644, root:wheel). Zou RTG_ENC_KEY of
#     RTG_VAULT_KEY daar in de EnvironmentVariables staan, dan kan elke
#     gebruiker `cat` doen en is de versleuteling-in-rust waardeloos. De
#     geheimen staan daarom in een apart bestand met rechten 600, dat alleen de
#     draaiende gebruiker mag lezen; dit script leest dat in.
#  2. launchd geeft een daemon een kale PATH (/usr/bin:/bin:/usr/sbin:/sbin).
#     Node uit Homebrew (/opt/homebrew/bin op Apple Silicon) zit daar niet in,
#     dus die zoeken we hier zelf op.
#  3. Node 22 of hoger is nodig (de server draait op --experimental-sqlite).
#     Beter hier meteen een duidelijke regel in het logboek dan een cryptische
#     crash-lus.
#
# Handmatig te gebruiken:
#   scripts/mac/rtg-start.sh              start de server op de voorgrond
#   scripts/mac/rtg-start.sh --keuring    leest de omgeving, keurt de config
#                                         en stopt (start dus niets)
set -euo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HIER/../.." && pwd)"
ENVBESTAND="${RTG_ENV_BESTAND:-/usr/local/etc/rtg/rtg.env}"
KEURING=0
if [ "${1:-}" = "--keuring" ]; then KEURING=1; fi

zeg() { echo "[rtg-start] $*"; }
stuk() { echo "[rtg-start] FOUT: $*" >&2; exit 78; }   # 78 = EX_CONFIG

# ---------- 1. de geheimen inlezen ----------
# Bewust GEEN `source` / `.` van het bestand: dan zou $(...) of `rm -rf` in dat
# bestand als root-in-wording worden uitgevoerd, en zou een regel met een
# wachtwoord vol speciale tekens (SMTP!) door de shell worden verminkt. We
# lezen regel voor regel en zetten de waarde letterlijk in de omgeving.
if [ ! -f "$ENVBESTAND" ]; then
  stuk "geen omgevingsbestand op $ENVBESTAND. Draai scripts/mac/installeer.sh."
fi

if [ "$(uname -s)" = "Darwin" ]; then
  rechten="$(stat -f '%Lp' "$ENVBESTAND" 2>/dev/null || echo '')"
else
  rechten="$(stat -c '%a' "$ENVBESTAND" 2>/dev/null || echo '')"
fi
if [ -n "$rechten" ] && [ "$rechten" != "600" ]; then
  if chmod 600 "$ENVBESTAND" 2>/dev/null; then
    zeg "rechten van $ENVBESTAND waren $rechten; teruggezet naar 600."
  else
    zeg "LET OP: $ENVBESTAND heeft rechten $rechten en is dus breder leesbaar dan alleen de eigenaar."
  fi
fi

regelnr=0
while IFS= read -r regel || [ -n "$regel" ]; do
  regelnr=$((regelnr + 1))
  case "$regel" in
    ''|'#'*) continue ;;
    export\ *) regel="${regel#export }" ;;
  esac
  case "$regel" in
    *=*) ;;
    *) continue ;;
  esac
  naam="${regel%%=*}"
  waarde="${regel#*=}"
  # alleen echte variabelenamen, zodat een verdwaalde regel niets raars doet
  case "$naam" in
    [A-Za-z_]*) ;;
    *) zeg "regel $regelnr overgeslagen (geen geldige naam)"; continue ;;
  esac
  case "$naam" in
    *[!A-Za-z0-9_]*) zeg "regel $regelnr overgeslagen (geen geldige naam)"; continue ;;
  esac
  # omhullende aanhalingstekens weghalen, verder niets interpreteren
  case "$waarde" in
    \"*\") waarde="${waarde#\"}"; waarde="${waarde%\"}" ;;
    \'*\') waarde="${waarde#\'}"; waarde="${waarde%\'}" ;;
  esac
  export "$naam=$waarde"
done < "$ENVBESTAND"

# ---------- 2. node zoeken ----------
# Homebrew ACHTERAAN: launchd geeft een daemon een kale PATH zonder node, dus
# achteraan is genoeg om hem te vinden. Vooraan zou een oude node in
# /usr/local/bin een nieuwere uit de eigen PATH kunnen overschaduwen.
export PATH="${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}:/opt/homebrew/bin:/usr/local/bin"
NODE="${RTG_NODE:-}"
if [ -z "$NODE" ] || [ ! -x "$NODE" ]; then
  NODE="$(command -v node 2>/dev/null || true)"
fi
[ -n "$NODE" ] || stuk "node niet gevonden. Installeer Node 22+ (brew install node) of zet RTG_NODE in het plist."

major="$("$NODE" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$major" -lt 22 ]; then
  stuk "node $("$NODE" -v) is te oud; de server heeft 22 of hoger nodig (--experimental-sqlite)."
fi

cd "$REPO"

# ---------- 3. keuren of starten ----------
if [ "$KEURING" = "1" ]; then
  zeg "node $("$NODE" -v) op $NODE, repo $REPO, omgeving $ENVBESTAND"
  exec "$NODE" -e '
    const r = require("./server/config").valideer(process.env);
    for (const w of r.waarschuwingen) console.log("  waarschuwing: " + w);
    for (const f of r.fouten) console.error("  FOUT: " + f);
    console.log(r.fouten.length ? "keuring: " + r.fouten.length + " blokkerende fout(en)" : "keuring: in orde");
    process.exit(r.fouten.length ? 1 : 0);
  '
fi

zeg "start RTG op poort ${PORT:-3000} met node $("$NODE" -v)"
exec "$NODE" server/trio.js
