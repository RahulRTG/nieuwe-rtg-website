# Trust & Evidence runtime-export

Dit pad maakt een versleutelde, geverifieerde momentopname van de volledige
`trustEvidence`-collectie. Het leest de autoritatieve JSON-, SQLite- of
PostgreSQL-bron rechtstreeks en uitsluitend read-only. Het start de applicatie,
seed, schema-initialisatie, synchronisatie en schrijfpaden niet.

De export is een retentievoorwaarde, niet de retentieoplossing zelf:

- productie-evidence wordt nooit gewijzigd, verwijderd of gepruned;
- capaciteit komt door export niet vrij;
- een lokaal bestand met `0400` is geen WORM-, offsite- of immutability-bewijs;
- een export maakt een claim zonder opnieuw verifieerbare domeinbron niet
  alsnog `VERIFIED`;
- import/pruning is bewust niet aanwezig zolang claim-resolvers gearchiveerde
  bronnen niet veilig en aantoonbaar kunnen herverifiëren.

## Wat wordt gemaakt

In een afzonderlijke map met modus `0700` ontstaan twee bestanden:

1. `<content-address>.rtge`: de exacte collectie, met de bestaande RTG
   bestandsnaamgebonden AES-GCM-primitive (`RTGENC2`) versleuteld;
2. `<content-address>.receipt.json`: een niet-gevoelige receipt met digests,
   bronrevisie, tellingen en capaciteitsstatus.

Het artefact wordt na schrijven opnieuw ontsleuteld, inhoudelijk gehasht en aan
de receipt gebonden voordat de CLI succes meldt. Bij een crash tussen artefact
en receipt verifieert een herhaling het bestaande artefact en maakt daarna pas
de ontbrekende receipt. Een bestaand bestand wordt nooit overschreven.

De receipt zegt expliciet:

```text
productionMutated: false
pruned: false
capacityFreed: false
retention.worm: false
retention.offsite: false
```

De versleutelde export is zeer gevoelig. De collectie kan naast digest-only
evidence ook nog domeinpayload in de transactionele outbox bevatten. Inhoud,
evidence-ID's en absolute paden komen daarom nooit in CLI-output of de receipt.

## Voorwaarden

- `RTG_ENC_KEY` is gezet en komt uit dezelfde beheerde sleutelset als de bron;
- `RTG_EVIDENCE_EXPORT_DIR` is een absoluut, genormaliseerd pad;
- de exportmap ligt buiten `RTG_DATA_DIR`, is van de huidige proceseigenaar en
  heeft modus `0700`;
- legacy V2-records met raw payload zijn al via
  `npm run trust:evidence:migrate-v2` gemigreerd. De export weigert ze anders;
- bewaar sleutel en export niet op hetzelfde medium.

## Export uitvoeren

De machineleesbare actuele watermerk-/debtstatus kan zonder archiefschrijfactie
worden gelezen:

```sh
npm run trust:evidence:export -- --status
```

Deze handeling leest dezelfde autoritatieve bron uitsluitend read-only en toont
geen inhoud of identifiers. Neem haar op in operationele bewaking en plan de
daadwerkelijke export ruim vóór `WARNING`.

```sh
RTG_EVIDENCE_EXPORT_DIR=/beheerd/pad/evidence-export \
npm run trust:evidence:export -- \
  --execute \
  --confirm=EXPORT-RUNTIME-TRUST-EVIDENCE
```

De leesoperatie gebruikt één collectionele momentopname. Schrijfacties die ná
dat leesmoment plaatsvinden horen bij een volgende export. `--execute` is een
expliciete operatorhandeling; het is geen verklaring dat verkeer of replicas
zijn gestopt, en voor deze read-only export is geen schijn-lockfile aanwezig.

Een bestaande export opnieuw verifiëren:

```sh
RTG_EVIDENCE_EXPORT_DIR=/beheerd/pad/evidence-export \
npm run trust:evidence:export -- \
  --verify=runtime_evidence_<64-hex-tekens>
```

Verificatie controleert bestandstype, links, rechten, naamgebonden authenticatie,
state-digest, capacity-profiel, content-address en receipt-digest. Een verkeerde
sleutel, andere bestandsnaam, hardlink, symlink of gewijzigde byte faalt gesloten.

## Capaciteitswatermerken

De receipt bevat voor V2-records/V2-evidence en alle V3-collecties:

| Benutting | Status | Operationele betekenis |
|---|---|---|
| `< 80%` | `OK` | normale periodieke export |
| `>= 80%` | `WARNING` | export verifiëren en retentie/pruning plannen |
| `>= 95%` | `CRITICAL` | onmiddellijk operationeel ingrijpen |
| `>= 100%` | `BLOCKED` | bestaande runtime hard-stop weigert nieuwe evidence |

Vanaf `WARNING` ontstaat machineleesbare
`EVIDENCE_RETENTION_CAPACITY_DEBT`. Die debt heeft altijd
`resolvedByExport:false`: een kopie maken is niet hetzelfde als veilige
retentie plus een bewezen lees-/herstelpad.

Plan de operationele export vóór 80%. Bewaar daarna artefact én receipt via een
afzonderlijk, domain-owned retentieproces met onafhankelijke toegang, offsite
kopie, bewaartermijn en periodieke herstelproef. Leg pas `WORM` of `offsite` vast
wanneer die externe eigenschappen werkelijk door dat systeem worden bewezen.

## Wat nog niet bewezen wordt

Deze voorziening sluit het ontbreken van een normaal exportpad en vroege
capaciteitswaarschuwing. Zij bewijst nog niet dat de oorspronkelijke inhoud
achter iedere V2/V3-digest via een domain-owned locator opnieuw opvraagbaar is.
Totdat zo'n bronbinding door contract én resolver wordt afgedwongen, hoort
ontbrekende bronretentie expliciete evidence debt/`UNKNOWN` te blijven en nooit
door het bestaan van deze runtime-export naar `VERIFIED` te promoveren.
