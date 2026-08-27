# Release-provenance

_Waar bestaat een RTG-release uit, en kun je nagaan dat wat er draait ook is wat er is gebouwd?_

`BEWIJSMACHINE.md` stelde vast dat dit huis daar niets voor had: geen SBOM, geen
build-attestatie, geen SLSA. Dit document beschrijft wat er sinds **27 augustus
2026** wél staat, en — even belangrijk — wat er nog niet staat.

## De materiaallijst

`npm run sbom` schrijft **`SBOM.json`**: wat er in een release zit, met per
onderdeel of het in de release terechtkomt of alleen bij het bouwen wordt
gebruikt.

**Dit is geen gewone SBOM, en dat komt door een eigenschap van dit project.**
Bij de meeste projecten is een materiaallijst een opsomming van honderden
npm-pakketten. Hier zijn het er **nul**: RTG heeft geen productie-afhankelijkheden,
en de norm bewaakt dat (`dependencies: 0` in `NORM.json`). Een lijst die alleen
npm telt zou hier dus bijna leeg zijn en daarmee een verkeerd beeld geven — alsof
er niets van buiten in zit.

Er zit wel iets van buiten in, en dat zijn de **basis-images en toolchains**:

| onderdeel | waar het vandaan komt |
|---|---|
| `node:22-slim` | de runtime waarin de server draait |
| `rust:1.97-slim` | bouwt de motor; komt niet in de runtime |
| `postgres:18-alpine` | de back-upsidecar |
| de crates uit `motor/Cargo.lock` | de Rust-motor |
| de eigen code | met een afdruk over alle bestanden die git kent |

Ze worden uit de `Dockerfile` en de lockfiles zelf gelezen, zodat de lijst niet
los kan gaan lopen van de bouw. `test/sbom.test.js` handhaaft dat.

## De afdruk over de eigen code

`eigenCode.afdruk` is een sha256 over **pad én inhoud** van elk bestand dat git
kent, in vaste volgorde. Het pad telt mee: een bestand verplaatsen is een andere
release, ook als de bytes gelijk zijn.

Dat de afdruk **reproduceerbaar** is, is de eigenschap waar alles op rust — een
afdruk die per ronde verschilt, kan de vraag "is dit dezelfde release" niet
beantwoorden. Ook dat staat in de toets.

## Het bouwstempel

Een materiaallijst is niets waard als je van een **draaiende** server niet kunt
vragen welke release het is. `GET /api/health` draagt daarom een blok `bouw`:

```json
"bouw": { "vastgelegd": true, "commit": "…", "bronAfdruk": "sha256:…", "gebouwdOp": "…" }
```

Die waarden komen van de **bouwer** en worden door `server/bouwstempel.js` alleen
doorgegeven. Dat is geen luiheid maar de kern: een proces dat zijn eigen afdruk
uitrekent, rekent hem uit over de bestanden die het op dat moment heeft — en dat
is precies de vraag niet. Het antwoord hoort van de bouwer te komen, niet van de
gebouwde. `test/sbom.test.js` bewaakt dat `bouwstempel.js` niets leest en niets
hasht.

Draait er geen release-image, dan staat er `vastgelegd: false` **met de reden**.
Geen leeg veld en geen gok — dezelfde regel als overal (`BESTUUR.md`).

Dezelfde drie waarden staan als OCI-labels op het image, zodat
`docker inspect` ze toont zonder dat je de app hoeft te starten.

## Herkomst bij het image

`.github/workflows/release-image.yml` bouwt met:

```
docker buildx build --push --provenance=mode=max --sbom=true …
```

BuildKit publiceert dan naast het image een **SLSA-provenance-attestatie** (welke
bron, welke bouwstappen, welke builder) en een **materiaallijst van het image
zelf**. Op te vragen met:

```
docker buildx imagetools inspect <image> --format '{{ json .Provenance }}'
```

De `SBOM.json` van de commit wordt daarnaast als artefact bij de run bewaard.

## Wat er nog NIET is

Dit hoort er even groot bij te staan, want half bewijs dat voor heel wordt
aangezien is erger dan geen bewijs.

- **Geen handtekening.** De provenance komt van BuildKit in onze eigen workflow.
  Er is geen door sigstore ondertekende attestatie op naam van GitHub, en dus
  geen manier voor een buitenstaander om te verifiëren zonder ons te vertrouwen.
  Dat vraagt een extra actie plus `id-token: write` — een besluit, geen
  vergetelheid.
- **Geen digest-pinning van de basis-images.** `node:22-slim` van vandaag is niet
  die van vorige maand. Vastzetten op een digest maakt de release
  reproduceerbaar en kost onderhoud (elke patch is een commit). De lijst zegt bij
  elk image dat het op een tag staat.
- **Geen kwetsbaarheidsscan.** Deze lijst zegt WAT erin zit, niet dat het veilig
  is. Dat is minder dan een keurmerk en precies wat een SBOM hoort te zijn.
~~- **Geen verificatie bij het uitrollen.**~~ **Die staat er sinds 27 augustus
2026:** `node scripts/uitrolproef.js <adres>` vraagt een draaiende server welke
build hij is en legt die naast de materiaallijst. Drie uitslagen met drie
afsluitcodes, zodat een pijplijn ze uit elkaar houdt zonder tekst te lezen:
**gelijk** (0), **anders** (1) en **niet vast te stellen** (2). Dat derde is
geen verlegenheid maar de regel van `BESTUUR.md`: onbekend is een eersteklas
uitslag naast in orde en storing, en een ontwikkelserver zonder bouwstempel is
niet verdacht.

  Een gelijke afdruk bewijst dat de **bronboom** byte voor byte die van de
  release is, pad inbegrepen. Hij bewijst **niet** dat het image verder
  ongewijzigd is: de basis-images staan op een tag, er draait een Rust-binary die
  niet in de som zit, en niets is ondertekend. Dat staat in de uitslag zelf, want
  een provenance-werktuig dat niet zegt wat het níét bewijst, wordt overschat.
