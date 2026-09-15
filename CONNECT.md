# Foundation Connect — het ontdeknetwerk van FoundationOS

*Werknaam. De publieke naam moet eerder klinken als ontdekken en leven dan als
onderwijs; op het scherm heet hij vandaag **Ontdekken**.*

Een sociaal ontdekkingsnetwerk waar entertainment, kennis, creativiteit, echte
ervaringen en menselijke verbinding in één lus zitten. **Je komt omdat het leuk
is. Je blijft omdat je nieuwsgierig wordt. Je gaat weg met iets wat je hebt
geleerd, gemaakt, gedaan of betekend.**

Lees dit document vóór je iets bouwt waarmee een mens hier iets ontdekt, leert,
maakt of doorgeeft. `LIFE.md` par. 4 en `FOUNDATION.md` par. 5 staan er onverkort
boven; wat hier staat komt daar bovenop.

---

## 0. De meting die vooropgaat

De dragende bewering van het ontwerp is dat vrijwel iedere functie in dezelfde
lus terechtkomt:

> ONTDEK → BEGRIJP → DOE → MAAK → DEEL → VERBIND → HELP → GROEI → ONTDEK

Dat is exact de vorm waarin `Asset`, `Koopbaar`, `Moment`, `Career` en `Manier`
alle vijf al een keer zijn gesneuveld, dus hij is **gemeten** en niet aangenomen:
`npm run connectlus` (`CONNECTLUS.json`), op de lezer van `scripts/objectmodel.js`
— een tweede parser zou de vergelijking met die vijf metingen waardeloos maken.

Over **<!--getal:connectlus.domeinen-->23<!--/getal--> ontdekkingsdomeinen**:

| | |
|---|---|
| werkwoorden in **álle** domeinen | **0** van 8 — ook `maak` niet (21/23) |
| domeinen die de lus **rond** maken | **2** van 23 |
| verschillende combinaties | **<!--getal:connectlus.combinaties-->22<!--/getal-->** over evenveel domeinen |
| zeldzaamste werkwoord | **`begrijp`, <!--getal:connectlus.begrijp-->5<!--/getal--> van 23** |

En de vorm eronder, over de 18 domeinen met iets bewaards: **<!--getal:connectlus.inAlle-->0<!--/getal-->** van 496 velden
in alle domeinen, **0** in zelfs maar de helft, **<!--getal:connectlus.domeineigenPct-->87.9<!--/getal-->%** in precies één.
Platformbreed is dat 71% (`OBJECTMODEL.json`) — de ontdekkingsdomeinen zijn dus
*minder* verwant dan een willekeurige doorsnede van dit huis.

**Lees deel A nooit zonder deel D.** De twee domeinen die alle acht werkwoorden
halen zijn precies de twee grootste (`kern/spellen` 92 bestanden, `kern/rtfos`
64): ze halen de acht door hun omvang en niet door hun vorm. Dat is dezelfde
hub-vertekening waar `MACHINEDEKKING.json` een keer op is gezakt, en daarom staat
de bestandstelling per domein in de uitslag.

**Daaruit volgt de hele architectuur.** Er komt geen `Ontdekking`-objecttype, geen
contenttabel en geen tweede feed. Wat overleeft zijn twee vormen die dit huis al
kent:

1. een **verklaring van werkwoorden** (de vorm die `COMMERCE.md` voor `Koopbaar`
   koos) — `server/kern/connect/werkwoordlijst.js` + `lus.js`;
2. een **projectie met etiketten** (de vorm van `kern/levensgraaf/graaf.js` en
   `kern/knelpunt/aanvoer.js`) — `server/kern/connect/ontdekking.js`.

### 0.1 Het getal dat het product stuurt

`begrijp` is het zeldzaamste werkwoord van het huis. De stap waar de hele lus op
draait — iemand drukt *waarom?* en krijgt uitleg op zijn niveau — is precies de
stap die hier vandaag bijna nergens bestaat. **Foundation Connect bouwt dus geen
tweede feed; hij vult de naad die gemeten is.** Een professor publiceert één
uitleg; een kind van negen krijgt een kindvriendelijke, een student de formules,
een anderstalige zijn eigen taal. Dat is krachtiger dan miljoenen losse lessen
maken, en het is de enige reden dat deze laag mag bestaan naast wat er al staat.

---

## 1. De acht werkwoorden

`server/kern/connect/werkwoordlijst.js`. Elk werkwoord draagt een **grond**
(waarom het bestaat), een **nietDit** (wat het niet is) en zijn **voorwaarden**.
Dat tweede veld is de helft van de waarde: `deel` dat stilletjes `verbind` gaat
betekenen, is hoe een ontdeklaag in een sociaal netwerk verandert zonder dat
iemand dat heeft besloten.

En een vierde eigenschap die zwaarder weegt dan de andere drie: **raaktEenAnder**.

> **Drie van de acht bereiken een tweede mens — `deel`, `verbind` en `help` — en
> daar geldt het werkwoord van LIFE.md onverkort: samenstellen en klaarzetten
> mag, bevestigen doet de mens.**

Dat is geen zin in een document. `lus.verklaar()` geeft ze terug in
`bevestigtEenMens`, en een route die die lijst negeert is het stil promoveren van
autonomie waar `INTELLIGENTIE.md` over gaat. Zonder die vlag is het verschil
tussen *"Rahul stelt voor dat je Sara vraagt"* en *"Rahul vraagt Sara"* een
kwestie van wie er toevallig de route schreef.

**Vijf woorden bestaan hier met opzet niet**, en ze staan met hun reden in
`NIET_GEBOUWD`: `beoordeel`, `rangschik`, `beloon`, `voorspel` en `meet`. Ze
ontbreken niet per ongeluk — ze botsen met de grens dat de meeteenheid nooit de
mens is. Een bron die ze aanmeldt krijgt ze terug in `geweigerd` mét de reden, en
niet een lijst waar ze stil uit zijn gevallen.

---

## 2. De mixer: acht motoren, en geen enkele die wint

`server/kern/connect/mixer.js`. Niet één aanbevelingsalgoritme maar acht die om
een plek dingen: interesse, groei, lokaal, menselijk (vertrouwd) tegenover
nieuwsgierig, brug, actualiteit, toeval (ontdekken).

Dat valt op precies één manier om: **door er een score tussen te zetten.** Zodra
elke motor een getal levert en de hoogste wint, is er weer één algoritme — met
acht ingangen en een gewichtenvector die niemand kan lezen.

> **Deze mixer verdeelt PLEKKEN en geen punten.** De horizon van de mens zegt
> hoeveel plekken naar de vertrouwde kant gaan en hoeveel naar de ontdekkende;
> binnen elke kant krijgen de motoren om beurten een plek. Er wordt niets
> gesorteerd, gewogen of vergeleken — en daardoor is er ook niets waarop iemand
> later kan optimaliseren.

Elke plek draagt zijn **reden** in woorden, niet een percentage. Dat is dezelfde
regel als bij `kern/frictie/motor.js`: een cijfer zonder opbouw is een orakel.
Hier is er geen cijfer, dus is de opbouw het enige dat er is.

**Vijf van de acht motoren zijn vandaag niet aangesloten**, en die staan in het
antwoord mét de reden in plaats van te ontbreken — `KAARTEN.md` par. 6: *"hier is
geen gebied" is niet "hier is geen motor"*. Ze zijn ook niet als lege functie
neergezet: een motor die bestaat en altijd niets teruggeeft, is niet te
onderscheiden van een motor die stuk is.

### 2.1 De bruggen

`server/kern/connect/bruggen.js`. Iemand die uitsluitend voetbal kijkt krijgt niet
ineens scheikunde. Wel: *"waarom krult een bal als je hem van opzij raakt?"*

Een brug bestaat uit drie dingen en niet uit twee: **van** (een alledaags
onderwerp), **naar** (een vak) en **de vraag die de sprong vanzelfsprekend
maakt**. Die derde is waar het op staat of valt — `voetbal → natuurkunde` betekent
alleen iets voor wie het al kent; de vraag stelt een kind van tien uit zichzelf.
Een bruggenlijst zonder vraag is een categorieënboom, en die had niemand nodig.

**De lijst is VERKLAARD en niet geleerd, en de graad is `vermoed`.** Er is geen
model dat dit uit gedrag afleidt — geen kijktijd, geen cluster. Dat is een
beperking, en het is ook de reden dat de laag mag bestaan: een geleerde
bruggenlijst leert wat mensen *aanklikken*, en dat is precies de aandachtsmachine
waar Foundation Connect niet op lijkt. De prijs is dat de lijst eindig is en met
de hand groeit; die prijs staat opgeschreven in plaats van weggewerkt.

---

## 2a. Besluit 2 is genomen: auteurschap wordt geconsumeerd, niet uitgevonden

*15 september 2026.* De regel die het ontwerp stuurt staat in één zin:

> **Connect mag auteurschap CONSUMEREN, niet zelf uitvinden.**

Die zin is niet uit voorzichtigheid geboren maar uit een lek. De eerste versie
liet de aanroeper zeggen wie de maker was, en daarmee kon iedereen een regel met
bewijskracht in het dossier van een willekeurig ander schrijven. Het
securitygat heeft zo de architectuur bepaald: als de client het niet mag zeggen,
en Connect het niet mag weten, dan moet het ergens anders al vaststaan.

Dat deed het. `kern/mediaos/wekken.js` heeft een haak `nieuwWerk(makerKey, soort,
titel)` die door vijf domeinen wordt aangeroepen — Klankwerk, Theater, Clips,
Podium en de aanwezigheden — met een echte ledensleutel, op het moment dat het
werk er werkelijk is. Die bewering is vertrouwd omdat het **domein** hem doet.

`kern/mediaos/werkherkomst.js` legt hem daar vast, en Connect **leest** hem:

```
bestaand domein maakt werkelijk iets
  -> nieuwWerk() legt vertrouwde herkomst vast
  -> Connect projecteert alleen wat het nodig heeft
  -> iemand anders doet er daadwerkelijk iets mee
  -> gebruikt/doorgegeven krijgt bewijs
  -> het leerdossier krijgt een regel
```

Drie dingen die daarbij niet mogen verwateren. De herkomst wordt vastgelegd
**vóór** het wekken (dat dit werk bestaat staat los van de vraag of er iemand
gewekt kon worden — een maker zonder volgers maakt evengoed iets). Het register
kent **geen functie die alle werken van iedereen teruggeeft**; dat zou een
publieke makerslijst zijn. En Connect krijgt er precies één ding uit —
`makerVanWerk(id)` — zodat de leesrichting in de handtekening zit en niet in een
afspraak.

---

## 3. Het leerdossier: bewijs door doen

`server/kern/connect/tredenlijst.js` + `leerdossier.js`. Zeven treden: gezien,
uitgelezen, begrepen, geoefend, toegepast, gemaakt, doorgegeven. Vijftig video's
over programmeren bekijken is geen programmeren; een werkende applicatie bouwen is
veel sterker bewijs.

En dat is precies de plek waar zo'n laag omslaat in het tegenovergestelde van wat
hij belooft. Een Career Score, een talentladder, een bijdragegrafiek per persoon:
`CARRIERE.md`, `HDI.md`, `ONTMOETEN.md`, `STAGE.md` en `INT-04` zeggen alle vijf
hetzelfde — **de meeteenheid is nooit de mens, ook niet intern als
sorteersleutel.** Die grens had vier documenten en nul handhavers; dit is de
eerste laag die er twee krijgt.

> **De treden zijn geen trap.** Iemand staat niet ÓP een trede — hij heeft regels
> die er een dragen, per onderwerp. De hoogste trede wordt afgeleid per onderwerp
> en nergens over onderwerpen heen opgeteld: een getal over alle onderwerpen ÍS
> een niveau, hoe je het ook noemt.

### 3.0 De vijf overdrachtstreden, en de regel eronder

De laatste vijf gaan over iets dat deze mens **zelf maakte**. Ze stonden er eerst
als één trede, en daarmee waren publiceren en betekenen hetzelfde ding:

| trede | wat er gebeurde | aanspraak |
|---|---|---|
| **gemaakt** | er bestaat iets van jou | eigen doen |
| **aangeboden** | jij hebt toegestaan dat een ander het kan ontvangen | eigen doen |
| **bereikt** | het kwam daadwerkelijk bij iemand anders | **geen** |
| **gebruikt** | die ander deed er aantoonbaar iets mee | overdracht |
| **doorgegeven** | het leidde aantoonbaar tot iets verderop | overdracht |

> **WIJ TELLEN GEEN AANDACHT ALS ONTWIKKELING.** Dat is de klassieke
> social-mediafout in een zin — *publiceren = impact* — en hij wordt hier
> tegengehouden door een veld en niet door een voornemen. `bereikt` draagt
> `aanspraak: 'geen'` en komt daarmee **wel** in het dossier en **nooit** in het
> portfolio.

Die derde regel is de hele kunst. *"Mijn werk kwam bij iemand aan"* voelt als een
prestatie en het is bereik. Een platform dat dat meetelt, heeft binnen een jaar
makers die voor bereik werken; een platform dat het weglaat, kan niet uitleggen
waarom *aangeboden* en *er is echt iemand geweest* niet hetzelfde zijn. Daarom
staat hij er wel, en telt hij nergens mee.

**En `mooi` levert de maker niets op.** Van de zes naklanken is dat de enige
zonder trede — en het is de soort die het vaakst gegeven wordt. Juist daarom.

**Alle vijf zijn `eenmalig`.** Een trede die per gebeurtenis een regel
bijschrijft, wordt een teller: dan staat in het dossier van de maker hoe vaak
zijn werk is geopend, en dat is een populariteitscijfer met een ander etiket.
Deze ladder legt **overgangen** vast en nooit **volumes** — *"iemand heeft hier
iets mee gedaan"* is een feit, *"veertien mensen"* is een score. Dat heeft een
tweede gevolg dat er hard bij hoort: niemand kan andermans dossier laten groeien
door te blijven drukken. Vier mensen die vier verschillende naklanken geven,
leveren samen **één** regel `gebruikt` op.

### 3.0a De zes vragen per bewijsstuk

Elk stuk in het portfolio draagt ze mee, en de eerste vijf komen uit de tabel
zelf zodat ze niet naast de code kunnen gaan lopen:

| vraag | veld |
|---|---|
| wat gebeurde er? | `trede` + `stelt` |
| welk vermogen werd gebruikt? | `werkwoord` (uit de lus — níét `capability`, dat is in `OS.md` bezet) |
| waar kwam het bewijs vandaan? | `herkomst` + `bron` |
| wie stelde het vast? | `doorWie`: de mens zelf, het systeem, of een ander |
| wat is feit en wat is afleiding? | `graad` + `nietZegt` |
| mag het buiten Foundation? | `buitenFoundation`, afgeleid uit `aanspraak` |

`stelt` en `nietZegt` zijn met opzet dezelfde woorden als in
`kern/carriereledger/regels.js`: dat ledger heeft deze vraag al beantwoord, en
een tweede vocabulaire voor *"wat zegt dit bewijs niet"* is de botsing die
`SEMANTIEK.json` meet. Het blok `nietZegt` is daar ook geen slag om de arm maar
de helft van de betekenis.

**Elke regel draagt zijn graad, en die is niet te kiezen maar volgt uit wie hem
schrijft.** `toegepast` zegt de mens zelf en blijft `vermoed`; `gemaakt` heeft een
ding achter zich en is `gemeten`; `onderwezen` ontstaat doordat een **ander** zei
dat hij geholpen is, en is `bewezen`. Wie die drie op een hoop gooit, bouwt een
portfolio waarin *"ik heb dit toegepast"* er hetzelfde uitziet als *"iemand zei
dat ik hem hielp"* — en alleen dat laatste is buiten Foundation iets waard.

`wieSchrijft` is daarom geen commentaar maar een grendel: zonder hem vult iedereen
zijn eigen dossier met de enige trede die bewijskracht heeft.

### 3.1 Waarom dit onder de 18 mag bestaan

`progressieMag` (`kern/spellen/grens.js`) houdt onder de achttien alles tegen wat
een prestatie buiten het potje bewaart. Het besluit van 14 september 2026
(`CLAUDE.md`, `FOUNDATION.md` par. 5.5) zegt dat een **leerdossier** op elke
leeftijd mag bestaan, mits aan vier dingen wordt voldaan. Ze staan hier niet als
belofte maar als code:

| voorwaarde | hoe hij wordt afgedwongen |
|---|---|
| gaat over de persoon zelf en vergelijkt nooit | er is geen functie die twee dossiers samen kan lezen |
| geen blijvend niveau-label | `hoogste()` rekent per onderwerp en levert geen totaal |
| alleen leesbaar voor de leerling en wie al een rechtmatige verhouding tot hem heeft | `lees()` neemt één sleutel en geeft nooit een lijst over mensen heen |
| hangt aan de codenaam | `sleutel`, nooit een naam of een geboortedatum |

**Valt er één van de vier weg, dan geldt de progressiegrens weer — en dan is dit
een scorebord.**

---

## 4. De naklank: zes gevolgen in plaats van een like

`server/kern/connect/naklank.js`. Mooi, iets geleerd, geprobeerd, afgemaakt,
doorgegeven, hierdoor geholpen. Een maker ziet dus niet *"81.204 likes"* maar dat
17.841 mensen zeggen iets geleerd te hebben, 4.211 het probeerden en 117 daarna
iemand anders hielpen. Die laatste vier zeggen iets; een duim zegt alleen dat er
is gescrold.

Vier regels, en de eerste is de hele reden dat de laag bestaat:

1. **Er komt nooit een totaal.** De zes worden niet opgeteld, niet gewogen en niet
   tot een cijfer verwerkt — ook niet intern om iets op te sorteren. Wie hier
   `score` toevoegt, heeft de like teruggebouwd met zes ingangen.
2. **Een naklank hangt aan een DING, nooit aan een mens.** Zodra dit op een
   persoon kan staan, is het een reputatiecijfer.
3. **`geholpen` is de enige met een gevolg buiten de module**: hij schrijft bij de
   maker de trede `onderwezen`. Daarom loopt hij langs een haak en niet langs een
   tweede schrijver — een dossierregel die hier zou ontstaan, omzeilt de grendel
   uit par. 3.
4. **De maker ziet aantallen en geen namen.** Een lijst namen onder een bijdrage
   is een volgerslijst met een ander etiket.

*De naam is gemeten.* `signalen` staat op dertien plekken in acht domeinen en
`weerklank` is in `KANTOOR.md` al vergeven aan de gebeurtenismotor; `naklank`
stond op nul — en het woord klopt ook beter: dit is niet het antwoord op iets,
maar wat ervan overblijft.

---

## 5. De kring en de horizon

**De kring** (`kring.js`) is wie iets mag zien: alleenIk → gezin → team →
community → publiek. Een **poort** en geen etiket: `magZien()` is de enige plek
waar zichtbaarheid wordt beslist. Een laag die de kring als veld meestuurt en de
lezer laat filteren, lekt bij de eerste route die het vergeet.

> **De ladder gaat één kant op, en niet de kant die hij lijkt te gaan.** De trap
> van een KRING is *bereik*; de trap van een RELATIE is *nabijheid*. Wie dichtbij
> staat ziet wat verder reikt. Twee schalen met dezelfde namen en tegengestelde
> richting — precies de vorm waarvan `BEWIJSMACHINE.md` par. 6a zegt dat een proef
> een geldige uitslag kan geven terwijl het verkeerde experiment is uitgevoerd.
> (Hier stond eerst `kijker >= doel`, en daarmee kon een gezinslid het publieke
> werk van zijn eigen kind niet zien.)

**Versmallen kan altijd, verbreden niet altijd.** Een beschermd profiel komt niet
voorbij `team` — niet als instelling en niet met een vinkje van een ouder, want
publiek maken is niet terug te draaien en dat besluit neemt niemand namens een
kind. Maar de uitgang staat vóór de grens in de code: zou het andersom zijn, dan
kan een kind zijn eigen werk niet meer terugtrekken zodra het per ongeluk in
`team` stond. *Een grens die de uitgang meeneemt, is geen bescherming.*

**De horizon** (`horizon.js`) is een schuif van vertrouwd naar ontdekken, door de
mens zelf gezet, plus vijf vrijwillige signalen. Wat er **niet** in mag staat bij
naam in `GEEN_SIGNAAL`: kijktijd, scrollsnelheid, tijdstip, leeftijd, locatie. Dat
zijn de variabelen waarmee een aandachtsmachine wordt gebouwd; ze ontbreken hier
niet, ze zijn geweigerd. En *verras me* verzet de instelling **niet** — een knop
die stilletjes je voorkeur verandert, is een val.

---

## 6. Anti-verslaving: de sessie mag ophouden

Er is bewust geen KPI op dagelijkse schermtijd. Twaalf plekken per keer, en het
antwoord draagt zelf `genoeg`:

> *"Twaalf is hier het maximum per keer. Genoeg gezien om iets te gaan proberen;
> leg de telefoon gerust weg."*

Dat getal is met opzet **niet** configureerbaar: een plafond met een knop eraan is
geen plafond, en de knop staat altijd op hoger. Geen streak-straf, geen escalatie
naar extremere inhoud, geen oneindige stroom. **De paradox is dat een geslaagde
sessie er een is die iemand afsluit.**

---

## 7. Wat er staat, en wat er niet staat

| | stand |
|---|---|
| de lus als verklaring van werkwoorden | **staat** |
| de projectie met zeven etiketten | **staat** |
| de mixer, 3 van 8 motoren aangesloten | **staat** (5 melden dat ze niet kijken) |
| bruggen van een onderwerp naar een vak | **staat** (28 bruggen, graad `vermoed`) |
| leerdossier, zeven treden, met de vier voorwaarden in code | **staat** |
| naklank, zes gevolgen zonder totaal | **staat** |
| kring als poort, horizon als schuif | **staat** |
| twee bronnen: leerstof en de buurt | **staat** |
| **auteurschap uit een vertrouwde bron** | **staat** — zie par. 2a |
| de vijf overdrachtstreden, met `bereikt` buiten het portfolio | **staat** |
| Doe, Samen en Maak als eigen ingangen | **vraagt een besluit** |
| live, AR/Lens, wereldkaart, vertaling, mentoren | **jaren weg** |

### 7.1 De lus is rond

`npm run lusproef` loopt de hele lus over een echte server: **17 schakels, 10
storingen — alle zeventien gesloten.**

Schakel 8 stond tot 15 september **open met een reden**, en de weg daarheen is
het vermelden waard omdat hij twee keer fout ging voordat hij goed ging:

1. Eerst stond hij **groen** met `maker` uit het verzoek. Daarmee kon iedereen
   een regel met bewijskracht in het dossier van een willekeurig ander
   schrijven. De zelf-weigering sloeg nooit aan, want een verzonnen codenaam is
   per definitie niet gelijk aan de gever.
2. Daarna stond hij **open**: de maker werd opgezocht, en geen enkele bron droeg
   er een. Dat er geen maker was, was de juiste uitkomst; dat de lus daar niet
   sloot, was de bevinding.
3. Nu **sluit** hij, en niet door in Connect iets te bouwen dat er al was. De
   schakel begint bij een écht domein: een lid maakt een clip langs
   `/api/clips/maak`, `kern/clips.js` roept `nieuwWerk(key, 'flow', titel)` aan
   zoals altijd, en `kern/mediaos/werkherkomst.js` legt vast van wie dat werk
   is. Pas dan kan een tweede mens er iets mee — en landt de regel bij de eerste.

De drie schakels daarna zijn de inhoudelijke: `bereikt` staat in het dossier en
niet in het portfolio (9), `mooi` levert de maker niets op en `geprobeerd` wel
(10), en vier naklanken op één trede geven één regel (toets 30).

**Wat de e2e-toets onderweg vond, en wat geen unittoets kon zien.** `/api/login`
geeft per pas *dezelfde* demo-persona terug, dus twee "verschillende" leden waren
er één — en dan bereikt een maker zichzelf. De toets stond daarop terecht rood.
Zo'n fout leeft precies in de naad tussen drie `opzet/`-bestanden die geen enkele
unittoets raakt, en dat is waarom die toets bestaat.

### 7.2 Wat met opzet geen deur heeft

**Publiceren naar `publiek`.** Dat werkwoord bereikt een tweede mens; de
bevestigingsstroom eromheen is niet gebouwd, en een route die alvast publiceert
zou die belofte breken voordat hij bestaat.

**Een lijst mensen, in welke vorm dan ook.** Geen route die twee dossiers naast
elkaar legt, geen zoekweg op makers, geen volgerslijst.

---

## 8. De grenzen

1. **De meeteenheid is de gebeurtenis en nooit de mens.** Geen score, geen
   ranglijst, geen niveau — ook niet intern als sorteersleutel, en ook niet
   samengesteld uit zes eerlijke deelgetallen.
2. **Wat een tweede mens bereikt, bevestigt een mens.** `deel`, `verbind` en
   `help` dragen `raaktEenAnder`, en die vlag heeft een aanroeper.
3. **Er komt geen contenttabel.** Deze laag bezit geen inhoud; hij leest de lagen
   die er al zijn en legt er etiketten op. Wie hier `db.data.connect.posts`
   aanmaakt, heeft de gemeten uitslag van par. 0 genegeerd.
4. **Een bron die om de mens vraagt, wordt geweigerd.** Een ontdekking die
   `leeftijd`, `postcode` of `geslacht` draagt valt hélemaal af, mét het veld
   erbij — niet het veld strippen en de rest doorlaten.
5. **Wat niet gemeten is, wordt niet als getal getoond.** `zekerheid` blijft
   `null` tenzij de bron zelf iets zegt; `null` leest als *niet nagegaan* en nooit
   als *het klopt*.
6. **Een bron die niets vond, zegt dat.** Leeg met een reden, nooit stil — zowel
   bij een motor zonder bron als bij een plaats die niet is opgegeven.
7. **Een kind gaat niet publiek, en kan altijd terug.** De uitgang staat vóór de
   grens.
8. **Personalisatie loopt op wat iemand ZEGT, niet op wat hij doet.** Kijktijd,
   scrollsnelheid en tijdstip zijn bij naam geweigerd.
9. **De gezinsdeur laat gasten er niet in.** Anders dan bij `/api/rtf/knelpunt`,
   waar iedereen in het gezin mag kijken omdat die route rekent en niets
   bewaart: hier bewaart élke deur iets van de mens zelf, en de vierde
   voorwaarde van het leerdossier is dat het aan de **codenaam** hangt — die een
   gastprofiel niet heeft. Een gast een dossier geven breekt dus of die
   voorwaarde, of het hangt aan een tijdelijk profiel dat bij het volgende
   bezoek wees is. De naam `gezinsPoort` is bovendien in
   `kern/handlerpoorten/buiten.js` verklaard als *"gasten eruit"*, en een
   zachtere variant onder dezelfde naam holt een contract uit waar drie andere
   routes op leunen.

---

## 9. Besluiten die openstaan

1. **De publieke naam.** *Ontdekken* staat er nu; de werknaam Foundation Connect
   is geen productnaam.
2. ~~**Wie is de maker van een stuk werk?**~~ **Genomen op 15 september 2026**
   (par. 2a): Connect consumeert auteurschap uit `kern/mediaos/werkherkomst.js`
   en stelt het nooit zelf vast. Wat hierna openstaat is de ándere kant — het
   werk van anderen komt nog niet in de ontdeklijst. Dat vraagt een bron op de
   mediacatalogus en niet op het herkomstregister: dat laatste kent met opzet
   geen "alle werken van iedereen", want dat zou een publieke makerslijst zijn.
3. **Gaan Doe, Samen en Maak eigen ingangen worden?** Vandaag zijn het
   werkwoorden op een ontdekking en geen tabbladen. Vijf tabbladen bouwen waar
   drie ervan niets achter zich hebben, is het product verzinnen om de navigatie
   te kunnen tekenen.
4. **Wordt de lusproef de zesde keten in `KETENVORM.json`?** `scripts/ketenvorm.js`
   houdt een gecureerde lijst van vijf ketens bij, en meet daarop de vraag of er
   over ketens heen gedeelde actoren en beloftethema's bestaan (vandaag: 0 van 33
   actoren, 2 van 10 thema's). Deze keten brengt vier actoren mee die er nog niet
   in zitten — een tweede lid, een gezinsbeheerder en een kindprofiel — en zou de
   uitslag dus echt op de proef stellen. Hij staat er bewust nog niet in: die
   lijst is per regel een besluit met een reden, en zo'n toevoeging verschuift
   getallen die in vier documenten worden geciteerd. Een aparte ingreep, geen
   bijvangst van deze.
5. **Mag een organisatie een challenge plaatsen?** Zo ja, dan geldt
   `TRAVELCOMMERCE.md`: betaald bereik mag nooit vermomd worden als neutrale
   educatieve waarheid, en er is vandaag geen laag die dat onderscheid draagt.
