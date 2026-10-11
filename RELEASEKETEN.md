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

## Artefactketen: exacte bytes, promotie en rollback op digest (6 oktober 2026)

Nieuw bovenop de tabel hierboven: `scripts/lib/artefactketen.js` (CLI `scripts/artefactketen.js`) houdt `.release/artefactketen.json` bij als ondertekende, geketende records. Een artefact IS zijn digest; een tag, branch of commit noemt er geen, en een herbouw van dezelfde commit is een ander artefact.

| Stap | Record (rol) | Wat het afdwingt |
|---|---|---|
| bouwen | `gebouwd` (BUILD) | commit + run + digest + image-id van image en backup |
| testen | `getest` (BUILD) | `release-image.yml` haalt het image BIJ DIGEST op, leest het waargenomen digest terug en draait de controles in dat image; een ander waargenomen digest kan geen `geslaagd:true` dragen |
| promoveren | `gepromoveerd` (PROMOTION) | alleen een digest met geslaagd testrecord voor exact dezelfde bytes (digest én image-id) |
| deploy | poort in `live-vrijgave.js` + `productie-promotie.js` | het kandidaat moet het ACTIEVE, ondertekende promotiebesluit zijn; `live.sh` bouwt nooit (`--no-build`; de wacht bewaakt dat) |
| terugdraaien | `terugdraai` (PROMOTION) | alleen naar een digest dat al eerder in die omgeving goedgekeurd was, vanaf het actieve digest, benoemd als `sha256:…`; `live.sh rollback sha256:…` eist het lokale image-id uit het besluit |

Fail-closed: een ontbrekende, beschadigde, gemanipuleerde of niet te verifiëren keten laat elke poort weigeren; `voegToe` schrijft pas na volledige controle van de nieuwe keten. Bewijs: `test/artefactketen.test.js` (negatieve en aanvalstoetsen) en `test/releaseketenwacht.test.js` (mutaties van workflow en promotiepad).

## Wat NIET bewezen is (met reden)

1. **Een echte CI-run.** De nieuwe stappen in `release-image.yml` zijn in deze omgeving niet uitgevoerd: er is geen Docker-daemon. De digest-test is bewezen tegen een nep-`docker`; dat het echt werkt met GHCR is niet bewezen. Eerste echte run is de proef.
2. **De volledige unitsuite op de image-bytes.** `afbouw:software` draait nog op de werkboom. Wat in het image draait is `release-bewijs --controle` plus `test/artefact-image.test.js` (commit, vertrouwenslaag, auditboek laden). Het image bevat de testmap niet.
3. **Backup-image op inhoud.** Het backup-image (postgres, zonder node) wordt op identiteit getoetst (pull bij digest, waargenomen digest), niet op gedrag.
4. **Native artefacten.** `eisKetenbesluit` geldt voor het OCI-pad; het native pad (`rtg-native-promotie-v1`) gaat er niet doorheen.
5. **Het venster vóór de eerste keten.** Een draaiend image dat nooit door de keten ging, wordt door `live.sh deploy` niet overschreven (exit 65). De eerste adoptie vereist dus een bewuste handeling van de eigenaar; er is geen bypass ingebouwd.
6. **Release-gate zelf.** `npm run release:gate` duurt langer dan 100 s in `Codecredentialregister`; een afgebroken run is niet "rood", maar ook niet groen. RELEASEKANDIDAAT.md noemt daarnaast de afbouwslot-blokkade (A1).
7. **Uitgevoerd-regels staan ná de wissel.** `live.sh` schrijft `promotie.uitgevoerd` / `rollback.uitgevoerd` ná een geslaagde wissel; faalt het boek dan, dan eindigt het script met exit 70 maar wordt de wissel niet teruggedraaid. De regel `aangevraagd` (vóór de handeling, verankerd) is de fail-closed kant.

## Grens

Deze wacht is een bewijs dat de schakels in het workflow STAAN, niet dat ze werken. Een groene wacht is geen releasebesluit.
