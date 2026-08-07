# Rahul Travel Group, website & ledenportaal

Conceptwebsite van Rahul Travel Group: homepage, drie passen (RTG / Lifestyle / Business), een ledenportaal met betalingen, reizen & diensten, een persoonlijke AI, een digitale toegangskaart voor de toekomstige RTG-app en **De Salon**, het besloten sociale netwerk van RTG.

## Projectstructuur

```
public/            alles wat de browser laadt (de webroot die de server serveert)
├── sw.js          service worker (staat bewust in de root: scope /)
├── manifest.webmanifest
├── icon.svg
├── shared/        gedeelde client-scripts (i18n.js, realtime.js, ios.js + ios.css)
├── site/          winkel.html (hardware-shop voor partners) + 404.html
└── apps/          alle web-apps, per doelgroep en genre:
    ├── app.html           leden-app (RTG-OS): DE homescreen, tevens het inlogscherm op /
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

Er is geen losse marketingsite meer: `/` toont direct de homescreen van het RTG OS (`/apps/app.html`); wie nog niet is aangemeld ziet daar de welkomstkaart (het gratis RTG-abonnement is de minimale ingang). Er is nog maar **een** beginscherm: het scrollende bureaublad `/apps/index.html` bestaat niet meer, en dat pad (net als `/apps/bureau.html` en `/apps/`) brengt je gewoon thuis. Alle onderlinge links en assets gebruiken absolute paden vanaf de webroot (bijv. `/shared/i18n.js`, `/apps/app.html`), zodat mappen verplaatsen geen links breekt.

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

Open daarna **http://localhost:3000** — dat toont direct de homescreen van het RTG OS; aanmelden gaat via de welkomstkaart (Rahul).

Met de backend actief lopen inloggen, betalingen, likes, reacties, DM's en de AI via de echte API:

- data wordt bewaard in `server/data/db.json` (verwijder dat bestand om terug te gaan naar de startdata);
- de Salon-rechten worden **server-side** afgedwongen: zonder pas alleen liken, RTG-leden reageren/dm'en onderling, Lifestyle- en Business-leden hebben volledige interactie met alle leden;
- creators verdienen reiskorting met hun content (elke 50 likes = 1% korting, tot 10% per kwartaal).

### De echte server op deze Mac (versleutelde data)

Draait de server met versleuteling-at-rest, dan staat de data in
`server/data/store.db` versleuteld en komt de sleutel uit `RTG_ENC_KEY`. **Start
hem dan niet met `npm start`**, want dan mist die sleutel en weigert hij op te
starten -- terecht: hij stopt liever dan onleesbare data te serveren.

```bash
bash bin/rtg-start.sh
```

Dat script haalt de sleutel uit de sleutelhanger van de Mac (Keychain) en geeft
hem aan de server mee. Hij komt nooit in een bestand, nooit in de git-map en
nooit in beeld.

De sleutel opbergen of vervangen (hij vraagt hem, dus je typt hem niet in beeld):

```bash
security add-generic-password -a rtg -s RTG_ENC_KEY -U -w
```

**Waarom dit er zo staat.** De sleutel zat een tijd lang nergens anders dan in
het geheugen van het draaiende proces. Wie dat proces stopte, gooide de sleutel
weg. Dat is een keer echt gebeurd en toen lag de site eruit tot de sleutel
elders werd teruggevonden. Een sleutel die maar op een plek staat, en dan nog
in het geheugen, is geen sleutel maar een kwestie van tijd.

De server start vanzelf bij het aanmelden en komt terug als hij omvalt, via
`~/Library/LaunchAgents/nl.rtg.server.plist`. Nagemeten door hem te doden: na
25 seconden draaide hij weer, met een nieuw procesnummer. Logboek:
`~/Library/Logs/rtg-server.log`.

```bash
launchctl kickstart -k gui/501/nl.rtg.server   # met de hand herstarten
```

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
aangehaakt via `shared/metgezel.js`). **Eén**, en dat is een regel en geen
toevalligheid: de homescreen heeft zijn eigen chatbalk (`#osAiBalk`), en
`metgezel.js` houdt zich daar dus stil. Hij herkent dat scherm aan wat het IS
(`<body data-ios-home>`, `#osAiBalk`) en niet aan zijn pad -- de homescreen
wordt namelijk op vier paden geserveerd (`/`, `/apps/`, `/apps/index.html`,
`/apps/bureau.html`) en een padtoets liet er drie doorheen, met twee balken
onder elkaar tot gevolg. Daarin typ je of praat je, en er gebeurt
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

### De mediapoort: waarom de camera niet opengaat (`shared/media.js`)

Camera en microfoon lopen door **één deur**. Niet als opruiming, maar omdat de
zeventien losse `getUserMedia`-aanroepen die er stonden allemaal iets anders
deden bij een fout — zeven gaven stil `null` terug, drie lieten de fout lopen.
En de belangrijkste oorzaak is er een die je niet ziet: **buiten https (en
localhost) bestaat `navigator.mediaDevices` niet.** Een telefoon die de server
op `http://192.168.x.x` opent heeft dus geen camera-API, terwijl exact dezelfde
code op `http://localhost` werkt. Er gebeurde dan niets, en niemand zei waarom.

`RTGMedia` stelt de diagnose vóórdat hij het de browser vraagt en noemt de
oorzaak hardop, op het moment van gebruik. Vijf oorzaken, vijf verschillende
handelingen: **onveilig** (het adres), **kader** (een iframe dat het recht niet
doorgeeft), **geweigerd** (het slotje in de adresbalk), **geenapparaat**,
**bezet**. Eén melding voor alle vijf — "geen toegang tot de camera" — stuurt de
gebruiker naar een knop die er niet is.

```js
const stroom = await RTGMedia.camera({ achter: true });   // scannen
const mic    = await RTGMedia.microfoon();
if (!RTGMedia.kan()) toon(RTGMedia.teksten[RTGMedia.reden()].uitleg);
```

De belofte breekt met een `Error` die `fout.rtg = { code, kort, uitleg }`
draagt, zodat een scherm de tekst ook zelf kan plaatsen (`{ stil: true }`).
Regel 38 van `npm run keuring` houdt vast dat niemand er langs gaat, dat elk
iframe het recht doorgeeft (`RTGMedia.kader(el)`, één tekst op één plek), en dat
elke pagina die de poort gebruikt hem ook laadt. `test/media.e2e.js` meet het in
een echte browser op een echt LAN-adres.

**Op een telefoon draait het dus op https.** `RTG_TLS=1 npm start` geeft meteen
https met een self-signed certificaat (genoeg om te proberen; je accepteert op
het toestel één keer de waarschuwing). Staat de server plat op het netwerk, dan
zegt hij dat bij het opstarten met het adres erbij
(`server/opzet/veiligadres.js`) — en zwijgt hij zodra het niet meer speelt.

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

### Het OS is iOS: een homescreen, en verder niets

Het OS droeg lang de metaforen van twee apparaten tegelijk. Naast het
springboard lag een tweede beginscherm (`/apps/index.html`: alle apps in
scrollende secties, met een eigen kopbalk, woordmerk en accountchips), en een
app-pagina kon in een **sleepbaar bureaubladvenster** staan (`desktopframe`), in
een **vensterbeheerder met dock en stoplichtknopjes** (`vensters`), in een
**tegel-werkblad** (`werkblad`), of omringd door **widgets** (`bureau`,
`flagship`). Bovenin liep een balk met het woordmerk en een accountchip
(`osbar` + `os.css`), en daarnaast een **uitschuivende hamburger** (`osmenu`).

Dat is allemaal weg. Wat een telefoon heeft, en verder niets:

- **Een homescreen.** Het springboard in `apps/app.html`. Alle andere paden
  (`/`, `/apps/index.html`, `/apps/bureau.html`, `/apps/`) komen daar uit.
- **Een navigatiebalk van 44 punten, alleen als er iets te navigeren of te
  bedienen valt.** Een balk die alleen de naam van de app herhaalt is behang;
  die verdwijnt, en de titel komt terug als grote titel boven de inhoud, die bij
  het scrollen in de balk terugzakt.
- **Geen woordmerk in de chrome.** Het merk staat op het icoon en op het
  toestel; binnen de app hoef je niemand meer te vertellen waar hij is.
- **Een home-indicator.** Omhoog vegen brengt je thuis; de app krimpt onder je
  vinger weg. Een losse tik doet niets -- de pil ligt waar je duim rust.
- **Een randveeg** van links terug in de geschiedenis.
- **Bladen in plaats van vensters** (`RTGiOS.blad(...)`): van onder omhoog, met
  een greep, sluiten met een veeg omlaag.
- **Een hamburger rechtsboven, in elke app** (`shared/appmenu.js`, door
  `ios.js` binnengehaald). Hij opent een blad met twee delen: *deze app* -- de
  functies van het scherm waar je staat -- en *overal*: beginscherm, een stap
  terug, instellingen, Rahul, volledig scherm, delen. Elke rij verschijnt
  alleen als er op dat scherm ook echt iets achter zit.

  De app-functies worden niet per app opgeschreven (dat zijn honderdenveertig+ bestanden die
  binnen een week uit elkaar lopen) maar GELEZEN uit wat de pagina al heeft: de
  delenbalk van `shared/deelmenu.js`, de tab- en filterrij die `ios.js` in de
  tweede rij van de navigatiebalk heeft gezet, en anders de eerste schakelrij
  die op vorm te herkennen is (een vakje met drie tot acht knoppen met korte
  labels -- `.chips`, `.rubrieken`, `.filters`, hoe hij ook heet). Een app die
  zelf beter weet wat erin hoort, zegt dat met `RTGAppMenu.zet([...])` of
  `RTGAppMenu.voegToe({...})`.

  **De homescreen krijgt hem niet.** Daar stonden eerst drie losse knopjes in de
  statusbalk (batterij, bel, bedieningspaneel); die zijn weggehaald, en er een
  vierde teken voor terugzetten is niet veel beter. Het beginscherm is de
  rustplek: mappen, klok, functies, de balk van Rahul, en verder niets. Wat er
  aan systeem achter zit haal je van de bovenrand omlaag (`shared/randen.js`
  opent daar het bedieningspaneel), en dat paneel draagt zoeken, **meldingen**,
  scannen, je Zegel en je backoffice. De knoppen zelf blijven in de HTML staan,
  verborgen: het paneel klikt ze aan, zodat het gedrag op één plek blijft wonen.

Dat alles staat op **een** plek: `public/shared/ios.css` + `public/shared/ios.js`
(bron in `public/shared/ios/`). De laag LEEST de kopbalk die een pagina al heeft
en bouwt hem ter plekke om -- hetzelfde `<header>`-element, dezelfde knoppen,
dus dezelfde id's en dezelfde luisteraars. Dat is geen detail: een kop draagt
meer dan knoppen (`#tel` telt ongelezen berichten, `#filters` wordt pas na het
inloggen gevuld), en wie die met de kop weggooit, breekt de app zonder dat er
ergens iets rood wordt. Alles met een id blijft staan, altijd.

Split View (`shared/split.js`) blijft: twee apps naast elkaar is iPad, geen
bureaublad. In zo'n paneel krijgt de app geen eigen home-indicator.

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

### RTG Mobility OS (de vervoerskern)

`server/kern/mobiliteit/` + `/api/mob/...`, `/api/staff/mob/...`,
`/api/supplier/mob/...`, `/api/office/mob/...` + `/apps/ov.html` (reiziger) en
`/apps/dispatch.html` (planner) en `/apps/zakelijk.html` (werkgever). Geen losse
taxi-app naast RTG OV, maar **een
kern waarop elk vervoerstype een aan- of uitzetbare module is**: taxi, pendel,
OV, rolstoelvervoer, boot, charter en bijzonder vervoer delen dezelfde ritten-,
voertuig-, locatie- en betaallaag.

| Module | Wat erin zit |
| --- | --- |
| `modulecatalogus.js` + `register.js` | 25 vervoersmodules met **afhankelijkheden** en niveaus (wereld, land, stad, organisatie, vervoerder, doelgroep, testers, percentage), plus een storingsknop |
| `voertuigcatalogus.js` + `assets.js` | een `mobility_asset` voor alles wat rijdt, vaart of vliegt (27 categorieen), met documentgeldigheid en geschiktheidstoets |
| `keten.js` + `opdracht.js` + `voortgang.js` | de rittenmotor: een opdrachtvorm voor alle vervoersvormen, met de statusketen `aangevraagd → … → afgerekend`, de uitzonderingen ernaast, en de gebeurtenissen (`ride.accepted`, `driver.arrived`, `trip.completed`) |
| `plekken.js` | vertrek en bestemming uit RTG zelf: onze horeca, hotels, zorgzaken en OV-haltes, plus de favoriete plekken van het lid |
| `matching.js` | toewijzing met instelbare wegingen per stad en vervoerder, en een natrekbare rekensom per kandidaat |
| `dispatch.js` | het planscherm: openstaand, onderweg, de vloot, toewijzen, overboeken naar een partner, telefonische boekingen |
| `pendel.js` + `pendel-rooster.js` | bedrijfspendels: een regel wordt een dienstregeling wordt een echte rit |
| `reisbeleid.js` + `zakelijk.js` | de zakelijke laag: dienstverband, reisbeleid, goedkeuring en het maandoverzicht van de werkgever |

**De zes regels die deze laag anders maken dan een Uber-kloon.** Ze staan in
code, en `test/mobiliteit.test.js` (14 toetsen) laat ze zakken zodra ze niet
meer waar zijn -- alle zes zijn met een mutatie nagetrokken:

1. **Een product is nooit meer aan dan waar het op leunt.** Helikoptercharter
   vereist identiteitscontrole, een partnercontract, menselijke bevestiging, een
   weertoets en charterafrekening. Staat er een uit, dan staat het charter uit --
   ook als iemand hem net heeft aangezet, en aanzetten weigert met de NAAM van
   wat ontbreekt. Zo is een half afgemaakte functie niet per ongeluk te
   activeren.
2. **Papieren zijn fail-closed.** Geen geldigheidsdatum telt als ONGELDIG, niet
   als "vast wel in orde". Er is geen veld `geblokkeerd` dat kan verjaren; er is
   een lijst redenen die leeg is of niet. Een taxi met een verlopen vergunning
   komt niet in de rangschikking -- niet met minpunten, maar helemaal niet.
3. **De statusketen kent maar een weg.** Een rit kan niet 'voltooid' worden
   zonder ooit ingestapt te zijn, want daar hangt de afrekening aan. Chauffeur,
   dispatcher, reiziger en het AI-stuur lopen allemaal over dezelfde functie.
4. **De matcher legt zijn keuze uit.** Elke kandidaat draagt zijn rekensom mee
   (welke factor hoeveel punten gaf en waarom), en de AFGEWEZEN voertuigen staan
   er met hun reden bij. Een dispatcher die niet snapt waarom de motor wagen 4
   koos, gaat handmatig toewijzen -- en dan is de motor een dure decoratie.
5. **Werk wordt eerlijk verdeeld.** "Wie had vandaag het minste" is een factor
   met gewicht, per stad en vervoerder in te stellen. En `surge_pricing` staat in
   het register maar staat UIT: RTG rekent geen schaarstepremie.
6. **Geen tweede adresboek en geen tweede grootboek.** Bestemmingen zijn onze
   eigen zaken en haltes; afrekenen loopt via `kern/pay` zoals elke andere
   RTG-betaling. Het woonadres uit de identiteitskluis wordt NIET aangesproken --
   een lid bewaart zijn vertrekpunten zelf, als favoriet op codenaam.

RTG voert zelf geen commerciele luchtvaart of zeevaart uit. Die producten zijn
een marktplaats voor gecertificeerde exploitanten, en dat zit in de code als de
boekingsvorm `aanvraag`: daar komt altijd een mens tussen.

#### De OV-kaartverkoop: drie poorten voor er een vervoerbewijs uit komt

`overeenkomst.js` + `kaartje(-beeld/-gebruik).js` + `storing.js`. Een kaartje is
een afspraak tussen de reiziger en de **vervoerder** -- die rijdt, die
controleert, die draagt het risico. RTG verkoopt hooguit namens hem. Daarom
komen er drie poorten voor een kaartje uit, en alle drie worden ze op het moment
zelf uitgerekend:

1. de module `public_transport_ticketing` staat aan in dit gebied;
2. er is een **geldige overeenkomst** met die vervoerder -- een dossier met
   looptijd, handtekening en afdracht, alleen door RTG zelf vast te leggen (een
   partij die zijn eigen overeenkomst schrijft, heeft geen overeenkomst maar een
   vinkje);
3. die overeenkomst dekt **deze lijn en dit product**. Een lege lijnenlijst
   betekent geen enkele lijn, niet alle.

De prijs komt uit `ovPrijsVan` -- dezelfde formule die afrekent bij het
uitchecken, zodat de balie en de bus niet uiteenlopen. De controle door de
conducteur is de enige plek waar een kaartje opgaat, en hij ziet het bewijs en
niet de persoon: product, lijn, geldigheid en de codenaam, geen e-mailadres en
geen wallet.

**Abonnementen** zijn hetzelfde ding met een ander product: een periodekaart
wordt bewaard als een kaartje met product `abonnement`, in dezelfde voorraad en
met dezelfde code, zodat de conducteur langs precies één weg controleert. Wat er
anders aan is staat in code: onbeperkt reizen binnen de looptijd (het aantal
ritten wordt geteld maar niet begrensd, en dat staat er ook bij), een prijs die
uit de **overeenkomst** komt en niet uit een formule -- wat een maandkaart kost
is een commerciële afspraak, geen som -- en bij een storing een teruggave op
**dagbasis**. Een maandkaarthouder de helft van zijn maand teruggeven omdat de
bus een uur uitviel, is geen compensatie maar een weggevertje, en het komt van
de vervoerder af.

Het kaartje is te **tonen als scanbare QR** (`shared/qr.js` + `qrteken.js`, onze
eigen codec) met de code in leesbare tekens eronder voor als de camera niet
meewerkt; de conducteur scant hem op de dienst-PDA met dezelfde overlay als de
kassa en de pas. Hij ziet het bewijs en niet de persoon.

**Vertraging komt van de vervoerder, niet van ons.** Wij hebben live posities
maar geen dienstregeling per halte, dus "hoeveel te laat" kunnen wij niet
berekenen -- en een teruggave op een geraden getal is erger dan geen teruggave.
De vervoerder meldt de storing zelf; iedereen met een kaartje in dat venster
krijgt automatisch geld terug (vertraging 50%, uitval 100%). Twee dingen die
daar in code staan omdat ze in de eerste versie fout gingen: nooit meer dan de
kaartprijs terug (wie 50% kreeg en daarna uitval, kreeg anders 150%), en een
vergoeding voor vertraging kost je je rit **niet** -- alleen bij uitval vervalt
het kaartje.

#### De CDT: klaar voor 2028, en eerlijk over wat er nog niet is

`cdt.js` + `cdt-tijden.js` + `cdt-export.js`. Vanaf 1 januari 2028 gaat het
Nederlandse taxivervoer van de boordcomputer over op de Centrale Database
Taxivervoer. Wat hier staat:

- **De dienst van een chauffeur**: aanmelden op de chauffeurskaart (zonder kaart
  geen registratie -- fail-closed), overschakelen tussen rijden, andere
  werkzaamheden, beschikbaarheid, pauze en rust, en afmelden. De tijdlijn heeft
  altijd precies één open blok, zodat er geen gaten of overlappingen ontstaan.
- **De grenzen** uit de Arbeidstijdenwet en het Arbeidstijdenbesluit vervoer
  (12 uur arbeid, 10 uur rijden, 30 minuten pauze na 4,5 uur rijden, 10 uur
  dagrust) staan als data op één plek en zijn per onderneming bij te stellen op
  het eigen regime. Elk signaal noemt zijn eigen rekensom; een dienst binnen de
  grenzen levert er géén op.
- **De ritten worden niet overgeschreven** maar per dienst opgezocht in de
  rittenmotor. Een tweede rittenlijst voor de inspectie zou binnen een maand
  uiteenlopen met de eerste, en daarvan gaat er één naar de overheid.
- **De export** is herhaalbaar en draagt een sha256 over een vaste ordening,
  zodat later na te gaan is of het aangeleverde bestand hetzelfde was. Er staan
  geen prijzen, codenamen of bestemmingen in: wat je niet uitlevert, kan ook niet
  uitlekken.

**En wat er bewust niet is: een knop "verzenden naar de CDT".** Aanleveren loopt
via een ICT-dienstverlener die aan de eisen van de ILT voldoet, en RTG is dat
niet. Zo'n knop zou een leugen zijn met een groen vinkje eronder, en bij een
wettelijke verplichting is dat gevaarlijk in plaats van slordig: een ondernemer
die denkt dat hij heeft aangeleverd, controleert het niet meer. Wat er wel is,
is een **overdracht-journaal**: wie gaf welk bestand wanneer aan welke
dienstverlener. Dat legt vast wat er echt gebeurde, en het antwoord zegt erbij
dat RTG niet kan zien of de CDT het heeft aanvaard.

#### De multimodale reisplanner: taxi en OV als EEN reis

`reisplan(-etappe).js` + `reisfactoren.js` + `reis.js` + het tabblad *Reizen* in
`/apps/ov.html`. Dit is de functie die andere vervoersapps niet kunnen bouwen,
en niet omdat het algoritme moeilijk is: het is dat de bestemmingen, de lijnen,
de taxi's en de betaling hier van hetzelfde huis zijn. "Taxi naar het station,
trein, lopen naar Sal de Mar" is bij ons **een** reis met **een** overzicht, en
geen drie apps met drie bonnetjes.

De planner zet de manieren om er te komen naast elkaar, met per optie de tijd,
de prijs, de overstappen, de loopafstand en de uitstoot -- en wijst *snelst*,
*goedkoopst* en *schoonst* aan zonder een "beste" te kiezen, want dat is een
oordeel over andermans afweging. Voor Ibiza-stad naar Santa Eularia:

| optie | tijd | prijs | uitstoot |
| --- | --- | --- | --- |
| Rechtstreeks met de taxi | 29 min | € 42,39 | 1861 g |
| Kustlijn 1 + taxi | 35 min | € 38,35 | 1738 g |
| Eilandexpres + 206 m lopen | 42 min | € 3,98 | 432 g |

**Wat de planner bewust niet doet** is een kortste pad zoeken door een netwerk
met overstappen. Dat vraagt een dienstregeling per halte die wij niet hebben, en
een planner die overstappen verzint op tijden die hij niet kent, stuurt mensen
naar een perron waar niets komt. Hij doet wat hij wel kan onderbouwen, en wat
afvalt valt af **met reden** ("de haltes liggen zo dat je er een omweg voor
maakt") -- een lege lijst zonder uitleg leest als een storing.

Vier dingen die in code staan omdat ze anders niet waar zouden zijn:

1. **Uitstoot heet een schatting**, ook op het scherm, met het gehanteerde
   getal per kilometer erbij. Het zijn indicatieve gemiddelden om opties mee te
   vergelijken, geen meting aan het voertuig waar u in stapt.
2. **Betrouwbaarheid komt uit onze eigen storingsmeldingen**, met het venster
   erbij. Geen gegevens is "niet bekend" en niet "100%".
3. **Comfort is geen score** maar een rij feiten: hoe vaak overstappen, hoeveel
   meter lopen, zit u zeker.
4. **Het plan wordt bij het boeken opnieuw gerekend.** De app stuurt alleen
   welke optie het werd; wie de prijs meestuurt, bepaalt hem anders zelf.

Boeken maakt de etappes echt: de taxi wordt een opdracht in de rittenmotor, de
OV-etappe een vervoerbewijs (of een instructie om in te checken als er op die
lijn geen kaartverkoop is). De geldregels staan apart en eerlijk: **het kaartje
is betaald, de rit wordt afgerekend als hij gereden is** -- tot dan is die prijs
een schatting. Mislukt er halverwege iets, dan worden de al aangemaakte ritten
teruggedraaid, zodat er nooit een betaald kaartje achterblijft voor een reis die
niet doorgaat.

En de fout die dit het duidelijkst maakt: de eerste versie schreef
`haversine(a, b) || 9e9`, en dat maakt van een afstand van **nul** een oneindige.
Stond je precies op de halte, dan werd die als verste gesorteerd en viel de hele
OV-optie af als omweg. De planner was het slechtst op het moment dat hij het
makkelijkst had moeten hebben.

#### De zakelijke laag: een product, geen knop "zakelijke rit"

`reisbeleid.js` + `zakelijk.js` + `/apps/zakelijk.html` (de werkgever) en de
velden *Op rekening van* / *Kostenplaats* in `/apps/ov.html` (de medewerker).
Een vinkje "zakelijk" op een rit is een regel op een factuur. Wat een werkgever
werkelijk wil is een grens, een goedkeuring en een overzicht -- en dat is wat
hier staat.

**Het gat dat hier zat, en hoe het gedicht is.** De rittenmotor nam de
organisatiecode aan uit het verzoek. Elk lid dat de code van een bedrijf kende,
kon op diens rekening rijden; de dienstverbandcontrole stond alleen bij de
bedrijfspendel. Die controle staat nu op **een** plek -- in `opdrachtMaak`, waar
elke weg naar een zakelijke rit langskomt (de app, de reisplanner, de
dispatcher) -- en wordt op het moment zelf nagevraagd bij de
personeelsadministratie, nooit uit iets wat de client meestuurt. Een controle
per ingang is een controle die de volgende ingang vergeet.

Het beleid kent een maximum per rit, een budget per medewerker per maand,
toegestane tijden, dagen, steden, ritsoorten, een (verplichte) kostenplaats en
een goedkeuringsdrempel. Vijf dingen die daarbij in code staan:

1. **Elke afwijzing noemt de regel en het getal.** Niet "niet toegestaan", maar
   *"Deze rit kost € 40,48; het maximum per rit is € 5,00."* Wie moet raden of
   het aan het bedrag, het tijdstip of de kostenplaats lag, belt zijn manager --
   precies wat een reisbeleid hoort te voorkomen. De werkgever ziet die zinnen
   naast zijn eigen knoppen staan, zodat hij weet hoe zijn beleid klinkt.
2. **Een drempel is geen verbod.** Boven het bedrag mag de rit best; er kijkt
   eerst een mens naar. Die twee door elkaar halen is waarom mensen om een
   beleid heen gaan werken. En wie buiten de regels valt, hoort dat hij de rit
   op eigen rekening kan boeken -- dat is het verschil tussen een werkgever en
   een voogd.
3. **Een rit die op akkoord wacht, rijdt niet.** Hij staat op geen enkel
   planbord en is niet in beweging te krijgen; de grendel zit op `opdrachtNaar`,
   de enige weg naar een andere status, en niet op een scherm. Zou de wagen
   alvast rijden, dan is de goedkeuring een formaliteit achteraf. Er is ook geen
   stilzwijgende goedkeuring na verloop van tijd: wie niets doet, keurt niets
   goed, en het besluit draagt de naam van wie het nam. Weigeren annuleert de
   rit, want een geweigerde rit die blijft staan wordt alsnog gereden.
4. **Bij een reis gaan de ritten naar de werkgever en blijven de
   vervoerbewijzen persoonlijk.** Een rit wordt achteraf afgerekend en kan dus
   naar een zakelijke rekening; een kaartje is hier en nu uit de portemonnee van
   de reiziger betaald. Het overzicht zegt dat er met zoveel woorden bij.
5. **Het maandoverzicht telt de rittenmotor**, per kostenplaats en per
   medewerker, met de uitstoot erbij als schatting -- geen tweede administratie
   die er binnen een kwartaal naast zit. De werkgever ziet de personeelsnaam die
   hij al kent; de vervoerder ziet de codenaam. Dat is dezelfde scheiding als
   overal: de chauffeur hoeft niet te weten wie hij ophaalt.

`test/zakelijkvervoer.test.js` (14 toetsen) bewaakt dit, met mutaties
nagetrokken: de poort die niet meer weigert, de grendel die eraf gaat, de
wachtende rit die toch op het planbord komt, het budget dat geannuleerde ritten
meetelt, de drempel die een verbod wordt, en een `werktBij` die niet meer naar
het bedrijf kijkt -- elk daarvan laat een andere toets zakken. Het scherm van de
werkgever loopt de weg af in `test/mobiliteitscherm.e2e.js`.

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

### RTF Foundation OS (de stichting als organisatie)

De RTFoundation is niet één kantoor dat alles zelf doet, maar een landelijke stichting die per stad met bestaande lokale partijen samenwerkt. Het **Foundation OS** (`server/kern/rtfos/`, routes `/api/rtfos/*`, schermen `/apps/foundation/os.html`, `os-bestuur.html`, `os-veld.html`, `os-portaal.html`, `os-donateur.html`, `os-vrijwilliger.html`, `os-deelnemer.html` en `os-publiek.html`) draagt dat federatieve model: **eigen uitvoering per stad, centrale governance erboven**. Wat het landelijke toezicht draagt staat in code en niet in een afspraak.

- **De boom.** RTF Internationaal > RTF Nederland > de stadsafdelingen. Een stad heeft een eigen kernteam, eigen partners, projecten, budgetten en rapportages. Wat een stad *niet* zelf doet: zichzelf activeren, zijn goedkeuringslimiet verhogen, een module aanzetten of een andere stad bekijken.
- **Zetels in plaats van rollen.** Bevoegdheid hangt aan een sleutel uit een échte inlog (`boardroomWie`), niet aan een veld in het verzoek. De gedeelde kantoorcode wijst niemand aan en krijgt dus nooit een zetel. Het landelijke bestuur is de boardroom; daaronder staan `stadsbestuur`, `projectleider` en `medewerker` (`kern/rtfos/zetels.js`).
- **Modules per stad** (zestien feature-vlaggen, van `youth_programs` tot `emergency_fund`). Staat een module uit, dan kan er in die stad niets van worden aangemaakt of gewijzigd — met de reden in het antwoord, niet als lege lijst.
- **Geoormerkt geld verschuift niet.** Een bron (donatie, subsidie, sponsoring) draagt zijn bestemming; een uitgave kan alleen bronnen aanspreken die bij dát project horen. Herbestemmen kan uitsluitend landelijk, met een reden, en nooit als de gever het heeft uitgesloten. Het vrije saldo telt de nog niet besloten aanvragen mee, zodat dezelfde euro niet twee keer wordt aangevraagd.
- **Vier ogen en een ladder.** Wie aanvraagt, besluit niet. Projectleider tot €250, stadsbestuur tot €2.500, daarboven landelijk; een stad kan die drempel verlagen, nooit verhogen. Hetzelfde getal geldt voor het goedkeuren van een project, uit dezelfde functie.
- **Partnerstichtingen** met KvK, RSIN, ANBI, bestuurders, documenten en looptijd — plus de vijf afspraken die er in de praktijk toe doen (wie doet het geld, de vrijwilligers, de persoonsgegevens, de aansprakelijkheid en de rapportage). Landelijk goedgekeurd, en niet actief zonder samenwerkingsovereenkomst in het dossier.
- **Vrijwilligers met een VOG-grendel.** De VOG is een datum, geen vinkje: verlopen is niet geldig. Bij werk met kinderen en ouderen wordt de koppeling geweigerd, niet gemarkeerd.
- **Hulpvragen op codenaam.** Geen veld voor gezondheid, geloof of gezinssituatie; naam en telefoon staan versleuteld (`server/kluis.js`) en worden alleen op een aparte handeling geopend, met een auditregel per blik. Toestemming wordt bij elke stap opnieuw gelezen en is intrekbaar; afronden kan niet zonder hulpactie in het dossier en zet meteen een bewaartermijn.
- **Integriteit.** Incidenten, klachten, klokkenluidersmeldingen en belangenverstrengeling, in vier zwaarteklassen. Hoog en kritiek staan direct op het landelijke bord; klokkenluidersmeldingen gaan buiten de stad om (anders gaan ze over het stadsbestuur langs het stadsbestuur). Niemand kan een melding verwijderen — sluiten kan, met een uitkomst.
- **Verantwoording.** Het gemeentenportaal (`/api/rtfos/portaal/gemeente`) geeft uitsluitend getelde cijfers: bereik, buurten, besteding, prestatieafspraken. Buurten met minder dan vijf hulpvragen worden samengevoegd, want een klein getal in een kleine buurt is geen statistiek meer. Wat niet is ingevuld staat als **niet gemeten** en niet als nul.
- **Drie code-portalen** naast het bestuursscherm: partnerstichting (`RTFP-`), gemeente (`RTFG-`) en lokale ondernemer (`RTFO-`). Zelfde familie als de clubcodes, met dezelfde twee remmen (20/min per bron, 60/min per code) en met een reden op de publieke lijst van `check.js` regel 28.

**Fase twee — de uitvoering op straat**, met dezelfde discipline: elke module heeft een grendel die de praktijkfout tegenhoudt, en die grendel is met een mutatie zien zakken.

- **Subsidies** (`kern/rtfos/subsidies.js`): een subsidie is geen inkomsten maar een verplichting met geld eraan — voorwaarden, rapportagemomenten, terugbetaalrisico. Toekennen *maakt zelf* de geoormerkte bron in `geld.js` (geen tweede plek die hetzelfde bedrag vasthoudt), aanvaarden boven de stadsgrens is landelijk werk, en "verantwoord" kan niet zolang er een rapportagemoment open staat of er geen bewijsstuk in het dossier zit. Een kans met een verstreken deadline komt terug als **gemist** in plaats van stil oud te worden.
- **Voorraad** (`kern/rtfos/voorraad.js`): goederen als *batch*, niet als saldo — houdbaarheid, opslaglocatie, gever, bestemming. Bederfelijke waar zonder houdbaarheidsdatum komt niet binnen; over de datum gaat niet de deur uit (afschrijven is een andere handeling, met verplichte reden); het restant wordt uit de batch zelf gerekend. Een uitgifte wijst naar een project of naar een hulpvraag-**codenaam**, nooit naar een persoon.
- **Activiteiten** (`kern/rtfos/activiteiten.js`): vol is een wachtlijst en geen nee — bij een afmelding schuift hij op en het antwoord zegt *wie*. Een jeugdactiviteit gaat niet open zonder begeleider met geldige VOG en zonder veiligheidsplan; een minderjarige zonder vastgelegde oudertoestemming checkt niet in; fototoestemming is een apart veld dat nergens uit meedoen wordt afgeleid. De incheckcode (de QR aan de deur) komt uit de CSPRNG.
- **Communicatie** (`kern/rtfos/berichten.js`): naar binnen stuurt de stad zelf — anders gaat het bericht via een privé-appgroep en is het systeem het probleem. Naar buiten draagt de naam van de hele stichting en gaat langs het landelijke bestuur; spoed geeft **voorrang, geen omweg**. Wie de tekst na goedkeuring wijzigt, valt terug op concept: een goedkeuring hoort bij díé tekst.

**Fase drie — de governance-laag**, en dat is de laag waarop een stichting wordt afgerekend als het misgaat: niet op wat ze deed, maar op of ze het *bevoegd* deed en het kan laten zien. Eigen scherm (`/apps/foundation/os-bestuur.html`), want dit is werk van een paar keer per jaar met een ander publiek dan de dagelijkse uitvoering.

- **Bestuursvergaderingen** (`kern/rtfos/bestuur.js` + `bestuur-notulen.js`): geen quorum, geen besluit — en de weigering noemt het getal ("2 van de 5 aanwezig, er zijn er 3 nodig"), want "geweigerd" leert de secretaris niets. Wie bij een punt als belanghebbend is aangemerkt, kan niet worden geteld als stemmer, ook niet als tegenstemmer: het gaat om deelname aan de stemming, niet om de richting. Notulen worden in een **volgende** vergadering vastgesteld — een vergadering die zichzelf vaststelt zegt alleen dat de aanwezigen zeiden wat zij zeiden — en daarna weigert alles wat wijzigt, tot en met een agendapunt.
- **Landelijk beleid** (`kern/rtfos/beleid.js`): een nieuwe versie **wist alle bevestigingen**. Dat voelt als werk weggooien en is het punt: een handtekening onder versie 1 is geen handtekening onder versie 2. Een stad kan een landelijke regel bevestigen, niet herschrijven; een regel die nog moet ingaan telt niet mee in het "wie moet nog"-lijstje.
- **Jaarverslag en ANBI-publicatie** (`kern/rtfos/jaarverslag.js`): de cijfers worden bij het opstellen **bevroren**. Een rapportagescherm hoort live te rekenen, een verantwoording niet — een jaarverslag dat meebeweegt met de database is geen jaarverslag. Vaststellen kan alleen met een *aangenomen* besluit uit *vastgestelde* notulen, publiceren alleen na vaststelling, en daarna is een correctie een herziening met een reden. De publicatie hangt onder `/api/rtfos/publiek/jaarverslagen`: achter een inlog is een ANBI-jaarstuk niet gepubliceerd.
- **Risicoregister** (`kern/rtfos/risico.js`): kans maal impact, allebei 1 tot 5, geen wegingsformule die precisie suggereert die er niet is. Een zwaar risico (vanaf 15) gaat niet op "beheerst" zonder maatregel, eigenaar én een herbeoordelingsdatum in de toekomst; het antwoord noemt precies welke van de drie ontbreekt. Een verstreken herbeoordeling wordt gerekend en niet opgeslagen — net als de gemiste subsidiekans.
- **Grote en contante giften** (`kern/rtfos/herkomst.js`): boven de tienduizend euro, of vijfhonderd contant, **staat het geld stil**. Geen waarschuwing en geen vinkje op een lijst: de grendel zit op de bron (`geld-uitgaven.js`), dus wie het geld ook wil aanspreken stuit op hetzelfde. Staat er iets tegenover, dan is het geen donatie maar sponsoring en wordt het geweigerd. De sanctielijst controleert dit systeem **niet** — het veld vraagt wie het handmatig deed, want een knop die "gecontroleerd" zegt zonder te controleren is erger dan geen knop.
- **Meldcode** (`kern/rtfos/meldcode.js`): de vijf wettelijke stappen bij zorg om een kind. Wegen en beslissen kan niet zonder de overlegstap — dat is precies de fout die de meldcode moet voorkomen: de welwillende medewerker die in zijn eentje concludeert dat het meevalt. Het gesprek met de betrokkene mag worden overgeslagen (soms verslechtert het de veiligheid), maar niet stilzwijgend. Sluiten vraagt een afweging in woorden, ook bij "geen actie". Er staat in die module geen enkele verwijderende bewerking, en de toets leest dat in de bron.

Getoetst in `test/rtfos-governance.test.js` (acht scenario's) en `test/rtfosgovernance.e2e.js` (het scherm). Negen mutaties, alle negen **RAAK** — inclusief de mutatie die het jaarverslag weer live liet rekenen en die de noemer van het quorum van het scherm haalde.

**Fase vier — het netwerkeffect**, de enige reden om federatief te zijn. Alles hier houdt de stadsgrenzen intact:

- **Blauwdrukken** (`kern/rtfos/netwerk.js`): wat in de ene stad werkte, neemt de volgende over. Een blauwdruk kan alleen uit een project dat draait of gedraaid heeft én ten minste één ingevulde indicator heeft — anders is het een ideeënbus. Wie hem overneemt begint bij **idee** met budget nul en loopt de eigen goedkeuring; de resultaten en het bedrag van de andere stad reizen niet mee.
- **Gezamenlijke inkoop** (`kern/rtfos/inkoop*.js`): elke stad schrijft zelf in, met een bron van de eigen stad en met het oormerk intact. Sluiten is geen betaling maar een **bestelling**: per stad ontstaat een gewone uitgave-aanvraag die daar nog door de vier ogen en de limiet moet. Minder dan twee steden is geen gezamenlijke inkoop.
- **Vrijwilligers tussen steden** (`kern/rtfos/uitwisseling.js`): een vrijwilliger wordt gevraagd, niet verplaatst. Zonder vastgelegde toestemming loopt de uitleen niet; er is altijd een einddatum (verlopen wordt gerekend, niet door een taak omgezet); en de ontvangende stad ziet vaardigheden en beschikbaarheid, **geen evaluaties en geen urenhistorie** — dat is het dossier van de eigen stad.
- **Landelijke campagnes** (`kern/rtfos/campagnes.js`): de verdeelsleutel staat vooraf vast en telt op tot exact 100%; een ronde verdeelt centnauwkeurig (grootste rest) en landt als bron in de stad zelf. Geen automatische formule op inwonertal of prestatie — het bestuur kiest, met de reden in het auditspoor.
- **Benchmark** (`kern/rtfos/netwerk-meting.js`): steden naast elkaar mét hun noemer, en met opzet **geen rangschikking op doelmatigheid**. Een stad ziet zichzelf naast de landelijke mediaan, niet naast de buren bij naam. Uitschieters komen terug als *vraag* ("zijn dit langere trajecten, of loopt hier iets vast?"), niet als oordeel.
- **Koppelbord met RTG** (`kern/rtfos/koppeling.js`): alleen de agenda werkt vandaag echt (een activiteit in je eigen RTG-agenda). Vervoer, betalingen en chat staan er als **niet gekoppeld**, met per stuk de reden en wat ervoor nodig is. Een knop die stilletjes niets doet, is erger dan geen knop.

**Fase vijf — de drie doelgroepen die nog geen eigen ingang hadden.** De functies bestonden al; wat ontbrak was de deur waar de vrijwilliger, de hulpvrager en de buurt zelf naar binnen gaan. Alle drie de schermen houden de code in het tabblad en nergens anders — op een gedeelde computer sluit je het tabblad en is het weg.

- **De vrijwilligersapp** (`kern/rtfos/vrijwilligerportaal.js`, scherm `/apps/foundation/os-vrijwilliger.html`, code `RTFV-`): eigen beschikbaarheid, talen en vaardigheden bijwerken, en uren melden. Wat hij hier *niet* zet: zijn VOG-datum, de gedragscode en zijn status — dat doet de afdeling, met de reden in het antwoord in plaats van een stille weigering. Gemelde uren landen in `gemeldeUren` en tellen pas mee ná bevestiging door de coördinator: uren zijn een verantwoording naar buiten, en dan is "de vrijwilliger typte het in" geen bron. Zijn eigen beeld bevat bewust geen evaluaties en geen contactgegevens, met de tekst erbij dat hij ze wél mag opvragen — bij een mens, niet bij een knop.
- **Het deelnemersportaal** (`kern/rtfos/deelnemerportaal.js`, scherm `/apps/foundation/os-deelnemer.html`, code `RTFD-`): waar staat mijn vraag, en nee kunnen zeggen. De keten-woorden worden vertaald (`in_uitvoering` wordt "er wordt aan gewerkt"), interne notities blijven binnen, de helpende organisatie staat er wel en de namen van hulpverleners niet. Intrekken loopt door dezelfde functie als de kantoorkant (`casus.toestemmingWegDirect`) — de eerste versie had de controle er nog een tweede keer omheen staan, en een mutatie die hem weghaalde liet geen enkele toets zakken. Dat was een controle te veel, geen extra veiligheid.
- **De publieke RTF-app** (`kern/rtfos/publiek.js`, scherm `/apps/foundation/os-publiek.html`): zonder inlog, en met een simpele maat — wat zou je op een poster in het buurthuis hangen? Actieve steden, wat er te doen is en de landelijke campagnes. Geen aantallen hulpvragen, geen namen, geen bedragen: die zeggen op straat niets en verraden in een kleine buurt wél iets.

Alle drie zijn ze **installeerbaar als eigen app** (`manifests/rtf-vrijwilliger`, `rtf-eigen`, `rtf-buurt`) en staan ze in de offline-schil van de bestaande foundation-service-worker — niet in een eigen: een tweede service worker op `/apps/foundation/` vervangt de eerste, en dan is de gezinsapp zijn cache kwijt. Wat offline komt is de pagina zelf en niet de inhoud; die loopt over een POST-API die nooit uit de cache komt. Het manifest van de hulpvrager heet met opzet gewoon **RTFoundation** en niet "Mijn hulpvraag": een geïnstalleerde app zet een icoon mét naam op een beginscherm dat huisgenoten meelezen, en dan vertelt de telefoon wat de pagina zelf zorgvuldig niet vertelt. Dezelfde reden waarom er geen contactgegevens op staan.

**De laatste twee ingangen**, waarmee alle tien de interfaces uit de opzet bestaan.

- **De veld-app** (`kern/rtfos/veld.js`, scherm `/apps/foundation/os-veld.html`): het verschil met het bestuursscherm is niet het formaat maar de blik. Een medewerker ziet uitsluitend wat aan hem is **toegewezen** — niet zijn stad, niet zijn project, aan hem. In een buurthuis kent iedereen elkaar; een dossier van de buurvrouw hoort niet twee tikken weg te zijn. Het adres opent apart en dat komt in hetzelfde auditspoor als op kantoor (dezelfde functie, niet een tweede versie ervan). Elk bezoekrapport draagt een vervolgafspraak, of de uitdrukkelijke mededeling dat er geen vervolg nodig is met de reden erbij — een rapport zonder vervolg is hoe een hulpvraag blijft liggen: iedereen denkt dat de ander aan zet is. Afronden kan hier niet, en de weigering legt uit waarom: dat zet de bewaartermijn in gang en sluit de zaak, en zo'n besluit hoort niet op de stoep te vallen.
- **Het donateursportaal** (`kern/rtfos/donateur.js`, scherm `/apps/foundation/os-donateur.html`, code `RTFS-`): wat gaf ik, en waar ging het heen. Nooit wie er nog meer gaf — een code die het donateursbestand opent is de adressenlijst van iemand anders — en nooit op mensniveau: "uw gift ging naar het Taalcafé" mag, "u hielp mevrouw K." niet. Het giftbewijs zegt wat het **is**: bij sponsoring komt er geen bewijs maar de reden (er staat iets tegenover, dus het zijn zakelijke kosten), bij een gift waarvan de herkomst nog open staat evenmin, en **periodiek** heet het alleen met een vastgelegde overeenkomst van ten minste vijf jaar. Dat laatste is geen detail: een bewijs dat iets anders suggereert kost de gever geld bij zijn aangifte.

Getoetst in `test/rtfos-afmaak.test.js` (zes scenario's, inclusief de publieke campagnelijst — de laatste rtfos-route die nog door geen enkele toets werd aangeraakt) en `test/rtfosafmaak.e2e.js` (beide schermen, tekst én rauw antwoord). Acht mutaties, alle acht **RAAK**.

**Elk routepad staat letterlijk in de bron**, en dat is een reparatie met een verhaal: de eerste versie bouwde de paden op (`app.post('/api/rtfos/' + pad, …)`). Dat werkte, en het maakte 85 routes onzichtbaar voor vier meters tegelijk — de poort-audit (`check.js` regel 28), de dubbele-routecontrole (regel 31), `scripts/schakelbaar.js` en de routekaart lezen allemaal de bron met een regex op een letterlijk pad. Ze zagen één route, `/api/rtfos/`. Alles stond groen omdat er niets te zien was. Sinds de paden letterlijk zijn, ziet de poort-audit ze wel (nagetrokken met een mutatie: `officeAuth` weghalen laat regel 28 zakken met die route bij naam), en werd zichtbaar dat 24 ervan nog nooit door een toets waren aangeraakt.

Getoetst in `test/rtfos.test.js` (twaalf scenario's op de governance-grendels), `test/rtfos-uitvoering.test.js` (zes op de uitvoering), `test/rtfos-portalen.test.js` (acht op de portalen en dossiers), `test/rtfos-netwerk.test.js` (zeven op het netwerkeffect), `test/rtfos-doelgroepen.test.js` (zes op de drie eigen ingangen, inclusief de manifesten en de offline-schil), `test/rtfosschermen.e2e.js` (de twee bestuursschermen, inclusief het rauwe antwoord aan de gemeente) en `test/rtfosdoelgroepen.e2e.js` (de drie doelgroepschermen plus de overdracht van code en uren vanaf het bestuursscherm, met een lijst dingen die op géén van de drie mag opduiken — gecontroleerd in de zichtbare tekst én in de rauwe antwoorden, want een scherm dat gevoelige gegevens ophaalt maar niet toont, lekt ze nog steeds). De 30%-afdracht van RTG naar de stichting blijft waar hij stond (`kern/fonds.js`); dit OS gaat over wat de stichting met dat geld dóét.
### Het stadsweefsel (`server/kern/stadsweefsel/`)

RTG had de organen van een stad al — sensoren, gemeente, overheid, OV, hulpdiensten, rampbeeld, gebouwen, betalingen — maar niet het weefsel ertussen. Het platform wist wél dát er iets speelde, maar niet waar het lag, wat eromheen stond, of twee meldingen hetzelfde probleem waren, wat er meeviel bij uitval, of het vaker gebeurde, en wat oplossen had gekost. Deze laag is dat weefsel. De boardroom-routes staan onder `/api/office/weefsel/*` (`routes/kantoren/weefsel.js`), de toetsen in `test/stadsweefsel.test.js` (negen toetsen, negen mutaties, alle negen RAAK).

- **Eén geografische waarheid** (`geografie.js` + `meetkunde.js`): `stad → wijk → buurt → zone → straatsegment`, elk gebied met een geometrie (punt, lijn of vlak). De grens van een wijk is de omhullende van zijn buurten, dus geen tweede getal. Middelpunt en grenzen komen uit `kern/navigatie` (REF/BOUNDS, Ibiza-stad), zodat de stad en haar A*-wegennet in dezelfde wereld liggen. `plaats(lat,lng)` geeft het diepste gebied plus het hele kruimelpad; zones overlappen niet, dus een punt hoort bij precies één zone. **De zes zones van RTG Stad wonen hier**: `kern/stad` had ze in een eigen `db.data.stadZones` en leest ze nu hier — één lijst in plaats van twee die uiteenlopen.
- **Het objectregister** (`objecten.js`, `objectsoorten.js`, `objectseed.js`): twaalf soorten (lantaarn, container, gemaal, transformator, laadpaal, brug, halte …) met eigenaar, beheerder, status, risicoklasse, conditie (NEN 2767-achtig: 1 uitstekend … 6 zeer slecht), bouwjaar, technische levensduur, vervangingswaarde en een eigen onderhoudshistorie. Het gebied is **afgeleid uit de positie**, nooit ingetikt. `weefselAandacht` geeft wat om aandacht vraagt zónder dat iemand belde (conditie ≥ 4 of over de levensduur heen). De laadpalen worden gezaaid uit de POI-laag van de navigatie, zodat het laadpunt dat je aanwijst hetzelfde ding is als het laadpunt dat je onderhoudt.
- **Relaties en afhankelijkheden** (`relaties.js`, `afhankelijkheden.js`): getypeerde randen van oorzaak naar gevolg (`voedt`, `afvoer-naar`, `stuurt`). Daarmee beantwoordt `/api/office/weefsel/uitval` de wat-als-vraag ("transformator Kern valt uit → vijftien objecten in twee zones, waaronder een gemaal"), en `keten` de omgekeerde ("waar hangt deze lantaarn van af"). De doorloop is begrensd op diepte en knopen en zegt het zelf als hij afkapt.
- **Het geheugen** (`tijdreeksen.js`): elke meting rolt op in een uur- en een dagemmer per sensorsoort per zone (n, som, min, max). Cijfers voor een buurt, wijk of de hele stad worden **gerekend** uit de zones eronder en niet apart bewaard. Bewaartermijn per laag (`RTG_WEEFSEL_UURDAGEN`, standaard 14; `RTG_WEEFSEL_DAGDAGEN`, standaard 400) en de veger ruimt echt op.
- **Eén zaak- en werkordermotor** (`zaken.js`, `zaakbeeld.js`, `werkorders.js`, `categorien.js`): elk kanaal — bewonersapp, gemeenteloket, telefoon, ambtenaar, Stadsdoos, politie, vervoerder, bedrijf — biedt een **waarneming** aan. Zelfde categorie, zelfde object (of binnen 75 meter) en binnen 72 uur op een open zaak: dan hoort het bij die zaak. Tien meldingen over dezelfde paal zijn zo één zaak met tien melders in plaats van tien klussen. Elke zaak krijgt meteen een werkorder; klaarmelden boekt de handeling mét kosten en uren in de onderhoudshistorie van het object (precies één keer) en sluit de zaak, waarna de melder het live terugziet. En hangen meerdere open zaken van dezelfde soort onder één bovenstroomse bron, dan **wijst** de motor die aan als mogelijke gedeelde oorzaak — als hint voor een mens, niet als besluit.
- **Onderhoud dat niet op meldingen wacht** (`onderhoud.js`): een inspectieregime per objectsoort (speeltoestel elk kwartaal, lantaarn eens in de vier jaar), en een signaal van 0–100 uit conditie, restlevensduur, hoe vaak er het afgelopen jaar aan is gesleuteld, de overschreden schouwtermijn en de huidige status — altijd **met de redenen erbij**. Een ronde is een voorstel dat een mens gunt; bij een object met risicoklasse *kritiek* (gemaal, transformator, brug) kan dat alleen met **vier ogen**: twee namen, en niet twee keer dezelfde.
- **Contracten, SLA's en prestatie** (`contracten.js`): een aannemer is een partij met een scope (welke soorten, welk gebied), tarieven, een looptijd en een SLA per prioriteit — twee klokken, want reageren en herstellen zijn verschillende beloftes. Het **meest specifieke** lopende contract wint. De reactieklok stopt bij een handeling (iemand pakt de order op), niet bij een status die je zelf kunt zetten. `weefselPrestatie` geeft per partij het percentage op tijd, en noemt apart wat nog openstaat én over zijn termijn is — de vorm waar een gemiddelde overheen kijkt.
- **Stedelijke indicatoren** (`indicatoren.js`): doorlooptijd (mediaan én gemiddelde, want het verschil vertelt zelf iets), open en opgeloste zaken, kosten per domein, SLA-nakoming, herhaling per object, en het **verschil tussen wijken** met de spreiding erbij. Elke indicator draagt zijn eenheid en zijn richting; *niet gemeten* is null met een tekst, nooit 0. Technische beschikbaarheid ("99,9% sensoren online") staat er met opzet **niet** tussen — dat is een randvoorwaarde, geen resultaat, en hij hoort op het techniekbord.
- **Van beleidsdoel tot uitkomst** (`begroting.js`): `doel → budget → project → werkorders → uitgaven → effect`. Een project legt zijn **nulmeting bij de start** vast (achteraf is elke startwaarde de waarde die het beste uitkomt) en meet bij het afsluiten dezelfde indicator opnieuw. Alleen afgerond werk telt als uitgave; een overschrijding wordt **gemeld, niet geblokkeerd** — werk stilleggen omdat een potje leeg is, is een besluit van een mens. Er wordt hier geen geld verplaatst.
- **Energie als planlaag** (`energie.js`): per voedingsgebied de capaciteit, wat eraan hangt, gemeten naast geschat verbruik, en de bezetting — met een marge die voor hulpdiensten gereserveerd blijft. Maatregelen (laden uitstellen, dimmen, batterijen inzetten, bedrijven waarschuwen) komen met hun verwachte winst **en hun terugvalstand**. Een opdracht is een *vastgelegd voornemen* met een naam, een reden en een vervaltijd, geen schakelaar: dit platform stuurt geen enkele fysieke installatie aan. Zware maatregelen vragen vier ogen; een maatregel die een veiligheidskritiek object raakt wordt geweigerd, ook mét twee namen.
- **Water, hitte en droogte** (`klimaat.js`): vijf meetsoorten naast de acht domeinen (regen, grondwater, rioolbelasting, waterstand, gevoelstemperatuur), risicokenmerken per zone (laag, hitte, kade) en vier scenario's — extreme regen, hittegolf, droogte, hoogwater — die combineren welke objecten in welke risicozone staan, in welke conditie, en wat ze bij uitval meeslepen. De Stadsdoos mag deze vijf gewoon insturen: dezelfde hardware, dezelfde sleutel.
- **Eén wat-als-motor** (`simulatie.js`): uitval, wegafsluiting (wat staat eraan, welke halte vervalt, blijft er een verbinding over), evenement (houdt wat er *staat* het vol — containers, haltes, laadpunten) en klimaat, achter één ingang. De aannames staan met naam en getal in het antwoord, zodat je kunt zien waarop het rust.
- **Vijf niveaus en een openbaar algoritmeregister** (`ainiveau.js`, `algoritmeregister.js`): van *waarnemen* tot *verboden zonder een expliciete menselijke beslissing*, als tabel die elk deel leest. Wat op niveau 4 staat, staat er met naam (hulpdiensten inzetten, een weg of brug afsluiten, kritieke infrastructuur uitschakelen, een vergunning weigeren, een persoonsrisico bepalen). Het register op **`/api/stad/algoritmes` is openbaar** — een register dat alleen achter de kantoorinlog te lezen is, geeft een inwoner niets — en noemt per regel het doel, de gebruikte gegevens, de beslisruimte, **de bekende beperkingen** en waar je terecht kunt.
- **Onderwijs, werk en de lokale economie** (`kansen.js`, `ondernemers.js`): deze laag houdt bijna niets zelf bij en dat is het punt. Vacatures komen uit `kern/werk`, bedrijven uit de partnerlijst, beroepen uit de Beroepen-Bibliotheek, aankomend werk uit de onderhoudsplanning — de kansenlaag legt ze op de **kaart** en maakt er verbindingen van: waar zit het werk per wijk, welk beroep is schaars (en dus: welk **gratis leerpad** hoort daarbij), welke panden staan leeg en **wat staat daaromheen** (haltes, laadpunten, bedrijven, open zaken), welk werk komt eraan waar nog geen contract voor loopt (een kans voor een lokale partij), wie moet weten dat zijn straat open gaat, en welke ondernemers een evenement raakt. Ontbreekt een bron, dan zegt de laag dat de **bron** ontbreekt — niet dat er geen werk is. Geteld wordt waar het *werk* is, nooit wie er zoekt.
- **Wie mag wat besluiten** (`bestuur.js`, `besluitvorming.js`): vier organen die niet hetzelfde doen — de raad stelt vast en controleert, het college bestuurt daarbinnen, een wijkraad **adviseert** (per wijk uit de geografie), de rekenkamer onderzoekt en besluit nooit. Het **mandaat** hangt aan het bedrag én aan het risico: onder €25.000 tekent een ambtenaar, daarboven het college, daarboven de raad, en veiligheidskritiek werk schuift altijd een trede op. En het **bijt**: `begroting.js` weigert een project boven de grens zolang er geen *aangenomen* besluit van het *juiste orgaan* onder ligt dat het bedrag ook echt dekt. Stemmen gaat per fractie met zetels — een demostad hoort geen ledenlijst te bevatten — en de meerderheid gaat over álle zetels, niet over de aanwezigen. Wordt er tegen een advies in besloten, dan staat dát in het besluit.
- **Inspraak en controle** (`inspraak.js`, `rekenkamer.js`): een raadpleging hangt aan een gebied en telt **twee keer** — iedereen, en alleen wie uit dat gebied komt; het verschil ertussen is zelf informatie. Eén reactie per codenaam, te wijzigen zolang hij loopt, en de toelichting van een ander is nooit zichtbaar. Het rekenkameronderzoek voegt geen enkel gegeven toe: het legt budget, uitgaven, effect, besluit en SLA naast elkaar en stelt de **vragen** die daaruit volgen — geen score, geen stoplicht. Het toetst het mandaat op wat een project werkelijk *kostte*, want een project dat onder de grens begon en er tijdens de rit overheen ging, kan de begroting per definitie niet tegenhouden.
- **Openbaar**: net als het algoritmeregister staat het **besluitenregister** op `/api/stad/besluiten` zonder inlog — wat een stad besluit, met welke stemverhouding en tegen welk advies in, is de kern van waarom een inwoner er iets over te zeggen heeft. Er staan geen personen in.
- **De Stadsdoos als product** (`kern/stad/apparaat.js`, `kalibratie.js`, `apparaatupdate.js`): een levensloop met vaste overgangen (geproduceerd → getest → geregistreerd → geïnstalleerd → gekalibreerd → actief → onderhoud → vervangen → gewist → afgevoerd) en een productpaspoort; *actief* kan pas als élke sensor gekalibreerd is, en *gewist* verwijdert de sleutel echt. **Sleutelrotatie met overlap** — de nieuwe sleutel wordt één keer getoond, de oude blijft een dag geldig, want zonder die overlap sluit je precies de dozen buiten die net offline waren. **Ondertekende updates**: het manifest draagt versie, hash en een HMAC met de eigen sleutel van het apparaat, plus altijd een terugvalversie. **Kalibratie** per sensor met een geldigheidstermijn, toegepast bij binnenkomst zodat er nooit een ruwe én een gecorrigeerde versie bestaat. En een **buffer**: een doos die dagen zonder netwerk zat mag zijn eigen tijdstempels meesturen (niet in de toekomst, niet ouder dan 30 dagen) — ze op "nu" stempelen zou van een storing een piek maken die er nooit was. Sabotage gaat naar de beveiligingslaag, niet naar de klussenlijst.
- **De stad mag niet dom worden als wij uitvallen** (`terugval.js`): per kritiek systeem de veilige terugvalstand, hoe een mens het ter plekke bedient, waar de papieren procedure ligt, en **wanneer dat voor het laatst écht is geoefend**. Een terugvalstand die nooit is geoefend heet hier een *aanname* en staat bovenaan de noodkaart; een mislukte oefening telt niet als geoefend. De noodkaart rekent niets uit en heeft geen ander deel van het systeem nodig — hij is bedoeld om af te drukken. Daarnaast liggen de **vertrouwenszones** vast (publiek, sensorinname, stadsregie, hulpdiensten, geld) met per zone wat er nooit bij mag; de scheiding zelf hoort in de infrastructuur, en een applicatie die beweert haar eigen netwerk te bewaken bewaakt niets.
- **Het sociaal domein, en waar het stopt** (`voorzieningen.js`, `sociaalgrenzen.js`): voorzieningen met capaciteit en wachttijd op de kaart, en vraagcijfers **per wijk per maand** — genoeg om beleid op te maken, te weinig om iemand mee te vinden. Er komt geen enkele persoon in: niet "we slaan het niet op", maar er is geen veld waar een persoon in past. Wat deze laag met opzet *niet* kan (wie zit er in de schuldhulp, geef deze inwoner een risicoscore, combineer stromen tot een profiel) staat als **lijst met redenen**, inclusief wat er eerst nodig zou zijn — een grondslag en een besluit dat buiten de code valt.
- **Privacy**: het weefsel kent objecten, plaatsen en codenamen — geen inwoners. Waarnemingen dragen een codenaam, een melder ziet alleen zijn eigen meldingen, en de vrije tekst gaat niet de AI-dataset in. De zaken en werkorders hebben een bewaartermijn (drie jaar, `server/bewaarbeleid.js`); het register zelf verloopt niet, want een lantaarnpaal verloopt niet.

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
- **Dataminimalisatie als poort, niet als belofte** (`server/kern/gegevenspoort.js`, `server/kern/gegevensgesprek.js`): een gratis RTG-account vraagt vier dingen — naam, geboortedatum, e-mail, wachtwoord. Wie alleen rondkijkt geeft nooit meer. Pas als er een **derde partij** bij komt (een zaak, een koerier, een professional) vraagt Rahul precies wat díé handeling nodig heeft, in een gesprek: een bestelling of reservering vraagt een telefoonnummer, een bezorging daarnaast een adres, en paspoort loopt via de bestaande identiteitscontrole (`/api/verify/upload`) — er komt met opzet geen tweede paspoort-intake naast. **De verplichte intake houdt zich sinds deze ronde aan diezelfde regel**: elk veld in `server/kern/onboarding.js` draagt een MOMENT, en alleen naam, e-mailadres en geboortedatum staan op `nu`. Telefoon, adres, postcode, woonplaats, land, nationaliteit en paspoort staan op `later` en komen niet meer in de poort na het inloggen; `status()` geeft ze apart terug als `laterVelden`, zodat een scherm ze kan tonen zonder een poort te zijn. Het paspoort houdt exact het gedrag dat het had: zodra de pas (Lifestyle, Business) of RTG Pay erom vraagt (`paspoortVerplicht()`) is zijn moment alsnog nu. De momenten reizen mee door de beheerlaag en er staat een migratie in `store()`, want de scope staat in de database — zonder die twee zou een bestaande installatie, of één beheerronde van de eigenaar, stilletjes weer alles vooraf vragen. **Nationaliteit wordt daarmee nergens meer gevraagd, en er komt met opzet ook geen poort voor**: in de hele vlucht- en grensstapel (`server/kern/luchthaven/`, `server/kern/marechaussee.js`) leest niets `md.nationaliteit` — wat hem wel vult is de identiteitscontrole bij goedkeuren. Een veld uitvragen dat niets leest is geen minimalisatie maar een extra drempel; komt die lezer er ooit, dan hoort hij in `kern/gegevenspoort.js` met een waarom dat je hardop kunt uitspreken. **En de woonplaats verdwijnt niet stil mee**: het ledenregister van het kantoor toont leden per stad uit `p.velden.woonplaats`, en de intake was daarvan de enige voeding. De adresstap van de poort schrijft hem daarom bij, met dezelfde functie waarmee de intake dat deed (`onboarding.slaOp`) en uit een letterlijk stuk van de zin die het lid zelf typte — is die plaats niet met zekerheid aan te wijzen, dan wordt er niet geraden maar gevraagd (`test/woonplaats-poort.test.js` meet dat door tot wat de boardroom te zien krijgt). Een route die nog iets mist antwoordt geen weigering maar **428** met `ontbreekt`, waarna de app het gesprek opent (`/api/gegevens/{nodig,start,zeg}`) en de handeling gewoon opnieuw doet. Het gesprek is een vaste stappenmachine en niet de vrije AI: wat hier gevraagd wordt gaat de kluis in en bepaalt of een bestelling doorgaat, dus dat moet elke keer hetzelfde gaan. De regel is streng in twee richtingen, en **keuringsregel 16** (`npm run check`) bewaakt beide: elk pad achter de leden-poort dat een derde partij noemt gaat langs de gegevenspoort — een nieuw pad (een koerier, een luchthavendienst) valt om zodra het er zonder staat, en wie een pad bewust uitzondert zet zijn reden erbij in `MAG_ZONDER`. De scan kijkt naar héél `server/routes`, niet alleen naar `routes/member`: vluchten boeken, een clubticket kopen en een verblijf boeken staan elders en gleden er allemaal langs toen de regel smaller was. **Rahul zelf komt er ook niet omheen**: hij doet zijn acties met dezelfde functies als de app-knoppen maar niet via de routes, dus de poort staat óók in `kern/fluister/acties.js` en `kern/fluister/bevestig.js` — zonder telefoonnummer reserveert hij niet. En hij stuurt u er niet voor weg: hij zít in een gesprek, dus hij vraagt het gewoon zelf (`kern/fluister/gegevens.js`), zet de handeling op de plank (`p.wachtGeg`) en doet hem alsnog zodra u antwoordt. Het gesprek dat hij daarvoor voert is letterlijk hetzelfde als in de app (`kern/gegevensgesprek.js`) — wat er gevraagd wordt, hoe het gecontroleerd wordt en waar het landt hoort niet af te hangen van het kanaal waarin u toevallig zit, dus "waarom?" en "laat maar" doen het daar precies zo.

  De andere helft is het scherm. Een 428 die nergens landt is erger dan een gewone fout: het lid leest "dat vraag ik even" en er wordt niets gevraagd. `public/shared/poortgesprek.js` maakt die belofte waar — Rahul stelt de vraag in beeld, "waarom?" krijgt een eerlijk antwoord zonder dat de vraag verdwijnt, stoppen kan altijd, en daarna gaat de oorspronkelijke handeling vanzelf door zonder dat je opnieuw hoeft te zoeken wat je aan het doen was. Het haakt in op de gedeelde `maakAPI` (`shared/appshell.js`), dus de hele leden-app is met één plek gedekt. **Keuringsregel 17** houdt dat vast: een pagina die bij een poortpad kan, laadt de module — en die poortpaden leest de keuring uit de routes zelf, niet uit een lijst die veroudert. `test/poortgesprek.e2e.js` speelt het na in een echte browser.
- **Adres opzoeken zonder iets weg te geven** (`server/kern/adresopzoek.js` + `server/kern/adresopzoek/vertaling.js`, `POST /api/adres/zoek`): postcode en huisnummer erin, straat, woonplaats en land eruit, zodat de ene plek waar nog een adres gevraagd mag worden — de adresstap van de gegevenspoort — twee dingen vraagt in plaats van vier. Er gaan **precies twee dingen** de deur uit en verder niets: geen naam, e-mailadres, lidnummer, codenaam of token. De uitgaande URL ontstaat op één plek (`bouwVraag()`) en `test/adresopzoek.test.js` leest hem letterlijk na, in de functie én in wat een nagebootste PDOK werkelijk binnenkreeg. **Het antwoord is een voorstel, geen opslag**: de route bewaart niets, want wat het lid niet op zijn scherm heeft zien staan hoort nergens te landen. De bron is de PDOK Locatieserver (open data van het Kadaster, gratis en zonder sleutel); die kent alleen Nederlandse adressen, dus een buitenlandse postcode krijgt een eerlijk "die ken ik niet" in plaats van een gok. **Falen is een antwoord en geen fout** — geen internet, een 500 of een onbekende postcode geeft `gevonden:false` met een reden — **maar het is geen stilte**: elke uitzondering en elk niet-200-antwoord gaat naar de fout-aggregatie van het techniekbord, inclusief het stille geval dat PDOK ooit een veldnaam hernoemt. Dat laatste is scherper dan het klinkt, want de free-ingang van PDOK is *fuzzy*: die gaf bij een echte proef op `9999ZZ 1` doodleuk "1 juli-weg 1G-01, Maastricht" terug. De opzoeker vergelijkt daarom de teruggegeven postcode én het huisnummer met wat er gevraagd is. Het antwoord draagt bovendien alleen de velden uit `NAAR_BUITEN` — een `uitCache`-vlaggetje zou lid B laten aftasten welke adressen lid A heeft opgezocht, en dat is in een huis op codenamen gedrag van een ander lid en geen kadasterdata. De route zit achter de leden-poort met een rem per **lid** (twintig per minuut, op de sessiesleutel en niet op het IP), en de kern heeft daarnaast een rem die aan de **bron** hangt (zestig vragen per minuut voor het hele proces), want wie tien accounts maakt koopt tien keer de eerste rem maar geen extra verkeer richting een gratis overheidsdienst. Uit te zetten met `RTG_ADRESOPZOEK=uit`; in de boardroom hangt hij onder *De gegevenspoort*, want daar hoort hij bij — niet onder Onboarding, die immers geen adres meer vraagt.
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

De app is een besturingssysteem (het "ROS"). Het beginscherm heeft vier lagen, van boven naar beneden, en verder niets. Geen begroeting bovenaan (die is aardig de eerste keer en behang de honderdste, en hij kostte precies de hoogte die de mappen nodig hebben), geen knopjes in de statusbalk, geen hamburger: alleen de regel die zegt welke pas je hebt en sinds wanneer, en dan:

1. **De mappen met apps** — zeven mappen in twee rijen: Reizen, Geld, De Salon, Het Huis / Media, Werk, Veilig. De tweede rij telt er drie en staat **gecentreerd** onder de eerste; in een raster van vier kolommen schuift zo'n restrij tegen de linkerkolom aan en lees je een halfvolle rij van vier in plaats van een rij van drie. Alles waar je pas je recht op geeft zit er al in; je hoeft niets te installeren. Een tik opent de map, een tik op een app opent hem schermvullend.

   Het waren er **vier**, en dat leek rustig tot je ze opendeed: De Salon droeg eenentwintig apps en Het Huis zeventien. Een map met eenentwintig tegels is geen map maar een lade waar je in graait.

   Toen werden het er **acht**, en dat was er één te veel — maar dat zag je alleen op de goede pas. De tegels tellen namelijk niet voor iedereen hetzelfde: veertien apps zijn Lifestyle/Business en vallen voor een RTG-pas vanzelf weg. Het Huis was gevuld met Maison, Table, Cellier, Garde-robe en De Rechterhand — alle vijf premium — dus een Business-lid zag daar acht tegels en een RTG-lid drie. Dezelfde map, half zo vol, precies op de instappas, en dat is exact wat de merkregel verbiedt. Nageteld over alle 62 items is er materiaal voor **zeven** mappen die op allebei de passen gevuld staan, en niet voor acht; de zorgkant zit daarom weer in Het Huis, waar zorg, gezin en rust ook horen.

   Gemeten per pas (RTG / Business): Reizen 8/10, Geld 7/10, De Salon 6/10, Het Huis 6/11, Media 8/8, Werk 7/7, Veilig 4/4. Een app staat in precies **één** map — twee plekken voor hetzelfde is precies waarom je hem nergens meer vindt.
2. **De ronde RTG-klok**, in het midden — hetzelfde horloge als op het inlogscherm (`shared/klok.js`, `data-rtg-klok="ring"`). Zijn vak pakt alle ruimte die de andere lagen overlaten en centreert hem daarin: evenveel lucht boven als onder, want een horloge zonder marge wordt een tegel. Hier heeft een bovengrens op gestaan om de klok omhoog te halen; die trok de balk van Rahul mee los van de onderrand en zette er een gat van 155 punten onder. Wil je een laag verschuiven, doe dat met een marge op die laag zelf — het klokvak krimpt dan mee en de onderrand blijft staan.
3. **De functierij**: Bellen, Berichten, Videobellen en je **Wallet**. Deze vier staan vast en kunnen niet uit.
4. **De balk van Rahul**, aan de onderrand — daar zoekt je duim hem. Het gesprek erboven staat er met een ruime marge vanaf, zodat het als gesprek en invoer leest en niet als één blok. Typ wat je wilt: is het iets dat het OS zelf kan ("open Reizen", "donker", "zoek villa", "hernoem Geld naar Bank"), dan gebeurt het meteen en blijf je thuis; al het andere gaat naar Rahul, wiens app opent met je vraag erin.

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

## RTG Communication Core: communicatie is infrastructuur, geen functie

**Wat er misging.** Dit huis had **zes berichtenvoorraden naast elkaar** — `db.data.memberChats` (vrienden), `applyChats` (sollicitaties), `guestChats` (gast en zaak), `collegaChats` (werkvloer), `podiumChat` en `rijkBerichten` (overheid) — en elke module die er een gesprek bij wilde, bouwde de zevende. Elk met een eigen berichtvorm, een eigen verstuurroute en een eigen leesstand; geen van alle met zoiets gewoons als een reactie, een antwoord-op of een correctie. De Berichten-app was daarbovenop een **leeslijst** die naar de bron-app doorverwees: hij kon tonen dát er iets was, en verder niets.

Dat is de fout die je maar één keer moet maken. Een chatfunctie per module betekent dat "verwijderen voor iedereen", "gelezen op dit apparaat" of "zoeken over alles" zes keer gebouwd en zes keer nét anders wordt — en dat de zevende module weer bij nul begint.

**De kern** (`server/kern/comm/`) is één gespreksmodel voor het hele platform. Elke module vraagt het daar aan in plaats van zelf iets te bouwen:

```js
kern.comm.gesprekMaak({ soort: 'ride', deelnemers: [chauffeur, reiziger],
                        titel: 'Rit RT-1941', meta: { sleutel: 'rit:RT-1941' } })
```

Taxi bouwt dus geen berichtenbackend. Horeca ook niet. School ook niet. `meta.sleutel` maakt het **idempotent**: een rit, een bestelling of een ticket vraagt bij elke stap opnieuw om "zijn" gesprek en krijgt er dan niet elke keer een nieuw — zonder dat zou de module zelf moeten onthouden welk gesprek bij welke rit hoort, en dan zit de koppeling weer in de module.

**Het soort is de context**, en dat is meer dan een etiket: het bepaalt in welke la van de inbox een gesprek valt. Twaalf, bewust een gesloten lijst (een vrij tekstveld was binnen een maand een verzameling spelfouten): `personal, group, business, order, ride, school, project, support, marketplace, government, event, ai`. De laden erboven zijn Mensen / Zaken / Onderweg / Officieel / Rahul — dat is de **Universal Inbox**: *Chats → Mobiliteit → Rit #RT-1941*, terwijl het technisch allemaal gesprekken blijven.

**Drie regels die worden afgedwongen, niet alleen beschreven:**

1. **Alles op codenaam.** De kern kent sleutels en codenamen, nooit echte namen; die staan in de gescheiden kluis en komen hier niet langs. Ook niet in een titel, ook niet in een zoekindex.
2. **Wie er niet in zit, leest niet mee.** Elke weg — lezen, sturen, reageren, wijzigen, wissen, lezen-melden, typen, porren, vlaggen, samenvatten — loopt langs dezelfde poort. Een gesprek-id raden is nooit genoeg. Getoetst met alle tien wegen apart, want een poort die op vier plekken moet staan, wordt op de vijfde vergeten.
3. **De AI stelt op, de mens verstuurt.** Er is geen enkele weg waarop een model zelf een bericht plaatst; `@Rahul` levert tekst terug en die belandt in het invoerveld. Dezelfde drempel als bij geld.

**De priveberichten zijn verhuisd.** `db.data.memberChats` was de grootste voorraad en stond als enige nog buiten de kern — en zolang dat zo was, was "communicatie is infrastructuur" een belofte en geen feit: de ene app kon die gesprekken alleen lézen. Ze wonen nu in de kern (`kern/comm/dm.js`), en de sociale laag, haar routes en de app schrijven allemaal in dezelfde. De controles blijven staan waar ze stonden — verbonden zijn, blokkade, de 9+-poort, de snelheidslimiet — want die gaan over vriendschap en veiligheid, niet over berichten.

De geschiedenis gaat mee, **per paar en eenmalig**, op het moment dat een gesprek toch al wordt geopend. Niet met een migratiescript over de hele database: dat moet je durven draaien op data die in gebruik is, en het valt om op het eerste rare bericht. Wat daarbij goed moest gaan en apart getoetst is (`test/comm-dm.test.js`): de berichten houden hun **eigen tijdstempels** (via de gewone verstuurweg zou een gesprek van twee jaar er ineens uitzien alsof het vanmiddag gebeurde — geen migratie maar een vervalsing), de **leesstand** verhuist mee (anders springt bij iedereen elk oud gesprek op ongelezen: een stapel rode bolletjes die niemand veroorzaakte), een gedeelde Salon-post overleeft als bijlage, en de import gebeurt **precies één keer**. De oude voorraad blijft staan: hij wordt niet meer gelezen en niet meer geschreven, maar data van mensen weggooien omdat de code er klaar mee is, is de handeling die je niet terug kunt draaien.

**Wat er verder al was, loopt mee — en is nu ook te beantwoorden.** De sollicitatie-chats, de Berichtenbox van MijnOverheid, het gastcontact met een zaak en het doorlopende gesprek met Rahul wonen nog in hun eigen module. `kern/comm/bronnen.js` **leest** ze en laat ze in dezelfde inbox meelopen.

Sinds deze ronde open je een sollicitatie- of zaakgesprek gewoon *in* de ene app en antwoord je daar ook. Niet doordat deze laag in een vreemde voorraad schrijft — dat zou de tweede schrijver zijn — maar doordat `/api/comm/gesprek` bij zo'n gesprek meegeeft **waar** een antwoord heen moet (`antwoord: { pad, vast, veld }`), en de app daar rechtstreeks naartoe post. De route van de module blijft de enige ingang op haar eigen voorraad, met al haar controles, vertaling en meldingen; er staat niets nagebouwd.

Hier stond eerst een doorgeefluik dat `app._router.handle()` aanriep om het verzoek intern door te sturen. Dat gaf een 500 — dit huis heeft zijn eigen router (`server/web/routing.js`), geen Express — maar het was ook zonder die fout de verkeerde vorm: een route die een andere route naspeelt is een tweede plek die moet weten hoe die eerste heet en wat hij verwacht. Officiële post en het Rahul-gesprek blijven doorverwijzen: het eerste is eenrichtingsverkeer, het tweede heeft zijn eigen scherm — en een invoerveld tonen bij iets waar je niet op kunt antwoorden is erger dan geen invoerveld. Vier voorraden tegelijk migreren terwijl hun modules er ook nog in schrijven, is vier keer de kans om berichten kwijt te raken in een ronde waarin niemand dat merkt tot iemand iets terugzoekt. Een bron **schrijft** daarom nooit — dat zou de tweede schrijver op één voorraad zijn, precies de splitsing die we opheffen. Elke bron die later wél overgaat, verdwijnt gewoon uit dat bestand.

**Eén app** (`public/apps/comm.html`). Op het beginscherm stonden er vier — Berichten, Bellen, Videobellen en Snaps — plus Meet als vijfde, voor iets dat een mens als *één* ding ziet: contact met iemand. Nu: links de inbox met zijn laden, rechts het gesprek, en bellen en videobellen zijn twee knoppen in de kop van het gesprek waar je toch al bent (de verbinding zelf loopt over de bestaande WebRTC-laag; een tweede belimplementatie zou een tweede plek zijn waar het misgaat). `/apps/berichten.html` blijft bestaan als pad en leidt erheen.

Wat de app kan: threads met antwoord-op en citaat, reacties, wijzigen binnen een kwartier (met de oorspronkelijke tekst bewaard — "bewerkt" zonder te kunnen zien wat er stond is een uitnodiging om een gesprek achteraf te herschrijven), intrekken dat een spoor achterlaat (de ander heeft het gelezen; doen alsof er nooit iets stond is liegen tegen wie erbij was), ongelezen-tellers, leesbevestiging, `typt…`, aanwezigheid, zoeken over álle gesprekken tegelijk, vastzetten/stilzetten/archiveren, een concept dat meereist tussen apparaten, en de **por** — de buzz van MSN, die door "stil" heen mag omdat dat zijn hele bestaansreden is, en precies daarom begrensd is tot één per minuut per gesprek. Een aandachtsknop zonder rem is een pestknop.

API: `/api/comm/{inbox,gesprek,begin,stuur,wijzig,wis,reactie,lees,vlag,concept,typt,por,zoek,ai}`; de oude `/api/member/dm{,/send}` blijven bestaan en schrijven in dezelfde kern. Getoetst in `test/comm.e2e.js`, `test/comm-dm.test.js` en `test/berichten.e2e.js`.

**Bewaartermijn en wisrecht.** Twee gaten die de verhuizing zelf maakte, en die allebei groen waren:

- Het **bewaarbeleid** wees naar `memberChats` — de tak die leeg achterbleef. De nieuwe takken hadden er geen, dus persoonlijke berichten werden vanaf dat moment voor altijd bewaard. `commGesprekken` en `commBerichten` staan nu in `server/bewaarbeleid.js` met dezelfde twee jaar als daarvoor (een termijn die bij een verhuizing stilletjes ruimer wordt, is hoe "we bewaren niet eindeloos" een dode letter wordt), en `memberChats` blijft als bevroren archief zijn termijn houden — juist omdat er niets meer bij komt.
- Het **wisrecht** kende de nieuwe takken niet: een lid dat om vergetelheid vroeg, verdween uit zijn account en bleef in zijn gesprekken. `kern/vergeten/gesprekken.js` doet dat nu, met dezelfde lezing van art. 17 als bij de eigen Salon-posts: wat dít lid schreef gaat weg, en blijft er niemand over dan gaat het hele gesprek weg — maar de kant van de ander blijft staan, want dat is zijn inhoud.

Allebei waren ze onzichtbaar, en om dezelfde reden: de bezem in `test/vergeten.test.js` loopt na het verwijderen door de hele database, maar de wandeling ervóór maakt geen gesprek (daar heb je een tweede, verbonden lid voor nodig) — en een tak die nooit is aangeraakt kan een bezem niet vinden. **De dekking van een bezem is de dekking van de wandeling ervoor.** Daarom zijn er nu twee toetsen die de takken écht aanmaken met de kern zelf: `test/bewaartermijnen.test.js` eist dat elke tak die de kern maakt een termijn heeft (met de tak-lijst uit de kern gehaald en niet met de hand overgeschreven), en `test/comm-vergeten.test.js` roept dezelfde functie aan die `wisLid()` aanroept.

**Wat er nog niet in zit** — zodat niemand het hier gaat zoeken: end-to-end encryptie, tenants/RBAC, SSO/SCIM, legal hold, eDiscovery, DLP en de publieke API voor externe ontwikkelaars. Het model is erop gebouwd (elk bericht hoort bij een gesprek met een soort en een `meta`), maar ze staan er niet. Een half aangezette compliance-laag is gevaarlijker dan een afwezige. Hetzelfde geldt voor groepsbellen met breakout rooms en opname: dat blijft voorlopig RTG Meet.

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
