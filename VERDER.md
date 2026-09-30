# VERDER.md — FoundationOS: wie na jou komt, begint verder

Opdracht van de eigenaar (30 september 2026): bedenk voor FoundationOS wat RTG
Living World voor reizen is, maar dan voor **werk, leren en de buurt**, met
veiligheid als eerste eis. In een tweede ronde werd het groter dan de buurt:
één lus op Foundation-niveau, met werk, leren en buurt als projecties. De
eigenaar koos daarna uitdrukkelijk voor **eerst meten, dan pas bouwen**, en vroeg
de meter het idee van een universele overgang **kapot te proberen te krijgen** in
plaats van het te bewijzen.

Dit is een richtingsdocument, net als `PLATFORM.md`, `ECONOMIE.md` en `HDI.md`.
Per onderdeel staat erbij of het **staat**, **een stap weg** is, **een besluit
vraagt** of **jaren weg** is. Na deze ronde is er **geen nieuw
Foundation-gedrag gebouwd**. Wat er wel is:

- een meting die zegt welke grammatica de lus draagt en waar die ophoudt;
- twintig wetten en acht ontwerpbesluiten, met per regel wie hem vandaag
  handhaaft;
- de eigenaarbesluiten die de rest blokkeren.

`LEVEN.md` (de mens zelf), `FOUNDATION.md` (de civiele helft),
`CONNECT.md` (het ontdeknetwerk), `HDI.md` (niemand uit beeld) en
`SAMENLEVING.md` (de universele bodem) blijven onverkort gelden. Dit document
voegt er de lus tussen mensen en plekken aan toe, en zegt wat er van een eerder
leven blijft liggen voor het volgende.

## 0. De kern, in een zin

> **Wie na jou komt, begint verder.**

Voor reizen was de belofte *leave the world richer*. Voor de Foundation is het
smaller en scherper: wat iemand heeft uitgezocht, geleerd of opgebouwd, hoeft de
volgende niet opnieuw uit te vinden. Dat geldt voor de weg naar werk, voor een
buurtmaaltijd die wél werkt en voor een huiswerkklas die na zes weken omviel.

En de zin eronder, die het ontwerp stuurt:

> **Een systeem waarin de samenleving een geheugen krijgt zonder haar inwoners
> tot dataobjecten te maken.**

De nuance zit in wet 20: wie na jou komt, moet verder **kúnnen** beginnen. Niemand
is verplicht verder te gaan, en niemand is verplicht iets achter te laten
(wet 18).

## 1. De lus

```
WERELD → MOGELIJKHEID/BEHOEFTE → OVERGANG → VOORWAARDEN → VOORBEREIDEN
       → BEVESTIGEN → UITVOEREN → BEWIJZEN → RESULTAAT → ERVARING
       → KENNIS → OVERDRAGEN → LOKAAL AANPASSEN → TERUGVLOEIEN → WERELD
```

**Werk, leren en buurt zijn projecties op deze lus, geen eigenaren ervan.** Een
`BUURT.md` zou per ongeluk de eigenaar worden van begrippen die Academy, WorkOS en
de Foundation zelf ook nodig hebben. Daarom staat de lus hier, en daarom is de
eerste vraag of er onder die lus één object zit (par. 2).

| Station | Waar het vandaag woont | Stand |
|---|---|---|
| Wereld: wat er gaande is | `kern/connect/bron-lokaal.js` (posterveilig), `kern/stadsweefsel/` | **staat** als bron, **een stap weg** als scherm |
| Mogelijkheid / behoefte | knelpunt-aanvoer (`aanvoer-werk.js`, `aanvoer-opleiding.js`), `/api/rtf/knelpunt` | **staat** |
| Overgang | zie par. 2: er is geen universele | **gemeten** |
| Voorwaarden, voorbereiden | per domein (leerhuis, vakbewijs, projecten, vrijwilligers) | **staat**, domeineigen |
| Bevestigen | vier-ogenregels in leerhuis, projecten, kennis; ouders bij activiteiten | **staat** waar het een poort is, **ontbreekt** elders (par. 2.3) |
| Uitvoeren | domeinen | **staat** |
| Bewijzen | VOG, beoordeling, vakbewijs, indicatoren, kennisbron | **staat** in 6 van 14 overgangen |
| Resultaat, ervaring | leerdossier en naklank (`kern/connect/`) | **staat** |
| Kennis | leerhuis-kennismachine (`acties-kennis.js`), blauwdruk-`geleerd` | **staat** binnen een organisatie |
| Overdragen | blauwdruk tussen steden (`rtfos/netwerk.js`) | **staat** voor projecten, **een stap weg** voor een mens |
| Lokaal aanpassen | `neemOver()`: begint op idee, budget nul, eigen goedkeuring | **staat** |
| Terugvloeien | niets | **geen drager** (par. 2, overgang `upstream`) |
| "Verder": wat jouw bijdrage deed | de overdrachtstreden `gebruikt` en `doorgegeven` | **een stap weg**, besluit B5 |

## 2. De meting: is er één overgang?

`npm run overgangsvorm` (`OVERGANGSVORM.json`, rekening in
`scripts/lib/overgangsrekening.js`).

### 2.1 Wat hij meet

<!--getal:overgangsvorm.overgangen-->16<!--/getal--> overgangen. Het zijn de dertien van het voorstel, plus de
mislukte poging in drie stappen (poging → gestopt → les → kennisvoorstel). Een
mislukking is namelijk niet automatisch kennis. Van die zestien hebben er
<!--getal:overgangsvorm.metDrager-->14<!--/getal--> een drager in de code. Alle zestien zijn gemeten tegen de veertien
dimensies die de eigenaar vroeg:

`van`, `naar`, `voorwaarden`, `actor`, `bevoegdheid`, `actie`, `bewijs`,
`uitkomst`, `blokkade`, `terugweg`, `kennis`, `overdracht`, `privacyklasse` en
`menselijke_bevestiging`.

Per cel staat een van drie standen. Die drie betekenen niet hetzelfde:

- **poort**: de drager **weigert** als hier niet aan is voldaan. Dit is de enige
  stand waar de mutatieproef op rust.
- **draagt**: de drager legt het vast of gebruikt het, maar weigert er niet op.
- **afwezig**: de drager kent het niet, met de reden erbij.

Elke `poort` en `draagt` heeft een **citaat dat letterlijk in de code moet
staan**. Commentaar telt daarbij niet mee, want een zin in een toelichting is een
belofte en geen handhaving. Een weigerzin telt wel, want die staat in een
tekenreeks. Een citaat dat verdwijnt heet **rot** en telt als afwezig. Dat is de
goede kant om fout te zitten: het verlaagt de kern en kan dus nooit een gedeelde
vorm verzinnen.

De indeling blijft een **oordeel**. Het citaat bewijst dat de code er staat, niet
dat die code déze dimensie is. Daarom staan er vier assen, en die worden nooit
opgeteld:

- **A. De dimensies**: de verklaarde standen. Hierop rust de conclusie.
- **B. De woorden**: dezelfde vraag, maar dan lexicaal over de namen in de code,
  met graad `vermoed`. Elke onenigheid tussen A en B wordt gemeld, en een mens
  heeft er een reden bij geschreven. Er zijn er <!--getal:overgangsvorm.onenig-->31<!--/getal-->, en ze zijn alle
  31 verklaard. Deze as heeft zich al terugbetaald: de eerste indeling zette
  `oplossen.privacyklasse` op afwezig, en de woordenas vond dat een melder bij de
  klaarmelding alleen zijn **eigen** tekst ziet, niet die van zijn buren.
- **C. De vorm**: delen de dragers velden? Dat is de Asset-vraag, gemeten met de
  lezer van `scripts/objectmodel.js`.
- **D. De proeven**: de echte modules gedraaid met een verzonnen context, en
  elke proef heeft een besturing die juist wél moet slagen.

### 2.2 De uitslag

```
                  van naa voo act bev act bew uit blo ter ken ove pri men
  werk             P   d   P   P   P   d   .   d   d   d   .   d   .   P
  leren            P   d   P   P   P   d   P   d   d   d   .   .   d   P
  bevoegd          P   d   P   P   P   d   P   d   d   d   .   .   d   d
  buurtidee        P   d   P   P   P   d   .   d   d   d   .   .   .   P
  blauwdruk        P   d   P   d   P   d   P   d   d   .   P   d   d   .
  deelnemen        P   d   d   d   P   d   P   .   d   d   .   .   P   P
  mentor           P   d   P   d   P   d   P   d   d   d   .   d   .   P
  melden           .   d   P   P   .   d   .   d   d   .   .   d   d   .
  oplossen         P   d   P   P   P   d   .   d   d   d   .   d   d   .
  kennisvoorstel   .   d   P   P   P   d   d   d   d   .   P   d   .   .
  kennis-actief    P   d   P   P   P   d   P   d   d   d   P   d   .   P
  fork             P   d   P   d   P   d   .   d   d   .   d   d   d   .
  gestopt          P   d   .   P   P   d   .   d   d   .   .   .   .   .
  les              P   d   P   d   P   d   .   d   d   .   P   .   .   .
  upstream        -- geen drager
  les-voorstel    -- geen drager

  P = poort (weigert), d = draagt, . = afwezig
```

**GEEN UNIVERSELE OVERGANG GEVONDEN.** Er zijn <!--getal:overgangsvorm.dilemmas-->7<!--/getal--> dimensies die ergens een
poort zijn en elders afwezig: `van`, `voorwaarden`, `bevoegdheid`, `bewijs`,
`kennis`, `privacyklasse` en `menselijke_bevestiging`. Voor elk van die zeven
heeft een gemeenschappelijke vorm twee uitgangen, en allebei zijn ze fout:

- **Weglaten.** Dan slaagt een overgang die vandaag weigert ten onrechte. Dat is
  niet uitgerekend maar gedraaid (par. 2.4).
- **Overal verplichten.** Dan moet een overgang die de dimensie niet kent een
  bewijs, een bevoegdheid of een les **verzinnen**. Een verzonnen `bewijs` op een
  melding is een bewering zonder grond.

**De families houden ook niet.** De hypothese (toestand, kennis, overdracht)
onderscheidt zich wel: elke familie lijkt intern meer op zichzelf dan op de rest.
Maar geen enkele familie is dilemmavrij. Ook de drie groepen die de data zelf
vormt, zonder de hypothese te kennen, zijn dat niet. De meter had het wél gezegd
als het anders was: hij kent de uitkomsten `FAMILIES` en `ANDERE_FAMILIES`, en
zijn zelfijking laat zien dat hij op twee overgangen die samengaan `UNIVERSEEL`
zegt (`test/overgangsvorm.test.js` toets 1).

De leerzaamste familie is de kleinste. `blauwdruk` en `fork` delen elf
dimensies en breken op **één**: `bewijs`. Dat is geen toeval maar het ontwerp.
Het bewijs hoort bij het **delen** ("zonder cijfers is dit een idee en geen
blauwdruk") en niet bij het **overnemen**, want wie overneemt begint bij idee en
loopt zijn eigen keten. Zelfs twee overgangen uit hetzelfde bestand, over
hetzelfde ding, horen dus niet dezelfde poort te dragen.

**De vorm-as zegt hetzelfde**: 0 velden staan in alle overgangen. Het aandeel in
precies één overgang is lager dan bij de andere vormmetingen
(<!--getal:overgangsvorm.inEenPct-->47.8<!--/getal-->%), maar dat komt doordat dragers gedeeld worden:
`netwerk.js` draagt zowel `blauwdruk` als `fork`, en het leerhuis draagt er
vier. Een bestand deelt zijn velden met zichzelf. Het register zet die paren
erbij in `vorm.gedeeldeDragers`.

### 2.3 Wat er wel overblijft: de kleine grammatica

**De kern** staat in alle overgangen. Het zijn er
<!--getal:overgangsvorm.kern-->4<!--/getal-->: `naar`, `actor`, `actie` en `blokkade`. *Iemand doet iets, er
is een nieuwe stand, en een weigering zegt waarom.* Dat is dezelfde uitslag als
`KETENVORM.json`: wat ketens werkelijk delen, gaat over de **machine** en niet
over het domein.

**De bijna-kern** telt dimensies die op hoogstens twee na overal staan, met de
uitzonderingen erbij. Die uitzonderingen dragen het antwoord:

| Dimensie | Aanwezig | Niet in | Met opzet? |
|---|---|---|---|
| `bevoegdheid` | 13/14 | `melden` | ja: een melding vraagt geen recht |
| `voorwaarden` | 13/14 | `gestopt` | nee: stoppen vraagt niets, ook geen les (par. 3) |
| `uitkomst` | 13/14 | `deelnemen` | nee: inschrijven en inchecken laten geen auditregel na |
| `van` | 12/14 | `melden`, `kennisvoorstel` | ja: een open ingang begint uit het niets |

Er zijn dus twee soorten overgangen, en het onderscheid is niet werk, leren of
buurt:

- Een **bestuurde overgang** heeft een begintoestand, voorwaarden en een recht.
- Een **open ingang** (melden, een kennisvoorstel indienen) mag juist niets
  vragen. Een melding die een recht eist, sluit de mens buiten die het probleem
  ziet.

**Wat werkelijk splijt zijn de domeinpoorten**: `bewijs` (poort in 6, afwezig in
7), `kennis` (4 en 9), `menselijke_bevestiging` (6 en 7) en `privacyklasse` (1 en
7). Die horen bij het domein dat weet waarom. Een VOG hoort bij werk met
kinderen, en niet bij een melding over een kapotte schommel.

**De conclusie voor de bouw is daarom een verklaring van werkwoorden en geen
`Overgang`-objecttype**. Het is dezelfde uitslag die dit huis bij `Asset`,
`Koopbaar`, `Career`, `Moment`, `Manier`, `Ontdekking` en de planningsgrond al
had. Er komt geen `overgangen`-tabel en geen motor die overgangen uitvoert. Wat
wel verdedigbaar is, staat hieronder, en geen van beide is in deze ronde gebouwd:

- een **gedeelde vorm voor de kern**: wie deed het, welke nieuwe stand, en waarom
  een weigering. Die bestaat al half als `kern/envelop.js` plus de huisregel dat
  een weigering een reden draagt;
- een **verklaring per overgang** van welke domeinpoorten hij heeft, zodat een
  scherm "wat ontbreekt er nog?" kan tonen **zonder** zelf te beslissen. Dat is de
  vorm van `kern/appstore/machtigingen.js` en `Koopbaar`.

### 2.4 De mutatieproef, op de echte code

De vraag was: haal `bewijs` of `bevoegdheid` uit de gemeenschappelijke vorm, en
bewijs welke bestaande overgang dan ten onrechte kan slagen. De proef zet een
**universele motor** neer die alleen de kern kent, en geeft hem en de echte
drager hetzelfde verzoek:

| Verzoek | Echte drager | Universele motor | Besturing |
|---|---|---|---|
| blauwdruk zonder gemeten indicator | geweigerd: *"Zonder cijfers is dit een idee en geen blauwdruk."* | **geslaagd** | met indicator: geslaagd |
| huiswerkklas koppelen zonder VOG | geweigerd: *"… is een geldige VOG verplicht."* | **geslaagd** | met VOG: geslaagd |
| koppelen zonder het recht `vrijwilliger.beheren` | geweigerd | **geslaagd** | met recht: geslaagd |

Drie overgangen slagen ten onrechte. De besturing slaagt telkens, en dat moet ook:
een poort die altijd dicht zit, laat een weigering zien die niets bewijst.

Over alle veertien dimensies noemt het register per dimensie welke overgangen ten
onrechte slagen als de dimensie wegvalt. Voor `bevoegdheid` zijn dat er 13, voor
`bewijs` 6, en voor `menselijke_bevestiging` 6. Onder die 6 vallen `werk`
(niets wordt vastgelegd zonder keuze), `leren` (niemand beoordeelt zichzelf) en
`kennis-actief` (wie een kennisversie schrijft, keurt hem niet zelf goed).

### 2.5 Wat deze meting NIET zegt

- Of een overgang **goed werkt**. Dat is een ketenproef (`tafelproef.js`,
  `ritproef.js`), en die bestaat voor deze lus niet.
- Of de routes eromheen hetzelfde doen als de modules. De proeven draaien de
  **modules** met een verzonnen context; de deur, de sessie en de montage zitten
  er niet in (LAT-regel 17).
- Of de indeling juist is. Ze is nagetrokken, met een tweede as en een reden per
  onenigheid, maar een ander mens kan een cel anders lezen. Dat hoort dan een
  wijziging in `scripts/overgangsvorm.js` te zijn met de reden erbij, en niet een
  andere zin in dit document.

## 3. De mislukte poging

```
POGING → GESTOPT → LES (waarneming) → KENNISVOORSTEL → ACTIEVE KENNIS
                        ↑
                        hier miste een toestand
```

**De invariant `gestopt ≠ blauwdrukbron` staat en is gedraaid.**
`rtfos/netwerk.js` laat alleen `actief` en `afgerond` toe. De proef
`gestoptGeenBlauwdrukbron` geeft een gestopt project met een gemeten indicator:
dat wordt geweigerd. Het actieve project met dezelfde indicator slaagt.

**Wat ontbreekt is de les.** Stoppen vraagt vandaag geen reden en geen les
(overgang `gestopt`). De blauwdruk weigert gestopte projecten, en dat is terecht.
Maar daardoor is er **geen enkele plek** waar een gestopte buurtpoging iets
achterlaat. Alleen het Living Lab draagt "gestopt → les" (`livinglab/cyclus.js`:
*"Waarom dit besluit? Juist bij "gestopt" is dat de waardevolle regel."*), en dat
geldt voor onderzoek en niet voor buurtprojecten. Daarnaast wordt een les nergens
een kennisvoorstel (overgang `les-voorstel`, geen drager).

**De extra toestand die de eigenaar zag, klopt met de meting**: een mislukking is
eerst een **waarneming** en pas na gronding **kennis**. Het voorstel hieronder is
gespecificeerd en **niet** gebouwd.

| Stap | Wat hij draagt | Wat hij niet mag |
|---|---|---|
| gestopt | een verplichte reden, zoals het Living Lab die al eist | een blauwdruk worden |
| les | wat er gebeurde, wat men dacht dat de oorzaak was, en de graad `vermoed` | als waarheid reizen; één slechte avond is geen patroon |
| kennisvoorstel | de les plus herkomst ("uit een gestopte poging") | zichzelf goedkeuren |
| actieve kennis | dezelfde vier-ogenregel en bron-eis als `kennis-actief` | automatisch in een blauwdruk terechtkomen |

Een les mag zich bij een **nieuwe poging** melden als **waarschuwing**, met de
graad erbij. Een les wordt nooit een sjabloon.

## 4. De grondwet: twintig wetten

Per wet de stand. Waar de stand `gehandhaafd` of `deels` is, trekt de meter het
citaat na (ratel `overgangCitaatRot`, op nul).
`test/overgangsvorm.test.js` zakt zodra deze tabel iets anders zegt dan het
register.

| # | Wet | Stand | Wie handhaaft |
|---|---|---|---|
| 1 | De mens is geen route-object. Een route ondersteunt een mens en definieert hem niet. | deels | `knelpunt/aanvoer.js` weigert een vondst met een gegeven over de mens |
| 2 | Iedere route heeft alternatieven. Geen systeemgegenereerde lotsbestemming. | document | niemand |
| 3 | Een blokkade is informatie, geen oordeel. | document | niemand; het huis doet het wel (`blokkade` staat in de kern), maar niets dwingt het af |
| 4 | Een vondst is geen recht, bevoegdheid of geschiktheid. | deels | `knelpunt/aanvoer.js`: een vondst kent de mens niet, dus kan hij geen geschiktheidsoordeel zijn |
| 5 | Een rol verleent geen competentie; competentie verleent geen authority. | gehandhaafd | `leerhuis/brug.js`: *"Geschiktheid is geen bevoegdheid"* |
| 6 | De echte wereld is leidend. | gehandhaafd | `rtfos/netwerk.js`; maar alleen waar bewijs een poort is (par. 2.3) |
| 7 | Persoonlijke ervaring wordt nooit automatisch collectieve kennis. | deels | `leerhuis/acties-kennis.js`: vier ogen, binnen één organisatie |
| 8 | Alleen vrijwillig vrijgegeven en veilig geabstraheerde kennis mag reizen. | deels | het abstraheren wel (`netwerk.js`), het vrijwillige niet: een blauwdruk deelt wie het recht heeft, niet de mensen van wie de ervaring was |
| 9 | Mislukking mag kennis worden, maar niet automatisch een blauwdruk. | deels | de tweede helft staat (par. 3), de eerste niet |
| 10 | Een fork erft methode, nooit deelnemers, toestemming, geld of authority. | gehandhaafd | `netwerk.js` `neemOver()`: idee, budget nul, eigen goedkeuring |
| 11 | AI stelt voor; bevoegde mensen beslissen waar dat vereist is. | deels | `stuur/beleid.js` kent `voorstel`; voor deze overgangen is er geen AI-pad om te begrenzen |
| 12 | Foundation optimaliseert uitvoerbaarheid, niet gehoorzaamheid. | document | er is geen optimizer |
| 13 | Aandacht is geen impact. | gehandhaafd | `connect/portfolio.js`: `bereikt` komt er niet in |
| 14 | Geen mens of buurt krijgt een waardescore. | deels | `scripts/lib/cijferopmens.js` (CAR-05) voor een mens; niets voor een buurt |
| 15 | Het systeem leert van overgangen, niet van surveillance. | gehandhaafd | `connect/horizon.js` `GEEN_SIGNAAL` |
| 16 | Wie een probleem kan oplossen, krijgt minimaal noodzakelijke informatie. | deels | `rtfos/gemeente.js` `K = 5`: celveilig, niet queryveilig (par. 6) |
| 17 | Iedere materiële aanbeveling heeft herkomst. | deels | `knelpunt/aanvoer.js` eist `herkomst`; daarbuiten niets |
| 18 | Teruggeven blijft vrijwillig. | document | niemand |
| 19 | Vergeten moet mogelijk blijven. | eigenaarbesluit | B7 |
| 20 | Wie na jou komt, moet verder kúnnen beginnen, niet verplicht verder moeten gaan. | document | een richtingsregel |

Opgeteld zijn er 5 gehandhaafd, 9 deels, 5 alleen document en 1 wacht op de
eigenaar. **Wet 2 en wet 3 zijn de goedkoopste om een handhaver te geven**: het
huis doet ze al bijna overal, en een toets die elke weigering zonder reden laat
zakken, is dezelfde vorm als `test/aicontext-allowlist.test.js`.

## 5. Acht ontwerpbesluiten

Deze komen uit de correcties op het eerste voorstel, en de eigenaar heeft ze tot
harde eisen gemaakt.

| # | Besluit | Stand |
|---|---|---|
| B1 | **Aggregatie is queryveilig, niet alleen celveilig.** Vaste views, minimumcel, complementaire onderdrukking en tijdvensters, en geen vrije gemeentelijke OLAP over gevoelige dimensies. | te-bouwen: minimumcel en vaste view staan, de rest niet (par. 6) |
| B2 | **Foundation zet financiële handelingen klaar, maar wordt geen betaalroute.** De organisatie betaalt via haar eigen geld- en arbeidsketen. | deels: een gift komt binnen over RTG Pay (`gift-betalen.js`, `partnerIn`); er is geen pad waarlangs de Foundation een mens betaalt, en dat moet zo blijven |
| B3 | **Werk, leren, vrijwillig, oefenen en helpen zijn afdwingbare standen, geen labels.** Oefenen vraagt begrenzing, begeleiding en een einde, en misclassificatie eindigt fail-closed in WEIGER. | te-bouwen: er zijn twee van de vijf (vrijwilliger, dienstverband), zonder regel ertussen |
| B4 | **Geen funnelmetriek op menselijke ontwikkeling.** Bezoeker → deelnemer → mentor mag als vorm worden gemeten (deze meter doet dat), maar nooit als conversie van mensen. | document |
| B5 | **VERDER is onherleidbaar.** Geen plaats, persoon of exacte tijd; vertraagd; alleen extern bewezen `gebruikt` en `doorgegeven`; geen oplopende teller. | te-bouwen: de treden zijn eenmalig (`tredenlijst.js`), het scherm bestaat niet |
| B6 | **Intentie blijft privé.** Een organisatie ziet iemand pas na diens expliciete overdracht. | document: `deelnemen` laat nu het kantoor inschrijven; de mens draagt zijn eigen voornemen nergens over |
| B7 | **Vergeten tegenover aangenomen collectieve kennis.** | **eigenaarbesluit** (OWNER_DECISION_REQUIRED) |
| B8 | **"Waarom zie ik dit?"** toont de gebruikte en de bewust níét gebruikte factoren. | deels: Connect houdt `GEEN_SIGNAAL` bij en de mixer zegt per motor waarom hij niet kijkt; het scherm bestaat niet |

**Over B7** staan de twee opties hieronder. Een technische keuze zou er een van
beide zijn zonder dat iemand hem gemaakt heeft:

- **Alleen de naam eraf.** De kennis blijft, want anderen hebben erop gebouwd, en
  de herkomst wordt "een deelnemer". Daar staat tegenover dat een les soms zo
  specifiek is dat hij zonder naam nog herkenbaar is.
- **De kennis ook weg.** Vergeten is vergeten. Daar staat tegenover dat een fork
  die erop leunt dan een gat krijgt, en de volgende weer opnieuw begint.

## 6. Veiligheid

Dit zijn de tien grenzen uit het eerste voorstel. Ze gelden bovenop LIFE.md
par. 4, HDI.md par. 5 en PLAATS.md, en hebben voorrang op elke functie die ermee
botst.

1. **Geen mensen op een plek.** Het beeld toont aanbod en vrije plekken, nooit wie
   waar is. Een groepsgetal verschijnt alleen bij openbare activiteiten, met een
   ondergrens en vertraging, en nooit bij kinderen. *Een coördinaat verlaat het
   toestel niet* (PLAATS.md).
2. **Gevoelige plekken bestaan niet op de kaart.** Opvang, vrouwenopvang, azc, ggz,
   verslavingszorg en de voedselbank worden gevonden via de hulpwijzer, en die
   laat geen spoor na.
3. **Het geheugen meldt dingen, geen mensen.** De bron is posterveilig
   (`bron-lokaal.js`) en het stadsweefsel kent geen inwoners.
4. **Kinderen en jongeren.** Nooit openbaar op naam, geen progressie
   (`progressieMag`), en nooit rechtstreeks bereikbaar voor een onbekende
   volwassene.
5. **Wie met kinderen of kwetsbaren werkt, is gecontroleerd.** Dat staat al als
   grendel: `vrijwilligers-inzet.js` weigert een koppeling zonder geldige VOG.
   Het is gedraaid in par. 2.4.
6. **Een kring is geen contactmarkt.** Mensen vinden elkaar via een organisator,
   en een eerste ontmoeting is openbaar.
7. **Werk zonder uitbuiting.** Alleen toegelaten zaken, rode vlaggen hardop, geen
   pas kopen om te mogen werken, en een vondst is geen recht.
8. **Snel weg.** De uitstapknop en de neutrale titel uit HDI.md.
9. **"Ik voel me niet veilig" is een ondergrens** voor elk account, gratis.
10. **Geen cijfer op een buurt of een mens.**

**Wat de meting aan veiligheid vond, en wat vandaag niet klopt.** De gemeente ziet
hulpvragen per buurt, en buurten onder de vijf worden samengevoegd tot "overige
buurten". Valt er **precies één** buurt onder de drempel, dan verschijnt haar
exacte aantal onder "overige buurten (1)". De gemeente kent haar eigen buurten en
weet dus welke ontbreekt (proef `buurtenQueryveilig`: met één kleine buurt lekt
het, met twee niet). Het voorbeeld dat `gemeente.js` zelf in zijn kop gebruikt om
de drempel uit te leggen (*"In de Zeewijk zijn twee mensen geholpen met
schuldhulp"*), komt er zo alsnog uit. Dat is **B1** in één regel code, en het is
**niet** gerepareerd in deze ronde, omdat er geen gedrag zou veranderen. De
kleinste reparatie is complementaire onderdrukking: onderdruk bij één kleine buurt
de op één na kleinste mee, of laat het aantal weg.

## 7. Wat de meting verder vond

Geen van deze bevindingen is in deze ronde gerepareerd. Elk staat hier met de
graad erbij.

| # | Bevinding | Waar | Graad |
|---|---|---|---|
| V1 | Een kleine buurt lekt haar exacte aantal naar de gemeente (par. 6). | `rtfos/gemeente.js` `buurten()` | **bewezen**: gedraaid |
| V2 | `sluitbaar` in de klassen van RTG Service heeft **geen enkele lezer**. Het commentaar ernaast verwijst naar een `sluit()` in `zaak.js` die niet bestaat, dus een klacht die "niet sluitbaar" is, kan gewoon op klaar. | `service/klassen.js` | **gemeten**: nul lezers |
| V3 | Het besluit "gestopt" in het Living Lab neemt de naam van de beslisser uit het **verzoek** (`b.door`) en niet uit de sessie, terwijl de sessie wel wordt meegegeven. AUTHORITY.md: de actor van een auditregel komt uit de sessie. | `livinglab/cyclus.js` `besluitZet` | **gemeten** |
| V4 | Niets toetst dat wie een vakbewijs aftekent niet de betrokkene zelf is. | `vakbewijs-aftekenen.js` | **vermoed**: vraagt een kantoormens met een eigen vakbewijs |
| V5 | Inschrijven en inchecken bij een activiteit laten geen auditregel na; alleen afmelden doet dat. | `rtfos/activiteiten-deur.js` | **gemeten** |
| V6 | Het leerhuis (bewezen competentie) en persoonseis/vakbewijs (afgetekende bevoegdheid) zijn niet verbonden. ACADEMY.md par. 5 laat dat open. | `leerhuis/brug.js`, `persoonseis.js` | **gemeten** |
| V7 | Een verbetering stroomt nooit terug naar de blauwdruk waar een project uit kwam. `uitBlauwdruk` wordt nergens gelezen. | `rtfos/netwerk.js` | **gemeten** |
| V8 | Een gestopt RTF-project laat geen les achter. | `rtfos/projecten-besluit.js` | **gemeten** |

V1 tot en met V5 zijn gebreken in bestaande code. V6 tot en met V8 zijn gaten in
de lus.

## 8. Namen

- **Bezet:**
  - `Pulse`: een sociale feed.
  - `moment`: zesvoudig.
  - `signalen`, `weerklank` en `naklank` zijn allemaal in gebruik.
  - `weefsel` is het stadsweefsel.
  - `herkomst` heeft zeven modules; de functie voor de mens heet daarom
    **Waarom zie ik dit?**
  - `overgang`: 113 bestanden, onder meer de overgangstabel van de
    contractmotor. In code krijgt het een voorvoegsel.
- **Bezet met precies de goede betekenis:** `blauwdruk` (`rtfos/netwerk.js`).
  Uitbreiden, geen tweede.
- **Vrij:** `buurtgeheugen`, `Gaande` (het beeld van wat er speelt) en
  `overgangsvorm`.
- **`verder` is geen bruikbare codenaam.** Het woord staat als gewone Nederlandse
  tekst in 269 kernbestanden. Het is de naam van dit document en van de belofte;
  een scherm dat het toont, krijgt in code een eigen naam, gemeten voordat het
  gebouwd wordt.

## 9. Wat er klaar is, en wat niet

**Klaar in deze ronde.** Het huis weet nu aantoonbaar vier dingen:

- welke grammatica de lus draagt: de kern van vier, plus de bijna-kern met twee
  opzettelijke uitzonderingen;
- waar die grammatica ophoudt: zeven domeinpoorten;
- welke van de twintig wetten al technisch worden gehandhaafd;
- welk eigenaarbesluit blokkeert (B7).

Drie ratels houden dat vast: `overgangenGemeten` omhoog, en `overgangCitaatRot`
en `overgangWoordenOnverklaard` omlaag, alle drie geijkt in
`test/meterijk.test.js`.

**Niet gebouwd:**

- een `Overgang`-object;
- een scherm;
- de les na een gestopte poging;
- een reparatie van V1 tot en met V8.

**Wat hierna komt, wordt bepaald door de meting en niet door de wens.** De
gedeelde vorm hield niet, dus er wordt geen primitief gebouwd. De families hielden
ook niet, dus er wordt ook geen familieprimitief gebouwd. De kandidaten voor de
eerste implementatieronde zijn allemaal klein, en de keuze is aan de eigenaar:

1. **V1 dichten** (B1, één functie). Dit is de enige bevinding die vandaag een
   mens raakt die er niet om vroeg.
2. **De les na een gestopte poging** (par. 3). Die sluit de mislukkingslus en
   verandert niets aan wat er al staat.
3. **Wet 3 een handhaver geven**: een toets die elke weigering zonder reden laat
   zakken. `blokkade` staat al in de kern, dus hij kost vrijwel niets aan
   reparaties.
4. **V2, V3 en V5**: drie kleine gebreken in bestaande code, elk met een eigen
   toets.
