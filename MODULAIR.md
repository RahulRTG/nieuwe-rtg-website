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
<!--getal:verstrengeling.onverklaard-->0<!--/getal--> **onverklaard** zijn. Dat getal moet naar nul, en het
aantal randen niet: een huis waarin domeinen elkaar nooit nodig hebben, is geen
huis maar een map met losse programma's.

**Het staat op nul.** Honderdelf randen zijn met de hand nagelezen -- per stuk de
aanroepregel, met bestand en regelnummer in de reden -- en ingedeeld. Daarmee
verschuift het risico: de gevaarlijkste beweging is nu niet een nieuwe rand maar
een slechte verklaring. "Hoort zo" houdt de meter op nul en meet niets meer.
`test/verstrengeling.test.js` legt de bodem (een soort die bestaat, een reden die
iets uitlegt, geen twee verklaringen voor dezelfde rand); of een reden WAAR is,
blijft mensenwerk, en daarom staat bij elke verklaring waar hij vandaan komt.

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
<!--getal:activering.mediaan-->27<!--/getal--> knopen.

**Drie graden, en ze zijn niet uitwisselbaar.** <!--getal:activering.gemeten-->118<!--/getal--> functies
zijn `gemeten`; <!--getal:activering.ondergrens-->79<!--/getal--> zijn `ondergrens` (er hangt méér aan dan
hier staat) en zeven zijn `deels-niet-toe-te-rekenen` (hun route hangt in de
bedrading, en de sluiting vanaf `server.js` is het hele huis).

Drie ronden gaven drie verschillende getallen en alle drie de keren was de vorige
fout — de fouten staan uitgeschreven in de kop van `scripts/activering.js`. De
belangrijkste: **de require-graaf ziet de hoofdbedrading van dit huis niet.** De
meeste route-bestanden hebben nul requires en krijgen hun domein via de kern-tas
(`module.exports = (kern) => { const { gewoontenVan } = kern; }`). Daarom wordt
bij het opstarten vastgelegd welk bestand welke sleutel levert, in vier slagen:
bij het `require`, via de waarde bij een letterlijk object, achteraf over de tas
zelf (voor `kern.x = ...`), en als laatste door de brontekst van de functie
letterlijk terug te zoeken in `server/`.

Die laatste is met opzet een ZOEKTOCHT en geen aanname. Wat overbleef had je ook
"komt uit de bedrading" kunnen noemen -- dat klopt waarschijnlijk, en het zou 130
functies van `ondergrens` naar `gemeten` tillen zonder dat er iets gemeten is.
Nu telt alleen een UNIEKE treffer; twee treffers of geen is onbekend en blijft
onbekend.

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
van de <!--getal:trede.routes-->4740<!--/getal--> API-routes open, en <!--getal:trede.lekken-->0<!--/getal--> lekken.

| trede | functies | routes open | zuiver | beproefd | rondgang | onvoltooid |
|---|---|---|---|---|---|---|
| 0 · De smalle snee | 19/204 | 331 | 0 | 0 | 0 | 0 |
| 1 · Leden onder elkaar | 26/204 | 544 | 0 | 0 | 0 | 0 |
| 2 · De partners erbij | 30/204 | 1408 | 0 | 0 | 0 | 0 |
| 3 · De vloer draait | 34/204 | 1446 | 0 | 0 | 0 | 0 |
| 4 · Het fundament | 38/204 | 1475 | 0 | 0 | 0 | 0 |
| 5 · De stad | 55/204 | 2011 | 0 | 0 | 0 | 0 |
| 6 · Alles open | 204/204 | 4651 | 0 | 0 | 0 | 0 |

**En een derde uitslag: de rondgang.** Zuiver en beproefd zeggen allebei dat er
niets *anders* opengaat — een trede waarop niemand kan inloggen scoort daar
vlekkeloos. De rondgang loopt daarom een echte ingelogde reis langs wat trede 0
belooft: binnenkomen, zien wat ik mag, mijn gegevens, aanmelden voor een pas, de
leden-app, De Salon. Zes stappen, elk gekoppeld aan de functie van de trede die
hij beproeft, en `test/tredeproef.test.js` zakt zodra een stap een functie noemt
die niet in trede 0 zit. Alle zes slagen, op elke trede.

De rondgang groeit mee met de trede: elke stap noemt zijn functie, en staat die
aan dan hoort de stap te slagen, staat hij uit dan hoort hij 503 te geven. Op
trede 0 is dat een rondgang van zes geslaagde en negen correct geweigerde
stappen; op trede 6 lopen alle vijftien, inclusief de hele wig — **een zaak
vinden, zijn kaart lezen, bestellen en betalen**.

**Een derde uitkomst: onvoltooid** — een stap wiens functie aan staat, maar wiens
voeding op die trede nog dicht zit. Geen zakker (de code mankeert niets) maar een
uitspraak over de **ladder**, apart geteld zodat niemand code gaat repareren die
heel is.

Die uitkomst verdiende zich meteen terug. Op trede 2 t/m 5 stond `bestellen`
open terwijl `ov-suppliers` (`/api/suppliers`, het partneroverzicht) pas op
trede 6 openging: een lid kon op "de vloer draait" geen zaak vínden om bij te
bestellen. De code deed precies wat de fase-lijst zei, en de fase-lijst kwam niet
rond. `ov-suppliers` staat nu in trede 2, waar de partners binnenkomen, en de
kolom staat overal op nul.

**Geld heeft een tweede slot, en dat is niet de schakelkast.** Trede 3 belooft de
complete werkvloer *zonder geld*, afgedwongen met `RTG_BETALEN_UIT=1`. De proef
zet die vlag nu zelf onder trede 4 en kijkt of de betaalstap dan weigert met 503
**én** `code: 'betalingen-uit'` — twee weigeringen met dezelfde statuscode die
iets anders zeggen. Wie alleen naar 503 kijkt, kan die belofte niet nakijken.

Wat de rondgang niet dekt: alles wat een **eigen account** eist (de korte inlog
geeft een pas-sessie zonder account, dus `/api/ik` weigert daar terecht) en alles
wat een **tweede mens** eist — een gesprek, een verbinding, een uitnodiging.
`member-dm` valt daaronder.

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
(klokken, busabonnees, webhooks), waarvan er <!--getal:wekkers.onverklaard-->0<!--/getal--> geen enkele
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
- **Geen kassa en geen bevestiging aan de zaakkant.** De rondgang bestelt en
  betaalt als LID; wat de zaak daarna op de PDA of de kassa ziet, is niet
  beproefd.
- **Geen afdwinging op de wekkers.** Zie hierboven: eerst de schaduw.
- **Geen `default = dicht` in `functieAan()`.** De regel `if (!f) return true`
  staat er nog. Het gat in de vorm is echt, maar het staat vandaag niet open:
  `routesNietSchakelbaar` is nul en van de 97 routes zonder functie verklaart het
  platformregister alle 97 als bediening. Omdraaien is een besluit met een risico
  dat niet uit deze metingen volgt.

## Het einddoel, en waar we staan

Het doel is: RTG Horeca volledig zichtbaar terwijl Mobility, School en Office uit
de runtime verdwijnen, zonder één fout. Voor de HTTP-kant is dat bewezen op alle
zeven treden, in beide richtingen: er gaat niets anders open, én de trede zelf
werkt.

Wat nog niet bewezen is, en dat is de eerlijke rest: elke wekker draagt nu een
functie of een reden, maar er wordt nog niets AFGEDWONGEN buiten HTTP om — die
laag loopt met opzet eerst in de schaduw. En de rondgang stopt bij wat trede 0
belooft: bestellen, betalen en een bevestiging zijn nooit end-to-end beproefd
met de rest van het huis uit.
