# RTG Exchange

> **Een marktplaats zet iets online en wacht. Een exchange draagt iets veilig over.**

Dit bestand hoort bij `PLATFORM.md` zoals `UITVOEREND.md` en `APPSTORE.md` dat
doen. `LAT.md` zegt hoe er geschreven wordt, `WAARDE.md` wat geld hier is,
`GELD.md` waar de grens van de automatisering ligt. Dit zegt waar het handelen
tussen mensen heen gaat.

Zoals elk richtingsdocument in dit huis staat alles hieronder in vier bakken:
**staat**, **een stap weg**, **een besluit nodig**, **jaren weg**. Wat in de
laatste twee bakken staat, hoort nergens als knop op een scherm te verschijnen.

---

## 0. De herformulering, en waarom dit geen leeg veld is

Het voorstel is om niet "een betere Marktplaats" te bouwen maar een
**trust-first commerce network**: veiligheid als bodem in plaats van als optie,
en bijna alle wrijving uit kopen en verkopen weg.

**Dat begint niet bij nul, en dat is de belangrijkste vaststelling van dit
document.** `server/kern/markt.js` bestaat, draait, en draagt al vier pijlers:
een verkopersbadge (geverifieerd / zaak / gezin), oplichtingsdetectie
(te-mooi-om-waar-prijs, betalen-vooraf, contact buiten de app), een verbodslijst
voor waren die hier niet horen, melden en blokkeren met een drempel, en
AI-hulp die een omschrijving schrijft en een prijs voorstelt. Kinderprofielen
mogen niet verkopen.

Er zit zelfs een veiligheidsmaatregel in die de meeste marktplaatsen níét
hebben: **betalen kan pas als koper en verkoper fysiek bij elkaar zijn** — beide
delen hun locatie, en pas dan gaat de knop open (`kern/markt/handel/deal.js`).

De vraag is dus niet "hoe bouwen we een marktplaats" maar **"wat moet erbij om
van een marktplaats een exchange te maken"**. Dat is een kortere lijst, en hij
begint met iets anders dan het voorstel verwacht.

---

## 1. Wat er vandaag staat, gemeten

| bouwsteen | stand | waar |
|---|---|---|
| Advertenties, categorieën, zoeken, filteren | **staat** | `kern/markt.js`, `kern/markt/regels.js` |
| Verkopersbadge (geverifieerd / zaak / gezin) | **staat** | `kern/markt.js` |
| Oplichtingsdetectie op tekst en prijs | **staat** | `kern/markt/toezicht.js` |
| Verboden waren, kwetsende taal, huisregels | **staat** | `kern/markt/regels.js` |
| Melden en blokkeren (drie meldingen = verborgen) | **staat** | `kern/markt/toezicht.js` |
| Chat per advertentie, met een postvak | **staat** | `kern/markt/handel/chat.js` |
| Prijs afspreken (een voorstel over en weer) | **staat** | `kern/markt/handel/deal.js` |
| **Samen-zijn vóór betaling** (beide GPS) | **staat** | `kern/markt/handel/deal.js` |
| AI schrijft de advertentie en stelt een prijs voor | **staat** | `kern/markt/toezicht.js` |
| Privacy op codenaam | **staat** | het hele huis |
| Betalen | **staat, maar zie par. 2** | `server/betaal.js` |

En wat er níét staat, ook gemeten: **geen escrow** (nul treffers), **geen
veiling** in de markt, **geen productpas of serienummerregister**, **geen
eigendomsoverdracht**, **geen fraudegraaf over accounts en apparaten**.

---

## 2. De vondst die de volgorde bepaalt

> **Er staat in de hele marktboom geen enkele geldbeweging naar de verkoper.**

Gemeten: `grep` over `kern/markt.js` en `kern/markt/` op elke vorm van uitbetalen,
boeken of doorsturen levert **nul** treffers. Wat er gebeurt bij `dealBetaal`:

1. de koper wordt afgeschreven via de betaalprovider (`betaal.maakBetaling`);
2. de advertentie gaat op *verkocht*;
3. er komt een systeemregel in de chat;
4. de verkoper krijgt **een melding** dat er is betaald.

Het geld landt dus bij de merchantrekening van RTG en blijft daar. Er is geen
vrijgave, geen uitbetaling, en geen enkele plek waar de verkoper zijn geld
krijgt. Dat is niet "escrow zonder naam" — escrow heeft een vrijgavemoment, en
dat bestaat hier niet.

**Waarom dit vóór alle tien de punten uit het voorstel komt.** Een
trust-first-netwerk bouwen bovenop een keten waar het geld niet aankomt, is een
huis bouwen op een leiding die nergens uitkomt. Elk punt hieronder — escrow,
Instant Trade, veiling, OneTap — maakt dit erger in plaats van beter, want ze
verhogen allemaal het bedrag dat door die keten gaat.

Dit hoort te worden nagelopen door iemand die weet hoe de markt in productie is
bedoeld. Twee mogelijkheden, en ze vragen een heel ander antwoord: **(a)** de
markt is nooit live geweest en dit is een demo-stand — dan hoort er een
schakelaar op te zitten die dat zegt; **(b)** hij is wél bedoeld voor gebruik —
dan is dit een geldstroom die niet aankomt, en dat is de ernstigste soort fout
die dit huis kent.

---

## 3. De tien punten, per stuk in een bak

| # | uit het voorstel | bak | wat het vraagt |
|---|---|---|---|
| 5 | Privacy by design (geen adres, geen telefoonnummer) | **staat** | het codenaam-ontwerp doet dit al |
| 1 | Veiligheid standaard | **deels staat** | badge, scamdetectie en melden staan; risicoscore, apparaatherkomst en transactietijdlijn niet |
| 6 | Camera → scan → publiceren | **een stap weg** | de AI-hulp schrijft en prijst al; wat ontbreekt is de camera-ingang |
| 2 | **Escrow als basislaag** | **een besluit nodig** | zie 4.1 — dit is geen functie maar een vergunningsvraag |
| 3 | Proof of item (productpas) | **een besluit nodig** | zie 4.3 — wie tekent ervoor dat de foto's echt zijn? |
| 7 | Instant Trade (direct kopen) | **een besluit nodig** | RTG die zelf koopt is een handelaar met voorraad en risico; dat is een bedrijfsbesluit |
| 9 | Deal Room die onderhandelt | **een besluit nodig** | zie 4.2 — mag binnen grenzen, maar bevestigen doet de mens |
| 4 | Realtime fraudegraaf | **een besluit nodig** | zie 4.4 — botst frontaal met het codenaam-ontwerp |
| 8 | Universal Product Identity | **jaren weg** | zie 4.5 — moet gemeten worden, niet verklaard |
| 10 | OneTap Trade | **jaren weg** | de som van alle bovenstaande; een knop is het laatste wat je bouwt |

---

## 4. Waar het voorstel en het huis botsen

### 4.1 Escrow is geen functie maar een vergunningsvraag

Dit is de scherpste botsing in het hele voorstel, en hij staat al in `CLAUDE.md`.

Geld van een ander aanhouden en later vrijgeven **is** een betaaldienst. Dit huis
heeft die redenering al één keer helemaal doorlopen voor het walletsaldo:
`kern/bevoegdheid/lijst.js` laat zien dat `WALLET_SALDO` jarenlang een *besluit*
was ("beperkt netwerk"), op drie voorwaarden — alleen binnen RTG te besteden,
niet uitbetaald aan het lid, en met plafonds — mét een vervalclausule: verandert
één van die drie, dan verandert de bevoegdheid mee.

Escrow breekt alle drie tegelijk. Het geld is van een ander, het gaat naar een
ander, en er zit geen plafond op. Wie escrow bouwt zonder de bevoegdheidsvraag
mee te bewegen, bouwt precies het pad om de vergunningplicht heen waar `CLAUDE.md`
voor waarschuwt.

**Wat dat niet betekent:** dat het niet kan. Het betekent dat de eerste stap geen
code is. De uitweg die dit huis elders al kent, is een derde partij die de
bevoegdheid wél heeft en die het geld aanhoudt — zoals de betaalprovider dat nu
al doet voor de inkomende kant.

### 4.2 De Deal Room mag klaarzetten, niet afspreken

Het voorstel zegt het zelf goed: *"RTG neemt nooit zelfstandig een financieel
besluit buiten expliciet ingestelde grenzen."* Dat is precies de regel van
`GELD.md` par. 3 en van `LIFE.md`: alles wat een tweede persoon raakt wordt
**klaargezet**, en bevestigen doet de mens.

De concrete vorm die daaruit volgt: RTG mag binnen de grenzen van beide partijen
een prijs **voorstellen** en de afspraak **klaarzetten** — en beide mensen tikken
hem aan. "€1.450 overeengekomen" verschijnt dus niet als mededeling maar als
voorstel met twee handtekeningen eronder. Het scheelt de vijftien berichten
waarover het voorstel terecht klaagt, zonder dat er iemand aan een afspraak vast
zit die hij niet heeft gemaakt.

### 4.3 Een productpas is een bewering, en beweringen hebben een bron

`BESTUUR.md`: elke bewering draagt haar bewijsgraad. Een productpas die zegt
"authenticiteit ✓" is de zwaarste bewering die dit huis ooit zou doen over iets
wat het niet in handen heeft gehad.

Wat een pas eerlijk kán dragen: **wanneer** deze foto's zijn gemaakt, **door
wie** (op codenaam), **wat** de verkoper heeft ingevuld, en **dat het sindsdien
niet is gewijzigd**. Dat is waardevol en het is waar te maken. Wat hij niet kan
dragen zonder dat iemand het product heeft gezien: dat het echt is, dat het
serienummer klopt, of dat het niet gestolen is. Een diefstalregister raadplegen
is een derde partij, en die heeft een naam en een bron nodig — precies zoals
`kern/vakbewijs.js` niet doet alsof het het BIG-register belt.

**De regel die eruit volgt:** elk vakje in de pas draagt zijn bewijsgraad, en
`niet vast te stellen` is er een van. Een pas met alleen vinkjes is een pas die
liegt.

### 4.4 De fraudegraaf botst frontaal met het codenaam-ontwerp

Het voorstel wil relaties leggen tussen "accounts, apparaten, betaalmiddelen,
adressen, gedrag, advertenties en transacties". Dat is precies het profiel dat
dit huis overal weigert: `kern/mediaos/smaak.js` weigert een stil meegeschreven
kijkprofiel, `CLAUDE.md` zet echte namen in een aparte kluis, en de hele
codenaam-opzet bestaat om te voorkomen dat gedrag aan een mens vastgeknoopt kan
worden.

En het punt uit het voorstel dat het zelf al maakt — *koper en verkoper hoeven
elkaars adres niet te zien* — wordt door zo'n graaf ondergraven: RTG ziet dan
alles wat de twee niet van elkaar mogen zien.

**Dat maakt het niet onmogelijk, maar het maakt het een besluit met voorwaarden.**
Minimaal: welke signalen mogen worden gekoppeld en op welke grond, hoe lang ze
blijven staan, wie ze mag inzien (met een reden en een journaalregel, zoals de
identiteitskluis dat al doet), en wat een lid erover te horen krijgt als hij
erdoor wordt geraakt. Een fraudegraaf zonder die vier is bewaking.

### 4.5 "Universal Product Identity" moet worden gevonden, niet verklaard

Dit huis heeft deze fout al één keer voorkomen en het staat gemeten in
`OBJECTMODEL.json`: **`Asset` bestaat niet.** Tafel, kamer, podium en leaseauto
delen niets buiten hun verpakking; 71% van de velden hoort bij precies één
domein. `DEVELOPERCLOUD.md` par. 2 trekt daar de les uit: een universeel
objectmodel hoort te worden **gevonden in de domeinen** en niet eroverheen
verklaard.

Een productidentiteit die "ieder waardevol object" dekt, is dezelfde belofte in
een ander jasje. Voeg dus geen type toe dat niet uit een meting komt — en die
meting is goedkoop: `scripts/objectmodel.js` draait al.

### 4.6 De marktplaats en de Mall zijn twee dingen, en dat moet zo blijven

Er staat naast `kern/markt.js` een hele `kern/mall/` (aanbod, catalogus,
bestellingen, collecties). Dat is de kant van **zaken** die verkopen; de markt is
de kant van **mensen** die iets van de hand doen. Het voorstel zegt dat een
particulier "via de mall" moet kunnen verkopen — als dat betekent dat die twee
één worden, hoort daar eerst de super-app-toets van `PLATFORM.md` overheen: is
dit een zelfstandige capability, of een tweede ingang naar dezelfde?

---

## 4.7 Wie de belasting betaalt, en wat dat NIET dekt

**Besluit van de eigenaar (27 augustus 2026): bij een verkoop tussen leden is de
particulier zelf verantwoordelijk voor zijn belasting; RTG geeft de tools.** Dat
is het facilitator-model, en het is verdedigbaar: RTG is geen verkoper en geen
tussenpersoon, het geld gaat rechtstreeks van koper naar verkoper.

Dat besluit heeft een tweede helft die makkelijk blijft liggen: **"wij geven
alleen de tools" is een belofte, en die moet in code staan** (LAT-regel 6). Tot
27 augustus kon een lid dertig grootboekregels en zijn saldo zien — daar valt
geen aangifte mee te doen. Sindsdien is er `kern/pay/inkomsten.js`: wat kwam er
in een jaar binnen, per soort, met aantallen, en als uitdraai voor een
boekhouder. Met een blok dat even groot is als het bedrag en zegt wat er **niet**
in zit (geld buiten RTG Pay, eigen stortingen, en dat dit omzet is en geen
winst). Een overzicht dat zich groter voordoet dan het is, laat iemand een
verkeerde aangifte doen.

**Wat dit besluit níét dekt, en dat blijft bij RTG liggen.** DAC7 (EU-richtlijn
2021/514) legt een rapportageplicht bij de **platformexploitant**, niet bij de
verkoper: vanaf 30 transacties óf 2.000 euro per jaar moet de exploitant
verkopersgegevens verzamelen en aanleveren. Wie de belasting betaalt verandert
daar niets aan. Zolang de verkoopvolumes klein zijn is dat theorie; het wordt
praktijk op precies het moment dat de rest van dit document slaagt.

Wat er nu al voor ligt: het inkomstenoverzicht telt per soort en per jaar,
inclusief **aantallen** — dat is het getal waar de drempel op staat. Wat
ontbreekt is de kant van RTG: welke verkopers over de drempel gaan, welke
gegevens er dan verzameld moeten worden, en wie dat aanlevert. Dat is een
besluit met een jurist, geen sprint.

---

## 5. Waar het omvalt als het omvalt

Niet op de techniek van het handelen — dat staat er grotendeels. Op de
**geldketen** (par. 2) en op de **aansprakelijkheid**.

Elke belofte in het voorstel verplaatst risico naar RTG. "Escrow" betekent: RTG
is aanspreekbaar als het geld niet vrijkomt. "Proof of item" betekent: RTG is
aanspreekbaar als de pas klopte en het product niet. "Product verzekerd tijdens
transport" betekent dat er een verzekeraar is met een polis, of dat het een lege
zin is.

Dat is geen reden om het niet te doen. Het is de reden om het in deze volgorde te
doen: eerst de keten laten kloppen, dan pas beloven.

---

## 6. De volgorde

1. **Par. 2 uitzoeken.** Komt het geld bij de verkoper aan, of niet? Alles hierna
   hangt hiervan af, en het is een halve dag werk.
2. **De transactietijdlijn.** Wat is er gebeurd, wanneer, en op welk moment ging
   welk geld waarheen. Dat is de bodem onder elke vorm van vertrouwen, en het is
   te bouwen met wat er ligt.
3. **De productpas mét bewijsgraden** (4.3) — de eerlijke helft ervan is nu al
   waar te maken.
4. **De camera-ingang** (#6): de AI-hulp schrijft en prijst al.
5. **De Deal Room als klaarzetten** (4.2).
6. **Het escrow-besluit** (4.1) — een gesprek met een jurist, geen sprint.
7. Pas daarna veiling, Instant Trade en de fraudegraaf, elk met hun eigen besluit.

---

## 7. Wat dit document niet is

Het is geen toezegging dat er tien dingen komen, en geen ontwerp. Het is de plek
waar staat wat er al is, wat er één stap vandaan ligt, wat een besluit van de
eigenaar vraagt en wat jaren weg is — zodat niemand ze voor elkaar aanziet.

Twee dingen die er met opzet niet in staan:

- **Geen belofte dat RTG Exchange er komt.** Par. 4 laat zien wat het kost: drie
  van de tien punten vragen een juridisch of een bedrijfsbesluit voordat er één
  regel code bij hoort.
- **Geen oordeel over de markt zoals hij nu draait.** Par. 2 is een meting en
  geen aanklacht: het kan een demo-stand zijn. Wat er niet mag gebeuren is dat
  die vraag onbeantwoord blijft terwijl er functies bovenop worden gezet.
