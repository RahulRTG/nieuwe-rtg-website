# Storingen ontvangen

Het tijdelijke adres is `https://app.rahultravelgroup.com/api/webhooks/storingen`.
De route ontvangt en bewaart meldingen. Zij verstuurt geen e-mail, SMS of push.
Omdat de ontvanger op dezelfde app en host draait, is dit geen onafhankelijke
alarmering bij een volledige app-, host- of verbindingsstoring. Het alarmbord
en de foutmelderstand houden die beperking zichtbaar. Een geslaagde zelfproef
bewijst ontvangst op dat moment, geen volledige productiegereedheid.

## Configuratie

- `ERR_WEBHOOK_URL`: het bovengenoemde volledige adres.
- `ERR_WEBHOOK_SECRET`: een aparte, cryptografisch willekeurige sleutel van
  32 bytes, als 64 hex-tekens. Beide kanten gebruiken dezelfde sleutel.
  Bewaar deze buiten Git en de datamap, in de bestaande runtime-sleutelopslag.
- `RTG_ENC_KEY`: de bestaande gegevenssleutel versleutelt opgeslagen meldingen.
  Een sleutelrotatie vraagt een gecoördineerde herstart van zender en ontvanger.

Er is geen ongesigneerde terugval voor deze route. Een ontbrekende sleutel
geeft 503 en maakt de eigen afzender inactief. De productieconfiguratie weigert
een eigen webhook zonder geldige sleutel.

## Protocol en grenzen

Alleen POST met ongecomprimeerde `application/json`, maximaal 16 KiB.
De body bevat `app`, `soort` (`fout` of `zelfproef`), `tijd` en `fout`.
Optionele `stack` en vrije `context` worden niet bewaard. Alleen een
technisch bronpad zonder query blijft over; tekst gaat langs de logredactie.

De koppen zijn `X-RTG-Event-Id`, `X-RTG-Timestamp` (Unixseconden) en
`X-RTG-Signature` (`v1=` plus een hex-HMAC-SHA256). Het ondertekende bericht is
de UTF-8-prefix `v1\nPOST\n/api/webhooks/storingen\n<tijd>\n<id>\n`
gevolgd door de exacte bodybytes. De klokafwijking mag hoogstens vijf minuten
zijn. Handtekeningen worden tijdveilig vergeleken.

De afzender herhaalt netwerkfouten en 5xx zonder `Retry-After` hoogstens
tweemaal, met dezelfde event-id en body. Bij 429 of een positieve
`Retry-After` meldt hij de mislukking en wachttijd zonder directe retry.
Elke poging heeft een harde deadline van vijf seconden.
Een 2xx telt alleen met een geldig ondertekend ontvangstbewijs dat id en
bodyhash bindt. Het bewijs gebruikt HMAC-SHA256 over
`v1\nack\n<id>\n<body-sha256>\n`.

De ontvanger schrijft transactioneel naar `RTG_DATA_DIR/storingen.db`
(standaard `server/data/storingen.db`), met WAL, FULL-synchronisatie,
bestandsrechten 0600 en versleutelde inhoud via de bestaande kluis.
Een unieke event-id voorkomt dubbele opslag, ook tussen de drie app-processen
en na een herstart. Dezelfde id met andere bytes geeft 409.

De route begrenst elk bron-IP tot 60 verzoeken per minuut per app-proces.
Na authenticatie geldt bovendien een gezamenlijke grens van 120 ontvangsten
per minuut over alle processen die dezelfde SQLite-map delen.
Er worden maximaal 50.000 meldingen gedurende 30 dagen bewaard; na afloop
geldt de deduplicatiegarantie niet meer. Opslag vol of onbeschikbaar geeft 503,
zonder opslagbewijs. 429 en 503 geven `Retry-After: 60`.

Logs bevatten resultaat, event-id, request-id en status; geen body,
handtekening of sleutel. Een fout in de ontvanger wordt niet teruggestuurd
naar dezelfde webhook. Opgeslagen meldingen zijn alleen lokaal via beheer
leesbaar; er is geen openbare lees- of verwijderroute.

## Verificatie

`node --test test/storingen-webhook.test.js test/storingen-bezorging.test.js`
test de echte app-route, twee processen, herstart, handtekeningfouten,
bodywijziging, verlopen verzoeken, inhoudsgrenzen, encryptie en rate limiting.
De bezorgtest verliest doelbewust een antwoord na opslag en controleert dat
de retry dezelfde ontvangst terugkrijgt. Ook volle of falende opslag, een
vals HTTP-200-antwoord, time-outs en een terugmeldlus worden beproefd.

Na uitrol moet een expliciete zelfproef via het publieke HTTPS-adres een
ondertekend opslagbewijs opleveren. Controleer daarnaast lokaal dezelfde
event-id en bodyhash in het ontvangstjournaal en de bijbehorende logregel.
Een herhaalde levering moet 200 met `herhaald: true` geven. Noteer de
uitgerolde commit en de feitelijke testuitslag; schrijf geen READY-status
op basis van alleen een bereikbare URL of deze handleiding.
