# RTG Execution Physics — van zestien organen naar één machine

Dit is een **richtingsdocument**, zoals `PLATFORM.md`, `ECONOMIE.md` en
`EXECUTIE.md`: per onderdeel staat er of het **staat**, **een stap weg** is, **een
besluit vraagt** of **jaren weg** is. Zo kan niemand die vier voor elkaar
aanzien.

De kern in één zin: **dit huis heeft geen tekort aan motoren, het heeft een
tekort aan handelingen die er langs gaan.** Er komt dus geen centrale
orkestrator bij — dat is over drie jaar de monoliet waar alles omheen wordt
gebouwd — maar één uitvoerpad waar een betekenisvolle handeling niet omheen
*kan*.

**DE NAAD MET `RUNTIME.md`, en die staat hier vooraan omdat de twee documenten
uit hetzelfde voorstel komen.** `RUNTIME.md` gaat over de **werkelijkheid**: is er
één samenhangende graaf, en wat mag die graaf over domeinbetekenis zeggen
(antwoord: niets — hij gaat over identiteit, tijd, herkomst en bevoegdheid, en hij
is een projectie en geen tweede database). Dit document gaat over de
**uitvoering**: komt een handeling langs de motoren die dit huis daarvoor heeft
gebouwd. Die twee zijn niet hetzelfde en horen niet in één document: de eerste
vraag is *wat is waar*, de tweede *wat mag er gebeuren en is dat bewijsbaar
gebeurd*. Waar ze elkaar raken staat het hier met een verwijzing en niet met een
tweede telling.

`EXECUTIE.md` beschrijft de execution plane (wie veroorzaakt effecten),
`INTELLIGENTIE.md` de laag die anticipeert, `CONTROLPLANE.md` wie iets mag. Dit
document gaat over de vraag die geen van de drie stelt: **komen die lagen bij
dezelfde handeling langs?** Lees het met `MACHINEDEKKING.json` ernaast.

---

## 0. De meting die dit document eerlijk houdt

`npm run machinedekking` → `MACHINEDEKKING.json`. Hij legt zestien motoren naast
elkaar op dezelfde route, plus drie assen die hij LEEST uit `EXECUTION_MAP.json`
(hij rekent ze niet zelf — een tweede plek die hetzelfde telt, zegt op een dag
iets anders).

Twee assen per motor, en ze worden **nooit opgeteld**: `handler` is lexicaal
binnen de tekst van de handler (mist een hulpfunctie en de kern-tas), `bestand`
rekent het routebestand plus zijn directe requires (vangt de hulpfunctie,
markeert alle routes in een bestand, mist nog steeds de tas). Twee ondergrenzen
die verschillende dingen missen, geven samen geen bovengrens — dezelfde vorm als
`KANTOORMACHT.json`.

**De meter heeft in zijn eerste ronde twee keer zichzelf betrapt, en beide fouten
horen hier te blijven staan.** Eerst rekende de bestandsas de module mee die een
gebruikte kern-naam had geleverd. Dat leek de blinde vlek van de require-graaf te
dichten en deed het omgekeerde: `save` komt uit `server/server.js`, dat
`lib/keten` requiret, en daardoor stonden idempotentie (4162), bewijsketen (4158)
en schaduw (4157) op bijna élke muterende route. Daarna scoorde
`/api/notifications` tien assen — die route woont zelf in `server/server.js`, 143
requires. **Een hub markeert de hele boom, van twee kanten.** Een dekkingsgetal
dat zo ontstaat leest als een overwinning en betekent niets. Vandaar de hubgrens
(veertig requires) en de <!--getal:machine.hubRoutes-->28<!--/getal--> routes
waarvoor de bestandsas met naam en toenaam **onbruikbaar** is verklaard in plaats
van stil meegeteld.

---

## 1. Wat er gemeten is

<!--getal:machine.muterend-->4952<!--/getal--> muterende routes. Per as het
aantal routes dat hem raakt (`handler` / `bestand`):

| as | handler | bestand | motor |
|---|---|---|---|
| bewijsDraagt (proof-carrying) | 0 | <!--getal:machine.bewijsDraagt-->0<!--/getal--> | `kern/commercie/bewijstoken.js` |
| beleid (veiligheidskern) | 0 | 0 | `kern/commercie/veiligheidskern.js` |
| gevolg (wat raakt dit aan) | 0 | 0 | `kern/stuur/gevolg.js` |
| bewijsstand (bewezen) | 0 | 0 | `VERTROUWEN.json` |
| mandaat | 0 | <!--getal:machine.mandaat-->1<!--/getal--> | `kern/stuur/mandaat.js` |
| atomair | 1 | 17 | `pg/verzoektransactie.js` |
| bewijsketen (hash) | 4 | 23 | `lib/keten.js` |
| autoriteit | 1 | 28 | `kern/commercie/rechten.js` |
| tegenfeit | 2 | 28 | `kern/commercie/tegenfeit.js` |
| schaduw | 3 | 29 | `kern/commercie/schaduw.js` |
| voornemen (execution plan) | 3 | 44 | `kern/commercie/voornemen.js` |
| assurance (passkey, stap-op) | 2 | 49 | `kern/identiteit/vertrouwen.js` |
| frictie | 1 | 72 | `kern/frictie/motor.js` |
| simulatie | 10 | 103 | `kern/command/simulatie.js` |
| envelop (oorzaak, correlatie) | 2 | <!--getal:machine.envelop-->109<!--/getal--> | `kern/envelop.js` |
| idempotentie | 13 | 114 | `lib/idem-poort.js` |
| aiVindbaar | 173 | 173 | `kern/stuur/beleid.js` |
| mensAanDeDeur | 234 | <!--getal:machine.mensAanDeDeur-->234<!--/getal--> | `kern/kantoor/kluispoort.js` |
| herhaling (beschermd) | 1675 | 1675 | `IDEMPROEF.json` |

Vier assen staan als **ongemeten met een reden** en nooit als 0: doelvindbaarheid
(er is geen doelregister), gegevensklasse per veld (bestaat niet,
`KANTOORMACHT.md` par. 3), de terugweg (een naam is geen bewijs) en de kostprijs
per handeling (hangt aan een async-context, niet aan een route).

**De drie getallen die de richting bepalen:**

1. <!--getal:machine.zonderAs-->2818<!--/getal--> van de
   <!--getal:machine.muterend-->4952<!--/getal--> muterende routes raken **geen
   enkele** as — zelfs niet op de ruime bestandsas.
2. De hoogst geïntegreerde handeling buiten de hubs raakt **drie** assen
   (`/api/bank/rekening/open`, `/api/office/boardroom`,
   `/api/office/commercie/zaakabonnement/zet`). Er is geen enkele handeling in
   dit huis die de keten heeft gelopen.
3. <!--getal:machine.motorenZonderRoute-->3<!--/getal--> motoren bereiken geen
   enkele route: het bewijstoken, de veiligheidskern en de gevolgmeting.

Dat is de meetkundige vorm van de stelling: **niet te weinig motoren, te weinig
handelingen die erlangs gaan.** De prijs van de sprong is dus bedrading en geen
uitvinding — met vier uitzonderingen die in par. 4 als *besluit* of *jaren weg*
staan.

---

## 2. Het werkwoord

Niet `route → controller → mutatie`, maar: **begrijpen → wegen → bewijzen →
uitvoeren → vastleggen → observeren → leren.** Elke stap bestaat al als module;
wat ontbreekt is dat ze aan elkaar geregen zijn en dat een handeling er niet
buitenom kan.

De vorm die dat draagt is een **uitvoerkapsel**: één pakket dat met de handeling
meereist en per veld naar de bestaande motor verwijst (actor, assurance, mandaat,
autoriteit, bewijs, voornemen, tegenfeit, frictie, idempotentiesleutel,
gebeurtenisenvelop, ketenregel, gevolg). Niet zestien middlewares op één route,
maar één ding dat de hele handeling doorgaat — en dat aan het eind bewijsbaar
maakt wat er is besloten en waarom.

Twee dingen over dat kapsel liggen vast voordat er een letter van wordt gebouwd:

- Het **heet geen envelop**. `kern/envelop.js` is de gebeurtenisenvelop, gesloten
  op acht velden, en hij zegt met opzet **nooit WAT** er gebeurt. Een tweede
  envelop die juist wél over bedrag, doel en voorwaarden gaat, is exact de
  `VERMOGENS`-botsing op de centrale naam van de laag (`AFSPRAAK.md` par. 3). Het
  kapsel **verwijst** naar de envelop en vervangt hem niet.
- Het kapsel is **geen tweede autorisatielaag**. Elk veld is een verwijzing naar
  de motor die het antwoord bezit. Wie in het kapsel zelf gaat beslissen, heeft
  de 22e capabilitylijst gebouwd (`OS.md`, `CAPABILITEIT.json`:
  <!--getal:capabiliteit.lijsten-->21<!--/getal--> lijsten met
  <!--getal:capabiliteit.leden-->248<!--/getal--> leden).

---

## 3. Zeven begrippen die al bezet zijn

Dit is de goedkoopste paragraaf van het document: elke botsing die hier staat,
kost later een hernoeming door de hele boom. `RUNTIME.md` par. 2 heeft er al vijf
afgehandeld (**World Model** is bezet met zes betekenissen en heet hier
levensgraaf, **Capability Mesh** half, **Trust Kernel** half, **Intent Engine**
vrij, **Situation** let op); die worden hier niet herhaald. Dit zijn de zeven die
uit de uitvoeringskant komen. `SEMANTIEK.json` meet dat dit huis
<!--getal:semantiek.namen-->123<!--/getal--> namen in meer dan één domein heeft,
waarvan <!--getal:semantiek.betekenissen-->105<!--/getal--> met meer dan één
betekenis (samen <!--getal:semantiek.betekenissenTotaal-->389<!--/getal-->
betekenissen).

1. **`envelop`** — bezet en gesloten (zie par. 2).
2. **`doel`** — bezet, twee keer: `kern/doelen.js` is de LEVENSdoelenmotor
   (LEVEN.md) en `kern/identiteit/doelen.js` is **doelbinding** in de zin van de
   AVG (waarvoor mag dit gegeven gebruikt worden). Een planner-doel is een derde
   betekenis over 28 modules. Voorstel: de doeltoestand van een planner heet
   **`streefstand`** (nul treffers in de code), en het woord `doel` blijft van de
   mens en van de AVG.
3. **`capability`** — bezet als **platformvermogen** (`OS.md`), en de
   domeinkant heet sinds 27 augustus **genre-cap**. Een capability mesh met namen
   als `money.payment.initiate.v3` past op die eerste betekenis. Maar hij moet
   **afgeleid** worden uit de router en de assen, niet met de hand onderhouden:
   `EXECUTIE.md` zegt het al over de executiekaart — *wie hem met de hand kan
   bijwerken, heeft de 22e capabilitylijst gemaakt.*
4. **Een samengesteld integratiecijfer** (`15/15`, `confidence 99,997%`) — mag
   niet. `BEWIJSMACHINE.md` verbiedt het enkele `READY` boven een
   bewijs-scorecard en INT-04 verbiedt een percentage waar de trefzekerheid niet
   over drie afgesloten perioden is gemeten. Wat ervoor in de plaats komt: de
   **matrix per as** (die staat er nu) plus twee normtanden die alleen mogen
   dalen. Een cijfer verbergt precies wat het werk is: wélke as ontbreekt.
5. **Assurance als kommagetal** (`0,87`) — nee. `kern/identiteit/vertrouwen.js`
   heeft vijf discrete standen met de regel *een conclusie is nooit harder dan
   haar zachtste premisse*, en die regel is een **minimum**, geen gewogen
   gemiddelde. Een float suggereert precisie die er niet is en maakt van 0,87 een
   onderhandelbaar getal. Wat wél kan en de hele step-up-gedachte draagt: een
   capability noemt een **minimumtrede**, en de runtime vraagt een passkey zodra
   de zachtste premisse daaronder zit.
6. **`EXPERIMENTAL → OBSERVED → PROVEN → TRUSTED → DEGRADED → SUSPENDED`** — dat
   is een zesde ladder, en `AFSPRAAK.md` houdt die tegen. De drie die er al zijn
   dekken het samen: de vier bewijsgraden (onbekend, vermoed, gemeten, bewezen),
   de vervalstaten van `VERTROUWEN.json` (bewezen, verschaald, verzwakt,
   geschorst, ongemeten) en de drie schaduwmodi (UIT, SCHADUW, AFDWINGEN). Het
   immuunsysteem uit punt 8 van het voorstel is dus **bedrading van drie
   bestaande ladders**, geen nieuwe woordenlijst.
7. **Temporal truth** — de vorm mag, de opslag niet zonder besluit: dit huis
   heeft bewaartermijnen en een vergetelheidsbezem, en `HDI.md` par. 5.1 verbiedt
   een tweede plek waar een mens als rij bestaat. Een tijdprojectie **over
   gebeurtenissen** botst daar niet mee; een historische tabel van entiteiten
   wel.

---

## 4. Per onderdeel

### Staat (bedraden, niet bouwen)

| onderdeel | waar | wat er nog aan ontbreekt |
|---|---|---|
| execution plan | `kern/commercie/voornemen.js` | één echte aanroeper: vandaag alleen het boardroomscherm |
| proof-carrying auth | `kern/commercie/bewijstoken.js` | een inlever-plek: het token wordt uitgegeven en nergens verzilverd |
| tegenfeit | `kern/commercie/tegenfeit.js` | 28 routes op de ruime as, 2 in een handler |
| machtskaart | `kern/commercie/rechten.js` | leest alleen, en niemand leest hém |
| frictie (hand/assist/auto) | `kern/frictie/` | 0 lid- of zaakroutes: hij draait alleen in de ops-cockpit |
| gebeurtenisenvelop | `kern/envelop.js` | één requirer (`bus.js`); 95 bestanden melden buiten de bus om |
| hashketen + anker | `lib/keten.js`, `keten-anker.js` | 5 productiebestanden; het anker in dezelfde database is geen anker |
| idempotentiepoort | `lib/idem-poort.js` | 114 routes op de ruime as van 4952 |
| schaduwmodus | `kern/commercie/schaduw.js` | 6 regels, waarvan 3 in de schaduw en 0 ooit op bewijs gepromoveerd |
| mandaat-grammatica | `kern/stuur/mandaat.js` | 1 route; `INT-01` noemt dit al het initiatiefniveau |
| resolver + plan + gevolg | `kern/stuur/` | elk één requirer (`lusstap.js`) |
| kluispoort | `kern/kantoor/kluispoort.js` | 24 van 598 kantoorroutes |
| digitale tweeling | `kern/command/simulatie.js`, `zandbak.js` | draait uit de zaaiset, niet uit productie |
| voor- en nacontrole | `kern/command/transactie-poorten.js` | alleen in de ops-cockpit |

### Een stap weg

- **Het uitvoerkapsel** als object dat verwijst en niets beslist (par. 2).
- **Continuous assurance**: `vertrouwen.js` + `zwaarbewijs` + WebAuthn +
  kluispoort achter één vraag — *is de zachtste premisse sterk genoeg voor
  DEZE handeling?* De vier bestaan, de step-up-lus bestaat (`zwaarbewijs`), wat
  ontbreekt is dat een capability zijn minimumtrede noemt.
- **Adaptive friction in de UI**: `kern/frictie/` levert de trede al; wat
  ontbreekt is dat een scherm hem leest in plaats van een vast
  bevestigingsvenster te tonen. `GRAMMATICA.md` heeft de vijf gewichten al
  (`licht` … `plechtig`).
- **Causale observability**: de envelop draagt `correlatie` en `oorzaak`, dus
  *waarom besta ik* is een leesvraag zodra mutaties de envelop dragen.
- **Shadow everything**: de motor staat, de zes regels zijn er, en de
  promotie-eis (*je kunt niet afdwingen wat nooit heeft meegelopen*) is al
  doctrine.

### Vraagt een besluit van de eigenaar

1. **Wordt het uitvoerkapsel verplicht, en vanaf welke grens?** "Elke
   betekenisvolle mutatie" is geen grens; `kern/mutatie.js` heeft de vorm die wél
   werkt: de poort staat **aan de rand** (nieuw publiek aanroepbaar werk), niet
   met terugwerkende kracht over 4952 routes.
2. **Het anker van de hashketen**: een anker in dezelfde database is geen anker.
   Dit besluit staat al open in `AFSPRAAK.md` en het kapsel maakt het dringender.
3. **`RTG_HERKOMST_AFDWINGEN` aanzetten** — gemeten prijs: een lid gaat van 120
   naar 36 AI-paden, een zaak van 53 naar 9 (`INTELLIGENTIE.md` par. 4).
4. **Mag de bouw zakken op een ontbrekende verklaring?** (punt 20 van het
   voorstel). Dit is het enige structurele slot in het hele plan en het is
   goedkoop, omdat het een uitbreiding is van een bestaande poort en niet een
   nieuw mechanisme.

### Jaren weg (en waarom — met het getal)

- **Executable goals / world-state compilation.** Een planner heeft per
  capability een voorwaarde en een effect nodig. `kern/stuur/gevolg.js` meet dat
  vandaag: over de 176 paden die de AI mag bedienen zijn 36 `gemeten`, 44
  `geen-effect-gemeten` en **96 `onbekend`**. Een planner op 55% onbekende
  effecten verzint gevolgen. Dit is geblokkeerd op een meting, niet op ambitie.
- **Zelfherstellende journeys.** Zelfde blokkade, plus: van de 115
  AI-schrijfpaden hebben er 91 geen bekende terugweg. Een doelbewarende omweg
  zonder terugweg is een tweede poging bovenop een half effect.
- **Runtime evidence scores.** `VERTROUWEN.json` staat op
  <!--getal:vertrouwen.bewezen-->0<!--/getal--> bewezen en
  <!--getal:vertrouwen.routes-->4716<!--/getal--> verzwakt. Een
  promotiesysteem boven nul bewijs promoveert niets; eerst één keten écht
  bewijzen, dan het systeem eromheen.
- **Routes als bijproduct.** Kan pas als de capability-laag is **afgeleid**;
  `OBJECTMODEL.json` (71% van de velden hoort bij één domein) en
  `KETENVORM.json` (<!--getal:ketenvorm.actorenGedeeld-->0<!--/getal--> van
  <!--getal:ketenvorm.actorenTotaal-->13<!--/getal--> gedeelde actoren over drie
  ketens) zeggen dat een model eroverheen de `Asset`-fout is.

---

## 5. De grenzen die niet mogen sneuvelen

1. **Het kapsel beslist niets.** Elk veld verwijst naar de motor die het antwoord
   bezit. Een kapsel dat zelf oordeelt, is de 22e capabilitylijst.
2. **Geen samengesteld integratiecijfer als poort.** De matrix per as is het
   product; de normtanden hangen aan absolute getallen die alleen mogen dalen.
3. **Geen zesde ladder, geen tweede envelop, geen derde `doel`.** Wie een
   begrip toevoegt, toetst het eerst tegen `SEMANTIEK.json`.
4. **Assurance is een trede en geen kommagetal**, en de samenstelling is een
   minimum: een conclusie is nooit harder dan haar zachtste premisse.
5. **De verplichting staat aan de rand.** Nieuw publiek aanroepbaar werk draagt
   het kapsel; 4952 routes met terugwerkende kracht is een megaproject dat vooraf
   moet slagen, en dit huis doet het andersom (`kern/mutatie.js`).
6. **Een schaduwregel bijt niet voordat hij heeft meegelopen** — en er gaat geen
   identiteit in de schaduwteller (de lidpoort-les: het product is een getal, de
   stand is wat een mens nodig heeft om te besluiten).
7. **Geld verlaat het huis nooit vanzelf, en wat een tweede persoon bereikt
   bevestigt een mens.** Het kapsel maakt uitvoeren makkelijker; die twee grenzen
   uit `FABRIC.md` en `LIFE.md` bewegen niet mee.
8. **Een tijdprojectie mag, een tweede plek waar een mens als rij bestaat niet**
   (`HDI.md` par. 5.1), en een bewaartermijn gaat vóór een terugspoelbaarheid.

---

## 6. De volgorde

De eerste drie kosten samen dagen, niet maanden, en ze bewegen alle drie een
getal uit par. 1:

1. **Kluispoort op de dertien zware kantoorpaden en de vier zware lezende.** De
   poort bestaat; dit is bedrading, en het haalt de anoniem-uitvoerbare as omlaag
   waar hij het meest kost.
2. **Eén echte aanroeper voor het voornemen**, op een meerstapsgeldweg. De laag
   is af, getoetst en heeft vijf harde regels; wat ontbreekt is de eerste klant.
   Daarmee krijgt ook het bewijstoken zijn eerste inlever-plek.
3. **De envelop op de kantoormutaties.** `kern/envelop.js` staat, de keten loopt
   vanzelf door, en dit is de auditketen die `KANTOORMACHT.md` al aanwijst.

Daarna, en in deze volgorde omdat elk de volgende mogelijk maakt:

4. Het uitvoerkapsel als object, op precies die ene keten uit stap 1–3.
5. De bouwpoort (besluit 4 hierboven): nieuw publiek aanroepbaar werk zonder
   verklaarde actor-semantiek, bevoegdheidseis, assurance-trede, effecten,
   omkeerbaarheid en bewijsbeleid **landt niet**.
6. De capability-laag als **afgeleide** projectie uit router + assen.
7. Pas dan de planner, en pas nadat `gevolg.js` onder de 96 onbekende paden zit.

---

## 7. Wat dit document niet zegt

Het zegt niet dat de zestien motoren goed zijn — alleen dat ze bestaan en dat
bijna niets erlangs gaat. Het zegt niet dat de assen van `MACHINEDEKKING.json`
compleet zijn: vier staan als ongemeten met een reden, en de kern-tas-as ontbreekt
tot iemand hem per FUNCTIE meet in plaats van per module. Het zegt niet dat een
route met drie assen goed is; het zegt dat er geen route met meer is.

En het belangrijkste: geen enkel getal hierboven is met een echte gebruiker
gemeten. Het zijn metingen op de code, in de graden die `BESTUUR.md` voorschrijft
— `gemeten` waar het uit de router komt, `vermoed` waar het lexicaal is.
