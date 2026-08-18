# REIZEN.md -- RTG Travel OS

Het diepte-document voor de wereld die vandaag "RTG Reizen" heet. `PLATFORM.md`
beschrijft het wereldpatroon dat elke wereld krijgt, `GELD.md`, `LEVEN.md` en
`LIFE.md` zijn de zusterdocumenten, `LAT.md` zegt hoe er geschreven wordt, en
`ONTWERP.md` hoe het eruitziet. Dit zegt wat deze wereld is, en -- zwaarder
wegend -- wat hij nooit mag worden.

Besluit van de eigenaar, 18 augustus 2026, in twee delen: het Travel OS zelf
(reiziger, medewerker, management) en de handelskant eronder (partners, externe
producten, invoer van bestaande boekingen).

---

## 0. De kern, in twee zinnen

> Een reisbureau verkoopt boekingen. **RTG beheert reizen** -- ook de reis die
> hij niet verkocht heeft.

En daaruit volgt de regel die het hele ontwerp stuurt:

> **Het maakt niet uit waar een onderdeel vandaan komt. Het maakt wel uit dat
> RTG dat weet.** De reiziger ziet één reis; het systeem weet van elk onderdeel
> waar het vandaan komt, hoe zeker het is, en wat het ermee mag.

Dat tweede is geen slag om de arm. Het is het enige verschil tussen een
reismap die je kunt vertrouwen en een verzameling schermafdrukken met een
mooie rand eromheen.

---

## 1. Dit is geen groen veld, en dat is hier het belangrijkste feit

Zeven mechanismen die deze visie vraagt, staan in dit huis al werkend en
getoetst. Ze staan alleen op de verkeerde plek, of ze kijken de andere kant op.

| Wat de visie vraagt | Wat er staat | Waar |
|---|---|---|
| één standaardvorm voor alles wat je kunt kopen of boeken | **het universele aanbod-object**: tien bronnen, één vorm, één zoekmachine; een bron die een half object levert wordt geweigerd en die weigering komt mee terug | `kern/mall/aanbod.js` |
| "waar mag dit product verschijnen" | bereik en plek per aanbod (`plekVan`, `bereikVan`, `MARKT_BEREIK`, `RTG_BEREIK`) | `kern/mall/plek.js` |
| weten waar vraag is zonder mensen te volgen | het **vraagbeeld**: geteld per WOORD, nooit per persoon, pas zichtbaar boven een drempel -- en een tekort is daar een ondernemerskans | `kern/mall/vraagbeeld.js` |
| een scanbare pas die niet te kopiëren is | **dyncode**: ondertekend, 45 seconden geldig, onleesbaar voor een generieke QR-lezer, met `/api/code/scan` erachter | `kern/dyncode.js` |
| één reis over de domeinen heen | de reiswereld: vlucht, verblijf, reisaanvraag en charter op één tijdlijn, met per status een teken, een signaal en waar op gewacht wordt | `kern/reiswereld.js` |
| het reisdossier dat eerlijk is over wat nog niet rond is | Het Huis: per onderdeel bevestigd / wacht op betaling / in aanvraag, en streng gescheiden wat AAN U ligt en wat u alleen kunt AFWACHTEN | `kern/huis.js` |
| bewijs achteraf: wie keek waarin, en waarom | het **inzagejournaal** (van de betrokkene, AVG art. 15) naast het kantoor-auditlog (van het kantoor) -- twee lezers, twee doelen, twee sporen | `server/inzagelog.js`, `afdelingen/inzage.js` |

Daarnaast: de Reiswijzer en de Regelwacht (alle regels van elk land, automatisch
uitgereikt zodra iemand ergens naartoe gaat), de visumtaak die bij een boeking
klaarstaat en bij annulering weer verdwijnt, één leverancier-app over 73 genres
(`kern/pda/modules.js`), de handelsketen die een aanvraag naar een GENRE stuurt
in plaats van naar een adres, de betaalopdracht met idempotentiesleutel en
terugboeking (`kern/betaalopdracht/`), en sinds 18 augustus de Reisbalie: de
kamer waar een mens een reisaanvraag bevestigt.

**Wat er NIET staat, en wat dus echt gebouwd moet worden.** Vier dingen, en het
is eerlijker ze zo klein te noemen als ze zijn:

1. een **Journey-object** -- een reis als ding, met meerdere reizigers, een
   venster, en onderdelen uit meerdere herkomsten;
2. **invoer van bestaande boekingen** (document, beeld, e-mail) met extractie,
   zekerheid per veld en het origineel als bewijsstuk;
3. **bewaking** van een lopende reis, met een bron die zichzelf meldt als hij
   stilvalt;
4. een **partner-productmodel** met voorraad, tijdsloten, voorwaarden en
   afdracht -- de leesbare kant daarvan (aanbod, bereik, vraagbeeld) bestaat al,
   de schrijfkant niet.

Termen die in de opdracht vielen en die hier iets anders heten, zodat niemand
gaat zoeken naar iets dat niet bestaat: een *Applicability Engine* is hier
`middleware/functieschakelaars.js` (zes assen: globaal, pas, land, plaats,
persoon, genre) plus `kern/bevoegdheid.js` (wat RTG **zelf** mag, veertien
handelingen met rang en vergunning). Een *Evidence Graph* is hier het
inzagejournaal plus het auditlog plus `GRENZEN.json`. Een *AI Permission
Engine* bestaat **niet** -- dat is nieuw, en par. 4.5 zegt waar hij mag komen te
hangen: nergens naast die twee, maar erop.

---

## 2. De objectlaag

Niet: Vluchten, Hotels, Excursies, Taxi's. Maar vier objecten.

| Object | Wat het is | Wat het NOOIT is |
|---|---|---|
| **Reis** (journey) | het venster, de reizigers, de tijdlijn, de bewaking | een tweede boekingsadministratie |
| **Onderdeel** (item) | één ding op die tijdlijn, met een **soort** en een **herkomst** | de boeking zelf |
| **Aanbod → Bestelling** | wat er te koop is en wat er besteld werd | van de reiswereld -- dit blijft van het domein |
| **Bewijsstuk** | het origineel plus wat eruit gelezen is, met zekerheid per veld | een verbeterde versie van het origineel |

### 2.1 De belangrijkste zin van dit document

> **De Reis bezit geen boeking. Hij bezit een verwijzing, een voornemen en een
> bewijs.**

Dit is de plek waar de visie en de bestaande architectuur elkaar raken, dus hij
hoort met zoveel woorden opgeschreven. `kern/reiswereld.js` heeft nu geen enkele
knop die boekt, wijzigt of annuleert, en dat is een besluit met een reden:
zodra een tweede plek een reis kan laten ontstaan, is *"waar staat mijn boeking
echt"* binnen een maand niet meer te beantwoorden (LAT-regel 4, en de
super-app-regel in `PLATFORM.md`: een super app orkestreert domeinsoftware, hij
vervangt haar niet).

"Eén reis, één object" mag dat besluit niet omdraaien -- en hoeft dat ook niet.
De reiziger ziet één reis; de vlucht blijft van het vluchtdomein, het verblijf
van logies, de reisaanvraag van het reisbureau. Wat de Reis toevoegt is wat
nergens bestond: het verband, de vooruitblik en het bewijs.

Voor wijzigen betekent dat de vorm die `LIFE.md` al koos, hier met een reden die
zwaarder is dan comfort: **RTG stelt samen en zet klaar; uitvoeren doet het
domein dat de boeking bezit.** Eén knop "los het op" mag alles voorbereiden --
alternatieven zoeken, de gevolgen doorrekenen, de vervolgstappen klaarzetten --
maar de omboeking wordt uitgevoerd door de partij die hem kan waarmaken, en
komt daar in het grootboek en het auditspoor terecht waar hij hoort.

### 2.2 Soort en herkomst zijn twee dingen

Elk onderdeel draagt allebei, en ze worden nooit door elkaar gehaald.

**Soort** (wat de reiziger ziet): vlucht, verblijf, vervoer, transfer,
activiteit, tafel, evenement, spoor, huurauto, verzekering.

**Herkomst** (wat het systeem weet): `rtg` (zelf verkocht), `partner`
(partnerinventaris), `extern` (extern distributiekanaal), `document`
(ingelezen PDF/e-mail), `beeld` (ingelezen schermafdruk/foto), `handmatig`
(door mens ingevoerd).

De voorkant kiest op **soort**, en ziet er dus overal hetzelfde uit. Elke regel
die met geld, wijzigen, garanderen of bewaken te maken heeft, kijkt naar
**herkomst** -- en mag daar niet omheen. Een ingelezen hotelbevestiging is geen
verkochte boeking, en RTG mag er niet mee omgaan alsof het dat wel is.

---

## 3. Het werkwoord van deze wereld

`PLATFORM.md` eist dat elke wereld zijn werkwoord kiest en opschrijft vóór er
gebouwd wordt. RTG Geld voert uit binnen regels en binnen eigen tegoed.
RTFoundation voert niets uit en opent alleen. RTG Sociaal stelt samen en zet
klaar. Voor RTG Reizen:

> **VÓÓR ZIJN.** Opmerken en klaarzetten vóórdat de reiziger het merkt -- en
> uitvoeren alleen daar waar het domein dat al mocht.

Dat is het hele verschil tussen deze wereld en een boekingssite. Een
boekingssite is klaar bij de bevestiging. Hier begint het werk daar: de
aansluiting die krap wordt, het document dat verloopt, de transfer die niet meer
past bij de nieuwe aankomsttijd, de bestemming waarvan de regels veranderden.

En de keerzijde, die er even hard bij hoort: **vóór zijn zonder bron is
verzinnen.** Zie 4.2.

---

## 4. DE GRENZEN. Dit deel weegt zwaarder dan par. 1-3

### 4.1 De Reis is geen tweede boekingsadministratie

Zie 2.1. Praktisch: de reislaag heeft geen eigen collectie voor
boekingsgegevens, kopieert geen prijzen, en telt niets op wat een domein al
optelt. Waar hij een projectie deelt, deelt hij de bestaande pure functie --
zoals de Mall dat doet met `reisAanbod(db)` uit het reisbureau. Een reis die bij
het bureau € 2.200 kost en in de reismap € 22, is precies het soort verschil dat
niemand ziet aankomen.

### 4.2 Een wachter zonder bron zegt dat hij niet kijkt

De gevaarlijkste functie in dit hele document is RTG Guardian. Een groen vinkje
"wij houden je vlucht in de gaten" bij een wachter die in werkelijkheid niets
ophaalt, is erger dan geen wachter: dan gaat iemand ontspannen op tijd naar een
vliegveld waar zijn vlucht al drie uur geleden is geschrapt.

Daarom, als harde eis (`LAT.md` regel 3: een meter die zijn invoer mist, hoort
te falen en niet groen te blijven):

- elke bewaking draagt haar **bron** en haar **laatste meting**;
- valt de bron weg of wordt de meting oud, dan zegt het scherm *"RTG kijkt hier
  nu niet mee"* -- niet niets, en zeker geen vinkje;
- zolang er geen echte luchtvaart- of spoorbron is aangesloten, heet de
  bewaking wat ze is: een demonstratie op eigen gegevens.

### 4.3 Nooit een echt merk als bevestigde partner, nooit "geboekt" zeggen

Dit is de merkregel uit `CLAUDE.md`, en hij wordt door de invoerkant zwaarder
belast dan door wat dan ook. Zodra iemand een KLM-ticket inleest, staat er een
echt merk op een RTG-kaart. Dat mag -- als **feit over het document van het
lid**, met de herkomst erbij. Het mag niet als partner, als aanbeveling, of als
iets dat RTG geregeld heeft.

En de tweede helft: RTG zegt nooit dat iets geboekt of bevestigd is omdat een
document dat zegt. Het document zegt het. RTG geeft het door, met de bron erbij.

### 4.4 Een ingelezen waarde wordt nooit stilletjes verbeterd

Wat er in het origineel staat, staat er. RTG mag lezen, structureren en mooier
tonen -- niet corrigeren, aanvullen of gladstrijken.

Concreet, per gelezen veld: **waarde, bron, hoe gelezen, zekerheid, wanneer.**
Onder de drempel is een veld niet "waarschijnlijk goed" maar **te controleren**,
en het wordt niet gebruikt voor een automatische handeling. Het origineel blijft
bewaard en opvraagbaar als bewijsstuk; de RTG-kaart is een weergave en niet de
waarheid.

Dat is dezelfde vorm als de aanbod-normalisator, die een half object weigert en
die weigering meldt in plaats van hem stil over te slaan (LAT-regel 5).

**En de codes blijven van de uitgever.** Een boardingpass, treinticket of
evenementkaart houdt zijn eigen barcode; RTG toont die en maakt er nooit een
eigen code van. De ondertekende RTG-code (`dyncode`) is er voor wat RTG of een
partner zelf levert -- een excursie, een transfer, een tafel -- en vervangt
nooit een extern credential.

### 4.5 Er komt geen derde rechtenmodel bij

Wat de AI mag uitvoeren, is een echte vraag en hij hoort een echt antwoord te
krijgen. Maar niet in een eigen laag naast de twee die er al zijn -- dezelfde
regel als in `CONCERN.md`: toegang verlenen gebeurt waar de rol woont.

Dus: een AI-handeling wordt gewogen op de assen die er al zijn (de zes van
`functieschakelaars.js`, plus `bevoegdheid.js` voor wat RTG zelf mag), met één
toevoeging die er nog niet is: **een drempel per handeling en per bedrag**,
gezet door de mens. Lezen mag altijd. Iets kosteloos verzetten mag binnen
beleid. Geld uitgeven vraagt een mens, en boven een grens een tweede.

Twee dingen die daarbij niet onderhandelbaar zijn: de AI belooft **nooit**
toegang tot Lifestyle of Business (die gaan uitsluitend via menselijke
goedkeuring), en de AI bevestigt **nooit** zelf een reis aan een lid -- dat is
precies de knop die op 18 augustus met opzet aan een mens is gegeven.

### 4.6 Relevant zijn is niet hetzelfde als achtervolgen

"Rahul gaat over twaalf dagen naar Ibiza, verblijft op 800 meter van de haven en
heeft zaterdagmiddag nog niets" is een goede aanbeveling, en hij mag -- omdat
elk woord ervan uit **zijn eigen reis** komt. Wat niet mag is dezelfde zin
opbouwen uit wat andere leden deden zonder dat zij dat wisten, of uit gedrag dat
buiten deze reis is verzameld. Het vraagbeeld van de Mall staat er niet voor
niets zo in: geteld per woord, nooit per persoon, pas zichtbaar boven een
drempel.

En de aanbieding zelf blijft binnen de merkregels: geen kunstmatige urgentie,
geen aflopende klok, geen "nog twee beschikbaar" tenzij dat de waarheid is en
uit de voorraad van de partner komt.

### 4.7 Documenten zijn de zwaarste categorie die dit huis kent

Een reismap wil per definitie precies de dingen bewaren die het meest gevoelig
zijn: paspoortnummers, geboortedata, adressen, betaalgegevens. De bestaande
identiteitslaag (`kern/paspoort.js`) heeft daar al een antwoord op dat niet
opnieuw uitgevonden moet worden: versleuteld op schijf, drie niveaus
(bevestiging / idkaart / volledige scan), toestemming per aanvraag, elke inzage
tijdgebonden en gelogd, en het lid krijgt altijd bericht.

De reisdocumentenmap valt daaronder, niet ernaast. Klantgegevens draaien ook
hier op codenamen; de echte naam komt uit de kluis, per keer, met een reden, en
in het journaal.

### 4.8 De reiziger mag stoppen zonder alles kwijt te raken

Wie zijn reis bij RTG onderbrengt terwijl hij hem elders kocht, moet hem er ook
weer uit kunnen halen: de originelen zijn van hem. Invoeren is geen val.

---

## 5. Wat er bewust NIET komt

- **Geen eigen ticketvoorraad zonder de papieren die daarbij horen.** RTG
  verkoopt geen vliegtickets alsof het een luchtvaartmaatschappij of een
  geaccrediteerde agent is. Wat er niet is, wordt niet gespeeld.
- **Geen zevenhonderd zoekresultaten.** Drie complete voorstellen met een
  uitleg waarom, of niets. Een filterbalk is geen advies.
- **Geen AI die zelfstandig annuleert.** Zie 4.5.
- **Geen tweede prijs voor hetzelfde ding.** Eén projectie, gedeeld.
- **Geen kunstmatige haast**, in geen enkele vorm. Het aftellen zegt hoeveel
  dagen er nog zijn en verder niets -- zoals Het Huis dat al doet.
- **Geen ranglijst op reizen.** Geen niveaus, geen "je bent een Gold Traveller",
  geen wedstrijd. Dat is dezelfde grens als bij de spellen en bij het leven
  tussen mensen: wie hard reist is niet beter.

---

## 6. Het wereldpatroon, hier ingevuld

| Laag | Bij RTG Reizen | De regel die hem eerlijk houdt |
|---|---|---|
| **graaf** | de Reis: onderdelen uit alle domeinen en alle herkomsten op één tijdlijn, plus de vooruitblik (wat komt er, wat wordt krap) | leest alleen; bezit geen boeking; deelt de projectie van het domein |
| **beleid** | de reisregels van de reiziger zelf: niet vóór 09:00 vliegen, minimaal 90 minuten overstap, deze bank, dit budget, wat de AI mag uitgeven | het systeem handelt binnen beleid, nooit naar eigen inzicht |
| **cockpit** | de Reisbalie, uitzonderingsgestuurd: alleen wat aandacht vraagt -- ontbrekende bevestigingen, krappe aansluitingen, verlopende documenten, mislukte betalingen | rust is een uitkomst, geen leegte |
| **Rahul** | de concierge die de reis kent en bij elk antwoord zegt waaruit hij het weet | rekent met echte gegevens en noemt zijn bronnen; verzint geen inreisregels (Entourage weigert dat al) |
| **actielog** | elke wijziging, elk besluit, elke inzage, elke automatische handeling -- met wie, waarom en waaruit | groeit aan, wordt nooit herschreven |

---

## 7. Faseplan

Elke fase levert iets dat op zichzelf werkt. Geen fase mag een half object
achterlaten dat de volgende moet afmaken.

### Fase 1 -- De Reis bestaat

Het Journey-object: venster, reizigers, onderdelen met **soort** en
**herkomst**, tijdlijn. Gevuld uit wat er al is (`reiswereld.komend()` levert de
regels al; Het Huis levert de standen al). Nog geen invoer, nog geen bewaking.

*Klaar als:* een lid met een vlucht, een verblijf en een reisaanvraag in drie
verschillende domeinen één reis ziet met één naam, en elk onderdeel nog steeds
naar zijn eigen app wijst.

**Waar fase 1 staat: af** (18 augustus 2026). `kern/reizen.js` (de verdeling) en
`kern/reizen-vorm.js` (wat een Reis is als hij af is), `/api/reis/reizen`, en het
register van `/apps/reizen.html` staat per reis in plaats van als één rij. De
laag leest uitsluitend `reiswereld.komend()` en schrijft niets.

De verdeling gaat in twee ronden, en dat is geen elegantie maar een reparatie:
één ronde op datum liet elk geplaatst onderdeel het venster oprekken, waardoor
een vlucht op de 34e twee losse Dubai-reizen (t/m de 33e en vanaf de 35e) aan
elkaar **lijmde**. Nu vormen eerst de onderdelen mét een eigen venster het
geraamte; daarna worden de losse punten tegen die vastgezette vensters gelegd.
Past een punt bij twee reizen, dan wordt het losgelegd met de reden erbij in
plaats van in de eerste de beste geduwd — par. 4.1 in de praktijk.

Twee dingen die bij het bouwen boven water kwamen en die er los van staan:

- **een verblijf had helemaal geen plaats.** De reiswereld las `v.plaats`, en dat
  veld bestaat niet op een verblijfsrecord — de stad staat bij de zaak. Alle
  hotelovernachtingen stonden dus zonder bestemming in RTG Reizen, en De Reis kon
  ze bij geen enkele reis plaatsen. Opgelost in het domein dat het weet
  (`verblijf/gast.js` projecteert de stad van de zaak), niet in de laag erboven.
- **de stand telde regels en noemde ze reizen.** Een vlucht, een hotel en een
  aanvraag naar Dubai lazen als "3 reizen gepland". Nu er reizen zijn, telt hij
  reizen.

Wat deze fase met opzet **niet** doet: een terugvlucht herkennen. Het
vluchtdomein kent geen vertrekpunt (er zijn alleen boekingen op een vertrek vanaf
de eigen luchthaven), dus zou dat raden zijn. Zodra er retourvluchten bestaan,
heeft een onderdeel een **richting** nodig.

### Fase 2 -- De Invoerbalie

Eén ingang voor documenten en beelden, eerst voor het kantoor, daarna voor het
lid. Regelwerk waar het kan (een boardingpass en een e-ticket hebben een vorm),
een model alleen voor de rest, en per veld: waarde, bron, hoe gelezen,
zekerheid. Het origineel blijft, de codes blijven van de uitgever.

*Klaar als:* acht bestanden erin één reis opleveren, met de onzekere velden
zichtbaar gemarkeerd en geen enkel verzonnen veld ertussen.

### Fase 3 -- De bewaking

Wat er verandert, en wat dat raakt. Begint bij de bronnen die dit huis echt
heeft: de eigen domeinen, de Regelwacht (landregels), de documenten en hun
vervaldata, de betalingen. Externe vervoersbronnen komen erbij wanneer ze er
zijn -- en tot die tijd zegt de reis dat ze er niet zijn.

*Klaar als:* een verandering in een domein binnen één scherm zichtbaar is als
gevolg voor de rest van de reis, en een weggevallen bron zichzelf meldt.

### Fase 4 -- De partnerkant

Product, variant, voorraad, tijdslot, voorwaarden, media, afdracht -- met
moderatie vóór publicatie. De leeskant bestaat al (aanbod, bereik, vraagbeeld);
dit is de schrijfkant, met dyncode als fulfilment en de betaalopdracht als
afwikkeling.

*Klaar als:* een kleine ondernemer op zijn telefoon een tijdslot kan sluiten en
dat binnen een seconde in de reis van een lid klopt.

### Fase 5 -- Samenstellen

Dynamische samenstelling en de knop "los het op": alternatieven zoeken, gevolgen
doorrekenen, klaarzetten. Uitvoeren blijft bij het domein; bevestigen bij de
mens, binnen de drempels uit 4.5.

---

## 8. Wat V1 minimaal moet zijn om "RTG" te mogen heten

Niet de hele tabel uit de opdracht. Wel deze vijf, want zonder één ervan is het
een boekingssite met een mooie voorkant:

1. **Eén reis** met onderdelen uit meerdere herkomsten (fase 1).
2. **Invoer met bewijs**: origineel bewaard, zekerheid per veld, niets verzonnen
   (fase 2).
3. **Eerlijke bewaking**: met bron en laatste meting, en een stilgevallen bron
   die zichzelf meldt (fase 3, eerste bronnen).
4. **Een uitzonderingsgestuurde balie** voor het kantoor -- de vorm die de kamer
   Reisbureau sinds 18 augustus heeft.
5. **Een spoor**: van elke automatische handeling en elke inzage is achteraf te
   zeggen wie, waarom en waaruit.

En de zin die eronder hangt, voor buiten:

> **Het maakt niet uit waar je reis geboekt is. RTG maakt er één reis van --
> en zegt er altijd bij waar elk stuk vandaan komt.**
