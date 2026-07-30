#!/bin/bash
# Zet RTG als launchd-service op een Mac (bijvoorbeeld een Mac mini als
# thuisserver). Na afloop start de server vanzelf bij het aanzetten van de
# machine, ook zonder in te loggen, en komt hij terug na een crash of een
# stroomstoring.
#
# Draaien:
#   sudo scripts/mac/installeer.sh --eigenaar=jij@voorbeeld.nl
#
# Opties:
#   --gebruiker=NAAM    account waaronder de server draait (standaard: jij)
#   --eigenaar=E-MAIL   RTG_OWNER_EMAIL; verplicht bij een nieuwe installatie
#   --url=ADRES         APP_URL, het publieke adres (standaard: http://naam.local:poort)
#   --poort=NUMMER      poort van de site (standaard 3000)
#   --env=PAD           het geheimenbestand (standaard /usr/local/etc/rtg/rtg.env)
#   --slaap-uit         zet de Mac op serverstand (niet slapen, terug na stroomuitval)
#   --geen-start        alles klaarzetten maar de service niet laden
#   --toch-doorgaan     negeer de waarschuwing over Bureaublad/Documenten (zie onder)
#
# Wat dit script NOOIT doet: een bestaand geheimenbestand overschrijven. Daar
# staat RTG_VAULT_KEY in, en zonder die sleutel zijn alle namen en e-mailadressen
# in de kluis onleesbaar. Bestaat het bestand al, dan blijft het staan.
set -euo pipefail

LABEL="nl.rtg.server"
HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HIER/../.." && pwd)"
PLIST="/Library/LaunchDaemons/$LABEL.plist"
LOGMAP="/usr/local/var/log/rtg"

GEBRUIKER=""
EIGENAAR=""
APPURL=""
POORT="3000"
ENVBESTAND="/usr/local/etc/rtg/rtg.env"
SLAAPUIT=0
STARTEN=1
TOCHDOORGAAN=0

kop() { echo; echo "== $* =="; }
zeg() { echo "   $*"; }
stuk() { echo; echo "FOUT: $*" >&2; exit 1; }

for arg in "$@"; do
  case "$arg" in
    --gebruiker=*) GEBRUIKER="${arg#*=}" ;;
    --eigenaar=*)  EIGENAAR="${arg#*=}" ;;
    --url=*)       APPURL="${arg#*=}" ;;
    --poort=*)     POORT="${arg#*=}" ;;
    --env=*)       ENVBESTAND="${arg#*=}" ;;
    --slaap-uit)   SLAAPUIT=1 ;;
    --geen-start)  STARTEN=0 ;;
    --toch-doorgaan) TOCHDOORGAAN=1 ;;
    -h|--help)     awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$0"; exit 0 ;;
    *) stuk "onbekende optie: $arg (probeer --help)" ;;
  esac
done

# ---------- 1. voorwaarden ----------
kop "1. Voorwaarden controleren"
[ "$(uname -s)" = "Darwin" ] || stuk "dit script is voor macOS. Op Linux gebruik je systemd."
[ "$(id -u)" = "0" ] || stuk "draai dit met sudo: sudo $0 $*"

[ -n "$GEBRUIKER" ] || GEBRUIKER="${SUDO_USER:-}"
[ -n "$GEBRUIKER" ] || stuk "geen gebruiker gevonden; geef --gebruiker=NAAM op."
[ "$GEBRUIKER" != "root" ] || stuk "de server hoort niet als root te draaien. Geef --gebruiker=NAAM op."
id -u "$GEBRUIKER" >/dev/null 2>&1 || stuk "gebruiker $GEBRUIKER bestaat niet."
GROEP="$(id -gn "$GEBRUIKER")"
zeg "gebruiker: $GEBRUIKER (groep $GROEP)"

case "$POORT" in
  ''|*[!0-9]*) stuk "poort moet een getal zijn: $POORT" ;;
esac
[ "$POORT" -ge 1024 ] || stuk "poort $POORT is een bevoorrechte poort; de server draait niet als root. Gebruik 3000 en zet er poortdoorverwijzing of een reverse proxy voor."

[ -f "$REPO/server/trio.js" ] || stuk "$REPO ziet er niet uit als de RTG-repo (server/trio.js ontbreekt)."
zeg "repo: $REPO"

# macOS beschermt Bureaublad, Documenten en Downloads (TCC). Een LaunchDaemon
# krijgt daar geen toegang en faalt met "Operation not permitted", zonder dat
# duidelijk is waarom. Beter nu blokkeren dan straks zoeken.
HOME_G="$(eval echo "~$GEBRUIKER")"
for beschermd in Desktop Documents Downloads Bureaublad Documenten; do
  case "$REPO/" in
    "$HOME_G/$beschermd/"*)
      if [ "$TOCHDOORGAAN" = "0" ]; then
        echo
        echo "FOUT: de repo staat in $HOME_G/$beschermd." >&2
        echo "      macOS geeft achtergronddiensten daar geen toegang; de service zou" >&2
        echo "      falen met 'Operation not permitted'. Verplaats de map, bijvoorbeeld:" >&2
        echo >&2
        echo "        mv \"$REPO\" \"$HOME_G/rtg\"" >&2
        echo >&2
        echo "      en draai dit script daarna opnieuw vanuit de nieuwe map." >&2
        echo "      (Weet je zeker dat het bij jou wel mag: --toch-doorgaan)" >&2
        exit 1
      fi
      zeg "LET OP: repo staat in een beschermde map; je hebt --toch-doorgaan gegeven."
      ;;
  esac
done

# node zoeken met de PATH van de gebruiker (Homebrew staat niet in de kale PATH)
NODE="$(sudo -u "$GEBRUIKER" /bin/bash -lc 'command -v node' 2>/dev/null || true)"
[ -n "$NODE" ] || stuk "node niet gevonden voor $GEBRUIKER. Installeer het: brew install node"
NODEV="$("$NODE" -v)"
NODEMAJOR="$("$NODE" -p 'process.versions.node.split(".")[0]')"
[ "$NODEMAJOR" -ge 22 ] || stuk "node $NODEV is te oud; RTG heeft 22 of hoger nodig (brew upgrade node)."
zeg "node: $NODEV op $NODE"

# ---------- 2. het geheimenbestand ----------
kop "2. Geheimen"
ENVMAP="$(dirname "$ENVBESTAND")"
mkdir -p "$ENVMAP"
chmod 755 "$ENVMAP"

if [ -f "$ENVBESTAND" ]; then
  zeg "$ENVBESTAND bestaat al; die blijft staan (daar zit RTG_VAULT_KEY in)."
  chown "$GEBRUIKER:$GROEP" "$ENVBESTAND"
  chmod 600 "$ENVBESTAND"
else
  if [ -z "$EIGENAAR" ]; then
    if [ -t 0 ]; then
      printf "   E-mailadres van de eigenaar (RTG_OWNER_EMAIL): "
      read -r EIGENAAR
    fi
  fi
  case "$EIGENAAR" in
    *@*.*) ;;
    *) stuk "geef een geldig eigenaarsadres op: --eigenaar=jij@voorbeeld.nl. Zonder dat weigert de server in productie te starten, en zou wie dat adres registreert eigenaar van de technische pagina worden." ;;
  esac
  [ -n "$APPURL" ] || APPURL="http://$(hostname -s).local:$POORT"

  zeg "nieuwe geheimen maken met scripts/sleutels.js"
  RUW="$(cd "$REPO" && sudo -u "$GEBRUIKER" "$NODE" scripts/sleutels.js)"

  TIJDELIJK="$(mktemp "${TMPDIR:-/tmp}/rtg-env.XXXXXX")"
  chmod 600 "$TIJDELIJK"
  {
    echo "# RTG-omgeving voor de launchd-service ($LABEL)."
    echo "# Rechten 600, eigenaar $GEBRUIKER. Deze sleutels zijn onvervangbaar:"
    echo "# raak je RTG_VAULT_KEY kwijt, dan zijn alle namen en e-mailadressen in"
    echo "# de kluis onleesbaar. Maak er een kopie van in je wachtwoordkluis."
    echo
    # regels met een VUL-IN-plaatshouder uitcommentarieren: op een losse Mac
    # draait de opslag lokaal, dus Postgres/Redis/SMTP zijn niet verplicht.
    echo "$RUW" | while IFS= read -r regel; do
      case "$regel" in
        RTG_OWNER_EMAIL=*) echo "RTG_OWNER_EMAIL=$EIGENAAR"; continue ;;
        APP_URL=*)         echo "APP_URL=$APPURL"; continue ;;
      esac
      case "$regel" in
        \#*)      echo "$regel" ;;
        *VUL-IN*) echo "# (nog niet ingesteld) $regel" ;;
        *)        echo "$regel" ;;
      esac
    done
    echo
    echo "# Poort van de site; de drie servers erachter draaien op $((POORT + 1)) t/m $((POORT + 3))."
    echo "PORT=$POORT"
    echo "# Lokale opslag op deze machine (SQLite). Zonder deze regel waarschuwt"
    echo "# de keuring dat DATABASE_URL ontbreekt."
    echo "RTG_STORE=sqlite"
  } > "$TIJDELIJK"
  chown "$GEBRUIKER:$GROEP" "$TIJDELIJK"
  mv "$TIJDELIJK" "$ENVBESTAND"
  chmod 600 "$ENVBESTAND"
  zeg "geschreven: $ENVBESTAND (rechten 600, eigenaar $GEBRUIKER)"
  zeg "Het 2FA-geheim voor de backoffice staat er als otpauth-regel in; scan die met je authenticator-app."
fi

# ---------- 3. logboek ----------
kop "3. Logboek"
mkdir -p "$LOGMAP"
chown "$GEBRUIKER:$GROEP" "$LOGMAP"
chmod 750 "$LOGMAP"
zeg "$LOGMAP/rtg.log en $LOGMAP/rtg-fout.log"

# ---------- 4. het plist schrijven ----------
kop "4. launchd-service"
SJABLOON="$HIER/nl.rtg.server.plist.sjabloon"
[ -f "$SJABLOON" ] || stuk "sjabloon ontbreekt: $SJABLOON"
# tekstvervanging in bash, geen sed: de paden zitten vol schuine strepen
inhoud="$(cat "$SJABLOON")"
inhoud="${inhoud//@@LABEL@@/$LABEL}"
inhoud="${inhoud//@@START@@/$HIER/rtg-start.sh}"
inhoud="${inhoud//@@GEBRUIKER@@/$GEBRUIKER}"
inhoud="${inhoud//@@GROEP@@/$GROEP}"
inhoud="${inhoud//@@REPO@@/$REPO}"
inhoud="${inhoud//@@LOGMAP@@/$LOGMAP}"
inhoud="${inhoud//@@NODE@@/$NODE}"
inhoud="${inhoud//@@ENVBESTAND@@/$ENVBESTAND}"
case "$inhoud" in
  *@@*) stuk "er staat nog een niet-ingevulde plaatshouder in het sjabloon $SJABLOON" ;;
esac
printf '%s\n' "$inhoud" > "$PLIST"
chown root:wheel "$PLIST"
chmod 644 "$PLIST"
plutil -lint "$PLIST" >/dev/null || stuk "het gegenereerde plist is ongeldig: $PLIST"
chmod +x "$HIER/rtg-start.sh" 2>/dev/null || true
zeg "geschreven: $PLIST"

# ---------- 5. de configuratie keuren voordat we laden ----------
kop "5. Configuratie keuren"
# Anders krijg je een service die elke tien seconden opnieuw probeert te starten
# en steeds dezelfde fout in het logboek zet.
if sudo -u "$GEBRUIKER" RTG_ENV_BESTAND="$ENVBESTAND" /bin/bash "$HIER/rtg-start.sh" --keuring; then
  zeg "de omgeving is goedgekeurd."
else
  echo
  echo "De configuratie is nog niet in orde; de service is NIET geladen." >&2
  echo "Pas $ENVBESTAND aan en draai dit script opnieuw." >&2
  exit 1
fi

# ---------- 6. laden en starten ----------
if [ "$STARTEN" = "0" ]; then
  kop "Klaar (niet gestart)"
  zeg "Laden doe je met: sudo launchctl bootstrap system $PLIST"
  exit 0
fi

kop "6. Service laden"
launchctl bootout "system/$LABEL" >/dev/null 2>&1 || true
# enable VOOR bootstrap. Heeft launchd dit label ooit uitgezet (een eerdere
# mislukte poging, of iemand die 'launchctl disable' draaide), dan weigert
# bootstrap met "Input/output error" -- en een enable achteraf is te laat,
# want er is dan niets geladen om aan te zetten.
launchctl enable "system/$LABEL" >/dev/null 2>&1 || true
if ! launchctl bootstrap system "$PLIST"; then
  # launchd geeft alleen een errno terug en zegt niet wat er mis is. Zoek het
  # hier op, in plaats van de gebruiker met "5: Input/output error" te laten
  # zitten: de drie oorzaken die het in de praktijk zijn.
  echo
  echo "   Laden mislukte. Wat launchd hierover kwijt wil:" >&2
  echo "   -- staat hij al geladen?" >&2
  launchctl print "system/$LABEL" 2>&1 | head -3 >&2 || true
  echo "   -- staat hij uitgezet?" >&2
  launchctl print-disabled system 2>/dev/null | grep -i "$LABEL" >&2 || echo "      nee" >&2
  echo "   -- klopt het plist?" >&2
  plutil -lint "$PLIST" >&2 || true
  echo "   -- kan launchd bij het startscript?" >&2
  ls -ld "$HIER/rtg-start.sh" >&2 || true
  echo >&2
  echo "   Draaien kan intussen gewoon met de hand:" >&2
  echo "     cd $REPO && RTG_ENV_BESTAND=$ENVBESTAND bash scripts/mac/rtg-start.sh" >&2
  exit 1
fi
launchctl kickstart -k "system/$LABEL" >/dev/null 2>&1 || true
zeg "geladen als system/$LABEL"

kop "7. Controleren"
gelukt=0
for poging in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if curl -fsS -m 3 "http://127.0.0.1:$POORT/api/health" >/dev/null 2>&1; then gelukt=1; break; fi
  sleep 2
done
if [ "$gelukt" = "1" ]; then
  zeg "de server antwoordt op http://127.0.0.1:$POORT/api/health"
else
  echo "   De server antwoordde binnen 40 seconden niet. Kijk in het logboek:" >&2
  echo "     tail -n 40 $LOGMAP/rtg-fout.log" >&2
fi

# ---------- 8. slaapstand ----------
kop "8. Energie-instellingen"
huidig="$(pmset -g 2>/dev/null || true)"
slaap="$(printf '%s\n' "$huidig" | awk '$1=="sleep"{print $2}' | head -1)"
autorestart="$(printf '%s\n' "$huidig" | awk '$1=="autorestart"{print $2}' | head -1)"
if [ "$SLAAPUIT" = "1" ]; then
  pmset -a sleep 0 disksleep 0 autorestart 1 womp 1 >/dev/null 2>&1 || true
  zeg "serverstand gezet: niet slapen, schijf niet slapen, terug na stroomuitval, wekken via netwerk."
else
  zeg "huidige stand: sleep=${slaap:-onbekend}, autorestart=${autorestart:-onbekend} (niet gewijzigd)."
  zeg "Wil je hem als server laten staan (niet slapen, terugkomen na stroomuitval):"
  zeg "  sudo pmset -a sleep 0 disksleep 0 autorestart 1 womp 1"
  zeg "of draai dit script opnieuw met --slaap-uit."
fi

kop "Klaar"
zeg "site:        http://$(hostname -s).local:$POORT"
zeg "status:      sudo launchctl print system/$LABEL | head -20"
zeg "logboek:     tail -f $LOGMAP/rtg.log"
zeg "herstarten:  sudo launchctl kickstart -k system/$LABEL"
zeg "verwijderen: sudo $HIER/verwijder.sh"
