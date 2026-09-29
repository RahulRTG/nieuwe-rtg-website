# RTG — goedgekeurde warme standaard

De definitieve desktop- en mobiele tekeningen van 27 september 2026 staan in `output/rtg-warm-persoonlijk` en `output/rtg-mobiel-warm` in de taakwerkruimte. `warm-referenties.json` legt de hashes vast. Eerdere ontwerpen zijn geen runtime-keuze.

Alle app-ingangen en publieke pagina’s gebruiken dezelfde componenten en tokens. LivingOS en Saloon zijn licht champagne (#faf8f3); WorkOS grafietgroen (#141a18); TravelOS warm bordeauxzwart (#1c1818); FoundationOS nachtblauw (#14202a). Inter is de interfaceletter. Het RTG-beeldmerk blijft zijn eigen vorm houden.

Desktop: drie kolommen, bij 1440 px buitenmarges van 40 px, 216 px links, 280 px rechts en 24 px tussenruimte. Een ondiepe sfeerfoto bovenaan, open navigatie, echte persoonlijke gegevens, kop boven de hoofdfoto, verhaalregel, drie app-ingangen en één vaste Edge. Mobiel: één kolom met tabbladen, hoofdfoto, actie, compacte agenda, verhaal en apps. Scrollruimte houdt alle bediening boven de vaste Edge bereikbaar.

Bestaande functies, invoer, rechten en accountgrenzen blijven de functionele bron. Namen, afspraken en reizen uit de illustraties zijn geen gegevens van ingelogde gebruikers. Geen gefingeerde persoonlijke gegevens om een tekening te vullen.

Persoonlijke beelden vervangen uitsluitend de eigen presentatie. De bytes blijven in de bestaande privébestandenkluis; de voorkeur bevat alleen bestand-ID en aparte desktop- en mobiele uitsneden. Herstellen verwijdert de voorkeur. Andere accounts en gedeelde projecties krijgen geen persoonlijke beelden.

## Bronnen en bewijs

De vier hoofdfoto’s en vier sfeerfoto’s zijn uit de goedgekeurde tekeningen opnieuw gegenereerd als interfacevrije productiebeelden met de ingebouwde imagegen-tool. De PNG-bronnen staan in de generated_images-map van deze taak. JPEG-encoding voegt geen retouchering toe.

De volledige routecontrole wordt uitgevoerd door `scripts/desktop-audit.js`; het rapport noemt de werkelijk gemeten routeomvang en viewport. `test/warm-presentation.e2e.js` toetst foto-opslag, uitsneden, herstel en accountgrenzen. Bestaande wereld-, invoer- en toegangstoetsen blijven vereist. Dit document is geen verklaring dat publicatie al heeft plaatsgevonden.
