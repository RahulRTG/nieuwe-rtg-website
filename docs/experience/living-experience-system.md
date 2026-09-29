# RTG Living Experience System

De eerste verticale versie verbindt de bestaande vier wereldmanifesten, echte
app-ingangen, routebronnen en een restaurantaanvraag, reisaanvraag en handmatig gastprogramma met toetsbaar bewijs. Er is geen
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

`experience/travel.json` voegt Travel → reisbureau → adviseursbesluit in Work →
reisoverzicht toe. `proofRefs` koppelt gedeelde contract- en intentproeven zonder
ze opnieuw te draaien. Een onbekende verwijzing blokkeert de compiler. Het
observatorium toont de bewijsstatus per reis en filtert op reis én bewijsstatus.

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

## De Travel-reis

Datum en aantal reizigers blijven staan bij het bekijken van een andere reis.
Na expliciete toestemming kunnen alleen deze twee velden maximaal twee uur in
hetzelfde tabblad worden hervat. Restaurant- en reiscontext kunnen elkaar niet
lezen, wijzigen of afronden. Vrije reiswensen worden niet tijdelijk opgeslagen.

De gebruiker controleert de aanvraag en de ontvanger vóór de verzendknop.
Tijdens verzending blijft die knop geblokkeerd. De interface leest eerst de
bestaande aanvragen, zodat een oude aanvraag niet als nieuw ontvangstbewijs
wordt gepresenteerd. Na antwoordverlies zoekt zij naar precies één nieuwe
aanvraag met dezelfde reis, datum, reizigers en wensen. Geen match, meerdere
matches of een onbereikbare bron blijven onzeker; er wordt niet automatisch
opnieuw verstuurd. Deze controle is geen cryptografische koppeling tussen een
browserpoging en een domeinobject. Bij gelijktijdig identieke aanvragen in een
ander tabblad kan alleen het reisbureau definitief bevestigen welke poging is
ontvangen. Een herladen tabblad toont de aanvragen opnieuw via de bron; de
tijdelijke verzendstatus zelf wordt niet opgeslagen.

Een ontvangen aanvraag verschijnt meteen onder Mijn aanvragen. De reisadviseur
beslist via de bestaande kantoorbevoegdheid. Reisoverzicht en programma blijven
de domeinbron volgen. De HTTP-proef controleert ook afwijzen met een reden,
afzeggen, intrekken, dubbel versturen en eigenaargrenzen. De browserproef loopt
via de zichtbare Travel-appbibliotheek, met werkelijk antwoordverlies en een
mislukte broncontrole. Betalen valt buiten deze reis.

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

## Handmatig gastprogramma

Kantoor → Reisbureau bevat de planner voor elke bestemming. Een leeg concept
of deur-tot-deur-sjabloon wordt volledig handmatig ingevuld: maximaal 80
onderdelen, maximaal 50 reizigers, vrije locaties en afzonderlijke lokale
tijdzones voor vertrek en aankomst. Chauffeur, lounge, meet & greet, concierge,
privéjet, restaurant en eigen onderdelen gebruiken dezelfde planner.

Concepten blijven uitsluitend voor het kantoor. Publicatie vereist een
bewuste keuze en een einddatum (maximaal 366 dagen). De 128-bit gastcode staat
alleen als hash in de bestaande uitnodigingscollectie; de kale code verschijnt
eens bij uitgifte. De gast leest het volledige gedeelde programma zonder account.
Daarom zijn alle ingevulde adressen, contacten en referenties zichtbaar voor
iedereen die de link bezit. De planner vraagt geen paspoorten, betaalgegevens
of medische dossiers. Deze nieuwe deelkeuze verruimt geen bestaande
ledenuitnodigingen: die blijven hun beperkte voorvertoning en claimregels houden.

Updates controleren de versie atomair, zodat een collega niet stil wordt
overschreven. Een gepubliceerde reis bijwerken verandert ook de bestaande
gastweergave. Een nieuwe link vervangt de vorige; intrekken/verlopen sluit iedere
volgende serverlezing. De open gastpagina ververst op verzoek, bij terugkeer en
elke minuut zolang zichtbaar. Reeds gelezen, opgeslagen of afgedrukte inhoud
kan niet worden teruggehaald. Codes blijven alleen in paginageheugen: na
herladen opent de gast de oorspronkelijke link opnieuw.

Bevestigingen zijn verklaringen van de adviseur, met verplichte bronvermelding.
Er is geen live leveranciers-, vlucht-, beschikbaarheids- of betalingscontrole.
Een PDF is een afdruk van de bekeken versie, geen automatisch bijgewerkt ticket.
De planner maakt geen reservering, klantaccount of pas. Gastpublicatie en
bestaande accountoverdracht hebben verschillende rechten.
