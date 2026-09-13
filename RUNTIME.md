# RTG Runtime — één levende werkelijkheid, of vijf lagen die dat beweren

Richtingsdocument, zoals `PLATFORM.md`, `ECONOMIE.md`, `HDI.md` en
`DEVELOPERCLOUD.md`: per onderdeel staat er of het **staat**, **een stap weg**
is, **een besluit vraagt** of **jaren weg** is. Niemand hoort die vier voor
elkaar aan te zien.

De aanleiding is een voorstel van de eigenaar: niet nóg een laag bovenop RTG,
maar het bestaande herontwerpen tot één intelligent runtime-model, zodat de
werelden, Navigatie, Partner, Office, Money, Identity, Files en RTG
Intelligence geen losse systemen meer zijn die elkaar aanroepen maar
**verschillende perspectieven op dezelfde levende werkelijkheid**.

Dat uitgangspunt is juist, en het is de reden dat dit document bestaat in plaats
van een implementatieplan. Want de dragende bewering eronder — *alles wordt een
object in één samenhangende graph* — is in dit huis al twee keer gemeten, en de
uitkomst bepaalt of dit een verbouwing is of een vergissing.

---

## 0. De zin die het verschil maakt

Het voorstel en dit huis zeggen bijna hetzelfde, en het verschil zit in één woord:

> **Voorstel:** één samenhangende graph waarin MENS, REIS en BEDRIJF objecten zijn.
> **Dit huis:** één samenhangende **projectie** waarin die dingen zichtbaar worden.

Een graph die je vult is een tweede database. Een graph die je berekent is een
lens. `server/kern/levensgraaf/graaf.js` heeft dat verschil al gevonden en
schrijft het in zijn eigen kop uit:

> *DIT IS EEN PROJECTIE, GEEN TWEEDE DATABASE. De verleiding bij een levensgraaf
> is om alles nog een keer op te slaan in graafvorm. Dan staat het huis van het
> lid op twee plekken, en regel 4 van de lat zegt precies wat er dan gebeurt: ze
> lopen uiteen, en meestal zonder dat iets klaagt.*

Dus: het voorstel wordt niet afgezwakt, het wordt **gegrond**. Het werk is de
bestaande projectie verbreden — niet een nieuw objectmodel eroverheen verklaren.

---

**De uitvoeringskant van dit voorstel staat in `MACHINE.md`.** Dit document
beantwoordt *wat is waar* (één projectie, en waarover die mag gaan); dat
document beantwoordt *komt een handeling langs de motoren die dit huis daarvoor
heeft gebouwd* -- met `npm run machinedekking` als meting, die zestien motoren
voor het eerst naast elkaar op DEZELFDE route legt. Twee vragen, twee documenten,
en geen tweede telling van hetzelfde.

---

## 1. De meting die dit document eerlijk houdt

Drie bestaande metingen raken de dragende bewering rechtstreeks. Ze zijn niet
voor dit voorstel gedaan, en dat maakt ze bruikbaar.

| meting | uitkomst | wat dat zegt over "één objectmodel" |
|---|---|---|
| `OBJECTMODEL.json` | **1418 van 2010 velden** (70,5%) horen bij precies één domein; 267 domeinen; `Asset` bestaat niet | een gedeeld TYPEmodel is hier al een keer gesneuveld |
| `KETENVORM.json` | **0 van 13 actoren** gedeeld over drie onafhankelijke ketens; 2 van 10 beloftethema's, en die twee gaan over de MACHINE en niet over het domein | een status-, actor- of uitkomstcontract over domeinen heen is niet gerechtvaardigd |
| `SEMANTIEK.json` | **100 namen** dragen meer dan één betekenis, samen 379; `SOORTEN` op 47 | een nieuw kernbegrip landt zelden op vrij terrein |

De conclusie is niet "geen graaf". De conclusie is: **de graaf mag over
IDENTITEIT, TIJD, HERKOMST en BEVOEGDHEID gaan, en niet over domeinbetekenis.**
Precies de grens die `OS.md` al trekt tussen platformvermogen en domeinvermogen,
nu met bewijs uit drie onafhankelijke metingen.

### 1.1 Hoe ver de graaf vandaag reikt

`kern/levensgraaf/` bestaat, met 47 bronnen, en leest **zes** collecties:
`agendas`, `boekingen`, `cvs`, `leren`, `lifestyle`, `rtgid`. Dit huis heeft er
**197** met een eigenaar (`scripts/check.js` regel 63, graad: gemeten).

> **De graaf heeft de goede vorm en 3% van de reikwijdte.**

Let op waar die noemer vandaan komt, want dat is bij het schrijven van dit
document een keer misgegaan. Een eigen telling op `db.data.*` in `server/` gaf
325 — en dat is een overtelling, want niet elke verwijzing is een collectie. Het
huis heeft er een betere meter voor die er al stond: `check.js` regel 63 telt
alleen collecties met een eigenaar. Wie een noemer zelf verzint terwijl er een
gemeten noemer ligt, maakt zijn eigen percentage. (De 196 die `CLAUDE.md` uit
`IDEMPROEF.json` citeert, klopt daarmee ook — al is het veld `opslag` in de
huidige stand van dat register leeg, dus dáár is hij vandaag niet na te rekenen.)

Dat is de eerlijkste samenvatting van dit hele document. Er hoeft niets
afgebroken en niets uitgevonden; er moet worden **aangesloten**. En elke bron
die erbij komt draagt de vijf etiketten die er al zijn — `bron`, `eigenaar`,
`deel`, `gevoelig`, `vervalt` — waarvan `deel` een **poort** is en geen etiket:
`graafVoor()` filtert erop.

---

## 2. Namen die al bezet zijn

`HDI.md` par. 2 houdt vier namen tegen omdat ze al iets anders betekenen. Dit
voorstel introduceert er vijf, en één ervan is de zwaarst belaste term van het
huis.

**`wereld` draagt al zes betekenissen.** De vier OS'en (`WERELDEN.md`), de vier
economische werelden (`ECONOMIE.md`, waar de wereld een eigenschap is van de
IDENTITEIT), het wereldpatroon (`PLATFORM.md`), de synthetische werelden
(`MAGNAATLAB.md`), `wereldOntbreekt` als testopstelling (`HERSTELPROEF.json`, 46
paren) en `server/kern/fiscaal/wereld/` als landen. **"World Model" komt er dus
niet als naam.** Wat het aanwijst bestaat wel en heet hier de **levensgraaf**.

| voorgesteld | stand | waarom |
|---|---|---|
| World Model | **bezet** | zes betekenissen; gebruik *levensgraaf* |
| Capability Mesh | **half bezet** | `capability` = platformvermogen (`OS.md`); `mesh` is vrij, maar `CAPABILITEIT.json` telt al 21 lijsten met 250 leden |
| Trust Kernel | **half bezet** | de vertrouwenslaag heet `PROOF.md` en meet in `VERTROUWEN.json` |
| Intent Engine | **vrij** | `stuur/` draagt intentie al als begrip, maar niet als naam |
| Situation | **let op** | 48 bronbestanden gebruiken het woord; een meting waard vóór het kernbegrip wordt |

---

## 3. De twintig punten, met stand

### Staat al — niet opnieuw bouwen

| # | punt | waar het woont | let op |
|---|---|---|---|
| 3 | Decision Fabric | `kern/frictie/motor.js` — grondslag, bedrag, aantal, omkeerbaarheid, zekerheid, met **26 lezers** | de score draagt zijn **opbouw**; een `confidence: 0.98` zonder opbouw is verboden (INT-04) |
| 5 | Digital Twin | `kern/command/simulatie.js` — heet daar letterlijk zo, met de aannames in de uitslag | vandaag ops-breed, niet per reis of bedrijf |
| 14 | Purpose-bound privacy | `LINK.md` + `kern/rtfos/gemeente.js` (telt zonder te lezen) | **het sterkste punt in de lijst**; dit is aansluiten, niet uitvinden |
| 15 | Shadow execution | `schaduw.js`, `kern/stuur/schaduwtelling.js`, `router.schaduw()`, canary met terugrol | `CONTROLPLANE.md` heeft de regel al: *je kunt niet afdwingen wat nooit in de schaduw heeft gelopen* |
| 18 | Knowledge met provenance | de vier bewijsgraden, `fiscaal/herkomst.js`, `kosten/herkomst.js` | een kennisregister dat **naast** de code leeft wordt zelf de volgende botsing — het hoort afgeleid |

Punt 3 verdient een aparte zin. De Decision Fabric die het voorstel beschrijft
bestaat, met precies de gevraagde assen — en de resterende dubbele waarheid is
nu benoemd in `EXECUTIE.md`: **`kern/stuur/beleid.js` leest wél
`frictie/bodem.js` maar niet de motor**, en houdt dus zijn eigen armere model
voor de vraag per geval. Dat is één dag werk en het grootste enkele effect in
deze hele lijst.

### Een stap weg

| # | punt | wat er staat | wat ontbreekt |
|---|---|---|---|
| 1 | Levensgraaf verbreden | de vorm, 47 bronnen, 6 collecties | 190 collecties, elk met zijn vijf etiketten |
| 4 | Capability Credentials | `kern/stuur/mandaat.js` — versmalt alleen, doorsnede, **leeg is dicht** | **nul aanroepers**; en de cryptografische drager |
| 8 | Temporal Intelligence | `levensgraaf/termijnen.js` telt vervaldata over apps heen; `SERVICE.md` par. 5 heeft vier klokken | *"over 43 minuten wordt dit kritiek"* — dat is de aandachtmotor uit punt 2 |
| 9 | Spatial Intelligence | `kern/navigatie/wegennet.js`, `kern/plaats/`; de voorspeller wordt al met plaats gevoed | één gedeelde kaartlaag onder de vijf gebruikers ervan |
| 4b | Multi-agent orkestratie | `kern/ai/router.js` met een register van motoren die aantoonbaar laden | de router **beslist niets**, en de volgorde staat omgekeerd |

### Vraagt een besluit

| # | punt | het besluit |
|---|---|---|
| 8b | Continue Key als voorspelde actie | `WERELD.md` zegt met zoveel woorden dat er **bewust geen voorgekookt werkblad** is. Dit is een omkering van een genomen besluit, geen aanvulling. |
| 10 | Generatieve interfaces | `ADAPTIEF.md` heeft de harde grens **verbergen bestaat niet**. Een engine die "toegestane componenten" kiest, kiest per definitie componenten wég. Die twee moeten verzoend zijn vóór er iets rendert. |
| 16 | Simulation Lab | er zijn **al twee** synthetische werelden (Magnaat en `kern/hospitality-universe/`) die elkaar aanroepen. `MAGNAATLAB.md`: die vraag hoort beantwoord vóór er een derde bij komt. De rail bestaat wel: `server/betaal/synthetisch.js`, vier afloopen, drie grendels. |
| 19 | Universal Command | `EXECUTIE.md` blok 9 is **bewust niet gebouwd**, met de reden: 0 bewezen routes en 96 van 176 onbekende gevolgen dragen geen balk die het hele huis in gewone taal bedient. Geen gat — een besluit dat op twee getallen wacht. |
| 20 | Apps worden lenses | juist, en het mag geen ontsnapping worden: `PLATFORM.md` par. 0b laat samenvoegen alleen toe als kern, dáta én workflow dupliceren. "Lens" mag die toets niet overslaan. |

### Half, en het ontbrekende stuk is precies benoemd

| # | punt | wat er staat | het gat |
|---|---|---|---|
| 2 | Situation Engine | kaart → plan → doe (`resolver.js` 100% dekking, `plan.js`, `gevolg.js`); VERIFIËREN staat (`command/transactie-poorten.js`: *een controle die niet kon draaien is niet geslaagd*) | **WAARNEMEN** en **LEREN**. Er is geen aandachtmotor. |
| 6 | Event sourcing | `kern/envelop.js`: acht velden, `correlatie` en `oorzaak`, de keten loopt door | **geen schemaregister.** De envelop zegt met opzet nooit WAT, dus `payment.authorized.v1` met een vorm erachter bestaat niet. En tijdreizen botst met de eigen bewaartermijnen. |
| 13 | Self-healing | reconciliatie in `kern/pay/`, `kern/bank/grootboek.js`; `kern/pay/bewijs.js` kent drie standen en géén groen | *recovery action* is voor **91 van 115** AI-schrijfpaden onbekend |

### Jaren weg

**Punt 11 (personalisatie)** botst bovendien met een genomen besluit: "leren
welke informatie iemand opent" is een gedragslogboek per lid, en `KOSTEN.md`
koos expliciet **tellers en geen journaal**. Voeg daarbij `GRAMMATICA.md`: de
bediening moet voorspelbaar blijven.

**Punt 12 (ambient)** is echt ver weg, en `TOEGANKELIJK.md` geldt er dubbel: er
is nog nooit iemand met een handicap door dit huis gelopen.

---

## 4. Wat werkelijk vanaf nul begint

Drie dingen. Niet meer, en dat is het goede nieuws.

1. **De aandachtmotor.** Er is geen `kern/aandacht`; `/api/aandacht` staat in
   `EXECUTION_MAP.json` op `verboden`. Dit is het ontbrekende werkwoord van het
   hele voorstel: het systeem **wacht** vandaag op een opdracht.
2. **Het schemaregister voor gebeurtenissen.** De envelop draagt de keten maar
   nooit de inhoud, en dat is een grens en geen gebrek — een register ernaast is
   dus nieuw werk, met de vraag wie hem afdwingt.
3. **De leerlus.** Punt 15 (shadow execution) meet al *wat er anders zou zijn
   gegaan*. Van meten naar bijstellen is een stap die nergens bestaat.

---

## 5. Grenzen die niet mogen sneuvelen

1. **De mens bestaat nergens als rij.** `HDI.md` par. 5.1. De MENS-boom uit het
   voorstel — huishouden, bedrijf, medewerker, reizen, documenten, betalingen
   onder één wortel — is in opgeslagen vorm exact een `humans`-tabel. Als
   projectie mag hij, met `deel` als poort. Er komt ook geen route die "alles
   over deze mens" teruggeeft zonder dat de mens zelf die aanroep doet.
2. **Een cijfer draagt zijn opbouw, of het bestaat niet.** `confidence: 0.98`
   naast een besluit is een orakel. `frictie/motor.js` doet het al goed; de
   Decision Fabric mag dat niet verliezen.
3. **`onbekend` is geen `geen effect`.** 96 van 176 bereikbare paden zijn
   ongemeten. Een Situation Engine die "raakt niets aan" toont waar niemand keek,
   is een geruststelling zonder grond.
4. **Autonomie wordt gepromoveerd, nooit geslopen** (`FABRIC.md`). Een
   capability credential verleent nooit vermogen — hij versmalt bestaand,
   bewezen vermogen. Leeg is dicht.
5. **Verbergen bestaat niet** (`ADAPTIEF.md`). Geldt onverkort voor een
   gegenereerde interface.
6. **De AI beweegt geen geld** (`WAARDE.md`), en wat een tweede persoon bereikt
   bevestigt een mens (`LIFE.md`). Geen runtime-model verandert dat.

---

## 6. De volgorde

Op opbrengst per dag werk, en de eerste drie kosten samen ongeveer een week.

1. **De frictiemotor aansluiten op het stuur — en dat is anders dan het leek.**
   Deze aanbeveling stond hier eerst als "`stuur/beleid.js` de motor laten lezen,
   ongeveer een dag". Dat is nagemeten en het klopte niet, op twee punten.

   Ten eerste zit de naad niet in `beleid.js`. Die leest `frictie/bodem.js` al
   volledig, mét de afbeeldingsbeslissing en de regel dat hij alleen kan
   verzwaren. Wat ontbreekt is de MOTOR, en die vraagt bedrag, aantal,
   omkeerbaarheid en zekerheid — terwijl `beleidVoor(pad, wereld)` alleen een pad
   en een rol krijgt, bij alle 8 aanroepers. De context zit één laag hoger:
   `stuurToets` in `kern/stuur.js` heeft de body al in handen.

   Ten tweede is de opbrengst smaller dan gehoopt, en dat is **gemeten**
   (`npm run frictiestuur`): met de grondslag op `lezen` scoort 250.000 euro
   **17** punten en de autogrens ligt op 30 — de bedragfactor loopt vast op 25 en
   `hoge zekerheid` trekt er 8 af. **Bedrag alleen verzwaart nooit.** Wat wél
   verzwaart is bedrag ÉN aantal samen (25.000 euro + 500 objecten = 42 →
   `assist`). Dat is één vorm, en het is een echte: een bulkhandeling met een
   groot bedrag hoort een mens te passeren.

   De schaduw staat er inmiddels (`kern/stuur/frictieschaduw.js`), meelopend en
   zonder te bijten, zoals `CONTROLPLANE.md` eist. Wat hem breder zou maken is
   geen bedrading maar een **besluit**: een grondslag per AI-route. De tabel in
   `kern/frictie/motor.js` is met zoveel woorden "de acties die Command kent",
   zestien namen, en er is geen afbeelding van een AI-route op een daarvan — er
   een verzinnen zou de fout van de cap `rooms` zijn.
2. **`mandaat.js` een aanroeper geven.** De duurste regel van `INTELLIGENTIE.md`
   is gratis — de grammatica staat, niemand roept hem.
3. **De routervolgorde omdraaien**, zodra de schaduwtelling een getal draagt.
   Vandaag gaat *"wat kost een RTG Pass?"* langs een taalmodel.
4. **De levensgraaf verbreden** van 6 naar de collecties die ertoe doen — geld,
   reizen, documenten, termijnen. Elke bron met zijn vijf etiketten.
5. **De 46 ontbrekende herstelwerelden**, want zonder terugweg geen autonomie.
6. **Dan pas de aandachtmotor**, en daarmee de Situation Engine.

De maatstaf blijft die van `INTELLIGENTIE.md` par. 6, en dit voorstel verandert
hem niet: **wanneer kan RTG van een zelfstandige handeling vooraf zeggen wat er
verandert, achteraf bewijzen dat het gebeurd is, en hem terugdraaien als het
misging?** Vandaag zijn dat 7 van de 118 schrijfparen.

Wat het voorstel wél verandert is de richting waarin dat getal moet groeien: niet
door meer lagen, maar door de projectie te verbreden die er al staat.
