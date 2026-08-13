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

**Dat verschil is de stand van vandaag.** Zonder contract is de inkoop van een
zaak een percentage van zijn eigen omzet (`stap.js`): er gaat geen euro naar
een leverancier, ook niet als die op het kavel ernaast staat met capaciteit
over. De keten bestaat als **mogelijkheid** en niet als **structuur** — en
zolang dat zo is, raakt een leverancier die omvalt niemand.

Dat is niet erg als je het weet. Het is erg als je het niet weet.

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
| 3 | mensen en huishoudens | ◐ loon wordt betaald, maar verdwijnt daarna |
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
voor huishoudens. Zolang loon alleen een kostenpost is, is er geen kringloop —
en dat is de scherpste openstaande fout in laag 3.

**GEEN SKILL-SCORES.** Niet `chef.skill = 83` maar *negen jaar horeca, drie
jaar leidinggegeven, 682 diensten, twee vestigingsopeningen meegemaakt*. Dat is
al de regel in `loopbaan-profiel.js` en hij geldt hier onverkort.

**EEN FAILLISSEMENT REIST.** Een bedrijf verdwijnt nooit gewoon: werknemers
komen vrij, panden komen vrij, leveranciers verliezen omzet, klanten zoeken
alternatief, banken boeken verlies, concurrenten krijgen kansen, en kennis
verspreidt zich doordat mensen elders gaan werken. Mislukking is economisch
nuttig voor de wereld.

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

1. **De keten sluiten voor wat er al is.** Inkoop die langs een aanwezige
   leverancier komt, ook zonder contract — dan gaat `0%` omhoog en heeft
   omvallen gevolgen. Dit is de kleinste stap met het grootste effect, want
   alles hierna leunt erop.
2. **Loon dat terugkomt** (laag 3). Zonder kringloop is er geen macro-economie,
   alleen een optelsom van bedrijven.
3. **Energie** (laag 2), omdat hij bijna alles raakt en dus meteen laat zien of
   "dezelfde schok raakt niet iedereen gelijk" werkelijk klopt.

Daarna pas de sectoren die vandaag nog niet bestaan. Een farmaceut bouwen op
een motor waarin goederen uit het niets komen, is een sector bouwen op een
verzinsel.
