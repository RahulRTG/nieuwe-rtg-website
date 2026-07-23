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
| `RTG_TLS=1` | De app termineert **zelf** TLS/HTTPS op Node's tls-stack (HTTP/2 + HTTP/1.1-terugval via ALPN, TLS 1.2 als vloer, harde ciphers) — een aparte reverse proxy voor TLS is dan niet meer nodig. Zonder cert maakt ze een self-signed voor local |
| `RTG_ACME=1` + `RTG_TLS_DOMAIN` + `RTG_TLS_EMAIL` | Met `RTG_TLS=1`: de app haalt en vernieuwt **zelf** een echt Let's Encrypt-certificaat (eigen ACME-client, HTTP-01 op poort 80, live cert-herlaad zonder herstart). `RTG_ACME_STAGING=1` om eerst tegen de staging-CA te oefenen |

Aanbevolen: `SENTRY_DSN` (fouttracking), SMTP (`SMTP_URL`), `STRIPE_SECRET_KEY`
+ `STRIPE_WEBHOOK_SECRET` (echte betalingen), `ANTHROPIC_API_KEY` (AI).

Volledige lijst met uitleg: `.env.example`.

### Native TLS + eigen ACME (reverse proxy optioneel)

De app kan HTTPS zelf termineren, zonder nginx/Caddy ervoor:

- **Snel, met een echt certificaat:** `RTG_TLS=1 RTG_ACME=1 RTG_TLS_DOMAIN=rahultravelgroup.example RTG_TLS_EMAIL=… npm start`. De app luistert HTTPS op `PORT`, start een kleine HTTP-responder op poort 80 (die de ACME-challenge serveert én al het overige verkeer naar HTTPS 301'ert), haalt bij Let's Encrypt een certificaat op via HTTP-01, laadt het live in en vernieuwt het automatisch ~30 dagen voor het verloopt. Dit vereist dat poort 80 én 443 vanaf internet bereikbaar zijn voor het domein. Oefen eerst met `RTG_ACME_STAGING=1` (geen rate-limits).
- **Alleen TLS, cert regel je zelf:** `RTG_TLS=1` met `RTG_TLS_CERT`/`RTG_TLS_KEY` naar je eigen PEM-bestanden.
- **Local/dev:** alleen `RTG_TLS=1` — de app genereert een self-signed cert (in `<datamap>/tls/`, gitignore) en spreekt meteen HTTPS.

Het sleutelmateriaal (self-signed cert, ACME-accountsleutel, opgehaalde certificaten) staat onder `<datamap>/tls/` en wordt nooit gecommit. Een reverse proxy/CDN (Cloudflare) ervoor mag nog steeds — dan laat je `RTG_TLS` uit en blijft `trust proxy` de bron van waarheid voor `X-Forwarded-Proto`.

---

## 4. Wat er in de code al productie-klaar is

- **Observability** — gestructureerde JSON-logs (`server/log.js`), per verzoek
  een correlatie-id (`X-Request-Id`), duur en status; centrale foutafhandeling
  met stack; een eigen in-memory fout-aggregatie op het techniekbord (ERR-01 +
  de storingslijst); optionele Sentry-koppeling erbovenop via `SENTRY_DSN`.
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
- **Archiefkast** - afgeronde tickets ouder dan `RTG_ARCHIEF_DAGEN`
  (standaard 92, een afgesloten kwartaal) verhuizen automatisch naar
  append-only maandbestanden in `RTG_DATA_DIR/archief`. De levende kast
  blijft daardoor klein en snel; de boekhoud-export en de backoffice-totalen
  tellen het archief gewoon mee, en er raakt nooit iets zoek (eerst duurzaam
  naar schijf, dan pas uit de levende kast).
- **Inlogpieken** - wachtwoord-hashing (scrypt) rekent asynchroon in de
  libuv-threadpool naast de server; server.js zet `UV_THREADPOOL_SIZE`
  standaard op het aantal CPU-kernen (minimaal 4). Gemeten op een
  miljoen-leden database met 100 gelijktijdige logins: de site blijft vlot
  terwijl de logins doorstromen. scrypt is puur rekenwerk, dus de
  piekcapaciteit per instance schaalt met de kernen van de machine;
  meer draden dan kernen levert niets op. Meer capaciteit = zwaardere
  machine of meer instances (vloot/trio).
- **Graceful shutdown** — `SIGTERM`/`SIGINT` schrijven data weg en sluiten netjes.
- **Failover** — drie-server-cluster met poortwachter (`server/trio.js`).
- **Toegankelijkheid** — alle vlaggenschip-schermen axe-schoon (CI bewaakt dit).

## 5. Schalen naar miljoenen

Eerlijk over de plafonds en hoe je eroverheen komt. De kern van het advies:
**één proces schaal je verticaal tot een grens; daarna schaal je horizontaal
achter de poortwachter, met Postgres en Redis overal aan.**

### Bekende plafonds van één proces
- **Doorvoer** — een enkel Node-proces haalt in de praktijk ~1.400–1.700
  req/s voor de gewone JSON-endpoints (afhankelijk van de machine). Dat is
  ruim voor een enkele zaak of stad, maar niet voor miljoenen gelijktijdige
  gebruikers op één proces.
- **Geheugen-snapshot** — de lokale-bestand-modus houdt de levende data in
  het geheugen. Dat plafond is bewust gemitigeerd: afgeronde tickets verhuizen
  naar het **archief** (append-only maandbestanden, zie §4) en de bulk-zaken
  staan in het **Postgres-grootboek**, zodat de levende kast klein blijft en de
  totalen tóch eerlijk over alles tellen. Voor echte schaal is de
  lokale-bestand-modus echter niet bedoeld: zet `DATABASE_URL`.
- **Rekenpieken (login)** — scrypt is puur rekenwerk; de piekcapaciteit per
  instance schaalt met de CPU-kernen (zie §4). Meer capaciteit = meer/zwaardere
  instances.

### Horizontaal uitschalen (de route naar miljoenen)
1. **Postgres overal aan.** Zet `DATABASE_URL`; gedeelde data én accounts
   draaien dan op PostgreSQL met transacties, row-locks, `LISTEN/NOTIFY` en de
   3-weg-merge tegen gelijktijdige schrijvers. Zonder dit heeft elke instance
   zijn eigen snapshot en lopen de instances uit elkaar.
2. **Redis-bus overal aan.** Zet `REDIS_URL`. Realtime-events (SSE) gaan dan
   over Redis pub/sub, zodat een gebruiker op instance A een event ziet dat op
   instance B is veroorzaakt. Zonder Redis werkt realtime alleen binnen één
   proces.
3. **Deel de gedeelde geheimen.** Bij meerdere instances moeten
   `RTG_VAULT_KEY`, `RTG_SECRET_KEY` (en `RTG_ENC_KEY`) op alle instances
   gelijk zijn, anders kan de ene instance de versleutelde naam/e-mail van de
   andere niet lezen en kloppen e-mail-login-hash en sessietokens niet (zie §4).
   **Ook de mediastore moet gedeeld zijn:** zet `RTG_MEDIA_BACKEND=s3` met
   `RTG_MEDIA_S3_*` (AWS S3, Cloudflare R2, MinIO, Backblaze). Salon-foto's en
   snaps staan dan als losse, versleutelde objecten in gedeelde objectopslag i.p.v.
   base64 in de database of op de lokale schijf van één instance; een lokale
   warme cache houdt veelgevraagde foto's snel. De `/media`-route mag achter een
   CDN (de responses zijn `immutable`). Zonder S3 op meerdere instances ziet
   alleen de instance die de foto ontving hem — de config-check waarschuwt hiervoor.
4. **Zet er meer instances achter een load balancer.** De app is stateless
   tussen requests (sessie zit in Postgres, niet in procesgeheugen), dus je kunt
   naar believen instances bijzetten. TLS-termination vóór de app (reverse proxy
   met `trust proxy`) **of** native in de app (`RTG_TLS=1`, zie §3). Sticky sessions zijn niet nodig; alleen voor de
   SSE-verbinding is een langlevende connectie handig, maar de Redis-bus levert
   events naar de juiste instance ongeacht waar de gebruiker hangt.
5. **Kies de procesindeling die past.**
   - **Vloot-modus** (`npm run vloot`, §2): één machine, per domein een proces,
     foutisolatie + herstart per groep. Goede eerste stap.
   - **Trio/failover** (`server/trio.js`, §4): drie servers met poortwachter en
     automatische overname voor beschikbaarheid.
   - **Kubernetes/containers**: het Docker-image (§1) draait ongewijzigd;
     schaal per domein-deployment met de Redis-bus en Postgres als gedeelde laag.

### Wat hierna nog rest (bewuste keuzes, geen code-blokkade)
- **Load-tests op productievolume** en het afstemmen van Postgres pool-/
  connectielimieten en een read-replica-/backup-strategie voor Postgres zelf
  (zie ook §7).
- **Lijst-virtualisatie in de backoffice.** De API's zijn al gepagineerd en
  geven eerlijke totalen los van de paginagrootte, dus de server schaalt. Voor
  extreem lange lijsten in het kantoorscherm is client-side virtualisatie
  (alleen de zichtbare rijen in de DOM) nog een open, puur front-end
  verbetering; functioneel is er geen blokkade.
- **CDN voor statische assets.** De build hasht bestandsnamen en de
  service-worker cachet ze al; een CDN vóór de app haalt die last verder weg.

---

## 6. Go-live checklist

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

**De snelste route (een avond werk):**

1. `npm run sleutels -- --schrijf` — genereert ALLE geheimen (inclusief het
   2FA-secret met scanbare otpauth-regel) en zet ze in `.env.productie`
   (rechten 600, staat in `.gitignore`).
2. Vul in `.env.productie` de HANDMATIG-regels in: `RTG_OWNER_EMAIL`,
   `APP_URL`, `DATABASE_URL`, `REDIS_URL`, `SMTP_URL`.
3. `npm run golive` — leest `.env.productie` vanzelf mee, raakt PostgreSQL
   echt aan en keurt; exitcode 0 = de configuratie is klaar.
4. Zet de reverse proxy (TLS) en de DNS-rand (Cloudflare) ervoor, laad
   `.env.productie` als omgeving en start met `NODE_ENV=production`.

- [ ] `npm run golive` geeft exitcode 0 op de productiemachine
- [ ] `RTG_OWNER_EMAIL` is het echte adres van de eigenaar (verplicht; het voorbeeldadres blokkeert de start)
- [ ] `.env` ingevuld; `NODE_ENV=production`; `RTG_ENC_KEY` gezet
- [ ] `DATABASE_URL` gezet, PostgreSQL draait; back-up/restore van de database één keer geoefend
- [ ] TLS geregeld: óf een reverse proxy/load balancer vóór de app met `trust proxy` aan, óf native in de app (`RTG_TLS=1`, evt. `RTG_ACME=1` voor een automatisch Let's Encrypt-certificaat) — poort 80 + 443 bereikbaar
- [ ] Redis draait en `REDIS_URL` is gezet (bij >1 instance)
- [ ] `SENTRY_DSN` gezet en er komt een testfout binnen
- [ ] SMTP getest (herstel-link komt echt aan)
- [ ] Stripe live-keys + webhook-endpoint (`/api/betaal/webhook`) geregistreerd en getest
- [ ] Back-up-volume gemount; herstel-uit-back-up één keer geoefend
- [ ] `npm run check` en `npm test` groen in CI; image bouwt
- [ ] Logs komen ergens terecht (Loki/CloudWatch/Datadog)
- [ ] Uptime-/health-monitor prikt op `/api/ready`
- [ ] `OFFICE_TOTP_SECRET` gezet en de authenticator-app gekoppeld (2FA op de backoffice; de keuring waarschuwt zolang hij ontbreekt)
- [ ] Inlog-auditlog gecontroleerd na de eerste inlog (RTG HQ, kaart "Inlogactiviteit")
- [ ] Rate-limiter bevestigd: in productie geeft de API boven 300 verzoeken/minuut/IP een 429 (test/livegang.test.js bewijst dit)
- [ ] Schone start bevestigd: in productie zonder `RTG_DEMO` zijn er geen demozaken, geen demopersoneel en geen voorbeeldposts; ook een database die als demo begon wordt bij de start opgeschoond (test/livegang.test.js)
- [ ] Schild getest: de applicatie-WAF blokkeert sondes (wp-admin, .env, pad-klimmen) en de DDoS-rem zet een stormend IP 15 minuten op de banlijst; meldingen komen op het beveiligingsbord binnen (test/schild.test.js)
- [ ] Rand-DDoS geregeld: DNS achter Cloudflare (of gelijkwaardig) met proxy aan, zodat volumetrische golven de server nooit bereiken; de app-WAF en -rem zijn de tweede linie
- [ ] TURN draait: coturn met `use-auth-secret` en `static-auth-secret` gelijk aan `TURN_SECRET`; `/api/ice` geeft kortlevende inloggegevens terug en (video)bellen werkt vanaf 4G/strenge firewalls

---

## 7. Wat code NIET oplost, en vóór een echte lancering moet (eerlijk)

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
