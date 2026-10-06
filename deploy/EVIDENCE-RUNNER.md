# Externe meetrunner: trustcontract v2

De meetrunner heeft een eigen bevoegdheid. De latere ondertekening van het
externe dossier vervangt zijn handtekening niet.

## Een runneranker vastzetten

1. Genereer de Ed25519-private key rechtstreeks in de runner-secretstore.
2. Verifieer de publieke fingerprint via een onafhankelijk kanaal.
3. Commit uitsluitend de publieke SPKI-PEM als
   `deploy/evidence-runner-v1.pub`.
4. Zet op de releasehost `RTG_EVIDENCE_RUNNER_TRUST_VERSION=v1`.

`RTG_EVIDENCE_RUNNER_PUBLIC_KEY_FILE` wordt geweigerd. Een willekeurig
runtimepad zou een gecompromitteerde host immers zijn eigen vertrouwde runner
laten aanwijzen. Rotatie maakt een nieuwe versie (`v2`, `v3`, ...), een nieuwe
commit en nieuwe releasebewijzen; een bestaand anker wordt niet overschreven.

## Ondertekend antwoord

Een antwoord gebruikt `rtg-external-measurement-v2` en bevat verplicht dezelfde
`runnerTrustVersion` als het verzoek. De ondertekende bytes zijn:

```text
UTF8("RTG:EXTERNAL-MEASUREMENT:v2") || 0x00 || UTF8(canonical_json(response_without_signature))
```

Canonical JSON sorteert objectsleutels recursief; arrayvolgorde blijft
betekenisvol. De Ed25519-signature is standaard base64. De releasehost
controleert haar direct. Later controleert de releaseverifier haar opnieuw met
hetzelfde gecommitte versieanker, nadat het dossier door de onafhankelijke
evidence-signer is ondertekend. Daardoor kan die dossier-signer geen
runnerwaarneming wijzigen of vervangen.

## Provideritemmanifest v1

`webhookDelivery` en `reconciliation` berekenen onafhankelijk dezelfde digest
over exact de provideritems van de geautoriseerde geldketen. De canonieke vorm
is:

```json
{
  "format": "rtg-provider-items-v1",
  "chainIdSha256": "<sha256>",
  "provider": "<provider-id>",
  "items": [
    {
      "kind": "<payment|payout|refund|event|statement>",
      "providerRefSha256": "<sha256>",
      "amountMinor": 100,
      "currency": "eur",
      "finalStatus": "settled"
    }
  ]
}
```

De `items` worden eerst uniek en oplopend gesorteerd op
`kind + "\\0" + providerRefSha256`. Een veld dat voor een item niet bestaat is
afwezig, niet `null`. De digest is SHA-256 over UTF-8 canonical JSON. Beide
metingen leveren vervolgens:

```text
providerItemManifestVersion = rtg-provider-items-v1
providerItemManifestSha256  = <digest>
providerItemManifestItems   = <items.length>
```

Reconciliatie moet bovendien exact hetzelfde aantal `providerItems` hebben.
Een verschillende digest, versie of telling maakt het volledige live-gelddossier
ongeldig, ook wanneer beide losse proeven `PASS` zeggen.

## Image-scanbinding

De image-scanner leest vast `.release/herkomst.json`, verifieert daarin de
BUILD-handtekening met `deploy/release-sleutel.pub` en vergelijkt commit,
runtime-inhoudshash en image-digest vóór het scannen. Het scanverslag bevat de
getekende kandidaatherkomst plus haar canonieke hash. De releaseverifier
controleert deze BUILD-handtekening later opnieuw. Een evidence-signer kan dus
geen schone scan van image A aan releasekandidaat B hangen.
