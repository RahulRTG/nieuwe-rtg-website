# Livegang - bewezen kandidaat naar productie

Dit is de enige ondersteunde productieroute voor RTG. Een release wordt in CI
op exact één schone commit getest, als unieke kandidaat gepubliceerd en aan
zijn registrydigest, SBOM en Ed25519-herkomst gebonden. De productiehost keurt
precies dat image in een geïsoleerde omgeving. Pas na `PRODUCTION_STATUS=READY`
en een afzonderlijk ondertekend promotiebesluit mag datzelfde immutable image
de actieve release vervangen.

Een installatie zonder AI en zonder geld kan veilig fail-closed draaien, maar
is geen volledige B2B2C-productierelease. Voor de status `READY` zijn echte en
beproefde inkomende betaling, uitbetaling, webhookafhandeling, settlement en
reconciliatie verplicht.

## Wat deze stand afdwingt

- `RTG_AI_UIT=1`: geen OpenAI, Anthropic, Gemini, Qwen of andere modelserver
  nodig. De ingebouwde lokale taal- en regelmotor blijft werken.
- `RTG_BETALEN_UIT=1`: een beperkte release zonder geld houdt alle
  betaalproviders, demo-betalingen, webhooks, refunds, uitbetalingen en
  muntbetalingen fail-closed. Deze stand kan niet de B2B2C-READY-stempel krijgen.
- `RTG_TLS=1` + `RTG_ACME=1`: RTG regelt zelf HTTP/2, TLS 1.2/1.3,
  Let's Encrypt, vernieuwing en HTTP-naar-HTTPS. Geen Caddy/certbot nodig.
- PostgreSQL + Redis + versleutelde identiteitskluis; geheimen staan niet in
  `docker inspect` en niet op het datavolume.
- Elke upload gaat eerst naar een niet-geserveerde quarantaine en langs de
  ingebouwde scanner én een losse ClamAV-container. Valt ClamAV uit, dan gaan
  uploads dicht terwijl lezen beschikbaar blijft.
- Dagelijkse gevalideerde back-up buiten de Docker-schijf, AES-256-GCM
  versleuteld naar een publieke sleutel, plus een tweede write-once-set op een
  off-site WORM/Object-Lock-doel en een dubbel bevestigd herstelpad.

## Eenmalig op de Linux-productieserver

Vereist: Docker met `docker compose`, een domein waarvan A/AAAA naar de server
wijst, en publiek bereikbare TCP-poorten 80/443 plus UDP 3478.

```bash
cp deploy/live.env.example deploy/live.env
# Pas beide back-upmappen aan: één tweede schijf en één echt off-site doel met
# WORM/Object Lock/retentie. De containers draaien als uid 1000:
sudo install -d -o 1000 -g 1000 -m 700 /mnt/tweede-schijf/rtg-backups
sudo install -d -o 1000 -g 1000 -m 700 /mnt/offsite-worm/rtg

# Schrijf de privésleutel rechtstreeks naar een los/offline medium. Alleen het
# publieke certificaat blijft op de server. Bewaar ook een tweede offline kopie.
npm run backup:sleutel -- /media/offline-kluis/rtg-backup-private.pem

npm run live:init -- \
  --eigenaar=eigenaar@jouwdomein.nl \
  --url=https://app.jouwdomein.nl \
  --tls-email=beheer@jouwdomein.nl \
  --smtp-url=smtps://gebruiker:wachtwoord@smtp.jouwdomein.nl:465
npm run motor:init
```

`live:init` toont de sleutels niet in de terminal. Het schrijft
`.env.productie`, `.rtg-secrets/postgres_password` en de afzonderlijke
`.rtg-secrets/motor_state_key` met rechten 600; alle drie staan in `.gitignore`.
`motor:init` legt de verwachte genesis eerst blijvend vast en initialiseert het
versleutelde geldvolume daarna exact eenmaal. Start/restart doet dit nooit
automatisch en blijft bij een verdwenen of afwijkende volume fail-closed.
Bewaar een versleutelde kopie van deze bestanden en het geldvolume buiten de
server. Koppel `OFFICE_TOTP_SECRET` uit `.env.productie` aan de authenticator
van de eigenaar en verwijder `RTG_OWNER_BOOTSTRAP` zodra het eigenaarsaccount
is geclaimd.

ClamAV haalt zijn handtekeningen dagelijks op via een apart update-netwerk en
publiceert poort 3310 niet op de host. Reserveer hiervoor circa 4 GB RAM; bij te
weinig geheugen blijft de veilige toestand gelden en worden uploads geweigerd.

`live:init` maakt bewust eerst een veilige, gesloten hostconfiguratie. Voor een
B2B2C-release vervang je de gesloten geldstand daarna door de echte
providerconfiguratie. Een sleutel alleen telt niet als bewijs: de genoemde
provider-, webhook-, payout- en reconciliatieproeven moeten ook in het
ondertekende externe dossier staan.

## Canonieke releasevolgorde

1. Rond de bronwijzigingen af, werk alle gegenereerde registers bij en commit.
   De releasebron moet volledig schoon zijn.
2. Laat de GitHub-workflow `Release-imagekandidaat` op precies die commit lopen.
   Die voert de volledige Node-, scherm-, PostgreSQL/Redis- en stagingronde uit,
   bouwt twee unieke kandidaatimages en levert het artefact `herkomst` op.
3. Plaats de bestanden uit dat artefact ongewijzigd in `.release/` en neem de
   twee unieke kandidaat-tags over in `deploy/live.env` als
   `RTG_CANDIDATE_IMAGE` en `RTG_CANDIDATE_BACKUP_IMAGE`.
4. Plaats de echte onafhankelijke bewijsbestanden in
   `.release/external-evidence/`, vul `.release/external-release.json` op basis
   van `deploy/external-release.example.json` en laat de aangewezen
   releasebeoordelaar het dossier ondertekenen met `npm run external:teken`.
5. Keur de host en exact dezelfde CI-kandidaat. `live:golive` bouwt niets en
   raakt de productievolumes niet; het gebruikt een eigen vluchtige
   PostgreSQL-, Redis-, queue- en motoromgeving.
6. Laat de commitgebonden einduitspraak maken. Alleen nul blokkades mag READY
   opleveren.
7. Laat een andere, bevoegde release-authority de READY-uitspraak, kandidaat-
   digests en alle bewijsbytes ondertekenen. Daarna pas volgt de wissel.

```bash
npm run live:check
npm run live:golive
npm run productie:status       # moet exact PRODUCTION_STATUS=READY melden
npm run promotie:teken         # aparte Ed25519-promotiesleutel + besluitreferentie
npm run promotie:controle
npm run live:deploy            # gebruikt alleen bewezen digestrefs; bouwt niets
npm run live:probe
```

De twee ondertekeningssleutels zijn gescheiden: `RTG_RELEASE_SIGN_KEY` tekent
het onafhankelijke externe dossier en `RTG_PROMOTION_SIGN_KEY` tekent het
uiteindelijke menselijke promotiebesluit. Bewaar beide buiten de appomgeving;
de promotiesleutel hoort uitsluitend bij de release-authority.

Beschermde Foundation- en minderjarigenfuncties staan in de eerste release
standaard server-side dicht. Het externe dossier legt dat vast met
`vrijgave: GESLOTEN`; leeftijdscontrole en moderatie blijven dan expliciet
`NIET_VRIJGEGEVEN`. Alleen een latere release met beide controles op `PASS`,
`vrijgave: OPEN` én de commitgebonden runtimevlag mag die routes openen. De
volwassen B2B2C-release hoeft daardoor niet te wachten op een risicovollere
minderjarigenrelease, terwijl een losse env-vlag nooit voldoende is.

Voor de eenmalige hostvoorbereiding en het beheer blijven deze opdrachten
beschikbaar:

```bash
npm run live:init        # hierboven met de vereiste argumenten
npm run live:owner       # na de eerste geslaagde wissel; claimt eigenaar lokaal
npm run live:status
```

De eerste uitrol is nog niet het moment om de lancering aan te kondigen.
`live:owner` vraagt naam, geboortedatum en tweemaal het
wachtwoord, claimt het ingestelde eigenaarsadres uitsluitend via de lokale
HTTPS-poort, verwijdert `RTG_OWNER_BOOTSTRAP` atomisch en herstart de app. Geen
van beide geheimen komt in shellgeschiedenis of logs. Bevestig daarna de mail,
beantwoord op de technische pagina de papierwerkvragen en voer voor een volgende
release opnieuw de volledige kandidaat- en bewijsronde uit. PostgreSQL heeft
bewust geen hostpoort; de kandidaatkeuring gebruikt daarom een afzonderlijke
interne database en nooit de actieve productiedatabase.

De eerste ACME-uitgifte lukt pas als DNS al naar de server wijst en poort 80
bereikbaar is. Een mislukte uitgifte houdt de app bewust op een self-signed
certificaat; `live:probe` blijft dan rood en voorkomt een stille schijn-livegang.

## Dagelijks beheer

```bash
npm run live:status
npm run live:backup
npm run live:rollback
```

De uitrol bewaart de volledige vorige app- én backup-imagedigests met de hash
van hun ingebakken releasebewijs als rollbackset. Komt de nieuwe `/api/ready`
niet binnen twee minuten op, dan wordt uitsluitend die eerder bewezen immutable
set teruggezet. Een beweegbare tag zoals `latest`, een lokale herbouw of een
los app-image zonder bijpassend backup-image wordt geweigerd.

De GitHub-workflow `Publieke live-sonde` meet elke vijf minuten van buitenaf.
Zet daarvoor repository variable `RTG_LIVE_URL` op het volledige HTTPS-adres en
zet GitHub Actions-foutmeldingen aan. `ERR_WEBHOOK_URL` blijft aanbevolen voor
interne fouten die de app nog wel zelf kan waarnemen.

## Herstel bij een echte ramp

Bekijk eerst de timestamps in `<RTG_BACKUP_HOST_DIR>`. Het volgende commando
stopt alle schrijvers, controleert SHA-256 en dumpstructuur, herbouwt PostgreSQL,
zet de bijbehorende bestandsback-up terug en start daarna opnieuw:

```bash
RTG_BACKUP_PRIVATE_KEY_FILE=/media/offline-kluis/rtg-backup-private.pem \
  npm run live:restore -- 20260815T030000Z
```

De privésleutel wordt alleen in de eenmalige herstelcontainer gemount. Koppel
het offline medium na de herstelcontrole weer los. Zonder die sleutel kan ook
een aanvaller met alle back-upbestanden de inhoud niet ontsleutelen.

Daarna zijn twee handmatige controles verplicht: een bestaand lid kan inloggen
en diens echte naam is zichtbaar. Alleen dat tweede bewijst dat de apart
bewaarde kluissleutel bij de teruggezette data hoort.

## Nog extern nodig voor de volledige functiebreedte

- Echte e-mail: SMTP is een harde livegangvoorwaarde, omdat bevestigings- en
  herstellinks anders alleen in een lokale outbox belanden.
- Videobellen door strenge mobiele/bedrijfsfirewalls: de eigen STUN-server is
  inbegrepen; voor betrouwbare verbindingen is ook een eigen coturn/TURN nodig.
  Zet daarna `TURN_URL` en `TURN_SECRET` in `.env.productie`.
- Bescherming tegen zeer grote netwerk-DDoS: de app heeft een WAF en IP-rem,
  maar een volumetrische aanval moet vóór de server worden geabsorbeerd. Voeg
  pas als het risicoprofiel dat vraagt een CDN/WAF-provider toe.
- Juridische antwoorden en een onafhankelijke pentest kunnen niet eerlijk door
  code worden ingevuld; `npm run golive` blijft daarop blokkeren.

Betalingen kunnen later als een afzonderlijke, gecontroleerde release worden
ingeschakeld. Tot die tijd is “niet beschikbaar” een technische toestand, geen
UI-belofte die een achterdeur openlaat.
