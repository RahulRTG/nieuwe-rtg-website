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
| Registers in de wortel | <!--getal:codewereld.registers-->84<!--/getal--> (37 op route, 31 op bestand, 1 op symbool, 9 zonder as) |
| As **route** | 5709 paden, in 42 registers |
| As **bestand** | 1457 bestanden, in 54 registers |
| As **symbool** | <!--getal:codewereld.symboolSleutels-->19517<!--/getal--> symbolen — *stond op 0 tot 3 september 2026, zie §0.2* |
| Ruggengraat | **<!--getal:codewereld.ruggengraat-->5207<!--/getal--> van <!--getal:codewereld.paden-->5835<!--/getal--> paden (<!--getal:codewereld.ruggengraatPct-->89.2<!--/getal-->%) staan in meer dan één register** |
| Brug route → bestand | <!--getal:codewereld.brugPaden-->5113<!--/getal--> paden, uit **2** registers |
| Verschillen in die brug | 1, getoetst op <!--getal:codewereld.brugToetsbaar-->4530<!--/getal--> paden (<!--getal:codewereld.brugDekkingPct-->88.6<!--/getal-->%) — soort: zie §0.3 |
| Bronbereik **structuur** | <!--getal:codewereld.bronGenoemd-->3988<!--/getal--> van <!--getal:codewereld.bronBestanden-->3988<!--/getal--> (<!--getal:codewereld.bronPct-->100<!--/getal-->%) — welke functies er wonen, wie ervan afhangt |
| Bronbereik **gedrag** | **<!--getal:codewereld.bronGedrag-->1470<!--/getal--> van 3987 (<!--getal:codewereld.bronGedragPct-->36.9<!--/getal-->%)** — schrijft het, is het bewezen, is het herhaalbaar |
| — gedrag in `server/` | <!--getal:codewereld.bronServerPct-->41.9<!--/getal-->% |
| — gedrag in `public/` | <!--getal:codewereld.bronPublicPct-->21<!--/getal-->% |

Vier dingen volgen daaruit, en ze zijn belangrijker dan het plan zelf.

**De Codewereld is te bouwen, maar op de as ROUTE.** <!--getal:codewereld.ruggengraatPct-->89.2<!--/getal-->% van de paden staat in
meer dan één register: er is een echte ruggengraat, geen verzameling losse
lenzen. Dat is de sterkste uitslag hier.

**Het voorbeeldobject uit het voorstel bestond niet — en bestaat nu wel.**
`pay.boeken` met `source.bestand` én `source.symbol` veronderstelt een
symboolas, en die stond op **nul**: geen enkele meter vulde dat veld. Sinds
3 september 2026 vult `SYMBOLEN.json` hem (§0.2). De volgorde is hier het punt:
eerst meten dat de as ontbrak, dan hem bouwen — niet een objectformaat beloven
en er daarna een meter bij zoeken.

**"0 tegenspraken" was geen groen.** De brug tussen route en bestand rustte op
één register (`SCHRIJFANALYSE.json`, met `MUTATIESEMANTIEK.json` voor 35 paden).
Over **0,7%** van de paden viel er iets te vergelijken; over de rest sprak
niemand tegen omdat er niemand tweede was. De meter zei daarom `niet vast te
stellen` en geen `0` — dezelfde regel als in `BESTUUR.md`. Die tweede bron is er
sinds 3 september (§0.3) en de dekking staat nu op <!--getal:codewereld.brugDekkingPct-->88.6<!--/getal-->%.

**De belofte "80–95% zonder bron te beantwoorden" haalt vandaag <!--getal:codewereld.bronGedragPct-->36.9<!--/getal-->%** —
en stond op 33% voordat de schermen erbij kwamen. Over de meerderheid van de
bronbestanden zegt geen enkel register iets over gedrag: `server/accounts/`
vrijwel volledig, de hele `server/ai-*`-familie. Dat is de eerlijke bovengrens
van een Architect die alleen registers leest. Niet omdat de meters slecht zijn,
maar omdat ze vrijwel allemaal op ROUTES kijken en een groot deel van de code
geen route is.

Het getal staat gesplitst omdat het gemengde cijfer een verschil verbergt:
`server/` haalt <!--getal:codewereld.bronServerPct-->41.9<!--/getal-->%, `public/` <!--getal:codewereld.bronPublicPct-->21<!--/getal-->%. Dat tweede was **6,6%** tot
`SCHERMGEDRAG.json` er was (§0.5) — over de schermen wisten de registers
toen niets over gedrag, en een Architect die gevraagd wordt waarom een knop niet
werkt, stond daarmee meteen op niveau 3 van de ladder hieronder. Ook nu nog
geldt: wie het gemengde getal aanhoudt, plant voor een dekking die per boom
verschilt.

### 0.1 De symboolas was bouwbaar, en is beproefd vóór hij gebouwd werd

"Bouwbaar" is zelf een bewering, dus die is beproefd en niet beloofd. De eigen
parser in `scripts/ast/` (lexer, recursive-descent parser, walker — geen enkele
dependency) is over de hele serverboom gehaald:

**<!--getal:codewereld.geparsed-->3028<!--/getal--> bestanden geparsed, <!--getal:codewereld.parseFout-->0<!--/getal--> gefaald, <!--getal:codewereld.symbolen-->13837<!--/getal--> benoemde
symbolen, in vijf seconden.**

Nul gefaald telt hier dubbel, want deze parser gooit op wat hij niet begrijpt in
plaats van stil over te slaan (`parser.js`: *"wat de parser NIET begrijpt is een
harde fout"*). Een symboolas met onzichtbare gaten kan hier dus niet ontstaan.
En bij enkele seconden voor de hele boom is de incrementele herbouw uit punt 17 van
het voorstel voorlopig een oplossing voor een probleem dat niemand heeft.

### 0.2 De symboolas staat (3 september 2026)

`scripts/symbolen.js` → `SYMBOLEN.json` (`npm run symbolen`):

**<!--getal:symbolen.gelezen-->3684<!--/getal--> bestanden gelezen, <!--getal:symbolen.totaal-->19652<!--/getal--> benoemde symbolen met een regelnummer,
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
onwaar voor <!--getal:symbolen.uitvoerZonderNamen-->1876<!--/getal--> bestanden hier. Het register draagt daarom de vórm
(`object`, `functie`, `anders`), en `geexporteerd` staat per symbool op
`onbekend` in plaats van op een vals `nee`.

En één ding dat het meten meteen opleverde: toen deze as erbij kwam sprong het
bronbereik van 33% naar 100%, want een index noemt élk bestand. Dat getal mat
toen zichzelf. Het staat daarom gesplitst in **structuur** (welke functies wonen
hier, wie hangt ervan af — nu 100%) en **gedrag** (schrijft het, is het bewezen),
en die tweede bleef bij die ronde onveranderd op 33%. Een index van alles maakt
elke dekkingsvraag triviaal waar; alleen de tweede teller zegt nog iets.

### 0.3 De twee gaten uit §7 zijn dicht (3 september 2026)

**Gat 1 — de brug had één bron.** `scripts/routebron.js` → `ROUTEBRON.json`
(`npm run routebron`) legt er een onafhankelijke afleiding naast: niet de
bronboom aflopen (dat doet `SCHRIJFANALYSE.json`) maar het de **router** vragen —
wat de server werkelijk aanbiedt — en daar de plek in de bron bij zoeken.

<!--getal:routebron.vergeleken-->4120<!--/getal--> routes kennen beide wegen (was 32), <!--getal:routebron.gelijk-->4119<!--/getal--> geven hetzelfde bestand,
**<!--getal:routebron.tegenspraak-->0<!--/getal--> echte tegenspraken** en <!--getal:routebron.verouderd-->1<!--/getal--> verschil dat er geen is.

Dat ene verschil is de opbrengst van de hele oefening. `POST /api/auth/me` staat
volgens de router in `inlog-pas.js` en volgens `SCHRIJFANALYSE.json` in
`inlog.js` — en beide hebben gelijk: dat register draagt het stempel van commit
`55e4a311` (29 augustus) en het bestand is op 1 september gesplitst. Daarom kent
`ROUTEBRON.json` twee soorten verschil en telt het ze nooit bij elkaar op:

| soort | betekenis |
|---|---|
| `verouderd` | een van de bestanden is gewijzigd ná het stempel van het andere register — je vergelijkt twee **momenten** |
| `tegenspraak` | beide bestanden staan stil sinds dat stempel, en toch verschillen de wegen — een **bevinding** |

Wie die twee op één hoop gooit, krijgt een Codewereld die op leeftijdsverschil
alarm slaat en bij een echte tegenspraak niets zegt. `BESTUUR.md` zegt het al
voor bewijs — vervallen bewijs is geen bewijs; voor een samenvoeging geldt het
net zo goed: **registers van verschillende leeftijd zijn niet zonder meer naast
elkaar te leggen.** `CODEWERELD.json` noemt het daarom `verschillen` en niet
`tegenspraken`: het soort wordt in `ROUTEBRON.json` bepaald, en één woord met
twee betekenissen is precies wat `SEMANTIEK.json` hier 99 keer heeft geteld.

**Gat 2 — over de schermen wisten de registers niets** (gedragsdekking 6,6%).
`scripts/schermroutes.js` → `SCHERMROUTES.json` (`npm run schermroutes`) leest
per bestand in `public/` welke API-paden het noemt: <!--getal:schermroutes.schermen-->368<!--/getal--> schermen,
<!--getal:schermroutes.paden-->843<!--/getal--> exacte paden over <!--getal:schermroutes.verwijzingen-->974<!--/getal--> verwijzingen, plus <!--getal:schermroutes.voorvoegsels-->128<!--/getal--> voorvoegsels.
Daarmee bestaat de keten **scherm → route** die een impactvraag nodig heeft.

**Correctie op een eerdere versie van deze paragraaf.** Hier stond dat `public/`
daarmee van 6,6% naar 26,6% gedragsdekking ging. Dat was onjuist.
`SCHERMROUTES.json` legt een RELATIE (welk scherm noemt welk pad) en doet geen
uitspraak over gedrag: niet of er geschreven wordt, niet of het klopt, niet of
het bewezen is. De gedragsteller staat onveranderd op
<!--getal:codewereld.bronPublicPct-->21<!--/getal-->% voor `public/`; wat er wél bij kwam heeft sinds §0.4 een
eigen teller.

Met de **lexer** en niet de parser, want de 303 bundeldelen parsen niet maar
tokeniseren wel — en een lexer laat commentaar weg, zodat een uitgeschakelde
aanroep niet als levende telt. Drie delen zijn middenin een sjabloon geknipt;
die zijn via hun samengestelde bundel nagelezen, en de uitslag daarvan staat in
het register (nul gevonden — de werkos-bundel noemt geen enkel API-pad).

#### Wat dat gat kostte om eerlijk te krijgen

De eerste versie meldde **118 dode paden**. Vrijwel allemaal onzin, in drie
rondes teruggebracht tot <!--getal:schermroutes.dood-->0<!--/getal--> — en elke ronde is een regel die elders net zo
geldt:

1. **Een pad kan verdergaan.** `'/api/agenda/' + id` is geen route maar een
   stam. Het register kijkt nu of het volgende token een `+` is, of het pad op
   `/` eindigt, of er een `?` in staat.
2. **Een pad kan een gegeven zijn in plaats van een doel.** In
   `String(weg).replace('/api/rtf/social', '')` staat het pad als tekst. Een
   lexer ziet dat verschil niet, dus is er een derde stand: `basis` — er bestaat
   een route die ermee begint, dus het is een stam en geen bevinding. Het
   register beweert *"dit bestand noemt dit pad"*, en een dood-pad-verdict is
   sterker dan die bewering; die spanning is hiermee opgelost.
3. **Vindbaar zijn is niet hetzelfde als bestaan.** Dit is de duurste, want
   `scripts/lib/routes.js` waarschuwt er in zijn eigen kop voor en ik trapte er
   toch in: ik nam de routes *met een gevonden bronbestand* als "welke routes
   bestaan er". Daardoor heette `/api/instant-reality/event` dood terwijl de
   router hem gewoon aanbiedt — zijn routebestand staat op één regel, dus de
   bronindex vond hem niet. `ROUTEBRON.json` draagt daarom **twee** lijsten:
   `alleRoutes` (<!--getal:routebron.routerRoutes-->4856<!--/getal-->, bestaan) en `perRoute` (met bestand), en
   <!--getal:routebron.zonderBestand-->54<!--/getal--> routes zitten wél in de eerste en niet in de tweede.

Nul dode paden is hier geen lege controle: <!--getal:schermroutes.paden-->843<!--/getal--> exacte paden zijn tegen
<!--getal:routebron.routerRoutes-->4856<!--/getal--> echte routes gehouden.

### 0.4 De aanroepgraaf en de brug route → symbool (3 september 2026)

`scripts/aanroepgraaf.js` → `AANROEPGRAAF.json` (`npm run aanroepgraaf`) legt de
laatste twee schakels: **wie roept wie aan**, en **welk symbool handelt deze
route af**. <!--getal:graaf.kanten-->22121<!--/getal--> kanten, <!--getal:graaf.aanroepers-->8043<!--/getal--> symbolen waarvan bekend is wie ze
aanroept, en <!--getal:graaf.routesMetSymbool-->2978<!--/getal--> routes met minstens één afgehandeld symbool.

Daarmee loopt de keten van scherm tot functie, uit registers alleen:

```
/api/fluister
  → POST /api/fluister            (ROUTEBRON.json)
  → server/routes/member/persoonlijk.js   (ROUTEBRON.json)
  → 13 schermen                   (SCHERMROUTES.json)
  → onthoudGesprek, aiStatus, ai-live-twin.js#maakLiveTwin   (AANROEPGRAAF.json)
```

**De regel die deze meter draagt: liever geen kant dan een verzonnen kant.** Een
aanroepgraaf met gokwerk ziet er even compleet uit en wijst je naar de verkeerde
plek. Een kant ontstaat daarom alleen als de naam lokaal bestaat of aantoonbaar
uit een `require` komt, **én** het doelbestand dat symbool ook echt kent.

#### Een kwart opgelost is hier geen tekort

Van de <!--getal:graaf.aanroepen-->135045<!--/getal--> aanroepen is <!--getal:graaf.opgelostPct-->24.3<!--/getal-->% naar een symbool te herleiden (18,1%
toen deze meter werd gebouwd; §0.7 bracht de rest). Dat getal zonder indeling
nodigt uit tot de verkeerde reparatie — iemand gaat de resolver "verbeteren" tot
hij `res.json` aan een bestand knoopt. Daarom staat de rest ingedeeld:

| soort | aantal | wat het is |
|---|---|---|
| ingebouwd | 25.345 | `String()`, `Object.freeze()`, `JSON.parse()` |
| kader | 10.735 | `res.json()`, `app.post()`, `req.body` |
| contextobject | <!--getal:graaf.contextobject-->15798<!--/getal--> | `k.instantMutate()` — zie hieronder (was 20.961 vóór §0.7) |
| lokale waarde | 20.218 | `uit.push()` op iets dat hier is verklaard |
| methode op waarde | 30.250 | `iets().nogwat()` — geen naam om op te lossen |
| **overig** | **<!--getal:graaf.overig-->3071<!--/getal-->** | de echte restbak: 2,3% van alle aanroepen |

De post `contextobject` is een **architectuurfeit en geen meetfout**. Dit huis
geeft zijn modules vaak niet via `require` door maar via een contextobject dat in
`server/opzet/` wordt samengesteld; `scripts/schrijfanalyse.js` schrijft dat in
zijn eigen kop al op. Toen deze meter werd gebouwd leek die post principieel
onherleidbaar — één op de zes aanroepen. §0.6 en §0.7 hebben dat voor een deel
weerlegd: de zak wordt bij het bedraden gelezen, en wie hem vult is af te leiden.
Wat er nu nog staat is wat ook dan niet te volgen is.

#### Vier fouten die deze meter in zichzelf vond

`doelOnbekend` staat op <!--getal:graaf.doelOnbekend-->0<!--/getal-->, maar begon op 587. Geen van die 587 was een
fout in de code; alle vier de oorzaken zaten in de meter, en alle vier zijn het
lessen die elders net zo gelden:

1. **De parser zet een stringliteraal in `raw`, niet in `value`.** Daardoor
   ontstond geen enkele invoerbinding en leek de graaf 100% lokaal — compleet
   ogend en fout. Precies de faalvorm waartegen deze meter zou moeten
   beschermen.
2. **`module.exports.zin = function zin(…)` is een expressie, geen declaratie.**
   Zulke functies ontbraken volledig in de symbooltabel — ook in
   `SYMBOLEN.json`, dat daarop is bijgewerkt.
3. **Een spread maakt een uitvoerlijst onvolledig.** `module.exports = { a,
   ...users }` exporteert meer dan er staat. Een onvolledige lijst als volledig
   noteren is erger dan geen lijst; er is nu een aparte vorm
   `object-onvolledig`.
4. **Schaduw.** `const wie = require('./wie')` en even verderop
   `([teken, wie]) => wie.includes(mij)` — een array-patroon dat de
   modulebinding overschaduwt. Namen die ergens in het bestand ook een parameter
   of lokale verklaring zijn, vallen daarom uit de bindingen. Grof, en met
   opzet.

Wat na die vier overblijft is <!--getal:graaf.doelOnbekend-->0<!--/getal-->. Dat is hier geen lege controle: <!--getal:graaf.kanten-->22121<!--/getal-->
kanten zijn tegen de symbooltabel van hun doelbestand gehouden.

#### Een derde teller, omdat twee er niet genoeg waren

Toen de aanroepgraaf erbij kwam sprong de gedragsdekking van `server/` van 41,9%
naar 85,5% — zonder dat er iets over gedrag bij was gekomen. Dezelfde val als bij
de symboolas. `CODEWERELD.json` telt daarom nu drie dingen apart, en bepaalt
welk register een **index** is op twee manieren tegelijk: een register mag het
zichzelf noemen (`soort: 'index'`) én het wordt gemeten (noemt hij ≥95% van een
boom, dan is hij het, wat hij ook beweert).

| teller | wat het zegt | stand |
|---|---|---|
| structuur | dit bestand bestaat, en dit woont erin | <!--getal:codewereld.bronPct-->100<!--/getal-->% |
| relatie | waar hangt het mee samen, welk scherm gebruikt het | <!--getal:codewereld.relatie-->3988<!--/getal--> bestanden |
| **gedrag** | schrijft het, klopt het, is het bewezen | **<!--getal:codewereld.bronGedragPct-->36.9<!--/getal-->%** |

Alleen die laatste is de bovengrens voor een Architect die over gedrag wordt
bevraagd, en juist die bewoog bij deze ronde niet: hij bleef op 33,4% en ging
pas omhoog toen er in §0.5 een echte gedragsmeting bij kwam.

### 0.5 Gedrag voor `public/` (3 september 2026)

Het grootste gat uit §7 was: over een scherm was geen enkele gedragsuitspraak te
doen (<!--getal:codewereld.bronPublicPct-->21<!--/getal-->% — daarvóór 6,6%). `scripts/schermgedrag.js` →
`SCHERMGEDRAG.json` (`npm run schermgedrag`) lost dat op zonder iets nieuws te
meten: het **stelt samen** uit metingen die er al zijn.

```
SCHERMROUTES     welk scherm noemt welk pad
ROUTEBRON        welke routes bestaan er op dat pad
SCHRIJFANALYSE   schrijft die route
EXECUTION_MAP    welke rol vraagt hij, wat is het bewijs waard
IDEMPROEF        wat doet een tweede aanroep
```

<!--getal:schermgedrag.schermen-->368<!--/getal--> schermen, waarvan <!--getal:schermgedrag.metGrond-->231<!--/getal--> met een echte uitspraak:
<!--getal:schermgedrag.schrijftJa-->63<!--/getal--> schermen kunnen via de API iets veranderen, <!--getal:schermgedrag.verzwakt-->160<!--/getal--> raken een route
met verzwakt bewijs, en **<!--getal:schermgedrag.bewezen-->0<!--/getal--> schermen raken uitsluitend bewezen routes** — dat
laatste is geen verrassing (`VERTROUWEN.json` staat huisbreed op 0 bewezen)
maar het staat nu per scherm.

Die nul is trouwens de reden dat het register een **verdeling** publiceert en
geen handvol gekozen bakjes. De eerste versie had een rangorde van vijf
bewijswaarden waarvan er in deze code twee voorkomen — een ladder uit het hoofd
in plaats van uit de data — en dan drukt een `|| 4` stilletijds de uitkomst.
`bewijsGeschorst: 0` leest bovendien als een geruststelling terwijl die waarde
hier nergens bestaat. Nu staat er wat er werkelijk is (`verzwakt` 160,
`ONBEPAALD` 51, `niet vast te stellen` 157), krijgt een onbekende bewijswaarde
de **zwakste** plaats in plaats van een middelmatige, en wordt zij apart
gemeld.

**De grens is scherp en hoort meegelezen:** dit is *afgeleid* gedrag — wat een
scherm via de API kan veroorzaken. Het zegt niets over wat het scherm zelf doet:
localStorage, de DOM, een download. `schrijft: nee` betekent hier "verandert
niets aan de serverkant", niet "verandert niets". Wie dat verwart, leest een
halve meting als een hele.

De samenstelregel is de veto-regel die `scripts/schrijfanalyse.js` al gebruikt:
bij **schrijven** wint de zwaarste uitkomst (één van tien routes schrijft = dit
scherm kan iets veranderen), bij **bewijs** het zwakste (een keten is zo sterk
als zijn zwakste schakel). `onbekend` is in beide gevallen niet de gunstige
uitkomst.

#### Dezelfde val, een derde keer — en nu vooraf gezien

<!--getal:schermgedrag.zonderGrond-->137<!--/getal--> van de 368 schermen krijgen `niet vast te stellen`, elk met een reden:
134 bouwen hun paden op uit een sjabloon of een optelling, 3 noemen een stam.
Die schermen staan wél in het register — dat is de helft van zijn waarde — maar
ze mogen niet als dekking tellen. Anders stijgt de gedragsteller doordat er een
meter bij komt die over een derde van zijn onderwerp zwijgt.

Een register mag daarom nu `zonderUitspraak` declareren, en `CODEWERELD.json`
trekt die bestanden af. Zonder die aftrek stond `public/` op 26,1%; met de
aftrek op <!--getal:codewereld.bronPublicPct-->21<!--/getal-->%. Dat verschil van vijf punten is precies het deel waarover
niemand iets weet, en het hoort niet aan onze kant van de streep.

### 0.6 De runtime-meting — en waarom zij mijn eigen voorspelling omkeerde
*(3 september 2026)*

Na §0.4 stond hier dat de toen 20.961 statisch onherleidbare
contextobject-aanroepen "een runtime-meting worden of niets". Die meting staat er
nu, en zij zegt iets anders dan verwacht.

`server/opzet/contextspoor.js` hangt in de **domeingrens-Proxy** — het enige punt
waar elke toegang tot het contextobject langskomt — en noteert welke kernnaam
door welk verzoek wordt opgehaald, met de route uit de async-context van
`opzet/handeling.js`. `scripts/contextproef.js` (`npm run contextproef`) zet een
wegwerpserver op met die stand aan, rijdt elke route één keer en legt het vast in
`CONTEXTPROEF.json`.

| | |
|---|---|
| routes gereden | <!--getal:context.gereden-->4769<!--/getal--> |
| daarvan aan het werk (geen 401/404/405) | <!--getal:context.aanHetWerk-->3214<!--/getal--> |
| **reikt tijdens het verzoek naar de kern** | **<!--getal:context.metSpoor-->213<!--/getal-->** |
| doet werk zonder dat te doen | <!--getal:context.zonderSpoor-->3075<!--/getal--> |
| losse kernnamen tijdens een verzoek | <!--getal:context.namen-->78<!--/getal--> |
| kernnamen opgehaald bij het **bedraden** | <!--getal:context.bedrading-->2222<!--/getal--> |

**Van de routes die werkelijk werk deden, reikt 6,6% tijdens het verzoek naar het
contextobject.** De rest niet — en dat is geen tekort van de proef maar het
antwoord: een module doet één keer `const { app, auth, save } = kern` bij het
ophangen, en werkt daarna met gewone variabelen. Vandaar 2222 namen bij de
bedrading tegenover 78 tijdens een verzoek.

Wat dat betekent voor het gat uit §0.4: die onherleidbare aanroepen zijn
**geen runtime-raadsel**. Het zijn aanroepen op namen die één keer, bij het
bedraden, uit de zak zijn gehaald — statisch zichtbaar, alleen niet met de
resolver zoals die nu werkt. De vraag verschuift daarmee van *"wat gebeurt er
tijdens een verzoek"* naar *"welke module heeft `kern.save` erin gezet"*, en dat
is een andere en waarschijnlijk goedkopere klus dan een runtime-meting.

Ik had dat andersom voorspeld. De meting is er niet voor niets: zonder haar was
de volgende stap een dure runtime-infrastructuur geweest voor een probleem dat
grotendeels statisch is.

**Wat de proef wél ziet en niets anders kan zien** is de late binding: 213 routes
die pas tijdens het verzoek een naam ophalen — `bank.bankLedenAan` (24 routes),
`geld.geldbeleid` (11), `kantoren.hardware` (11). Precies de plekken waar
`routes/supplier/genrepuls.js` in zijn eigen kop over schrijft: *"de motoren
hangen pas NA deze routes aan de kern, dus we pakken ze op aanroepmoment via hun
kern-sleutel"*. Die tak is met geen enkele statische lezer te volgen.

#### Twee garanties in een heet pad

De haak zit in de Proxy waar élke kerntoegang langskomt. `test/contextspoor.test.js`
houdt daarom twee dingen vast, en allebei zijn ze zien zakken op een mutatie:
de stand staat **uit** zonder de vlag (geen bestand, geen geheugen), en met de
vlag aan weigert de grens **precies hetzelfde**. Die tweede is de scherpste: de
haak zit vlak vóór de regel die weigert, dus een meetronde die stilletjes een
grensovertreding doorlaat is één regel verschil.

Nog twee dingen die het bouwen opleverde:

- **Wegschrijven mag niet op afsluiten leunen.** `scripts/lib/wegwerpserver.js`
  ruimt zijn server op met `SIGKILL`, en dat sein is niet af te vangen: de eerste
  ronde verloor haar hele spoor zonder één foutmelding. Het spoor schrijft nu
  tijdens het draaien, hooguit eens per 750 ms.
- **De proef schrijft geen ander register.** De idempotentieproef rijdt dezelfde
  routes en had gratis meegekund — maar dan hangt die meting aan deze, en een
  ronde van de één overschrijft het register van de ander.

### 0.7 Wie heeft `kern.save` erin gezet (3 september 2026)

De runtime-meting van §0.6 wees de weg: het contextobject wordt vooral bij het
**bedraden** gelezen, dus het gat is statisch. `scripts/kernherkomst.js` →
`KERNHERKOMST.json` (`npm run kernherkomst`) beantwoordt de vraag die niemand had
gesteld: welke module legt welke naam in de zak?

<!--getal:kern.namen-->1120<!--/getal--> namen met een herkomst, over <!--getal:kern.vulplekken-->282<!--/getal--> vulplekken, met
<!--getal:kern.onopgelost-->32<!--/getal--> plekken die niet te volgen zijn — elk met een reden, geen daarvan geraden.
Drie vormen vullen de zak:

```
basis        const kern = { app, express, db, save, ... }
toewijzing   kern.zaakBoard = ...
samenvoeging Object.assign(kern, require('../kern/wallet').maakWallet({...}))
```

Die derde is de talrijkste en de enige die werk kost: de namen staan niet op de
aanroepplek maar in wat de fabriek **teruggeeft**. Die wordt gelezen als het
laatste letterlijke `return { … }` op het eigen niveau van die functie — niet in
een geneste functie, want een `return { status: 200 }` in een handler binnenin is
geen uitvoer van de fabriek.

#### Wat het oplevert in de graaf

| | vóór §0.7 | na |
|---|---|---|
| aanroepkanten | 17.596 | <!--getal:graaf.kanten-->22121<!--/getal--> |
| aanroepen herleid | 18,1% | <!--getal:graaf.opgelostPct-->24.3<!--/getal-->% |
| routes met een symbool | 2346 | <!--getal:graaf.routesMetSymbool-->2978<!--/getal--> |
| post `contextobject` | 20.961 | <!--getal:graaf.contextobject-->15798<!--/getal--> |

<!--getal:graaf.viaKern-->4519<!--/getal--> kanten bestaan puur dankzij deze herkomst. Van die kanten wijzen er
<!--getal:graaf.viaKernZonderSymbool-->4045<!--/getal--> alleen het **bestand** aan en niet de functie, en dat is geen slordigheid
maar wat er te weten valt: een fabriek mag `{ walletVoeg: voeg }` teruggeven, en
dan is de zaknaam `walletVoeg` terwijl het symbool `voeg` heet. Een gok naar een
symbool dat er niet is, zou de graaf onbetrouwbaar maken op precies de plek waar
hij nieuw is.

#### Drie vormen van dezelfde zak, en waarom de derde geen heuristiek is

De naam komt op drie manieren bij de code die hem aanroept:

```js
const { save } = kern;                                  // uitgepakt
module.exports = ({ app, save }) => { ... };            // in de parameter
function maakHandelsketen({ db, save }) { ... }         // in een benoemde fabriek
```

Die laatste is de gevaarlijke: een parameter die `save` heet hoeft niet
`kern.save` te zijn. Daarom wordt hij niet op zijn naam herkend maar op zijn
**functie**: `KERNHERKOMST.json` zegt welke fabriek in welk bestand de kern
vult, en alleen de parameters van díé functies gelden als zaknamen. Geen
heuristiek op een woord, een verwijzing uit een register.

Nog niet alles is los: 357 aanroepen van `save` blijven staan, in vormen die dit
register niet aanwijst. Die tellen gewoon door in de post `contextobject` — en
dat is beter dan ze met een aanname te vullen.

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
| Deterministische code-analyse | **staat** — <!--getal:codewereld.registers-->84<!--/getal--> registers, alle uit `scripts/`, geen model |
| Scheiding runtime ↔ bron | **staat**, en afgedwongen (`test/codegrens.test.js`) |
| Ruggengraat op route | **staat** — <!--getal:codewereld.ruggengraatPct-->89.2<!--/getal-->%, gemeten |
| Symboolas | **staat** — `SYMBOLEN.json`, §0.2 |
| Codewereld als één object | **een stap weg** — drie assen, en de brug route→bestand heeft sinds §0.3 twee bronnen |
| Brug scherm → route | **staat** — `SCHERMROUTES.json`, §0.3 |
| Gedrag van een scherm | **staat** — `SCHERMGEDRAG.json`, §0.5 (afgeleid, met de grens erbij) |
| Runtime-meting van het contextobject | **staat** — `CONTEXTPROEF.json`, §0.6 |
| `kern.X` → de module die hem erin zette | **een stap weg** — de echte rest van het contextobject-gat |
| Brug route → symbool | **staat** — `AANROEPGRAAF.json`, §0.4 |
| Aanroepgraaf (wie roept wie) | **staat** — §0.4, met de restbak ingedeeld |
| Impactketen scherm → functie | **staat**, uit registers alleen — §0.4 |
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

### De twee gaten die besluit 2 blokkeerden: dicht

Beide zijn gedicht op 3 september 2026, en de meting staat in §0.3:

1. **De brug route → bestand heeft een tweede bron** (`ROUTEBRON.json`):
   <!--getal:codewereld.brugDekkingPct-->88.6<!--/getal-->% toetsbaar in plaats van 0,7%, met <!--getal:routebron.tegenspraak-->0<!--/getal--> echte tegenspraken.
2. **`public/` heeft gedragsdekking** (`SCHERMROUTES.json`): <!--getal:codewereld.bronPublicPct-->21<!--/getal-->% in plaats
   van 6,6%, en de keten scherm → route bestaat.

### Wat daarmee de eerstvolgende stap is

De aanroepgraaf en de brug route → symbool staan sinds §0.4; de impactketen loopt
van scherm tot functie. Wat de Architect nog steeds tegenhoudt is één ding, en
het is niet de graaf: **over gedrag weet dit huis <!--getal:codewereld.bronGedragPct-->36.9<!--/getal-->%** — structuur
100%, relaties compleet, gedrag een derde. Een Architect die daarop wordt losgelaten,
beantwoordt "waar staat het" en "wat hangt ermee samen" uitstekend en "klopt het"
niet.

Drie stappen, in deze volgorde:

1. ~~**Gedragsdekking van `public/`**~~ — gedaan in §0.5: 6,6% → <!--getal:codewereld.bronPublicPct-->21<!--/getal-->%.
   Wat er nu nog onder zit zijn de <!--getal:schermgedrag.zonderGrond-->137<!--/getal--> schermen die hun paden opbouwen; die
   zijn statisch niet te volgen en vallen onder punt 2.
2. ~~**De <!--getal:graaf.contextobject-->15798<!--/getal--> contextobject-aanroepen via een runtime-meting**~~ — gemeten in
   §0.6, en de uitkomst keert de stap om: maar <!--getal:context.metSpoor-->213<!--/getal--> routes reiken tijdens een
   verzoek naar de kern. De rest haalt zijn namen bij het BEDRADEN op, en dat is
   statisch zichtbaar. Wat overblijft voor runtime is de late binding, en dat is
   klein.
3. ~~**`kern.save` terugvoeren naar de module die hem erin zette**~~ — gedaan in
   §0.7. Het wás goedkoper dan de runtime-weg: <!--getal:kern.namen-->1120<!--/getal--> namen met een herkomst,
   <!--getal:graaf.viaKern-->4519<!--/getal--> nieuwe kanten, en de graaf van 18,1% naar <!--getal:graaf.opgelostPct-->24.3<!--/getal-->%.
4. **Pas dan de Architect**, met een eerlijke opgave van wat hij niet weet.

Wat er ná deze ronde nog ligt, in volgorde van wat het waard is:

- **De gedragsteller staat op <!--getal:codewereld.bronGedragPct-->36.9<!--/getal-->%** en dat is nog steeds het enige getal dat
  telt voor "klopt het". Structuur en relaties zijn compleet; gedrag is een
  derde. Dat lost geen graaf op — daar is meer BEWIJS voor nodig, en
  `VERTROUWEN.json` staat huisbreed op 0 bewezen.
- **De restbak van de aanroepgraaf** is nu <!--getal:graaf.overig-->3071<!--/getal--> aanroepen (2,3%). Dat is klein
  genoeg om met de hand door te lopen, en groot genoeg om er iets in te vinden.
- **De 32 onopgeloste vulplekken** van `KERNHERKOMST.json`: drie spreads en een
  handvol fabrieken zonder letterlijk return-object.

En twee dingen die hier horen te blijven staan, allebei omdat ze iets zeggen over
wat een register waard is:

- De meetronde van §0.3 vond <!--getal:schermroutes.dood-->0<!--/getal--> dode paden, maar begon op 118. Die van §0.4
  vond <!--getal:graaf.doelOnbekend-->0<!--/getal--> onbekende doelen, maar begon op 587. Beide keren zat de fout in
  de meter en niet in de code. Wie een Architect bouwt op een register dat zijn
  eigen zekerheid niet kent, bouwt een machine die 705 fouten met overtuiging
  voorleest.
- Twee keer op rij sprong een dekkingsgetal omhoog zonder dat er iets bij kwam,
  doordat een index alles noemt. Een dekkingspercentage is pas een meting als
  vaststaat wat er NIET onder valt.
