# TURN-relay voor (beeld)bellen in productie

Bellen en videobellen in RTG (leden, personeel, kantoor, de RTFoundation-
gezinnen, school, Meet, Podium/Theater/Clips) gebruikt WebRTC: beeld en geluid
gaan rechtstreeks van toestel naar toestel. Achter symmetrische NAT, streng
4G/5G en bedrijfsfirewalls lukt dat alleen via een **TURN-relay**. RTG draait
die zelf: **coturn op een aparte host `turn.<productiedomein>`**.

Dit document beschrijft het model, de inrichting en het bewijs. De harde regel
eronder: **TURN_URL aanwezig ≠ werkend relais.** Publieke voice/video bestaat
alleen zolang een echte relayproef slaagt.

## 0. Het model in vijf regels

1. **Alleen kortlevende credentials (TURN REST).** coturn draait met
   `use-auth-secret`; het gedeelde geheim (`TURN_SECRET`) staat alleen op de
   app-host en de TURN-host. Een credential is
   `username = <verloop-unix>:<actorlabel>`,
   `password = base64(HMAC-SHA1(TURN_SECRET, username))`. Een vaste
   `TURN_USER`/`TURN_PASS` is in publieke productie **niet toegestaan** (die
   zou ongewijzigd naar elke browser gaan en nooit verlopen).
2. **Alleen voor een geauthenticeerde actor.** `GET /api/ice` (Bearer-sessie),
   `POST /api/rtf/ice` (gezinsprofiel, alleen naar `/api/rtf/`),
   `POST /api/foundation/gezin/ice` en `POST /api/foundation/school/ice`.
   Zonder sessie: `401` en alleen STUN. Per actor maximaal 30 uitgiftes per
   minuut (`429`). Antwoord altijd `Cache-Control: no-store`.
3. **Het actorlabel is ondoorzichtig**: een HMAC onder het TURN-geheim over de
   sessiesleutel, 22 tekens. coturn kan per uitgifte loggen en quota tellen
   zonder dat er een codenaam in zijn log komt.
4. **De relaystand wordt afgeleid, nooit opgeslagen** (`server/kern/rtc/relaystand.js`).
   De server draait elke 4 minuten zelf de echte relayproef
   (`server/kern/rtc/relayproef.js`: twee allocaties, permissies, 64 KiB in
   beide richtingen, SHA-256 vergeleken, over élk geconfigureerd adres). Een
   geslaagde proef draagt 10 minuten en is gebonden aan de
   configuratievingerafdruk (URL's, geheim als HMAC, TTL) en aan de draaiende
   release. Er is geen route, vlag of databaseveld waarmee iemand de stand
   op "geverifieerd" kan zetten.
5. **Monotone hiërarchie**: kill switch (`RTG_RTC_UIT=1`) > autorisatie >
   kwalificatie > providergereedheid (relaystand) > ... Elke stap kan alleen
   weigeren. Voice/video in Connection OS (`connection-policy.json`,
   `provider: rtc-relay`) en élke WebRTC-signaalroute (`server/kern/rtc/poort.js`,
   vóór alle routers) weigeren met `503 PROVIDER_NOT_READY` zolang de stand
   dicht is; ophangen/weigeren blijft altijd mogelijk. Het SOS-meekijkkanaal
   van een ontmoeting is bewust uitgezonderd (een veiligheidskanaal gaat niet
   dicht omdat een kwaliteitsafhankelijkheid wegvalt).

Buiten publieke productie (lokaal, `RTG_PRIVATE_BETA=1`) is een relais niet
vereist: bellen mag direct, en `/api/rtc/stand` zegt dan eerlijk
`RELAY_NIET_VEREIST` of `RELAY_NIET_BEWEZEN_NIET_VEREIST`.

## 1. Omgevingsvariabelen op de app-host

```
TURN_URL=turns:turn.<domein>:5349?transport=tcp
TURN_SECRET=<uit de secretstore, zie par. 3>
# optioneel; standaard 3600, begrensd op [300, 14400] seconden
TURN_CREDENTIAL_TTL=3600
```

- Publieke productie accepteert alleen volledige `turns:`-adressen met een
  openbare host en expliciete poort (geen `turn:`, geen `?transport=udp`, geen
  testnamen of private adressen). Meerdere adressen mogen komma-gescheiden;
  **elk** adres moet de relayproef halen.
- **Waarom een uur TTL**: coturn toetst de tijd in de gebruikersnaam bij elk
  geauthenticeerd verzoek, ook de Refresh en CreatePermission tijdens een
  lopend gesprek. Korter dan een gesprek breekt het gesprek. Clients halen bij
  elke nieuwe oproep een vers credential.
- `RTG_RTC_UIT=1` is de kill switch: geen ICE-servers, geen belsignalen, voice
  en video dicht in elke laag.

## 2. De TURN-host inrichten

Vereisten: een eigen VPS met een **openbaar IPv4-adres**, een DNS A-record
`turn.<domein>` daarnaar, en een publiek vertrouwd TLS-certificaat voor die
naam. IPv6 wordt pas aangezet als de host aantoonbaar een werkend openbaar
IPv6-adres heeft; de configuratie hieronder bindt alleen IPv4.

```
# 1. geheim maken IN de secretstore van de host (nooit in een ticket of repo)
sudo install -d -m 0700 /etc/rtg-turn
openssl rand -hex 32 | sudo tee /etc/rtg-turn/secret >/dev/null
sudo chmod 0600 /etc/rtg-turn/secret

# 2. certificaat (ACME op de TURN-host zelf, bv. certbot standalone of DNS-01)
#    naar /etc/rtg-turn/tls/fullchain.pem en privkey.pem; na elke vernieuwing:
#    docker compose -f docker-compose.turn.yml kill -s SIGUSR2 turn   (herlaadt TLS)

# 3. configuratie genereren (weigert zwakke geheimen, private IP's en open bereiken)
node scripts/turn/maak-config.js \
  --realm=turn.<domein> --extern-ip=<openbaar IPv4>[/<privé IPv4 achter NAT>] \
  --geheim-bestand=/etc/rtg-turn/secret \
  --cert=/etc/rtg-turn/tls/fullchain.pem --sleutel=/etc/rtg-turn/tls/privkey.pem \
  --uit=/etc/rtg-turn/turnserver.conf

# 4. starten (coturn 4.7.0, vastgepind op digest)
docker compose -f docker-compose.turn.yml up -d
```

Wat de gegenereerde configuratie afdwingt: `use-auth-secret` (geen
allocatie zonder geldig credential: geen open relais), `denied-peer-ip` over
alle private, loopback-, link-local- (incl. de metadata-dienst 169.254.169.254),
CGNAT-, multicast- en documentatiebereiken (geen springplank naar interne
netwerken), relaypoorten 49160-49999, `user-quota=12`, `total-quota=2000`,
`max-bps=500000` per sessie, geen CLI, geen versie in SOFTWARE, geen TLS 1.0/1.1.
`test/rtc-relay.test.js` start precies deze configuratie en bewijst dat
permissies naar 10.x, 192.168.x, 169.254.169.254, 172.16.x en 100.64.x een
`403` krijgen en dat een allocatie zonder credential wordt geweigerd.

## 3. Het geheim op de app-host

`TURN_SECRET` komt uit dezelfde secretstore als de TURN-host en gaat via het
bestaande `deploy/live.env`/`rtg_env`-secret naar de app (nooit als
buildargument, nooit in de image). De productiekeuring weigert een zwak geheim
of een plaatshouder. `/api/ice`, `/api/rtc/stand`, logs en het golivebewijs
bevatten het geheim nooit; toetsen controleren dat.

**Rotatie** (gepland, buiten piekuren):
1. Nieuw geheim in de secretstore; `maak-config.js` opnieuw; coturn herstarten.
2. Direct daarna `TURN_SECRET` in de app-secret vervangen en de app herstarten
   via `scripts/docker/live.sh`.
3. Tussen stap 1 en 2 faalt de relayproef (andere geheimen) en staat RTC
   **dicht** -- dat is de bedoeling (fail-closed), geen storing om weg te
   werken. Lopende gesprekken via het relais verliezen hun relay bij de
   eerstvolgende Refresh.
4. Controleer `GET /api/rtc/stand`: `geverifieerd: true` binnen ~4 minuten.

## 4. Firewall op de TURN-host

Alleen open:

- `3478/udp` en `3478/tcp` (STUN/TURN)
- `5349/tcp` (TURN over TLS)
- `49160-49999/udp` (relaypoorten, moet gelijk zijn aan de configuratie)
- SSH alleen vanaf het beheernetwerk

Al het andere dicht, ook naar buiten toe niets extra's nodig.

## 5. Bewijs

| Laag | Wat het bewijst | Waar |
|---|---|---|
| Runtimeproef | dit proces kan NU via elk adres 64 KiB heen en terug relayen | `server/kern/rtc/relaystand.js`, `GET /api/rtc/stand` |
| Golive-keuring | het kandidaatimage met de echte productieconfig relayt; anders geen promotie | `scripts/golive.js` (`turnRelay`), `scripts/lib/live-kandidaat.js` |
| Browserproef | Chromium belt met audio, video en data via het relais (`iceTransportPolicy: 'relay'`), relay-paar aan beide kanten; fout/verlopen/gemanipuleerd verbindt niet | `test/rtc-relay.e2e.js`, `scripts/lib/relaygesprek.js` |
| Extern machinebewijs | twee verschillende netwerk-AS'en, relay-only, ≥64 KiB beide richtingen, getekend door de externe meetrunner | `connectionRealtime` in `server/config/external-machine-evidence.js` |

Alleen `/api/ice` ophalen, een TCP-connect, een draaiend coturn-proces of een
schermafbeelding van de Trickle ICE-pagina is **nooit** bewijs.

## 6. Monitoring en capaciteit

- `GET /api/rtc/stand` (geen geheimen): `beschikbaar`, `geverifieerd`, `reden`,
  en per adres de laatste proef. Alarmeer op `geverifieerd: false` in productie.
- coturn logt naar stdout (json-file, 5×20 MB); gebruikersnamen bevatten alleen
  het ondoorzichtige label.
- Reken op 0,5-1,5 Mbit/s uitgaand per gerelayde videostroom; alleen
  gesprekken zonder directe route gebruiken het relais.

## 7. Terugrollen

- **App**: de gebruikelijke rollback naar het vooraf vastgelegde image
  (`npm run deploy:terug`). De oude app kent deze laag niet maar kan wel
  met dezelfde coturn praten.
- **TURN-host**: `docker compose -f docker-compose.turn.yml down` zet het
  relais uit; de app zet RTC binnen één proefronde dicht (fail-closed). Een
  vorige coturn-versie is een andere vastgepinde digest in dezelfde compose.
- **Noodgeval**: `RTG_RTC_UIT=1` in de app-secret en herstarten.
