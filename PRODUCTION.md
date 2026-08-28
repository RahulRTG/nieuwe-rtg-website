# Productie-draaiboek (RTG / RTFoundation)

Dit document beschrijft hoe je de server veilig live zet, wat er in de code al
voor productie is geregeld, en, net zo belangrijk, **wat er nog buiten de code
moet gebeuren voordat je echt open mag**. Wees hier eerlijk over: de code is
bijna productiekwaliteit, maar "live met echt geld en echte (soms
minderjarige) gebruikers" vraagt meer dan code alleen.

---

## 0. Alles automatisch afbouwen en bewijzen

```bash
npm run afbouw:snel       # releasepoort + volledige geïsoleerde stagingrepetitie
npm run afbouw:software   # alle Node-tests + releasepoort + stagingrepetitie
npm run afbouw:alles      # hetzelfde, daarna ook alle echte livevoorwaarden controleren
```

`afbouw:alles` is de centrale nul-dependency afbouwknop. Hij stopt bij de
eerste echte fout en geeft pas groen nadat gameplay, economie, drie afzonderlijke
spelers, 300-verzoekenbelasting, procesfailover, Sentinel-isolatie, audit,
backup/herstel, Rust en alle Node-tests zijn geslaagd. De repetitie bindt alleen
aan loopback, gebruikt uitsluitend synthetische speldata en verwijdert de hele
tijdelijke omgeving na afloop. Het machineleesbare bewijs staat in
`.release/staging-bewijs.json`; het laatste proceslog in
`.release/staging-laatste.log`. Gelijktijdige bronmuterende tests en releases
worden met één exclusief afbouwslot geweigerd, zodat Sentinel nooit een tijdelijk
ijkbestand als productiewijziging hoeft te beoordelen.

De knop voert bewust geen echte uitrol uit. Wanneer `afbouw:alles` groen is,
blijft `npm run deploy:productie` de afzonderlijke, menselijke publicatieactie.
Een domein, mailroute, betaalkeuze, juridische antwoorden of persoonsgegevens
worden nooit door software verzonnen.

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
verwijder `RTG_PRIVATE_BETA=1`, zet een HTTPS-`APP_URL` en SMTP. Koppel daarna
een echte betaalprovider, of kies expliciet `RTG_BETALEN_UIT=1`; laat externe
AI bewust uit met `RTG_AI_UIT=1`. Draai `npm run golive`, en zet pas daarna een
TLS-tunnel of reverse proxy voor de loopbackpoort.

Publiek zonder AI en zonder betalen, zoals voor een eerste veilige release:

```bash
npm run sleutels -- --docker --schrijf --zonder-ai --zonder-betalen \
  --eigenaar=jij@domein.nl --url=https://jouw-domein.nl
npm run selfhost:check
docker compose up -d --build
npm run golive
```

In deze stand is “zonder betalen” geen demo: starten, bevestigen, terugbetalen,
uitbetalen en betaalwebhooks weigeren allemaal fail-closed. Zonder AI draait de
app in handmatige werkmodus; navigatie, regels en overige kernprocessen blijven
beschikbaar.

- Liveness: `GET /api/health` (proces leeft)
- Readiness: `GET /api/ready` (mag verkeer krijgen; 503 als de datalaag nog niet klaar is)
- Sentinel: `GET /__sentinel/live` en `GET /__sentinel/ready`

De app heeft in Compose bewust geen hostpoort. Alleen Sentinel publiceert de
voordeur, standaard op host-loopback zodat een TLS-proxy/tunnel ervoor moet.
Status, gerichte blokkade, volledige isolatie en auditbediening staan in
`docs/sentinel.md`. De losse `.sentinel-token` wordt alleen in Sentinel gemount;
de app krijgt hem nooit.

Voor de eerste capability-canary zet je in `.env.productie`
`RTG_CAPABILITY_RUST_MODE=canary`, een percentage en een stabiele, niet-geheime
instance-sleutel. Het percentage selecteert instances deterministisch; op een
enkele Compose-instance is die instance dus geheel wel of niet geselecteerd.
De actuele bron, pariteit, terugvalreden en centrale noodstop zijn zichtbaar in
Magnaat Boardroom bij `capabilityGraph.motor`. Zet bij twijfel direct
`RTG_RUST_ALLES_UIT=1` en herstart alleen `app`; Sentinel blijft dan actief.

## 2. Zonder Docker

```bash
npm ci --omit=dev
NODE_ENV=production RTG_ENC_KEY=... node server/server.js
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

Aanbevolen: `ERR_WEBHOOK_URL` (externe alarmering) en SMTP (`SMTP_URL`). Voor
echte betalingen: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` of een andere
provider; anders `RTG_BETALEN_UIT=1`. Voor AI: `ANTHROPIC_API_KEY` of een andere
provider; anders `RTG_AI_UIT=1`.

Veilige tussenstand: er is nog geen externe herstel-SMS en geen geactiveerde
uitgaande Stripe-rail. Productie start daarom alleen wanneer
`RTG_HERSTEL_SMS_UIT_BEWUST=1` expliciet bevestigt dat herstel voor accounts met
telefoon fail-closed geblokkeerd blijft. Met `STRIPE_UITGAAND_UIT_BEWUST=1`
bevestigt de beheerder dat partner- en RTFoundation-uitbetalingen gereserveerd
blijven en niet via de onjuiste Payout-met-IBAN-route worden verstuurd.

Voor lokale integratieproeven bestaan vier afgeschermde providerstanden. Met
`SMS_SANDBOX=1` wordt het E.164-nummer gevalideerd en komt de herstelcode alleen
in de beveiligde outbox. Met `STRIPE_CONNECT_SANDBOX=1` en `SEPA_SANDBOX=1`
worden providerachtige opdrachten met status `processing` gemaakt; ze doen geen
netwerkverkeer en verplaatsen geen geld. `SMS_SANDBOX_RESULT=failed` simuleert
een geweigerde SMS. Een lokale SMTP-catcher kan met `SMTP_SANDBOX=1` worden
gebruikt; de host in `SMTP_URL` moet dan localhost/loopback zijn. De
productiekeuring weigert al deze sandboxvlaggen expliciet.

De vier runtime-zekeringen staan in het RTG-kantoor onder **Integratiekamer**
(`/apps/kantoren.html?kamer=integraties`). Boardroomleden mogen een lokale
contractproef uitvoeren en een schakelverzoek indienen; alleen de eigenaar kan
dat verzoek goedkeuren. De noodstop zet alle lokale rails direct uit en iedere
handeling komt in het auditlog. Dit scherm kan geen live provider activeren.

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
database van een opgegeven omvang. Draai: `node
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

### Laat de log door een PIJP lopen, niet naar een bestand

Node kiest zijn stdout-stroom op wat eraan hangt, en dat bepaalt of het loggen de
server ophoudt:

```
node server.js | logger        ->  Socket           asynchroon   (systemd, docker)
node server.js > /var/log/rtg  ->  SyncWriteStream  SYNCHROON
```

Met `LOG_LEVEL=info` — de standaard — schrijft **elk verzoek** een regel. Op een
bestand is dat dus per verzoek een synchrone schrijfactie, midden op de
event-loop, terwijl er een verzoek wordt afgehandeld.

Gemeten op 24 augustus 2026, dezelfde last, alleen de bestemming van stdout
verschilt (zie `PRESTATIES.md` voor de opstelling):

| Meter | naar een bestand | door een pijp |
|---|---:|---:|
| Event-loop p99 | 26,7 ms | **19,8 ms** |
| Event-loop max | 114,3 ms | **68,0 ms** |

Draai je onder **systemd of Docker**, dan zit je goed: die hangen er allebei een
pijp aan en je hoeft niets te doen. Alleen wie zelf `> bestand` schrijft — of dat
in een start-script heeft staan — betaalt de prijs. Twee uitwegen:

- laat de uitvoer door een pijp lopen (`| logger`, `| rotatelogs`, een
  logverzamelaar), of
- zet `LOG_LEVEL=warn`, dan verdwijnt de regel per verzoek en blijft alleen wat
  misgaat.

Techniekcontrole **LOG-01** op het backoffice-statusbord kijkt hiernaar en zegt in
welke stand je staat, dus je hoeft het niet te onthouden.

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
- **Auditspoor** — `server/opzet/auditspoor.js` schrijft elke GESLAAGDE
  schrijfhandeling weg in een hash-geketend journaal (wie, wat, wanneer, welke
  status; nooit het verzoeklijf, want een auditlog met alle lijven is zelf het
  datalek). Wie er een regel in wijzigt of uit knipt, breekt de keten, en
  `POST /api/command/apispoor` (backoffice) laat die controle draaien. Gemeten
  met `npm run auditproef`: **860 schrijfroutes laten aantoonbaar een spoor na,
  0 niet**, keten heel. Wat het NIET dekt: wie de nieuwste regels weggooit houdt
  een kloppende keten over -- daarvoor moet het kopzegel buiten deze database
  worden vastgelegd (`server/lib/keten-anker.js`, bewust nog niet in bedrijf;
  `TAKEN.md` 3.7).
- **Dubbeltik** — `server/lib/dubbeltik.js` staat vóór alle routers: een
  schrijfverzoek met een idem-sleutel (`idem` in het lijf of de kop
  `Idempotency-Key`) wordt één keer uitgevoerd; de herhaling krijgt het bewaarde
  antwoord met `herhaald: true`. Gemeten met `npm run idemproef`: van 15
  beschermde en 100 onbeschermde routes naar **842 beschermd en 3 onbeschermd**
  (die drie zijn geldroutes; die gaan bewust langs deze laag omdat ze hun eigen,
  duurzame idempotentie hebben -- zie `TAKEN.md` 3.8).
  Drie grenzen staan in de kop van dat bestand en horen erbij: hij doet niets
  zonder sleutel (twee keer hetzelfde toevoegen zonder sleutel MAG twee items
  zijn), hij leeft in het geheugen van één proces (voor geld blijft
  `server/lib/idem.js` staan, mét duurzame commit), en een ander lijf onder
  dezelfde sleutel wordt doorgelaten in plaats van geweigerd. De kast is
  begrensd op aantal (5000) én op omvang (32 MB, gemeten aan de content-length
  die de server toch al berekent): loopt hij vol, dan valt de oudste eraf, zodat
  bescherming geleidelijk aan de achterkant verdwijnt in plaats van dat het
  geheugen oploopt.
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
- **Herkomst van het image** — de release-workflow maakt na de push een
  stuklijst (SBOM, CycloneDX 1.5) UIT het gepubliceerde image en bindt die met
  een Ed25519-handtekening aan het image-digest, het releasebewijs en de commit
  (`scripts/imageherkomst.js`). Waarom dat nodig was naast `release-bewijs.json`:
  dat bewijs hasht de BRON van dit huis, maar een image is meer dan deze
  repository -- uit `node:22-slim` komen ruim honderd deb-pakketten mee die wij
  niet schrijven. Op "zit die kwetsbaarheid in wat jullie draaien?" gaf een
  bronhash geen antwoord. Controleren op de machine:
  `npm run imageherkomst:controle -- --draait=<digest van wat er draait>`; zonder
  dat laatste toets je alleen de handtekening en niet wat er staat te draaien.
  **Twee eerlijke grenzen.** (1) Dit is geen Sigstore: geen transparantielogboek,
  geen keyless-OIDC, geen derde die meekijkt -- wie sigstore-verificatie eist
  krijgt dat hier niet (`TAKEN.md` 3.5). (2) Zolang `deploy/release-sleutel.pub`
  niet bestaat, worden stuklijst en herkomstdocument wel gemaakt maar is er
  niets te verifieren; de workflow zegt dat dan hardop als waarschuwing.
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
4. **Zet er meer instances achter een load balancer, en laat een gebruiker aan
   één instance kleven.** De app is stateless tussen requests (de sessie staat in
   de gedeelde opslag en de Redis-bus houdt alle instances in de pas), dus je
   kunt naar believen instances bijzetten. TLS-termination vóór de app (reverse
   proxy met `trust proxy`) **of** native in de app (`RTG_TLS=1`, zie §3).

   **Hier stond dat sticky sessions niet nodig zijn. Dat is nagemeten en het
   klopt niet.** De sessie loopt inderdaad over de bus — die is meteen geldig op
   elke instance, 0 ms — maar de DATA loopt over de kruisprocespoll. Een lid dat
   een notitie opslaat op instance A en zijn lijst opvraagt bij instance B, ziet
   zijn eigen notitie niet staan: mediaan 733 ms op SQLite, 139–141 ms op
   Postgres, en in beide gevallen 0 van de 10 meteen zichtbaar. De meting staat
   in `docs/meerkernig.md`. Een bug die willekeurig lijkt en niet te reproduceren
   is, want of je hem ziet hangt af van welke instance je verzoek ving.

   Kleef dus op de sessie. Bij een externe load balancer: op de
   `Authorization`-kop of een cookie, met consistent hashing en niet met
   round-robin. Draait u het trio, dan zit het er al in — zie punt 5.
5. **Kies de procesindeling die past.**
   - **Vloot-modus** (`npm run vloot`, §2): één machine, per domein een proces,
     foutisolatie + herstart per groep. Goede eerste stap.
   - **Trio/failover** (`server/trio.js`, §4): drie servers met poortwachter en
     automatische overname voor beschikbaarheid. Standaard neemt één van de drie
     verkeer aan; met `RTG_SPREIDING=1` (plus `REDIS_URL`, anders weigert hij mét
     de reden) nemen ze alle drie verkeer aan en stuurt de poortwachter een lid
     steeds naar hetzelfde proces — kleefroutering op het token, met
     rendezvous-hashing zodat bij een uitval alleen de leden van díé server
     verhuizen. De backup, de zelfzorgautomaat en het roerwerk van de RTG-AI
     blijven bij één server (`db.leider`, zichtbaar in `/api/health`).

     **Zet er dan ook `RTG_POORTWACHTERS=N` bij.** De poortwachter is zelf één
     Node-proces en was gemeten het plafond: 90% van één kern terwijl de servers
     op de helft stonden. Met N voordeurprocessen op dezelfde poort
     (`SO_REUSEPORT`) ging de doorvoer 29% omhoog en de p50 28% omlaag. Zonder
     deze schakelaar levert spreiding vrijwel niets op — 1,4% gemeten. Werkt niet
     samen met `RTG_LOKAAL_TLS`; zet TLS er dan vóór.
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
npm run sleutels:bestand # schrijft .env.productie met rechten 600, zonder secrets in logs
npm run golive     # keurt de omgeving: exitcode 0 = klaar om live te gaan
```

De keuring beoordeelt de configuratie op productieniveau, probeert PostgreSQL
echt te bereiken, prikt een geconfigureerde Rust-sidecar aan en voert de native
Magnaat-capabilityscan uit. De testsuite bevat bovendien
een generale repetitie (`test/golive.test.js`) die de server echt in
productiestand start en bewijst: onveilige start geweigerd, demo dicht, geen
dev-lekken, registratie/eigenaar/backoffice werken.

**De snelste route (een avond werk):**

1. Volg `LIVEGANG.md`: maak `deploy/live.env` en een externe back-upmap.
2. `npm run live:init -- --eigenaar=… --url=https://… --tls-email=…
   --smtp-url=smtps://…` genereert alle geheimen zonder ze naar terminal- of
   CI-logs te schrijven. AI en betalingen staan in deze route fail-closed uit.
3. `npm run live:check` keurt native TLS/ACME, 2FA, poorten, geheimen en de
   externe back-upmount. `npm run live:deploy` bouwt daarna een immutable image,
   start de stack en rolt bij mislukte readiness automatisch terug.
4. `npm run live:owner` claimt het eerste eigenaarsaccount via de lokale
   HTTPS-poort en verwijdert daarna automatisch het eenmalige bootstrapgeheim.
   Vul het papierwerk in en draai `npm run live:golive`: die keurt vanuit de
   app-container de echte interne database en hetzelfde datavolume.
   `npm run live:probe` meet daarna DNS, het publieke certificaat en de
   veiligheidsrand vanaf buiten.

- [ ] `npm run live:golive` geeft exitcode 0 in de productiecontainer
- [ ] `RTG_OWNER_EMAIL` is het echte adres van de eigenaar, en er hoort al een RTG-account bij (verplicht; leeg of het voorbeeldadres blokkeert de start). Overdragen kan later op de technische pagina onder "Eigenaarschap"
- [ ] `.env` ingevuld; `NODE_ENV=production`; `RTG_ENC_KEY` gezet
- [ ] Versleuteling in rust bewezen op de echte machine: `node --test test/rust.test.js` is groen. Die test zet gegevens via de gewone endpoints in een server en zoekt daarna de hele datamap byte voor byte af; hij vertrouwt niet op de belofte
- [ ] De sleutels (`RTG_ENC_KEY`, `RTG_VAULT_KEY`, `RTG_SECRET_KEY`) staan als omgevingsvariabele, **niet** in de datamap. Zonder deze regel schrijft de server ze als bestand naast de data, en dan opent een gestolen schijf zichzelf
- [ ] Weet dat de outbox met een sleutel versleuteld is: mislukte verzendingen teruglezen gaat met `npm run outbox` (met dezelfde `RTG_ENC_KEY`)
- [ ] `DATABASE_URL` gezet, PostgreSQL draait; back-up/restore van de database één keer geoefend
- [ ] TLS geregeld: in de lokale-eerst live-route native in de app (`RTG_TLS=1`, `RTG_ACME=1`) met poort 80 + 443 bereikbaar; een reverse proxy is alleen een bewuste alternatieve architectuur
- [ ] Redis draait en `REDIS_URL` is gezet (bij >1 instance)
- [ ] `ERR_WEBHOOK_URL` gezet, en de **zelfproef** op het techniekbord komt
      echt aan (`POST /api/techniek/alarm/proef`, alleen de eigenaar). Dit
      vinkje was niet af te vinken zolang het naar `SENTRY_DSN` wees: die
      variabele wordt door niets gelezen, dus er kwam nooit een testfout
      binnen. Vink dit pas af als de proef `ok: true` teruggeeft.
- [ ] SMTP getest (herstel-link komt echt aan)
- [ ] Betalingen: voor de eerste livegang staat `RTG_BETALEN_UIT=1` en weigert elke rail fail-closed. Alleen bij een latere betaalrelease vervangen door echte providerkeys + een geteste, ondertekende webhook
- [ ] Back-up-volume gemount; herstel-uit-back-up één keer geoefend
- [ ] `npm run check` en `npm test` groen in CI; image bouwt
- [ ] `npm run release:gate:productie` is groen en `.release/release-bewijs.json` verifieert met `npm run release:controle`
- [ ] Op het techniekbord is **Controleer alle code nu** groen en staat het releasebewijs als **extern verankerd**. `npm run deploy:productie` leest de bewijs-SHA uit het gebouwde image, geeft hem als runtime-pin terug en bewaart hem in de uitrolbon. Zie `docs/incidentcontrole.md`
- [ ] Een rollback is op de echte host geoefend met een uitrolbon; volumes zijn daarbij niet teruggezet
- [ ] Logs komen ergens terecht (Loki/CloudWatch/Datadog)
- [ ] GitHub repository variable `RTG_LIVE_URL` gezet; de publieke sonde prikt elke vijf minuten van buitenaf door DNS en TLS heen
- [ ] `OFFICE_TOTP_SECRET` gezet en de authenticator-app gekoppeld (2FA op de backoffice; **de keuring blokkeert de productiestart zolang hij ontbreekt**, en een geheim onder de 16 base32-tekens telt niet als tweede factor). Zonder deze factor staat de backoffice — auditlog, tijdlijn met codenamen, export — achter alleen de statische `OFFICE_CODE`, en de officedeur remt per IP, dus verspreid raden komt daar langs. Dit was een waarschuwing; `scripts/docker/controle.js` eiste het al hard voor livegang, en die twee zeggen nu hetzelfde
- [ ] Inlog-auditlog gecontroleerd na de eerste inlog (RTG HQ, kaart "Inlogactiviteit")
- [ ] Rate-limiter bevestigd: in productie geeft de API boven 300 verzoeken/minuut/IP een 429 (test/livegang.test.js bewijst dit)
- [ ] Schone start bevestigd: elke echte omgeving heeft `RTG_MAGNAAT_TEST` uit en bevat geen voorbeeldzaken, testpersoneel of voorbeeldposts; ook een database die eerder als testomgeving begon wordt bij de start opgeschoond (test/livegang.test.js)
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
