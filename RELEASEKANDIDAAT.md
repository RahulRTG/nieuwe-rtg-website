# Release candidate V1 — blocker-matrix en afhankelijkheden

*Gemeten, niet aangenomen. Stand: main `c82e3f94` (27 september 2026).
Bronnen: `npm run productie:status`, `npm run golive`, `npm run release:gate`,
`npm run check`, `npm test` (op `115ceb85`, 14.591 toetsen), plus
`scripts/lib/productie-oordeel.js`, `server/config/external-release.js`,
`server/config/release-trust.js`, `deploy/TRUST.md`, `LIVEGANG.md`,
`PRODUCTION.md` §6–7, `LAUNCH.md`, `TAKEN.md` §1–3.*

Dit document bouwt niets. Het zegt per blokkade wat hem sluit, wie dat kan, en
waar hij op wacht. Groep **A** is technisch en zelfstandig af te bouwen, **E** is
een externe partij of een echte host, **B** is een besluit van de eigenaar.

## 0. De meting in vier regels

- `productie:status` → **BLOCKED**, 10 blokkades (acht ontbrekende CI-/release-
  bewijzen, het externe dossier, de getekende kandidaat).
- `golive` → **26 blokkades**; twee daarvan zijn CODE (`PG_ACCOUNTS_ATOMAIR_ONTBREEKT`
  en een hard `uitgaandGeconfigureerd: false`), de rest is configuratie,
  providers en papierwerk.
- `release:gate` → **zakt op eigen kracht** bij "Bron- en securityregels": de poort
  pakt het afbouwslot en geeft het niet door aan zijn kinderen, dus
  `scripts/kaart.js` in `check.js` weigert te meten. Dezelfde poort draait in
  `release-image.yml` via `afbouw:software`; daar is hij nog nooit aangekomen
  omdat de sleutelcontrole er eerder stopt.
- `npm test` → 14.591 toetsen, **0 gezakt, 22 overgeslagen** — alle 22 vragen een
  echte PostgreSQL/Redis. Met `DATABASE_URL` + `REDIS_URL` is dat een
  omgevingskwestie en geen codefout; een overgeslagen toets telt voor de
  release als gezakt (`productie-oordeel.js:18-33`).

## 1. De matrix

Kolommen: **code** / **extern** / **besluit** = JA/NEE; *bewijs* = wat
`productie-status` of het dossier mist; *raakt* = bestanden/systemen;
*mechanisme* = bestaande toets of meter; *kleinste stap*; *hangt af van*.

### A — technisch, zelfstandig

| # | blokkade | status | code | ext | bsl | ontbrekend bewijs | raakt | mechanisme | kleinste veilige stap | hangt af van |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | releasepoort blokkeert zichzelf (afbouwslot niet doorgegeven) | GEZAKT | JA | NEE | NEE | `.release/release-gate-bewijs.json` | `scripts/release-gate.js`, `scripts/afbouw-slot.js` | `eisGeenAfbouw`, `RTG_AFBOUW_SLOT_ACTIEF` (al gebruikt door `test-runner.js`) | kinderen van de poort erven `RTG_AFBOUW_SLOT_ACTIEF=1`, één plek in `afbouw-slot.js`, regressietoets | — |
| A2 | accountmutaties in productie dicht (`PG_ACCOUNTS_ATOMAIR_ONTBREEKT`) — registreren geeft 503 | BLOCKED | JA | NEE | NEE | `golive.accounts.{gereed,transactioneel}` | `server/db/verzoekcontext.js`, `server/db/postgres-verzoeken.js` (10181/10240 B), `server/pg/verzoektransactie.js`, `server/accounts/duurzaamheid.js`, `server/accounts/transactie.js` | `accounts-productie-hardclose.test.js`, `postgres-requestcommit(.pg).test.js`, `pgaccounts-commit.js` (PG-helft staat), bewaakte vooruitwijzing in `AANROEPGRAAF.json` | deelnemer-protocol (`registreerDeelnemer`: pasToe/publiceer/annuleer) in de verzoekcontext + commitmotor; `eisMutatie` opent `transactie.begin()`; nieuwe unit-, sqlite- en pg-proeven | — (ontwerprisico: SQLite-schrijfslot vs. event loop, zie §3) |
| A3 | volledige suite zonder skip | ONBEWEZEN | NEE | NEE | NEE | `.release/ci-suite.json` | lokaal PG 16 + Redis | `test-runner.js` → `SUITE.json` | suite draaien met `DATABASE_URL`/`REDIS_URL`; in CI via `release-image.yml` | A1 (zelfde keten), A2 (toetsen veranderen) |
| A4 | schermsuite | ONBEWEZEN | NEE | NEE | NEE | `.release/ci-schermsuite-bewijs.json` | Chromium in `/opt/pw-browsers` | `scripts/e2e.js --bewijs` | draaien; falen oplossen bij de oorzaak | A2 |
| A5 | PostgreSQL/Redis-proeven | ONBEWEZEN | NEE | NEE | NEE | `.release/ci-pg-bewijs.json` | `scripts/pgtoetsen.js`, `pg-toetslijst.js` | `npm run test:pg` | draaien; bij A2 een nieuwe pg-proef in de toetslijst | A2 |
| A6 | stagingrepetitie | ONBEWEZEN | NEE | NEE | NEE | `.release/staging-bewijs.json` | `scripts/staging-repetitie.js` | idem | draaien | A1-patroon (slot) |
| A7 | bronbewijs | ONBEWEZEN | NEE | NEE | NEE | `.release/bron-release-bewijs.json` | `scripts/bron-release-bewijs.js` | idem | alleen geldig uit CI (`release-image.yml:77`) | B1 |
| A8 | bewijsproducent herstelproef | **producent staat** (`npm run extern:bewijs`), draait op de host | JA | host | NEE | `backup-herstel.json` | `scripts/docker/herstel.sh`, `live.sh restore` | `livegang-pakket.test.js`, `herstelproef.test.js` | restore-pad laat een machineleesbaar, commitgebonden verslag achter (tijden, sha's, de twee handcontroles als open velden) | E2 (echte host) |
| A9 | bewijsproducent rollback | **producent staat** (`npm run extern:bewijs`), draait op de host | JA | host | NEE | `deployment-rollback.json` | `scripts/docker/live.sh rollback` | `uitrol.test.js`, `release-hardening.test.js:153` | idem voor rollback: vorige/nieuwe digest, readiness-tijden | E2, B1 |
| A10 | bewijsproducent malwaredefinities | **producent staat** (`npm run extern:bewijs`), draait op de host | JA | host | NEE | `malware-definitions-scan.json` | `server/kern/clamd.js` | `uploadquarantaine.test.js` | clamd-versie/definitiedatum + EICAR-scan als verslag | E2 |
| A11 | bewijsproducent objectopslag | **producent staat** (`npm run extern:bewijs`), draait op de host | JA | bucket | NEE | `object-storage-delivery.json` | `golive.js:192-195` (`beproefMedia`) | `media.test.js` | bestaande golive-proef als los verslag exporteren | E3 |
| A12 | Sentinel-sleutel + binary | BLOCKED (golive) | NEE | host | NEE | golive | `sentinel:init`, `motor:build` | golive regel 90-94 | ops-commando's in de installatie; lokaal na te spelen | — |

### E — externe partij of echte host (alleen aansluiting en bewijsvoorziening bouwen)

| # | blokkade | code | wat ontbreekt | bestaand mechanisme |
|---|---|---|---|---|
| E1 | onafhankelijke pentest | NEE | rapport | dossierveld `onafhankelijkePentest` |
| E2 | productiehost (Docker, DNS A/AAAA, 80/443/3478), TLS/ACME, `live:probe` | NEE | host + domein | `luister.js`/`acme.js`, `publieke-tls-proef.js`, `live-monitor.yml` |
| E3 | objectopslag (S3/MinIO/R2 met creds) | NEE | bucket | `server/media/s3.js` |
| E4 | SMTP + SPF/DKIM/DMARC, bezorgbewijs | NEE | provider/DNS | `server/smtp*.js`, `eigenpost` |
| E5 | foutalarm `ERR_WEBHOOK_URL`, log-sink | NEE | ontvanger | `foutmelder.js` zelfproef |
| E6 | back-up tweede schijf + off-site WORM, offline sleutelmedium | NEE | opslag | `backup.sh`, `controle.js:96-118` |
| E7 | rand-DDoS/CDN, TURN (coturn) | NEE | provider/host | `schild.js`, `/api/ice` |
| E8 | juridische vrijgave, DPIA-beoordeling, verwerkersovereenkomsten | NEE | jurist/FG | `DPIA.md` (fundament), `server/papieren/` |
| E9 | betaalprovider (in), webhooks, refunds, settlement, reconciliatie | ná B3 JA | merchant-account + sandboxbewijs | Stripe/Mollie/Adyen-code staat, `webhook.js`, `betaalwaarheid/` |
| E10 | image-kwetsbaarheidsscan uitvoeren | ná B6 JA | scanner + db | SBOM staat (`imageherkomst.js --sbom`) |

### B — besluit van de eigenaar

| # | besluit | waarom het blokkeert | opties en technisch gevolg |
|---|---|---|---|
| B1 | **De drie releasesleutels en hun bewaarders** (build, extern bewijs, promotie) | zonder `deploy/*.pub` stopt `release-image.yml` bij stap 1; geen image, geen SBOM, geen herkomst, geen kandidaat, geen dossier (`TRUST.md`) | bewaarders aanwijzen, drie Ed25519-paren in hun eigen secret stores, alleen de publieke ankers committen, `RTG_RELEASE_SIGN_KEY` als GitHub-secret. Code: geen. Er is met opzet geen sleutelgenerator |
| B2 | **Scope V1: met of zonder geld** | `LAUNCH.md` zegt "ga live op trede 0" (zonder geld mag), `LIVEGANG.md` en `productie-oordeel.js:96-124` zeggen dat alleen een release MET echte inkomende én uitgaande rail READY kan zijn — dat spreekt elkaar tegen | (a) V1 mét geld: READY haalbaar, wacht op B3+E9; (b) V1 zonder geld: veilig live met `RTG_BETALEN_UIT=1`, maar `productie:status` blijft BLOCKED tot een latere geldrelease — de poort zelf veranderen is een besluit over de grondwet, niet over code |
| B3 | **Geldmodel + uitbetaalprovider** | `productie-geld.js:95` zet `uitgaandGeconfigureerd` hard op `false`; `betaal.js:146-150` weigert elke uitbetaling | `LAUNCH.md` (partner is merchant of record, Connect direct charges) en `WAARDE.md`/`GIFT.md` (RTG houdt wallet- en partnersaldo, terugstortbaar = e-geld) trekken elk een andere kant op. Na de keuze is er code: een railadapter, payout-webhook, automatische afstemming |
| B4 | **Papierwerk: 18 vragen** (juridische naam, KvK, verantwoordelijke, FG, bewaartermijnen…) | vult `VERWERKINGSREGISTER.md` (15 plekken) en `DATALEK.md` (4) | antwoorden via de technische pagina; code: geen |
| B5 | **SMS**: provider of bewust uit (`RTG_HERSTEL_SMS_UIT_BEWUST=1`) | golive-blokkade + dossierveld `smsDelivery` | uit = telefoonherstel fail-closed; aan = provider (E) |
| B6 | **Image-scanner kiezen** | er is geen enkele scanner (grep: 0) terwijl het dossier `imageVulnerabilityScan` eist | een externe scanner in CI (trivy/grype) is een nieuwe afhankelijkheid tegen de nul-dependencylijn; alternatief: scan buiten de repo door de reviewer, alleen het verslag komt binnen |
| B7 | **`RTF_IBAN` + Foundation-wallet** | golive `foundationRekeningGeconfigureerd` | IBAN leveren; wallet aanmaken via `rtfwallet.js` |
| B8 | **Foundation/minderjarigen in V1 dicht** | dossierveld `foundationMinderjarigen` | aanbevolen en al de standaard: `vrijgave: GESLOTEN` |

## 1a. Besluiten van de eigenaar (27 september 2026)

| # | besluit | gevolg in code |
|---|---|---|
| B2 | **Scope V1**: zonder kaartprovider werkt RTG met eigen **opwaardeerkaarten** of **extern afrekenen**; meerdere opties naast elkaar | geldmodus naast `RTG_BETALEN_UIT`; zie B2a en B2b |
| B2a | **Aparte beperkte releasestand**: naast READY komt een expliciete stand voor een release zonder kaartrail; volledige READY blijft ongewijzigd voor de latere geldrelease | **gebouwd**: `READY_ZONDER_RAIL` (vlaggen `RTG_BETALEN_UIT=1` + `RTG_RELEASE_ZONDER_RAIL=1`), eigen promotiewoord `PROMOVEER-ZONDER-RAIL-`, `LIVEGANG.md`; toetsen in productie-status, productie-promotie en golive |
| B2b | **Extern afrekenen mag** terwijl RTG-betalingen uit staan, **alleen** met contant, pin (eigen terminal) of op rekening; elke RTG Pay-, cadeaukaart- of tegoedmethode blijft dicht | **gebouwd**: `server/opzet/betaalstop.js` (`externWijzePoort`), `test/extern-afrekenen.test.js` |
| B9 | **Alle negen dichtgezette geldcode- en tickettypes gaan mee in V1**: opwaardeerkaarten (tegoedbon), cadeaukaart, bestellen en bezorgen, RTG Pay aan de kassa (kascode, vooraf, tikcode), entreetickets, vervoerskaartjes, Invisible Arrival, WorkOS-werkruimtetokens | elk type naar het beleid in `CODECREDENTIALS.json` (128-bit, hash-only, eenmalig tonen, vervaldatum, intrekken en roteren, constante-tijd, atomisch claimen), met toetsen als `bewijs` |
| A1b | Keuringsregel 71 mag een lopende ronde doorlaten die aantoonbaar de eigen ouder is | gedaan: `eigenLijn()` |
| A2b | Accountmutaties met een schrijver per proces, en de bewaarveger meteen mee | gedaan: `server/db/deelnemers.js`, `server/accounts/achtergrond.js` |
| B10 | **Kantoortoegang in productie op naam met een passkey**; de gedeelde `OFFICE_CODE` werkt alleen nog buiten productie | **gebouwd**: deur `office.gedeelde_kantoorcode` staat op `closed`. `server/kern/kantoor/productiedeur.js`: in productie weigeren `/api/office/login` en het kantoorgesprek de code vóór de vergelijking; een kantoorsessie ontstaat alleen via `/api/account/start` (rol kantoor) met een verse passkey (zware poort, actie `kantoor-binnen`, zonder terugval); `officeAuth` en de query-tokenpoorten weigeren elke kantoorsessie zonder dat bewijs en het kale lid-token van de eigenaar; zonder passkeylaag of `APP_URL` 503. Toetsen: `test/kantoordeur-productie.test.js` (echte productieserver), `test/kantoor-productiedeur.test.js` |
| B11 | **Bon- en polsbandsaldo naar 128 bits** met een atomische claim; een gast boekt alleen af wat aan zijn eigen sessie hangt | deur `horeca.bon_en_polsbandsaldo`, patroon van de cadeaukaart |
| B12 | **Zaakdoos-sleutel per zaak** (128 bits, hash-only, intrekken en roteren), met een kloon die alleen de eigen zaak bevat | deur `devices.zaakdoos_sleutel` |
| B13 | **De kortingscode van RTG Eten is een promotiecode** en geen geheim: wel een vervaldatum, een maximum, een grens per lid en een rem tegen raden | deur `eten.kortingscode` |
| B14 | **Partnerkanaal splitsen**: de partnercode wordt een openbare attributielink die niets opent; de personeelscode wordt een persoonlijke 128-bit code per medewerker (hash-only, intrekbaar), besluit van 29 september 2026 | **gebouwd**: deur `partnerkanaal.personeels_en_partnercode` staat op `migrated` (`server/kern/partnerpersoneelscode.js`, PK.<32 hex>, uitgeven/roteren/intrekken door het kantoor op naam, een boeking claimt een gebruik in de collectietransactie), de partnercode is `partnerkanaal.partnercode_attributie` (`public_identifier`, `/api/partner` geeft alleen code en naam). Een oude zelfgekozen `staff.code` opent niets meer. Toetsen: `test/partnerpersoneelscode.test.js`, `-register.test.js`, `.pg.test.js` |
| B15 | **De RTG Link-drager voor `geld.kassa` migreert**: 128 bits, hash-only, minuten geldig, eenmalige atomaire claim, gebonden aan de zaak die hem maakte; daarna gaat de productiegrendel eraf | deur `link.capability_aanvaarden` |
| B16 | **Het SSO-clientgeheim versleuteld per tenant**: nooit terug te lezen via een route, rotatie met overlap en een vervaldatum | deur `identity.sso_client_secret` |
| B17 | **De Foundation-tokens migreren nu**, voor de release: de lescodes en leraar- en leerlingtokens van onderwijs, en het gezinsprofieltoken (128 bits, hash-only, verval, intrekken); tot dan blijven ze in productie op 503 | deuren `foundation.onderwijs_les_tokens` en `foundation.family_profile_token_buiten_harde_poort` |
| B18 | **De gezinsdeur zelf migreert** (besluit van 4 oktober 2026): de gezinscode van circa 30 bits wordt een 128-bit code, alleen als hash bewaard, met een rem per code en per IP, en het token gaat niet meer in de URL van de social-stream. Daarna geeft productie weer gezinstokens uit | deur `foundation.family_profile_access` |
| B19 | **Een gezinssessie is 7 dagen geldig**, en wie binnen die termijn met zijn passkey bevestigt krijgt opnieuw 7 dagen; zonder passkey is het daarna opnieuw inloggen met gezinscode en pincode. Het kanaal van een oppas blijft 12 uur | `server/foundation/gezinstoken.js` |
| B20 | **Een leerling komt binnen via een deellink of QR van de leraar**; de lescode blijft 128 bits en wordt niet ingetikt. Geen derde korte-code-uitzondering | deur `foundation.onderwijs_les_tokens` |
| B21 | **Oude personeelscodes van het partnerkanaal worden bij de uitrol gewist** uit de opslag; partners geven elke medewerker opnieuw een personeelscode | deur `partnerkanaal.personeels_en_partnercode` |
| B22 | **Strengere termijnen voor het SSO-clientgeheim**: rotatieadvies 30 dagen, maximaal 90, overlap 3; roteren vraagt een verse passkey | deur `identity.sso_client_secret` |
| B23 | **Het eerste kantooraccount op naam machtigt de eigenaar met zijn eigen passkey**; er is geen gedeelde of eenmalige startcode | deur `office.gedeelde_kantoorcode` |
| B24 | **Een nieuwe kantoormedewerker bevestigt het koppelen met een eigen verse passkey**; de gedeelde kantoor-TOTP vervalt in productie bij het verzilveren van een uitnodiging (besluit van 4 oktober 2026) | `kern/eenaccount/koppelen.js`, deur `office.gedeelde_kantoorcode` |
| B25 | **De leerlingsleutel verlaat de URL**: bord-, schrift- en lesverzoeken dragen hem in een header of het lijf, de live-stroom krijgt een kortlevend eenmalig ticket | deur `foundation.onderwijs_les_tokens` |
| B26 | **Een leerling zonder gezinsprofiel scant na het inloggen opnieuw**; de lescode uit de link blijft alleen in het geheugen en wordt nergens bewaard | `public/apps/foundation/leren.html` |
| B27 | **De maximale overlap van een SSO-clientgeheim gaat naar 7 dagen**, en de uitrol levert vooraf een lijst organisaties waarvan het geheim ouder is dan 90 dagen, zodat die eerst roteren | deur `identity.sso_client_secret` |

**Nieuw gemeten sinds de matrix:** de codecredentialpoort telt geen 9 maar
**483** blokkades: de 9 open types, **399** routes die op een toegangscode
lijken maar niet in het register staan, en **75** routes die de scanner niet kan
lezen. Die 474 zijn indelingswerk (A); de 9 types zijn bouwwerk (A, besloten in B9).

**Stand na de indeling (27 september 2026):** 0 ongeclassificeerd en 0
onleesbaar (de router lost de dynamische paden nu op). Het register telt 14
gemigreerd, 41 gesloten en **31 resterend**, en die 31 zijn allemaal echte
deuren die de release blokkeren. De indeling vond **22 nieuwe deuren**, elk met
de risico's erbij. Voorbeelden zijn de gedeelde `OFFICE_CODE`, de bon- en
polsbandsaldo's in de horeca, de OV-incheckcode, de Zaakdoos-sleutel die de hele
database kan klonen, de kortingscode van RTG Eten en de gezinsprofieltokens.
Een geen-credentialoordeel mag alleen met status gesloten, zonder blokkade en
met een notitie van minstens 40 tekens; `test/codecredentials.test.js`
beproeft dat met een mutatie.

Drie vondsten waren gevaarlijker dan hun deur deed vermoeden. Alle drie zijn
in productie dichtgezet; de deuren blijven `remaining`, want de credentials zelf
zijn niet gemigreerd:
- Het gezinsprofieltoken had consumers buiten de Foundation-productiepoort:
  `/api/rtf/toegang`, `/beroepen*`, `/bieb*`, `/geloof*` en `/knelpunt`, en
  bronafgeleid ook `/api/rtf/connect/*`, `/labfonds/*` en
  `/api/foundation/kosten`. `/api/rtf/kanaal` gaf het ruwe token terug. Elke
  consumer en uitgever staat nu in `NOG_GESLOTEN`
  (`server/middleware/foundation-nog-gesloten.js`), ook de routes die alleen in
  de beschermde lijsten stonden en met een extern dossier opengingen.
- De lesfamilie `/api/foundation/les/*` en de routes die dezelfde lescode en
  tokens lezen (`/bord`, `/schrift`, `/opgave(n)`, `/agenda`, `/ai`) staan in
  `NOG_GESLOTEN`.
- `GET /api/doos/kloon` geeft in productie 503 (`doos-kloon-productie-dicht`),
  vóór de sleutelwacht en voor elke sleutel: het antwoord was de hele database.

`test/foundation-gezinstoken-productie.test.js` leidt de consumers uit de bron
af en beproeft de sluiting op een echte productieserver.

**B9, eerste type gemigreerd: de opwaardeerkaart (`pay.tegoedbon`).** De code is
128 bits en wordt alleen als hash bewaard. Hij wordt precies één keer getoond en
heeft een vervaldatum. Er is één gebruik, en intrekken en roteren gebeurt aan de
serverkant. De vergelijking gebeurt in constante tijd. Het claimen is een saga:
eerst de claim in de collectietransactie, dan de escrowboeking met een vaste
sleutel, dan het afronden. Een crash halverwege wordt hervat naar dezelfde
bestemming. Dat is beproefd over twee PostgreSQL-instances plus een derde die
hervat.

Daarbij is een fout in `saldoSamen` gerepareerd die elk `extern:`-account in
PostgreSQL raakte: een rekening op precies 0 viel weg, en het volgende verzoek
kreeg daardoor een 409.

Er ligt één besluit voor de eigenaar. Oude codes van 96 bits blijven geldig, als
hash en met het merkteken `legacy96`, totdat de koper roteert of de kaart
verloopt; dat is hooguit een jaar. De houder houdt zo zijn waarde. Het
alternatief is die codes nu ongeldig maken en een rotatie afdwingen.

**B9, tweede type gemigreerd: de afhaalcode (`pay.order_pickup_code`).** Het oude
veld `pickup` telde vier tekens en blijft bestaan, maar alleen als bonnummer voor
keuken en pas; het opent niets meer. De credential is nu een aparte afhaalcode
van 128 bits (`AH.`), die alleen als hash wordt bewaard in `afhaalToegang`.
- Het lid haalt de code op met `POST /api/order/afhaalcode`. Elke keer tonen
  maakt een nieuwe code en trekt de vorige in.
- De code is zes uur geldig en kan één keer worden gebruikt. Hij hoort bij één
  zaak.
- De kassa scant een QR. Het claimen, het uitgeven en het besluit of de kassa
  nog moet afrekenen staan samen in één collectietransactie.
- Een betaling in de app zet eerst een betaalweg vast. Zo kunnen kassa en app
  nooit allebei afrekenen.
- De zaak trekt de code in vóórdat een bestelling wordt afgesloten of
  teruggestort.

Bestaande bestellingen zijn niet gemigreerd: hun oude code is nu alleen een
bonnummer, en het lid maakt met "Toon afhaal-QR" een nieuwe. Het restrisico:
crasht het proces tussen een app-betaling en `betaalEinde`, dan kan de kassa na
twee minuten toch afrekenen. Dat wordt gelogd en niet stil geslikt; het helemaal
dichtzetten vraagt een besluit.

**B9, derde type gemigreerd: de cadeaukaart (`pay.giftcard_value_code`).** De
oude code was `RTG-GC-` plus zes hextekens (24 bits) en stond kaal op de kaart,
op de kassabon en in het bewaarde kassa-antwoord. Nu (`server/kern/cadeaukaart*.js`):
- De code is 128 bits (`GC-` plus 32 hextekens) en staat alleen kaal in het
  antwoord op de koop, de kassaverkoop en een rotatie; daarna alleen als hash.
- Een jaar geldig, hoort bij een zaak, en telt zijn deelverzilveringen; het
  saldo blijft de echte grens.
- De zaak trekt in (het saldo blijft staan) en koper of manager roteert.
- Verzilveren, los of via de kassabon, is een collectietransactie op
  `giftcards` en onthoudt de kassasleutel, zodat een herhaling niet opnieuw
  afboekt. Bon en antwoord noemen de kaart bij haar id.

Er ligt een besluit voor de eigenaar. Oude kaarten houden hun 24-bitcode,
gehasht en gemerkt `legacy24`, minstens een jaar na de migratie, zodat de houder
zijn waarde houdt. Maar 24 bits zijn raadbaar aan de kassa van die zaak en een
hash ervan is geen geheim voor wie de database heeft. Het alternatief is die
codes nu ongeldig maken en de houder via de zaak een nieuwe laten roteren.

**B9, vierde en vijfde type gemigreerd: het entreeticket
(`travelos.activity_ticket_entry`) en het vervoerskaartje
(`travelos.mobility_transport_ticket`).** De boeking en het kaartje dragen geen
code meer. De credential is een 128-bit bearer (`TK.` en `OV.`), alleen als hash
bewaard in `ticketToegang` en `mobKaartToegang`.
- Tonen is roteren: `POST /api/ticket/toon` en `POST /api/mob/kaart/toon`
  (het lid), en voor een aan de deur verkocht kaartje de deurverkoop zelf en
  `POST /api/supplier/ticket/toon` (de zaak). Mijn tickets, Mijn kaartjes, het
  dagprogramma, de kassabon en de reis tonen nooit een code.
- Een ticketcode vervalt aan het eind van de ticketdag en wordt één keer
  gebruikt; een kaartcode vervalt met het kaartje en telt de ritten van het
  product, en die teller reist mee bij een rotatie.
- De deur en de conducteur claimen in één collectietransactie, waarin ook de
  boeking of het kaartje opnieuw wordt gekeurd (betaald, niet geannuleerd, de
  goede dag, de goede lijn). Beproefd over twee PostgreSQL-instances.

Twee besluiten voor de eigenaar. Oude codes (24-30 bits voor tickets, ~60 voor
kaartjes) zijn van de rijen gehaald en openen niets meer; het ticket of kaartje
houdt zijn waarde, want de houder toont een nieuwe code. En offline tonen: de
app houdt de laatst getoonde code alleen in het geheugen van de pagina. Een pas
die zonder verbinding opnieuw getoond moet kunnen worden, vraagt een besluit.

**B9, zesde en zevende type gemigreerd: RTG Pay aan de kassa (kascode, vooraf)
en de tikcode.** Beide codes zijn nu 128 bits (`KC-`/`TK-`), staan alleen als
hash in een eigen collectie (`kern/pay/kasbak.js`) en worden een keer getoond;
een retry met dezelfde sleutel krijgt 409 zonder code. Uitgeven is roteren, en
`/api/pay/kascode/intrek` en `/api/pay/tikcode/intrek` trekken server-side in.
- Innen en vastzetten zijn een saga (`kern/pay/kas-claim.js`): de claim in de
  collectietransactie, de samenstelling bevroren, per deel een boeking met een
  `pay-kas`-sleutel (ook in de Rust-motor), dan afronden. Een crash wordt na een
  lease van een minuut naar dezelfde zaak en hetzelfde bedrag afgemaakt; een
  weigering draait terug en geeft de code terug.
- Vastleggen en vrijgeven van een reservering lopen door `payVoorafAfloop`, een
  rij per reservering; vrijgeven werkt ook tijdens een betaalstop.
- De tik mag door een tafel worden gebruikt: hoogstens 25 keer, elk gebruik
  geclaimd per betaler en sleutel.
- Beproefd over twee PostgreSQL-instances plus een derde die hervat.

Oude kale codes (hoogstens vijf minuten geldig) openen niets meer en worden bij
de eerste handeling gewist. De ondertekende Link-drager van de kascode is een
andere deur (`link.capability_aanvaarden`) en blijft in productie dicht. Het
restrisico: bijladen is niet economisch gesleuteld, dus twee hervattingen die
elkaars lease overschrijden kunnen de eigen wallet van het lid twee keer
bijladen -- geld naar het lid zelf, geen dubbele betaling.

**B9, Invisible Arrival gemigreerd (`livingos.invisible_arrival_pass`).** De
browser koos vroeger zelf de pass; met `randomUUID` was de geheime helft 122
bits. Nu maakt de server hem (`AR.`, 128 bits) en bewaart alleen de hash in
`arrivalToegang` (`server/kern/arrivalpas.js`).
- De pass staat kaal alleen in het antwoord op de aanvraag en op een rotatie.
  De aanvraagcode van de browser is nog alleen de idempotentiesleutel: een
  herhaling roteert (binnen een kwartier, zolang de pass ongebruikt is, hooguit
  drie keer) en toont de eerste pass nooit opnieuw.
- De pass vervalt op aankomst plus twaalf uur, en een aanvraag mag hooguit
  zestig dagen vooruit. Hij telt pulsen (hooguit zestig).
- De gast roteert of trekt in. Een reservering die de zaak weigert, of die
  geannuleerd, no-show of afgerond is, sluit de pass.
- Uitgifte, rotatie, puls met de eenmalige voorbereidingsclaim en intrekking
  lopen in een collectietransactie; beproefd over twee PostgreSQL-instances.

Er ligt een besluit voor de eigenaar. De oude, door de browser gekozen passen
zijn zonder datamigratie ongeldig: hun hash opent niets meer. De reservering
blijft staan, maar de gast kan voor die aankomst geen status meer delen. Het
alternatief is ze tot hun verval als legacy te laten werken.

**B9, WorkOS-werkruimtesleutels gemigreerd (`workos.workspace_access_tokens`).**
In productie bestaat er geen werkruimtebearer: `/api/bedrijf` en `/api/tenant`
openen alleen met het RTG-account. Elk verzoek leest eerst een verse stand
van tenants en werkruimtes uit PostgreSQL (`db.verversVerzoekCollectie`, nieuw
in `server/db/postgres-poorten.js`). De tijdelijke grendel is weg, en oude kale
sleutels verdwijnen bij de opslagstart.
- Buiten productie zijn beheer- en lidsleutels sessies uit
  `server/bedrijf/sleutels.js`: 128 bits, alleen als hash op de werkruimte,
  lid zeven dagen en beheer dertig. `/api/bedrijf/mijn`, de bootstraps en de
  accountstart geven een VERSE sessie en nooit de oude terug.
- Een sessie telt geen gebruik (max_gebruik 0). Wat haar begrenst is de
  vervaltijd, acht sessies per lid, en een epoch: uit dienst, afwijzen,
  deprovisioning, bewaring en import sluiten elke sessie van dat lid tegelijk.
- De houder roteert of trekt in (`/api/bedrijf/sleutel/roteer` en `/intrek`).
- Oude 192-bit sleutels worden hash met het merkteken `legacy192` en krijgen
  een vervaltijd.

**Daarmee zijn alle negen typen uit B9 gemigreerd.** Wat de codecredentialpoort
nog blokkeert zijn de andere echte deuren uit de indeling, niet de geldcodes en
tickets van V1.

**Vier restdeuren naar hetzelfde beleid (27 september 2026):** de OV-incheckcode
(`travelos.ov_incheckcode`, `kern/ov/incheckcode.js`: niet langer een 24-bit code
in procesgeheugen maar een 128-bit hash-only credential per lid, gebonden aan de
gekozen vervoerder, en een betaalde rit start alleen na een atomaire claim), de
incheckcode van een Foundation-activiteit (`rtfos.activiteit_incheckcode`), de
festivalpas (`festivalos.toegangspas`, de scan is de claim) en de bezorgcode
(`mode.bezorgcode`). Die laatste blijft met opzet vier cijfers omdat het lid hem
voorleest: `entropy_bits` staat eerlijk op onwaar, en de deur draagt `korte_code`
(gebonden aan een bezorging, eenmalig, zeven dagen, vergrendeld na vijf fouten,
hooguit tien codes, HMAC met serversleutel) -- zonder die grenzen weigert
`scripts/codecredentials.js` de migratie. Oude codes van alle vier worden niet
gehonoreerd; dat staat per deur als open besluit.

**Juridisch open (E8), en niet door code te beslissen:** een opwaardeerkaart die
tegen nominale waarde in een uitbetaalbare wallet landt, is vermoedelijk
elektronisch geld (terugstortstand `open`, `WAARDE.md`, `TOKEN.md`). Wie contant
geld of een overboeking voor een kaart aanneemt, raakt derdengelden. Beide horen
bij de jurist vóór de kaart live gaat; de code bouwt de kaart fail-closed en
zonder uitbetaalweg tot dat oordeel er is.

## 2. Afhankelijkheidsgraaf

```
B1 sleutels ─┬─> CI release-image draait ─┬─> A3 suite, A4 scherm, A5 pg, A7 bron (als CI-kopie)
             │                            ├─> SBOM + herkomst + inhoudsbewijs
             │                            └─> kandidaat-images ─> live:golive op E2 ─> kandidaatbewijs
             └─> dossier tekenen (evidence-sleutel) ─> extern dossier
A1 gate-slot ──> A5/A6/release-gate-bewijs ──> afbouw:software groen ──> CI release-image
A2 accounts ───> golive.accounts ─────────────────┐
B2/B3 + E9 geld ─> golive.geld + geldmotor ───────┼─> golive-bewijs ─> kandidaat ─> READY
B4 papierwerk, B5 sms, B7 IBAN, E3-E6 config ─────┘
E2 host ─> A8 herstel, A9 rollback, A10 malware, A11 media (producenten) ─> dossier
E1, E8, E10, E7 ─────────────────────────────────────────────────────────> dossier
```

Wat het meeste vrijgeeft: **A1** (klein, ontgrendelt de hele CI-bewijsketen),
**A2** (enige grote codeblokkade; zonder hem kan in productie niemand een account
aanmaken), en **B1** (zonder sleutels komt er geen enkel image).

## 3. Wat hier niet weggepoetst mag worden

- **Het externe dossier leest de inhoud van een bewijsbestand niet.** Elk niet-
  leeg bestand met de juiste hash telt (`external-release.js:80-87,131-137`).
  De handtekening van de beoordelaar is dus het enige wat een lege PDF
  tegenhoudt. Voor de machinale velden (A8–A11) hoort een producent met een
  vaste vorm; de rest blijft mensenwerk en blijft `OPEN` tot het er echt is.
- **A2 heeft een ontwerprisico dat eerst beantwoord moet worden:** de
  requesttransactie houdt `BEGIN IMMEDIATE` op SQLite vast tijdens een
  asynchrone PostgreSQL-commit, terwijl andere schrijvers op `rtg.db`
  (`busy_timeout=5000`, NOTIFY-pulls in `mirror.js`, `intreklijst`) de event loop
  synchroon kunnen blokkeren. Zonder oplossing daarvoor is de reparatie een
  nieuwe storing.
- **Niets in deze lijst wordt groen gemaakt door een bestand te kopiëren.**
  `productie-oordeel.js` leest `.release/ci-*`; een handkopie van een lokale run
  zou drie blokkades sluiten zonder CI. Lokale runs zijn hier bewijs voor ONS,
  niet voor de poort.
