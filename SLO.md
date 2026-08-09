# Servicedoelen (SLO) -- Rahul Travel Group

_Wat wij onszelf opleggen, en waarop wij te controleren zijn._

Dit document beschrijft **doelen die wij meten**, niet beloften die wij verkopen.
Het verschil is belangrijk: een SLO is een intern doel met een foutbudget, een
SLA is een contractuele belofte met een boete. **Er is op dit moment geen SLA.**
Die kan er pas komen als deze doelen een aantal maanden zijn gemeten en gehaald
-- en dan is het een besluit van de directie, niet van de techniek.

## Waar de cijfers vandaan komen

`server/meting.js` telt elk afgehandeld verzoek op methode, routepatroon en
statusklasse, plus de duur in een histogram. Uit te lezen op:

- `GET /api/metrics` -- Prometheus-tekstformaat
- `GET /api/metrics/kort` -- dezelfde cijfers als JSON

Allebei achter `RTG_METRICS_TOKEN`, of zonder token alleen vanaf een intern
adres. Zie `server/routes/meting.js` voor waarom dat geen overdrijving is.

De cijfers bevatten **niets persoonsgebonden**: geen paden met namen erin, geen
IP's, geen codenamen. Dat is getoetst (`test/meting.test.js`, test 7).

## De doelen

De tabel hieronder is een **afdruk van `SLO.json`** en geen handwerk. Daar staat
de norm, daar leest de meter hem (`server/kern/command/slo.js`), en `npm run
check` maakt de keuring rood zodra deze afdruk achterloopt. Dat is de reden dat
hij tussen merktekens staat: een norm die op twee plaatsen staat, staat er
binnen een maand twee keer anders.

<!-- uit SLO.json, geschreven door scripts/slo.js -- niet met de hand bijwerken -->

| # | Doel | Meting | Streefwaarde | Venster | Foutbudget |
|---|---|---|---|---|---|
| 1 | **Beschikbaarheid** | aandeel verzoeken zonder 5xx | 99,9% | 30 dagen | 43 min 12 s |
| 2 | **Snelheid, gewoon werk** | p90 van rtg_duur_seconden op lees-endpoints | < 250 ms | 30 dagen | n.v.t. (snelheid) |
| 3 | **Snelheid, staart** | p99 van rtg_duur_seconden op lees-endpoints | < 1 s | 30 dagen | n.v.t. (snelheid) |
| 4 | **Inloggen** | aandeel /api/auth/login zonder 5xx | 99,95% | 30 dagen | 21 min 36 s |
| 5 | **Betalen** | aandeel betaalroutes zonder 5xx | 99,95% | 30 dagen | 21 min 36 s |

Een doel telt pas mee vanaf **200 verzoeken** en pas als er over minstens **5%** van zijn venster is gemeten. Daaronder is de uitslag "onvoldoende gemeten", en dat is de uitslag en geen tussenstand: de tellers in `server/meting.js` beginnen bij elke herstart op nul, en een vers proces met drie verzoeken en nul fouten staat op 100%.

### De reizen van de sonde

| Reis | Aanroep | Verwacht | Max |
|---|---|---|---|
| **De server antwoordt** | `GET /api/health` | 200 | 500 ms |
| **De server is gereed** | `GET /api/ready` | 200 / 503 | 1000 ms |
| **De voordeur laadt** | `GET /` | 200 | 1500 ms |
| **Het inlogpad antwoordt** | `POST /api/auth/login` | 400 / 401 / 403 / 429 | 2000 ms |
| **Het publieke aanbod laadt** | `GET /api/aanbod` | 200 / 401 / 404 | 1500 ms |

De inlogreis logt **met opzet verkeerd in**: de sonde toetst dat het pad antwoordt, niet dat hij binnenkomt. Een 200 daar zou een bevinding zijn en geen succes.

<!-- einde SLO.json -->

Doel 4 en 5 staan strenger dan doel 1, en dat is geen slordigheid: wie niet kan
inloggen ziet niets, en wie niet kan betalen ziet een half afgeronde transactie.
Dat weegt zwaarder dan een trage overzichtspagina.

### Het foutbudget

De kolom "foutbudget" hierboven is de marge tussen de streefwaarde en honderd
procent, uitgedrukt in storingstijd per venster. Zolang er budget over is, mag
er uitgerold worden. Is het op, dan gaat de aandacht naar stabiliteit tot de
volgende periode -- geen nieuwe functies. Dit is de hele reden dat een
foutbudget bestaat: het maakt de afweging tussen snelheid en stabiliteit een
cijfer in plaats van een discussie.

De stand van dat budget staat in RTG Command onder **Spiegel > Servicedoelen**
(`server/kern/command/slo.js`, `POST /api/command/slo`), met per doel hoeveel er
nog over is en of er uitgerold mag worden. Het uitrolslot slaat bewust NIET aan
op doelen die "onvoldoende gemeten" zijn: een slot dat na elke herstart een dag
dichtzit, wordt omzeild in plaats van gebruikt.

## De meting van buitenaf

Alles wat `server/meting.js` telt, telt de app over zichzelf. Ligt de app plat,
dan telt er niets -- en dan ziet de grafiek er prima uit. Daarom is er een
sonde: nepgebruikers die de reizen uit de tabel hierboven lopen.

- **Van binnenuit**: `POST /api/command/sonde/draai` laat de server ze zelf
  lopen. Dat bewijst dat de HTTP-laag antwoordt, niet dat een klant erbij kan.
- **Van buitenaf**: `node scripts/sonde.js https://host --melden --token=...`
  draait op een ANDERE machine en meldt de uitslag terug op
  `POST /api/sonde/melding` (achter dezelfde poort als `/api/metrics`). Daar
  zitten TLS, DNS, de reverse proxy en het netwerk wel in.

De twee worden nergens bij elkaar opgeteld: dan zou het strenge cijfer in het
makkelijke verdwijnen. Staat er niets van buitenaf, dan zegt het scherm dat met
zoveel woorden. Wat ook van buitenaf nog niet gemeten wordt: het netwerk en de
browser van de klant. Een sonde is een ondergrens voor de storing, geen
bovengrens voor de kwaliteit.

## Wat hier NOG NIET staat, en eerlijk gezegd moet

1. **Een doorlopende sonde van buitenaf.** `scripts/sonde.js` bestaat en meldt
   terug, maar niemand start hem elke minuut. Dat is een cron op een machine die
   niet van ons is, en dus een inrichtingsbesluit en geen code in deze repo.
2. **Alertregels in de repo.** De cijfers worden gemeten en het budget wordt
   bijgehouden, maar er gaat nog niemand piepen. Een SLO zonder alarm is een
   rapportcijfer achteraf.
3. **Een gemeten basislijn.** De streefwaarden hierboven zijn verstandig gekozen,
   niet gemeten. Ze horen na een maand echt verkeer bijgesteld te worden naar wat
   het systeem werkelijk doet -- omhoog als het makkelijk gehaald wordt, en
   omlaag met een reden als dat niet lukt. De meter zegt dat zelf ook: zolang er
   te weinig verkeer of te kort gemeten is, is de uitslag "onvoldoende gemeten"
   en niet "gehaald".
4. **Een piket.** Een doel van 99,9% betekent dat iemand 's nachts opneemt. Dat
   is een personeelsafspraak, geen code.

Punt 1 tot en met 4 zijn geen technische restpunten maar de voorwaarden om deze
tabel serieus te kunnen noemen. Ze staan hier omdat een SLO-document dat zijn
eigen gaten verzwijgt, erger is dan geen SLO-document.

## Herstel: gemeten

| Leden | RTO (schijf weg -> lid ingelogd) | RPO |
|---|---|---|
| 25.000 | 7,7 s | tot 24 uur |
| 250.000 | 8,9 s | tot 24 uur |

Gemeten op 2 augustus 2026 met `scripts/hersteltijd.js`; zie `PRODUCTION.md` voor
de voorbehouden (lokale schijf, en de tijd tot het BESLUIT om te herstellen zit
er niet in -- dat is meestal het langste deel).

De RPO van 24 uur is de zwakste schakel in dit document. Hij volgt uit het
dagelijkse back-upritme, en hij is niet met code op te lossen: er moet vaker
een back-up gemaakt worden, of de opslag moet naar Postgres met point-in-time
recovery. Dat is een keuze met kosten, en dus een besluit van de directie.

## Wat wij bij een storing doen

Zie `DATALEK.md` voor een incident met persoonsgegevens (andere keten, andere
termijnen -- 72 uur meldplicht) en `PRODUCTION.md` hoofdstuk 3 voor herstel uit
back-up.
