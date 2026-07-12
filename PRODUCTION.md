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

---

## 3. Verplichte configuratie in productie

| Variabele | Waarom |
|---|---|
| `NODE_ENV=production` | Zet demo uit, https-redirect + HSTS aan |
| `RTG_ENC_KEY` | Versleuteling-at-rest. 64 hex-tekens (`openssl rand -hex 32`). Zonder dit weigert de start, tenzij je bewust `RTG_ALLOW_PLAINTEXT=1` zet |
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
- **Data-duurzaamheid** — schrijven gaat atomisch (tmp + rename) én duurzaam
  (`fsync` op bestand en map), plus dagelijkse back-ups met retentie en een
  tweede-schijf-kopie (`RTG_BACKUP_DIR`). Herstelt automatisch uit de nieuwste
  back-up als het hoofdbestand corrupt is.
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

- [ ] `.env` ingevuld; `NODE_ENV=production`; `RTG_ENC_KEY` gezet
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
3. **Database onder last.** De JSON/SQLite-laag met eigen merge is knap, maar
   niet bewezen voor grote volumes. Voor echte schaal: migreer de opslaglaag naar
   PostgreSQL (de opslag zit al achter één interface, dus dit is te doen) en
   draai load-tests.
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
