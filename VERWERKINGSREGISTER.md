# Verwerkingsregister (AVG art. 30)

Dit register is opgesteld op basis van wat de code werkelijk doet, niet op basis
van een sjabloon. Elke regel is te herleiden naar een module in deze repository.

**Nog te doen voordat dit klopt:** de velden gemarkeerd met `[VUL IN]` kunnen
alleen door RTG zelf worden ingevuld, en een jurist hoort het geheel na te
kijken. Zolang die velden openstaan, blokkeert `npm run golive`.

- **Verwerkingsverantwoordelijke:** `[VUL IN -- juridische naam, KvK, adres]`
- **Contactpersoon privacy:** `[VUL IN -- naam + e-mail]`
- **Functionaris gegevensbescherming:** `[VUL IN -- of: niet verplicht, met reden]`
- **Laatst bijgewerkt:** `[VUL IN -- datum]`

---

## Het ontwerp in één alinea

RTG draait op **pseudonimisering**. De operationele gegevens (bestellingen,
boekingen, gesprekken, De Salon) staan onder een **codenaam**, nooit onder een
naam. De echte naam, het e-mailadres en het telefoonnummer liggen versleuteld
(AES-256-GCM) in een aparte kluis met een sleutel die buiten de database
hoort te staan. Zie `server/accounts/kluis.js`.

Let op de juridische kant: **pseudonimisering is geen anonimisering.** De
gegevens onder een codenaam blijven persoonsgegevens, omdat wij de sleutel
hebben om ze te herleiden. Het register hieronder behandelt ze dan ook als
persoonsgegevens. Wat pseudonimisering wél oplevert is een passende
beveiligingsmaatregel (art. 32): een gestolen database toont codenamen.

Elke blik in de kluis wordt vastgelegd in het inzagejournaal
(`server/inzagelog.js`): wie, wanneer, welk account, en waarom.

De bewaartermijnen hieronder staan niet alleen op papier. `server/bewaarwacht.js`
telt dagelijks wat er over zijn termijn staat en meldt dat maandelijks op het
technische bord; `server/bewaartermijnen.js` houdt het beleid zelf bij. Die wacht
**wist nooit uit zichzelf** -- opruimen is een menselijke handeling met een
bevestiging. Dat onderscheid is bewust: het maakt de opslagbeperking
aantoonbaar (art. 5 lid 2) zonder dat een automaat administratie kan weggooien
die zeven jaar moet blijven.

---

## Verwerkingen

### 1. Ledenaccount en toegang

| | |
|---|---|
| **Doel** | Iemand een account geven, laten inloggen, en de juiste pas tonen |
| **Grondslag** | Uitvoering van de overeenkomst (art. 6 lid 1 b) |
| **Categorieën personen** | Leden (RTG, Lifestyle, Business), gasten |
| **Gegevens** | Naam, e-mailadres, telefoonnummer (versleuteld in de kluis); codenaam, pastype, wachtwoordhash (scrypt), sessietokens |
| **Waar** | `server/accounts/` -- `rtg.db`, kolommen `enc_name`, `enc_email`, `enc_phone` |
| **Ontvangers** | Niemand buiten RTG |
| **Bewaartermijn** | Zolang het account bestaat; verwijderen op verzoek via `/api/privacy/delete` |
| **Beveiliging** | Versleuteling at rest, sleutel uit een secrets manager (verplicht in productie), inzagejournaal bij elke ontsleuteling |

### 2. Identiteitsverificatie (KYC)

| | |
|---|---|
| **Doel** | Vaststellen dat iemand is wie hij zegt, en oud genoeg is |
| **Grondslag** | Wettelijke verplichting bij leeftijdsgrenzen (art. 6 lid 1 c); overigens gerechtvaardigd belang: fraude tegengaan (art. 6 lid 1 f) |
| **Gegevens** | Identiteitsdocument (upload), geboortedatum, nationaliteit, geslacht uit het paspoort, gezichtsvergelijking (ja/nee) |
| **Bijzondere categorie?** | Een pasfoto is **geen** biometrisch gegeven zolang er geen geautomatiseerde herkenning op draait. Wordt dat wel ingebouwd, dan valt het onder art. 9 en is een aparte grondslag nodig. `[CONTROLEER dit bij de jurist voordat er gezichtsherkenning bij komt]` |
| **Waar** | `server/kern/kantoor/` (`pendingVerifications`), upload in `UPLOAD_DIR` |
| **Ontvangers** | RTG-backoffice. Elke inzage komt in het inzagejournaal |
| **Bewaartermijn** | `[VUL IN -- advies: document verwijderen zodra de verificatie rond is; alleen de uitkomst bewaren]` |

### 3. Bestellingen, boekingen en betalingen

| | |
|---|---|
| **Doel** | Een bestelling of boeking uitvoeren en afrekenen |
| **Grondslag** | Overeenkomst (art. 6 lid 1 b); de administratie zelf: wettelijke verplichting (art. 6 lid 1 c) |
| **Gegevens** | Codenaam, bedragen, tijdstippen, de zaak, orderregels |
| **Ontvangers** | De betrokken partner-zaak (ziet de codenaam, niet de naam); de betaalprovider |
| **Bewaartermijn** | **7 jaar** -- fiscale bewaarplicht (art. 52 AWR). Deze mogen niet eerder weg; zie `server/bewaartermijnen.js` |

### 4. De Salon, gesprekken en sociale functies

| | |
|---|---|
| **Doel** | Leden onderling en met zaken laten communiceren |
| **Grondslag** | Overeenkomst (art. 6 lid 1 b) |
| **Gegevens** | Codenaam, berichten, foto's, connecties |
| **Bewaartermijn** | Gastgesprekken 1 jaar, gesprekken tussen leden 2 jaar, snaps en verhalen 24 uur |

### 5. Locatie

| | |
|---|---|
| **Doel** | Live meekijken tijdens een rit of bezorging, en de zorgketen |
| **Grondslag** | **Toestemming** (art. 6 lid 1 a) -- het lid zet het zelf aan en kan het intrekken |
| **Gegevens** | Coördinaten, gekoppeld aan de codenaam |
| **Bewaartermijn** | Kort; niet langer dan de rit `[BEVESTIG de exacte termijn]` |

### 6. Werk en sollicitaties

| | |
|---|---|
| **Doel** | Solliciteren op een vacature bij een partner |
| **Grondslag** | Precontractueel, op verzoek van de betrokkene (art. 6 lid 1 b) |
| **Gegevens** | CV, motivatie, contactgegevens; bij de match-tabel alleen de voornaam, en alleen van wie zichzelf op "open voor werk" heeft gezet |
| **Ontvangers** | De werkgever bij wie is gesolliciteerd |
| **Bewaartermijn** | 1 jaar; daarna weg. Bij verwijdering van het account worden lopende sollicitaties geanonimiseerd, zodat de werkgever zijn administratie houdt zonder herleidbaarheid |

### 7. Zorg- en allergiegegevens

| | |
|---|---|
| **Doel** | Voorkomen dat iemand iets krijgt waar hij niet tegen kan |
| **Grondslag** | **Uitdrukkelijke toestemming** (art. 9 lid 2 a) -- dit is een **bijzondere categorie** (gezondheid) |
| **Gegevens** | Allergieën, medische aandachtspunten, intake bij RTG Care |
| **Ontvangers** | Alleen de zaak waar het lid op dat moment iets afneemt, en alleen wat nodig is |
| **Let op** | Bijzondere persoonsgegevens hebben een zwaarder regime: expliciete toestemming, strikte toegang, en een DPIA is hier waarschijnlijk verplicht. `[TE DOEN: DPIA laten uitvoeren]` |

### 8. Beveiligingslogboek en inzagejournaal

| | |
|---|---|
| **Doel** | Aanvallen herkennen; kunnen navertellen wie in de identiteitskluis heeft gekeken |
| **Grondslag** | Gerechtvaardigd belang: beveiliging (art. 6 lid 1 f) |
| **Gegevens** | IP-adressen, tijdstippen, account-id's, reden van inzage. **Geen namen** -- het inzagejournaal bewaart bewust geen namen, anders was het een tweede onversleutelde kopie van de kluis |
| **Bewaartermijn** | Beveiligingslogboek 1 jaar, inzagejournaal 2 jaar |

---

## Verwerkers (art. 28) -- met wie moet een overeenkomst

Iedere partij hieronder verwerkt persoonsgegevens **namens** RTG. Zonder
verwerkersovereenkomst is dat een overtreding, en ligt de aansprakelijkheid bij
RTG.

| Partij | Wat zij verwerken | Overeenkomst? |
|---|---|---|
| Hostingpartij / VPS | Alles wat op de schijf staat | `[VUL IN]` |
| Cloudflare of andere CDN/WAF | IP-adressen, verzoeken | `[VUL IN]` |
| Betaalprovider (Stripe) | Betaalgegevens, bedragen | `[VUL IN]` |
| E-mailverzender (SMTP) | E-mailadressen, berichtinhoud | `[VUL IN]` |
| Anthropic (AI, indien `ANTHROPIC_API_KEY` is gezet) | Wat er in een gesprek met Rahul wordt getypt | `[VUL IN]` |
| Sentry (indien `SENTRY_DSN` is gezet) | Foutmeldingen, mogelijk met context | `[VUL IN]` |
| **Elke partner-zaak** | Codenaam, bestelling, eventueel zorgprofiel | `[VUL IN -- dit zijn er veel; regel het in het onboarding-proces]` |

De laatste rij is de belangrijkste en de makkelijkste om te vergeten: elke
horecazaak, elk hotel en elke vervoerder die de app gebruikt is een verwerker.

## Doorgifte buiten de EU

`[VUL IN]` -- controleer per verwerker hierboven. Let in elk geval op de
AI-aanbieder en de foutentracker; die verwerken vaak buiten de EU en vragen dan
om aanvullende waarborgen.
