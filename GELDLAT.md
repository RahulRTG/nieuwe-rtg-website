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
