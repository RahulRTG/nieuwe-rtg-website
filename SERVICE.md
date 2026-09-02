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

## 7. Wat er staat, en wat er niet staat

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
- de klacht van de ledenbalie krijgt een envelop en blijft een klacht.

**Staat niet**, met de reden en niet als lege functie:

- **kanalen**: mail, telefoon, terugbellen en API staan in `klassen.js` met
  `gebouwd: false` en een reden. Een zaak uit zo'n kanaal is dezelfde zaak;
  alleen het transport ontbreekt, en wie er een bouwt raakt de zaak niet aan.
- **incidentkoppeling met patroonherkenning**: koppelen kan (`/koppel`), maar
  niets merkt zélf op dat twintig zaken dezelfde foutcode dragen.
- **de persoonlijke statuspagina**: volgt op het vorige punt; zonder herkenning
  is er niets om persoonlijk over te melden.
- **foutsignalen**: `routes/fout.js` logt clientfouten nog steeds en gooit ze
  weg. Groeperen op fingerprint en aan een zaak koppelen bestaat niet.
- **support voor partners en leveranciers richting RTG**: een zaak kan de
  doelgroep `zaak` dragen en er is een team `zakelijk`, maar er is geen ingang
  waarlangs een leverancier hem opent.
- **een medewerkerscockpit**: de kantoorroutes bestaan, een scherm eromheen niet.
- **AI-onderzoeker en copilot**: de router kiest een team, geen techniek. De
  intelligentierouter (`kern/ai/router.js`) loopt in de schaduw en beslist niets.

## 8. De grenzen

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
   zeggen dat.

## 9. Wat de meting vond, en wat lezen niet vond

De eenentwintig routes zijn door een **kale ronde** gehaald: twee keer dezelfde
aanroep, met een opname van de servicecollecties (inclusief de tijdlijn) voor en
na. Dat vond twee fouten die geen enkele toets zag, en allebei zagen ze er bij
het lezen prima uit:

1. **Een bevestiging werd onbruikbaar zodra de zaak van team wisselde** — en dat
   gebeurt juist bij "ik wil een mens". Het lid kreeg een weigering over een team
   waar hij nooit van gehoord had, voor toegang die hij net had goedgekeurd.
2. **Het hergebruik van een lopend verzoek keek naar (zaak, mens) en niet naar
   wat er gevraagd werd.** Een medewerker die om iets anders vroeg kreeg
   stilletjes het oude verzoek terug, en het lid keurde iets anders goed dan er
   gevraagd was.

Daarnaast bleek de eerste versie van de meter zelf blind voor de tijdlijn — en
meldde dus "geen effect" bij een route die aantoonbaar schrijft. Dat is de
gevaarlijkste uitslag die een meter kan geven, en de reden dat de opname nu de
tijdlijn meeneemt.

Eén route is niet volledig te meten met de huidige opstelling
(`/machtiging/tekenbij`); die draagt `BLOCKED_BY_TEST_FIXTURE` met het adres van
het werk erbij, en niet "geen effect".
