# Eén standaard voor desktop en mobiel

Alle zelfstandige RTG-appschermen, de publieke appwebsite, wereld- en paspagina’s, Explore en de bedrijfssite delen vormgeving en Edge-bediening. Vanaf 1000 px staan er een bovenrand, titelstrook, mensenkolom, centraal werkvlak, favorieten en een appbibliotheek. Op 1440 px zijn de buitenmarges 24 px, de zijkolommen 216 en 280 px en de tussenruimtes 20 px. De gedeelde Edge heeft vijf knoppen.

Onder 1000 px krijgt een app één inhoudsoppervlak: de eigen pagina, met dezelfde Edge. De desktop-titel, tabrij, zijpanelen, sfeerlaag en appbibliotheek worden niet om de mobiele pagina heen gestapeld. De oorspronkelijke wereldinhoud is direct zichtbaar, niet verstopt achter een tweede gegenereerde homepage. Een geopende desktopapp blijft bij versmallen het actieve oppervlak; invoer en iframe blijven bestaan. Dit is een presentatiewissel, geen navigatie of herladen. Publieke verhalen behouden hun inhoudelijke secties; die zijn de pagina zelf.

De Edge past zijn materiaal aan vanuit het bestaande wereldpalet. Tijdens menselijk scrollen wordt hij kleiner, met vijf aanraakvlakken van minstens 44 px. Omhoog scrollen of rust herstelt de ruime stand. Actieve invoer, een geopend paneel en handmatig gekozen bediening gaan voor automatische beweging. Verminderde beweging en verhoogd contrast worden gerespecteerd. De gedeelde RTG-vorm blijft herkenbaar; er wordt geen aparte mobiele balk gebouwd.

LivingOS en Saloon gebruiken warm onyx met brons en champagnegoud. WorkOS gebruikt donker petrol, TravelOS diep bordeaux en FoundationOS bosgroen met ivoren inhoudsvlakken. Foundation blijft altijd 100% gratis. Openbare platformpagina’s gebruiken neutraal warm onyx met subtiel brons. Foto’s, documenten en tekenvlakken behouden hun eigen inhoudskleuren.

`public/shared/rtg-world-palette.css` bezit de wereldkleuren. De gedeelde desktopbestanden bezitten de geometrie. `scripts/heritage-uitrol.js` bewaakt alle 293 zelfstandige appingangen; de 18 bestaande aliases verwijzen door en bevatten geen tweede scherm. Een ingesloten app deelt het buitenste kader. Het gedeelde speelscherm laadt geen persoonlijke widgets.

## Controle

`npm run desktop:controle` ontdekt routes uit de bron en controleert ze met een echte browser. Ontbrekende browser, verkeerd palet, oude layout, meerdere Edges, overloop of afwijkende kolommen laten de controle falen. `.github/workflows/desktop-standard.yml` draait die controle op elke PR en op main. `--browser`, `--routes`, `--site`, `--width` en `--output` ondersteunen lokale controle en de afzonderlijke bedrijfssite.

De definitieve warme tekeningen en productiebeelden zijn vastgelegd in `docs/ontwerp/warm-referenties.json`; `docs/ontwerp/warm-standaard.md` beschrijft de toepassing. `test/warm-presentation.e2e.js` bewijst foto-upload (ook in stukken), galerij, aparte uitsneden, herladen, annuleren, herstel en de scheiding tussen accounts en gezinsprofielen. De routecontrole schrijft per viewport een rapport met de werkelijk gemeten omvang en tijden. De rapporten zijn bewijs van lokale meting, geen publicatieverklaring.

## Bedrijfssite

De bedrijfssite staat buiten deze apprepository. `scripts/company-desktop-build.js --source <bestaande-inhoud> --config <geverifieerde-workerconfig> --output <bouwmap>` bouwt alle pagina’s met exact dezelfde gedeelde bestanden. `DESKTOP-PROVENANCE.json` bevat de pagina-inventaris en SHA-256 per asset. Oude navigatiescripts en zelfstandige stylesheets worden niet meegenomen. De bestaande Worker, taalroutes, headers en redirects blijven behouden.

Lokale controles en een gemergede PR zijn geen bewijs dat beide live domeinen dezelfde versie serveren. Controleer na publicatie de bestanden, cacheversie en zichtbare pagina’s op de openbare domeinen.

De gedeelde desktop begint 24 px onder de bovenrand. Lege werkvlakken krijgen geen minimale decoratieve hoogte. Bodoni draagt grote redactionele titels; Inter draagt bediening en gegevens. De mobiele Edge is 60 px hoog met raakvlakken van minimaal 44 px, subtiel glas en het lippenbeeldmerk. Een geopend paneel of geleende appbediening vervangt de navigatie binnen dezelfde Edge.
