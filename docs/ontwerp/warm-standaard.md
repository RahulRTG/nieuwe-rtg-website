# RTG — goedgekeurde warme standaard

De actuele beeldrichting is de door de gebruiker gekozen RTG-editorialstijl van 1 oktober 2026. De referenties staan in `output/rtg-editorial-concepts-20261001/` in de taakwerkruimte. Werkelijke browserbeelden staan afzonderlijk onder `output/rtg-editorial-rollout-20261001/`; een tekening is geen bewijs van de implementatie.

Alle app-ingangen en publieke pagina’s gebruiken dezelfde componenten en tokens. LivingOS en Saloon zijn warm onyx (#100d0a); WorkOS donker petrol (#101817); TravelOS bordeauxzwart (#190d12); FoundationOS bosgroen (#10231e) met ivoren inhoud. Inter is de interfaceletter, Bodoni de redactionele titelletter. Foundation blijft altijd 100% gratis. Het RTG-beeldmerk blijft zijn eigen vorm houden.

Desktop: drie kolommen, bij 1440 px buitenmarges van 24 px, 216 px links, 280 px rechts en 20 px tussenruimte. Een volwaardige hoofdfoto, echte persoonlijke gegevens, redactionele titel, bruikbare app-ingangen en één Edge. Houd de tussenruimte compact en gebruik geen lege vaste minimumhoogtes. De mobiele correctie van 1 oktober vervangt de gestapelde desktopindeling: één oorspronkelijke apppagina zonder extra titel, tabrij of widgetkolommen. Dezelfde Edge beweegt mee in formaat en wereldkleur; scrollruimte houdt de bediening bereikbaar. Zie `DESKTOP-STANDAARD.md` voor de responsieve grens en het behoud van geopende apps.

Bestaande functies, invoer, rechten en accountgrenzen blijven de functionele bron. Namen, afspraken en reizen uit de illustraties zijn geen gegevens van ingelogde gebruikers. Geen gefingeerde persoonlijke gegevens om een tekening te vullen.

Persoonlijke beelden vervangen uitsluitend de eigen presentatie. De bytes blijven in de bestaande privébestandenkluis; de voorkeur bevat alleen bestand-ID en aparte desktop- en mobiele uitsneden. Herstellen verwijdert de voorkeur. Andere accounts en gedeelde projecties krijgen geen persoonlijke beelden.

## Bronnen en bewijs

De vier hoofdfoto’s en vier sfeerfoto’s zijn uit de goedgekeurde tekeningen opnieuw gegenereerd als interfacevrije productiebeelden met de ingebouwde imagegen-tool. De PNG-bronnen staan in de generated_images-map van deze taak. JPEG-encoding voegt geen retouchering toe.

De volledige routecontrole wordt uitgevoerd door `scripts/desktop-audit.js`; het rapport noemt de werkelijk gemeten routeomvang en viewport. `test/warm-presentation.e2e.js` toetst foto-opslag, uitsneden, herstel en accountgrenzen. Bestaande wereld-, invoer- en toegangstoetsen blijven vereist. Dit document is geen verklaring dat publicatie al heeft plaatsgevonden.

## Inhoud binnen de omlijsting

De gedeelde pagina bezit de document-scroll. Oude schermschillen mogen geen viewport-hoogte of lege navigatierij behouden wanneer hun inhoud in die pagina wordt geplaatst. Werk OS had daardoor op mobiel slechts 58 pixels inhoud binnen een vlak van 400 pixels. Werkmodules moeten bovendien naar de beschikbare middenkolom schalen: vier oude minimumkolommen plaatsten de projectactie onder de favorietenkolom.

`test/mobile-content.e2e.js` controleert daadwerkelijke zichtbaarheid en raakbaarheid, document-scroll, de projectactie, Pass-tabbladen, hervatte werkbladen en de inlogdeur. Met `RTG_TEST_WEBKIT=1` draait dezelfde toets in Chromium en WebKit, op 390 en 1440 pixels, met de iPhone-standalone-eigenschap. De mobiele CI-job vereist beide browsermotoren. Dit is browseremulatie, geen controle op een fysiek iPhone-toestel.

De routecontrole onderzoekt ook afgeknelde inhoud binnen de buitenste pagina. Een volledige routecontrole opent de routes zonder privésessie; de gerichte toetsen dekken de genoemde ingelogde toestanden. Een groen routerapport bewijst dus niet elke accounttoestand of pixelgelijkheid met de tekeningen. De exacte pixels van de gemelde Pass-screenshot zijn niet gereproduceerd op een fysiek iPhone-toestel. Wel is een kapotte offline start na één installatie gereproduceerd: de pagina was opgeslagen, maar de serverbundels en Command-modules ontbraken. `pass-cache.js` vult na worker-overname uitsluitend openbare interfacebestanden aan, met de exacte bundeladressen. API-antwoorden, uploads en privésessies vallen daarbuiten. `pass-recovery.js` toont een bereikbare herstelknop wanneer het beginscherm niet is opgebouwd. Verbindingsverlies houdt de toegangsdeur gesloten en bewaart de sessiesleutel voor een gecontroleerde herkansing; een 401/403 wist de sleutel wel.

`test/pass-startup.e2e.js` test ontbrekende opstartmodules plus herkansing in Chromium en WebKit, en een echte service-worker-installatie met offline herstart en herstel van de verbinding in Chromium. `test/pass-cache.test.js` bewaakt de toegestane openbare bestanden en weigert API-, upload- en externe adressen. WebKit-emulatie is geen test op het fysieke beginscherm van een iPhone.

Alle CSS-imports van de gedeelde vormgeving horen bij de installatiecache van zowel RTG als Foundation. `test/randen.test.js` bewaakt dit; `scripts/build.js` leidt de cacheversies uit hun werkelijke inhoud af.

## Wereldkleuren in geopende apps

De kleurregels gelden ook binnen Pass-bladen en desktopvensters; ze mogen niet afhangen van de aanwezigheid van de desktopomlijsting. Het zichtbare palet volgt het voorste geopende scherm via `data-rtg-palette`. De vaste route-identiteit blijft apart staan voor navigatie en gegevensbronnen. Sluiten herstelt het palet van het onderliggende blad of de beginpagina. Het volledige adres telt mee, inclusief het gebied van een gedeelde werkruimte.

`test/world-palette.e2e.js` vergelijkt echte achtergrond- en tekstkleuren van los geopende en ingebedde apps, de vier werelden binnen Pass, navigatie binnen een bestaand blad en terugkeren naar Home. De toets draait op 390 en 1440 pixels in Chromium en WebKit en bewaart schermafbeeldingen. De browserrand wordt opnieuw gemeten na een kleurwisseling. Bij het sluiten mag het kleine verzoek om de hervatpositie te bewaren doorlopen, zodat WebKit dat verzoek niet halverwege afbreekt.
