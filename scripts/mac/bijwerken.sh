#!/bin/bash
# Werkt de draaiende RTG-server op deze Mac bij naar de nieuwste versie, en
# draait terug als de nieuwe versie niet opkomt.
#
#   sudo scripts/mac/bijwerken.sh
#   sudo scripts/mac/bijwerken.sh --tak=main --oude-map=~/rtg-oud
#
# Opties:
#   --tak=NAAM        welke tak je live zet (standaard: main)
#   --poort=NUMMER    poort waarop de server antwoordt (standaard: uit rtg.env, anders 3000)
#   --oude-map=PAD    een OUDE kopie van de site die weg mag; gaat naar de
#                     prullenmand, pas nadat de nieuwe versie echt antwoordt
#   --geen-keuring    sla scripts/check.js over (de configuratiekeuring blijft)
#   --env=PAD         het geheimenbestand (standaard /usr/local/etc/rtg/rtg.env)
#
# WAAROM DIT SCRIPT BESTAAT EN JE NIET GEWOON `git pull` DOET.
# Een `git pull` gevolgd door een herstart heeft drie manieren om je zondag te
# verpesten: de pull loopt vast op lokale wijzigingen, de nieuwe versie start
# niet op door een configuratiefout, of hij start wel maar antwoordt niet. In
# alle drie de gevallen staat de site uit en sta jij met een halve installatie.
# Dit script controleert vooraf, kijkt achteraf of de site ECHT antwoordt, en
# zet bij twijfel de vorige versie terug voordat het klaar meldt.
#
# WAT DIT SCRIPT NOOIT WEGGOOIT:
#   - /usr/local/etc/rtg/rtg.env  (daar staat RTG_VAULT_KEY in; zonder die
#     sleutel zijn alle namen en e-mailadressen onleesbaar, ook uit een back-up)
#   - server/data  (de database en de sleutels; staat niet in git, dus een
#     nieuwe kopie heeft die NIET)
#   - het logboek in /usr/local/var/log/rtg
# En met --oude-map wordt er niets verwijderd maar verplaatst naar de
# prullenmand, zodat je het terug kunt halen zolang je die niet leegt.
set -euo pipefail

LABEL="nl.rtg.server"
HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HIER/../.." && pwd)"
ENVBESTAND="/usr/local/etc/rtg/rtg.env"
TAK="main"
POORT=""
OUDEMAP=""
KEURING=1

kop() { echo; echo "== $* =="; }
zeg() { echo "   $*"; }
stuk() { echo; echo "FOUT: $*" >&2; exit 1; }

for arg in "$@"; do
  case "$arg" in
    --tak=*)       TAK="${arg#*=}" ;;
    --poort=*)     POORT="${arg#*=}" ;;
    --oude-map=*)  OUDEMAP="${arg#*=}" ;;
    --env=*)       ENVBESTAND="${arg#*=}" ;;
    --geen-keuring) KEURING=0 ;;
    -h|--help)     awk 'NR>1 && /^#/ { sub(/^# ?/, ""); print; next } NR>1 { exit }' "$0"; exit 0 ;;
    *) stuk "onbekende optie: $arg (probeer --help)" ;;
  esac
done

# ---------- 1. voorwaarden ----------
kop "1. Voorwaarden"
[ "$(uname -s)" = "Darwin" ] || stuk "dit script is voor macOS."
[ "$(id -u)" = "0" ] || stuk "draai dit met sudo: sudo $0 $*"
[ -f "$REPO/server/trio.js" ] || stuk "$REPO ziet er niet uit als de RTG-repo."

# Git NIET als root draaien: dan worden nieuwe bestanden van root en kan de
# server ze later niet meer schrijven. We draaien git als de eigenaar van de map.
GEBRUIKER="$(stat -f '%Su' "$REPO")"
[ "$GEBRUIKER" != "root" ] || stuk "de repo is van root; dat hoort niet. Zet hem op je eigen account (chown -R jij \"$REPO\")."
git() { sudo -u "$GEBRUIKER" /usr/bin/git -C "$REPO" "$@"; }
zeg "repo: $REPO (van $GEBRUIKER)"

if [ -z "$POORT" ] && [ -f "$ENVBESTAND" ]; then
  POORT="$(awk -F= '$1=="PORT" { print $2 }' "$ENVBESTAND" | tail -1 | tr -d ' \r')"
fi
[ -n "$POORT" ] || POORT="3000"
zeg "poort: $POORT"

# ---------- 2. eerst kijken of er iets in de weg staat ----------
kop "2. Werkmap controleren"
VUIL="$(git status --porcelain)"
if [ -n "$VUIL" ]; then
  echo "$VUIL" | sed 's/^/   /'
  stuk "er staan lokale wijzigingen in de repo. Bewaar of gooi ze eerst weg (git stash / git checkout -- .), anders zou het bijwerken ze overschrijven."
fi
zeg "schoon"

VORIGE="$(git rev-parse HEAD)"
zeg "nu live: $(git log --oneline -1 | cat)"

# ---------- 3. de nieuwe versie halen ----------
kop "3. Nieuwe versie halen (tak $TAK)"
POGING=0
until git fetch origin "$TAK"; do
  POGING=$((POGING + 1))
  [ "$POGING" -lt 4 ] || stuk "kan origin niet bereiken na 4 pogingen."
  zeg "netwerk hapert, opnieuw over $((2 ** POGING))s"
  sleep $((2 ** POGING))
done

if ! git merge-base --is-ancestor HEAD "origin/$TAK"; then
  stuk "origin/$TAK is geen rechtstreekse voortzetting van wat hier staat. Bekijk het verschil met: git -C $REPO log --oneline HEAD..origin/$TAK"
fi
git merge --ff-only "origin/$TAK"
NIEUW="$(git rev-parse HEAD)"
if [ "$VORIGE" = "$NIEUW" ]; then zeg "was al bij; we controleren alleen nog of de server gezond is"
else zeg "nu: $(git log --oneline -1 | cat)"; fi

# ---------- 4. keuren VOOR we herstarten ----------
kop "4. Keuren voor de herstart"
if [ "$KEURING" = "1" ] && [ -f "$REPO/scripts/check.js" ]; then
  if sudo -u "$GEBRUIKER" node "$REPO/scripts/check.js" >/tmp/rtg-check.log 2>&1; then
    zeg "scripts/check.js: alles in orde"
  else
    tail -20 /tmp/rtg-check.log | sed 's/^/   /'
    git reset --hard "$VORIGE"
    stuk "de keuring zakt op de nieuwe versie; de vorige versie staat terug en draait door. Volledige uitvoer: /tmp/rtg-check.log"
  fi
fi
if ! RTG_ENV_BESTAND="$ENVBESTAND" sudo -u "$GEBRUIKER" "$REPO/scripts/mac/rtg-start.sh" --keuring; then
  git reset --hard "$VORIGE"
  stuk "de configuratiekeuring zakt op de nieuwe versie; de vorige versie staat terug en draait door."
fi
zeg "configuratie in orde"

# ---------- 5. herstarten ----------
kop "5. Herstarten"
if launchctl print "system/$LABEL" >/dev/null 2>&1; then
  launchctl kickstart -k "system/$LABEL"
  zeg "service herstart"
else
  [ -f "/Library/LaunchDaemons/$LABEL.plist" ] || stuk "de service is niet geinstalleerd. Draai eerst: sudo scripts/mac/installeer.sh --eigenaar=..."
  launchctl bootstrap system "/Library/LaunchDaemons/$LABEL.plist"
  zeg "service geladen"
fi

# ---------- 6. antwoordt hij ook echt? ----------
# Dit is de stap die het verschil maakt tussen "herstart gelukt" en "de site
# doet het". launchd meldt succes zodra het proces start, ook als dat proces
# meteen weer omvalt.
kop "6. Antwoordt de site?"
GEZOND=0
for i in $(seq 1 40); do
  if curl -fsS -m 3 "http://127.0.0.1:$POORT/api/health" >/dev/null 2>&1; then GEZOND=1; break; fi
  sleep 1.5
done

if [ "$GEZOND" != "1" ]; then
  kop "TERUGDRAAIEN"
  zeg "de nieuwe versie antwoordt niet op /api/health; we zetten de vorige terug."
  git reset --hard "$VORIGE"
  launchctl kickstart -k "system/$LABEL" || true
  for i in $(seq 1 40); do
    if curl -fsS -m 3 "http://127.0.0.1:$POORT/api/health" >/dev/null 2>&1; then
      stuk "de nieuwe versie kwam niet op; de VORIGE versie draait weer en antwoordt. Kijk in /usr/local/var/log/rtg/rtg-fout.log wat er misging."
    fi
    sleep 1.5
  done
  stuk "de nieuwe versie kwam niet op EN de vorige komt ook niet terug. Kijk direct in /usr/local/var/log/rtg/rtg-fout.log."
fi
zeg "de site antwoordt op http://127.0.0.1:$POORT/api/health"

# ---------- 7. pas nu mag de oude kopie weg ----------
if [ -n "$OUDEMAP" ]; then
  kop "7. De oude kopie opruimen"
  OUD="$(cd "$OUDEMAP" 2>/dev/null && pwd || true)"
  [ -n "$OUD" ] || stuk "--oude-map=$OUDEMAP bestaat niet."
  [ "$OUD" != "$REPO" ] || stuk "--oude-map wijst naar de repo die NU draait. Dat is geen oude kopie."
  case "$REPO/" in "$OUD"/*) stuk "de draaiende repo staat IN $OUD. Die map kan dus niet weg." ;; esac
  case "$OUD" in
    "/"|"$HOME"|"/Users"|"/Applications"|"/System"*|"/Library"*|"/usr"*) stuk "$OUD is geen kopie van de site maar een systeem- of thuismap." ;;
  esac
  if [ ! -f "$OUD/package.json" ] && [ ! -f "$OUD/index.html" ]; then
    stuk "$OUD ziet er niet uit als een kopie van de site (geen package.json en geen index.html). Kijk er zelf even in voor je hem weggooit."
  fi

  zeg "gevonden in $OUD:"
  /bin/ls -1 "$OUD" | head -12 | sed 's/^/      /'
  if [ -d "$OUD/server/data" ]; then
    echo
    zeg "LET OP: hier staat een server/data met eigen gegevens:"
    /bin/ls -1 "$OUD/server/data" | sed 's/^/      /'
    zeg "Dat is een DATABASE en mogelijk sleutelmateriaal, en dat staat niet in git."
    if [ ! -d "$REPO/server/data" ]; then
      stuk "de draaiende repo heeft zelf GEEN server/data. Dan is dit de enige kopie van de gegevens en gaat hij niet naar de prullenmand. Zet hem eerst over: cp -R \"$OUD/server/data\" \"$REPO/server/\""
    fi
    zeg "de draaiende repo heeft een eigen server/data, dus we gaan verder (naar de prullenmand, niet weg)."
  fi

  PRULLEN="$(sudo -u "$GEBRUIKER" sh -c 'echo $HOME')/.Trash"
  [ -d "$PRULLEN" ] || PRULLEN="/tmp"
  DOEL="$PRULLEN/$(basename "$OUD")-oud-$(date +%Y%m%d-%H%M%S)"
  mv "$OUD" "$DOEL"
  chown -R "$GEBRUIKER" "$DOEL" 2>/dev/null || true
  zeg "verplaatst naar de prullenmand: $DOEL"
  zeg "hij is er dus nog. Weg is hij pas als jij de prullenmand leegt."
fi

kop "Klaar"
zeg "live: $(git log --oneline -1 | cat)"
zeg "meekijken: tail -f /usr/local/var/log/rtg/rtg.log"
