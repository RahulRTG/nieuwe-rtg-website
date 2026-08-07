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

# VIER SLEUTELS, en ze doen alle vier iets anders:
#   RTG_ENC_KEY     versleutelt de opgeslagen data (store.db)
#   RTG_VAULT_KEY   versleutelt de identiteitsgegevens EN maakt de zoek-hash van
#                   een e-mailadres. Verandert deze, dan wordt geen enkel
#                   bestaand account nog gevonden bij het inloggen.
#   RTG_SECRET_KEY  ondertekent de sessietokens
#   RTG_VAULT_RING  oudere kluissleutels, nieuwste eerst, zodat gegevens van
#                   voor een sleutelwissel leesbaar blijven
#
# DE REDEN DAT ZE HIER ALLE VIER STAAN. Ze zaten alleen in de omgeving van het
# draaiende proces, nergens anders. Toen dat proces stopte en opnieuw startte
# zonder die omgeving, verzon server/accounts/index.js er nieuwe -- stil, zonder
# waarschuwing. Elk bestaand account was daarmee in een klap onvindbaar, en het
# zag eruit als "mijn wachtwoord klopt niet meer".
for NAAM in RTG_ENC_KEY RTG_VAULT_KEY RTG_SECRET_KEY RTG_VAULT_RING; do
  WAARDE=$(security find-generic-password -a rtg -s "$NAAM" -w 2>/dev/null || true)
  if [ -z "$WAARDE" ]; then
    echo "FOUT: $NAAM staat niet in de sleutelhanger."
    echo "      Starten zonder deze sleutel maakt bestaande accounts onvindbaar."
    echo "      Berg hem op met: security add-generic-password -a rtg -s $NAAM -U -w"
    exit 1
  fi
  export "$NAAM=$WAARDE"
done
SLEUTEL="$RTG_ENC_KEY"

# een draaiende server eerst netjes stoppen, anders vecht de nieuwe om de poort
pkill -f "node server/trio.js" 2>/dev/null || true
sleep 2

exec node server/trio.js
