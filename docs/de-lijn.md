# De lijn: wat we zelf bouwen, wat bewust niet, en waarom

RTG bouwt vrijwel alles zelf. Dat is een keuze, geen toeval, en het is geen
absoluut principe. Dit document legt de lijn vast waar zelfbouw ophoudt, zodat
die wijsheid niet alleen in iemands hoofd en in de commit-historie zit.

De vuistregel in één zin:

> **Zelf bouwen waar controle waarde schept, en beproefde fundamenten waar een
> fout fataal is.**

De naïeve versie van "alles zelf" schrijft zijn eigen cryptografie en verliest
ledengeld. De onze bouwt zijn eigen alles *behalve* de handvol dingen waar een
fout onherstelbaar is. Dat verschil is de hele filosofie.

---

## Wat we zelf bouwen

Overal waar controle het product ís, of waar een afhankelijkheid meer risico dan
gemak brengt. In deze code betekent dat:

- **De hele frontend.** Geen React, geen jQuery, geen CSS-framework. Een eigen,
  klein reactief componentje (`Util.el` in `public/apps/util.js`), eigen
  a11y-helpers, eigen i18n (`public/shared/i18n.js` + de server-laag). Gevolg: de
  browser laadt **niets van derden** en de CSP kan echt op slot (`'self'`, verder
  niets). Voor een privacy-merk is dat geen detail, dat is het product.
- **De opslaglaag** (`server/db.js`): één interface met drie backends
  (in-memory JSON, embedded `node:sqlite`, PostgreSQL), inclusief een eigen
  drieweg-merge (`merge3`) voor gelijktijdige schrijvers en fsync-durability.
- **De realtime-laag**: eigen SSE-routing plus een bus-abstractie
  (`server/bus.js`) die over losse processen werkt.
- **De betaal-naad** (`server/betaal.js`): de *interface* is van ons —
  idempotentie, de durable dedup-store, de webhook-verificatie — zodat dubbel
  afschrijven onmogelijk is, ongeacht de provider erachter.
- **Alle productlogica en genres**: horeca, verblijf, vervoer, verhuur, verkoop,
  charter, activiteiten, vastgoed, retail, groothandel, beveiliging, De Salon,
  de directe betalingen, de ontmoetingen. Dit is waar het bedrijf zit; dit hoort
  van eigen huis te zijn.
- **De build** (`scripts/build.js`), de checks (`scripts/check.js`), de
  toegankelijkheidskeuring, de belastingtests (`spitsuur`, `orkaan`). Ook het
  gereedschap is grotendeels eigen.
- **Sinds kort ook de lettertypen** (`public/fonts/`): zelf geserveerd, zodat er
  letterlijk geen enkele verbinding met een derde partij overblijft in de
  browser van de bezoeker.

Winst: geen supply-chain-aanval via een pakket-update, geen dependency die
morgen breekt of verdwijnt, geen black box om in te turen tijdens een incident.
Elke regel is te begrijpen en te verdedigen.

---

## Wat we bewust NIET zelf bouwen

Op precies drie soorten plekken leunen we op beproefde fundamenten, omdat een
fout daar niet te herstellen is met een hotfix.

**1. Cryptografie — nooit zelf.** We gebruiken uitsluitend de ingebouwde
`crypto` van Node: `scrypt` voor wachtwoorden en pincodes, `sha256` voor
sessietokens, `randomBytes`/`randomInt` voor codes en pincodes (nooit
`Math.random` voor iets dat geheim moet zijn), `timingSafeEqual` voor
constante-tijd-vergelijkingen. Zelfgeschreven crypto is de klassieke manier
waarop een trots project zichzelf opblaast. Dit is de scherpste regel: **rol
nooit je eigen encryptie, hashing of toevalsbron.**

**2. Echt geld en identiteit — achter een naad.** Stripe verplaatst het echte
geld; wij bouwden de *naad* eromheen, niet de PCI-afhandeling. Zo houden we
controle over de logica zonder de aansprakelijkheid van kaartgegevens naar ons
toe te trekken. Hetzelfde geldt voor **cryptomunten** (`server/muntbetaal.js`):
we accepteren munten voor onze eigen diensten en zetten ze meteen om naar euro's
via een vergunninghoudende aanbieder. De *ontvanger*, de gelockte koers, de
idempotentie en het grootboek zijn van ons; de custody, de on-chain afhandeling
en de conversie liggen bij die aanbieder. Zelf wallets of sleutels beheren zou
regel 1 breken (eigen crypto is verboden) en zou ons bovendien tot een
vergunningplichtige crypto-dienstverlener (CASP) maken. Door meteen naar euro om
te zetten blijven we een handelaar die munten accepteert, geen wisselkantoor.

**3. De vier runtime-fundamenten.** Bewust klein gehouden:

| Pakket | Waarom niet zelf |
|---|---|
| `express` | HTTP-routing, jaren dichtgetimmerd tegen randgevallen die je niet in een middag reproduceert. |
| `@anthropic-ai/sdk` | De AI-butler; het model draait niet bij ons. |
| `nodemailer` | SMTP met alle protocol-eigenaardigheden. |
| `web-push` | VAPID en de encryptie van webpush-payloads, cryptografisch werk (zie regel 1). |

En vier **optionele** pakketten die alleen laden als je ze configureert —
zonder deze draait alles gewoon door in demo/lokaal:

| Pakket | Rol | Zonder |
|---|---|---|
| `stripe` | echt geld | demo-provider (geen echt geld) |
| `pg` | PostgreSQL, de schaalweg boven ~1,5 mln leden | embedded sqlite/JSON |
| `redis` | realtime over losse processen | realtime binnen één proces |
| `@sentry/node` | externe fout-tracking | eigen gestructureerde logging |

Dev-only: `axe-core` (a11y-keuring) en `terser` (minify). Die raken de productie
nooit.

---

## De grens die we uit ervaring kennen

Zelfbouw heeft een plafond, en we kennen het precies. De `orkaan`-belastingtest
(`scripts/orkaan.js`, 10 miljoen gebruikers, alle diensten tegelijk) liet zien:
de productlogica is orkaanbestendig — correctheid, geld en herstel blijven
overeind onder totale overbelasting — maar de **embedded opslag** serialiseert
bij elke `save()` de hele collectie en loopt daarop vast rond ~1,5 miljoen
gids-leden. Daarboven is PostgreSQL de weg. Dat is geen zwakte van "zelf
bouwen"; het is weten wáár zelfbouw ophoudt en een database-engine met dertig
jaar opgeloste randgevallen het overneemt.

---

## De regel voor de volgende beslissing

Sta je voor de keuze "zelf bouwen of een pakket erbij?", loop dan deze vragen
langs:

1. **Is het cryptografie, of iets waar een fout geld of identiteit lekt?**
   Zelf bouwen is verboden. Gebruik de ingebouwde `crypto` of een beproefd,
   smal pakket achter een naad.
2. **Codeert een volwassen bibliotheek jaren verborgen randgevallen** (tijdzones,
   protocol-eigenaardigheden, i18n-meervoud, betaal-compliance)? Leun erop, maar
   zet er een dunne eigen naad omheen zodat je later kunt wisselen.
3. **Is het product- of UI-logica, of iets waar controle de waarde is?**
   Bouw het zelf. Dat is waar RTG zich onderscheidt.
4. **Voegt het pakket een verbinding met een derde toe in de browser?**
   Dan bijna nooit. De belofte "niets van derden" is technisch afgedwongen via
   de CSP en dat houden we zo.

Twijfel je tussen 2 en 3, kies dan de naad: bouw de interface zelf, zet er
desnoods tijdelijk een pakket achter. Zo blijft de lijn verschuifbaar zonder dat
de rest van de code het merkt, precies zoals `server/betaal.js` en
`server/db.js` het nu doen.
