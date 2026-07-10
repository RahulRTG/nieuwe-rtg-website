#!/bin/bash
# RTG lokaal starten, gewoon dubbelklikken.
# Dit venster mag openblijven zolang je de site gebruikt. Sluiten = stoppen.

cd "$(dirname "$0")" || exit 1

echo ""
echo "  Rahul Travel Group, lokaal opstarten"
echo "  --------------------------------------"

# Node aanwezig?
if ! command -v npm >/dev/null 2>&1; then
  echo ""
  echo "  Node.js is nog niet geinstalleerd."
  echo "  Download de LTS-versie op https://nodejs.org, installeer die,"
  echo "  en dubbelklik daarna dit bestand opnieuw."
  echo ""
  read -r -p "  Druk op Enter om te sluiten. " _
  exit 1
fi

# Pakketten eenmalig installeren
if [ ! -d node_modules ]; then
  echo "  Eenmalig installeren (dit duurt even)..."
  npm install || { echo "  Installeren mislukt."; read -r -p "  Enter om te sluiten. " _; exit 1; }
fi

# Browser automatisch openen zodra de server er is
( sleep 3 && open "http://localhost:3000" ) >/dev/null 2>&1 &

echo ""
echo "  De site draait zo op:  http://localhost:3000"
echo "  Dit venster openlaten. Stoppen doe je met Ctrl+C of het venster sluiten."
echo ""

npm start
