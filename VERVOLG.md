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
KETENS           3 ketens · GELDPROVEN 2/3 · stilVerlies 1 (notities)
KLOK             1.298 directe tijdsaanroepen · 2 modules op de klok
```

Alle poorten groen, werkboom schoon, alles gepusht op
`claude/suites-tests-mutations-overview-m97u1d`.

## Twee besluiten die al genomen zijn

1. **`saveDuurzaam()` gaat gelden voor geld én alles wat een lid zelf maakt** —
   notities, agenda, bestanden, berichten. Niet voor herbouwbare toestand. Zie
   `GELDLAT.md`, paragraaf over de reikwijdte. Geld is al aangesloten; de rest
   niet.
2. **De invariantenmotor is de volgende laag** (niveau 5 uit `TOEZICHT.md`), met
   vijf kandidaat-wetten die daar al staan.

## De eerstvolgende handelingen, op volgorde

### A. Notities duurzaam maken (klein, en sluit een open bevinding)

```
server/kern/notities.js:70    bewaar() is SYNCHROON. Maak hem async en vervang
                              de laatste save() door:
                                await bijeen(async () => { ... }, {duurzaam:true})
server/routes/notities.js:18  await ervoor  (2 aanroepplekken in totaal)
scripts/check.js  regel 47    'server/kern/notities.js' op TOEGESTAAN, met reden
verifiëren                    npm run ketenronde → stilVerlies 1 → 0
```

Daarna hetzelfde voor agenda, bestanden en berichten.

### B. De goedkope drie matrixkolommen (grootste beweging, minste nieuwe code)

```
1  node --experimental-sqlite scripts/rolproef-route.js --max=8000
   → ACL en PRIVACY van 999 naar ~3000 elk. Alleen een groter getal, geen code.

2  INPUT: variant op scripts/rolproef-route.js — rommel-lijf met de JUISTE rol,
   en de bewering is: geen 5xx en geen stacktrace in het antwoord.

3  IDEMPOTENCY: zelfde harnas — elke schrijfroute twee keer met dezelfde sleutel,
   en kijken of er een tweede effect is.
```

Samen goed voor ruwweg 15.000 cellen, zonder één nieuwe ontwerpbeslissing.

### C. De prestatiemeting van de duurzame commit

`npm run beproeving` met en zonder, en dan p95/p99 en het event-loop-effect
naast elkaar. Dat getal ontbreekt nog en het is het enige dat `GELDPROVEN 3/3`
tegenhoudt. Het is géén poort meer — het besluit is genomen — maar de uitkomst
is wel informatie die terug moet.

### D. STATE, SIDE_EFFECT en ROLLBACK

Niet als drie losse meters bouwen. Ze vragen alle drie een per-route
vingerafdruk van "wat is er veranderd", en dat is precies de invariantenmotor.
Drie meters die elkaar niet kennen is duurder en zegt minder.

## Valkuilen die al een keer geld hebben gekost

Deze staan hier omdat ik er vandaag in ben gelopen. Ze zien er allemaal uit als
een goed idee.

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
- **Geen antwoord is iets anders dan een weigering.** Bij een weigering hoort
  er niets te blijven staan; bij een crash vóór de response hoort de duurzame
  boeking juist wél te blijven. Op een hoop gegooid meldt de proef correct
  gedrag als fout.
- **Een toets die een bewegende waarde vastpint, houdt vooruitgang tegen.** Een
  toets legde `geldcommit aangesloten: NIET AANGESLOTEN` vast en viel om zodra
  dat PROVEN werd.
- **Een keten die achter een poort zit, is niet blind maar ongemeten.** RTG Pay
  weigert een lid zonder geverifieerd paspoort (403). Die poort omzeilen meet
  een pad dat in productie niet bestaat; ga er doorheen met het geverifieerde
  account.

## De regels die overal gelden

- Geen groen zonder noemer (`x / y`, met de eenheid).
- Geen nul zonder bewezen zicht — `ONGEMETEN` is geen `0`.
- Een bevinding maakt CI niet rood; blindheid en onherhaalbaarheid wel.
- Elke bewering natrekken met een mutatie (`npm run mutatie test/x.test.js`).
  Kan dat niet (subprocestoets), zet het dan als bewijssoort in de control.
