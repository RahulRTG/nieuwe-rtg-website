#!/bin/bash
# Zet RTG online via een Cloudflare Tunnel, zonder ook maar een poort in je
# router open te zetten. De Mac maakt zelf een uitgaande verbinding naar
# Cloudflare; al het verkeer komt daar binnen en gaat door die verbinding naar
# 127.0.0.1:3000. Werkt achter elke provider, ook zonder vast IP-adres en ook
# achter CGNAT.
#
# Draaien (na installeer.sh, dus als de site al lokaal draait):
#   cloudflared tunnel login                      # eenmalig, opent je browser
#   sudo scripts/mac/tunnel.sh --domein=rtg.voorbeeld.nl
#
# Opties:
#   --domein=NAAM     het publieke adres (verplicht)
#   --naam=NAAM       naam van de tunnel (standaard: rtg)
#   --poort=NUMMER    waar RTG lokaal luistert (standaard 3000)
#   --env=PAD         het geheimenbestand (standaard /usr/local/etc/rtg/rtg.env)
#   --geen-start      alles klaarzetten, de dienst niet laden
#
# Waarom dit veilig samengaat met de app:
#
#   TLS blijft bij Cloudflare. RTG_TLS hoort UIT te staan; de app praat gewoon
#   http op de loopback en cloudflared vertelt hem met X-Forwarded-Proto dat de
#   bezoeker over https binnenkwam. Zet je RTG_TLS toch aan, dan praten twee
#   partijen tegelijk TLS en werkt er niets.
#
#   De doorstuurkoppen worden hier wel vertrouwd, en dat is geen aanname:
#   cloudflared draait op DEZE machine en verbindt vanaf 127.0.0.1. De app
#   vertrouwt X-Forwarded-* alleen van een privaat adres (server/web/verrijk.js),
#   dus precies in dit geval klopt het. Zou de tunnel op een andere machine
#   draaien, dan hoort daar RTG_PROXY_IPS bij.
set -euo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.cloudflare.cloudflared"
DOMEIN=""
NAAM="rtg"
POORT="3000"
ENVBESTAND="/usr/local/etc/rtg/rtg.env"
STARTEN=1

kop() { echo; echo "== $* =="; }
zeg() { echo "   $*"; }
stuk() { echo; echo "FOUT: $*" >&2; exit 1; }

for arg in "$@"; do
  case "$arg" in
    --domein=*) DOMEIN="${arg#*=}" ;;
    --naam=*)   NAAM="${arg#*=}" ;;
    --poort=*)  POORT="${arg#*=}" ;;
    --env=*)    ENVBESTAND="${arg#*=}" ;;
    --geen-start) STARTEN=0 ;;
    *) stuk "onbekende optie: $arg" ;;
  esac
done

[ -n "$DOMEIN" ] || stuk "geef het publieke adres op, bijvoorbeeld --domein=rtg.voorbeeld.nl"
[ "$(id -u)" = "0" ] || stuk "draai dit met sudo (de dienst komt in /Library/LaunchDaemons)"

# wie draaide de sudo: onder dat account staat de cloudflared-login
ECHTE_GEBRUIKER="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"
THUIS="$(eval echo "~$ECHTE_GEBRUIKER")"

kop "1. Wat er al moet staan"

command -v cloudflared >/dev/null 2>&1 || stuk "cloudflared ontbreekt. Installeer hem met: brew install cloudflared"
zeg "cloudflared: $(cloudflared --version 2>&1 | head -1)"

# De login zet een certificaat in ~/.cloudflared. Zonder dat kan cloudflared
# geen tunnel aanmaken en ook geen DNS-record zetten; de foutmelding die hij
# dan geeft is nietszeggend, dus vangen we het hier af.
CERT="$THUIS/.cloudflared/cert.pem"
[ -f "$CERT" ] || stuk "nog niet ingelogd bij Cloudflare. Draai eerst, ZONDER sudo:
     cloudflared tunnel login
   Kies in je browser het domein waar $DOMEIN onder valt."
zeg "ingelogd: $CERT"

curl -fsS -m 5 "http://127.0.0.1:$POORT/api/health" >/dev/null 2>&1 \
  || stuk "RTG antwoordt niet op http://127.0.0.1:$POORT/api/health.
   Zet de site eerst lokaal aan de praat (scripts/mac/installeer.sh); een tunnel
   naar een server die niet draait geeft alleen maar een foutpagina op internet."
zeg "RTG antwoordt lokaal op poort $POORT"

kop "2. De tunnel"

# bestaat hij al? dan hergebruiken we hem: een tweede tunnel met dezelfde naam
# levert twee records die om beurten winnen, en dat is niet te debuggen
if sudo -u "$ECHTE_GEBRUIKER" cloudflared tunnel list 2>/dev/null | awk '{print $2}' | grep -qx "$NAAM"; then
  zeg "tunnel '$NAAM' bestaat al; die gebruiken we"
else
  sudo -u "$ECHTE_GEBRUIKER" cloudflared tunnel create "$NAAM"
  zeg "tunnel '$NAAM' aangemaakt"
fi
TUNNEL_ID="$(sudo -u "$ECHTE_GEBRUIKER" cloudflared tunnel list 2>/dev/null | awk -v n="$NAAM" '$2==n {print $1}' | head -1)"
[ -n "$TUNNEL_ID" ] || stuk "kon het id van tunnel '$NAAM' niet vinden"
zeg "id: $TUNNEL_ID"

kop "3. De configuratie"

mkdir -p /etc/cloudflared
CONFIG="/etc/cloudflared/config.yml"
cat > "$CONFIG" <<EOF
# Geschreven door scripts/mac/tunnel.sh. Handmatig aanpassen mag; dit script
# overschrijft het bestand wel bij een volgende run.
tunnel: $TUNNEL_ID
credentials-file: $THUIS/.cloudflared/$TUNNEL_ID.json

# originRequest: cloudflared praat http tegen de loopback. Geen TLS hier --
# dat doet Cloudflare aan de buitenkant. Zie de toelichting boven in dit script.
ingress:
  - hostname: $DOMEIN
    service: http://127.0.0.1:$POORT
    originRequest:
      # SSE (live updates) mag niet na 30 seconden worden afgekapt
      noTLSVerify: false
      connectTimeout: 10s
      # geen antwoord-buffering: anders komen live updates met horten en stoten
      disableChunkedEncoding: false
  # alles wat niet op $DOMEIN binnenkomt hoort hier niet
  - service: http_status:404
EOF
chmod 644 "$CONFIG"
zeg "geschreven: $CONFIG"

kop "4. Het DNS-record"

# route dns is idempotent zolang het record naar DEZE tunnel wijst; wijst het
# ergens anders heen, dan zegt cloudflared dat en laten we het staan
if sudo -u "$ECHTE_GEBRUIKER" cloudflared tunnel route dns "$NAAM" "$DOMEIN" 2>&1 | tee /tmp/rtg-route.log; then
  zeg "$DOMEIN wijst naar tunnel '$NAAM'"
else
  if grep -qi "already exists" /tmp/rtg-route.log; then
    zeg "er bestaat al een record voor $DOMEIN; laat staan wat er staat"
    zeg "controleer in het Cloudflare-dashboard dat het naar $TUNNEL_ID.cfargotunnel.com wijst"
  else
    stuk "het DNS-record zetten lukte niet; zie de melding hierboven"
  fi
fi

kop "5. Het publieke adres in de app"

# APP_URL staat in de e-mails die RTG verstuurt. Blijft daar http://...local
# staan, dan krijgt iedereen links die alleen bij jou thuis werken.
if [ -f "$ENVBESTAND" ]; then
  if grep -q '^APP_URL=' "$ENVBESTAND"; then
    HUIDIG="$(grep '^APP_URL=' "$ENVBESTAND" | head -1 | cut -d= -f2-)"
    if [ "$HUIDIG" = "https://$DOMEIN" ]; then
      zeg "APP_URL staat al goed"
    else
      zeg "LET OP: APP_URL staat nu op $HUIDIG"
      zeg "zet hem op https://$DOMEIN in $ENVBESTAND en herstart RTG:"
      zeg "  sudo launchctl kickstart -k system/nl.rtg.server"
    fi
  else
    zeg "APP_URL ontbreekt in $ENVBESTAND; zet erin: APP_URL=https://$DOMEIN"
  fi
  if grep -q '^RTG_TLS=1' "$ENVBESTAND"; then
    zeg "LET OP: RTG_TLS=1 staat aan. Achter een tunnel hoort dat UIT --"
    zeg "anders praten Cloudflare en de app allebei TLS en werkt er niets."
  fi
else
  zeg "geen $ENVBESTAND gevonden; sla deze stap over"
fi

if [ "$STARTEN" = "0" ]; then
  kop "Klaar (niet gestart)"
  zeg "Laden doe je met: sudo cloudflared service install"
  exit 0
fi

kop "6. cloudflared als dienst"

# service install leest /etc/cloudflared/config.yml en zet een LaunchDaemon neer,
# zodat de tunnel terugkomt na een herstart -- net als RTG zelf
if launchctl print "system/$LABEL" >/dev/null 2>&1; then
  zeg "de dienst draait al; opnieuw laden met de nieuwe configuratie"
  launchctl kickstart -k "system/$LABEL" || true
else
  cloudflared service install
  zeg "geinstalleerd als system/$LABEL"
fi

kop "7. Controleren"
gelukt=0
for poging in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl -fsS -m 5 "https://$DOMEIN/api/health" >/dev/null 2>&1; then gelukt=1; break; fi
  sleep 4
done
if [ "$gelukt" = "1" ]; then
  zeg "https://$DOMEIN/api/health antwoordt. RTG staat online."
else
  echo "   Nog geen antwoord van https://$DOMEIN binnen een minuut." >&2
  echo "   Dat kan aan de DNS liggen (even geduld) of aan de tunnel. Kijk mee met:" >&2
  echo "     sudo launchctl print system/$LABEL | head -20" >&2
  echo "     sudo tail -f /Library/Logs/com.cloudflare.cloudflared.err.log" >&2
fi

kop "Klaar"
zeg "Publiek adres:  https://$DOMEIN"
zeg "Tunnel:         $NAAM ($TUNNEL_ID)"
zeg "Configuratie:   $CONFIG"
zeg "Stoppen kan met: sudo launchctl bootout system/$LABEL"
