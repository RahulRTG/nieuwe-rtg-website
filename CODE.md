# RTG Code Intelligence Plane

*Kan RTG zijn eigen software begrijpen — en waar houdt dat op?*

Dit is een richtingsdocument zoals `PLATFORM.md` en `DEVELOPERCLOUD.md`: per
onderdeel staat erbij of het **staat**, **een stap weg** is, **een besluit
vraagt** of **jaren weg** is. Zodat niemand die vier voor elkaar aanziet.

De vraag die eronder ligt was: *werkt onze interne AI al op onze eigen code?*
Het antwoord is nee, en dat is geen achterstand maar een scheiding die vandaag
gratis bestaat en die je niet moet weggeven.

---

## 0. De meting eerst

De dragende bewering van dit hele plan is dat de registers in de wortel samen
één **Codewereld** vormen: een canonieke waarheid waarin een object zijn
bestand, zijn routes, zijn schrijfdoelen en zijn bewijs bij elkaar draagt. Dat
is exact de vorm waarin `Asset` hier al een keer sneuvelde (`OBJECTMODEL.json`):
een gedeeld type dat van bovenaf werd verklaard in plaats van in de domeinen
gevonden. Dus eerst meten — `npm run codewereld`, uitslag in `CODEWERELD.json`.

| Wat | Uitslag |
|---|---|
| Registers in de wortel | <!--getal:codewereld.registers-->78<!--/getal--> (37 op route, 31 op bestand, 1 op symbool, 9 zonder as) |
| As **route** | 5709 paden, in 42 registers |
| As **bestand** | 1457 bestanden, in 54 registers |
| As **symbool** | <!--getal:codewereld.symboolSleutels-->19503<!--/getal--> symbolen — *stond op 0 tot 3 september 2026, zie §0.2* |
| Ruggengraat | **<!--getal:codewereld.ruggengraat-->4912<!--/getal--> van <!--getal:codewereld.paden-->5709<!--/getal--> paden (<!--getal:codewereld.ruggengraatPct-->86<!--/getal-->%) staan in meer dan één register** |
| Brug route → bestand | <!--getal:codewereld.brugPaden-->4444<!--/getal--> paden, uit **2** registers |
| Tegenspraak in die brug | 0 — maar getoetst op <!--getal:codewereld.brugToetsbaar-->32<!--/getal--> paden (**<!--getal:codewereld.brugDekkingPct-->0.7<!--/getal-->%**) |
| Bronbereik **structuur** | <!--getal:codewereld.bronGenoemd-->3987<!--/getal--> van <!--getal:codewereld.bronBestanden-->3987<!--/getal--> (<!--getal:codewereld.bronPct-->100<!--/getal-->%) — welke functies er wonen, wie ervan afhangt |
| Bronbereik **gedrag** | **<!--getal:codewereld.bronGedrag-->1314<!--/getal--> van 3987 (<!--getal:codewereld.bronGedragPct-->33<!--/getal-->%)** — schrijft het, is het bewezen, is het herhaalbaar |
| — gedrag in `server/` | <!--getal:codewereld.bronServerPct-->41.3<!--/getal-->% |
| — gedrag in `public/` | <!--getal:codewereld.bronPublicPct-->6.6<!--/getal-->% |

Vier dingen volgen daaruit, en ze zijn belangrijker dan het plan zelf.

**De Codewereld is te bouwen, maar op de as ROUTE.** <!--getal:codewereld.ruggengraatPct-->86<!--/getal-->% van de paden staat in
meer dan één register: er is een echte ruggengraat, geen verzameling losse
lenzen. Dat is de sterkste uitslag hier.

**Het voorbeeldobject uit het voorstel bestond niet — en bestaat nu wel.**
`pay.boeken` met `source.bestand` én `source.symbol` veronderstelt een
symboolas, en die stond op **nul**: geen enkele meter vulde dat veld. Sinds
3 september 2026 vult `SYMBOLEN.json` hem (§0.2). De volgorde is hier het punt:
eerst meten dat de as ontbrak, dan hem bouwen — niet een objectformaat beloven
en er daarna een meter bij zoeken.

**"0 tegenspraken" is hier geen groen.** De brug tussen route en bestand rust op
één register (`SCHRIJFANALYSE.json`, met `MUTATIESEMANTIEK.json` voor 35 paden).
Over 0,7% van de paden viel er iets te vergelijken, en daar klopte het. Over de
rest spreekt niemand tegen, omdat er niemand tweede is. De meter zegt daarom
`niet vast te stellen` en geen `0` — dezelfde regel als in `BESTUUR.md`.

**De belofte "80–95% zonder bron te beantwoorden" haalt vandaag <!--getal:codewereld.bronGedragPct-->33<!--/getal-->%.** Tweederde
van de bronbestanden wordt door geen enkel register genoemd — `server/accounts/`
vrijwel volledig, de hele `server/ai-*`-familie. Dat is de eerlijke bovengrens
van een Architect die alleen registers leest. Niet omdat de meters slecht zijn,
maar omdat ze allemaal op ROUTES kijken en de helft van de code geen route is.

En dat ene percentage verbergt nog iets, dus het staat gesplitst: `server/` haalt
<!--getal:codewereld.bronServerPct-->41.3<!--/getal-->%, `public/` haalt <!--getal:codewereld.bronPublicPct-->6.6<!--/getal-->%. Over de schermen weten de registers dus
vrijwel niets. Een Architect die gevraagd wordt waarom een knop niet werkt, staat
meteen op niveau 3 van de ladder hieronder — bij de bron. Wie het gemengde getal
van <!--getal:codewereld.bronGedragPct-->33<!--/getal-->% aanhoudt, plant voor een dekking die aan de voorkant niet bestaat.

### 0.1 De symboolas was bouwbaar, en is beproefd vóór hij gebouwd werd

"Bouwbaar" is zelf een bewering, dus die is beproefd en niet beloofd. De eigen
parser in `scripts/ast/` (lexer, recursive-descent parser, walker — geen enkele
dependency) is over de hele serverboom gehaald:

**<!--getal:codewereld.geparsed-->3027<!--/getal--> bestanden geparsed, <!--getal:codewereld.parseFout-->0<!--/getal--> gefaald, <!--getal:codewereld.symbolen-->13832<!--/getal--> benoemde
symbolen, in vijf seconden.**

Nul gefaald telt hier dubbel, want deze parser gooit op wat hij niet begrijpt in
plaats van stil over te slaan (`parser.js`: *"wat de parser NIET begrijpt is een
harde fout"*). Een symboolas met onzichtbare gaten kan hier dus niet ontstaan.
En bij enkele seconden voor de hele boom is de incrementele herbouw uit punt 17 van
het voorstel voorlopig een oplossing voor een probleem dat niemand heeft.

### 0.2 De symboolas staat (3 september 2026)

`scripts/symbolen.js` → `SYMBOLEN.json` (`npm run symbolen`):

**<!--getal:symbolen.gelezen-->3684<!--/getal--> bestanden gelezen, <!--getal:symbolen.totaal-->19638<!--/getal--> benoemde symbolen met een regelnummer,
<!--getal:symbolen.kanten-->4727<!--/getal--> require-kanten** — heen (waar hang ik van af) én terug (wie hangt van
mij af). Die tweede richting is de dure kant om met de hand te zoeken, en precies
wat een impactvraag nodig heeft.

<!--getal:symbolen.nietGelezen-->303<!--/getal--> bestanden zijn **niet** gelezen, en die staan in het register met hun
reden: alle <!--getal:symbolen.bundeldeel-->303<!--/getal--> zijn bundeldelen (`public/apps/<naam>/`), fragmenten die middenin een
functie beginnen en pas samengevoegd een programma vormen. Echte parsefouten:
<!--getal:symbolen.parsefout-->0<!--/getal--> — en elke andere waarde dan nul laat het script met een foutcode
eindigen, want een parsefout búiten een bundeldeel is een bevinding en geen ruis.

Drie dingen doet dit register met opzet niet, en ze staan er ook in:

1. **Het raadt geen aanroeper.** Een naam in aanroeppositie is een naam, geen
   verwijzing — twee bestanden mogen allebei een `bouw()` hebben. De kanten hier
   zijn require-kanten, want die wijzen naar een bestand dat bestaat. De
   symbool-naar-symboolgraaf is een volgende stap en staat er niet als halve
   waarheid.
2. **Het slaat niets stil over.** Zie de 303 hierboven.
3. **Het beweert niets over routes.** Welk symbool ín een bestand een route
   afhandelt, is niet gemeten en wordt dus niet gesuggereerd.

Eén detail dat er bijna stil verkeerd in ging, en dat overal elders net zo geldt:
`module.exports` kent **drie** standen, niet twee. Een bestand dat
`module.exports = (kern) => {...}` doet, exporteert wel degelijk iets maar zonder
namen — dat als een lege lijst noteren leest als "exporteert niets", en dat is
onwaar voor <!--getal:symbolen.uitvoerZonderNamen-->2019<!--/getal--> bestanden hier. Het register draagt daarom de vórm
(`object`, `functie`, `anders`), en `geexporteerd` staat per symbool op
`onbekend` in plaats van op een vals `nee`.

En één ding dat het meten meteen opleverde: toen deze as erbij kwam sprong het
bronbereik van 33% naar 100%, want een index noemt élk bestand. Dat getal mat
toen zichzelf. Het staat daarom gesplitst in **structuur** (welke functies wonen
hier, wie hangt ervan af — nu 100%) en **gedrag** (schrijft het, is het bewezen —
onveranderd <!--getal:codewereld.bronGedragPct-->33<!--/getal-->%). Een index van alles maakt elke dekkingsvraag triviaal
waar; alleen de tweede teller zegt nog iets.

---

## 1. De invariant, en waarom hij in code staat

> **CODE-AI-001** — een runtime-agent verkrijgt nooit rechtstreeks broncode- of
> repositorybevoegdheid.

Handhaver: `test/codegrens.test.js`. Niet dit document — een document houdt
niemand tegen die morgen `readFileSync(__dirname + '/../pay/poort.js')` schrijft.

De grens is scherper dan "geen `fs`", en dat bleek pas bij het meten. De sluiting
van het stuur is klein — vandaag vijftien modules, en de toets rekent hem elke
keer opnieuw uit — en precies één daarvan leest van schijf:
`server/lib/vervalstaat.js` leest `VERTROUWEN.json`. Dat is een **register** —
afgeleide, gepubliceerde waarheid. `server/kern/pay/poort.js` is dat niet. Dát
onderscheid is de invariant:

| Mag de runtime-AI | Nooit |
|---|---|
| een register lezen (`*.json` in de wortel) | een `.js`, `.html` of `.css` lezen |
| API-paden kennen via `beleid.js` | de bronmeters uit `scripts/` importeren |

De toets doet drie dingen, en alle drie zijn ze zien zakken op een mutatie:

1. geen module in de sluiting van het stuur leest bron van schijf;
2. geen module in die sluiting importeert `scripts/` of een codeobservatorium;
3. het model heeft exact drie gereedschappen (`kaart`, `doe`, `plan`).

Regel 3 is een **ratel en geen slot**: een vierde gereedschap mag, maar niet
ongezien. Zonder die regel is de goedkoopste weg naar broncode-in-de-runtime een
vierde tool met een onschuldige beschrijving.

---

## 2. Drie AI's, drie vertrouwensdomeinen

| | Wereld | Taal | Mag | Mag nooit |
|---|---|---|---|---|
| **Operator** *(staat)* | draaiend platform | capabilities, routes | productie bedienen namens een mens | bron lezen |
| **Architect** *(vraagt een besluit)* | Codewereld | objecten, relaties, bewijs | software begrijpen | productie bedienen |
| **Builder** *(jaren weg)* | zandbak | patches, toetsen | een wijziging vóórstellen | productie bedienen, zelf mergen |

De Operator is de bestaande AI (`server/kern/stuur/`). Die wordt **niet
uitgebreid** — dat is de kern van dit ontwerp. Een Architect die de Operator zijn
kaart aanvult, is één systeem dat productie én bron én model bestuurt.

Broncode wordt capability-based, net als al het andere hier:

```
CODE_METADATA        CODE_SYMBOL_READ     CODE_DEPENDENCY_READ
CODE_TEST_READ       CODE_HISTORY_READ    CODE_PATCH_PROPOSE
```

En met opzet niet: `CODE_WRITE`, `CODE_COMMIT`, `CODE_PUSH`, `CODE_DEPLOY`.

`CODE_TEST_EXECUTE` staat in geen van beide lijstjes, en dat is geen vergeetpost:
**een agent die toetsen uitvoert is niet read-only.** Hij voert code uit die hij
zelf koos, op een machine van ons. Dat hoort in de zandbak van `MAGNAATLAB.md`
thuis en niet in een leesrecht — en de vraag wie die zandbak begrenst hoort
beantwoord vóór het recht bestaat, niet erna.

---

## 3. De escalatieladder

Ruwe bron is een **escalatie**, geen standaardcontext. Vijf niveaus, elk duurder
dan het vorige:

| Niveau | Antwoord uit | Vandaag |
|---|---|---|
| 0 | een register | **staat** (77 registers) |
| 1 | de graaf (aanroepers, routes, capabilities) | **een stap weg** |
| 2 | AST / symbool | **een stap weg** (parser bewezen, as leeg) |
| 3 | een bronfragment via een broker | **vraagt een besluit** |
| 4 | een experiment in de zandbak | **jaren weg** |

Niveau 3 loopt nooit langs het bestandssysteem maar langs een **broker** die het
AST-bereik van een symbool teruggeeft en niet het bestand: geen `.env`, geen
sleutels, geen productiegegevens, en een dak op wat er per vraag uit mag.

---

## 4. Wat er van het voorstel al staat, en wat niet

| Onderdeel | Stand |
|---|---|
| Deterministische code-analyse | **staat** — <!--getal:codewereld.registers-->78<!--/getal--> registers, alle uit `scripts/`, geen model |
| Scheiding runtime ↔ bron | **staat**, en afgedwongen (`test/codegrens.test.js`) |
| Ruggengraat op route | **staat** — <!--getal:codewereld.ruggengraatPct-->86<!--/getal-->%, gemeten |
| Symboolas | **staat** — `SYMBOLEN.json`, §0.2 |
| Codewereld als één object | **een stap weg** — de drie assen bestaan; de brug ertussen rust nog op één bron |
| Code Resolver | **een stap weg** — `kern/stuur/resolver.js` is er het model voor, mét zijn dekkingsmeter |
| Impactmap / blast radius | **een stap weg** — `EXECUTION_MAP.json` plus de omgekeerde require-graaf uit `SYMBOLEN.json` |
| Architect-AI | **besloten, nog niet gebouwd** — read-only, na de twee gaten in §7 |
| Bronfragment-broker | **besloten** — alleen lokaal (`LOCAL_AI_URL`), nog niet gebouwd |
| Hypothese → meter → bewijs | **besloten** — een mens tekent af, zie §7 en hieronder |
| Symbool-naar-symboolgraaf | **een stap weg**, met opzet niet meegenomen — zie §0.2 |
| Testsynthese, patchvoorstellen | **jaren weg** |
| Code-time-travel | **jaren weg**, maar goedkoper dan het lijkt: registers dragen al een `stempel.commit` |
| Content-addressed caching | **niet doen, nog niet** — zie hieronder |

**Hypothese → meter → bewijs** (punt 15 van het voorstel) is de sterkste
gedachte erin: de AI ontdekt, het determinisme beslist. *AI mag betekenis
voorstellen; alleen deterministische systemen mogen waarheid vaststellen.* Dat
sluit naadloos aan op `BEWIJSMACHINE.md`. Er zit één gat in dat benoemd moet
worden: de gegenereerde meter is zelf code, en een meter die zijn eigen
hypothese bevestigt is geen bewijs. Wie tekent die meter af? Zolang dat antwoord
ontbreekt, mag een gegenereerde meter wel draaien maar niets **promoveren**.

**Content-addressed caching** (punt 18) is precies waar `KEURING.md` voor
waarschuwt: 57,1% van de toetsbestanden heeft geen enkele require-kant naar
`server/`. Een cache op een graaf met een blinde vlek maakt van die vlek een
permanente PASS. Eerst de vlek, dan de cache — nooit andersom.

---

## 5. De noemer is een besluit

Elk register telt zijn eigen aantal routes: `DEKKING.json` 4856, `OUTPUTPROEF`
4747, `MUTATIECONTRACT` 4739, `IDEMPROEF` 4733, `EXECUTION_MAP` 4729,
`VERTROUWEN` 4185. Wie ze samenvoegt **kiest** een noemer, en dat is geen
afleiding. Dezelfde vondst als in `MUTATIEINVENTARIS.json`, waar vier getallen
rondliepen die alle vier "het aantal routes" heetten. Een Codewereld die dit
stil oplost, verkoopt een percentage tussen twee verschillende noemers.

---

## 6. De grenzen

1. **De Operator komt nooit aan de bron.** CODE-AI-001, afgedwongen.
2. **De Architect bedient nooit productie.** Geen `doe`, geen route, geen sessie.
3. **Een modelbevinding wordt nooit een register.** Alleen een deterministisch
   gereproduceerd resultaat is registerwaardig. De AI-projectie is tijdelijk.
4. **Er komt geen tweede routelijst.** De Codewereld wordt afgeleid uit de
   bestaande meters; wie hem met de hand kan bijwerken, heeft de 22e
   capabilitylijst gemaakt (`OS.md`).
5. **Waar twee registers elkaar tegenspreken staat `ONBEPAALD`** en nooit stil
   een winnaar — zoals `EXECUTION_MAP.json` het al doet.
6. **Niet-gemeten is nooit in-orde.** `niet vast te stellen` is een eersteklas
   uitslag naast in orde en storing (`BESTUUR.md`).
7. **Een agent die toetsen uitvoert is niet read-only** en hoort in een zandbak.

---

## 7. De besluiten (genomen 3 september 2026)

Vier vragen lagen bij de eigenaar. Alle vier zijn beantwoord.

**1. De symboolas wordt gebouwd.** *Uitgevoerd* — §0.2. Hij draait in `scripts/`,
raakt `server/` niet, en is dus omkeerbaar: een register weggooien kan.

**2. Er komt een Architect, read-only, en pas na de symboolas.** Eigen
vertrouwensdomein: hij leest de Codewereld en bedient nooit productie. Dat "pas
na" is geen volgorde uit netheid — een Architect die tweederde van de code niet
kan zien, vult dat gat met aannames, en grens 3 verbiedt precies dat. Hij is er
dus nog niet: wat er nu staat is de wereld waarin hij straks leest.

**3. Een bronfragment gaat alleen naar een lokaal model.** Eigen code verlaat het
huis niet. De broker mag dus alleen praten met `LOCAL_AI_URL`; zonder lokaal
model werkt de Architect niet, en dat is de bedoelde uitkomst en geen storing.
`RTG_EXTERNE_AI_UIT=1` bestond al voor gebruikersdata — dit is dezelfde regel,
nu over onze bron. Wie hier later een uitzondering op wil, neemt een merkbesluit
en geen technisch besluit: dit is niet terug te draaien nadat het één keer is
gebeurd.

**4. Een gegenereerde meter wordt door een mens afgetekend, en promoveert tot
die tijd niets.** Hij mag draaien en melden; zijn uitslag wordt geen register
voordat iemand hem heeft gelezen. Dat sluit het gat in punt 15: een meter die
zijn eigen hypothese bevestigt is geen bewijs. Het overwogen alternatief — een
meter telt zodra hij eerst rood gaf op de huidige code — is afgevallen omdat de
meter dan zelf zijn tegenvoorbeeld kiest.

### Wat daarmee de eerstvolgende stap is

Niet de Architect. Eerst de twee gaten die besluit 2 blokkeren, in deze volgorde:

1. **Een tweede bron voor de brug route → bestand.** Nu <!--getal:codewereld.brugDekkingPct-->0.7<!--/getal-->% toetsbaar. Met de
   symboolas erbij is die tweede bron dichterbij: een routebestand kent nu zijn
   symbolen, dus een onafhankelijke afleiding is te maken en tegen
   `SCHRIJFANALYSE.json` te leggen. Pas dan betekent "0 tegenspraken" iets.
2. **Gedragsdekking van `public/`,** nu <!--getal:codewereld.bronPublicPct-->6.6<!--/getal-->%. Zolang die zo laag is, is elke
   vraag over een scherm meteen een bronvraag — en dus meteen niveau 3.

De symbool-naar-symboolgraaf is een derde stap en geen eerste: hij is pas
betrouwbaar te maken als require-kanten en uitvoernamen kloppen, en die staan er
nu.
