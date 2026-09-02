# RTG Service — de laag die de hulplijnen orkestreert

Dit document hoort bij `server/kern/service/`. Lees het voordat je iets bouwt
waarmee een gebruiker om hulp vraagt, of waarmee een medewerker in het dossier
van iemand anders kijkt.

## 0. Wat het probleem NIET was

Het probleem was niet dat RTG geen klantenservice had. Er waren er vier, en ze
werkten elk:

| lijn | voor wie | waar |
|---|---|---|
| Rahul, de AI | RTG Pass | `kern/ai.js` |
| de menselijke concierge | Lifestyle, Business | `kern/lifestyle/`, `routes/office/concierge.js` |
| de ledenbalie | elk lid, via het kantoor | `kern/ledenbalie*.js` |
| RTG Bijstand | organisaties | `kern/command/bijstand*.js` |

Wat ontbrak was een **gemeenschappelijke envelop**: iets dat over alle vier heen
weet wie eraan werkt, sinds wanneer, met welke bevoegdheid, en wat de melder
ziet. En daardoor ontbraken twee dingen die je van buiten meteen merkt: een lid
kon zelf geen zaak beginnen, en een lid kon zelf niet om een mens vragen.

**Deze laag vervangt die vier niet.** Zij blijven bepalen wat iets BETEKENT; een
klacht blijft een klacht van `ledenbalie-zaken.js`, een conciergeverzoek blijft
van `kern/lifestyle`. Service bepaalt alleen wie, wanneer, waarmee, en wat de
melder ziet.

## 1. Het fundamentele object is een Zaak, geen ticket

Een ticket zegt: *persoon → vraag → medewerker → antwoord*. Te klein voor dit
huis, waar het kan zijn: *lid → betaling → zaak → incident → AI → medewerker →
techniek → bewijs → herstel*. Daarom draagt een Servicezaak een **tijdlijn** in
plaats van een status; stand, eigenaar, prioriteit en de vier klokken zijn er
allemaal uit af te leiden. `kern/service/loop.js` is de enige module die die
tijdlijn schrijft — zodra het er twee zijn, is hij een verslag dat meestal klopt.

**Drie soorten die dezelfde infrastructuur delen en nooit in elkaar overlopen:**

- `ondersteuning` — er is een probleem;
- `opdracht` — er is geen probleem, er moet iets geregeld worden (concierge);
- `klacht` — er is iets misgegaan en daar hoort een oordeel over.

Een servicezaak kan opgelost worden terwijl de klacht nog onderzoek, oordeel en
maatregel voor zich heeft. Wie ze samenvoegt, laat "de medewerker was onbeschoft"
verdwijnen op het moment dat de bestelling alsnog geleverd wordt.

## 2. Context weten is iets anders dan gegevens openen

Dit is de belangrijkste grens van de laag, en hij is structureel afgedwongen.

`betrokken` op een zaak is een **verwijzing**: een soort en een code, meer niet.
`verwijzing()` in `kern/service/zaak.js` gooit al het andere weg — een bedrag,
een IBAN, een adres komt er niet in. Dat een zaak over `PAY-829192` gaat mag de
wachtrij weten; wat er in die betaling staat is een aparte vraag met een eigen
reden, een eigen bevoegdheid en een eigen spoor.

Die tweede helft is de **ServiceMachtiging** (`kern/service/machtiging.js`):
zaakgebonden, tijdgebonden, capability-gebonden, met verval als **berekende
toestand** en niet als opruimactie. Zij is de vorm van `kern/command/bijstand.js`
met de zaak als bereik in plaats van de organisatie — en dat er twee zijn is
bewust: bijstand gaat over de omgeving van een klant, met een klant die
uitnodigt en live meekijkt.

Vier dingen zijn daar structureel, niet afgesproken:

1. **een machtiging versmalt alleen** — de doorsnede met wat het team nodig heeft;
2. **verlopen wordt gerekend**, bij elke lezing, uit de klok;
3. **het bereik is de zaak** — een machtiging bij SUP-1 opent niets bij SUP-2;
4. **zwaar werk vraagt een tweede mens**, en nooit de aanvrager zelf.

Het inzagejournaal krijgt daardoor eindelijk de zin die het altijd miste: niet
"medewerker bekeek lid X", maar "medewerker opende de betaalstand omdat SUP-382
over een ontbrekende uitbetaling ging".

## 3. "Ik wil een mens" is een contract

`kern/ai.js` zette voor de RTG Pass hard `needsConcierge = false`. Dat was geen
bug maar de merkregel, eerlijk uitgevoerd. Het gevolg was wel een gebrek: een
RTG-lid kwam via de chat nergens bij een mens uit, terwijl de ledenbalie elk lid
helpt. Er wás een mens, en de melder was de enige die niet bij hem kon.

`kern/service/mens.js` haalt twee dingen uit elkaar die allebei "een mens" heten:

- **De Rechterhand is uitvoering.** Iemand doet iets vóór u. Gekochte dienst,
  blijft bij Lifestyle en Business.
- **Een mens bij een probleem is service.** Geen product maar een ondergrens,
  voor elk lid met een account.

De norm, mechanisch: *iedere identiteit waarvoor menselijke hulp bestaat, moet
die hulp zelfstandig kunnen aanvragen vanuit een kanaal dat zij al heeft.*
`test/servicemens.test.js` houdt dat per pas vast. En wie drie keer vraagt,
krijgt geen vierde afwerende dialoog — dat is een teller, geen stijlvoorschrift.

## 4. De supportbevestiging, en waarom de vaste steuncode het niet werd

`kern/ledenbalie.js` leidt per lid een vaste steuncode af en het baliescherm zegt
"het lid leest die voor uit de app". Alleen: `steuncodeVan()` werd buiten dat
bestand nergens aangeroepen. Geen enkele route liet een lid zijn eigen code zien.
Een beveiligde werkstroom die niet uitvoerbaar is, is erger dan geen.

De oplossing is niet "toon die code dan" — dan heeft elk lid een vaste geheime
supportcode die over een jaar is doorverteld en gescreenshot, en die niets zegt
over wát er mag. In plaats daarvan vraagt de medewerker om een **bevestiging**:
het lid ziet wie er vraagt, voor welke zaak, en wat die persoon daarmee opent, en
drukt zelf. De code blijft als **terugval**: zes cijfers, vijf minuten, één keer,
gebonden aan deze zaak en deze gevraagde bevoegdheden.

Een bevestiging identificeert niemand. Zij bewijst dat wie de app open heeft
akkoord gaat, meer niet — een scan, een code of een tik is geen mens (LINK.md
par. 3). Alles wat echt om identiteit vraagt, blijft een tweede mens vragen.

## 5. Vier klokken, en de vierde is de belangrijkste

`kern/service/klok.js` leidt ze af uit de tijdlijn en houdt zelf niets bij.

- **eerste reactie** — tot RTG inhoudelijk iets terugzei (een statuswijziging
  telt niet: die is voor de melder niet van stilte te onderscheiden);
- **menselijke reactie** — vanaf het VERZOEK, niet vanaf het begin;
- **hersteltijd** — tot het probleem weg was, niet tot het gesprek stopte;
- **wacht op de melder** — en die wordt van de andere drie afgetrokken.

Zonder de vierde meet je de melder. En er staat nooit een getal waar er geen is:
een zaak zonder gemeten reactietijd draagt `{ nietGemeten: true, waarom }` en geen
nul, want een nul die "nog niet gebeurd" betekent, maakt een gemiddelde beter
naarmate RTG slechter werkt.

## 6. Prioriteit wordt berekend, niet gekozen

Vijf termen met een weging, en de opbouw staat er altijd bij — een cijfer zonder
opbouw is een orakel. `P0` is met opzet niet uit termen bereikbaar: dat is een
menselijk besluit. De overschrijving bestaat en eist een reden; een berekening
die niet te overrulen is, wordt omzeild met verzonnen invoer, en dan liegt de
invoer in plaats van dat het oordeel zichtbaar is.

Wat de melder aanlevert zijn **termen** (er ligt iets stil, er staat geld vast),
nooit een prioriteit. Anders meet de wachtrij binnen een half jaar
welbespraaktheid.

## 7. Het patroon: twintig meldingen die hetzelfde zeggen

Als er een storing is, melden twintig mensen hem, en dan werken twintig
medewerkers aan twintig zaken met dezelfde oorzaak. En als hij verholpen is,
hoort niemand van die twintig dat vanzelf. Daar zit de schaalwinst.

`kern/service/patroon.js` kijkt vanaf de **melders** en groepeert lopende zaken
op onderwerp, de soort van het betrokken object en het scherm, binnen een venster
van zes uur en vanaf drie zaken. Wat eruit komt is een **vermoeden**, geen
incident:

- **Het is geen tweede incident.** `kern/command/incident.js` blijft het incident
  van dit huis; dat hangt aan een *vermogen* uit de gezondheidskaart, en de
  melderskant heeft geen vermogen om aan te wijzen. Er komt dus ook geen tweede
  nummerreeks: `bundel()` weigert zonder incidentnummer, en dat nummer komt uit
  RTG Command.
- **Correlatie is geen oorzaak, en dat staat in de uitslag.** Elk vermoeden zegt
  waaróp de groep is gevormd. Vijf mensen die op maandagochtend over hun factuur
  bellen delen een tijdvenster; dat is geen storing. Zonder die zin is de drempel
  een orakel.
- **De machine bundelt niets uit zichzelf.** Een mens bevestigt.

Daarna is het één technische oplossing en twintig melders die vanzelf worden
bijgewerkt. Maar: **een hersteld incident sluit geen zaken.** Ze gaan naar
`inBehandeling` en niet naar `opgelost` — dat een platformstoring weg is, bewijst
niet dat de bestelling van dit ene lid alsnog is aangekomen. Het scherm wordt er
rustiger van om dat wel te doen, en dat is precies de reden om het niet te doen.

## 8. De persoonlijke stand, zonder groen vinkje

Een gewone statuspagina zegt "Payments: degraded performance", en dat is voor
bijna iedereen onwaar in beide richtingen. `kern/service/persoonlijk.js`
beantwoordt een kleinere en eerlijkere vraag: *raakt er op dit moment een bekende
storing een van uw lopende zaken?*

Wat er met opzet **niet** staat is "RTG werkt normaal voor u". Dat zou een
bewering zijn over beschikbaarheid, en die wordt niet per lid gemeten. Het
antwoord bij geen treffer is "wij zien niets dat uw zaken raakt", met de zin
erbij dat dat iets anders is dan dat alles werkt (BESTUUR.md: `niet vast te
stellen` is een eersteklas uitslag naast in orde en storing).

En het houdt twee bronnen uit elkaar die niet hetzelfde zijn: of een storing
verholpen **is** weet RTG Command; wat Service aan de melders heeft **verteld**
staat hier. Een lid dat "hersteld" leest, leest dat wij dat gemeld hebben — niet
dat een meter het bevestigt. Vandaar drie standen en niet twee, met `onbekend`
als eersteklas uitkomst.

## 9. Foutsignalen: 84.000 gebeurtenissen, geen 84.000 zaken

`routes/fout.js` ving browserfouten op en gooide ze weg. Wat er nu gebeurt is
groeperen op een **vingerafdruk** (`kern/service/foutsignaal.js`) — soort,
melding met de getallen weggestreept, bestand, regel — zodat er één regel staat
waar er tienduizend gebeurtenissen waren.

Twee dingen die daar niet in mogen sneuvelen:

- **De vingerafdruk kent geen mensen.** Geen codenaam, geen sessiesleutel, geen
  token. Deze deur staat met opzet zonder inlog open (een fout die het inloggen
  sloopt komt nooit binnen achter een poort die inloggen vereist), dus alles wat
  binnenkomt is van een onbekende. Er wordt geteld hoe *vaak* iets gebeurde, niet
  wie het overkwam.
- **`gebruikers` is `null` met de reden erbij.** Zonder identiteit is dat niet te
  tellen, en een geschat aantal mensen is precies het getal dat later als feit
  wordt geciteerd.

Wie vanaf een kapot scherm om hulp vraagt, laat de medewerker meteen zien dat dit
geen individueel probleem is: `/api/office/service/zaak` geeft de signalen van
dat scherm mee.

## 10. De cockpit, en waarom er geen zoekbalk op staat

`/apps/service.html` is het bureau van de medewerker. Je komt er via de wachtrij
en opent SUP-xxxxxx; er is **geen veld waarmee je een lid opzoekt**. Dat is het
onderscheid met de ledenbalie: die is vrije inzage, met een reden en een regel in
het inzagejournaal, en die blijft bestaan. Deze is zaakgericht, en die twee horen
zichtbaar naast elkaar en niet door elkaar.

Wat het bord toont: het gesprek als tijdlijn links, de zaak rechts (melder als
codenaam, de verwijzing, de vier klokken, de machtigingen, de foutsignalen van
dat scherm), en de handelingen eronder. Toegang vragen gaat via een keuzelijst
met wat het **team** nodig heeft — geen vrij tekstveld, want dan vraagt iemand
iets dat zijn team niet mag en krijgt hij een weigering waar hij niets aan heeft.

**Alles wat het bord beweert, draagt een waarom.** Achter "Waarom?" staat waarop
de prioriteit is uitgerekend, waarom de zaak bij dit team ligt, en — het
belangrijkste veld — wat er **niet** is gewogen. Een zaak op P4 omdat niemand de
omvang inschatte, is iets anders dan een zaak die aantoonbaar klein is.

En het bord **stelt geen oorzaak vast**. Er is geen onderzoekende AI, en dat
staat er met zoveel woorden bij in plaats van dat er een waarschijnlijke oorzaak
wordt getoond. Een gok in de vorm van een diagnose is precies de bewering die dit
huis nergens anders accepteert.

Twee dingen die de browsertoets blootlegde en die je nergens anders moet
herhalen. Een functie `open()` op het hoogste niveau van een klassiek script
**overschaduwt `window.open`**, die de gedeelde schil gebruikt. En de schil laadt
met `defer` en verbouwt de header, dus `#titel` kan weg zijn op het moment dat je
erin schrijft — stond dat als eerste regel in de renderfunctie, dan sloeg de
TypeError toe vóórdat het werkblad werd gevuld: een dode klik, zonder
foutmelding, die zich als een willekeurige flake voordeed. Sindsdien loopt elke
handeling door een vangnet dat de reden meldt, en raakt het bord de kop alleen
defensief aan.

## 11. De kant van een zaak

Een leverancier, restaurant, vervoerder, gemeente of ontwikkelpartner kon RTG
**nergens** een hulpvraag stellen. Er was wel een zin — `routes/supplier/
abonnement.js` vertelt of er een vaste contactpersoon is — maar geen kanaal: geen
enkele route waarlangs een zaak iets kon melden, en de enige verbinding met het
kantoor (`sseToOffice`) wordt uitsluitend voor order-sync gebruikt. Wat een gast
aan tafel wél had (`routes/gast/verzoek.js`), had een zaak richting RTG niet.

`server/routes/service-zaak.js` is die ingang. Drie dingen die hem eerlijk
houden:

- **Het systeem vraagt niet wie er meldt.** De zaakcode komt uit de sessie
  (`supplierAuth`); er is geen veld waarin een zaak zijn eigen nummer intikt. Een
  zaak die zijn klantnummer moet opzoeken om hulp te vragen, is een zaak die het
  niet doet.
- **De doelgroep wordt door de route gezet**, niet uit het lichaam gelezen. Een
  melder die zichzelf een organisatie mag noemen, routeert zichzelf naar een
  ander team.
- **Een zaak krijgt een mens, niet De Rechterhand.** Die is een gekochte
  pas-dienst en een zaak heeft geen pas. `kern/service/mens.js` heeft daarvoor
  een eigen tabel, en `loop.mensVraag()` leest welke geldt uit de **doelgroep van
  de zaak** — niet uit een parameter, want dat zou een tweede bron zijn die uit
  de pas kan lopen.

De meldersleutel is `zaak-<code>` en niet de kale code: leden dragen `user-<id>`,
en zonder voorvoegsel zou een zaakcode die op een ledensleutel lijkt bij het
verkeerde dossier uitkomen — precies op de plek waar het telt, het filter dat
bepaalt wiens zaken je ziet.

Aan de kantoorkant staat er een **zaakprofiel** bij: code, naam, soort, stad en
de partnerstand. Vijf velden, en met opzet niet `publicSupplier()` — dat is de
klantweergave met menu's, foto's, kamers en evenementen erin, en een medewerker
die een storing onderzoekt heeft daar niets aan. Alles wat daar binnenkomt, is
meteen ook alles wat er in de wachtrij te zien is.

## 12. Hoe goed is deze service, en waarom niet op afhandeltijd

Een callcenter meet *average handling time* en tickets per medewerker. Die twee
belonen precies het verkeerde: wie een zaak snel sluit scoort beter dan wie hem
oplost, en wie doorverwijst beter dan wie doorbijt. Binnen een half jaar meet je
dan hoe snel mensen van een probleem afkomen.

De maat die hier telt is een andere, en hij staat vooraan:

> Hoeveel problemen zijn opgelost zonder dat de melder zijn verhaal opnieuw
> hoefde te vertellen?

Dat is te meten, het is niet te halen door harder te werken, en het is precies
wat deze laag mogelijk maakt — de zaak draagt zijn context mee, dus een
overdracht hoeft geen herstart te zijn. `kern/service/kwaliteit.js` leest het uit
de tijdlijn, en met opzet streng: waar als de melder ná zijn verzoek om een mens
zélf het eerstvolgende bericht stuurde. Wij meten dus niet of hij woorden
herhaalde — dat is niet vast te stellen zonder zijn tekst te wegen — maar of de
**structuur** hem dwong. Een zaak zonder overdracht krijgt geen oordeel (`null`
en niet `false`), anders telt elke zaak zonder mens mee als een succes.

Daarnaast: heropend binnen zeven dagen (die was dus niet opgelost, afgeleid uit
de tijdlijn en niet uit een vlag die iemand vergeet), hoe vaak er om een mens
werd gevraagd (**geen faalgetal** — soms hoort dat gewoon), en de hersteltijd als
**mediaan**, zodat één zaak van drie weken het beeld niet bepaalt.

Vijf dingen staan er met opzet niet in, en dat staat in het antwoord zelf onder
`nietGemeten` — anders vult een medewerker het gat met zijn eigen indruk en gaat
díé rondzingen:

- **afhandeltijd per medewerker** — dat is een ranglijst op mensen, en die maakt
  dit huis nergens;
- **tevredenheid** — er wordt niets gevraagd, dus er is niets te melden; een
  geschat cijfer is erger dan geen cijfer;
- **een samengesteld rapportcijfer** — zes eerlijke getallen bij elkaar geven een
  zekerheid die geen van de zes draagt (`scripts/zekerheid.js` bestaat daarvoor);
- **een percentage zonder noemer** — elke verhouding draagt zijn `van`, want 100%
  van twee zaken is geen 100%;
- **een getal waar er geen is** — onder tien zaken staat er `nietTeZeggen` met de
  reden, geen nul.

## 13. Wat er staat, en wat er niet staat

**Staat** (gemeten, met toetsen die zijn zien zakken):

- de Servicezaak met tijdlijn, standen, teams, koppelingen;
- de berekende prioriteit met opbouw en menselijke overschrijving;
- de router (doelgroep vóór onderwerp, met de reden erbij);
- de vier klokken;
- de menselijke overname als contract, ook vanuit de chat van Rahul;
- de ServiceMachtiging met versmalling, zaakbereik, verval en tweede handtekening;
- de supportbevestiging met eenmalige terugvalcode;
- de ledenkant in de app-gids-la (Core, op elk scherm) en de kantoorkant achter
  de balie-zetel;
- de klacht van de ledenbalie krijgt een envelop en blijft een klacht;
- patroonherkenning met bundelen en herstellen in één handeling;
- de persoonlijke stand, zonder belofte over beschikbaarheid;
- foutsignalen op vingerafdruk, gevoed door `routes/fout.js`;
- de cockpit op `/apps/service.html`, met de waarom-laag en zonder ledenzoeker;
- de ingang voor een zaak, met het zaakprofiel aan de kantoorkant, en de
  werkplek erbij (`/apps/leverancier-service.html`);
- de kwaliteitsmeting, met vooraan de maat die ertoe doet.

**Staat niet**, met de reden en niet als lege functie:

- **kanalen**: mail, telefoon, terugbellen en API staan in `klassen.js` met
  `gebouwd: false` en een reden. Een zaak uit zo'n kanaal is dezelfde zaak;
  alleen het transport ontbreekt, en wie er een bouwt raakt de zaak niet aan.
- **een koppeling met de incidentstand van RTG Command**: Service weet wat zij
  zelf heeft gemeld, niet wat de gezondheidskaart zegt. Die brug is bewust niet
  gelegd zolang de melderskant geen vermogen kan aanwijzen.
- **AI-onderzoeker en copilot**: de router kiest een team, geen techniek, en de
  intelligentierouter (`kern/ai/router.js`) loopt in de schaduw en beslist niets.
  Dit is bewust niet gebouwd, en de reden is hard: een copilot die "waarschijnlijk
  een security hold" zegt, doet een uitspraak over een oorzaak. Om die te kúnnen
  onderbouwen moet hij de betaalstand, de wijzigingsgeschiedenis en het
  incidentbeeld kunnen lezen — precies de gegevens die deze laag achter een
  machtiging met een bevestiging heeft gezet. Een onderzoeker bouwen betekent dus
  eerst beslissen of een AI die machtiging mag krijgen, en dat is een besluit van
  de eigenaar en geen bouwtaak. Tot dat besluit valt, zegt de cockpit met zoveel
  woorden dat RTG hier geen oorzaak vaststelt (par. 10). Dat is geen gat maar de
  eerlijke stand.
- **telefonie en terugbellen**: er is geen provider en geen nummer, dus er valt
  niets te bouwen dat werkt. `klassen.js` draagt ze als `gebouwd: false` met die
  reden; een zaak uit dat kanaal is dezelfde zaak, alleen het transport ontbreekt.
- **RTMail als ingang**: technisch een kleinere stap dan telefonie (de stack
  bestaat), maar hij vraagt eerst een besluit dat hier niet gemaakt kan worden:
  post komt binnen van een adres, en een adres is een persoonsgegeven dat aan een
  codenaam gekoppeld moet worden om er een zaak van te maken. Waar die koppeling
  woont — in de kluis, of als losse mailidentiteit — bepaalt of de envelop een
  achterdeur naar de identiteitskluis wordt. Zolang dat openstaat is de eerlijke
  vorm `gebouwd: false` met de reden, en niet een half kanaal.

## 14. De grenzen

1. **Een zaak opent niets.** `betrokken` is een verwijzing; gegevens vragen een
   machtiging, en die vraagt een bevestiging van het lid.
2. **Een machtiging kan alleen versmallen.** Er is geen pad waarlangs er iets
   bij komt — ook niet via een bevestiging, want die versmalt bij het VRAGEN al.
3. **De tijdlijn wordt door één module geschreven.** Stand, eigenaar en
   prioriteit zijn afgeleiden; wie ze los zet, maakt een tweede waarheid.
4. **De RTG Pass krijgt een mens, niet de concierge.** Die twee uit elkaar
   houden is wat de merkregel heel laat.
5. **Een geweigerde herhaling is geen idempotentie.** Zie de contracten in
   `server/lib/mutatiecontracten-service*.js`; `hooguitEens` is de eerlijke
   klasse voor een bevestiging die één keer werkt.
6. **Er staat nooit een getal waar er geen is.** Klokken die niet gemeten zijn,
   zeggen dat; `gebruikers` bij een foutsignaal is `null` met de reden erbij.
7. **De machine bundelt niet en sluit niet.** Zij levert een vermoeden en licht
   melders in; groeperen en afsluiten blijven een oordeel.
8. **Er komt geen groen vinkje.** De persoonlijke stand zegt nooit dat alles
   werkt, want beschikbaarheid wordt niet per lid gemeten.

## 15. Wat de meting vond, en wat lezen niet vond

De zevenentwintig routes zijn door een **kale ronde** gehaald: twee keer dezelfde
aanroep, met een opname van de servicecollecties (inclusief de tijdlijn) voor en
na. Dat vond vier fouten die geen enkele toets zag, en alle vier zagen ze er bij
het lezen prima uit:

1. **Een bevestiging werd onbruikbaar zodra de zaak van team wisselde** — en dat
   gebeurt juist bij "ik wil een mens". Het lid kreeg een weigering over een team
   waar hij nooit van gehoord had, voor toegang die hij net had goedgekeurd.
2. **Het hergebruik van een lopend verzoek keek naar (zaak, mens) en niet naar
   wat er gevraagd werd.** Een medewerker die om iets anders vroeg kreeg
   stilletjes het oude verzoek terug, en het lid keurde iets anders goed dan er
   gevraagd was.
3. **Twee keer bundelen stuurde elke melder een tweede keer dezelfde
   mededeling.** `koppel()` ving de dubbele koppeling wel af, het bericht
   eronder niet — en juist daar zit de schaal: bij twintig melders is een
   dubbelklik twintig overbodige berichten.
4. **Twee keer "hersteld" stuurde iedereen opnieuw dat de storing verholpen
   was.** Een tweede exemplaar van dat bericht maakt het eerste ongeloofwaardig.

Daarnaast bleek de eerste versie van de meter zelf blind voor de tijdlijn — en
meldde dus "geen effect" bij een route die aantoonbaar schrijft. Dat is de
gevaarlijkste uitslag die een meter kan geven, en de reden dat de opname nu de
tijdlijn meeneemt.

Eén route is niet volledig te meten met de huidige opstelling
(`/machtiging/tekenbij`); die draagt `BLOCKED_BY_TEST_FIXTURE` met het adres van
het werk erbij, en niet "geen effect".
