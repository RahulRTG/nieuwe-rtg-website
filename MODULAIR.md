# RTG modulair — technisch groot, gelanceerd klein

Dit document gaat over één belofte, en het bestaat omdat die belofte tot 2
september 2026 niet na te rekenen was:

> **RTG kan technisch groot zijn terwijl elk gelanceerd product aantoonbaar klein
> blijft.**

Niet "we hebben feature flags". Feature flags heeft dit huis al jaren, en goede:
`server/functies/toegang.js` schakelt per functie op zes assen (globaal, pas,
land, plaats, persoon, genre) plus een canary die zegt vóór hoeveel mensen iets
open gaat. Wat ontbrak is het antwoord op de vraag daarachter: **als ik dit
uitzet, staat het dan ook uit — en als ik dit aanzet, wat wordt er dan wakker?**

Vijf registers beantwoorden die vraag, elk met een eigen meter, een eigen ratel
in `NORM.json` en een eigen toets. Ze zijn er in deze volgorde gekomen, en die
volgorde is de inhoud: eerst meten wat er is, dan pas een laag verzinnen.
Dezelfde volgorde als bij `OBJECTMODEL.json` (waar `Asset` sneuvelde) en
`SEMANTIEK.json` (waar `VERMOGENS` sneuvelde).

## 1. De verstrengeling — wie kan wie wakker maken

`npm run verstrengeling` → `VERSTRENGELING.json`

<!--getal:verstrengeling.randen-->1644<!--/getal--> randen tussen de knopen van dit huis, waarvan er
<!--getal:verstrengeling.onverklaard-->111<!--/getal--> **onverklaard** zijn. Dat laatste getal moet naar nul,
en het aantal randen niet: een huis waarin domeinen elkaar nooit nodig hebben,
is geen huis maar een map met losse programma's.

**Een knoop is laag + domein, nooit domein alleen.** De eerste ronde meldde
`supplier -> horeca` (37 randen) als zwaarste verstrengeling, terwijl dat
`routes/supplier` is dat `kern/horeca` aanroept — een ingang die zijn eigen
domein gebruikt. Wie de laag weglaat, gaat spaghetti opruimen die niet bestaat.

Drie soorten leidt de meter af (laagrand, eigen data, gemeten primitief); de
rest is een menselijk oordeel en komt uit `scripts/lib/verstrengeling-verklaringen.js`
of heet `ONBEKEND`. **`GEDEELDE_PRIMITIEF` is een meting en geen promotie tot
kern** — `SEMANTIEK.json` laat zien dat hetzelfde woord op drie plekken nog geen
gedeelde betekenis is.

Omgekeerd staat er wat er breekt als iets er niet is:
<!--getal:verstrengeling.uitneembaar-->64<!--/getal--> van de <!--getal:verstrengeling.domeinen-->544<!--/getal--> domeinen sleept géén ander
domein mee. Bovenaan de andere kant staat `eigencollectie` met 246: dat is geen
domein meer maar een verborgen kern, en dat is een besluit (noem het kern) of
werk (breng de koppelingen terug).

## 2. De activering — wat wordt er wakker

`npm run activering` → `ACTIVERING.json`

Per functie uit de catalogus: welke routes, welke bestanden, welke domeinen.
<!--getal:activering.functies-->204<!--/getal--> functies dragen routes; een doorsnee functie raakt
<!--getal:activering.mediaan-->18<!--/getal--> knopen.

**Drie graden, en ze zijn niet uitwisselbaar.** <!--getal:activering.gemeten-->31<!--/getal--> functies
zijn `gemeten`; <!--getal:activering.ondergrens-->166<!--/getal--> zijn `ondergrens` (er hangt méér aan dan
hier staat) en zeven zijn `deels-niet-toe-te-rekenen` (hun route hangt in de
bedrading, en de sluiting vanaf `server.js` is het hele huis).

Drie ronden gaven drie verschillende getallen en alle drie de keren was de vorige
fout — de fouten staan uitgeschreven in de kop van `scripts/activering.js`. De
belangrijkste: **de require-graaf ziet de hoofdbedrading van dit huis niet.** De
meeste route-bestanden hebben nul requires en krijgen hun domein via de kern-tas
(`module.exports = (kern) => { const { gewoontenVan } = kern; }`). Daarom wordt
bij het opstarten vastgelegd welk bestand welke sleutel levert.

## 3. De deltapoort — er komt niets bij

`npm run delta`

De onverklaarde randen hoeven niet weg om ergens aan te mogen werken; er mag
alleen niets bijkomen. Een nieuw bestand staat op de norm (nul), een aangeraakt
bestand mag zijn erfenis houden maar niet vergroten. De uitweg is niet "haal de
rand weg" maar **"verklaar hem"**, met een reden die klopt.

Dat hoort in de deltapoort en niet in de keuring, want de som over het huis
verrekent: een rand weg in het ene domein betaalt een nieuwe in het andere.

## 4. De tredeproef — kan een trede zelfstandig bestaan

`npm run tredeproef:alle` → `TREDEPROEF.json`

De zeven treden van `LAUNCH.md` staan machineleesbaar in
`server/functies/register` (`FASES`). De proef zet er één aan, de rest uit, en
kijkt of er dan werkelijk niets anders openstaat. Op trede 0: <!--getal:trede.inTrede-->331<!--/getal-->
van de <!--getal:trede.routes-->4738<!--/getal--> API-routes open, en <!--getal:trede.lekken-->0<!--/getal--> lekken.

| trede | functies | routes open | zuiver | beproefd |
|---|---|---|---|---|
| 0 · De smalle snee | 19/204 | 331 | 0 | 0 |
| 1 · Leden onder elkaar | 26/204 | 544 | 0 | 0 |
| 2 · De partners erbij | 29/204 | 1407 | 0 | 0 |
| 3 · De vloer draait | 33/204 | 1445 | 0 | 0 |
| 4 · Het fundament | 37/204 | 1474 | 0 | 0 |
| 5 · De stad | 54/204 | 2010 | 0 | 0 |
| 6 · Alles open | 204/204 | 4651 | 0 | 0 |

**Twee uitslagen die nooit worden opgeteld.** *Zuiver* vraagt de beslissing zelf
over álle routes: compleet, en het bewijst de bedrading niet. *Beproefd* klopt
echt aan over HTTP: dat bewijst de bedrading en kan niet compleet zijn. De eerste
ronde liet zien waarom dat verschil bestaat — de zuivere kant zei dat
`/api/betaal/webhook` dicht was en de webhook antwoordde 200. Die staat nu als
verklaarde uitzondering met de reden erbij; een uitzondering die je niet ziet is
een lek.

## 5. De wekkers — wat begint werk zonder dat iemand iets opvraagt

`npm run wekkers` → `WEKKERS.json`

De tredeproef bewijst de HTTP-kant. Daarnaast staat de gevaarlijkste vorm van
"uit": het ziet er dicht uit en het draait. <!--getal:wekkers.totaal-->47<!--/getal--> wekkers
(klokken, busabonnees, webhooks), waarvan er <!--getal:wekkers.onverklaard-->8<!--/getal--> geen enkele
functie raken en niet verklaard zijn.

**De AI is hier geen gat**, en dat is nagekeken: `kern/stuur.js` r.130 roept zijn
paden aan met `fetch('http://127.0.0.1:' + poort + pad)`, dus over echte HTTP en
dus langs dezelfde schakelaars als een mens.

Deze meter **blokkeert niets**. Dat is de volgorde van `CONTROLPLANE.md` en niet
van gemak: je kunt niet afdwingen wat nooit in de schaduw heeft gelopen.

## Wat er bewust NIET staat

- **Geen mapverhuizing.** Een indeling in `kern/ domeinen/ producten/` verplaatst
  2847 bestanden en levert niets op. De grens hoort in een poort, niet in een map.
- **Geen capability-register eroverheen verklaard.** `CAPABILITEIT.json` heeft die
  vraag al gemeten: er is geen capabilitylaag, er zijn er 21. Een nieuw register
  ernaast wordt de 22ste.
- **Geen mensenrondgang in de tredeproef.** Hij bewijst dat er niets anders
  opengaat, niet dat de trede zelf wérkt. Die helft ontbreekt en dat staat in
  zijn eigen uitslag.
- **Geen afdwinging op de wekkers.** Zie hierboven: eerst de schaduw.
- **Geen `default = dicht` in `functieAan()`.** De regel `if (!f) return true`
  staat er nog. Het gat in de vorm is echt, maar het staat vandaag niet open:
  `routesNietSchakelbaar` is nul en van de 97 routes zonder functie verklaart het
  platformregister alle 97 als bediening. Omdraaien is een besluit met een risico
  dat niet uit deze metingen volgt.

## Het einddoel, en waar we staan

Het doel is: RTG Horeca volledig zichtbaar terwijl Mobility, School en Office uit
de runtime verdwijnen, zonder één fout. De HTTP-helft daarvan is bewezen voor
alle zeven treden. Wat nog niet bewezen is: dat de trede zelf werkt (dat vraagt
een echte rondgang), en dat er niets langs een klok of de bus alsnog begint (dat
vraagt de acht onverklaarde wekkers, en daarna een besluit over afdwingen).
