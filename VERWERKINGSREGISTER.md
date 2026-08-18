# Verwerkingsregister (AVG art. 30)

Dit register is opgesteld op basis van wat de code werkelijk doet, niet op basis
van een sjabloon. Elke regel is te herleiden naar een module in deze repository.

**Hoe de open velden ingevuld raken:** een aantal plekken hieronder weet alleen
RTG zelf. Ze worden niet met de hand in dit bestand getypt: **Rahul vraagt ze
uit** op de technische pagina, één vraag per keer en met erbij waarom hij het
vraagt. Wat hij te horen krijgt landt hier op de goede plek. Rahul
verzint nooit een antwoord — een verzonnen KvK-nummer is erger dan een leeg
veld, want een leeg veld ziet iedereen. Zolang er iets openstaat, blokkeert
`npm run golive`. Een jurist hoort het geheel daarna alsnog na te kijken.

- **Verwerkingsverantwoordelijke:** {{verantwoordelijke}}
- **Contactpersoon privacy:** {{privacycontact}}
- **Functionaris gegevensbescherming:** {{fg}}
- **Laatst bijgewerkt:** {{bijgewerkt}}

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
| **Bewaartermijn** | {{kyctermijn}} |

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
| **Bewaartermijn** | {{locatietermijn}} |

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
| **Let op** | Bijzondere persoonsgegevens hebben een zwaarder regime: expliciete toestemming, strikte toegang, en een DPIA is hier waarschijnlijk verplicht. **DPIA:** {{dpia}} |

### 8. Beveiligingslogboek en inzagejournaal

| | |
|---|---|
| **Doel** | Aanvallen herkennen; kunnen navertellen wie in de identiteitskluis heeft gekeken |
| **Grondslag** | Gerechtvaardigd belang: beveiliging (art. 6 lid 1 f) |
| **Gegevens** | IP-adressen, tijdstippen, account-id's, reden van inzage. **Geen namen** -- het inzagejournaal bewaart bewust geen namen, anders was het een tweede onversleutelde kopie van de kluis |
| **Bewaartermijn** | Beveiligingslogboek 1 jaar, inzagejournaal 2 jaar |

### 9. Handelingsspoor (wie deed wat)

> **Besluit van de eigenaar, 18 augustus 2026: deze verwerking mag bestaan, in
> de vorm die hieronder staat.** Daarmee is de bouw niet langer geblokkeerd.
>
> Wat dat besluit NIET vervangt: een grondslag is een juridisch oordeel, en de
> twee vetgedrukte plekken hieronder (het bredere bereik dan punt 8, en wat er
> bij vergetelheid gebeurt) horen vóór livegang door een advocaat te worden
> getoetst -- samen met de rest van punt 7 in `LAUNCH.md`. Dat is advies en geen
> blokkade; het staat hier zodat het niet in een gesprek blijft hangen.

| | |
|---|---|
| **Doel** | Kunnen navertellen wat er is gebeurd: bij een incident, bij een klacht, en bij de vraag van een betrokkene "wat is er onder mijn account gedaan" |
| **Grondslag** | Gerechtvaardigd belang: beveiliging en verantwoording (art. 6 lid 1 f) -- dezelfde als punt 8, maar **breder van bereik**, en dat verschil hoort een jurist te wegen |
| **Gegevens** | Tijdstip, de **pseudonieme sleutel** (`user-42`), methode, pad, statuscode, en een **hash van de aanvraag**. Geen namen, geen e-mailadressen, en **nooit de inhoud van de aanvraag zelf** -- een auditlog dat de inhoud bewaart is een tweede onversleutelde kopie van alles wat er ooit is ingevuld, op een plek die juist lang bewaard blijft |
| **Wat het WEL zegt** | Dát er iets is gedaan, door welke sleutel, wanneer, en of twee handelingen hetzelfde verzoek waren |
| **Wat het NIET zegt** | Wat erin stond. De hash is onomkeerbaar |
| **Ontvangers** | RTG-backoffice. De betrokkene ziet zijn **eigen** regels in de AVG-export |
| **Bewaartermijn** | 1 jaar, gelijk aan het beveiligingslogboek. Vastgelegd in `server/bewaarbeleid.js` (tak `handelingLog`), zodat de bewaarwacht hem telt -- een termijn die alleen hier staat, bestaat op papier en nergens anders |
| **Bij vergetelheid** | Het spoor blijft, de sleutel blijft. Dat is een keuze: een auditspoor dat verdwijnt zodra de betrokkene erom vraagt is geen auditspoor meer. Ná wissing verwijst de sleutel naar een account dat niet meer bestaat en is de kluis leeg, dus de regel is dan onherleidbaar. **Laat juist deze afweging toetsen** -- het is de spanning tussen art. 17 (vergetelheid) en het gerechtvaardigd belang hierboven |
| **Beveiliging** | Elke regel draagt de hash van zijn voorganger (`server/lib/keten.js`), dus wijzigen of verwijderen midden in het spoor breekt aantoonbaar. Wat dat niet tegenhoudt: het wegknippen van de nieuwste regels -- daarvoor is een extern anker nodig, en dat is nog niet in bedrijf |


---

## Verwerkers (art. 28) -- met wie moet een overeenkomst

Iedere partij hieronder verwerkt persoonsgegevens **namens** RTG. Zonder
verwerkersovereenkomst is dat een overtreding, en ligt de aansprakelijkheid bij
RTG.

| Partij | Wat zij verwerken | Overeenkomst? |
|---|---|---|
| Hostingpartij / VPS | Alles wat op de schijf staat | {{vwoHosting}} |
| Cloudflare of andere CDN/WAF | IP-adressen, verzoeken | {{vwoCdn}} |
| Betaalprovider (Stripe) | Betaalgegevens, bedragen | {{vwoBetaal}} |
| E-mailverzender (SMTP) | E-mailadressen, berichtinhoud | {{vwoSmtp}} |
| Anthropic (AI, indien `ANTHROPIC_API_KEY` is gezet) | Wat er in een gesprek met Rahul wordt getypt | {{vwoAi}} |
| Externe foutentracker (indien in gebruik) | Foutmeldingen, mogelijk met context | {{vwoFouten}} |
| **Elke partner-zaak** | Codenaam, bestelling, eventueel zorgprofiel | {{vwoPartners}} |

De laatste rij is de belangrijkste en de makkelijkste om te vergeten: elke
horecazaak, elk hotel en elke vervoerder die de app gebruikt is een verwerker.
Dat hoort in het onboarding-proces te zitten, niet in een los mapje.

## Doorgifte buiten de EU

{{doorgifte}}

Controleer dit per verwerker hierboven. Let in elk geval op de AI-aanbieder en
een eventuele foutentracker; die verwerken vaak buiten de EU en vragen dan om
aanvullende waarborgen.
