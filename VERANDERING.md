# RTG Verandering — de bewijsmachine rond één wijziging

`KEURING.md` gaat over de keten die alles draait, `NORM.md` over de meters,
`LAT.md` over de code. Dit document gaat over de vraag daarboven: **als er iets
verandert, welk bewijs moet dan opnieuw, en hoe hard weet dit huis dat?**

Het is een richtingsdocument zoals `PLATFORM.md`, `ECONOMIE.md` en `MACHINE.md`:
per onderdeel staat er of het **staat**, **een stap weg** is, **een besluit
vraagt** of **jaren weg** is — zodat niemand die vier voor elkaar aanziet.

De hoofdregel staat vooraan, want alles hieronder is er een toepassing van, en
hij is niet nieuw maar geërfd uit `KEURING.md`:

> **Zekerheid mag snelheid toestaan; onzekerheid mag nooit snelheid afdwingen.**
>
> Volledige dekking is de uitgangstoestand. Versmalling is geen optimalisatie die
> achteraf bewezen wordt — het is een recht dat per effect verdiend moet worden.

Daaruit volgt de toetsvraag van dit hele document. Niet *"hoe draaien we minder
toetsen?"* maar **"van welke toets staat vast wat hij dekt, en van welke niet?"**
Dat tweede getal is het product. Zolang het niet nul is, is er geen impactplan —
er is een meting met een volle ring eromheen.

---

## 1. De meting die vooraf gaat

De aantrekkelijke gedachte heet Affected Proof Selection: classificeer een commit
en draai alleen het bewijs dat hij raakt. Dit huis heeft die gedachte al een keer
tegengehouden, en met een getal in plaats van een gevoel.

`scripts/impactbereik.js` keert de require-graaf om en vraagt: als dit bestand
verandert, welke toetsen hangen eraan? Vers gemeten over
<!--getal:veranderbereik.toetsen-->1926<!--/getal--> toetsbestanden:

| gewijzigd bestand | transitief geraakte toetsen |
|---|---|
| `kern/stuur/resolver.js` | 11 (0,6%) |
| `kern/pay/poort.js` | 6 (0,3%) |
| `kern/passen.js` | 7 (0,4%) |
| `kern/fiscaal/tarief.js` | 43 (2,3%) |

Zes toetsen voor de plek waar élke betaling langskomt is geen versmalling maar
een blinde vlek, en die is
<!--getal:veranderbereik.blind-->771<!--/getal--> toetsbestanden groot: ruim de
helft heeft **geen enkele require-kant naar `server/`**. Ze starten de server als
apart proces en raken de oppervlakte over HTTP (1058 starten een proces, 995
praten HTTP). Een planner op deze graaf slaat ze over en meldt groen — "de
stilste vorm van kapot die dit huis kent" (`scripts/lib/bedrading.js`).

### 1.1 Drie dingen die deze ronde aan het licht bracht

**De blinde vlek stond nergens vast.** `impactbereik.js` draait in **geen enkele
workflow** en schrijft **geen register** (nul `writeFileSync`). Het getal dat
versmalling tegenhoudt bestond dus alleen als proza in `KEURING.md` par. 1 — en
dat proza stond op 819 van 1434 (57,1%) terwijl de verse meting
<!--getal:veranderbereik.blind-->771<!--/getal--> van
<!--getal:veranderbereik.toetsen-->1926<!--/getal--> zegt. Niet fout opgeschreven;
gewoon ouder dan de code. *Een register dat niet is hergedraaid is een bewering
over het verleden* (`MENSNETWERK.md` par. 4) — en een getal zónder register is
dat ook, alleen merkt niemand het.

**De bewijsladder zet deze sport op `staat`.** `BEWIJSLADDER.json` kent een sport
`geraakt` — *"Wat kan deze wijziging raken: de affected-graaf, welk bewijs moet
opnieuw"* — en die staat op **`staat`**, met als grond dat er twee mechanismen aan
beide kanten draaien en een gestempeld register achterlaten. Nagekeken zijn dat
`scripts/activering.js` en `scripts/verstrengeling.js` (die over iets anders gaan)
plus `scripts/attributie.js`, en die laatste draagt `stempel: null` en schrijft een
register dat **niet in de repo staat**: CI maakt het en bewaart het vijf dagen als
artefact. De meter die de vraag wél stelt, `impactbereik.js`, staat niet in de
lijst omdat hij nergens draait. De sport was dus groen op een naam en niet op een
uitslag — precies `BEWIJSMACHINE.md` par. 6a: *een proef kan een geldige uitslag
geven en toch het verkeerde experiment zijn uitgevoerd.*

Sinds deze tak staat er wél een mechanisme onder die sport met een gestempeld
register in de repo (`veranderbereik.js` → `VERANDERBEREIK.json`). Dat repareert
de grond half en niet heel: `attributie.js` draagt nog steeds `stempel: null`, en
`impactbereik.js` draait nog steeds nergens. Zie besluit 2.

**En de ontbrekende schakel lag klaar.** `scripts/attributie.js` zegt in zijn
eigen `nietGemeten` dat hij alleen ROUTES kent en geen BRONBESTANDEN, en noemt dat
een tekort. `ROUTEBRON.json` draagt route → bronbestand voor 4942 routes. Niemand
had die twee aan elkaar geknoopt. Dat is het werk van deze tak, en het is
**aansluiten en niet uitvinden**.

---

## 2. Twee assen, en ze worden nooit opgeteld

`scripts/veranderbereik.js` (`VERANDERBEREIK.json`, `npm run veranderbereik`)
beantwoordt per toetsbestand: staat het BRONBESTANDbereik vast, en langs welke as?

| as | wat hij ziet | wat hij mist |
|---|---|---|
| **statisch** | de omgekeerde require-graaf | een `spawn` — dus de helft van de suite |
| **waargenomen** | het routejournaal van een échte ronde, via `ROUTEBRON.json` naar het bestand | alles wat die ronde niet draaide |

Ze missen verschillende dingen, dus ze worden **niet opgeteld tot één cijfer** —
dezelfde reden waarom `scripts/tredeproef.js` zuiver en beproefd apart meldt en
`scripts/machinedekking.js` zijn twee assen apart houdt. Een samengesteld getal
verbergt welke van de twee bewoog.

Stand op deze tak:

| | |
|---|---|
| toetsbestanden | <!--getal:veranderbereik.toetsen-->1926<!--/getal--> |
| statische as | <!--getal:veranderbereik.statisch-->1155<!--/getal--> |
| waargenomen as | <!--getal:veranderbereik.waargenomen-->337<!--/getal--> |
| blinde vlek statisch alleen | <!--getal:veranderbereik.blind-->771<!--/getal--> |
| **gedicht door waarneming** | <!--getal:veranderbereik.gedicht-->236<!--/getal--> |
| **zonder enig bereik (volle ring)** | <!--getal:veranderbereik.zonder-->530<!--/getal--> |
| toetsen die in deze ronde draaiden | <!--getal:veranderbereik.ronde-->769<!--/getal--> |
| waargenomen routes zonder bronbestand | <!--getal:veranderbereik.routesZonderBestand-->80<!--/getal--> |

### 2.2 Wat de VOLLE ronde zegt, en waarom dat hier apart staat

De tabel hierboven komt uit het ingecheckte register, en dat register draagt
`rondeVolledig: false`: de lokale ronde haalde 769 van de 1900 toetsbestanden.
Op 15 september 2026 heeft de keten hem voor het eerst op een VOLLEDIGE ronde
gedraaid (run `34974276733`, job *Waargenomen endpoint-dekking*), en die uitslag
staat hier als PROZA en niet tussen merktekens — een getal uit een artefact van
vijf dagen is geen repo-waarheid, en de merktekens horen bij het register dat er
werkelijk ligt.

| | lokaal (769 van 1900) | keten (volledig) |
|---|---|---|
| waargenomen as | 337 | **970** |
| gedicht door waarneming | 239 | **734** |
| zonder bereik | 828 (43,6%) | **333 (17,5%)** |
| draaide, raakte geen route | 150 | **333** |
| draaide niet in deze ronde | 678 | **0** |
| routes waargenomen | 3388 | **5070** |

Twee dingen die dat verandert. **De schuld is kleiner en scherper dan de halve
ronde suggereerde**: van de 1067 toetsen die de statische graaf niet ziet, haalt
de waarneming er 734 binnen. En **wat overblijft is volledig gekarakteriseerd**:
alle 333 zijn `draaideZonderRoute` — in-proces toetsen, een EIGENSCHAP — en
`nietInDezeRonde` staat op nul. Er is dus geen enkele toets meer waarover deze
meter moet zeggen "niemand heeft gekeken". Dat is precies het verschil dat par.
2.1 beschrijft, nu met een getal eronder.

**En de volle ronde legde een defect in deze meter zelf bloot.** Hij meldde
"ronde: 1901 van 1900 toetsbestanden gedraaid" — de duurregisters dragen een naam
die niet op schijf staat, want `test/meterijk.test.js` zet tijdens zijn ijking een
toetsbestand neer en haalt het weer weg. De volledigheidstoets vroeg
`ronde.size >= toetsen.length`, dus een ronde kon een ECHT bestand missen en toch
volledig heten zolang er maar een vreemde naam tegenover stond. Nu telt
lidmaatschap. Een gelijkheidstoets op aantallen heeft een blinde vlek die eruitziet
als succes, en dat is dezelfde vorm die `MENSNETWERK.md` par. 4c al beschreef bij
de AI-contextproef.

### 2.1 Drie dingen die niet mogen sneuvelen

**Een afwezige toets is geen nul.** `ongemeten` betekent dat er niets over bewezen
is, nooit dat de toets niets aanraakt. Dat is de regel van `attributie.js`, hier
onverkort: wie die twee verwart, bouwt een planner die een toets overslaat omdat
de MÉTING ontbrak.

**En daarom valt `zonder bereik` in twee standen uiteen.** Een toets die draaide
en geen route raakte is een **eigenschap** (een in-proces toets — daarover is iets
bewezen). Een toets die niet meedraaide is een **meetgat**. `CLAUDE.md` zegt over
`kern/stuur/gevolg.js` dat `geen-effect-gemeten` en `onbekend` nooit door elkaar
mogen lopen; hier geldt dat woordelijk. Beide houden wel hun volle ring — het
onderscheid maakt de meting eerlijker, niet de versmalling ruimer.

**De montagewortel telt apart, en wordt nooit afgetrokken.** Dit is de derde
vondst van deze ronde en hij bepaalt wat de omgekeerde vraag mag beweren.
`server/server.js` en `server/opzet/` MONTEREN de code en gebruiken hem niet, dus
ze staan in de omgekeerde sluiting van vrijwel élk bronbestand — en `server.js`
handelt zelf 18 routes af, met `/api/health` voorop, die bijna elke toets
aanraakt. Gemeten: `--raakt server/kern/pay/poort.js` gaf **6** toetsen langs de
statische as en **336** langs de waargenomen as, en die 336 kwamen **alle
driehonderdzesendertig alleen via die ene band** binnen. Zonder die telling leest
342 als precisie terwijl er zes echte toetsen onder liggen.

Dat is dezelfde vorm die `scripts/machinedekking.js` met zijn hubgrens
tegenhoudt ("een hub in de kern-tas zette 4162 routes op idempotent"). Er wordt
hier niets afgetrokken — te ruim is de veilige kant voor een bewijskeuze — maar
de band wordt apart gemeld. **Wie hem wegstreept, maakt van een veilige
overschatting een stille onderschatting.**

**De meter faalt naar "alles draaien".** Een half journaal duwt toetsen naar de
volle ring en nooit eruit. Ontbreekt `ROUTEBRON.json`, dan weigert hij met de
reden in plaats van een blinde vlek te melden die hij zelf heeft gemaakt. Dat is
de enige kant waarop hij fout mag gaan.

---

## 3. De 28 punten, met de stand erbij

Het meeste bestaat al, en bijna nooit onder de voorgestelde naam.

| # | voorstel | stand | waar het al woont, of wat het blokkeert |
|---|---|---|---|
| 1 | Proof Efficiency als doelfunctie | **besluit** | zie correctie A — een ratio optimaliseert ook de noemer |
| 2 | Change Intelligence vooraf | **stap** | de bouwstenen staan; par. 2 is de eerste helft |
| 3 | één Change Graph | **stap** | `AANROEPGRAAF.json` (23716 kanten), `SYMBOLEN.json` (19652), `ROUTEBRON.json`, `SCHERMROUTES.json`, `CODEWERELD.json` — de graaf bestaat, de ontbrekende kant was toets → bestand |
| 4 | registers als projectie | **staat** | `scripts/lib/stempel.js`, `npm run registerklopt`; het openstaande stuk staat al benoemd in `METERKLASSE.json` (67 generatoren zonder verklaard grendelcontract) |
| 5 | Incremental Proof Engine | **besluit** | geblokkeerd op <!--getal:veranderbereik.zonder-->530<!--/getal--> volle ringen — zie par. 5 |
| 6 | P0–P4 escalatieladder | **stap** | `BEWIJSLADDER.json` heeft 12 sporten (6 staat, 6 stap, 0 jaren) — maar naar SOORT bewijs, niet naar TIJDBUDGET; zie correctie C |
| 7 | risico bepaalt bewijs | **stap** | `kern/frictie/motor.js` (score mét opbouw), `scripts/lib/risico.js` |
| 8 | bewijs met houdbaarheid | **staat** | `versheid()` en `sluiting()` in `scripts/lib/stempel.js` — per instrument, nog niet per toets |
| 9 | Proof Cache | **besluit** | zie correctie D — er is vandaag 0 bewezen |
| 10 | parallellisme op bewijsniveau | **staat** | `scripts/lib/delen.js`, gewogen op gemeten duur (`TOETSDUUR.json`) |
| 11 | Speculative Proof | **jaren** | niets van aanwezig, en het leunt op 5 |
| 12 | Test Impact Learning | **jaren** | vraagt uitvoerhistorie per toets; `TOETSDUUR.json` kent duur, niet waarde |
| 13 | mutation testing | **staat** | `scripts/mutatie.js`, `npm run meterijk`, `scripts/sabotage.js` (overtreedt elke wet één keer met opzet) |
| 14 | property-based testing | **stap** | **echt afwezig** — nul `fast-check`, nul property-runner in 1899 toetsbestanden |
| 15 | stateful model checking | **staat** | de ketenproeven: `tafelproef`, `ritproef`, `toelatingsproef`, `momentproef`, plus `herstelproef` (heen, kijken, terug, kijken) |
| 16 | deterministische simulatie | **stap** | `scripts/chaos.js`, `server/betaal/synthetisch.js` (afloop reproduceerbaar uit de idempotentiesleutel) |
| 17 | record → replay | **jaren** | vraagt productie, en botst met de bewaartermijnen |
| 18 | shadow execution | **staat** | `kern/pay/schaduw.js`, `kern/stuur/frictieschaduw.js`, `kern/commercie/schaduw.js`, `scripts/motor-schaduw.js` |
| 19 | canary + terugrol | **staat** | met de waarschuwing uit `KANTOORMACHT.md`: een percentage is bij drie medewerkers niet streng maar zinloos |
| 20 | één trace-identiteit | **besluit** | `kern/envelop.js` draagt `correlatie` en `oorzaak` — maar is **gesloten op acht velden**; een `changeId` erbij is een versiesprong, geen toevoeging |
| 21 | cryptografisch bewijsboek / SLSA | **besluit** | `lib/keten.js` + `lib/keten-anker.js` staan; wat ontbreekt is een BESLUIT (een anker in dezelfde database is geen anker), en release-provenance ontbreekt echt |
| 22 | hermetic proof workers | **stap** | `scripts/lib/stempel.js` levert de reproduceerbaarheidsvraag al; de isolatie niet |
| 23 | AI als onderzoeker | **staat** | dit is al doctrine: `CODE-AI-001` in `test/codegrens.test.js` — de runtime-AI komt nooit aan de bron, de meters bedienen niets |
| 24 | adversarial builder/breaker | **stap** | de deterministische helft staat (`sabotage.js`, `aanval.js`); de AI-helft niet |
| 25 | Proof Budget | **besluit** | vraagt eerst 5; zonder bereik is een budget een bezuiniging op het onbekende |
| 26 | Change Friction Heatmap | **stap** | `VERSTRENGELING.json`, `GRENZEN.json`, `CODEWERELD.json` dragen de invoer |
| 27 | parallelle agents, één beslisser | **staat** | als doctrine: *AI mag betekenis voorstellen, alleen deterministische systemen mogen waarheid vaststellen* (`CODE.md`) |
| 28 | selectieve formele verificatie | **jaren** | de kandidaten bestaan wel: `kern/commercie/contract.js` (8 standen, expliciete overgangstabel), `kern/mobiliteit/keten.js` (10), `kern/service/loop.js` |

---

## 4. Vier correcties

**A. "Proof Efficiency = dekking / kosten" botst met de hoofdregel.** Een breuk
optimaliseert ook zijn noemer, en de goedkoopste manier om hem te laten stijgen is
minder meten. Dat is precies wat `KEURING.md` verbiedt. Wat wél kan is een
**normtand**: `zonderBereik` mag alleen dalen — een absoluut getal, geen
percentage, want een percentage daalt ook als er toetsen bijkomen die niets
bewijzen. Die tand staat (`npm run veranderbereik:controle`).

**B. Eén samengesteld cijfer is verboden, en niet uit voorzichtigheid.** Een
`Proof Efficiency`-getal of een enkel `READY` boven een scorecard is letterlijk
wat `LAT.md` regel 11 en `scripts/check.js` regel 48 tegenhouden (*bewijsgroen is
geen go-live-groen*) en wat `INT-04` verbiedt: een besluit draagt zijn opbouw,
nooit een samengesteld cijfer. Daarom zijn de twee assen in par. 2 apart en blijft
`zonderBereik` het kopgetal.

**C. De escalatieladder bestaat, maar op een andere as.** `BEWIJSLADDER.json` deelt
bewijs in naar SOORT (eenheid, contract, keten, herstel, release, canary). Het
voorstel deelt in naar TIJDBUDGET (P0 <1s tot P4 release). Dat zijn twee assen en
niet twee versies van dezelfde; een tijdbudget eroverheen leggen zonder de
soortenas te noemen, maakt van twaalf sporten vijf emmers en verliest wat elke
sport bewijst. Wie P0–P4 wil, hangt ze **naast** de sporten en niet eroverheen.

**D. Een Proof Cache boven nul bewijs is een cache van niets.** `VERTROUWEN.json`
staat op **0 bewezen** en 4716 verzwakt. Bewijs hergebruiken op grond van een
dependency-hash veronderstelt dat er bewijs is dat een identiteit verdient. De
volgorde is dus: eerst bereik (par. 2), dan bewijs, dan hergebruik. Andersom cachet
hij een uitslag en noemt dat een bewijs.

**En twee namen zijn bezet.** `graaf` draagt in dit huis al `levensgraaf`,
`socialegraaf`, `geldgraaf`, `AANROEPGRAAF.json` en `GRAAFAS.json` (151 bestanden
in `server/kern/` noemen het woord) — een "Change Graph" als nieuw kernbegrip is de
`VERMOGENS`-botsing op de centrale naam van een laag. `veranderbereik` is gemeten
vrij en is daarom de naam geworden. En `envelop` is gesloten op acht velden: wie
er een `changeId` bij wil, doet een versiesprong op een gesloten vorm en voegt niet
even iets toe.

---

## 5. De grenzen

1. **Dit is geen selector.** `veranderbereik.js` slaat niets over en mag niet aan
   een draaier hangen zolang `zonderBereik` niet nul is. De meter zegt dat zelf in
   zijn uitvoer, zodat niemand hem per ongeluk promoveert.
2. **Een meetgat is nooit een uitspraak over de toets.** `nietInDezeRonde` en
   `draaideZonderRoute` blijven twee standen.
3. **Geen versmalling zonder dat de meting eerst in de schaduw liep.** Dat is de
   regel van `CONTROLPLANE.md` (`schaduw.js`) en hij geldt hier ook: je kunt niet
   afdwingen wat nooit zonder te blokkeren heeft gedraaid. Daarom blokkeert de
   CI-stap niets.
4. **De AI stelt voor, de machine stelt vast.** `CODE-AI-001` staat en heeft een
   toets; deze laag verandert daar niets aan. Een modelbevinding wordt nooit een
   register.
5. **Geen cijfer op een mens.** Een bewijsmachine die per ontwikkelaar zou meten
   wie de duurste wijzigingen maakt, valt onder dezelfde grens als `CAR-05`,
   `INT-04` en `KANTOORMACHT.md`: de meeteenheid is de wijziging, nooit de mens —
   ook niet intern als sorteersleutel.

---

## 6. Wat er op deze tak gebouwd is

- `scripts/veranderbereik.js` + `VERANDERBEREIK.json` — de twee assen, de
  ronde-splitsing, `--raakt <bestand>` voor de omgekeerde vraag, en een normtand
  op `zonderBereik`.
- `test/veranderbereik.test.js` — acht toetsen, alle drie de dragende beweringen
  met een mutatie nagetrokken (een verzonnen routekaart, een uitgezette volle
  ring, en de twee standen op één hoop laten ze alle drie zakken).
- Een stap in `ci.yml`, in de job die de journalen **al** heeft, die niets
  blokkeert.
- De getallen in dit document en in `KEURING.md` par. 1 staan tussen merktekens
  (`npm run getallen`), zodat ze niet opnieuw twaalf dagen achter kunnen lopen.

## 7. De besluiten die openstaan

1. **Wordt `VERANDERBEREIK.json` een repo-register of blijft het een artefact?**
   Vandaag is het allebei mogelijk. Een artefact leeft vijf dagen en kan geen
   normtand dragen; een repo-register vraagt een verse ronde per commit. Het
   verschil is precies waarom `attributie` vandaag `stempel: null` draagt.
2. **Wat doet de sport `geraakt` in `BEWIJSLADDER.json`?** Hij staat op `staat`.
   Sinds deze tak heeft hij één mechanisme met een gestempeld repo-register, maar
   twee van de vier dragen hun uitslag nog steeds niet: `attributie.js` schrijft
   naar een artefact van vijf dagen (`stempel: null`) en `impactbereik.js` draait
   in geen enkele workflow. Óf die twee worden aangesloten, óf de grond van de
   sport zegt hardop dat hij op één been staat. Dit document verandert die uitslag
   niet zelf — dat is een besluit van de eigenaar over zijn eigen ladder.
3. **Property-based testing (punt 14): erbij of niet?** Het is het enige punt van
   de 28 dat echt afwezig is, goedkoop te beginnen, en het past op de bestaande
   invarianten (`lib/idemsleutels.js`, `kern/waarde/policy.js`).

## 7a. De drie besluiten zijn genomen (15 september 2026)

De eigenaar heeft de drie vragen van par. 7 beantwoord. Ze staan hier met wat er
al van gebouwd is en wat er nog niet is — en met één correctie, want een van de
drie botst met een ladder die dit huis al heeft.

**1. Register en waarneming worden uit elkaar getrokken.** Eén bestand mag geen
twee betekenissen dragen. Er komt een **VERANDERBEREIK-REGISTER** (stabiele
kennis: toets → claims → afhankelijkheden, versioneerbaar, in de repo) naast een
**VERANDERBEREIK-RUN** (een waarneming: commit X raakte Y, daarom liep Z). Dat
lost precies de ongemakkelijke stand op waarin het huidige bestand tegelijk
waarheid moet zijn én `rondeVolledig: false` draagt. **Nog niet gebouwd.**

**2. De sport `geraakt` mag geen `staat` heten** zolang twee van zijn vier
mechanismen hun uitslag niet dragen. Besloten, **en hier hoort een correctie
bij**: de voorgestelde ladder `ONTDEKT → BEDRAAD → BEWEZEN` zou de **zesde**
gezagsladder van dit huis zijn, en `BEWIJSMACHINE.md` houdt precies dat tegen.
De ladder bestaat al en staat in `BESTUUR.md` par. 3 als huisregel: **onbekend,
vermoed, gemeten, bewezen**. Die vier dekken het voorstel een-op-een — *ontdekt*
is `vermoed`, *bedraad* is `gemeten`, *bewezen* is `bewezen` — en ze hebben al
lezers. De sport hoort dus een **bewijsgraad** te krijgen en geen nieuwe
woordenlijst. **Bewust nog niet gebouwd**: het verandert de standen van
`BEWIJSLADDER.json`, en daarmee de normtand `bewijsAlleenKeten` en zijn toetsen.
De eigenaar heeft die correctie overgenomen ("doe het met de bestaande vier graden"), en **het staat**:
`scripts/bewijsladder.js` geeft elke sport een **graad** naast zijn stand, afgeleid uit feiten
die het mechanisme al draagt. Twee vragen, in deze volgorde: **draait hij** (zo niet, dan is
`onbekend` waar en anders niet), en **draagt hij zijn uitslag** -- een poort die alleen een
exitcode geeft en een register zonder stempel zijn allebei `vermoed`, register plus stempel is
`gemeten`, en dat plus draaien aan beide kanten is `bewezen`.

**Die eerste vraag zat er eerst niet in, en de meter loog daardoor over zichzelf.** De eerste
versie gaf `onbekend` aan elk mechanisme zonder register, en toen heette tien van de twaalf
sporten `onbekend` -- terwijl `scripts/check.js` geen JSON schrijft en wel degelijk een oordeel
geeft. Een poort met een uitspraak gelijkstellen aan een poort die nergens draait, is meten wat
je niet bedoelt (`BEWIJSMACHINE.md` par. 6a). Met de correctie: **12 van de 12 sporten staan op
`vermoed`**, nul op `onbekend`, en per mechanisme 46 `vermoed`, 10 `bewezen`, 2 `gemeten`. Dat
de sportas geen spreiding heeft is geen defect maar de uitslag: elke sport heeft minstens een
poort die zijn uitslag niet commit-gebonden draagt. De graad van een sport is de **zwakste** van zijn
mechanismen, want een conclusie is nooit harder dan haar zachtste premisse.

Uitslag voor de sport waar het om begon: **stand `staat`, graad `vermoed`** -- en hij noemt de
zwakste premisse bij naam (`attributie.js`, die zijn uitslag naar een artefact van vijf dagen
schrijft). `veranderbereik.js` haalt `gemeten` en niet `bewezen`, want hij draait alleen in de
keten. De stand is bewust NIET aangeraakt: stand en graad zijn twee assen -- de een zegt of dit
soort bewijs bestaat, de ander hoe hard het is -- en ze worden nooit tot een cijfer verrekend.

**3. Property-based testing komt er, en begint bij de wetten.** Niet willekeurige
invoer op een scherm, maar de invarianten waar de hoogste veiligheidswinst zit:
*geen actor zonder geldige bevoegdheid veroorzaakt ooit een geslaagde mutatie*,
en *dezelfde idempotentiesleutel met dezelfde betekenis en dezelfde toestand geeft
nooit twee economische gevolgen*. **Nog niet gebouwd.** Let bij de bouw op één
ding: `fast-check` toevoegen is een dependency-besluit dat langs de job *Nieuwe
dependencies beoordelen* gaat; de generatoren zijn ook met de hand te schrijven,
en dat is voor deze twee wetten waarschijnlijk genoeg.

## 7b. De vondst die uit het CI-incident zelf kwam

Tijdens deze tak werd een CI-run op de head **geannuleerd** — geen enkele job
gezakt. Dat las als "niets rood", en dat is precies verkeerd: een geannuleerde
run heeft geen uitspraak gedaan. De eigenaar trok daaruit de goede conclusie:
tussen `PASS` en `FAIL` liggen minstens `CANCELLED`, `NOT_RUN`, `RUNNING`,
`STALE`, `SUPERSEDED` en `INFRA_ERROR`, en maar één daarvan betekent *bewezen op
deze head*.

**En dat gat zat ook lokaal.** `scripts/ci-lokaal.js` drukte al netjes af *"niet
gedraaid: N — en dat is geen groen"*, en liet daaronder het oordeel luiden
`gezakt === 0 ? 'geen poort gezakt' : ...` met exit 0. Het proza zei het goede en
de exitcode zei het tegenovergestelde; een ronde waarin dertig poorten niet
draaiden en nul zakten, meldde groen. Dat is gerepareerd:

| stand | betekenis |
|---|---|
| `GEZAKT` | een poort is gevallen |
| `ONBEWEZEN` | niets viel om, maar niet alles is gedraaid — geen groen én geen rood |
| `BEWEZEN` | elke poort die hier hoort te draaien, draaide en staat |

Drie dingen die daar niet mogen sneuvelen. **Een poort die alleen bij GitHub
bestaat telt óók als onbewezen** — zou die niet meetellen, dan heet een lokale
ronde "bewezen" terwijl de halve keten er niet in zat. **`ONBEWEZEN` geeft
standaard geen exit 1**, want deze draaier is ook het gereedschap van iemand die
met opzet versmalt (`--alleen`, `--snel`); zou hij daarop zakken, dan leert
iedereen binnen een week de exitcode te negeren en is de strengere stand minder
waard dan de oude. Met `--eis-bewezen` zakt hij wél, en dát is de stand voor een
release-oordeel. En het oordeel wordt **met de commit** in `.cilokaal` gelegd:
zonder die commit is "de ronde stond groen" een uitspraak zonder onderwerp.

## 7c. De richting daarboven, en wat er eerst gemeten moet worden

De eigenaar heeft de architectuur uitgeschreven: Change Compiler → Semantic Delta
→ Change Graph → Risk Engine → Proof Planner → Proof Executor → **Proof Ledger**,
met een attestatie die aan `head + plan + omgeving + dependencies` hangt in plaats
van aan "de PR". Vier dingen daaruit zijn hier de moeite van het vastleggen waard,
omdat ze de volgorde bepalen.

**De 333 worden niet met de hand gelabeld.** Er komt een instrumentatieronde die
per toets vastlegt welke modules, routes, capabilities, toestand en wetten hij
raakt — en het resultaat draagt een **herkomst** (`declared`, `static`,
`observed`, `inferred`, `proven`), want waargenomen bereik is geen bewezen
volledig bereik. Alleen bepaalde combinaties mogen later versmalling toestaan.

**De selector wordt zelf getoetst, in de schaduw.** Eerst kiest hij, dan draait
alles alsnog, en elke failure die hij niet had gekozen is een **false negative**
en een ontbrekende rand in de graaf. Pas na honderden van die rondes mag hij werk
besparen. Dat is de vorm die `CONTROLPLANE.md` al voorschrijft: je kunt niet
afdwingen wat nooit in de schaduw heeft gelopen.

**Recall gaat vóór precisie, en dat is geen voorkeur maar rekenkunde.** Kiest hij
45 toetsen waar er 37 nodig waren, dan kost dat seconden. Kiest hij er 36 terwijl
nummer 37 een dubbele betaling tegenhoudt, dan is het een veiligheidsprobleem.
Let bij het meten wel op de noemer: *alle toetsen die hadden kunnen breken* is
niet kenbaar zonder ze te draaien, dus recall wordt gemeten tegen de
WAARGENOMEN failures van de schaduwronde — een ondergrens, en hij hoort zo te
worden opgeschreven.

**CCC en Proof Efficiency blijven twee assen.** Ze mogen naast elkaar staan en
nooit tot één cijfer worden vermenigvuldigd; dat is `INT-04` en `LAT.md` regel 11
(zie ook correctie A hierboven). En de regel die erboven hangt, is de scherpste
zin van het hele voorstel:

> **Nooit veiligheid verwijderen om sneller te worden. Verwijder opnieuw
> uitgevoerd bewijs waarvan aantoonbaar vaststaat dat het niets nieuws kan
> bewijzen.**

Het doel is dus niet minder toetsen, maar meer zekerheid per seconde — en zolang
er 333 volle ringen staan, is er nog niets aantoonbaar overbodig.

## 7d. De gezagspoort: alleen BEWEZEN mag door (16 september 2026)

`b5053189` was de eerste commit met een correcte betekenis van BEWEZEN. Maar een
juiste waarheid zonder harde consequentie is nog steeds te omzeilen, en daarom
staat deze stap vóór alle andere: zolang een uitrolpoort niet mechanisch eist dat
het oordeel BEWEZEN is, kan ONBEWEZEN er langs een verkeerd aangeroepen pad
doorheen.

**En dat pad bestond met naam en toenaam.** `afbouw:software` is de softwarepoort
voor een uitrol — volledige suite, schermsuite, releasepoort, stagingrepetitie —
aan elkaar geregen met `&&`. Dat is binair: hij stopt bij de eerste die valt en is
anders klaar. Wat hij niet kon zeggen is of alle vier er ook wáren. En
`afbouw:snel` heet bijna hetzelfde en draait er **twee**: de releasepoort en de
stagingrepetitie, zonder de suite en zonder de schermsuite. Wie die voor een
uitrol gebruikte, kreeg een groen dat de halve oppervlakte oversloeg.

`scripts/afbouwoordeel.js` sluit dat. Hij draait geen enkele toets: hij LEEST per
vereist bewijs of het er is, of het bij **deze commit** hoort en of het niet
gezakt is, en hij hergebruikt `oordeelVan` uit `ci-lokaal.js` — die beslisregel
krijgt hier geen tweede huis, want twee plekken die allebei bepalen wat BEWEZEN
betekent, zeggen op een dag iets anders.

| | |
|---|---|
| `npm run afbouw:oordeel` | leest en drukt af, altijd exit 0 |
| `npm run afbouw:software` | eindigt op `afbouw:oordeel -- --eis-bewezen` |
| `npm run afbouw:snel` | eindigt op `afbouw:oordeel` zónder vlag, en meldt dus eerlijk ONBEWEZEN |

Drie dingen die daar niet mogen sneuvelen. **Een bewijs van gisteren is geen
bewijs van vandaag**: een bewijsbestand dat bij een andere commit hoort telt als
ontbrekend, en een bestand zónder commit ook — anders passeert een bewijs van een
onbekend moment. **GEZAKT sluit de poort ook zonder de vlag**, want tegenbewijs
telt altijd. En **de vlag staat in `package.json` en niet in een handleiding**:
een release-, merge- of uitrolpoort mag de vrijblijvende stand niet gebruiken, en
dat hoort mechanisch te zijn en geen afspraak.

De negatieve proef hoort erbij en is de eigenlijke toets: `test/afbouwoordeel.test.js`
zet een kunstmatige ronde neer en kijkt of de poort DICHT gaat — bij een
ontbrekend bewijs, bij een gezakt bewijs, bij bewijs van een andere commit en bij
bewijs zonder commit. Een poort waarvan niemand de gesloten stand heeft gezien, is
geen poort. Twee mutaties nagetrokken: de vlag negeren laat er drie zakken, een
vreemde commit laten meetellen laat er een zakken.

### De regel die hierboven hangt

> **Een bewijsoptimalisatie mag nooit zelf de enige reden zijn waarom haar eigen
> onjuistheid niet meer waarneembaar is.**

Dat is geen stijlregel maar de grens onder alles wat hierna komt. Zegt een
selector straks dat toetsen A–Z niet hoeven te draaien, en was juist toets Q de
enige die had kunnen aantonen dát die selector ernaast zat, dan heeft de
optimalisatie haar eigen tegenbewijs opgeruimd. Daarom blijft er ook ná activering
een onafhankelijke steekproef die de volle ronde draait — niet als
zekerheidshalve-extra, maar omdat het de enige plek is waar een fout van de
selector nog zichtbaar kan worden.

Daaruit volgen drie onafhankelijke lagen, en de derde is degene die vaak wordt
vergeten: bereik voorspellen → gericht bewijzen → **gezagspoort** → uitrol, met
daarnaast een onafhankelijke shadow- of volledige controle die bij een
**BEREIKGAT** het bewijs van de selector DEGRADEERT. Een false negative hoort geen
statistiekje slechter te maken; hij hoort de bewijsgraad van die selector te laten
zakken en versmalling voor dat bereik te stoppen tot het gat verklaard en opnieuw
bewezen is. Dat is een zelfcorrigerend systeem in plaats van een eenmalig
gecertificeerde selector — en het is de reden dat stap 7 (de selector laten
promoveren) vóór stap 8 (versmallen) staat.

### De nulmeting waartegen dit alles gemeten wordt

Op `b5053189`, de eerste volledig doorgemeten commit: **734 toetsen uit de blinde
vlek, 333 volle ringen over, 0 `nietInDezeRonde`, 1900 van 1900 toetsbestanden
werkelijk gedraaid.** Vanaf hier is te meten of een optimalisatie de onbekendheid
verlaagt zónder de waargenomen failure-capture te verslechteren. Let op de naam
van dat tweede getal: het is **geen recall**, want *alle toetsen die hadden kunnen
breken* is geen waarneembare noemer. Waargenomen failures binnen de selectie
gedeeld door alle waargenomen failures — en zo hoort het op een scherm te staan,
anders leest 100% als een garantie die niemand kan geven.

## 7e. Stap 2: kennis en waarneming zijn twee objecten (16 september 2026)

`VERANDERBEREIK.json` droeg twee soorten waarheid door elkaar, en dat was pas te
zien toen het getal een keer verkeerd werd gelezen. Er staat in hetzelfde bestand:

| | wat het is | hoe lang het geldt |
|---|---|---|
| `statischBereik` | wat de require-graaf ziet | tot de code verandert |
| `zonderBereik` | hoeveel toetsen deze ronde geen bereik opleverden | **alleen voor die ronde** |

Het tweede getal is bij een halve ronde te hoog — niet een beetje, maar met de
helft van de suite. Wie dat in een document als *"zoveel weet dit huis niet"*
leest, leest een tekort van de METING als een uitspraak over de toetsen. Dat is
dezelfde fout als `geen-effect-gemeten` tegenover `onbekend` in
`kern/stuur/gevolg.js`, nu een laag hoger.

Vandaar twee registers:

- **`VERANDERBEREIK-KENNIS.json`** — wat een toets KAN raken, afgeleid uit de
  code alleen. Geen journaal, geen ronde. Dezelfde commit geeft hier altijd
  hetzelfde.
- **`VERANDERBEREIK-RONDE.json`** — wat er bij ÉÉN uitvoering is waargenomen,
  inclusief de schuld, met `bronnen` erbij zodat te lezen is wélke ronde het was.

Drie dingen daar niet wegpoetsen.

**De schuld hoort bij de RONDE en niet bij de kennis**, hoe graag je hem ook
duurzaam zou willen noemen. Zonder te weten welke ronde er liep, betekent
`zonderBereik` niets — dus staat hij in de bak die zijn eigen bronnen noemt. De
volledigheidspoort (`--onvolledig` is verplicht bij een halve ronde) hangt om
dezelfde reden alleen aan RONDE.

**De tweede normtand gaat de andere kant op.** `veranderbereikZonderBereik` mag
alleen omlaag (RONDE); `veranderbereikStatisch` mag alleen **omhoog** (KENNIS),
want een require-graaf die minder ziet dan gisteren hoort niet stil te gebeuren.
De ijking in `test/meterijk.test.js` VERLAAGT dat getal daarom in plaats van het
op te hogen: een tand die alleen op een verhoging is geijkt, bewijst niet dat hij
een daling ziet.

**Een lijst velden nakijken is niet genoeg, en dat is met twee mutaties gemeten.**
`return { ...u, soort: 'kennis' }` laat twee toetsen zakken — die vorm schrijft
niemand. De vorm die je in het echt krijgt is dat iemand het dichtstbijzijnde
getal pakt: `toetsbestanden: u.gemeten.toetsenInDezeRonde` houdt de lijst velden
precies goed en laat alleen de proef zakken die twee verschillende rondes over
dezelfde code vergelijkt en een byte voor byte gelijke KENNIS eist. Dat is de
dragende toets; de veldenlijst ernaast vangt alleen de grove vorm.

## 7f. De blinde vlek was voor 28% de meter zelf (16 september 2026)

Bij het splitsen viel op dat een nieuw toetsbestand de schuld met 1 liet stijgen.
Dat leek een eerlijke post — een toets zonder bekend bereik — tot de vraag werd
gesteld wáárom hij geen bereik had. Het antwoord stond in de meter:

```js
if (b.kanten.opgelost.some((d) => d.startsWith('server/'))) statisch.add(t);
```

De vraag die dit register beantwoordt is *als DIT bestand verandert, welk bewijs
moet dan opnieuw?* Die gaat over elk bestand dat kan wijzigen. De as vroeg alleen
naar `server/`, en telde daardoor als **blind** wat volstrekt bepaalbaar is:

| klasse | toetsen |
|---|---|
| require-kant naar `server/` | 833 |
| **alleen naar `scripts/`** (elke metertoets in dit huis) | **224** |
| **alleen naar `public/`** (de schermtoetsen) | **78** |
| geen opgeloste kant (start de server, praat HTTP) | 766 |

302 van de 1068 gemelde blinde toetsen — **28%** — waren niet blind. En juist dat
getal werd geciteerd als de schuld die Affected Proof Selection tegenhoudt.

Met `BRONMAPPEN = ['server/', 'scripts/', 'public/']` op dezelfde halve ronde:

| | voor | na |
|---|---|---|
| statische as | 833 | **1135** |
| blinde vlek statisch alleen | 1068 | **766** |
| zonder enig bereik (volle ring) | 829 | **530** |

Drie dingen daar niet wegpoetsen.

**De fout zat in de METER en niet in de code** — dezelfde klasse als de 118 "dode
paden" van `SCHERMROUTES.json` en de 587 onbekende doelen van de aanroepgraaf, die
allebei op nul eindigden (`CODE.md`). Een meter die te weinig weet, laat een huis
denken dat het ondoorgrondelijk is.

**De verbreding verzint geen bereik.** Er komen drie mappen bij die eigen,
wijzigbare bron bevatten; een kant naar `node_modules/` of naar een ander
toetsbestand zegt niets over dekking en telt niet mee. `test/veranderbereik.test.js`
houdt vast dat een toets die nergens aan hangt eerlijk blind blijft.

**De besturingsproef leunde op een sorteervolgorde, en dat was bijna een stil
gat.** Hij gebruikte `TOETSEN[0]` als "toets zonder bereik". Door de verbreding
kreeg juist die toets bereik, waarmee de proef niet meer kon aantonen dat de
schuld stijgt als de waarneming wegvalt — hij zou groen zijn gebleven omdat de
schuld niet meer kón stijgen, niet omdat de meter werkte. De blinde toets wordt nu
uit een echte meting AFGELEID. Dat is dezelfde les als bij de AI-contextproef
(`MENSNETWERK.md` par. 4c): *een instrument dat niet kan uitslaan, is geen
instrument* — en een fixture die zijn eigenschap aan een index ontleent, verliest
die zonder iets te zeggen.

## 8. De maatstaf

Niet *"wanneer heeft RTG een bewijsmachine"* maar:

> **Wanneer kan RTG van een willekeurige wijziging zeggen welk bewijs opnieuw
> moet, zonder dat er één toets buiten beeld valt?**

En daar hoort een eerlijkheid bij die deze ronde heeft opgeleverd: de VOORWAARTSE
richting werkt (per toets weten we welke bestanden hij raakte), de OMGEKEERDE nog
niet. Zolang de montagewortel de sluiting van elk bestand vult, levert
`--raakt` een veilige maar brede verzameling — bruikbaar om niets te missen,
niet om iets over te slaan. Dat is precies de goede volgorde, en het is geen
tegenvaller: een selector die vandaag zou versmallen, zou het op deze band doen.

Vandaag is dat antwoord: van
<!--getal:veranderbereik.statisch-->1155<!--/getal--> toetsen langs de statische as,
plus <!--getal:veranderbereik.gedicht-->236<!--/getal--> die de waarneming erbij
haalt, en <!--getal:veranderbereik.zonder-->530<!--/getal--> waarover dit huis niets
weet. Dat laatste getal is het werk.
