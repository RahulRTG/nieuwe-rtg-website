# Desktopwereld en widgets

LivingOS, TravelOS, WorkOS en FoundationOS gebruiken vanaf 1000 CSS-pixels
dezelfde compositie: mensen links, de bestaande wereldhome in het midden,
favorieten rechts en de appbibliotheek eronder. De materiaal- en accentkleuren
komen uit de bestaande wereldidentiteit. Mobiel behoudt de bestaande home.
FoundationOS blijft 100% gratis.

## Beschikbaarheid is geen live-integratie

`scripts/world-widgets.js` leidt de catalogus af van het routemanifest, de twee
appcatalogi en bestaande HTML. De ontwerpmetadata beschrijft vorm, geen
persoonlijke records of nieuwe routes. De gegenereerde catalogus bevat 307
apps en deelapps, inclusief alle 303 ontwerpen. Deze inschrijving is L0.

Achttien compacte weergaven hebben een echte domeinkoppeling: agenda, notities,
reizen, reisboek, foodcourt, table, attenties, verificatie, accountbescherming,
geld, bestanden, training, kantoor, veilig, gesprekken, gezinsagenda,
Foundation leren en Foundation schrijven. Een koppeling bewijst geen toegang
voor ieder account. De server blijft toegang en rollen bepalen. Voor de andere
apps toont de widget mogelijkheden en opent hij de bestaande app vergroot.
Dat is geen bewering dat alle 307 apps compacte live-widgets hebben.

## Interactie en grenzen

- Agendaweken bladeren zonder een afspraak te wijzigen.
- Taken wijzigen via de bestaande Action Broker en `/api/notities/vink`.
  Een vinkje verandert pas na bevestiging van de server. Een fout blijft zichtbaar.
- Een nieuwe taak opent het bestaande notitieformulier. Er wordt niets automatisch opgeslagen.
- Het RTG-betaalsaldo is standaard afgeschermd en gebruikt echte centen uit de betaaladministratie.
- Gesprekken openen alleen via een record in de eigen inbox.
- Beveiliging toont de gemeten toegangsstand of e-mailstatus, geen algemene veiligheidsclaim.
- Ontbrekende gegevens, ontbrekende toegang, storingen en onvolledige bronnen
  zijn afzonderlijke toestanden. Foto's zijn als sfeerbeeld aangeduid.

Alle widgettransporten gebruiken een vaste lijst bestaande domeinroutes.
Foundation gebruikt de bestaande gezinssessie; widgets geven geen extra rechten.
Lezingen delen maximaal dertig seconden cache en tonen wanneer de bron is opgehaald.

## Vergroten en teruggaan

De modulehost opent uitsluitend bestaande apppaden van dezelfde origin. De
bestaande app houdt zijn eigen formulieren, authenticatie en backendregels.
Maximaal vier geopende apps blijven in geheugen, inclusief concepttekst.
Sluiten van een gewijzigd formulier vraagt bevestiging. Er is geen stille
verwijdering van oudere concepten. De standaard Edge Bar projecteert de
oorspronkelijke appacties; de ingebedde app krijgt geen tweede Edge Bar.
Een fout bij laden biedt opnieuw proberen en rechtstreeks openen.

## Voorkeuren en taal

Widget-ID's worden via de bestaande accountvoorkeur opgeslagen onder een vaste
wereldscope. De bestaande commandowerkruimte blijft apart. Er worden geen
gesprekken, bedragen, formulieren of tokens in deze voorkeur geschreven.
Een mislukte eerste lezing mag geen opgeslagen indeling overschrijven.
Gasten en gezinsschermen bewaren hun keuze uitsluitend in het huidige
schermgeheugen. Foundation gebruikt voor contacten en widgets uitsluitend het
gekozen gezinsprofiel; een gelijktijdig ingelogd ledenaccount levert daar geen
gegevens of bewaarde widgetvoorkeuren aan. Profielwissels en uitloggen wissen
de oude weergaven door de desktop opnieuw te laden.

De gedeelde taalruntime vertaalt de interface. NL en EN hebben vaste bronkopij;
andere talen volgen het bestaande taalbeleid en de bestaande terugvalregels.
Persoonlijke recordtekst is uitgesloten van automatische vertaling. Invoer en
de gekozen agendaweek blijven bij een taalwissel behouden. Dit document claimt
geen semantische certificering van alle apps in 114 talen.

## Bewijs

`test/world-desktop.e2e.js` controleert echte taakopslag, geweigerde wijzigingen,
vergroten, formulierbehoud, Edge-acties, de vier werelden en gratis gezinsdata.
`test/world-desktop-state.e2e.js` controleert bewaarde voorkeuren, falende
lezingen, gesprekselectie en taal-/RTL-behoud. `test/world-widget-catalog.test.js`
bewaakt de afleiding uit bestaande routes. `test/workspace-voorkeur.test.js`
bewaakt scheiding per account en wereld. Productie en fysieke apparaten zijn
hiermee niet automatisch end-to-end bewezen.
