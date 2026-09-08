# RTG Heritage Intelligence

Editorial luxury on the surface. Operational intelligence underneath.

De bestaande schermen, bron-API's en rechten blijven eigenaar van hun inhoud. De gedeelde laag geeft hun één bedieningsgrammatica en vier wereldidentiteiten.

## Centrale afspraken

- `public/shared/rtg-world-identity.js` beheert routes, materiaalgrenzen en de expliciete `gebied`-varianten van de bestaande werkruimte. Een willekeurige query kan geen route van wereld veranderen.
- `rtg-heritage.css` en zijn gedeelde deelbladen bevatten kleur, geometrie, typografie, grid en spacing. Grote redactionele titels gebruiken Bodoni; bediening, formulieren en tabellen Inter.
- `rtg-heritage-registry.js` koppelt bestaande DOM aan WorldPortal, EditorialHero, ContextStrip, MomentList, NarrativePanel, OperationalPanel, SideSheet en bronstaten. Canvasroutes hebben expliciete selectoren en beginnen Compact.
- Edge blijft de enige vaste navigatieschil. Bestaande lokale bediening wordt met haar handlers naar Context verplaatst. Ook een later geladen Foundation-wereldbalk wordt opgenomen. Via het menu blijft **Bediening en weergave** bereikbaar in Compact; Focus heeft een herstelknop.
- De Continue Key heeft vaste, bereikbare ankers. Hover verandert de capsule, niet het raakvlak. Positie heeft toetsenbordbediening en wordt per apparaat onthouden. De drie pinposities worden uitsluitend door de gebruiker gewijzigd. Binnen de werkruimte openen pins dezelfde werkbladen als de bestaande functiebibliotheek.

## Context en waarheid

`RTGRouteMemory` bewaart alleen toegestane route-identiteit en expliciet geregistreerde context: scroll, sectie, dichtheid en kleine adapters. Het bewaart geen willekeurige formulieren, tokens, boekingsinhoud of berichten. Sessiegeheugen is begrensd op 24 routes, 65.536 UTF-16-tekeneenheden in de geserialiseerde inhoud en 24 uur. Nieuwe invoer onderbreekt herstel; browsergeschiedenis en BFCache blijven leidend.

Agenda, Bestanden, Living, Travel, Work en de publieke Foundation-home gebruiken hun eigen adapter. Adapters wachten waar nodig op de eigen bronrender; Living en Work herstellen hun lokale tab- of doelgroepkeuze direct. Een directe URL met een tab of stad heeft voorrang. Bestanden controleert een herstelde map tegen de actuele bron.

`RTGOperation` onderscheidt lokaal verwerkt, verzonden, bevestigd, wacht op bron, mislukt en teruggedraaid. HTTP 200 alleen is geen domeinbevestiging. Definitieve states vragen expliciete bronherkomst; gevoelige acties mogen niet lokaal als afgehandeld worden gemarkeerd. Agenda bewaart tekst bij offline/HTTP/JSON-fouten en sluit een concept pas na een geldige bewaarontvangst. Bestaande bevestigingen en undo-flows blijven eigenaar van hun handelingen.

## Laden en beweging

Wereldhomes tonen één tijdelijke, toegankelijke laadstatus terwijl hun echte DOM, Edge en fonts worden opgebouwd. De laag wacht op een stabiele indeling en heeft een begrensde fallback van twaalf seconden voor ontbrekende scripts. Bij een trage bron blijft de eigen laad-, lege of foutstaat van de route bereikbaar. Bronvlakken reserveren ruimte; een onbekende reistijd blijft zichtbaar onbekend.

Shared-element-overgangen koppelen wereldportalen en bestaande Agenda-/Foundation-projectdetails. Zonder ondersteuning of bij reduced motion werkt dezelfde handeling direct. Selecties, knoppen en morphteksten behouden hun plaats. Kaart- en editorcanvassen krijgen geen extra decoratieve inhoud; resize van hun echte vlak bereikt de bestaande renderer.

## Controle

- `npm run build` en `npm run check` bewaken de bestaande bouw- en architectuurcontracten.
- `test/rtg-heritage*.test.js` en `test/rtg-world-identity.test.js` controleren alle route-identiteiten, toegestane materiaalvarianten, componentrollen, canvasdefaults en beide offline assetlijsten.
- `test/rtg-operation.test.js`, `test/rtg-route-memory.test.js` en de bestaande Continue/Edge-tests bewaken bronfinaliteit, begrensd contextgeheugen en veilige bediening.
- `test/heritage-context.e2e.js` en `test/heritage-intelligence.e2e.js` gebruiken een geïsoleerde server, echte navigatie en bestaande bronflows. Ze toetsen conceptbehoud, ongeldige ontvangst, werkbladen, context, echte modusknoppen, pins, toetsenbordfocus en bereikbare raakvlakken.
- `test/world-dashboard.e2e.js` meet de vier native homes op 320, 390, 768, 1024, 1440 en 1920 pixels. De proef faalt bij dubbele shells, afsnijden, overlappende bediening of runtimefouten. Zet `RTG_WORLD_DASHBOARD_SHOTS` op een uitvoermap voor volledige en viewport-referentiebeelden; de getoonde reis en stad komen uit testfixtures.
- `A11Y_STRICT=1 npm run a11y` controleert de volledige scherminventaris in de bestaande sessie-, telefoon-, tablet- en themarondes.

Productiedata, betalingen, autorisaties en productie-uitrol worden niet door deze laag gesimuleerd. Een gemeten regressieproef is bewijs voor haar scenario's; zij vervangt geen bronspecifieke bedrijfsacceptatie of meting op echte apparaten.
