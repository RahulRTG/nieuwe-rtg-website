# Productie-draaiboek (RTG / RTFoundation)

Dit document beschrijft hoe je de server veilig live zet, wat er in de code al
voor productie is geregeld, en, net zo belangrijk, **wat er nog buiten de code
moet gebeuren voordat je echt open mag**. Wees hier eerlijk over: de code is
bijna productiekwaliteit, maar "live met echt geld en echte (soms
minderjarige) gebruikers" vraagt meer dan code alleen.

---

## 1. Snel starten (Docker)

Eerst veilig lokaal bouwen, zonder te doen alsof mail of betalingen al echt
zijn:

```bash
npm run selfhost:init -- --eigenaar=jij@domein.nl
npm run selfhost:check
docker compose up -d --build
docker compose ps
```

Open `http://127.0.0.1:3000`. Docker publiceert de app bewust alleen op de
loopback; PostgreSQL, Redis en de Rust-motor hebben helemaal geen hostpoort.
De containers draaien met een read-only root, zonder extra Linux-capabilities
en met begrensde, roterende logs. Geheimen komen uit `.env.productie` en
`.rtg-secrets/postgres_password` als Docker secrets en staan niet als losse
waarden in `docker inspect`.

`selfhost:init` overschrijft bestaande sleutels nooit. Voor publieke livegang:
verwijder `RTG_PRIVATE_BETA=1`, zet een HTTPS-`APP_URL`, SMTP en een echte
betaalprovider, draai `npm run golive`, en zet pas daarna een TLS-tunnel of
reverse proxy voor de loopbackpoort.

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

### Op een Mac (Mac mini als thuisserver)

```bash
mv ~/Desktop/nieuwe-rtg-website ~/rtg        # niet in een map die macOS afschermt
cd ~/rtg
sudo scripts/mac/installeer.sh --eigenaar=jij@voorbeeld.nl --slaap-uit
```

Zolang mail en betalingen nog niet aangesloten zijn, voeg je bewust
`--private-beta` toe. Die stand werkt alleen met localhost, `.local` of een
privaat LAN-adres en wordt door `npm run golive` altijd afgekeurd.

Dit zet RTG als **launchd-daemon** neer: hij start bij het aanzetten van de
machine (zonder dat er iemand inlogt), komt terug na een crash en na een
stroomstoring. Het installatiescript maakt de geheimen met `npm run sleutels`,
zet ze in `/usr/local/etc/rtg/rtg.env` met rechten 600, keurt de configuratie
vóórdat het de dienst laadt, en overschrijft een bestaand geheimenbestand
**nooit** (daar zit `RTG_VAULT_KEY` in). In het plist staan geen sleutels:
alles in `/Library/LaunchDaemons` is voor iedereen leesbaar.

Details, achtergrond en het dagelijks gebruik (`launchctl print`, `kickstart`,
logboeken, energie-instellingen): `scripts/mac/LEESMIJ.md`. Weghalen kan met
`sudo scripts/mac/verwijder.sh`.

---

## 3. Verplichte configuratie in productie

| Variabele | Waarom |
|---|---|
| `NODE_ENV=production` | Zet demo uit, https-redirect + HSTS aan |
| `RTG_ENC_KEY` | Versleuteling-at-rest. 64 hex-tekens (`openssl rand -hex 32`). Zonder dit weigert de start, tenzij je bewust `RTG_ALLOW_PLAINTEXT=1` zet |
| `RTG_VAULT_KEY` | De sleutel van de identiteitskluis (echte naam, e-mail, telefoon). 64 hex-tekens. **Zonder dit weigert de start.** Staat hij niet in de omgeving, dan maakt de server hem als bestand `vault.key` in de datamap — naast `rtg.db`. Wie die map steelt heeft dan de data én de sleutel, en zijn de codenamen weer namen. Hoort uit een secrets manager te komen |
| `RTG_SECRET_KEY` | Ondertekent de sessietokens. 64 hex-tekens. **Zonder dit weigert de start**, om dezelfde reden: anders komt `secret.key` naast de database te liggen, en kan wie hem heeft zelf geldige sessies maken |
| `DATABASE_URL` | PostgreSQL voor de gedeelde data (aanbevolen voor productie en meerdere instances). Leeg = lokaal bestand |
| `APP_URL` | Correcte links in e-mails |
| `REDIS_URL` | Nodig zodra je meer dan één instance draait (realtime over instances) |
| `RTG_TLS=1` | De app termineert **zelf** TLS/HTTPS op Node's tls-stack (HTTP/2 + HTTP/1.1-terugval via ALPN, TLS 1.2 als vloer, harde ciphers) — een aparte reverse proxy voor TLS is dan niet meer nodig. Zonder cert maakt ze een self-signed voor local |
| `RTG_ACME=1` + `RTG_TLS_DOMAIN` + `RTG_TLS_EMAIL` | Met `RTG_TLS=1`: de app haalt en vernieuwt **zelf** een echt Let's Encrypt-certificaat (eigen ACME-client, HTTP-01 op poort 80, live cert-herlaad zonder herstart). `RTG_ACME_STAGING=1` om eerst tegen de staging-CA te oefenen |

Aanbevolen: `ERR_WEBHOOK_URL` (externe alarmering), SMTP (`SMTP_URL`), `STRIPE_SECRET_KEY`
+ `STRIPE_WEBHOOK_SECRET` (echte betalingen), `ANTHROPIC_API_KEY` (AI).

Volledige lijst met uitleg: `.env.example`.

### Native TLS + eigen ACME (reverse proxy optioneel)

De app kan HTTPS zelf termineren, zonder nginx/Caddy ervoor:

- **Snel, met een echt certificaat:** `RTG_TLS=1 RTG_ACME=1 RTG_TLS_DOMAIN=rahultravelgroup.example RTG_TLS_EMAIL=… npm start`. De app luistert HTTPS op `PORT`, start een kleine HTTP-responder op poort 80 (die de ACME-challenge serveert én al het overige verkeer naar HTTPS 301'ert), haalt bij Let's Encrypt een certificaat op via HTTP-01, laadt het live in en vernieuwt het automatisch ~30 dagen voor het verloopt. Dit vereist dat poort 80 én 443 vanaf internet bereikbaar zijn voor het domein. Oefen eerst met `RTG_ACME_STAGING=1` (geen rate-limits).
- **Alleen TLS, cert regel je zelf:** `RTG_TLS=1` met `RTG_TLS_CERT`/`RTG_TLS_KEY` naar je eigen PEM-bestanden.
- **Local/dev:** alleen `RTG_TLS=1` — de app genereert een self-signed cert (in `<datamap>/tls/`, gitignore) en spreekt meteen HTTPS.

Het sleutelmateriaal (self-signed cert, ACME-accountsleutel, opgehaalde certificaten) staat onder `<datamap>/tls/` en wordt nooit gecommit. Een reverse proxy/CDN (Cloudflare) ervoor mag nog steeds — dan laat je `RTG_TLS` uit en blijft `trust proxy` de bron van waarheid voor `X-Forwarded-Proto`.

### Backup en herstel (oefen dit, geloof het niet)

De server maakt elke dag een backup in `<datamap>/backups/<datum>/`, en met
`RTG_BACKUP_DIR` ook een kopie op een tweede schijf. Meegekopieerd worden
`db.json`, `rtg.db`, `store.db` en hun `-wal`-bestanden. Vóór het kopiëren
wordt de SQLite-WAL in het hoofdbestand gevouwen; zonder die stap kopieert hij
bestanden waar de recentste gegevens niet in staan.

**De sleutels zitten NIET in de backup, en dat hoort zo.** `vault.key` en
`secret.key` staan er bewust buiten: zou de sleutel in dezelfde backup zitten,
dan opent een gestolen backup zichzelf. Dat betekent wel dat de backup in zijn
eentje waardeloos is. Bewaar `RTG_VAULT_KEY` en `RTG_SECRET_KEY` in een
secrets manager, met een tweede kopie ergens waar je erbij kunt als die
secrets manager onbereikbaar is. Zonder die sleutels krijg je na een herstel
wel alle accounts terug, maar geen enkele naam: die blijven versleuteld.

In Docker draait daarnaast een onafhankelijke `backup`-container. Die maakt:

- een PostgreSQL-dump in custom format en laat `pg_restore --list` hem direct
  valideren;
- een archief van de laatst atomisch afgeronde app-/mediaback-up;
- SHA-256-controlesommen over beide artefacten;
- retentie van standaard 30 dagen.

De hostbestanden staan standaard in `./backups`. Zet
`RTG_BACKUP_HOST_DIR=/Volumes/RTG-Backup` (of een andere afzonderlijke schijf)
voordat je Compose start; een back-up op dezelfde fysieke schijf beschermt
niet tegen schijfverlies.

Herstellen:

```bash
systemctl stop rtg                      # of: docker compose down
cp <datamap>/backups/<datum>/* <datamap>/
export RTG_VAULT_KEY=...  RTG_SECRET_KEY=...   # uit de secrets manager
systemctl start rtg
```

Controleer daarna dat een bestaand lid kan inloggen én dat zijn echte naam
zichtbaar is -- dat tweede bewijst dat de kluis het weer doet.

`test/herstelproef.test.js` loopt deze hele ronde automatisch door: aanmaken,
backuppen, datamap wissen, terugzetten, opstarten, controleren. Draai hem als
je iets aan de opslag verandert.

#### Hoe lang duurt het? (gemeten, niet aangenomen)

`scripts/hersteltijd.js` doet dezelfde ronde maar met een stopwatch, op een
database van een opgegeven omvang. Draai: `node --experimental-sqlite
scripts/hersteltijd.js 250000`.

Gemeten op **2 augustus 2026**, op de ontwikkelmachine:

| Leden | Back-up | Terugzetten | Server op | **RTO** |
|---|---|---|---|---|
| 25.000 (13,8 MB) | 14 ms | 14 ms | 7,6 s | **7,7 s** |
| 250.000 (144,1 MB) | 210 ms | 166 ms | 8,7 s | **8,9 s** |

RTO = van "de schijf is weg" tot "een lid is ingelogd en zijn naam is weer
leesbaar". Tienmaal zoveel leden kost maar ruim een seconde extra, omdat het
grootste deel de serverstart is en niet de gegevens -- dat is goed nieuws voor
de schaalbaarheid en slecht nieuws als je de RTO omlaag wilt: dan moet de
opstarttijd omlaag, niet de back-up.

<sub>Ter vergelijking, dezelfde meting op 29 juli 2026: 9,8 s (25.000) en 13,1 s
(250.000). Het verschil zit vrijwel helemaal in de serverstart en in het
kopieren; de winst op het kopieren komt van het werk aan de opslaglaag van deze
week. De rij van 250.000 werd 4,2 seconden sneller. Oude cijfers blijven hier
staan omdat een RTO zonder trend niet te beoordelen is: een enkel getal kan een
toevallig rustige machine zijn.</sub>

**Twee dingen die deze cijfers NIET zeggen.** Ze zijn gemeten op een lokale
schijf; een back-up van een tweede locatie ophalen telt daar de overdracht bij
op. En de echte tijd tot dienstverlening begint bij het OPMERKEN en het besluit
om te herstellen -- meestal het langste deel van de keten. Zie `SLO.md`.

**RPO** (hoeveel werk je kwijt bent) volgt uit het back-upritme, niet uit een
meting: bij een dagelijkse back-up is dat tot 24 uur. Wil je daaronder, dan is
er vaker back-uppen nodig, of Postgres met point-in-time recovery.

### Zet een proxy ervoor? Strip dan `token` uit zijn access log

De live-verbindingen (SSE) kunnen geen `Authorization`-header meesturen —
`EventSource` in de browser kan dat simpelweg niet — dus daar reist het
sessietoken mee als `?token=…` in de URL.

De app zelf logt dat niet: `server/log.js` schrijft `req.path`, en dat is het
pad **zonder** querystring (`test/loghygiene.test.js` bewaakt dat). Ook stuurt
de app `Referrer-Policy: strict-origin-when-cross-origin`, zodat een externe
partij hooguit onze origin ziet en nooit de volledige URL met het token erin.

Maar een reverse proxy of CDN logt standaard de **hele** URL. Doe je dat niet
uit, dan staan er geldige sessietokens in de access log van nginx/Caddy/
Cloudflare — en logs gaan naar plekken waar de kluis niet geldt. Dus:

```nginx
# nginx: log het pad, niet de querystring
log_format rtg '$remote_addr "$request_method $uri" $status $body_bytes_sent';
access_log /var/log/nginx/rtg.log rtg;
```

Bij Cloudflare: zet in de Logpush-configuratie het veld `ClientRequestURI` uit
(of gebruik `ClientRequestPath`). Draai je met `RTG_TLS=1` zonder proxy, dan
speelt dit niet.

### Eigen interne CA + mTLS (intern verkeer)

Naast ACME (publieke domeinen) is er een **eigen interne certificaat-autoriteit**
(`server/lib/ca.js`) voor het EIGEN verkeer: mTLS tussen de RTG-servers onderling,
de zaakdoos, de noodserver en losse instances. Een intern component vertrouwt
alleen ons CA-cert (de trust anchor) en accepteert dan elk certificaat dat wij
ondertekenden — en niets anders.

```js
const { maakCA } = require('./server/lib/ca');
const ca = maakCA({ dataDir });                       // root-CA (10 jr), gepersisteerd in <datamap>/tls/ca/
const srv = ca.geefUitServer({ names: ['zaakdoos.intern'] });   // { certPem, keyPem, chainPem, serial }
const cli = ca.geefUitClient({ cn: 'instance-2' });             // clientcert voor mTLS
```

De TLS-server zet mTLS aan met `maakServer(app, { cert, key, ca: ca.bundelPem(), requestCert: true })`:
dan vraagt hij het clientcertificaat op en verifieert het tegen onze CA. Intrekken
kan op serial (`ca.trekIn(serial)`); `ca.crlPem()` geeft de door de CA ondertekende
CRL die interne clients ophalen. De CA-sleutel en de intrekkingslijst staan onder
`<datamap>/tls/ca/` en worden NOOIT gecommit.

---

## 4. Wat er in de code al productie-klaar is

- **Observability** — gestructureerde JSON-logs (`server/log.js`), per verzoek
  een correlatie-id (`X-Request-Id`), duur en status; centrale foutafhandeling
  met stack; een eigen in-memory fout-aggregatie op het techniekbord (ERR-01 +
  de storingslijst); optionele EXTERNE alarmering erbovenop via
  `ERR_WEBHOOK_URL` (een webhook-POST naar Slack/Discord/eigen endpoint, met
  SSRF-keuring op het doel en tempering per vingerafdruk). Geen Sentry: dit huis
  heeft geen externe pakketten, dus `SENTRY_DSN` wordt door niets gelezen.
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
- [ ] `RTG_OWNER_EMAIL` is het echte adres van de eigenaar, en er hoort al een RTG-account bij (verplicht; leeg of het voorbeeldadres blokkeert de start). Overdragen kan later op de technische pagina onder "Eigenaarschap"
- [ ] `.env` ingevuld; `NODE_ENV=production`; `RTG_ENC_KEY` gezet
- [ ] Versleuteling in rust bewezen op de echte machine: `node --experimental-sqlite --test test/rust.test.js` is groen. Die test zet gegevens via de gewone endpoints in een server en zoekt daarna de hele datamap byte voor byte af; hij vertrouwt niet op de belofte
- [ ] De sleutels (`RTG_ENC_KEY`, `RTG_VAULT_KEY`, `RTG_SECRET_KEY`) staan als omgevingsvariabele, **niet** in de datamap. Zonder deze regel schrijft de server ze als bestand naast de data, en dan opent een gestolen schijf zichzelf
- [ ] Weet dat de outbox met een sleutel versleuteld is: mislukte verzendingen teruglezen gaat met `npm run outbox` (met dezelfde `RTG_ENC_KEY`)
- [ ] `DATABASE_URL` gezet, PostgreSQL draait; back-up/restore van de database één keer geoefend
- [ ] TLS geregeld: óf een reverse proxy/load balancer vóór de app met `trust proxy` aan, óf native in de app (`RTG_TLS=1`, evt. `RTG_ACME=1` voor een automatisch Let's Encrypt-certificaat) — poort 80 + 443 bereikbaar
- [ ] Redis draait en `REDIS_URL` is gezet (bij >1 instance)
- [ ] `ERR_WEBHOOK_URL` gezet, en de **zelfproef** op het techniekbord komt
      echt aan (`POST /api/techniek/alarm/proef`, alleen de eigenaar). Dit
      vinkje was niet af te vinken zolang het naar `SENTRY_DSN` wees: die
      variabele wordt door niets gelezen, dus er kwam nooit een testfout
      binnen. Vink dit pas af als de proef `ok: true` teruggeeft.
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
