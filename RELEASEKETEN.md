# RELEASEKETEN — voorstel bij audit A-P0-01

Dit is een VOORSTEL en geen uitrol. Het bewaakt wat er al staat en benoemt wat ontbreekt.

## De keten uit de audit

exacte commit → onveranderlijk artefact/digest → volledige tests op die bytes → herstel/rollback → handtekeningen en bewijs → promoveer alleen dat digest.

## Wat er staat (bewaakt door `npm run releaseketenwacht`)

| Schakel | Waar | Wacht |
|---|---|---|
| exacte commit | `RTG_RELEASE_COMMIT` build-arg in `release-image.yml` | ja |
| onveranderlijke tag | `candidate-<sha12>-<run>` | ja |
| volledige tests | `npm run afbouw:software` vóór publicatie | ja |
| digest-binding | `imageherkomst.js --binden --digest=` | ja |
| digest-controle | `--controle --eis-kandidaat` | ja |
| stuklijst | `--sbom` uit het gepubliceerde image | ja |
| ondertekening vooraf | `--sleutelcontrole` vóór `docker push` | ja |

De wacht leest alleen het workflowbestand. Hij bouwt, publiceert en promoveert niets, en weigert een workflow dat `:latest` pusht of uitrolt (kubectl, ssh, compose up).

## Wat NIET bewezen is (met reden)

1. **Tests op precies deze bytes.** `afbouw:software` draait op de werkboom; de gepubliceerde image wordt daarna gebouwd. Dat dezelfde bytes getest zijn is niet bewezen. Besluit nodig: de tests tegen het gepubliceerde digest laten draaien (kost een tweede job met `docker run` op het digest).
2. **Herstel/rollback op dezelfde bytes.** De rollbackrepetitie staat in RELEASEKANDIDAAT.md als open blokkade, niet in een workflow.
3. **Promotie van alleen dit digest.** Er is geen promotiestap; het workflow zegt met opzet dat het geen officiële release publiceert. Besluit nodig: wie promoveert, en met welk bewijs (READY-uitspraak op hetzelfde digest).
4. **Release-gate zelf.** `npm run release:gate` duurt langer dan 100 s in `Codecredentialregister`; een afgebroken run is niet "rood", maar ook niet groen. RELEASEKANDIDAAT.md noemt daarnaast de afbouwslot-blokkade (A1).

## Grens

Deze wacht is een bewijs dat de schakels in het workflow STAAN, niet dat ze werken. Een groene wacht is geen releasebesluit.
