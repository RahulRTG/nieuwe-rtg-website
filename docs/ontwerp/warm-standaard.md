# RTG — goedgekeurde warme standaard

De definitieve desktop- en mobiele tekeningen van 27 september 2026 staan in `output/rtg-warm-persoonlijk` en `output/rtg-mobiel-warm` in de taakwerkruimte. `warm-referenties.json` legt de hashes vast. Eerdere ontwerpen zijn geen runtime-keuze.

Alle app-ingangen en publieke pagina’s gebruiken dezelfde componenten en tokens. LivingOS en Saloon zijn licht champagne (#faf8f3); WorkOS grafietgroen (#141a18); TravelOS warm bordeauxzwart (#1c1818); FoundationOS nachtblauw (#14202a). Inter is de interfaceletter. Het RTG-beeldmerk blijft zijn eigen vorm houden.

Desktop: drie kolommen, bij 1440 px buitenmarges van 40 px, 216 px links, 280 px rechts en 24 px tussenruimte. Een ondiepe sfeerfoto bovenaan, open navigatie, echte persoonlijke gegevens, kop boven de hoofdfoto, verhaalregel, drie app-ingangen en één vaste Edge. Mobiel: één kolom met tabbladen, hoofdfoto, actie, compacte agenda, verhaal en apps. Scrollruimte houdt alle bediening boven de vaste Edge bereikbaar.

Bestaande functies, invoer, rechten en accountgrenzen blijven de functionele bron. Namen, afspraken en reizen uit de illustraties zijn geen gegevens van ingelogde gebruikers. Geen gefingeerde persoonlijke gegevens om een tekening te vullen.

Persoonlijke beelden vervangen uitsluitend de eigen presentatie. De bytes blijven in de bestaande privébestandenkluis; de voorkeur bevat alleen bestand-ID en aparte desktop- en mobiele uitsneden. Herstellen verwijdert de voorkeur. Andere accounts en gedeelde projecties krijgen geen persoonlijke beelden.

## Bronnen en bewijs

De vier hoofdfoto’s en vier sfeerfoto’s zijn uit de goedgekeurde tekeningen opnieuw gegenereerd als interfacevrije productiebeelden met de ingebouwde imagegen-tool. De PNG-bronnen staan in de generated_images-map van deze taak. JPEG-encoding voegt geen retouchering toe.

De volledige routecontrole wordt uitgevoerd door `scripts/desktop-audit.js`; het rapport noemt de werkelijk gemeten routeomvang en viewport. `test/warm-presentation.e2e.js` toetst foto-opslag, uitsneden, herstel en accountgrenzen. Bestaande wereld-, invoer- en toegangstoetsen blijven vereist. Dit document is geen verklaring dat publicatie al heeft plaatsgevonden.

## Inhoud binnen de omlijsting

De gedeelde pagina bezit de document-scroll. Oude schermschillen mogen geen viewport-hoogte of lege navigatierij behouden wanneer hun inhoud in die pagina wordt geplaatst. Werk OS had daardoor op mobiel slechts 58 pixels inhoud binnen een vlak van 400 pixels. Werkmodules moeten bovendien naar de beschikbare middenkolom schalen: vier oude minimumkolommen plaatsten de projectactie onder de favorietenkolom.

`test/mobile-content.e2e.js` controleert daadwerkelijke zichtbaarheid en raakbaarheid, document-scroll, de projectactie, Pass-tabbladen, hervatte werkbladen en de inlogdeur. Met `RTG_TEST_WEBKIT=1` draait dezelfde toets in Chromium en WebKit, op 390 en 1440 pixels, met de iPhone-standalone-eigenschap. De mobiele CI-job vereist beide browsermotoren. Dit is browseremulatie, geen controle op een fysiek iPhone-toestel.

De routecontrole onderzoekt ook afgeknelde inhoud binnen de buitenste pagina. Een volledige routecontrole opent de routes zonder privésessie; de gerichte toetsen dekken de genoemde ingelogde toestanden. Een groen routerapport bewijst dus niet elke accounttoestand of pixelgelijkheid met de tekeningen. De lege Pass-pagina uit de melding van 29 september is nog niet exact gereproduceerd.

Alle CSS-imports van de gedeelde vormgeving horen bij de installatiecache van zowel RTG als Foundation. `test/randen.test.js` bewaakt dit; `scripts/build.js` leidt de cacheversies uit hun werkelijke inhoud af.
