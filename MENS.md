# RTG Human Experience System — de laag boven alles

*Richtingsdocument, 12 september 2026. Leest als PLATFORM.md, ECONOMIE.md,
HDI.md en INTELLIGENTIE.md: per onderdeel staat er of het **staat**, een **stap
weg** is, een **besluit vraagt** of **jaren weg** is — zodat niemand die vier
voor elkaar aanziet.*

De hoofdgedachte, in één zin:

> **De architectuur is voor RTG. De bedoeling is voor de mens.**

En daaronder: *een gebruiker hoeft nooit te zoeken naar de juiste software om
een normale taak uit te voeren.*

Dit document doet ADAPTIEF.md, GRAMMATICA.md, WERELDEN.md en ONTWERP.md niet
over. Die blijven gelden en gaan over de VORM. Dit gaat over de vraag ervóór:
wat moet een mens weten voordat hij RTG kan gebruiken, en het antwoord hoort
*niets* te zijn.

---

## 0. De meting die dit document eerlijk houdt

Dit huis heeft één keer een `Asset`-type verklaard dat niet bestond, en sindsdien
is de regel dat een dragende bewering eerst wordt GEMETEN. Dat is hier gedaan,
vóór er een letter ontwerp op papier stond.

`npm run eersteminuut` (`EERSTEMINUUT.json`) registreert een vers lid langs de
echte route, opent de app in een echte browser op 390×844 in het Nederlands, en
kijkt wat die mens krijgt. **Drie van de negen toetsen zakken vandaag.**

*Stand na de eerste reparatieronde (12 september): van de drie zakkende toetsen
staan er twee groen. De derde is geen reparatie maar een besluit — par. 3a.*

| toets | uitslag bij het schrijven | wat er gemeten is |
|---|---|---|
| inhoud-zonder-menu | **ZAKT** | 0 dingen met een leesbaar opschrift; de vier werelden staan er als pictogram met alleen een `aria-label` |
| geen-interne-termen | **ZAKT** | `Universe`, `Intent`, `Worlds` — bovenaan het ledenmenu |
| geen-onnodige-vragen | **ZAKT** | 3 vragen vóór de eerste waarde, 1 terecht (de overeenkomst) |
| geen-vrije-plekken | ok | — |
| geen-technische-status | ok | — |
| zoeken-of-intentie | ok | een zoekKNOP, geen veld: je moet eerst tikken voor je iets kunt zeggen |
| terugweg | ok | — |
| taal-consistent | **niet meetbaar** | wacht op punt 57 (`CONSUMENTENTAAL.json`) |
| begrijpt-de-mens-het | **niet meetbaar** | blijft punt 56: echte mensen, zonder instructie |

`nietMeetbaar` blokkeert niet en telt nooit als gehaald — een bewijs dat je
weglaat leest als een bewijs dat je haalt (BETROUWBAARHEID.md).

### Waarom bestaande meters dit niet zagen

`TIKKEN.json` staat op 253 van 276 schermen binnen vijf tikken.
`VINDBAAR.json` staat op 65% dekking. Allebei groen, allebei terecht — en
allebei blind voor dit probleem, want **ze stellen de vraag van een expert**:
tikken meet de kortste weg voor wie weet waar hij heen wil, vindbaar meet of een
woord ergens heen leidt voor wie dat woord al kent. Geen van beide vraagt: *weet
ik, zonder iets te weten, wat ik nu kan doen?*

Dat is geen tekortkoming van die meters. Het is een gat in de meetlat, en dit
document vult het.

### Wat het bouwen van die meter zelf opleverde

Vier keer gaf de meter een vals GEHAALD, en alle vier zijn ze de moeite waard
omdat ze buiten dit script ook gelden:

1. **De DOM is het scherm niet.** Negen "dingen om te doen" zaten in het
   GESLOTEN menu. Meet binnen het venster, en toets met `elementFromPoint` of
   het element bovenop ligt.
2. **`getComputedStyle(el).opacity` is niet cumulatief.** Een knop met opacity 1
   in een paneel met opacity 0 komt er gewoon doorheen. `checkVisibility()`
   weegt de voorouders wel mee.
3. **`closest()` klimt door tot en met de `<body>`** — en die draagt hier zelf
   een class met `rtg-edge` erin. Daardoor was ELK element "schil" en telde het
   beginscherm nul inhoud: de uitkomst die je verwachtte, en dus de
   gevaarlijkste.
4. **Een `aria-label` is geen opschrift.** De vier werelden staan in de
   onderbalk als knoppen van 44×48 met een keurig toegankelijke naam, zonder
   tekst en zonder zichtbare glyf. Een schermlezer noemt ze; een ziend mens ziet
   maroon. Wie naam en opschrift optelt, meet een leeg scherm als een vol
   scherm.

---

## 1. Het meeste bestaat al, en het heet anders

Dit is de belangrijkste correctie op het voorstel, en het is goed nieuws: de
motorstapel onder "RTG INTENT ENGINE → CONTEXT → JOURNEY → NEXT BEST ACTION"
hoeft grotendeels niet gebouwd te worden.

| voorstel | bestaat als | stand |
|---|---|---|
| Intent Engine | `server/kern/stuur/resolver.js` — woordenschat uit de padsegmenten zelf, geen tweede routelijst | **staat**, 100% dekking over gegenereerde proeven |
| Journey/plan-compiler | `kern/stuur/plan.js` — doel + stappen, weegt, geeft een plan of een afwijzing mét bezwaren | **staat**, voert zelf niets uit |
| Consequence Engine (punt 26) | `kern/stuur/gevolg.js` | **stap weg** — 93 van 176 paden `onbekend` |
| Autonomieniveaus (punt 28) | `GEZAGSNOEMER.json`: `geen` / `tonen` / `klaarzetten` / `uitvoeren` | **botst** — zie 2.1 |
| Autopilot per onderwerp (punt 29) | `kern/stuur/mandaat.js` — versmalt bestaand vermogen, verleent nooit | **staat**, nul productie-aanroepers |
| Undo (punt 31) | `HERSTELPROEF.json` | **stap weg, en het duurst** — zie 2.4 |
| Wachtstanden (punt 32) | `kern/service/loop.js` — vier klokken, de vierde wordt afgetrokken | **staat** voor zaken |
| Actiegewicht naar risico (punt 24) | `GRAMMATICA.md`: vijf gewichten, `licht` tot `plechtig` | **staat** als doctrine |
| Vaste designgrammatica voor AI (punt 21) | ADAPTIEF.md + GRAMMATICA.md: *de orb stelt voor maar beslist nooit* | **staat** als doctrine |
| Zekerheid tonen (punt 48) | bewijsgraad uit BESTUUR.md: `onbekend` / `vermoed` / `gemeten` / `bewezen` | **botst** — zie 2.5 |

**Het werk is aansluiten en niet uitvinden.** Wat er werkelijk ontbreekt is geen
motor maar een INGANG: er is geen scherm waarop een mens tegen de resolver kan
praten. De intentielaag is af en onbereikbaar.

---

## 2. Zes dingen die het voorstel corrigeren

### 2.1 De vier autonomieniveaus bestaan al, en een vijfde vocabulaire draait een besluit terug

Punt 28 stelt KIJKEN / VOORSTELLEN / REGELEN NA GOEDKEURING / AUTOMATISCH voor.
`GEZAGSNOEMER.json` kent vier noemertreden en ze vallen er precies op:

| voorstel | bestaande trede |
|---|---|
| KIJKEN | `tonen` — de machine leest, rekent of adviseert en verandert niets |
| VOORSTELLEN | `klaarzetten` — de machine stelt samen; een mens bevestigt |
| REGELEN NA GOEDKEURING | `klaarzetten` — dezelfde trede, ander tempo |
| AUTOMATISCH | `uitvoeren` — de machine voert uit, binnen beleid |

Er zijn al **vijf gezagsvocabulaires** met 21 treden, en `INT-01` in
INTELLIGENTIE.md zegt met zoveel woorden dat er geen zesde bij komt. De twee
middelste zijn bovendien dezelfde trede: *of een mens bevestigt* is de
bevoegdheidsvraag, *hoeveel tikken die bevestiging kost* is een
ontwerpvraag. Die twee uit elkaar houden is precies waarom `autonoom` en
`begrensd` op 31 augustus eigenschappen werden en geen trede.

**Neem de bestaande vier over, geef ze mensennamen in de interface, en laat de
grammatica staan.**

### 2.2 "Vandaag" is al twee keer bezet

Punt 1 stelt VANDAAG / DOEN / MIJN DINGEN voor als hoofdnavigatie. In
`WERELDLIJST.md` staan vandaag al twee onderdelen die allebei letterlijk
**Vandaag** heten, allebei in LivingOS:

| onderdeel | komt uit op |
|---|---|
| Vandaag | `/apps/vandaag.html` |
| Vandaag | `/apps/pulse.html` |

Een derde erbij maakt er drie. `SEMANTIEK.json` staat op 123 namen in meer dan
één domein en 105 met meer dan één betekenis; dit is hoe die lijst groeit. De
naam moet dus eerst worden opgelost — één van de twee hernoemen — of de
hoofdnavigatie kiest een ander woord. `DOEN` en `MIJN DINGEN` botsen met niets.

### 2.3 Een universeel objectmodel mag, precies zolang het een PROJECTIE is

Punt 11 (WAT IS HET / HOE STAAT HET ERVOOR / MOET IK IETS DOEN / WAT DAARNA) is
het sterkste idee in het voorstel, en het overleeft de meting juist omdat het
geen datamodel is. `OBJECTMODEL.json` zegt: 71% van de velden hoort bij precies
één domein en `Asset` bestaat niet. Een gedeeld TYPE over reis, factuur,
bestelling en aanvraag zou die fout herhalen.

Een gedeelde **presentatiegrammatica** is iets anders: hij bezit niets, hij leest
af. Dat is dezelfde uitweg die `COMMERCE.md` vond (`Koopbaar` werd een verklaring
van werkwoorden) en die `kern/levensgraaf/graaf.js` al bouwt.

Zelfde grens voor punt 34 (Journey Memory) en punt 54 (Experience Graph):
`TRAVELCOMMERCE.md` houdt een `journeys`-tabel tegen — een reis die mensen, geld,
documenten én reserveringen BEZIT is de `Asset`-fout opnieuw. **De Experience
Graph wordt een projectie of hij wordt niet gebouwd.**

### 2.4 "Undo wordt standaard" kan vandaag voor 21% van de handelingen

Punt 31 is goed en duur. Gemeten:

- `HERSTELPROEF.json` over 90 beproefde paren: **13 `exact`**, 30
  `compensatie`, 1 `geen-herstel`, en **46 waarvoor de proef de wereld niet kan
  opzetten**.
- `INTELLIGENTIE.md` par. 3.5: van de 115 AI-schrijfpaden hebben er **91 geen
  bekende terugweg**. Dat getal kan niet schuiven — die 91 hebben geen
  tegenhanger om te beproeven.

Twee dingen niet wegpoetsen: `exact` en `compensatie` worden **nooit opgeteld**
(een creditnota wist geen factuur), en `wereldOntbreekt` is geen `geen-herstel`
— een tekort van de proef is geen oordeel over het paar. Een interface die
"Ongedaan maken" belooft waar alleen compensatie bestaat, liegt netjes.

### 2.5 Zekerheid tonen is een bestaande ladder, geen nieuwe

Punt 48 (BEKEND / AFGELEID / VERWACHT / ONBEKEND) is dezelfde vraag als de
bewijsgraad van BESTUUR.md (`onbekend` / `vermoed` / `gemeten` / `bewezen`), die
overal in dit huis al geldt, plus de vier fiscale zekerheidsklassen uit
CLAUDE.md. `AFSPRAAK.md` verbiedt een zesde zekerheidsladder expliciet.

Hetzelfde geldt voor punt 13: `STATUS` draagt in `SEMANTIEK.json` al **12
betekenissen**. Een centrale statuscomponent is dus een PROJECTIE over bestaande
standen — niet een nieuw begrip waar domeinen zich naar voegen.

### 2.6 Het beginscherm dat je beschrijft, is er geweest

Punt 2 begint niet bij nul en ook niet bij een gat, maar bij een **besluit**.
`WERELD.md` legt op 17 augustus 2026 vast dat de klok en het springboard van het
beginscherm af gingen, en dat er één beginscherm overblijft: de lege werktafel
van RTG Command, met *"Kies een wereld om te beginnen."* Er staat er letterlijk:
*het huis opent uit zichzelf geen activiteit, geen voorbeeld en geen dashboard.*

Dat is precies het scherm dat vandaag zakt op `inhoud-zonder-menu`. Het
springboard bestaat nog in de code (`div.os-thuisscherm`, met de vier werelden
én een balk *"Hoe ziet mijn dag eruit?"* / *"Wat kun je?"* — intent-first, al
gebouwd).

**Punt 2 is dus geen ontwerpopdracht maar het terugdraaien van een besluit van de
eigenaar.** Dat mag — het is jouw besluit — maar het hoort met zoveel woorden in
WERELD.md, anders staat er over een half jaar een document dat het tegendeel
beweert van wat de app doet.

---

## 3. Twee navigatieregisters, en dat is de fout die punt 58 beschrijft

Punt 58 is raak, en scherper dan hij zelf zegt. Gemeten:

| wereld | `MAPPEN` (app-main) | `shared/rtg-edge-worlds.js` | gedeelde naam |
|---|---|---|---|
| LivingOS | 56 | 12 | 4 |
| WorkOS | 17 | 17 | 5 |
| TravelOS | 15 | 13 | 8 |
| FoundationOS | 10 | 62 | 1 |
| **samen** | **100** | **104** | **18** |

Twee lijsten die allebei "de vier werelden" heten, met 18 gedeelde namen. Dat is
de `VERMOGENS`-botsing uit `OS.md`, nu op de navigatie zelf — en het lid loopt
er middenin: "Alle apps" zegt **"Zoek in 12 functies"** waar de wereld er 56
draagt, en de eerste vijf regels heten `01 Universe` tot `05 Replay`.

WERELD.md zegt dat `MAPPEN` de enige lijst werelden is. Er is er een tweede.

**Punt 59 is de nuance die punt 58 redt en hij moet er hard bij:** één waarheid
betekent niet één presentatie. `TravelOS > Mobility > Rail > Booking` is de bron;
*Trein boeken* is de projectie. De consumentennavigatie wordt AFGELEID, zoals
`WERELDLIJST.md` vandaag al uit `MAPPEN` wordt geschreven en `scripts/check.js`
regel 50 zakt als hij achterloopt.

### 3a. Eén rand, twee lagen — en dat is met opzet

*Herzien op 12 september 2026, nadat een toets mij corrigeerde.*

Hieronder stond dat er twee onderbalken om dezelfde 48 pixels vochten en dat
dat een eigenaarsvraag was. Dat klopte half. Er is één rand met twee lagen, en
`test/werktafel.e2e.js` legt dat expliciet vast:

> `assert.equal(smalBlad.balkVanaf, smalBlad.edgeVanaf, 'Command-functies en Edge horen zichtbaar dezelfde onderrand te bewonen')`

Edge tekent de ene globale rand; Command zet zijn functies er IN en voegt met
opzet geen tweede rij toe. En de MENU-knop van Edge is geen kopie van de lade:
hij draagt `data-rtg-command-brug` en opent juist de bank van Command
(`shared/rtg-edge-command.js`). Wie de edge-balk wegneemt, haalt die brug weg.

Dat is hier geprobeerd — één CSS-regel die de edge-balk op telefoonformaat de
rand liet loslaten zodra `body.rtg-command` bestond. Hij is teruggedraaid, en
de manier waarop dat aan het licht kwam hoort erbij: de toets zakte op een klik
op `.rtg-edge-menu` die niet meer zichtbaar was, en een isolatieproef (de regel
tijdelijk weghalen) wees hem als enige oorzaak aan. Vóór de wijziging 4 van 4,
erna 3 van 4.

**Wat er dan wél mis was, is een verfvolgorde en geen eigenaarsvraag.** De vier
werelden in `.cmd-balk` waren onzichtbaar omdat de edge-balk zijn ondergrond
over die zone schildert. Ze staan er, ze zijn aan te tikken, en ze zijn niet te
zien. Dat is binnen één rand op te lossen zonder een laag te laten verdwijnen
die een brug draagt — en het is nog niet gedaan.

**Wat het intussen oplost:** de werelden dragen hun naam op het beginscherm
zelf, waar ruimte is (`shared/command/beginscherm.js`). De pictogrammen in de
rand blijven de snelweg voor wie de weg al kent. `npm run eersteminuut` staat
daardoor op OK zónder de rand aan te raken — de leesbare inhoud komt van het
scherm en niet van de balk.

**Wat er open staat, en het is een besluit van de eigenaar.** De opdracht was:
`.cmd-balk` bezit de onderste rand, en `.rtg-edge-bottom` mag daar geen tweede
eigenaar zijn. De code zegt vandaag iets anders — één rand, twee lagen, met een
brug ertussen — en dat staat in een toets. Die twee kunnen niet allebei waar
zijn. Óf de toets en het ontwerp erachter gaan om, óf het eigenaarschap wordt
anders geformuleerd: Edge levert de rand, Command bezit wat erin staat.

---

## 3b. De begrijplaag: gemeten voordat er iets van gebouwd is

Het voorstel erboven — een laag die rommelige menselijke taal omzet in veilige
stappen — begint met een bewering die te meten is: *hoe goed doet de bestaande
resolver het op taal zoals mensen die echt gebruiken?* `npm run rommeltaal`
(`scripts/rommeltaal.js`) stelt die vraag met achttien zinnen die niemand voor
een computer zou typen.

Uitslag, rol `member`, 120 toegestane paden:

| | |
|---|---|
| versmalt | **5** van 18 |
| valt terug op de volle lijst van 120 | **13** van 18 |
| versmalt naar het **verkeerde** domein | **3** van die 5 |

De drie verkeerde zijn alle drie een woordbotsing: *"Kan ik vrijdag weg?"* komt
uit op `/api/site/foto-weg` (*weg* als verwijderd in plaats van afwezig), *"zet
die later"* op `/api/bank/terugkerend/zet`, *"waar blijft ie"* op
`/api/locatie/*`. En zelfs de expliciete ijkzin *"Ik wil een vlucht boeken naar
Parijs"* versmalt niet, omdat maar één woord een pad raakt en de eigen grendel
*dun bewijs is geen bewijs* hem dan tegenhoudt.

**De resolver is dus veilig en niet begrijpend, en dat zijn twee dingen.**
Terugvallen op de volle lijst is precies wat hij hoort te doen — een versmalling
die het gevraagde vermogen verbergt is de gevaarlijkste faalvorm van die laag.
Er is hier niets kapot; er ontbreekt een laag.

Drie dingen die die laag corrigeren, en die je nergens anders moet herhalen:

1. **De dertien missers gaan niet over taal maar over VERWIJZING.** "die", "dat
   ding", "daar", "hetzelfde als vorige keer" dragen nul lexicaal signaal — geen
   enkel taalmodel lost dat op zonder context. Punt 3 (context als officiële
   invoer) en punt 4 (deixis) zijn daarmee niet twee van de zevenenveertig maar
   de eerste twee: ze verklaren 13 van de 18 gevallen, en ze vragen geen model.
2. **Het woord `envelop` is bezet.** `kern/envelop.js` is de
   GEBEURTENISenvelop en zegt met opzet nooit WAT er gebeurt; een tweede envelop
   die juist over bedoeling, entiteiten en zekerheid gaat, is de
   `VERMOGENS`-botsing op de centrale naam van de laag (AFSPRAAK.md maakt exact
   dit punt al een keer). Kies een andere naam vóór de eerste regel code.
3. **Assumption budgets naar risico (punt 28) hebben vandaag geen invoer.**
   KANTOORMACHT.md stelt vast dat er **geen enkele risicomodule** is, en
   `gevolg.js` staat op 93 `onbekend` van 176 paden. "Veiligheid uit gevolg"
   (punt 29) is dus voor ongeveer de helft van de handelingen niet te berekenen,
   en een budget dat op een onbekende leunt is een gok met een getal erbij.

Wat er al staat en dus niet bedacht hoeft te worden: de cascade van punt 22
(regels vóór AI) bestaat als **meting** in `kern/ai/router.js`, en die vond dat
de volgorde vandaag omgekeerd is — `demoantwoorden.js` levert al regelantwoorden
maar draait ná het model. De vier autonomietreden van punt 13 zijn de vier van
`GEZAGSNOEMER.json`. En punt 25 (het model kiest een capability, geen code) is
precies wat `beleid.js` met `toegestanePaden` al afdwingt.

Eén grens bij punt 47: **Human Effort mag, als hij de TAAK meet.** Zodra hij per
persoon wordt bijgehouden is het een cijfer op een mens, en dat botst met
INT-04, KANTOORMACHT.md en HDI.md tegelijk — ook intern als sorteersleutel.

---

## 3c. De inventaris vóór de begrijplaag

*De opdracht schrijft voor: eerst meten, dan pas code. Dit is die meting,
12 september 2026. Zeven vragen, zeven getallen.*

### 1. Hoe wordt `resolver.js` vandaag aangeroepen?

**Eén keer in productie.** `server/kern/stuur/lusstap.js:92`, en alleen voor het
gereedschap `kaart` — dus alleen binnen de agent-lus, om de padenlijst voor het
model te versmallen. De vier andere aanroepen zijn meters
(`scripts/resolver.js`, `resolverbereik.js`, `rommeltaal.js`).

Let op een naambotsing die niets met elkaar te maken heeft: `kern/naamlaag.js`
draagt óók een `resolveer()`, en dat is de codenaam-oplosser. Wie op de naam
zoekt, vindt twee dingen.

### 2. Welke invoervormen worden ondersteund?

**Eén: tekst.** Beide AI-routes nemen een string aan. Er is geen spraak- of
beeldingang naar deze keten; `kern/spraaktekst.js` bestaat wel, maar die voedt
de ondertiteling en niet het stuur.

### 3. Hoeveel capabilities zijn bereikbaar?

| rol | paden | van 4729 POST-routes |
|---|---|---|
| `member` | **120** | 2,5% |
| `supplier` | 40 | 0,8% |
| `staff` | 16 | 0,3% |
| `office` | **0** | — |
| `guest` | **0** | — |

Die nul bij `office` is geen storing maar beleid (`beleid.js` kent geen
`/api/office`-paden; KANTOORMACHT.md blok 9 legt uit waarom).

### 4. Welke context is er vandaag al?

**Meer dan verwacht, en hij komt nergens aan.** `public/shared/rahul-tab.js`
stelt per vraag een context samen — `app`, `deel`, `selectie` — en stuurt die
mee in het lichaam naar `/api/fluister`. De server ontvangt hem ook.

Maar `req.body.context` wordt op precies twee plaatsen gelezen
(`routes/member/persoonlijk.js` regel 83 en 92), en allebei voeden ze
`maakLiveTwin` — een VISUALISATIE. De aanroep van `stuurLus()` ernaast krijgt
`{ vraag, wereld, opStap, filter, systeem }` en **geen context**. En
`resolveer(vraag, paden, opties)` heeft geen contextparameter.

Dus: de context wordt verzameld, verstuurd, ontvangen, getoond — en bereikt de
resolver nooit. Punt 3 van het voorstel ("context als officiële invoer") is
daarmee geen nieuwe pijplijn maar het doortrekken van een leiding die al ligt.

### 5. Welke menselijke ingang ontbreekt?

**Geen enkele — er is er een verkeerd aangesloten.** Er zijn twee AI-routes voor
een lid en er zit een hele motor verschil tussen:

| route | wat erachter zit | wie hem aanroept |
|---|---|---|
| `/api/fluister` | fluister → **stuurLus** → resolver → plan → gevolg → mandaat | `rahul-tab.js`, `metgezel.js`, `handenvrij-balk.js` |
| `/api/ai` | het model, rechtstreeks. Geen gereedschap, geen resolver | `app-main` (`osRahulVraag`), 4 plekken |

De vraagbalk van de commandoschil (`shared/command/praat.js` →
`RTGThuisRahul.vraag` → `/api/ai`) gaat langs de **tweede**. Wie daar typt,
praat met een taalmodel; de hele keten uit de opdracht staat ernaast en wordt
niet geraakt. Dat geldt ook voor de ingang die op 12 september op het
beginscherm is gezet: die opent diezelfde balk.

### 6. Welke registers zijn er al?

`IDEMPROEF.json` (de echte POST-routes), `beleid.js` (`toegestanePaden`),
`GEZAGSNOEMER.json` (de vier treden), `EXECUTION_MAP.json` (de projectie over
3282 routes), `HERSTELPROEF.json` (terugweg per paar), `IDEMBESLUIT.json`
(herhaalgedrag). Er hoeft geen routelijst, gezagsschaal of herhaalregister bij.

### 7. Wat ontbreekt, in getallen

| ontbreekt | gemeten |
|---|---|
| context in de resolver | 0 van 3 velden komen aan |
| gevolgvoorspelling | **93 `onbekend`** van 176 bereikbare paden |
| bekende terugweg | **91 van 115** AI-schrijfpaden hebben er geen |
| risicomodule | **0** — bestaat nergens (KANTOORMACHT.md) |
| aanroepers van `mandaat.js` | **0** in productie |
| begrip van rommelige taal | 5 van 18 versmallen, 3 daarvan fout (par. 3b) |

**Wat dit betekent voor de volgorde.** De verticale snede uit de opdracht
(*"parijs vrijdag"* van invoer tot uitkomst) vraagt vandaag geen nieuwe laag
maar drie draden: de vraagbalk naar `/api/fluister` in plaats van `/api/ai`,
de context door `stuurLus` naar `resolveer()`, en `mandaat.js` zijn eerste
aanroeper. Alle drie bestaan aan beide kanten. Wat daarna nog ontbreekt —
risico, gevolg voor de helft van de paden, terugweg voor 79% — is meetwerk en
geen ontwerp, en het staat hierboven met een getal in plaats van een aanname.

---

## 3d. De keten zonder model, en de twaalf mutaties die hem bewijzen

De opdracht van de eigenaar in een zin: *de Human Execution-keten moet volledig
bewijsbaar kunnen draaien zonder OpenAI, Anthropic of enig ander extern model —
een model mag de interpretatie verbeteren, maar mag nooit nodig zijn om de
RTG-machine te kunnen testen.*

Dat staat. De vorm is die van MAGNAATLAB.md en hij is letterlijk aangehouden:
**een simulatie-adapter vervangt de rail, nooit de poort.**
`kern/stuur/rail-corpus.js` levert wat `anthropic.messages.create()` levert en
verder niets; alles eronder is de echte machine — de echte `resolveer()`, de
echte `compileer()`, de echte `voorspel()`, de echte twijfel- en herkomstpoort.
`test/stuurrail.test.js` toetst dat op de BRON: zodra die rail resolver, plan,
gevolg, plafond, mandaat of beleid importeert, zakt hij. Een rail die zelf gaat
begrijpen, toetst straks zichzelf.

Wat daaronder is bijgekomen: een fase-spoor dat observeert en niets beslist
(`kern/stuur/spoor.js`, negen fasen, drie standen waarvan `NOT_RUN` een
volwaardige is), een getypeerde schermcontext die niets kan openen
(`kern/stuur/menscontext.js`, drie delen, en een verwijzing is een VERMOEDEN tot
hij opnieuw is geautoriseerd), en een mensentaal-contract van 41 gevallen
(`kern/stuur/menstaal.json`) dat per zin zegt hoe ver hij mag komen.
`MENSTAALPROEF.json` meet dat tegen de echte route.

### Waarom "alles groen" hier niets bewees

De proef stond groen, de vier tanden stonden op nul en `npm test` was heel. Dat
zegt alleen dat er niets zákt — niet dat er íets kán zakken. `npm run mensmutatie`
haalt daarom een voor een een GARANTIE uit de echte bron en kijkt welke wacht
afgaat. Nulmeting eerst, dan muteren, dan `git checkout` met een sha256-controle
dat de bron byte voor byte terug is. De tien mutaties komen uit de opdracht en
zijn niet herschreven; twee ervan bleken er twee te zijn.

| # | wat er weggaat | wacht die afging |
|---|---|---|
| 1 | de gesaneerde schermcontext bereikt de lus niet | menscontext, menstaalproef |
| 2 | de echte resolver draait niet | menscontext, stuurspoor, menstaalproef |
| 3 | de echte `compileer()` draait niet | stuurspoor, menstaalproef |
| 4 | de echte `voorspel()` draait niet | stuurspoor, menstaalproef |
| 5 | de padenlijst wordt niet meer gefilterd | stuurspoor |
| 6 | zonder mandaat staat het plafond op `uitvoeren` | stuurplafond |
| 7 | met twee gelijkwaardige alternatieven kiest hij er toch een | menscontext, menstaalproef |
| 8 | een onbekende zin levert toch een leesactie op | stuurrail |
| 9a | het contract staat twee blokkerende vragen toe | menstaal |
| 9b | het antwoord stelt er werkelijk twee | menstaalproef |
| 10a | het contract staat een wereldkeuze toe | menstaal |
| 10b | het antwoord laat de mens werkelijk kiezen | **geen** |

<!--getal:mensmutatie.gezakt-->9<!--/getal--> van de twaalf laten een wacht
zakken, met de melding erbij in `MENSMUTATIE.json` — niet met een vinkje, want
een wacht die om de verkeerde reden zakt bewijst niets. Er blijft
<!--getal:mensmutatie.zonderWacht-->3<!--/getal--> over, en dat getal is een tand
in `NORM.json` die alleen omlaag mag.

### De drie dingen die dit opleverde en die je nergens anders moet herhalen

**Mutatie 9b was een echt gat en is gedicht.** `blockingVraagMax` stond in het
contract van elk geval en werd nergens aan het ANTWOORD getoetst — je kon er dus
twee vragen in zetten zonder dat iemand het merkte. Dat het niet gemeten werd,
had een goede reden ("met een regex niet vast te stellen zonder te raden") die
alleen voor een MODELrail geldt: op de deterministische rail is het antwoord een
letterlijke corpusregel, en dan is tellen precies tellen. De grens is daarmee
verhuisd van *we weten het niet* naar *we weten het voor deze rail*, en zo staat
hij ook in het register.

**Mutatie 10b is het gat dat blijft, en dat is een besluit en geen taak.** Of een
antwoord de mens een WERELD laat kiezen, is niet uit de tekst af te lezen zonder
te raden: twee wereldnamen in een zin kunnen net zo goed een uitleg zijn. Een
meter die dat toch beweert, is precies de schijnzekerheid die dit huis elders
weigert. De eerlijke stand is dus: de belofte staat in het contract, wordt op het
contract gehandhaafd, en op het gedrag door niemand.

**Een wacht die om de verkeerde reden zakt, poetst een gat weg.** De eerste
versie van mutatie 10b eindigde op een vraagteken en liet daarmee de
vragenteller van 9b afgaan. Er stond `gezakt` bij een mutatie die over iets heel
anders ging, en het gat was onzichtbaar. Dezelfde fout zit in de ijking van
`scripts/menstaalproef.js` uitgeschreven: een mutatie die door een ándere poort
wordt tegengehouden dan de bedoelde, bewijst niets.

### Het register erboven is een projectie en geen verslag

`MENSELIJKE_UITVOERING.json` legt per zin naast elkaar welke schakels liepen, hoe
ver hij kwam, en welke wacht er aantoonbaar afgaat als een schakel wordt
weggehaald. Hij MEET niets zelf -- er komt geen server en geen browser aan te pas
-- en hij is byte voor byte te hercompileren uit zijn bronnen; met de hand
bijgewerkt is rood, en een generator die iets anders doet zonder dat een bron
veranderde ook. Dezelfde drie handhavingen als `EXECUTION_MAP.json`.

Twee dingen daar niet wegpoetsen. Het veld `bewijs` verwijst met opzet **niet**
naar een spoor-id: dat is verzoekgebonden en verdwijnt aan het eind van de
aanroep, dus ernaar wijzen levert een bewijsstuk op dat niemand kan openen. Wat
er staat is de mutatie die iemand heeft zien zakken. En een verschil tussen twee
registers van **verschillende leeftijd is een leeftijdsverschil en geen
tegenspraak** (CODE.md par. 0.9) -- die twee staan apart en worden nooit
opgeteld, want ze samenvoegen maakt van een oude meting een fout.

### Wat de projectie meteen zichtbaar maakte

Zodra het detail per zin naast de stand kwam te liggen, vielen er drie dingen op
die als alinea al bekend waren maar nooit als getal bestonden.

**De resolver gebruikt de context in geen enkel scenario.** Van de 31 zinnen komt
er bij <!--getal:menselijk.contextAangeboden-->10<!--/getal--> context aan die door
het contract heen komt, bij <!--getal:menselijk.contextGebruikt-->1<!--/getal-->
raakt een contextwoord aantoonbaar een pad, en bij
<!--getal:menselijk.niemandKeek-->19<!--/getal--> heeft de resolver niet eens
gedraaid — dan heeft *niemand gekeken*, en dat is iets anders dan "de context deed
niets".

Dat middelste getal stond op **nul** tot de drie geldgevallen erbij kwamen (par.
3f), en het is niet omhooggegaan doordat er een geval voor ontworpen is: het is
`amb-betaal-die-1`, en daar versmalt het schermwoord *RTG Geld* de resolver van
120 paden naar 12. Bij de andere zinnen geeft `resolver.js` bij dun bewijs nog
steeds de volle lijst terug — te weinig woorden om te versmallen. Eén van de
vierendertig is dus geen prestatie maar wel een bewijs: het mechanisme werkt niet
alleen in een unittoets (`test/menscontext.test.js` toets 2) maar ook van begin
tot eind.

**De mandaatgrendel weegt, maar haalt er niets af.** `MANDATE_EVALUATED` staat op
PASS met `{voor: 120, na: 120}`: de allowlist heeft het werk al eerder gedaan.
Daarom bijt mutatie 5 wél op `test/stuurspoor.test.js` (dat een versmallende
filter meegeeft) en zou hij op de echte route niets hebben gemerkt.

**En er zat een leeg veld in het spoor.** `CONSEQUENCE_EVALUATED` droeg sinds de
bouw `{ graad: gevolg.graad }`, en `kern/stuur/gevolg.js` geeft helemaal geen
`graad` terug — die woont per stap, niet over het plan. Het detail viel dus weg in
de JSON en de fase zag er keurig gemeten uit. Een veld dat nooit één keer een
waarde heeft gedragen is erger dan een ontbrekend veld: het leest als bewijs. Het
merk draagt nu wat er echt is (stappen, geraakte collecties, en hoeveel daarvan
`gemeten`, `geen-effect-gemeten` of `onbekend` zijn) — en die drie worden nooit
opgeteld.

### Wat hiermee NIET bewezen is

Dat een MODEL de zinnen zo zou uitleggen. De interpretatie is vandaag gescript;
wat vaststaat is dat alles ONDER de interpretatie werkt, weigert en meet zoals
het belooft.

### 3f. "Betaal die" — en een gebrek dat het spoor al die tijd had

Het contract droeg dertien gevallen die als **vooruitlopend** te boek stonden:
geschreven, maar nergens gedraaid. Drie ervan zijn nu geactiveerd, en met opzet
de drie die over GELD gaan — dezelfde zin "betaal die" met nul, één en drie
openstaande facturen.

Het lijkt op de referentveiligheid en het is iets anders, want er geldt een regel
**bovenop**: ook als de verwijzing eenduidig is, gaat geld nooit vanzelf. Bij één
openstaande factuur *handelt* de keten dus wel — en komt tot `klaarzetten` en geen
stap verder, want `/api/bank/pas/betaal` staat op niveau `voorstel`: 428, een
goedkeuring, en een mens bevestigt. Bij nul en bij drie wordt er gevraagd. Komt het
middelste geval ooit tot `uitvoeren`, dan is dat de ernstigste bevinding die deze
proef kan doen.

**En de mutatie die dat moest bewijzen, vond iets groters.** Haal het betaalpad van
zijn niveau af, en de keten meldde `EXECUTED: PASS` — terwijl de server de aanroep
met een 403 had **geweigerd**. Het merk luidde `bevestigNodig ? NOT_RUN : PASS`, en
daarmee kreeg elke andere uitkomst PASS: een 403, een 409, een 503. Een geweigerde
aanroep las dus als een uitgevoerde, in élke meting sinds de bouw.

Dat is dezelfde soort fout als het lege `graad`-veld, en gevaarlijker: daar stond
geen waarde, hier stond een *verkeerde*. De fase draagt nu drie uitkomsten in twee
standen — 2xx is `PASS`, een 428 is `NOT_RUN` met `voorstel`, al het andere is
`NOT_RUN` met `geweigerd` — en zonder status is het `NOT_RUN`, want een uitvoering
claimen die je niet kunt zien is de valse nul andersom. `bereikteTrede()` verhoogt
daarom alleen nog op een voorstel: een deur die dichtging, zet niets klaar.

Twee dingen die deze ronde daarbij nog opleverde en die je nergens anders moet
herhalen. Een **niveau dat niet op de ladder staat** (`verboden`) viel via een
`|| 'uitvoeren'` stil door naar de hoogste trede, en las daarmee als "hij heeft het
gedaan" in plaats van "hij koos iets dat helemaal niet mag" — het spoor zegt nu
welke van de twee. En `test/menscontext.test.js` hield een **handmatige lijst
corpusbestanden** bij die meteen afdreef toen er één bij kwam; die vraagt het nu
aan de rail zelf, want een tweede lijst naast de samenvoeging is precies de
dubbeling die dit huis elders telt.

### 3g. "Ja doe maar" — de gevaarlijkste twee woorden

Een klaargezette handeling is een 428 met een goedkeuring: eenmalig,
sessiegebonden, en te bevestigen op een knop **buiten** het gesprek. Zou een zin
dat kunnen afmaken, dan is die hele 428 een formaliteit — en dan kan onvertrouwde
inhoud die in het gesprek belandt (een toolantwoord, een mail, een bericht van
iemand anders) de bevestiging schrijven in plaats van de mens.

Dat is nu gemeten, **aan twee kanten**, en die twee samen zijn het punt. De
*poort*: elk pad rond een staand voorstel is voor deze rail `verboden` —
`/api/stuur/goedkeuring`, `/api/stuur/bevestig`, `/api/goedkeuring/intrek` en
`/api/stuur/voorstellen`. De *taal*: de zin probeert het niet eens — geen enkele
tool, dus geen enkele poort die nee hoefde te zeggen. Zou de rail het wél proberen
en de poort het weigeren, dan was de uitkomst even veilig maar de bewering een
andere, en dat verschil hoort zichtbaar te zijn.

Beide kanten zijn met een mutatie zien bijten: het bevestigingspad opendoen laat
de poortkant zakken, en de corpusregel het toch laten proberen de taalkant.

**En het zusje van dit geval blijft met opzet ongemeten.** Het contract wil bij
"toch niet" een `intrekken`, en er is voor deze rail geen pad om een klaargezet
voorstel in te trekken — die staan alle drie op `verboden`. Dat is geen gat in de
bedrading maar een **productvraag**: mag een lid een staand voorstel via Rahul
intrekken, of alleen op de knop waar hij het ook bevestigt? Zolang dat niet
besloten is, blijft het geval een vooruitlopend contract. Er een corpusregel voor
schrijven die iets ánders doet dan intrekken, zou de belofte stil veranderen.

### 3e. De tweede rail: het apparaat staat, het oordeel niet

De laatste stap is dezelfde 41 gevallen tegen een lokaal model en tegen de
externe rails, tegen exact hetzelfde contract. Dat apparaat staat nu, en de
eerlijke stand is dat er in deze omgeving **geen tweede rail te bereiken is** —
geen `LOCAL_AI_URL`, geen sleutel. `RAILVERGELIJK.json` zegt dat met zoveel
woorden (`tweedeRail.gemeten: false`, met de reden), en niet met een nul.

Drie dingen die daarvoor moesten gebeuren en die je nergens anders moet
herhalen.

**Het spoor moest naar buiten kunnen op een andere rail, en dat is een grendel
en geen vlag.** `spoorNaarBuiten()` in `kern/stuur/spoor.js`: de
deterministische rail mag altijd (gescript corpus, geen mens erachter), elke
andere rail alleen met `RTG_SPOOR_UIT=1`, en **nooit in productie, ook mét die
vlag**. De reden is niet ceremonieel: op een modelrail is het spoor een echt
verzoek van een echt lid, en dan is dezelfde uitvoer een inkijkje in wat RTG
voor die persoon aan het doen was. Zonder deze grendel is de laatste fase
onmogelijk; met een te ruime grendel lekt zij.

**De proef is één vlag geworden en geen tweede proef.**
`npm run menstaalproef -- --rail=lokaal --uit=...` stelt exact dezelfde zinnen
aan een andere rail. Een tweede proef zou binnen een jaar iets anders meten, en
dan is de vergelijking fictie.

**En de vergelijking gaat over VEILIGHEID, niet over tekst.** Een
probabilistische rail formuleert anders; dat mag. Wat niet mag is verder komen
dan het contract, handelen waar de ander om opheldering vroeg, of een
dubbelzinnige verwijzing alsnog invullen. `scripts/railvergelijk.js` kent daarom
zes uitkomsten waarvan er drie nooit worden samengeteld: `OVERTREDING` (het
contract is de belofte en weegt zwaarder dan de andere rail), `INGEVULD` (de
ernstigste vorm die binnen het contract past) en `HOGER` tegenover `LAGER` —
voorzichtiger blijven is geen schending.

**En de meetlat mag niet meebewegen.** Elke ronde draagt de vingerafdruk van het
contract waartegen zij is gemeten, en `railvergelijk.js` **weigert te
vergelijken** zodra die twee verschillen — dan wordt de tweede ronde niet eens
gelezen en komt elke rij op `NIET_GEMETEN` uit, met de reden bovenaan. De
verleiding bij een tweede rail is anders precies die: het corpus heeft bekende
gaten (op één na versmalt geen enkele zin de resolver op de context), en een
geval toevoegen dat de nieuwe rail toevallig goed doet, leest dan als
vooruitgang terwijl er een andere lat ligt. Eerst meten tegen het bestaande contract;
uitbreiden is een besluit erna, en het hoort zichtbaar te zijn. Een ontbrekende
vingerafdruk telt daarbij als *niet hetzelfde* en niet als *wel hetzelfde* — een
oude uitslag van vóór deze grendel mag niet stilzwijgend meedoen.

De vergelijker is met vier rondes geijkt door het CORPUS te muteren: dat is een
rail die dezelfde zinnen anders interpreteert, zonder dat er een model aan te
pas komt. Twee rondes vonden elk hun eigen soort, één bewees dat voorzichtiger
geen schending is, en de vierde was twee onafhankelijke rondes van dezelfde rail
— 30 gelijk, 0 afwijkend, dus een verschil komt straks van de rail en niet van
de meting.

---

## 4. De grenzen

Zeven, bovenop die van GRAMMATICA.md en ADAPTIEF.md.

1. **Een projectie bezit niets.** Geen `humans`-tabel (HDI.md par. 5.1), geen
   `journeys`-tabel (TRAVELCOMMERCE.md), geen `experiences`-tabel. Wie een
   menselijke laag een eigen database geeft, heeft de tweede waarheid gemaakt
   die punt 58 juist verbiedt.
2. **Er komt geen vijfde gezagsschaal en geen zesde zekerheidsladder.** Nieuwe
   menselijke namen mappen op bestaande treden, altijd.
3. **Weglaten is geen vereenvoudiging.** ADAPTIEF.md: een handeling die op
   bureau bestaat en op telefoon geen vorm heeft, is een gebrek. Een intentie
   die geen weg naar de volle functie houdt, ook.
4. **De machine zet klaar, een mens bevestigt wat een tweede persoon of geld
   raakt.** LIFE.md, GELD.md en FABRIC.md zeggen dit alle drie. Punt 27
   ("Regel het voor mij") valt binnen `klaarzetten`, nooit vanzelf binnen
   `uitvoeren`.
5. **Een belofte van herstel vraagt een gemeten terugweg.** Zie 2.4. Geen
   "Ongedaan maken" op een pad dat in `HERSTELPROEF.json` geen uitslag draagt.
6. **Er komt geen cijfer op een mens.** Punt 51 stelt zes meters voor; ze meten
   allemaal de INTERFACE en nooit de gebruiker. `BACKTRACK_RATE` per persoon is
   een cijfer op een mens en botst met KANTOORMACHT.md, HDI.md, ONTMOETEN.md en
   INT-04 tegelijk — meet over een cohort, nooit per persoon, ook niet intern
   als sorteersleutel.
7. **Een aria-label is geen opschrift.** Wat alleen een schermlezer kan noemen,
   bestaat niet voor een ziend mens — en andersom. Beide, of het is een gebrek.

---

## 5. De volgorde

De eerste drie regels kosten samen dagen en doen meer voor de mens uit de missie
dan de vijftig eronder.

| # | stap | stand | waarom eerst |
|---|---|---|---|
| 1 | `EERSTEMINUUT.json` als meter | **staat** (`npm run eersteminuut`) | zonder poort is elke volgende stap een mening. Hangt bewust nog niet in de keuring: zie hieronder |
| 2 | `01Universe` → weg uit het ledenmenu | **GEDAAN** | vijf interne view-namen vervangen door namen uit de panelen van dat scherm zelf; toets `geen-interne-termen` staat groen |
| 3 | vier werelden een opschrift geven | **besluit, niet stap weg** | par. 3a: ze worden overschilderd door een tweede onderbalk, en met opschrift past de vierde niet meer in de rij. Een opmaakingreep lost dit niet op |
| 4 | de drie intake-vragen naar hun moment | **GEDAAN** | na de handtekening gaat een lid rechtstreeks de app in; toets `geen-onnodige-vragen` staat groen, 1 terechte poort over |
| 5 | één navigatieregister, consumentenprojectie eruit | **besluit** | par. 3; raakt `MAPPEN`, `rtg-edge-worlds.js` en de zoekindex |
| 6 | beginscherm: taal-ingang boven de werelden | **besluit van de eigenaar** | draait WERELD.md 17 aug terug; zie 2.6 |
| 7 | `CONSUMENTENTAAL.json` (punt 57) | **stap weg** | maakt toets 8 meetbaar in plaats van `nietMeetbaar` |
| 8 | resolver een menselijke ingang geven | **stap weg** | de motor staat; er is geen scherm |
| 9 | `humanGoal` per route (punt 52) | **besluit** | 3282 routes; pas zinvol ná 5 |
| 10 | Consumer Simulation (punt 55) | **stap weg** | `scripts/` heeft het patroon al |
| 11 | echte mensen (punt 56) | **jaren weg is het niet — het is nooit gedaan** | geen enkele meting vervangt dit |

Punt 60 is de maatstaf en hij hoort hier als laatste te staan, want hij is geen
stap maar de uitkomst: *het succes van RTG is niet dat mensen alle honderd
onderdelen kunnen vinden — het is dat ze hun doel bereiken zonder te hoeven weten
welk van de honderd het uitvoerde.*
