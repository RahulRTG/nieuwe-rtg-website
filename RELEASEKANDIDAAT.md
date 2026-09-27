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
| A8 | bewijsproducent herstelproef | GEEN PRODUCENT | JA | host | NEE | `backup-herstel.json` | `scripts/docker/herstel.sh`, `live.sh restore` | `livegang-pakket.test.js`, `herstelproef.test.js` | restore-pad laat een machineleesbaar, commitgebonden verslag achter (tijden, sha's, de twee handcontroles als open velden) | E2 (echte host) |
| A9 | bewijsproducent rollback | GEEN PRODUCENT | JA | host | NEE | `deployment-rollback.json` | `scripts/docker/live.sh rollback` | `uitrol.test.js`, `release-hardening.test.js:153` | idem voor rollback: vorige/nieuwe digest, readiness-tijden | E2, B1 |
| A10 | bewijsproducent malwaredefinities | GEEN PRODUCENT | JA | host | NEE | `malware-definitions-scan.json` | `server/kern/clamd.js` | `uploadquarantaine.test.js` | clamd-versie/definitiedatum + EICAR-scan als verslag | E2 |
| A11 | bewijsproducent objectopslag | GEEN PRODUCENT | JA | bucket | NEE | `object-storage-delivery.json` | `golive.js:192-195` (`beproefMedia`) | `media.test.js` | bestaande golive-proef als los verslag exporteren | E3 |
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
