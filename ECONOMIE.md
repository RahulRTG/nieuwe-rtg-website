# ECONOMIE.md — één natuurkunde, geen tweehonderd motoren

> Van één afwasser naar de wereldeconomie — zonder ooit van simulatie te
> wisselen.

`VERHAAL.md` gaat over de mens in een bedrijf. `ORGANISATIE.md` over waarom
organisaties het houden of breken. Dit document gaat over de laag eronder: de
**economische natuurkunde** waarop een snackbar, een farmaceut, een
voetbalclub, een chipfabrikant, de Foundation en een bank allemaal dezelfde
fundamentele regels gebruiken.

De reden dat dit één document is en niet twintig: als elke sector zijn eigen
motor krijgt, heb je over drie jaar tweehonderd economics engines die uit
elkaar lopen. Er is er één.

---

## 1. De eerste wet

> **Niets spawnt zomaar.**
>
> Ieder product heeft een oorsprong. Iedere dienst heeft capaciteit. Iedere
> euro heeft een tegenpartij. Iedere werknemer komt ergens vandaan. Iedere
> onderneming gebruikt iets dat door een ander geleverd moet worden.

Een hamburger is niet `hamburger.cost = 2.83`. Hij bestaat omdat ergens graan
verbouwd is, energie gebruikt, verpakking gemaakt, transportcapaciteit
beschikbaar was, personeel heeft gewerkt, een pand er stond — en iemand hem
wilde kopen.

### Wat de wet níet zegt

IJmuiden is een stad en geen wereld. Een restaurant dat aardappelen koopt,
koopt ze grotendeels van buiten, en dat hoort ook zo. Wat de wet verbiedt is
niet dat er iets van buiten komt — het is **dat er iets uit het niets komt
terwijl het van binnen lijkt te komen.** De grens moet hardop staan, anders
weet niemand hoe groot de eigen economie eigenlijk is.

### De nulmeting

`scripts/magnaat-pomp.js` bewaakt al de ene helft: *iedere euro heeft een
tegenpartij.* `scripts/magnaat-oorsprong.js` meet sinds nu de andere, met van
elke sector één zaak in de stad:

```
handelssoort | gevraagd/mnd | leverbaar hier | loopt er echt door | levert
goederen     |          945 |            459 |                  0 | retail
productie    |           31 |             70 |                  0 | industrie
vervoer      |          206 |           1217 |                  0 | logistiek
diensten     |            3 |              9 |                  0 | kantoor

KAN uit de stad komen : 59%   (er is capaciteit voor)
LOOPT er werkelijk door: 0%   (er is een contract voor)
```

**Dat was de stand.** Zonder contract was de inkoop van een zaak een percentage
van zijn eigen omzet (`stap.js`): er ging geen euro naar een leverancier, ook
niet als die op het kavel ernaast stond met capaciteit over.

`magnaat/keten.js` — Supply Network v1 — sluit die keten. Dezelfde meting nu:

```
goederen     |         1211 |            851 |                900 | retail
productie    |           43 |            105 |                 43 | industrie
vervoer      |          298 |           1456 |                297 | logistiek
diensten     |            4 |             12 |                  4 | kantoor

KAN uit de stad komen : 77%
LOOPT er werkelijk door: 80%
  krap: goederen -- 25% van de vraag kan de stad niet leveren
```

### Hoe hij werkt

**Het is geen nieuwe post maar een verplaatsing.** De inkoopsom blijft wat hij
was; wat verandert is waar hij heen gaat. Dezelfde vorm als `derving`: een
uitsnede, geen extra rekening. Hij loopt daarom door de machinerie die er al
was en al getoetst is — `toezegging` en `ontvangst` uit de contractlaag. **Een
spotlevering is een contract dat niemand hoefde te onderhandelen.**

**De buitenwereld is een actor.** Wat er niet lokaal geleverd wordt komt van
buiten, en heet dan ook zo. Dat kostte geen enkel nieuw geldmechaniek: import
is precies wat de inkooppost altijd al *was* — geld dat de wereld verlaat
zonder tegenpartij.

**De prijs komt uit de structuur.** De wereldprijs is het plafond van de lokale
markt: niemand betaalt lokaal meer dan invoeren kost. Bij een ruime markt geldt
het lokale voordeel (3%, gemeten), bij volledige schaarste verdwijnt dat. Geen
`scarcityBonus`.

**Een contract is voorrang, geen korting.** Contracten leggen beslag op
capaciteit vóór de spotverdeling. Tijdens schaarste krijg jij geleverd en je
concurrent niet — en dát is wat een contract waard is.

**Verdelen gaat pro rata.** Niet wie het eerst komt, want dan bepaalt de
volgorde in een object wie er omvalt.

### Wat er nog niet is

Met zoveel woorden, want een half gebouwde laag die eruitziet als een hele is
erger dan een ontbrekende: **levertijd** (een bestelling is er meteen),
**voorraad** (er ligt niets ergens), **substitutie** (geen alternatief product)
en **meerdere steden**. En het scherm: de keten is nog niet klikbaar.

---

## 1b. De tweede wet — en het geld komt terug

> **Wat een bedrijf aan mensen betaalt, verdwijnt niet uit de stad.**

Dezelfde wet als §1, een halve slag gedraaid. Daar ging het over goederen die
een producent moeten hebben; hier over klanten die hun geld ergens verdiend
moeten hebben. En het stond er net zo scheef: `stap.js` had de regel

```js
const lonen = v.personeel * s.loon;
```

Geld dat de wereld verliet zonder ooit ergens aan te komen — precies de vorm van
de inkooppost van vóór `keten.js`. Een lek met een nette naam.

### Het is een lek dat terugkeert, geen bron

Dit is de ontwerpkeuze waar de rest aan hangt, en ze sluit meteen de enige echte
uitbuiting uit. Wat terugkomt is uitsluitend het loon van het **personeel** —
geld dat de wereld werkelijk verliet. Een dienstverband tussen twee **spelers**
telt niet mee, hoe hoog het loon ook is: dat geld ging van de ene kas naar de
andere en is de wereld nooit uit geweest.

*Alleen wat weglekte kan terugkeren.* Zonder die regel zouden drie spelers
elkaar in een kring in dienst kunnen nemen — netto nul tussen hen — en samen de
vraag van de hele stad opstoken. Het scenario `loondienst` in
`scripts/magnaat-pomp.js` staat er nog steeds op **0,00**.

En er komt geen euro bij: koopkracht landt op de **vraag**, niet op een kas.

### De stad is groter dan de spelers

De noemer is de loonsom van de stad zélf, afgeleid uit `stadsomzet` — het getal
waar de Foundation al uit put. IJmuiden had een economie voordat er iemand een
restaurant opende. Twee gevolgen, allebei gewenst:

- **In zijn eentje kan niemand de stad rijk maken.** Wie personeel aanneemt om
  de vraag op te stoken betaalt honderd procent van dat loon en verschuift een
  paar procent van een stadsloonsom die grotendeels van hem los staat — en de
  vraag die hij koopt komt ook bij zijn concurrenten terecht.
- **Maar samen wel.** Sluiten er zaken, dan zakt de loonsom zichtbaar, en dat
  raakt iedereen die van lokale klanten leeft. Zo reist een faillissement
  (laag 28) zonder dat er iets gescript is.

### Dezelfde schok raakt niet iedereen gelijk

Die grens volgt hier **uit de structuur** en niet uit een tabel met
uitzonderingen. Een strandhotel leeft van toeristen die hun geld elders
verdienden; een buurtwinkel van mensen die hier werken. Het verschil komt uit
de segmentsom die `vraag.js` toch al maakt — gemeten in een stad met van elke
sector één zaak:

| sector | leeft van lokaal verdiend geld |
|---|---|
| vrije-tijd | 52% |
| retail | 39% |
| horeca | 36% |
| hotel | 25% |
| logistiek | 9% |
| kantoor | 7% |
| industrie | 4% |

Daar hangt een eigenschap aan die niemand heeft ingetikt: **een stad met veel
ouderen en veel toeristen staat steviger in een neergang** dan een stad die van
haar eigen loonsom leeft. Pensioen en vakantiegeld komen niet uit de lokale
werkgelegenheid.

### Wat de nulmeting zegt

`scripts/magnaat-oorsprong.js`, tweede helft:

```
loonsom van de stad zelf : 1.055.963 per maand (18% van de stadsomzet)
loonsom van de spelers   :   254.150 per maand, van 7 zaken
bestedingskracht         : 1.241   (1.000 = een stad zonder spelers)
```

Zeven zaken zijn dus goed voor bijna een kwart van wat er in deze stad aan loon
omgaat. Ontslaan ze samen tachtig procent van hun mensen, dan zakt de
bestedingskracht naar **1,05** — en dat kost een winkel in het centrum vraag
terwijl een fabriek in de haven er nauwelijks iets van merkt.

### Wat er nog niet is

**Traagheid** (een huishouden dat deze maand minder verdient eet deze maand nog
hetzelfde — er hoort een spaarbuffer tussen), **werkloosheid** als eigen
toestand (wie ontslagen wordt verdwijnt nu gewoon uit de som), **sparen**, en
**huur en vaste lasten** van huishoudens.

En één eigenschap die geen gebrek is maar wel het vermelden waard: een zaak die
**vol zit merkt van extra koopkracht niets**. `maat.js` begrenst de capaciteit
op de omvang, dus extra vraag landt in `gemist` tot de eigenaar uitbreidt.
Koopkracht die stijgt raakt eerst wie ruimte heeft; koopkracht die zakt raakt
uiteindelijk iedereen.

---

## 2. De acht vragen

Elke sector krijgt dezelfde fundamentele vragen. Daarboven ontstaat alle
sectorale complexiteit — en hieronder ligt één motor.

1. Wat heb je nodig?
2. Waar komt het vandaan?
3. Wie voert het uit?
4. Wie betaalt?
5. Wanneer gebeurt het?
6. Wie draagt het risico?
7. Welke capaciteit wordt bezet?
8. Wat gebeurt er als het faalt?

En het megaprincipe eroverheen:

> **Iedere output van één sector kan input van een andere sector zijn.**

Onderwijs → arbeid. Farmaceutisch onderzoek → zorg. Sport → media en toerisme.
Media → merkwaarde en vraag. Vastgoed → bedrijfscapaciteit. Banken →
investeringscapaciteit. Energie → bijna alles. Foundation → opleiding,
infrastructuur, gezondheid. Big Tech → productiviteit van andere bedrijven.
Overheid → infrastructuur en regelkader.

---

## 3. De lagen

Van onderaf, en met opzet in deze volgorde: elke laag gebruikt de vorige.

| # | laag | staat er |
|---|---|---|
| 1 | grond, natuur, grondstoffen | ◐ kavels en zones |
| 2 | energie | ✗ |
| 3 | mensen en huishoudens | ◐ `huishoudens.js` — loon komt terug als koopkracht; werkloosheid en sparen niet |
| 4 | arbeidsmarkt | ◐ `dienst.js`, `loopbaan.js` |
| 5 | wonen en vastgoed | ◐ kavels als bedrijfscapaciteit |
| 6 | horeca: fastfood tot Michelin | ✅ `sectoren.js`, prijsstand |
| 7 | retail en merken | ◐ sector bestaat, merken niet |
| 8 | logistiek | ◐ sector bestaat, vormen niet |
| 9 | industrie | ◐ sector bestaat, machines/onderhoud wel |
| 10 | big tech | ✗ |
| 11 | chips en strategische technologie | ✗ |
| 12 | farmacie | ✗ |
| 13 | zorg | ✗ |
| 14 | banken en kapitaalmarkten | ✅ `bank.js`, `beurs.js` |
| 15 | startups en venture capital | ✗ |
| 16 | media en entertainment | ✗ |
| 17 | sport | ✗ |
| 18 | Foundation | ✅ `foundation.js` |
| 19 | onderwijs | ✗ |
| 20 | onderzoek en wetenschap | ◐ `onderzoek.js` |
| 21 | overheid | ✗ |
| 22–24 | internationale economie, wisselkoersen, centrale banken | ✗ |
| 25 | inflatie uit de economie | ✗ |
| 26 | recessies en bubbels | ◐ `cyclus.js` is gegeven, niet ontstaan |
| 27 | monopolies | ✗ |
| 28 | faillissementen die door de wereld reizen | ◐ `afscheid.js` |
| 29 | grote evenementen als tijdelijke economieën | ✗ |
| 30 | ecosysteemmacht | ✗ |

---

## 4. De grenzen

Deze staan boven elke laag hierboven. Waar een laag ermee botst, vervalt de
laag.

**GEEN EVENT DAT EEN GEVOLG NABOOTST.** Niet `voedselinflatie +8%`, niet
`housingCrash = true`, niet `networkEffect = +20%`, niet `deliveryDelay +2`.
Een slechte oogst verhoogt een grondstofprijs, die bereikt een producent, die
bereikt een groothandel, die bereikt een restaurant, die bereikt een consument.
Wie de uitkomst rechtstreeks schrijft, heeft de economie ervoor niet nodig — en
dan is hij er ook niet.

**DEZELFDE SCHOK RAAKT NIET IEDEREEN GELIJK.** Een energieprijs doet iets
anders bij een aluminiumproducent dan bij een kapper. Een zwakke euro helpt een
exporteur en schaadt een importeur. Eén koersbeweging, geen universele plus of
min. Een factor die overal hetzelfde doet, is een cijfer en geen mechaniek.

**RECESSIES EN BUBBELS WORDEN NIET GESCHREVEN.** Goedkoop krediet → meer
vastgoedvraag → prijzen stijgen → mensen lenen meer omdat het "altijd stijgt" →
bouw trekt aan → banken raken blootgesteld → de stijging stopt → wanbetalingen
→ krediet droogt op → werkloosheid → consumptie daalt. Als dat er niet uit
komt, is de motor niet af — en dan is een crisis-event een pleister.

**HET GELD KOMT TERUG.** Het salaris dat een fastfoodketen betaalt verdwijnt
niet: het wordt huur, boodschappen, OV, een voetbalkaartje, spaargeld. Een
loonstijging is tegelijk hogere kosten voor werkgevers **en** meer koopkracht
voor huishoudens. Zolang loon alleen een kostenpost is, is er geen kringloop.

Dat was de scherpste openstaande fout in laag 3, en `huishoudens.js` heft hem
op — zie §1b. De kringloop is er nu voor **loon**; voor huur, sparen en
uitkeringen nog niet. Hoe de rest van laag 3 eruit hoort te zien staat in
**`HUISHOUDEN.md`**, met het huishouden als eigen actor.

**GEEN SKILL-SCORES.** Niet `chef.skill = 83` maar *negen jaar horeca, drie
jaar leidinggegeven, 682 diensten, twee vestigingsopeningen meegemaakt*. Dat is
al de regel in `loopbaan-profiel.js` en hij geldt hier onverkort.

**EEN FAILLISSEMENT REIST.** Een bedrijf verdwijnt nooit gewoon: werknemers
komen vrij, panden komen vrij, leveranciers verliezen omzet, klanten zoeken
alternatief, banken boeken verlies, concurrenten krijgen kansen, en kennis
verspreidt zich doordat mensen elders gaan werken. Mislukking is economisch
nuttig voor de wereld.

---

## 4b. De ultieme eis

> **Elke macro-uitkomst moet terug te voeren zijn op microgedrag; elke
> microhandeling moet ergens in de macrodata kunnen landen.**

Deze staat boven alle andere. Stijgt de inflatie, dan moet je kunnen terugzoeken
wélke prijzen bewogen. Stijgt de werkloosheid, wélke bedrijven mensen lieten
gaan. Stort de consumptie in, wélke huishoudtypen begonnen te snijden. Groeit een
stad, waar de banen, woningen en investeringen vandaan kwamen.

Van één loonstrook tot het BBP van de wereld — dezelfde werkelijkheid.

Daaruit volgt meteen wat er **niet** mag: een macrogetal dat rechtstreeks
geschreven wordt. Een inflatiecijfer dat niet uit prijzen komt, een
werkloosheidspercentage dat niet uit ontslagen komt, een groeicijfer dat niet uit
transacties komt — dat zijn alle drie hetzelfde als `housingCrash = true`, alleen
met een net jasje aan.

En het geeft je gratis het verschil tussen drie soorten kijkers naar dezelfde
gebeurtenis:

| | ziet |
|---|---|
| speler | *"Waarom zit mijn terras leeg?"* |
| ondernemer | *"Vrij besteedbaar inkomen in mijn wijk is gedaald."* |
| econoom | *"Een arbeidsmarktschok heeft via huishoudbuffers en discretionaire consumptie de lokale diensten geraakt."* |

Zelfde gebeurtenis, drie niveaus van begrip. Dat is niet drie modellen — het is
één keten, op drie hoogtes gelezen.

---

## 4c. Economenmodus

Wat er bovenop diezelfde motor kan staan zodra §4b klopt. Geen academisch model
óver het spel, maar gereedschap om de motor te bestuderen die er al is.

**Schoklaboratorium.** Kloon een wereld. Wereld A blijft gelijk, wereld B krijgt
precies één exogene verandering: energie-aanvoer −20%, rente +2 procentpunt, een
grote werkgever die sluit, een importkanaal dat wegvalt. Vergelijk daarna. Niet
om iets over de echte wereld te beweren, maar om te zien welk mechanisme in déze
motor het verschil maakt. Dat is dezelfde vorm als de supply-shocktoets in
`test/spelketennetwerk.test.js` en de schoktoets in `test/spelhuishouden.test.js`,
maar dan als gereedschap in plaats van als toets.

**Reproduceerbaarheid.** Zelfde zaaiing, zelfde regels, zelfde begintoestand,
zelfde uitkomst — tenzij mensen andere keuzes maken. Dat is er al: de wereld
rekent bij, dus tien maanden in één keer moeten hetzelfde opleveren als tien
maanden los, en toeval hoort in de wereld en niet in de boeken. Experimenten zijn
daardoor letterlijk herhaalbaar.

**Counterfactuals.** *"Wat als leverancier X niet was omgevallen?"* Kloon de
wereld vlak vóór de gebeurtenis, laat hem lopen zonder die schok, vergelijk.

**Causaliteitskaart.** Geen AI die uitlegt waarom, maar een graaf van echte
stromen: *fabriek sluit → loonmassa wijk −8% → horeca-uitgaven −11% → twee
restaurants krimpen → veertien diensten verdwijnen → loonmassa nog −1,2%.* Een
econoom volgt daarmee de transmissieketen zelf.

**En geen enkele score voor "gezonde economie".** Hoge groei kan samengaan met
hoge schuld, woningtekort, ongelijkheid en inflatie; lage groei kan stabiel zijn.
Er komt dus geen `Economy Health: 88`. Geef de feiten, per groep uitgesplitst —
mediaan loon, onderste en bovenste vijfde, werkloosheid per sector, huurdruk,
schuldquote, spaarbuffer — en laat de beoordeling aan wie kijkt. Dat is dezelfde
regel als in `ORGANISATIE.md` (geen bus factor, geen cultuurcijfer) en om dezelfde
reden: een balk om te optimaliseren is geen inzicht.

---

## 5. Hetzelfde Wimbledon, acht schermen

Een evenement is geen sport-feature maar een **tijdelijk economisch
ecosysteem**: hotels, horeca, OV, mediarechten, sponsoractivatie, catering,
security, merchandise. En na afloop verdwijnt die vraag weer — een hotel dat
zich te agressief uitbreidde kan daarna met lege kamers zitten.

Het mooiste is dat iedereen hetzelfde ziet vanuit zijn eigen positie:

| wie | wat hij ziet |
|---|---|
| zestienjarige in de fastfood | *"Wat een drukte. Heel Londen zit vol."* |
| restauranteigenaar | personeelstekort én hogere omzet |
| hotel | bezetting 98% |
| luchtvaartmaatschappij | extra capaciteit nodig |
| broadcaster | miljoenen kijkers |
| sponsor | campagnebereik |
| bank | piek in transacties |
| econoom | tijdelijke vraagschok in hospitality en mobiliteit |

Dat is precies het patroon dat de werklaag al heeft — dezelfde koelstoring, een
andere handelingsruimte per rol — één schaal hoger.

---

## 6. Het einddoel

Op de wereldkaart op Londen klikken en vragen: **waarom was juli 2048 zo
bijzonder?** En Magnaat antwoordt uit feiten:

```
Wimbledon trok 612.000 bezoekers.
Hotelprijzen stegen door schaarste.
Horeca nam 4.821 tijdelijke werknemers aan.
Regionale treinbelasting bereikte recordniveau.
Twee hotelketens breidden capaciteit uit.
Eén ging drie jaar later failliet omdat de vraag niet permanent bleek.
Een cateringbedrijf dat tijdens het toernooi begon groeide later uit tot
landelijke speler.
```

En één van die werknemers begon daar zijn loopbaan.

Daar sluit de cirkel met waar Magnaat begon: één afwasser. Een zestienjarige
begint met een dienblad; twintig speljaren later bestuurt hij een multinational.
Hij hoeft nooit naar een ander soort spel — alleen zijn positie in dezelfde
economie is veranderd.

---

## 7. Waar te beginnen

Niet bovenaan. De volgorde die uit de nulmeting volgt:

1. ~~**De keten sluiten voor wat er al is.**~~ **Staat** — `keten.js`, §1.
   `0%` → `80%`.
2. ~~**Loon dat terugkomt** (laag 3).~~ **Staat** — `huishoudens.js`, §1b.
3. **Energie** (laag 2), omdat hij bijna alles raakt en dus meteen laat zien of
   "dezelfde schok raakt niet iedereen gelijk" werkelijk klopt.

Daarna pas de sectoren die vandaag nog niet bestaan. Een farmaceut bouwen op
een motor waarin goederen uit het niets komen, is een sector bouwen op een
verzinsel.
