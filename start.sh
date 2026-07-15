#!/usr/bin/env bash
#
# RTG demo starten op je eigen computer.
#
# Wat dit script doet:
#   1. Haalt onze laatste wijzigingen op (git pull).
#   2. Zet ontbrekende pakketten klaar (npm install, alleen als het nodig is).
#   3. Start de server in demo-modus op http://localhost:3000
#
# Gebruik:  ./start.sh
# Stoppen:  Ctrl + C
#
set -e

cd "$(dirname "$0")"

echo ""
echo "==> Laatste wijzigingen ophalen..."
git pull --ff-only || echo "    (kon niet pullen, ga verder met wat er lokaal staat)"

# node_modules ontbreekt of package.json is nieuwer? Dan installeren.
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
  echo ""
  echo "==> Pakketten installeren..."
  npm install
fi

echo ""
echo "==> Server starten in demo-modus"
echo "    Open in je browser:  http://localhost:3000"
echo "    Inloggen kan met de demo-accounts (Rahul / Imran)."
echo "    Stoppen: druk op Ctrl + C"
echo ""

# RTG_DEMO=1 zet de demo-inlog open. De server herstart zichzelf met de
# juiste Node-vlag, dus 'node server/server.js' is genoeg.
RTG_DEMO=1 node server/server.js
