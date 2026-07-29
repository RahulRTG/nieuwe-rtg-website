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

| # | Doel | Meting | Streefwaarde | Venster |
|---|---|---|---|---|
| 1 | **Beschikbaarheid** | aandeel verzoeken zonder 5xx | 99,9% | 30 dagen |
| 2 | **Snelheid, gewoon werk** | p90 van `rtg_duur_seconden` op lees-endpoints | < 250 ms | 30 dagen |
| 3 | **Snelheid, staart** | p99 van `rtg_duur_seconden` op lees-endpoints | < 1 s | 30 dagen |
| 4 | **Inloggen** | aandeel `/api/auth/login` zonder 5xx | 99,95% | 30 dagen |
| 5 | **Betalen** | aandeel betaalroutes zonder 5xx | 99,95% | 30 dagen |

Doel 4 en 5 staan strenger dan doel 1, en dat is geen slordigheid: wie niet kan
inloggen ziet niets, en wie niet kan betalen ziet een half afgeronde transactie.
Dat weegt zwaarder dan een trage overzichtspagina.

### Het foutbudget

99,9% over 30 dagen is **43 minuten en 12 seconden** storing per maand. Dat is
het budget. Zolang er budget over is, mag er uitgerold worden. Is het op, dan
gaat de aandacht naar stabiliteit tot de volgende periode -- geen nieuwe
functies. Dit is de hele reden dat een foutbudget bestaat: het maakt de afweging
tussen snelheid en stabiliteit een cijfer in plaats van een discussie.

99,95% is 21 minuten en 36 seconden.

## Wat hier NOG NIET staat, en eerlijk gezegd moet

1. **Een meting van buitenaf.** Alles hierboven wordt door de app zelf geteld.
   Ligt de app plat, dan telt er niets -- en dan ziet de grafiek er prima uit.
   Een externe controle die elke minuut van buiten aanklopt, is nodig voordat
   deze cijfers iets waard zijn tegenover een klant. `scripts/rand.js` doet een
   eenmalige controle van buitenaf; een doorlopende hoort erbij.
2. **Alertregels in de repo.** De cijfers worden gemeten maar er gaat nog niemand
   piepen. Een SLO zonder alarm is een rapportcijfer achteraf.
3. **Een gemeten basislijn.** De streefwaarden hierboven zijn verstandig gekozen,
   niet gemeten. Ze horen na een maand echt verkeer bijgesteld te worden naar wat
   het systeem werkelijk doet -- omhoog als het makkelijk gehaald wordt, en
   omlaag met een reden als dat niet lukt.
4. **Een piket.** Een doel van 99,9% betekent dat iemand 's nachts opneemt. Dat
   is een personeelsafspraak, geen code.

Punt 1 tot en met 4 zijn geen technische restpunten maar de voorwaarden om deze
tabel serieus te kunnen noemen. Ze staan hier omdat een SLO-document dat zijn
eigen gaten verzwijgt, erger is dan geen SLO-document.

## Wat wij bij een storing doen

Zie `DATALEK.md` voor een incident met persoonsgegevens (andere keten, andere
termijnen -- 72 uur meldplicht) en `PRODUCTION.md` hoofdstuk 3 voor herstel uit
back-up.
