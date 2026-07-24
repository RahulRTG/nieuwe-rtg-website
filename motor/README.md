# RTG Motor — de hete kern in Rust

De **strangler-motor**: de security- en snelheidskritische kern van RTG,
herschreven in **Rust**, met **exact dezelfde HTTP-API** als de Node-kern zodat
we hem stap voor stap onder de bestaande server kunnen schuiven zonder de rest
van het platform aan te raken. De Node-server blijft de poort, de auth, de
rol-scheiding en alle 1.300 endpoints doen; de motor neemt het **grootboek**
over (en later de ledengids + de kluis-crypto).

## Waarom Rust (en niet C)

Dit deel beweegt **echt geld** en raakt de **identiteitskluis**. Dat is precies
waar C zijn klassieke gaten heeft (buffer-overflow, use-after-free) — de #1 bron
van het hack-gevaar dat we juist willen uitbannen. Rust geeft C-snelheid **plus**
geheugenveiligheid **plus** veilige concurrency. Voor geld + kluis is dat geen
smaak maar een eis.

## Ontwerpkeuzes

- **Zero dependencies** — alleen de standaardbibliotheek, net als de Node-kant.
  Volledig te auditen, snel te bouwen, geen supply-chain-risico. Binaire ±600 KB.
- **Bedragen zijn `i64` centen** — geen float, dus geen afrondingsdrift. De
  sluitcontrole (som van alle saldi = 0, niemand rood) is de waarheid.
- **`RwLock<State>`** — elke boeking atomair onder de volle storm; lezers
  (overzicht, gezond) blokkeren elkaar niet.
- **Write-behind snapshot** — elke ~200 ms een atomische snapshot (temp +
  rename), opgebouwd onder een korte lock en geserialiseerd búiten de lock.
  Idempotentie en saldi overleven zo een herstart.
- **Thread-per-verbinding** met een verbindingsplafond — verwerkt keep-alive
  zonder pool-verhongering; boven het plafond volgt nette backpressure (503).
- **Gehard tegen DoS**: body-cap (256 KB) VOOR de allocatie, begrensde
  regel/header-lengte — een liegende `Content-Length` van 10 GB krijgt 413 en
  laat de motor niet groeien (blijft ~2,5 MB).
- **Constant-time vergelijk** op betaalcodes (kascode/tikcode): geen timing-lek
  dat verraadt hoeveel tekens al klopten.

## Bouwen, testen, draaien

```sh
cd motor
cargo test --release        # 11 kern-tests (grootboek, idempotentie, kassa, JSON)
cargo build --release        # -> target/release/rtg-motor
RTG_MOTOR_ADDR=127.0.0.1:3100 ./target/release/rtg-motor
```

Omgeving:

| Variabele          | Standaard              | Betekenis                         |
|--------------------|------------------------|-----------------------------------|
| `RTG_MOTOR_ADDR`   | `127.0.0.1:3100`       | luisteradres                      |
| `RTG_MOTOR_MAXCONN`| `1024`                 | plafond gelijktijdige verbindingen|
| `RTG_MOTOR_DATA`   | `motor-data/state.json`| snapshot-bestand (durability)     |

## Endpoints (identiek aan `server/routes/pay.js`)

Ledenkant: `/api/pay/registreer`, `/api/pay/oplaad`, `/api/pay/stuur`,
`/api/pay/overzicht`, `/api/pay/tikcode`, `/api/pay/tik`, `/api/pay/kascode`.
Partnerkant: `/api/supplier/pay/in`, `/api/supplier/pay/overzicht`,
`/api/supplier/pay/uitbetaal`. Bewaking: `/api/pay/gezond`, `/api/motor/status`.

De auth zit in de Node-poort ervoor; `codenaam`/`supplier` komen als veld mee in
de body. In productie draait de betaal-naad (kaart/Apple Pay) echt; hier is het
de demo-naad (altijd meteen betaald), net als de Node-standaard zonder sleutel.

## Status & vervolg (strangler)

- [x] **Money-engine** — grootboek, idempotentie (herstart-vast), autolaad,
  tik, kassacode, partnerkant. 12 tests groen; live idempotent bewezen.
- [x] **Pariteit bewezen** — `scripts/motor-pariteit.js` jaagt dezelfde reeks
  door de Node-JS-engine en de motor; de saldi zijn IDENTIEK, beide sluiten. De
  motor is een geverifieerde 1-op-1 vervanger van het grootboek.
- [x] **Gehard** — DoS-body-cap + constant-time betaalcodes.
- [x] **Concurrency bewezen** — `scripts/motor-storm.js`: 60k parallelle
  operaties (64 schrijvers), 0 serverfouten, som saldi = 0, conservatie exact
  (positieve saldi === -extern). Geen cent zoek onder volle last.
- [x] **Schaduw-modus** (gekozen richting) — `RTG_MOTOR_SHADOW=<url>` spiegelt
  ELKE boeking van de autoritaire JS-engine naar de motor, op het ene
  `boek()`-primitief (dus alle 26 interne callers automatisch mee, zonder ze aan
  te raken). Fire-and-forget batches (nul latentie op het geld-pad); JS blijft
  de baas. `scripts/motor-schaduw.js` bewijst LOCKSTEP: de motor-saldi zijn
  identiek aan de JS-waarheid. Volgende: drift-detector op het statusbord, dan
  canary -> cutover.
- [ ] **De echte naad (na schaduw) — beslissing later.** Het grootboek wordt niet alleen via
  `/api/pay/*` bereikt: **26 interne JS-modules** (RTG Bank, OV, Assets, Vonk,
  Podium, Fluister, WBW, kassa, synergie) roepen `pay.boek/stuur/...`
  RECHTSTREEKS aan. Alleen de HTTP-routes omleiden zou een split-brain-grootboek
  geven (twee ledgers → geldconservatie kapot). De juiste seam is het JS
  `pay`-object zelf een dunne client naar de motor maken, zodat ALLE callers
  door één ledger gaan. Dat is een echte refactor van de geldkern (veel callers
  zijn synchroon `pay.boek(...)`; de motor is async HTTP) en architecturaal
  significant — daarom een bewuste keuze, geen sluipende omzetting.
- [x] **Ledengids** (out-of-RAM) — leden in een gesorteerd bestand met vaste
  recordgrootte; zoeken met binair zoeken op schijf, dus **RAM = O(1)** ongeacht
  het aantal. Endpoints: `/api/gids/bouw`, `/api/gids/zoek` (exact + prefix),
  `/api/gids/status`. Bewezen op 2M leden: gids openen = 2,5 MB RAM (184 MB op
  schijf), 5000 zoekopdrachten ~3000/s, p50 0,31 ms / p99 0,70 ms, RAM vlak.
  `scripts/motor-gids.js` reproduceert het. Projectie 100M: ~9 GB op schijf,
  ~2,5 MB RAM. (Bouwen sorteert nu in RAM; voor >~10M hoort extern sorteren, maar
  het serveren is al out-of-RAM — dat is de eigenschap die telt.)
- [x] **Kluis-crypto** (achter `--features kluis`) — identiteitskluis met ECHTE
  authenticated encryption (**ChaCha20-Poly1305** uit de geaudite RustCrypto-crate;
  geen zelfgebouwde crypto). Verse willekeurige nonce per record (OS-CSPRNG),
  sleutel gescheiden van de data (`secret.key`, rechten 600). Endpoints:
  `/api/kluis/bewaar`, `/api/kluis/onthul`, `/api/kluis/wis`, `/api/kluis/status`
  (toont alleen een niet-omkeerbare sleutel-vingerafdruk, nooit de sleutel).
  Bewezen: klaartekst raakt de schijf nooit, een andere sleutel of een gewijzigd
  blob levert niets op. **De standaardbuild blijft zero-dependency**; alleen deze
  vault-build trekt de crypto binnen (`cargo build --features kluis`).
