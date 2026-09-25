# PolitiekOS — de democratische lus van FoundationOS

*Werknaam. Het is geen vijfde wereld en geen partij-app: het is een onderdeel van
**FoundationOS**, en de publieke naam is nog een besluit (par. 9).*

In één zin: **iemand wordt niet alleen gehoord, hij kan volgen wat er daarna
gebeurt.** De technologie zorgt ervoor dat een inbreng nooit stil verdwijnt, en
dat wie tegen een voorstel besluit, laat zien waarom.

> Welkom → Ontmoeten → Luisteren → Samen begrijpen → Samen maken → Besluiten →
> Doen → Bewijzen → Terugkomen → (opnieuw)

Lees dit document vóór je iets bouwt waarmee een mens een maatschappelijke vraag
inbrengt, anderen ontmoet om erover te praten, of een besluit terugkrijgt.
`LEVEN.md` par. 2, `LIFE.md` par. 4, `FOUNDATION.md` par. 5 en `HDI.md` par. 5
staan er onverkort boven; wat hier staat komt daar bovenop.

Zoals `HDI.md`, `PLATFORM.md` en `ECONOMIE.md` is dit een richtingsdocument: per
onderdeel staat er of het **staat**, **een stap weg** is, **een besluit vraagt**
of **jaren weg** is.

---

## 0. De eerste correctie: twee lagen, niet één

Het voorstel beschrijft één systeem. Juridisch en in de architectuur zijn het er
twee, en wie ze samenvoegt, bouwt precies wat dit huis op drie plekken al
weigert.

| Laag | Wat erin zit | Waar het woont | Waarom daar |
|---|---|---|---|
| **De burgerlaag** | welkom, bijeenkomst, luisteren, samen maken, doen, terugkoppeling, de meter *Niemand kwijt* | **FoundationOS** (RTFoundation) | het is maatschappelijke infrastructuur, open voor iedereen, **partijneutraal** |
| **De partijlaag** | leden, congres, fractie, het eigen verkiezingsprogramma, de eigen besluitkamer | **bij de partij zelf**, als klant (`TENANT.md`: *`org` IS de klant*) | een partij is een vereniging met eigen rechtspersoon, eigen geld en eigen data |

Drie redenen, en elk is op zichzelf genoeg:

1. **Geld.** Een ANBI-stichting die één partij helpt, zet haar eigen status op het
   spel. De economische firewall (`server/kern/economie/firewall.js`) weigert een
   stroom tussen werelden zonder grondslag. `GIFT.md` zegt bovendien dat de
   RTFoundation nog geen positie heeft om geld op te ontvangen.
2. **Gift in natura.** Gebruikt een partij de software van de stichting of van RTG
   gratis of met korting, dan is dat een gift aan een politieke partij. Die valt
   onder de meldplicht van de Wet financiering politieke partijen. De uitweg
   staat in grens **PO-01**: de burgerlaag is voor elke partij, raad en elk
   initiatief gelijk, en de partijlaag betaalt de gewone prijs.
3. **De eigenaar.** De eigenaar van RTG wil zelf een partij oprichten. Precies
   daarvoor bestaan MN-01 (geen bevoegdheidsvoordeel, ook niet voor de eigenaar)
   en MN-02 (kennis uit hoedanigheid A gaat niet stilzwijgend mee naar
   hoedanigheid B) in `MENSNETWERK.md`. Wat iemand bij de stichting inbrengt,
   bereikt de partij van de eigenaar nooit, ook niet als "signaal".

Het eigen onderscheid van het voorstel komt daarmee sterker terug in plaats van
zwakker. Omdat de lus niet van één partij is, kan elke partij er haar beloften in
laten volgen. Dan wint een partij die haar beloften nakomt, en niet een partij die
het platform bezit.

---

## 1. Wat er al staat

De meting (een verkenning door de bronboom, lexicaal en dus graad `vermoed`)
vindt geen enkele module die "politiek" heet. Voor bijna elke stap van de lus is
er wel een module die hem al doet, alleen in een ander domein: de Living Lab, het
Stadsweefsel (de stad als klant), de RTFoundation-kernel en RTG Service. **Het werk
is dus aansluiten en niet uitvinden**, dezelfde conclusie als in `HDI.md` par. 1.

| Stap | Wat er al staat | Stand |
|---|---|---|
| **Welkom** | `public/apps/foundation/os-publiek.html` + `server/kern/rtfos/publiek.js`: "RTFoundation in jouw buurt", zonder code of inlog. `server/routes/rtfos/voordeur.js`: een publieke ingang zonder account, met twee remmen. | **een stap weg**: er is een deur, maar geen deur voor *"wat speelt er bij jou?"* |
| **Ontmoeten** | `server/kern/genootschap/bijeenkomst.js`: datum, plek en wie er komt, zonder sociale druk, met "misschien" als eigen antwoord. `server/kern/rtfos/activiteiten.js`: buurtmaaltijden en inloopuren, met wachtlijst, check-in en ouderlijke toestemming. `server/translate/` voor vertaling, `server/kern/toegankelijk.js` voor het toegankelijkheidsprofiel. | **een stap weg**: bijeenkomsten bestaan, maar niet rond een *kwestie* |
| **Luisteren** | `server/kern/stadsweefsel/inspraak.js`: een codenaam per bewoner per raadpleging, vrije tekst gaat nooit de AI-dataset in, *"nooit wie wat vond"*. `server/kern/rtfos/gemeente.js`: telt zonder te lezen, en een buurt met minder dan vijf wordt samengevoegd. `server/kern/service/patroon.js`: meldingen die hetzelfde zeggen worden een *vermoeden*, en een mens bevestigt. | **staat**, verspreid over drie domeinen. Wat ontbreekt: *"genoemd in drie wijken"* over een kwestie heen |
| **Samen begrijpen / maken** | `server/kern/livinglab/werkplaats.js`: taken, documenten met versies, een besluitenlog. `server/kern/livinglab/ai.js`: Rahul als onderzoekscoach, die wijst op wat het tegendeel zou bewijzen, met een plafond in code. | **een stap weg**. Er is **geen B1-laag** (`TOEGANKELIJK.md` zegt het met zoveel woorden) en geen tegenargumentenzoeker |
| **Beleidslab** | `server/kern/command/simulatie.js`: wat-als met de aannames in de uitslag. `server/kern/stadsweefsel/simulatie.js`: vier scenariovormen. `server/kern/livinglab/graden.js`: het bewijsplafond waarvan het laagste wint. `server/kern/fiscaal/regelwacht.js`: regels per jaargang. | **jaren weg** voor "wie profiteert, welke wet, wat kost het". De losse bouwstenen staan |
| **Besluiten** | `server/kern/stadsweefsel/besluitvorming.js`: voorstel → advies → stemmen per fractie. Een advies staat naast het besluit, en de uitslag wordt bij het sluiten vastgelegd en niet bij elke weergave herrekend. `server/kern/rtfos/bestuur.js`: quorum, en wie een belang heeft stemt niet. `server/kern/rtfos/zetels.js`: de enige plek waar bevoegdheid wordt uitgedeeld. `server/kern/overheid/bestuur.js`: stemmen achter `volwassen()` (A3, 18+). | **staat**, voor de stad en de stichting. Voor een partij hoort het in de partijlaag (par. 0) |
| **Doen** | `server/kern/rtfos/vrijwilligers-inzet.js`: matching, uren, evaluatie. `server/kern/rtfos/projecten.js` ("Samen aan een project"). `server/kern/rtfos/ruil.js` (Buurtruil). | **een stap weg**: alles loopt via de organisatie van de stichting, niets begint bij de burger zelf |
| **Belofteboek** | `server/lib/keten.js`: een journaal met een hashketen, waarvan het verleden niet stil te herschrijven is. `server/kern/livinglab/conclusielijn.js`: de geschiedenis van een conclusie, die alleen aangroeit. `server/kern/rtgone.js` kent een `belofte` met eigenaar en deadline, maar zonder geschiedenis. | **een stap weg**: de keten staat, het register niet |
| **Bewijzen** | `server/kern/stadsweefsel/rekenkamer.js`: *"feiten en vragen, geen cijfer en geen stoplicht — een systeem dat zijn eigen projecten een score geeft, heeft zichzelf tot rechter benoemd"*. `server/kern/livinglab/graden.js`: de ladder aanname → bewezen, waarbij "sterk" en "bewezen" een mens vragen. | **staat**, en is precies de toon van het voorstel |
| **Terugkomen** | `server/kern/livinglab/vraagbesluit.js`: elke buurtvraag krijgt een stand en een reden uit een **gesloten lijst**, wordt nooit verwijderd en komt nooit op een ranglijst. `server/kern/ontvanger.js`: een bericht is pas bezorgd als er een bewezen leespad is. `server/kern/service/patroon.js` licht alle gekoppelde melders één keer in. | **staat als patroon**. `vraagbesluit.js` IS *Niemand kwijt* voor één domein |

De vondst die het ontwerp het meest stuurt: **`vraagbesluit.js` heeft de kern van
het voorstel al**, met dezelfde redenering. *"Een afgewezen vraag die verdwijnt,
is niet te onderscheiden van een vraag die nooit is gesteld."* Daar begint de
bouw (par. 8).

---

## 2. Namen: de helft is bezet

Dezelfde les als `vermogens`, `moment` en `envelop`: een centraal woord dat al een
andere betekenis heeft, kost later meer dan het nu kost om te hernoemen. De
tellingen zijn lexicaal (bestanden die het woord bevatten) en dus een ondergrens.

| Voorgesteld | Al bezet als | Ernst |
|---|---|---|
| **Zaak** | een bedrijf of leverancier (`zaakcode` in 194 bestanden, `kern/zaak.js`), plus al vier soorten "casus": servicezaak, stadsweefselzaak, commandzaak, beschermzaak | **ernstig**: de centrale naam van de laag zou de vijfde betekenis worden |
| **Tafel** | horeca (`tafelticket`, `tafelproef`, `rendezvous-tafels`), in 930 bestanden | **ernstig** |
| **Belofte** | het doctrinewoord van het hele huis, plus `BELOFTE.md` (het register van productbeloften) | **hoog**: "belofteboek" zou naast `BELOFTE.json` staan |
| **Werkplaats** | twee betekenissen: RTG Werkplaats (appbureau) en de Living Lab-werkplaats | midden |
| **Voordeur** | de publieke landing en de beschermzaak-ingang | midden |
| **Vraagstuk** | de onderzoeksvraag van de Living Lab | **dichtbij in betekenis**: dit kan hetzelfde ding zijn, en dan is het geen botsing maar een aansluiting |

Voorstel, met het besluit bij de eigenaar (par. 9):
- **De kern heet `kwestie`.** Als identifier is het vrij (het woord komt alleen in
  proza voor: "geen smaakkwestie"), en het past op zowel "dit zebrapad" als "hoe
  organiseren we ouderenzorg". Een codenaam en een schermnaam hoeven niet
  hetzelfde te zijn, maar op een scherm in FoundationOS waar "zaak" ook "bedrijf"
  betekent, is "Zaak" verwarrend.
- **Ontmoeten heet `bijeenkomst`**, en is die van `genootschap/bijeenkomst.js`
  plus een verwijzing naar de kwestie. Het wordt geen tweede.
- **Het belofteregister heet `toezegging`.** Het woord "belofte" blijft van de
  doctrine.

---

## 3. De kwestie: één object dat verwijst en niets bezit

Het voorstel zegt: *"alles blijft aan diezelfde Zaak gekoppeld: mensen,
ervaringen, bewijs, voorstellen, besluiten, geld, uitvoering en resultaten."*
Dat is goed als het **verwijzen** betekent, en fout als het **bezitten** betekent.
Een kwestie die mensen, geld en bewijs bezit, is de `journeys`-fout uit
`TRAVELCOMMERCE.md` en de `humans`-grens uit `HDI.md` par. 5.1 tegelijk.

De vorm die wél werkt, staat al twee keer:
- `server/kern/service/zaak.js`: een zaak weet *waarover* het gaat en opent
  niets. `betrokken` is een soort plus een code, en al het andere gaat weg.
- `server/kern/levensgraaf/graaf.js`: een projectie met etiketten, geen tweede
  database.

Wat de kwestie dus zelf draagt:

| Veld | Wat | Wat het nooit is |
|---|---|---|
| `onderwerp` | de vraag in de woorden van de inbrenger | een categorie waarin een mens wordt ingedeeld |
| `gebied` | door de inbrenger zelf gekozen (zoals in `inspraak.js`) | een opgezocht woonadres |
| `tijdlijn` | wat er gebeurde, met één schrijver (zoals `service/loop.js`) | een status die je kunt overschrijven |
| `verwijzingen` | naar bijeenkomsten, bijdragen, voorstellen, besluiten, toezeggingen, uitvoering en uitkomst, elk in zijn eigen domein | een kopie van die dingen |
| `inbrengers` | codenamen, met toestemming, alleen om terugkoppeling te sturen | een lijst van mensen die "voor" iets zijn |
| `eindstand` | uit een gesloten lijst, met reden (par. 7) | leeg zonder dat iemand het ziet |

Een kwestie mag **groeien** (samenvoegen, opschalen van buurt naar land). Bij het
samenvoegen gaan de inbrengers van beide kwesties mee: een samengevoegde kwestie
die de oorspronkelijke inbrenger kwijtraakt, is de stille verdwijning die deze
laag moet voorkomen.

---

## 4. De lus, stap voor stap: wat hergebruiken, wat bouwen

1. **Welkom.** Geen "word lid" maar *wie ben je, wat speelt er, wil je praten,
   helpen, leren, organiseren of kijken?* Hergebruik de publieke deur van
   `rtfos/publiek.js`. Te bouwen: een ingang die naar een kwestie, een
   bijeenkomst of alleen meelezen leidt. **Geen account nodig om te luisteren**,
   en een account om in te brengen hangt nooit aan een betaalde pas (PO-07).
2. **Ontmoeten.** `genootschap/bijeenkomst.js` plus een verwijzing naar de kwestie.
   Toegankelijkheid en vertaling komen per bijeenkomst uit de bestaande lagen.
   Een fysiek lokaal huis is een plek met een adres en krijgt geen eigen model.
3. **Luisteren.** Bijdragen hangen aan de kwestie en tellen zoals in `inspraak.js`
   en `gemeente.js`: *hoeveel en uit welk gebied, nooit wie wat vond*, met de
   ondergrens van vijf. Het signaal *"dit wordt in drie wijken genoemd"* is een
   **vermoeden** in de vorm van `service/patroon.js`, dat een mens bevestigt.
4. **Samen maken.** De Living Lab-werkplaats met de kwestie als onderwerp. Rahul
   in de rol van `livinglab/ai.js` (par. 5).
5. **Beleidslab.** Begin niet met simuleren maar met **aannames zichtbaar maken**:
   een voorstel draagt een lijst van wat het kost, wie het betaalt, welke regel
   moet veranderen en wie het uitvoert. Elk veld staat op `onbekend` tot iemand
   het invult, met een bron. Dat is een stap weg. Een echte scenariomotor is
   jaren weg, en zonder die lijst eronder zou hij een orakel zijn.
6. **Besluiten.** In de burgerlaag gaat het over wie er in *deze* context
   beslist: een gemeente (`stadsweefsel/besluitvorming.js`), het bestuur van de
   stichting (`rtfos/bestuur.js`) of een partij (partijlaag). De kwestie toont
   **wie bevoegd is** en verwijst naar het besluit met argumenten voor en tegen.
   Is niemand in het systeem bevoegd, dan is de eindstand `doorgestuurd`, met
   naar wie.
7. **Doen.** Het eigenlijke verschil. Te bouwen: een actie die bij een **burger**
   begint (honderd mensen herstellen een speeltuin) en niet bij de stichting.
   Hergebruik `vrijwilligers-inzet.js` en `projecten.js`. De grens uit `LIFE.md`
   blijft: *samenstellen en klaarzetten, bevestigen doet de mens*. Een uitnodiging
   aan een ander gaat nooit automatisch.
8. **Toezeggingen (Belofteboek).** Een toezegging heeft een eigenaar (een partij,
   een fractie, een wethouder), een datum, een doel en afhankelijkheden, en een
   stand die **alleen aangroeit** op `server/lib/keten.js`. Een wijziging is een
   nieuwe regel en nooit een overschrijving. Partijneutraal: elke partij kan hier
   haar toezeggingen laten volgen, onder dezelfde regels.
9. **Bewijzen (Resultaatkamer).** `stadsweefsel/rekenkamer.js` is de vorm: feiten
   en vragen, geen stoplicht. De uitkomst draagt een graad (`onbekend`, `vermoed`,
   `gemeten`, `bewezen`), en **de eigenaar van een toezegging zet haar nooit zelf
   op nagekomen** (PO-05).
10. **Terugkomen.** Bij elke eindstand gaat er een bericht naar alle inbrengers,
    over een bewezen leespad (`ontvanger.js`): *dit brachten jullie in → dit is
    onderzocht → dit is besloten, door wie en waarom → dit is gedaan → dit weten we
    over het resultaat, en zo zeker is dat → wat zien jullie nu?* Daarna mag de
    kwestie opnieuw beginnen, als nieuwe regel op dezelfde tijdlijn.

---

## 5. Rahul als publieke dienaar

Rahul is geen leider en geen campagnemedewerker. Hij helpt de lus eerlijk te
houden. Wat hij mag, en waar dat al staat:

| Rahul zegt | Waar het op rust | Stand |
|---|---|---|
| *"Deze oplossing kost € 4 miljoen, en niemand heeft gezegd waar dat vandaan komt."* | de aannamelijst van het beleidslab (par. 4.5): een leeg veld is een vaststelling, geen oordeel | een stap weg |
| *"Een belangrijk tegenargument uit de bijdragen komt niet terug in het voorstel."* | bijdragen en voorstel naast elkaar. Rahul wijst aan, een mens beslist of het terechtkomt | een stap weg |
| *"Deze tekst is C1. Zal ik hem ook op B1 zetten?"* | er is vandaag geen B1-laag. Alleen via een **lokaal** model (`LOCAL_AI_URL`), het origineel blijft leidend, en de B1-versie wordt als versie gemarkeerd | een stap weg |

Wat hij nooit doet, en **dat hoort in code te staan en niet in een prompt**:

- **Geen overtuigingsvraag.** *"Hoe krijgen we deze groep zover dat ze op ons
  stemt?"* heeft in deze laag geen antwoord, en structureel geen ingang. Er is
  vandaag **geen centrale regel tegen overtuigen of targeting** in het huis (alleen
  losse opmerkingen per domein), dus daar hoort een handhaver bij (PO-03).
- **Geen standpunt.** Rahul zegt niet wat de goede uitkomst is. Hij toont
  argumenten, kosten, onzekerheid en wie er beslist.
- **Geen kiezersbeeld.** Rahul krijgt in deze laag nooit gegevens over een mens of
  een groep mee, alleen de kwestie en haar bijdragen, geteld zoals in par. 4.3.

De vorm van die laatste grens staat al: `server/kern/knelpunt/` geeft zijn functie
`vondsten()` alleen een randvoorwaarde en verder niets, zodat een
geschiktheidstoets daar structureel niet *kan* in plaats van verboden is. De
AI-functies van deze laag krijgen dezelfde handtekening: kwestie in, nooit een
persoon.

---

## 6. De grenzen

Waar een functie botst met een grens, vervalt de functie. Per grens staat erbij
wie hem vandaag handhaaft.

- **PO-01 Partijneutraal.** De burgerlaag kent geen enkele partij bij naam. Elke
  partij, raad en elk initiatief krijgt dezelfde toegang op dezelfde voorwaarden,
  en een partij die meer wil, is een klant tegen de gewone prijs. *Handhaver:
  niemand. Te maken: een toets die zakt zodra de code van deze laag een
  partijnaam of een partijspecifieke tak draagt.*
- **PO-02 Geen kiezersprofiel.** Politieke voorkeur is een bijzonder
  persoonsgegeven (AVG art. 9) en bestaat hier niet als veld, niet als segment en
  niet als afleiding. Een bijdrage is geen stemintentie. Er wordt geteld per
  kwestie en per gebied, met een ondergrens van vijf. *Handhaver: gedeeltelijk
  (`bureau/relaties.js` en `vonk/selectie.js` weigeren het veld lokaal). Te maken:
  de nieuwe map in de scan van `scripts/lib/cijferopmens.js` en een veldtoets voor
  deze laag.*
- **PO-03 Geen overtuigingsmachine.** Geen route, tool of prompt die een groep
  als doelwit neemt, een boodschap per segment maakt of meet wie "te winnen" is.
  *Handhaver: niemand. Te maken: vóór de eerste AI-functie van deze laag, niet
  erna.*
- **PO-04 Niemand kwijt.** Elke kwestie eindigt in een eindstand uit een gesloten
  lijst, met een reden, en elke inbrenger krijgt die terug over een bewezen
  leespad. Een kwestie wordt nooit verwijderd. *Handhaver: de meter van par. 7.*
- **PO-05 Geen eigen voldoende.** Wie een toezegging doet, zet haar niet zelf op
  nagekomen. De uitkomst draagt een graad en de onzekerheid staat even groot op
  het scherm als de uitkomst. *Handhaver: het patroon van `rekenkamer.js`. Te
  maken: de toezeggingslaag zelf.*
- **PO-06 Geschiedenis groeit alleen aan.** Een toezegging, een besluit en een
  eindstand worden nooit overschreven maar aangevuld, op `server/lib/keten.js`.
- **PO-07 Deelnemen staat nooit achter een pas.** Democratische deelname is geen
  commercieel recht (`WERELDEN.md`: *passen bepalen commerciële rechten*).
  Luisteren kan zonder account, inbrengen met elk account, en een betaalde pas
  geeft nooit meer gewicht.
- **PO-08 Een kind is geen profiel.** Een jongere mag inbrengen en meedoen
  (`LEVEN.md` par. 2). Stemmen in een formeel besluit gaat, waar de wet dat eist,
  langs `volwassen()` in `server/kern/volwassen.js` en krijgt geen eigen kopie van
  die regel.

---

## 7. De meter *Niemand kwijt*

Dit is de meter die de lus bewaakt en die het voorstel een eigen categorie
geeft.

**Eindstanden** (gesloten lijst, naar het voorbeeld van `livinglab/vraagbesluit.js`):

| Eindstand | Betekent | Wat de inbrenger krijgt |
|---|---|---|
| `uitgevoerd` | er is gedaan wat besloten is | wat er gedaan is, en wat we over het resultaat weten |
| `afgewezen` | een bevoegde heeft nee gezegd | wie, waarom, en de argumenten voor en tegen |
| `samengevoegd` | gaat verder in een andere kwestie | de nieuwe kwestie, en hij blijft inbrenger |
| `doorgestuurd` | niemand hier is bevoegd | naar wie, en hoe hij het daar kan volgen |
| `onhaalbaar` | kan niet, met reden (kosten, wet, gegevens die niet in verhouding staan) | de reden uit de lijst |
| `ingetrokken` | de inbrenger stopt zelf | niets meer, want dat is zijn keuze |

**Wat de meter telt** (een eigen meter, nog te bouwen):
- kwesties zonder eindstand die langer dan hun termijn stilstaan, per stand;
- eindstanden waarvan een inbrenger **geen bewezen leespad** heeft (de fout uit
  `MAATSTAF.md` par. 7f: een bericht zonder lezer ziet er bezorgd uit);
- samenvoegingen waarbij een inbrenger zoekraakte.

Twee regels, zoals bij de andere meters in dit huis: de telling is een **ratel die
alleen omlaag mag**, en de meter heeft een **zelfijking** (een kwestie die met
opzet kwijtraakt moet hij vinden). Een meter die niets kan vinden, staat groen om
dezelfde reden als een meter die niets vindt.

**Wat hij nooit wordt:** een ranglijst van kwesties, een score per wijk, of een
cijfer per medewerker of bewindspersoon. Hij telt wat er openstaat, niet wie er
achterloopt.

---

## 8. Bouwvolgorde

| Fase | Wat | Waarom eerst |
|---|---|---|
| **0** | De besluiten van par. 9 | naam, neutraliteit en rechtsvorm bepalen alles daarna |
| **1** | De **kleinste lus**: kwestie → eindstand met reden → terugkoppeling, plus de meter *Niemand kwijt* en de toetsen voor PO-01, PO-02 en PO-03 | dit is het eigen onderscheid, en het staat al als patroon in `vraagbesluit.js`. De grenzen komen vóór de eerste AI-functie, niet erna |
| **2** | Welkom + bijeenkomst + luisteren | dan heeft een kwestie mensen om zich heen |
| **3** | Samen maken + de aannamelijst van het beleidslab + B1 via een lokaal model | dan heeft een kwestie voorstellen |
| **4** | Toezeggingen + bewijzen | dan heeft een besluit een vervolg dat je kunt nagaan |
| **5** | Doen (actie die bij de burger begint) | het grootste verschil, maar het leunt op 1 t/m 4 |
| **6** | De partijlaag, als klant | pas als de burgerlaag voor iedereen staat |
| jaren weg | een echte beleidsscenariomotor, publieke verificatie van besluiten | zonder de aannamelijst en de keten eronder zouden ze een orakel zijn |

Het onderdeel komt in FoundationOS langs de gewone weg: een scherm onder
`public/apps/foundation/`, een `link:` in het register, één regel in de
FoundationOS-map van `MAPPEN`, en `npm run wereldlijst`. Een app hoort in precies
één wereld (`scripts/check.js`).

---

## 9. Besluiten die bij de eigenaar liggen

1. **De naam van het object.** `kwestie` (vrij), `vraagstuk` (aansluiten op de
   Living Lab), of toch `zaak` en daarvoor de botsing betalen.
2. **De rechtsvorm van de burgerlaag.** Binnen de RTFoundation (kan alleen als hij
   strikt partijneutraal blijft), of een aparte stichting met een eigen bestuur
   (meer afstand tot de eigenaar-politicus, meer werk).
3. **Wie de burgerlaag gebruikt.** Alleen burgers en initiatieven, ook
   gemeenteraden (het Stadsweefsel staat al), of ook partijen, via hun
   toezeggingen.
4. **Deelnemen zonder account.** Alleen meelezen, of ook inbrengen met een
   eenmalige code (meer bereik, meer misbruikrisico: dan hoort er een rem bij in
   de vorm van `routes/rtfos/voordeur.js`).

---

## 10. Wat dit document niet zegt

- **Het is geen juridisch advies.** De Wet financiering politieke partijen, het
  wetsvoorstel Wet op de politieke partijen, de ANBI-voorwaarden en de AVG zijn
  hier genoemd als richting, niet getoetst. Volgens de fiscale klassen van dit
  huis is dat `advies`: een jurist met kennis van partijfinanciering beoordeelt.
- **Niets hiervan is gebouwd.** De tabel in par. 1 zegt wat er in andere domeinen
  staat, niet dat het hier al werkt.
- **Er is nog nooit een burger door deze lus gelopen.** Of iemand zich gehoord
  voelt terwijl zijn voorstel is afgewezen, is geen eigenschap van de code maar
  iets wat je aan mensen vraagt.
