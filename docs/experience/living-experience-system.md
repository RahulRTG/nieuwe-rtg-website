# RTG Living Experience System

De eerste verticale versie verbindt de bestaande vier wereldmanifesten, echte
app-ingangen, routebronnen en een restaurantreis met toetsbaar bewijs. Er is geen
nieuwe autorisatiemotor, gebruikersscore of autonome productiewijziging.

## Gebruiken

- `npm run experience:check`: valideert de grondwet en de journeycontracten.
- `npm run experience:prove`: voert iedere gekoppelde proef werkelijk uit en
  schrijft logs, bronvingerafdrukken, JSON en een lokaal observatorium.
- `npm run experience:report`: bouwt het overzicht uit bestaande proefresultaten.
- `npm run experience:gate`: faalt bij een ongeldig contract, ontbrekend, rood,
  overgeslagen of verouderd bewijs. Dit is de automatische pilotpoort, geen
  productieautorisatie of vervanging van andere releasecontroles.

Open `artifacts/experience/index.html`. Het rapport bevat geen klantgegevens en
hoeft niet als publieke website te worden gepubliceerd. De onderliggende graaf
staat in `report.json`. Logs blijven lokale/CI-artifacts en worden niet als
productdata verspreid.

## Waarheid en reikwijdte

`experience/constitution.json` onderscheidt harde, wereld- en menselijke regels.
`experience/dinner.json` is Experience DNA: bedoeling, doelgroep, scherm,
capability, resultaat, bevoegdheid, toestanden, herstel, overdracht, eigenaar,
inspanningsdoel en benoemde proeven. Wereldidentiteit komt uit het bestaande
manifest; routebronnen worden met de gedeelde routelezer gevonden. Het contract
bewijst structurele aanwezigheid. Gedrag komt alleen uit uitgevoerde tests.

Het observatorium inventariseert alle actuele niet-doorverwijzende app-HTML's.
Een gevonden scherm krijgt `NOT_MODELED`; een scherm met DNA `CONTRACT_ONLY`.
Geen van beide labels beweert dat het scherm visueel of functioneel bewezen is.
De websitepagina's en niet-HTML-toestanden vallen buiten deze app-inventaris.

Elk proefresultaat bevat de testnaam, datum, commit, inhoudshash, testtelling,
exitcode en hash van het log. Nul tests, skips, todo's, crashes en gewijzigde bron
onderweg leveren geen groen bewijs. Een gewijzigde bron of ouderdom boven 24 uur
maakt bewijs `STALE`. Een ontbrekend of gewijzigd log blokkeert het bewijs.
De vingerafdruk is bewust breed: wijzigingen in productcode, contracten, tests,
scripts en dependencies vereisen opnieuw meten. Een fijnmazige impactselectie is
nog niet ingevoerd. Lokale artifacts zijn geen cryptografisch ondertekende
release-attestatie; de CI moet de proeven zelf uitvoeren.

## De eerste reis

Saloon/Pass opent Food Court. Het lid kiest restaurant, datum, gezelschap en tijd,
controleert de samenvatting en vraagt expliciet aan. De server herbeoordeelt
bevoegdheid, zaakbeschikbaarheid en capaciteit. `Aangevraagd` blijft zichtbaar tot
de verantwoordelijke zaak beslist. De persoonlijke agenda projecteert dezelfde
reservering met de actuele status; er wordt geen losse agenda-afspraak gekopieerd.
Annuleren of weigeren verwijdert de reservering uit de actieve agendaprojectie.

Bij een verloren antwoord blijft de invoer staan. De interface laat eerst bij de
bron controleren of de aanvraag bestaat. Geen automatische herverzending.
De bestaande domeingrens verhindert een tweede actieve aanvraag voor hetzelfde
lid, restaurant, datum en tijd; het formulier blokkeert dubbel tikken tijdens
verzending. Contextwijzigingen na het tonen van een slot worden bij uitvoering
opnieuw beoordeeld.

## Tijdelijke bedoeling

Bewaren is een expliciete keuze. Alleen datum, groepsgrootte, zoekterm en keuken
worden in sessionStorage bewaard, maximaal twee uur, gekoppeld aan een hash van
de huidige ingelogde sessie. De gegevens zijn geen autorisatie en worden niet in
een profiel, analytics of de Experience Graph opgenomen. De kern ondersteunt
meerdere gescheiden bedoelingen; de restaurantinterface hervat de laatste actieve
avond. 'Nieuwe avond' trekt die context in en wist de velden. Een ontvangen
reserveringsaanvraag rondt deze lokale zoekbedoeling af; dat betekent niet dat
de tafel bevestigd of het diner genoten is.

Afronden, intrekken of verlaten wist de velden. Verlopen records worden bij de
volgende toegang verwijderd en bij herladen niet hersteld. SessionStorage is
gebonden aan de browsertab en verdwijnt bij het sluiten van de tabsessie; dit is
geen gegarandeerde achtergrond-wistaak op een slapend toestel. Er wordt nog geen
context tussen accounts, apparaten of willekeurige andere capabilities gedeeld.

## Bewuste grenzen

De browserproef loopt op 390 en 1440 px in Chromium en omvat een echt ingebed
Pass-blad, contextbehoud, antwoordverlies na serververwerking, herstel en agenda.
De HTTP-proef meet de zaakbevestiging en eigenaarsgrenzen. Een geslaagde proef
bewijst uitsluitend haar genoemde scope. Een testfixture zonder externe calls
bewijst niet dat alle betaal-, AI- en pushconfiguraties van heel RTG functioneren.

De menselijke beoordeling, inspanningsmeting, fysieke iPhone, schermlezers,
200% tekstzoom, canary-uitrol en generatieve UI blijven expliciet niet bewezen of
niet ingevoerd. Een geldige beschrijving van een fouttoestand bewijst nog niet
iedere uitvoering van die toestand. Er staat daarom geen verzonnen totaalscore
of productievrijgave in het observatorium.

Uitbreiden gebeurt per menselijke reis: voeg DNA en echte resultaatproeven toe,
voer ze uit, laat de ervaring met mensen beoordelen en behoud de bestaande
releasecontrole. Verander nooit een meetgrens om een onbekende toestand groen
te laten lijken.
