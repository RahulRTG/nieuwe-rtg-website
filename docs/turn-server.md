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
# STUN (RTG gebruikt standaard de eigen host; expliciet zetten mag)
STUN_PUBLIC_HOST=<publiek-turn-domein>
STUN_URL=stun:<publiek-turn-domein>:3478

# TURN (verplicht voor publieke voice/video; vervang de haakjes eerst)
TURN_URL=turns:<publiek-turn-domein>:5349?transport=tcp
TURN_SECRET=<willekeurig-geheim-uit-de-secrets-manager>
```

- Deze haakjes zijn uitleg, geen geaccepteerde productieconfiguratie. Publieke
  productie weigert placeholders, `.test`/`.example`, localhost, private IP's,
  een ontbrekende/ongeldige poort en plaintext `turn:`.
- Meerdere volledige `turns:`-URL's mogen met komma's gescheiden. Lege
  lijstitems worden niet naar clients geprojecteerd en blokkeren productie.
- Gebruik een publiek bereikbare host met een geldig TLS-certificaat. Poort
  5349 is gebruikelijk; poort 443 kan als coturn daar werkelijk luistert.
- `TURN_SECRET` of `TURN_PASS` moet minstens 32 daadwerkelijk willekeurige
  tekens bevatten. Herhaalde tekens en bekende placeholders gelden niet als
  sterk geheim. Genereer en bewaar dit in de secrets manager.
- Herstart de server na het zetten van de variabelen. Controleer daarna:
  `curl https://<host>/api/ice` moet uitsluitend niet-lege, veilige ICE-items
  teruggeven. Dit bewijst alleen projectie, niet dat media door het relais liep.

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
realm=<publiek-turn-domein>
server-name=<publiek-turn-domein>

# Aanrader: tijdelijke, per-gebruiker inloggegevens (zie sectie 3)
use-auth-secret
static-auth-secret=<zelfde-geheim-als-in-de-app>

# of, simpeler, een vaste gebruiker (dan TURN_USER/TURN_PASS hierboven gebruiken)
# lt-cred-mech
# user=rtg:<een-sterk-geheim>

# TLS-certificaat (bijv. van Let's Encrypt):
cert=/etc/letsencrypt/live/<publiek-turn-domein>/fullchain.pem
pkey=/etc/letsencrypt/live/<publiek-turn-domein>/privkey.pem

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

## 3. Beveiliging: tijdelijke inloggegevens (TURN REST)

Vaste `TURN_USER`/`TURN_PASS` in de app zijn eenvoudig maar worden aan elke
client meegegeven; lekt het wachtwoord, dan kan iemand je relaybandbreedte
misbruiken. Voor productie is de nette aanpak **kortlevende inloggegevens**
(coturn `use-auth-secret`):

- De server maakt per gebruiker een tijdelijk paar:
  `username = <unix-tijd-over-1-uur>` en
  `password = base64(HMAC-SHA1(static-auth-secret, username))`.
- `/api/ice` geeft dan dat verse paar terug in plaats van een vast wachtwoord.

Deze keten is al geïmplementeerd. Zet `static-auth-secret` in coturn gelijk aan
`TURN_SECRET` in de app. `/api/ice` projecteert dan een één uur geldig paar.
Een vaste `TURN_USER` + sterke `TURN_PASS` wordt nog ondersteund, maar vergroot
de gevolgen van uitlekken en is niet de voorkeursroute.

## 4. Firewall / poorten

Open op de TURN-server:

- `3478/udp` en `3478/tcp` (STUN/TURN)
- `5349/tcp` (TURN over TLS)
- `49152-65535/udp` (het relay-poortbereik uit de config)

## 5. Testen

- **trickle-ice testpagina:** open de officiële WebRTC "Trickle ICE" testtool,
  vul je `turns:`-URL + inloggegevens in en klik "Gather candidates". Je moet
  regels van type `relay` zien; dat bewijst dat TURN werkt.
- **Releasebewijs:** de verplichte `connectionRealtime`-runner gebruikt twee
  aantoonbaar verschillende netwerk-AS'en, forceert een relay-only selected
  pair en verstuurt minstens 64 KiB in beide richtingen. Het getekende dossier
  herverifieert deze waarneming. Alleen `/api/ice` ophalen, twee clients op
  hetzelfde netwerk of een handmatige schermafbeelding kan release nooit groen
  maken.

## 6. Schaal en kosten

- Eén TURN-server aan kan honderden gelijktijdige gesprekken; media relayen
  kost vooral uitgaande bandbreedte (reken op ~0,5-1,5 Mbit/s per videostream).
- Alleen gesprekken die geen directe verbinding kunnen leggen gebruiken TURN;
  de rest gaat rechtstreeks (STUN). In de praktijk is dat een minderheid.
- Voor meerdere regio's kun je meer TURN-servers achter dezelfde
  `TURN_URL`-lijst (komma-gescheiden) zetten; de client kiest automatisch de
  snelste.

## Samengevat

1. Draai coturn met TLS op een server met publiek IP en publiek DNS-certificaat.
2. Zet een volledige `turns:`-`TURN_URL` en bij voorkeur `TURN_SECRET` bij de
   RTG-server en herstart.
3. `GET /api/ice` geeft de TURN-server dan mee; de app pakt hem automatisch op.
4. Maak en onderteken daarna het echte tweennetwerk-machinebewijs; pas dat kan
   publieke release-readiness openen.
