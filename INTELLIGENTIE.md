# RTG Intelligence Layer

*Richtingsdocument. Per onderdeel staat er of het **staat**, **een stap weg** is,
**een besluit vraagt** of **jaren weg** is — dezelfde vorm als `PLATFORM.md`,
`ECONOMIE.md`, `HDI.md` en `DEVELOPERCLOUD.md`, zodat niemand die vier voor
elkaar aanziet.*

Gemeten op 6 september 2026, commit `5cf21401`. Elk getal hieronder komt uit een
register waarvan de bronnen op diezelfde boom zijn gehasht
(`npm run executionmap:controle`: byte voor byte gelijk aan zijn zeven bronnen).
Waar een getal ontbreekt staat de reden en niet een nul.

---

## 0. De lat

De voorgestelde hoofdregel, en hij staat boven de bestaande doctrine in plaats
van ernaast:

> **Understand continuously. Prepare proactively. Act proportionally. Prove
> everything. Interrupt rarely.**

In de grammatica van `WERELDEN.md`:

> *Worlds orchestrate. Domains own. Policies authorize. Runtimes execute.
> Evidence proves.* **Intelligence anticipates.**

Dat laatste werkwoord ontbreekt vandaag, en dat is niet een gat in de code maar
een gat in de architectuur. De huidige keten is:

```
mens -> opdracht -> resolver -> toestemming -> uitvoering -> bewijs
```

De voorgestelde keten is:

```
wereld verandert -> merken -> begrijpen -> voorspellen -> klaarzetten
                 -> bevoegdheid bepalen -> handelen of aandacht vragen
                 -> uitkomst controleren -> leren
```

Het verschil zit in de eerste vier woorden. Alles vanaf *bevoegdheid bepalen*
bestaat; alles ervóór niet.

### 0.1 Waarom dit document met een meting begint

De opzet noemt vijftien onderdelen. Vier ervan botsen met een besluit dat dit
huis al genomen heeft, en drie ervan bestaan al onder een andere naam. Dat is
geen kritiek op de opzet maar de reden dat `scripts/objectmodel.js` bestaat: een
laag die eroverheen wordt verklaard in plaats van in de domeinen gevonden, is de
`Asset`-fout. Die is hier één keer gemaakt en hoeft geen tweede keer.

De meting staat in par. 1. De botsingen staan in par. 3, want die zijn duurder
dan de gaten.

---

## 1. Waar de laag vandaag staat

### 1.1 Het bereik van het stuur

4729 routes. Daarvan zijn er **176 (rol, route)-paren** AI-bedienbaar — 3,7%.

| | lezen | klein | voorstel | totaal |
|---|---|---|---|---|
| member | 43 | 5 | 72 | 120 |
| supplier | 11 | 0 | 29 | 40 |
| staff | 4 | 0 | 12 | 16 |
| **totaal** | **58** | **5** | **113** | **176** |

`voorstel` vraagt een menselijke bevestiging buiten het model. Wat de machine
zelfstandig **schrijft** zijn dus 5 paden, alle vijf bij de gebruiker zelf en
omkeerbaar. Er is geen vierde wereld: het kantoor (`office`) is geen rol in
`kern/stuur/beleid-lijsten.js`, dus de 548 muterende kantoorroutes uit
`KANTOORMACHT.md` zijn nul procent bereikbaar.

### 1.2 De vier registers waar de nieuwe laag op moet leunen

| register | stand | wat dat betekent voor deze laag |
|---|---|---|
| `VERTROUWEN.json` | 0 bewezen, 0 geschorst, 4716 verzwakt, 22 ongemeten | de bewijspoort sluit alleen op `geschorst` en er zijn er nul: **proof-aware routing filtert vandaag niets** |
| gevolgvoorspelling | over de 176: 35 gemeten, 48 geen-effect-gemeten, **93 onbekend** | voor 53% van zijn handelingen kan het stuur niet zeggen wát er verandert |
| herhaalbaarheid | over de 176: 57 beschermd, **119 ongemeten** | voor tweederde is niet bekend wat een tweede aanroep doet |
| herstel | over de 115 AI-**schrijfpaden**: 4 exact, 17–18 compensatie, 2 wereld ontbreekt, 1 niet beproefd, **91 zonder enige tegenhanger** | zie par. 3.5 — dit is het duurste getal in dit document, en het enige dat niet kan schuiven |

`HERSTEL.json` staat huisbreed op 1,1% dekking (47 vermoede tegenhangers over
4643 routes), en niets daarvan komt boven de graad `vermoed` uit een naam.

### 1.3 Wat er wél staat, en niet opnieuw gebouwd moet worden

Zeven bouwstenen die de opzet als nieuw opvoert, bestaan:

| opzet noemt het | het heet hier | stand |
|---|---|---|
| Effect Graph | `kern/stuur/gevolg.js` + `opslag` in `IDEMPROEF.json` | **staat**, 47% gevuld |
| Simulator | `kern/command/simulatie.js`, `kern/commercie/schaduw.js` | **staat**, voor de ops-cockpit |
| Verifier | `kern/command/transactie-poorten.js` | **staat** — *een controle die niet kon draaien is niet geslaagd*, en de verificatie kijkt POSITIEF na |
| Policy | `kern/stuur/beleid.js` + `kern/frictie/bodem.js` | **staat**, closed by default, bodem kan alleen verzwaren |
| Critic | `kern/commercie/voornemen.js` (execution plan, vijf harde regels) | **staat**, niet aangesloten op het stuur |
| Open-lus-geheugen | `kern/service/loop.js` (de zaak-tijdlijn) | **staat** voor zaken, één schrijver |
| event-envelop | `kern/envelop.js` — 8 velden, `correlatie` + `oorzaak` | **staat**, 14 aanroepers |
| Memory (procedureel) | `kern/levensgraaf/graaf.js` — de projectie-vorm | **staat** als patroon, niet als geheugen |

Het werk is dus voor een groot deel **aansluiten en niet uitvinden**. Dat is
dezelfde uitkomst als par. 1 van `HDI.md`, en om dezelfde reden: dit huis bouwt
zijn lagen los en verbindt ze laat.

---

## 2. De vijftien onderdelen, gewogen

| # | onderdeel | stand | waarom |
|---|---|---|---|
| 1 | Mensmodel (zes geheugensoorten) | **besluit** | privacygrens, par. 3.3 |
| 2 | Attention Engine (`aandacht.js`) | **stap weg** | de bus staat (`envelop.js`), het schemaregister niet — par. 3.6 |
| 3 | Initiative Budget (5 standen) | **botst** | het bestaat al en heet `mandaat.js` — par. 3.1 |
| 4 | Consequence Engine | **stap weg** | `gevolg.js` staat; de 93 `onbekend` zijn meetwerk, geen ontwerp |
| 5 | World Model boven de routes | **besluit + meting** | par. 3.2 — eerst meten, zoals `objectmodel.js` |
| 6 | Hypotheses met kansen | **stap weg** | `kern/voorspel/` staat; de vorm mag geen samengesteld cijfer worden |
| 7 | Next Best Action per entiteit | **jaren weg** | vraagt 5 (world model) en 4 (gevolg) allebei af |
| 8 | Stilte als feature | **botst deels** | de formule wel, het ene cijfer niet — par. 3.4 |
| 9 | Specialistennetwerk (9 rollen) | **stap weg** | 6 van de 9 bestaan (par. 1.3); Observer en Memory niet |
| 10 | Verificatie verplicht | **stap weg** | `transactie-poorten.js` staat, hangt aan de verkeerde laag |
| 11 | Herstelplan per handeling | **stap weg, en het duurst** | par. 3.5 — 91 van 115 |
| 12 | Shadow Worker in het kantoor | **besluit** | par. 3.7 — er is geen medewerkersidentiteit |
| 13 | `AUTONOMIEBEWIJS.json` | **stap weg** | het is een JOIN van vier bestaande registers, geen nieuwe meting |
| 14 | Leerrecord met promotie | **stap weg** | `candidate -> validation -> promoted` is precies `CODE.md` besluit 4 |
| 15 | Constraint solver | **stap weg** | `ai/router.js` noemt hem al in `ONTBREEKT`, mét de reden |

---

## 3. De zeven dingen die niet mogen sneuvelen

### 3.1 Het Initiative Budget bestaat al, en een zesde schaal draait een besluit terug

`scripts/gezag.js` telt **vijf gezagsvocabulaires** in dit huis. `npm run
gezagsnoemer` heeft ze net teruggebracht tot één noemer van **vier treden**
(`geen` / `tonen` / `klaarzetten` / `uitvoeren`) over 21 rijen: 18 evident, 3
besloten, **0 onbepaald**. Dat was werk, en het is af.

Een nieuwe schaal van vijf standen (*stil / signaleren / voorbereiden / handelen
/ regisseren*) is de **zesde** — en twee van zijn standen zijn precies de vraag
die op 31 augustus is beantwoord:

> `autonoom` en `begrensd` blijven **eigenschappen** (van het mandaat, van de
> uitvoering) en worden geen trede. Wat de machine mag is een vraag, hoe ver hij
> mag gaan is een tweede.

**De uitweg is geen nieuwe schaal maar een bestaande aanroeper.**
`kern/stuur/mandaat.js` ís het Initiative Budget: een doorsnede die bestaand
vermogen versmalt, met budgetsoorten (`centen`, `handelingen`, `berichten`) en
leeg-is-dicht. Wat de opzet per domein wil (`agenda = 3`, `medisch = 0`,
`geld > €500 = 1`) is exact wat een mandaat uitdrukt.

Het probleem is niet dat het ontbreekt. Het probleem is dat **`mandaat.js` in
heel `server/` nul aanroepers heeft** — alleen `test/stuur-mandaat.test.js`. De
grammatica staat en er is geen zin in geschreven.

> **Regel INT-01.** Er komt geen zesde gezagsvocabulaire. Het initiatiefniveau
> is een eigenschap van een mandaat en wordt uitgedrukt in de vier treden van
> `GEZAGSNOEMER.json`. Wie een nieuwe schaal introduceert, herstelt de botsing
> die `npm run gezagsnoemer` net heeft opgelost.

### 3.2 Het World Model moet gevonden worden, niet verklaard

De opzet stelt elf concepten voor (gast, reis, dienst, betaling, werknemer,
project, voorraad, woning, afspraak, probleem, belofte) met relaties eronder. De
richting is goed en de vorm is de gevaarlijkste in dit document, want dit huis
heeft die fout al één keer gemaakt en toen gemeten:

- `OBJECTMODEL.json`: 2002 velden over 264 domeinen, waarvan **1416 (71%) bij
  precies één domein horen**. `Asset` bestaat niet — tafel, kamer, podium en
  leaseauto delen niets buiten hun verpakking. Er kwamen vier kandidaten uit, en
  er haalde er **één** de drempel.
- `KETENVORM.json`: over drie onafhankelijke ketens (horeca, rit, toelating) is
  **0 van 13 actoren gedeeld** en 2 van 10 beloftethema's — en die twee gaan
  allebei over de machine (mag dit twee keer, zegt een weigering waarom) en niet
  over het domein.
- `SEMANTIEK.json`: van 118 namen die in meer dan één domein staan dragen er
  **100 meer dan één betekenis**, samen 379. `SOORTEN` staat op 47. En `zaak`
  betekent in twee ketens iets anders — ontvanger tegenover uitkomst.

Drie onafhankelijke metingen zeggen hetzelfde: een gedeeld typemodel over
domeinen heen is **niet gerechtvaardigd** zonder meting per concept.

**Maar de uitweg bestaat en is beproefd.** `kern/levensgraaf/graaf.js` is precies
de vorm die `HDI.md` par. 5.1 voorschrijft: een **projectie**, geen tweede
database, met `deel` als poort en niet als etiket. Een wereldmodel dat zo wordt
gebouwd voegt geen waarheid toe — het leest bestaande domeinwaarheid en legt er
verwijzingen tussen.

> **Regel INT-02.** Elk concept in het wereldmodel wordt gemeten voordat het
> bestaat (`scripts/wereldmodel.js`, in de vorm van `scripts/objectmodel.js`), en
> het model is een projectie die niets bezit. Een concept dat geen twee domeinen
> aantoonbaar deelt, wordt geen concept maar blijft een domeinnaam.

De eerste vier kandidaten liggen er trouwens al: `OBJECTMODEL.json` noemt
`architect`, `atelier`, `hardwarelab` en `studio` als de vier domeinen waar twee
onafhankelijke metingen naar dezelfde gedeelde vorm wijzen. Dáár begint een
wereldmodel, niet bij `gast`.

### 3.3 Het Mensmodel is een privacybesluit voordat het een functie is

De zeven velden die de opzet voorstelt (`waarom_weet_ik_dit`, `bron`,
`zekerheid`, `laatst_bevestigd`, `mag_worden_gebruikt_voor`, `mag_worden_vergeten`,
`conflicteert_met`) zijn goed en sluiten aan op de bewijsgraad uit `BESTUUR.md`
(onbekend / vermoed / gemeten / bewezen). Er moeten er twee bij, en één ervan is
niet onderhandelbaar.

Het probleem zit niet in de velden maar in de **sleutel**. Een episodisch
geheugen zegt: *"de vorige drie keer dat deze leverancier te laat was, koos je
alternatief B."* Dat is een gedragsprofiel dat aan een persoon hangt. Drie
huisregels raken dat tegelijk:

- `HDI.md` par. 5.1: **de mens mag nergens als rij bestaan.** Er komt geen
  `humans`-tabel en geen route die "alles over deze mens" teruggeeft zonder dat
  de mens zelf die aanroep doet.
- `CLAUDE.md`, privacy by design: klantdata draait op **codenamen**; echte namen
  staan in de gescheiden kluis.
- `scripts/afleidbaar.js` vond dat **codenaam plus bezorgadres** vandaag al in de
  operationele data staat **zonder bewaartermijn**, en merkte dat aan als het
  ene punt dat een besluit verdient. Een episodisch geheugen náást diezelfde
  codenaam maakt precies dat pad korter.

> **Regel INT-03.** Het Mensmodel hangt aan de codenaam en raakt de
> identiteitskluis nooit. Elk geheugenitem draagt bovenop de zeven voorgestelde
> velden een **bewaartermijn** (geen termijn = het item bestaat niet) en een
> **`deel`-poort** in de vorm van `kern/levensgraaf/graaf.js`. Er komt geen
> route die het hele model van één mens teruggeeft, ook niet intern, ook niet
> voor het kantoor.

En de meeteenheid-grens uit `HDI.md` geldt onverkort: **een voortgangsmaat mag
over een cohort en nooit per persoon, ook niet intern als sorteersleutel.** Een
voorkeurengeheugen dat "deze gebruiker kiest in 96% van de gevallen B" opslaat is
toegestaan; datzelfde getal gebruiken om gebruikers te ordenen is dat niet.

### 3.4 De aandachtscore mag bestaan, het ene cijfer niet

`attention_score = urgency × impact × confidence × novelty − interruption_cost`
is de juiste gedachte in de verkeerde vorm. Twee huisregels:

- `BEWIJSMACHINE.md`: één samengesteld cijfer **verbergt welke van de meters
  bewoog**. `scripts/zekerheid.js` bestaat precies omdat losse eerlijke getallen
  bij elkaar een gevoel geven dat gevaarlijker is dan elk getal apart.
- `HORECA.md` en `KANTOORMACHT.md`: wat niet gemeten is wordt niet als getal
  getoond, en een score draagt altijd zijn opbouw.

Vandaag zijn `confidence` en `novelty` niet meetbaar — er is geen basislijn om
nieuwheid tegen af te zetten en de bewijsgraad staat op 0 bewezen. Een score die
die twee tóch als factor draagt, vermenigvuldigt met een verzonnen getal.

> **Regel INT-04.** De aandachtmotor geeft een **besluit met zijn opbouw**
> (negeren / onthouden / in de briefing / voorbereiden / nu tonen / zelf
> oplossen), nooit één cijfer. Een factor die niet gemeten is, ontbreekt in de
> opbouw mét reden en wordt niet op 1 gezet. En de score gaat over
> **gebeurtenissen**, nooit over mensen — niet op leden, niet op medewerkers,
> ook niet intern als sorteersleutel.

### 3.5 De terugweg is het echte plafond op autonomie

Dit is het duurste getal in dit document, en het staat niet in de opzet.

Punt 11 stelt terecht dat autonomie niet aan een endpointcategorie hangt maar aan
`impact × onzekerheid × reversibility × bewijsbaarheid × blast radius`. Die
formule is vandaag voor de meeste paden niet uit te rekenen:

**Van de 115 AI-schrijfpaden hebben er 91 geen bekende terugweg** (79%). Bewezen
zijn er 22 — 4 `exact` en 18 `compensatie` — plus 2 waarvoor de proef de wereld
niet kon opzetten.

**En dit getal kan niet schuiven, wat er ook met het instrument gebeurt.** Die
91 hebben namelijk geen tegenhanger *om* te beproeven: `HERSTEL.json` leidt
kandidaat-paren af uit de NAAM van een route (`/bewaar` tegenover `/verwijder`),
en voor deze 91 levert dat er geen. Er is dus niets gedraaid dat anders had
kunnen uitvallen. Alleen de 24 paden die wél een tegenhanger hebben, worden echt
beproefd, en daar zit de beweging: 21 of 22 bewezen, afhankelijk van de
omgeving (zie 3.5a).

| | ingecheckt register | herdraaid op een andere machine |
|---|---|---|
| bewezen terugweg | 22 | 21 |
| geen bekende terugweg | 93 | 94 |
| volledig bewijsbaar (par. 6) | **7** | **7** |

### 3.5a Twee eigenschappen van de herstelproef die je moet kennen

Bewijsgraad van alles wat uit `HERSTELPROEF.json` komt: **gemeten**, met een
spreiding van één paar, en met twee voorbehouden die op 6 september 2026 zijn
vastgesteld door de proef meerdere keren te draaien.

**Het ingecheckte register reproduceert niet op een andere machine.** Twee
rondes op ongewijzigde `main` zijn onderling identiek — nul verschillen over
negentig paren, dus de proef is deterministisch — maar wijken allebei met
dezelfde vijf paren van het ingecheckte bestand af (`/api/meet/kom`,
`/api/meet/verlaat`, `/api/meet/weg`, `/api/samen/maak`, `/api/samen/weg`). Wie
zijn eigen ronde tegen het ingecheckte bestand legt, ziet vijf spookverschillen.
De juiste nulstand is een **verse ronde op de basisbranch, op dezelfde machine**.

**Alle negentig paren delen één wegwerpserver.** Een wijziging die ergens
schrijft verschuift daarmee de voorgeschiedenis van de opslag, en dus wat
`exact` betekent voor latere paren — ook voor routes die niets met die
wijziging te maken hebben. **`exact` is hier een broze graad.**
`wereldOntbreekt` daarentegen wordt beslist voordat er een server draait en kan
per constructie nooit schuiven; dat is de reden dat par. 3.2 en de opzoeking uit
Fase 0 wél hard zijn.

Beide staan uitgeschreven in `scripts/herstelproef.js` op de plek waar ze
bijten, want ze hebben tijdens Fase 0 drie meetrondes gekost: een werkende
wijziging is teruggetrokken op grond van vijf "regressies" die achteraf
spookverschillen bleken.

*Pad of paar:* het stuur kent 176 (rol, pad)-paren over 173 unieke paden; de
schrijfkant is 118 paren over 115 paden. Waar dit document over herstel en
gevolg spreekt telt het **paden**, want een terugweg is een eigenschap van de
route en niet van wie hem aanroept. Waar het over bereik spreekt telt het
**paren**, want een pad kan voor de ene rol open zijn en voor de andere dicht.

Het goede nieuws is dat het instrument bestaat en werkt. `scripts/herstelproef.js`
vóért het paar uit (heen, kijken, terug, kijken) en vergelijkt de inhoud van de
opslag; over 90 paren gaf hij 13 `exact`, 30 `compensatie`, 1 `geen-herstel`, **0
niet beproefd** en 46 die een wereld vragen die de proef niet opzet. Het werk is
die 46 werelden bouwen, niet een motor ontwerpen.

> **Regel INT-05.** Een handeling die het stuur zelfstandig uitvoert, draagt een
> **beproefde** terugweg — `exact` of `compensatie`, met de soort erbij, want een
> creditnota wist geen factuur. `vermoed` uit een naam telt niet: /agenda/bewaar
> is geen omkering van /verwijder, en dat is precies waarom `HERSTEL.json` op 1,1%
> staat en `HERSTELPROEF.json` iets anders meet.

Dat maakt punt 11 tegelijk het meest lonende: het is de enige verandering die
autonomie **vergroot** in plaats van beperkt. Een handeling van € 20 die
aantoonbaar volledig herstelbaar is, is minder riskant dan een gratis handeling
die onomkeerbaar gegevens vernietigt — maar dat argument mag alleen worden
gemaakt met een beproefd getal eronder.

### 3.6 De bus staat, het schema niet

De Attention Engine leest state changes. Die bus bestaat: `kern/envelop.js` geeft
elk bericht acht velden en de keten loopt door, zodat een gevolg-gebeurtenis weet
waardoor zij ontstond. Er zijn 14 aanroepers.

Wat ontbreekt staat in `OS.md` met zoveel woorden: **de envelop zegt met opzet
nooit WAT.** Er is geen schemaregister — `payment.authorized.v1` met een vorm
erachter bestaat niet. Een aandachtmotor die `betekenis -> consequentie ->
urgentie` moet afleiden uit een berichtenstroom zonder types, leidt af uit
tekenreeksen.

> **Regel INT-06.** Het schemaregister komt vóór de aandachtmotor. Zolang een
> gebeurtenis geen vorm heeft, is elke afleiding eruit een gok met een nette
> naam.

Drie grenzen van de envelop reizen mee en blijven gelden: de actor is een
codenaam (de envelop weigert wat op een contactgegeven lijkt), `onbekend` is geen
`openbaar` en een gevolg erft de classificatie niet, en de levering gaat voor.

### 3.7 De Shadow Worker in het kantoor kan vandaag niet meten wie de mens was

Punt 12 is de sterkste van de vijftien: kantoorroutes niet openzetten maar er een
schaduwwerker naast zetten, en autonomie laten **verdienen** door gedrag
(`observe -> recommend -> prepare -> supervised -> autonomous`). Het mechanisme
bestaat zelfs — `kern/commercie/schaduw.js` doet precies dit voor
handhavingsregels, en `CONTROLPLANE.md` schrijft het voor: je kunt niet afdwingen
wat nooit in de schaduw heeft gelopen.

Er is één blokkade die de opzet niet noemt, en zonder die is de meting zinloos.
`KANTOORMACHT.md`: er is **één gedeelde `OFFICE_CODE`, één rol `office`, 26
kamers achter één sleutel**. Je kunt "menselijke keuze versus AI-keuze" niet
vergelijken als je niet weet wélke mens koos. De toelatingsproef liep hier al
tegenaan: `boardroomWie()` geeft alleen een naam als er een lid-account achter
het kantoortoken hangt — wie met de gedeelde code inlogt, kan de keten niet
afmaken.

> **Regel INT-07.** De Shadow Worker in het kantoor komt ná de
> medewerkersidentiteit. Tot die tijd meet hij een gemiddelde van onbekende
> mensen, en dat is geen bewijs maar een getal.

Dat is trouwens geen omweg: `KANTOORMACHT.md` noemt het uit elkaar halen van de
bestaande macht al **de eerste functie van die laag**, vóór er macht bij komt.
De Shadow Worker geeft die verbouwing eindelijk een reden.

---

## 4. De bouwvolgorde, gecorrigeerd

De voorgestelde volgorde (Know → Understand → Anticipate → Prepare → Act → Learn
→ Disappear) is de goede richting. Twee correcties, allebei uit par. 3.

**Er is een Fase 0 die vóór Know komt.** Fase E (*reversible autonomy*) is
gedefinieerd op getallen die vandaag niet bestaan: 91 van 115 schrijfpaden zonder
terugweg, 93 van 176 zonder gevolgvoorspelling, 119 van 176 zonder gemeten
herhaalbaarheid, 0 bewezen routes. Die vier zijn geen ontwerpwerk maar meetwerk,
ze blokkeren alles erna, en ze zijn met bestaande instrumenten te doen.

**Fase A valt uiteen in drie stukken met verschillende prijzen.** De effectgraaf
is meetwerk (goedkoop, blokkerend). Het wereldmodel is een meting plus een
besluit (par. 3.2). Het geheugen is een privacybesluit vóór het een functie is
(par. 3.3) — en dat besluit is niet terug te draaien nadat het één keer is
genomen.

| fase | wat | prijs | blokkeert |
|---|---|---|---|
| **0 — Prove** | herstelproef-werelden (46), gevolgmeting (93), herhaalbaarheid (119), `bewezen` van 0 af | meetwerk, bestaande scripts | alles |
| **A1 — Know** | effectgraaf afmaken, `AUTONOMIEBEWIJS.json` als join van vier registers | klein, volgt uit 0 | C, E |
| **A2 — Know** | `scripts/wereldmodel.js` — meten, niet verklaren | meting + besluit | 5, 7 |
| **A3 — Know** | Mensmodel: besluit eerst, dan bouwen | **eigenaarsbesluit** | 1, 14 |
| **B — Understand** | Consequence Engine op de gevulde graaf; hypotheses met opbouw | volgt uit A1 | C |
| **C — Anticipate** | schemaregister, dán `aandacht.js`, dán Next Best Action | volgt uit A2 + 3.6 | — |
| **D — Prepare** | Shadow Worker — ná medewerkersidentiteit; constraint solver | verbouwing kantoor | 12, 15 |
| **E — Act** | `mandaat.js` een aanroeper geven; `RTG_HERKOMST_AFDWINGEN` omzetten | **twee besluiten, geen bouwwerk** | — |
| **F — Learn** | leerrecord met `candidate -> validation -> promoted` | volgt uit F-besluit in `CODE.md` | — |
| **G — Disappear** | de intelligentie zit in de werelden, niet in een app | — | — |

**Fase E is vandaag al bijna gratis en dat is opvallend.** Twee dingen die de
meeste waarde toevoegen zijn geen bouwwerk maar een besluit:

1. **`mandaat.js` aansluiten.** De module staat, is getoetst, en heeft nul
   aanroepers. Het Initiative Budget uit punt 3 is daarmee grotendeels
   bedradingswerk.
2. **`RTG_HERKOMST_AFDWINGEN=1`.** De prijs is gemeten en ligt klaar: na de
   eerste geslaagde `doe` gaat een lid van 120 naar 36 AI-paden en een zaak van
   53 naar 9. Dat getal hoort een mens te zien voordat de vlag omgaat — maar het
   ligt er, en het wachten is op de eigenaar en niet op de code.

---

## 5. Wat er bewust niet komt

- **Geen zesde gezagsschaal** (INT-01).
- **Geen tweede allowlist.** Alles wat de nieuwe laag toevoegt — mandaat,
  aandacht, wereldmodel — kan alleen **versmallen**. Wie hier iets bouwt dat
  vermogen toevoegt, heeft van `beleid.js` een suggestie gemaakt.
- **Geen `humans`-tabel** en geen route die één mens samenvat (INT-03).
- **Geen samengesteld aandachtscijfer** (INT-04), en geen score op een mens.
- **Geen autonome geldbeweging.** `GELD.md` staat hierboven: geld verlaat het
  huis nooit vanzelf, en voorbereiden, verplichten en betalen blijven drie
  gebeurtenissen die er als één knop uitzien.
- **Geen model dat zichzelf herschrijft.** Een leerrecord levert een *kandidaat*;
  promotie tot geheugen is een deterministische stap met een mens erin
  (`CODE.md` besluit 4).
- **Geen bronfragment naar een extern model.** Eigen code verlaat het huis niet;
  de Architect praat alleen met `LOCAL_AI_URL` (`CODE.md` besluit 3).

---

## 6. De maatstaf

Niet *"wanneer heeft RTG een Intelligence Layer"* maar:

> **Wanneer kan RTG van één zelfstandige handeling vooraf zeggen wat er verandert,
> achteraf bewijzen dat het gebeurd is, en hem terugdraaien als het misging?**

Vandaag is dat antwoord **ja voor 7 van de 118 AI-schrijfparen** — 5,9%. Alleen
deze zeven dragen alle drie tegelijk: een beproefde terugweg, een gemeten gevolg
en een beschermde herhaling.

| pad | rol | terugweg |
|---|---|---|
| `/api/agenda/toevoegen` | member | exact |
| `/api/bank/pas/uitgeven` | member | exact |
| `/api/kantoorpakket/maak` | member | exact |
| `/api/supplier/agenda/toevoegen` | supplier | exact |
| `/api/bank/terugkerend/zet` | member | compensatie |
| `/api/meet/maak` | member | compensatie |
| `/api/site/bewaar` | member | compensatie |

Drie paren hebben herstel én herhaling maar geen gemeten gevolg; de overige 108
missen er minstens twee.

Dat is de teller die dit document voorstelt, en hij hoort in een register te
staan (`AUTONOMIEBEWIJS.json`, par. 2 punt 13) voordat er een functie op wordt
gebouwd. Hij is met opzet **geen samengesteld cijfer**: het is een
drievoudige EN met drie noembare bronnen, en zodra één ervan zakt, zakt het
paar eruit met de reden erbij.

*Nagerekend op 6 september 2026 uit `EXECUTION_MAP.json`, `HERSTELPROEF.json` en
`kern/stuur/gevolg.js`. **Deze teller is stabiel**: hij komt op 7 uit met het
ingecheckte register én met een verse ronde op een andere machine, terwijl de
onderliggende uitslagen daartussen op vijf paren verschillen (par. 3.5a). Dat is
geen toeval maar de drievoudige EN: een paar dat op één van de drie assen zakt,
valt eruit, en de paren die alle drie halen zitten er ruim in. De eerste versie van deze paragraaf beweerde 4 zonder te
rekenen; dat is precies de fout waar LAT.md regel 6 over gaat, en het getal is 7.*
