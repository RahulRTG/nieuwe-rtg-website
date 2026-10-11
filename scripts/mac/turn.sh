#!/bin/bash
# Het TURN-relais van RTG op DEZE Mac (docs/turn-server.md par. 2b).
#
# Bedoeld voor zolang de Mac mini de server is. Een VPS is de blijvende plek
# (scripts/turn/vps.js); de configuratie is in beide gevallen dezelfde
# (scripts/turn/maak-config.js), dus verhuizen is een andere TURN_URL en verder niets.
#
# WAAROM NIET DOOR DE TUNNEL. Een Cloudflare Tunnel draagt webverkeer. TURN is
# UDP en ruwe TCP/TLS op eigen poorten; dat moet rechtstreeks binnenkomen. Dus:
#   - je router stuurt 3478 udp+tcp, 5349 tcp en 49160-49999 udp door naar deze Mac;
#   - turn.<domein> staat in de DNS als "DNS only" naar je thuisadres -- dat
#     adres wordt daarmee openbaar (de app zelf blijft achter de tunnel);
#   - het werkt ALLEEN met een echt openbaar IPv4-adres. Achter CGNAT (veel
#     glasvezel- en 4G-abonnementen) komt er niets binnen; dit script stopt dan.
#
# Draaien:
#   export CLOUDFLARE_API_TOKEN=...      # alleen Zone-DNS-Edit, voor het certificaat (DNS-01)
#   sudo -E scripts/mac/turn.sh --domein=turn.<domein> --email=<adres voor Let's Encrypt>
#
# Opties:
#   --domein=NAAM  turn.<domein> (verplicht)     --email=ADRES  voor Let's Encrypt (verplicht)
#   --lan-ip=IP    het adres van deze Mac in je thuisnet (standaard: en0/en1)
#   --env=PAD      het geheimenbestand van de app (standaard /usr/local/etc/rtg/rtg.env)
#   --geen-start   alles klaarzetten, de dienst niet laden
#
# Opnieuw draaien mag: het geheim blijft staan, de configuratie wordt opnieuw
# geschreven (handig als je thuisadres veranderde -- dan klopt external-ip niet
# meer, faalt de relayproef en gaat bellen DICHT; dat is de bedoeling).
set -euo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HIER/../.." && pwd)"
LABEL="nl.rtg.turn"; LABEL_CERT="nl.rtg.turn-cert"
MAP="/usr/local/etc/rtg-turn"
DOMEIN=""; EMAIL=""; LAN_IP=""; ENVBESTAND="/usr/local/etc/rtg/rtg.env"; STARTEN=1

kop() { echo; echo "== $* =="; }
zeg() { echo "   $*"; }
stuk() { echo; echo "FOUT: $*" >&2; exit 1; }

for arg in "$@"; do
  case "$arg" in
    --domein=*) DOMEIN="${arg#*=}" ;;  --email=*) EMAIL="${arg#*=}" ;;
    --lan-ip=*) LAN_IP="${arg#*=}" ;;  --env=*) ENVBESTAND="${arg#*=}" ;;
    --geen-start) STARTEN=0 ;;
    *) stuk "onbekende optie: $arg" ;;
  esac
done

[[ "$DOMEIN" =~ ^turn\.[a-z0-9.-]+\.[a-z]{2,}$ ]] || stuk "geef --domein=turn.<domein>"
[[ "$EMAIL" == *@*.* ]] || stuk "geef --email=<adres> voor Let's Encrypt"
[ "$(id -u)" = "0" ] || stuk "draai dit met sudo -E (de dienst komt in /Library/LaunchDaemons)"
ECHTE_GEBRUIKER="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"
als_gebruiker() { sudo -u "$ECHTE_GEBRUIKER" "$@"; }

kop "1. Het adres van buiten"
PUBLIEK="$(curl -fsS -4 -m 8 https://api.ipify.org || true)"
[[ "$PUBLIEK" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || stuk "kon het openbare IPv4-adres niet bepalen"
IFS=. read -r a b _ _ <<< "$PUBLIEK"
if [ "$a" = "100" ] && [ "$b" -ge 64 ] && [ "$b" -le 127 ]; then
  stuk "je zit achter CGNAT ($PUBLIEK). Van buiten komt hier niets binnen; gebruik de VPS-route (scripts/turn/vps.js)."
fi
zeg "openbaar: $PUBLIEK"
zeg "CONTROLEER in je router dat het WAN-adres ook $PUBLIEK is. Is het een 100.64-127.x- of"
zeg "10.x-adres, dan zit je achter CGNAT en werkt deze route niet."
[ -n "$LAN_IP" ] || LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
[[ "$LAN_IP" =~ ^(10|172|192)\. ]] || stuk "kon het thuisnetadres van deze Mac niet bepalen; geef --lan-ip=..."
zeg "thuisnet: $LAN_IP"

kop "2. Wat er moet staan"
command -v brew >/dev/null 2>&1 || stuk "Homebrew ontbreekt (https://brew.sh)"
als_gebruiker brew list coturn >/dev/null 2>&1 || als_gebruiker brew install coturn
als_gebruiker brew list certbot >/dev/null 2>&1 || als_gebruiker brew install certbot
CB="$(als_gebruiker brew --prefix certbot)"
"$CB/libexec/bin/python3" -c 'import certbot_dns_cloudflare' 2>/dev/null \
  || als_gebruiker "$CB/libexec/bin/pip" install --quiet certbot-dns-cloudflare
TURNSERVER="$(als_gebruiker brew --prefix coturn)/bin/turnserver"
[ -x "$TURNSERVER" ] || stuk "turnserver niet gevonden na brew install coturn"
NODE="$(command -v node || true)"; [ -n "$NODE" ] || stuk "node ontbreekt"
# De app draait zelf STUN op 3478/udp (server/stun.js). Twee processen op een poort gaat niet.
if lsof -nP -iUDP:3478 -Fc 2>/dev/null | grep '^c' | grep -qv '^cturnserver'; then
  stuk "poort 3478/udp is bezet (waarschijnlijk de STUN-server van RTG). Zet in $ENVBESTAND:
     STUN_UIT=1
     STUN_URL=stun:$DOMEIN:3478
   herstart RTG (sudo launchctl kickstart -k system/nl.rtg.server) en draai dit script opnieuw.
   coturn beantwoordt STUN op dezelfde poort, dus er gaat niets verloren."
fi
zeg "coturn: $TURNSERVER"

kop "3. Geheim en certificaat"
install -d -m 0750 -o root -g nobody "$MAP" "$MAP/tls"
if [ ! -s "$MAP/secret" ]; then (umask 077; openssl rand -hex 32 > "$MAP/secret"); zeg "nieuw geheim in $MAP/secret (0600)"; else zeg "bestaand geheim blijft staan"; fi
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || stuk "CLOUDFLARE_API_TOKEN ontbreekt (export + sudo -E). Nodig voor het certificaat via DNS-01."
(umask 077; printf 'dns_cloudflare_api_token = %s\n' "$CLOUDFLARE_API_TOKEN" > "$MAP/cloudflare.ini")
cat > "$MAP/herlaad.sh" <<EOF
#!/bin/sh
# door certbot na elke vernieuwing: certificaat naar coturn, en coturn herstarten
install -m 0644 /etc/letsencrypt/live/$DOMEIN/fullchain.pem $MAP/tls/fullchain.pem
install -m 0640 -g nobody /etc/letsencrypt/live/$DOMEIN/privkey.pem $MAP/tls/privkey.pem
launchctl kickstart -k system/$LABEL 2>/dev/null || true
EOF
chmod 0755 "$MAP/herlaad.sh"
"$CB/bin/certbot" certonly --non-interactive --agree-tos -m "$EMAIL" -d "$DOMEIN" \
  --dns-cloudflare --dns-cloudflare-credentials "$MAP/cloudflare.ini" --deploy-hook "$MAP/herlaad.sh" --keep-until-expiring
sh "$MAP/herlaad.sh"
zeg "certificaat voor $DOMEIN staat klaar"

kop "4. De configuratie"
"$NODE" "$REPO/scripts/turn/maak-config.js" --realm="$DOMEIN" --extern-ip="$PUBLIEK/$LAN_IP" \
  --geheim-bestand="$MAP/secret" --cert="$MAP/tls/fullchain.pem" --sleutel="$MAP/tls/privkey.pem" \
  --uit="$MAP/turnserver.conf"
chown root:nobody "$MAP/turnserver.conf"; chmod 0640 "$MAP/turnserver.conf"

kop "5. De diensten"
cat > "/Library/LaunchDaemons/$LABEL.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$TURNSERVER</string><string>-c</string><string>$MAP/turnserver.conf</string></array>
  <key>UserName</key><string>nobody</string>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/usr/local/var/log/rtg-turn.log</string>
  <key>StandardErrorPath</key><string>/usr/local/var/log/rtg-turn.log</string>
</dict></plist>
EOF
cat > "/Library/LaunchDaemons/$LABEL_CERT.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL_CERT</string>
  <key>ProgramArguments</key><array><string>$CB/bin/certbot</string><string>renew</string><string>--quiet</string></array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>4</integer><key>Minute</key><integer>17</integer></dict>
</dict></plist>
EOF
mkdir -p /usr/local/var/log; touch /usr/local/var/log/rtg-turn.log; chown nobody /usr/local/var/log/rtg-turn.log
FW=/usr/libexec/ApplicationFirewall/socketfilterfw
[ -x "$FW" ] && { "$FW" --add "$TURNSERVER" >/dev/null; "$FW" --unblockapp "$TURNSERVER" >/dev/null; } || true
if [ "$STARTEN" = "1" ]; then
  for l in "$LABEL" "$LABEL_CERT"; do
    launchctl bootout "system/$l" 2>/dev/null || true
    launchctl bootstrap system "/Library/LaunchDaemons/$l.plist"
  done
  zeg "coturn draait als system/$LABEL (gebruiker nobody); vernieuwen dagelijks via system/$LABEL_CERT"
fi

kop "Wat jij nog moet doen"
zeg "1. Router: stuur door naar $LAN_IP -- 3478 udp+tcp, 5349 tcp, 49160-49999 udp."
zeg "   Geef deze Mac in de router een vast adres (DHCP-reservering), anders wijzen de regels straks nergens heen."
zeg "2. DNS:    CLOUDFLARE_API_TOKEN=... node scripts/turn/dns.js --naam=$DOMEIN --ip=$PUBLIEK --uitvoeren"
zeg "3. In $ENVBESTAND:"
zeg "     TURN_URL=turns:$DOMEIN:5349?transport=tcp,turn:$DOMEIN:3478?transport=udp"
zeg "     TURN_SECRET=<de inhoud van $MAP/secret>"
zeg "   en herstart RTG: sudo launchctl kickstart -k system/nl.rtg.server"
zeg "4. Binnen ~4 minuten: curl -s https://<app-domein>/api/rtc/stand  ->  \"geverifieerd\":true"
zeg "   Zo niet, dan staat de reden erbij; bellen blijft dicht tot het klopt."
