#!/usr/bin/env bash
#
# De RTG-server starten, met de versleutelsleutel uit de sleutelhanger.
#
# WAAROM DIT BESTAAT. De data in server/data/store.db staat versleuteld op
# schijf, en de sleutel komt uit RTG_ENC_KEY in de omgeving. Die sleutel stond
# een tijd lang NERGENS anders dan in het geheugen van het draaiende proces:
# wie dat proces stopte, gooide de sleutel weg en kreeg een server die weigerde
# te starten -- terecht, want zonder sleutel is de data onleesbaar. Dat is een
# keer echt gebeurd, en toen was de site uit de lucht.
#
# Nu staat hij in de sleutelhanger van de Mac (Keychain), versleuteld en achter
# je aanmelding. Dit script haalt hem daar op en geeft hem aan de server mee.
# Hij komt nooit in een bestand, nooit in de git-map en nooit in beeld.
#
# Opnieuw opbergen (bijvoorbeeld na een sleutelwissel):
#   security add-generic-password -a rtg -s RTG_ENC_KEY -U -w
#   (zonder waarde erachter: dan vraagt hij hem, en typt niemand hem in beeld)
#
# Gebruik:  bash bin/rtg-start.sh
# Stoppen:  pkill -f "node server/trio.js"

set -e
cd "$(dirname "$0")/.."

SLEUTEL=$(security find-generic-password -a rtg -s RTG_ENC_KEY -w 2>/dev/null || true)
if [ -z "$SLEUTEL" ]; then
  echo "FOUT: geen RTG_ENC_KEY in de sleutelhanger."
  echo "      Zonder die sleutel start de server niet, en dat hoort ook zo:"
  echo "      hij weigert liever dan onleesbare data te serveren."
  echo "      Berg hem op met: security add-generic-password -a rtg -s RTG_ENC_KEY -U -w"
  exit 1
fi

# een draaiende server eerst netjes stoppen, anders vecht de nieuwe om de poort
pkill -f "node server/trio.js" 2>/dev/null || true
sleep 2

export RTG_ENC_KEY="$SLEUTEL"
exec node server/trio.js
