# AUDITBOEK — duurzame auditrijen in PostgreSQL met een anker buiten PostgreSQL

Garantie 3 van de releasefase (6 oktober 2026). Code: `server/kern/auditboek/`, bediening `scripts/auditboek.js`, tests `test/auditboek.pg.test.js`, `test/auditboek-cli.pg.test.js`, `test/kritiekspoor-auditboek.pg.test.js`. De PostgreSQL-stand van de twee oudere sporen staat in [AUDITOPSLAG.md](AUDITOPSLAG.md).

## Wat het is

Een gesloten lijst gebeurtenissen (`gebeurtenissen.js`) wordt als rij in `auditboek` vastgelegd, geketend met een volledige SHA-256 (domeinprefix `RTG:AUDITBOEK:v1`), met per rij een volgnummer, tijd, actor en een canonieke JSON-regel. Periodiek tekent een aparte ankerdienst met een Ed25519-sleutel die NIET in de database of de app staat een anker (kop-nummer + kop-hash + vorig anker) en zet dat in minstens twee write-once bestemmingen buiten PostgreSQL (map met bestanden `0444`, of https-sink). De verificatie legt de keten naast de ankers.

## De gebeurtenissen (security, beheer, release, promotie, rollback)

Een gesloten catalogus; wat er niet staat kan het boek niet in. Elke waarde heeft een TYPE met een vorm (digest, commit, pad zonder querystring, reden-code); een waarde die niet past wordt geweigerd, niet geschoond. Er is geen vrij tekstveld, dus een wachtwoord, token, e-mailadres of PEM-sleutel past nergens.

| Categorie | Type | Wordt vandaag geschreven door |
|---|---|---|
| security | `kritiek.toegestaan` | `opzet/kritiekspoor.js` (PostgreSQL-modus, vóór de handeling, 503 bij falen) |
| security | `kritiek.geweigerd`, `bezitsbewijs.geweigerd`, `sessie.ingetrokken`, `inzage.kluis` | **niemand** — gecatalogiseerd, schrijvers niet aangesloten |
| beheer | `auditboek.init`, `auditboek.verificatie`, `auditboek.retentie` | `scripts/auditboek.js` en `bewaring.js` |
| beheer | `beheer.rol.gewijzigd`, `beheer.sleutel.gewisseld`, `beheer.config.gewijzigd` | **niemand** — gecatalogiseerd, schrijvers niet aangesloten |
| release | `release.kandidaat.gebouwd`, `release.kandidaat.getest`, `release.gate` | `scripts/artefactketen.js` (bij `promoveer --auditboek` uit de ondertekende keten); `release.gate` niemand |
| promotie | `promotie.aangevraagd`, `promotie.geweigerd`, `promotie.uitgevoerd` | `scripts/artefactketen.js promoveer`, `noteer-uitgevoerd` (door `live.sh deploy`) |
| rollback | `rollback.aangevraagd`, `rollback.geweigerd`, `rollback.uitgevoerd` | `scripts/artefactketen.js terugdraai`, `noteer-uitgevoerd` (door `live.sh rollback`) |

De actor komt uit de sessie of de CI-run, nooit uit het verzoek; een sleutel die geen codenaam/rol/run-id is wordt gepseudonimiseerd (`h:` + SHA-256-prefix).

## Garanties en hoe ze zijn bewezen

| Eis | Mechanisme | Bewijs |
|---|---|---|
| Duurzaam | één transactie per regel, `synchronous_commit=on`, terugkeer pas na COMMIT; falen = `AUDIT_NIET_VASTGELEGD` | `auditboek.pg` 12 (PG weg), `kritiekspoor-auditboek.pg` 4 (503) |
| Geen UPDATE/DELETE/TRUNCATE door de app | triggers op alle vier tabellen | `auditboek.pg` 4 |
| Herschrijven + keten opnieuw uitrekenen door een beheerder | het anker kent de oorspronkelijke kop-hash: `herschreven` | `auditboek.pg` 5 |
| Kop afknippen | `ingekort` t.o.v. het anker | `auditboek.pg` 6 |
| Regel schrappen / kolom wijzigen | `ketenGebroken` / `kolommenAfwijkend` | `auditboek.pg` 7 |
| Vals anker | Ed25519 + vaste publieke sleutel + boek-id | `auditboek.pg` 8 |
| Anker kwijt in één sink / alle sinks | `sinkAchterstand` (herstel via `gelijkTrekken`) / `ankerVerdwenen` | `auditboek.pg` 9, 10 |
| Sink onbereikbaar | `niet-vast-te-stellen`, nooit groen; schrijven werkt door; `minSinks` bewaakt ankeren | `auditboek.pg` 11, `auditboek-cli.pg` |
| Retentie | 730 dagen, alleen na strikte verificatie + een anker dat ouder is dan de termijn de regels dekt + checkpoint + retentieregel in één transactie | `auditboek.pg` 14, 15, 16 |
| Geen geheimen | gesloten catalogus met vormen | `auditboek.pg` 3 |
| Productie zonder extern anker | start weigert (`config/productie-auditboek.js`) | `auditboek-cli.pg` (productiekeuring) |

## Falen en herstel

- **PostgreSQL weg**: er komt geen regel; de kritieke handeling en elke releasestap stoppen. Herstel: database terug; er is niets "later" in te halen en dat is de bedoeling.
- **Sink weg**: schrijven loopt door; verificatie zegt `niet vast te stellen` (exit 2); ankeren vereist `minSinks` ontvangers. Zodra de sink terug is trekt het volgende anker hem gelijk.
- **Anker vervalst of verdwenen**: fatale bevinding (exit 1).
- **Kapotte keten**: fatale bevinding; bewaring weigert op een boek dat niet strikt verifieert, zodat bewijs van manipulatie niet kan worden weggesnoeid.

## Wat het NIET bewijst (grenzen)

- Een superuser of eigenaar van de tabellen kan triggers uitzetten. De triggers beschermen tegen applicatiefouten, niet tegen de beheerder; tegen de beheerder helpt alleen het externe anker, en dat detecteert achteraf, het voorkomt niet.
- Tussen twee ankers is er een venster: regels na het laatste anker zijn pas na het volgende anker tegen herschrijving door een beheerder beschermd. `noteerEnAnker` (release-, promotie- en rollbackstappen) sluit dat venster per stap; gewone kritieke regels hebben het venster van de ankerdienst (standaard 15 min, maximale leeftijd 6 uur).
- Een anker dat in dezelfde vertrouwensgrens staat als de database is geen anker. De sinks moeten echt elders staan (andere host, ander account); dat controleert de code niet.
- Dat de ankerdienst DRAAIT en dat de sleutel en de sinks bestaan, is een actie van de eigenaar. Zonder `deploy/audit-anker.pub` en twee sinks weigert productie op PostgreSQL te starten; zonder draaiende dienst slaat verificatie op `ankerVerouderd` aan.
- De schrijvers voor de gecatalogiseerde-maar-niet-aangesloten gebeurtenissen (zie tabel) ontbreken.
