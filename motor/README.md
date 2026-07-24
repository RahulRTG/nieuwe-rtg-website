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
  tik, kassacode, partnerkant. 11 tests groen; live idempotent bewezen.
- [ ] Achter de Node-poort schuiven (proxy `/api/pay/*` → motor) en De
  Beproeving eroverheen draaien voor pariteit + snelheidswinst zwart-op-wit.
- [ ] **Ledengids** — 100M leden, out-of-RAM venster, zoek.
- [ ] **Kluis-crypto** — codenamen ↔ echte namen in de gescheiden kluis.
