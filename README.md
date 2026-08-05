# Rahul Travel Group, website & ledenportaal

Conceptwebsite van Rahul Travel Group: homepage, drie passen (RTG / Lifestyle / Business), een ledenportaal met betalingen, reizen & diensten, een persoonlijke AI, een digitale toegangskaart voor de toekomstige RTG-app en **De Salon**, het besloten sociale netwerk van RTG.

## Projectstructuur

```
public/            alles wat de browser laadt (de webroot die de server serveert)
├── sw.js          service worker (staat bewust in de root: scope /)
├── manifest.webmanifest
├── icon.svg
├── shared/        gedeelde client-scripts (i18n.js, realtime.js, osmenu, os.css)
├── site/          winkel.html (hardware-shop voor partners) + 404.html
└── apps/          alle web-apps, per doelgroep en genre:
    ├── app.html           leden-app (RTG-OS, tevens het inlogscherm op /)
    ├── index.html         app-overzicht (hub)
    ├── juridisch.html     juridische ROS-app (voorwaarden, privacy, partnervoorwaarden)
    ├── personeel.html     personeels-app (rooster, taken, walkie-talkie, SOS)
    ├── leverancier.html   werkgevers-app (alle genres)
    ├── boardroom.html     persoonlijke boardroom (functies aan/uit, ouderbeheer)
    ├── backoffice.html    RTG-backoffice
    ├── kantoren.html      RTG-kantoren + de boardroom-kamers (o.a. RTG Bank en RTG Stad)
    ├── bank.html          RTG Bank voor het lid (alleen zichtbaar als de boardroom hem live zet)
    ├── stad.html          Mijn Stad: het bewonersbeeld + meldingen naar de veldploeg
    └── stadsdoos.html     Stadsdoos veld-app voor de medewerkers buiten (kantoor-inlog)
server/            Node.js/Express-backend + data (db.json, rtg.db, sleutels, uploads)
```

Er is geen losse marketingsite meer: `/` toont direct het RTG OS-bureaublad (`/apps/index.html`); wie nog niet is aangemeld ziet daar de welkomstkaart (het gratis RTG-abonnement is de minimale ingang). Alle onderlinge links en assets gebruiken absolute paden vanaf de webroot (bijv. `/shared/i18n.js`, `/apps/app.html`), zodat mappen verplaatsen geen links breekt.

### Eén vormtaal: de UI-kit (`shared/rtg-ui.css`)

Elke ROS-app schreef zijn eigen kaart, eigen knop en eigen melding: honderdtachtig keer bijna hetzelfde, met net andere randen, hoeken en grijstinten. **`public/shared/rtg-ui.css`** is nu de maat. Hij is letterlijk de vormtaal van de boardroom (`apps/boardroom.html`), tot onderdelen gemaakt: een donkere kaart met een fijne rand, een kapitaaltjes-kopje erboven, rijen gescheiden door haarlijnen, pilknoppen, en één accent dat met de dagkleur meeademt.

- **De tokens** (`--rtg-bg/card/card2/line/txt/muted/soft/goud/acc/rond`) staan op één plek. Alle app-pagina's verwijzen ernaar, dus één hairline-grijs en één kaartkleur voor de hele familie in plaats van drie varianten per waarde.
- **De onderdelen** heten `rtg-`: `.rtg-wrap`, `.rtg-intro`, `.rtg-groep` (+ `h2`, `.rtg-uitleg`), `.rtg-rij` (+ `.rtg-naam`, `.rtg-sub`), `.rtg-knop` (`.vol` = primair/goud), `.rtg-veld`, `.rtg-sw` (een echte `role="switch"`), `.rtg-merk`, `.rtg-melder` (`.goed`/`.let`/`.fout`), `.rtg-leeg`, `.rtg-logrij`. Nieuwe schermen gebruiken deze direct.
- **De overstap-laag** vangt de bestaande woordenschat op. De pagina's delen al jaren `.kaart`, `.knop`, `.rij`, `.veld`, `.kop`, `.stil`, `.leeg`, `.melding` — alleen tekende elke pagina ze zelf. Zet `class="rtg-stijl"` op de `<body>` en die namen krijgen de vormtaal van de boardroom; de HTML en het JavaScript blijven ongemoeid, dus er hoeven geen classe-namen in honderden string-sjablonen om. Daarna kan de pagina zijn eigen kaart-, knop- en veldregels weggooien.

De kit staat vóór de eigen `<style>` van een pagina en gebruikt nergens `!important`: wie iets echt anders nodig heeft, overschrijft gewoon.

### Modulebeleid: behapbare bestanden van ~5-10KB

De bron is opgeknipt in modules van grofweg 5 tot 10KB, op twee manieren:

- **Server**: domeinmodules (`server/kern/`, `server/routes/`, `server/foundation/`) zijn gesplitst in deelmodules die een gedeelde context één keer bij het opstarten meekrijgen (`module.exports = (ctx) => { ... }`). De hoofdmodule bouwt de context, mount de delen en exporteert hetzelfde als voorheen — geen kosten per verzoek. Kruisverwijzingen tussen delen lopen via de context (late binding per aanroep waar de mount-volgorde dat vraagt).
- **Frontend**: grote browser-scripts staan als delen in een eigen map (bijv. `public/apps/leverancier/`); `scripts/bundel.js` plakt ze op bestandsnaamvolgorde rauw aaneen tot exact het uitgeserveerde bestand (byte-identiek, dus geen gedragsverandering en geen SW-hashwissel). Bewerk de delen, niet de bundel; `npm run build` en `npm run check` bewaken dat.

Bewust níet opgeknipt (samenhang of gevoeligheid weegt zwaarder dan de maat): de opslaglaag (`server/db.js`, `server/pg.js` — gedeelde muteerbare pool/cache-state, durability-kritisch), de wiring-kern van `server/server.js` (volgorde-kritische middlewares, het kern-object), de identiteitskluis (`server/accounts.js`), de betaalmodules (`kern/pay.js`, `kern/directpay.js`), één-functie-modules (`kern/kantoor.js`, `kern/hoteldorp/tools.js`) en pure datamodules (`seed.js`, `translate/woordenboek.js`, `functies/register.js`, `foundation/buddy/coachdata.js`).

## Starten (met backend)

Vereist Node.js 18+.

```bash
npm install
npm start
```

Open daarna **http://localhost:3000** — dat toont direct het RTG OS-bureaublad; aanmelden gaat via de welkomstkaart (Rahul).

Met de backend actief lopen inloggen, betalingen, likes, reacties, DM's en de AI via de echte API:

- data wordt bewaard in `server/data/db.json` (verwijder dat bestand om terug te gaan naar de startdata);
- de Salon-rechten worden **server-side** afgedwongen: zonder pas alleen liken, RTG-leden reageren/dm'en onderling, Lifestyle- en Business-leden hebben volledige interactie met alle leden;
- creators verdienen reiskorting met hun content (elke 50 likes = 1% korting, tot 10% per kwartaal).

### Echte AI (optioneel)

Zet een Anthropic API-key in de omgeving en de persoonlijke AI draait op Claude:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Zonder key geeft de AI vaste demo-antwoorden.

Met key krijgt Rahul bovendien **het AI-stuur** (`server/kern/stuur.js`): in de
drie assistenten (leden-app, partner-app, personeels-PDA) voert hij vrije
opdrachten echt uit, via interne aanroepen op de gewone API met de inlog van
de gebruiker zelf. Hij kan dus alles wat de gebruiker via de knoppen kan en
nooit meer: dezelfde auth, dezelfde functie-schakelkast, dezelfde limieten.
Accounts, het techniekbord en de zaakdoos zijn verboden terrein, en elke
geld-actie vraagt eerst een expliciete bevestiging. De losse endpoints
(`/api/member/doe`, `/api/supplier/doe`, `/api/staff/doe` + `/kaart`) werken
ook zonder key en de boardroom kan de functie `stuur` per doelgroep sluiten.

Elke AI-aanroep loopt via **`server/ai.js`**: één `messages.create` met een
uitwijkketen erachter (Claude, dan OpenAI, dan Gemini; alleen aanbieders met
een sleutel doen mee, volgorde met `AI_VOLGORDE`). Voor korte classificaties
staat daar ook `jaNee(ai, vraag, tekst)` — één plek met het lichte model
(`AI_MODEL_KORT`) en het lezen van het antwoord, dat `true`, `false` of `null`
geeft. `null` betekent "geen oordeel" (geen sleutel, alle aanbieders plat, of
een onleesbaar antwoord) en dan valt de aanroeper terug op zijn eigen
heuristiek: een AI-storing mag nooit een besluit forceren. Modules die een
oordeel nodig hebben bouwen dus geen eigen aanroep met een eigen modelnaam —
dat zou ze stil aan één aanbieder vastzetten.

### De Salon-curatie: viraal rekent zichzelf uit, belang niet

De Salon-feed laat alleen door wat viraal gaat of maatschappelijk belangrijk is
(`server/kern/salonviraal.js`; partner-etalage en door RTG uitgelichte posts
staan daar los van en zijn altijd zichtbaar). Viraliteit is een som van likes,
reacties en de RTG-waardering. Belang is een AI-oordeel, en dat staat met opzet
**niet** in het leespad: een lezer mag nooit op een AI-aanroep wachten, en er
staat ook geen timer op. Het draait op een knop in de boardroom
(`POST /api/office/salon/belang{,/beoordeel}`, achter de boardroom-poort), per
ronde maximaal `BELANG_MAX` (40) posts, met de uitkomst en een audit-regel
erna. Zonder oordeel geldt de vaste woordencheck in dezelfde module, dus zonder
AI-sleutel werkt de feed precies zoals hij is. Getest in
`test/salon-curatie.test.js`, inclusief een ronde tegen een nagemaakte
provider.

### Muisvrij: alles met de mond of met typen

Op elke app-pagina staat onderaan één balk met daarboven het gesprek
(`public/shared/handenvrij.js` + `-balk.js` + `-chat.js` + `-mond.js`,
aangehaakt via `shared/metgezel.js`). Daarin typ je of praat je, en er gebeurt
iets. Het leest als een chat met Rahul: jouw beurt rechts in bordeaux, zijn
beurt links met de signatuurmond ernaast, drie puntjes terwijl hij bezig is.

Het gesprek begint ook niet leeg. Bij het openen komt de doorlopende conversatie
mee (`/api/chat/history`) — dezelfde die in de chat van de leden-app staat, want
de server legt de beurten van de assistent daar nu ook in vast
(`kern/ai.js: noteerBeurt`). **Behalve bij Lifestyle en Business:** daar is die
chat de lijn naar een mens (de concierge). De AI schrijft daar niets in het
draadje, anders leest die concierge straks antwoorden die zij niet gaf.
`test/gesprekdraad.test.js` houdt die grens vast.

Drie dingen maken het muisvrij:

- **Navigeren zonder tik.** "Open de Salon", "ga naar Bestellen", "terug",
  "omlaag", "sluit". Dat wordt *lokaal* afgehandeld, zonder ronde langs de
  server: springen hoort onmiddellijk te zijn en ook te werken als het netwerk
  hapert. De plekken komen uit de pagina zelf (tabs, `data-tab`,
  navigatielinks), en worden bij elke opdracht opnieuw opgehaald, want in dit OS
  wisselen de schermen voortdurend. Een pagina kan er zelf bij zetten met
  `Handenvrij.plek(naam, doen)`. Zeg "wat kan ik zeggen" voor de lijst.
- **Luisteren zonder klik.** De knop *Mond* zet continu luisteren aan, met een
  wekwoord ("Rahul, ..."); daarna blijft hij twaalf seconden wakker zodat een
  vervolgzin zonder wekwoord mag. Hij staat **uit** tot je hem zelf aanzet: een
  meeluisterende microfoon is geen standaardinstelling. *Stem* zet het
  terugpraten aan of uit ("stil" werkt ook).
- **Beginnen met typen.** Een losse letter, waar je ook bent op de pagina,
  belandt in de balk. Zonder dat pak je toch eerst de muis om bij het veld te
  komen, en dan is de hele opzet zinloos.

De grens: de balk herkent **navigatie** en anders niets. Elke zin die niet
zeker een sprong is, gaat onveranderd naar Rahul, met de geld-drempel en de
bevestiging die daar zitten. Zou de balk zelf gaan gokken wat een half-verstane
zin betekent, dan wordt een spraakfoutje een echte handeling. Verkeerd
navigeren is hinderlijk, verkeerd handelen niet. `test/handenvrij.test.js`
toetst precies dat: "boek een taxi naar huis" en "open de deur van kamer 12"
mogen nooit als navigatie gelezen worden. `test/handenvrij.e2e.js` doet het
daarna nog eens in een echte browser.

### Geld en boekingen typ je

Wat geld kost of ergens toe verplicht -- "boek een taxi", "stuur 20 euro",
"betaal dit", "reserveer een tafel" -- gaat **standaard niet met de mond**.
Rahul zet de zin klaar in het veld en je stuurt hem zelf. De reden is simpel:
spraak wordt niet altijd goed verstaan en een open microfoon hoort de kamer mee.
Een verkeerd verstane routebeschrijving is hinderlijk; een verkeerd verstane
betaling is geld dat weg is.

Wie het toch met de mond wil, zet het zelf aan in het gespreksvenster. Dan:

1. verschijnt er een **disclaimer, elke keer dat je hem aanzet** -- niet een keer
   weggeklikt en daarna nooit meer. De stand geldt per sessie
   (`sessionStorage`), zodat je hem niet een half jaar geleden hebt goedgekeurd.
   De tekst zegt onomwonden dat het eigen risico en eigen verantwoordelijkheid
   is en dat RTG niets vergoedt dat zo in gang wordt gezet;
2. vraagt hij het **per opdracht nog een keer**, vóórdat de vraag de deur uit
   gaat ("U zei: ... Zal ik dit doorzetten?");
3. en doet de server daarna nog zijn eigen geld-drempel. Met de mond zitten er
   dus twee poorten meer voor dan met getypte tekst.

De herkenning (`Handenvrij.geldZin`) leunt hier bewust de **andere** kant op dan
de navigatie: bij navigatie is niets-herkennen veilig, hier is te-veel-herkennen
veilig. Een valse treffer betekent typen; een misser betekent geld. Vragen
tellen niet mee: "wat kost een taxi" mag gewoon met de mond, want dat verplicht
je tot niets. `test/handenvrij.test.js` toetst beide kanten, en
`test/handenvrij.e2e.js` telt in een echte browser de verzoeken naar Rahul --
een gesproken boeking hoort er nul te veroorzaken.

De bestaande knoppen blijven allemaal staan; dit is een tweede weg, geen
vervanging.

### Het scherm van Rahul: vier standen die zichzelf zetten

`public/shared/handenvrij-scherm.js`. De chatbox is het **enige** dat permanent
in beeld staat; wat er eerder omheen zweefde (de losse Rahul-knop van de
metgezel, de pil met "draaien" en "volledig scherm") is erin opgegaan.

Vier standen: **min** (alleen de balk), **half**, **vol** en **scherm**
(volledig scherm). Hij beweegt uit zichzelf tussen de eerste drie: zegt Rahul
iets, dan komt hij omhoog; antwoord jij, dan zakt hij terug zodat je ziet waar
je mee bezig was. Zet je zelf een stand, dan blijft die staan -- een scherm dat
terugveert nadat je het met de hand hebt gezet, voelt kapot. Slepen aan de greep
werkt ook.

Drie regels die daar strak omheen zitten:

- **Je kunt altijd scrollen.** Deze laag zet nooit `overflow:hidden` op de body,
  en in de stand `vol` blijft er met opzet een strook pagina zichtbaar. Die
  strook is geen decoratie maar de uitweg: hij is te scrollen, en tikken laat
  het paneel zakken.
- **Staat iets anders op volledig scherm** (een video, een foto), dan verdwijnt
  de balk vanzelf en komt hij daarna terug in de stand waarin hij stond. Ons
  eigen volledige scherm telt daarbij niet mee, anders poetst hij zichzelf weg.
- **Op een bureaublad wordt de balk een paneel** rechtsonder
  (`handenvrij-bureau.js`), in plaats van een strook van een halve meter over
  een 27-inch monitor. Ctrl/Cmd+K zet de aandacht in het veld.

Op de **werkpagina's** (zaak, personeel, kantoor, backoffice, meldkamer) staat
er een smalle rij van hooguit vijf knoppen boven de balk. Liever gaat alles via
Rahul, maar iemand die aan het werk is mag daar nooit door vertraagd worden. Die
knoppen komen uit dezelfde plekkenlijst die Rahul gebruikt, dus er is maar één
waarheid over wat een pagina kan. Vijf en niet meer: een rij van vijftien is
weer gewoon een werkbalk.

`test/rahulscherm.e2e.js` toetst de vier beloften in een echte browser.

### De camera in de balk

Twee knoppen, en het verschil is niet cosmetisch (`handenvrij-oog.js`,
`server/kern/kijken.js`):

- **Kijk** -- je richt op iets en Rahul zegt wat het is. Die ene foto gaat naar
  het model, want anders is er geen antwoord, en dat staat er ook bij. Hij wordt
  **nergens** opgeslagen: niet in de database, niet op schijf, niet in een log.
  Zonder AI-sleutel zegt hij dat hij niet kan kijken in plaats van te raden.
  Staan er mensen op, dan beschrijft hij die niet en probeert hij niemand te
  herkennen; over iets medisch stelt hij geen diagnose.
- **Deel** -- een foto ergens neerzetten (De Salon). *Jij* kiest de bestemming;
  Rahul plaatst nooit iets uit zichzelf. Waar het heen kan vraagt de app aan de
  server, want dat hangt af van de pas en van wie je kent.

Let op het verschil met **RTG Eye** (`kern/oog.js`): daar draait de visielaag
volledig op het toestel en verlaat er geen beeld het apparaat. Dat is de
werkvloer, waar een camera de hele dag aan staat; zwijgend meekijken zou daar
een surveillancesysteem zijn. Hier richt het lid zelf, tikt zelf en vraagt zelf.

### Het salongesprek: Rahul kletst met de Rahul van je vriend

Een gimmick, en we noemen het ook zo (`server/kern/kletspraat/`). Twee AI's die
over de dag van hun mens ouwehoeren alsof het twee mensen zijn. Te openen vanuit
de ledenchat.

Het gaat wel over waar iemand was, dus er zitten **drie sloten** op, en alle
drie moeten open:

1. **Alleen tussen vrienden** -- een actieve connectie in de vriendenlaag,
   opnieuw gecontroleerd op het moment zelf.
2. **Alleen als beiden het aan hebben staan.** Standaard staat het uit. Zet
   iemand het uit, dan kan er niets meer gemaakt worden, ook niet door de ander.
3. **Alleen met verzonnen namen.** Elke echte zaaknaam gaat door
   `kletspraat/namen.js`: binnen een gesprek altijd dezelfde (anders klopt het
   verhaal niet), tussen gesprekken altijd anders (anders leg je ze naast elkaar
   en reken je alsnog uit waar iemand komt), en nooit per ongeluk een bestaand
   merk. Wat er bewaard wordt bevat dus geen enkele echte naam.

Het dagbeeld komt uit wat er tóch al staat -- de bestellingen en boekingen van
vandaag -- en er komt geen nieuwe verzameling persoonsgegevens bij. Er staan
**geen bedragen** in, ook niet bij benadering: hooguit "iets kleins" of
"uitgebreid". Geen berichten, geen locaties, geen agenda, geen andere mensen.
En hooguit één gesprek per paar per dag; dit hoort een verrassing te zijn, geen
knop waar je op blijft drukken. `test/klets.test.js` bewaakt alle drie de
sloten, inclusief de controle dat er geen echte naam in de opslag belandt.

### Het werkblad: je scherm zelf indelen

Op een kantoorwerkplek (>=1100px) liggen meerdere dingen tegelijk open. Daarom
kan elke werkpagina zichzelf opdelen in vlakken: 1, 2 naast elkaar, 2 boven
elkaar, 3 of 4 (`public/shared/werkblad.js` + `.css`). De verhouding zet je door
de scheiding te verslepen, en die keuze blijft staan per pagina en per toestel.
De knoppenrij staat in de kopbalk van de pagina, niet in de console van Rahul --
een knop die verdwijnt zodra je de console dichtklapt, is geen knop.

Twee dingen zijn met opzet zo:

- **Tegels, geen zwevende vensters.** Die bestaan al (`shared/vensters.js`) en
  zijn goed om even iets bij te pakken. Ze overlappen, en dat is precies wat je
  niet wilt als twee schermen de hele dag naast elkaar moeten staan.
- **Het eerste vlak is de pagina zelf**, verhuisd en niet gekopieerd. Anders zet
  je twee versies van hetzelfde scherm naast elkaar die elkaars gegevens niet
  zien. De kopbalk van de pagina blijft de bovenrand van het werkblad, zodat wat
  de pagina met `position:fixed` neerzet binnen zijn eigen vlak blijft.

De console van Rahul is op het bureaublad te **verplaatsen en van maat te
veranderen** (`handenvrij-bureau.js`); ook dat blijft onthouden. Slepen naar
links en rechts verzet hem, omhoog en omlaag blijft van de standen.
`test/werkblad.e2e.js` toetst het in een echte browser.

## Tests

```bash
npm test
```

Draait de geautomatiseerde tests (Node's eigen testrunner, geen extra
packages). Ze bewaken de plekken waar geld en wet aan hangen:

- de identiteitskluis (naam/e-mail versleuteld, codenaam operationeel),
  wachtwoord-hashing (scrypt) en sessietokens;
- de zzp-belastingtool (rekenkundige invarianten, afscherming per pas,
  peiljaar) en de leeftijdslaag (leeftijdsgroep uit de geboortedatum);
- De Salon-rechten (gast liket wel, reageert niet), de bestel- en betaalflow
  en de AVG-rechten (inzage en definitieve verwijdering).

De tests draaien in een tijdelijke datamap (`RTG_DATA_DIR`) en raken de echte
data nooit aan.

Uit de veiligheidsrondes kwam een tweede groep die niet controleert of iets
wérkt, maar of een belofte waar is:

- `herstelproef.test.js` zet een backup echt terug en logt daarna in — de test
  die de lege backups vond;
- `bewaartermijnen.test.js` bewaakt beide kanten: niet te lang bewaren (AVG) en
  niet te kort (de zeven jaar van art. 52 AWR);
- `bewaarwacht.test.js` bewaakt vooral dat de wacht nóóit wist;
- `pas-escalatie.test.js` bewijst dat zelf-registreren geen betaalde pas geeft
  en dat een menselijk akkoord dat wél doet;
- `papieren.test.js` bewaakt dat Rahul het AVG-papierwerk uitvraagt maar er
  nooit een antwoord bij verzint, en dat het register zijn eigen gaten toont;
- `vergeten.test.js`, `inzagelog.test.js`, `scheiding.test.js` en
  `loghygiene.test.js` voor vergetelheid, het inzagejournaal, de scheiding
  tussen codenaam en identiteit, en of er geen persoonsgegevens in de logs
  belanden.

Sommige tests hebben een écht Lifestyle- of Business-lid nodig. Dat kan sinds de
pas-poort niet meer via registratie; `test/helper.js` heeft daarvoor
`elevateTier()`, dat de geldige weg loopt (registreren als RTG → aanvraag →
kantoor accepteert).

### De Postgres-toetsen (`npm run test:pg`)

Zeven toetsen bewijzen de meerdere-instances-kant: de gedeelde store, de
accountsspiegel, gelijktijdige schrijvers, de Postgres-ledengids, het
transactie-grootboek, en twee zware integratietoetsen (GRAND en SLOOPHAMER) met
twee servers op één Postgres plus één Redis-bus. Zonder `DATABASE_URL` slaan ze
netjes over; met een database erbij:

```bash
DATABASE_URL=postgres://postgres@127.0.0.1:5433/rtgtest \
REDIS_URL=redis://127.0.0.1:6380 npm run test:pg
```

Twee dingen die hier eerder misgingen, en waarom het script bestaat:

- **De poort stond te lang dicht.** `test/pg.test.js` en `test/pgaccounts.test.js`
  wachtten ook op het NPM-pakket `pg`, terwijl de code al lang op onze eigen
  pgwire-client draait. Die toetsen sloegen dus ALTIJD over, ook met een echte
  database ernaast -- acht toetsen die niets bewaakten. De wachtstand is eruit.
- **Ze willen de database voor zichzelf.** Meerdere PG-toetsen droppen en maken
  dezelfde tabellen, en `node --test` draait bestanden parallel. Dan trekt de een
  de tabel onder de ander weg en krijg je spookfouten die niets met de code te
  maken hebben. Vandaar `--test-concurrency=1` in het script (of geef elke toets
  een eigen database).

### De blinde vlek (`test/blindevlek.test.js`)

Alle andere toetsen draaien op de **server**. Ze bewijzen dat de endpoints
kloppen, en dat is precies wat ze bewijzen -- niet dat de pagina die ze gebruikt
ook maar een regel JS uitvoert. Daar zijn er twee fouten maandenlang doorheen
gelopen terwijl alles groen stond: op RTG Kantoren sloot een ingeplakte
scriptregel het inline script af (halve pagina als platte tekst in beeld), en op
de hangar stond een ternair zonder dubbele punt (het script draaide nooit).

Dit bestand jaagt daarom op **klassen** van stille fout, niet op gevallen:

1. elk inline script op een pagina is geldige JS;
2. elk eigen script-, stijl- en beeldpad bestaat echt;
3. elk `.html`-adres dat in JS staat (een schermenlijst, een knop die iets opent)
   bestaat als bestand of als route -- `/apps/bureau.html` is bijvoorbeeld geen
   bestand maar een omschrijving in de voordeur;
4. geen dubbele `id` op een pagina (de tweede doet stil niets);
5. elk `/api`-pad dat de app aanroept bestaat op de server. De lijst komt niet
   uit de broncode maar uit de **echte** router: `scripts/routekaart.js` start de
   app en leest `app._routes()` (`server/web/routing.js`). Uit de broncode kan het
   niet, want een deel van de routes hangt aan een voorvoegsel-hulpje;
6. elke gelezen opslagsleutel wordt ook ergens gezet (naamdrift: een pagina die
   altijd uitgelogd lijkt);
7. geen handler in een HTML-attribuut -- de nonce-CSP weigert die, dus zo'n knop
   ziet er goed uit en doet niets. Ook in JS die HTML opbouwt, en ook in een
   venster uit `window.open('')`: dat erft de CSP van de pagina;
8. er wordt niet gezocht naar een element dat nergens bestaat. Deze lijst met
   uitzonderingen is nu **leeg**: de vier resten van de oude inlogformulieren van
   de leden-app (regForm, toReg, toLogin, resetForm) zijn opgeruimd nu de poort
   een gesprek met Rahul is. Wat hier bij zou moeten, is in principe code die weg
   mag.

Bij het schrijven vonden 3, 6, 7 en 8 elk een echte fout: RTG Kantoren had een
scherm in de lijst dat niet bestaat, de werkplek las een token-sleutel die
niemand zet (wie geen kantoorsessie had kwam er nooit in), de printknop op het
tafel-QR-blad zat op een geweigerde handler, en de coach-vraagbalk op de PDA had
geen `id` waardoor de cursor er nooit in belandde.

Regel voor dit bestand: vind je een nieuw soort stille fout, dan komt er een
scanner bij. En een scanner die roept bij dingen die kloppen is erger dan geen
scanner -- dus liever iets milder dan valse alarmen.

## Datamap instelbaar (RTG_DATA_DIR)

Standaard staan database, sleutels en uploads in `server/data`. Met
`RTG_DATA_DIR=/pad/naar/data` verplaatst u die map, handig om data en sleutels
op productie los van de app-schijf te zetten (bijvoorbeeld op een aparte
volume of secrets-mount) en om tests te isoleren.

## Noodserver (tweede adres, andere machine)

Naast de drie hoofdservers met poortwachter (`npm start`) is er een losse
**noodserver** die op een andere machine bij een andere hoster hoort te draaien:

```bash
RTG_HOOFD_URL=https://rahultravelgroup.example npm run nood
```

De noodserver (standaard poort 3100, instelbaar met `RTG_NOOD_POORT`) serveert
alle apps en pagina's zelf en stuurt API-verkeer door naar de hoofdingang.
Vallen de hoofdservers of hun datacenter uit, dan blijven alle pagina's op het
noodadres gewoon laden; de API antwoordt dan met een nette uitleg en de apps
tonen hun demoweergave tot de hoofdservers terug zijn. Eigen status:
`GET /nood/health`.

Alle apps zijn ook op desktop te openen: de telefoon-apps (leden-app,
partner-apps, PDA) tonen op een breed scherm een gecentreerd toestelkader, de
backoffice is een volwaardige desktopwerkplek, en elke app is als PWA ook op
de desktop te installeren (Chrome/Edge: installeren via de adresbalk).

## Zonder backend

De HTML-bestanden werken ook los (dubbelklikken of statische hosting): het portaal schakelt dan automatisch over naar lokale demo-data. Alle interactie werkt, maar niets wordt bewaard.

## API-overzicht

| Endpoint | Doel |
|---|---|
| `POST /api/login` `{tier}` | Demo-login (guest / rtg / lifestyle / business), geeft token + state |
| `POST /api/state` | Actuele state voor de ingelogde gebruiker |
| `POST /api/pay` `{invoiceId}` | Betaal een openstaande factuur (werkt de reis-tijdlijn bij) |
| `POST /api/like` `{postId, liked}` | Like/unlike (mag iedereen, ook gasten) |
| `POST /api/comment` `{postId, text}` | Reageren, rechten per pas, server-side afgedwongen |
| `POST /api/dm` `{postId, text}` | Privébericht, zelfde rechten als reageren |
| `POST /api/ai` `{messages}` | Persoonlijke AI (Claude indien key aanwezig, anders demo) |
| `POST /api/logout` | Sessie beëindigen |
| `POST /api/partner` `{code}` | Partnercode valideren (demo-codes: `NOVA`, `ATLAS`) |
| `POST /api/staff` `{staffCode}` | Personeelscode van een partnerbedrijf valideren |
| `POST /api/partnertrips` `{staffCode?}` | Gecureerde reizen, alleen totaalprijzen; met geldige personeelscode ook personeelsprijzen |
| `POST /api/book` `{code \| staffCode, tripId, name, email}` | Boeking zonder pas via een partner of personeelscode |
| `POST /api/cv/get` / `POST /api/cv/save` | Het RTG-cv van het lid (de cv-builder in de leden-app) |
| `POST /api/member/apply` `{supplierCode, func}` | Solliciteren bij een partner; kan pas met een afgerond cv |
| `POST /api/supplier/apply` `{code, name, func, contact}` | Open sollicitatie via het startscherm van een partner-app |

### RTG School (de onderwijs-toren)

Een leven lang leren op een eigen motor, van kleuterklas tot universiteit en daarna. Gebouwd in zes golven; de kern:

- **Het leerpaspoort** (`server/kern/onderwijs.js`): hangt aan de codenaam (nooit een echte naam), volgt de officiële Nederlandse ladder (groep 1-8, referentieniveaus, vmbo/havo/vwo, mbo 1-4, hbo, wo) en telt elk behaald leerdoel mee. Overgaan wordt geadviseerd door het systeem, besloten door een mens.
- **De leerstof-motor** (`server/kern/leerstof.js` + `leerstof-data/`): 20 vakken en 70+ leerdoelen met een les in gewone taal en verse opgaven uit generatoren (`leerstof-gen.js`). Server-authoritatief: het juiste antwoord verlaat de server nooit. Vijf opgaven per sessie; bij vier goed wordt het doel bijgeschreven.
- **Examentraining en niveau-advies** (`server/kern/leerstof-vervolg.js`): tien vragen zoals een echt examen (terugblik pas aan het eind), de cijferindicatie is een ADVIES; het niveau-advies telt behaalde doelen en zegt eerlijk waar je staat.
- **Rahul Bijles** (`server/kern/bijles.js`): ieders eigen bijlesleraar, geduldig en positief, op het niveau uit het paspoort; werkt ook zonder AI-sleutel (vaste demo-uitleg) en tweetalig via de thuistaal.
- **School × RTF** (`server/school/`): klassen, huiswerk, toetsen op dezelfde leerdoelbibliotheek, de tweetalige laag (NL blijft altijd staan), in-app bellen, excursies met tijdelijke GPS (toestemming, stop = wissen, kijklog), de vrijwillige ouderbijdrage, de telefoonboom en de hulplijn (de knop van het kind zelf; vertrouwelijk = alleen de mentor).
- **De schermen**: `/apps/rtgschool.html` (leden: paspoort, lessen, oefenen, examentraining, advies, bijles), `/apps/foundation/school.html` (gezin: kind en ouder, incl. hulplijn en aankomende toetsen) en `/apps/schoolpartner.html` (school: directie, leraar, mentor).
- **AI-bedienbaar**: alle onderwijs-routes lopen over het gewone stuur (`/api/member/doe`), dus Rahul kan inschrijven, overhoren en bijles regelen met de inlog van het lid zelf, binnen dezelfde remmen (bewaakt door `test/onderwijsstuur.test.js`).

Vaste eerlijkheidsregels, in code en tests verankerd: RTG School is geen school of examenbureau (diploma's en examens lopen via de officiële instellingen); cijfervoorstellen zijn advies (een mens beslist); een toets verklikt niet halverwege; geen scores buiten de sessie, geen reeksen, geen ranglijsten -- leren is geen wedstrijd.

#### De enterprise-laag: het hele schoolbedrijf, niet alleen de klas

Bovenop het schoolkanaal draait een volledige enterprise-laag, in acht delen,
allemaal onder `/api/foundation/school/...` en in modules van 4-9 KB
(`server/school/`). De poort eronder is één functie: `poort(req, res, recht)`
uit `school/rollen.js`, die het beheer-token van de school (directie) of een
personeel-token met de juiste rol accepteert.

| deel | modules | wat erin zit |
|---|---|---|
| **Rollen & rechten** | `rollen.js` | veertien rollen (leerling t/m systeembeheerder), een rechtenmatrix, het inzagejournaal per school |
| **School Core** | `inschrijving.js`, `inschrijving-mutatie.js`, `dossier.js`, `organisatie.js` | aanmelding, wachtlijst, plaatsing, uitschrijving, overstap, leerlingdossier met contact- en gezinsgegevens, documenten/diploma's, zorgdeel, vestigingen, opleidingen, schooljaarovergang |
| **Learning** | `rapport.js`, `rapport-tekst.js` | periodrapporten, conceptteksten (AI = advies), vaststellen door een mens, studievoortgang, individuele leerdoelen en remedial teaching (in het zorgdeel) |
| **Communicatie** | `omroep.js` | nieuwsbrief (meertalig), automatische herinneringen, vakgroepgesprek; bellen en videobellen zaten al in `bellen.js` |
| **Aanwezigheid & veiligheid** | `aanwezigheid.js`, `veiligheid.js`, `veiligheid-incident.js` | presentie per les, te laat, verlofaanvraag met besluit, toegangspassen, bezoekers, incidentregistratie, ontruimingslijst, calamiteitenmelding |
| **Finance** | `financien.js`, `financien-beheer.js` | schoolgeld en ouderbijdragen als factuur, betaallink, terugbetaling, kantinesaldo, budgetten, subsidies, debiteuren, rapportage en boekhoudexport |
| **HR** | `hr.js`, `hr-verlof.js` | personeelsdossier, contract, bevoegdheden en trainingen, verlof en ziekte, vervanging, urenregistratie, gesprekken |
| **AI & Analytics** | `analyse.js`, `analyse-signalen.js` | directiedashboard, waarschuwingen met hun eigen rekensom, signalen rond een leerling |
| **Koppelingen & portaal** | `koppelingen.js`, `webhook.js`, `machtiging.js`, `peiling(-antwoord).js`, `ouderportaal(-mijn).js` | integratieregister met veldkeuze, ondertekende webhookbezorging, machtigingenregister, anonieme tevredenheidspeiling, export, toestemmingsformulieren, gespreksafspraken, het gezinsoverzicht |

Schermen: de directiepanelen staan in `/apps/schoolpartner.html`
(`schoolpartner/enterprise.js` + `enterprise-beheer.js`), de ouder- en
leerlingkant in `/apps/foundation/school.html`
(`foundation/school-portaal.js`).

**De acht regels die deze laag anders maken dan een standaardpakket.** Ze staan
niet in een folder maar in code, en `test/schoolenterprise.test.js`,
`test/schoolaanwezig.test.js`, `test/schoolgeld.test.js` en
`test/schoolbeeld.test.js` (28 toetsen) laten ze zakken zodra ze niet meer waar
zijn:

1. **Geld raakt nooit het onderwijs.** Er is geen functie die een leerling
   afsluit wegens een openstaande post; elk financieel antwoord draagt
   `blokkeertOnderwijs: false`. Een leeg kantinesaldo weigert geen eten (het
   verschil wordt een factuur), en een vrijwillige ouderbijdrage wordt hooguit
   één keer herinnerd -- vaker vragen maakt vrijwillig alsnog verplicht.
2. **Het zorgdeel gaat alleen open met een reden.** Zorg, incidenten,
   personeelsdossiers en de export vragen een reden en schrijven een regel in
   het journaal: wie, wanneer, waarover en waarom -- nooit wat er stond, want
   dan was het journaal een tweede, ongeschermde kopie van het dossier.
3. **De systeembeheerder komt niet in dossiers.** Hij beheert koppelingen en
   leest het journaal; leerlinggegevens, zorg en geld staan voor hem dicht.
4. **Geen loopspoor.** Van een toegangspas wordt alleen de HUIDIGE stand
   bewaard (binnen/buiten, sinds wanneer, welke ingang) plus een dagteller. Er
   is dus geen endpoint dat "waar was dit kind vandaag" kan beantwoorden. De
   ontruimingslijst valt terug op de presentie van vandaag als een school geen
   poortjes heeft.
5. **Een rapport stelt een mens vast.** De AI schrijft hooguit een concept (met
   de bron erbij, en zonder sleutel een feitelijke opzet uit de cijfers); er is
   geen route die publiceert zonder dat iemand bevestigt de teksten te hebben
   gelezen. De gezinskant toont alleen vastgestelde rapporten.
6. **Geen voorspelling, geen ranglijst.** De signalen rond een leerling zijn
   factoren met een natrekbare uitleg ("6 van 16 lessen gemist in zestig
   dagen"), zonder score en zonder volgorde op zwaarte. Een waarschuwing noemt
   zijn eigen rekensom en zwijgt onder de tien lesregistraties.
7. **Een koppeling noemt wat hij deelt.** Velden kies je uit een vaste lijst;
   zorg, incidenten, de hulplijn en het journaal staan er niet in en zijn er
   niet aan toe te voegen. Zonder veldkeuze gaat een koppeling niet aan.
8. **Toestemming is intrekbaar, en geen antwoord is geen toestemming.** Dat
   laatste staat ook zo in het overzicht van de school.

Drie dingen die in de eerste ronde nog openstonden, zijn daarna gebouwd -- en
het derde bewust maar half:

- **De webhooks bezorgen nu echt** (`school/webhook.js`). Elke levering draagt
  een HMAC-SHA256 over het exacte lijf in `X-RTG-Handtekening`, wordt bij een
  fout twee keer opnieuw geprobeerd, en telt mislukkingen op de webhook zelf
  met een waarschuwing in het log; na tien op rij valt hij stil tot de school
  hem wekt (`/school/webhook/wek`). Het lijf meldt **dat** er iets is gebeurd
  met ids -- geen namen, geen cijfers, geen zorg. Wie de inhoud wil, haalt hem
  daarna op met zijn eigen recht, zodat een webhook nooit een sluiproute om de
  rechtenmatrix wordt. `/school/webhook/proef` stuurt een proeflevering en zegt
  precies wat eruit kwam. Een intern adres kan alleen met
  `RTG_SCHOOL_WEBHOOK_INTERN=1` (zelfde schakelaar als bij de fout-melder); het
  cloud-metadata-adres blijft ook dan dicht.
- **Machtigingen worden vastgelegd** (`school/machtiging.js`), maar er is nog
  steeds **geen incasso-run** -- en dat is een besluit. Het register weet wie
  heeft getekend, voor welk maximum, wanneer en via welk kanaal; het volledige
  rekeningnummer staat er niet in (alleen de laatste vier tekens), want er
  wordt niets geïnd. Elk antwoord draagt `geindNu: false`, en een factuur met
  de incasso-vlag zegt of er een geldige machtiging ligt. Intrekken kan altijd,
  ook door het gezin zelf, zonder reden en per direct.
- **Tevredenheid wordt gemeten** (`school/peiling.js`), anoniem: alleen scores
  van 1 tot 5, een hash met het schoolgeheim tegen dubbel stemmen die los staat
  van het antwoord, geen vrije tekst (die maakt een kleine groep herleidbaar),
  geen cijfer per medewerker, en **geen uitslag onder de vijf antwoorden**.
  Zolang die grens niet is gehaald, staat er nog steeds `null` op het dashboard
  met de reden erbij.

### RTG Horeca OS (de horecatoren)

Het huis had al een kassa (`routes/supplier/kassa/`), tafels en tafelstatussen,
reserveringen, een keukenbrein met recepturen en voorraad (`kern/keuken.js`),
hotelkamers met check-in en housekeeping, eventdraaiboeken en een bezorgrit met
gps. Wat er niet was, is de laag die daar een besturingssysteem van maakt: een
REKENING die blijft leven, keukenschermen met tijden, bezorgzones, een club, de
gastrekening van het hotel en de zakelijke kant van een event.

Die laag staat in `server/kern/horeca.js` (de rekenlaag) plus veertien
deelmodules in `server/routes/supplier/horeca/`, allemaal onder
`/api/supplier/horeca/...` en dus binnen de bestaande partner-functie van de
schakelkast.

| deel | modules | wat erin zit |
|---|---|---|
| **Hospitality Core** | `rekening.js`, `schuif.js`, `betalen.js`, `bonnen.js` | rekening openen op dertien kanalen (tafel, bar, club, terras, afhaal, bezorging, roomservice, hotelrestaurant, foodtruck, event, kiosk, QR, online), gangen vrijgeven, verplaatsen, samenvoegen, splitsen per persoon of per product, korting met reden, fooi, deelbetalingen met meerdere methoden, cadeaubon en tegoed, happy hour, arrangementen, en een offline-wachtrij |
| **Kitchen** | `keuken.js`, `keuken-regie.js` | stationsborden, de standen besteld → gestart → bereid → klaar → uitgegeven, bereidingstijden per gerecht, het regiescherm van de chef met staat-koud per tafel, en een drukterem in keukenminuten |
| **Delivery** | `bezorging.js`, `bezorgrit.js` | bezorgzones op postcode of straal met kosten, minimum en gratis-vanaf, tijdsloten met capaciteit in keukenminuten, een gecombineerde route en het afleverbewijs met leeftijdscontrole |
| **Club & Bar** | `club.js` | polsbandtegoed, minimum spend per VIP-tafel, gastenlijst met promotercodes, en een deurteller met herbetreding en capaciteit |
| **Hotel** | `folio.js` | een gastrekening waarop kamer, ontbijt, restaurant, minibar, spa, roomservice, parkeren, wasserij en schade samenkomen; de nachtrun, de toeristenbelasting en de borg |
| **Events** | `event.js` | offerte, akkoord met naam, versiebeheer, aanbetaling en nacalculatie met marge |
| **Inventory & HACCP** | `haccp.js` (+ het bestaande `kern/keuken.js`) | temperatuurmetingen met verplichte actie bij een afwijking, batches met THT, en controlelijsten |
| **Workforce & CRM** | `personeel.js` | de fooienpot, loonkosten tegenover omzet, en het gastprofiel met voorkeuren en punten |
| **Analytics** | `dashboard.js` | het dagbeeld per kanaal en per betaalwijze, en de signalen |

**De regels die deze laag anders maken dan een kassasysteem.** Ze staan in code
en `test/horeca-rekening.test.js`, `horeca-keuken.test.js`,
`horeca-bezorg-club.test.js`, `horeca-hotel-event.test.js` en
`horeca-vloer.test.js` (38 toetsen) laten ze zakken zodra ze niet meer waar zijn:

1. **Splitsen en samenvoegen zijn verplaatsingen.** `controleerSom()` vergelijkt
   de netto waarde voor en na, tot op de cent; klopt het niet, dan gebeurt er
   niets. 10,00 door drie is 3,34 + 3,33 + 3,33, en een percentagekorting gaat
   evenredig mee in plaats van te verdampen.
2. **Een bestelde prijs verandert nooit meer.** Happy hour rekent op het moment
   van bestellen; de lijstprijs blijft naast de kortingsprijs staan.
3. **Fooi is geen omzet** — niet op de rekening, niet in het loonpercentage, en
   nooit voorgevuld. De fooienpot wordt verdeeld over gewerkte uren inclusief
   keuken en afwas, en telt exact op tot de pot.
4. **Wat niet betaald wordt, verdwijnt niet**: oninbaar mét reden, zichtbaar in
   het dagbeeld. Te veel betalen bestaat niet.
5. **De keuken begint niet aan een gang die de zaal niet heeft vrijgegeven**, en
   de allergie staat in een eigen veld dat op elk scherm meegaat.
6. **Tijd is een feit, geen kleurtje**: elke bon draagt zijn looptijd naast zijn
   norm, en de drukterem waarschuwt met zijn rekensom in plaats van zelf de
   bestellingen dicht te zetten.
7. **Een weigering noemt zijn reden**: buiten de bezorgzone, een vol tijdslot
   (met het eerstvolgende erbij), een lege polsband, een volle deur.
8. **Geld van gasten blijft van gasten**: een polsband kan niet onder nul en het
   restsaldo gaat terug; een borg is een aantekening en blokkeert niets bij de
   bank (`geblokkeerdBijBank: false`).
9. **Op de kamer boeken kan alleen als daar een open gastrekening staat**, en de
   nachtrun is idempotent op de datum.
10. **Een offerte wordt pas een opdracht na een akkoord met naam**; posten
    wijzigen daarna maakt een nieuwe versie die opnieuw bevestigd moet worden.
11. **Een afwijking zonder actie bestaat niet** (HACCP), een meting corrigeren
    laat de oude waarde staan, en een controlelijst is niet in een keer af te
    vinken.
12. **Elk gemiddelde noemt zijn noemer**, en er wordt niets voorspeld wat we
    niet meten: het dagbeeld toont wat er nu open staat en wat er vandaag
    binnenkwam, geen omzetprognose.

Wat deze laag bewust **niet** doet: hij bouwt de kassa, de voorraad, de
recepturen, de tafelstatussen, de reserveringen, de hotelkamers en het
eventdraaiboek niet opnieuw. Een betaalde horecarekening boekt zijn
ingredienten af via het bestaande `kern/keuken.js`, met een logregel op naam van
de rekening. Er is dus geen tweede voorraadadministratie -- en dat is precies de
bedoeling (LAT-regel 4).

Schermen: `/apps/horeca.html` is de dienst zelf -- de zaal (rekening openen,
bestellen met de allergie in een eigen veld, een gang vrijgeven, splitsen,
afrekenen) en de keuken (het stationsbord met looptijd naast de norm, de standen
en het regiescherm). Daarnaast staan er zeven werkschermen, bereikbaar vanaf die
pagina:

| Scherm | Waarvoor |
| --- | --- |
| `/apps/horeca-expeditie.html` | de pas: per tafel en gang wat er klaar is en hoe lang het eerste bord al koud staat, uitgeven met de hand, en de drukterem met zijn rekensom |
| `/apps/horeca-bezorg.html` | zones, adrescheck, tijdsloten in keukenminuten, de ritvolgorde, en de rit zelf van inpakken tot afleverbewijs |
| `/apps/horeca-hotel.html` | de gastrekening (folio), de nachtrun, de borg, en roomservice die op de kamer wordt geboekt |
| `/apps/horeca-events.html` | offerte, akkoord met naam, aanbetaling, kosten en nacalculatie |
| `/apps/horeca-club.html` | polsbandtegoed, minimum spend per tafel, de deurteller en de gastenlijst per promoter |
| `/apps/horeca-haccp.html` | temperatuurlogboek met verplichte actie bij een afwijking, batches met houdbaarheid, controlelijsten |
| `/apps/horeca-beheer.html` | de dag over alle kanalen, de fooienpot, loon tegenover omzet, gastprofielen en de signalen |

De bedrading (zaak-sessie, API-aanroep, meldbalk, de deur voor wie uitgelogd
komt) staat een keer in `public/apps/horeca/kern.js` en de vormtaal een keer in
`public/apps/horeca/scherm.css` -- niet acht keer gekopieerd.
`test/horecascherm.e2e.js` en `test/horecaschermen.e2e.js` doen het na in een
echte browser, inclusief de beweringen die er het meest toe doen: een gang die
de zaal niet heeft vrijgegeven staat NIET op het keukenscherm (en met vrijgave
staat de allergie erbij), wat is uitgegeven verdwijnt van de pas, en roomservice
die op de kamer wordt geboekt komt op de gastrekening van diezelfde kamer
terecht.

### RTG Werk OS (de werkplek van een organisatie)

`server/bedrijf/` + `/api/bedrijf/...` + `/apps/werk.html`. Een **werkruimte**
per organisatie (holdings met dochters eronder), met eigen leden, rollen,
journaal en startscherm -- zodat dit ook aan een andere organisatie te geven is.

| Module | Wat erin zit |
| --- | --- |
| Werkruimte | leden (aanmelden is niet binnen zijn), rollen met een venster van/tot, journaal, uit dienst |
| Projecten | projecten, taken, subtaken, afhankelijkheden, kanban, uren, budget |
| Kennis | artikelen met eigenaar, houdbaarheidsdatum, versie en afscherming |
| Klanten | klanten met hun RTG-producten, verkoopkansen, gewogen pijplijn |
| Service | tickets met twee SLA-klokken, storingen, evaluatie, tevredenheid |
| Bouw | repositories, issues, releases per omgeving, feature flags |
| IT | apparaten, licenties, het uitdienstproces in zes stappen |
| Recht | contractbibliotheek met een uitgerekende laatste opzegdag |
| Governance | voorstel, adviesronde, stemronde, besluit met evaluatiemoment |
| Beeld | het directiebeeld en de geconsolideerde blik over dochters |

Wat deze laag met opzet **niet** doet: geen tweede Docs, chat, agenda of
loonrun. Die staan al in dit huis (`kern/office/` met zes documentsoorten,
`routes/rtmail.js`, `routes/agenda.js`, `routes/payroll.js`, `kern/klok.js`,
`kern/facturatie.js`, `routes/sso.js`, `routes/scim.js`) en worden
**aangesloten**: een lid koppelt eenmalig zijn eigen RTG-account en ziet daarna
zijn agenda, postvak en kluis op zijn werkstartscherm -- met tellingen en
titels, nooit de inhoud.

De regels die de laag dragen staan in de code en niet in een handleiding:
voortgang wordt geteld en nooit ingevuld; een cirkel in de afhankelijkheden
wordt geweigerd; naar productie gaat alleen wat groen is, met een mens die
tekent; een feature flag zonder opruimdatum bestaat niet; de laatste opzegdag
wordt uitgerekend uit de einddatum en de opzegtermijn; stemmen kan pas na de
adviesronde en het beheer-token stemt niet; en wat niet gemeten wordt staat
overal als **niet gemeten** in plaats van als nul.

### RTG Bank & RTG Stad (de eigen infrastructuur)

- **RTG Bank** (`server/kern/bank/` + `kern/bankregie/`): een eigen dubbel-boekhoudend grootboek naast RTG Pay (som altijd exact nul, bewaakt door BANK-01 en PAY-02 op het technische bord). De boardroom-knop heeft drie standen (partner / hybride / eigen) met vier-ogen-autorisatie bij opschalen en een nood-fallback naar de kaart-rails; de leden-bank (rekeningen met echt IBAN, sparen, passen, krediet, salarisrun uit de klokuren) gaat pas open als de boardroom hem live zet en het lid akkoord geeft. In de eigen-stand lopen ook de Pay-autoload en de 30% RTFoundation-afdracht over de eigen rails.
- **RTG Stad** (`server/kern/stad/`): het slimme-stad-platform op eigen hardware (de Stadsdoos-vloot, aanmelden met een eenmalig getoonde apparaat-sleutel; poorten `/api/stad/doos/*` met een rem per doos) en eigen software: acht domeinen met standen en regimes, één scenario-knop (nacht t/m nood, nood meldt de meldkamer en staat in het rampbeeld), een zelfschrijvende werklijst voor de veld-app en de bewonersapp Mijn Stad (meldingen op codenaam die als klus bij de veldploeg landen). Privacy by design: de stad meet dingen, geen mensen — geen camera's, geen persoonsvolging; de vrije tekst van bewonersmeldingen gaat niet mee in de AI-dataset.

**Blijf ingelogd:** sessies worden bewaard (server-side in `db.json`, client-side in de browser). Wie inlogt blijft ingelogd, ook na een herstart van de server of het sluiten van de app. Uitloggen kan in elke app (leden-app: onderin het meldingenpaneel; partner-app: de gebruikerschip rechtsboven; personeels-app: Wissel). Personeels-PIN's zijn beschermd tegen raden: na vijf foute pogingen volgt een minuut wachttijd.

## Eén account voor alles

Mensen registreren zich één keer (het leden-account met codenaam in de kluis).
Elke andere rol is daarna een **koppeling** aan dat ene account, nooit een
nieuw account: personeel koppelt door één keer zaak-code + eigen PIN te
bewijzen, de zaak met de bedrijfsinlog, het kantoor met de backoffice-code
(en TOTP als die aanstaat). Daarna toont elk inlogscherm "verder met uw
RTG-account" en munt `/api/account/start` exact dezelfde sessie als de losse
inlog (zelfde `rememberSession`, zelfde logs). Endpoints:
`/api/account/{rollen,koppel,start,ontkoppel}` (kern/eenaccount.js); het
AI-stuur blijft bewust van deze sleutelbos af.

### Het eigenaarsaccount en de boardroom-poort

In de demo bestaat één eigenaarsaccount: **Rahul Imran Ismail** (inlog
`Rahul` of het eigenaars-e-mailadres, wachtwoord `Imran`, instelbaar met
`DEMO_PASS`; het e-mailadres met `RTG_OWNER_EMAIL`). De kantoor- en zaak-rol
hangen er standaard aan, dus na de leden-inlog is elke werkplek een rolkeuze.
**De boardroom is de kamer van de eigenaar:** alle boardroom-besluiten
(schakelkast, geld-, mall- en AI-regie, paniek-besluiten, wereld-acties,
AI-dataset-export) lopen door de boardroom-poort en openen alleen voor de
eigenaar, of voor wie hij op codenaam toegang heeft gegeven
(`/api/office/boardroom/toegang{,/geef,/weg}`). De anonieme backoffice-code
heeft geen identiteit en komt er dus nooit in; de rest van het kantoor blijft
gewoon op de office-inlog werken.

Wie de eigenaar is, staat op één plek: `server/eigenaar.js` (startadres uit
`RTG_OWNER_EMAIL`, anders de ingebouwde standaard). Het eigenaarschap is over
te dragen op de technische pagina onder **Eigenaarschap**
(`POST /api/techniek/eigenaar`), met drie sloten: het wachtwoord van de
huidige eigenaar op dat moment, een nieuw adres waar al een RTG-account bij
hoort (anders zou de pagina voor iedereen dichtzitten) en een spoor in het
logboek plus een kritieke beveiligingsmelding. De keuze staat in de database
en wordt bij het opstarten teruggezet, dus een herstart draait hem niet terug.

## Privacy & security

- **Pseudonimisering by design:** klanten staan in alle operationele systemen op hun codenaam; echte namen liggen in een gescheiden kluis en worden pas bij ticketing/check-in gekoppeld.
- **Versleuteling in rust:** met `RTG_ENC_KEY` gaat alles wat op schijf komt door `server/kluis.js` (AES-256-GCM, per waarde een eigen nonce, authenticated): de database (JSON, SQLite en de Postgres-waarden), het transactiegrootboek, de geheugen-brokken, de identiteitsbewijzen en de mail-outbox. Naam, e-mail en telefoon liggen daarnaast altijd in de identiteitskluis (`RTG_VAULT_KEY`), net als het ledendossier (`users.member_state`: gesprekken, boekingen, geboortedatum) — dat zit in dezelfde rij als de identiteit, dus dat platte tekst laten zou het codenaam-ontwerp uithollen. Bestaande platte velden blijven leesbaar en migreren bij de eerstvolgende schrijfactie (markering `RTGV1:`). Beloftes zijn hier goedkoop, dus `test/rust.test.js` doet het omgekeerde: die zet herkenbare gegevens via de gewone endpoints in een echte server en zoekt daarna de HELE datamap byte voor byte af. Zo vond die test twee lekken die er echt in zaten. De outbox is met een sleutel niet meer met de hand te lezen; daarvoor is `npm run outbox`.
- **Tokens gehasht op schijf:** in `db.json` staat alleen de sha256-hash van elk sessietoken. Wie de database in handen krijgt, kan daarmee niet inloggen. Sessies verlopen na 30 dagen zonder gebruik.
- **Rate-limiting:** wachtwoorden, backoffice-code en personeels-PIN's zijn beschermd tegen raden (tien pogingen, dan vijf minuten wachten; PIN's: vijf pogingen, een minuut, per persoon).
- **De kantoor-inlog is een gesprek** (`server/kern/kantoorgesprek.js`, `public/shared/kantoorgesprek.js`): Rahul vraagt de kantoorcode en, als `OFFICE_TOTP_SECRET` staat, de tweede factor — geen codeveld meer. Drie dingen maken dat geen zwakkere deur. Wat je intypt wordt **nergens** bewaard (geen gespreksgeheugen, geen log met de code erin; de machine onthoudt alleen wélke vraag openstaat). Het scherm **maskeert** de invoer zodra de server `verborgen` op de vraag zet, want een chatvenster toont normaal wat je typt. En de misslagen lopen in **dezelfde teller en dezelfde bucket** als `/api/office/login` (`office:<ip>`), dus tien pogingen zetten allebei de deuren vijf minuten op slot — anders had je de backoffice makkelijker te raden gemaakt door hem vriendelijker te maken. Een fout antwoord zegt niet wélke helft fout was. **Keuringsregel 18** bewaakt dat de deur maar op één plek staat: dat is met schade geleerd, want `/api/office/login` was op vijf schermen los nagebouwd en toen de tweede factor kwam, kreeg maar één van die vijf een veld ervoor — de andere vier liepen vast op een vraag die ze niet konden stellen.
- **Persoonlijke login bij partners:** in een partner-app logt iedereen in op de eigen naam met een persoonlijke pincode (of het bedrijfsaccount met gebruikersnaam en wachtwoord). Alleen de bedrijfscode geeft geen toegang; zo staat elke handeling op een persoon.
- **Ledenprijsgarantie in code:** een lid betaalt bij een partner nooit meer dan de eigen publieke prijs van die partner. De ledenprijs wordt server-side afgekapt op de publieke prijs, zowel bij het opslaan van de menukaart als bij het plaatsen van een bestelling.
- **Security-headers:** Content-Security-Policy (`default-src 'self'`, `font-src 'self'`: geen extern verkeer, ook niet voor fonts — die staan zelf in `public/fonts/`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (camera, microfoon en locatie alleen voor de eigen apps).
- **Dataminimalisatie als poort, niet als belofte** (`server/kern/gegevenspoort.js`, `server/kern/gegevensgesprek.js`): een gratis RTG-account vraagt vier dingen — naam, geboortedatum, e-mail, wachtwoord. Wie alleen rondkijkt geeft nooit meer. Pas als er een **derde partij** bij komt (een zaak, een koerier, een professional) vraagt Rahul precies wat díé handeling nodig heeft, in een gesprek: een bestelling of reservering vraagt een telefoonnummer, een bezorging daarnaast een adres, en paspoort loopt via de bestaande identiteitscontrole (`/api/verify/upload`) — er komt met opzet geen tweede paspoort-intake naast. Een route die nog iets mist antwoordt geen weigering maar **428** met `ontbreekt`, waarna de app het gesprek opent (`/api/gegevens/{nodig,start,zeg}`) en de handeling gewoon opnieuw doet. Het gesprek is een vaste stappenmachine en niet de vrije AI: wat hier gevraagd wordt gaat de kluis in en bepaalt of een bestelling doorgaat, dus dat moet elke keer hetzelfde gaan. De regel is streng in twee richtingen, en **keuringsregel 16** (`npm run check`) bewaakt beide: elk pad achter de leden-poort dat een derde partij noemt gaat langs de gegevenspoort — een nieuw pad (een koerier, een luchthavendienst) valt om zodra het er zonder staat, en wie een pad bewust uitzondert zet zijn reden erbij in `MAG_ZONDER`. De scan kijkt naar héél `server/routes`, niet alleen naar `routes/member`: vluchten boeken, een clubticket kopen en een verblijf boeken staan elders en gleden er allemaal langs toen de regel smaller was. **Rahul zelf komt er ook niet omheen**: hij doet zijn acties met dezelfde functies als de app-knoppen maar niet via de routes, dus de poort staat óók in `kern/fluister/acties.js` en `kern/fluister/bevestig.js` — zonder telefoonnummer reserveert hij niet. En hij stuurt u er niet voor weg: hij zít in een gesprek, dus hij vraagt het gewoon zelf (`kern/fluister/gegevens.js`), zet de handeling op de plank (`p.wachtGeg`) en doet hem alsnog zodra u antwoordt. Het gesprek dat hij daarvoor voert is letterlijk hetzelfde als in de app (`kern/gegevensgesprek.js`) — wat er gevraagd wordt, hoe het gecontroleerd wordt en waar het landt hoort niet af te hangen van het kanaal waarin u toevallig zit, dus "waarom?" en "laat maar" doen het daar precies zo.

  De andere helft is het scherm. Een 428 die nergens landt is erger dan een gewone fout: het lid leest "dat vraag ik even" en er wordt niets gevraagd. `public/shared/poortgesprek.js` maakt die belofte waar — Rahul stelt de vraag in beeld, "waarom?" krijgt een eerlijk antwoord zonder dat de vraag verdwijnt, stoppen kan altijd, en daarna gaat de oorspronkelijke handeling vanzelf door zonder dat je opnieuw hoeft te zoeken wat je aan het doen was. Het haakt in op de gedeelde `maakAPI` (`shared/appshell.js`), dus de hele leden-app is met één plek gedekt. **Keuringsregel 17** houdt dat vast: een pagina die bij een poortpad kan, laadt de module — en die poortpaden leest de keuring uit de routes zelf, niet uit een lijst die veroudert. `test/poortgesprek.e2e.js` speelt het na in een echte browser.
- **AVG-rechten in de app:** elk lid kan onderin het meldingenpaneel zijn volledige dossier downloaden (inzagerecht, JSON) en zijn gegevens definitief laten wissen (vergetelheid): cv, chats, likes, live-locatie en account inclusief geupload document; sollicitaties bij bedrijven worden geanonimiseerd en alle sessies uitgelogd.
- **Wachtwoorden en PIN's** worden gehasht met scrypt; identiteitsdocumenten staan buiten de webroot en zijn alleen voor de backoffice toegankelijk.
- **Juridisch:** [privacybeleid](public/apps/juridisch/privacy.html), [algemene voorwaarden](public/apps/juridisch/voorwaarden.html) en [partnervoorwaarden](public/apps/juridisch/partnervoorwaarden.html) staan gebundeld in de juridische ROS-app (`/apps/juridisch.html`) en kloppen met wat de techniek doet.

### De veiligheidsrondes: van beloftes naar bewijs

Een tweede reeks rondes ging niet over nieuwe functies maar over de vraag of de
bovenstaande beloftes ook waar zijn. Dat leverde een paar echte gaten op; die
staan hieronder mét de fout erbij, want een lijst die alleen successen noemt is
geen documentatie maar reclame.

- **Sleutels moeten uit de omgeving komen.** `server/config.js` weigert een
  productiestart zonder `RTG_VAULT_KEY` en `RTG_SECRET_KEY` (elk ≥32 tekens).
  Eerder was dat een waarschuwing die je kon negeren — en een waarschuwing die
  je kunt negeren is geen maatregel.
- **Inzagejournaal** (`server/inzagelog.js`): elke blik in de identiteitskluis
  wordt vastgelegd — wie, wanneer, welk account, en waarom. Het journaal bewaart
  bewust *niet* de opgezochte naam; anders was het een tweede, onversleutelde
  kopie van de kluis. Een betrokkene ziet via `/api/privacy/inzage` wél dát er
  in zijn dossier is gekeken en waarom, nooit wie er keek.
- **Bewaartermijnen** (`server/bewaartermijnen.js`): tien categorieën met een
  termijn, een grond en een uitleg. De wet wint van minimalisatie — facturen en
  loonadministratie blijven zeven jaar staan (art. 52 AWR) en de veger raakt ze
  niet aan. Wissen gebeurt nooit vanzelf: `veeg()` maakt standaard alleen een
  rapport, en pas `bevestig: 'WIS'` op het techniekbord verwijdert echt.
  `zonderBeleid()` noemt de takken die nog géén termijn hebben, zodat het gat
  zichtbaar blijft in plaats van vergeten.
- **De bewaarwacht** (`server/bewaarwacht.js`): telt dagelijks wat over zijn
  termijn staat en meldt dat maandelijks op het technische bord, met de grootste
  posten bij naam. Hij wist nooit — dat blijft mensenwerk met een bevestiging.
  Het moment van de laatste melding staat in de database en niet in het
  geheugen, anders reset elke herstart de teller en hoor je hem alsnog elke dag.
- **Geteste herstelproef** (`test/herstelproef.test.js`): zet een backup echt
  terug en logt daarna in. Precies die test vond het ernstigste probleem van de
  hele reeks: **de backups waren leeg.** In WAL-modus stond alle verse data nog
  in de `-wal`-bestanden terwijl de kopie alleen de (lege) `.db` meenam. Nu
  checkpoint de backup eerst en kopieert hij de `-wal`-bestanden mee. Een backup
  die je nooit hebt teruggezet is een aanname, geen backup.
- **De pas-poort** (merkregel): zelf-registreren levert **altijd** hooguit een
  RTG Pass. Lifestyle en Business ontstaan uitsluitend door een menselijk besluit
  (`kern/aanmeldingen.js` → `beslis`, dat `accounts.setTier` aanroept). Eerder
  gaf het `tier`-veld bij registratie direct een Business Pass; dat gat vond de
  aanvalsronde hieronder, niet de eigen testsuite.
- **Aanvalsronde** (`node scripts/aanval.js`): een batterij aanvallen tegen een
  draaiende server (IDOR, kapotte tokens, rechten-escalatie, WAF-sondes,
  injectie), exitcode 1 zodra er iets raak is. Wat dit **niet** is: een
  onafhankelijke pentest. Het script is geschreven door dezelfde partij die de
  server schreef, en dat is een echte beperking — je zoekt niet naar de aanname
  waarvan je niet weet dat je hem hebt. Voor de lancering hoort hier een vreemd
  paar ogen overheen.
- **De poortwacht: elke route anoniem aangeklopt.** `npm run poortwacht` leest de
  routekaart uit de server zelf en klopt bij alle 2496 API-routes aan zonder
  inlog. Niet "doet dit endpoint het goed" (dat zijn 2496 tests), maar de vraag
  die er veiligheidsmatig het meest toe doet en die je voor allemaal tegelijk
  kunt stellen: *komt er iemand binnen die niet is ingelogd?* Uitslag van de
  eerste ronde: 2220 netjes geweigerd, 244 stil afgeslagen, 25 open — waarvan er
  twee niet klopten (zie `test/poortwacht.test.js`). Dit dekt **één** klasse
  fouten volledig; een route die 401 geeft kan tussen twee ingelogde leden nog
  steeds lekken, en daarvoor is `scripts/aanval.js`.
- **De randcontrole: alles wat buiten de code ligt.** `npm run rand -- https://uwadres`
  meet aan een draaiende installatie wat de testsuite per definitie niet ziet:
  certificaat en TLS-versie, HSTS, de CSP zoals hij echt wordt uitgeserveerd
  (met onderscheid tussen `script-src`, `style-src` en `style-src-attr`: de
  eerste twee draaien op een nonce zonder `unsafe-inline`, de derde houdt hem
  nog — de resterende `style="…"`-attributen in `public/` staan aan een ratel
  in `NORM.json` (`inlineStijlAttributen`) en kunnen alleen omlaag), of `http` doorstuurt, of `.env`/`.git`/`server/data` op straat liggen, en
  of een verzonnen `X-Forwarded-For` de snelheidslimiet omzeilt. Die laatste
  vond een echt gat: `trust proxy` stond vast op 1 en `verrijk.js` las het
  **linkse** adres uit de kop — het deel dat de bezoeker zelf verzint. Daarmee
  was elke rem, inclusief de brute-force-grens op de inlog, met één kop te
  omzeilen. Nu wordt er van rechts gelezen — en, de tweede helft: de kop wordt
  **alleen geloofd van een vertrouwde proxy-positie**. `trust proxy` zei hoevéél
  hops, niet wie; zonder dat tweede stuk kon een bezoeker die rechtstreeks
  binnenkomt nog steeds zijn eigen adres verzinnen, want dan is hij zelf de
  rechtse. Het adres van de verbinding is de enige waarneming die niemand kan
  vervalsen, dus die beslist: loopback en private adressen (waar een reverse
  proxy staat) worden geloofd, een publieke bezoeker niet. Staat uw proxy op een
  publiek adres, dan `RTG_PROXY_IPS`. Zie `test/proxykop.test.js` (9 tests).
- **Het papierwerk is een poort, geen herinnering.** `npm run golive` **vult**
  `VERWERKINGSREGISTER.md` (AVG art. 30) en `DATALEK.md` (72-uursklok, art. 33)
  in met de antwoorden uit `server/papieren/` en **blokkeert** zolang daar
  plekken openstaan. Wat een jurist moet nakijken geeft een waarschuwing. De
  keuring kan niet beoordelen of de inhoud juridisch klopt — alleen dat hij
  bestaat en niet half af is.
- **Rahul vraagt het papierwerk uit; hij vult het nooit zelf in.** In beide
  documenten stond eerst een rij `[VUL IN]`-plekken. Een invullijst vult
  niemand in, dus stond het er nog steeds. Nu stelt Rahul de 19 vragen uit
  `server/papieren/vragen.js` op de technische pagina — één per keer, met erbij
  waaróm hij het vraagt (KvK-nummer, wie er 's nachts beslist bij een lek, of
  er een verwerkersovereenkomst ligt). Er zit **geen generatiepad** in die
  module: er komt niets in het register zonder dat een mens het intypte. Een
  verzonnen KvK-nummer is erger dan een leeg veld — een leeg veld ziet
  iedereen, een verzonnen nummer gelooft iedereen. Weet iemand iets niet, dan
  parkeert Rahul het eerlijk als "nog niet bekend"; dat telt gewoon als open en
  de keuring gaat er niet overheen. De antwoorden staan in
  `server/data/papieren.json` (0600, buiten git en buiten de database) — juist
  omdat de database tijdens een datalek het ding is dat je misschien niet
  vertrouwt, moet het draaiboek daar los van leesbaar zijn.

## RTG Mail

Het interne postsysteem is geen inboxscherm maar een communicatielaag met e-mail als protocol. Twee helften, streng gescheiden.

**De mailervaring.** Elk lid en elke zaak heeft een postvak op zijn codenaam, met een domein dat het lidmaatschap volgt (`kern/rtmail-adres.js`). Daarboven: mappen (in, archief, prullenbak, verzonden), etiketten, favorieten, sluimeren en zoeken (`kern/rtmail-vak.js`); gesprekken die op de **draad** groeperen en nooit op onderwerp (`kern/rtmail-draad.js`); concepten in een eigen lade, uitgesteld verzenden zonder wekker, handtekening, afwezigheid met lus-rem en aliassen (`kern/rtmail-schrijf.js`); en regels die bij de **bezorging** draaien en niet in de app, zodat ze ook werken voor post die 's nachts binnenkomt (`kern/rtmail-regels.js`).

De toestand van een bericht hangt **per bus** en niet op het bericht. Dat is geen implementatiedetail: een bericht tussen twee postvakken van dit huis is een rij in de opslag, en zonder die scheiding zou het archiveren door de ontvanger het bericht ook uit de verzonden map van de afzender laten verdwijnen.

**Gedeelde postvakken.** Een team is een adres dat meerderen samen lezen, met toewijzing en afhandeling (`kern/rtmail-team.js`, `-teampost.js`) en daarbovenop een dossier per bericht: status, prioriteit, interne notities en de koppeling aan een klant of ticket (`kern/rtmail-dossier.js`). De klok (`kern/rtmail-sla.js`) loopt tot het eerste **menselijke** antwoord; de automatische ontvangstbevestiging stopt hem niet. Wie al geantwoord heeft wordt afgeleid uit de draad in plaats van apart bijgehouden -- een tweede administratie zou vroeg of laat iets anders beweren dan de post zelf.

**Post wordt werk.** `server/bedrijf/postbrug.js` maakt van een bericht een taak, ticket of kans in het Werk OS, met de herkomst (bericht-id en draad) erbij; `/api/bedrijf/post/context` zet de klant, open kansen, tickets en contracten naast een bericht en zegt eerlijk "er wordt niets geraden" als de afzender bij niemand als contactpersoon staat. De omzetting vraagt twee sleutels (RTG-sessie plus werkruimte-lidtoken) die van dezelfde persoon moeten zijn: post is van iemand.

**Rechten, journaal en bewaarbeleid.** Dertien losse rechten (`kern/rtmail-recht.js`) in plaats van "mag erin": een supportmedewerker antwoordt vanuit support@ zonder te kunnen exporteren. Niemand geeft weg wat hij zelf niet heeft, vier handelingen vragen een reden **vooraf**, en elke handeling op andermans postvak landt in het journaal -- ook een geweigerde poging. `kern/rtmail-bewaar.js` is de enige plek waar post echt weggaat: bewaartermijn, juridische bewaring die altijd wint van die termijn, en aantoonbare vernietiging die het feit achterlaat en niet de inhoud.

**De infrastructuur.** `kern/mailwachtrij.js` legt uitgaande post in een lade met oplopende wachttijden (1, 5, 15, 60, 240 minuten), herhaalt een permanente fout nooit, houdt een dead-letter lade bij en herkent dubbele aflevering. `kern/mailmime.js` pakt echte RFC 5322-post uit (doorgevouwen koppen, encoded-words, MIME, base64, quoted-printable, platte tekst boven HTML) en `kern/mailinkomend.js` bewaart het **origineel ongewijzigd** en stempelt de uitslag van de controles. Die drie worden nu ook echt gedaan: DKIM via `server/dkim.js`, SPF via `kern/mailspf.js` (mechanismen, include/redirect, en de tien-vragen-grens uit RFC 7208 die ook een kring van records afkapt) en DMARC via `kern/mailauth.js`, dat de **uitlijning** bepaalt -- hoort wat er geslaagd is bij het domein dat de lézer ziet? Twee regels gelden overal: geen antwoord is geen goedkeuring (geen record heet `geen`, een DNS-storing `tijdelijke fout`, nooit `gezakt`), en wij handhaven niet maar stempelen -- het beleid wordt gemeld, weigeren is een beslissing van een mens. Alles van buiten blijft onbetrouwd: links blijven onklikbaar. Bijlagen gaan door **De Ontsmetter** (`kern/antivirus`, dezelfde scanner die de bestandenkluis bewaakt -- er is er geen tweede gebouwd): wat schoon is wordt versleuteld bewaard en is te openen door wie het bericht mag lezen, wat dat niet is verdwijnt met de reden in de tekst van het bericht. Geen quarantaine-map waar iemand later "toch even" bij kan.

**AI-hulp bij een gesprek** (`kern/rtmail-ai.js`): samenvatten, actiepunten herkennen en uitleggen waarom iets op phishing lijkt. Eén regel vormt dat hele bestand: **elke bewering draagt de herkomst mee** -- elk punt, elk actiepunt en elke risicomelding noemt het bericht-id waar het vandaan komt, en op het scherm springt u er met een klik naartoe. Een samenvatting zonder verwijzing is een tweede versie van de waarheid. Risico komt als *redenen*, niet als cijfer: "risico 7,4" zegt een lezer niets, "dit bericht vraagt om een wachtwoord" wel. De laag leest en vat samen; antwoorden, betalen en opbergen blijven handelingen van een mens langs de gewone poorten, en er is geen taalmodel voor nodig -- een hulp die alleen bestaat als er een sleutel in de omgeving staat, is geen hulp.

**Een externe mailclient** kan erbij via IMAP (`server/imap.js` voor het gesprek, `server/imap-server.js` voor de verbinding). Dat is een **adapter en geen tweede mailbox**: de waarheid blijft in RTMAIL, en wie in Thunderbird een ster zet, zet hem in zijn postvak. INBOX/Archive/Trash/Sent vertalen naar de mappen, `\Seen` en `\Flagged` naar gelezen en favoriet; etiketten en sluimeren bestaan in IMAP niet en dat staat opgeschreven in plaats van weggemoffeld. Inloggen gaat **nooit** met het RTG-wachtwoord maar met een **apparaatsleutel** (`kern/mailsleutel.js`): één postvak, één keer te zien, los in te trekken en meteen dood. De poort staat uit tenzij `IMAP_POORT` is gezet -- een mailpoort die vanzelf openstaat, is een deur die niemand heeft besloten open te zetten. `APPEND` en `IDLE` zitten er nog niet in, en `APPEND` weigert duidelijk in plaats van stil te mislukken: een client die denkt dat zijn concept is opgeslagen, verliest werk.

Wat er bewust **niet** in zit: een regel die post doorstuurt naar een ander adres (de kortste weg naar post die ongemerkt het huis verlaat, en naar lussen), een teller wie het meest afhandelt, en een prullenbak die echt wist.

## Partner worden & e-mail

Bedrijven worden aangemaakt vanuit de backoffice (de losse publieke wervingspagina is met de marketingsite verwijderd; het aanvraag-endpoint blijft bestaan). Bij goedkeuring maakt de server het bedrijf aan (leverancierscode + manager-PIN) en mailt die naar de aanvrager, waarna de hele partner-app direct werkt.

E-mail (verificatie, wachtwoord-herstel, sollicitatie- en partner-besluiten) is af, en de verzendlaag is helemaal van onszelf -- er zit geen pakket meer onder. `server/mail.js` kent drie standen, in deze volgorde:

1. **`SMTP_URL`** (+ optioneel `MAIL_FROM`): afleveren bij een ingehuurde smarthost via de eigen SMTP-client `server/smtp.js` (EHLO, STARTTLS, AUTH, MAIL/RCPT/DATA, MIME met base64 en dot-stuffing; credentials gaan nooit over een onversleutelde verbinding).
2. **`MAIL_DIRECT=1`**: **eigen post** -- `server/smtp-direct.js` zoekt zelf het MX-record van de ontvanger op, verbindt op poort 25, pakt STARTTLS als die er is en levert af; `server/dkim.js` ondertekent het bericht (relaxed/relaxed, RSA-SHA256 uit `node:crypto`) met `DKIM_PRIVATE_KEY`, `DKIM_SELECTOR` en `MAIL_DOMEIN`. Een mislukte bezorging valt terug op de outbox, waarbij **tijdelijk (4xx)** en **permanent (5xx)** apart gemeld worden -- bij het eerste heeft opnieuw proberen zin, bij het tweede niet.
3. **niets gezet**: berichten gaan naar `server/data/outbox/` en alle links werken gewoon.

Aanzetten gaat met **`npm run eigenpost -- <domein> <ip>`**: dat meet eerst of uitgaand poort 25 op deze machine open is (en zegt "nee" als hij dicht is, in plaats van u een sleutelpaar te geven waar u niets aan hebt), maakt daarna een DKIM-sleutelpaar en drukt de drie DNS-records en de omgevingsvariabelen af. De private sleutel wordt getoond en nergens weggeschreven -- een sleutel die een script netjes in een bestand zet, staat morgen in git.

Wat stand 2 *niet* kan oplossen staat hardop in de kop van `server/smtp-direct.js`, omdat een verzendlaag die dat verzwijgt post wegstuurt die nergens aankomt: uitgaand poort 25 is bij de meeste hosters dicht (`beschikbaar()` **probeert** het in plaats van het te beweren), PTR hoort bij de hosting, en SPF en DMARC zijn DNS-records -- `dkim.dnsRegels()` schrijft die drie voor u uit, publiceren is mensenwerk. `test/mail-eigen.test.js` rekent elke handtekening ook echt na met de publieke sleutel en kijkt of hij breekt zodra het lijf of een ondertekende kop wijzigt.

Zie **LAUNCH.md** voor de volledige livegang-checklist (hosting, domein, betalingen, sleutels).

## Live updates & push-notificaties

Website-portaal en app delen dezelfde backend en werken **live bij zonder herladen**, via Server-Sent Events (`GET /api/stream`). Betaal je in de app, dan daalt het openstaande bedrag in een geopend website-portaal meteen; reageert iemand op je post, dan verschijnt de reactie live in beide.

Elk lid heeft een **notificatiebel**: reacties, likes en privéberichten op je eigen posts komen binnen als in-app melding, als systeemmelding wanneer het scherm openstaat, en als **web-push** wanneer het scherm dicht is. Push draait op VAPID via onze eigen, dependency-loze implementatie (`server/webpush.js`: RFC 8292 + RFC 8291 op Node's `crypto`), met de service worker als ontvanger; de publieke sleutel komt van `GET /api/push/key`, subscriptions gaan naar `POST /api/push/subscribe`.

## De app (PWA)

**apps/app.html** is de RTG-app als installeerbare web-app (PWA, met `manifest.webmanifest` + `sw.js`), draaiend op dezelfde backend als de site. Open op een telefoon en kies "Zet op beginscherm" om te installeren.

### Het beginscherm: vier lagen, één scherm

De app is een besturingssysteem (het "ROS"). Het beginscherm heeft vier lagen, van boven naar beneden, en verder niets:

1. **De mappen met apps** — vier mappen (Reizen, Geld, De Salon, Het Huis). Alles waar je pas je recht op geeft zit er al in; je hoeft niets te installeren. Een tik opent de map, een tik op een app opent hem schermvullend.
2. **De ronde RTG-klok**, in het midden — hetzelfde horloge als op het inlogscherm (`shared/klok.js`, `data-rtg-klok="ring"`).
3. **De functierij**: Bellen, Berichten, Videobellen en je **Wallet**. Deze vier staan vast en kunnen niet uit.
4. **De balk van Rahul**. Typ wat je wilt: is het iets dat het OS zelf kan ("open Reizen", "donker", "zoek villa", "hernoem Geld naar Bank"), dan gebeurt het meteen en blijf je thuis; al het andere gaat naar Rahul, wiens app opent met je vraag erin.

Het beginscherm scrolt niet en heeft geen tweede blad: de maat-eenheid `--e` groeit met het venster mee, zodat hetzelfde beeld op telefoon, tablet en computer past.

Openen en sluiten is één beweging: **inlogscherm → app openen → sluiten → beginscherm.** Sluiten kan met de terugknop linksboven, met een tik op de home-indicator onderin, of door omhoog te vegen op die indicator.

Wat je niet wilt zien, zet je uit in de **Boardroom** (bedieningspaneel → Boardroom). Die werkt andersom dan een App Store: alles staat aan, jij zet uit. De keuze staat per pas in `localStorage` (`rtg_os_uit_<pas>`).

De statusbalk houdt drie dingen vast: batterij, de bel en het bedieningspaneel. Scannen, je Zegel tonen en je backoffice zitten in dat paneel.

### De wallet en de ledenpas

**apps/wallet.html** is alles wat je bij je draagt. Bovenaan ligt je **ledenpas**: codenaam, lidnummer, welke pas en een QR met je lidnummer (onze eigen codec, `shared/qr.js` + `shared/qrteken.js`). Daaronder je passen, tickets, sleutels, feestmunten en klantenkaarten (`/api/wallet`, `server/kern/wallet.js`). De pas stond vroeger op het beginscherm van de app; daar staat nu de klok.

**Codenaam (privacy by design):** elke klant krijgt een codenaam (bijv. *Zilveren Valk*). Reserveringen, betalingen en reisdata staan in de systemen op de codenaam; de echte naam ligt in een gescheiden kluis en wordt pas bij ticketing/check-in gekoppeld. Wordt reisdata ooit gestolen, dan heeft de aanvaller nooit de juiste naam.

### De boardroom van het lid

**apps/boardroom.html** (`server/kern/lidboard/`) is het schakelbord van het lid zelf: 22 functies in vier groepen (app-onderdelen, privacy & sociaal, AI & meldingen, verbindingen). Er is er **één**, en die staat op de server — de stand reist mee naar elk toestel en de app spiegelt hem, hij bewaart geen tweede lijstje. Bereikbaar via het bedieningspaneel in de app.

Wat het bord bestuurt, bestuurt het ook echt:

- **Handhaving.** Een uitgezette functie zet ook zijn API dicht (`lidPadFunctie` + `lidBoardUit`, gecontroleerd in `server.js` vóór de routes). Zet je "Spelen" uit, dan geeft `/api/member/spel` 403 — en verdwijnt de tegel van je beginscherm. Een tegel die je kunt openen en die daarna weigert, is erger dan geen tegel.
- **Privacy by design.** Alles wat gegevens *deelt* (locatie, GPS, paspoort delen, Bluetooth) staat standaard **uit**; de rest staat aan. "Terug naar standaard" herstelt precies dat, en is dus iets anders dan "alles aan".
- **Beheerd door RTG.** Zet de platform-schakelkast (`server/functies`) een functie globaal of voor jouw pas uit, dan toont het bord hem als *beheerd* met de reden erbij, en weigert het schakelen. Een schakelaar die niets doet is een leugen.
- **Vast.** Sommige functies kunnen niet uit (je wallet met de ledenpas): zet je die uit, dan kun je hem daarna niet meer aanzetten omdat het scherm met de knop weg is. Dat is geen keuze maar een val. Het bord markeert ze `vast`, en bulk-acties slaan ze stil over.
- **Versie.** Elk bord telt zijn wijzigingen. Wie schakelt mag zijn versie meesturen; klopt die niet meer, dan volgt een 409 mét het verse bord in plaats van dat de wijziging van je andere toestel stilzwijgend wordt overschreven.
- **In één keer.** `zetveel` en `herstel` zijn alles-of-niets: eerst valideren, dan schrijven, één versie-stap, één regel in het journaal. Een bord blijft nooit half om.
- **Een spoor.** Elke omzetting komt in het journaal (`db.data.ledenBoardLog`, max 200 per bord): wat er omging, van welke stand naar welke, door wie (`lid` of `ouder`) en vanwaar. Zichtbaar onderaan de app, meegenomen in de AVG-export, en gewist bij "verwijder mijn gegevens". Zonder spoor is "wie heeft dat uitgezet?" onbeantwoordbaar — en bij een kind is het antwoord vaak "een ouder".
- **Een rem.** Dertig schakelingen per minuut per account; daarboven 429. Elke omzetting schrijft de database weg, dus een lus zonder rem is een schrijfstorm.

**Ouderlijk beheer:** een ouder/beheerder stuurt via dezelfde motor de boardroom van zijn beschermde kind bij (RTF-handle als sleutel, `/api/rtf/social/kind/boardroom*`). De voogd-check houdt een vreemde ouder buiten, functies die niet bij een kind horen (paspoort, Pay, Care) staan niet op het kinder-bord, en wat de ouder omzet staat als `door: 'ouder'` in het journaal van het kind.

**Werkgeversbeleid (Business Pass).** Een bedrijf dat passen voor zijn mensen neemt, moet kunnen zeggen welke functies op die passen dicht staan — compliance, geheimhouding, of gewoon een keuze. Dat kan via `/api/supplier/werkbeleid{,/zet}`, achter de zaak-inlog. Eén regel maakt dit veilig en is niet configureerbaar:

> **Een werkgever kan alleen dichtzetten, nooit openzetten.**

Er is dus geen "verplicht aan" — de API kent die vorm niet. Een werkgever kan een medewerker niet dwingen zijn locatie te delen, zijn GPS aan te zetten of zijn paspoort beschikbaar te stellen: de enige richting waarin hij die knoppen kan bewegen is dicht, en dat is voor de medewerker altijd de veilige kant. Wat de werkgever níet dichtzet, blijft van de medewerker zelf; het beleid is een bovengrens, geen dictaat over de rest. De basis van het toestel (je wallet met je ledenpas, `vast:true`) blijft buiten zijn bereik.

Het bedienen gebeurt in de **eigen boardroom van de zaak** (`/apps/leverancier.html` → Boardroom), onder *Werkbeleid op de passen van uw mensen*: een chip per functie, groen = de medewerker beslist zelf, rood = wij hebben hem dicht gezet, met de regel er in gewone taal boven. Een chip omzetten stuurt de vólledige dicht-lijst terug, niet een los aan/uit — dan kan een half mislukt verzoek nooit een beleid achterlaten dat niemand zo bedoeld heeft.

De koppeling lid ↔ werkgever zijn de rollen aan het ene RTG-account (`kern/eenaccount`): een `personeel`- of `zaak`-rol wijst een zaak-code aan. Werk je voor twee bedrijven, dan gelden beide beleiden opgeteld — de strengste wint. Wat dicht staat, staat op je eigen bord met de **naam van het bedrijf** erbij (`beheerdDoor: 'werkgever'`), en gaat ook echt dicht op de API: anders was het beleid een grijze knop en verder niets.

**Taal.** De labels van dit bord komen van de server (ze staan in de catalogus, niet in de pagina), dus `bord()` krijgt de taal mee en `kern/lidboard/talen.js` levert de vertaling; een onbekende taal valt terug op Engels, een ontbrekende sleutel op het Nederlands. De pagina zelf gebruikt de gewone i18n-laag (`window.I18N` + `shared/i18n.js`) en haalt bij een taalwissel (`rtglang`) het bord opnieuw op.

API: `/api/member/boardroom{,/zet,/zetveel,/herstel,/logboek}` en `/api/supplier/werkbeleid{,/zet}`. Getoetst in `test/lidboard.test.js` (21 toetsen: standaarden, handhaving, voogdij, versie-botsing, bulk, herstel, journaal, export, rem, beheerd-door-RTG, vergetelheid, taal en het werkgeversbeleid).

## Veiligheid & verbinding: vier apps op één ruggengraat

Vier losse apps (elk met eigen PWA-manifest), die onderhuids dezelfde kern delen
(`server/kern/veiligheid/`, routes onder `/api/veiligheid/*`):

| App | Wat het doet |
|---|---|
| **Thuiswacht** (`/apps/thuiswacht.html`) | "Ik ben over X minuten thuis." Meld je je niet, dan krijgt je kring bericht met je laatst bekende plek |
| **Codewoord** (`/apps/codewoord.html`) | Een gewone zin tegen Rahul waarschuwt je kring stil; op je scherm gebeurt er zichtbaar niets |
| **Vitaal** (`/apps/vitaal.html`) | Dagelijkse check-in voor medicijnen of voor wie alleen woont |
| **Thuisrust** (`/apps/thuisrust.html`) | Niet storen tot je thuis bent, met een veiligheidsbaan die je kring altijd doorlaat |

Drie ontwerpkeuzes die de rest verklaren:

1. **De dodemansknop tikt op de server, niet in de app.** Daarom werkt hij ook
   als de telefoon uitvalt: het toestel moet zich MELDEN om het alarm tegen te
   houden, dus stilte is zelf het signaal. De laatst bekende positie staat al op
   de server en gaat mee in het alarm. Bewezen in `test/veiligheid.test.js`
   (toets 4): daar doet het toestel na de start niets meer, en het contact krijgt
   toch het alarm met de plek.
2. **De kring bestaat uit codenamen**, en alleen uit mensen met wie je al een
   actieve connectie hebt. Echte namen blijven in de kluis. Per contact stel je in
   of hij je plek mag zien.
3. **Het codewoord staat nooit als tekst opgeslagen** (HMAC met de serversleutel
   plus een eigen zout), het scherm toont hem na het instellen nooit meer, en de
   controle-route geeft altijd exact hetzelfde antwoord: raak of mis is van
   buitenaf niet te zien.

En hardop op elk scherm: **dit is geen alarmcentrale.** Er wordt niemand gebeld,
er kijkt geen mens mee, en zonder internet of met een server die plat ligt gaat er
niets af. Die zin staat er met opzet; wie denkt beschermd te zijn en het niet is,
is slechter af dan wie het weet.

## Rahul als mens: geen AI-taal, een echte bui, iedereen welkom

Vijf lagen die samen bepalen hoe Rahul klinkt.

**Geen AI-taal** (`server/kern/rahul/taal.js`). Regels in de prompt, PLUS een
schrobber over elk antwoord dat de deur uitgaat, inclusief de vaste
demo-antwoorden zonder API-sleutel (die komen niet langs een model, dus een
prompt helpt daar niet). Weg: "Natuurlijk!", "Als AI-assistent kan ik...",
"Ik hoop dat dit helpt", "Laat het me weten als je nog vragen hebt". De
schrobber is bewust voorzichtig: liever een cliche gemist dan een zin
verminkt die iets betekende.

**Een stemming** (`server/kern/rahul/stemming.js`). Rahul is soms chagrijnig,
soms een hele poos uitgelaten, soms moe, soms stuitert hij (ADHD wagenwijd
open). Een stand houdt uren tot een dag aan, en geldt voor iedereen tegelijk:
hij is een persoon, geen apparaat dat per gesprek een masker kiest.

De grens telt zwaarder dan het mechaniek: **stemming raakt alleen de toon.**
Een chagrijnige Rahul helpt even goed en even snel, is nooit kortaf tegen de
persoon voor hem, en zegt nooit iets over de vraag die net gesteld is. Bij een
kind, op de werkvloer en zodra het ergens over gaat (verdriet, geld,
veiligheid, gezondheid) valt de bui volledig weg.

**Iedereen welkom** (`server/kern/rahul-omgang.js`). Dit liep op GESLACHT: een
man kreeg de beste-vriend-toon, een vrouw de crush-toon. Dat is omgedraaid.
Wie iemand is zegt niets over hoe die persoon benaderd wil worden, en een
systeem dat op geslacht gokt zit er per definitie bij een deel van de mensen
naast. Nu kiest het lid zelf in `/apps/ik.html`: **maatje** (standaard),
**plagerig** (de ondeugende, licht rebelse Rahul; alleen als je daar zelf voor
kiest en alleen vanaf 18), **zakelijk** of **rustig**. Voornaamwoorden en
aanspreekvorm zijn vrije velden, want geen enkele keuzelijst dekt iedereen.
De welkomstregel staat in elke stand, ook in het kind-hart.

**Vijf levensfases** (`server/kern/rahul-fases.js`). Dezelfde persoon, een
andere rol. Bij een **kind** is Rahul een grote broer: lief, geduldig,
beschermend, en bereid om over koetjes en kalfjes te praten. Bij een
**scholier** is hij los en beschermend tegelijk -- je moet experimenteren om te
ontdekken wat je wilt, naar jezelf luisteren is altijd het juiste antwoord
(meestal met je hart, soms met je hoofd), en omdat deze leeftijd wankel kan
zijn duwt hij op een chille manier de goede kant op en helpt hij met school,
bijbaan, sport en geld. Bij een **student** gaat het over de studie, rondkomen,
balans, volwassen worden en dingen meemaken -- en over er in een volle week een
moment alleen tussen zetten. Bij een **volwassene** over werk, boodschappen,
verjaardagen, kinderen, sparen, koken en af en toe quality time. Bij een
**opa of oma** is hij vooral behulpzaam, lief en een luisterend oor, met alle
tijd en gewone woorden.

De leeftijd uit het paspoort geeft de standaard, het lid stelt hem zelf bij in
`/apps/ik.html` (een student van 34 bestaat). **De grens: een minderjarige kan
alleen kind of scholier kiezen** -- anders zou iemand van veertien zichzelf tot
volwassene kunnen verklaren en daarmee verschuiven wat Rahul bespreekbaar
vindt. De plagerige stand staat bij een minderjarige niet in de lijst en wordt
ook niet opgeslagen, zodat hij niet vanzelf aangaat op de dag dat iemand
achttien wordt.

**Bij twijfel doet hij niets** (`server/kern/rahul/twijfel.js`). Twijfelt Rahul
over wat er gevraagd wordt, over een tijd, een bedrag, een plek of over voor
wie iets is, dan voert hij niets uit maar stelt hij een vraag, en nog een, tot
hij het honderd procent begrijpt. Haast is geen uitzondering; dan vraagt hij
korter, maar hij vraagt.

Dat staat er twee keer, want een regel in een prompt is een verzoek: juist bij
twijfel "helpt" een model liever dan dat het iets vraagt. Naast de regels in de
system prompt heeft de tool `doe` in de AI-lus (`server/kern/stuur/lus.js`) twee
**verplichte** velden -- `zeker: true` en `begrepen`, een zin over wat er
precies gaat gebeuren en voor wie. Zonder allebei wordt de actie niet
uitgevoerd en krijgt het model terug dat het eerst moet vragen. Kun je niet
opschrijven wat je gaat doen, dan weet je het niet zeker genoeg.

### Geloof: zelf uitgerekend, nooit geraden

`server/kern/geloof/` rekent gebedstijden, de richting van Mekka en de
feestdagen van alle tradities zelf uit. Niet uit principe-drift maar omdat een
verzoek om gebedstijden drie dingen tegelijk verraadt: waar je bent, hoe laat
het daar is, en wat je gelooft. Dat geef je niet aan een derde.

- **Gebedstijden** uit de zonnestand, met keuze uit zes methodes (MWL, ISNA,
  Egypte, Umm al-Qura, Karachi, Teheran) en asr standaard of hanafi. De
  methode staat er altijd bij, want er is geen enkele juiste.
- **Qibla** als grootcirkelkoers. Gecontroleerd tegen de referentiewaarde voor
  Londen (119,0 graden).
- **Feestdagen**: joodse kalender en Pasen exact berekend, islamitische data
  uit de tabelkalender **met het voorbehoud dat de plaatselijke maansikkel
  beslist**, en lunisolaire feesten (Diwali, Holi, Vesak, Guru Nanak) uit een
  tabel. Buiten die jaren zegt hij dat hij het niet weet in plaats van te
  gokken. Joodse en islamitische dagen beginnen bij zonsondergang de avond
  ervoor; dat staat erbij, zodat een felicitatie niet een avond te laat komt.
- Op hoge breedtegraden bestaan fajr en isha in de zomer astronomisch niet.
  Dan komt er geen verzonnen tijd maar een uitleg met de gebruikelijke
  benadering.

**Rahul raadt nooit iemands geloof** uit een naam, een land of een taal. Er
staat een keuze in het profiel of er staat er geen. Wie niets invult merkt er
niets van, en dat is geen tweederangs ervaring.

## Partnerkanaal

Het partnerkanaal voor niet-leden draait server-side: boekingen worden per stuk opgeslagen in `server/data/db.json` onder `bookings`, met één totaalprijs voor de klant; nettoprijs en service zijn interne administratie. RTG verdient niets aan een boeking (`rtgCut` is altijd 0): een eventuele service gaat volledig naar de partner. RTG's enige inkomsten zijn de abonnementen. (De losse publieke boekingspagina is met de marketingsite verwijderd; het model en de endpoints blijven bestaan.)

## Documentatie

- **docs/de-lijn.md** — wat we zelf bouwen, wat bewust niet, en waarom (de filosofie achter de afhankelijkheden).
- **docs/architectuur.md** — gedeelde kern + aparte domeinmodules, gateway en losse processen.
- **docs/hardening.md** — beveiligings- en betrouwbaarheidskeuzes.
- **VERWERKINGSREGISTER.md** — het AVG-verwerkingsregister (art. 30), opgesteld op wat de code werkelijk doet. De plekken die alleen RTG weet vraagt Rahul uit op de technische pagina; zolang die openstaan blokkeert `npm run golive`.
- **DATALEK.md** — het datalek-draaiboek: de 72-uursklok van art. 33, wie wat doet, en wat er vooraf uitgevraagd moet zijn.
- **PRODUCTION.md** / **LAUNCH.md** — runbook en livegang-checklist.
- **scripts/mac/LEESMIJ.md** — RTG als launchd-dienst op een Mac (Mac mini als thuisserver): `sudo scripts/mac/installeer.sh`.
