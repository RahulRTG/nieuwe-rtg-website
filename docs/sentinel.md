# RTG Sentinel: onafhankelijke voordeur en noodbediening

Sentinel is een kleine Rust-binary zonder externe crates. Hij draait vóór Node
en krijgt geen database-, sessie-, kluis-, Stripe- of motorsleutels. Daardoor
kan hij verkeer blijven blokkeren wanneer de app defect of mogelijk besmet is.

```text
internet -> TLS/CDN -> Sentinel :3080 -> Node/app :3000 -> Rust-motor :3100
                         |
                         +-- beheer :3091, uitsluitend loopback + eigen token
```

De Node-controlekamer blijft geschikt voor fijnmazige functieschakelaars en
diagnose. Sentinel is de buitenste, onafhankelijke hoofdzekering. Geef zijn
token nooit aan Node en zet beheerpoort 3091 nooit publiek open.

## Wat hij afdwingt

- vergelijkt alle runtimebron, gebouwde frontend en beide Rust-binaries met het
  gepinde SHA-256-releasebewijs;
- gaat fail-closed in isolatie bij nieuwe, verdwenen of veranderde code;
- onthoudt de stand in een HMAC-beveiligd bestand;
- schrijft iedere standwisseling in een append-only HMAC-hashketen;
- weigert herstel zolang de codescan rood is;
- sluit bestaande verbindingen bij beperken of isoleren;
- verwijdert door clients aangeleverde forwardingheaders en maakt zelf de
  vertrouwde bron-IP/protocolheaders;
- weigert dubbelzinnige HTTP-verzoeken, waaronder Transfer-Encoding, botsende
  Content-Length, kale CR/LF, dubbele Host en pipelining.

In Compose draaien app, motor en Sentinel bovendien met een read-only rootfs,
zonder Linux-capabilities en met `no-new-privileges`. Alleen hun expliciete
datavolumes en begrensde tijdelijke map zijn schrijfbaar. Sentinel controleert
hetzelfde app-image; Node kan zijn runtimebron daardoor niet wijzigen.

Sentinel scant standaard iedere vijf minuten. Een onbereikbare app wordt wel
zichtbaar, maar veroorzaakt standaard geen blijvende auto-isolatie: anders kan
een aanvaller met een korte storing zelf een permanente denial-of-service
uitlokken. Code-integriteitsverlies is wél direct fail-closed.

## Dagelijkse bediening

Lokaal start `npm run start:rust` de hele keten. Het bouwt eerst de frontend,
maakt een vers releasebewijs en zet Sentinel op de publieke poort. Los bedienen:

```bash
npm run sentinel:status
npm run sentinel:scan
npm run sentinel:audit
npm run sentinel:audit:verify
```

De vier standen:

```bash
npm run sentinel:watch -- "verdachte piek wordt onderzocht"
npm run sentinel:restrict -- "/api/pay,/api/bank" "geldroutes tijdelijk gesloten"
npm run sentinel:isolate -- "mogelijke besmetting wordt onderzocht" "ISOLEER RTG"
npm run sentinel:restore -- "schone release onderzocht en gecontroleerd" "HERSTEL RTG"
```

`restrict` blokkeert de opgegeven padprefixes en laat de rest door. `isolate`
blokkeert al het appverkeer; alleen Sentinel-liveness en de lokale beheerpoort
blijven bereikbaar. `restore` werkt pas nadat `sentinel:scan` groen is.

In Docker gebruikt beheer de container, zodat poort 3091 intern blijft:

```bash
docker compose --env-file .env.productie exec sentinel /app/rtg-sentinel ctl status
docker compose --env-file .env.productie exec sentinel /app/rtg-sentinel ctl scan
docker compose --env-file .env.productie exec sentinel /app/rtg-sentinel ctl isolate \
  "mogelijke besmetting wordt onderzocht" "ISOLEER RTG"
```

## Incident: mogelijke malware

1. Isoleer eerst; verwijder of wijzig nog niets.
2. Bewaar container/image, `.release/release-bewijs.json`, Sentinel-volume,
   app-logs en externe logs als bewijs.
3. Lees `sentinel:status`, `sentinel:audit` en voer `sentinel:scan` uit.
4. Roteer app-geheimen vanuit het geheimenbeheer als uitlekken mogelijk is.
   Het Sentinel-token roteert apart.
5. Bouw een bekende schone commit opnieuw en rol die uit via
   `npm run deploy:productie`; die uitrol scant Sentinel vóór groenmelding.
6. Herstel verkeer pas bij groene integriteit en leg de reden vast.

Een kapotte auditketen vergrendelt Sentinel bewust in isolatie. Bewaar eerst een
kopie van het volledige Sentinel-volume. Stop daarna Sentinel en gebruik alleen
offline:

```bash
npm run sentinel:audit:recover -- "BEWAAR EN HERSTART AUDIT"
```

Dit wist niets: de oude audit en stand worden als `*.corrupt-<tijd>.json[l]`
bewaard en een nieuwe keten begint in isolatie. In Compose: stop de service en
voer hetzelfde binarycommando uit met een tijdelijke `compose run` die het
Sentinel-volume en secret mount. Onderzoek de bewaarde bestanden daarna apart.

## Configuratie en grens

Zie `.env.example` voor alle `RTG_SENTINEL_*`-variabelen. Compose bindt de
publieke Sentinel-poort standaard alleen op `127.0.0.1`; een lokale TLS-proxy
of tunnel hoort ervoor. `RTG_SENTINEL_BIND=0.0.0.0` is een bewuste uitzondering,
niet de veilige standaard.

De SHA-pin moet van buiten het draaiende image komen. `deploy:productie` leest
hem na de build uit het image en geeft hem terug aan Sentinel. Wie tegelijk de
host, het image, de uitrolcode én de externe secret-/backupomgeving beheerst,
valt buiten deze grens. Daarom blijven immutable/offsite backups, sleutelrotatie,
hostpatches, CDN/DDoS-bescherming en onafhankelijke pentests nodig.
