# Keuring — de keten die zichzelf toetst, en de bodem onder versmalling

`LAT.md` gaat over de code, `NORM.md` over de meters, `ONDERHOUD.md` over de
grond die zonder commit verschuift. Dit document gaat over de machine die dat
allemaal draait: de keuringsketen zelf.

De hoofdregel staat vooraan, want alles hieronder volgt eruit:

> **Volledige dekking is de uitgangstoestand. Versmalling is geen optimalisatie
> die achteraf bewezen wordt — het is een recht dat per effect verdiend moet
> worden.**

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
a11y-ronde (958 tegenover 518). De verdeling in `scripts/lib/delen.js` is om en
om over de ALFABETISCHE lijst — die spreidt naamburen, maar weet niets van duur.

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

## 4. Wat er nu staat, en wat nadrukkelijk niet

**Staat.** Het CI-contract met zijn vier regels; de browserinstallatie uit de
lockfile met een tijd per fase (`scripts/browserinstall.js`); de keuringen
losgeknipt van de scherven (job `keuringen`, `test` wacht er nog wel op en
wordt overgeslagen als hij zakt — fail-closed); één runtime uit `.nvmrc`; de
testidentiteit als runtime-context; het attributieregister met drie standen.

**Staat niet, en dat is een besluit en geen gat.** Er is geen impactgraaf, geen
risicoclassificatie, geen planner, geen resultaatcache en geen dynamische
verdeling. De volgorde waarin ze mogen komen:

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
5. pas daarna lanes, dynamische verdeling en handhaving voor lage risico's
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
