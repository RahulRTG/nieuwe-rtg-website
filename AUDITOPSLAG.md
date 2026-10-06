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
- Het kritieke spoor van A-P1-05 (`opzet/kritiekspoor.js`) vraagt `vastleggen` (duurzaam, met bevestigde commit) en is dus wél afhankelijk van de PG-commitroute, niet van deze poort.

## Open besluit (niet genomen, niet gebouwd)

Een PG-implementatie van `open()` (rijtabel, append-only, dezelfde `view/append/rewrite`) of bewust de lijstvorm houden en de bewaring uitschrijven. Tot dat besluit staat de stand in `test/auditopslag-pg.test.js` vast: wie de terugval verandert of `open()` voor postgres iets laat teruggeven zonder deze tekst bij te werken, laat die toets zakken.
