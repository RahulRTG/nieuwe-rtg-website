# Waar het werk stopte — start hier

Dit bestand is geschreven aan het eind van de ronde van 11–12 augustus 2026, voor
wie hier fris binnenkomt. Het bestaat om één reden: alles hieronder is al een
keer uitgezocht, en een deel ervan is duur uitgezocht. Lees het voordat je iets
opnieuw bedenkt.

Achtergrond staat in `GELDLAT.md` (het contract voor geld) en `TOEZICHT.md`
(hoe bewijs wordt vastgelegd, en de vijf niveaus). Dit is alleen de stand en de
volgende handeling.

## De stand in getallen

```
BEWIJSMATRIX     12.365 bewezen · 31.102 ongemeten · 108 gezakt  (43.835 cellen)
                 instrument op 7 van de 11 kolommen
                 nog leeg: OUTPUT  STATE  SIDE_EFFECT  AUDIT
CONTROLS         11, waarvan 1 niet in bedrijf (AUDIT-KETEN-VERANKERD) en
                 1 hier niet meetbaar (UI-WAARHEID: geen browser in deze omgeving)
VERRAADSMOTOR    4 / 9 ingebouwd
KETENS           3 ketens · 9 scenarios · 4 voldoen aan de lat
                 GELDPROVEN 2/3 · rollback bewezen 2 · stilVerlies 0
ROL-SCHEIDING    2.937 / 2.937 schrijfroutes · 0 doorbraken · 0 lekken
INVOER           2.510 / 2.936 routes voorbij de poort · 0 breuken · 0 sporen
IDEMPOTENTIE     12 beschermd · 94 onbeschermd · 106 van 2.936 beoordeeld
KLOK             1.298 directe tijdsaanroepen · 2 modules op de klok
```

De sprong van 5.984 naar 12.365 komt uit stap B: de rolproef over alle routes in
plaats van een derde, plus twee nieuwe instrumenten (INVOER en IDEMPOTENCY).

**De 108 gezakte cellen zijn geen nieuwe schade**, ze zijn nieuw ZICHTBAAR:
12 routes waar de poortwacht zonder token binnenkwam (die stonden daarvoor als
*bewezen* in de matrix — zie de valkuilen), en 94 routes waar een herhaalde
opdracht het gewoon nog een keer doet. Dat laatste is een werklijst van routes
die een idem-sleutel nodig hebben, geen lijst met bugs.

Alle poorten groen, werkboom schoon.

## Twee besluiten die al genomen zijn

1. **`saveDuurzaam()` gaat gelden voor geld én alles wat een lid zelf maakt** —
   notities, agenda, bestanden, berichten. Niet voor herbouwbare toestand. Zie
   `GELDLAT.md`, paragraaf over de reikwijdte. **Geld en notities zijn
   aangesloten; agenda, bestanden en berichten nog niet.**
2. **De invariantenmotor is de volgende laag** (niveau 5 uit `TOEZICHT.md`), met
   vijf kandidaat-wetten die daar al staan.

## De eerstvolgende handelingen, op volgorde

### A. De andere drie apps duurzaam maken (het patroon ligt er)

Notities is klaar en de weg is geplaveid: `server/lib/duurzaam.js` is de gedeelde
helper, en aansluiten is drie handelingen.

```
1  de kern:      const vastleggen = require('../lib/duurzaam')({ bijeen, save, bron: '<app>' })
                 elke schrijffunctie async, en de save() vervangen door
                   const mis = await vastleggen(() => { ...mutaties... });
                   if (mis) return mis;
2  server.js:    `bijeen` meegeven aan de maak<App>()-aanroep
3  de routes:    `async` + `await` op ELKE schrijfroute van die app
4  check.js 47:  het kernbestand op TOEGESTAAN, met de reden erbij
```

Op volgorde: **agenda** (hangt al aan notities vast via de gekoppelde afspraak),
dan **bestanden**, dan **berichten**. Let bij bestanden op de bytes op schijf —
die staan al buiten de database en hebben hun eigen duurzaamheidsvraag.

Verifiëren doe je niet met de toets alleen: `npm run ketenronde` meet alleen de
notitieketen, dus een nieuwe app hoort een eigen keten te krijgen óf een eigen
toets in de vorm van `test/notitiesduurzaam.test.js` (vijf beweringen, alle vier
de mutaties raak — zie het commit-bericht).

### ~~B. De goedkope drie matrixkolommen~~ — GEDAAN op 12 augustus

Alle drie staan er, met een register en een eigen toets. De vier rondes draaien
los en schrijven elk hun eigen bestand; de matrix leest ze nu vanzelf uit de
wortel (dat stond eerst achter een vlag, zie de valkuilen).

```
npm run poortwacht -- --json --per-route > POORTWACHT.json    AUTH
npm run rolproef -- --max=8000                                ACL + PRIVACY
npm run invoerproef                                           INPUT
npm run idemproef                                             IDEMPOTENCY
npm run bewijsmatrix -- --vastleggen
```

**De schatting in dit bestand was te optimistisch, en dat is het leerzame deel.**
"Ruwweg 15.000 cellen" ging uit van drie kolommen van elk ~3.000. ACL, PRIVACY en
INPUT haalden dat (2.937, 2.937 en 2.510). IDEMPOTENCY haalde er **106** — van de
2.936 routes gaven er maar 106 een antwoord waaraan een tweede effect te ZIEN was.
De rest doet zijn tweede schrijfactie stil, en van buiten is dat niet te meten.
Dat is geen tekort van de proef maar de grens ervan, en hij zegt het per route
met reden. Wie die 2.830 alsnog wil, heeft de per-route vingerafdruk uit D nodig.

Wat er van B nog open ligt: de 94 routes die als `onbeschermd` uit de ronde komen.
Ze staan met naam in `IDEMPROEF.json`. Dat is een werklijst voor idem-sleutels,
geen buglijst — begin bij de routes die geld of toegang raken.

### C. De prestatiemeting van de duurzame commit

`npm run beproeving` met en zonder, en dan p95/p99 en het event-loop-effect
naast elkaar. Dat getal ontbreekt nog en het is het enige dat `GELDPROVEN 3/3`
tegenhoudt. Het is géén poort meer — het besluit is genomen — maar de uitkomst
is wel informatie die terug moet, en ze is sinds notities breder: er hangen nu
vijf schrijfroutes meer aan de fsync, waaronder `notities/vink`, die van alle
duurzame routes het vaakst wordt ingedrukt.

### D. STATE, SIDE_EFFECT en ROLLBACK — en nu ook de staart van IDEMPOTENCY

Niet als drie losse meters bouwen. Ze vragen alle drie een per-route
vingerafdruk van "wat is er veranderd", en dat is precies de invariantenmotor.
Drie meters die elkaar niet kennen is duurder en zegt minder.

Sinds stap B is er een vierde klant voor diezelfde vingerafdruk: de 2.830 routes
waar de idempotentieproef van buitenaf niets kan zien. Dat maakt D goedkoper dan
hij leek — één instrument vult vier kolommen in plaats van drie.

### E. De twaalf open voordeuren

De poortwacht komt op twaalf routes zonder token binnen. Ze zien er allemaal uit
als bewust publiek (RTFoundation-campagnes, de algoritmeregisters van RTG Stad,
de lijst rechtsvormen), maar ze staan niet op de `PUBLIEK`-lijst — en tot dat
besluit is genomen, staan ze als GEZAKT in de AUTH-kolom. Twee mogelijke
uitkomsten: op de lijst met een reden, of een poort ervoor. Beide zijn goed;
stilletjes zo laten is dat niet. Ze staan in `POORTWACHT.json` met `oordeel: open`.

## Valkuilen die al een keer geld hebben gekost

Deze staan hier omdat ik erin ben gelopen. Ze zien er allemaal uit als een goed
idee.

- **Observeren is niet genoeg bij duurzaamheid.** Wachten tot een
  persistentieteller oploopt werkt niet: de opslag is write-behind, dus op het
  moment dat de route antwoordt is er nog niets geprobeerd. Er moet
  afgedwongen worden. (Brak vier geldtoetsen met 503.)
- **Zet een verraad nooit vóór de boekhouding van een bundel.** In `save()`
  stond de verraadcontrole vóór het zetten van de flush-vlag; onder
  `schrijf-verloren` zette het verraad daarmee niet de opslag uit maar de
  MEETOPSTELLING. Alles bleef groen omdat er niets meer gebeurde.
- **`saveDuurzaam()` mag geen algemene synchrone save worden.** Regel 47 in
  `npm run check` bewaakt dat met een lijst. De lijst wordt langer, niet losser.
- **Een poort die de gebruikte deur niet bewaakt, is erger dan geen poort.**
  Regel 47 zocht op de NAAM `saveDuurzaam` — en niemand roept die naam aan. De
  weg erheen is `bijeen(fn, { duurzaam: true })`. Wie een route duurzaam maakte,
  kwam er dus ongezien langs, terwijl de regel groen meldde en dus als dekking
  las. Hij kijkt nu naar het BEREIK (naam, bundelvlag, gedeelde helper). De
  mutatie die dit aantoont staat in het commit-bericht: een smokkelbestand met
  alleen de vlag erin kwam er onder de oude regel doorheen.
- **Alleen de gemeten knop repareren is het symptoom repareren.** De ketenronde
  meet `notities/bewaar`; het bord heeft vier schrijfknoppen. Een lid ziet niet
  welke ervan beschermd is.
- **Geen antwoord is iets anders dan een weigering.** Bij een weigering hoort
  er niets te blijven staan; bij een crash vóór de response hoort de duurzame
  boeking juist wél te blijven. Op een hoop gegooid meldt de proef correct
  gedrag als fout.
- **Een toets die een bewegende waarde vastpint, houdt vooruitgang tegen.** Een
  toets legde `geldcommit aangesloten: NIET AANGESLOTEN` vast en viel om zodra
  dat PROVEN werd. Zelfde val bij de volgende stap: leg in een toets niet vast
  dat de agenda nog NIET duurzaam is.
- **Een keten die achter een poort zit, is niet blind maar ongemeten.** RTG Pay
  weigert een lid zonder geverifieerd paspoort (403). Die poort omzeilen meet
  een pad dat in productie niet bestaat; ga er doorheen met het geverifieerde
  account.
- **Niet elke 5xx is een crash.** De invoerproef las in zijn eerste versie elke
  5xx als "omgevallen" en meldde meteen drie loze bevindingen op
  `/api/bank/krediet*`. In dit huis is 503 een ONTWORPEN antwoord: de API-poort
  staat uit, een functie is geschakeld, er is een vergunning nodig, de opslag
  laadt nog. Dat is een handler die werkt. 503 telt daarom als grendel — zelfde
  stand als 401 en 403 — en alleen 500/502/504 en "geen antwoord" zijn een breuk.
  Na drie keer loos alarm zet iemand de proef uit, en dan meet er niets meer.
- **Een instrument dat achter een vlag ligt, wordt niet gedraaid.** De matrix las
  `ROLPROEF.json` alleen met `--rolproef=...`; zonder die vlag meldde
  `npm run bewijsmatrix` "ACL 999 → 0, is de meetronde meegeleverd?" en zakte op
  zijn eigen ratel — over invoer die gewoon in de wortel lag. De registers worden
  nu standaard gelezen; de vlag blijft om een ánder bestand aan te wijzen.
- **Beproefd en gezakt is geen bewijs — ook niet bij de voordeur.** De matrix nam
  elk poortwacht-oordeel over als `bewezen`, ook `open`. Twaalf routes waar een
  vreemde zonder token binnenkwam, telden dus mee als dekking. ACL en PRIVACY
  deden het drie regels lager al goed; AUTH niet.
- **Een control die niet KAN draaien is niet GEZAKT.** UI-WAARHEID kwam binnen als
  gezakt omdat Playwright zijn binaire bestand miste, niet omdat een scherm loog.
  Dat wegschrijven als defect stuurt de volgende lezer een fout zoeken die er niet
  is. Nu: `niet gemeten`, met de reden — en dat is nadrukkelijk geen groen.
- **Een naam die het verkeerde belooft, kost een factor.** `maxPerRol` was een
  budget voor de HELE ronde. `--max=2000` las als "2000 per rol" en leverde 1000
  van de 2937 routes. Hij heet nu `maxPogingen`.
- **Draai een mutatie nooit terug met `git checkout <bestand>`.** Die gooit ook
  het werk weg dat je in datzelfde bestand nog niet had ingeleverd — hier
  verdween zo de hele reparatie van regel 47, en dat merk je pas als je hem
  opnieuw zoekt. Kopie in een kladmap vóór de mutatie, kopie terug erna.
- **Commentaar telt mee in de modulegrootte-poort.** `notities.js` ging over de
  10 KB door de uitleg erboven. Dat is geen te strenge poort maar een signaal:
  de uitleg hoorde bij de gedeelde helper, niet bij de eerste app die hem
  gebruikt. De poort wees de goede kant op.

## De regels die overal gelden

- Geen groen zonder noemer (`x / y`, met de eenheid).
- Geen nul zonder bewezen zicht — `ONGEMETEN` is geen `0`.
- Een bevinding maakt CI niet rood; blindheid en onherhaalbaarheid wel.
- Elke bewering natrekken met een mutatie (`npm run mutatie test/x.test.js`).
  Kan dat niet (subprocestoets), zet het dan als bewijssoort in de control.
