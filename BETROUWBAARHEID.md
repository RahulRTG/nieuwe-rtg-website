# RTG Product Reliability — wanneer bestaat een functie?

Dit is een richtingsdocument zoals `PLATFORM.md` en `ECONOMIE.md`: per onderdeel
staat er of het **staat**, **een stap weg** is, **een besluit vraagt** of **jaren
weg** is — zodat niemand die vier voor elkaar aanziet.

## 0. De definitie

> **Een functie bestaat pas als een echte gebruiker haar volledige bedoeling
> succesvol kan voltooien, de uitkomst correct wordt opgeslagen, fouten
> begrijpelijk worden afgehandeld, rechten kloppen en dezelfde stroom na storing,
> refresh en herhaling betrouwbaar blijft werken.**

Alles hieronder volgt daaruit. De zin is streng met opzet: hij sluit precies de
uitspraken uit die dit huis over zichzelf kon doen zonder te liegen, en die toch
niets waard bleken — *"de pagina laadt"*, *"de toetsen staan groen"*, *"de
bestanden bestaan"*.

## 1. De meeteenheid is een belofte, niet een scherm

`Navigatie` is niet `/apps/navigatie.html`. De belofte is *breng mij vanaf waar
ik nu ben naar mijn bestemming*, en daaronder vallen de locatiepoort, het zoeken,
de kaartdata, de routering, de overlays, het gedrag bij time-out en de status die
het scherm toont. Pas als die keten sluit, mag Navigeren groen.

Daarom telt dit register per **onderdeel uit `MAPPEN`** — de enige lijst werelden
(`WERELD.md`) — en niet per HTML-bestand. Een onderdeel is een ingang die aan
iemand wordt getoond, en dat is precies het niveau waarop een gebruiker teleur­
gesteld wordt.

**Dat de eenheid een belofte is, was al besloten en half gebouwd.** `BELOFTE.json`
houdt 79 beloften bij met hun dekking, en `BELOFTE.md` zegt zelf waar het ophoudt:

> *"Dit register beoordeelt geen kwaliteit. Dat een bestand bestaat, zegt niet dat
> de belofte goed is ingelost."*

Dat gat is wat hier dichtgaat. `BELOFTE.json` blijft de dekkingsvraag (bestaat
het), `APPWERKT.json` wordt de werkvraag (doet het het). Ze worden niet
samengevoegd: een belofte kan gedekt zijn en stuk, en dat verschil moet zichtbaar
blijven.

## 2. De acht bewijzen

| # | bewijs | de vraag | stand |
|---|---|---|---|
| 1 | **bereikbaar** | vindt de gebruiker de functie vanaf de plek waar RTG haar presenteert? | **staat** (`APPWERKT.json`) |
| 2 | **bedienbaar** | doen de knoppen, tabs, velden, uploads en gebaren iets, zonder te breken? | **een kwart** — knoppen wel, formulieren/uploads/toetsenbord niet; en een groot deel van wat er staat is niet aan te tikken omdat er iets overheen ligt (zie par. 5) |
| 3 | **voltooibaar** | kan de hele stroom worden afgemaakt, tot en met de bevestiging? | **een stap weg** (vraagt de testwereld uit par. 4) |
| 4 | **waarheidsgetrouw** | toont de UI nooit een sterkere toestand dan de backend heeft bewezen? | **een stap weg** (`SCHERMLEUGEN.json` doet dit voor 6 schermen) |
| 5 | **persistent** | komt de juiste toestand terug na refresh, nieuwe sessie, andere browser? | **een stap weg** |
| 6 | **bevoegd** | kan een andere rol, een ander gezin of een ander bedrijf hier niets? | **half** — de routekant staat (`IDOR.json`, `ROLPROEF.json`), de schermkant niet |
| 7 | **herstelbaar** | overleeft de functie uitval, time-out, dubbelklik en een afgebroken verzoek? | **een stap weg** (`HERSTELPROEF.json`, `chaos.js`, `aanval.js` bestaan al) |
| 8 | **menselijk** | krijgt de gebruiker nooit een kale 500, TypeError, lege pagina of dode knop? | **half** — kale fouten worden gezien, de bruikbaarheid van een melding niet |

Bewijs 1, 2 en 8 worden vandaag gemeten door `npm run appwerkt`. De andere vijf
staan in `APPWERKT.json` per rij met de stand `GEEN_FIXTURE` **en de reden**. Ze
weglaten zou erger zijn dan ze op rood zetten: een ontbrekend bewijs leest als een
gehaald bewijs.

## 3. De standen zijn gesloten

    BEWEZEN                   gemeten en in orde
    GEBLOKKEERD_DOOR_DEFECT   gemeten en stuk; hier moet code voor worden gerepareerd
    GEBLOKKEERD_DOOR_CONFIG   de code klopt, de omgeving mist iets — en de server
                              zegt dat zelf (een `hoe` in het antwoord, of een 503
                              die naar een niet-ingelezen bron wijst)
    GEEN_FIXTURE              niet te meten zonder testwereld, met de reden
    NIET_GETEST               deze ronde niet aangeraakt, met de reden

**"Waarschijnlijk goed" bestaat niet.** Dat is dezelfde regel als in
`BESTUUR.md` (`niet vast te stellen` is een eersteklas uitslag) en in
`MUTATIECONTRACT.md` (100% geclassificeerd, 0% schijnzekerheid). De stand van een
rij is de **strengste** van haar bewijzen; een rij waarvan alleen ongemeten
bewijzen over zijn, is nooit groen.

### Een deur is geen defect, en een defect is geen deur

Bewijs 1 kent drie toegangspoorten als **mechanisme** en niet als woordenlijst:
`#poort.zien` (de losse schermen), `.rtf-toegang-dicht` (de gezinspoort) en
`.rtf-school-dicht` (de schoolpoort). Staat er een deur, dan zijn er precies twee
uitkomsten:

- **een andere bekende persona komt er wél door** → `GEBLOKKEERD_DOOR_DEFECT`.
  De ingang is aan de verkeerde persoon geadresseerd. Dat is de "Vrienden"-fout.
- **niemand van de vier komt er door** → `NIET_GETEST`, met de tekst van de deur
  erbij, en apart geteld als `deurenZonderPersona`.

Die tweede is met opzet geen beschuldiging. Misschien is de functie onbereikbaar,
misschien kent de proef de rol niet die er wel doorheen komt — een docentencode,
een keurder, een gemeente. Een defect melden dat je niet kunt onderbouwen kost dit
register bij de eerste ronde zijn geloofwaardigheid; apart tellen houdt het
werkvoorraad in plaats van ruis. De eerste volle ronde leverde die correctie
meteen op: `Het bord` en `Het schrift` kwamen als defect binnen en zijn een
docentendeur.

Het onderscheid **DEFECT tegenover CONFIG** is niet cosmetisch. Het eerste is werk
voor wie bouwt, het tweede voor wie uitrolt, en ze door elkaar halen kost beide
kanten een dag. Het wordt daarom niet geraden maar **gelezen uit wat de server
zelf zegt** — vandaar dat `kern/navigatie/dekking.js` bij zijn weigering een `hoe`
meestuurt in plaats van alleen nee te zeggen.

## 4. De gecontroleerde testwereld — het grootste ontbrekende stuk

De huidige proef raakt met opzet niets aan dat onomkeerbaar is: betalen,
verwijderen, versturen, uitloggen. Elke rij noemt wat hij daarom oversloeg. Dat is
eerlijk en het laat precies het duurste risico ongemeten.

**Vraagt een besluit.** De uitweg is geen vlag in de productiecode — die regel
staat al vast in `MAGNAATLAB.md`: *een simulatie-adapter vervangt de rail, nooit
de poort*. `kern/pay/poort.js` kent geen enkele demo-stand en dat moet zo blijven.
De testwereld bestaat daarom uit adapters náást de echte, elk met een grendel die
fail-closed is:

| wat | hoe | stand |
|---|---|---|
| betalen | vierde provider naast de demo-provider | **staat**: `server/betaal/synthetisch.js`, achter `RTG_SIMULATIEBANK=1`, nooit naast een echte provider, nooit in productie |
| mail | sink-mailbox | **een stap weg**: `SMTP_URL=''` en `server/data/outbox/` bestaan al |
| sms | test-adapter | **een stap weg**: `sendSms` in `server/mail.js` en `server/mail-lokaal.js` — twee choke points, niet één (`KOSTEN.md` telt ze zo) |
| verwijderen | wegwerpdata | **staat**: elke proef draait al op een eigen `RTG_DATA_DIR` |
| boekingen | synthetische leveranciers | **staat**: de seed levert ze (`KIKUNOI`) |
| ritten | gesimuleerde voertuigen | **half**: `kern/mobiliteit/` heeft de standen, geen simulator |
| bellen/video | test-identiteiten | **vraagt een besluit**: WebRTC in een headless browser |
| AI | testmodel | **staat**: `LOCAL_AI_URL`, en zonder model is de handmatige werkmodus zelf de uitkomst die getoetst hoort te worden |
| locatie | gesimuleerde GPS-trajecten | **staat**: Playwright `geolocation` + `permissions` |

De regel die daarbovenop hoort: **een simulatie-adapter mag nooit een handeling
laten slagen die in het echt niet zou slagen.** Vandaar dat de synthetische bank
vier afloopen kent (`betaald`, `geweigerd`, `traag`, `terugboeking`) en niet één.

## 4a. Bewijs samenstellen — wat er al gemeten is, laten tellen

**Staat** (24 september 2026). De eerste stap naar de testwereld is geen nieuwe
fixture maar een naad: er lagen gesloten ketenproeven die complete stromen lopen,
en `APPWERKT.json` las er geen enkele. Een app mag nu een bewijs **samenstellen**
uit een proef die al bestaat. Drie stukken, en geen van drie is een nieuw
framework:

- **`scripts/lib/appcontract.js`** zegt per app welke bron welk bewijs mag
  leveren. Het is een verklaring en nooit een uitslag: er staat geen stand in, en
  `test/appcontract.test.js` zakt als iemand er toch een in zet. Alleen de acht
  bewijzen van par. 2 — er komt geen negende.
- **`scripts/lib/bewijsbron.js`** beslist of de bron het op deze code verdient,
  in drie stappen waarvan de eerste die faalt de uitslag bepaalt: de **koppeling**
  is gemeten (de proef raakt routes die de ingang aanroept, via
  `SCHERMROUTES.json` en de scripts die de ingang laadt), het register is **vers**
  (`versheid()` uit `scripts/lib/stempel.js`, en met opzet geen tweede grendel),
  en de keten **sluit** (de schakels zelf, niet de samenvattende telling).
- Verouderd is `NIET_GETEST` en nooit `GEBLOKKEERD_DOOR_DEFECT`: er is dan niets
  gemeten dat stuk was. Vers met een open schakel is `DEFECT` en nooit
  `NIET_GETEST`: dan is er wel iets gemeten.

**Een ketenproef levert precies één bewijs: `voltooibaar`.** Zijn storingen zijn
dubbele tikken, verkeerde rollen en verboden standen — dat is niet wat
*herstelbaar* hier betekent (uitval van Redis of PostgreSQL, een providertimeout,
een verzoek dat midden in een mutatie afbreekt). Er is geen herstart, dus ook geen
*persistent*; hij leest API-antwoorden, dus geen *waarheidsgetrouw*; en een
handvol verkeerde-rol-storingen is geen kruisproef, dus geen *bevoegd*. Wie een
keten voor een van die vier laat tellen, voert het verkeerde experiment uit met
een geldige uitslag (`BEWIJSMACHINE.md` par. 6a).

**De meting die het verwachte beeld corrigeert.** Het leek alsof zeven gesloten
ketens veel gratis bewijs waren. Gemeten op de routes landt er **één** op de
kernbelofte van een app in `MAPPEN`: de tafelproef op Horeca (twaalf gedeelde
routes onder `/api/supplier/horeca/`). De andere zes staan in `ZONDER_APP`, elk
met de reden en wat er nodig is:

| keten | waarom hij (nog) niet telt |
|---|---|
| rit | geen scherm roept `/api/ride/request` aan; de rit start in een stand van de ledenapp zonder eigen adres |
| Adam | loopt over `/api/rtf/solliciteer` en `/api/concern/*`; geen ingang in `MAPPEN` roept die aan |
| moment | raakt RTG Media, maar alleen de deelbelofte volgen en gewekt worden |
| toelating, zaak-live | de zaak- en kantoorkant; `MAPPEN` kent alleen lid- en gezinswerelden |
| lus (Connect) | schrijft geen register, en `connect.html` staat niet in `MAPPEN` |

De routeoverlap is **nodig en niet voldoende**: vandaar de belofte in woorden bij
elke koppeling. Een keten die een deelbelofte loopt, verdient het bewijs van de
hele app niet. Twee valkuilen die de meting zelf opleverde: een scherm met het
voorvoegsel `/api/` leek op alle zeven ketens te landen (een voorvoegsel telt pas
vanaf twee segmenten), en vijf van de zes registers droegen een kale datum in
plaats van een stempel, zodat `versheid()` er niets over kon zeggen. Die vijf
schrijven nu het huisstempel.

**Wat dit betekent voor de volgorde.** Samenstellen schaalt niet door meer ketens
te schrijven maar door de wereld eronder: de bewijsbron is gebouwd om later ook
een wereldproef, een autorisatieproef en een verraadproef te lezen (elk met zijn
eigen bewijs in `BRONSOORTEN`, nooit door een bestaande soort op te rekken). Dat
is de volgende stap: de bestaande `scripts/lib/wereld-*.js` onder één compositor,
zodat een app alleen verklaart welke wereld hij nodig heeft.

## 4b. Werelden samenstellen — een app vraagt wat hij nodig heeft

**Staat** (24 september 2026). De testwereld van par. 4 hoeft niet gebouwd te
worden: hij ligt er in stukken. Er zijn elf wereldbouwers (`scripts/lib/wereld-*.js`),
elk geschreven omdat een groep routes op "bestaat niet" strandde. Wat ontbrak was
een manier om ze te **vragen**. Ze werden op één plek samengesteld, een vaste lijst
van zes in `scripts/idemproef-route.js`, en **vijf werden door geen enkele proef
gebruikt**: horeca, school, spel, signature en wortels. Alleen hun eigen
unittoetsen riepen ze aan.

`scripts/lib/wereldcompositor.js` is het register en het plan erboven, zonder een
bouwer te herschrijven. `plan(['horeca'])` is een pure functie: welke werelden,
in welke volgorde, en welke fundering (server, sleutelbos, lijfsleutelfamilies).
Wie horeca vraagt, krijgt de gastfamilie en een open rekening, en niet de hele
stad. `npm run wereld -- horeca school` bouwt het op een wegwerpserver en meldt per
wereld klaar of niet, met de reden, en daarna of hij na afloop nog staat.

De eerste echte bouw van de vijf ongebruikte werelden: **vier komen op**
(signature, horeca, school, wortels). **Spel eerst niet**, met een eerlijke
reden: de bouwer vraagt een `member-account`-sessie, en geen enkele munter in
`scripts/lib/proefsleutels.js` maakte die. Die munter staat er sinds ronde C: een
vers gratis account langs de gewone registratie, en in `GEEN_BEWAKER`, zodat de
verdeling van routes over rollen voor geen enkele proef verandert. Daarmee komen
alle elf werelden op.

**Het meetinstrument kreeg in dezelfde ronde een vierde bak**
(`scripts/lib/foutindeling.js`). De proef vult geen formulieren in, dus een tik op
"toevoegen" met een leeg veld levert een 400 met een zin als "Schrijf op wat er
gebeurde." Dat is een weigering met een reden en geen defect. De bak is smal:
alleen 400, 409 en 422, en alleen met een `error` die een zin is. Een code als
`BAD_REQUEST` of een 500 met een nette zin blijft stuk. Wat de indeling niet kan
zien, is of het scherm de zin ook toont. Daarom blijven weigeringen per rij
geteld in de reden van `bedienbaar`, en verdwijnen ze niet.

Een app verklaart zijn wereld in `WERELD` in `scripts/lib/appcontract.js`, en ook
dat is gemeten: de bouwer raakt minstens twee routes van de ingang, en **geen andere
wereld raakt er meer**. Een vaste drempel alleen liet een verkeerde verklaring door
(de wortels-wereld haalt twee routes van Spelen). `test/wereldcompositor.test.js`
zakt ook zodra er een wereldbouwer bestaat die niet in het register staat. Een wees
is voortaan zichtbaar.

## 4c. Bedienbaar was een kromme meetlat — vier fouten in de meter, en geen enkele in een app

**Staat** (24 september 2026). Na de hermeting stond `bedienbaar` voor alle 112
onderdelen op `NIET_GETEST`, en drie apps die op 7 september bewezen waren vielen
terug. Dat is eerst **gediagnosticeerd en pas daarna gerepareerd**: een trechter
per scherm, een spoor per ronde en de stadia per herkomst (DOM → zichtbaar → in
beeld → te raken). Ze wezen vier onafhankelijke fouten aan, alle vier in de meter:

| fout | gemeten | reparatie |
|---|---|---|
| **navigatie** | 50 van 97 schermen stopten op "geen nieuwe knop": een tik op een schillink navigeerde pas na de url-controle weg, en de volgende ronde zag 0 knoppen op een andere pagina | de **thuisregel**: vóór elke tik staat de proef op de landing, en anders keert hij terug met dezelfde gereedvoorwaarde als bij het eerste laden |
| **de noemer groeide onder het examen** | `gevonden` was het maximum over de rondes; Buurtruil ging van 23 naar 43 na een tik op de zoekknop | de noemer **bevriest** bij het laden, vóór er getikt wordt |
| **de schil in de noemer** | de Edge alleen: 1923 knoppen op 93 schermen, waarvan 993 onder een laag; de lus koos op DOM-volgorde, dus de rondes gingen naar schilknoppen | de noemer is de **app-herkomst** (topcontainer onder `body`); de schil krijgt een eigen bewijs |
| **het budget** | een limiet van 14 met een drempel van de helft: op 86 van 97 schermen wiskundig onhaalbaar | het budget volgt uit de noemer; een drempel boven het budget is een **MeterConfigFout** en laat de meting als geheel falen |

**De schil is een definitie en geen lijst.** Een topcontainer die een gedeeld script
in `public/shared/` aanmaakt, is schil. `scripts/lib/bedieningsmeting.js` noemt
elk teken met zijn bron, en `test/bedieningsmeting.test.js` zakt als die bron het
teken niet aanmaakt.

**De schil is geen plek om fouten te verbergen.** Hij staat in het register als
eigen onderdeel (`schil`), en elke rij draagt zijn uitslag onder `afhankelijk`.
"De eigen bediening van Horeca is bewezen" en "de gedeelde schil heeft een gebrek"
staan naast elkaar en worden nooit samengevoegd tot "Horeca werkt".

**Te raken is geen middenpunttest.** De hittest kijkt naar vijf punten na scrollen,
en één punt is genoeg. Een knop waarvan alleen het midden onder een laag ligt, is
voor een mens vaak gewoon bedienbaar.

**De regressiefixture** (`test/appwerkt-meter.e2e.js`) is een synthetisch scherm met
alle vier de fouten erin: 6 app-knoppen die pas na 800 ms bestaan, een paneel met
20 extra knoppen, 30 schilknoppen waarvan 15 onder een laag, en navigerende knoppen
in schil en app. De waarheid is een app-noemer van 6 en een schil-noemer van 15.
Zeven mutaties, één per gerepareerd gebrek plus de wachttijd en de invariant: alle
zeven laten een toets zakken.

**Wat hier bewust niet in zit:** de losse vondst dat Routedossier voor een lid op
`personeel.html?kantoor=1` landt terwijl `bereikbaar` op BEWEZEN staat. Die vraagt of
`bereikbaar` alleen bewijst dat er een pagina verschijnt, of ook dat de juiste app
voor de juiste persona is bereikt. Dat krijgt een eigen diagnose.

## 4d. Bereikbaar: de juiste actor op de bedoelde bestemming

**Staat** (24 september 2026). Een diagnose over alle 112 rijen vergeleek de
ingang uit `MAPPEN` met de pagina waar de proef werkelijk landde. **Vier rijen
stonden op BEWEZEN terwijl een lid de app nooit bereikte**: Routedossier, Decision
Room, Project Room en RTG One sturen een lid zonder kantoorsessie door naar de
kantoordeur of het RTG Kantoor. De meter herkende een deur alleen als een selector
óp de pagina, dus een deur via een doorverwijzing ging erdoorheen.

**De identiteit bestond al.** `SCHERMEIGENAAR.json` noemt per scherm een
capability, een rol en een doelgroep. `scripts/lib/bestemming.js` vergelijkt
daarom de capability van de landing met die van de ingang, en niet de url. Een
alias wordt gevolgd, zodat een canonieke doorverwijzing geldig blijft. Een andere
capability is nooit BEWEZEN. Komt een andere bekende persona er wel, dan is het de
bestaande uitkomst "verkeerd geadresseerd" met dezelfde zin. Een landing die niet
te benoemen is, is NIET_GETEST. Het register wordt zonder vangnet gelezen: een
onleesbaar register is geen leeg register.

**Een tweede as, bewust zonder bewijsbetekenis.** Op dertien schermen meet de proef
met een andere persona (de wereld uit `MAPPEN`, via `PERSONA_VAN_WERELD`) dan het
register als doelgroep noemt. WorkOS meet bijvoorbeeld als lid, terwijl Horeca en
Partner Network voor een zaak zijn. Welke van de twee gelijk heeft, is geen
meetvraag. "Vanuit welke wereld testen we" en "voor wie is dit scherm" hoeven niet
hetzelfde begrip te zijn. De afwijking staat per rij als `personaAfwijking`, met
beide waarden en beide bronnen. `npm run appcluster` groepeert hem per wereld op
`gebruikt → verwacht`. Hij verandert geen enkel bewijs, tot de dertien semantisch
zijn ingedeeld.

Toetsen: `test/bestemming.test.js` (de drie gevallen, een onbekende landing, de
persona-afwijking) en `test/appwerkt-bestemming.e2e.js` (echte doorverwijzingen na
het laden). Vijf mutaties, waaronder "terug naar url-vergelijking": alle vijf
laten een toets zakken.

## 5. Wat er vandaag gemeten wordt, en wat dat niet bewijst

`npm run appwerkt` schrijft `APPWERKT.json`: per onderdeel uit `MAPPEN`, met de
persona die de wereld impliceert (een lid voor LivingOS/WorkOS/TravelOS, een gezin
voor FoundationOS), in een echte browser met een echte sessie langs de echte
inlogroute.

Een **BEWEZEN** rij betekent daar precies dit: *de ingang opent voor de persona aan
wie hij wordt getoond, en de zichtbare bediening breekt niet.* Het betekent
uitdrukkelijk niet dat de functie werkt. Vier dingen die deze proef niet ziet:

- formulieren worden niet ingevuld en niet verstuurd;
- onomkeerbare knoppen worden overgeslagen (met naam, per rij);
- hooguit veertien knoppen per scherm;
- het meet op bureaubreedte — de telefoonkant staat in `TIKKEN.json`.

### De duurste beperking, en een verkeerde diagnose onderweg

Bewijs 2 is dunner dan het lijkt, en het kostte drie metingen om te weten
waarom. Dat staat hier voluit, want de tussenstappen waren allebei plausibel en
allebei fout.

**Ronde 1 — de ratel leek stuk.** Er werd een knop ingebouwd die bij een klik
gooit; `appwerkt:controle` meldde *"OK: 0 defecten"*. Conclusie op dat moment:
de ratel deugt niet.

**Ronde 2 — een verkeerde verklaring.** De meter had op dat scherm maar één knop
aangetikt, dus leek het antwoord: een vers account toont te weinig. Dat is
opgeschreven, en het was **onjuist** — de meter *vond* er gewoon veertien en
klikte er één.

**Ronde 3 — het echte gebrek zat in de meter zelf.** `bedien()` markeerde in één
keer veertien knoppen met `data-appwerkt` en tikte ze op nummer aan. Een tik
wisselt vaak van stand, het scherm hertekent, de markeringen verdwijnen — en
elke volgende klik liep in een time-out die stil werd overgeslagen. Gemeten over
de hele ronde: **1206 knoppen gevonden, 331 aangetikt**, mediaan 14 gevonden
tegen 2 aangetikt. "Bedienbaar BEWEZEN" sloeg dus vrijwel overal op één knop.

Dat is de gevaarlijkste soort defect in een meetinstrument: **een meter die te
weinig doet, meldt groen.** Hij kijkt nu elke ronde opnieuw wat er zichtbaar
staat en houdt op een handtekening bij wat al gehad is — een positie klopt na
een hertekening niet meer.

**En wat er toen zichtbaar werd, is de grootste bevinding van deze ronde.** Over
alle 102 onderdelen staan **3407 zichtbare knoppen**; de proef tikte er **439**
aan en kwam bij **720** niet — de rest was al gehad of viel buiten de veertien
rondes per scherm. De reden staat er nu bij, en één springt eruit:

| waarom niet aan te tikken | aantal |
|---|---|
| **er ligt iets overheen** (`intercepts pointer events`) | **572** |
| niet zichtbaar op het moment van tikken | 91 |
| buiten beeld | 56 |
| niet stabiel | 1 |

Wat daarvan een overlay is die een mens eerst wegtikt, en wat een werkelijk
onbereikbare knop, kan deze proef niet uitmaken — en juist daarom maakt hij er
geen vinkje van. Raakt de proef minder dan de helft van wat er staat, dan is de
rij `NIET_GETEST` met de uitsplitsing erbij. Uitkomst: **bedienbaar staat op 6
BEWEZEN en 96 NIET_GETEST**, en **80 van de 102** schermen zijn grotendeels
ongemeten.

Dat is een veel slechter getal dan de 87 BEWEZEN van de vorige ronde, en het is
het eerste getal dat waar is.

De les die hier het meeste waard is: **de eerste twee verklaringen waren
verhalen, de derde was een meting.** Een register dat op ronde 1 was blijven
staan, had 87 rijen BEWEZEN gemeld op één klik per scherm.

`npm run appwerkt:controle` is de ratel: het aantal defecten mag alleen omlaag.
Groeit het, dan is er een functie stukgegaan die het deed, en dat hoort de bouw te
laten zakken in plaats van in een register te verdwijnen.

## 6. Waarom dit niet theoretisch is

Deze laag komt uit één middag handmatig kijken, en die leverde vier defecten op
die geen enkele bestaande toets zag. Alle vier waren ze **stil** — geen
foutmelding, geen rode toets, geen klacht:

1. **RTG Navigatie toonde Ibiza aan een lid in Amsterdam.** Zonder de NWB-import
   viel `kaart()`, `bestemmingen()` en `poi()` zwijgend terug op een
   demonstratieraster; alleen `route()` weigerde eerlijk. De badge zei intussen
   "Motor actief". *Vier antwoorden op een ontbrekende bron zijn vier waarheden.*
2. **RTG Vrienden verloor zijn halve app aan een knop die niet bestond.**
   `$('#pinNoodKnop')` gooide, en daarmee viel alles daarna in dat scriptblok weg:
   `laad()`, de stream, de verversing, chat, foto's, snaps, verhalen en bellen.
   Het scherm zag er normaal uit — met lege koppen.
3. **Drie schermen groeven zelf in de locatieschakelaar.** `rtg_os_gps` heeft een
   eigenaar (`shared/plek.js`); wie hem zelf leest, mist het moment waarop de
   eigenaar hem zet. Regel 68 van `npm run check` houdt dat nu tegen — en vond bij
   het aanzetten meteen een vierde lezer die niemand had gezien.
4. **LivingOS presenteerde een ingang naar een scherm met een andere deur.**
   "Vrienden" wees naar de gezinscontacten van de RTFoundation. De autorisatie
   klopte tot op de regel; de belofte niet. *Een zichtbare ingang naar een
   onbereikbare functie is een productdefect, ook als elke regel code klopt.*

5. **De meter vond een defect in zichzelf**, en dat is het bewijs dat deze laag
   werkt zoals bedoeld. Zie par. 5: hij klikte één knop per scherm terwijl hij
   er veertien vond, en meldde daar 87 rijen groen op. Twee verklaringen daarvoor
   waren plausibel en fout voordat de derde meting het echte gebrek aanwees. Een
   meter die te weinig doet, meldt groen — dat is de faalvorm waar een
   betrouwbaarheidslaag zelf het kwetsbaarst voor is.

6. **En hij vond er een in de code, op zijn eerste volle ronde.** `LivingOS /
   Fonds`: tik in RTG Geld naar de stand Lab-fonds en meteen door naar een
   andere, dan schrijft `laad()` na zijn `await` in opmaak die er niet meer is
   -- `Cannot set properties of null (setting 'innerHTML')`. Met de hand
   reproduceert dat vrijwel nooit; een proef die sneller tikt dan een mens vindt
   het meteen. **Het is een klasse en geen incident:** een heuristische telling
   over `public/apps/geld/` vindt **37 async-functies in 13 modules** die na een
   `await` in een element schrijven zonder te kijken of hun stand er nog is
   (graad `vermoed` -- geteld op vorm, niet uitgevoerd). Gerepareerd is
   voorlopig de ene die gemeten is (`labfondsb.js`, met een `nogInBeeld()`-poort);
   de andere twaalf modules zijn werkvoorraad, en de vorm die ze allemaal nodig
   hebben is dezelfde poort direct na elke `await`. Ze hier opschrijven in plaats
   van in twaalf bestanden te grijpen is een keuze: een ongemeten reparatie in
   twaalf modules is precies hoe je een stille fout toevoegt in plaats van
   weghaalt.

7. **En Navigatie zelf, de functie waarmee dit document opent, was niet af.**
   Een tweede ronde -- deze keer met een browser in plaats van met de hand --
   leverde vijf stille defecten op in het SCHERM, terwijl de motor eronder
   (`test/navigatie.test.js`, veertien toetsen) volledig groen stond:

   - de badge zei **"Motor actief"** boven Nederland zonder ingeladen wegennet.
     Dat is defect 1 hierboven, en `kern/navigatie/dekking.js` heeft het
     opgelost -- maar het scherm haalde de status alleen op NA een geslaagde
     kaart, en juist in het faalgeval is die er niet. De reparatie zat in de
     motor, de leugen stond op het scherm. *Een badge die niet is bijgewerkt is
     geen lege badge; hij liegt.*
   - wie zocht voordat de eerste GPS-fix binnen was, kreeg per toetsaanslag een
     `Cannot read properties of null (reading 'lat')`. Geen resultaten, geen
     melding, en het zoeken bleef stuk tot er een plek kwam -- terwijl de server
     een zoekvraag zonder plek gewoon beantwoordt en dan alleen de afstanden
     weglaat.
   - nul treffers sloot de lijst zonder een woord, en een 503 van de motor werd
     helemaal weggegooid: een lid in Amsterdam typte zijn straat en er gebeurde
     letterlijk niets.
   - wie zijn locatie weigerde, keek **12,2 seconden** naar een zwart scherm.
     Het antwoord was er na een halve seconde, maar `shared/plek.js` kon "er
     komt geen plek" niet doorgeven, dus wachtte de app zijn volle time-out uit.
   - knijpen deed niets. `pinchD` stond er als losse variabele die nergens werd
     gelezen, en het doek draagt `touch-action:none` -- dus op precies het
     toestel waarvoor een navigatie-app bedoeld is, was de kaart niet te zoomen.

   Geen van de vijf zit in een route, dus geen routetoets kon ze vinden. Ze
   staan nu onder `scripts/navigatieproef.js` (`npm run navigatieproef`): zeven
   schakels en vijf storingen in een echte browser, met de scriptfouten van de
   pagina als eigen teller. Elke reparatie is een keer teruggedraaid om te zien
   dat de proef hem werkelijk mist -- een toets die je niet hebt zien zakken is
   geen toets (LAT.md regel 11).

Nummer 4 is de reden dat bewijs 1 over een **persona** gaat en niet over een URL.
Een dichte deur is geen defect; een dichte deur achter een ingang die je aan de
verkeerde persoon toont, wel.

## 7. De volgorde

1. **Uitzoeken wat er over die knoppen heen ligt.** 8 van de 13 onbereikbare
   knoppen op één scherm melden "intercepts pointer events". Dat is óf een
   overlay die een mens eerst wegtikt (dan moet de proef dat ook doen), óf een
   knop die werkelijk onbereikbaar is (dan is het een productdefect van de
   ergste soort: hij staat er en doet niets). Zolang dat niet uit elkaar is
   gehaald, is elke uitbreiding van bewijs 2 bouwen op zand. *Een stap weg.*
2. **Bewijs 2 afmaken** (formulieren, uploads, toetsenbord, mobiel). Geen nieuwe
   infrastructuur nodig. *Een stap weg, na 1.*
3. **Bewijs 4 verbreden.** De liegpoort bestaat (`RTG_LIEG`) en draait over zes
   schermen. Hem over alle onderdelen halen kost rekentijd, geen ontwerp.
   *Een stap weg.*
4. **De testwereld bouwen** (par. 4), en daarmee bewijs 3, 5 en 7 openen. Dit is
   het grote stuk en het enige dat een besluit vraagt. *Vraagt een besluit.*
5. **Bewijs 6 naar de schermkant.** De routekant is gemeten; wat een scherm doet
   met een sessie van iemand anders niet. *Een stap weg, na 4.*
6. **De acht bewijzen aan `BELOFTE.json` koppelen**, zodat de uitspraak niet per
   ingang maar per belofte gedaan kan worden. *Vraagt een besluit* — welke ingangen
   samen één belofte vormen, staat nergens in de code, en dat verzinnen levert een
   lijst op die stelliger is dan wat het huis weet (zelfde reden als de
   ontbrekende domeinlaag in `WERELDLIJST.md`).

## 8. De uitspraak waar dit naartoe werkt

Niet *"292 schermen laden"*, maar iets in deze vorm — met per getal een register
dat hem draagt:

    N/N onderdelen bereikbaar voor hun eigen persona
    N/N gebruikershandelingen bedienbaar zonder fout   (nu: 439 van 3407)
    N/N primaire stromen end-to-end voltooid
    0 schermen die meer beweren dan de backend heeft bewezen
    0 onbewezen kritieke mutaties
    0 autorisatielekken
    0 kale fouten die de gebruiker bereiken

Vandaag is alleen de eerste regel te vullen, en de tweede voor een achtste. Dat is geen
tegenvaller: het is de eerste keer dat de vraag überhaupt een noemer heeft.
