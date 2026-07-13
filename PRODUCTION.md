# Productie-draaiboek (RTG / RTFoundation)

Dit document beschrijft hoe je de server veilig live zet, wat er in de code al
voor productie is geregeld, en, net zo belangrijk, **wat er nog buiten de code
moet gebeuren voordat je echt open mag**. Wees hier eerlijk over: de code is
bijna productiekwaliteit, maar "live met echt geld en echte (soms
minderjarige) gebruikers" vraagt meer dan code alleen.

---

## 1. Snel starten (Docker)

```bash
cp .env.example .env            # vul de geheimen in
docker compose up -d --build
docker compose logs -f app
```

- Liveness: `GET /api/health` (proces leeft)
- Readiness: `GET /api/ready` (mag verkeer krijgen; 503 als de datalaag nog niet klaar is)

## 2. Zonder Docker

```bash
npm ci --omit=dev
NODE_ENV=production RTG_ENC_KEY=... node --experimental-sqlite server/server.js
```

De server **weigert te starten** als productie onveilig is ingesteld (demo aan,
geen versleutelingssleutel, standaard-geheimen). Dat is bewust, zie
`server/config.js`.

### Vloot-modus: elke app zijn eigen proces (foutisolatie)

```bash
DATABASE_URL=postgres://... REDIS_URL=redis://... npm run vloot
```

`server/vloot.js` start het platform als losse processen achter de
poortwachter: **leden** (auth, member, social, zakelijk), **partners**
(supplier, staff), **kantoor** (office, techniek) en **rtf** (kern +
foundation). Crasht een groep, dan geeft de gateway alleen voor dat domein
een 502 en herstart de vloot hem automatisch met oplopende wachttijd; de
andere apps merken er niets van. Indeling aanpassen kan met
`RTG_VLOOT_GROEPEN`. Voor productie zijn PostgreSQL en de Redis-bus
verplicht (anders heeft elk proces zijn eigen data-snapshot). Daarnaast is
elke route-handler omhuld: een (async) bug in een route geeft die ene
aanvraag een nette 500 en raakt de rest van het proces nooit.

---

## 3. Verplichte configuratie in productie

| Variabele | Waarom |
|---|---|
| `NODE_ENV=production` | Zet demo uit, https-redirect + HSTS aan |
| `RTG_ENC_KEY` | Versleuteling-at-rest. 64 hex-tekens (`openssl rand -hex 32`). Zonder dit weigert de start, tenzij je bewust `RTG_ALLOW_PLAINTEXT=1` zet |
| `DATABASE_URL` | PostgreSQL voor de gedeelde data (aanbevolen voor productie en meerdere instances). Leeg = lokaal bestand |
| `APP_URL` | Correcte links in e-mails |
| `REDIS_URL` | Nodig zodra je meer dan één instance draait (realtime over instances) |

Aanbevolen: `SENTRY_DSN` (fouttracking), SMTP (`SMTP_URL`), `STRIPE_SECRET_KEY`
+ `STRIPE_WEBHOOK_SECRET` (echte betalingen), `ANTHROPIC_API_KEY` (AI).

Volledige lijst met uitleg: `.env.example`.

---

## 4. Wat er in de code al productie-klaar is

- **Observability** — gestructureerde JSON-logs (`server/log.js`), per verzoek
  een correlatie-id (`X-Request-Id`), duur en status; centrale foutafhandeling
  met stack; optionele Sentry-koppeling via `SENTRY_DSN`.
- **Fail-fast configuratie** — `server/config.js` stopt de start bij een
  onveilige productie-instelling.
- **Opslag** — zowel de gedeelde data als de **accounts** draaien op
  **PostgreSQL** (`DATABASE_URL`): transacties, row-locks en `LISTEN/NOTIFY` voor
  live cross-instance-updates, met dezelfde 3-weg-merge zodat gelijktijdige
  schrijvers elkaar niet overschrijven. Accounts krijgen globaal-unieke id's uit
  een Postgres-reeks (blokken per instance), en SQLite blijft als lokale
  synchrone cache. Een lokale snapshot dient als warme cache en fallback als
  Postgres even wegvalt. Zonder `DATABASE_URL` valt de app terug op een lokaal
  bestand (of `RTG_STORE=sqlite`).
  **Let op bij meerdere instances:** zet `RTG_VAULT_KEY` en `RTG_SECRET_KEY`
  (gedeeld en gelijk), anders kan de ene instance de versleutelde naam/e-mail van
  de andere niet lezen en kloppen de e-mail-login-hash en sessietokens niet.
- **Data-duurzaamheid** — lokaal wegschrijven gaat atomisch (tmp + rename) én
  duurzaam (`fsync` op bestand en map), plus dagelijkse back-ups met retentie en
  een tweede-schijf-kopie (`RTG_BACKUP_DIR`). Herstelt automatisch uit de
  nieuwste back-up als het hoofdbestand corrupt is.
- **Betaal-naad** — `server/betaal.js`: idempotente betalingen (geen
  dubbele afschrijving bij herhaling) en webhook-verificatie met handtekening.
  Zonder Stripe-key draait de demo-provider.
- **Security** — https-redirect + HSTS, strikte CSP (met per-antwoord nonce voor
  scripts), `nosniff`/`DENY`/referrer/permissions-headers, token-hashing,
  sessieverloop, rate-limits, AVG-rechten (inzage + verwijderen).
- **Graceful shutdown** — `SIGTERM`/`SIGINT` schrijven data weg en sluiten netjes.
- **Failover** — drie-server-cluster met poortwachter (`server/trio.js`).
- **Toegankelijkheid** — alle vlaggenschip-schermen axe-schoon (CI bewaakt dit).

## 5. Go-live checklist

De eerste twee stappen zijn geautomatiseerd:

```bash
npm run sleutels   # maakt alle geheimen in een keer (.env-blok)
npm run golive     # keurt de omgeving: exitcode 0 = klaar om live te gaan
```

De keuring beoordeelt de configuratie op productieniveau, probeert PostgreSQL
echt te bereiken en somt blokkerende punten op. De testsuite bevat bovendien
een generale repetitie (`test/golive.test.js`) die de server echt in
productiestand start en bewijst: onveilige start geweigerd, demo dicht, geen
dev-lekken, registratie/eigenaar/backoffice werken.

- [ ] `npm run golive` geeft exitcode 0 op de productiemachine
- [ ] `RTG_OWNER_EMAIL` is het echte adres van de eigenaar (verplicht; het voorbeeldadres blokkeert de start)
- [ ] `.env` ingevuld; `NODE_ENV=production`; `RTG_ENC_KEY` gezet
- [ ] `DATABASE_URL` gezet, PostgreSQL draait; back-up/restore van de database één keer geoefend
- [ ] TLS-termination (reverse proxy / load balancer) vóór de app; `trust proxy` staat aan
- [ ] Redis draait en `REDIS_URL` is gezet (bij >1 instance)
- [ ] `SENTRY_DSN` gezet en er komt een testfout binnen
- [ ] SMTP getest (herstel-link komt echt aan)
- [ ] Stripe live-keys + webhook-endpoint (`/api/betaal/webhook`) geregistreerd en getest
- [ ] Back-up-volume gemount; herstel-uit-back-up één keer geoefend
- [ ] `npm run check` en `npm test` groen in CI; image bouwt
- [ ] Logs komen ergens terecht (Loki/CloudWatch/Datadog)
- [ ] Uptime-/health-monitor prikt op `/api/ready`

---

## 6. Wat code NIET oplost, en vóór een echte lancering moet (eerlijk)

Dit is het deel dat je niet in dit repo kunt afvinken:

1. **Externe security-audit / pentest.** De basis is verstandig, maar niet door
   een derde geverifieerd. Doe dit vóór je echt geld en persoonsgegevens raakt.
2. **Echte betaalcertificering.** De naad staat klaar, maar PCI-scope,
   terugboekingen, refunds, boekhouding en reconciliatie zijn nog werk.
3. **Database onder last.** De gedeelde data én de accounts draaien nu op
   PostgreSQL (transacties, row-locks, LISTEN/NOTIFY, item-merge bij gelijktijdige
   schrijvers, globaal-unieke id's), met tests voor correctheid en multi-writer.
   Wat nog rest: load-tests op productievolume, afstemmen van pool/connlimits, en
   een read-replica-/backup-strategie voor Postgres zelf.
4. **Kinderen en moderatie (het zwaarst).** De RTFoundation richt zich op
   minderjarigen, met chat, snaps en (video)bellen. Dat vereist: echte moderatie
   (mensen + tooling, niet alleen block/report), leeftijdsverificatie, een DPIA,
   meldroutes en toezicht. Dit is een *voorwaarde om te mogen starten*, geen
   latere feature.
5. **Juridisch.** Voorwaarden, verwerkersovereenkomsten, cookie-/privacybeleid
   en aansprakelijkheid moeten door een jurist zijn getoetst voor de doelgroepen
   en landen waarin je draait.
6. **Breder testen.** De testsuite dekt de kritieke paden (veiligheid, realtime,
   betaal-naad, config, opslag). UI-flows en edge-cases verdienen meer dekking.

Kort: **de code is klaar om te draaien; het product is klaar om te starten
zodra de zes punten hierboven zijn geregeld.**
