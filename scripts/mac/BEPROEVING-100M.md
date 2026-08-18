# De 100M-beproeving op de Mac mini

*Waarom dit een draaiboek is en geen script dat ik voor je draai: de zware
beproeving heeft een echte Postgres en tientallen gigabytes schijf nodig, en
die staan op jouw machine. De ontwikkelomgeving waarin de code wordt gebouwd
haalt dat niet: daar draait geen Postgres en is ongeveer 7 GB vrij, terwijl
100 miljoen leden op ruwweg 60 GB uitkomt (gemeten: 250.000 leden = 144 MB).
Dat is geen instelling die je kunt bijstellen; het is een machine die je nodig
hebt. Vandaar dit blad: kopieer de regels, plak ze in Terminal.*

## Wat je nodig hebt

| | minimum | waarom |
|---|---|---|
| vrije schijf | **120 GB** | 100M leden ~60 GB, plus indexen, WAL en de back-up ernaast |
| geheugen | 16 GB | de storm draait met `--max-old-space-size=8192` |
| Postgres | 14 of hoger | zonder `DATABASE_URL` valt de beproeving terug op sqlite en draait hij NIET op 100M |
| tijd | 1 tot 3 uur | het zaaien van 100M rijen is het grootste deel |

Controleer eerst, voor je begint:

```bash
df -h ~            # "Avail" moet ruim boven de 120G staan
psql --version     # bestaat Postgres?
pg_isready         # draait hij ook?
```

## Postgres klaarzetten (eenmalig)

```bash
brew install postgresql@16
brew services start postgresql@16
createdb rtgmega
psql rtgmega -c 'select version();'
```

## De beproeving draaien

```bash
cd ~/rtg

# 1. de volle 100M, met de scherpe lat (STRENG)
DATABASE_URL="postgres://$(whoami)@localhost/rtgmega" \
STRENG=1 \
node --max-old-space-size=8192 scripts/beproeving.js 2>&1 | tee ~/beproeving-100m.log
```

Wil je eerst kleiner proefdraaien om te zien of de keten loopt, zet dan het
aantal leden lager. Tien miljoen kost ~6 GB en een kwartier:

```bash
DATABASE_URL="postgres://$(whoami)@localhost/rtgmega" \
MEGA_LEDEN=10000000 STRENG=1 \
node --max-old-space-size=8192 scripts/beproeving.js
```

## De crashtest (die kan wel overal)

Deze draait op sqlite en heeft geen Postgres nodig; hij voert de druk op tot
er iets breekt en wijst dan de plek aan.

```bash
cd ~/rtg
node scripts/tot-crash.js 2>&1 | tee ~/crashtest.log
```

**Lees in de uitslag "rondes met ECHTE druk", niet "rondes gedraaid".** Werkers
verdubbelen loopt een keer dood op de client zelf: duizenden sockets in een
Node-proces leveren minder verzoeken op dan honderd. Het harnas merkt dat nu
(het vergelijkt de doorvoer met de piek en kijkt naar de event-loop van de
server) en stopt met de mededeling *"vanaf hier meet ik mijn eigen client, niet
de server"*. Staat die regel er, dan is meer werkers zinloos -- dan moet de druk
van meerdere machines komen, of per socket omhoog.

## Wat je terugstuurt

Het enige dat ik nodig heb om de uitslag te kunnen lezen en er iets mee te
doen, is `BEPROEVING.json` uit de map en de staart van het log:

```bash
cat ~/rtg/BEPROEVING.json
tail -60 ~/beproeving-100m.log
```

## Hoe je de uitslag leest

- **`oordeel: "PASS"`** met `gezakteDrempels: 0` -- de lat is gehaald op 100M.
- **`serverfouten5xxPaden`** -- staat hier iets in, dan is dat de lijst met
  echte bugs onder druk. Dat is het waardevolste deel van de hele ronde.
- **`meters`** -- p99, doorvoer, event-loop, hersteltijd, geheugenhelling.
  Deze horen bij DEZE machine: `scripts/norm.js` vergelijkt ze alleen binnen
  dezelfde vingerafdruk (kernen/geheugen/platform/modus), dus de cijfers van
  de mini gaan de lat van de ontwikkelmachine niet verzetten. Wil je de mini
  zijn eigen lat geven, draai dan daar `npm run norm:vast`.

## Als hij zakt

Dat is de bedoeling van een beproeving. Stuur `BEPROEVING.json` en het log;
de gezakte drempel staat er met naam in, en `serverfouten5xxPaden` wijst de
endpoints aan. Dan repareren we de oorzaak en draai je hem opnieuw.
