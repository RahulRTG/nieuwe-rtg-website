# TURN-server voor (beeld)bellen in productie

Het bellen en videobellen in de app (leden onderling in de RTG-app en de
gezinsleden/oppas in de RTFoundation) gebruikt WebRTC: het beeld en geluid gaan
rechtstreeks van toestel naar toestel, niet via onze server. Om die directe
verbinding tot stand te brengen zijn twee soorten hulpservers nodig:

- **STUN** laat een toestel zijn eigen publieke IP-adres ontdekken. Dit is
  gratis en licht; er loopt geen media overheen. Voor de meeste verbindingen is
  STUN genoeg.
- **TURN** geeft het beeld en geluid een omweg via een relayserver wanneer een
  directe verbinding niet lukt. Dat gebeurt achter strenge of mobiele netwerken
  (symmetrische NAT, streng bedrijfs- of 4G/5G-netwerk). Zonder TURN blijft een
  gesprek daar "overgaan" of valt het beeld weg. TURN kost bandbreedte en draait
  daarom op je eigen server.

De app leest de lijst met ijs-servers (ICE) live op via `GET /api/ice`. Zet je
de TURN-omgevingsvariabelen, dan sturen we die automatisch mee naar elke
belverbinding. Je hoeft in de app-code niets te wijzigen.

## 1. Omgevingsvariabelen die de server leest

Zet deze bij de RTG-server (of in je proces-manager / container):

```
# STUN (standaard staat een publieke Google-STUN al aan; eigen STUN mag ook)
STUN_URL=stun:turn.rahultravelgroup.example:3478

# TURN (verplicht voor betrouwbaar bellen op mobiel)
TURN_URL=turn:turn.rahultravelgroup.example:3478,turns:turn.rahultravelgroup.example:5349
TURN_USER=rtg
TURN_PASS=<een-sterk-geheim>
```

- Meerdere URL's mogen met komma's gescheiden (bijv. UDP + TLS).
- `turns:` (TURN over TLS, poort 5349) is belangrijk: op netwerken die alleen
  poort 443/TLS toestaan is dit vaak de enige weg die werkt.
- Herstart de server na het zetten van de variabelen. Controleer daarna:
  `curl https://<host>/api/ice` moet je TURN-server teruggeven.

## 2. coturn installeren (aanbevolen, open source)

Op een eigen VPS/servertje met een publiek IP (Ubuntu/Debian):

```
sudo apt update && sudo apt install coturn
sudo sed -i 's/#TURNSERVER_ENABLED/TURNSERVER_ENABLED/' /etc/default/coturn
```

Bewerk `/etc/turnserver.conf`:

```
listening-port=3478
tls-listening-port=5349
# vervang door het publieke IP van de server:
external-ip=<PUBLIEK_IP>
realm=turn.rahultravelgroup.example
server-name=turn.rahultravelgroup.example

# Aanrader: tijdelijke, per-gebruiker inloggegevens (zie sectie 3)
use-auth-secret
static-auth-secret=<zelfde-geheim-als-in-de-app>

# of, simpeler, een vaste gebruiker (dan TURN_USER/TURN_PASS hierboven gebruiken)
# lt-cred-mech
# user=rtg:<een-sterk-geheim>

# TLS-certificaat (bijv. van Let's Encrypt):
cert=/etc/letsencrypt/live/turn.rahultravelgroup.example/fullchain.pem
pkey=/etc/letsencrypt/live/turn.rahultravelgroup.example/privkey.pem

# beperk de relaypoorten en sluit interne adressen uit
min-port=49152
max-port=65535
no-multicast-peers
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
```

Start en zet aan bij het opstarten:

```
sudo systemctl enable coturn
sudo systemctl restart coturn
```

## 3. Beveiliging: gebruik tijdelijke inloggegevens (TURN REST)

Vaste `TURN_USER`/`TURN_PASS` in de app zijn eenvoudig maar worden aan elke
client meegegeven; lekt het wachtwoord, dan kan iemand je relaybandbreedte
misbruiken. Voor productie is de nette aanpak **kortlevende inloggegevens**
(coturn `use-auth-secret`):

- De server maakt per gebruiker een tijdelijk paar:
  `username = <unix-tijd-over-1-uur>` en
  `password = base64(HMAC-SHA1(static-auth-secret, username))`.
- `/api/ice` geeft dan dat verse paar terug in plaats van een vast wachtwoord.

Zo ziet zo'n uitbreiding er in de server uit (te plaatsen in `iceServers()` in
`server/server.js` als je overstapt op REST-credentials):

```js
const crypto = require('crypto');
function turnCred(secret) {
  const username = String(Math.floor(Date.now() / 1000) + 3600); // 1 uur geldig
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential };
}
// in iceServers(): als process.env.TURN_SECRET gezet is, gebruik turnCred(...)
// i.p.v. TURN_USER/TURN_PASS, met dezelfde TURN_URL.
```

Zet dan `static-auth-secret` in coturn gelijk aan `TURN_SECRET` in de app.

## 4. Firewall / poorten

Open op de TURN-server:

- `3478/udp` en `3478/tcp` (STUN/TURN)
- `5349/tcp` (TURN over TLS)
- `49152-65535/udp` (het relay-poortbereik uit de config)

## 5. Testen

- **trickle-ice testpagina:** open de officiele WebRTC "Trickle ICE" testtool,
  vul je `turns:`-URL + inloggegevens in en klik "Gather candidates". Je moet
  regels van type `relay` zien; dat bewijst dat TURN werkt.
- **In de app:** bel tussen twee toestellen op verschillende netwerken (bijv.
  een op wifi, een op 4G zonder wifi). Zonder TURN mislukt dit vaak; met TURN
  verbindt het.

## 6. Schaal en kosten

- Eén TURN-server aan kan honderden gelijktijdige gesprekken; media relayen
  kost vooral uitgaande bandbreedte (reken op ~0,5-1,5 Mbit/s per videostream).
- Alleen gesprekken die geen directe verbinding kunnen leggen gebruiken TURN;
  de rest gaat rechtstreeks (STUN). In de praktijk is dat een minderheid.
- Voor meerdere regio's kun je meer TURN-servers achter dezelfde
  `TURN_URL`-lijst (komma-gescheiden) zetten; de client kiest automatisch de
  snelste.

## Samengevat

1. Draai coturn met TLS op een server met publiek IP.
2. Zet `TURN_URL`, `TURN_USER`, `TURN_PASS` (of `TURN_SECRET` voor REST) bij de
   RTG-server en herstart.
3. `GET /api/ice` geeft de TURN-server dan mee; de app pakt hem automatisch op.
4. Overweeg kortlevende inloggegevens voor productie.
