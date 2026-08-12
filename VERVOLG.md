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
BEWIJSMATRIX     5.984 bewezen · 37.588 ongemeten · 3 gezakt   (43.835 cellen)
                 leeg: INPUT OUTPUT STATE SIDE_EFFECT AUDIT IDEMPOTENCY ROLLBACK
CONTROLS         9, waarvan 1 niet in bedrijf (AUDIT-KETEN-VERANKERD)
VERRAADSMOTOR    4 / 9 ingebouwd
KETENS           3 ketens · 9 scenarios · 4 voldoen aan de lat
                 GELDPROVEN 2/3 · rollback bewezen 2 · stilVerlies 0
KLOK             1.298 directe tijdsaanroepen · 2 modules op de klok
```

**`stilVerlies` staat op nul** sinds notities duurzaam vastlegt (12 augustus). De
BEWIJSMATRIX-getallen hierboven zijn nog die van vóór die reparatie: de matrix
leest `KETENS.json`, maar hij weigert terecht zichzelf te herschrijven uit een
ronde die minder invoer heeft dan de vorige (de ratel). Hij pakt de winst op bij
de eerstvolgende volledige meetronde — poortwacht én rolproef mee, zie de
opdracht die het script zelf afdrukt.

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

### B. De goedkope drie matrixkolommen (grootste beweging, minste nieuwe code)

```
1  node --experimental-sqlite scripts/rolproef-route.js --max=8000
   → ACL en PRIVACY van 999 naar ~3000 elk. Alleen een groter getal, geen code.

2  INPUT: variant op scripts/rolproef-route.js — rommel-lijf met de JUISTE rol,
   en de bewering is: geen 5xx en geen stacktrace in het antwoord.

3  IDEMPOTENCY: zelfde harnas — elke schrijfroute twee keer met dezelfde sleutel,
   en kijken of er een tweede effect is.
```

Samen goed voor ruwweg 15.000 cellen, zonder één nieuwe ontwerpbeslissing. Draai
daarna meteen de volledige matrixronde, dan komt de notitiewinst er ook in.

### C. De prestatiemeting van de duurzame commit

`npm run beproeving` met en zonder, en dan p95/p99 en het event-loop-effect
naast elkaar. Dat getal ontbreekt nog en het is het enige dat `GELDPROVEN 3/3`
tegenhoudt. Het is géén poort meer — het besluit is genomen — maar de uitkomst
is wel informatie die terug moet, en ze is sinds notities breder: er hangen nu
vijf schrijfroutes meer aan de fsync, waaronder `notities/vink`, die van alle
duurzame routes het vaakst wordt ingedrukt.

### D. STATE, SIDE_EFFECT en ROLLBACK

Niet als drie losse meters bouwen. Ze vragen alle drie een per-route
vingerafdruk van "wat is er veranderd", en dat is precies de invariantenmotor.
Drie meters die elkaar niet kennen is duurder en zegt minder.

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
