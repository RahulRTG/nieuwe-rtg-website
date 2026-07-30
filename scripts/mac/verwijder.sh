#!/bin/bash
# Haalt de RTG-launchd-service weg. De server stopt en start niet meer mee bij
# het opstarten van de machine.
#
#   sudo scripts/mac/verwijder.sh
#
# Wat dit script met opzet NIET weghaalt:
#   - het geheimenbestand (/usr/local/etc/rtg/rtg.env). Daar staat RTG_VAULT_KEY
#     in; zonder die sleutel zijn alle namen en e-mailadressen in de kluis
#     onleesbaar, ook uit een back-up. Weggooien doe je zelf, bewust.
#   - de database in server/data.
#   - het logboek in /usr/local/var/log/rtg.
# Het script zegt aan het eind waar die staan.
set -euo pipefail

LABEL="nl.rtg.server"
PLIST="/Library/LaunchDaemons/$LABEL.plist"
ENVBESTAND="${RTG_ENV_BESTAND:-/usr/local/etc/rtg/rtg.env}"
LOGMAP="/usr/local/var/log/rtg"

[ "$(uname -s)" = "Darwin" ] || { echo "FOUT: dit script is voor macOS." >&2; exit 1; }
[ "$(id -u)" = "0" ] || { echo "FOUT: draai dit met sudo: sudo $0" >&2; exit 1; }

if launchctl print "system/$LABEL" >/dev/null 2>&1; then
  launchctl bootout "system/$LABEL" || true
  echo "   service gestopt en uitgeladen"
else
  echo "   service was niet geladen"
fi

if [ -f "$PLIST" ]; then
  rm -f "$PLIST"
  echo "   verwijderd: $PLIST"
else
  echo "   geen plist gevonden op $PLIST"
fi

echo
echo "Blijven staan (bewust):"
if [ -f "$ENVBESTAND" ]; then echo "   $ENVBESTAND   <- de sleutels; hier zit RTG_VAULT_KEY in"; fi
if [ -d "$LOGMAP" ]; then echo "   $LOGMAP   <- het logboek"; fi
echo "   de database in server/data van de repo"
echo
echo "Opnieuw installeren kan met: sudo scripts/mac/installeer.sh"
