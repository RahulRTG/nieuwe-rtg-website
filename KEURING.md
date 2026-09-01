# Keuring — de keten die zichzelf toetst, en de bodem onder versmalling

`LAT.md` gaat over de code, `NORM.md` over de meters, `ONDERHOUD.md` over de
grond die zonder commit verschuift. Dit document gaat over de machine die dat
allemaal draait: de keuringsketen zelf.

De hoofdregel staat vooraan, want alles hieronder volgt eruit:

> **Volledige dekking is de uitgangstoestand. Versmalling is geen optimalisatie
> die achteraf bewezen wordt — het is een recht dat per effect verdiend moet
> worden.**
>
> Of scherper, als mechanische regel: **zekerheid mag snelheid toestaan;
> onzekerheid mag nooit snelheid afdwingen.** Alles hieronder is daar een
> toepassing van — `ongemeten` draagt een volle ring, een ontbrekend
> duurregister valt terug op de oude verdeling, een onzekere
> afhankelijkheidsverzameling maakt een resultaatcache ongeldig.

Dat is dezelfde zin als in `EXECUTIE.md` ("een scherm, een automatisering, de
commandbalk en een AI-agent leveren allemaal intentie — alleen de execution
plane veroorzaakt effecten"), toegepast op een zesde ingang: een commit is
intentie, en rekenwerk is een effect.

## 1. Wat er gemeten is, en waarom de uitslag een alarm was

Op 31 augustus 2026 is de keten doorgemeten op een groene ronde van de
hoofdlijn (run `33404735353`, 29 minuten, 29 jobs, 171 runnerminuten).

Het kritieke pad liep over drie jobs:

| | duur |
|---|---|
| Toetsscherf 1 (traagste van vier) | 1336 s |
| Tests, checks en build (wachtte op alle scherven) | 379 s |
| Waargenomen endpoint-dekking | 32 s |

De vier scherven deden samen 2962 seconden, dus een gelijke verdeling is
~740 s per scherf. De traagste stond op 1,8× dat getal, en hij bepaalde de
klok. Dezelfde scheefheid in de schermtoetsen (1037 tegenover 552) en in de
a11y-ronde (958 tegenover 518). De verdeling in `scripts/lib/delen.js` was om en
om over de ALFABETISCHE lijst — die spreidt naamburen, maar weet niets van duur.

**En hij verschuift.** Bij een verdeling op volgorde schuift elk bestand na een
nieuwe toets een deel op. Toen er op deze tak één toetsbestand bijkwam
(`attributie.test.js`, positie 60), verhuisden 299 van de 314 bestanden van deel
2 — en daarmee de zware staart van scherf 1 naar scherf 2. Run `33454187817`
gaf 419 / **1122** / 626 / 549: dezelfde scheefheid, andere scherf, niemand die
het zag aankomen. Sinds 1 september 2026 weegt de verdeling daarom op de gemeten
duur uit `TOETSDUUR.json` (zwaarste eerst, naar het lichtste deel), met één
harde eis: een bestand dat niet in het register staat krijgt het **zwaarste
bekende gewicht** en wordt nooit overgeslagen. Nul of het gemiddelde gokken zou
de keten sneller laten lijken dan hij is; onbekend telt hier als duur, en dat is
de hoofdregel hierboven in één regel code. Waar de meting vandaan komt staat in
par. 3.

**Dit was er al een keer, en het is bij een verhuizing blijven liggen.**
`scripts/scherf.js` verdeelde op precies deze manier en stond tot 28 augustus
2026 in `ci.yml`; commit `618cfea8` verving hem door `npm run test:deel`, dat de
CI-weg gelijktrok met wat een ontwikkelaar lokaal draait. Bij die verhuizing
ging de weging verloren — de verdeling viel terug op alfabetische volgorde — en
het script bleef met zijn eigen register (`SUITEDUUR.json`) als dode tak achter.
Beide zijn op 1 september 2026 opgeruimd; de weging staat nu in
`scripts/lib/delen.js`, de plek die `test-runner.js`, `e2e.js` én `a11y.js` al
deelden. Twee verdelers met elk een eigen duurregister is `LAT.md` regel 4 op de
plek waar hij het duurst is.

### De impactgraaf versmalt te goed om waar te zijn

De aantrekkelijke gedachte is: laat een commit eerst classificeren en draai
alleen wat hij raakt. Het fundament daarvoor bestaat al — `scripts/lib/
werkelijkheid.js` levert de require-kanten, en `BEDRADING.json` telt er 3730
opgelost, 3 benaderd en 2 onbekend, met een eis van nul onbekend voor identity,
money en security.

De omgekeerde graaf is uitgerekend over 5899 bestanden en 1434 toetsbestanden
(`npm run impactbereik`, zodat dit getal na te rekenen is en niet in dit
document blijft hangen):

| gewijzigd bestand | transitief geraakte toetsen |
|---|---|
| `kern/stuur/resolver.js` | 7 (0,5%) |
| `kern/pay/poort.js` | 6 (0,4%) |
| `kern/passen.js` | 2 (0,1%) |
| `kern/fiscaal/tarief.js` | 40 (2,8%) |

Zes toetsen voor de plek waar élke betaling langskomt is geen versmalling maar
een blinde vlek. Nagemeten:

- **819 van de 1434 toetsbestanden (57,1%) hebben geen enkele require-kant naar
  `server/`.**
- **905 starten de server als apart proces**, 863 praten over HTTP.

Die meerderheid raakt de hele oppervlakte via een `spawn`, en een require-graaf
ziet daar niets van. Een planner op deze graaf zou ze overslaan en groen
melden — "de stilste vorm van kapot die dit huis kent" (`scripts/lib/
bedrading.js`). Vandaar de volgorde: **eerst dekking, dan versmalling**, precies
de les van de resolver in `EXECUTIE.md`, waar het succescriterium dekking was
en niet compactheid.

## 2. Het CI-contract: vier regels, alle vier uit een vondst

De toetsen bewaken het product; niets bewaakte het systeem dat ze draait.
`scripts/ci-keten.js` doet dat nu, en draait in de job `keuringen`.

| regel | wat er stond |
|---|---|
| elke checkout zonder achtergelaten credential | 21 checkouts lieten een GITHUB_TOKEN in `.git/config` staan terwijl 1058 toetsbestanden en de scripts van elke dependency in diezelfde job draaiden |
| de runtime wordt gedeclareerd, niet overgetypt | negen jobs op node 26, vijf op node 22 — geen matrix, geen besluit; de schermtoetsen draaiden op een andere versie dan productie (`node:26-slim`) |
| niets wordt geïnstalleerd buiten de lockfile om | acht jobs deden `npm i --no-save playwright@^1.49.0` ná `npm ci`, dus zonder integriteitscontrole en op een bereik dat niet meer klopte met de gepinde 1.62.1 |
| elke externe Action op een commit-SHA | de oorspronkelijke regel van dat bestand |

`test/ci-keten.test.js` voert per regel de mutatie uit die hem moet laten
zakken. Een keuring waarvan niemand de rode kant heeft gezien is geen keuring.

## 3. De attributie, en de stand die het belangrijkst is

`RTG_TOETS` bestond al, maar werd op één plek gezet: `test/helper.js`, bij het
starten van een kindserver. Dat dekt 868 van de 1433 toetsbestanden; de rest
schreef zijn sporen weg als `onbekend`. `test/toetsnaam.js` verplaatst dat naar
de UITVOERING van een toets — voorgeladen in elk toetsproces, waarna elk
kindproces de naam via de omgeving erft, welke helper hem ook start.

`scripts/attributie.js` maakt er een register van, met drie standen:

```
waargenomen   deze toets heeft kanten op zijn naam
deels         er is gedrag gezien, maar zonder eigenaar (`onbekend`)
ongemeten     deze toets kwam in geen enkel journaal voor
```

**`ongemeten` is met opzet geen synoniem van "raakt niets aan".** Een toets die
volledig in het proces draait raakt geen route en hoort hier gewoon als
ongemeten te staan. Beide betekenen: hierover is niets bewezen. Daarom draagt
elke toets die niet `waargenomen` is `volleRing: true`, en staat de
veiligheidsrichting in de UITVOER in plaats van in een later hoofd.

De meter blokkeert niets. Hij zou vandaag 1432 van de 1433 toetsen weigeren, en
een poort die alles weigert is geen poort.

Wat hij níét meet staat er even groot bij: welke BRONBESTANDEN een toets raakt.
Node schrijft lcov per groep en niet per toetsbestand, dus die as staat in het
register als `nietGemeten` met de reden — niet als nul.

Diezelfde voorlading levert de tweede meting: **hoe lang elk toetsbestand
erover deed** (`TOETSDUUR.json`, geschreven door `scripts/toetsduur.js`). Dat is
het gewicht onder de scherfverdeling hierboven, en het is nergens anders te
halen: `node --test` draait een hele groep in één aanroep en zijn TAP-uitvoer
noemt het bestand niet. Hier is het gratis — dit proces ís het toetsbestand.
Het register wordt in CI samengesteld en als artefact klaargezet; **een mens
commit hem**, want hij stuurt de bouw en hoort dus in de historie te veranderen
en niet onderweg.

*Waarom niet gewoon uit de Actions-cache?* Dat zou de menselijke stap besparen,
en voor een planningsgetal klinkt dat redelijk. Het antwoord staat in de kop van
het opgeruimde `scherf.js`, en het is de reden dat het register in git hoort:
**de verdeling is deterministisch — zelfde invoer, zelfde uitkomst.** Zou de
weging uit een cache komen, dan kan een herhaalde ronde op dezelfde commit een
ander bestand op een andere scherf zetten, "en dan is *die scherf zakte* geen
bruikbare aanwijzing meer". Een cache maakt de verdeling sneller actueel en de
diagnose onbruikbaar; dat is de verkeerde ruil.

Eén ding is daarbij stil fout gegaan en staat daarom uitgeschreven in
`test/toetsnaam.js`: `node --test a.js b.js` maakt drie soorten processen die er
van binnen bijna hetzelfde uitzien, en de eerste versie liet de **regelaar**
zichzelf de naam van het eerste bestand geven. Omdat de kinderen zijn omgeving
erven, meldde het kind dat `b.js` draaide zich als `a.js` — een hele scherf
sporen op naam van het verkeerde bestand, en het attributieregister zou dat als
*gemeten* hebben opgeschreven. `NODE_TEST_CONTEXT` scheidt de drie.

## 3b. Het gewichtregister, en waarom het een driftcontract heeft

Op 1 september 2026 draaide deze keten een verdeling die op haar eigen projectie
**1,00x** scoorde en in werkelijkheid **1348s tegen 526s** uitliep. Er was niets
rood, en er was ook niets te zien.

De oorzaak was niet de verdeler. `TOETSDUUR.json` was lokaal gemeten — zonder
dekking, op vier kernen, node v22 — en de keten draait op runners **mét**
dekking. De verdeler optimaliseerde correct op een fout kostenmodel, en dat ziet
er van binnen perfect uit. Het register droeg dat feit gewoon in zijn stempel
(`waar: lokaal`); niemand las het. **Een signaal dat niemand leest is geen
signaal.**

Hoe groot dat verschil is, gemeten op het zwaarste bestand: `ast-grens.test.js`
doet **430s zonder dekking** en was **met dekking na vijfentwintig minuten nog
niet klaar**. Dat is geen uitschieter maar een ander kostenmodel — en daarmee is
één universeel gewicht principieel verkeerd. Het register houdt de modi daarom
apart (`normaal`, `dekking`), en gewichten waarvan de modus niet meer te
achterhalen is heten `onbekend` en worden nooit bij een van de twee opgeteld.

### De drie maten, en waarom ze niet hetzelfde zeggen

| maat | wat hij zegt |
|---|---|
| totale kosten | de suite als geheel duurder — een andere machine schaalt alles mee |
| max bestand | het ergste losse verschil; dít had `ast-grens` gevangen |
| **projectiefout** | verdeel met de oude gewichten, weeg met de nieuwe |

Alleen de derde vertaalt drift naar wachttijd. Een register kan er per bestand
flink naast zitten en toch prima verdelen (als alles meeschaalt), en het kan er
gemiddeld dichtbij zitten en toch een scherf laten uitlopen (als juist het
zwaarste bestand verschoof). En hij kijkt naar de **traagste** scherf en niet
naar het gemiddelde: het gemiddelde van de lasten ís het ideaal, dus die maat
zou per definitie nul zijn en eeuwig ACTUEEL melden.

### Drie banden, met een gevolg

| status | projectiefout | wat er gebeurt |
|---|---|---|
| ACTUEEL | < 10% | melden, verder niets |
| VEROUDERD | < 25% | CI stelt een nieuw register voor, als PR |
| ONGELDIG | ≥ 25%, andere modus, of geen meting | de gewogen verdeling is geen bewijs meer |

Dat laatste heeft een gevolg in de code en niet alleen op een scherm.
`scripts/lib/delen.js` draagt een **vertrouwen**: bij `twijfelachtig` weegt hij
nog steeds, maar met een marge — geen scherf krijgt meer bestanden dan zijn
deel. Die marge is met opzet een **telling en geen tijd**: als de gewichten
verdacht zijn, is het enige dat je nog zeker weet hoeveel bestanden er zijn. De
schade van een fout gewicht is daarmee begrensd in plaats van onbeperkt.

### Wanneer een gewicht zonder modus mag verdwijnen

`onbekend` is de bak voor metingen van vóór de modi: echt gemeten, maar niemand
weet meer onder welke omstandigheden. Hij is nuttig zolang hij de enige is die
een bestand kent — de terugval leunt erop — en hij hoort niet eeuwig te groeien
naast modi die datzelfde bestand wél gelabeld kennen.

De regel is bewust streng: **een gewicht gaat pas weg als élke gedeclareerde
modus dat bestand kent.** Dan bestaat er voor elke vraag een gelabeld antwoord
en kan `onbekend` per definitie niet meer nodig zijn.

Waarom niet soepeler — "weg zodra `dekking` het kent"? Omdat niemand weet wát
`onbekend` heeft gemeten. Voor een ronde zonder dekking is een onbekende meting
waarschijnlijk een betere schatting dan een dekkingsmeting, die er drie keer
naast kan zitten. Een gewicht weggooien op grond van een aanname over zijn
herkomst is precies de fout die dit register wegneemt.

Hij ruimt dus vanzelf op zodra beide modi vol zijn, en tot die tijd doet hij
niets. **Een opruiming die iemand op het juiste moment moet aanzetten is geen
opruiming** — dat is hoe het register maandenlang lokaal bleef.

### Appels met peren, ook binnen een modus

De modi voorkomen dat een dekkingsmeting en een gewone meting op een hoop
komen. Er blijft een tweede vorm over, en die zit *binnen* een modus: een
register bewaart het gewicht van een bestand dat deze ronde niet draaide — met
opzet, want een scherf mag de andere drie kwarten niet wissen — en zo'n gewicht
houdt zijn oude bron. Een meting van een andere runner, een andere node, soms
een andere machine.

Dat staat per bestand vast (`spreiding.bronnen`), maar zolang niemand het optelt
ziet niemand het. `gewichtdrift.js` telt daarom hoeveel gewichten **niet** van
de nieuwste bron komen. Op het eerste CI-gemeten register:

| modus | van een andere bron |
|---|---|
| `dekking` | 0 van 1259 |
| `onbekend` | 1257 van 1434 |

Die meter verandert met opzet de **status niet**. Een oude bron is geen bewijs
dat het gewicht fout is; hij is een reden om het te weten. Wie hier een grens op
zet, laat een register zakken omdat een toets een ronde niet meedraaide.

En hij neemt de nieuwste bron uit de **jongste meting**, niet uit de grootste
hoop. Dat is de faalvorm die hem anders nutteloos maakt: bij een register vol
oude gewichten wint de oude bron op aantal, heet die "de nieuwste", en meldt de
meter bijna niets vreemds — precies wanneer er het meeste vreemd is.

### CI meet, CI stelt voor, een mens merget

Het register staat in git omdat de verdeling deterministisch hoort te zijn; een
register dat zichzelf in CI bijwerkt verschuift het kritieke pad zonder dat
iemand het in de historie ziet. Dat blijft staan. Wat erbij komt is dat het
voorstel er ook echt kómt: `scripts/gewichtvoorstel.js` opent bij materiële
drift een PR met de nieuwe meting. Boven de oude stap stond al *"een mens commit
hem"* — en sinds die stap bestaat heeft niemand dat gedaan. **Een mens doet het
is geen mechanisme als niemand het onder ogen krijgt.**

Het voorstel schrijft nooit naar main, opent nooit een tweede PR, en laat de
bouw nooit zakken: een mislukt voorstel is geen kapotte keten.

### Wat hier bewust niet staat

Geen poort op traagheid. Een toets die trager wordt is hier geen fout maar een
ander gewicht; daarvoor is `NORM.json`. `gewichtdrift.js` zakt alleen als je hem
dat expliciet vraagt (`--poort`), en dan uitsluitend op ONGELDIG — want dat is
geen trage toets maar een register dat niet over deze keten gaat.

En de **26% winst** die eerder in deze tak is opgeschreven, is geschrapt. Niet
omdat de verdeler slecht was, maar omdat de meting geen geldige weergave van de
uitvoeromgeving was. Wat er over de scherfwinst komt te staan, wordt gemeten op
echte CI-wall-clock of het staat er niet.

## 4. Wat er nu staat, en wat nadrukkelijk niet

**Staat.** Het CI-contract met zijn vier regels; de browserinstallatie uit de
lockfile met een tijd per fase (`scripts/browserinstall.js`); de keuringen
losgeknipt van de scherven (job `keuringen`, `test` wacht er nog wel op en
wordt overgeslagen als hij zakt — fail-closed); één runtime uit `.nvmrc`; de
testidentiteit als runtime-context; het attributieregister met drie standen; en
de scherfverdeling die op gemeten duur weegt in plaats van op alfabet.

Dat laatste is inmiddels gevuld en doorgerekend. Over de 1247 bestanden die de
scherven werkelijk draaien (niet-geïsoleerd, zonder de ijkingen):

| | scherf 1 / 2 / 3 / 4 | traagste |
|---|---|---|
| om en om (op volgorde) | 1578 / **2586** / 1735 / 1755 s | 2586 s |
| gewogen (op duur) | 1913 / 1913 / 1913 / 1913 s | **1913 s** |

**673 seconden van het kritieke pad, 26%** — en vier keer exact het ideaal in
plaats van één scherf op 1,35×. Het register is lokaal gemeten (zie zijn
`stempel`); de absolute getallen van een runner liggen anders, de verhoudingen
niet, en alleen die tellen voor de verdeling.

De 177 schermtoetsen (`*.e2e.js`) staan er nog niet in: `npm test` draait ze
niet. Ze zijn dus ongemeten, krijgen het zwaarste gewicht en worden om en om
verdeeld — precies zoals vroeger. De schermscherven winnen hier dus nog niets;
dat komt met de eerstvolgende ronde die hun meting meeschrijft.

**Staat niet, en dat is een besluit en geen gat.** Er is geen impactgraaf, geen
risicoclassificatie, geen planner en geen resultaatcache. De volgorde waarin ze
mogen komen:

1. attributie over een volle ronde (de bodem — nu meetbaar, nog niet gemeten)
2. de graaf als `bekend = statische kanten ∪ waargenomen kanten`, met de
   onzekerheid ERNAAST en niet erin: onopgeloste statische kanten,
   ongeattribueerde toetsen en niet-waargenomen uitvoeringsklassen zijn geen
   afwezige kanten
3. de planner in de schaduw, met drie onafhankelijke meters — een gezakte
   relevante toets die niet gepland was (moet nul zijn), de recall over
   waargenomen kanten, en het aandeel beslissingen dat niet volledig te
   verklaren viel. Alleen op de eerste sturen is onbruikbaar: gezakte toetsen
   zijn schaars, en maandenlang nul kan bij een structureel verkeerde selectie
   horen
4. historische replay: elke volle ronde bewaart commit, uitgevoerde toetsen,
   waargenomen kanten, plannerselectie en uitslagen, zodat een nieuwe
   plannerversie op honderden oude commits kan worden losgelaten in plaats van
   op de volgende tweehonderd te wachten
5. pas daarna lanes en handhaving voor lage risico's
6. en als sluitstuk de resultaatcache — nooit eerder. Een cache op "de hash van
   de bronnen waarvan deze toets afhangt" is alleen geldig als die verzameling
   compleet is; op een graaf met een blinde vlek verandert hij die vlek in een
   permanente PASS

## 5. Geen enkel samengesteld eindoordeel

De verleiding aan het eind van deze weg is één stempel boven de scorecard —
`PROVEN`. Dat is precies wat `LAT.md` regel 11 en keuringsregel 48 verbieden, en
waarvoor `scripts/zekerheid.js` bestaat: losse eerlijke getallen geven samen een
gevaarlijk gevoel. Een keuringsrapport toont daarom wat door welk getal gedragen
wordt — attributie, veranderingsdekking, de statische graaf, de schaduwmeters en
of handhaving aan of uit staat — en nooit één woord eronder.

Van die getallen is er één dat werkelijk telt: het aantal beslissingen dat
`onbekend` is. Zolang dat niet nul kan worden, is de rest decoratie.

## 6. Wat hierna mag komen — en wat de meting daarover zegt

Er ligt een uitgewerkt eindmodel: een delta-motor die afgeleide toestand
bijwerkt in plaats van herberekent, content-addressable uitvoering, selectie op
bewijsverplichting in plaats van op testbestand, een snelle voorcontrole vóór
GitHub Actions, en warme werkers. Vier van die voorstellen zijn hier gemeten
voordat er iets aan gebouwd wordt, met deze uitkomst:

**De incrementele motor levert vandaag niets.** De volledige graaf over 5899
bestanden staat in **1,8 seconden** (`scripts/lib/werkelijkheid.js`, koud, op
één kern). Een job kost alleen al 13 seconden aan checkout en `setup-node`
voordat er één regel code draait. Incrementeel herberekenen bespaart dus
hooguit 1,8 s tegen een grote hoeveelheid nieuwe toestand die zelf fout kan
staan — precies de vorm van complexiteit die dit document elders afwijst. Hij
wordt pas interessant als de graaf ordes van grootte trager wordt.

**Selectie op bewijsverplichting is het juiste eindmodel en de verkeerde
volgende stap.** Het register bestaat al: `WETTEN.json` draagt 46 wetten, elk
met een bron, met handhavers (29 wijzen naar `test/`) en 43 met een
sabotage-recept — de enige manier waarop een verplichting zich laat natrekken.
Maar omgekeerd gelezen dekt dat register **76 van de 5899 bestanden**:
`kern/pay/poort.js` raakt één wet, `kern/stuur/resolver.js` en `kern/passen.js`
raken er nul. Een selector op verplichtingen zou vandaag over vrijwel elke
wijziging zeggen dat er niets te bewijzen valt, en dat is de gevaarlijkste
uitkomst die deze laag kent.

**Een voorcontrole onder de 20 seconden kan niet op GitHub-hosted runners.** De
vaste kost is 7 s checkout + 6 s `setup-node` (+ 21 s als de job containers
draait), plus wachttijd in de rij — gemeten in run `33454187817`, waar jobs
tussen +2 s en +52 s begonnen. Een snelle baan is haalbaar op ongeveer een
minuut; alles daaronder vraagt eerst warme werkers, en dat is een
infrastructuurbesluit (eigen runners) en geen codebesluit.

**Agressief annuleren staat er al.** De concurrency-groep met
`cancel-in-progress: true` doet precies wat het voorstel vraagt: run
`33452968389` werd afgebroken toen `33454187817` op dezelfde tak startte. Wat
er niet is, is het annuleren van zware banen zodra een goedkope poort al rood
staat — dat is wel een echte toevoeging.

Wat daarmee overblijft als eerstvolgende bouwstap is de **dubbele planner**:
statische graaf ∪ waargenomen attributie, met een derde bron (historische
mede-falers) als hij er is, en de regel dat oneensheid tussen de bronnen de
onzekerheid verhoogt en dus de suite verbreedt. Dat is geen extra laag maar de
directe voortzetting van par. 1 en 3, en het is de enige constructie die de
blinde vlek van 57% structureel onschadelijk maakt in plaats van hem te
omzeilen.
