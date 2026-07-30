# RTG als dienst op een Mac (launchd)

Voor een Mac mini (of iedere Mac) die als thuisserver draait. Na de installatie
start RTG vanzelf bij het aanzetten van de machine, ook als er niemand inlogt,
en komt hij terug na een crash of een stroomstoring.

## In het kort

```bash
# 1. de repo op een plek die macOS niet afschermt (NIET op je Bureaublad)
mv ~/Desktop/nieuwe-rtg-website ~/rtg
cd ~/rtg

# 2. installeren
sudo scripts/mac/installeer.sh --eigenaar=jij@voorbeeld.nl --slaap-uit

# 3. bekijken
open http://$(hostname -s).local:3000
```

## Wat de installatie neerzet

| Waar | Wat | Rechten |
|---|---|---|
| `/Library/LaunchDaemons/nl.rtg.server.plist` | de dienstbeschrijving voor launchd | 644 root:wheel |
| `/usr/local/etc/rtg/rtg.env` | **de sleutels en geheimen** | 600, jouw account |
| `/usr/local/var/log/rtg/rtg.log` | gewone uitvoer | jouw account |
| `/usr/local/var/log/rtg/rtg-fout.log` | fouten | jouw account |

De drie bestanden in de repo zelf:

- `installeer.sh` zet alles klaar en laadt de dienst.
- `rtg-start.sh` is de wikkel die launchd aanroept: leest de geheimen, zoekt
  node en start `server/trio.js`.
- `nl.rtg.server.plist.sjabloon` is het sjabloon voor het plist.
- `verwijder.sh` haalt de dienst weer weg.

## Waarom het zo is gebouwd

**LaunchDaemon en geen LaunchAgent.** Een agent draait pas als er iemand
inlogt. Een daemon start bij het aanzetten van de machine. Dat is wat je wilt
van een server die na een stroomstoring vanzelf terug moet komen. Omdat een
daemon standaard als root draait, staat `UserName` in het plist: RTG draait als
gewone gebruiker, niet als root.

**Geen geheimen in het plist.** Alles in `/Library/LaunchDaemons` is voor
iedereen op de machine leesbaar. Zou `RTG_ENC_KEY` daar staan, dan is de
versleuteling-in-rust een lege huls. De sleutels staan daarom in een apart
bestand met rechten 600; `rtg-start.sh` leest dat in en geeft het door aan node.

**Het geheimenbestand wordt nooit overschreven.** In `RTG_VAULT_KEY` zit de
sleutel van de identiteitskluis. Raak je die kwijt, dan zijn alle namen en
e-mailadressen onleesbaar, ook uit een back-up. Draai je `installeer.sh` een
tweede keer, dan blijft het bestaande bestand gewoon staan. **Zet een kopie van
`/usr/local/etc/rtg/rtg.env` in je wachtwoordkluis.**

**Het bestand wordt gelezen, niet uitgevoerd.** `rtg-start.sh` doet bewust geen
`source`. Zou het dat wel doen, dan zou een SMTP-wachtwoord met `$(...)` erin
worden uitgevoerd, en zouden spaties en aanhalingstekens de waarde verminken.
Nu wordt elke regel letterlijk overgenomen.

**Keuren voordat we laden.** De installatie draait eerst
`rtg-start.sh --keuring`, die `server/config.js` op de echte omgeving loslaat.
Is er een blokkerende fout, dan wordt de dienst niet geladen. Zonder die stap
zou launchd elke tien seconden opnieuw proberen te starten en steeds dezelfde
fout in het logboek zetten.

**Niet op het Bureaublad.** macOS schermt `~/Desktop`, `~/Documents` en
`~/Downloads` af voor achtergronddiensten (TCC). Een LaunchDaemon krijgt daar
geen toegang en faalt met "Operation not permitted", zonder dat duidelijk is
waarom. Het installatiescript weigert daarom te installeren als de repo daar
staat, en zegt hoe je hem verplaatst.

## Dagelijks gebruik

```bash
sudo launchctl print system/nl.rtg.server | head -20   # status
tail -f /usr/local/var/log/rtg/rtg.log                 # meekijken
sudo launchctl kickstart -k system/nl.rtg.server       # herstarten
sudo launchctl bootout system/nl.rtg.server            # stoppen
sudo launchctl bootstrap system /Library/LaunchDaemons/nl.rtg.server.plist  # starten
```

Na `git pull` in de repo: `sudo launchctl kickstart -k system/nl.rtg.server`.

## Energie-instellingen

Een Mac mini die als server staat, moet niet in slaap vallen en moet terugkomen
na een stroomstoring:

```bash
sudo pmset -a sleep 0 disksleep 0 autorestart 1 womp 1
```

`installeer.sh` doet dit alleen als je `--slaap-uit` meegeeft; zonder die vlag
laat hij je instellingen met rust en laat hij alleen zien hoe ze nu staan.

## Van buitenaf bereikbaar

Standaard draait de site op poort 3000 op je eigen netwerk. Er zijn twee wegen
naar buiten.

### Cloudflare Tunnel (aanbevolen voor een Mac thuis)

De Mac maakt zelf een uitgaande verbinding naar Cloudflare. Je hoeft geen enkele
poort in je router open te zetten, je hebt geen vast IP-adres nodig, en het
werkt ook achter CGNAT -- waar poortdoorverwijzing simpelweg onmogelijk is.

```bash
brew install cloudflared
cloudflared tunnel login                                  # zonder sudo; opent je browser
sudo scripts/mac/tunnel.sh --domein=rtg.voorbeeld.nl
```

Het script maakt de tunnel, schrijft `/etc/cloudflared/config.yml`, zet het
DNS-record, installeert cloudflared als LaunchDaemon (dus terug na een
herstart) en controleert daarna of `https://<domein>/api/health` echt
antwoordt. Weghalen kan met `sudo launchctl bootout system/com.cloudflare.cloudflared`.

Twee dingen die het script controleert en waar je zelf op moet letten:

- **`RTG_TLS` blijft UIT.** Cloudflare doet de TLS; de app praat gewoon http
  op de loopback. Zet je het toch aan, dan praten twee partijen tegelijk TLS
  en werkt er niets.
- **`APP_URL=https://<domein>`** in het geheimenbestand. Daar staan de links in
  die RTG mailt; blijft daar `http://...local` staan, dan krijgt iedereen
  links die alleen bij jou thuis werken.

De doorstuurkoppen (`X-Forwarded-Proto` en `X-Forwarded-For`) worden hier
vertrouwd, en dat is geen aanname: cloudflared draait op dezelfde machine en
verbindt vanaf `127.0.0.1`. De app vertrouwt die koppen alleen van een privaat
adres (`server/web/verrijk.js`). Draait de tunnel op een andere machine, dan
hoort daar `RTG_PROXY_IPS` bij.

### Zelf poorten openzetten

Kan ook: eerst een echt domein en TLS, dan pas openzetten. Zie `PRODUCTION.md`
(native TLS met `RTG_TLS=1` en `RTG_ACME=1`, of een reverse proxy ervoor).
Poorten onder 1024 kan de server niet zelf pakken, want hij draait niet als
root; gebruik daarvoor poortdoorverwijzing in je router of `pfctl`, of zet er
een proxy voor. Let op dat veel providers poort 80 en 443 blokkeren of je
achter CGNAT zetten -- dan is de tunnel hierboven de enige weg.

## Getest en niet getest

De scripts zijn gecontroleerd op syntaxis, het plist is als plist geparseerd,
en de omgevingslezer plus de configuratiekeuring zijn echt gedraaid (inclusief
een regel met `$(...)` erin, die letterlijk werd doorgegeven). **`launchctl`
zelf is niet gedraaid**: dat kan alleen op macOS. De eerste echte
`bootstrap` doe je op de Mac mini.
