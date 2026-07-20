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
  toegankelijkheidskeuring, en de belastings- en misbruik-beproeving
  (`scripts/beproeving.js`, `npm run beproeving`). Ook het gereedschap is
  grotendeels eigen.
- **De AST-scanner** (`scripts/ast/` + `scripts/ast-scan.js`, `npm run ast-scan`):
  een volledig zelfgebouwde statische analyse -- eigen lexer, eigen recursive-
  descent parser (bouwt een echte AST), eigen walker en eigen regels -- zonder
  ook maar een parser-dependency. Bewust veilig: code die de parser niet begrijpt
  is een HARDE fout, geen stille overslag (een security-scanner die code mist
  geeft valse zekerheid). De parser is geborgd doordat hij de hele boom van
  server/ + scripts/ leest; in de test is de boom bovendien knoop-voor-knoop
  gelijk aan een volwassen parser. De regels bewaken juist de afspraken van deze
  lijn: geen require van een pakket dat we zelf bouwen, geen eval/Function, geen
  Math.random als toevalsbron voor een geheim (regel 1), en onbereikbare code.
  Dit is aanvullend op CodeQL, niet in plaats daarvan.
- **De minifier** (`scripts/ast/print.js` + `minify.js`, in `scripts/build.js`):
  bouwt voort op diezelfde eigen parser en verving `terser` (en daarmee ook acorn).
  Parse -> compact printen (commentaar/witruimte weg, haakjes alleen waar de
  voorrang ze eist). Bewust veilig: als de geprinte code niet EXACT dezelfde boom
  oplevert, valt hij per bestand terug op de bron -- nooit iets kapots uitgeleverd.
  We manglen (nog) geen namen: een foute hernoeming zou stille kapotte client-code
  opleveren, en over de lijn haalt gzip het meeste van dat verschil toch weg
  (gemeten ~8% gezipt t.o.v. terser). Een dependency minder, geen risico erbij.
- **Sinds kort ook de lettertypen** (`public/fonts/`): zelf geserveerd, zodat er
  letterlijk geen enkele verbinding met een derde partij overblijft in de
  browser van de bezoeker.
- **En de STUN-server voor (video)bellen** (`server/stun.js`): een eigen
  RFC 5389-responder op UDP, zodat de verbindingsopzet niet meer langs de publieke
  STUN van Google gaat. Het is puur het terugkaatsen van de afzender -- geen
  cryptografie -- dus het botst niet met regel 1. De harde NAT-gevallen blijven
  via een eigen TURN-relais (coturn) lopen.
- **De rate-limiter** (`server/rem.js`): een kleine in-memory rem (vaste-venster-
  telling per IP of eigen sleutel) die `express-rate-limit` verving. Het is precies
  het telwerk dat we nodig hebben -- de brede productie-rem in `server.js` en de
  twee Theater-remmen draaien er nu op -- en scheelt een dependency die alleen maar
  optelde. Puur tellen, geen cryptografie, dus geen botsing met regel 1.
- **De fout-aggregatie** (`server/log.js`): een in-memory ring die onverwachte
  serverfouten groepeert op een vingerafdruk (genormaliseerd bericht + plaats) met
  een teller, en ze op het techniekbord toont (ERR-01 + de storingslijst). Zo ziet
  de eigenaar meteen wat er stuk is zonder een externe dienst. `@sentry/node` blijft
  optioneel bovenop deze aggregatie voor wie externe tracking wil.
- **De web-push** (`server/webpush.js`): VAPID (RFC 8292, ES256-JWT) en de payload-
  versleuteling (RFC 8291, aes128gcm) die het pakket `web-push` verving. Let op de
  nuance bij regel 1: we schrijven hier GEEN eigen cryptografie. We zetten alleen de
  bekende protocolstappen op elkaar met Node's standaard-primitieven -- ECDH (P-256),
  HKDF-SHA256, AES-128-GCM, ECDSA -- allemaal uit `node:crypto`. Dat is protocol-
  assemblage, geen eigen crypto. De payload-versleuteling is byte-voor-byte tegen het
  RFC 8291-testvector geijkt (`test/webpush.test.js`).
- **De Claude-client** (`server/anthropic.js`): een dunne eigen HTTPS-client naar
  de Messages-API die `@anthropic-ai/sdk` verving. Het MODEL blijft bij Anthropic
  draaien -- dat kunnen en willen we niet zelf zijn -- we vervangen alleen de
  HTTP-omhulling (headers, JSON, herproberen bij 429/5xx). Zelfde vorm als het
  pakket (`new Anthropic().messages.create(...)`), dus de ~50 aanroepplekken en de
  tool-lus merken er niets van. Scheelt de grootste dependency-boom.
- **De WebAuthn-verificatie** (`server/webauthn.js`): passkeys (registreren en
  inloggen met vingerafdruk/gezicht/hardwaresleutel) die `@simplewebauthn/server`
  verving. Let op dezelfde nuance bij regel 1 als bij web-push: we schrijven GEEN
  eigen cryptografie. We zetten alleen de WebAuthn-protocolstappen op elkaar met
  Node's standaard-primitieven -- SHA-256 en handtekeningverificatie (ECDSA P-256,
  RSA PKCS#1v1.5, Ed25519) uit `node:crypto`. Het enige echt eigen stuk is een
  kleine CBOR-lezer voor het attestationObject en de COSE-sleutel; dat is puur een
  binair formaat decoderen, geen crypto. Scope: attestatie 'none' (we vragen geen
  attestatie op -- we willen niet weten welk merk authenticator iemand gebruikt);
  de identiteit wordt bij het inloggen bewezen via de assertion-handtekening over de
  opgeslagen publieke sleutel. Geborgd door een synthetische ceremonie-test
  (`test/webauthn-eigen.test.js`); tijdens de bouw byte-voor-byte gelijk bevonden
  aan het pakket. Zelfde vorm en veldnamen, dus `kern/webauthn.js` merkt er niets van.
- **De SMTP-verzending** (`server/smtp.js`): het versturen van e-mail (verificatie-
  en herstel-links, meldingen) die `nodemailer` verving. Zelfde nuance bij regel 1:
  de versleuteling van de verbinding komt volledig uit `node:tls` (implicit TLS of
  STARTTLS) -- geen eigen crypto. Wij zetten alleen de SMTP-protocolstappen op elkaar
  (EHLO, STARTTLS, AUTH, MAIL/RCPT/DATA) plus een correcte MIME-opmaak. Bewust smal
  en eerlijk: dit is een SUBMISSION-client naar een geconfigureerde smarthost
  (`SMTP_URL` van een provider), geen volwaardige MTA -- geen MX-resolutie of eigen
  wachtrij; dat doet de provider erachter, en zonder `SMTP_URL` valt `server/mail.js`
  terug op de outbox. Credentials gaan NOOIT over een onversleutelde verbinding.
  Geborgd met een test tegen een nep-SMTP-server (`test/smtp.test.js`, incl. STARTTLS
  + AUTH LOGIN/PLAIN); tijdens de bouw naast nodemailer gelegd (zelfde commando-reeks).
  Zelfde vorm (`createTransport(url).sendMail(...)`), dus `server/mail.js` merkt er niets van.
- **Het web-framework** (`server/web.js`): de HTTP-routering en middleware die
  `express` verving -- de laatste verplichte runtime-dependency. Puur op `node:http`:
  router met `:params` en RegExp-paden, middleware-ketens met `next(err)` en fout-
  afhandelaars, het mounten van sub-routers (met het strippen van het mount-pad),
  body-parsers (`web.json`/`web.raw` met limiet en type-match) en statische bestanden
  (`web.static`) inclusief Range voor de video's, voorwaardelijke GET/304 en
  bescherming tegen pad-traversal. Zelfde vorm en veldnamen als express
  (`app.get/post/use`, `req.body/params/query`, `res.status().json()`), plus een
  express-compatibele `app._router.stack` zodat de AI-routekaart (`kern/stuur.js`)
  ongewijzigd blijft -- dus server.js, de ~1100 routes, de foundation-router en de
  noodserver merken er niets van. Geborgd op twee niveaus: de hele testsuite draait
  het echte systeem eroverheen (1023 tests, incl. auth, SSE en de webhooks), en een
  eigen test toetst het framework los (`test/web.test.js`). Zie de nuance hieronder:
  dit was een bewuste keuze om de eerder getrokken lijn te verschuiven, niet regel 1.

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

**3. De runtime-fundamenten.** Deze categorie is inmiddels leeg: er is **geen
enkel verplicht runtime-pakket** meer. `express` was de laatste, en die is nu
`server/web.js` (zie hierboven). `package.json` heeft dus `dependencies: {}`.

Een eerlijke kanttekening, want dit dócument beschreef `express` eerder juist als
een bewust behouden fundament ("jaren dichtgetimmerd tegen randgevallen"). Het
vervangen ervan is een bewuste keuze geweest om de lijn te verschuiven, op verzoek
van de eigenaar en in dezelfde geest als de andere zelfbouw: **niet** omdat routing
onder regel 1 valt (dat doet het niet -- het is geen cryptografie en lekt geen geld
of identiteit), maar omdat de gebruikte deelverzameling klein en te overzien is, en
de volledige testsuite het echte systeem eroverheen draait als vangnet. De
randgevallen die express wél afdekte en wij niet gebruiken (view-engines, cookies,
content-negotiation) staan bewust niet in `web.js`. Zou er ooit een web-randgeval
opduiken dat dit framework mist, dan is de eerlijke stap terug: `express` er weer
achter zetten -- de vorm is identiek, dus dat kan zonder de rest te raken.

En vier **optionele** pakketten die alleen laden als je ze configureert —
zonder deze draait alles gewoon door in demo/lokaal:

| Pakket | Rol | Zonder |
|---|---|---|
| `stripe` | echt geld | demo-provider (geen echt geld) |
| `pg` | PostgreSQL, de schaalweg boven ~1,5 mln leden | embedded sqlite/JSON |
| `redis` | realtime over losse processen | realtime binnen één proces |
| `@sentry/node` | externe fout-tracking (bovenop de eigen aggregatie) | eigen in-memory fout-aggregatie op het techniekbord |

Dev-only: alleen nog `axe-core` (a11y-keuring). De minify doen we zelf
(`scripts/ast/`), dus terser -- en daarmee acorn -- is eruit. Dev-only raakt de
productie sowieso nooit.

---

## De grens die we uit ervaring kennen

Zelfbouw heeft een plafond, en we kennen het precies. De Beproeving
(`scripts/beproeving.js`, tot 65 miljoen leden, alle diensten + misbruik-scenario's
tegelijk) laat zien: de productlogica is beproevingsbestendig — correctheid, geld,
privacy en herstel blijven overeind onder totale overbelasting. De grens zat in de
**embedded JSON-opslag**, die bij elke `save()` de hele collectie serialiseerde en
daarop vastliep rond ~1,5 miljoen gids-leden. Daarvoor zijn er nu twee wegen: de
**GEHEUGEN-motor** (`RTG_STORE=geheugen`), die per collectie versleuteld en
incrementeel wegschrijft en zo veel verder reikt zonder externe database, en
PostgreSQL voor de echt grote, gedeelde opzet. Dat is geen zwakte van "zelf
bouwen"; het is weten wáár welke motor het beste past.

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
