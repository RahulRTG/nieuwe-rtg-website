# Gecontroleerde Rust-migratie

`RUST-MIGRATIES.json` is het blijvende stuurpaneel voor de dertien expliciet
gekozen zware modules. `npm run motor:migraties` toont de stand;
`npm run motor:migraties:controle` blokkeert een release als paden, volgorde,
bewijs, fase of noodstop niet meer kloppen.

De vaste trechter is: `geregistreerd` → `rust-bouw` → `pariteit` → `schaduw` →
`canary` → `rust`. Er mag maximaal één module tegelijk in `schaduw` of `canary`
staan. Een fase in het register is een bewezen toestand, geen planning. Canary
betekent daarom niet dat alle productiebelasting al is gezien; pas gemeten
verkeer en een bewust volgende wijziging mogen de fase naar `rust` brengen.

## Noodbediening

`RTG_RUST_ALLES_UIT=1` zet gemigreerde applicatiefuncties terug naar hun
bewezen JavaScript-pad. De Rust-Sentinel blijft bewust actief: die onafhankelijke
voordeur moet verkeer juist kunnen beperken of isoleren tijdens een incident.
Module-eigen schakelaars staan in het register. Voor de eerste module zijn dat:

- `RTG_CAPABILITY_RUST_MODE=uit|schaduw|canary|motor`
- `RTG_CAPABILITY_RUST_CANARY_PCT=0..100`
- `RTG_CAPABILITY_RUST_CANARY_KEY=<stabiele instance- of tenant-sleutel>`

Bij een kapotte binary of pariteitsdrift kiest de capabilityscanner automatisch
JavaScript en meldt `graph.motor` bron, stand, pariteit en reden.

## Grenzen per module

Rust neemt alleen zuivere, begrensde kernen over. Node houdt netwerkadapters,
HTTP-autorisatie, PostgreSQL-I/O en SMTP-I/O zolang daar geen apart bewezen
protocol voor bestaat. Voor `public/shared/media.js` blijven DOM en
browserrechten JavaScript; alleen zuivere parsing kan later naar Rust/WASM.
`appgids-data/deel1.js` blijft declaratieve data; Rust kan die bij de build
valideren en compileren. Dit voorkomt een grote herschrijving zonder terugweg.

De huidige stand is eerlijk: capability-inventarisatie staat op canary met
runtime-pariteitscontrole; de bestaande Magnaat-marktkern en pay-ledger hebben
pariteitsbewijs; de ledengids heeft een Rust-bouwkern. De overige modules zijn
geregistreerd en worden strikt één voor één behandeld.
