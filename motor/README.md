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
cargo test --release        # kern-tests: grootboek, idempotentie, kassa, JSON, AEAD-testvectoren, kluis, poortwacht
cargo build --release        # -> target/release/rtg-motor
RTG_MOTOR_ADDR=127.0.0.1:3100 ./target/release/rtg-motor
```

Omgeving:

| Variabele          | Standaard              | Betekenis                         |
|--------------------|------------------------|-----------------------------------|
| `RTG_MOTOR_ADDR`   | `127.0.0.1:3100`       | luisteradres                      |
| `RTG_MOTOR_MAXCONN`| `1024`                 | plafond gelijktijdige verbindingen|
| `RTG_MOTOR_DATA`   | `motor-data/state.json`| snapshot-bestand (durability)     |
| `RTG_MOTOR_TOKEN`  | *(leeg)*               | gedeeld geheim voor de poortwacht (min. 16 tekens) |
| `RTG_KLUIS_NEGEER_GEKNOEID` | *(leeg)*      | `1` = schrijven toestaan ondanks een niet-kloppend kluis-manifest |

### De poortwacht

Rol-scheiding (welk lid mag wat) zit in de Node-poort ervoor. Maar de motor zelf
is daarmee geen open deur: wie hem rechtstreeks bereikt kan zonder slot
`/api/kluis/onthul` lezen en met `/api/pay/boek` rauw boeken. Daarom:

- **`RTG_MOTOR_TOKEN` gezet** → elk verzoek moet het token meesturen, in
  `X-RTG-Motor-Token` of als `Authorization: Bearer <token>`. Constant-time
  vergeleken. Fout of afwezig = `403`. Minimaal 16 tekens, anders start hij niet.
- **Niet gezet** → de motor start alleen op een loopback-adres. Luisteren op
  bijvoorbeeld `0.0.0.0` zonder token is een harde weigering, geen waarschuwing.
- **`/api/leeft`** blijft altijd open voor liveness-probes en geeft niets anders
  dan `{"ok":true}`. Gebruik die voor healthchecks; `/api/ready` en
  `/api/motor/status` zitten wél achter het token (die tonen som, saldi-afdruk en
  ledental).

De Node-kant (`server/kern/pay/motorklant.js`, `bank/motorklant.js`,
`pay/schaduw.js`) en de `scripts/motor-*.js` sturen het token automatisch mee als
`RTG_MOTOR_TOKEN` in hun omgeving staat.

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
  identiek aan de JS-waarheid.
- [x] **Drift-detector op het statusbord** (twee lagen). Het techniek-bord
  (MOTOR-01) vergelijkt de schaduw-motor met de JS-waarheid op ELKE poll:
  eerst de totaalsom, en daarnaast een **vingerafdruk over ALLE saldi**
  (FNV-1a, byte-voor-byte gelijk in `src/pay.rs::vingerafdruk` en
  `server/kern/pay/vingerafdruk.js`). Zo komt ook per-rekening-drift eruit die
  de som mist (rekening A te hoog, B even veel te laag -> som blijft 0). Bewezen
  lockstep: dezelfde stand geeft in beide dezelfde afdruk (`e1c42b2abf34f03f`),
  live geverifieerd tegen `/api/motor/status`. Volgende: canary -> cutover.
- [x] **Cutover-seam gebouwd (gated, standaard uit).** De echte naad is er nu:
  `RTG_MOTOR_GELD=motor` maakt de motor het ENIGE autoritatieve grootboek. Het
  choke-point is `pay.boekAsync` -- in schaduw-modus exact de sync-guard (geen
  gedragsverandering; `pay.test.js` blijft byte-identiek groen), in motor-modus
  gaat elke boeking geguard naar `/api/pay/boekguard` (de guard leeft dus in de
  motor) en spiegelt de JS-engine pas de door de motor BEVESTIGDE regel. De
  interne callers (stuur, oplaad, klompje, kassa, uitbetaal, vonk, ov, synergie
  EN de bank<->wallet-brug) lopen nu door dit ene punt. De synchrone `pay.boek`
  weigert in motor-modus luid (fail-closed) -- nooit een stil tweede grootboek.
  **Bewezen** met `node scripts/motor-cutover.js`: byte-voor-byte lockstep
  (JS-spiegel == motor-vingerafdruk na elke boeking), som blijft 0, de motor-guard
  weigert onvoldoende saldo (402) zonder de spiegel aan te raken, idempotentie
  boekt niet dubbel, de bank<->wallet-brug-pay-kant loopt in lockstep door de
  motor, en de herstart-reconcile herstelt een verse spiegel byte-voor-byte uit de
  motor-snapshot.
  - **Bank<->wallet-brug (klaar):** de brug (`kern/bank/overboeken`) stuurt zijn
    PAY-kant nu via `boekAsync` (in motor-modus dus geguard langs de motor); de
    bank-kant blijft het eigen JS-bank-grootboek. Elk grootboek sluit apart -- de
    bank hoeft NIET in de motor te zitten voor de brug.
  - **Herstart-reconcile (klaar):** in motor-modus haalt de server bij het
    opstarten de saldi-spiegel uit de motor-snapshot (`reconcileVanMotor`, via
    `/api/motor/saldi` achter `RTG_MOTOR_SALDI=1`), zodat de spiegel altijd in
    lockstep start -- ook na een crash of nadat de motor los is bijgewerkt.
  - **Flip-klaar:** zet `RTG_MOTOR_GELD=motor` + `RTG_MOTOR_GELD_URL` en (op de
    motor) `RTG_MOTOR_SALDI=1`.
- [x] **Bank-grootboek in de motor (cutover stap 3, gated, standaard uit).** De
  motor houdt nu een TWEEDE, aparte `Ledger` voor de RTG Bank (`bank`), naast het
  pay-grootboek; ze delen de boekhoud-tucht (som=0, dezelfde FNV-1a-vingerafdruk-
  code) maar sluiten onafhankelijk. Dezelfde vlag `RTG_MOTOR_GELD=motor` stuurt
  beide. Ontwerp-verschil met pay: de bank-guard is **metadata-afhankelijk**
  (rekening bestaat, bevroren, rood-staan-bodem per rekening-soort), en die
  metadata woont in JS. Daarom:
  - De motor doet voor de bank een **RAUWE apply** (`/api/bank/boek`) -- hij is de
    autoritatieve saldi-store, maar neemt de accept/reject-beslissing niet.
  - De **JS-guard** draait vóór de motor-call (in `kern/bank/index.js::boekAsync`),
    plus een **serialisatie-slot** (belofte-keten) om alle bank-schrijfacties heen:
    dat sluit een TOCTOU-race waarin twee gelijktijdige overboekingen dezelfde
    verouderde bodem-check passeren en samen door de bodem zakken.
  - `bank.boek` (synchroon) weigert in motor-modus luid (fail-closed); alle 14
    interne boek-callers (storten, overboeken, brug, SEPA, passen, krediet, sparen,
    incasso, zakelijke bulk/salaris) lopen door `boekAsync`. De motor-`bank_gezond`
    bewaakt enkel de conservatie (som=0), niet wie rood staat -- want in de bank MAG
    een betaalrekening rood tot haar limiet (die policy blijft in JS).
  - **Herstart-reconcile** voor de bank net als voor pay (`/api/bank/saldi` achter
    `RTG_MOTOR_SALDI=1`).
  - **Bewezen** door `node scripts/motor-cutover.js` (bank-scenario): lockstep +
    conservatie op het bank-grootboek, JS-guard weigert onder de bodem zonder de
    spiegel te raken, een betaalrekening mag rood binnen haar limiet, het
    serialisatie-slot laat van twee gelijktijdige boekingen er precies één slagen
    (geen bodem-doorbraak), en de bank-herstart-reconcile herstelt een verse spiegel
    byte-voor-byte. De 19 bank-tests blijven in de standaard schaduw-modus groen
    (byte-identiek gedrag).
- [x] **Ledengids** (out-of-heap) — leden in een gesorteerd bestand met vaste
  recordgrootte; zoeken met binair zoeken, dus **process-heap = O(1)** ongeacht
  het aantal. Standaard leest de gids via **mmap(2)** (read-only, rauwe POSIX-FFI,
  geen crate — zero-dep blijft): de kernel cachet de hete pagina's in RAM en we
  lezen op RAM-snelheid, zonder per zoekopdracht een `File::open` of seek/read.
  Binair zoeken is willekeurige toegang, dus `madvise(MADV_RANDOM)` zet de
  readahead uit (geen verspilde I/O aan pagina's die we niet op volgorde lezen).
  Lukt mmap niet (of op niet-Unix), dan valt de gids terug op **seek+read** op
  schijf — zelfde antwoorden. `bouw()` schrijft naar een temp-bestand en hernoemt
  atomair, zodat een actieve mmap veilig op het oude inode blijft tijdens herbouw
  (geen SIGBUS). Micro-bench (1M leden, mmap): `exact()` p50 ~4 µs / p99 ~9 µs,
  ~233k lookups/s single-thread — de leespad is nu RAM-snelheid i.p.v. de ~0,31 ms
  schijf-p50. Endpoints: `/api/gids/bouw`, `/api/gids/zoek` (exact + prefix),
  `/api/gids/status` (met `mmap`-vlag). Bewezen op 2M leden: gids openen = enkele
  MB heap (184 MB op schijf, in de paginacache), RAM vlak.
  `scripts/motor-gids.js` reproduceert het. (Bouwen sorteert in RAM; voor >~10M
  hoort extern sorteren, maar het serveren is out-of-heap — dat is de eigenschap
  die telt.)
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
