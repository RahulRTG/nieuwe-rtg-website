# AUDITOPSLAG — pariteit SQLite / PostgreSQL (audit A-P1-05, open beperking)

Gemeten op 6 oktober 2026, geen bouwwerk: dit legt vast wat er is, zodat het geen stille aanname blijft.

## Wat er staat

`save.audit.open(naam)` (`server/db/audit-poort.js`) geeft een append-only auditopslag met rijen **alleen als `STORE === 'sqlite'`**. Bij PostgreSQL geeft hij `null`.

Twee aanroepers, beide met `?.` en een terugval:

- `server/opzet/auditspoor.js` (`apiSpoor`): zonder opslag leest en schrijft het command-journaal in de eigen collectie (`eigencollectie`, vorm `kaart`).
- `server/lib/handelingsspoor.js` (`handelingLog`): zonder opslag een lijst in de eigen collectie met een ringgrens (`MAX`).

## Wat dat betekent (en niet betekent)

- In PostgreSQL leven beide sporen in de gewone database-snapshot (`db.data`), geschreven via `save()`. Ze zijn dus **niet kwijt**, maar ze zijn een **lijst met een ringgrens** in plaats van rijen die alleen groeien.
- De hashketen bewijst nog steeds wat er STAAT; de ringgrens kan oudste regels laten afvallen. In SQLite is dat een apart besluit (730 dagen op tijd, `inzagelog-bewaring`); voor de twee sporen hierboven is er in PostgreSQL **geen tijdgebonden bewaring**, alleen de ringgrens.
- Het kritieke spoor van A-P1-05 (het kritiekspoor uit PR #499) vraagt `vastleggen` (duurzaam, met bevestigde commit) en is dus wél afhankelijk van de PG-commitroute, niet van deze poort.

## Besluit (6 oktober 2026): het auditboek is de PostgreSQL-weg voor beveiligings-, release-, promotie-, rollback- en beheergebeurtenissen

Er komt GEEN PG-implementatie van `save.audit.open()`; dat zou een tweede opslagmodel voor dezelfde sporen zijn. In plaats daarvan is er een eigen, gesloten, onherschrijfbare opslag: **`server/kern/auditboek/`, zie [AUDITBOEK.md](AUDITBOEK.md)** -- rijen in PostgreSQL met append-only triggers, een SHA-256-keten, een ondertekend anker BUITEN de database en een bewaartermijn van 730 dagen op tijd. Het kritiekspoor schrijft in PostgreSQL-modus daar ook naartoe en weigert (503) als dat niet lukt.

Wat NIET veranderd is en dus nog steeds geldt: `apiSpoor` en `handelingLog` blijven in PostgreSQL een **lijst met een ringgrens** in de snapshot, **geen tijdgebonden bewaring**, en hun terugval op `null` staat vast in `test/auditopslag-pg.test.js`. Wie wil dat die twee sporen dezelfde garanties krijgen als het auditboek, moet ze er expliciet op aansluiten; dat is niet gebeurd.
