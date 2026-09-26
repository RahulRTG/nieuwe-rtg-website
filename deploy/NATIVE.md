# Native release op de bestaande Mac

De productiehost blijft de bestaande Mac (eigenaarsbesluit, 26 september 2026).
De Linux-imageketen blijft bestaan, maar mag niet als bewijs voor een native
Node-proces worden gebruikt. De drie trustrollen uit [TRUST.md](TRUST.md)
blijven gescheiden. De publieke identiteiten en hun secret stores staan in
`OWNER-CUSTODY.json`; dat bestand bevat geen privésleutels of releasegoedkeuring.

## Kandidaat maken en bewaren

`release-native.yml` bouwt op een macOS arm64-runner. Het exporteert één schone
Git-commit naar een tijdelijke map, bouwt frontend en Rust daar één keer en
neemt de gebruikte Node 26-binary mee. Er komen geen runtimecredentials in de
bouwomgeving. De uitvoer is `candidate.rtgp`: een begrensd bestandsmanifest met
de werkelijke bytes van de app, frontend, Rust en Node. Dit formaat accepteert
geen symlinks, hardlinks, traversal of ongekende extra bytes.

De inhoud wordt beproefd met de meegeleverde Node en een nieuwe, synthetische
SQLite-database: aanmelden, document maken, trash, retry, authorization denial,
stoppen, nieuwe login na procesherstart en restore. Directe databaseassertions
en controle van alle pakketbytes volgen na beide processen. De proef gebruikt
een geïsoleerde nonproductieconfiguratie. Hij bewijst geen provider, geldketen,
volledige regressie, productieconfiguratie of rollback naar een oudere versie.

Daarna tekent BUILD de archive-SHA-256, manifest-SHA-256, commit, build-ID en
hash van het runtimebewijs. De workflow bewaart deze exacte bestanden 90 dagen.
Er wordt na de proef niets aan het pakket herbouwd. Een lokale build zonder
bevoegde BUILD-signature blijft een diagnostische build.

```sh
node scripts/native-release.js build .release/native
node scripts/native-rehearsal.js .release/native/candidate.rtgp COMMIT .release/native/RUNTIME-PROOF.json
node scripts/native-release.js attest .release/native/candidate.rtgp .release/native/RUNTIME-PROOF.json
node scripts/native-release.js verify .release/native/candidate.rtgp COMMIT
node scripts/native-release.js stage .release/native/candidate.rtgp COMMIT /absolute/release-store
```

`attest` leest uitsluitend de BUILD-key uit zijn secret store. `verify` en
`stage` lezen de vaste publieke anchors uit de vertrouwde checkout, nooit uit
het aangeleverde pakket. `stage` controleert eerst de signature en alle bytes,
plaatst het pakket in een nieuwe directory met de archive-digest als naam en
controleert de geïnstalleerde bytes opnieuw. Herhaald stagen mag alleen als de
bestaande directory nog exact klopt. Stage wijzigt geen launchd-service of
actieve releaseverwijzing. Runtimegegevens en secrets horen buiten het pakket.

## Productievoorwaarden blijven gelden

Een succesvolle BUILD-signature is geen EVIDENCE-attestatie of PROMOTION.
De bestaande productiebeslissing vereist nog de volledige regressie, externe
providerbewijzen, geldcorrectheid en een bewezen rollback. De huidige
`productie-status`/`live-vrijgave`-keten verwacht OCI-imagebewijzen en is niet
automatisch geldig voor dit native pakket. Tot de native promotie-adapter en
alle vereiste bewijzen zijn afgerond, is native productiepromotie geblokkeerd.

De volgende proef moet kandidaat én vorige bekende goede native artifact
gebruiken, met blijvende synthetische data, schema-compatibiliteitscontrole,
smoke na rollback en opnieuw starten van exact de kandidaat. Een herstart van
dezelfde versie telt niet als deze rollback. De huidige productiecheckout is
nog geen ondertekend, onveranderlijk rollbackartifact.

Ook het huidige B2B2C-go-livebeleid vereist PostgreSQL, Redis en bewezen
geldrails. Een enkele Mac met SQLite en uitgeschakelde geldrails kan veilig
fail-closed draaien, maar voldoet daarmee niet automatisch aan dat beleid.
Deze keuze van host verwijdert geen van die eisen en verplaatst MONEY-012 niet.

De eerste installatie moet bovendien de bestaande Keychain-startwikkel,
launchd-configuratie, datamappen en losse `public/preview`-inhoud behouden en
eerst geïsoleerd beproeven. Geen installatiescript mag dit stilzwijgend vervangen.
