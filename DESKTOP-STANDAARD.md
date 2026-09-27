# Eén desktopstandaard

Alle zelfstandige RTG-appschermen, de publieke appwebsite, wereld- en paspagina’s, Explore en de bedrijfssite gebruiken dezelfde indeling. Vanaf 1000 px staan er een bovenrand, titelstrook, mensenkolom, centraal werkvlak, favorieten en een appbibliotheek. Op 1440 px zijn de buitenmarges 40 px, de zijkolommen 216 en 280 px en de tussenruimtes 24 px. De gedeelde Edge heeft vijf knoppen. Kleinere schermen houden hun bruikbare mobiele bediening.

LivingOS en Saloon gebruiken champagne/licht. WorkOS gebruikt grafiet met gedempt groen, TravelOS gedempt bordeaux en FoundationOS nachtblauw met zacht goud. Openbare platformpagina’s gebruiken neutraal onyx/goud. Foto’s, documenten en tekenvlakken behouden hun eigen inhoudskleuren.

`public/shared/rtg-world-palette.css` bezit de wereldkleuren. De gedeelde desktopbestanden bezitten de geometrie. `scripts/heritage-uitrol.js` bewaakt alle 292 zelfstandige appingangen; de 18 bestaande aliases verwijzen door en bevatten geen tweede scherm. Een ingesloten app deelt het buitenste kader. Het gedeelde speelscherm laadt geen persoonlijke widgets.

## Controle

`npm run desktop:controle` ontdekt routes uit de bron en controleert ze met een echte browser. Ontbrekende browser, verkeerd palet, oude layout, meerdere Edges, overloop of afwijkende kolommen laten de controle falen. `.github/workflows/desktop-standard.yml` draait die controle op elke PR en op main. `--browser`, `--routes`, `--site` en `--output` ondersteunen lokale controle en de afzonderlijke bedrijfssite.

Op 27 september 2026 zijn 303 ingangen, 36 bedrijfspagina’s en Explore gecontroleerd zonder afwijkingen. De functionele ronde omvat 32 browsertoetsen, waaronder Saloon, invoerbehoud, wereldwissels, mobiele bediening en Foundation-toegang. De account-/taalronde omvat 27 toetsen met alle 114 taalkeuzes; dat certificeert geen vertaalbetekenis in 114 talen. Een opzettelijk zwarte Living-achtergrond laat de kleurcontrole afgaan.

## Bedrijfssite

De bedrijfssite staat buiten deze apprepository. `scripts/company-desktop-build.js --source <bestaande-inhoud> --config <geverifieerde-workerconfig> --output <bouwmap>` bouwt alle pagina’s met exact dezelfde gedeelde bestanden. `DESKTOP-PROVENANCE.json` bevat de pagina-inventaris en SHA-256 per asset. Oude navigatiescripts en zelfstandige stylesheets worden niet meegenomen. De bestaande Worker, taalroutes, headers en redirects blijven behouden.

Lokale controles en een gemergede PR zijn geen bewijs dat beide live domeinen dezelfde versie serveren. Controleer na publicatie de bestanden, cacheversie en zichtbare pagina’s op de openbare domeinen.
