# LIFE.md -- RTG Life OS

Het diepte-document voor de wereld die vandaag "RTG Sociaal" heet. `PLATFORM.md`
beschrijft het wereldpatroon dat elke wereld krijgt, `GELD.md` en `LEVEN.md` zijn
de twee zusterdocumenten, `LAT.md` zegt hoe er geschreven wordt. Dit zegt wat
deze wereld is, en -- zwaarder wegend -- wat hij nooit mag worden.

Besluit van de eigenaar, 11 augustus 2026.

---

## 0. De kern, in een zin

> Instagram beheert foto's, WhatsApp gesprekken, Tinder matches, Calendar
> afspraken. RTG beheert **het leven tussen mensen**.

En daaruit volgt de regel die het hele ontwerp stuurt:

> **Een lid opent geen app. Hij opent een levensmoment.** Het platform zet
> daarachter de systemen aan die erbij horen.

Een verjaardag is geen agenda-item plus een chat plus een reservering plus een
betaling plus een fotomap. Het is een levensmoment, en de onderdelen horen
eromheen te komen in plaats van eronder verdeeld te worden.

---

## 1. Dit is geen groen veld, en dat is het belangrijkste feit hier

Vier mechanismen die deze visie vraagt, bestaan in dit huis al werkend en
getoetst. Ze staan alleen op de verkeerde plek of aan de verkeerde kant.

| Wat de visie vraagt | Wat er staat | Waar |
|---|---|---|
| één graaf die alle apps lezen | de Life Graph, als **projectie** en niet als tweede database: elke knoop draagt bron, eigenaar, wie het mag zien, gevoeligheid en vervaldatum | `kern/levensgraaf/graaf.js` |
| relaties met rechten | banden die alleen bestaan als **beide** kanten bevestigen, delen per stuk, met vervaldatum, altijd intrekbaar | `kern/levensband/` |
| objecten in plaats van apps | 73 genres, **één** leverancier-app en **één** PDA; de UI volgt `caps` en de server bepaalt welke modules aan gaan | `kern/pda/modules.js`, `seed/genres-lijst.js` |
| iets bereiken zonder per paar te bouwen | de handelsketen: een aanvraag gaat naar een **genre** en niet naar een adres -- dat is wat van N² weer N maakt | `kern/handelsketen.js` |

Daaronder ligt de sociale software zelf: elf apps, ± 125 endpoints, van
gesprekken over vijf bronnen tot een SOS-keten met GPS en een noodlaag naar
kantoor.

**De opgave is dus niet uitvinden maar omdraaien.** De graaf weet vandaag wat
een lid *heeft* -- paspoorten, taxaties, keuringen, drinkvensters -- en moet
leren wat er *tussen mensen speelt*. Dat is dezelfde motor met andere bronnen,
en dat is precies waarom hij die bronnen meekrijgt in plaats van zelf te kiezen
(zie de reden in `graaf.js`: een motor die zijn eigen brandstof kiest, kan er
maar één soort verstoken).

---

## 2. De objectlaag

Niet: Dating, Chat, Games, Events. Maar objecten die iets **kunnen**.

| Object | Kan |
|---|---|
| **Persoon** | chatten, plannen, samen betalen, reizen, gamen, herinneren |
| **Groep** | chatten, stemmen, vergaderen, reserveren, reizen, samen betalen |
| **Event** | tickets, chat, vervoer, verblijf, tafel, beeld, wallet |
| **Reis** | deelnemers, verblijf, vlucht, planning, betalingen, beeld |
| **Match** | chat, agenda, budget, tafel, reis, herinneringen |
| **Moment** | alles wat er die dag omheen hoort |

Het scherm volgt de `caps` van het object, exact zoals de leverancier-app de
`caps` van een genre volgt. Dat mechanisme is hier niet nieuw en hoeft dus niet
bewezen te worden -- alleen verhuisd naar de ledenkant.

**Twee regels houden deze laag eerlijk.**

**Een object bezit niets.** Een Reis-object bewaart de vlucht niet; die blijft in
`kern/reis`. Het object draagt de samenhang en de deelnemers, verder niets. Zou
het opslaan, dan bestaat een reis op twee plekken en lopen ze uiteen zonder dat
iets klaagt (LAT-regel 4). Dit is dezelfde regel die `graaf.js` al draagt, en om
dezelfde reden.

**Een objecttype erbij is geen app erbij.** Dat is de toets. Komt er een type dat
zijn eigen kern, eigen opslag en eigen workflow meebrengt, dan is het geen object
maar een domein, en dan hoort het onder de objectlaag te hangen in plaats van
erin (PLATFORM.md par. 0b).

---

## 3. Het werkwoord van deze wereld

Elke wereld kiest bewust wat zijn vierde laag mág, en schrijft dat op vóór de
bouw (PLATFORM.md). RTG Geld voert uit binnen regels en binnen het eigen tegoed.
RTFoundation voert niets uit en opent alleen. Life OS is een derde geval, en het
verschil is de reden dat dit document bestaat:

> **Life OS stelt samen en zet klaar. Bevestigen doet de mens.**

| Niveau | Gedrag | Mag in Life OS |
|---|---|---|
| **Kijken** | signaleren wat er speelt | ja |
| **Voorstellen** | een plan voorstellen | ja |
| **Klaarzetten** | alles invullen, het lid bevestigt | ja, en dit is de WOW |
| **Automatisch** | zelf uitvoeren | **alleen bij eigen ordening** |

De grens is hard en hij loopt anders dan bij geld. **Daar** is de grens het eigen
tegoed; **hier** is de grens een ander mens. Alles wat een tweede persoon
bereikt -- een uitnodiging, een bericht, een reservering op andermans naam, een
betaling, een gedeelde map -- blijft maximaal "klaarzetten". Er is geen regel,
geen instelling en geen vertrouwensniveau waarmee dat "automatisch" wordt.

Wat "automatisch" wél mag: ordening die alleen het lid zelf raakt. Een moment op
de eigen tijdlijn zetten, een eigen herinnering aanmaken, een eigen map ordenen.

**Wat dit betekent voor "Regel zaterdag".** Rahul mag het hele plan samenstellen
-- agenda-overlap, budget, afstand, weer, tafel, vervoer, verblijf, muziek -- en
compleet klaarzetten. Eén scherm, één bevestiging, en dan pas gaat er iets de
deur uit. Dat is nog steeds één handeling in plaats van tien, dus de WOW blijft
heel; wat vervalt is dat de AI namens iemand contact legt met een derde. Dat is
geen beperking van het idee maar de voorwaarde waaronder het idee mag bestaan.

En de huisregels blijven staan waar ze stonden: geld verlaat het huis nooit
vanzelf (GELD.md par. 3), de AI belooft nooit toegang die een mens moet geven, en
er wordt nooit gezegd dat een boeking verwerkt is als dat niet zo is
(`CLAUDE.md`).

---

## 4. DE GRENZEN. Dit deel weegt zwaarder dan par. 1-3

Zoals in `LEVEN.md`: waar een functie botst met een grens, vervalt de functie.
Deze wereld gaat over andere mensen, en daarmee over de enige gegevens die een
lid niet zelf kan terugnemen.

### 4.1 Een relatie is geen trechter

Collega → vriend → reismaat → partner → bruiloft → gezin is een prachtige
beschrijving van wat er *gebeurd* kan zijn. Het mag nooit een *pad* worden dat
het platform toont, voorstelt of aanmoedigt. Een systeem dat de volgende stap in
een relatie voorstelt, is een regisseur van iemands leven geworden -- en `LEVEN.md`
par. 2.2 zegt het al voor kinderen: nooit sturen, alleen openen. Voor volwassenen
geldt het net zo goed.

De relatietijdlijn legt vast wat er was. Hij stelt nooit voor wat er hoort te
komen. Geen "jullie zijn drie maanden samen", geen "tijd voor een weekend weg".

### 4.2 De relatieruimte is van twee mensen, niet van één

Alles in een gedeelde ruimte is voor beiden zichtbaar, en elke kant kan zijn deel
weghalen of de ruimte verlaten. Er ontstaat hier geen eenzijdig dossier over een
ander mens.

De persoonlijke uitzondering die al bestaat en mag blijven: Attenties en Entourage
houden eigen aantekeningen bij een relatie (band, dieet, giftgeschiedenis). Dat is
een eigen dossier over een eigen relatie, en het blijft eigen -- het schuift nooit
vanzelf een gedeelde ruimte in.

### 4.3 Wat Rahul over een groep weet, weet hij omdat het gebeurd is

"Deze groep houdt van techno en sushi" mag alleen bestaan als het terug te voeren
is op wat die groep werkelijk deed, en het lid moet dat kunnen zien en wissen.
Een voorkeur die uit gedrag is *afgeleid* zonder bron is een gok die eruitziet als
een feit -- dezelfde fout waar `kern/mediaos/hub.js` al tegen waarschuwt bij het
koppelen van clips aan nummers. Uitlegbaarheid is hier geen extra: elk oordeel
noemt zijn bronnen (GELD.md par. 5, LEVEN.md par. 2.10).

### 4.4 Geen score op het leven tussen mensen

Geen relatiegezondheid, geen reeks, geen "je sprak Marco al drie maanden niet",
geen badge voor contact onderhouden. Schuld als motor is de scherpste vorm van het
verslavende patroon dat `CLAUDE.md` verbiedt, en juist hier zou hij werken. Dat is
precies waarom hij er niet komt.

### 4.5 Wat een spel of een project bewaart, valt onder de 18+-grens

Een gezamenlijk potje mag altijd, voor iedereen. Alles wat er ná afloop van
overblijft buiten dat potje -- een winnaar, een stand, statistieken, een badge
voor vrijwilligerswerk -- hangt aan `progressieMag` in `kern/spellen/grens.js` en
nergens anders. Een nieuwe progressievorm krijgt geen eigen kopie van die regel.

### 4.6 Toestemming reist niet mee

Wie in je Reis-object staat, ziet daarmee niet je budget. Wie in een groepschat
zit, ziet daarmee niet je agenda. Elke `cap` is een eigen deling, met een eigen
vervaldatum, intrekbaar door elke kant -- op `kern/levensband/` en niet op een
nieuwe opslag ernaast.

### 4.7 Geen schaduwprofielen

Geen "mensen die je misschien kent" op grond van wat anderen over jou prijsgaven.
Wie geen lid is, bestaat hier niet -- ook niet als contactregel in andermans
telefoon.

### 4.8 Codenamen, ook hier

De graaf en de objectlaag draaien op codenamen; echte namen blijven in de kluis
(`accounts.js`). Een sociale laag is precies de plek waar iemand dat "even
makkelijker" wil maken, en precies de plek waar dat niet mag.

---

## 5. Wat er bewust NIET komt

- **Geen tweede opslag** van gesprekken, beeld, agenda of betalingen. De
  objectlaag is een projectie; de waarheid blijft in het domein.
- **Geen autonome berichten of uitnodigingen** namens een lid. Zie par. 3.
- **Geen relatiescore, reeks of herinnering-om-de-herinnering.** Zie par. 4.4.
- **Geen aparte "Life OS"-inbox.** Berichten heeft er één; een tweede zou
  betekenen dat een gesprek op twee plekken ongelezen kan zijn.
- **Geen kinderen in de relatielaag buiten `levensband` om.** Dat pad bestaat, is
  getoetst, en heeft zijn grenzen al (LEVEN.md par. 2.1 en 2.8).

---

## 6. Het wereldpatroon, hier ingevuld

De vijf lagen uit PLATFORM.md, met het werkwoord uit par. 3.

| Laag | In Life OS | De regel die hem eerlijk houdt |
|---|---|---|
| **graaf** | de sociale graaf: elf apps plus de vriendenlaag als bron, met vooruitblik | leest alleen, bezit niets |
| **beleid** | wie mag wat zien, wie mag mij bereiken, wat mag Rahul klaarzetten | het systeem handelt binnen beleid, nooit naar eigen inzicht |
| **cockpit** | Life Command: wie wacht, wat loopt, wat komt | uitzonderingsgestuurd; rust is een uitkomst |
| **Rahul** | Life Orchestrator: samenstellen en klaarzetten | rekent met echte gegevens en noemt zijn bronnen |
| **actielog** | wie deed wat, wanneer, namens wie | groeit aan, wordt nooit herschreven |

Het actielog weegt in deze wereld zwaarder dan in de andere twee: hier staan
handelingen in die een **ander mens** hebben bereikt. Dat moet terug te lezen zijn
door beide kanten.

---

## 7. Faseplan

Elke fase levert werkende, getoetste software op, en geen fase begint voor de
vorige zijn toetsen heeft (LAT.md).

| Fase | Wat | Status |
|---|---|---|
| 1 | **de sociale graaf**: de tien sociale apps plus de vriendenlaag als bron, met vooruitblik (verlopende documenten uit Entourage, data uit Attenties). Alleen lezen. | **er** |
| 2 | **de objectlaag**: Persoon, Groep en Event als eerste drie types, met `caps` en een scherm dat de caps volgt | **er** |
| 3 | **de relatieruimte** op `levensband`: gedeelde tijdlijn, beeld, plannen en betalingen per relatie, met par. 4.2 in code | -- |
| 4 | **de momentlijn**: leven in plaats van posts -- vandaag, vrijdag, zaterdag, volgende week | -- |
| 5 | **Life Command + de orchestrator** op niveau klaarzetten, met het actielog eronder | -- |
| 6 | **de koppelingen naar buiten**: een community-actie die een Foundation-project wordt, een zaak-event dat de handelsketen in gaat (tickets, vervoer, tafel, wallet) | -- |

Fase 1 is met opzet klein en volledig omkeerbaar: hij voegt niets toe aan wat een
lid kan doen, alleen aan wat het platform ziet. Alles daarna staat erop.

### Waar fase 1 staat

`server/kern/socialegraaf/` met vier delen: `hulp.js` (de vorm van een moment),
`bronnen.js` (negen sociale bronnen), `vooruitblik.js` (de sociale snede van de
Control Tower) en `index.js` (de motor). De route is `POST /api/sociaal/graaf`
in `server/routes/sociaal.js`, achter de ledendeur en niet voor gasten. Getoetst
in `test/socialegraaf.test.js`, elke toets met de mutatie erbij die hem hoort te
laten zakken; alle mutaties zijn gedraaid en gezien zakken.

**De correctie op het faseplan hierboven, want hij hoort niet weggepoetst.** Er
stond "alle elf apps" en "gastpassen uit Cercle". Beide klopten niet en dat bleek
pas bij het bouwen. De elfde catalogusregel is RTG Sociaal zélf, dus het zijn er
tien plus de vriendenlaag. En een gastpas in Cercle is een AANTAL, geen datum
(`kern/rechterhand/cercle.js`) — er valt dus niets vooruit te blikken, en een
verzonnen vervaldatum eromheen zou een waarschuwing zijn die nergens op slaat.
Clubs komen mee als telling. Zie de kop van `vooruitblik.js`.

**Twee fouten die bij het nalezen van de bronnen boven water kwamen**, allebei in
de bestaande samenhanglaag `kern/socialewereld.js` en allebei stil:
`bijeenkomst.titel` bestaat niet (het domein levert `wat`) en `pulse.naam`
bestaat niet (het domein levert `codenaam`). Elke bijeenkomst stond dus zonder
titel op het RTG Sociaal-scherm en elk bericht zonder afzender. De toets zag het
niet omdat zijn nagemaakte bronnen wél `titel` en `naam` teruggaven — een
namaakbron die niet op de echte lijkt, bewijst niets. Oorzaak en toets zijn
allebei gerepareerd.

**Wat er in fase 1 met opzet NIET is:** een scherm. De graaf is een laag, geen
gezicht; het command center is fase 5. Wie de laag nu wil zien, roept de route
aan.

### Waar fase 2 staat

`server/kern/objectlaag/` met vier delen: `caps.js` (de catalogus), en
`persoon.js`, `groep.js`, `event.js` voor de drie types. De route is
`POST /api/sociaal/object`; het scherm is het objectpaneel in
`public/apps/sociaal.html`, dat **geen enkele cap bij naam kent** — het toont wat
de server stuurt. Een cap erbij is dus een regel in `caps.js` en niets in het
scherm, precies zoals de PDA schakelt op de modulelijst van de server
(`kern/pda/modules.js`) en niet op zijn eigen idee van de caps.

**Een cap is een belofte, en dat is machinaal bewaakt.** Elke cap draagt zijn
bestemming, en `test/objectlaag.test.js` zakt zodra die pagina niet bestaat. Dat
is de tegenhanger van wat PLATFORM.md beschrijft: zeventien app-teksten
beloofden functies zonder route ("open deuren op afstand", "wij verzorgen
inpakken en bezorgen"). Een objectlaag kan die fout op schaal herhalen — een cap
"samen reizen" bij een persoon voelt logisch en is zonder bestemming een leugen
met een pijltje.

**Wat er bewust NIET in de catalogus staat: Attenties, Entourage en Cercle.** Die
drie bewaren mensen met hun **echte naam** in het eigen dossier van het lid;
deze laag draait op codenamen. Een cap die de twee koppelt, zou namen uit een
dossier gaan vergelijken met codenamen en daarmee het ontwerp doorbreken dat
CLAUDE.md beschermt. Een toets bewaakt dat er geen zo'n cap bijkomt. De reden
staat in de kop van `persoon.js`, zodat de volgende die ze mist niet denkt dat
het vergeten is.

**De kop van een persoon: feiten, geen oordeel.** Naast de caps draagt een
persoon-object een `over`-blok — nu online, de eerstvolgende afspraak waar de
ander óók ja zei, en wanneer u elkaar het laatst sprak. Dat zijn alle drie
feiten uit een domein. Wat er nooit bij komt is een cijfer over de relatie zelf:
een hechtheid, een reeks, "u sprak elkaar al drie maanden niet". Een toets zakt
op elk veld dat zo heet, en het scherm rekent zelf niets uit.

**Wat een cap AANZET is nooit een type.** Er staat nergens `type = vriend`. Wie
tegelijk collega, reismaat en medespeler is, krijgt die drie caps naast elkaar,
want elke cap hangt aan een feit uit een domein en niet aan een etiket. Dat is
ook waarom een cap erbij nooit een nieuw sociaal model vraagt: een app die iets
nieuws kan met een persoon, voegt een proef en een catalogusregel toe.

**Wat er (nog) geen bron voor heeft.** Nagemeten, niet aangenomen — deze staan
hier zodat ze niet voor vergeten worden aangezien:

| Gevraagd | Waarom het er niet is |
|---|---|
| agenda-afspraken samen | `kern/agenda.js` kent geen deelnemers of codenamen; alleen genootschap-bijeenkomsten dragen een deelnemerslijst |
| werkrelatie | collega-chats hangen aan een ZAAK en aan personeelsleden, niet aan een lid-codenaam |
| gedeelde contacten | u ziet uw eigen verbindingen; die van een ander zijn niet van u om te tellen |
| Meet-kamer samen | `meetMijn` levert wie er nú in zit, niet wie er mág; een leesexport in het domein zou dat oplossen |
| hospitality, mobility, wallet en livestream bij een Event | een genootschap-bijeenkomst heeft geen enkele koppeling naar reserveringen, vervoer, tickets of een uitzending. Dit is geen ontbrekend veld maar een ontbrekende VERBINDING tussen domeinen, en die hoort een eigen stap te zijn |

**Twee toetsbestanden, en dat is met reden.** `test/objectlaag.test.js` maakt de
domeinen na en toetst de logica; `test/objectlaagroutes.test.js` praat met de
echte server en pint de echte vorm vast. Dat tweede bestand verdiende zich
meteen terug: een bijeenkomst-id is een **getal** (`Date.now()`) en alles wat via
een route binnenkomt is een string, dus de vergelijking matchte nooit en de route
gaf een 404 op een bijeenkomst die gewoon bestond. De nagemaakte kern zag het
niet — daar was de id een string, want zo was hij opgeschreven. Zelfde blinde
vlek als de lege bijeenkomsttitel in fase 1.

---

## 8. De acht besturingssystemen -- een aparte beslissing

Bij dit besluit hoort een tweede: de eigenaar noemt acht OS'en (Life, Business,
Money, Mobility, Hospitality, Media, Foundation, Identity). Dat is **niet** de
acht uit PLATFORM.md par. 0 (Reizen, Media, Kantoor, Sociaal, Geld, Veilig, Leven,
RTFoundation).

Het verschil is echt en het is niet klein: Reizen en Kantoor bestaan in de nieuwe
indeling niet meer als eigen wereld, en Hospitality en Business komen erbij. Dat
raakt werkende software en de omleidingen die er al liggen.

**Dit document neemt dat besluit niet.** Het hoort in `PLATFORM.md`, waar de kaart
staat, en het hoort apart genomen te worden -- niet als bijvangst van een
sociaal-document. Wat de twee kaarten wél delen is dat Life OS in beide hetzelfde
bevat: sociaal, relaties, communities, dating, events en samen spelen. Fase 1 tot
en met 4 hierboven zijn dus geldig onder allebei, en kunnen beginnen zonder dat de
kaartvraag beantwoord is.
