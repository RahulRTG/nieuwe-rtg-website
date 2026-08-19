# PLAATS.md — plaats als laag, niet als functie

Opdracht van Rahul (19 augustus 2026), na de reparatie van de locatieschakelaar:
bouw plaats uit tot iets waar het huis werkelijk slimmer van wordt — enterprise
in wat het aankan, bijzonder in wat het weigert. Dit document legt vast wat dat
betekent, waar de grens ligt, en in welke volgorde het komt. `PLATFORM.md`
blijft gelden (de schil is één, de domeinkernen blijven); dit gaat over de laag
die eronder ontbrak.

## 0. De kern, in een zin

> RTG weet wát je nodig hebt zonder te weten wáár je bent geweest.

Vier werkwoorden: **waarnemen, herkennen, klaarzetten, uitleggen.** Elke nieuwe
plaatsfunctie hoort bij precies één van die vier. Er staat bewust geen vijfde
bij — *vastleggen* hoort er niet bij, en dat is geen omissie maar het hele
ontwerp. Wie een functie bedenkt die alleen werkt door een spoor te bewaren,
heeft geen functie bedacht maar een volgsysteem.

## 1. De harde grens: op het toestel eerst

**Een coördinaat verlaat het toestel niet, tenzij een lopende reden hem nodig
heeft.** Dat is de grens, en alles hieronder is eraan onderworpen. Concreet:

1. **Hekken zijn plaatsen, geen personen.** De server kent gebieden (een zaak,
   een vestiging, een zone, een werkorder, een halte). Die lijst is niet gevoelig
   en mag gewoon naar het toestel. Wat gevoelig is, is welk lid waar staat — en
   dat is precies het gegeven dat blijft waar het hoort.
2. **Het toestel rekent, de server hoort de uitkomst.** `shared/plaats.js`
   vergelijkt je positie lokaal met de hekken die het heeft opgehaald, en meldt
   alleen `{ hek, binnen|buiten, tijd }`. Geen lat/lng. Geen nauwkeurigheid. Geen
   snelheid.
3. **Een coördinaat mag alleen binnen een venster.** Een rit die loopt, een
   alarm dat af is, een wacht die opstaat: dán heeft een domein een echte
   coördinaat nodig, en dán pas. Het venster heeft altijd een einde, en dat
   einde staat in het venster zelf — het model dat `kern/veiligheid/plek.js` al
   hanteert, hier tot huisregel gemaakt.
4. **Geen spoor buiten een venster.** Sluit het venster, dan gaan de punten weg.
   Wat overblijft is hoogstens de laatste bekende plek, want dát is de plek die
   iemand nodig heeft als een telefoon uitvalt.

**Waarom dit ook zakelijk het sterkste is.** Elke concurrent stuurt bij elke
kaartweergave de positie van zijn klant naar Google of Mapbox. RTG doet dat
niet, want er ligt een eigen wegennet (`kern/navigatie/wegennet.js`) en een
eigen geometrie (`kern/stadsweefsel/geografie.js`). "Onze leverancier ziet uw
medewerkers niet, en wij zien ze ook niet" is een zin die vrijwel niemand kan
uitspreken, en het is een zin die bij een aanbesteding wint. De grens is dus
geen rem op het product; hij *is* het product.

## 2. Wat er al lag, en wat er ontbrak

Er was al veel meer dan het leek:

| Wat | Waar |
|---|---|
| Eigen wegennet met A*-route, bocht-voor-bocht, ETA per wijze | `kern/navigatie/wegennet.js` |
| Eén geografische waarheid: stad → wijk → buurt → zone → straatsegment, met echte geometrie | `kern/stadsweefsel/geografie.js` |
| Punt-in-vlak, afstand tot lijnstuk, omhullende — zuivere meetkunde | `kern/stadsweefsel/meetkunde.js` |
| Ruim honderd kernmodules die al coördinaten dragen | mobiliteit, ov, gemeente, mall, podium, luchthaven, beveiliging, horeca, modebezorg, … |
| Crowd-sourced verkeerslaag op codenaam | `kern/flits.js` |
| Een voorspeller met uitlegbare zekerheid | `kern/voorspel/` |
| Het graaf-patroon: bronnen → patronen → vooruitblik → uitzonderingen | `kern/geldgraaf/`, `kern/levensgraaf/` |
| Een openbaar algoritmeregister dat per regel zijn beperking noemt | `kern/stadsweefsel/algoritmeregister.js` |

En wat er ontbrak was niet een functie maar een **laag**. De positie woonde op
minstens vier plekken die niets van elkaar wisten:

- `db.data.ontmoetPosities` — de radar, met een eigen TTL
- `db.data.veilig.plek` — het levensteken, met een eigen spoorregel (max 12 punten)
- `opdracht.positie` + `trip.location_updated` — de rit, met een eigen gebeurtenislimiet
- `db.data.live` / `db.data.rides` / `db.data.bevRondes` — vervoer en patrouille

Vier waarheden, vier bewaarregels, en **geen enkele ervan stond in
`server/bewaarbeleid.js`** — dat kende 24 takken en niet één was een positie.
`geografie.js` schrijft zelf op waarom dat misgaat: *"Twee plekken die dezelfde
waarheid vasthouden lopen uiteen."*

Twee gevolgen die je zonder deze laag niet kunt wegwerken:

1. **Er was geen hek.** `inVlak()` bestond, maar werd alleen gebruikt om te
   vrágen in welke zone een punt ligt — nooit om iets te laten gebeuren als
   iemand er binnenkomt. Prikklok, patrouille, dispatch-SLA, aankomst,
   bezorgvolg: dat zijn allemaal hekken, en er was er niet één.
2. **De voorspeller kende geen plaats.** `kern/voorspel/` leert uitsluitend uit
   `payBoekingen`: hij weet wánneer en wát, nooit wáár. Daardoor is "je bestelt
   meestal om 19:00" het maximum, terwijl "je bestelt om 19:00 als je thuis
   bent, en je bent nu onderweg" het verschil is tussen een aardige suggestie en
   iets wat klopt.

## 3. De plaatslaag (`kern/plaats`)

Vier begrippen, en het is belangrijk dat het er vier zijn en niet één veld.

**Hek** — een gebied met een naam en een doel. Komt zoveel mogelijk uit
geometrie die er al is (een gebied uit het weefsel, het adres van een zaak, een
vestiging, een werkorder) in plaats van uit een tweede tekening. Een hek draagt
zijn **doel**: waarvoor bestaat hij, en wie mag zijn uitkomst zien. Een hek voor
de prikklok van je werkgever is iets anders dan een hek rond je eigen huis, en
het verschil hoort in het model te zitten en niet in de discipline van wie de
volgende route schrijft.

**Waarneming** — dat een toestel een hek binnenkwam of verliet, met de tijd. Dit
is het enige dat standaard de server bereikt. Een waarneming draagt een codenaam
en nooit een naam, en ze draagt het doel waarvoor ze is gemaakt: een waarneming
gemaakt voor de prikklok mag niet ineens de radar voeden.

**Venster** — de toestemming, met een einde erin. Buiten een venster is er geen
waarneming en geen coördinaat. Een venster ontstaat uit iets dat werkelijk
loopt (een dienst, een rit, een wacht, een alarm) of uit een uitdrukkelijke tik
van het lid, en het sluit zichzelf.

**Actielog** — wat er is waargenomen en wat er op grond daarvan is klaargezet,
aangroeiend en nooit herschreven. Dit is wat het verschil maakt tussen een
systeem dat je vertrouwt en een systeem dat je moet geloven.

### De vijf lagen van het wereldpatroon

`PLATFORM.md` schrijft voor dat een wereld pas af is als hij zijn onderwerp
begrijpt. Plaats krijgt dezelfde vijf lagen, met het werkwoord bewust gekozen:

| Laag | Wat het hier is |
|---|---|
| **graaf** | de plaatsgraaf: leest hekken, waarnemingen en de geometrie van het weefsel, en zet er nadering en aanwezigheid uit af. Leest alleen. Bezit niets |
| **beleid** | wie welk hek mag zien, welk doel welk venster opent, en hoe lang. Van de mens, niet van het systeem |
| **cockpit** | uitzonderingsgestuurd: niet "waar is iedereen", maar "wie is er niet waar hij zou moeten zijn". Rust is een uitkomst |
| **Rahul** | rekent met echte waarnemingen en noemt zijn bron: welk hek, welk moment, welk venster |
| **actielog** | groeit aan, wordt nooit herschreven |

**Het werkwoord van de vierde laag is *klaarzetten*, nooit *doen*.** Plaats
opent een deur, zet een bon klaar, meldt een aankomst — een mens bevestigt. Dat
sluit aan op LIFE.md ("samenstellen en klaarzetten — bevestigen doet de mens").
Een geofence die zelfstandig geld beweegt, een dienst afsluit of iemand ergens
binnenlaat is een geofence te ver.

## 4. Wat plaats toevoegt aan wat er al staat

Drie richtingen, en alle drie hangen ze aan dezelfde laag.

**Aanwezigheid (de zakelijke kant).** Eén hek-motor bedient de prikklok, de
patrouille (`kern/beveiliging/pda/patrouille.js`), de dispatch-SLA
(`kern/mobiliteit/`), de bezorgketen (`kern/bezorgvolg.js`) en het toewijzen
van een werkorder aan wie het dichtst is (`kern/stadsweefsel/`). Dat is de
functie waar een bedrijf voor tekent, en het is er één en niet vijf. De
verkoopbare zin: *aanwezigheid zonder volgen* — de werkgever ziet dat iemand er
was, niet waar iemand is geweest.

**De voorspeller leert plaats.** Plaats als bron voor `kern/voorspel/`, in
dezelfde vorm als de bestaande bronnen en met dezelfde eerlijkheid over
zekerheid ("nog te weinig geschiedenis" blijft een geldig antwoord). Wat het
oplevert is niet meer voorspellingen maar minder verkeerde: een gewoonte die
aan een plaats hangt wordt niet voorgesteld op een moment dat je daar niet bent.

**De stad die weet dat je komt.** Nadering — niet aankomst — is het signaal.
`arrival`, `hoteldorp`, `mall`, `avond/plan`, de residentie: alles wat nu wacht
tot je er bent, kan klaarstaan voordat je er bent. Hier ligt het grootste
gevoel en het grootste risico, en daarom geldt hier de vierde-laag-regel het
strengst: klaarzetten, en de mens bevestigt.

### Wat fase 3 opleverde: plaats spreekt alleen over nu

De voorspeller (`kern/voorspel/`) leerde uitsluitend uit het grootboek: hij weet
*wanneer* en *wat*, nooit *waar*. Daardoor was "je bestelt meestal om 19:00" het
maximum, terwijl "je bestelt om 19:00 als je thuis bent, en je bent nu onderweg"
het verschil is tussen een aardige suggestie en iets wat klopt.

**Wat plaats hier niet doet, en niet kan: leren.** De laag houdt geen spoor, dus
er valt uit plaats geen patroon over tijd af te leiden — en dat is met opzet zo.
Plaats spreekt alleen over *nu*: ben je op dit moment in de buurt van de zaak
waar deze gewoonte over gaat. Wie hier ooit een "je gaat woensdags altijd naar
het noorden" bij wil bouwen, bouwt een locatiegeschiedenis, en die bestaat hier
niet.

**Drie uitkomsten, en de derde draagt het ontwerp.** Bevestigd nabij gaat naar
voren; bevestigd niet-nabij zakt naar achteren; *niet gemeten* blijft ongemoeid.
Zou die derde hetzelfde doen als de tweede, dan wordt elk lid dat zijn locatie
uit laat staan stilletjes slechter bediend — een boete op een keuze die vrij
hoort te zijn.

**Er valt niets weg, en het getal verandert niet.** Klaarzetten is het werkwoord:
een gewoonte verbergen omdat je er nu niet bent, zou een lid zijn eigen gewoonte
kunnen afnemen. En de zekerheid blijft staan voor een geleerde frequentie —
nabijheid erbij optellen zou dat getal iets anders laten betekenen dan het zegt.
Plaats verandert alleen de volgorde, en staat als eigen veld naast de
verwachting zodat je kunt zien dat het meespeelde.

**Het stille seintje houdt zich in.** De rangschikking laat een verwachting al
zakken, maar het seintje is indringender: het fluistert ongevraagd mee. "Rond
deze tijd, als u wilt: uw gebruikelijke bezoek" terwijl je dertig kilometer
verderop staat, is precies het meepraten waardoor iemand het hele systeem niet
meer gelooft. Alleen bij een *bevestigde* niet-nabij; bij niets gemeten praat hij
gewoon mee.

**En het doel is `nadering`, niet `dienst`.** Een waarneming die is gemaakt om je
aanwezigheid op je werk te bevestigen, mag geen aanbeveling voeden. Dat is grens
2 hieronder, en het is precies waarvoor een hek zijn doel draagt.

**Een gat dat hier zichtbaar wordt en niet stilletjes gedicht hoort te worden.**
`kern/stadsweefsel/algoritmeregister.js` is een openbaar register dat per
rekenregel zegt wat hij doet, welke gegevens hij gebruikt, wat zijn beperking is
en waar je terecht kunt — maar het gaat uitsluitend over het *weefsel*, en zegt
dat ook van zichzelf. De voorspeller heeft geen equivalent. Wat hij wel heeft is
het `waarom` per verwachting, en daar staat plaats nu ook in. Dat is uitleg op
de plek waar een lid kijkt, maar het is geen register. Of dat register
huisbreed moet worden, is een eigen beslissing en geen bijvangst van deze fase.

## 5. De grenzen

Waar een functie hiermee botst, vervalt de functie.

1. **Geen spoor.** Buiten een lopend venster bestaat er geen reeks punten. Niet
   ingekort, niet geanonimiseerd, niet "voor analyse" — niet.
2. **Geen plaats zonder doel.** Elke waarneming draagt het doel waarvoor ze is
   gemaakt en is buiten dat doel onbruikbaar. Een hek voor een dienstrooster
   voedt geen advertentie, geen radar en geen aanbeveling.
3. **Geen oordeel over een mens.** Het weefsel houdt zich er al aan
   (`algoritmeregister.js`: "er is geen regel die een oordeel over een persoon
   vormt") en plaats verandert daar niets aan. Geen betrouwbaarheidsscore uit
   bewegingsgedrag, geen risicoprofiel uit waar iemand komt.
4. **De werkgever krijgt aanwezigheid, geen locatie.** Binnen of buiten het
   hek, met een tijd. Niet de coördinaat, ook niet "hoe ver erbuiten".
5. **Uitzetten is uitzetten.** De schakelaar in het bedieningspaneel blijft de
   baas, en "uit" wist wat er lag — niet "bewaard maar even niet gebruikt".
6. **Nooit stil overslaan waar plaats de functie is.** De regel die uit de
   reparatie van 19 augustus komt: een lijst zonder afstanden is nog een lijst,
   maar een knop "dichtstbij eerst" die niets doet is een defect. Wie plaats
   echt nodig heeft, vráágt erom met de reden erbij (`shared/plek.js`).

## 6. Wat er bewust NIET komt

- **Geen kaartdienst van derden.** Niet voor tegels, niet voor geocoding, niet
  voor "even snel" een adres omzetten. De CSP staat het niet toe en dat is geen
  toeval.
- **Geen achtergrondlocatie zonder lopende reden.** Een app die peilt terwijl
  niemand kijkt is precies wat `shared/plek.js` al tegenhoudt met zijn
  stopfunctie op `pagehide`.
- **Geen locatiegeschiedenis als product.** Geen jaaroverzicht "waar je was",
  geen tijdlijn, hoe leuk het ook oogt. Dat is het ene ding dat dit ontwerp
  onmogelijk maakt, en dat hoort zo.
- **Geen locatie in de identiteitskluis.** Codenaam en positie horen niet in
  dezelfde rij. De kluis (`server/accounts.js`) blijft waar echte namen wonen,
  en plaats komt daar niet.

## 7. Faseplan

| Fase | Wat | Status |
|---|---|---|
| **1** | De laag: hekken, waarnemingen, vensters, actielog, bewaarbeleid, en de hek-motor op het toestel (`shared/plaats.js`) | **af** |
| **2a** | Aanwezigheid, de motor + de eerste klant: `plaatsBijZaak()` met drie uitkomsten, stabiele hek-id's op zaakcode, en de prikklok (`/api/staff/clock`) die de bevestiging vastlegt | **af** |
| **2b** | Het bronnenregister: een domein levert zijn eigen plaatsen als hek. Twee bronnen bedraad (je werkplekken, de posten van je beveiligingsteam) | **af** |
| **2c** | De brug: een lopende dienst wordt in de app van het lid aangeboden, en het venster sluit als de dienst voorbij is | **af** |
| **3** | Plaats als bron voor `kern/voorspel/`: nabijheid verandert de volgorde en houdt het stille seintje in, en leert nooit iets | **af** |
| **4** | Nadering: arrival, mall, hoteldorp, avond/plan — klaarzetten vóór aankomst | open |

De volgorde is niet vrij. Fase 2, 3 en 4 bouwen alle drie op fase 1; ze eerder
beginnen levert de vijfde positie-opslag op, en dan is dit document een verhaal
in plaats van een ontwerp.

### Wat fase 2a opleverde, en waar het op wacht

**De architectuur is de opbrengst: je telefoon neemt waar, de kassa vraagt.** Het
toestel draait de hek-motor onder het eigen LEDENaccount van de medewerker
(codenaam); de prikklok draait op een ZAAK-inlog en stelt alleen een vraag. De
twee sessies raken elkaar nooit en er gaat geen coördinaat over de lijn. Wat de
werkgever ziet is binnen of buiten met een tijd — grens 4, afgedwongen door
`plaatsBijZaak()` als enige ingang.

**Drie uitkomsten, nooit twee.** *Bevestigd* (het toestel keek en je stond er),
*niet bevestigd* (het keek en je stond er niet) en *niet gemeten* (er keek
niemand: geen venster, geen gekoppeld ledenaccount, of een toestel dat niets
afgaf). Die laatste twee samenvoegen maakt van elke ongemeten inklok een
verdachte inklok, en dan is dit geen aanwezigheidslaag meer maar een
beschuldigingslaag. `test/plaatsprikklok.test.js` houdt ze uit elkaar.

**Wat er onderweg wegging.** `kern/beveiliging/pda/patrouille.js` bewaarde bij
het inklokken de positie van de bewaker op zijn dienst. Niemand las hem ooit:
`dienstPubliek()` geeft hem niet terug, geen scherm toont hem, geen rapportage
rekent ermee. Een coördinaat die niemand leest is geen functie maar alleen een
risico — en juist bij een bewaker, wiens werkgever daarmee precies wist waar hij
op welk moment stond. Weg, tot fase 2b de hek-bevestiging bij de post kan geven.

### Wat fase 2b opleverde

**Het bronnenregister** (`kern/plaats/bronnen.js`). De posten van een
beveiligingsteam, de depots van een dispatch en de werkorders van het weefsel
zijn ook plaatsen waar aanwezigheid telt, maar ze staan in geen enkele algemene
plekkenlijst. Er waren drie wegen en twee ervan zijn fout:

- **fout** — de plaatslaag laten lezen in elk van die domeinen. Dan kent hij de
  datavorm van vijf andere domeinen en verandert hij mee met alle vijf.
- **ook fout** — de hekken kopiëren naar `db.data.plaatsHekken` bij het
  aanmaken. Dan bestaat de plek twee keer en lopen ze uiteen zodra er een adres
  wijzigt.
- **goed** — het domein dat de plek bezit *levert* hem, in dezelfde vorm, op het
  moment dat ernaar wordt gevraagd. Niets gekopieerd, niets over een grens
  gelezen, één waarheid. Het is het patroon dat dit huis al heeft in
  `kern/geldgraaf/bronnen.js` en `kern/levensgraaf/bronnen.js`.

**De harde regel voor een bron:** hij mag alleen plaatsen teruggeven die dit lid
sowieso al mag zien. De hekkenlijst gaat naar het *toestel*, dus een bron die
niet filtert zet die lijst op de telefoon van elk lid dat de route aanroept.
Welke objecten een beveiligingsbedrijf bewaakt is bedrijfsgevoelig — daarom
krijgt een bron de codenaam én de ledensleutel, en is filteren zijn taak en geen
extraatje.

**Twee bronnen bedraad** (`server/opzet/plaatsbronnen.js`, bewust een
bedradingsbestand: de plaatslaag hoeft niet te weten hoe een beveiligingsteam
zijn posten opslaat, en dat team hoeft niet te weten dat er zoiets als een hek
bestaat):

1. *werkplek* — de zaken waar dit lid werkelijk werkt. Hiervoor stond op het doel
   `dienst` gewoon de hele leverancierslaag: elk toestel kreeg elke zaak van het
   eiland als hek. Onschuldig, maar verkeerd — aanwezigheid op je werk gaat over
   jouw werkgevers.
2. *bevpost* — de posten van je eigen beveiligingsteam. Hiermee sluit de kring
   die bij 2a openging: de rauwe positie op de dienst is weg, en wat ervoor
   terugkomt is binnen of buiten de post, met een tijd.

**En een mutatie die niet beet.** Het terugzetten van `d.lat` op de dienst liet
geen enkele schermtoets zakken, want `dienstPubliek()` gaf hem toch al niet
terug. Door het raam kijken in plaats van in de la — dezelfde fout als bij het
sluiten van een venster in fase 1. Een belofte over wat er *niet* wordt bewaard,
controleer je in de opslag zelf; daar staat nu een unit-toets op de kern voor.

### Wat fase 2c opleverde: de brug, met een mens ertussen

De hek-motor draait in de leden-app; een dienst leeft in de personeels-app. Die
twee sessies raken elkaar bewust nooit — dat is de kracht van het ontwerp, en
tegelijk de reden dat een venster alleen met de hand open kon.

**De deur die dicht moest blijven.** Het lag voor de hand om de zaak het te laten
doen: bij het inklokken meteen een venster openen op het account van de
medewerker. Eén regel code, en klaar. Maar dan opent een *werkgever* een
toestemming op de telefoon van zijn personeel, en toestemming die een ander voor
je geeft is geen toestemming. `test/plaatsdienstbrug.test.js` toets 2 bewaakt
precies die deur.

**Wat er wel mag is klaarzetten.** `/api/plaats/dienst` vertelt het *lid* dat zijn
eigen dienst loopt — eigen data, geen andere mens erin, geen plek erin. Zijn eigen
app (`shared/plaatsdienst.js`) biedt het hem aan met dezelfde rustige kaart als
`plek.js`, en de tekst zegt wat er gebeurt én wat er niet gebeurt: *je werkgever
ziet dat je er was, niet waar je bent geweest.* Eén tik en het staat aan; geen tik
en er gebeurt niets, deze sessie niet meer gevraagd.

**Uitgeklokt is uitgekeken.** Het venster sluit zodra de reden ervoor weg is — niet
alleen een einddatum die vanzelf verloopt, maar een toestemming die weggaat op het
moment dat ze niet meer nodig is. En alleen een venster dat de app zélf voor die
dienst opende: een venster dat het lid om een andere reden openzette, is niet van
ons om te sluiten.

**Waarom hier een schermtoets naast de servertoets staat.** De serverkant bewijst
dat de zaak geen venster opent en dat er na het uitklokken niets ligt. Wat die
toets niet kan zien is het stuk waar het om draait: dat er een *mens* tussen zit.
Een app die stilletjes zelf op ja drukt, komt daar precies zo doorheen.
`test/plaatsdienstbrug.e2e.js` meet in een echte browser dat het aanbod verschijnt
en dat er tot de tik niets is waargenomen.
