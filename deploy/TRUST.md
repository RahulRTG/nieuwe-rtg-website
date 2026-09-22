# Release-trust v1: drie bevoegdheden

Deze policy vervangt de gedeelde build-/evidence-sleutel. De migratie maakt
geen echte sleutels aan en verleent niemand automatisch releasebevoegdheid.

| Rol | Private secret | Publiek verificatieanker | Signature-domein |
|---|---|---|---|
| Build | `RTG_RELEASE_SIGN_KEY` | `deploy/release-sleutel.pub` | `RTG:BUILD:v1` |
| Externe beoordeling | `RTG_EVIDENCE_SIGN_KEY` | `deploy/evidence-sleutel.pub` | `RTG:EXTERNAL-EVIDENCE:v1` |
| Promotie | `RTG_PROMOTION_SIGN_KEY` | `deploy/promotie-sleutel.pub` | `RTG:PROMOTION:v1` |

Alle drie publieke Ed25519-ankers moeten aanwezig zijn. Vergelijking van de
DER-gecodeerde publieke sleutels voorkomt dat verschillende PEM-weergaven
het hergebruik van één sleutel verhullen. Het document kan zijn eigen
verificatiesleutel niet aanleveren. Signers controleren vóór ondertekening dat
hun private key bij hun eigen vaste rolanker hoort.

## Signaturecontract

De getekende bytes zijn `UTF8(domein) || 0x00 || payload`. Buildherkomst gebruikt
de bestaande canonieke JSON-payload zonder `handtekening`; externe dossiers en
promotiebesluiten gebruiken de exacte documentbytes. Elk document bevat ook
het verplichte veld `ondertekenDomein`; het moet bij de verwachte rol passen.

Nieuwe formaten zijn `rtg-herkomst-v2`, `rtg-external-release-v3` en
`rtg-productie-promotie-v2`. Oude formaten en oude signatures zonder domein
worden geweigerd. Alleen een versielabel wijzigen helpt niet: de signature
bindt de oorspronkelijke bytes én het domein. Een build-private-key kan
wiskundig willekeurige bytes tekenen, maar levert geen geldig promotiebesluit
op: de promotieverifier gebruikt uitsluitend het afzonderlijke promotieanker.

## Eenmalige bevoegde bootstrap

1. De eigenaar wijst custodians aan voor build, onafhankelijke externe
   beoordeling en menselijke promotie. Leg hun bevoegdheden en de drie
   publieke fingerprints in het bevoegde wijzigingsbesluit vast.
2. Laat drie verschillende Ed25519-sleutelparen rechtstreeks in hun
   toegewezen secret stores genereren/importeren. Exporteer private keys niet
   naar Git, een outputdirectory, chat, terminal, screenshots of auditlogs.
3. Commit uitsluitend de drie publieke SPKI-PEM-bestanden op de kandidaatbranch.
   Elke wijziging aan een trustanker levert een nieuwe kandidaatcommit op.
4. Stel alleen `RTG_RELEASE_SIGN_KEY` als GitHub Actions-buildsecret in.
   De evidencekey blijft bij de externe beoordelaar in een aparte beschermde
   omgeving; de promotionkey uitsluitend bij de menselijke release-authority.
   De imageworkflow ontvangt geen evidence- of promotionsecret.
5. Draai de build-sleutelcontrole en bouw één exact imagepaar. Externe
   attestatie en promotie blijven afzonderlijke latere besluiten; een
   geslaagde bootstrap maakt de release niet READY.

De oude CLI-optie `--nieuwe-sleutel` faalt bewust zonder sleutelmateriaal af te
drukken. Er is geen tijdelijke productie-testsleutel of impliciete fallback.

## Migratie, rotatie en herstel

Inventariseer bestaande statements voordat deze kandidaat wordt gebruikt.
Bewaar oude artifacts, publieke ankers en bewijzen als historisch dossier;
presenteer ze niet als bewijs voor de nieuwe kandidaat. Laat externe dossiers
opnieuw beoordelen en ondertekenen voor de nieuwe commit. Buildherkomst moet
bij exact de nieuwe imagebytes horen; promotie volgt pas na de volledige
releasebeslissing. Er is geen automatische acceptatie van legacy signatures.

Rotatie of intrekking vervangt het betreffende publieke anker in een nieuwe
kandidaat. De verifier accepteert daarna de oude signer niet meer. Alle
statements worden opnieuw aan de kandidaat gebonden; privésleutelherstel mag
nooit een ingetrokken identiteit stilzwijgend opnieuw bevoegd maken. Bewaar
oude secrets volgens het beleid van de secret store; kopieer ze niet naar de
repository als herstelmechanisme.

Repetities gebruiken uitsluitend geïsoleerde synthetische testidentiteiten.
Ze bewijzen domein-/rolgrenzen, niet de bevoegdheid van een echte beoordelaar,
het gedrag van een provider of productiegeschiktheid van een image.
