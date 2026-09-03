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
| Registers in de wortel | <!--getal:codewereld.registers-->77<!--/getal--> (37 op route, 31 op bestand, 9 zonder as) |
| As **route** | 5709 paden, in 42 registers |
| As **bestand** | 1457 bestanden, in 54 registers |
| As **symbool** | **0** — geen register kent een functienaam met een plaats |
| Ruggengraat | **<!--getal:codewereld.ruggengraat-->4912<!--/getal--> van <!--getal:codewereld.paden-->5709<!--/getal--> paden (<!--getal:codewereld.ruggengraatPct-->86<!--/getal-->%) staan in meer dan één register** |
| Brug route → bestand | <!--getal:codewereld.brugPaden-->4444<!--/getal--> paden, uit **2** registers |
| Tegenspraak in die brug | 0 — maar getoetst op <!--getal:codewereld.brugToetsbaar-->32<!--/getal--> paden (**<!--getal:codewereld.brugDekkingPct-->0.7<!--/getal-->%**) |
| Bronbereik | **<!--getal:codewereld.bronGenoemd-->1314<!--/getal--> van <!--getal:codewereld.bronBestanden-->3987<!--/getal--> bronbestanden (<!--getal:codewereld.bronPct-->33<!--/getal-->%)** wordt door enig register genoemd |
| — daarvan `server/` | <!--getal:codewereld.bronServerPct-->41.3<!--/getal-->% |
| — daarvan `public/` | <!--getal:codewereld.bronPublicPct-->6.6<!--/getal-->% |

Vier dingen volgen daaruit, en ze zijn belangrijker dan het plan zelf.

**De Codewereld is te bouwen, maar op de as ROUTE.** <!--getal:codewereld.ruggengraatPct-->86<!--/getal-->% van de paden staat in
meer dan één register: er is een echte ruggengraat, geen verzameling losse
lenzen. Dat is de sterkste uitslag hier.

**Het voorbeeldobject uit het voorstel bestaat vandaag niet.** `pay.boeken` met
`source.bestand` én `source.symbol` veronderstelt een symboolas, en die is nul.
Niet moeilijk — **nul**. Wie het model dat objectformaat belooft, belooft een
veld dat geen enkele meter vult.

**"0 tegenspraken" is hier geen groen.** De brug tussen route en bestand rust op
één register (`SCHRIJFANALYSE.json`, met `MUTATIESEMANTIEK.json` voor 35 paden).
Over 0,7% van de paden viel er iets te vergelijken, en daar klopte het. Over de
rest spreekt niemand tegen, omdat er niemand tweede is. De meter zegt daarom
`niet vast te stellen` en geen `0` — dezelfde regel als in `BESTUUR.md`.

**De belofte "80–95% zonder bron te beantwoorden" haalt vandaag <!--getal:codewereld.bronPct-->33<!--/getal-->%.** Tweederde
van de bronbestanden wordt door geen enkel register genoemd — `server/accounts/`
vrijwel volledig, de hele `server/ai-*`-familie. Dat is de eerlijke bovengrens
van een Architect die alleen registers leest. Niet omdat de meters slecht zijn,
maar omdat ze allemaal op ROUTES kijken en de helft van de code geen route is.

En dat ene percentage verbergt nog iets, dus het staat gesplitst: `server/` haalt
<!--getal:codewereld.bronServerPct-->41.3<!--/getal-->%, `public/` haalt <!--getal:codewereld.bronPublicPct-->6.6<!--/getal-->%. Over de schermen weten de registers dus
vrijwel niets. Een Architect die gevraagd wordt waarom een knop niet werkt, staat
meteen op niveau 3 van de ladder hieronder — bij de bron. Wie het gemengde getal
van <!--getal:codewereld.bronPct-->33<!--/getal-->% aanhoudt, plant voor een dekking die aan de voorkant niet bestaat.

### 0.1 Wat wél al bewezen is: de symboolas is bouwbaar

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
| Deterministische code-analyse | **staat** — 77 registers, alle uit `scripts/`, geen model |
| Scheiding runtime ↔ bron | **staat**, en sinds nu afgedwongen (`test/codegrens.test.js`) |
| Ruggengraat op route | **staat** — 86%, gemeten |
| Codewereld als één object | **een stap weg** op route + bestand; de symboolas moet eerst bestaan |
| Code Resolver | **een stap weg** — `kern/stuur/resolver.js` is er het model voor, mét zijn dekkingsmeter |
| Impactmap / blast radius | **een stap weg** — `EXECUTION_MAP.json` is de helft ervan |
| Architect-AI | **vraagt een besluit** — zie §6 |
| Bronfragment-broker | **vraagt een besluit** |
| Hypothese → meter → bewijs | **vraagt een besluit** (zie hieronder) |
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

## 7. Wat een besluit van de eigenaar vraagt

1. **Komt de Architect er?** Niet "mag AI code lezen" maar: er komt een tweede
   interne AI met een eigen vertrouwensdomein, en die is niet gratis in
   onderhoud.
2. **Wordt de symboolas gebouwd?** Bewezen haalbaar (4,8s, 0 fouten). Zonder
   hem blijft de Codewereld op routeniveau en is het bronbereik 33%.
3. **Mag een bronfragment naar een model?** Ook met een broker verlaat er dan
   eigen code het huis, tenzij het via `LOCAL_AI_URL` gaat. Dat is dezelfde
   vraag als bij `RTG_EXTERNE_AI_UIT`, maar nu over onze eigen bron.
4. **Wie tekent een gegenereerde meter af** voordat hij bewijs mag promoveren?

De eerste twee zijn goedkoop en omkeerbaar. De derde is een merkbesluit en geen
technisch besluit. De vierde hoort beantwoord vóór punt 15 gebouwd wordt, niet
erna.
