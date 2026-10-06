# AUDITOPSLAG — pariteit SQLite / PostgreSQL en de integriteit van het spoor

Eerst gemeten op 6 oktober 2026 (audit A-P1-05, open beperking). Dezelfde dag bijgewerkt na de reparatie van de auditbevindingen P0-1, P1-2, P1-3, P1-4, P2-5 en P2-7 — alles hieronder beschrijft wat de code NU doet, met de toets die het bewaakt.

## Wat er staat

`save.audit.open(naam)` (`server/db/audit-poort.js`) geeft een append-only auditopslag met rijen **alleen als `STORE === 'sqlite'`**. Bij PostgreSQL geeft hij `null`.

Twee aanroepers, beide met `?.` en een terugval:

- `server/opzet/auditspoor.js` (`apiSpoor`): zonder opslag leest en schrijft het command-journaal in de eigen collectie (`eigencollectie`, vorm `kaart`).
- `server/lib/handelingsspoor.js` (`handelingLog`): zonder opslag een lijst in de eigen collectie met een ringgrens (`MAX`).

## Wat dat betekent (en niet betekent)

- In PostgreSQL leven beide sporen in de gewone database-snapshot (`db.data`), geschreven via `save()`. Ze zijn dus **niet kwijt**, maar ze zijn een **lijst met een ringgrens** in plaats van rijen die alleen groeien.
- De hashketen bewijst nog steeds wat er STAAT; de ringgrens kan oudste regels laten afvallen. In SQLite is dat een apart besluit (730 dagen op tijd, `inzagelog-bewaring`); voor de twee sporen hierboven is er in PostgreSQL **geen tijdgebonden bewaring**, alleen de ringgrens.

## Geen vastgelegde mutatie zonder haar spoor (P0-1)

**De fout.** In PostgreSQL committen twee primitieven midden in een verzoek in een eigen transactie: de collectietransactie (`server/db/collectie-postgres.js`) en de economische boeking (`server/db/economische-boeking-postgres.js`). Het spoor van dat verzoek (handelingsspoor, API-spoor, inzagejournaal, de voorregel van het kritiekspoor) landde pas in de latere requestcommit. Een mislukte requestcommit — of een foutstatus, die hem overslaat — liet de mutatie staan en het spoor verdwijnen. Gemeten: `POST /api/pay/kascode` gaf 503, de kascode stond in PostgreSQL, het `handelingLog` was niet veranderd.

**Het besluit.** Elke vroege commit neemt het spoor van het verzoek mee in ZIJN EIGEN transactie (`server/db/verzoekspoor.js`, op de PG-laag `server/pg/verzoekschrijf.js`, met dezelfde samenvoeging als de requestcommit en de sloten in één vaste volgorde). Er komt een regel `stand: 'vastgelegd'` bij met de geraakte collecties, want de eindregel bestaat pas na die commit. Faalt het spoor (een trigger, een conflict, een gebroken keten), dan rolt de mutatie mee terug. De andere weg — de voorregel van het kritiekspoor vooraf als eigen commit — is bewust niet gekozen: die dekt alleen de kritieke paden en legt vast dat iets MAG, niet dat het gebeurde.

**Wat "duurzaam" daarmee in PostgreSQL betekent.** Binnen een verzoek: de regel staat in dezelfde transactie als elke mutatie van dat verzoek, of geen van beide staat er. `server/lib/duurzaam.js` weigert in PostgreSQL BUITEN een verzoek (503, de mutatie draait niet): daar bevestigt niemand iets. `noteerVast()` van het inzagejournaal zet in PostgreSQL binnen een verzoek `vast: true`, omdat een opgeslagen regel alleen bestaat als de transactie slaagde die ook het antwoord draagt.

**SQLite** (één schrijvend proces) was al veilig: de voorregel van het kritiekspoor staat daar duurzaam VOORDAT de handler draait; faalt die, dan 503 en geen mutatie.

Bewaakt door `test/auditspoor-atomair.pg.test.js` (echte server + echte PostgreSQL, een trigger die alleen de auditschrijf laat falen; en de PG-laag zelf, ook voor de economische boeking) en `test/auditatomair-sqlite.test.js` (een trigger op `audit_rij`).

## Een gebroken keten is een alarm, geen stille 409 (P1-2, P1-4)

- `server/lib/keten.js`: een regel zonder hash telt alleen als erfenis ONDER de oudste geketende regel; daarboven is hij een breuk, en een geketende regel die naar een hashloze voorganger verwijst ook (P1-2: wijzigen + `hash` weghalen gaf `ok: true`).
- De requestmerge (`server/pg/verzoeksporen.js`, `server/pg/spoorketen.js`) weigert een gebroken handelingLog of API-spoor met `PG_AUDIT_KETEN_GEBROKEN` in plaats van `PG_REQUEST_CONFLICT`. Het antwoord is 503 met `reden: 'auditspoor-gebroken'` en het journaal; de schrijfpoort blijft voor de rest open.
- `server/lib/auditwacht.js` loopt inzage-, inlog- en handelingsspoor, API-spoor en besluitjournaal na bij het opstarten en elke `RTG_AUDITWACHT_MINUTEN` (standaard 5), en hoort het van de requestmerge. Een breuk wordt het alarm `auditspoor-gebroken` (ernst hoog, `server/kern/command/alarm.js`), meteen gewogen en niet pas bij de volgende tik.

## Het externe anker (P1-3, P2-5)

- Het ankerblok wordt getekend met Ed25519 (`server/lib/ankerzegel.js`), met een sleutel die NIET in de database staat: `RTG_ANKER_SIGN_KEY`, of afgeleid uit het procesgeheim via HKDF met een eigen doel. Bij het terugrekenen telt alleen de eigen publieke sleutel.
- Het blok draagt nu ook het API-spoor en het besluitjournaal (`server/lib/ankerjournalen.js`), met het volgnummer uit de doorlopende teller.
- `server/lib/ankertimer.js` haalt elke ronde EERST het vorige blok terug en rekent ermee af; een afwijking of een anker dat niet te lezen is wordt een alarm, en dan gaat er geen nieuw blok weg.
- Een geankerde regel die verdween is alleen in orde als de bewaring het verklaart (journaal vol, of ouder dan de termijn) — `verifieerTegenAnker(regels, anker, bewaring)`.
- Publieke productie start niet zonder `RTG_ANKERPOST_URL` (`server/config/productie-anker.js`). `scripts/ankerontvanger.js` is een referentie-ontvanger (alleen bijschrijven, geen teruggang, een vastgepinde sleutel).

**Wat dit NIET is.** De echte bestemming — een andere machine met onveranderlijke opslag, onder ander beheer — staat buiten deze software; daarom blijft de control `AUDIT-KETEN-VERANKERD` op NIET IN BEDRIJF tot die er staat. Na een AVG-wissing in het API-spoor (die het venster herzegelt) rekent een ouder anker af als herschreven: dat is met opzet een alarm, en een mens zet daarna met de hand een nieuw anker.

## Herkomst van een regel (P2-7)

Handelingsspoor, command-journaal (dus ook het API-spoor) en inzagejournaal dragen `verzoek` (het correlatie-id van de server; in het inzagejournaal alleen waar de PostgreSQL-werkkopie het verzoek kent) en `release` (`RTG_RELEASE_COMMIT` of `release-bewijs.json`, `server/lib/releaseidentiteit.js`) — binnen de hash, en alleen wat bekend is.

## Open besluit (niet genomen, niet gebouwd)

Een PG-implementatie van `open()` (rijtabel, append-only, dezelfde `view/append/rewrite`) of bewust de lijstvorm houden en de bewaring uitschrijven. Tot dat besluit staat de stand in `test/auditopslag-pg.test.js` vast: wie de terugval verandert of `open()` voor postgres iets laat teruggeven zonder deze tekst bij te werken, laat die toets zakken.
