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

| toets | uitslag | wat er gemeten is |
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
| 1 | `EERSTEMINUUT.json` in de keuring | **staat** (`npm run eersteminuut:controle`) | zonder poort is elke volgende stap een mening |
| 2 | `01Universe` → weg uit het ledenmenu | **stap weg** | drie interne termen, één bestand, direct meetbaar |
| 3 | vier werelden een opschrift geven | **stap weg** | ze staan er al; ze zijn alleen onzichtbaar |
| 4 | de drie intake-vragen naar hun moment | **stap weg** | punt 6/7: vragen wanneer het antwoord nodig is |
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
