# Livegang — één server, lokaal waar het kan

Dit is de kortste ondersteunde productieroute voor RTG zonder OpenAI en zonder
betalingen. De website, accounts, workflows, zoek-, taal- en rekenfuncties,
backoffice, PostgreSQL, Redis, de Rust-geldmotor, TLS en back-ups draaien op de
eigen server. Alleen drie zaken moeten noodzakelijk van buiten komen: DNS,
bezorging van echte e-mail en een afzonderlijke plek voor back-ups.

## Wat deze stand afdwingt

- `RTG_AI_UIT=1`: geen OpenAI, Anthropic, Gemini, Qwen of andere modelserver
  nodig. De ingebouwde lokale taal- en regelmotor blijft werken.
- `RTG_BETALEN_UIT=1`: alle betaalproviders, demo-betalingen, webhooks,
  refunds, uitbetalingen en muntbetalingen weigeren fail-closed.
- `RTG_TLS=1` + `RTG_ACME=1`: RTG regelt zelf HTTP/2, TLS 1.2/1.3,
  Let's Encrypt, vernieuwing en HTTP-naar-HTTPS. Geen Caddy/certbot nodig.
- PostgreSQL + Redis + versleutelde identiteitskluis; geheimen staan niet in
  `docker inspect` en niet op het datavolume.
- Dagelijkse gevalideerde back-up buiten de Docker-schijf, met een bewust
  dubbel bevestigd herstelpad.

## Eenmalig op de Linux-productieserver

Vereist: Docker met `docker compose`, een domein waarvan A/AAAA naar de server
wijst, en publiek bereikbare TCP-poorten 80/443 plus UDP 3478.

```bash
cp deploy/live.env.example deploy/live.env
# Pas RTG_BACKUP_HOST_DIR aan naar een bestaande map op een tweede schijf/mount.
# De app/back-upcontainers draaien als uid 1000; geef die gebruiker toegang:
sudo install -d -o 1000 -g 1000 -m 700 /mnt/tweede-schijf/rtg-backups

npm run live:init -- \
  --eigenaar=eigenaar@jouwdomein.nl \
  --url=https://app.jouwdomein.nl \
  --tls-email=beheer@jouwdomein.nl \
  --smtp-url=smtps://gebruiker:wachtwoord@smtp.jouwdomein.nl:465
```

`live:init` toont de sleutels niet in de terminal. Het schrijft
`.env.productie` en `.rtg-secrets/postgres_password` met rechten 600; beide
staan in `.gitignore`. Bewaar een versleutelde kopie van die twee buiten de
server. Koppel `OFFICE_TOTP_SECRET` uit `.env.productie` aan de authenticator
van de eigenaar en verwijder `RTG_OWNER_BOOTSTRAP` zodra het eigenaarsaccount
is geclaimd.

Controleer en rol uit:

```bash
npm run live:check       # geheimen, native TLS, 2FA, AI/betalen uit, back-upmount
npm run live:deploy      # bouwt, start, wacht op ready; rollback bij mislukking
npm run live:owner       # claimt eigenaar lokaal; geheimen worden niet getoond
npm run live:golive      # echte containerdatabase + verplicht papierwerk
npm run live:probe       # echte DNS/TLS/security/SLO-proef vanaf buiten
```

De eerste uitrol is de technische opstart, nog niet het moment om de lancering
aan te kondigen. `live:owner` vraagt naam, geboortedatum en tweemaal het
wachtwoord, claimt het ingestelde eigenaarsadres uitsluitend via de lokale
HTTPS-poort, verwijdert `RTG_OWNER_BOOTSTRAP` atomisch en herstart de app. Geen
van beide geheimen komt in shellgeschiedenis of logs. Bevestig daarna de mail,
beantwoord op de technische pagina de papierwerkvragen en laat `live:golive` én
`live:probe` groen worden. PostgreSQL heeft bewust geen hostpoort; daarom draait
de echte go-live-keuring in de container.

De eerste ACME-uitgifte lukt pas als DNS al naar de server wijst en poort 80
bereikbaar is. Een mislukte uitgifte houdt de app bewust op een self-signed
certificaat; `live:probe` blijft dan rood en voorkomt een stille schijn-livegang.

## Dagelijks beheer

```bash
npm run live:status
npm run live:backup
npm run live:rollback
```

Een release-image wordt immutable als `rtg-app:release-<git-id>` gebouwd. Voor
de wissel bewaart de uitrol het draaiende image als `rtg-app:rollback`. Komt de
nieuwe `/api/ready` niet binnen twee minuten op, dan zet het script dat image
automatisch terug.

De GitHub-workflow `Publieke live-sonde` meet elke vijf minuten van buitenaf.
Zet daarvoor repository variable `RTG_LIVE_URL` op het volledige HTTPS-adres en
zet GitHub Actions-foutmeldingen aan. `ERR_WEBHOOK_URL` blijft aanbevolen voor
interne fouten die de app nog wel zelf kan waarnemen.

## Herstel bij een echte ramp

Bekijk eerst de timestamps in `<RTG_BACKUP_HOST_DIR>`. Het volgende commando
stopt alle schrijvers, controleert SHA-256 en dumpstructuur, herbouwt PostgreSQL,
zet de bijbehorende bestandsback-up terug en start daarna opnieuw:

```bash
npm run live:restore -- 20260815T030000Z
```

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
