#!/bin/bash
# Installeert RTG Kompas als lokale, GPU-versnelde Ollama-service op macOS.
# Geen sudo, geen API-sleutel, geen publieke poort. Standaardmodel: qwen3.5:4b.
#
#   scripts/mac/ollama-kompas.sh
#   scripts/mac/ollama-kompas.sh --controle
#   scripts/mac/ollama-kompas.sh --model=qwen3.5:4b
set -euo pipefail

LABEL="nl.rtg.ollama"
MODEL="qwen3.5:4b"
NAAM="rtg-kompas"
CONTROLE=0
HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MATERIAAL="$HIER/ollama"

zeg() { echo "[rtg-kompas] $*"; }
stuk() { echo "[rtg-kompas] FOUT: $*" >&2; exit 1; }

for arg in "$@"; do
  case "$arg" in
    --controle) CONTROLE=1 ;;
    --model=*) MODEL="${arg#*=}" ;;
    -h|--help) awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$0"; exit 0 ;;
    *) stuk "onbekende optie: $arg" ;;
  esac
done

[ "$(uname -s)" = "Darwin" ] || stuk "dit installatiepad is alleen voor macOS."
command -v brew >/dev/null 2>&1 || stuk "Homebrew ontbreekt; installeer eerst Homebrew."

if ! brew list --versions ollama >/dev/null 2>&1; then
  zeg "Ollama installeren via Homebrew"
  brew install ollama
fi
OLLAMA="$(brew --prefix ollama)/bin/ollama"
[ -x "$OLLAMA" ] || stuk "Ollama-binary niet gevonden op $OLLAMA"

PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/rtg-ollama.log"
CONFIG="$HOME/.ollama/server.json"

controleer() {
  curl -fsS --max-time 3 http://127.0.0.1:11434/api/version >/dev/null || stuk "Ollama antwoordt niet op loopback."
  if lsof -nP -iTCP:11434 -sTCP:LISTEN 2>/dev/null | tail -n +2 | grep -v '127.0.0.1:11434' >/dev/null; then
    stuk "poort 11434 luistert niet uitsluitend op 127.0.0.1."
  fi
  grep -q 'Ollama cloud disabled: true' "$LOG" || stuk "cloud-uit kon niet in het logboek worden bewezen."
  grep -q 'library=Metal' "$LOG" || stuk "Metal/GPU kon niet in het logboek worden bewezen."
  "$OLLAMA" list | grep -q "^$NAAM" || stuk "model $NAAM ontbreekt."
  zeg "gereed: loopback, cloud-uit, Metal en $NAAM zijn bewezen."
}

if [ "$CONTROLE" = "1" ]; then controleer; exit 0; fi

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs" "$HOME/.ollama"
chmod 700 "$HOME/.ollama"

# Bewaar eventuele toekomstige Ollama-instellingen, maar forceer de harde
# privacygrens. Node is al een vereiste van de RTG-server.
CONFIG_TMP="$(mktemp "$HOME/.ollama/server.XXXXXX")"
node - "$CONFIG" "$CONFIG_TMP" <<'NODE'
const fs = require('fs');
const [bron, doel] = process.argv.slice(2);
let inhoud = {};
try { inhoud = JSON.parse(fs.readFileSync(bron, 'utf8')); } catch (_) {}
inhoud.disable_ollama_cloud = true;
fs.writeFileSync(doel, JSON.stringify(inhoud, null, 2) + '\n', { mode: 0o600 });
NODE
mv "$CONFIG_TMP" "$CONFIG"
chmod 600 "$CONFIG"

PLIST_TMP="$(mktemp "${TMPDIR:-/tmp}/rtg-ollama.XXXXXX")"
inhoud="$(cat "$MATERIAAL/nl.rtg.ollama.plist.sjabloon")"
inhoud="${inhoud//@@HOME@@/$HOME}"
inhoud="${inhoud//@@OLLAMA@@/$OLLAMA}"
printf '%s\n' "$inhoud" > "$PLIST_TMP"
plutil -lint "$PLIST_TMP" >/dev/null || stuk "het gegenereerde plist is ongeldig."

launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
mv "$PLIST_TMP" "$PLIST"
chmod 600 "$PLIST"
launchctl bootstrap "gui/$(id -u)" "$PLIST"

for poging in 1 2 3 4 5 6 7 8 9 10; do
  curl -fsS --max-time 2 http://127.0.0.1:11434/api/version >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS --max-time 3 http://127.0.0.1:11434/api/version >/dev/null || stuk "de lokale server startte niet. Zie $LOG"

zeg "$MODEL downloaden"
"$OLLAMA" pull "$MODEL"
zeg "$NAAM bouwen met de RTG-veiligheidsgrenzen"
"$OLLAMA" create "$NAAM" -f "$MATERIAAL/Modelfile.rtg-kompas"
controleer

cat <<EOF

Zet deze niet-geheime regels in de omgeving van de RTG-server en herstart hem:

LOCAL_AI_URL=http://127.0.0.1:11434
LOCAL_AI_MODEL=$NAAM
LOCAL_AI_MODEL_KORT=$NAAM
LOCAL_AI_MODEL_TOOLS=$NAAM
LOCAL_AI_MODEL_VISION=$NAAM
LOCAL_AI_REASONING=none
LOCAL_AI_REASONING_TOOLS=none
RTG_EXTERNE_AI_UIT=1
AI_VOLGORDE=local

Daarna: npm run ai:lokaal:check
EOF
