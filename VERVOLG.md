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
BEWIJSMATRIX     15.044 bewezen · 28.431 ongemeten  (43.857 cellen)
                 instrument op 9 van de 11 kolommen
                 nog leeg: OUTPUT  AUDIT
DUURZAAM         geld · notities · agenda · bestanden (incl. delen) · berichten
                 kosten: p50 x2,01 · p95 x1,49 · p99 x0,84 (controle x1,03)
CONTROLS         12, waarvan 1 niet in bedrijf (AUDIT-KETEN-VERANKERD) en
                 1 hier niet meetbaar (UI-WAARHEID: geen browser in deze omgeving)
VERRAADSMOTOR    4 / 9 ingebouwd
KETENS           3 ketens · 9 scenarios · 4 voldoen aan de lat
                 GELDPROVEN 2/3 · rollback bewezen 2 · stilVerlies 0
POORTWACHT       3.987 routes · 0 open · 43 publiek met een reden
ROL-SCHEIDING    2.937 / 2.937 schrijfroutes · 0 doorbraken · 0 lekken
INVOER           2.510 / 2.936 routes voorbij de poort · 0 breuken · 0 sporen
IDEMPOTENTIE     12 beschermd · 94 onbeschermd · 106 van 2.936 (op het ANTWOORD)
TOESTAND         2.338 / 2.936 beoordeeld (80%) · 7 rollback gezakt
                 STATE 224 · SIDE_EFFECT 224 · ROLLBACK 2.107 · IDEM 124/224
KLOK             1.298 directe tijdsaanroepen · 2 modules op de klok
```

Van 5.972 naar 15.044 bewezen cellen in één dag: stap B (de rolproef over alle
routes, plus INVOER en IDEMPOTENCY) en stap D (de toestandsvingerafdruk, die in
zijn eentje STATE, SIDE_EFFECT en ROLLBACK opent).

**De twaalf open voordeuren zijn dicht** — niet met een poort maar met een
besluit: alle twaalf stonden in de bron al beschreven als bewust publiek en staan
nu met een reden per regel op de PUBLIEK-lijst (TAKEN 4.29).

Wat er aan gezakte cellen overblijft, zijn de 94 routes waar een herhaalde
opdracht het gewoon nog een keer doet. Dat is een werklijst voor idem-sleutels,
geen buglijst.

Alle poorten groen, werkboom schoon.

## Twee besluiten die al genomen zijn

1. **`saveDuurzaam()` gaat gelden voor geld én alles wat een lid zelf maakt** —
   notities, agenda, bestanden, berichten. Niet voor herbouwbare toestand. Zie
   `GELDLAT.md`, paragraaf over de reikwijdte. **Alle vijf aangesloten, compleet** —
   inclusief delen, versies en de prullenbak.
2. **De invariantenmotor is de volgende laag** (niveau 5 uit `TOEZICHT.md`), met
   vijf kandidaat-wetten die daar al staan. De toestandsvingerafdruk uit stap D
   is daarvan het meetdeel; wat er nog ontbreekt zijn de WETTEN zelf.

## De eerstvolgende handelingen, op volgorde

### ~~A. De andere drie apps duurzaam maken~~ — GEDAAN op 12 augustus

Agenda, bestanden en berichten hangen aan dezelfde helper als notities
(`server/lib/duurzaam.js`). Twee dingen die daarbij zijn geleerd en die voor de
rest van de reikwijdte net zo gelden:

**Nesting hoort ÉÉN commit te blijven.** Een notitie met een datum maakt een
agenda-afspraak, en allebei die lagen leggen duurzaam vast. Zonder maatregel
committeert de binnenste eerst en staat de afspraak vast voordat de notitie dat
is. `db.inBundel()` lost dat op: staat er al een bundel open, dan doet de
binnenste laag zijn mutatie gewoon mee.

**De async-keten loopt verder dan de app.** `agenda.voegToe` wordt ook gebruikt
door afgeleide schrijvers (visumtaak, de RTF-koppeling, postdatum). Niet awaiten
gaat daar STIL mis: de aanroeper krijgt een Promise, leest `r.ok` als undefined
en meldt "geen taak aangemaakt". Zes kernmodules en acht routebestanden mee.

En twee bugs die de toets blootlegde, allebei uit dezelfde familie als de
oorspronkelijke bevinding: `routes/agenda.js` gaf élke fout uit de kern als 400
terug (een opslagfout las dus als "u heeft iets verkeerd ingevuld"), en
`routes/member/berichtenapp.js` zette `ok: true` hard in het antwoord met de
uitkomst ernaast.

Sinds 12 augustus ook **`kern/bestanden-delen.js`** (delen, versies, prullenbak).
Daarmee is de reikwijdte uit GELDLAT.md compleet: een lid ziet niet welke knop
beschermd is, dus zijn ze het alle vier.

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

Wat er van B nog open ligt: de routes die als `onbeschermd` uit de ronde komen —
94 op het antwoord gemeten, 100 op de toestand (stap D ziet er meer).
Ze staan met naam in `IDEMPROEF.json`. Dat is een werklijst voor idem-sleutels,
geen buglijst — begin bij de routes die geld of toegang raken.

### ~~C. De prestatiemeting van de duurzame commit~~ — GEDAAN op 12 augustus

`npm run kosten` meet gepaard op één machine (zie `GELDLAT.md` stap 6 en
`DUURZAAMHEIDSKOSTEN.json`):

```
FACTOR p50 duurzaam  2,01x      p95  1,49x      p99  0,84x
FACTOR p50 CONTROLE  1,03x   <- de ijklijn
```

De mediaan verdubbelt (~3 ms per schrijfactie), **de staart beweegt niet**. Dat
laatste was niet het verwachte antwoord: de p99 wordt hier niet bepaald door de
fsync maar door wat er sowieso al gebeurt (event loop, GC). `npm run beproeving`
twee keer draaien zou dit NIET hebben laten zien — daar verdrinken vier routes in
een storm over honderden endpoints, en de laatste vastgelegde ronde stond
bovendien op een andere machine én opslag, en die vergelijk je niet.

De schakelaar die de tweede meting mogelijk maakt (`RTG_DUURZAAM=uit`) weigert in
productie en schreeuwt bij elke start. Het is letterlijk de knop die de belofte
uitzet.

### ~~D. STATE, SIDE_EFFECT en ROLLBACK~~ — GEBOUWD op 12 augustus

`server/lib/vingerafdruk.js` + `/api/techniek/vingerafdruk` (achter techAuth) +
`npm run staatproef`. Per collectie een aantal en een gezouten hash over de
rij-hashes; nooit inhoud. Drie vingerafdrukken rond twee gelijke oproepen vullen
vier kolommen tegelijk.

**Drie regels die uit een echte valse bevinding zijn geboren**, en die alle drie
in `test/staatproef.test.js` staan:

1. **De per-route ijking.** Bewoog de eerste oproep niets, dan zegt "de herhaling
   bewoog ook niets" niets. Ongemeten, met reden.
2. **Omgevingsruis.** `doorgeefjournaal` en `rtgai` bewegen bij élk verzoek, ook
   bij een 404 — het huis dat opschrijft dat er is aangeklopt. De eerste ronde
   meldde negentien loze "geweigerd en toch veranderd" op rij. Ruis wordt nu
   gemeten in plaats van geraden: wat in ELKE ijkronde beweegt, en niet wat er
   één keer bewoog (dat verschil houdt `notities` in beeld).
3. **Eerste aanraking.** Een kern die zijn la inricht (`bankregie` met
   standaardwaarden) verandert de toestand ook als het verzoek daarna 403 geeft.
   Inrichting gebeurt één keer; de tweede, even hard geweigerde oproep laat alles
   met rust. Dát is het onderscheid, en het is meetbaar in plaats van geraden.

**Wat er nog niet in zit.** De meting wordt duurder naarmate hij vordert: de
proef maakt zelf data, en elke vingerafdruk hasht de hele opslag. Een volledige
ronde over 2.936 routes loopt daardoor niet lineair. Zolang dat zo is, draait hij
met een begrenzing die in het register staat (`gemeten.begrenzing`) — niet stil
afgekapt. De goedkope reparatie is een vingerafdruk die alleen de collecties
hasht die sinds de vorige aanroep van versie zijn veranderd; de opslag houdt die
versienummers al bij.

### ~~D-oud~~ — wat hem blokkeerde, voor de geschiedenis

Niet als drie losse meters bouwen. Ze vragen alle drie een per-route
vingerafdruk van "wat is er veranderd", en dat is precies de invariantenmotor.
Drie meters die elkaar niet kennen is duurder en zegt minder.

Sinds stap B is er een **vierde** klant voor diezelfde vingerafdruk: de 2.830
routes waar de idempotentieproef van buitenaf niets kan zien. Eén instrument
vult dus vier kolommen in plaats van drie — 15.700 cellen in potentie.

**De blokkade is één ding, en die is bij het bouwen van B scherp geworden.**
Alle vier de kolommen vragen hetzelfde: van BUITEN zien wat er in de database is
veranderd. Dat kan vandaag niet.

```
AUTH  ACL  INPUT  PRIVACY   meten het ANTWOORD          -> gebouwd
IDEMPOTENCY (106 routes)    meet het antwoord, indirect -> gebouwd, en meteen op
                                                           zijn grens gelopen
STATE  SIDE_EFFECT
ROLLBACK  IDEMPOTENCY-rest  meten de TOESTAND           -> geen zicht
```

De idempotentieproef laat precies zien waar het misgaat: hij kon 106 van de
2.936 routes beoordelen, en de andere 2.830 kregen `ongemeten` met de reden "het
antwoord verandert niet per oproep". Een route die stil aan een lijst toevoegt
zonder dat in zijn antwoord te tonen, is van buitenaf niet te beoordelen. Punt.

**Wat er dus eerst moet komen: een toestandsvingerafdruk.** Een goedkope,
gegevensvrije samenvatting van wat er in de opslag staat — per collectie een
aantal en een versienummer, geen inhoud — die een proef vóór en ná een verzoek
kan opvragen. Daarmee wordt per route zichtbaar WAT er veranderde, en dan vallen
de vier kolommen bijna vanzelf:

```
STATE         veranderde er iets, en was dat wat de route belooft
SIDE_EFFECT   veranderde er iets BUITEN de collectie van deze route
ROLLBACK      na een geweigerd verzoek: is de vingerafdruk gelijk gebleven
IDEMPOTENCY   beweegt de vingerafdruk bij de tweede oproep nog een keer
```

Drie ontwerpvragen die eerst een antwoord nodig hebben, en die geen van drieën
technisch zijn:

1. **Waar woont die vingerafdruk?** Een nieuw endpoint verbreedt de API van het
   platform voor een meetinstrument. Achter `techAuth` is het minst verrassend,
   maar de proeven komen daar vandaag niet bij (er is geen eigenaarsaccount op
   een wegwerpserver). De andere weg is de vorm van `RTG_VERRAAD` en `RTG_LIEG`:
   alleen aanwezig onder een vlag, weigert in productie.
2. **Wat mag erin staan?** Aantallen en versienummers, nooit inhoud. Een
   vingerafdruk die per ongeluk een codenaam of een bedrag meedraagt, is een
   nieuw lek in een instrument dat lekken moest vinden.
3. **Hoe grof mag hij zijn?** Per collectie is goedkoop en ziet "er kwam een rij
   bij". Per rij is duur en ziet "welke rij". Voor STATE en IDEMPOTENCY is het
   eerste genoeg; voor SIDE_EFFECT waarschijnlijk niet.

Dit is bewust NIET half gebouwd. Een vingerafdruk die niet alles ziet, meldt
"geen wijziging" over routes die wel degelijk schreven — en dat is precies de
meter die groen zegt zonder te kijken, waar deze hele reeks over gaat.

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
- **Een gedeelde schrijffunctie sleept zijn aanroepers mee.** `agenda.voegToe`
  wordt ook gebruikt door visumtaak, de RTF-koppeling en postdatum. Async maken
  zonder die te volgen gaat STIL mis: de aanroeper krijgt een Promise, leest
  `r.ok` als undefined en meldt keurig dat er geen taak is aangemaakt.
- **Twee keer dezelfde storm draaien is geen gepaarde meting.** Voor de
  kostenvraag moesten dezelfde machine, opslag en belasting twee keer, met
  alleen de schakelaar ertussen — plus een controlegroep die NIET duurzaam
  schrijft. Zonder die controle meet je hoe druk de machine toevallig was.
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
