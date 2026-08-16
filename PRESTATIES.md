# RTG native prestaties

Meetpunt: Apple Silicon (`darwin-arm64`), Node v24.18.0, release-Rust met LTO.
De proef gebruikt 5.611 controlepunten, 3.597 API-acties, 257 apps en 1.574
werkprocessen. Alle getallen zijn wandkloktijd; lager is beter.

```bash
npm run prestaties

# Inclusief de read-only Rust-broncodescan:
RTG_CAPABILITY_RUST_BIN="$PWD/motor/target/release/rtg-motor" npm run prestaties

# Inclusief de volledige Node -> HTTP -> Rust Magnaat-keten:
RTG_MOTOR_REKEN_URL=http://127.0.0.1:3100 \
RTG_MAGNAAT_RUST=motor RTG_MOTOR_TOKEN='...' npm run prestaties
```

## Gemeten winst

| Pad | Voor p50 | Na p50 | Winst | Voor p95 | Na p95 | Winst |
|---|---:|---:|---:|---:|---:|---:|
| Capability Graph, volledige scan | 219,4 ms | 180,9 ms | 17,5% | 230,2 ms | 189,0 ms | 17,9% |
| Codecontrole, boardroom | 9,87 ms | 3,82 ms | 61,3% | 15,72 ms | 4,47 ms | 71,5% |
| Codecontrole, één kantoor | 10,16 ms | 2,88 ms | 71,7% | 27,28 ms | 3,55 ms | 87,0% |
| Magnaat, volledige Rust-keten | 8,51 ms | 1,93 ms | 77,4% | 14,38 ms | 2,40 ms | 83,3% |

De Codecontrole-winst komt uit stabiele `Map`-indexen en één publieke omzetting
per punt. De index wordt automatisch vervangen zodra een codescan een nieuw
Graph-object oplevert; overrides blijven dus onmiddellijk zichtbaar.

De Rust-keten kopieerde aanvankelijk vóór ieder verzoek ook het volledige,
groeiende journaal en de historie. Nu wordt alleen het kleine rekenmodel gekopieerd.
Na het native antwoord volgt een mutatieversie-check en één synchrone commit. Een
storing of gelijktijdig besluit kan daardoor nog steeds geen halve dag achterlaten.

## Eerlijke grens

Met de huidige twee spelbedrijven is de bewezen JavaScript-dagberekening zelf
klein: circa 0,15 ms p50. De volledige Rust-keten van circa 1,93 ms is daarvoor
niet sneller, omdat proces-, HTTP- en JSON-overdracht een vaste prijs hebben.
Rust is hier gekozen voor isolatie, geheugenveiligheid en groei naar veel meer
bedrijven; niet om een onmeetbare rekensom mooier te laten lijken. De benchmark
houdt dit verschil zichtbaar zodat een toekomstige wijziging aantoonbaar beter
moet zijn.

## Browserstart

`app-main.js` (circa 584 KB) en `leverancier.js` (circa 788 KB) blokkeerden het
HTML-parsen. Beide laden nu met `defer`: parallel met de HTML, in vaste volgorde
na hun synchrone poorten en vóór `DOMContentLoaded`. Een echte lokale browserproef
laadde beide poorten volledig met nul console-errors. De statische toets
`test/zware-bundels.test.js` bewaakt de laadwijze en de vereiste volgorde.
