# RTG Experience Architecture v1

## Harde regel

Een RTG-release is uitsluitend **Premium Ready** wanneer alle toepasselijke
APPWERKT- en EXPERIENCEWERKT-bewijzen geldig zijn voor dezelfde kandidaatversie.
Ontbrekend, verlopen, geblokkeerd of uitsluitend door AI beoordeeld bewijs is
geen geslaagd bewijs.

## Eén inventaris, twee bewijsassen

APPWERKT blijft de functionele appbewijsbron. EXPERIENCEWERKT voegt geen tweede
handmatige appcatalogus toe: de logische apps worden afgeleid uit `MAPPEN` en de
schermen uit `public/apps/**/*.html`. Het gegenereerde register legt de
Experience-bewijslast naast iedere gevonden app en ieder gevonden scherm.

De Experience Signature is een dunne declaratieve overlay. Een signature kan
alleen iets zeggen over een bestaande app of route; hij kan geen app of scherm
aan de inventaris toevoegen of eruit verwijderen. Een onbekende signature laat
de integriteitscontrole falen. Een ontbrekende signature blijft `NOT_TESTED`.

Een app-signature hoeft bestaande productwaarheid niet te kopieren. Met
`{"source":"appcontract"}` als `purpose` leest de resolver de bestaande
productbelofte van exact die app. Met `{"source":"APPWERKT"}` als
`interactions` neemt hij de volledige actuele, aangeraakte interactie-inventaris
over. Ontbrekende of onaangeraakte bediening blokkeert; nieuwe bediening
vergroot automatisch de Experience-noemer. Schermsignatures mogen deze
appbronnen niet lenen. Identiteit, compositie, beweging, dichtheid en menselijke
taken blijven altijd expliciet onderdeel van de signature en kunnen dus niet
uit een generiek sjabloon groen worden verklaard.

## Acht bewijsgebieden

1. Identiteit: wereld- en appsignatuur.
2. Compositie: rust, hiërarchie en ruimte.
3. Continuïteit: navigatie, context, herstel en beweging.
4. Terughoudendheid: weinig zichtbare complexiteit.
5. Adaptiviteit: apparaten, formaten en netwerken.
6. Toegankelijkheid: toetsenbord, zoom, contrast en schermlezer.
7. Vloeiendheid: reactiesnelheid, frames en stabiliteit.
8. Menselijke kwaliteit: echte taakproeven met menselijke beoordeling.

Iedere interface krijgt standaard de volledige bewijslast over de vastgelegde
toestanden en apparaten. Een technische redirect telt ook mee in de noemer,
maar heeft een expliciet gemotiveerd toepasselijkheidsprofiel. Een ongemotiveerd
`NOT_APPLICABLE` is een contractfout.

Een signature declareert daarnaast iedere toepasselijke interactie met een
stabiele semantische ID. Die interacties krijgen eigen bewijsregels voor
zichtbaarheid, begrijpelijkheid, continuïteit, toegankelijkheid en vloeiendheid.
Een scherm zonder bediening mag alleen een lege lijst dragen met een gemotiveerd
`noInteractions`-besluit. De bestaande APPWERKT-browserinventaris blijft de
onafhankelijke bron die nieuwe en dynamische bediening ontdekt; EXPERIENCEWERKT
mag die waarneming niet vervangen door een handmatig korter lijstje. De compiler
blokkeert daarom een app-signature die minder interacties declareert, een
waargenomen label mist of nog onaangeraakte APPWERKT-bediening probeert te
negeren.

## Commando's

- `npm run experience:coverage:write` genereert `EXPERIENCEWERKT.json`.
- `npm run experience:coverage:check` bewijst dat het register exact uit de
  actuele bronnen is afgeleid.
- `npm run experience:coverage:gate` is de fail-closed Experience-poort. Deze
  hoort rood te blijven totdat alle toepasselijke bewijzen werkelijk bestaan.

Een nieuwe app, route of HTML-pagina vergroot automatisch de noemer. Daardoor
kan groei nooit ongemerkt een eerdere 100%-claim laten staan.

## Bewijsbinding

Elk bewijsrecord noemt onderwerp, dimensie, concrete requirement, bronhash,
kandidaatcommit, configuratiehash, methode en artefact. Menselijke kwaliteit
vereist daarnaast een menselijke reviewer. De uiteindelijke vrijgavepoort moet
APPWERKT en EXPERIENCEWERKT op dezelfde kandidaatcommit samenstellen; dit eerste
architectuurpakket verklaart de huidige ervaring uitdrukkelijk nog niet groen.

### Configuratieverplichtingen voor destination

Het bestaande `coverage-contract.json` operationaliseert
`continuity:destination` conservatief over **alle toestanden × alle apparaten ×
alle netwerken**. Toestanden en apparaten komen uit het contract, aangevuld met
`additionalStates` en `additionalDevices` van de bestaande signature. Netwerken
komen uit `contract.networks`. De ontvangen bewijzen en `executedProofs` bepalen
deze noemer niet. Een ontbrekende producer of proefcel verkleint hem niet.
Er is geen impliciete vrijstelling voor niet-normale toestanden. De netwerkas
is hiermee expliciet gemaakt; de eerdere implementatie legde die relatie voor
destination nog niet vast. Een UI-toestand `offline` is een andere as dan de
netwerkconditie `offline` en mag daarmee niet worden samengevouwen.

Deze cellen hangen onder de bestaande requirement; zij voegen geen apps,
schermen of tweede bewijsregister toe. Juridisch heeft momenteel elf toestanden,
vier apparaten en drie netwerken: **132 configuratieverplichtingen per scherm**.
De bestaande `configurationCoverage` in de afleiding toont deze noemer en haar
blokkades. `requiredCellCount` is geen aantal uitgevoerde of bewezen proeven.

De concrete apparaatconfiguraties wonen uitsluitend in
`configurationCoverage["continuity:destination"].deviceConfigurations` van
hetzelfde contract. Iedere definitie bevat `browser`, `viewport` (breedte en
hoogte), `deviceScaleFactor` en `touch`. Een apparaatlabel zonder definitie,
een onbekende configuratie of eenzelfde viewport onder twee apparaatlabels
blokkeert. De vastgelegde Chromium-profielen zijn `mobile-small` 320 × 568,
`mobile-large` 430 × 932, `tablet` 820 × 1180 en `desktop` 1440 × 900 CSS-pixels.
Alle vier gebruiken DPR 1 en `touch:false`: dit zijn browserformaten, geen
metingen van fysieke apparaten of aanraakbediening. Het kleinste formaat toetst
de reflowgrens op 320 CSS-pixels. Een toegevoegd apparaat zonder eigen concrete
definitie blijft geblokkeerd. De netwerkconditie is een afzonderlijke as en kan
niet uit de viewport of de naam van de lokale proefserver worden afgeleid.

`scripts/lib/experience/configurations.js` leidt uitsluitend de verplichtingen
af en controleert configuratiemetadata. Zelfs een volledige metadata-matrix
blijft `NOT_TESTED`. Ontbrekende definities blijven `BLOCKED`. Iedere
producer moet de toestand werkelijk opwekken, de netwerkconditie
controleren en het passende bestemmingsresultaat waarnemen. Het woord
`local-test-server` benoemt een proefomgeving, geen netwerkconditie. Een
ongedefinieerde toestand, onbekende combinatie of onuitvoerbaar scenario mag
niet stilzwijgend als normaal, bewezen of niet-toepasselijk worden behandeld.

Artefactmatching onderscheidt configuraties via `configurationHash`; twee
waarnemingen voor hetzelfde onderwerp, requirement en configuratie binnen één
uitvoering blijven een conflict. De bestaande executor schrijft per uitvoering
een eigen log en afzonderlijke celartefacten. Pas na een volledig geslaagd
proces, alle exact getypeerde waarnemingen en een laatste controle van de schone,
ongewijzigde kandidaat krijgen de oorspronkelijke recordreferenties een levend
procesreceipt. Een kopie, import of later opgeslagen bestand krijgt dat gezag
niet. De laatste-proefweergave blijft beschikbaar, maar overschrijft nooit het
log waarnaar een eerdere receipt verwijst.
Een generiek geslaagd testproces geeft in het observatorium geen groen
reislabel. Dat label vereist volledige getypeerde deelscopes voor de betrokken
proeven, dezelfde kandidaat en bron, en een schone kandidaat bij rapportage.

De eerste configuratiegroep hergebruikt de bestaande echte Hotels-proef:
`normal` op de vier contractprofielen, naast de oorspronkelijke 390 × 844-proef.
Elke cel opent een nieuwe Chromium-context met echte lokale lidautorisatie,
zonder ingestelde netwerkvertraging of offline-modus. Het instrument meet
online-status, HTTP 200 voor document en eigenaar, de juiste Travel-bestemming
en de zichtbare collectie. `normal` beschrijft hier dit lokale netwerkmodel;
dit is geen meting van een fysiek netwerk of apparaat. De netwerkcondities
`constrained` en `offline` krijgen daarmee geen bewijs.

Alleen geldige artefacten mét levende receipts tellen als waargenomen cel.
Een geslaagde uitvoering kan zo vier van de huidige **180 Hotels-cellen**
waarnemen. De oorspronkelijke 390 × 844-scope blijft afzonderlijk en vult geen
contractprofiel. Het bestaande rapport toont de cellen per uitvoering;
verschillende uitvoeringen worden niet samengevoegd tot een kunstmatig volle
matrix. Iedere deelclaim blijft uitsluitend `PROVEN_IN_SCOPE` en sluit
destination niet. De matrix blijft `NOT_TESTED` zolang cellen ontbreken;
ongeldige of conflicterende invoer blijft `BLOCKED`. Configuratiemetadata alleen
kan ook een volledige matrix nooit kwalificeren.

Dit bouwpakket maakt meerdere getypeerde cellen uitvoerbaar. De resterende
bouwstap omvat producers voor alle toepasselijke toestanden en netwerken en de
volledige kwalificatie van iedere requirement. De twee onafhankelijke eindruns,
menselijke beoordeling en vrijgave blijven afzonderlijke, ongewijzigde poorten.
Nieuwe browserproeven moeten nog werkelijk worden uitgevoerd; pure protocoltests
leveren geen nieuwe browserclaim of volledige `PROVEN`-status.

De tweede groep gebruikt dezelfde executor voor `/apps/juridisch.html`.
`experience/legal-documents.json` beschrijft het bestaande publieke doel
`site.juridisch` binnen LivingOS: de drie gepubliceerde documenten vinden.
De binding is `juridisch-public-normal-destination-v1`, uitgevoerd door
`test/juridisch-ds.e2e.js`. Vier verse anonieme browsercontexten meten de echte
overzichtsresponse, titel, wereld, drie titels/bestemmingen en bereikbaarheid
van iedere link. De normale toestand heeft de cookiemelding al afgehandeld;
eerste bezoek is een afzonderlijke, nog niet getypeerd bewezen toestand.
Er is geen login- of eigenaar-API nodig voor openbare informatie.

Deze groep kan **4 van 132 Juridisch-cellen** waarnemen; 128 blijven open.
De ontbrekende toestanden blijven verplichtingen, geen bewering dat de
statische overzichtsroute zelf een lege collectie of prijs-API heeft.
Een verwijderde DOM, ontbrekend account of vervalste lege response mag die
toestanden niet bewijzen. De drie onderliggende documentroutes behouden hun
eigen signatures en vereisen afzonderlijk bewijs. Juridische zekerheid,
actuele tarieven, authenticatie, andere netwerken en menselijke beoordeling
worden door deze overzichtsmetingen niet gekwalificeerd.

## Vier afzonderlijke vrijgavegrenzen

**Volledige bewijsdekking is geen automatische productgoedkeuring.** De poort
eist bewijs voor iedere geïnventariseerde regel én een afzonderlijke controle
dat de inventaris zelf compleet is. Een ontbrekend scenario kan daardoor niet
een kunstmatige 100%-score opleveren. De menselijke taakbeoordeling en het
uiteindelijke productoordeel blijven afzonderlijke vereisten.

**De actieve ontwerp-erfenis blokkeert Premium Ready.** De bestaande norm meet
op deze bronstand 159 app-pagina's die de gedeelde tokenlaag nog niet insluiten.
Dat getal is een ondergrens voor migratiewerk, geen bewering dat alle overige
pagina's al volledig zijn gemigreerd. Voor de eindvrijgave is de norm nul:
ieder actief scherm gebruikt het geldende Design System. Een tijdelijke
uitzondering blijft `BLOCKED` en kan niet door een gemiddelde score worden
gecompenseerd.

**De twee eindruns zijn werkelijk onafhankelijk.** Beide draaien op dezelfde
onveranderde kandidaatcommit, maar run 2 begint met een schone testtoestand en
bouwt zijn bewijsresultaat opnieuw op. Geen database, cache, browserprofiel,
gegenereerd register of ander resultaat uit run 1 mag de tweede uitslag dragen.

**Kritieke risico's zijn fail-closed.** Financiële veiligheid, autorisatie en
de binding van een handtekening aan de exacte contractversie zijn afzonderlijke
vrijgaveblokkades. Eén open of verlopen kritisch bewijs houdt de kandidaat
tegen, ongeacht het aantal geslaagde visuele of functionele controles.

De integrale runs zijn het eindbewijs. Een fout die daar nog bovenkomt gaat
terug naar een gericht herstelpakket; de volledige run wordt niet herhaald als
diagnostisch zoekmiddel voordat die oorzaak en haar getroffen bereik zijn
afgesloten.
