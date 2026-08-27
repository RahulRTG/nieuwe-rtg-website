# RTG Commerce — de laag boven de domeinen

*Gemeten op 27 augustus 2026 met `scripts/commerce.js`, opnieuw vastgelegd nadat
`kern/commerce/` er zelf bij kwam; de uitslag staat in
`COMMERCE.json` en wordt bewaakt door `test/commerce.test.js`.*

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

**437 vormen met een prijsveld, in 100 van 430 domeinen.** Na aftrek van de
42 envelop-velden blijven er 849 velden over, waarvan **660 (78%) in precies één
domein** voorkomen. Van de 437 koopbare vormen halen **7 paren** uit verschillende
domeinen de 60%-drempel.

De acht werkwoorden, over die 100 domeinen:

| werkwoord | domeinen | |
|---|---|---|
| `toon` | 80 van 100 (80%) | ████████████████ |
| `bevestig` | 45 van 100 (45%) | █████████ |
| `beschikbaarheid` | 43 van 100 (43%) | █████████ |
| `prijs` | 30 van 100 (30%) | ██████ |
| `reserveer` | 22 van 100 (22%) | ████ |
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
| **`kern/retail`** | • | | • | | • | | | | **3/8** |
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

**`kern/retail` haalt 3 van 8**, terwijl dat het domein is waar iedereen naar
wijst als hij "webshop" zegt. Het heeft varianten, SKU's en voorraad op de
variant — en geen prijsfunctie, geen levering, geen annulering, geen retour. De
webshop bouwen betekent dus niet "retail ontsluiten" maar *retail afmaken*.

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
begrip waar samenvoegen echt iets oplevert: er staan nu **24 vormen die regels
dragen** (een aantal naast een bedrag) in **17 domeinen**, en daarvan zijn er
**22 verschillend**. Ze delen dus vrijwel niets — anders dan bij `Koopbaar` is
hier geen bestaand type dat kapotgemaakt wordt.

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
- **Wat een aanbod NIET kan, met de reden erbij.** De unieke opbrengst van deze
  laag. Een ondernemer ziet per regel waarom er geen koopknop staat, en het
  verschil tussen *er is iets te doen* (zet een prijs) en *er is niets aan de
  hand* (een offerte-aanvraag hoort geen koopknop te hebben).

### Een stap weg

- **`kern/retail` afmaken tot 6/8.** Prijsfunctie, levering, annulering — de drie
  die het domein mist en die `kern/mall` en `kern/horeca` al hebben.
- **Een exacte prijs waar nu een vanaf-prijs staat.** Op de seed dragen 12 van de
  92 koopbaren met een bedrag een *indicatie* (`vanaf`) in plaats van een
  afrekenbedrag: reizen, verblijven en menukaarten waarvan de prijs van de datum
  of het gerecht afhangt. Die worden getoond en niet verkocht, want wie op een
  vanaf-prijs afrekent incasseert iets wat niemand heeft afgesproken. Het echte
  bedrag hoort uit het domein zelf te komen.
- **Het geld van een retour werkelijk terugstorten.** Het besluit staat klaar met
  bedrag, btw-deel en tarief; een mens voert het uit langs `kern/pay` met de
  bevoegdheid die daarvoor bestaat. Die knop komt er niet als bijproduct van een
  statusknop bij — maar de weg van dat klaargezette besluit naar de uitbetaling
  is nog met de hand.
- **Bevestigen vanuit de mand.** De afrekening rekent door, stopt bij de deur en
  **wijst hem aan**: elke afrekening draagt `bevestigBij` met de plek(ken) waar
  die verkoper werkelijk bevestigt, en het scherm zet er een link heen. Meerdere
  deuren bij één verkoper worden ook als meerdere getoond — een tafel en een
  artikel worden niet op dezelfde plek bevestigd, en dat samentrekken zou een
  belofte maken die de kern juist weigert. Wat er nog niet is: de bestelling
  meegeven aan dat domein, zodat de koper daar niet opnieuw begint. Dat is een
  overdracht en geen tweede orderwaarheid, maar hij is nog niet gebouwd.

### Vraagt een besluit van de eigenaar

- ~~Het woord `Kanaal`~~ — **genomen** (par. 3): hernoemd, `KANALEN` is uit de
  botsingstop en het woord is van de verkoopweg.
- **Publiek verkopen op een eigen domein.** `kern/webdomein.js` staat standaard
  uit met twee sloten, en de reden staat er: *binnen het huis leest alleen een
  ingelogd lid een site; op een eigen domein leest iedereen hem.* Een publieke
  winkel is die grens, één stap verder. Dat is een besluit, geen ontbrekende code
  — en het raakt `CLAUDE.md` ("geen marketingsite terugbouwen"), al is de winkel
  van een partner iets anders dan de etalage van RTG.
- **Betaalroutering en zelfherstel.** Technisch een uitbreiding van
  `server/betaal-regie.js`. Maar "RTG kiest de goedkoopste rail" is een belofte
  over andermans geld, en die hoort langs dezelfde vraag als elke andere
  bevoegdheid in `kern/bevoegdheid/lijst.js`.
- **Autopilot, simulatie en causaliteit.** Aantrekkelijk en ver weg. `BESTUUR.md`
  legt de lat: elke bewering draagt een **bewijsgraad** met een datum, en
  *vervallen bewijs is geen bewijs*. Een simulatie die zegt "omzet +7,8%" zonder
  bewijsgraad is een schermleugen — daar is `SCHERMLEUGEN.json` voor.

### Jaren weg

- **De 90 optellingen.** 90 plekken in 49 domeinen rekenen regelbedragen uit of
  tellen ze op. Dat is de prijs van geen gedeelde afrekening, en het is precies
  het patroon dat `fiscaal/tarief.js` al één keer heeft laten ontsporen. Ze zijn
  niet in één ronde samen te brengen, en een poging daartoe die halverwege stopt,
  laat het huis met 91 achter.

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
