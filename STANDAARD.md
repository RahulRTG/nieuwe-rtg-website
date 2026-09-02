# De RTG-standaard

Dit is de **minimale** standaard: de vloer, niet de ambitie. `CLAUDE.md` gaat
over het merk, `LAT.md` over hoe code geschreven hoort te worden, en dit over de
eigenschappen die het platform als geheel moet dragen voordat er een laag
bovenop mag.

De maatstaf, in een zin:

> Een systeem is pas af wanneer ieder belangrijk gedrag **contractueel
> beschreven**, **gelijktijdig correct**, **continu waarneembaar**,
> **reproduceerbaar bewezen**, **veilig uitvoerbaar** en **begrensd aanpasbaar**
> is.

"Big tech premium" is bewust niet de lat. Die is niet afdwingbaar: geen machine
kan hem laten zakken, en wat geen machine kan laten zakken is in dit huis een
voornemen. De zes eigenschappen hierboven kunnen dat wel, elk met een eigen
meter en een eigen noemer.

Bijgewerkt: 2026-09-02.

---

## 0. Wat deze standaard NIET is

**Geen cijfer.** Er komt geen samengesteld getal, geen niveau-badge en geen
enkel groen vinkje boven deze eigenschappen. Dat is geen smaak maar een regel
die hier al staat: `LAT.md` regel 11 (bewijsgroen is geen go-live-groen),
`scripts/check.js` regel 48, en `scripts/zekerheid.js` bestaat juist omdat
losse eerlijke getallen bij elkaar een gevaarlijk gevoel geven. Een lezer die
"RTG staat op niveau 5" leest, kijkt niet meer naar de veertien registers
eronder -- en precies daar staat de waarheid.

**Wel een ontwerptaal.** De niveaus hieronder mogen gebruikt worden om een
BESLUIT te wegen ("dit ontwerp maakt niveau 6 over drie jaar onmogelijk"). Ze
mogen nooit worden opgeteld tot een stand van het platform. Een eigenschap
draagt haar niveau **per domein**, met `niet vast te stellen` als zichtbare
derde stand naast gehaald en niet gehaald.

| | wat het systeem doet |
|---|---|
| 1 functioneel | doet wat er gebouwd is |
| 2 productie | blijft overeind onder echte belasting |
| 3 beheersbaar | veilig, controleerbaar, herstelbaar |
| 4 geschaald | verdeeld, waarneembaar, met gereedschap eromheen |
| 5 bewezen | kritieke eigenschappen dragen machinebewijs |
| 6 terugkoppelend | wat draait, verandert het contract en het beleid |
| 7 uitvoerend | intenties worden veilig gepland en uitgevoerd |
| 8 soeverein | blijft correct bij fouten, providers, netwerken, agenten en menselijke vergissingen |

---

## 0b. Wat "minimaal" betekent, per tijdvak

Een minimumeis die je op 2905 modules tegelijk oplegt, is op dag een onwaar --
en dan wordt hij binnen een week uitgezet. `LAT.md` heeft dat probleem al een
keer opgelost, en deze standaard erft die vorm letterlijk.

**De toekomst -- bindend.** Nieuw werk voldoet aan de instroomeisen hieronder,
en waar een machine kan handhaven handhaaft hij. Wie een eis toevoegt, beproeft
hem met een mutatie voordat hij hem inlevert (`LAT.md` regel 2 geldt ook voor
eisen).

De handhaver daarvan is `scripts/deltapoort.js` en niet een goed voornemen. Die
poort weigert het SALDEREN dat een ratel toestaat: een **nieuw** bestand staat
op de norm, een **aangeraakt** bestand mag niet zakken. Elke poortregel dient
een meter uit `NORM.json` en verzint niets eigens -- dus een eis die hier bindend
heet, heeft een meter, of hij heet het niet.

**Het heden -- geteld en gerangschikt.** Wat er niet aan voldoet is een eindige
lijst met een nummer: `TAKEN.md` par. 7. Naar risico gerangschikt en niet naar
aantal.

**Het verleden -- niet herschreven.** Het bestaande werk wordt niet met
terugwerkende kracht rechtgetrokken omdat dit bestand is gaan bestaan. De
erfenis hoeft niet weg om iets te mogen wijzigen; hij mag alleen niet groeien.

---

## 0c. Welke eis een machine heeft, en welke niet

Dit is de eerlijke kern van dit document. Een eis zonder handhaver is een
voornemen, en die staan hieronder ook als zodanig.

| Eis | Instroomeis voor nieuw werk | Handhaver |
|---|---|---|
| bewijs is herhaalbaar (par. 5) | een register meet niet uit een vuile werkboom | **machine** -- meter `registersUitVuileBoom` + deltapoortregel `bewijs-uit-vuile-boom` |
| geen tweede gezagsschaal (par. 7) | er komt geen zesde vocabulaire bij | **machine** -- `GEZAG.json` `vocabulaires`, alleen krimpend |
| een endpoint draagt een toets (par. 2) | een nieuw endpoint komt in een toets voor | **machine** -- meter `endpointsZonderTest` + deltapoortregel |
| geen runtime-afhankelijkheid erbij (par. 6) | `dependencies` blijft nul | **machine** -- meter `dependencies` + deltapoortregel `nieuw-pakket` |
| elke meter is geijkt | een nieuwe meter slaat uit op bekend-foute invoer | **machine** -- keuringsregel 35 + `metersOngeijkt` |
| geld schrijft via de poort (par. 3) | -- | **geen handhaver.** Kan er pas komen als `TAKEN.md` 7.1 staat: vandaag schrijft `pasToe()` zelf, dus de regel zou op de eerste dag rood zijn op de bron die hij moet beschermen |
| een ontleder van buitenbytes draagt een budget (par. 6) | -- | **geen handhaver.** Vraagt `FUZZ.json`, dat niet bestaat -- `TAKEN.md` 7.2 |
| een scherm draagt de foutmelder (par. 4.1) | -- | **geen handhaver.** Vraagt `TAKEN.md` 7.9 |
| een route draagt een invoercontract (par. 2) | -- | **geen handhaver.** Vraagt `TAKEN.md` 7.6 |
| autorisatie is toewijsbaar (par. 8) | -- | **half.** Keuringsregel 28 ziet 341 routes niet -- `TAKEN.md` 7.14 |

Vijf machines, vijf voornemens, en bij elk voornemen staat wat hem in de weg
staat. Die verhouding hoort te verschuiven; zij is zelf de voortgangsmaat van
dit document. Wat er NIET hoort te gebeuren is dat een voornemen stilzwijgend
als eis wordt gelezen omdat hij in dezelfde tabel staat.

---

## 1. De volgorde, en waarom hij niet anders kan

De vier lagen hieronder zijn geen indeling maar een **afhankelijkheid**. Laag III
werkt aantoonbaar niet zonder laag I, en niet omdat het netter is: een AI die
kiest uit een lijst handelingen waarvan de uitvoeringssemantiek onbekend is,
is geen autonomie maar een gok met een nette schil. `VERTROUWEN.json` staat
vandaag op **0 bewezen, 4180 verzwakt, 0 geschorst** (gemeten 20 augustus 2026),
dus de bewijspoort in `server/kern/stuur/beleid.js` houdt op dit moment niets
tegen.

Twee dingen gaan daarom voor alles uit, en ze zijn allebei klein:

1. **Het bewijspaspoort** (par. 5). Zolang niet vaststaat op welk systeem een
   register is gemeten, is elke andere uitspraak in dit document een bewering
   over iets anders. Dat is de goedkoopste ingreep met het grootste bereik.
2. **De topologievork** (par. 4.3). Of elk domein een eigen schrijver houdt of
   RTG multi-writer wordt, bepaalt het ontwerp van de geldlaag. Dat besluit gaat
   dus vooraf aan het bouwen ervan, niet erachteraan.

---

## I. HARDE WERKELIJKHEID

Geen functie heet af zolang deze laag niet klopt.

### 2. Contract overal

**De eis.** Elke route zegt machineleesbaar wat zij aanneemt, wat zij verandert,
welke fout zij kan geven en welke toestand zij achterlaat.

**Wat er vandaag staat.** `EXECUTION_MAP.json` is al een projectie over 3282
routes met bereikbaarheid, gezagstrede, bewijs en herhaalbaarheid -- inclusief de
regel dat twee bronnen die elkaar tegenspreken `ONBEPAALD` opleveren en nooit
stil een winnaar. `INHOUDSKAART.json` is al een afgeleid ANTWOORDcontract voor
139 routes, afgedwongen door `test/inhoudswacht.test.js`. `kern/platformfout.js`
schrijft het foutcontract compleet uit.

**Wat ontbreekt.** De invoerkant. 924 unieke `req.body`-velden tegenover zes
gedeclareerde vormen; `platformfout.js` wordt door vier bestanden gebruikt.

**De vorm die het moet krijgen, en dit is de kern van deze paragraaf.** Het
contract wordt **AFGELEID waar dat kan en handgeschreven waar dat niet kan**, en
die twee wonen niet in hetzelfde artefact. Een contract met twaalf secties maal
4748 routes is ongeveer 57.000 handgeschreven feiten, en `BEWIJSMACHINE.md` zegt
al wat daarmee gebeurt: een register dat naast de code leeft, wordt binnen een
jaar zelf de volgende botsing. Dus:

| kant | wat erin staat | waar het vandaan komt |
|---|---|---|
| afgeleid | invoervelden, mutaties, foutcodes, bereikbaarheid, gezagstrede | `scripts/ast/parser.js`, `EXECUTION_MAP.json` |
| verklaard | invarianten, doel, SLO, consistentie-eis | met de hand, en ALLEEN voor de geld- en identiteitstrap |

De verklaarde kant blijft klein met opzet. `TAKEN.md` 7.6, 7.7, 7.8.

**De grens.** Een contract dat met de hand kan worden bijgewerkt zonder dat de
code meebeweegt, is de tweeentwintigste capabilitylijst. De afgeleide kant wordt
gehercompileerd en byte voor byte vergeleken, zoals regel 40 dat met
`ARCHITECTUUR.md` doet.

### 3. Geld is vijandig tegen bederf

**De eis.** Geen algemeen samenvoegalgoritme mag financiele waarheid bepalen.
Bij twijfel stopt de geldlaag; hij kiest nooit een kant.

**Wat er vandaag staat.** `server/pg/collectietransactie.js` biedt een
ondeelbare read-modify-write met advisory lock en `SELECT FOR UPDATE` in een
transactie, voor allebei de productieopslagvormen. `kern/bank/grootboek.js`
heeft een serialisatieslot. `server/db/tx/collecties.js` draagt het
transactiegrootboek.

**Wat ontbreekt.** De aanroepers. De modules die werk in `bewerkCollectie` doen
zijn Magnaat-modules; `kern/pay` gebruikt hem niet. Daardoor geldt vandaag:

```
merge3({A:10000,B:0}, {A:7000,B:3000}, {A:6000,B:4000})  ->  {A:7000,B:3000}
```

Twee instances boeken vanaf dezelfde basis; de boeking van 40 euro verdwijnt,
terwijl haar grootboekregel blijft staan en haar idempotentiesleutel overleeft.
De retry wordt dus geweigerd voor een boeking die niet bestaat.
`server/db/merge.js` regel 29 kiest bij twee gewijzigde scalars "de onze", en
`paySaldi` is zo'n platte map. Dezelfde samenvoeging staat aan de LEESkant
(`server/pg/inlezen.js`), die op NOTIFY en elke twee seconden draait, buiten elk
slot om.

**De volgorde, en die is hier belangrijker dan het eindbeeld.** Het eindbeeld is
een append-only grootboek met geprojecteerde saldi. De eerste zet is dat niet:
de eerste zet is `pasToe()` op `bewerkCollectie` en `merge3` laten WEIGEREN op
een collectie die `voorcheck.exactNodig()` als geld herkent. Dat is dagen werk
op iets dat er al ligt. Wie de kernel eerst bouwt, laat het gat maanden staan.
`TAKEN.md` 7.1.

**De grens.** Uitbetaalbaar hangt aan een bevoegdheid en nooit aan een boolean
(`WAARDE.md`), en geld verlaat het huis nooit vanzelf (`GELD.md`). Deze
paragraaf verandert daar niets aan.

### 4. Waarneembaarheid, gelijktijdigheid, topologie

#### 4.1 Runtime-waarheid

**De eis.** Elke belangrijke stroom laat een spoor, een meting en een
auditregel achter, en de afwijking tussen wat het contract belooft en wat er
gebeurde is zelf meetbaar.

**Wat er vandaag staat.** Een metrics-endpoint in Prometheus-vorm achter een
token. `kern/envelop.js` geeft elk busbericht een correlatie en een oorzaak.
De AsyncLocalStorage-machinerie staat zevenvoudig in huis;
`kern/kosten/haak.js` is het beste model.

**Wat ontbreekt.** `hrtime` staat in 2 van 2905 servermodules. `telFout()` heeft
geen enkele aanroeper in productiecode, dus `rtg_fouten_totaal` telt voor altijd
nul. De browser-foutmelder draait op 1 van 277 schermen. `server/lib/http.js`
herhaalt tot drie keer bij 429 en 5xx zonder enig spoor. Het alarm eindigt in
het journaal; `ERR_WEBHOOK_URL` bestaat en is leeg. `TAKEN.md` 7.9 t/m 7.12.

**De grens.** Een lege alarmuitgang leest als "geen uitgang" en nooit als
bezorging. En de laag die iets toont, meet het niet (`BESTUUR.md`).

#### 4.2 Gelijktijdigheid

**De eis.** Waar twee schrijvers elkaar kunnen raken, is het gedrag beproefd en
niet beredeneerd.

**Wat ontbreekt.** De twee meerprocestoetsen vuren hun betaalrace naar dezelfde
instance, dus de kruisproces-race is nooit rood geweest. `TAKEN.md` 7.1.

#### 4.3 De topologievork -- een besluit, geen taak

**Wat er vandaag draait.** `npm start` start `server/trio.js`: drie servers, een
actief, twee standby. Dat is failover en geen schaal. `server/vloot.js` (een
proces per domeingroep) bestaat, maar deelt data alleen veilig via PostgreSQL en
de Redis-bus -- en `RTG_SPREIDING` staat standaard uit. `docker-compose.live.yml`
gaat uit van een enkele productieserver. Gemeten plafond
(`BEPROEVING.json`, 18 augustus 2026, sqlite, vier kernen): p99 233 ms, 336
verzoeken per seconde, event-loop p99 97,9 ms bij 109% CPU van 400%.

**De vork.** Twee wegen, en ze vragen een ander geldontwerp:

- **Een schrijver per domein.** Elk domein bezit zijn eigen data (de vloot).
  Dan is `merge3` op geld nooit nodig en blijft par. 3 klein.
- **Meerdere schrijvers op dezelfde data.** Dan koopt RTG gedistribueerde
  correctheid, met alles wat daarbij hoort.

Dit besluit gaat vooraf aan het bouwen van par. 3. `TAKEN.md` 7.5.

### 5. Bewijspariteit

**De eis.** Geen bewijs zonder omgevingsidentiteit. Een uitslag zegt op welk
systeem hij is gemeten, en hoe ver dat systeem van productie af staat.

**Wat er vandaag staat, en het is verder dan het lijkt.** `BEPROEVING.json`
draagt zijn vingerafdruk al compleet: kernen, geheugen, platform, node-versie,
opslagmodus, commit, en een gemeten `kalibratieBasisMs` omdat twee containers
met dezelfde vorm op ander silicium kunnen draaien. `scripts/norm.js` weigert
latenties te vergelijken tussen machines waarvan die kalibratie uiteenloopt --
liever geen oordeel dan een oordeel dat nergens over gaat. Dat is precies de
goede vorm.

**Wat ontbreekt.** Diezelfde vorm bij de andere registers, en een poort die
eraan hangt. `VERTROUWEN.json` is gemeten met `boomVuil: true`: het bewijs komt
van een werkboom die niet gelijk was aan een commit, en is toch als bewijs
opgeslagen. De versheidscontrole draait wekelijks met `|| true`. En de
routeregisters zijn gemeten op sqlite terwijl productie op Postgres hoort te
draaien -- een andere transactiesemantiek, dus een andere werkelijkheid.

**Wat er sinds 2 september 2026 wel wordt afgedwongen, en het is met opzet de
SMALLE helft.** De meter `registersUitVuileBoom` telt de registers waarvan de
meting uit een vuile werkboom komt (bij het aanzetten: 18 van de 25), hij ratelt
alleen omlaag, en de deltapoortregel `bewijs-uit-vuile-boom` weigert een nieuw
register dat zo gemeten is en een bestaand register dat van schoon naar vuil
gaat. De telling woont in `scripts/lib/paspoort.js`, zodat de poort met dezelfde
functie telt als de meter die hij dient.

Smal, omdat de andere helft -- "op wat voor MACHINE is dit gemeten" -- niet voor
elk register geldt: een latentie hangt van de machine af, een telling van routes
uit de bron niet. Een regel die van alle 25 een vingerafdruk zou eisen, heeft
vanaf dag een valse gevallen, en keuringsregel 50 legt uit wat dat kost.

**Wat er nog niet is.** De motorpariteit: een claim die op sqlite is gemeten
terwijl productie Postgres draait, komt vandaag nog gewoon als bewijs door.
`TAKEN.md` 7.3, 7.4.

**De grens.** `vervallen bewijs is geen bewijs` (`BESTUUR.md`), en
`niet gemeten` is nooit hetzelfde als `geen effect` (`kern/stuur/gevolg.js`).

### 6. Vijandige randen

**De eis.** Elk pad dat bytes van buiten ontleedt, draagt een budget: op
lengte, op diepte, op geheugen en op tijd.

**Waarom dit hier staat.** De nul-afhankelijkhedenkeuze is een besliste positie
met een normtand (`NORM.meters.dependencies` = 0) en een gemeten voordeel: de
eigen routerlaag haalt in `test/routerindex.test.js` factor 111 waar de toets er
15 eist. De keuze wordt hier niet teruggedraaid. Maar zij verplaatst het risico:
RTG is zijn eigen leverancier, en dan hoort de rekening van een leverancier
betaald te worden.

**Wat er vandaag staat.** `test/rtgjson.test.js` fuzzt de JSON-parser
differentieel met 5000 documenten tegen de ingebouwde motor.
`test/samlc14n.test.js` legt de eigen canonicalisatie naast `xmllint` en weigert
zichzelf over te slaan als die ontbreekt. `kern/mailmime.js` is begrensd op
diepte en omvang.

**Wat er sinds 2 september 2026 dicht is.** De twee bewezen gaten:

- `server/webauthn/cbor.js` nam een 64-bits lengte onbeperkt over. Negen bytes
  blokkeerden de event-loop 9,3 seconden, bereikbaar voor elk ingelogd lid via
  `/api/webauthn/registreer`. Nu drie budgetten: een lengte kan nooit groter
  zijn dan wat er nog in de buffer ligt, de positie moet binnen de buffer
  vallen, en de diepte stopt op 32. De grens is niet een verzonnen maximum maar
  de buffer zelf -- een element kost minstens een byte -- dus hij weigert precies
  het onmogelijke en geen enkel geldig document.
- `server/pgwire/protocol.js` liep in `foutVelden` oneindig door als de
  NUL-afsluiter ontbrak. Nu breekt hij af.

`test/vijandigerand.test.js` houdt het vast, en draait zijn proeven in een
**kindproces**: bij de eerste versie liep de suite niet rood maar VAST, precies
zoals eerlijkheidspunt 6.7 beschrijft. Een vastloper hoort een uitslag te zijn.
Zes toetsen zijn rood gezien vóór de reparatie en groen erna; twee tegenproeven
bewijzen dat geldige CBOR en een goed gevormd foutbericht er nog doorheen komen.

**Wat ontbreekt.** De motor. Er is nog geen fuzzer die zelf tegenvoorbeelden
zoekt, en `sso/saml/xml.js` en `kern/mailmime.js` zijn nog niet met misvormde
bytes beproefd. `TAKEN.md` 7.2.

**De grens.** Er komt geen derde runtime bij om dit op te lossen. Het budget is
de reparatie en de fuzzer is de handhaver; WASM of een verhuizing naar de
Rust-motor is hooguit een latere optimalisatie en nooit de eerste zet.

---

## II. WERKTUIGLIJKE INTELLIGENTIE

Pas als laag I klopt.

### 7. Een gezagsschaal, niet zes

**De eis.** De vraag "mag de machine dit zelf" wordt op een plek beantwoord.

**De stand.** `GEZAG.json` staat op **5 vocabulaires en 22 losse niveaunamen**,
met in het register zelf de reden dat dit erg is: er is geen gedeelde noemer,
dus geen mens en geen machine kan ze naast elkaar leggen. De meter mag alleen
krimpen. `scripts/gezagsnoemer.js` legt er een vier-tredige noemer overheen
(18 evident, 3 besloten, 0 open) en beslist met opzet niets; hij woont daarom in
`scripts/` en `test/gezagsnoemer.test.js` zakt zodra iets uit `server/` hem
importeert.

**De grens, en dit is de belangrijkste zin van deze paragraaf.** Een
capability-algebra die NAAST de vijf komt te staan, is de zesde schaal. Hij moet
ze vervangen. De eerste opdracht is dus semantische consolidatie en geen
featurewerk -- zo staat het al in `EXECUTIE.md`. `TAKEN.md` 7.13.

**Wat er al goed staat.** `kern/stuur/mandaat.js` is de goede vorm in het klein:
een mandaat verleent nooit vermogen maar VERSMALT bestaand vermogen, de
speelruimte is een doorsnede, en leeg is dicht.

### 8. Autorisatie is een besluit, geen `if`

**De eis.** Er is een plek waar wordt beslist of iets mag, en het oordeel draagt
een reden.

**Wat ontbreekt.** Zestig bewakersvormen over 4441 handlers. Keuringsregel 28
leest `app.<verb>()` en niet `router.<verb>()`, waardoor 341 routes van de
RTFoundation- en School-tak buiten de per-commit poortcontrole vallen; de
runtime-poortwacht dekt er 324 wel, dus het gat zit in de controle en niet in de
deur. Van de 716 routes die het huis zelf `OBJECT_SCOPED` noemt, dragen er 638
geen toewijsbare uitslag over horizontale scheiding. `TAKEN.md` 7.14.

**De vorm.** Niet herschrijven. Elke bewakersvorm roept een gedeelde
`beslis(req, eis)` aan die de uitkomst met reden teruggeeft; de bewakers blijven
staan, alleen hun oordeel loopt door een functie. De projectie die daaruit volgt
loopt eerst in de schaduw (`kern/stuur/schaduw.js` is het model) voordat hij
afdwingt. Het doel is **100% toewijsbaar**, niet 100% gescheiden.

---

## III. UITVOEREND

Pas als I en II kloppen. Deze laag is bewust nog niet uitgewerkt: hij is
ontwerpruimte, geen werkvoorraad.

### 9. Twee grenzen die eerst een besluit vragen

Twee dingen die in deze richting voor de hand liggen, botsen met grenzen die
vandaag in code staan. Dat maakt ze niet verboden -- het maakt ze een besluit van
de eigenaar in plaats van een toevoeging van een bouwer. `TAKEN.md` 7.16.

**Geld en autonomie.** `kern/stuur/mandaat.js` schrijft uit dat een mandaat een
bestelling mag laten voorbereiden en zelfs een verplichting mag laten aangaan
binnen een grens -- betalen niet. `GELD.md` staat daarboven: geld verlaat het
huis nooit vanzelf. Een agent die zelfstandig 75 euro afrekent, kruist die
grens. Wie hem wil, verandert `GELD.md` bewust en met een reden; hij sluipt er
niet in via een architectuurbeslissing.

**Generatieve schermen en de zichtbaarheidsgrens.** `ADAPTIEF.md` stelt hard dat
verbergen niet bestaat: een handeling die op bureau bestaat en op telefoon geen
vorm heeft, is een gebrek en laat de toets zakken. Een AI die componeert, kiest
per definitie wat er niet verschijnt. Dat conflict hoort opgelost voordat er
iets gebouwd wordt, niet erna.

### 10. Een voorspelling toont pas een getal als haar trefzekerheid gemeten is

Dezelfde regel die `kern/kosten/vooruitblik.js` al hanteert: de bandbreedte
verschijnt pas als de trefzekerheid over drie afgesloten perioden is GEMETEN.
Een simulatie die "omzetimpact -740 euro" toont zonder scoringshistorie, is een
getal zonder bron -- en dat is precies waar dit huis elders wel op let.
`TAKEN.md` 7.17.

Wat er wel al staat en geen nabouw verdient: `kern/stuur/gevolg.js` (drie graden,
waarvan `geen-effect-gemeten` en `onbekend` met opzet uit elkaar), de zandbak die
uit de zaaiset draait en niet uit productie, en `command/transactie-poorten.js`
met voor- en nacontrole.

---

## IV. ZICHZELF VERDEDIGEND

### 11. Elke garantie draagt een aanval

**De eis.** Een bewering die het huis afdwingt, is een keer zien afgaan.

**Wat er staat, en het is het beste van dit huis.** `scripts/sabotage.js`
overtreedt elke wet een keer met opzet: 46 wetten, 42 raak, 3 expliciet
mensenwerk, 1 blind. `test/meterijk.test.js` voert elke geijkte meter een
bekend-foute invoer.

**Wat ontbreekt.** 51 van de 64 keuringsregels hebben geen sabotagerecept. De
motor die dit huis het duurst heeft gebouwd, dekt een vijfde van zijn eigen
keuring. `TAKEN.md` 7.19.

### 12. Een release bewijst zichzelf

**De eis.** Wat er draait is wat er getekend is.

**Wat er staat.** De herkomstketen ligt er in volle breedte: SBOM,
digestbinding, releasebewijs, `release:gate`.

**Wat ontbreekt.** Hij heeft nog nooit gedraaid, er is geen ondertekeningssleutel,
en beide deploypaden bouwen op de host opnieuw in plaats van een getekend digest
te pullen. Een poort die je nooit hebt zien draaien is geen poort.
`TAKEN.md` 7.20.

### 13. De keuring is bruikbaar tijdens het werk

Regel 1 van `npm run check` kost ongeveer 130 seconden procesopstart waar 0,8
volstaat, en de keuring is alles-of-niets. Zolang een ronde minuten kost,
spreekt de kwaliteitsmachine pas na een push. `TAKEN.md` 7.18.

---

## 14. Wat deze standaard niet zegt

- **Niets over de ploeg.** De grootste bedreiging voor dit document is niet
  technisch: 562 commits in negentien dagen, geen reviewspoor, en `CODEOWNERS`
  laat een goedkeurder toe. Twintig regels structureel werk veronderstelt een
  organisatie die er niet is. Wie hieraan begint, sequencet voor de ploeg die
  bestaat -- of laat de ploeg groeien. Dat is een besluit van de eigenaar en het
  staat hier alleen zodat niemand doet alsof het geen risico is.
- **Niets over de voordeur.** De leveringslaag van 277 schermen (523 kB brotli
  in 57 verzoeken op de voordeur, nooit een meting van hoe snel een scherm
  verschijnt, en acht browserjobs die `npm run build` nooit draaien) valt buiten
  deze paragrafen en hoort een eigen ronde te krijgen.
- **Niets met terugwerkende kracht.** Zie par. 0.
- **Geen getal dat vanzelf meeloopt.** De cijfers in dit bestand zijn gedateerd
  en dragen hun register, maar ze staan nog niet tussen de merktekens van
  `npm run getallen`. Ze verouderen dus stil, en dat is een bekend gebrek van dit
  document en geen eigenschap van de standaard.

## 15. Waar de rest staat

| Vraag | Waar |
|---|---|
| Hoe hoort code geschreven te worden? | `LAT.md` |
| Welke merkregels gelden? | `CLAUDE.md` |
| Wat moet er nog, en hoe zie je dat het af is? | `TAKEN.md` par. 7 |
| Wat is gemeten, en welke kant mag het op? | `NORM.json` + `npm run norm` |
| Wat doet de code technisch? | `README.md`, `ARCHITECTUUR.md` |
| Welke toets bewijst wat? | `BEWIJS.md` |
