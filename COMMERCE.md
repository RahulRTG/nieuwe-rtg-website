# RTG Commerce — de laag boven de domeinen

*Gemeten op 27 augustus 2026 met `scripts/commerce.js`, opnieuw vastgelegd na
elke ronde die de code raakte; de uitslag staat in `COMMERCE.json` en wordt
bewaakt door `test/commerce.test.js`. De vier posten die dit document als
openstaand had — de publieke verkoopweg, `annuleer` in retail, de vanaf-prijzen
en de optellingen — zijn alle vier afgemaakt; par. 6 zegt per post wat er is
gebouwd en wat er met opzet níét is gedaan.*

Dit is een richtingsdocument zoals `PLATFORM.md`, `DEVELOPERCLOUD.md` en `OS.md`:
per onderdeel staat er of het **staat**, **een stap weg** is, **een besluit
vraagt** of **jaren weg** is — zodat niemand die vier voor elkaar aanziet.

De aanleiding is een ontwerp voor een universele commerce-laag: één `Kanaal`-object,
één `Commerce Graph`, één `Universal Cart`, één `Universal Checkout`, `Reverse
Commerce`, en als dragende bewering een **`Koopbaar`-protocol** dat dertien soorten
verkoopbare dingen achter acht werkwoorden zet. Het idee eronder is goed en dit
document neemt het over. De uitwerking verandert, en dat komt door de meting.

---

## 1. De meting: `Koopbaar` bestaat niet als één protocol

Dit huis heeft de vraag "delen onze domeinen een type?" al twee keer gesteld en
twee keer *nee* gehoord. `OBJECTMODEL.json`: **`Asset` bestaat niet** — tafel,
kamer, podium en leaseauto delen niets buiten hun verpakking. `CAPABILITEIT.json`:
er is geen capabilitylaag, er zijn er **twintig**. `DEVELOPERCLOUD.md` par. 2 trok
daar de regel uit die hier geldt:

> Een universeel objectmodel moet worden **gevonden** in de domeinen, niet
> eroverheen **verklaard**.

`Koopbaar` is exact even breed als `Asset` was. Dus is hij op dezelfde manier
behandeld. De meting is **met opzet royaal**: een werkwoord telt mee bij de
vaagste naamverwantschap, een koopbare vorm bij het minste prijsveld. Dat maakt
`Koopbaar` rijker dan hij is — en dus weegt een negatieve uitslag zwaar.

**440 vormen met een prijsveld, in 100 van 430 domeinen.** Na aftrek van de
42 envelop-velden blijven er 851 velden over, waarvan **661 (78%) in precies één
domein** voorkomen. Van de 440 koopbare vormen halen **7 paren** uit verschillende
domeinen de 60%-drempel.

De acht werkwoorden, over die 100 domeinen:

| werkwoord | domeinen | |
|---|---|---|
| `toon` | 80 van 100 (80%) | ████████████████ |
| `bevestig` | 45 van 100 (45%) | █████████ |
| `beschikbaarheid` | 43 van 100 (43%) | █████████ |
| `prijs` | 31 van 100 (31%) | ██████ |
| `reserveer` | 23 van 100 (23%) | ████ |
| `annuleer` | 21 van 100 (21%) | ████ |
| `lever` | 15 van 100 (15%) | ███ |
| `retour` | **7 van 100 (7%)** | █ |

En de drie getallen waar het besluit op rust:

- **0 domeinen voeren alle acht werkwoorden uit.**
- **0 werkwoorden staan in álle koopbare domeinen** — zelfs `toon` niet.
- **43 verschillende combinaties** van werkwoorden over 100 domeinen.

Eén protocol met 43 verschillende invullingen is geen protocol. Wie `Koopbaar`
alsnog als interface van acht methodes neerzet, dwingt 100 domeinen tot methodes
die ze niet hebben. Voor `lever` staat er dan in 85 van de 100 domeinen een
`nietGebouwd`, voor `retour` in 94 — of erger: een lege implementatie die *doet*
alsof.

> **Twee dingen die de meter eerst verkeerd zei, en waarom dat hier staat.**
> `serveer` in de lever-familie slikte elke **re**serveer, waardoor `kern/mobiliteit`
> alle acht werkwoorden haalde met `lever` en `reserveer` bewezen door dezelfde
> functie. En de patronen ankerden op het begin van de naam, waardoor
> `maakTeruggave` in `kern/appstore` het werkwoord `retour` miste terwijl dat
> bestand juist het teruggaverecht uit `APPSTORE.md` uitvoert. Beide zijn
> gerepareerd en beide staan als regressietoets in `test/commerce.test.js`. Een
> meter die je niet hebt zien zakken, is geen meter (LAT-regel 10) — alle acht
> mutaties zijn nagelopen en laten elk precies hun eigen toets uitslaan.

---

## 2. Wat er wél gevonden is

De meting vindt geen universeel type, maar wel **twee echte gedeelde vormen** —
allebei tussen precies twee domeinen, allebei binnen hetzelfde genre:

| gelijkenis | domeinen | gedeelde velden | wat het is |
|---|---|---|---|
| **0,89** | `kern/mall` ↔ `kern/retail` | `categorie drop foto materiaal price publiekePrijs sku varianten` | **het artikel met varianten** |
| **0,73** | `kern/gast` ↔ `kern/horeca` | `allergenen allergie gang gastNr ingrediënten itemId prepMin station` | **de bestelregel** |

Dat is de eerlijke oogst, en hij is bruikbaar: dit zijn twee types die er
werkelijk zijn en die je één keer mag opschrijven. Wat er níét uit komt is een
derde die er dwars overheen ligt.

### De prijskaart

De 78% domeineigen velden en de 43 combinaties zeggen samen: elk domein verkoopt
op zijn eigen manier. Wat het per domein kóst om het onder één laag te brengen,
staat hieronder — niet als foutenlijst maar als prijskaart. Volledige matrix in
`COMMERCE.json`.

| domein | toon | prijs | beschikb. | reserv. | bevestig | lever | annul. | retour | |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `kern/appstore` | • | • | • | | • | • | • | • | 7/8 |
| `kern/mobiliteit` | • | • | • | • | • | | • | • | 7/8 |
| `kern/spellen` | • | • | • | • | • | • | • | | 7/8 |
| `kern/mall` | • | • | • | • | • | • | | | 6/8 |
| `kern/horeca` | • | • | • | • | • | • | | | 6/8 |
| `kern/thuis` | • | • | • | • | • | | • | | 6/8 |
| `kern/pay` | • | | • | • | • | | • | • | 6/8 |
| `kern/gast` | • | • | • | | • | • | | | 5/8 |
| `kern/groothandel` | • | • | • | | • | | • | | 5/8 |
| `kern/markt` | • | • | • | • | • | | | | 5/8 |
| `kern/keuken` | • | • | | | • | • | | | 4/8 |
| `kern/verblijf` | • | | • | | • | | • | | 4/8 |
| `kern/ov` | • | • | | | • | | • | | 4/8 |
| `kern/onderneming` | • | • | • | • | | | | | 4/8 |
| **`kern/retail`** | • | • | • | • | • | | | | **5/8** |
| `kern/eten` | • | • | • | | | | | | 3/8 |
| `kern/waarde` | • | | • | • | | | | | 3/8 |
| `kern/modebezorg` | • | | | | | • | | • | 3/8 |
| `kern/boerderij` | • | | • | | | | | | 2/8 |

Drie dingen springen eruit.

**`kern/appstore` is de bouwtekening en niet `kern/retail`.** Het domein dat het
dichtst bij het volledige protocol zit, is de App Store — 7 van 8, en het enige
domein dat een prijs, een btw-land, een onveranderlijke bon, een afdracht én een
teruggaverecht in één keten heeft staan. `OS.md` had dit al gevonden vanaf een
andere kant: `kern/appstore/machtigingen.js` is het enige bestand in dit huis dat
een **doel én een grens** draagt. Wie de commerce-laag ontwerpt, leest dat domein
eerst.

**`kern/retail` haalt 5 van 8**, terwijl dat het domein is waar iedereen naar
wijst als hij "webshop" zegt. Het heeft varianten, SKU's en voorraad op de
variant — en geen levering, geen annulering, geen retour. De webshop bouwen
betekent dus niet "retail ontsluiten" maar *retail afmaken*.

> Het stond hier eerst op **3 van 8**. De vierde is geen nieuwbouw maar een
> **meterfout van dezelfde soort als `serveer` en `maakTeruggave`**. `legApart`
> in `kern/retail/klant.js` haalt een variant uit de vrije verkoop, houdt hem
> vast op de sleutel van een klant en laat hem na drie dagen vervallen — de
> regel erboven zegt zelf *"gereserveerd = uit de vrije verkoop"*. Dat is
> `reserveer`, en het patroon zag het woord niet. Gevonden bij het zoeken naar
> wat er in retail nog gebouwd moest worden; het antwoord was dus deels: niets.
> Dat de correctie precies het domein raakt dat er het slechtst uit kwam, is
> een reden om hem na te rekenen en niet om hem te laten — over 1540 bestanden
> kantelt er exact één domein (22 → 23) en komt er nergens een valse treffer
> bij. `test/commerce.test.js` toets 3b noemt de functie bij naam, zodat een
> hernoeming de regel laat zakken in plaats van hem lucht te laten meten.
>
> De **vijfde is wel gebouwd**, en hij kwam uit dezelfde zoektocht. De prijs
> bestond in retail wel maar stond MIDDENIN een andere handeling: `verkoop` in
> `retail/vloer.js` rekende zijn totaal ter plekke uit. Dat is nu `prijsVan` in
> `retail/assortiment.js` — een functie die niets aanraakt, alle tekorten
> tegelijk teruggeeft en een onbekende variant benoemt in plaats van hem stil te
> laten vallen.
>
> **En het repareerde een echte fout.** `verkoop` haalde de voorraad eraf
> *terwijl* hij de regels langsliep, en keerde bij de eerste regel zonder
> voorraad terug met een 409 — met de voorraad van de regels ervoor al
> afgeboekt, zonder bon en zonder dat iemand het zag. Eerst rekenen en dan pas
> muteren maakt die volgorde onmogelijk; `test/retail-prijs.test.js` toets 4
> zakt op de oude volgorde.
>
> Wat het **niet** heeft gedaan is een optelling wegnemen. Die is verhuisd van
> `vloer.js` naar `assortiment.js`, en het totaal bleef dus staan. Het verschil dat de
> meter niet kan zien is dat er nu één plek is die zegt wat iets kost, in plaats
> van een som in de buik van een handeling die tegelijk voorraad afboekt.

**`retour` stond bij de eerste meting op 6 van 100, en die zes waren geen
retouren.** Het zijn
`terugboeken` (`kern/betaalopdracht`), `terugGave` (`kern/pay`), `maakTeruggave`
(`kern/appstore`) en de koeriersretour van `kern/modebezorg`: geldomkeringen en
één pakket dat terugrijdt. (Het staat nu op 7: de zevende is `kern/commerce`
zelf, de laag die hieronder is gebouwd om dat gat te vullen.) Een goederenretour met grondslag, inspectie,
voorraadstand en btw-correctie bestond nergens. **Reverse Commerce was dus geen
uitbreiding maar nieuwbouw** — en het was de grootste van de vier gaten. Hij
staat er inmiddels (par. 6), en dat de meting hem als afwezig aanwees is precies
waarom hij als eerste is gebouwd.

---

## 3. Het woord `Kanaal` is al bezet — en dat is geen detail

Het voorstel begint met "introduceer één nieuw kernbegrip: Kanaal". Dat woord is
niet vrij. `SEMANTIEK.json` heeft `KANALEN` al in de **top** staan als **botsing**:
**4 domeinen, 4 betekenissen, hoogste onderlinge overlap 0,10.**

| bestand | betekenis | leden |
|---|---|---|
| `kern/horeca.js` | **verkoopkanaal** (tafel, bar, terras, afhaal, bezorging, roomservice) | 12 |
| `kern/stadsweefsel/zaken.js` | meldkanaal (bewonersapp, gemeente, telefoon, ambtenaar) | 10 |
| `kern/concern/uitnodiging.js` | uitnodigingskanaal (chat, e-mail, telefoon, qr, code) | 6 |
| `kern/rtfos/berichten.js` | berichtkanaal (app, e-mail, sms, push, nieuwsbrief) | 5 |

Daarnaast `OPEN_KANALEN` in `kern/eten`, `MAX_KANALEN` in `kern/muziek-instrumenten`
(audiokanalen) en `kanalen` in `kern/berichten` (gesprekken).

`BEWIJSMACHINE.md` beschrijft precies deze fout, gemeten: van de 94 namen die in
meer dan één domein staan, dragen er **77 meer dan één betekenis**. Twee bestanden
met een `VERMOGENS` zonder één gedeeld lid waren daar de aanleiding. Een vijfde
`KANALEN` erbij zetten — en dan uitgerekend als *het* kernbegrip van een nieuwe
laag — is diezelfde fout, met opzet gemaakt.

**Er waren twee uitwegen, en de goedkope is genomen.**

`kern/horeca.js` gebruikte `KANALEN` al in exact de betekenis die het voorstel
bedoelt: waarlangs verkoop je. Die is de enige geworden; de andere drie heten nu
naar wat ze werkelijk zijn — **`MELDWEGEN`** (`kern/stadsweefsel/zaken.js`),
**`UITNODIGINGSWEGEN`** (`kern/concern/uitnodiging.js`) en **`BERICHTWEGEN`**
(`kern/rtfos/berichten.js`). Alleen de namen veranderden, geen enkele waarde.

Dat is precies de ingreep die `server/kern/passen.js` ook was: drie mutaties, en
de meter bewoog mee. `KANALEN` staat **niet meer in de botsingstop** van
`SEMANTIEK.json`, en het totaal aantal betekenissen ging van 282 naar 280.

Het alternatief was een ander woord kiezen voor de nieuwe laag (`TOONBANK`). Dat
zou de nieuwe laag schoon hebben gemaakt en de vier botsingen hebben laten staan
— goedkoper vandaag, duurder elke dag daarna.

> **En de laag hield zich er zelf ook aan — na één terugdraai.** De verkoopweg
> heette eerst `SOORTEN` en de retourstanden `STANDEN`. Dat zijn precies de twee
> ergste woorden van dit huis: `SOORTEN` stond op 38 betekenissen in 39 domeinen
> en was daarmee `ergsteWoord` in `SEMANTIEK.json`. Ze zijn `WEGSOORTEN` en
> `RETOURSTANDEN` geworden. Uitkomst: **`kern/commerce` doet aan geen enkele
> naamsbotsing mee**, en het totaal aantal betekenissen in het huis staat op 281
> — één lager dan voor deze laag bestond, ondanks twaalf nieuwe bestanden.

> **Deze laag maakte die fout bijna zelf.** De werkwoorden heetten eerst
> `VERMOGENS`, en dat woord staat al in `kern/bevoegdheid/lijst.js` (de
> juridische bevoegdheden: `WALLET_SALDO`, `LID_UITBETALING`), in
> `kern/command/vermogens.js` en in `kern/wereld/rechten.js` — drie betekenissen,
> en `OS.md` gebruikt het bovendien voor het onderscheid platformvermogen /
> domeinvermogen. Een vierde erbij zetten, in het document dat over precies die
> fout gaat, is het soort vergissing dat je alleen ziet als je ernaar kijkt. Ze
> heten nu `WERKWOORDEN` — het woord dat `scripts/commerce.js` en dit document al
> gebruikten.

Wat er niet mocht gebeuren was de derde optie: het woord gebruiken en de botsing
laten staan. Dan betekent `kanaal` in een routelog vijf dingen en is er geen
manier meer om te zien welke.

---

## 4. De begrippen

Zes, en er komt er geen zevende bij.

**VERKOOPWEG** — waarlangs iets te koop staat. Het woord `kanaal` is
vrijgemaakt (par. 3) en blijft van `kern/horeca.js`; dit is het object eromheen. Draagt
identiteit, doelgroep, assortimentsbron, prijsbeleid, voorraadbron, afrekenbeleid,
betaalbeleid, fulfilmentbeleid, retourbeleid, fiscale context, merk, toegang en
publicatie. Een webshop, een POS, een QR-kaart, een B2B-portaal, een AI-agent en
de Mall zijn dan geen zes producten maar zes verkoopwegen. Dit begrip is **nieuw
en dat mag**: het is geen bewering over bestaande domeinen, dus hij hoeft niet
gevonden te worden — hij moet alleen niet botsen.

**KOOPBAAR** — iets dat langs een verkoopweg kan gaan. **Geen interface van acht
methodes, maar een verklaring van werkwoorden.** Een koopbaar zegt wélke van de acht
werkwoorden hij kent, en de afrekening past zich aan. Dat is niet een compromis:
het is wat de meting vond: 26 van de 100 domeinen bevestigen zonder prijs. Een
gerecht kent geen retour, een hotelkamer kent geen
levering, een digitale dienst kent geen voorraad — en een protocol dat doet alsof
van wel, staat 85 keer leeg op `lever` en 94 keer op `retour`.
`kern/appstore/machtigingen.js` is het model: elk werkwoord draagt een doel én een
grens.

**MAND** — wat een koper bij elkaar heeft staan, over verkoopwegen en verkopers
heen. Eén mand, veel afrekeningen (zie de grens hieronder). Dit is het enige
begrip waar samenvoegen echt iets oplevert: er staan nu **25 vormen die regels
dragen** (een aantal naast een bedrag) in **18 domeinen**, en daarvan zijn er
**23 verschillend**. Ze delen dus vrijwel niets — anders dan bij `Koopbaar` is
hier geen bestaand type dat kapotgemaakt wordt. (De vijfentwintigste en het
achttiende domein zijn deze laag zelf; zie par. 6, *jaren weg*.)

**AFREKENING** — de bevestigde, server-berekende waarheid over één verkoper: de
regels, de prijs, de btw, de korting, de verzendkosten, het bewijs. Nooit uit de
browser. `routes/gast/checkout-buiten.js` is hiervan al de werkende vorm.

**LEVERING** — hoe het koopbare bij de koper komt: bezorgen, afhalen, digitaal,
uitvoeren op tijdstip, of niets (een reservering wordt niet geleverd).

**RETOURSTROOM** — de omkering, met dezelfde bewijslaag als de verkoop. Bestaat
nog niet; zie par. 6.

---

## 5. De grenzen die niet mogen sneuvelen

**1. Eén mand is niet één bevestiging.** `kern/mall/bestellingen.js` weigert
vandaag met zoveel woorden een knop "betaal alles", en de reden staat erbij:
*achter deze regels zitten verschillende partijen met verschillende
bevestigingen, en een enkele knop zou een belofte doen die niemand van hen heeft
gegeven.* Die weigering is geen ontbrekende functie maar een grens, en hij is
dezelfde als het werkwoord van `LIFE.md`: **samenstellen en klaarzetten —
bevestigen doet de mens**. Eén mand met vier verkopers mag dus één betaalmoment
hebben en moet vier afrekeningen houden, elk met de bevestiging van díé verkoper.
Wat RTG nooit doet is namens een verkoper bevestigen die niets heeft bevestigd.

**2. Er komt geen tweede betaalweg.** Elke afrekening gaat langs
`kern/pay/poort.js`, ook die van een publieke, niet-ingelogde koper. `GELD.md`
par. 3: geld verlaat het huis nooit vanzelf. Een verkoopweg die zijn eigen
betaalpad krijgt "omdat hij buiten staat", is precies het pad omheen.

**3. Btw wordt niet geraden en niet overgetypt.** `kern/fiscaal/tarief.js` is de
enige bron, en dat bestand bestaat omdat er ooit twee waren die het oneens waren
— een maaltijd op Ibiza die in de boekhouding 10% en op de bon 9% kostte,
jarenlang, zonder dat iemand wist welke klopte. Een publieke verkoopweg voegt één
vraag toe (het land van de kóper bij digitale diensten), en die staat al
uitgewerkt in `kern/fiscaal/digitaal.js` en wordt al gebruikt door
`kern/appstore/geld.js`. Geen tweede tabel, ook niet "tijdelijk".

**4. Een publieke koper is geen lid, en krijgt ook geen omweg naar een codenaam.**
De identiteitskluis (`accounts.js`) en het codenaam-ontwerp uit `CLAUDE.md` gelden
onverkort. `routes/gast/` heeft het patroon al: de poort is een **tafelsleutel en
geen inlog**, op de rekening staat een handle, en gaat de rekening dicht dan is de
sleutel niets meer waard. Een publieke verkoopweg erft dat, en breidt het niet op
tegen dat een order nu eenmaal een adres nodig heeft — dat adres hoort bij de
afrekening, niet bij een profiel dat stilletjes ontstaat.

**5. Webmaker krijgt geen commerce-logica.** De blokken lezen de leeslaag en
bezitten niets. Zodra een blok zelf een prijs berekent, staat de 90e optelling in
de 49e module en is de reparatie van `fiscaal/tarief.js` voor niets geweest. Dit
is LAT-regel 4 op de plek waar hij het makkelijkst sneuvelt, want een blok dat
"even zelf" rekent is altijd de kortste weg.

**6. RTG beslist geen retour namens de verkoper.** Een retourrecht ontstaat, een
mens handelt hem af — zoals `kern/appstore/teruggave.js` het nu doet: het recht
wordt **klaargezet**, een mens beslist. Automatisch geld terugsturen is dezelfde
autonome betaling die grens 2 verbiedt.

---

## 6. Wat staat, wat een stap weg is, wat een besluit vraagt

### Staat

- **De onderkant, grotendeels.** Dubbel grootboek met een poort ervoor
  (`kern/pay/`), zes waardeklassen met een grond (`kern/waarde/`), btw per land ×
  categorie uit één bron (`kern/fiscaal/`, 15 bestanden), facturen met nummering
  (`kern/facturatie/motor.js`), PSP-naad met webhookverificatie en idempotentie
  (`server/betaal.js`), voorraad op de variant (`kern/retail/assortiment.js`),
  koeriersroute en volgscherm (`kern/modebezorg/`, `kern/bezorgvolg.js`),
  internationale vracht met AWB/B-L/CMR (`kern/vracht.js`), multi-tenant
  (`kern/tenant/`, `TENANT.md`), en een App Store met keuring, cel, machtigingen
  en een onveranderlijke bon (`kern/appstore/`, 22 bestanden).
- **Een server-bevestigde afrekening die geen browserprijs gelooft**
  (`routes/gast/checkout-buiten.js`).
- **Een anonieme koopdeur die werkt** — `routes/gast/`, met een tafelsleutel in
  plaats van een account. Alleen horeca, maar het patroon is bewezen.
- **Een sitebouwer met versies, publiceren, plannen en spoor** (`kern/webmaker*`),
  met live blokken die uit het zaakprofiel oplossen (`kern/webplatform.js`) en één
  sjabloon voor alle vestigingen van een merk (`kern/webmerk.js`).
- **De commerce-laag zelf** (`kern/commerce/`, acht bestanden, gemonteerd in
  `opzet/kernlaag2b.js`): de werkwoorden als gesloten lijst met per werkwoord wat
  het geeft en wat het nooit doet, de vertaling van een aanbod-rij naar een koopbaar,
  de leeslaag over `kern/mall/aanbod.js` (nul `save()`), de mand op de
  sessiesleutel, en de afrekening per verkoper met btw uit `kern/fiscaal/tarief.js`.
  Draait op de seed: 100 koopbaren uit 8 typen. Scherm: `/apps/commerce.html`,
  routes: `/api/commerce/*`.
- **Reverse Commerce** (`kern/commerce/retour*.js`, `routes/supplier/retour.js`).
  De weg terug met dezelfde bewijslaag als de weg heen: zes gronden als gesloten
  lijst, vijf standen die elk zeggen wélke partij ze zet, de staat waarin iets
  terugkomt (en dus of het terug in de voorraad *kan* — boeken doet het domein),
  zes uitkomsten, en een **bevroren** bedrag en btw-tarief op het moment van
  aanvragen. Drie grenzen erin: RTG zet nooit een stand namens de verkoper, het
  geldbesluit wordt **klaargezet en nooit uitgevoerd** (`uitgevoerd: false`), en
  de order blijft van het domein — een retour verwijst ernaar en draagt
  `orderGecontroleerd: false` tot de verkoper hem tegen zijn eigen administratie
  legt. Wat er níét in zit staat er met de reden in `NIET_GEBOUWD`: ruilen tegen
  iets anders, een verzendlabel, automatisch terugboeken, en een
  retourpercentage (dat is een score op mensen).
  **De uitvoering staat er ook**: een manager van de verkoper drukt, en het
  bedrag gaat langs `kern/pay/verkoop.js` `terugGave` — dezelfde functie die
  `kern/appstore` gebruikt, met haar idempotentie en haar alles-of-niets. Uit-
  voeren is een aparte handeling dan afhandelen (die zet klaar, dit betaalt), en
  de retour-id is de idem-sleutel: twee keer drukken is één verzoek. Zonder
  geldlaag, zonder codenaam of bij een weigering blijft `uitgevoerd: false` staan
  — er komt nooit "betaald" bij een teruggave die niet is gedaan.
- **De verkoopweg** (`kern/commerce/verkoopweg.js`,
  `routes/supplier/verkoopweg.js`): een genoemde, gepubliceerde selectie uit het
  aanbod van een verkoper, met een toegangsniveau. Zes soorten (web, kassa, qr,
  b2b, mall, agent), vijf toegangsniveaus — en `publiek` is er één die **wordt
  geweigerd mét de reden** in plaats van te ontbreken, want dat is een besluit
  van de boardroom (`kern/webdomein.js`, twee sloten). De telling van wat er te
  koop staat komt uit de graaf en niet uit een eigen kopie; een kapotte
  aanbodlaag geeft `null` en niet nul, want nul zou "deze winkel is leeg"
  betekenen. Scherm voor de ondernemer: `/apps/leverancier-commerce.html` — daar
  staat `publiek` in de keuzelijst als een optie die *uitgeschakeld* is met de
  reden eronder, want een optie die ontbreekt laat iemand zoeken naar een
  instelling die niet bestaat. De elf eigenschappen die par. 4 opsomt en die nergens bestaan
  (prijsbeleid, betaalbeleid, fulfilment, eigen domein, merk) staan er niet als
  leeg veld maar in `NIET_GEBOUWD` met de reden.
- **De winkel op een partnersite.** Er is géén productblok bijgekomen, en dat is
  de pointe: `winkel` is een dertiende **bron** van het bestaande
  `zaakdata`-blok geworden (`webplatform.js`), naast `menu`, `kamers` en
  `agenda`. Een zaakdata-blok draagt een verwijzing en lost bij het openen op uit
  de laag die er werkelijk over gaat — dus wijzigt het aanbod, dan staat het op
  de site zonder dat iemand de site aanraakt (het Business Master Record). Zo
  blijft grens 5 staan zonder dat er iets voor moest wijken: Webmaker heeft nog
  steeds 14 bloktypes en nul commerce-logica. Wat de bron toont is wat er te
  koop staat; kopen gebeurt waar het al gebeurde.
- **De overdracht** (`kern/commerce/overdracht.js`, `shared/overdracht.js`): het
  sluitstuk van de afrekening. Die zegt "wij stoppen bij de deur" en wijst hem
  met `bevestigBij` aan; zonder dit was dat een doodlopend eind — de koper landde
  op `/apps/mall.html` en begon opnieuw, en dan is vier verkopers in één mand
  geen verbetering maar vier keer zoeken. Nu maakt de knop een **briefje**: wat
  je koos, hoeveel, en wat RTG rekende, afgeleverd bovenaan het scherm van het
  domein. **Hij draagt de keuze over en nooit de bevestiging** — er komt geen
  order bij, geen betaling en geen tweede orderwaarheid. Vijf grenzen: de regels
  komen uit het doorgerekende mandbeeld en nooit uit het verzoek (een aanroeper
  die zijn eigen regels stuurt, stuurt zijn eigen prijs); een briefje is alleen
  te lezen met de sleutel waarop het is gemaakt, want het id staat in een
  adresbalk; het bedrag staat vast en draagt zijn datum, zodat een afwijking bij
  de verkoper *zichtbaar* is in plaats van weggepoetst; twee deuren bij één
  verkoper is een keuze van de koper en geen gok van RTG; en er bestaat **geen
  stand `bevestigd`** — RTG hoort niet van het domein of de koper heeft
  doorgezet, dus loopt een briefje na twee uur gewoon af. De mandregel krijgt een
  merkje ("doorgegeven aan X om 12:40; of het is bevestigd, weet RTG niet") dat
  vervalt zodra iemand het aantal verandert. De balk staat op **één** plek en
  niet in de tientallen schermen waar domeinen bevestigen: `shared/basis.js`
  laadt hem pas bij als er `?overdracht=` in het adres staat, zoals hij
  `shared/kaart.js` ook bijlaadt.
- **Wat een aanbod NIET kan, met de reden erbij.** De unieke opbrengst van deze
  laag. Een ondernemer ziet per regel waarom er geen koopknop staat, en het
  verschil tussen *er is iets te doen* (zet een prijs) en *er is niets aan de
  hand* (een offerte-aanvraag hoort geen koopknop te hebben).

### Een stap weg

- ~~`kern/retail` afmaken~~ — het staat op **5/8** (par. 2), en `annuleer` is nu
  ook echt gebouwd. Hier stond een functie die de voorraad terughaalde én **de
  kassabon uit `posSales` gooide**: geen annulering maar een uitgeveegde regel,
  waarna de Z-lijst van gisteren er niet meer mee klopte.

  Het is een **tegenboeking** geworden en geen vlag (`kern/retail/annulering.js`).
  De bon blijft staan met een merkje; ernaast komt zijn spiegelbeeld met een min
  ervoor. Dat is niet alleen netter maar ook goedkoper: **42 plekken** in dit huis
  lezen `posSales`, en de plekken die geld optellen komen door een tegenboeking
  vanzelf op nul uit — zonder dat er ergens een `if (!bon.geannuleerd)` bij hoeft.
  Een vlag zou al die plekken moeten bereiken, en de plek die hem vergeet telt
  omzet die niet bestaat.

  Twee tellingen moesten wél mee. Het **aantal bonnen** telt de tegenboeking niet
  mee (een hersteld foutje is geen twee klanten), en de **btw-pot** in
  `kern/fiscaal/index.js` liet negatieve bedragen vallen (`if (bedrag > 0)`) —
  daardoor bleef de verkoop in de aangifte staan en verdween de annulering: een
  aangifte die te hoog uitvalt. Nagerekend tegen een draaiende server: de btw
  gaat 754,96 → 1258,26 → **exact terug naar 754,96**.

  Er is nog steeds **één** weg om een verkoop ongedaan te maken en geen twee: een
  mislukte betaling gaat langs dezelfde tegenboeking, met de grond
  `betaling-mislukt`. Twee mechanismen zijn twee waarheden over de vraag of die
  omzet echt is. `lever` hoort nog steeds **niet** hier: bezorgen staat per zaak
  in `kern/leverancier/bezorgregel.js`.
- ~~Een exacte prijs waar nu een vanaf-prijs staat~~ — **gebouwd**, en de twaalf
  bleken drie verschillende dingen te zijn. Nagemeten op de seed:

  | | wat het is | wat eraan te doen was |
  |---|---|---|
  | 6× `eten` | een restaurant, "vanaf €12 per gerecht" | **niets** — dat is een prijs*niveau*, geen prijs |
  | 3× `verblijf` | een huis met kamers die elk hun eigen exacte prijs hebben | welke kamer, hoeveel nachten |
  | 3× `reis` | de nettoprijs per persoon staat vast | met hoeveel personen |

  De laatste twee hebben dezelfde vorm — **kies een grondslag, maal een aantal** —
  en dat is precies de som die `afrekening.js` al deed. Er is dus geen prijsfunctie
  per domein aangeroepen en geen registertje van domeinen die er een hebben: het
  domein publiceert de keuzes mét hun exacte bedrag (die kent het al), en de
  commerce-laag doet de vermenigvuldiging die ze overal al doet
  (`kern/commerce/prijsvraag.js`). Een aanroep terug het domein in zou een tweede
  weg zijn waarlangs een bedrag ontstaat.

  Drie grenzen: het bedrag komt uit de **optie van de server** en nooit uit het
  antwoord van de browser; een onvolledig antwoord geeft **nooit** een getal maar
  de vraag terug; en `prijsAard: 'niveau'` markeert de zes restaurants als wat ze
  zijn, zodat "zet een prijs" een ondernemer niet aan het werk zet aan iets wat
  niet bestaat. Zonder dat onderscheid vielen drie verblijven en drie reizen uit
  de etalage met een reden die niet klopte.
- ~~Bevestigen vanuit de mand~~ — **gebouwd**, zie *De overdracht* hieronder.

### Vraagt een besluit van de eigenaar

- ~~Het woord `Kanaal`~~ — **genomen** (par. 3): hernoemd, `KANALEN` is uit de
  botsingstop en het woord is van de verkoopweg.
- ~~Publiek verkopen op een eigen domein~~ — **gebouwd**, en het werd inderdaad
  een regel MINDER en geen nieuwe laag. `kern/commerce/publiekslot.js` LEEST de
  twee sloten van `kern/webdomein.js` in plaats van er een derde naast te
  leggen: slot een is de boardroomfunctie `dom-eigendomein` (standaard uit),
  slot twee is de zaak die zelf een adres koppelt en online zet. Staan ze
  allebei open, dan is een publieke verkoopweg geen nieuwe deur maar een etalage
  op een deur die al open staat.

  Vier dingen die het scherp houden. De weigering noemt **welk slot** dicht zit
  in plaats van een blanket nee. `niet vast te stellen` is een eigen uitslag
  naast open en dicht, en houdt ook tegen — er gaat niets naar buiten op een
  vermoeden. De stand wordt bij élke lezing opnieuw opgehaald, dus een
  verkoopweg die live staat als de boardroom de schakelaar omzet, meldt
  **staat stil** in plaats van door te gaan op de vergunning van gisteren. En
  deze laag kan geen van beide sloten openen: hij krijgt twee lezers en verder
  niets.
- **Betaalroutering en zelfherstel.** Technisch een uitbreiding van
  `server/betaal-regie.js`. Maar "RTG kiest de goedkoopste rail" is een belofte
  over andermans geld, en die hoort langs dezelfde vraag als elke andere
  bevoegdheid in `kern/bevoegdheid/lijst.js`.
- **Autopilot, simulatie en causaliteit.** Aantrekkelijk en ver weg. `BESTUUR.md`
  legt de lat: elke bewering draagt een **bewijsgraad** met een datum, en
  *vervallen bewijs is geen bewijs*. Een simulatie die zegt "omzet +7,8%" zonder
  bewijsgraad is een schermleugen — daar is `SCHERMLEUGEN.json` voor.

### Jaren weg

- **De 92 optellingen — en wat het natellen opleverde.** 92 plekken in 49
  domeinen rekenen regelbedragen uit of tellen ze op. Dat is de prijs van geen
  gedeelde afrekening, en het is precies het patroon dat `fiscaal/tarief.js` al
  één keer heeft laten ontsporen. Ze zijn niet in één ronde samen te brengen, en
  een poging daartoe die halverwege stopt, laat het huis met nóg één meer achter.

  Er stonden er 90 toen dit stuk werd geschreven en 92 nu; twee ervan zijn **deze
  laag zelf** (`afrekening.js` en `overdracht.js`). De meter kent geen uitzondering
  voor de bouwer, en dat hoort zo. Wat de meting níét kan zien is dat die twee
  dezelfde som gebruiken.

  **Maar bij het natellen bleek het risico ergens anders te zitten, en scherper.**
  Ze rekenen niet in dezelfde eenheid, en erger: het WOORD voor die eenheid
  betekende drie dingen. Niet op vier plekken, zoals hier eerst stond, maar op
  **zeven** in `server/` en een **achtste** in `public/` — dat verschil is zelf
  het bewijs dat tellen boven onthouden gaat.

  | | | |
  |---|---|---|
  | `kern/util.js` | `centen(n) = round(n*100)/100` | euro's blijven euro's |
  | `school/financien.js` | `centen(v) = round(v*100)` | euro's worden centen |
  | `kern/labfonds.js` | `centen(euro) = round(euro*100)` | euro's worden centen |
  | `bedrijf/klant.js` | idem, met een eigen plafond | euro's worden centen |
  | `bedrijf/project.js` | idem, met een ánder plafond | euro's worden centen |
  | `kern/rtfos/basis.js` | idem, met een dérde plafond | euro's worden centen |
  | `kern/horeca.js` | `centen(v) = round(v)` | ongewijzigd |
  | `public/apps/geld/hulp.js` | `Geld.centen(v)`, leest "1.000" goed | euro's worden centen |

  `centen(x)` **leest** als "maak er centen van" en doet dat in `kern/util.js`
  juist niet. Vóór de hernoeming was er niets kapot — nagelopen, alle aanroepers
  gaven het goede mee — maar dat was geluk en geen ontwerp: dezelfde familie fout
  kostte deze laag al een keer een factor honderd (`bedrag` in euro's dat als
  centen werd gelezen). Dit is een `SEMANTIEK.json`-botsing in de duurste laag
  die er is. Wat de hernoeming zélf brak en hoe dat is gevonden, staat hieronder
  — ongepoetst, want dat is de helft van wat dit stuk waard maakt.

  Wat er nu staat: **één plek die zegt wat een bedrag is**
  (`kern/geld/eenheid.js`), met namen die niet te verwarren zijn — `naarCenten`,
  `naarEuro`, `rondEuro`, `regelCenten`, `somCenten`, en géén `centen`. Alle acht
  zijn hernoemd naar wat ze DOEN en wijzen er nu heen: `rondEuro` in
  `kern/util.js`, `heleCenten` in `kern/horeca.js`, `naarCenten` op de zes die
  echt omzetten (`Geld.naarCenten` in de browser hoort daarbij: een huisregel die
  bij de servergrens stopt, is een halve huisregel). Twee van de drie plafonds
  blijven staan waar ze stonden — dat is beleid van die laag en geen eenheid. Het
  derde is verschoven en dat staat in `kern/rtfos/basis.js` uitgeschreven: de
  bovengrens van EENHEID (tien miljoen euro) bindt daar nu, en het eigen plafond
  van een miljard was dode code geworden.

  **Gemeten, niet geschat.** De omzetting raakte **149 verwijzingen**: het woord
  `centen` als identifier ging van 431 in 110 bestanden naar 282 in 70. Wat
  overblijft zijn velden en variabelen die een bedrag in centen VASTHOUDEN — die
  heten naar wat ze zijn, niet naar wat ze doen, en die mogen zo heten. Hier
  stond eerder "104 aanroepen in 40 bestanden" voor alleen al `kern/util.js`;
  nagemeten waren dat er **37 in 7**. Een getal uit het hoofd is in dit document
  net zo goed een schermleugen als op een scherm.

  **Drie wachten houden het tegen, en ze zijn er niet in één keer gekomen.**
  `test/geldeenheid.test.js` toets 7 houdt het aantal functies dat `centen` heet
  én van eenheid verandert op **nul**; toets 7b is strenger en laat helemaal geen
  FUNCTIE meer toe die zo heet; toets 7c verbiedt elke AANROEP `.centen(`. Toets
  8 laat de meters zelf uitslaan op een bekend-foute invoer, want een toets die
  je niet hebt zien zakken is geen toets (`LAT.md` regel 10). Alle drie lezen
  `server/` én `public/`.

  Toets 7c bestaat omdat een hernoemer namen ná een punt MOET overslaan — anders
  sneuvelt elk veld dat `centen` heet, en dat zijn er honderden. Precies daardoor
  bleven twee aanroepen staan: `ctx.centen(...)` in `kern/rtfos/steden.js` en
  `horeca.centen(...)` in `kern/gast/beleid.js`. Allebei stil kapot, allebei op
  een route die geld aanneemt. Die wacht kan alleen bestaan omdát 7b de andere
  kant dichtzet: als er geen functie `centen` meer bestaat, is iedere `.centen(`
  per definitie een aanroep van `undefined`. Twee regels die elkaar dragen zijn
  sterker dan twee die naast elkaar staan.

  **En 7b verdiende zichzelf meteen terug.** Hij vond de zevende omzetter
  (`kern/rtfos/basis.js`) nadat de modules die hem gebruiken al hernoemd waren.
  Die stonden dus te destructureren op een naam die de context niet gaf — in
  JavaScript geen fout maar `undefined`, dat pas klapt als die regel draait. Op
  het geldpad bleven de rtfos-toetsen groen; die takken zijn niet gedekt. Daarom
  staat er nu
  `test/rtfos-context.test.js`: die BOUWT de gedeelde context en leest van elke
  module wat hij eruit haalt — 47 modules, 412 namen. Op zijn eerste ronde vond
  hij meteen een tweede stille fout in dezelfde laag: een ontbrekende `require`.
  Die had keuringsregel 50 óók gezien; de winst is dat een toets van seconden hem
  eerder vindt dan een keuring van minuten. Wat regel 50 níét ziet is het eerste
  geval: daar wás de naam gebonden, door de destructurering zelf, en ontbrak
  alleen de waarde aan de andere kant.

  **En de toets moest zelf worden verbreed, wat het punt nog eens maakt.** Hij
  las alleen `const { … } = ctx`, dus `ctx.centen(bedrag)` glipte erlangs. Twee
  vormen om iets uit een context te halen betekent twee lezingen, en de tweede
  is er pas gekomen nadat een bestaande toets (`rtfos.test.js`, de rolgrens) een
  500 liet zien op `/api/rtfos/stad/limiet`. Die had de fout dus wél te pakken —
  wat er eerder over die veertig toetsen stond, geldt voor het geldpad en niet
  voor de hele laag.

  En de eenheidssplitsing zelf staat er als eerste grove snede, mét wat hij niet
  ziet: **41 in centen, 5 in euro's, 0 gemengd, 46 niet vast te stellen**. Dat
  nulletje is nieuw: de drie sommen die eerder twee eenheden door elkaar
  gebruikten zijn er niet meer. Die laatste helft is te groot om er een conclusie
  op te bouwen, en dat staat er liever dan een getal dat zekerder klinkt dan het
  is.
---

## 7. Wat dit document níét zegt

Het zegt niet dat de meting `Koopbaar` heeft *weerlegd* als idee. Het zegt dat
`Koopbaar` als **interface van acht verplichte methodes** niet in deze code te
vinden is, en dat hij als **verklaring van werkwoorden** wél kan. Dat is een andere
vorm, geen kleinere ambitie.

Het zegt ook niets over of de domeinen *zouden moeten* kunnen wat ze niet kunnen.
"`kern/retail` kent geen retour" betekent: er staat vandaag niets. Niet dat het
daar niet hoort. De meting is een prijskaart, geen foutenlijst.

**De laag meet zichzelf mee, en dat levert meteen een illustratie op.** Sinds
`kern/commerce/` bestaat, telt de meting hem als het honderdste koopbare domein.
Hij scoort 2 van 8 — `toon` en `bevestig` — en die tweede is *onterecht*: de
werkwoordfamilie `bevestig` bevat het patroon `koop`, en `koopbaar.js` heet
`koopbaar`. Precies de vergissing waar de kop van `scripts/commerce.js` voor
waarschuwt, nu in het bestand dat de waarschuwing schreef. Het is één domein van
de honderd en het verandert geen enkele conclusie, maar het staat hier omdat een
meting die haar eigen ruis verzwijgt, precies zo betrouwbaar oogt als een die dat
niet doet.

En het meet namen, geen betekenissen. Een `bevestig` in `kern/reservering`
bevestigt een tafel; een `bevestig` in `kern/appstore` bevestigt een aanschaf.
Waar twee werkwoorden hetzelfde werkwoord zijn, beslist een mens die beide
modules opent — daarom staat in `COMMERCE.json` bij elk werkwoord wáár het vandaan
komt.

---

*Draai de meting opnieuw met `npm run commerce`; leg hem vast met
`npm run commerce:vast`. Zakt `test/commerce.test.js`, dan meet hij iets anders
dan hij zegt.*
