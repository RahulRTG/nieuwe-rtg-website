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
