# RTG Stage — de publieke laag

*De publieke en sociale projectie van een mens, een organisatie, een werk of een
gebeurtenis binnen RTG.*

Niet een app naast Podium, Theater, Clips, Klankwerk, Salon, Festival en
Sportclub. Die blijven hun eigen specialistische motoren. Stage is de laag
erboven die ze samen laat leven, en de kernbelofte is:

> **Volg niet alleen iemand. Stap zijn wereld binnen.**

Dit is een **richtingsdocument** zoals `PLATFORM.md`, `ECONOMIE.md`, `HDI.md` en
`CARRIERE.md`: per onderdeel staat er of het **staat**, **een stap weg** is, **een
besluit vraagt** of **jaren weg** is — zodat niemand die vier voor elkaar
aanziet.

---

## 0. De meting die dit document eerlijk houdt

De opzet rust op één bewering: *de nieuwe fundamentele eenheid moet `Moment`
worden — niet post, niet video, niet event, niet ticket.*

Die bewering is aantrekkelijk en zij is precies de vorm waarin dit huis al twee
keer is gestruikeld. `Asset` klonk net zo vanzelfsprekend over tafel, kamer,
podium en leaseauto (`OBJECTMODEL.json`), en de carrièrelus klonk net zo
vanzelfsprekend over vijftien talentdomeinen (`CARRIEREVORM.json`). Allebei
sneuvelden ze toen iemand ze tegen de code hield.

Dus is zij **gemeten** en niet aangenomen: `npm run stagevorm` →
`STAGEVORM.json`. Op de lezer van `scripts/objectmodel.js`, want een tweede
parser maakt de vergelijking met die twee metingen waardeloos — en daar rust de
conclusie nu juist op.

**A. De naam.** Is `moment` vrij?

| naam | plekken | domeinen |
|---|---|---|
| `momenten` | 7 | 6 — baby, rtfos, socialegraaf, sportclub, veiligheid, school |
| `moment` | 1 | 1 — magnaat |
| `capsule` | 1 | 1 — livinglab |
| `presence`, `broadcast`, `drop`, `stage` | 0 | 0 |

**B. De vorm.** 63 vormen in 10 publieke domeinen, 136 velden na aftrek van de
envelop:

- **0** velden in álle domeinen
- **0** velden in zelfs maar de helft (drempel 5)
- **121 (89%)** in precies één domein

Ter vergelijking: platformbreed is dat 71% (`OBJECTMODEL.json`), over de
talentdomeinen 88,2% (`CARRIEREVORM.json`). De publieke domeinen zijn dus
**mínder verwant dan een willekeurige doorsnede van dit huis.** Het hoogst
gedeelde veld staat in **twee** domeinen; niets haalt drie.

**C. De haak.** Van de 11 publieke domeinen roepen er **5** de bestaande wekhaak
`nieuwWerk()` aan (clips, mediaos, muziek, podium, theater) en **6** niet
(creator, events, festival, galerij, salon, sportclub). De momentsoorten die de
meldingsvoorkeur vandaag kent zijn er **vier**: `muziek`, `video`, `flow`,
`live`.

**De meter is een mutatie aangedaan en hij bewoog.** Versmald tot `clips` +
`theater` — twee aantoonbaar verwante videodomeinen — slaat "in alle domeinen"
om van 0 naar **5** (`duurS`, `mb`, `online`, `poster`, `reacties`). De nul over
tien domeinen is dus een bevinding en geen kapotte meter.

> Wat deze meting **niet** zegt: dat er geen gedeeld PROCES is. Zij kijkt naar
> bewaarde vormen en naar namen in de bron, niet naar werkwoorden, volgorde of
> uitkomst. `KETENVORM.json` laat zien dat die twee vragen verschillende
> antwoorden geven (0 van 13 gedeelde actoren, terwijl alle drie de ketens wel
> degelijk werkten). Voor de procesvraag is de vorm een **ketenproef** — par. 6.

---

## 1. Zeven correcties op de opzet

Deze zeven horen nergens anders herhaald te worden.

### 1.1 `moment` is bezet, en zesvoudig

Het woord draagt in deze code al zes betekenissen: een socialpost van een club
(`kern/sportclub`), een AI-mijlpaal in een gezinsboek (`kern/baby`), een
doorlooppunt van een subsidieaanvraag (`kern/rtfos/subsidies`), een gedeeld
moment waar een veiligheidskring op meekijkt (`kern/veiligheid/opslag`), een
dagopname van een simulatie (`kern/magnaat-economie`) — en, het gevaarlijkst,
**een levensgebeurtenis uit een stille bron** (`kern/socialegraaf/bronnen`, de
voeding van de levensgraaf).

Dat laatste is geen naamgevingsprobleem maar een veiligheidsprobleem. Een
PUBLIEK moment naast een PRIVAAT moment, onder dezelfde naam, in hetzelfde huis:
dat is de `VERMOGENS`-botsing uit `OS.md` op de centrale naam van een hele laag,
en de faalvorm is dat iemand op een dag de verkeerde leest. `SEMANTIEK.json`
telt 105 namen die dit al overkwam; dit zou nummer 106 zijn, en dan meteen op de
duurste plek.

**De nieuwe naam hernoemt dus eerst of wijkt uit.** `presence`, `broadcast`,
`drop` en `stage` zijn wél vrij (0 plekken) — die vier kosten niets.

### 1.2 Moment is geen object; het is een projectie

Dit is geen weerlegging van de opzet maar het bewijs eronder. De opzet zegt zelf
al het juiste: *Stage moet niets bezitten wat elders de bronwaarheid heeft.* De
meting geeft daar tanden aan: met 0 gedeelde velden over tien domeinen en 89%
domeineigen zou een `Moment`-OBJECT alles wat de domeinen onderscheidt naar een
`extra`-veld duwen — en dan heeft wie erop bouwt acht keer werk in plaats van
één keer.

Alleen het woord **"fundamentele eenheid"** moet dus weg. De vorm die overleeft
staat al in dit huis en is `kern/levensgraaf/graaf.js`: **een projectie met
etiketten, die elke keer opnieuw uit de domeinen wordt gebouwd.** Zie par. 3.

### 1.3 De momentmotor bestaat al en heet `wekken.js`

`kern/mediaos/wekken.js` is de momentmotor in embryo: vier momenten
(uitgave, video-bytes binnen, nieuwe clip, live gáán), drie filters (wie volgt,
waarvoor, en de algemene meldingsschakelaar), en een laat gebonden haak
`nieuwWerk(key, soort, titel)` die de domeinen zelf aanroepen.

De opdracht is daarmee **aansluiten en niet uitvinden** — dezelfde uitkomst als
`HDI.md` par. 1. Concreet: 6 van de 11 publieke domeinen aansluiten, en de
soortenlijst van vier verbreden. Dat is werk van dagen, niet van kwartalen.

### 1.4 ManagementOS bestaat, en heet `kern/vertegenwoordiging/`

Punt 29, 30 en 44 van de opzet zijn grotendeels gebouwd:
`machtiging.js` (mens-namens-mens, met de grammatica uit `kern/stuur/mandaat.js`:
een mandaat VERSMALT bestaand vermogen en verleent er nooit), `simulatie.js`
(letterlijk de permission-diff die de opzet vraagt — en hij toont **even groot**
wat er níét opengaat) en `jeugd.js` (het jeugdbestuur, met LEVEN.md par. 2
erboven: een kind is geen profiel, de jongere tekent zelf mee).

**Maar de bevoegdhedenlijst is met opzet GESLOTEN** op negen bevoegdheden, en
`publiceren` staat er niet bij. Punt 30 — *Emma mag PUBLISH_CLIP uitvoeren voor
Mila tot 31 december* — is daarmee geen bouwtaak maar **een besluit van de
eigenaar**: een tiende bevoegdheid in een gesloten lijst, met een grond. De
NOOIT-lijst (zeven regels) verbiedt publiceren níét, dus de weg staat open.

Twee dingen daar niet wegpoetsen: de poort is `volwassen()` en dus **A3**, zodat
er vandaag geen machtiging kan worden afgegeven voordat RTG het
identiteitsbewijs heeft gezien; en de simulator toont een verschil en niet een
lijst — dat is waarom hij een tweede keer gelezen wordt.

### 1.5 Drie dingen bestaan hier niet waar de opzet ze veronderstelt

- **`MENSNETWERK.md` bestaat niet** in deze repo. Wat er wél is, is
  `kern/vertegenwoordiging/` (par. 1.4) plus `CARRIERE.md` en `RUGDEKKING.md`.
- **De schil `Vandaag · Doen · Inbox · Ruimtes · Jij` bestaat niet als zodanig.**
  `WERELD.md` legt vast dat er precies één beginscherm is — de werktafel van RTG
  Command — met de werelden bovenaan de bank en Rahul in de schilbalk. Stage
  hoeft daar geen tweede navigatiegrammatica naast te zetten, maar het moet de
  bestáánde aanspreken en niet een andere.
- **`beschermstand` is bezet.** `kern/beschermstand.js` is de veilige noodstand
  van een ORGANISATIE (per categorie bevriezen), niet een Safety Mode voor een
  publiek persoon. Punt 43 is dus nieuw werk onder een nieuwe naam.

### 1.6 De Event Capsule bestaat half, en aan de verkeerde kant

Punt 19 leunt op "de offline bundel van Festival". Die bestaat, maar hij is van
de **poortmedewerker**: `kern/festival/toegang.js` speelt een bundel gescande
codes achteraf af, sorteert op tijd, laat de eerste winnen en meldt de rest als
dubbel — *"een offline poort kan een dubbele doorlaten, en dat is geen bug maar
natuurkunde"*.

Wat de BEZOEKER offline in handen heeft, bestaat niet. De Event Capsule is dus
nieuw werk aan de gastkant, en de bestaande bundel is er het bewijs dat de
denkwijze klopt — niet de helft van de implementatie.

### 1.7 De relay-boom heeft vandaag géén terugval

De zorg in punt 7 is terecht en meetbaar. `kern/podium/boom.js` kent één
distributievorm: `herstelBoom()` herkoppelt wezen wanneer een knoop wegvalt, en
verder is er geen edge-relay, geen serverpad en geen fallback. Bij een kanaal
met betalende kaartjes is dat een enkelvoudig afhankelijkheidspunt.

Dat is geen reden om de P2P-filosofie weg te gooien — zij is juist het
onderscheid — maar wel om een tweede weg te hebben vóór er een kaartje verkocht
wordt in de zone `evenement`.

---

## 2. Wat er al staat (de inventaris)

| Onderdeel uit de opzet | Stand | Waar |
|---|---|---|
| Live uitzenden, chat, cadeaus, abonnement, kaartje, live verkopen | **staat** | `kern/podium/` (7 zones) |
| Eén volgknop over vier mediavormen, zonder tweede administratie | **staat** | `kern/mediaos/volgen.js` |
| Wekken bij nieuw werk, per maker en per soort | **staat** (4 van 11 domeinen) | `kern/mediaos/wekken.js` |
| Samen kijken/luisteren als gedeelde aanwijzer | **staat** | `kern/mediaos/samen.js` |
| Makersprofiel en stuk-hub | **staat** | `kern/mediaos/hub.js` |
| Kaartverkoop zonder oververkoop (hold → pay → commit → issue) | **staat** | `kern/festival/verkoop.js` |
| Scan aan de poort, drie standen, offline replay | **staat** | `kern/festival/toegang.js` |
| Machtiging mens-namens-mens + permission-diff + jeugdbestuur | **staat** | `kern/vertegenwoordiging/` |
| Passkey-bevestiging bij zwaar werk | **staat** | `server/webauthn/` (`/api/webauthn/bevestig/opties`) |
| Event vraagt om een capability i.p.v. een genre | **staat** | `kern/objectlaag/eventwereld.js` |
| Videokamers op codenaam (de bouwsteen voor meet & greet) | **staat** | `kern/meet.js` |
| Moment als projectie over alle publieke domeinen | **een stap weg** | par. 3 |
| De 6 domeinen zonder wekhaak aansluiten | **een stap weg** | par. 4 |
| Eén `ACCESS`-capability over de vier ticketrails | **een stap weg** | par. 4 |
| Broadcast met expliciete toestemming per soort | **een stap weg** | `kern/mediaos/eigen.js` draagt de voorkeur al |
| Publiceren als bevoegdheid van een manager | **vraagt een besluit** | par. 1.4 |
| Event Capsule voor de bezoeker | **vraagt een besluit** (bewaartermijn, sleutel) | par. 1.6 |
| Terugval naast de relay-boom | **vraagt een besluit** (kosten) | par. 1.7 |
| C2PA / content provenance | **jaren weg** — 0 treffers in de hele repo | par. 5.7 |
| Semantische venue-objecten, Presence Mode, Memory Mode | **jaren weg** | — |
| Generative UI binnen goedgekeurde componenten | **jaren weg** | `VERTROUWEN.json`: 0 bewezen |

---

## 3. De vorm die overleeft

Een Moment is een **projectie**, geen rij. Hij wordt bij het opvragen gebouwd
uit het domein dat de waarheid al bezit, en hij voegt alleen toe wat nergens
stond: de etiketten. De vorm is die van `kern/levensgraaf/graaf.js` — vijf
etiketten daar, hier zes:

```
onderwerp   over wie of wat gaat dit (een codenaam of een zaakcode)
soort       wat er gebeurt (release, live, wedstrijd, verkoop open, ...)
bron        uit welk domein het komt, en dus wie het verandert
wanneer     het tijdstip waarop het publiek iets betekent
deel        wie het mag zien -- een POORT en geen etiket
vermogens   wat je hier kunt doen, en dat komt uit de capability-laag
```

Vier regels die daaruit volgen en die niet mogen sneuvelen:

1. **Een Moment bezit niets.** Geen video, geen kaartje, geen voorraad, geen
   identiteit. Verdwijnt de bron, dan verdwijnt de projectie — hij wordt niet
   stil een kopie die achterloopt (LAT.md regel 4).
2. **`deel` is een poort en geen etiket.** Precies zoals in de levensgraaf: de
   filter zit in de bouwer, niet in het scherm. Een Moment dat een kijker niet
   mag zien, bestaat niet voor hem.
3. **`vermogens` wordt berekend, niet opgeslagen.** Dat is de regel van
   `LINK.md`: *een code zegt wie of wat, nooit wat er mag.* Wat een kijker bij
   dit Moment kan doen, hangt af van wie hij is, waar hij staat en wat hij al
   mocht.
4. **Een Moment zonder bron bestaat niet.** Geen handmatig aangemaakte
   momenten, geen redactionele rij die nergens vandaan komt — anders is de
   projectie binnen een jaar zelf de negende waarheid.

---

## 4. De negen stenen, met hun echte status

| Steen | De opzet zegt | De meting zegt |
|---|---|---|
| Public Presence | nieuw | **nieuw**, en de naam is vrij |
| Moment-object | nieuw | **projectie, geen object** (par. 3) |
| Stage-projector | nieuw | **nieuw** |
| Broadcast-toestemming | nieuw | **half** — de voorkeur per maker/soort staat, de zendkant niet |
| Eén `ACCESS`-capability | deels | **deels** — vier rails, één gebruikersbegrip; par. 5.3 |
| Event Capsule | deels | **gastkant is nieuw** (par. 1.6) |
| Meet-capability | bedrading | **bedrading** — `kern/meet.js` staat |
| Drop-capability | bedrading | **bedrading** — `kern/podium/handel.js` staat, fulfilment niet |
| Moment Analytics | nieuw | **nieuw, en dit is de plek waar een huisregel eindelijk een handhaver krijgt** (par. 5.5) |

---

## 5. De grenzen

### 5.1 Er komt geen fanladder, en geen score op een mens

`LIFE.md` par. 4: een relatie is geen trechter. `CARRIERE.md` par. 4.2 wees de
ladder *bekijkt → volgt → … → ambassadeur* al af. De vorm die overleeft is:
**wat iemand heeft gedaan is een feit; waar hij "staat" is een oordeel.**

De relatietypes uit punt 37 (`FOLLOW`, `SUBSCRIBE`, `ATTEND`, `MEMBER`, `ASK`,
`MEET`, `PURCHASE`) zijn daarom **naast elkaar en nooit boven elkaar**. Geen
ervan betekent "betere fan". Er komt ook geen interne sorteersleutel op een mens
— niet zichtbaar en niet onzichtbaar.

### 5.2 De meeteenheid is de gebeurtenis, nooit de mens

Punt 38 heeft gelijk en het is scherper dan het lijkt. Deze regel staat vandaag
in vier documenten (`KANTOORMACHT.md`, `HDI.md`, `ONTMOETEN.md`, INT-04 in
`INTELLIGENTIE.md`) en heeft **nul handhavers**. Stage is de eerste laag die er
een kan krijgen, omdat hier voor het eerst getallen over publiek ontstaan.

Toegestaan: *8.422 kaartjes, 8.077 ingecheckt, 12.201 kijkers, 1.104
bestellingen.* Verboden: elk getal waarvan de eenheid één mens is.

### 5.3 Vier ticketrails blijven vier rails

Punt 17 heeft gelijk: de problemen zijn echt verschillend (een live-kaartje, een
festivalpas met dagdelen, een stoel in een vak, een tijdslot in een museum).
Stage toont één gebruikersbegrip — **mijn toegang** — en voegt de motoren niet
samen. Wat wél mag: de volwassen rail van `kern/festival/verkoop.js` als
referentie nemen, zodat niet elke rail opnieuw zijn eigen race-condition
uitvindt.

### 5.4 Een broadcast is een toestemming, geen bereik

Geen bulk-DM. Een maker bereikt alleen wie per soort expliciet ja heeft gezegd,
en de lijst met wie dat zijn komt nooit naar buiten. Wie "concertnieuws ja,
merch nee" zegt, krijgt geen merch — ook niet één keer, ook niet "omdat het
belangrijk is".

### 5.5 Wat niet gemeten is, wordt niet als getal getoond

Punt 39 is hier al huisregel: Clips-beeld passeert de server nooit en het
Theater telt geen weergaven. Een Moment dat een aantal toont, draagt dus de
**dekking** erbij (`gemeten op deelnemende toestellen`, `gedeeltelijk`), in de
vorm van de bewijsgraden uit `BESTUUR.md`. Een leeg vak wordt gevuld met iemands
eigen indruk; dat is erger dan een lelijk getal.

### 5.6 Een publiek persoon zendt zijn plaats niet uit

Punt 43 hoort tot de grenzen en niet tot de functies. Stage toont hooguit de
plaats die bij het Moment hoort (*Amsterdam*), nooit waar iemand nu is. Voor
minderjarig publiek talent gelden bovendien `LEVEN.md` par. 2 en het
jeugdbestuur uit `kern/vertegenwoordiging/jeugd.js` onverkort: geen publieke
plaatsbepaling, geen zichtbaarheidsverplichting, en geen ranglijst van talenten
(`RUGDEKKING.md`).

### 5.7 Herkomst is niet hetzelfde als waarheid

Als C2PA ooit wordt ingebouwd, zegt het scherm *"herkomstinformatie
beschikbaar"* en nooit *"dit is echt"*. Twee claims die niet worden samengeperst
tot één vinkje: wat RTG zelf weet (dit bestand is op die datum door dit account
aangeleverd) en wat het bestand zelf draagt. Metadata kan onderweg verdwijnen,
en een badge die dat niet weet, liegt zachtjes.

### 5.8 Een cadeau is waardering en geen status

De vaste bedragen van `kern/podium/index.js` blijven vast. Er komt geen
ranglijst van gulle gevers, geen publieke optelsom per kijker en geen
wedstrijdje — dat is precies het verslavende engagement-patroon dat `CLAUDE.md`
verbiedt. Een daglimiet is een aparte, open vraag (par. 7).

---

## 5a. De wekdekking: wat mag de publieke rail op?

*Gemeten met `npm run wekdekking` → `WEKDEKKING.json`, tegen het besluitregister
`scripts/lib/wekbesluit.js`.*

Par. 1.3 zei dat de opdracht "aansluiten en niet uitvinden" is. Dat klopt nog
steeds, maar het is niet hetzelfde als "zes haken zetten". Niet elke mutatie
verdient een melding: wie zes domeinen aansluit zonder eerst te besluiten wát
er de rail op mag, bouwt binnen een jaar een feed van administratieve ruis.

**Drie klassen, en de middelste bestond nergens:**

| klasse | betekenis |
|---|---|
| `moment` | publiek moment — mag Stage bereiken **en** mag wekken |
| `stil` | publiek maar stil — Stage mag het tonen wanneer iemand kijkt; geen melding |
| `niet` | mag de publieke rail überhaupt niet op |

Die middelste is het besluit dat het meeste tegenhoudt. *Zichtbaar* en *de
moeite van een onderbreking waard* zijn twee verschillende vragen, en zonder een
eigen klasse ertussen wordt alles wat zichtbaar mag zijn vanzelf een melding.

Dertien besluiten over de zes domeinen: **4 moment, 3 stil, 6 niet.** Een
onbevestigde artiestenboeking staat er als `niet` — `kern/festival/gast.js`
houdt voornemens al uit het gastprogramma, en Stage mag niet de achterdeur om
die regel heen worden.

### Wat de meting vond, en waarom er nog niets bedraad is

| meting | uitkomst |
|---|---|
| domeinen zonder uitspraak | **0** — en dit getal staat op de ratel, zodat een zevende domein niet stil kan verschijnen |
| momenten zonder wekweg | **4** — alle vier zitten in een domein dat de haak niet aanroept |
| momenten zonder volgers | **3** — festival (2×) en sportclub hebben géén volgrelatie |
| momenten zonder aanleiding | **1** — `salon.post_uitgelicht` |

**Geen van de vier momenten kan vandaag eerlijk worden aangesloten**, en elk om
een eigen reden. Dat is de uitkomst die de volgorde van het werk bepaalt, en zij
was niet te zien zonder te meten.

1. **Festival en sportclub hebben niemand om te wekken.** De wekhaak wekt
   VOLGERS, en die lijst komt uit het domein zelf. Er is geen volgrelatie op een
   festival of een club. Een haak daar zetten levert een mechanisme dat in het
   niets vuurt — en dat is niet zichtbaar, want nul meldingen ziet er hetzelfde
   uit als nul volgers. *Wat volgen hier betekent, is een besluit en geen
   bedrading.*
2. **De Salon heeft als enige wél een echte volgrelatie** (`volgtLid`, gelezen
   door `kern/salon/profiel.js`, en die geeft ledensleutels). Zij hangt vandaag
   niet aan de medialaag. Dit is het enige domein waar aansluiten werkelijk
   bedrading is.
3. **Maar het Salon-moment heeft geen oorzaak.** `featured` wordt nergens gezet
   behalve in de seed, terwijl `kern/salonviraal.js` én `CLAUDE.md` allebei
   zeggen dat RTG cureert. Er is geen handeling waarmee dat gebeurt. Dat is een
   gat in een bestaande merkregel en niet in Stage — en het is de reden dat elk
   `moment` in het register zijn **aanleiding** noemt, die de meter in de
   gewrongen bron opzoekt. Een wachter zonder bron hoort te zeggen dat hij niet
   kijkt.

### De val die deze meter voor zichzelf zette

`creator.volgers` is een **getal** over een extern platform — het bereik dat de
maker zelf opgeeft — en geen relatie met RTG-leden. Een meter die het woord
`volgers` zoekt, ziet daar een volgerslijst. Daarom zoekt hij naar een FUNCTIE
die volgers oplevert en nooit naar het woord, en `test/wekdekking.test.js` toets
4 houdt dat vast.

---

## 6. De momentproef

*Gedraaid op 13 september 2026. `npm run momentproef`, register `MOMENTPROEF.json`.*

De vierde gouden keten naast `tafelproef`, `ritproef` en `toelatingsproef` -- en
de eerste die over een **projectie** gaat in plaats van over een levering. De
drie bestaande eindigen alle bij een geleverde dienst of een verleende toegang;
deze eindigt bij **iemand die iets weet**. Er wordt niets geleverd, en aan de
bron verandert niets.

**De keten die werkelijk gelopen is.** Drie bronnen in één keten, want dat is de
eigenlijke vraag: gedragen drie verschillende domeinen zich hetzelfde als publiek
moment?

| | van → naar | wat | stand |
|---|---|---|---|
| 1 | festival → publieke wereld | bevestigt een boeking; de aanwezigheid van de ZAAK ontstaat | gesloten |
| 2 | publieke wereld → fan | de fan **vindt** die aanwezigheid | gesloten |
| 3 | fan → publieke wereld | volgt, expliciet, en leest vooraf waarvoor hij tekent | gesloten |
| 4 | festival → fan | zet een kaart klaar; de volger wordt gewekt | gesloten |
| 5 | fan → festival | **vindt het moment terug** na de wek | gesloten |
| 6 | lid → publieke wereld | plaatst in De Salon; er ontstaat GEEN aanwezigheid | gesloten |
| 7 | kantoor → publieke wereld | licht uit, op naam en met een grond; de aanwezigheid van de AUTEUR ontstaat | gesloten |
| 8 | publieke wereld → tweede fan | volgt de maker; de volgende uitlichting wekt hem | gesloten |
| 9 | fan → publieke wereld | ontvolgt; het volgende feit bereikt hem niet | gesloten |
| 10 | sportclub → publieke wereld | legt een wedstrijd vast; de supporter wordt gewekt | gesloten |

**Tien gesloten, dertien storingen gehouden, vier architectuurbeweringen
gehouden. `sluit: true`.**

Dat was op de eerste ronde anders, en die eerste uitslag staat hieronder
onverkort: zeven gesloten en drie `openBekend`. De drie zijn daarna gesloten op
besluit van de eigenaar (13 september), en wat dat opleverde is leerzamer dan de
tien: **één van de drie was helemaal geen besluit maar een gebrek in de proef
zelf**, en het sluiten van de andere twee legde nog drie defecten bloot die geen
enkele toets zag. Zie par. 6a.

**De drie bevindingen zijn besluiten en geen defecten**, en de eerste twee zijn
elkaars spiegelbeeld:

- **Schakel 2 -- de fan kan een aanwezigheid niet VINDEN.** Er is geen route die
  publieke aanwezigheden opsomt of doorzoekt; `/api/mediaos/aanwezig` vraagt een
  id dat de fan al moet kennen, en `/aanwezig/mijn` toont uitsluitend wat hij al
  volgt. Dat is het Discovery-blok uit par. 4, en waarom het er niet zomaar bij
  kan staat in `routes/festival/gast.js`: *"er is in dit huis geen publieke kant,
  en een line-up is het eerste dat er een van zou maken"*.
- **Schakel 5 -- na de wek kan de fan niets DOEN.** De melding draagt geen
  bestemming (geen enkele `notify()` in dit huis doet dat), en er is geen
  ledenroute die de kaarten van een festival toont of verkoopt; kopen gebeurt aan
  de balie. Dit is exact de scheiding *moment ≠ notificatie* uit par. 3: de wek
  werkt, de weg terug naar het moment bestaat niet. Dat is de Fan Inbox.
- **Schakel 10 -- geteld is niet gelopen.** De wedstrijd van een sportclub is de
  vierde aanleiding en `WEKDEKKING.json` telt hem, maar `/api/sport/*` eist een
  zaak van het type `sportclub`, de zaaiset heeft er geen, en geen route zet dat
  type. De haak staat; de keten is er niet doorheen gegaan. Het besluit is of de
  zaaiset een sportclub krijgt.

**De architectuurproef, en waarom hij er is.** De schakels bewijzen dat de keten
loopt; deze vier bewijzen dat hij de goede kant op loopt. Een keten die sluit
terwijl de projectie ondertussen een tweede waarheid is geworden, heeft niets
bewezen -- dat is de `Asset`-fout, een laag later.

| | bewering | hoe gemeten |
|---|---|---|
| A | de bron legt het feit vast terwijl er **niemand** luistert | product zonder een enkele volger: staat in de bron, en er ging niets uit |
| B | geen handeling van Stage verandert het **ANTWOORD** van de bron | het volledige antwoord teken voor teken gelijk, voor en na volgen/ontvolgen/lezen |
| C | de projectie draagt geen veld en geen verwijzing die de bron niet al heeft | vorm gesloten op vijf velden, id letterlijk `drager:code`, geen verwijzing naar een boeking, product of post |
| D | de Stage-laag schrijft alleen in haar **eigen collecties** | gelezen uit de bron van de laag: elke `db.data.<collectie>` ⊆ `mediaAanwezig`, `mediaVolgt`, `mediaMomenten` |

**D bestaat omdat B aantoonbaar een gat heeft, en dat is de scherpste les van
deze proef.** B is met een mutatie nagetrokken: de volgroute kreeg er een regel
bij die een volgersteller TERUGSCHREEF in de producten van het festival -- precies
de creep waar deze laag tegen ontworpen is. **B bleef groen.** De bron vórmt zijn
antwoord, dus een onbekend veld haalt `/api/festival/producten` nooit en van
buiten is er niets te zien. B meet daarom wat hij meet -- het antwoord -- en niet
meer dan dat, en dat staat nu ook zo in zijn bewering. D leest het andere:
welke collecties de laag aanraakt. Zwart-doos en bron zijn hier geen keuze maar
twee helften, en ze worden apart gemeld.

**Wat de proef zelf vond en wat er gerepareerd is.** De publieke aanwezigheid van
een zaak droeg de naam van het FESTIVAL. Maar de aanwezigheid hangt aan de
DRAGER (`zaak:NACHT`), en een zaak kan meer dan één festival draaien: het tweede
festival hernoemde dus de aanwezigheid van het eerste, en een volger die op
"Eerste Festival" had gedrukt zag daarna "Tweede Festival" in zijn lijst staan
zonder dat hij iets had gedaan. De naam van het festival hoort in de **titel van
het moment** (die gaat over wat er gebeurd is), de naam van de aanwezigheid gaat
over **wie er spreekt** -- `kern/festival/index.js`, `dragerNaam`. Storing 12
houdt dat vast. Twee assertions in de eerste versie van de proef waren daarnaast
tandeloos: ze lazen een veld `uitlichtingen` op het redactiebord, en dat bord
heet `lopend` en `geschiedenis` -- een lege lijst die altijd leeg is, bewijst
niets.

**Wat de keten NIET bewijst**, en dat staat even groot in het register: er komt
geen browser aan te pas, er wordt niets betaald, en het is de festival- en
salonkant -- Podium, Clips en het Theater hebben hun eigen naden. Van de vier
Moment-aanleidingen zijn er drie echt gelopen.

**En wat de vier ketens samen delen, is geteld en niet verklaard**
(`npm run ketenvorm`): **0 van 33 actoren** in alle zeven, en 2 van 10
beloftethema's -- dezelfde twee als bij drie ketens, en allebei over de MACHINE
(mag dit twee keer, en zegt een weigering waarom) en niet over het domein. Acht
van de dertien storingen van deze keten vallen buiten élk thema; die lijst is met
opzet niet opnieuw verbreed, want een meter die je uitbreidt tot hij past, zegt
wat je wilt horen. De vierde keten legde daarbij een etiketteringsfout bloot die
er al stond: "alleen tafel" betekende *niet in alle ketens* in plaats van *in
precies deze*, dus `zaak` stond zowel als "alleen tafel" als als "alleen
toelating". Er is nu een middenbak -- `kantoor`, `lid` en `zaak` zitten in meer
dan één keten en in geen enkele in alle vier -- en het kopgetal bewoog daar niet
van.

---

## 6a. Wat het SLUITEN van de drie schakels opleverde

*13 september 2026, na het besluit van de eigenaar om schakel 2 en 5 in hun
kleine vorm te bouwen.*

De drie bevindingen van par. 6 heetten alle drie een **besluit**. Bij het
uitvoeren bleek dat maar voor twee ervan te kloppen, en het sluiten van die twee
legde nog drie defecten bloot die geen enkele bestaande toets zag. Dat is de
opbrengst die hier telt: niet dat de keten nu sluit, maar wat er tevoorschijn
kwam door hem te willen sluiten.

**Schakel 10 was geen besluit maar een gebrek in de PROEF.** De reden luidde "de
zaaiset heeft geen enkele zaak van het type `sportclub`". Dat is onwaar: FC RTG
staat er gewoon in (`kern/sportclub/index.js`) -- alleen **lui** gezaaid, diep in
zijn eigen wereldmodule, en de proef heeft die wereld nooit aangeraakt. Nagemeten
met `DEMO_SUPPLIER=FCRTG`: supplier-login 200 met `type: 'sportclub'`,
`/api/sport/cockpit` 200, `/api/sport/wedstrijd/maak` 200. De proef telde dus een
eigenschap van haar eigen **opstelling** als een eigenschap van het **huis** --
precies de vergissing waartegen zij bestaat, nu in haarzelf. *Geteld is niet
gelopen* gold dubbel.

**En daaronder lag een echte fout, van dezelfde familie als die van het
festival.** `momentVoorClub` gaf de aanwezigheid de naam `club(code).naam`, en
dat veld bestaat niet -- het clubdossier draagt teams, wedstrijden en velden,
geen naam. De publieke aanwezigheid van een club heette dus **`FCRTG`** in plaats
van *FC RTG*, en een supporter die op de naam van zijn club zocht, vond hem niet.
Dezelfde les als eerder: wie een aanwezigheid benoemt uit zijn eigen dossier in
plaats van vanaf de **drager**, laat het publieke adres iets anders heten dan de
zaak.

**De Fan Inbox legde bloot dat een moment nergens werd VASTGELEGD.**
`nieuwMoment()` wekte wel en bewaarde niets. Een lid werd dus gewekt over een
optreden en kon daarna nergens terugvinden waarover. Dat is *moment ≠ notificatie*
uit par. 3 met één helft ontbrekend: de wek werkte, het feit werd niet bewaard.
Het register dat er nu ligt (`db.data.mediaMomenten`) draagt daarom een scherpe
grens, want anders is het precies de tweede waarheid die deze laag verbiedt:

> Wat er staat is een **gebeurtenis** -- dat deze aanwezigheid op dit tijdstip dit
> soort heeft uitgezonden, met de tekst die er TOEN bij hoorde. Wat er **niet**
> staat is alles wat leeft: de naam wordt bij het lezen uit de aanwezigheid
> gehaald, zodat een club die hernoemt overal meteen goed staat.

De feed en de wek zijn daarbij met opzet twee dingen: vastleggen gebeurt zodra de
**aanwezigheid** iets uitzendt, gewekt wordt alleen wie dat soort aan heeft
staan. Wie ze samenvoegt, laat een lid zijn eigen geschiedenis kwijtraken door
een vinkje uit te zetten.

**Discovery maakt geen publieke kant, en dat is de grens en geen detail.** De
zoeker hangt aan de **ledendeur**; de waarschuwing in `routes/festival/gast.js`
gaat over een *publieke* line-up, en die is er nog steeds niet. Drie dingen doet
hij met opzet niet: geen volgerstelling (niet in de uitvoer en niet als
sorteersleutel -- gesorteerd op naam), geen aanbeveling, en geen echte namen.

**En de duurste vondst kwam van de nieuwe toets zelf: de volgknop loog.** Met de
declaratie `velden: ['id', 'aan']` stond `/aanwezig/volg` in het dubbeltikvenster
van vijf seconden. Gemeten:

    volg(aan:true)  -> 200, volgIk: true
    volg(aan:false) -> 200, volgIk: false
    volg(aan:true)  -> 200, volgIk: true, herhaald: true
    ... en /aanwezig/mijn staat op NUL.

Het derde verzoek is woordelijk gelijk aan het eerste, dus de poort gaf het
antwoord van toen terug en de handler kwam er niet aan te pas. **Een lid dat
binnen vijf seconden volgt, ontvolgt en opnieuw volgt, volgt niet -- en de API
zegt van wel.** Geen randgeval maar een gewone vinger op een knop. De rem is
eraf gehaald: `volg()` is zelf al idempotent (hij zet een stand met `indexOf`),
dus de poort voegde niets toe en kostte correctheid.

Daarbij hoort een eerlijke kanttekening die in `server/lib/idemsleutels-stage.js`
voluit staat: de gekozen vorm heet `nietIdempotent`, en die naam dekt de lading
niet -- dit is geen worp en geen teller. Er bestaat vandaag **geen vorm** die
zegt *"de handler is zelf idempotent, dus dedupliceren is overbodig en voor een
toggle schadelijk"*. Die vijfde vorm verzinnen is een besluit en geen bouwtaak.

## 7. De besluiten van de eigenaar

Vijf zijn er genomen; vier staan er open.

**Genomen op 13 september 2026:**

0. ~~**Wat betekent een festival of een club VOLGEN?**~~ **Genomen: één
   begrip en niet vier.** Een lid volgt een publieke AANWEZIGHEID, gedragen door
   een mens óf door een organisatie (`kern/mediaos/aanwezigheid.js`). De harde
   invariant: *een aanwezigheid heeft nooit méér bevoegdheid dan haar drager* —
   zij is een projectieadres en geen actor. En volgen is altijd expliciet: een
   kaartje kopen is geen volgen, lid zijn is geen volgen, ergens werken is geen
   volgen, merchandise kopen is geen volgen.
0b. ~~**Wie licht een Salon-post uit?**~~ **Genomen: een mens, op naam, met een
   grond uit een gesloten lijst** (`kern/salon/uitlichten.js`). De grond hoeft
   niet publiek te zijn, maar hij moet er zijn — geen grond, geen uitlichting —
   en intrekken is even expliciet. `salonviraal` mag alleen VOORSTELLEN.

0c. ~~**Discovery — hoe vindt een fan een publieke aanwezigheid?**~~ **Genomen:
   ja, maar achter de LEDENdeur** (`aanwezigZoek` in `kern/mediaos/aanwezigheid.js`,
   route `/api/mediaos/aanwezig/zoek` met `auth`). Er komt dus geen publieke kant
   bij — de waarschuwing in `routes/festival/gast.js` gaat over een *publieke*
   line-up. Drie dingen doet de zoeker met opzet niet: geen volgerstelling (ook
   niet als sorteersleutel — hij sorteert op naam), geen aanbeveling, en geen
   echte namen. Schakel 2 sluit.
0d. ~~**De Fan Inbox — hoe komt een fan van de wek terug bij het moment?**~~
   **Genomen: het lid opent zelf de tijdlijn van wat hij volgt**
   (`/api/mediaos/momenten`). `notify()` is niet aangeraakt: een melding blijft
   een WEK zonder bestemming, en dat wordt in schakel 5 ook gemeten. Wat ervoor
   moest komen was het **momentregister**, want een moment werd nergens
   vastgelegd — zie par. 6a voor de grens die voorkomt dat dat een tweede
   waarheid wordt. Schakel 5 sluit.
0e. ~~**Krijgt de zaaiset een zaak van het type `sportclub`?**~~ **Vervallen: de
   vraag was verkeerd gesteld.** FC RTG stond er al in, lui gezaaid; de proef had
   die wereld nooit aangeraakt. Schakel 10 sluit, op een eigen wegwerpserver —
   zie par. 6a.

**Open:**
1. **Hoe heet het?** `moment` draagt al zes betekenissen (par. 1.1). Hernoemen
   of uitwijken — `presence`, `broadcast`, `drop` en `stage` zijn vrij.
2. **Mag een vertegenwoordiger publiceren?** Een tiende bevoegdheid in een
   gesloten lijst van negen, met een grond. Zonder dit besluit is punt 30 niet
   te bouwen (par. 1.4).
3. **Krijgt de relay-boom een terugval?** Dat kost geld en het is de voorwaarde
   om een kaartje te mogen verkopen voor een uitzending (par. 1.7).
4. **Komt er een daglimiet op cadeaus?** De bedragen zijn al vast en er is geen
   ranglijst; een limiet is de derde rem en hij is er nog niet.
5. **Wie vervult een drop?** Zolang RTG niets bezorgt, mag geen scherm iets
   anders beloven (`LAT.md` regel 6). Fulfilment als capability is de uitweg,
   en dat is een besluit vóór het een bouwtaak is.
