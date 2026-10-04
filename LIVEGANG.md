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

### De beperkte releasestand zonder kaartrail (besluit van 27 september 2026)

Zolang er geen kaartprovider is, mag V1 live als **beperkte release**. Dat is een
eigen stand, `PRODUCTION_STATUS=READY_ZONDER_RAIL`, en **nooit** READY:

- hij geldt alleen met `RTG_BETALEN_UIT=1` **én** `RTG_RELEASE_ZONDER_RAIL=1`; de
  tweede vlag zonder de eerste is een go-live-blokkade;
- elk ander bewijs moet even groen zijn als voor READY (suites, pg, staging,
  releasepoort, go-live, extern dossier, getekende kandidaat) -- alleen de
  inkomende en uitgaande rail en de geldmotor vallen weg;
- zaken rekenen extern af (contant, pin van de eigen terminal, op rekening); elke
  RTG Pay-, cadeaukaart- en tegoedweg blijft 503 (`server/opzet/betaalstop.js`);
- de promotie draagt de stand in het getekende document, en wie promoveert typt
  `RTG_PROMOTION_CONFIRM=PROMOVEER-ZONDER-RAIL-<commit12>` in plaats van
  `PROMOVEER-<commit12>`. Het woord van de ene stand promoveert de andere niet.

De volledige B2B2C-release blijft READY, met de eisen hieronder. Zie
`RELEASEKANDIDAAT.md` (B2, B2a, B2b).

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
npm run papierwerk -- --live
# Vul .rtg-compliance/papierwerk-invullen.txt met echte, gecontroleerde feiten.
npm run papierwerk -- --live --lees
npm run motor:init
```

`live:init` toont de sleutels niet in de terminal. Het schrijft
`.env.productie`, `.rtg-secrets/postgres_password`, de afzonderlijke
`.rtg-secrets/motor_state_key` en `.rtg-compliance/papieren.json` met rechten
600; alle vier staan in `.gitignore`. De compliance-map wordt schrijfbaar in
de productie-app gemount en alleen-lezen in de eenmalige go-livekandidaat. Zo
kan die kandidaat de werkelijk ingevulde papieren beoordelen zonder toegang
tot het brede productie-appvolume.
Gebruik voor een live-host altijd `npm run papierwerk -- --live`: deze stand
leidt het doel af uit `deploy/live.env` en schrijft/leest daardoor aantoonbaar
hetzelfde `papieren.json` dat later read-only in de keuring hangt. De gewone
stand blijft uitsluitend voor lokale ontwikkeling. Een leeg of geparkeerd
antwoord blijft terecht een blokkade.
`motor:init` legt de verwachte genesis eerst blijvend vast en initialiseert het
versleutelde geldvolume daarna exact eenmaal. Start/restart doet dit nooit
automatisch en blijft bij een verdwenen of afwijkende volume fail-closed.
Bewaar een versleutelde kopie van deze bestanden en het geldvolume buiten de
server. Het productiekantoor gebruikt geen gedeelde code of losse TOTP:
medewerkers openen de kantoorrol op naam met hun eigen passkey. Verwijder
`RTG_OWNER_BOOTSTRAP` zodra het eigenaarsaccount is geclaimd.

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
2. Bewijs die commit eerst met vier onafhankelijke GitHub-ronden: een handmatige
   volledige `CI` met `verwachte_commit`, `De ronde (wekelijks)` met omvang
   `beproeving`, `Desktop- en mobielstandaard` en `CodeQL`. Een oudere groene
   run, een andere commit, een verlopen artefact of een nieuwere rode run telt
   niet. Voor de twee handmatige ronden is de canonieke aanroep:

   ```bash
   SHA="$(git rev-parse origin/main)"
   gh workflow run ci.yml --ref main -f verwachte_commit="$SHA"
   gh workflow run ronde.yml --ref main -f omvang=beproeving
   ```

   Controleer bij alle vier de uiteindelijke runs dat `headSha` exact `$SHA` is.
   Een groene CodeQL-workflow alleen is niet genoeg: die ronde beoordeelt de
   lokaal geproduceerde SARIF en publiceert uitsluitend bij nul resultaten een
   commitgebonden `codeql-verdict`. De release-imagepoort eist het digest van
   precies dat artifact; een latere, mutable Security-tab kan een oudere commit
   daardoor niet stil groen maken.
3. Laat daarna de GitHub-workflow `Release-imagekandidaat` op precies die commit
   lopen. Vóór bouwen leest hij de vier uitspraken fail-closed uit GitHub Actions
   en bevriest hij run-ID's en artifactdigests in
   `.release/prerelease-workflows.json`. Daarna voert hij zelf opnieuw de
   volledige Node-, scherm-, PostgreSQL/Redis- en stagingronde uit, bouwt twee
   unieke kandidaatimages en bindt het prereleasedossier met BUILD aan beide
   image-digests in het artefact `herkomst`.
4. Plaats de bestanden uit dat artefact ongewijzigd in `.release/` en neem de
   twee unieke kandidaat-tags over in `deploy/live.env` als
   `RTG_CANDIDATE_IMAGE` en `RTG_CANDIDATE_BACKUP_IMAGE`.
5. Plaats de echte onafhankelijke bewijsbestanden in
   `.release/external-evidence/`. De host maakt de machineverslagen zelf met
   `npm run extern:bewijs -- <proef>`; zie **Externe bewijsproducenten**
   hieronder. Herstel blijft OPEN tot een mens met naam verklaart dat een lid
   inlogt en zijn echte naam ziet. Een externe/providerproef blijft OPEN zolang
   de meetrunner, testaccount of expliciete geldautorisatie ontbreekt. Vul
   daarna `.release/external-release.json` op basis
   van `deploy/external-release.example.json` en laat de aangewezen
   releasebeoordelaar het dossier ondertekenen met `npm run external:teken`.
6. Keur de host en exact dezelfde CI-kandidaat. `live:golive` bouwt niets en
   raakt de productievolumes niet; het gebruikt een eigen vluchtige
   PostgreSQL-, Redis-, queue- en motoromgeving.
7. Draai vóór de wissel op de productiehost, tegen dezelfde `RTG_DATA_DIR` als
   de app, `npm run ssogeheim:ouderdom -- --op <uitroldatum>` (B27). Elke
   organisatie met `verloopt-bij-uitrol` heeft een SSO-clientgeheim dat door de
   afkapping op 90 dagen (B22) bij de uitrol meteen verloopt; laat de eigenaar
   daar eerst roteren. De lijst leest alleen en toont nooit het geheim.
8. Laat de commitgebonden einduitspraak maken. Alleen nul blokkades mag READY
   opleveren.
9. Laat een andere, bevoegde release-authority de READY-uitspraak, kandidaat-
   digests en alle bewijsbytes ondertekenen. Daarna pas volgt de wissel.

```bash
npm run live:check
npm run live:golive
# Alleen op een verse host kan deze eerste ronde rood eindigen met exact één
# blokkade: RTG_OWNER_BOOTSTRAP. In dat geval is een smal, niet-uitrolbaar
# bootstrapkandidaatbewijs gemaakt:
npm run live:owner
npm run live:golive          # nu volledig groen, zonder bootstrapdeur
npm run productie:status       # moet exact PRODUCTION_STATUS=READY melden
npm run promotie:teken         # aparte Ed25519-promotiesleutel + besluitreferentie
npm run promotie:controle
npm run live:deploy            # gebruikt alleen bewezen digestrefs; bouwt niets
npm run live:probe
```

Er zijn drie gescheiden ondertekeningsrollen. `RTG_RELEASE_SIGN_KEY` tekent
uitsluitend buildherkomst (`RTG:BUILD:v1`), `RTG_EVIDENCE_SIGN_KEY` uitsluitend
externe dossiers (`RTG:EXTERNAL-EVIDENCE:v1`) en `RTG_PROMOTION_SIGN_KEY` het
menselijke promotiebesluit (`RTG:PROMOTION:v1`). De publieke ankers staan in
`deploy/release-sleutel.pub`, `deploy/evidence-sleutel.pub` en
`deploy/promotie-sleutel.pub`; ze moeten alle drie bestaan en verschillend zijn.
Private keys horen uitsluitend in de bijbehorende secret store, nooit in de
appomgeving, Git, terminaluitvoer of bewijsbundles. De buildjob krijgt alleen
de build-private-key. Zie [trust-bootstrap en migratie](deploy/TRUST.md).

## Externe bewijsproducenten

De bewijsproducent schrijft alleen PASS na een waarneming op de echte host of
bij een echte externe dienst. Configuratie alleen is geen bewijs. Voor de
onafhankelijke proeven gebruikt de releasehost een aparte meetrunner:

```bash
export RTG_EVIDENCE_RUNNER_URL=https://evidence-runner.example/probe
export RTG_EVIDENCE_RUNNER_TOKEN='uit-de-release-secret-store-minstens-32-tekens'
export RTG_EVIDENCE_RUNNER_TRUST_VERSION=v1

npm run extern:bewijs -- rand
npm run extern:bewijs -- incident
npm run extern:bewijs -- mailherstel
npm run extern:bewijs -- beeldscan
npm run extern:bewijs -- realtime       # aanvullend TURN-bewijs, geen dossiercontrole
```

De runner moet Ed25519-ondertekende `rtg-external-measurement-v2`-JSON
teruggeven met exact de aangevraagde `control`, releasecommit en unieke
`correlationId`. `v1` wijst uitsluitend naar het gecommitte
`deploy/evidence-runner-v1.pub`; een los sleutelpad uit de runtime wordt
geweigerd. De oorspronkelijke runnerhandtekening wordt bij dossiercontrole
opnieuw tegen dat anker geverifieerd, onafhankelijk van de evidence-signer.
Het script weigert onbekende velden en bewaart uitsluitend
begrensde metingen en gehashte identifiers. Daardoor kan een runner geen
providerreferenties, adressen of geheimen in het vrijgavedossier smokkelen.
Bootstrap, rotatie en het exacte signaturecontract staan in
[deploy/EVIDENCE-RUNNER.md](deploy/EVIDENCE-RUNNER.md).

De proeven en hun echte grens:

- `rand`: publieke TLS/HSTS/redirect plus een begrensde randproef vanaf minstens
  twee netwerken, providerbescherming en een niet rechtstreeks bereikbare
  origin. Dit is geen ongeautoriseerde volumetrische aanval.
- `incident`: verstuurt een uniek commitgebonden testalarm en eist externe
  ontvangst, incidentopening, acknowledgement én resolutie met gemeten tijden.
- `mailherstel`: start `/api/auth/forgot` voor het bestaande, uitsluitend voor
  releasebewijs gebruikte `RTG_EVIDENCE_RECOVERY_EMAIL`; de runner controleert
  inbox, herstellink, doelorigin, SPF, DKIM en DMARC. Het adres komt niet in het
  verslag.
- `beeldscan`: draait Trivy of Grype op exact `RTG_CANDIDATE_IMAGE` als
  `...@sha256:<digest>`, leest de commit uit `/app/release-bewijs.json` in dat
  image, verifieert dezelfde digest tegen de BUILD-getekende
  `.release/herkomst.json` en eist een databank jonger dan 72 uur en nul
  HIGH/CRITICAL-bevindingen. Het externe dossier herverifieert die
  buildhandtekening; de evidence-signer kan geen scan aan een ander image
  hangen.
  Kies desgewenst met `RTG_IMAGE_SCANNER=trivy` of `grype`.
- `realtime`: eist twee werkelijk verschillende netwerk-AS'en, relay-candidates
  aan beide kanten, een relay-only selected pair en minstens 64 KiB in beide
  richtingen. De releasepoort herverifieert ook de inhoud van de ondertekende
  runnerwaarneming; een dossier-signer kan een onvoldoende meting niet groen
  verklaren. Alleen `/api/ice` ophalen kan deze proef nooit laten slagen.

De vijf geldverslagen gebruiken bewust één al bestaande, idempotente liveketen.
Zonder een eigenaarbesluit en hard maximumbedrag starten ze niets:

```bash
export RTG_EVIDENCE_MONEY_CHAIN_ID='release-2026-10-money-001'
export RTG_EVIDENCE_MONEY_AUTHORIZATION_REF='CAB-2048'
export RTG_EVIDENCE_MONEY_MAX_MINOR=500
export RTG_EVIDENCE_MONEY_CURRENCY=eur

npm run extern:bewijs -- betaling
npm run extern:bewijs -- uitbetaling
npm run extern:bewijs -- webhook
npm run extern:bewijs -- geldlus
npm run extern:bewijs -- reconciliatie
```

De runner moet per stap zowel de RTG-operatie als de providerwaarheid meten.
`webhookDelivery` en `reconciliation` moeten daarnaast onafhankelijk dezelfde
`rtg-provider-items-v1`-manifestdigest en itemtelling rapporteren. Daardoor is
bewezen dat de afgeleverde webhooks en de reconciliatie over exact dezelfde
provideritems spreken; twee los groene tellingen zijn niet genoeg. De
canonieke manifestvorm staat in [deploy/EVIDENCE-RUNNER.md](deploy/EVIDENCE-RUNNER.md).
Webhookbewijs vereist een geldige providersignature en een replay met exact één
bedrijfsmutatie; reconciliatie vereist nul onbekende uitkomsten, nul unmatched
regels en een bedragverschil van nul. Een rail die RTG nog niet werkelijk kan
uitvoeren blijft dus OPEN/FAIL, ook als de provider zelf die functie aanbiedt.

De vier lokale producenten blijven beschikbaar als `malware`, `objectopslag`,
`rollback` en `herstel <JJJJMMDDTuummssZ>`. De onafhankelijke pentest,
juridische vrijgave, DPIA, Foundation-vrijgave en menselijke herstelcontrole
blijven terecht menselijke/derdepartijbewijzen; dit script maakt die niet na.

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
npm run live:owner       # vóór de eerste wissel; alleen na het begrensde tussenbewijs
npm run live:status
```

Op een verse host eindigt de eerste `live:golive` bewust rood. Alleen wanneer
`RTG_OWNER_BOOTSTRAP` de enige blokkade is, ontstaat een smal tussenbewijs dat
nooit als READY of als uitrolbewijs geldt. `live:owner` gebruikt exact dat
geverifieerde immutable image in een eenmalige container zonder gepubliceerde
poort. Het vraagt naam en geboortedatum, maakt een sterk wachtwoord en toont dat
één keer. Daarna leest een tweede schoon productieproces het account uit de
gedeelde PostgreSQL-waarheid terug. Pas na dat positieve bewijs wordt
`RTG_OWNER_BOOTSTRAP` atomisch verwijderd. Draai vervolgens `live:golive`
opnieuw; alleen die tweede, volledig groene ronde kan naar READY en deploy.
Daarmee bestaat er geen circulaire route meer waarin RTG eerst publiek zou
moeten draaien om zijn eerste eigenaar veilig te kunnen maken. PostgreSQL houdt
bewust geen hostpoort: beide eenmalige containers gebruiken uitsluitend het
afgesloten Docker-datanetwerk.

Dit eerste bewijs wordt daarna nooit als blijvende waarheid hergebruikt. Iedere
volgende `live:golive` wist het vorige eigenaarsbewijs en start uit exact het
nieuwe immutable kandidaatimage een aparte `ownerproof`-container. Die container
krijgt geen appvolume, geen releasevolume en geen publieke poort; hij voert
uitsluitend `SELECT`-metingen uit op de echte productie-PostgreSQL. De host bindt
de gehashte owner-email en current-DB-snapshot via een eenmalige nonce aan
commit, image-ID en registrydigest. Alleen dit gesanitiseerde bewijs gaat naar
`keurgolive`; de productiedatabase en haar volume nooit. Het bewijs verloopt na
vier uur. Een herstel, verdwenen eigenaar, onleesbare kluisbinding, oud image of
uitgestelde promotie valt daardoor dicht en vraagt een nieuwe `live:golive`.

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
  Zet daarna een publieke `turns:`-URL met expliciete poort en een sterk
  willekeurig `TURN_SECRET` in `.env.productie`; plaintext `turn:`, test- of
  private hosts en placeholders worden door publieke productie geweigerd.
- Bescherming tegen zeer grote netwerk-DDoS: de app heeft een WAF en IP-rem,
  maar een volumetrische aanval moet vóór de server worden geabsorbeerd. Voeg
  pas als het risicoprofiel dat vraagt een CDN/WAF-provider toe.
- Juridische antwoorden en een onafhankelijke pentest kunnen niet eerlijk door
  code worden ingevuld; `npm run golive` blijft daarop blokkeren.

Betalingen kunnen later als een afzonderlijke, gecontroleerde release worden
ingeschakeld. Tot die tijd is “niet beschikbaar” een technische toestand, geen
UI-belofte die een achterdeur openlaat.
