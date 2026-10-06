# DPIA — de gezinslaag van FoundationOS (AVG art. 35)

**Opgesteld:** 5 oktober 2026, door de bouwer, op verzoek van de eigenaar.
**Status:** concept met een **voorstel** voor de weging. Nog **niet vastgesteld**.

Dit document gaat over één verwerking: **gezinnen met kinderen in FoundationOS,
via het account van een ouder**. Het staat naast `DPIA.md`, dat het hele huis
beschrijft. Daar staan de zorggegevens, de identiteitskluis en de AI; die worden
hier niet herhaald.

De eigenaar vroeg de bouwer om "de DPIA te doen". Dat is gedaan zover het kan:

- de **feiten** (par. 2 en 5) zijn uit de code gehaald en per regel te controleren;
- de **weging** (par. 3 en 4) staat er als **voorstel van de bouwer**, gemarkeerd
  met `VOORSTEL`;
- het **besluit** (par. 7) is aan de verwerkingsverantwoordelijke.

Een DPIA die de bouwer van het systeem zelf vaststelt, is precies de
belangenverstrengeling die art. 35 lid 2 (advies van de FG) wil voorkomen. De
productiepoort leest daarom niet dit document maar een **ondertekend
vrijgavedossier** (`server/config/foundation-vrijgave.js`, controles
`juridischeVrijgave`, `privacyDpia` en `foundationMinderjarigen`). Dat dossier
tekent een mens met een eigen sleutel. Zonder dat dossier blijven de beschermde
gezinsfuncties in productie 503.

---

## 1. Waarom deze DPIA verplicht is

- **Kinderen.** De AVG noemt kinderen uitdrukkelijk als kwetsbare betrokkenen
  (overweging 38 en 75). De AP-lijst van verplichte DPIA's raakt dit via
  kwetsbare groepen.
- **Locatie.** Gezinsleden kunnen hun locatie delen (`/gezin/locatie`).
- **Gegevens over gezondheid en welzijn.** Daaronder vallen de allergieën en
  noodcontacten in de oppasinfo, en het gevoelsdagboek (`/api/rtf/welzijn`).
- **Communicatie.** Gezinschat, bellen, vrienden en mail voor kinderen.

Elk van deze vier kan op zich al genoeg zijn. Samen is een DPIA hier onmiskenbaar
verplicht.

---

## 2. De verwerking (art. 35 lid 7 sub a)

### 2.1 Het ontwerp sinds 5 oktober 2026

| | Vóór | Nu |
|---|---|---|
| **Wie maakt het gezin** | Iedereen, anoniem: alleen een IP-limiet | Een ingelogd RTG-account. Ook een gratis account mag, mits de opgegeven leeftijd 18 of hoger is |
| **Waar woont de sleutel** | Gezinscode (6 tekens, ±29,7 bits) plus een PIN van 4–6 cijfers | Het account van de ouder. Er is geen gezinscode of PIN nodig om binnen te komen |
| **Hoe komt een kind binnen** | Met de eigen PIN van het kind, op elk toestel | De ouder opent de sessie van het kind vanuit zijn account. Dat kan alleen als RTG het paspoort van de ouder heeft gezien |
| **Productie** | De deur met code en PIN staat dicht | Een token opent alleen iets in een gezin dat aan een account hangt. Een beschermd profiel opent alleen als de eigenaar `volwassen()` is |

De bijbehorende code:

- `server/foundation/gezinseigenaar.js`: maken, de sessie van de ouder,
  een kind toevoegen, en de sessie van een kind.
- `server/foundation/gezinshulp.js` `profielVan()`: de accountplicht. Elke
  gezinsroute loopt via deze ene plek.
- `server/routes/member/gezin.js`: de routes `/api/rtf/eigen-gezin*`.
- `test/gezinseigenaar.test.js` en `test/foundation-gezinstoken-productie.test.js`:
  het bewijs, op een echte server.

### 2.2 Welke gegevens

| Categorie | Wat | Opslag | Onder welke naam |
|---|---|---|---|
| Profiel | Weergavenaam (door de ouder getypt), geboortedatum, leeftijdsgroep, avatar, kleur | `db.data.foundation.gezinnen` | Codenaam per profiel. De weergavenaam is vrij in te vullen en hoeft geen echte naam te zijn |
| Eigenaar | Account-id en codenaam van de ouder | Op het gezin (`eigenaar`) | Codenaam. De echte naam blijft in de kluis |
| Sessies | Hash van het token, vervaltijd, epoch | Op het profiel (`sessies`) | n.v.t. Het token zelf wordt niet bewaard (`gezinstoken.js`) |
| Berichten | Gezinsberichten en chat | Versleuteld (`encS`) | Profiel-id |
| Locatie | Status, plus een optionele GPS-plek (5 decimalen) | De plek versleuteld | Profiel-id |
| Oppasinfo | Noodcontacten, allergieën, huisregels | Versleuteld | — |
| Welzijn | Gevoelsdagboek van het profiel zelf | Domein `welzijn` | Profiel. Geen route waarmee een ander gezinslid meeleest |
| Overig | Baby-album, tienertests, zakgeld, leren, spel, vrienden, mail | Per domein | Codenaam of profiel |

### 2.3 Wie ziet wat

- **De ouder (beheerder)** ziet de profielen en hun geboortedata, en beheert ze.
- **Een kind** ziet zijn eigen omgeving. Een beschermd profiel (rol kind, of 15
  jaar en jonger) is onvindbaar in de open vriendenlaag (`isBeschermd`).
- **Een gekoppelde oppas of familie** ziet de oppasinfo, de agenda en de
  locaties. De privézaken (geld, dagboek, dromen, cv) ziet hij niet (`isGast`).
- **RTG-kantoor**: er is geen kantoorroute naar het gezin.
  `[TE BEOORDELEN: dit is bevestigd door afwezigheid in de code en niet door een
  meting. Laat een mens dit nalopen.]`

### 2.4 Grondslag

| Verwerking | Grondslag (`VOORSTEL`) |
|---|---|
| Het gezinsaccount zelf | Art. 6 lid 1 sub b: de dienst die de ouder afneemt |
| Gegevens van een kind jonger dan 16 | Art. 8: toestemming door de ouder. De ouder legt die vast bij het aanmaken (`bevoegdGezin` + `privacyAkkoord`), en het kind komt uitsluitend via zijn account binnen |
| Gezondheidsgegevens: allergie en medische regel (oppasinfo), medicijnen, medische afspraken, groeimetingen, gevoelsdagboek | Art. 9 lid 2 sub a: uitdrukkelijke toestemming, **apart en bij het eerste gebruik** (besluit van de eigenaar, 5 oktober 2026). Niet het vinkje bij het aanmaken: dat staat tussen andere vinkjes en is daarom niet uitdrukkelijk. Een ouder of de beheerder geeft hem voor het gezin, en daarmee ook voor het dagboek van een kind jonger dan 16 (UAVG art. 5); wie 16 of ouder is geeft hem voor zijn eigen dagboek zelf. Toestemming geven is geen meelezen: het dagboek blijft van het kind. Intrekken kan altijd en wist wat erop rust (`foundation/gezondheidstoestemming.js`, `kern/welzijn.js`). Gegevens van vóór het besluit blijven leesbaar; wat nieuw wordt bewaard vraagt de toestemming |
| Locatie | Art. 6 lid 1 sub a: toestemming. De gebruiker zet het zelf aan (`/gezin/locatie`) en uit (`/gezin/locatie/stop`) |

---

## 3. Noodzaak en evenredigheid (art. 35 lid 7 sub b) — `VOORSTEL`

1. **Minder gegevens?** De weergavenaam hoeft geen echte naam te zijn. Er staat
   geen adres, BSN of school op het gezin. De geboortedatum is nodig voor de
   leeftijdspas, die bepaalt wat een kind ziet en wie het kan bereiken. Er is
   geen minder ingrijpend alternatief dat dezelfde bescherming geeft.
2. **Toegang via de ouder in plaats van via een code.** Dit is een
   **verbetering** van de evenredigheid. De oude deur liet iedereen anoniem een
   "gezin" met kinderprofielen maken. De nieuwe deur bindt elk kind aan een
   ouder van wie RTG het identiteitsbewijs heeft gezien.
3. **Bewaartermijn: 12 maanden ongebruikt, wissen na aankondiging** (besluit
   van de eigenaar, 5 oktober 2026; `foundation/gezinbewaren.js`). "Gebruikt"
   is het jongste moment waarop iemand in het gezin een sessie kreeg, of het
   aanmaken of meenemen. De wacht kondigt dagelijks aan wat kandidaat is; een
   gezin aan een account krijgt een bericht op dat account. Na 30 dagen kan de
   eigenaar van RTG het wissen vrijgeven (`/api/techniek/bewaren/gezinnen`,
   eerst als proef, dan met `WIS` en passkey). Wie tussendoor terugkomt, blijft
   staan: de wisronde rekent elk gezin opnieuw na. Daarnaast blijft gelden dat de
   ouder het gezin kan wissen (`/gezin/wissen`) en dat het verwijderen van het
   account het gezin meeneemt (`kern/vergeten.js`).
   Twee dingen die het meten opleverde: een **anoniem** gezin heeft geen kanaal
   voor de aankondiging (geen account en geen contactgegeven, met opzet), dus
   daar is de aankondiging een stempel op het gezin plus de openbare mededeling.
   En de gezinscode verloopt na 366 dagen (`kern/bearercode.js`): een anoniem
   gezin dat een jaar niets doet en geen lopende sessie heeft, kan na dag 366
   sowieso niet meer binnen. De termijn haalt het dus niets af dat het nog had.
4. **Twee treden voor de ouder.** Gezin maken kan direct, op een opgegeven
   leeftijd. Alles wat een kind raakt, vraagt een gecontroleerd paspoort. De
   eerste trede verwerkt alleen gegevens van de ouder zelf, dus het risico van
   een valse leeftijd daar is beperkt. Dat oordeel staat bij R-G2.

---

## 4. Risico's (art. 35 lid 7 sub c) — kans en ernst als `VOORSTEL`

| # | Risico | Kans | Ernst | Toelichting |
|---|---|---|---|---|
| R-G1 | Een onbevoegde volwassene maakt een "gezin" om in contact te komen met kinderen | Laag | Hoog | Een kind komt alleen binnen na de paspoortcontrole van de eigenaar. Beschermde profielen zijn onvindbaar in de vriendenlaag. Er is geen weg van buiten naar een kind |
| R-G2 | Een minderjarige geeft zich op als 18+ en maakt een gezin | Middel | Laag | Zonder paspoort kan hij geen kind toevoegen. Hij verwerkt dan alleen zijn eigen gegevens |
| R-G3 | Een ouder voegt een kind toe dat niet van hem is | Laag | Hoog | RTG controleert de identiteit van de ouder, maar niet de verwantschap. `[TE BEOORDELEN: is de verklaring "ik ben ouder of verzorger" plus een gecontroleerde identiteit voldoende? Dit is de zwakste schakel]` |
| R-G4 | Gezinsgegevens blijven achter na vertrek | Laag | Middel | Verwijderen gaat mee met het account, en een gezin dat 12 maanden ongebruikt is gaat na aankondiging weg (par. 3.3) |
| R-G5 | Een token lekt via een URL | Middel | Middel | `tokenUit()` accepteert het token ook als `?token=`, en de social-stream zet het in de URL. Daarom blijft die stream hard dicht (`foundation-nog-gesloten.js`). Het token is 128 bits, vervalt, en is in te trekken |
| R-G6 | Een gestolen toestel van een kind | Middel | Middel | De ouder trekt de sessie in (`/gezin/sessie/intrek`). Een sessie verloopt na 7 dagen (B19, `gezinstoken.js` `GELDIG_MS`) |
| R-G7 | De paspoortkeuring wordt ingetrokken, maar de sessie van het kind loopt door | Laag | Middel | `profielVan()` rekent `volwassen()` bij elk verzoek opnieuw. `[TE MAKEN: geen toets dekt dit geval apart; de route die sessies uitgeeft wel]` |
| R-G8 | Gegevens van een oud, anoniem gezin worden onbereikbaar maar blijven bestaan | Middel | Laag | De beheerder neemt het gezin mee naar zijn account met de gezinscode plus zijn eigen pincode (`/api/rtf/eigen-gezin/koppel`, `foundation/gezinmeenemen.js`); de gegevens blijven en het account wordt de sleutel. Grens: een gezin van vóór B18 heeft nog geen gezinscode van 128 bits, en die maakt de beheerder met een sessie die onder de plicht niet meer opent. Besluit van de eigenaar (5 oktober 2026): **zulke gezinnen gaan weg na een aankondiging** van 30 dagen, ongeacht hoe recent ze gebruikt zijn, want niemand kan er nog bij (`foundation/gezinbewaren.js`, soort `zonder-gezinscode`) |
| R-G9 | Gezondheidsgegevens worden bewaard op een vinkje dat niemand las | Middel | Hoog | Elke nieuwe allergie, elk medicijn, elke medische afspraak, groeimeting en dagboekregel vraagt een aparte toestemming (par. 2.4); zonder die toestemming weigert de server met 409 en de reden |

---

## 5. Maatregelen die bestaan en getest zijn

| Risico | Maatregel | Waar | Bewijs |
|---|---|---|---|
| R-G1, R-G3 | Een kind toevoegen of openen kan alleen met `volwassen()` (account + A3 + 18) | `gezinseigenaar.js` | `test/gezinseigenaar.test.js` 2, 3 |
| R-G1 | Onder de accountplicht opent een anoniem gezin niets | `gezinshulp.js` `profielVan` | `test/gezinseigenaar.test.js` 4; `test/foundation-gezinstoken-productie.test.js` op een echte productieserver |
| R-G1 | De oude ingangen maken onder de plicht geen anoniem gezin en geen kind | `accountplicht.js` `bewaak()` | `test/gezinseigenaar.test.js` 4, 5 |
| R-G2 | Een gezin maken kan pas vanaf een opgegeven leeftijd van 18 | `gezinseigenaar.js` `maak` | `test/gezinseigenaar.test.js` 8 (een account van 16) |
| R-G4 | Verwijderen van het account wist het gezin; export toont het | `kern/vergeten.js`, `routes/member/privacy.js` | `test/gezinseigenaar.test.js` 7 |
| R-G4 | Een gratis account heeft recht op inzage en vergetelheid (dat weigerde eerder: `tier === 'guest'`) | `routes/member/privacy.js` | `test/gezinseigenaar.test.js` 7 |
| R-G8 | Een bestaand gezin meenemen kan alleen de beheerder, met gezinscode en pincode, met een rem per account en per gezin; een gezin krijgt één eigenaar | `foundation/gezinmeenemen.js` | `test/gezinmeenemen.test.js` |
| R-G9 | Zonder aparte toestemming wordt geen nieuw gezondheidsgegeven bewaard; alleen een ouder of de beheerder geeft hem voor het gezin, vanaf 16 geeft een gezinslid hem voor zijn dagboek zelf; intrekken vraagt `WIS` en wist precies wat erop rust | `foundation/gezondheidstoestemming.js`, `kern/welzijn.js`, `lib/leeftijd.js` `ouderGeeftToestemming` | `test/gezondheidstoestemming.test.js` (met mutaties nagetrokken) |
| R-G4, R-G8 | Na 12 maanden ongebruikt, of zonder gezinscode en eigenaar: aankondigen, en pas na 30 dagen wissen als de eigenaar van RTG dat vrijgeeft; gebruik heft de aankondiging op | `foundation/gezinbewaren.js`, `routes/techniek/bewaren.js` | `test/gezinbewaren.test.js` (echte servers met een verzette klok; met mutaties nagetrokken) |
| R-G5, R-G6 | Token van 128 bits, alleen de hash bewaard, met verval, epoch en intrekken | `gezinstoken.js` | `test/gezinstoken.test.js`, `test/gezinssessie.test.js` |
| R-G5 | De stream met een token in de URL blijft dicht, ook met vrijgave | `foundation-nog-gesloten.js` | `test/foundation-productiepoort.test.js` |
| alle | Zonder ondertekend dossier blijven de beschermde functies 503 | `foundation-productiepoort.js` | `test/foundation-productiepoort.test.js` |

---

## 6. Wat nog moet vóór vrijgave

1. **Het register met deuren: gedaan op `main` (B18, 4 oktober 2026).** De
   gezinsdeur staat niet meer in `foundation-nog-gesloten.js`: de gezinscode is
   een 128-bit bearer geworden en een sessie verloopt na zeven dagen, met
   verlengen via een passkey (B19). Met een ondertekend dossier opent het
   gezinsscherm dus ook in productie. Onder de accountplicht maakt de oude deur
   `/gezin/maak` geen anoniem gezin meer, en voegt `/gezin/profiel/maak` geen
   kind toe; beide wijzen naar Mijn gezin (`accountplicht.js` `bewaak()`).
2. **De open plekken in deze tekst.** Alle `[TE BEOORDELEN]`, `[TE BESLISSEN]`
   en `[TE MAKEN]` hierboven.
3. **Advies van een FG of privacyjurist** (art. 35 lid 2).

---

## 7. Vaststelling

| | |
|---|---|
| Verwerkingsverantwoordelijke | `[naam / rechtspersoon]` |
| Advies FG of privacyjurist | `[naam, datum, advies]` |
| Restrisico aanvaardbaar? | `[ja / nee / ja onder voorwaarden]` |
| Voorafgaande raadpleging AP nodig (art. 36)? | `[ja / nee]` — `VOORSTEL`: nee, mits R-G3 is afgedekt (de art. 9-toestemming staat sinds 5 oktober 2026) |
| Besluiten van de eigenaar (5 oktober 2026) | Gezinnen van vóór B18: wissen na aankondiging. Bewaartermijn bij niet-gebruik: 12 maanden. Gezondheidsgegevens: aparte toestemming bij het eerste gebruik. Deze besluiten zijn van de eigenaar; het oordeel van de FG of privacyjurist hierboven staat daar los van |
| Opnieuw te toetsen bij | Een tweede ouder via het account; een eigen account voor 16–17 jaar; een school die het gezin bereikt; een nieuw land |
| Getekend | `[datum, handtekening]` |

Pas na deze tabel kan het vrijgavedossier worden opgesteld en ondertekend.
