# RTG Developer Cloud

> **Bring the idea. RTG provides the rest.**

Dit bestand hoort bij `PLATFORM.md` zoals `APPSTORE.md` dat doet, en het staat
er bewust BOVEN: de App Store is niet het product maar de etalage van iets
groters. `LAT.md` zegt hoe er geschreven wordt, `CLAUDE.md` wat het merk is,
`ARCHITECTUUR.md` waar de dingen nu staan. Dit zegt waar het heen gaat.

**En net als PLATFORM.md zegt het ook wat er vandaag in de weg staat.** Een
richtingsdocument dat alleen de bestemming noemt, is een verlanglijst; dit huis
schrijft ze anders op (LAT-regel 6: een belofte in tekst is een belofte in code).
Alles hieronder staat daarom in vier bakken: **staat**, **een stap weg**, **een
besluit nodig**, en **jaren weg**. Wat in de laatste twee bakken staat, hoort
nergens als knop op een scherm te verschijnen.

---

## 0. De herijking, en waarom die klopt

Wat er tot vandaag stond was "onze App Store". Dat is te klein, en het is de
verkeerde vergelijking: een App Store is een lijst met iconen en een afrekenweg,
en dat is precies het deel dat het minst waard is.

De propositie is de andere kant op:

> Een ontwikkelaar bouwt op RTG in een paar dagen waarvoor hij elders maanden
> nodig heeft, omdat hij auth, billing, compliance, hosting, permissies,
> observability en enterprise-controls niet zelf hoeft te bouwen.

Het aantrekkelijke daaraan is niet dat RTG veel API's heeft. Het is dat het
**economisch dom wordt om dezelfde infrastructuur ergens anders opnieuw te
bouwen**. Dat is een andere zin dan "kom apps bouwen", en hij is alleen waar te
maken als hij ook echt waar IS -- vandaar de bakken hieronder.

---

## 1. Wat er vandaag al staat, gemeten

Dit is geen inschatting. Per punt uit de opzet staat het bestand erbij dat het
doet; wie het niet gelooft, opent het.

| uit de opzet | wat er staat | waar |
|---|---|---|
| **13** secure extension runtime | de **cel**: derdencode in een naamloze herkomst, eigen CSP, integriteit per lezing | `routes/appstore/cel.js`, APPSTORE.md grens 1 |
| **14** netwerk aan banden | **strenger dan gevraagd**: `connect-src 'none'`, geen netwerk (zie par. 3) | `routes/appstore/cel.js` |
| **10** permission-by-design | de brug leest wat het lid VERLEENDE, niet wat het manifest vroeg | `kern/appstore/brug.js` |
| **25** app manifest | manifest met capabilities, prijs, start, icoon; streng gelezen, onbekende velden geweigerd | `kern/appstore/manifest.js` |
| **27** supply chain passport | versiehash over de hele bundel, integriteit bij ELKE lezing, bevindingen bewaard | `kern/appstore/bundel.js` |
| **47** transparante review | per bestand en per REGEL wat er is en hoe het wel kan | `kern/appstore/verboden.js` |
| **48** review preview | de **proefkeuring**: dezelfde poort, niets bewaard, geen rem | `kern/appstore/versies.js` |
| **38** billing-as-a-service | prijs, btw per land, afdracht, bon, payout over de bestaande partnerrekening | `kern/appstore/geld.js`, `kern/pay/verkoop.js` |
| **41** payouts | uitbetalen naar de bank, manager-only | `kern/pay/kassa.js` |
| **68** one-click revoke | machtiging intrekken zonder de app te verwijderen; app weg = alles weg | `kern/appstore/winkel.js` |
| **107** enterprise SSO | SAML + OIDC, koppelingen per organisatie | `server/sso/`, TENANT.md |
| **108** provisioning | SCIM: gebruikers en groepen van de IdP van de klant | `server/scim/` |
| **31** private marketplace, org-grens | `org` IS de klant: contract, merk, levensloop, uitgang | `kern/tenant/`, TENANT.md |
| **28** evidence layer | claim → control → test → bewijs, met bronnen en een weigering als het bewijs ontbreekt | `CONTROLS.json`, `kern/tenant/bewijs.js` |
| **21** observability | routejournaal, meting per route, SLO's als data | `server/routelog.js`, `server/meting.js`, `SLO.json` |
| **19** performance contracts | servicedoelen met venster, streefwaarde en dekking | `SLO.json`, `SLO.md` |
| **17** event mesh (halve) | een bus met Redis-pub/sub over domeinprocessen | `server/bus.js` |
| **78** internationalisatie | eigen vertaallaag, woordenboek, taalbeheer | `server/talen.js`, `public/shared/i18n.js` |
| **79** accessibility | contrast- en structuurpoorten op nul, per barrière beschreven | `TOEGANKELIJK.md`, `test/a11ykeuring.test.js` |
| **80** design system | vormtaal, drie modi, eigen componenten | `ONTWERP.md`, `MATERIAAL.md` |
| **81** device APIs | camera, microfoon, scanners achter één mediapoort met eerlijke diagnose | `public/shared/media.js` |
| **83** offline | service worker, eigen offline-lagen | `public/sw.js` |
| **85** secrets | sleutelkluis, versleuteld en gebonden aan de rij | `server/kluis.js`, `server/accounts/gebonden.js` |
| **8/9** AI-poort | één poort voor alle AI, lokaal-eerst, extern hard uit te zetten | `kern/aipoort.js`, `server/local-ai.js`, `RTG_EXTERNE_AI_UIT` |
| **16** fijnmazige rechten | rollen, rechten, functiescheiding, bewijspoorten per genre | `server/bedrijf/rollen-register.js`, `kern/persoonseis.js` |
| **105** fraudecontrole | bestaande grenzen op bedragen, snelheid, dubbele boekingen | `kern/pay/`, `server/kern/beveiliging.js` |

**Dat is ongeveer een derde van de opzet, en het is het moeilijke derde deel.**
Auth, geld, rechten, bewijs, meting, toegankelijkheid en de sandbox zijn de
onderdelen waar een platform jaren op vastloopt; die staan. Wat ontbreekt is
vooral de **schil eromheen**: de SDK, de CLI, de emulator, de console.

Dat is goed nieuws en het is ook de valkuil. Een derde van het werk dat er staat
is niet een derde van de belofte: een ontwikkelaar ziet nul van deze bestanden.

---

## 2. De belangrijkste vraag in de hele opzet

Punt 2 (één SDK) en punt 3 (één universeel objectmodel) zijn de spil. Ze zijn
ook het punt waar deze opzet botst met iets wat dit huis al DUUR heeft geleerd.

`PLATFORM.md` legt vast wat er gebeurde toen twee apps die identiek KLONKEN
werden onderzocht -- Cercle en Entourage -- en de uitkomst was: totaal
verschillende data en totaal verschillende werkstromen. Precies dat is het
risico bij:

> Een restauranttafel kan een `Asset` zijn. Een hotelkamer ook. Een
> festivalpodium ook. Een leaseauto ook.

Ze kunnen het zijn. De vraag is of ze het ZIJN. Een tafel heeft een couvert en
een bediening; een hotelkamer heeft een schoonmaakstatus en een folio; een
podium heeft een lijnplan en een geluidsnorm; een leaseauto heeft een kenteken,
een bijtelling en een APK. Een `Asset` die die vier dekt, dekt ze door alles wat
ze onderscheidt naar een `extra`-veld te duwen -- en dan heeft de ontwikkelaar
die "tooling voor assets" bouwt, vier keer werk in plaats van één keer.

**Het objectmodel moet worden GEVONDEN in de domeinen, niet eroverheen
verklaard.** De methode staat al in dit huis: `scripts/grenzen.js` mat welke
kern-naam door hoeveel domeinen wordt aangeraakt en vond dat 85% door precies
één domein wordt gebruikt -- en dat de 25 namen die door vijf of meer domeinen
gaan, een echte interface vormen. Datzelfde moet hier gebeuren, met velden in
plaats van functienamen:

1. haal per domein de vorm op van wat het bewaart (reservering, kamer, rit, order);
2. tel welke velden door meer dan één domein worden gedeeld;
3. **wat vier domeinen delen, is een objecttype. Wat er drie delen, is een
   toevalligheid met een mooie naam.**

Zonder die meting is `Asset` een aanname, en aannames over gedeelde vorm zijn in
dit huis al een keer fout geweest. Mét die meting is het een van de sterkste
onderdelen van het hele plan.

**Dit is de eerste echte opdracht van de Developer Cloud**, en het is meetwerk
en geen ontwerpwerk.

---

## 3. Waar de opzet en het huis botsen

Vijf punten kunnen niet zomaar, en ze horen alle vijf een besluit van de eigenaar
te krijgen in plaats van stilletjes de ene of de andere kant op te vallen.

### 3.1 Netwerk voor apps (punt 14) -- vandaag STRENGER dan gevraagd

De opzet vraagt een aangegeven lijst van toegestane hosts. Vandaag heeft een app
**geen netwerk**: `connect-src 'none'`, punt. Dat is niet strenger uit
voorzichtigheid maar omdat het iets anders koopt -- zolang een app niets kan
versturen, hoeft niemand te bewaken WAT hij verstuurt.

Een hostlijst haalt dat weg. Dan is de vraag niet meer "kan hij bellen" maar
"belt hij alleen naar wat er in het manifest staat, en wat stuurt hij mee". Dat
is te bouwen, en het kost een uitgaande proxy met logging per verzoek.

De aanbeveling: **niet doen zolang de Capability Gateway het werk kan doen.**
Punt 12 (zero-copy) wil precies dat een app data NIET krijgt; punt 59 wil dat
apps elkaar via de broker aanroepen en niet rechtstreeks. Als beide waar zijn,
is uitgaand netwerk voor de meeste apps overbodig -- en dan is het toevoegen
ervan het weggeven van de sterkste eigenschap die dit ecosysteem heeft.

### 3.2 De AI als distributiekanaal (punten 6, 62, 63, 66)

`CLAUDE.md`: *de AI mag nooit zelf toegang beloven of verlenen.* `GELD.md` par. 3:
*geld verlaat het huis nooit autonoom.* Een assistent die zelf een capability van
een derde kiest en uitvoert, loopt naar allebei die lijnen toe.

Maar de opzet lost het zelf al op, en netter dan ze het zelf noemt. Punt 66
(observe / assisted / autonomous) is exact de vier-nivieautabel die al in
`GELD.md` par. 3 staat:

| GELD.md | punt 66 | mag een derde dit? |
|---|---|---|
| kijken | observe | ja |
| voorstellen | observe | ja |
| klaarzetten | assisted | ja -- dit is de bovengrens vandaag |
| automatisch | autonomous | alleen binnen het eigen tegoed, en nooit voor een derde |

Punt 63 (delegated execution met een vervaldatum en een maximum) is de vorm die
"autonomous" acceptabel zou maken, en hij past bij hoe dit huis al denkt: een
tijdelijke, begrensde, intrekbare bevoegdheid met een spoor. **Dat is de
uitwerking waarmee dit kan; een agent met een permanente machtiging is het niet.**

### 3.3 De relatie met de klant (punt 57)

De opzet gaat ervan uit dat de ontwikkelaar een klantrelatie heeft. Vandaag krijgt
een uitgever **niet eens de codenaam** van wie zijn app kocht -- APPSTORE.md
grens 3, en `test/appstore-geld.test.js` toets 7 zakt als dat verandert. Dat is
strenger dan elke bestaande App Store, en het is een bewuste keuze uit het
codenaam-ontwerp.

Dit is dus geen technisch punt maar een echte afweging: **een ontwikkelaar die
zijn klant niet kent, kan hem niet ondersteunen, niet upsellen en niet
behouden.** Wat er tussenin ligt bestaat: een klant die zelf besluit zich bekend
te maken aan een leverancier, met een spoor en een intrekknop. Dat hoort een
besluit te zijn en geen bijvangst van een supportformulier.

### 3.4 Code van derden op onze servers (punten 86, 87, 88)

Managed databases, serverless functies en cron voor extensies zijn samen één
sprong, en het is de grootste in de hele opzet: **vandaag draait derdencode
uitsluitend in de browser van het lid, nooit op onze machines.** Dat is de reden
dat de cel werkt zoals hij werkt.

Zodra een `onOrderCreated(event)` bij ons draait, verandert het dreigingsmodel
volledig: procesisolatie, resourcelimieten, buurmanlekken, uitbraak uit de
runtime, en een aanvalsoppervlak dat 24 uur per dag aan staat in plaats van
alleen als iemand een app opent. Dat is niet "een feature erbij" maar RTG dat
een hostingbedrijf wordt.

Het kan, en het is waarschijnlijk nodig voor de zwaardere apps. Maar het hoort
een eigen document te krijgen met een eigen bewijslast, zoals `GELD.md` en
`TENANT.md` dat hebben -- niet een regel in een lijst van 110.

### 3.5 De afdracht (punten 40, 77)

"Eerste EUR 100.000: 95% voor de developer" klinkt als een cadeau en is **duurder
dan wat er nu staat**: de afdracht is vandaag 0%, want dit huis belooft partners
al "RTG rekent 0% commissie". Van 0% naar 5% is een verhoging, hoe genereus 95%
ook klinkt naast de 30% van anderen.

Dat is prima -- een marktplaats die niets verdient, kan ook niets terugstoppen in
launch support, review en bewijsvoering. Maar het is een verandering van een
bestaande belofte en hoort zo te worden opgeschreven, niet als "developer-friendly
revenue share".

Punt 77 (betalen per aantoonbare besparing) hangt volledig op één ding dat de
opzet als bijzin noemt: **een meting die de ontwikkelaar niet kan opdrijven.**
Dat is het hele probleem; de afrekening eromheen is het makkelijke deel.

---

## 4. De volgorde

Niet alles tegelijk, en niet op volgorde van aantrekkelijkheid. Wat eerst moet,
is wat de rest MOGELIJK maakt.

| fase | wat | waarom eerst |
|---|---|---|
| **1. Het objectmodel meten** (par. 2) | tel welke velden echte domeinen delen | zonder dit is elke SDK een gok, en een SDK die je terugneemt is erger dan geen SDK |
| **2. Capabilities met een doel** | een aanroep zegt WAT en WAARVOOR, een weigering legt uit waarom | dit is de kern van punt 10, 11, 22, 26 en 97 tegelijk, en het verdiept het bestaande machtigingsmodel in plaats van er een tweede naast te zetten |
| **3. De vergunningsdiff** | een nieuwe versie die MEER vraagt, vraagt opnieuw | zonder dit kan een app stilletjes groeien in bevoegdheden -- vandaag een gat |
| **4. De SDK en de CLI** | `rtg new`, `rtg dev`, typings, één foutmodel | pas zinvol als 1 t/m 3 staan; anders codificeert hij het verkeerde |
| **5. De emulator en synthetische data** | lokaal draaien zonder RTG | de grootste tijdwinst voor een ontwikkelaar, en onmogelijk zonder een vast objectmodel |
| **6. Event mesh voor derden** | levering, retries, dedup, replay | de bus staat; wat ontbreekt is de belofte eromheen |
| **7. Enterprise: private catalogus, policy-as-code, deployment** | punten 31 t/m 35, 70 t/m 74 | leunt volledig op `org` uit TENANT.md, die staat |
| **8. Serverside extensies** | punt 86/87/88 | eigen document, eigen bewijslast (par. 3.4) |

**Fase 2 en 3 zijn hieronder al begonnen** (zie `APPSTORE.md`); fase 1 is de
eerste echte opdracht en is meetwerk.

---

## 5. Wat dit document niet is

Het is geen toezegging dat er 110 dingen komen. Het is de plek waar staat welke
er al zijn, welke er één stap vandaan liggen, welke een besluit van de eigenaar
vragen, en welke jaren weg zijn -- zodat niemand ze voor elkaar aanziet.

Een lijst van 110 punten is in een middag te schrijven en in geen enkele middag
te bouwen. Wat hem waardevol maakt is niet de lengte maar dat er per punt een
eerlijk antwoord bij staat. Dat antwoord hoort te veranderen naarmate er wordt
gebouwd; wat er niet hoort te gebeuren is dat een punt uit bak drie of vier
stilletjes in een verkooppraatje belandt.
