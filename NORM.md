# De norm

_Wat "minimaal enterprise" hier betekent -- en hoe dat vast blijft liggen._

Een kwaliteitsronde verdampt. Je haalt de lat, je gaat verder, en een half jaar
later is de helft weggezakt zonder dat iemand een besluit heeft genomen. Niemand
heeft het stukgemaakt; het is gewoon gebeurd.

Dit document beschrijft de lat. `NORM.json` legt vast waar de code staat, en
`scripts/norm.js` bewaakt dat het niet slechter wordt. Die combinatie is het
verschil tussen "we halen het" en "we blijven het halen".

## De ratel

```
node --experimental-sqlite scripts/norm.js              # controleren
node --experimental-sqlite scripts/norm.js --vastleggen # verbetering vastleggen
```

Draait mee in CI. De regel is eenvoudig:

- **slechter dan de norm** -> de poort gaat dicht, de build zakt
- **beter dan de norm** -> geen fout, wel de melding dat de lat omhoog kan
- **de norm verlagen** kan alleen door `NORM.json` met de hand te wijzigen

Dat laatste is met opzet omslachtig. Wie de lat wil verlagen mag dat, maar dan
staat het als bewuste keuze in de git-historie in plaats van als sluipende
erosie. Dat is het hele punt: niet onmogelijk maken, wel zichtbaar.

## Wat er bewaakt wordt

| Meter | Richting | Waarom |
|---|---|---|
| `endpointsZonderTest` | omlaag | wat nergens wordt aangeraakt, is niet bewezen |
| `dekkingPct` | omhoog | hetzelfde, als percentage |
| `dekkingWaargenomenPct` | omhoog | hetzelfde, maar dan waargenomen -- zie hieronder |
| `keuringStuk` | omlaag | moet nul blijven; dit is wat kapot is |
| `keuringScheef` | omlaag | wat niet klopt maar nog niet omvalt |
| `keuringBeter` | omlaag | de backlog; mag groeien noch stilstaan |
| `dependencies` | omlaag | de nul is een principe, geen toeval |
| `testbestanden` | omhoog | een tak zonder test hoort niet te bestaan |

## Twee dekkingscijfers, en welk van de twee telt

`endpointsZonderTest` en `dekkingPct` komen uit een TEKSTZOEKTOCHT: `scripts/keuring.js`
kijkt of de naam van een route ergens in de broncode van de tests voorkomt. Dat
cijfer zit er twee kanten op naast.

- **Te laag.** Een suite die zijn routes via een hulpje in twee stappen opbouwt,
  noemt ze nergens letterlijk. `test/rechterhand.test.js` toetst 69 endpoints in
  18 tests; de teller zag er nul van.
- **Te hoog, en dat is het ergere.** Een pad in een commentaarregel telt gewoon
  mee. Het cijfer is dus met een zoek-en-vervang op te poetsen zonder ook maar
  een test te schrijven.

Daarom staat er een tweede meter naast, en die telt:

| Meter | Waar hij vandaan komt | Wie hem bewaakt |
|---|---|---|
| `dekkingPct` | tekstzoektocht door de tests | `scripts/norm.js` |
| `dekkingWaargenomenPct` | het routejournaal van de server zelf | `scripts/dekking.js` |

`server/routelog.js` laat de server tijdens de testrun opschrijven welk
ROUTEPATROON hij heeft afgehandeld. Wat daarin staat is aangeroepen; wat er niet
in staat, niet. Er valt niets aan te praten, en geen opmaaktruc beinvloedt het.

```
npm run dekking          # draait de suite zelf en meet
npm run dekking:vast     # legt een verbetering vast (weigert een verslechtering)
```

In CI kost het niets extra's: de bestaande teststap krijgt `RTG_ROUTELOG` mee, en
de meting is een aparte, goedkope stap die het journaal leest.

Drie dingen die met opzet NIET meetellen:

1. **De grens-sweep.** Die raakt elk endpoint een keer aan; telde hij mee, dan
   stond de teller op honderd procent terwijl er niets diepgaands bewezen was.
   Zijn server draait daarom met het journaal uit.
2. **Een leeg journaal.** `scripts/dekking.js` weigert een cijfer te melden bij
   minder dan vijftig patronen. Een vergeten omgevingsvariabele hoort luid te
   falen, niet stil "0%" te melden.
3. **`/api/test/*`.** Die twee opzettelijke storingen bestaan alleen onder
   `NODE_ENV=test`; ze horen niet op de routekaart en gelden dus niet als drift.

De oude teller blijft staan omdat hij snel is en geen suite hoeft te draaien. Hij
is de indicatie; het journaal is het bewijs.

## De poorten die er al waren

De ratel komt bovenop wat er al stond, niet ervoor in de plaats:

| Poort | Wat hij tegenhoudt |
|---|---|
| `scripts/check.js` | huisregels, modulegrootte (<= 10 KB), nul dependencies, bedradingscontract |
| `scripts/ast-scan.js` | statische analyse over de hele boom |
| `scripts/poortwacht.js` | klopt anoniem aan bij elke API-route; geen enkele mag opendoen |
| `test/scheiding.test.js` | elke handler die een id uit het verzoek leest, heeft een poortwachter |
| `test/grens-sweep.test.js` | elk endpoint een keer aangeroepen: geen 500, geen kluisdata van een ander |
| `test/wiring-contract.test.js` | aangeroepen methoden bestaan ook echt |
| `scripts/geheimen.js` | geen sleutels of tokens in de broncode |
| `npm audit --audit-level=high` | kwetsbare pakketten (er zijn er nul, maar de poort blijft) |
| CodeQL | bekende bug- en kwetsbaarheidspatronen |
| `scripts/a11y.js` | toegankelijkheid van de vlaggenschipschermen |
| `scripts/beproeving.js` | de storm: gedrag onder last en chaos |
| `scripts/hersteltijd.js` | herstel uit back-up, geklokt (RTO) |
| `scripts/dekking.js` | endpoints die tijdens de hele suite NOOIT zijn aangeroepen |

## Wat de norm NIET dekt, en dat is geen slordigheid

De ratel bewaakt wat meetbaar is in deze repo. Vier dingen die bij "enterprise"
horen, kunnen daar niet in staat, en het zou oneerlijk zijn te doen alsof wel:

1. **Een pentest door een derde partij.** Geen enkele eigen poort vervangt
   iemand die er met andere ogen naar kijkt. Zie `PRODUCTION.md` hoofdstuk 7.
2. **SOC 2 Type II of ISO 27001.** Dat is maanden bewijsvoering verzamelen over
   processen en mensen, geen codewijziging.
3. **De ondertekende verwerkersovereenkomsten** (`VERWERKERS.md`, 7 partijen) en
   de risicoweging in de DPIA (`DPIA.md`, hoofdstuk 3 en 4 staan op
   `[TE BEOORDELEN]`).
4. **Moderatie en piket.** De RTFoundation richt zich op minderjarigen; dat
   vraagt mensen, geen regels code. En een SLO van 99,9% (`SLO.md`) betekent dat
   iemand 's nachts opneemt.

Deze vier staan hier zodat niemand de groene CI voor een compleet antwoord
aanziet.

## De stand vandaag

Zie `NORM.json` voor de exacte cijfers. Op het moment van vastleggen:

- 2511 API-routes, waarvan **2364 (94%) tijdens de suite echt zijn aangeroepen**
  -- gemeten, niet geschat, uit het routejournaal van 2509 tests
- 1597 (64%) komen bij NAAM in een test voor; dat lagere getal is de
  tekstzoektocht, niet de werkelijkheid (zie hierboven)
- de 147 die nooit werden aangeraakt, zitten nu vrijwel allemaal in `supplier`
  (123), met `foundation` (22) als enige andere blok -- daar ligt het volgende
  werk
- `test/grens-sweep.test.js` roept ze wel aan met vier harde eisen, maar telt
  bewust niet mee: dat is een vloer, geen dekking
- 0 stuk, 0 scheef, 127 "kan beter" in de keuring
- 0 externe pakketten
- 418 testbestanden

De teller hoort te blijven wijzen waar de echte tests nog moeten komen. Dat is
precies waarom de sweep er niet in meetelt en waarom het waargenomen cijfer
leidend is: het eerste dat de waarneming opleverde, was dat de tekstteller een
heel domein (Rechterhand, 69 endpoints) als ongetest opvoerde terwijl er 300
regels test voor stonden -- werk dat anders opnieuw was gedaan.
