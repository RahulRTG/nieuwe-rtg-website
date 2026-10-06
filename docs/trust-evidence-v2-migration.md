# Trust & Evidence V2: expliciete legacy-migratie

De huidige evidence-ledger bewaart alleen digests en beperkte, niet-vrije
metadata. Een oudere installatie kan in `trustEvidence.blobs` nog de volledige
`content` en vrije metadata bevatten. De runtime herschrijft die records nooit
stil tijdens het starten: hij stopt met
`LEGACY_RAW_EVIDENCE_REQUIRES_MIGRATION`.

De migratie is een bewuste offline handeling. **`--offline` is uitsluitend de
verklaring van de operator; de vlag bewijst niet dat processen, replicas of
verkeer werkelijk gestopt zijn.** De CLI bouwt bewust geen schijnzekerheid met
een lokale lockfile: zo'n bestand kan andere hosts niet zien. Een nog draaiende
instance kan na de commit zijn oude RAM-kopie terugschrijven.

Runbook:

1. haal verkeer weg en stop alle RTG-applicatieprocessen, workers, timers en
   replicas die de datastore kunnen schrijven;
2. controleer in de echte orchestrator/procesmanager én aan de verkeerslaag dat
   er nul app-instances, nul actieve schrijvers en nul gebruikersverkeer zijn;
3. maak en controleer de gewone volledige databaseback-up;
4. kies een aparte archiefmap buiten `RTG_DATA_DIR`, op een opslagmedium met
   operationele back-up en retentie;
5. zet dezelfde `RTG_ENC_KEY`, datastoreconfiguratie en database-URL als de
   installatie;
6. voer de migratie uit;
7. cold-start één geïsoleerde, verse instance vanaf de autoritatieve datastore,
   met gebruikersverkeer nog geblokkeerd; controleer dat startup, readiness en
   de evidence-ledger zonder legacy-fout openen en stop die instance weer;
8. verifieer opnieuw nul verkeer en nul schrijvers, voer exact hetzelfde
   commando nogmaals uit en eis `changed: false` én `archiveVerified: true`;
   dit herverifieert de receipt en het geauthenticeerde archief ná de cold-start;
9. cold-start daarna de definitieve replicas, herstel het verkeer en bewaar de
   JSON-receipt bij het operationele wijzigingsbewijs.

```sh
export RTG_EVIDENCE_ARCHIVE_DIR=/srv/rtg-evidence-archive
npm run trust:evidence:migrate-v2 -- \
  --execute \
  --offline \
  --confirm=ARCHIVE-AND-MIGRATE-LEGACY-TRUST-EVIDENCE
```

De archiefmap moet een absoluut, genormaliseerd pad zijn, mag geen symbolische
links bevatten, moet eigendom zijn van de uitvoerende gebruiker en moet mode
`0700` hebben. De migratie weigert een archiefpad dat gelijk is aan, onder of
boven de primaire datamap. Het archiefbestand wordt met de bestaande
`RTG_ENC_KEY` als `RTGENC2` AES-256-GCM versleuteld en aan zijn bestandsnaam
gebonden. Het wordt na schrijven opnieuw ontsleuteld en inhoudelijk
geverifieerd vóór de databasemutatie.

De primaire wijziging loopt via één `bewerkCollectie('trustEvidence', ...)`:
SQLite gebruikt `BEGIN IMMEDIATE … COMMIT`, PostgreSQL een advisory lock,
`SELECT … FOR UPDATE` en `BEGIN … COMMIT`. Een gewijzigd bronrecord maakt het
plan stale en laat de volledige mutatie falen. Een crash na het archief maar
vóór de commit is veilig opnieuw uit te voeren: de archiefnaam is
content-addressed en een bestaand bestand moet eerst opnieuw authentiseren.

De receipt bevat alleen digests, aantallen, een vaste archiefnaam en
migratie-identifiers. Hij bevat geen domeinpayload, evidence-identifiers of
absoluut archiefpad. De CLI logt die gegevens evenmin.

Een herhaalde CLI-run na een voltooide migratie leest het in de receipt genoemde
archief opnieuw, controleert bestandsnaam, authenticatie, plaintextdigest en
cipherdigest en rapporteert alleen dan `archiveVerified: true`. Een ontbrekend
of gewijzigd archief is dus geen groene no-op.

## Belangrijke grens

Mode `0400` en een hash maken een lokaal bestand niet WORM, immutable of
off-site. Een beheerder met voldoende rechten kan het nog verwijderen. Echte
onveranderlijke retentie, een tweede locatie en sleutelherstel zijn afzonderlijke
operationele release-eisen. Verwijder het legacy-archief niet enkel omdat de
primaire database weer start; volg het vastgestelde bewijs- en bewaarbeleid.
