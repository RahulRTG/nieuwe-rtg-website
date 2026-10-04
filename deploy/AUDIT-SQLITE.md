# SQLite auditrijen en terugkeer naar een oudere release

`handelingLog` en `apiSpoor.commandJournaal` worden bij openen atomair uit `kv`
naar `audit_rij` en `audit_meta` overgezet. Rijvolgorde, bestaande hashes,
hashloze historie, metadata en de totale API-teller blijven behouden. Rijen en
metadata gebruiken dezelfde bestaande opslagversleuteling. Nieuwe regels worden
op de actuele SQL-kop berekend binnen dezelfde schrijftransactie. Alleen de
gecommitteerde leesprojectie wordt gedeeld; een open bundel heeft een eigen preview.
KV en beide journalen worden bij laden en synchroniseren uit één SQL-snapshot
gelezen. Een standby-proces voert geen datamigratie uit.

De generieke save serialiseert deze beheerde projecties niet. Expliciete
vervangingen blijven mogelijk voor retentie en import; een vervanging vanaf een
achterhaalde versie wordt geweigerd. Privacywissing herschrijft de keten en voegt
de bestaande verklaarregel toe binnen één transactie. Dit is geen bewijs van
forensische verwijdering uit backups of oude SQLite-pagina's.

## Uitrol en rollback

Stop vóór de eerste start van deze release alle oude schrijvende processen.
Er is geen ondersteunde rolling deploy met een oude KV-schrijver naast een nieuwe
rijschrijver. SQL-triggers weigeren een oude schrijver die de beheerde audits
als KV probeert te overschrijven. Dat vervangt het stoppen van die processen niet.

Een vorige release kent de rijtabellen niet. Start haar daarom pas nadat:

1. Alle kandidaatprocessen en andere schrijvers gestopt zijn.
2. Een consistente backup is vastgelegd.
3. De **kandidaatversie** van dit commando is uitgevoerd met dezelfde bestaande
   `RTG_ENC_KEY` uit de secret store, zonder die sleutel te loggen:

   `node scripts/audit-sqlite-rollback.js --writers-stopped /pad/naar/store.db`

4. De uitvoer `status: PASS` meldt en daarna het oude artifact wordt gestart.
5. De releaseprocedure de artifactidentiteit, health en veilige auditreads bewijst.

Het commando materialiseert de auditrijen in één SQLite-transactie terug naar KV,
verwijdert daarna de rijtabellen en checkpoints de WAL. Bij een fout blijft het
oude schema intact. Het commando bestuurt geen services; `--writers-stopped` is
een expliciete operationele voorwaarde, geen automatische procesdetectie.

Een latere start van de nieuwe release importeert de actuele KV opnieuw, inclusief
wijzigingen die de oude release na rollback heeft gemaakt. De gerichte tests
bewijzen deze opslagovergang met een onafhankelijke oude KV-reader. Zij vervangen
niet de artifactgebonden native rollbackrehearsal van de release.

## Gerichte verificatie

`node --test test/sqlite-audit-rijen.test.js test/sqlite-audit-herstel.test.js test/sqlite-audit-snapshot.test.js test/sqlite-audit-selectief.test.js`

Deze proeven gebruiken uitsluitend tijdelijke synthetische SQLite-databases.
Crashinjectie raakt alleen het eigen testkindproces. De prestatiegrenzen blijven
144 ms p99 en 64,8 ms event-loop-p99; alleen de geïsoleerde CI-stormmeting mag
vaststellen of deze optimalisatie die grenzen op de kandidaat haalt.
