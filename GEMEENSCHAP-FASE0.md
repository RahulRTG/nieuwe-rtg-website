# GEMEENSCHAP-FASE0.md -- de uitkomst van fase 0 voor FoundationOS

Dit is het resultaat van fase 0 uit `GEMEENSCHAP.md` (PR #544), uitgevoerd op een
eigen branch volgens de werkafspraak van 11 oktober 2026. Het levert de vier
dingen die de eigenaar vroeg: **de definitieve FoundationOS-architectuur**, **een
overzicht van herbruikbare functionaliteit**, **de noodzakelijke wijzigingen** en
**een gefaseerd implementatieplan**, plus het ontwerp en de toetsstrategie van de
samenwerkingsketen.

Wat deze ronde veranderde: één meetscript (`scripts/groepvorm.js`), zijn register
(`GROEPVORM.json`), zijn toets (`test/groepvorm.test.js`), de registratie van die
meter op de drie plekken waar dit huis meters registreert, en dit document. **Niets
in `server/` of `public/`.** De gebreken die het onderzoek in bestaande code vond
(par. 6) zijn met opzet niet gerepareerd; ze staan er met bewijs bij.

Bewijsgraden zoals in `BESTUUR.md`: **gemeten** = door een script vastgesteld,
**gelezen** = in de code nagelezen met regelnummer, **vermoed** = afgeleid en niet
gedraaid.

---

## 0. De uitkomst, in een zin

> **Er komt geen gemeenschapstabel. FoundationOS krijgt vier kleine bouwstenen die
> elk op een bestaand, beproefd mechanisme rusten, en een gedeelde vorm alleen
> waar de meting die aanwijst. De keten Drager → Verbond → Beraad → Besluit →
> Bijeenkomst → Terugkoppeling is daarmee te bouwen -- maar niet voordat vier
> gebreken in de bestaande groepslaag zijn gerepareerd en een privacyjurist de
> open vragen van par. 8 heeft beantwoord.**

---

## 1. De meting: hebben de groepsmodellen een gedeelde vorm?

`npm run groepvorm` (`GROEPVORM.json`) meet de groepsmodellen van
`GEMEENSCHAP.md` par. 1.1 met de lezer van `scripts/objectmodel.js` -- dezelfde als
bij `Asset`, `Koopbaar`, `Career`, `Moment` en `Manier` -- over twee lijsten:
**ruim** (het hele domein van elk model) en **smal** (alleen de module die de
groep zelf bewaart). De objectlaag staat er met reden buiten: hij bewaart niets.
Het gezin woont buiten het bereik van die lezer (`server/foundation/`) en is er met
dezelfde parser bij gelezen; dat staat als `extraBronnen` in de uitslag.

| | ruim | smal |
|---|---|---|
| modellen met een vorm | 16 van 17 | 13 van 17 |
| velden na de envelop | 264 | 89 |
| in **alle** modellen | **0** | **0** |
| in minstens de **helft** | **0** | **0** |
| in precies **één** model | 89,8% | 87,6% |
| breedst gedeeld | `wie` in 5 | `code`, `leden`, `stad` in 3 |
| meest verwante paar | genootschap ↔ leren-projecten (0,13) | genootschap ↔ leren-projecten (0,20) |

**Uitslag: `geen-gedeelde-vorm`, onder beide lijsten** (gemeten). Ter vergelijking:
platformbreed hoort 71% van de velden bij één domein; de groepsmodellen zijn dus
nog minder verwant dan een willekeurige doorsnede van dit huis -- dezelfde uitslag
als de carrière-, stage-, plan- en ontdekdomeinen.

**De meter kan uitslaan, en dat is gezien.** Versmald tot genootschap +
leren-projecten slaat hij om: `leden` en `uitgenodigd` staan dan in beide. Twee
mutaties op de conclusieregel en op de noemer laten elk twee toetsen zakken
(`test/groepvorm.test.js`).

**Wat de meting niet zegt.** Een gedeelde naam is geen gedeelde betekenis, en de
meting gaat over DATA en niet over WERKWOORDEN (lid worden, uitnodigen, opzeggen).
Vier modellen hebben smal geen leesbare vorm (gesprekken, werkruimte, klankwerk,
democratie): dat is een blinde vlek van de lezer (geneste literalen), geen nul.

### 1.1 De architectuurkeuze die eruit volgt

| optie | oordeel |
|---|---|
| één `communities`-tabel waar de modellen in opgaan | **valt af** -- 0 velden in de helft, onder beide lijsten |
| de modellen apart laten en alleen linken | **valt af** -- besluit van de eigenaar: FoundationOS organiseert zelf |
| **een projectie met etiketten + een verklaring van werkwoorden, met het Genootschap als enige groepsdrager voor FoundationOS** | **gekozen** |
| genootschap en leren-projecten samenvoegen | **niet nu**: het enige paar dat iets deelt, maar leren-projecten is van kinderen in het gezin en het genootschap van leden met een account. Eerst B1 (een gezinslid in een genootschap) bouwen; daarna opnieuw meten |

De vorm van de projectie is die van `kern/levensgraaf/graaf.js` (bron, eigenaar,
`deel` als poort, gevoelig, vervalt) en `kern/objectlaag/` (een object bezit niets
en toont caps). De werkwoorden zijn die van de keten: **dragen, verbinden,
beraadslagen, besluiten, bijeenkomen, terugkoppelen**.

---

## 2. De definitieve FoundationOS-architectuur

```
             ┌───────────────────────── FoundationOS (wereld) ──────────────────────────┐
  mens  ──▶  │  Gemeenschap  (huis-onderdeel, MAPPEN)                                     │
             │     │                                                                      │
             │     ├─ Drager (B1)    = Het Genootschap  + draagOrg (verwijzing)            │
             │     ├─ Verbond (B2)   = kern/verbond     (nieuw, bezit geen leden)          │
             │     ├─ Beraad (B3)    = kern/beraad      (nieuw, op besluit.js-standen)     │
             │     ├─ Bijeenkomst    = genootschap/bijeenkomst + lib/bijeenkomstregels     │
             │     ├─ Terugkoppeling = de drie treden van democratie (klaargezet→gewekt→gezien)
             │     └─ Aanbod (B4)    = knelpunt-aanvoerbron, zelf geplaatst, na wederzijds ja │
             └───────────────────────────────────────────────────────────────────────────┘
  deuren:    ledendeur /api/genootschap, /api/verbond, /api/beraad   (auth + geenGast)
             gezinsdeur /api/rtf/...   (verifieerProfiel) -- dezelfde kernfuncties, zoals /api/rtf/knelpunt
  poorten:   connection-consent (per persoon) · connect/kring (beschermd ≤ team) · levensgraaf deel
  Trusted Execution: resolver → plan (alleen 'voorstel') → Edge actiestaat → de mens drukt
  blijft waar het is: Sociaal, Vonk, Rendez-vous, gezin, School, rtfos, DemocratieOS, comm
```

Vier regels die de architectuur bij elkaar houden:

1. **Eén groepsdrager.** Het Genootschap is de groep van FoundationOS. Er komt
   geen tweede groepsmodule; een organisatie draagt een genootschap en wordt er
   geen lid van.
2. **Een organisatie verleent geen macht in de groep** (de MN-01-vorm). De
   drager is een verwijzing. Beheerders blijven mensen met een eigen sessie; de
   organisatie ziet geen ledenlijst en geen prikbord.
3. **Twee deuren, één kern.** De gezinsdeur roept dezelfde functies aan als de
   ledendeur, zoals `/api/rtf/knelpunt` dat al doet (`routes/knelpunt.js:140`), en
   het pad hangt onder DEZELFDE functie in het register -- anders zet het bord de
   ene helft uit en de andere niet.
4. **Niets wat een ander bereikt gaat vanzelf.** Een verbond tekenen, een beraad
   openen, stemmen, een bijeenkomst plaatsen en terugkoppelen zijn alle vijf een
   handeling van een mens. Ze staan op geen enkele AI-lijst in
   `kern/stuur/beleid-lijsten.js`, dus `beleidVoor()` zegt `verboden`, en waar
   Rahul ze klaarzet is het niveau `voorstel`.

---

## 3. Wat herbruikbaar is

| nodig voor | bestaat al | waar | hoe hergebruikt |
|---|---|---|---|
| groep, rollen, zichtbaarheid | Het Genootschap | `kern/genootschap/index.js` (r. 32-81) | wordt de drager; `pasAan` mag alleen dichter (r. 99-105) blijft |
| prikbord, peiling | genootschap-prikbord | `genootschap/prikbord.js` | het gesprek van de groep; peilingen zijn bewust niet anoniem |
| bijeenkomst met RSVP | genootschap-bijeenkomst | `genootschap/bijeenkomst.js` | de bijeenkomst van de keten |
| gezinslid identificeren | `rtf:CODE:pid`-handles | `kern/sociaal.js:24-42` (`codenaamVan`, `isBeschermdHandle`) | leden van een genootschap mogen zo'n handle zijn |
| uitnodigen met voogdgoedkeuring | vriendenlaag | `sociaal/vrienden/verbinden.js:79-89` (`voogdWacht`) | een gezinslid uitnodigen alleen als `zijnVrienden` |
| tweede deur, dezelfde kern | knelpunt-gezinsdeur | `routes/knelpunt.js:140-144` | patroon voor `/api/rtf/genootschap|verbond|beraad` |
| afspraakvelden | RTF-partners | `rtfos/partners.js:63-64` (vijf velden) | gedeelde validator voor het verbond |
| beide kanten beslissen | stadsraad | `kern/stadsraad.js:96-110` | het tekenmodel (niet de opslag, zie par. 6) |
| besluit-standen | ondernemingsbesluit | `server/bedrijf/besluit.js` (advies → stemmen → aangenomen\|verworpen; bezwaar verdwijnt nooit; evaluatiedatum) | de standmachine van het beraad |
| bevroren uitslag | stadsweefsel | `stadsweefsel/besluitvorming.js` (uitslag eenmaal bij sluiten) | uitslag van het beraad |
| tijdlijn, eindstand, terugkoppeling | DemocratieOS-kwestie | `democratie/kwestie.js` (hashketen, eindstand verandert niet, drie treden) | het PATROON via `lib/keten`, niet de module (G6) |
| een besluit met reden | Living Lab | `livinglab/vraagbesluit.js` (gesloten redenlijst, nee met naam) | redenlijst van het beraad |
| toestemming per persoon | Connection OS | `kern/connection-consent.js` (`wederzijds()`, ontbrekend = dicht) | gegevensdeling in een verbond; contact na een aanbod |
| zichtbaarheid van een kind | kringladder | `connect/kring.js:80` (`MAX_BESCHERMD='team'`) | grens voor een beschermd profiel |
| bezorgen met bewezen leespad | ontvanger | `kern/ontvanger.js` (`maakBezorger`) | elke melding van de keten |
| aanvoer zonder mens | knelpunt-aanvoer | `knelpunt/aanvoer.js:95-147` (`MENSVELDEN` weigert, geen rangorde) | bron voor zelf geplaatst aanbod (B4) |
| relatie met vervaldatum | levensband | `kern/levensband/` (soort `mentor`, wie vraagt bevestigt niet) | de mentorband, mits par. 6 opgelost |
| ondertekend akkoord, bewijs | Trusted Execution | `stuur/resolver.js`, `plan.js`, `gevolg.js`, `mandaatpoort.js`; Edge `actiestaat.js` | klaarzetten, wegen, tonen |
| meenemen | uitvoer | `genootschap/uitvoer.js` | G9 voor elke drager |

**Correcties op `GEMEENSCHAP.md` die hieruit volgen** (voor PR #544, na
beoordeling):
- `rtfos/partners.js` heeft **vijf** afspraakvelden (`geld`, `vrijwilligers`,
  `persoonsgegevens`, `aansprakelijk`, `rapportage`), niet vier, en de partner
  **tekent en zegt niets op**: alleen het kantoor zet de stand (r. 111-130). Het
  tekenmodel voor twee kanten komt uit `kern/stadsraad.js`.
- `mandaat.js` heeft al productieaanroepers (`stuur/plafond.js`,
  `stuur/mandaatpoort.js`, `kantoor/geldketen.js`). "Eerste productieaanroeper" in
  fase 6 klopt niet; het beraad heeft `mandaat.js` niet nodig (zijn handelingen zijn
  `voorstel`, en de mandaatpoort bijt alleen bij `klein`).
- Het **groepsgesprek wordt niet aan `kern/comm` gekoppeld**: comm kan geen
  deelnemer verwijderen en kapt stil af bij 256 (`comm/gesprek.js:16,58,67`), dus
  wie een genootschap verlaat, zou blijven meelezen. Het prikbord is het gesprek.
- "Het VOG-slot van `rtfos/vrijwilligers*`" bestaat niet voor een LID dat mentor
  wil zijn: het hangt aan een vrijwilligersrij van het kantoor. Zie par. 5.4.

---

## 4. De vier bouwstenen, technisch

### 4.1 B1 -- de drager

**Veldnaam.** `drager` is zwaar bezet (141 bestanden; eigen betekenis in
`kern/kosten/haak.js:37`, `kern/isolatie/`, `opzet/verzoekframe.js`). Op het scherm
heet het "drager", in code **`draagOrg`** (0 treffers).

```
groep.draagOrg = { soort: 'werkruimte'|'rtfpartner'|'rtfclub'|'zaak', ref,
                   stand: 'gevraagd'|'erkend'|'ingetrokken',
                   gevraagdDoor: key, erkendDoor: { soort, id }, at, erkendAt }
groep.leden[].key  mag ook 'rtf:CODE:pid' zijn (een gezinslid)
```

- **Vragen** doet een beheerder van de groep; **erkennen** doet de organisatie langs
  haar eigen poort: werkruimte (lid met werkruimterecht), zaak (`supplierAuth` +
  manager), RTF-partner of -club (een codedeur in de vorm van
  `routes/rtfkantoor/codedeuren.js`, met `ipRem` en `codeRem`). Een
  organisatiecode wordt nooit in een ledenroute geplakt.
- De school is met opzet **geen** drager in deze stap: haar poort is een platte
  vergelijking van schoolcode en personeelstoken (`school/poorten.js:32-37`), en
  `SCHOOL.md` is eigenaar. Dat is fase 7.
- **Gezinsleden** komen erin via `zijnVrienden(beheerder, handle)` -- niet op
  codenaam zoeken, want dat maakt kinderen opsombaar. **Beschermde profielen
  worden geweigerd met een reden** tot G5 is opgelost (par. 5.3).
- **Register.** `dom-genootschap` krijgt `doelgroepen: LEDEN_RTF` en de paden
  `['/api/genootschap', '/api/rtf/genootschap']`; `/api/rtf/genootschap` komt in
  `BESCHERMDE_ROUTEFAMILIES` (`middleware/foundation-productiepoort.js:36`).
- **Gebied** (voor "in mijn buurt"): een optioneel etiket op de groep, alleen
  getoond met de groepsdrempel van `bedrijfsmaat/poort.js` (onder vijf geen
  aantal).

Routes: `/api/genootschap/drager/vraag`, `/drager/los` (losmaken mag altijd, de
groep blijft), `/api/bedrijf/genootschap/erken`, `/api/supplier/genootschap/erken`,
`/api/rtfos/portaal/partner/genootschap`, en de gezinsdeur `/api/rtf/genootschap/*`.

### 4.2 B2 -- het verbond

`kern/verbond/`, eigen collectie, **bezit geen leden**:

```
verbond = { id, kanten: [{ soort: 'genootschap', ref }, { ... }], doel,
  afspraken: { geld, vrijwilligers, persoonsgegevens, aansprakelijk, rapportage }  // 'a'|'b'|'samen'
  van, tot, stand: 'concept'|'getekend-a'|'getekend-b'|'actief'|'opgezegd'|'verlopen',
  tekens: { a: { door, at }, b: { door, at } }, opzegging: { kant, door, at, reden } | null,
  tijdlijn: [hashketen via lib/keten] }
```

- `partners.js` exporteert zijn afspraakvelden en een pure validator; het verbond
  roept die aan met `['a','b','samen']`. Hergebruik, geen kopie.
- **Tekenen**: een beheerder tekent voor zijn eigen kant (de kant komt uit de
  sessie, nooit uit het verzoek). `actief` pas als beide hebben getekend; een
  tekstwijziging na tekenen zet beide tekens terug.
- **Opzeggen** kan elke kant, eenzijdig, met een reden. `opgezegd` is een andere
  stand dan `verlopen` (vgl. `afgezegd` en `geannuleerd` in `TRAVELCOMMERCE.md`).
  Wat er besloten is, blijft leesbaar: opzeggen is geen straf.
- **Wat een lid van kant A van kant B ziet: de groepsnaam.** Geen codenaam, geen
  ledenlijst. Gegevens van een persoon gaan alleen over met zijn eigen
  `connection-consent`.
- **Gezamenlijk project**: in fase 1 een bijeenkomst plus een verwijzing in de
  verbondstijdlijn. Via `rtfos/projecten` alleen als de RTFoundation het draagt
  (een project heeft daar één `stad`, één `partnerId` en één `leiderKey`,
  `projecten.js:96-102`); een project over twee steden is een besluit.

Routes: `/api/verbond/voorstel`, `/teken`, `/zeg-op`, `/mijn`, plus
`/api/rtf/verbond/*`.

### 4.3 B3 -- het beraad

`kern/beraad/`, met de standmachine van `bedrijf/besluit.js` en het tijdlijnpatroon
van `democratie/kwestie.js` (via `lib/keten`, zonder `kern/democratie` te laden --
G6):

```
beraad = { id, drager: { soort: 'genootschap'|'verbond', id }, vraag, door, at,
  rondes: [{ nr, stand: 'open'|'voorstel'|'stemmen'|'besloten',
    inbreng:   [{ id, vanKey, tekst, at }],        // nooit verwijderd; intrekken = een markering
    bezwaren:  [...],                              // verdwijnen nooit
    openPunten:[{ id, vraag, door }],
    voorstel:  { versie, tekst, door, at, hulp: 'rahul'|null } | null,
    voorstelBevroren, quorum, stemmen: { [key]: 'voor'|'tegen'|'onthouding' },
    uitslag /* eenmaal berekend bij sluiten */,
    eindstand: { stand: 'aangenomen'|'verworpen'|'geen-besluit'|'ingetrokken', toelichting, door, at },
    evalueerOp, bijeenkomstId,
    terugkoppeling: { [key]: 'klaargezet'|'gewekt'|'gezien' } }],
  tijdlijn: [hashketen] }
```

- `standpunt` is bezet (een enum in `stadsweefsel/besluitvorming.js:63`); het heet
  **`inbreng`**. `terugkoppeling` draagt de drie treden van DemocratieOS en
  dezelfde betekenis.
- Stemmen pas als het voorstel bevroren is; een gewijzigd voorstel zet de stemmen
  terug. De eindstand verandert nooit; heropenen maakt een nieuwe ronde.
- Inbrengen bij DemocratieOS: een klaargezette kwestietekst in het invoerveld van
  het lid, die hij zelf indient. Het beraad bewaart alleen "ingebracht", **zonder
  kwestie-id** -- een kwestie-id naast ledensleutels is de koppeling die
  `democratie/wek.js` en `koppeling.js` verbieden.
- **Terugkoppeling** gaat naar iedereen die inbracht of stemde, op de SLEUTEL en
  via `ontvanger.maakBezorger` (een melding op TIER verdwijnt, zie
  `opzet/meldaan.js`).

**Rahul in het beraad, drie taken, elk structureel afgedwongen:**

| taak | hoe | afgedwongen door |
|---|---|---|
| samenvatten met bron | één regel per inbreng, `[{ zin, inbrengId }]`; de server voegt de bron toe. NIET de globale `samenvat()` -- die scoort zinnen en laat een minderheid vallen, en dat is wegen | een regel zonder bekende `inbrengId` vervalt; elke inbreng staat erin |
| ontbrekende perspectieven | een gesloten aspectlijst (kosten, tijd, wie raakt het, alternatief, risico, toegankelijkheid), deterministisch, zonder model | geen model nodig, dus geen model dat kan sturen |
| conceptvoorstel | tekst terug in het invoerveld, nooit door Rahul bewaard | het lid plaatst het onder zijn eigen sleutel |

- De AI-module krijgt een **bevroren leesweergave**, niet het module-object:
  vandaag krijgt `genootschap/ai.js` het hele `prikbord` met `stem` en `weg`
  erin (r. 25), en niets houdt hem tegen.
- De AI-context is een positieve lijst (`BERAADVELDEN = ['id','tekst']`); er gaat
  geen codenaam naar een model.
- **Een besloten beraad alleen lokaal.** `server/ai.js` valt bij een storing door
  naar extern (`office/delen.js:117-118` zegt het al). De weg is een eigen client
  met `maakAI({ volgorde: ['local'] })`; zonder `LOCAL_AI_URL` draaien taak 1 en 2
  deterministisch door (vermoed: gelezen, niet gedraaid).

### 4.4 B4 -- zelf geplaatst aanbod (hulp en mentorschap)

Een bron van de knelpuntmotor, `knelpunt/aanvoer-aanbod.js`.

- **Er is geen terrein voor.** `TERREINEN` is gesloten op werk, opleiding, opvang,
  vervoer en wonen (`openingen-kaart.js:56`). Twee wegen: het aanbod op een bestaand
  terrein zetten (cv-hulp = werk, huiswerkhulp = opleiding), of een zesde terrein.
  Dat laatste is een besluit (par. 9).
- **G1 wordt scherper dan in `GEMEENSCHAP.md`.** De vondst draagt geen identiteit,
  ook niet die van de aanbieder -- `MENSVELDEN` weigert elke codenaam, en dat is
  goed. De `ingang` wijst naar een aanbod-id; de codenaam verschijnt pas na
  `wederzijds() === MUTUAL` (`connection-consent.js:144`), buiten de aanvoerlaag.
- **Vrije tekst lekt.** `keur()` controleert veldNAMEN en geen waarden: "bel
  06-…" in `wat` komt erdoor. De bron krijgt een waardecontrole op
  contactgegevens, in de vorm van de actorweigering in `kern/envelop.js`.
- **Toets 14 wordt uitgebreid**: `aanbod|mentor|vrijwilliger` erbij in de lijst
  van domeinwoorden die de contractlaag niet mag kennen, zodat het contract niet
  naar deze bron buigt.
- **Opslag**: op de sessiesleutel van de aanbieder, met `vervalt` (90 dagen,
  verlengbaar), intrekken verwijdert direct. Geen uren-teller en niets in het
  carrièreledger (CAR-05).
- **Mantelzorgrooster**: een genootschap met drager `gezin` en een **gesloten**
  takenlijst. Niet het vrije veld `dienst` van `rtgid-regie.js` (r. 41-66): "dialyse"
  daarin is een gezondheidsgegeven van een derde.

---

## 5. Grenzen: wat technisch afdwingbaar is, en wat niet

Dit is een technische toets en **geen** juridisch oordeel en geen vervanging van een
volledige veiligheids- en privacybeoordeling.

| grens | vandaag afdwingbaar? | wat ontbreekt | zwakste punt |
|---|---|---|---|
| G1 mensen geen aanbod | grotendeels (`MENSVELDEN`) | waardecontrole op vrije tekst | vrije tekst |
| G2 geen cijfer | deels (`scripts/lib/cijferopmens.js`, lexicaal) | gemeenschapsvelden | `rtfos/gemeente.js:93` "overige buurten (1)" is het exacte aantal van één buurt |
| G3 bijzondere gegevens | **nee** | een veld dat zegt dat een gemeenschap over geloof of zorg gaat; vandaag is er alleen openbaar/besloten/geheim, dus een OPENBARE moskeegroep publiceert een art. 9-gegeven | indeling hangt aan wie hem kiest |
| G4 verbond deelt geen leden | bouwsteen bestaat (`connection-consent`) | het verbond zelf | -- |
| G5 volwassene ↔ kind | **alleen voor gezinsprofielen en binnen School** | bescherming van 15-17-jarigen met een eigen account | `beschermd` hangt aan het gezinsprofiel, niet aan de leeftijd |
| G6 beraad is geen politiek | organisatorisch (eigen rechtspersoon) | een broncontrole: `kern/beraad` laadt niets uit `kern/democratie` | -- |
| G7 Rahul bemiddelt niet | ja (`persoonseis`, `vakbewijs` voor de professional) | -- | -- |
| G8 geen groeitruc | ja voor het genootschap (regel 2) | een huisbrede toets | -- |
| G9 meenemen | `genootschap/uitvoer.js` | voor elke drager | -- |

### 5.1 Minderjarigen

- Een eigen RTG-account kan **vanaf 15** (`lib/leeftijd.js:25`). Zo'n account is
  nooit `beschermd`: dat bestaat alleen voor gezinsprofielen (`kern/sociaal.js:37,42`),
  en de Connect-ledendeur zet `beschermd: false` hard (`routes/connect-gezinsdeur.js:54`).
- `kring.js` begrenst de ZICHTBAARHEID van het werk van een kind, niet wie hem kan
  bereiken.
- "Geen privékanaal volwassene-kind" geldt alleen binnen School
  (`server/school.js:9`, `school/gezin.js:103-119`). Elders bestaan één-op-één
  berichten tussen leden.
- Het genootschap kent **geen leeftijdscontrole** (`tredBinnen`, `nodigUit`,
  `index.js:113-140`; gelezen).

### 5.2 VOG: twee modellen die elkaar niet kennen

| | `rtfos/vrijwilligers.js` | `persoonseis` + `vakbewijs` |
|---|---|---|
| wat er staat | `vogGeldigTot`, een datum | nummer en datum, versleuteld in de identiteitskluis |
| wie zet het | een coördinator met `vrijwilliger.beheren` | een mens van RTG, nooit de werkgever |
| bewijs | geen document, geen nummer, geen screeningsprofiel | gezien en afgetekend |
| naam en contact | echte naam + contact in operationele data | codenaam; nummer alleen met reden en journaalregel |
| wanneer getoetst | bij koppelen en bij openen | bij elke vraag opnieuw |
| bewaartermijn | niet gevonden | niet gevonden |

Het tweede model is sterker, maar hangt aan het GENRE van een zaak. Een lid dat
mentor wil zijn, valt onder geen van beide. **Welk model de waarheid wordt, is een
besluit** (par. 9).

En het eerste model heeft een gat dat de regel "VOG bij kinderen" uitholt: een
jeugdactiviteit opent met **ten minste één** begeleider met een geldige VOG
(`activiteiten-beheer.js:81,102`, gelezen) -- de andere volwassenen hoeven er geen te
hebben.

### 5.3 Wat G5 dus vraagt, vóór B1 open mag voor kinderen

1. Leeftijd als poort in het genootschap, op de gecontroleerde geboortedatum
   (`leeftijdBron`), niet op de opgegeven.
2. Beschermde profielen en 15-17-jarigen alleen in een genootschap met een drager
   die een VOG-plicht draagt, en dan voor **elke** volwassene in die groep.
3. Geen één-op-één bericht tussen een volwassene en een minderjarige buiten een
   gezin, huisbreed -- of uitdrukkelijk besloten waar het wel mag.
4. Een levensband van soort `mentor` met een kindprofiel alleen na een
   voogdbevestiging (vandaag bevestigt de handle van het kind zelf,
   `routes/levenband.js:179`).

---

## 6. Gebreken die het onderzoek in bestaande code vond

Niet gerepareerd, omdat deze fase niets in `server/` of `public/` mag veranderen.
Elk staat er met waar en hoe zeker.

| # | gebrek | waar | graad | waarom het ertoe doet |
|---|---|---|---|---|
| 1 | **De uitnodiging voor een bijeenkomst gaat nooit de deur uit.** `notify()` krijgt een tekst; `meld()` gooit `TypeError` bij een niet-object, en een lege `catch` slikt hem in | `genootschap/bijeenkomst.js:83-85`, `opzet/meldingen.js:83-84` | gelezen | schakel "bijeenkomst" van de keten leunt erop; prikbord (r. 63) en afgelasten (r. 116) doen het wel goed |
| 2 | geen leeftijdscontrole bij binnentreden en uitnodigen | `genootschap/index.js:113-140` | gelezen | storing 1 van de keten staat vandaag op `gebroken` |
| 3 | jeugdactiviteit opent met één begeleider met VOG | `rtfos/activiteiten-beheer.js:81,102` | gelezen | de andere volwassenen hebben er geen |
| 4 | de AI-module van het genootschap krijgt `stem` en `weg` binnen bereik, en `aankondiging` kan via de volle keten naar extern | `genootschap/ai.js:25` | gelezen | G7 en een besloten groep |
| 5 | de RTG-stem in de stadsraad neemt de stemmer uit het verzoek (`req.body.naam`) | `routes/rtfkantoor/index.js:63` | gelezen | AUTHORITY.md P0b: de actor komt uit de sessie |
| 6 | "overige buurten (1)" toont het exacte aantal van één buurt | `rtfos/gemeente.js:93` | gelezen | bekend uit `VERDER.md` par. 7, nog open |
| 7 | `prikbord.lees` schrijft een lege rij bij lezen | `genootschap/prikbord.js` (`bord()`) | vermoed | dezelfde fout die `bijeenkomst.js:25-40` al herstelde |
| 8 | twee keer afgelasten overschrijft het eerste | `genootschap/bijeenkomst.js:111` | vermoed | doe-bijeenkomst houdt de eerste |
| 9 | "vol" is 400 in het genootschap en 409 in doe-bijeenkomst | `routes/member/genootschap.js`, `doe-bijeenkomst.js:45` | vermoed | dezelfde regel, twee antwoorden |
| 10 | mantelzorgmachtiging met vrij veld `dienst` | `rtgid-regie.js:41-66` | gelezen | gezondheid van een derde |
| 11 | vrijwilligersrijen met echte naam en contact zonder bewaartermijn | `rtfos/vrijwilligers.js` | vermoed (termijn niet gevonden) | AVG-bewaarplicht |
| 12 | `VERWERKINGSREGISTER.md` heeft geen verwerking voor vrijwilligers/VOG, gemeenschappen en mantelzorg | `VERWERKINGSREGISTER.md` | gelezen | art. 30 |

Nummer 1, 2 en 4 horen opgelost te zijn **vóór** de keten wordt gebouwd (fase 1a).

---

## 7. De samenwerkingsketen: ontwerp en toetsstrategie

`scripts/gemeenschapsproef.js` (nog te bouwen, na goedkeuring), in de vorm van de
bestaande ketenproeven: een wegwerpserver (`scripts/lib/wegwerpserver.js`), eigen
hulpjes zonder gedeelde ketenmodule (`test/adamproef.test.js` toets 8), en de
uitslag van `scripts/adamproef.js` (r. 215-250): schakels `gesloten`/`open`/
`openBekend`/`stuk`, storingen `gehouden`/`gebroken`, `sluit` en
`sluitMetBevinding` apart. `openBekend` alleen bij een 4xx mét een bekende reden;
een 5xx is altijd `stuk`.

### 7.1 Actoren

`lid` en `kantoor` delen we met andere ketens; nieuw zijn `beheerder`, `tweede
gemeenschap`, `deelnemer`, `minderjarige` en **Rahul** -- de eerste keten met de AI
als actor. `KETENVORM.json` meet vandaag 7 ketens en 0 van 33 gedeelde actoren (de
"0 van 19" elders in de documenten is verouderd).

### 7.2 Schakels: handelt A, en ziet B dat?

| # | A → B | A doet | B moet zien | wanneer |
|---|---|---|---|---|
| 1 | beheerder → lid | richt een openbaar genootschap op, met een organisatie als drager | de groep in `zoek`, de drager als verwijzing | nu, drager na B1 |
| 2 | lid → beheerder | treedt binnen | het lid in de ledenlijst | nu |
| 3 | beheerder A → beheerder C | stelt een verbond voor | het voorstel | na B2 |
| 4 | beheerder C → beheerder A | tekent | het verbond `actief`, aan beide kanten byte voor byte gelijk | na B2 |
| 5 | beheerder → deelnemer | opent een beraad in het verbond | de vraag, en GEEN ledenlijst van de andere kant | na B3 |
| 6 | lid → deelnemer | brengt iets in | de inbreng met zijn codenaam | na B3 |
| 7 | Rahul → leden | vat samen | elke regel met bron, elke inbreng erin (nep-modelserver op 127.0.0.1) | na B3 |
| 8 | leden → iedereen | besluiten | een eindstand met reden uit een gesloten lijst | peiling nu, besluit na B3 |
| 9 | beheerder → lid en deelnemer | roept bijeen, gekoppeld aan het besluit | **een melding die aankomt**, en de bijeenkomst | na reparatie gebrek 1 |
| 10 | beheerder → wie meedeed | koppelt terug | de melding op de SLEUTEL via `/api/notifications`, trede `gezien` | na B3 |
| 11 | lid → lid zelf | neemt mee | besluit en eigen inbreng in de uitvoer | deels nu |

### 7.3 Storingen die moeten houden

Elke storing meet het EFFECT (een telling voor en na), niet alleen de status
(`BEWIJSLUS.md` par. 4a).

1. **minderjarige deelnemer** -- een 16-jarige met eigen account komt niet zonder
   VOG-context binnen; een volwassene bereikt hem niet privé. *Vandaag `gebroken`
   (gebrek 2).*
2. **geweigerde toestemming** -- de beheerder van A vraagt gegevens van een
   deelnemer van C: 404; C's eigen beheerder: 200.
3. **vol** -- een bijeenkomst met één plaats weigert de tweede "ja" met een reden;
   na een "nee" komt de plaats vrij.
4. **opgezegd verbond** -- geen nieuw beraad en geen inbreng meer; het besluit en de
   terugkoppeling blijven leesbaar.
5. **Rahul probeert te stemmen** -- `/api/member/doe` op de stemroute wordt
   geweigerd (`beleidVoor` → `verboden`), de stemtelling blijft gelijk; de route
   weigert zelf ook als `agentteken.agentVan(req)` iets geeft; een broncontrole
   eist dat `kern/beraad/ai.js` geen `stem(` of `weg(` bevat.
6. **herhaling** -- een dubbele tik op stemmen, tekenen en besluiten geeft geen
   tweede effect.
7. **weigering met reden** -- de weg die een weigering noemt, bestaat (200).
8. **eindstand verandert niet** -- een tweede sluiting: 409.
9. **G4** -- de leden van C zijn voor A niet op te vragen.
10. **inbreng zonder bron** komt niet in de samenvatting.
11. **verzonnen id** -- 404, nooit een leeg geldig antwoord.
12. **G6** -- "inbrengen bij DemocratieOS" levert een klaargezette tekst, geen
    ingediende kwestie en geen gedeelde opslag.

### 7.4 Sessies, met bestaande hulpjes

Beheerders als gecontroleerd volwassen account (`scripts/lib/gratisaccount.js`,
`gecontroleerdGratis`), leden via `scripts/lib/proefsessies.js`, een minderjarige
met eigen account via registratie met een berekende geboortedatum (de vorm van
`adamproef.js`), een gezinsprofiel via `/api/foundation/gezin/*`, en kantoor op
naam via `scripts/lib/proefsleutels.js` (`kantoor-a`, `kantoor-b`).

### 7.5 Eerlijk houden

Geen ketenproef draait vandaag in CI; alleen hun statische toets. Daarom geldt
LAT-regel 17 los daarvan: **elke nieuwe route uit B1-B3 krijgt een treffer op een
echte server in een gewone toets.** Mutaties die de proef moeten laten zakken:
de stemroute op `KLEIN` zetten, `ai.js` laten stemmen, de leeftijdscontrole
weghalen, het verbond leden laten teruggeven, de opzegcontrole weghalen, de
eindstand laten overschrijven, terugkoppelen op tier in plaats van sleutel, en een
`openBekend` bij een 5xx.

Registratie na goedkeuring: `package.json`, `KETENS` in `scripts/ketenvorm.js`,
`scripts/lib/metingen.js`, `scripts/versheid.js`, een ratel
`gemeenschapOpenBekend` (omlaag) in `scripts/norm.js`, en
`test/gemeenschapsproef.test.js`.

---

## 8. Open juridische vragen (voor een privacyjurist of FG)

Dit zijn **vragen en geen conclusies**. Elk noemt welk ontwerpdeel ervan afhangt.

1. **Leeftijd.** De UAVG legt de grens voor eigen toestemming op 16; RTG staat een
   eigen account toe vanaf 15. Welke grondslag geldt voor een 15-jarige die lid
   wordt van een gemeenschap of een aanbod aanneemt? *Hangt af: G5, accountgrens.*
2. **Geloof (art. 9).** Is lidmaatschap van een geloofsgemeenschap ook een
   bijzonder persoonsgegeven als de groep openbaar is? Geldt art. 9 lid 2 sub d als
   RTG het platform is en niet de instelling? *Hangt af: G3, de zichtbaarheid
   `openbaar`.*
3. **Gezondheid via mantelzorg (art. 9).** Onthult lidmaatschap van een
   mantelzorggroep of een takenlijst iets over de verzorgde, een derde zonder
   toestemming? *Hangt af: het rooster, de gesloten takenlijst.*
4. **VOG en strafrechtelijke gegevens (art. 10 AVG, UAVG).** Is "heeft een geldige
   VOG tot X", of het ontbreken ervan, een strafrechtelijk gegeven? Wie mag het
   bewaren, en wat (kopie, nummer, alleen datum)? Is het huidige rtfos-model
   verdedigbaar? *Hangt af: welk VOG-model de waarheid wordt.*
5. **VOG-regelgeving.** Wie vraagt de VOG aan voor een mentor zonder organisatie?
   Welk screeningsprofiel past? Geldt de regeling gratis VOG voor vrijwilligers van
   een gemeenschap of verbond? Is "verlopen" juridisch of beleid? *Hangt af: B4, G5.*
6. **Wet meldcode.** Vallen gemeenschappen en mentoren die met kinderen werken
   onder de meldcode, en wie is de melder? *Hangt af: G5.*
7. **Gezamenlijke verwerkingsverantwoordelijkheid (art. 26).** Wie is
   verantwoordelijke in een verbond van twee gemeenschappen met RTG als platform,
   en volstaan de vijf afspraakvelden als regeling? *Hangt af: B2, G4.*
8. **Gegevensdeling.** Is toestemming per persoon de juiste grondslag, of is die
   binnen een vereniging niet vrij gegeven? *Hangt af: G4.*
9. **DPIA (art. 35).** Is een DPIA verplicht voor geloofs- en zorggemeenschappen,
   gemeenschappen met minderjarigen en het mentoraanbod -- één DPIA of meerdere,
   naast `DPIA-GEZIN.md` (dat nog niet is vastgesteld)? *Hangt af: de vrijgavepoort.*
10. **Bewaartermijnen** voor aanbod, VOG-status, vrijwilligersrijen en het
    inzagejournaal.
11. **Rechten van het kind.** Mag een minderjarige zelf een mentoraanbod
    aanvaarden, en vanaf welke leeftijd zonder ouder? *Hangt af: B4, levensband.*
12. **Profilering (art. 22, overweging 71).** Is aanbod tonen op een opgegeven
    randvoorwaarde profilering, ook zonder rangorde?
13. **Verwerkingsregister (art. 30).** Welke verwerkingen moeten erbij (gebrek 12)?

---

## 9. Besluiten die de eigenaar nog moet nemen

| # | besluit | aanbeveling |
|---|---|---|
| 1 | welk VOG-model de waarheid wordt | `vakbewijs` (nummer in de kluis, RTG tekent af), met rtfos als lezer -- na vraag 4 |
| 2 | B4 op bestaande terreinen of een zesde terrein | bestaande terreinen: het contract blijft onaangeraakt |
| 3 | een volwassene en een minderjarige buiten een gezin: één-op-één berichten huisbreed uit? | ja, met School als bewuste uitzondering |
| 4 | stemmen in een beraad zichtbaar voor de leden, of alleen aantallen | zichtbaar zoals het prikbord, alleen aantallen bij een G3-gemeenschap |
| 5 | idempotent afgelasten (gedragswijziging in het genootschap) | ja |
| 6 | een gemeenschap kan "geloof" of "zorg" als soort dragen (G3) | ja, met `gevoelig: 3` en verplicht `besloten` -- na vraag 2 |
| 7 | genootschap en leren-projecten samenvoegen | nee, na B1 opnieuw meten |

---

## 10. Gefaseerd implementatieplan

Elke fase vraagt een akkoord van de eigenaar en raakt pas dan productie.

| fase | wat | hangt af van | toets |
|---|---|---|---|
| **1a** | herstel gebrek 1, 2, 4, 7, 8 (bijeenkomst-melding, leeftijdspoort, leesweergave voor de AI, lezen zonder schrijven, afgelasten); `lib/bijeenkomstregels.js` voor de gedeelde regels van beide bijeenkomstmodules | besluit 5 | elk met een mutatie; equivalentietoets van de twee bijeenkomstmodules |
| **1b** | het onderdeel **Gemeenschap** op FoundationOS, dat het genootschap, rtfos-activiteiten, buurtruil, vrijwilligersportaal en kwesties opent | -- | wereldregister, tikken, doelgroepbereik |
| **2** | **B1 drager**: `draagOrg`, erkenning per organisatiepoort, gezinsdeur, register naar `LEDEN_RTF` | fase 1a, besluit 3 | par. 4.1 en de toetsen van B1; schakel 1-2 sluiten |
| **3** | **B2 verbond** | fase 2, vraag 7 | schakel 3-4, storing 2, 4, 9 |
| **4** | **B3 beraad** met de drie Rahul-taken en de terugkoppeling | fase 3, besluit 4 | schakel 5-8 en 10, storing 5, 8, 10, 12 |
| **5** | **de keten**: `gemeenschapsproef` volledig, alle schakels gesloten, alle storingen gehouden | fase 2-4 | de acceptatietoets |
| **6** | **B4 aanbod** en het mantelzorgrooster | vraag 1, 4, 5, 11; besluit 1, 2 | G1 met waardecontrole; toets 14 uitgebreid |
| **7** | **gemeenschappen met kinderen** (G5 volledig) en **geloof/zorg** (G3) | DPIA en FG-advies (vraag 9) | storing 1 `gehouden` |
| **8** | scholen samen en internationaal | `SCHOOL.md`, fase 7 | jaren weg |

Wat er tot fase 7 met opzet NIET opengaat: gemeenschappen met minderjarigen buiten
het gezin, en gemeenschappen die geloof of zorg als onderwerp dragen. Dat is geen
uitstel om het uitstel, maar de volgorde die de juridische vragen afdwingen.

---

## 11. Wat fase 0 niet heeft gedaan

- Geen enkele wijziging in `server/` of `public/`, geen merge, geen deployment.
- De gebreken in par. 6 zijn niet gerepareerd en de "vermoed"-regels niet
  gedraaid.
- Geen juridisch oordeel: par. 5 en 8 zijn een technische toets en een lijst
  vragen.
- `GEMEENSCHAP.md` is hier niet aangepast; de correcties uit par. 3 horen in PR
  #544, na beoordeling.
- De schermen in `public/` zijn niet bekeken; dit is een server- en datatoets.
