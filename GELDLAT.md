# De geldlat — durability en idempotentie zijn één paar

Dit document beschrijft het contract voor financiële mutaties, en het bestaat
omdat de ketenronde (`npm run ketenronde`, seed `819226199`) een belofte
weerlegde die niemand had opgeschreven: een oplading wordt met 200 bevestigd,
en na een herstart is het geld weg.

`TOEZICHT.md` gaat over hoe bewijs wordt vastgelegd, dit document over de
zwaarste keten die dat bewijs moet leveren.

## Wat er is weerlegd

```
BUSINESSKETEN: GELD
verraad: schrijf-verloren        seed: 819226199

  client response ..... OK
  ledger invariant .... GELDIG
  state wijziging ..... TERUGGEDRAAID   ← het geld is weg
```

Het antwoord klopt, het grootboek klopt met zichzelf, en de oplading bestaat
niet meer. Dat kan omdat een **verloren schrijfactie het grootboek kloppend
achterlaat**: er is nooit iets geboekt, dus de som blijft nul. De sluitcontrole
bewaakt dat het grootboek intern sluit — niet dat wat bevestigd is ook bestaat.
Twee verschillende beloften, en de eerste leek de tweede te dekken.

Zonder sabotage had niemand dit gezien: alle gewone oplaadtoetsen staan groen.
De definitie van "geslaagd" was zelf te zwak.

## Het contract voor een financiële mutatie

```
mutatie voorbereiden
  → grootboek/invariant controleren
  → duurzame write
  → fsync bevestigd
  → state definitief
  → response 2xx
```

De volgorde is de hele inhoud. Een 2xx die vóór `fsync bevestigd` vertrekt, is
een belofte die de opslag nog niet heeft gedaan.

## `saveDuurzaam()` is met opzet een zware primitive

Dit is de belangrijkste ontwerpregel in dit document, en hij gaat over misbruik
in plaats van over techniek.

`saveDuurzaam()` mag **geen algemene synchrone variant van `save()`** worden.
Zodra hij als "de veilige save" wordt gelezen, gebruikt iemand hem voor
profielen, likes en voorkeuren — en dan is het prestatieprofiel van het hele
platform veranderd zonder dat er ooit een beslissing over is genomen. Dat is
geen hypothetisch risico: het is precies hoe elke goedbedoelde primitive
ontspoort.

Daarom:

- hij is **alleen** voor mutaties waarvoor duurzaamheid vóór bevestiging
  noodzakelijk is;
- de toegestane aanroepplekken staan op een **lijst met een reden per regel**,
  net als `PUBLIEK` in de poortwacht en `MAG` in de klokschuld;
- een aanroep buiten die lijst is een **harde fout in `npm run check`**, niet
  een waarschuwing;
- de naam zegt wat het kost, niet wat het oplost.

## De gemeenste failure, en waarom idempotentie erbij hoort

```
duurzame write gelukt
  → proces sterft
  → response bereikt de klant nooit
  → klant retryt
```

De klant weet niet dat de eerste opdracht is gelukt. RTG moet bij de herhaling
herkennen: **deze financiële opdracht is al duurzaam uitgevoerd.**

Zonder dat los je een lost-write op en bouw je een double-write. Durability en
idempotentie zijn hier dus geen twee taken maar één: een duurzame commit die
niet herkenbaar is bij een retry, is een nieuwe fout in plaats van een
opgeloste.

Dat betekent ook dat de idempotentiesleutel **mee moet in dezelfde duurzame
write** als de boeking. Staat hij ergens anders of later, dan bestaat er een
venster waarin de boeking vast staat en de sleutel niet — precies de toestand
die de retry verkeerd laat aflopen.

## Het besluit over de reikwijdte — genomen op 12 augustus 2026

`saveDuurzaam()` gaat gelden voor **geld én alles wat een lid zelf maakt**:
notities, agenda, bestanden en berichten. Niet voor afgeleide of herbouwbare
toestand (caches, tellers, indexen, sessiestand).

De afweging stond zo: alleen geld is het snelst en laat één bekende bevinding
open — een bevestigde notitie kan bij een opslagfout verdwijnen. Dat is precies
wat de ketenronde op `notities/bewaar` meet en wat als GEZAKT in de
bewijsmatrix staat. De keuze is om die te sluiten.

**Dat verandert de rol van de prestatiemeting.** Ze is geen poort meer waar het
besluit van afhangt, maar de eerste stap van de uitvoering: we willen weten wat
het kost, niet meer of het mag. Blijkt de latentie op de veelgebruikte paden
onaanvaardbaar te verslechteren, dan is dat nieuwe informatie en geen veto — dan
komt de vraag terug met een getal erbij.

De regel dat `saveDuurzaam()` op een **lijst met redenen** staat en dat een
aanroep daarbuiten `npm run check` laat zakken (regel 47), blijft onverkort. De
lijst wordt langer, niet losser: elk nieuw pad noemt waarom een lid zijn werk
niet mag kwijtraken. Wat er níét op komt, is even belangrijk — een cache die
opnieuw te vullen is, hoort niet duurzaam bevestigd te worden.

### De uitbreiding van 6 september 2026 — een rem die een mens overhaalt

Het besluit hierboven kent twee categorieën, en de faalproef vond een derde die
in geen van beide past. `FAALPROEF.json` (`npm run faalproef`) draait de
verraadsmotor per route en meet wat er onder `schrijf-verloren` gebeurt: de
opslag bevestigt en bewaart niet. Over de 139 duurzaam schrijvende routes staat
het er zo:

```
onder schrijf-verloren    11 bewezen (5xx)   102 greep niet aan   26 GEZAKT (200)
onder schrijf-faalt      135 bewezen (5xx)     2 ongemeten         2 GEZAKT (200)
```

De 102 zijn geen groen: daar veranderde de toestand gewoon, dus het verraad
raakte de route niet en er is niets over gemeten. Alleen de elf antwoorden een
fout waar de opslag stil verloor. De zesentwintig die 200 melden zijn wél
beoordeeld, en drieëntwintig daarvan zijn leesvormige POSTs waarvan de enige
schrijfactie het inrichten van een standaard-entiteit is; één schrijft alleen
een auditregel. Twee niet:

```
POST /api/office/techniek/integraties/noodstop   -> antwoordt `noodstop: true`
POST /api/command/uitrol/pauze                   -> antwoordt stand `stil`
```

Allebei is het een MENS die aan de rem trekt en een bevestiging terugkrijgt.
Allebei is de schrijfactie niet vastgelegd, dus na een herstart staat er niets —
dat volgt uit wat `schrijf-verloren` dóét (`save()` keert terug zonder te
schrijven) en is voor deze twee niet apart nagemeten. Het is geen afgeleide
toestand die je opnieuw kunt opbouwen: de integraties staan gewoon weer aan, en
de uitrol loopt gewoon door.

De twee die onder `schrijf-faalt` zakken zijn een ANDER gebrek en horen niet in
deze uitbreiding: `POST /api/dag` en `POST /api/kosten/mij` antwoorden 200
terwijl de opslag een uitzondering GOOIDE. Daar is geen duurzaamheidsvraag maar
een weggevangen fout, en die reparatie zit in de route en niet in de primitive.

**De reikwijdte krijgt daarom een derde been: een rem die een mens overhaalt.**
Niet "alles wat het kantoor doet" — een kantoorscherm dat een lijst herschikt of
een cache verwarmt hoort er nadrukkelijk niet bij. Het criterium is smal en het
staat hier zodat de volgende het kan toetsen:

> een handeling die een mens bewust uitvoert om iets te STOPPEN, en waarvan de
> bevestiging de mens doet geloven dat hij weg kan lopen.

Dat criterium sluit de twee hierboven in en laat de tweeëntwintig andere
kantoorroutes uit de faalproef eruit. De latentieprijs uit stap 6 speelt hier
nauwelijks: het zijn boardroom- en kantoorroutes die zelden worden aangeroepen,
en een noodstop die twee milliseconden langer duurt is geen noodstop minder.

### Wat er inmiddels aan hangt

```
GELD        kern/pay -> lib/idem -> bijeen({duurzaam:true})     AANGESLOTEN
FACTUUR     kern/factuursaldo -> bijeen({duurzaam:true})        AANGESLOTEN
NOTITIES    kern/notities -> lib/duurzaam -> bijeen(...)        AANGESLOTEN
AGENDA      -                                                   OPEN
BESTANDEN   -                                                   OPEN
BERICHTEN   -                                                   OPEN
NOODSTOP    -                                                   OPEN
UITROLPAUZE -                                                   OPEN
```

Twee dingen zijn bij het aansluiten van notities geleerd, en ze horen hier omdat
ze voor de volgende drie net zo gelden.

**De poort bewaakte de deur niet die iedereen gebruikt.** Regel 47 zocht op de
naam `saveDuurzaam`, en niemand roept die naam aan — de weg erheen is
`bijeen(fn, { duurzaam: true })`. Wie een route duurzaam maakte, kwam er dus
ongezien langs. De regel kijkt nu naar het **bereik**: de naam, de bundelvlag en
de gedeelde helper. Een poort die precies de gebruikte ingang niet bewaakt, is
erger dan geen poort, want hij ziet eruit als dekking.

**Niet alleen de gemeten knop.** De ketenronde meet `notities/bewaar`, maar een
lid kan niet zien welke knop beschermd is. Afvinken, delen en weggooien zijn
evengoed werk van een lid — een boodschap die weer aanstaat, een notitie die
terugkomt nadat je hem hebt weggegooid. Alleen repareren wat er gemeten wordt, is
het symptoom repareren (`LAT.md`, regel 1). De leeskant schrijft niets en gaat er
dus niet doorheen; dat is de grens.

De gedeelde helper staat in `server/lib/duurzaam.js` en niet in elke app apart:
vier kopieën van dezelfde zes regels zijn vier plekken die een waarheid
vasthouden, en de eerste die uit de pas loopt doet dat stil (`LAT.md`, regel 4).

## De volgorde van bouwen

1. `saveDuurzaam()` als expliciete primitive. **Niet** stilletjes `save()`
   veranderen.
2. Alleen de kritieke geldcommit eraan hangen.
3. Bewijzen dat een 2xx nooit vóór durability vertrekt.
4. Crash direct ná durability, vóór de response.
5. Retry van dezelfde opdracht → exact één financiële mutatie.
6. De echte Beproeving draaien: niet de gemiddelde doorvoer, maar **p95/p99 en
   het event-loop- en opslageffect vóór en na** naast elkaar.
7. Pas dán `GELDPROVEN 2/2`.

Stap 6 vóór stap 7 is geen formaliteit. Een duurzaamheidsgarantie die de
latentie verdubbelt is een productbeslissing, en die hoort met een gemeten
getal genomen te worden.

### Stap 6, gemeten op 12 augustus 2026

`npm run kosten` (`scripts/duurzaamheidskosten.js`) meet **gepaard**: dezelfde
machine, dezelfde opslag, dezelfde belasting, twee rondes achter elkaar met
alleen `RTG_DUURZAAM` ertussen. Vier kernen, linux, sqlite, 400 verzoeken per
route.

```
route                  p50 aan   p50 uit     p95 aan   p95 uit     p99 aan   p99 uit
notities/bewaar           5,35      2,58        7,08      4,16        8,21     11,62
agenda/toevoegen          7,14      3,67        8,97      6,53       13,39     13,68
bestanden/map             6,91      3,43        9,10      6,56       11,05     13,41
zorgprofiel/zet (ctrl)    3,55      3,43       12,17     12,32       13,71     13,62

FACTOR p50 duurzaam  2,01x      p95  1,49x      p99  0,84x
FACTOR p50 CONTROLE  1,03x   <- de ijklijn: die hoort rond 1 te liggen
```

**De mediaan verdubbelt, de staart beweegt niet.** Dat laatste was niet het
verwachte antwoord en het is het interessantste getal van de drie: de p99 van
een duurzame route ligt niet boven die van de controle. De staart wordt hier dus
niet bepaald door de fsync maar door wat er sowieso al gebeurt (event loop, GC),
en dat is precies waar een gebruiker een trage app aan merkt.

In absolute termen: ongeveer **3 milliseconden per schrijfactie**. Dat is de
prijs van "bevestigd betekent vastgelegd", en daarmee is de vraag uit stap 6
beantwoord met een getal in plaats van een gevoel.

**Waarom niet gewoon `npm run beproeving` twee keer.** Dat is een storm over
honderden endpoints; het effect van vier routes verdrinkt erin. En de laatste
vastgelegde ronde stond op een andere machine én een andere opslag
(darwin/postgres tegen linux/sqlite) — die vergelijk je niet (`LAT.md`, regel 10).

**De schakelaar die dit mogelijk maakt is met opzet luid.** `RTG_DUURZAAM=uit`
weigert in productie en schreeuwt bij elke start. Het is letterlijk de knop die
de belofte uitzet; een stille vlag die "even sneller" betekent staat binnen een
half jaar in een productie-omgeving.

## Wat er al ligt

`db.persistentieStand()` (`server/db/index.js`) leest de teller die de
SQLite-opslag buiten het geheugen bijhoudt. Bewezen in
`test/persistentiestand.test.js`: hij loopt op na een echte schrijfactie, staat
**stil** onder `schrijf-verloren` terwijl het geheugen wél verandert, en geeft
`null` — niet `0` — waar niet te tellen valt.

**En wat die eerste poging leerde.** Observeren is niet genoeg. Een versie die
de geldroute liet wachten tot die teller opliep, brak vier geldtoetsen met 503:
de opslag is write-behind, dus op het moment dat de route antwoordt is de
schrijfactie nog niet eens geprobeerd. De teller staat dan terecht stil. Er moet
dus **afgedwongen** worden, niet gewacht — en dat is stap 1 hierboven.

## Hoe het bewijs eruit hoort te zien

Niet één woord PROVEN, maar per bewijssoort waar hij vandaan komt — inclusief
waar een bewijssoort níét van toepassing is:

```
GELD-DURABILITY
  scenario test        PROVEN
  fault injection      PROVEN
  subprocess detector  SELF-TESTED
  source mutation      NOT APPLICABLE
```

De laatste regel is er omdat een subprocestoets buiten het bereik van de
mutatiemotor valt. Dat is geen vergeten toets en het hoort niet te verdwijnen
in een totaal van zeshonderd groene: het bewijs kwam anders tot stand, en dat
is leesbaar.

## De drie situaties die stap 2 moet bewijzen

Zodra `oplaadAfronden` vóór zijn 2xx door `saveDuurzaam()` gaat, moeten er
direct drie dingen vaststaan — niet één:

1. **normale duurzame write → 2xx.** De gewone weg blijft werken, en dat is geen
   vanzelfsprekendheid: de eerste poging brak vier geldtoetsen.
2. **duurzame write faalt → géén succesresponse.** Dit is de fout die de
   ketenronde vond.
3. **duurzame write slaagt, proces sterft vóór de response, klant retryt →
   exact ÉÉN economische mutatie.**

Nummer 3 is de eigenlijke financiële eindtest, want daar komen durability en
idempotentie samen. De klant weet niet dat de eerste opdracht is gelukt; RTG
moet dat bij de herhaling herkennen. Wie alleen 1 en 2 bewijst, heeft
lost-write opgelost en double-write gebouwd.

Daaruit volgt de eis die eerder in dit document staat en die hier zijn reden
krijgt: de idempotentiesleutel gaat **mee in dezelfde duurzame write** als de
boeking. Elk venster tussen die twee is precies het venster waarin scenario 3
verkeerd afloopt.

## Waarom `POST /api/pay/oplaad` op GEZAKT staat terwijl CI groen is

Dat is met opzet en het is de kortste samenvatting van dit hele document:

> de codebase is bouwbaar en de controls werken, maar deze concrete financiële
> belofte is onder sabotage weerlegd.

CI rood houden om een onderzoeksbevinding leert iedereen om rood weg te kijken.
De route groen maken zou liegen. De bevinding staat waar hij hoort: in de
matrixcel van de route zelf.

## Scenario 3, gemeten op een echt geldpad — 12 september 2026

Het scenario hierboven stond hier sinds augustus als eis, en `test/saveduurzaam.test.js`
bewees er de helft van: dat het **injectiepunt** werkt (het proces sterft
werkelijk ná de duurzame schrijfactie, en de data overleeft). Die toets zegt er
zelf bij dat de geldketen nog open stond — die opmerking was inmiddels verouderd,
want de tabel hierboven zet `GELD` al op AANGESLOTEN. De vraag was dus meetbaar
en was nooit gemeten.

`npm run factuurproef` (`scripts/factuurproef.js`) meet hem, op het dunste
volledige geldpad dat dit huis heeft: `POST /api/pay/saldo` — de maandfactuur
betalen uit het eigen RTG Pay-saldo. Zeven stappen, en de maat is telkens de
**toestand** en nooit de status. Dat onderscheid is de hele reden dat dit
instrument bestaat:

> een route kan keurig 409 weigeren terwijl drie van de vijf geldcollecties al
> tweemaal zijn aangeraakt.

```
1 PROVEN    de factuur staat open en het saldo dekt hem
2 PROVEN    het geldpad voert uit: saldo af, factuur dicht, afdracht geboekt
3 PROVEN    een identieke tweede aanroep verplaatst NUL waarde
4 PROVEN    het proces sterft na de duurzame boeking en voor het antwoord
5 PROVEN    na de herstart is de uitkomst HEEL   <- stond op FAILED; gerepareerd
6 PROVEN    de herhaling na de crash levert over alles heen exact EEN mutatie
7 UNKNOWN   de terugweg
```

**Stap 5 stond bij de eerste ronde op FAILED.** Wat hij vond en hoe het is
gerepareerd, staat hieronder uitgeschreven; het is de reden dat deze proef
bestaat en het hoort niet weggepoetst te worden tot een groene regel.

### Stap 3 is bewezen, en scherper dan de idempotentieproef hem kan stellen

Na de tweede, identieke aanroep bewoog er in **geen van de vijf geldcollecties**
iets: gelijk aantal én gelijke hash op `paySaldi`, `payBoekingen`, `invoices`,
`fondsAfdrachten` en `socialeAfdrachten`. Wat wél bewoog is het audittrail
(`apiSpoor`, `handelingLog`) — dat hoort zo, en het staat met naam in de uitslag
in plaats van weggefilterd te worden. "We negeren de rest" is precies hoe een
echte dubbele mutatie ongezien blijft.

### Stap 5 was GEZAKT, en dat is de opbrengst van deze proef

Reproduceerbaar over drie rondes:

```
saldo vóór          20000        saldo ná        12135   (EUR 78,65 afgeschreven)
factuurstand        open  <-- nog steeds open
boekingen op deze factuur   1
afdracht RTFoundation       0
```

**Het lid is afgeschreven en zijn factuur staat nog open.** De oorzaak is
eenduidig aan te wijzen en volgt uit waar het crashpunt zit: `sterf-na-commit`
vuurt uitsluitend in `saveDuurzaam()`, en de enige duurzame commit op dit pad is
die van `pay.huisIn` (boeking + idem-sleutel, via `lib/idem.js`). De afwikkeling
die daarna komt — `settleFactuur`, die de factuur sluit en de 30%-afdracht boekt
— staat **buiten** die bundel. Het venster is dus exact:

```
pay.huisIn  -> duurzame commit (geld + sleutel)   VAST
            -> [crash]
settleFactuur -> factuur dicht, afdracht          NOOIT GEBEURD
```

Dit is niet de fout die dit document in augustus weerlegde. Toen verdween het
geld en klopte het grootboek. Nu staat het geld vást en is de tegenprestatie
zoek — de spiegel ervan, met dezelfde onderliggende oorzaak: twee dingen die bij
elkaar horen landen in twee commits.

**De toestand geneest bij elke herhaling** (dat is stap 6, en die is PROVEN): de
idem-sleutel overleefde de crash, dus `pay.huisIn` geeft dezelfde boeking terug,
`settleFactuur` loopt alsnog, en over crash + herhaling heen staat er exact één
boeking, één betaalbewijs en één afdracht. Er wordt niets dubbel geboekt. Maar
de genezing hangt volledig aan een klant die het opnieuw probeert; er is geen
herstelronde die halve betalingen opruimt (drie seconden na de herstart gewacht
en nagemeten — er is er geen). Blijft de herhaling uit, dan blijft de factuur
open terwijl hij betaald is.

### De reparatie, en waar zij uiteindelijk terechtkwam

De eerste poging deed het bij de aanroepers: `server/lib/idem.js` zou eerst
`inBundel()` vragen en meedoen in een openstaande bundel, en
`server/kern/factuursaldo.js` zou er een om de boeking én de afwikkeling heen
openen. Dat werkt, en het is precies wat `server/lib/duurzaam.js` en
`kern/fonds.js` al deden.

**En juist dat was het argument om het níét daar te doen.** Twee modules
stelden die vraag al elk apart, een derde (`lib/idem.js`) vergat hem, en er
werd niets rood — de geldketen verloor stil zijn atomiciteit. Een regel die
elke aanroeper apart moet onthouden, is een regel die de volgende vergeet.

De vraag woont daarom in **`server/db/bijeen.js`** zelf: een `bijeen()` binnen
een openstaande bundel die dezelfde belofte doet, doet daarin mee in plaats van
een eigen doos te openen. Wie de vraag al stelde krijgt hetzelfde antwoord en
verandert niets; wie hem vergat, is nu gedekt. `kern/factuursaldo.js` opent de
bundel om boeking en afwikkeling heen, en dat is de hele wijziging aan de
geldkant.

**De grendel eromheen is even belangrijk als de reparatie.** Meedoen mag alleen
in een bundel die dezelfde belofte doet: een NIET-duurzame buitenbundel zou een
geldcommit stil degraderen van "bevestigd als de opslag het heeft" naar
write-behind — precies de belofte die dit document in augustus weerlegde. Zulke
bundels bestaan ook echt (`db/economische-boeking.js` opent er een zonder de
vlag), dus `inBundel({ duurzaam: true })` geeft daar `false` en de geldcommit
opent gewoon zijn eigen duurzame doos. `test/idembundel.test.js` houdt die
grendel vast; vier mutaties nagetrokken, waaronder "altijd meedoen" en "de eis
genegeerd".

En één ding is bewust NIET in de bundel gezet: het seintje naar het lid
(`broadcastSync`) staat erbuiten. Een uitgaand bericht binnen een bundel
vertelt iemand iets dat de opslag nog niet heeft bevestigd.

Na de reparatie meldt stap 5 `volledig doorgegaan`: saldo af, factuur betaald,
afdracht geboekt — de crash valt nu ná de commit van het hele pad. Stap 6 geeft
409 met alles ongewijzigd, dus over crash en herhaling heen staat er nog steeds
exact één mutatie.

### Stap 7 blijft UNKNOWN, en dat is geen tekortkoming van de proef

`HERSTEL.json` leidt kandidaat-tegenhangers af uit de naam van een route en
noemt `/api/pay/saldo` **nul** keer. Zonder kandidaat valt er niets uit te
voeren, en niets komt boven de graad `vermoed` uit een naam. De compenserende
bouwsteen bestaat wél — `pay.huisUit` is de spiegel van de `pay.huisIn` die dit
pad gebruikt, en hij heeft echte aanroepers bij Assets en bij de punten — maar
geen ervan hangt aan een factuur. De bevinding is dus niet "er is geen terugweg"
maar **de bouwsteen ligt er en de bedrading ontbreekt**.

`FINAL` zou hier een besluit van de eigenaar zijn en geen meting. Daarom staat er
`UNKNOWN`, precies zoals `HERSTELBESLUIT.json` het bedoelt.

### Wat dit zegt over de zeven geblokkeerde geldpaden

De proef is gebouwd om te ontdekken welke gedeelde bouwstenen die paden
werkelijk nodig hebben, in plaats van er een crashwereld voor te verzinnen. Wat
er nodig bleek is opvallend weinig, en dat is zelf de uitkomst:

- **een wereld** — een lidsessie, een oplading en een bestaand onderwerp uit de
  zaaiset. Meer niet. `scripts/lib/wegwerpserver.js` levert de server, de map en
  de opruiming al.
- **een crashpunt** — bestaat al, ingebouwd, deterministisch, en er hoefde géén
  testhaak in productiecode: `RTG_VERRAAD=sterf-na-commit`. De enige truc die
  eromheen nodig was, is dat de opstelling schoon draait en pas de tweede start
  het verraad draagt, want de opstelling schrijft zelf duurzaam.
- **een economische momentopname** — en die bestond ook al, in twee helften:
  `/api/techniek/vingerafdruk` (bewóóg er iets: aantal + gezouten hash per
  collectie) en de domeinroutes van het lid zelf (de bedragen). Twee getuigen,
  want de vingerafdruk ziet een stille rij die geen route toont, en de bedragen
  zien een hash die toevallig gelijk blijft.

En dan de vondst die de hele lijst raakt. Dit pad stond zelf op
`BLOCKED_BY_TEST_FIXTURE` met als reden "geen openstaande factuur" — **en die
factuur lag er gewoon**, in `server/seed/leden.js`, als `RTG-2026-0207`. De
blokkade was een aanname en geen meting, en ze hield het geldpad dat over vijf
collecties beweegt een maand lang ongemeten.

Dat is geen incident. `POST /api/pay/verzoek/intrek` stond om dezelfde soort
reden geblokkeerd ("zonder verzoek geeft de route 404"), en er is nagemeten wat
daar werkelijk voor nodig was: **één opzetaanroep**. Twee lidsessies, `POST
/api/pay/verzoek` met de codenaam van de tweede, en het onderwerp bestaat —
`intrek` geeft dan 200 en een tweede poging 409. Er is geen wereld te bouwen, er
was een aanroep te doen.

De verwachting was dat deze zes een crashwereld nodig hadden. Wat ze nodig
hebben is dat iemand het onderwerp langs de gewone route laat ontstaan. Wie de
resterende vijf oppakt: begin met kijken of de zaaiset of een bestaande route het
al levert, en verander pas een `stand` nadat je gemeten hebt — hier is die stand
vervangen door `PROTECTED` mét het instrument en de datum erbij, niet door een
betere aanname.

Eén echte tekortkoming in de fixture is er ook, en die is het noteren
waard: **de zaaiset heeft precies
één open factuur, en dat is een abonnementsfactuur.** Er is dus geen open
factuur zonder RTFoundation-afdracht om tegenaan te meten, en de afwikkeling van
een niet-abonnement is daarmee op dit pad niet te beproeven.

Let ten slotte op één beperking van de meetopstelling zelf, die in de uitslag
staat en niet weggepoetst hoort te worden: het zout van de vingerafdruk wordt
per proces getrokken (met reden, zie `server/lib/vingerafdruk.js`). Over een
crash heen zijn dus alleen de **aantallen** en de bedragen vergelijkbaar, niet
de hashes. `bakverschil()` valt daar zelf op terug en zegt met `hashVergelijkbaar`
dat hij het doet; `test/factuurproef.test.js` houdt dat vast met een mutatie,
want een versie die de hashes tóch vergelijkt meldt elke geldbak als bewogen en
maakt de crashfase permanent rood.

## Het correctiemodel — besluit van de eigenaar, 12 september 2026

Dit document ging tot nu toe over de HEENWEG: komt een financiële mutatie heel
en één keer op schijf. De vraag erna — wat als hij achteraf fout blijkt — was
nooit beantwoord, en `HERSTELBESLUIT.json` stond daarom met opzet leeg. Dat
besluit is nu genomen, en het staat in dat register zodat het naast de getallen
leeft in plaats van in een herinnering.

> **RTG gebruikt append-only economische geschiedenis en corrigeert primair met
> compensaties. Geen generieke undo.** Iedere geldroute verklaart expliciet of
> hij REVERSIBLE, COMPENSATABLE, FINAL of NOT_APPLICABLE is. UNKNOWN blijft
> zichtbaar en ratelt alleen omlaag.

**Voor geld is COMPENSATABLE de standaard, niet REVERSIBLE.** Financiële
geschiedenis hoort niet te worden herschreven: is een factuur eenmaal
economisch verwerkt, dan wil je niet achteraf doen alsof die gebeurtenis nooit
heeft bestaan. Je wilt de fout ernáást zien staan.

```
+500   de oorspronkelijke gebeurtenis
-500   de compensatie
+450   de correcte boeking
```

en niet: *de oude 500 stil verwijderen*. Dat is wat audit, boekhouding en bewijs
nodig hebben, en het is de enige vorm die later refunds, chargebacks,
settlementcorrecties, payrollcorrecties en partnerafrekeningen kan dragen zonder
de geschiedenis te vervalsen.

`REVERSIBLE` mag wel bestaan, maar alleen waar de domeinregels aantonen dat een
toestand werkelijk atomair terug te draaien is én er geen economische gebeurtenis
is vastgelegd die zou moeten blijven staan. Een pre-settlement toestand kan dat
zijn; een verwerkte betaling niet.

### Een verklaring is geen bewijs, en dat is machinaal afgedwongen

Dit is de scherpste kant van het besluit. `HERSTELBESLUIT.json` zegt wat de
BEDOELING is; `bewijs` zegt of die bedoeling ergens is uitgevoerd. Zonder dat
onderscheid wordt de as groen op de dag dat iemand `COMPENSATABLE` tikt —
precies de faalvorm die de idempotentie-as al kent, waar een `stand` in een
contract ook niet als meting telt.

`scripts/gelddekking.js` kent daarom vier uitkomsten op deze as, en `BLOCKED` is
er nieuw bij:

```
PROVEN           verklaard EN de terugweg is ergens uitgevoerd
BLOCKED          verklaard, maar er valt (nog) niets uit te voeren -- mét watErMoetKomen
NOT_APPLICABLE   FINAL of geen corrigeerbare waarde-eindtoestand: beantwoord, geen gat
UNKNOWN          nog niet geclassificeerd -- de schuld die alleen mag dalen
```

Drie mutaties houden dat vast (`test/gelddekking.test.js`): een verklaring zonder
bewijs als PROVEN tellen, FINAL als gat tellen, en het bewijsveld negeren. Alle
drie laten ze de toets zakken.

### De eerste verklaring, en waarom het er één is

`POST /api/pay/saldo` staat op **COMPENSATABLE**, en dat is de enige route
waarvan de terugweg werkelijk is GEMETEN in plaats van beredeneerd. De grond
staat in het register: deze route legt drie gebeurtenissen vast — saldo eraf,
factuur dicht, afdracht naar de RTFoundation — en die afdracht is al bij een
derde partij. Ze terugdraaien zou betekenen dat je doet alsof de betaling nooit
heeft plaatsgevonden terwijl de stichting haar deel heeft gekregen.

Haar bewijs staat op `BLOCKED`, met wat er moet komen: er is nog geen route die
op een betaalde factuur een tegenboeking zet. `npm run factuurproef` stap 7 mat
dat — nul kandidaat-tegenhangers in `HERSTEL.json`, en de compenserende
bouwsteen `pay.huisUit` bestaat wél maar heeft geen enkele aanroeper op een
factuur. **De bouwsteen ligt er, de bedrading ontbreekt.**

De andere 41 blijven UNKNOWN. Eenenveertig standen verzinnen omdat er nu een
beleid is, zou precies de grens breken die boven het register staat: een stand
wordt nooit afgeleid uit bewijs, en een beleid is geen stand. De ratel
(`geldRoutesHerstelOnbesloten` in `NORM.json`) staat op de dag van invoering op
**41** en mag daarna alleen dalen.
