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
- [x] **Kluis-crypto** — identiteitskluis met ECHTE authenticated encryption:
  onze **eigen XChaCha20-Poly1305** in `src/aead.rs` (ChaCha20-Poly1305 uit
  RFC 8439 + HChaCha20 uit de XChaCha-draft), byte-voor-byte geverifieerd tegen
  de officiele testvectoren — óók de tussenstappen: quarter-round los + op de
  volle state, Poly1305, Poly1305-sleutelgen uit blok 0, ChaCha-blok, HChaCha20,
  volledige AEAD. Geen zelfverzonnen algoritme, en **geen externe crate** — de
  hele motor is zero-dependency (`cargo tree` toont enkel rtg-motor).
  - **24-byte nonce (XChaCha20)** → nonce-hergebruik bij willekeurige nonces
    praktisch onmogelijk (birthday-veilig).
  - **Timing-hardening** met `std::hint::black_box` op het constant-time
    tag-vergelijk en de Poly1305-maskerkeuze (zelfde mechanisme als de
    `subtle`-crate). ChaCha20-Poly1305 is ARX (geen S-box-cache-timing zoals AES).
  - **Context-binding (AAD):** elk record wordt verzegeld met zijn eigen
    codenaam als additional authenticated data. Een blob dat onder NEVEL staat
    kan daardoor NIET naar het slot van SPOOK worden verplaatst — de
    AEAD-authenticatie faalt zodra de codenaam niet meer klopt. Record-
    verwisseling binnen de kluis is onmogelijk, ook voor wie het versleutelde
    bestand op schijf kan bewerken.
  - **Crash-veilige sleutelrotatie (keyring):** de sleutel is een geordende
    keyring; elk blob draagt in zijn eerste byte de versie waarmee het is
    verzegeld. `/api/kluis/roteer` genereert een verse sleutel en hersleutelt
    alle records ernaartoe. De nieuwe keyring gaat EERST duurzaam naar schijf
    (temp + `fsync` + rename, rechten 600) vóór er ook maar één record wordt
    aangeraakt — crasht de motor halverwege, dan wijst elk blob nog steeds naar
    een sleutel die op schijf staat en raakt niets onleesbaar. Onleesbare
    records worden bij rotatie met rust gelaten (rotatie vernietigt nooit data).
  - **Lengte-verhulling (padding):** elke klaartekst wordt vóór het verzegelen
    naar een emmer (veelvoud van 64 byte) gepad met een lengteprefix. De
    ciphertext-lengte verraadt zo alleen de emmer, niet of een slot een leeg
    profiel of een vol dossier bevat.
  - **Tamper-evident manifest (anti-wissen + anti-terugrol):** naast de
    per-record-authenticatie draagt de kluis een gezegeld manifest (generatie +
    de complete recordset). Bij `open` valt op als iemand met schijftoegang een
    record WIST, een record TOEVOEGT, of de datafile TERUGROLT naar een oudere
    snapshot (de generatie leeft ook in het sleutelbestand als hoogste waarmerk;
    datafile-eerst-dan-keyring voorkomt een valse melding na een crash). Het
    statusbord toont `geknoeid`. Restrisico: wie óók het sleutelbestand
    terugrolt naar exact dezelfde oude generatie krijgt een oude-maar-consistente
    stand; forgen of records mengen lukt daarmee nog steeds niet.
  - **Sleutel wissen bij afsluiten** (zeroize-on-drop over de hele keyring,
    black_box-beschermd).
  - Verse willekeurige nonce per record (/dev/urandom), sleutel gescheiden van de
    data (`secret.key`, rechten 600). Status toont alleen een niet-omkeerbare
    sleutel-vingerafdruk plus het aantal sleutelversies.
  - **Bewezen betrouwbaar:** property-test (300 willekeurige seal→open + tamper),
    fuzz (2000 willekeurige/gemuteerde blobs → nooit crash, nooit vals-accept),
    elke-bit-flip-faalt, AAD-verplaatsing-faalt, rotatie-behoudt-data en
    oude-versie-blijft-leesbaar-na-rotatie. **Doorvoer:** ~332 MB/s seal én open
    (4 KB-blokken).
  Endpoints: `/api/kluis/bewaar`, `/api/kluis/onthul`, `/api/kluis/wis`,
  `/api/kluis/roteer`, `/api/kluis/status`.

  > Eerlijke restnoot (timing): de timing-techniek voor dit algoritme is dezelfde
  > als de pure-Rust vetted crates (ARX + branchloos + black_box). Het enige dat
  > een gevestigde crate extra biedt is jarenlange externe review en fuzzing.
- [x] **De Ontsmetter** (`src/ontsmetter.rs`) — de platform-malware-scanner als
  hete kern in Rust, met dezelfde verdicten als de Node-scanner
  (`kern/antivirus.js`), dus **pariteit**. Eerlijke scope: dit scant geen
  computer van een bezoeker, maar elk BESTAND dat RTG binnenkomt.
  - **46 handtekeningen** (byte-magie én tekst): EICAR, uitvoerbare bestanden
    (PE/MZ, ELF, Mach-O, CAFEBABE, DEX), scripts-in-beeld (`<?php`, `<script`,
    SVG/HTML-XSS), PHP-webshells, PowerShell/JS-uitvoering, Log4Shell, Office-
    macro's, archieven (ZIP/RAR/7z/GZIP/OLE), PDF-gevaar en ransomware-notities.
  - **Heuristiek + entropie**: magie-vs-opgegeven-type (verdacht), gevaarlijke/
    dubbele extensie (besmet), Shannon-entropie voor verpakte payloads.
  - **Snel**: één pass over de bytes via eerste-byte-emmers voor alle tekst-
    handtekeningen (i.p.v. een pass per patroon). **Doorvoer: ~1260 MB/s** (8 MB-
    blok) — 37× sneller dan de naïeve variant. Zero-dependency, incl. een eigen
    kleine base64-decoder.
  - **Bewezen**: EICAR-KAT, PE/ELF, php-in-afbeelding, type-vervalsing, dubbele
    extensie, entropie, uitgebreide-handtekeningen en base64-rondrit — 10 tests.
  Endpoints: `/api/av/scan` (base64 in `data` of rauwe `tekst`, + `mime`/`naam`),
  `/api/av/status` (tellingen + aantal definities).
