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
    ├── command.html       RTG Command: het RTG- en RTF-kantoor als één app
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

### Starten met de Rust-motor en onafhankelijke Sentinel

De native motor gebruikt alleen Rust `std` (geen Cargo-crates) en bedient de
zware/security-kritische paden: Pay, Bank, ledengids, uploadscan, identiteitskluis
met de eigen XChaCha20-Poly1305, en de markt- en macroberekening van Magnaat.

```bash
npm run motor:test
npm run start:rust
```

`start:rust` bouwt beide release-binaries zo nodig, maakt een gepind
codebewijs en zet de onafhankelijke Rust Sentinel vóór de Node-poort. De app is
daardoor niet rechtstreeks publiek bereikbaar en kan ook bij een defect of
mogelijke besmetting buiten Node om worden geïsoleerd. Bedieningscommando's en
het incidentdraaiboek staan in `docs/sentinel.md`.

De start zet ook Magnaat op Rust. Browserweergave en DOM-interactie blijven JavaScript; de
zware serverberekeningen lopen native. Pay en Bank blijven standaard als
gecontroleerde Rust-schaduw draaien. Na een groene geïsoleerde
`node scripts/motor-cutover.js` kan `RTG_MOTOR_GELD=motor` de Rust-motor voor
beide grootboeken autoritatief maken. Bij een onbereikbare Magnaat-rekenmotor
wordt de gehele halve dag teruggedraaid en rekent de bewezen JS-motor hem alsnog.
Na drie opeenvolgende motorfouten opent bovendien een stroomonderbreker: nieuwe
dagen vallen dan meteen terug in plaats van telkens op een time-out te wachten.
Na de afkoelperiode mag precies één herstelproef door. Gelijktijdigheid en de
antwoordgrootte zijn eveneens hard begrensd; alle grenzen staan in `.env.example`.
Dezelfde binary inventariseert bij `start:rust` ook de duizenden statische
API-routes en app-titels voor de Capability Graph. Die CLI voert geen projectcode
uit, schrijft niets en valt bij iedere fout automatisch terug op de JS-scanner.

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

### Lokale intelligentie (optioneel, lokaal eerst)

RTG heeft voor zijn kern geen model nodig. Schermen, workflows, rechten,
berekeningen, zoeken, sorteren, agenda-herkenning, vaste cataloguskeuzes en
extractieve samenvattingen draaien in gewone lokale code. Alleen vrije taal,
creatieve tekst, open vragen en beeldduiding gebruiken een model.

Voor die resterende taken kan een OpenAI-compatibele modelserver volledig op
het eigen apparaat draaien:

```bash
LOCAL_AI_URL=http://127.0.0.1:11434 \
LOCAL_AI_MODEL=<eigen-modelnaam> \
RTG_EXTERNE_AI_UIT=1 \
npm start
```

Voor een vaste lokale installatie mogen dezelfde regels in de door git
genegeerde `.env.local` staan. `npm start` en `npm run ai:lokaal:check` lezen
dat bestand letterlijk in; bestaande omgevingsvariabelen houden voorrang.

Controleer de verbinding en capabilities met `npm run ai:lokaal:check`. Een
loopback-adres is standaard verplicht; een eigen modelserver elders op het LAN
vereist de bewuste opt-in `LOCAL_AI_LAN_TOESTAAN=1`. Tekst, tool-calling en
beeld kunnen elk een apart lokaal model krijgen via `LOCAL_AI_MODEL_KORT`,
`LOCAL_AI_MODEL_TOOLS` en `LOCAL_AI_MODEL_VISION`. Zonder vision-model wordt
beeld nooit stil verwijderd of aan een tekstmodel voorgelegd.

Zonder model start RTG in **handmatige werkmodus**. Alle schermen, navigatie,
controles en regelgestuurde opdrachten blijven werken; alleen vrije
modelverrijking valt weg. Met `RTG_AI_UIT=1` is ook in productie aantoonbaar
alles uit. Zie [`docs/lokale-intelligentie.md`](docs/lokale-intelligentie.md)
voor de volledige grens per taak.

Met key krijgt Rahul bovendien **het AI-stuur** (`server/kern/stuur.js`): in de
drie assistenten (leden-app, partner-app, personeels-PDA) voert hij vrije
opdrachten echt uit, via interne aanroepen op de gewone API met de inlog van
de gebruiker zelf. Hij kan dus alles wat de gebruiker via de knoppen kan en
nooit meer: dezelfde auth, dezelfde functie-schakelkast, dezelfde limieten.
Accounts, het techniekbord en de zaakdoos zijn verboden terrein, en elke
geld-actie vraagt eerst een expliciete bevestiging. De losse endpoints
(`/api/member/doe`, `/api/supplier/doe`, `/api/staff/doe` + `/kaart`) werken
ook zonder key en de boardroom kan de functie `stuur` per doelgroep sluiten.

Elke modelaanroep loopt via **`server/ai.js`**: één `messages.create` met een
uitwijkketen erachter (lokaal, dan pas expliciet ingestelde externe aanbieders;
volgorde met `AI_VOLGORDE`). `RTG_EXTERNE_AI_UIT=1` sluit externe verwerking
hard af. Met lokaal én extern heet de zichtbare stand **hybride**; “privé op dit
apparaat” verschijnt alleen wanneer er geen externe modelroute bestaat. Voor korte classificaties
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

### Elkaar toevoegen met een pin (en een QR)

Zoeken op codenaam werkt, maar het vraagt dat je iets van de ander *al* weet.
De **contactpin** draait dat om, zoals de BlackBerry-pin dat deed: acht tekens
die op je eigen scherm staan, en pas als jij ze afgeeft -- voorgelezen, gedeeld
of als QR voorgehouden -- kan iemand er iets mee. Er valt niet mee te bladeren.

Twee dingen maken hem anders dan een naam:

- **Hij is een adres, geen geheim.** Dat is het verschil met de *andere* pin in
  dit huis (`server/kern/algpin.js`), die apps op het toestel opent: die staat
  met scrypt gehasht in de kluis en komt nooit in een antwoord terug. De
  contactpin staat leesbaar in de database en gaat leesbaar over de lijn --
  precies zoals een telefoonnummer op een kaartje. Wie de twee door elkaar
  haalt, bouwt of een adres dat niemand kan voorlezen, of een geheim dat op
  ieders scherm staat.
- **Hij is niet af te lopen.** Acht tekens uit Crockford base32 (geen I, L, O of
  U, want een pin wordt voorgelezen) geven 32⁸ ≈ 1,1 biljoen mogelijkheden, en
  elke poging kost een tik uit dezelfde snelheidsteller die de rest van de
  sociale laag remt: dertig per uur per lid.

**Kijken en versturen staan met opzet uit elkaar.** `/pin/zoek` zegt alleen wie
er achter de pin zit; pas `/pin/connect` stuurt het verzoek. Een gescande QR die
meteen een verzoek de deur uit doet, is een verzoek dat niemand bewust deed --
LIFE.md: samenstellen en klaarzetten, bevestigen doet de mens.

**Twee remmen, want de eerste alleen is te weinig.** De ene telt per *vrager*
(dertig pogingen per uur). Die remt de ongeduldige, maar wie de pin van niemand
in het bijzonder zoekt, koopt gewoon een tweede account -- exact de fout die
`server/pinslot.js` beschrijft. Bij een contactpin is er geen doel om de teller
aan te hangen (de aanvaller noemt er juist geen), dus hangt de tweede aan de
**deur**: een huisbreed budget aan *missers* per minuut, gedeeld door elke ingang
die een pin opzoekt. Alleen missers tellen, en dat maakt hem bruikbaar: wie een
pin overtypt die hij net kreeg, mist vrijwel nooit; wie raadt, mist bijna altijd.
De prijs staat erbij in `kern/sociaal/pin-deur.js` -- een huisbrede teller is ook
een huisbrede knop.

**De levende code: de QR die verloopt.** Een vaste pin is voor eeuwig, en dat is
precies het probleem dat de BlackBerry-pin altijd heeft gehad. Voor het geval
waarin een pin het vaakst wordt afgegeven -- twee mensen tegenover elkaar --
is een blijvend adres helemaal niet nodig. `/pin/live` levert een verse,
ondertekende code die na een minuut niets meer is, **je pin niet draagt en je
sleutel ook niet** (er zit een willekeurige verwijzing in die alleen deze server
kan omzetten), en die maar één keer opgaat. Ondertekend door `kern/dyncode.js`,
dus zelf een geldige code maken kan niet. Wie de QR fotografeert houdt een string
over die naar niets meer wijst.

**De pin uitzetten.** Vernieuwen helpt tegen een pin die is rondgegaan; `/pin/uit`
is het andere verzoek -- ik wil helemaal niet zo gevonden worden. Uit betekent:
dezelfde stilte als een pin die niet bestaat. De *levende* code blijft dan wel
werken, en dat is geen gat maar het onderscheid waar de schakelaar over gaat: een
pin die je hebt afgegeven werkt passief door, ook als je niet meer weet aan wie;
een code die je op dit moment ophoudt is een handeling.

**En je merkt dat je pin rondgaat.** Een verzoek draagt zijn herkomst mee: "via
je pin", "via je live code", of niets (het gewone zoeken op codenaam). Zonder dat
verschil merk je nooit dat de pin die je ooit in een groepsapp zette nog steeds
gebruikt wordt -- en dat is precies het moment om hem te vernieuwen.

De QR draagt precies dezelfde pin (`rtg:pin:<pin>`, zie
`public/shared/rtgcode.js`) en wordt getekend met de eigen QR-codec in
`public/shared/qr.js`; scannen gebeurt op het toestel zelf
(`public/shared/scanner.js`), er gaat geen beeld de deur uit. Geen extern
pakket, geen vreemde server -- de CSP laat dat ook niet toe.

**De kinderbescherming blijft onaangeroerd.** Een beschermd profiel (15 of
jonger) is via zijn pin net zo onvindbaar als via zijn codenaam: een pin die
niet bestaat, een pin van een beschermd kind en een pin van iemand die jou
blokkeerde geven alle drie *hetzelfde* antwoord, want juist het verschil in de
melding zou de manier zijn om vast te stellen dat een kind bestaat. De ouder
krijgt de pin van zijn kind wél te zien (in `/api/rtf/social/connections`) en
kan er via `/oudervoeg` een vriend mee toevoegen -- waarna de ouder van het
andere kind nog steeds akkoord moet geven.

**En de opzoeking is geen doorloop meer.** De index van pin naar lid is met opzet
geen tweede waarheid maar een *hint*: elke treffer wordt tegen de echte rij
nagekeken voordat hij telt, en de index wordt opnieuw opgebouwd zodra de
opslaglaag `db.data` vervangt of het aantal rijen verandert. Dat is niet
theoretisch -- `kern/vergeten/eigen.js` wist een lid rechtstreeks uit die tak, en
een index die zichzelf gelooft wijst dat lid daarna nog gewoon aan.

Bewezen door `test/contactpin.test.js` (drieëntwintig toetsen: vorm, uniekheid,
de voorleeslezing van O/I/L/U, het intrekken van een oude pin, de vier gelijke
antwoorden, beide remmen, de index tegen een wissing en tegen een vervangen
`db.data`, de levende code die geen blijvend gegeven draagt en maar één keer
opgaat, en de ouderkant) en `test/contactpin.e2e.js` (het scherm in een echte
browser). Mutaties uit LAT.md-regel 2 per verbetering, en twee toetsen zijn
onderweg herschreven omdat ze **niet konden zakken** -- de botsingscontrole in
`verzinPin` treedt op bij 1 op 1,1 biljoen, dus die botsing wordt nu met een
gestuurde toevalsbron afgedwongen.

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

### Het RTF Living Lab: spelenderwijs, maar niet vrijblijvend

`server/kern/livinglab/` + `server/routes/livinglab/` + `/apps/livinglab.html`
(kantoor) en `/apps/labpas.html` (bewoner). Het onderzoeksplatform van de
stichting, per stad in te zetten: buurtbewoners, onderzoekers, studenten,
organisaties en gemeenten onderzoeken er samen echte problemen.

De stelling in één zin: **de voorkant mag speels zijn, de achterkant is een
onderzoeksinstituut.** Wat dat concreet betekent:

- **Eén cyclus van tien stappen** voor elk onderzoek: vraagstuk → hypothese →
  plan → deelnemers → experiment → observaties → reflectie → resultaten →
  besluit → vervolg. Nooit een stap overslaan, en nooit terug -- wie halverwege
  iets anders ontdekt, zet dat in de reflectie; een echt nieuw plan is een
  nieuwe studie. Elke stap heeft een poort die **alle** openstaande gebreken
  teruggeeft, niet alleen het eerste (`kern/livinglab/cyclus.js`).
- **Twaalf projectsoorten**, van sensoren tot sociale cohesie. "Vermindert een
  buurttuin eenzaamheid?" draait op dezelfde motor als "welke sensor meet
  wateroverlast het beste?". Wat verschilt is het GEWICHT, niet de kwaliteit van
  de ondersteuning: bij een menselijk onderwerp weegt het professionele oordeel
  zwaarder, ligt de bewijslat hoger en blijft de data gescheiden. Dat verschil
  staat als DATA in `kader.js` en niet als apart codepad -- anders krijgt de
  sociale kant vanzelf de tweederangs versie.
- **De bewijsmotor** (`bewijs.js` + `graden.js`) voorkomt dat een mooi verhaal
  een feit wordt. Een conclusie draagt bronnen, datasets, observaties,
  interviews, experimenten en statistiek, en de graad (aanname → waarneming →
  indicatie → sterk bewijs → bewezen binnen deze studie) is geen keuze maar een
  uitkomst van drie plafonds: wat eronder ligt, wat de methode kan dragen, en
  wie tekent. Bewijs weghalen laat een conclusie zakken; bewijs toevoegen mag
  hem nooit verlagen (die regressie zat er, en `test/livinglab.test.js` bewaakt
  hem).
- **Ethiek als poort, niet als vinkje** (`ethiek.js` + `waarborg.js`). Vier
  risicoklassen bepalen wat er af moet zijn vóór er één deelnemer bij mag:
  review met één of twee handtekeningen (waarvan één onafhankelijk),
  privacytoets, toestemmingsregime, ouderlijke toestemming, stopcriteria. De AI
  kan die grenzen niet omzeilen -- niet omdat het in zijn prompt staat, maar
  omdat de poort in code staat.
- **Gescheiden onderzoeksdata.** Bij klasse hoog en hoger wordt de koppeling
  alias → Foundation-sleutel **nergens** vastgelegd; de deelnemer houdt zijn
  labpas en dat is de enige handle. Aliassen zijn bovendien per studie, dus twee
  dossiers zijn niet naast elkaar te leggen. De prijs staat er eerlijk bij: het
  lab kan zo'n deelnemer niet terugvinden vanuit zijn profiel. Dat is de
  bedoeling.
- **Bewoners als medeonderzoeker.** Ze dragen vragen aan en stemmen erop
  (`themas.js`), doen mee in zeven rollen, sturen observaties in en trekken zich
  terug -- alles op een **labpas en zonder account**. De alias komt altijd uit
  die pas en nooit uit het lijf van het verzoek.
- **Gamification op kwaliteit** (`spel.js`). Geen punt per observatie en geen
  ranglijst op volume; wél punten voor een bron natrekken, iemand echt spreken,
  een fout vastleggen en -- het zwaarst -- een eerdere conclusie herzien of een
  onderzoek stoppen omdat het bewijs tegenviel.
- **Van onderzoek naar verandering** (`doorbraak.js`): zeven uitgangen (pilot,
  werkorder, subsidie, beleid, startup, onderwijs, nieuw onderzoek), elk met een
  bewijs-ondergrens. Een beleidsvoorstel vraagt minstens een indicatie; nieuw
  onderzoek mag juist uit een aanname komen. Een pilot gaat door naar het
  bestaande **RTG Onderzoekslab** (`kern/onderzoekslab.js`) en wordt daar één
  project -- er komt geen tweede projectenlijst bij.
- **Meerdere labs onder één RTF** (`bestuur.js`): Haarlem werkt anders dan
  Nairobi, maar de cyclus, de bewijsgraden en de risicoklassen zijn centraal en
  lokaal niet te verlagen. De bewaartermijn mag lokaal omhoog, nooit onder de
  RTF-ondergrens.
- **Impact die ook de tegenvallers telt** (`impact.js`): gestopte studies staan
  bij de opbrengst en niet bij de uitval, met het stoppercentage als eigen
  getal. Een lab dat nooit iets stopt, onderzoekt niets.

De schermen halen hun cyclus, methoden en bewijsgraden op bij
`/api/lab2/kader` en bouwen niets van dat alles zelf na, zodat er geen stap in
beeld kan staan die de server weigert.

**Het dossier wordt door zeven modules samen opgebouwd** (`livinglab-vormen`,
`-ethiek`, `-mensen`, `-bewijs`, `-uitgang`, `-werkplaats`, `-apparatuur`), elk
met een blok dat bij de HUIDIGE stap hoort. Ze delen één `doe()`-helper, zodat
er één manier is waarop een handeling het blad sluit, herlaadt en heropent.
Omdat ze samen in één document staan, mag geen enkel `data-`attribuut door twee
van hen worden getekend -- `test/livinglab.test.js` scant daarop, want die
botsing heeft hier twee keer een knop aan de verkeerde bedrading gehangen.

**Wat de app NIET doet, en waarom dat een keuze is.** Zonder tekenbevoegde in
het labregister kan er niets ondertekend worden: geen risicoklasse, geen review,
geen bewijsgraad boven een indicatie. Dat is de bedoeling, en daarom zegt het
beheerscherm dat het de eerste stap is in plaats van een leeg keuzemenu te tonen.
Wie dat overslaat, loopt bij de deelnemersstap tegen vijf openstaande waarborgen
aan -- met bij elk de knop die hem oplost.

**Elk van de 77 endpoints is vanuit een scherm te bereiken.** Dat is geen
streefgetal maar een gemeten eigenschap: de eerste versie had er 29, en de app
liep daardoor dood bij stap vier van de tien. De kantoorkant verdeelt het werk
over dertien modules (`livinglab-kern`, `-beeld`, `-vormen`, `-studie`,
`-ethiek`, `-mensen`, `-bewijs`, `-uitgang`, `-werkplaats`, `-apparatuur`,
`-beheer`, `-toezicht`, `-coach`), de bewonerskant over drie (`labpas`,
`-buurt`, `-ontdek`).

**De startdata** (`server/seed/livinglab.js`) zet in de DEMOSTAND één lab in
Haarlem neer met zijn tekenbevoegden, wat apparatuur en drie vragen uit de
buurt -- de steiger die een leeg lab onbruikbaar maakt. Er staat met opzet geen
enkel verzonnen onderzoeksresultaat in: geen conclusies, geen bewijsgraden, geen
deelnemers. Een lab dat opstart met nepbevindingen leert zijn gebruikers precies
het omgekeerde van wat de bewijsmotor afdwingt. In productie start het Living Lab
leeg. Eén sensor is bewust nooit gekalibreerd: die weigert een reservering en
legt uit waarom.

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
- de btw-aangifte van een zaak (`test/btw-aangifte.test.js`): de periodevakken,
  de telling over het factuurregister, de twee controles die weigeren, de
  correctie na indienen en de poorten van de endpoints — plus een schermtoets
  (`test/btw-scherm.e2e.js`) die de kaart in een echte browser laat rekenen;
- het btw-toezicht van het Belastingkantoor (`test/btw-toezicht.test.js`): de
  vier standen van de aansluiting, dat inspecteur en aangever op de cent
  hetzelfde tellen, en dat er over een lopende periode géén signalen komen —
  met een schermtoets (`test/btw-aansluiting-scherm.e2e.js`) die hetzelfde
  bedrag aan beide kanten van de tafel op het scherm zet;
- de naheffingsaanslag (`test/btw-naheffing.test.js`): dat het bedrag uit de
  aansluiting komt en niet uit het verzoek, dat dezelfde ogen niet dubbel
  tellen bij vaststellen én bij het bezwaar erop, dat een boete niet zonder
  grond bestaat, en dat een concept nog geen besluit is — plus de hele keten
  over de échte routes met drie echte ambtenaren
  (`test/btw-naheffing-keten.test.js`, inclusief de poging om de vier ogen te
  omzeilen door een collega's naam mee te sturen) en het scherm van de zaak
  waar het bezwaar en de betaling vandaan gaan
  (`test/btw-naheffing-scherm.e2e.js`);
- het betalen zelf: dat er eerst wordt geboekt en pas daarna op betaald gezet,
  dat een mislukte boeking niets achterlaat, en dat een toegewezen bezwaar op
  een betaalde naheffing terugstort — met een nepbank die op commando weigert,
  want met de echte bank zou alleen de gelukkige helft getoetst worden;
- de invordering: dat elke stap op de termijn van de vorige wacht (verzetbare
  klok), dat beslag andere ogen vraagt en nooit meer pakt dan de schuld, dat een
  deelbeslag de rest laat staan, en dat de regeling en de stopknop de keten
  echt tegenhouden;
- dat elke betaalde lidtransactie ook echt een factuur oplevert
  (`test/lidfactuur.test.js`): zes betaalwegen — in de app, de gezamenlijke
  rekening, een boeking, een rit, de balie op de ophaalcode en het tafelticket
  — elk precies één factuur op de ref van de bon, nooit twee voor dezelfde bon,
  en als sluitstuk dat de btw-aangifte op de cent uitkomt op de omzet die de
  maandboekhouding van diezelfde zaak telt, over twee tarieven tegelijk. Plus
  dat een factuur die niet lukt de betaling niet omvertrekt maar wél op het
  techniekbord komt;
- dat de kwijtschelding van een aanslag door twee inspecteurs gaat
  (`test/belastingkantoor.test.js` en `test/kwijtschelding-scherm.e2e.js`):
  voordragen met een grond, beslissen door een ander, en de inwoner hoort er
  pas van als er écht is besloten;
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

### De systeemwetten (`npm run wetten`, `npm run sabotage`, `npm run zekerheid`)

De toetsen en keuringen hierboven vragen allemaal hetzelfde: *zakt er iets?*
`scripts/samenhang.js` draait die vraag om naar *kijkt er iemand?* Er bleef er
een over, en dat is de duurste:

```bash
npm run wetten        # 41 systeemwetten met hun bewijsstand
npm run sabotage      # zet elke handhaver echt uit, kijk wie rood wordt
npm run zekerheid     # wat we weten, en vooral wat we niet weten
```

`WETTEN.json` verzamelt de uitspraken die in de doctrine-documenten als HARD
staan opgeschreven -- "de progressielaag stopt bij 18+", "de bijdrage-spiegel is
nooit vergelijkend", "een grendel hangt aan het doel", "er komt geen derde
rechtenmodel bij". Per wet staan er drie dingen: de **bron** (het document en de
letterlijke zin, zodat de wet hier niet kan gaan afwijken van waar hij vandaan
komt), de **handhaver** (de bestanden die hem tegenhouden, die moeten bestaan) en
een **sabotage**: een mechanische verandering die de wet écht overtreedt, met de
wachter die daarvan rood hoort te worden.

`npm run sabotage` voert die uit -- in de echte bestanden, met een journaal in
`server/data/` zodat een afgebroken ronde met `--opruimen` terug te draaien is.
Vijf uitkomsten, want twee is te weinig: **raak** (de wachter werd rood: het enige
bewijs dat telt), **afgeslagen** (de wet is overtreden en er werd niets rood --
een bevinding, geen storing), **blind** (de wachter was al rood en bewijst dus
niets), **losgeraakt** (het recept wijst nergens meer naar) en
**nietGeprobeerd**. Wetten waarvoor geen machinale proef te bedenken is, staan
als `mensenwerk` in het register mét de reden, en tellen nooit als bewezen.

De meter `wettenOnbewezen` in `NORM.json` telt wat er niet bewezen is en mag
alleen omlaag; `test/meterijk.test.js` ijkt hem (keuringsregel 35), en
`test/wetten.test.js` ijkt de motor zelf -- onder andere dat een wachter die al
rood was nooit als bewijs meetelt.

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
| `POST /api/member/pin` | Je eigen contactpin (wordt bij de eerste vraag gemaakt) |
| `POST /api/member/pin/nieuw` | Een nieuwe pin; de oude wijst daarna niemand meer aan |
| `POST /api/member/pin/zoek` `{pin}` | Wie zit er achter deze pin? (kijken, nog niets versturen) |
| `POST /api/member/pin/connect` `{pin}` | En dan pas: het vriendschapsverzoek versturen |
| `POST /api/member/pin/uit` `{uit}` | De vaste pin uit- of weer aanzetten |
| `POST /api/member/pin/live` | Een levende code: ondertekend, één minuut houdbaar, eenmalig |
| `POST /api/member/pin/live/kijk` `{token}` | Wie zit er achter deze gescande code? (code gaat nog niet op) |
| `POST /api/member/pin/live/verbind` `{token}` | Versturen; nu is de code op |
| `POST /api/ai` `{messages}` | Persoonlijke AI (Claude indien key aanwezig, anders demo) |
| `POST /api/logout` | Sessie beëindigen |
| `POST /api/partner` `{code}` | Partnercode valideren (demo-codes: `NOVA`, `ATLAS`) |
| `POST /api/staff` `{staffCode}` | Personeelscode van een partnerbedrijf valideren |
| `POST /api/partnertrips` `{staffCode?}` | Gecureerde reizen, alleen totaalprijzen; met geldige personeelscode ook personeelsprijzen |
| `POST /api/book` `{code \| staffCode, tripId, name, email}` | Boeking zonder pas via een partner of personeelscode |
| `POST /api/cv/get` / `POST /api/cv/save` | Het RTG-cv van het lid (de cv-builder in de leden-app) |
| `POST /api/member/apply` `{supplierCode, func}` | Solliciteren bij een partner; kan pas met een afgerond cv |
| `POST /api/supplier/apply` `{code, name, func, contact}` | Open sollicitatie via het startscherm van een partner-app |

### Waar de omzet vandaan komt, en tegen welk tarief

Twee dingen zaten hier los van elkaar terwijl ze over dezelfde transactie gaan,
en allebei zijn ze rechtgezet.

**1. Elke betaalde lidtransactie boekt nu een factuur** (`kern/lidacties/factuur.js`).
De kassa, de retail, de verhuur en het vastgoed deden dat al; de transacties van
het lid — een bestelling, de gezamenlijke rekening, een boeking, een rit — niet,
en de twee kassawegen waarlangs zo'n bestelling alsnog wordt afgerekend (de
ophaalcode aan de balie en het tafelticket) evenmin. Dat viel niemand op tot de
btw-aangifte kwam: die telt het **factuurregister**, dus omzet zonder factuur
stond er niet in, terwijl de maandboekhouding van diezelfde zaak hem wel telde.
Er staat nu één routine die weet hoe een lidtransactie een factuur wordt, en de
zes wegen roepen die aan — precies één keer, op het moment dat er écht is
betaald. Een factuur die niet lukt draait de betaling nooit terug, maar valt ook
niet stil: hij gaat naar de fout-aggregatie en dus naar het techniekbord.

**2. Het btw-tarief stond op twee plekken en die twee waren het oneens**
(`kern/fiscaal/tarief.js`). De maandboekhouding zocht een percentage op in de
landentabel van de zaak; de facturatiemotor had `restaurant/bar/hotel/
groothandel/boerderij → 9%, de rest → 21%` in zijn kop staan, zonder ooit naar
het land te kijken. Voor een Nederlandse zaak viel dat samen. Voor Sal de Mar op
Ibiza (land `ES`) niet: de boekhouding rekende 10%, de bon van de gast zei 9%.
En het was niet bij te houden — de landentabel is levend, want de Regelwacht
legt er een overlay overheen zodra een tarief verandert, en twee vaste getallen
elders lopen daar per definitie op achter.

Beide kanten vragen het nu aan dezelfde routine, dus ze **kunnen** niet meer
uiteenlopen. Twee gevolgen die het waard zijn om te noemen:

- de bon van de gast draagt per regel het juiste tarief, dus een glas wijn in
  een restaurant staat op het standaardtarief en niet op het lage;
- **een zaak zonder kaart, kamers of ritten valt nu onder `standaard` in plaats
  van `eten`.** De boekhouding zette elke zaak zonder kamers of ritten op
  `eten`, dus een kledingwinkel rekende het verlaagde tarief over een jas. Dat
  cijfer verandert daardoor, en dat is de bedoeling.

### De btw-aangifte van een zaak (`kern/fiscaal/btwaangifte.js`)

Gebouwd naar het model van de loonaangifte (`kern/payroll/aangifte.js`), en om
dezelfde reden: **één bron, geen tweede motor.** De aangifte komt uit het
factuurregister en niets anders. Elke factuurregel draagt zijn eigen tarief
sinds de facturatiemotor hem boekte, en dat tarief is wat de klant op zijn bon
zag; er wordt hier geen btw opnieuw uitgerekend. Het tellen staat in
`kern/fiscaal/btwtelling.js`, dat ook als enige plek weet wat `2026K3` betekent.

Twee controles die weigeren in plaats van waarschuwen:

1. de btw uit de regels moet exact de btw op de facturen zelf zijn (twee wegen
   door hetzelfde register: regel versus factuurkop);
2. bij indienen wordt opnieuw geteld — zijn er sinds het opmaken facturen
   bijgekomen, dan weigert hij, want indienen op verouderde cijfers is een
   verkeerde aangifte met een handtekening eronder.

Verder: opmaken mag altijd, **indienen pas als de periode voorbij is**; een
ingediende aangifte verandert niet meer maar krijgt een correctie bovenop, met
verwijzing en verschil; en `dienIn` legt alleen vast DAT er is ingediend, door
wie en met welk kenmerk. RTG verzendt niets — dat is dezelfde afspraak als in
het btw-draaiboek (`kern/automatisering.js`): de zaak dient zelf in.

Anders dan bij de loonaangifte, waar het RTG-kantoor indient en de werkgever
meeleest, doet de ondernemer dit zelf: hij is de belastingplichtige. Er is dus
bewust geen kantoorroute die dat overneemt.

| Endpoint | Doel |
|---|---|
| `POST /api/supplier/btw/opmaken` `{periode, correctie?}` | Aangifte opmaken of bijwerken (`2026K3` of `2026-07`); manager, eigen zaak uit het token |
| `POST /api/supplier/btw/aangiftes` `{jaar?}` | De eigen aangiftes teruglezen |
| `POST /api/supplier/btw/aangifte` `{id}` | Eén aangifte in detail |
| `POST /api/supplier/btw/indienen` `{id, kenmerk}` | Vastleggen dat hij is ingediend; zonder kenmerk geen bewijs |

Het scherm staat in het Kantoor van de zaak onder Boekhouding, naast (en
nadrukkelijk niet in plaats van) "Btw deze maand": dat bord is de maandstand uit
de kassa en de boekingen, de aangifte is de periode uit het factuurregister.
Twee verschillende vragen. Wat er níét in zit is omzet die nooit een factuur
kreeg; de aangifte verantwoordt daarom uit hoeveel facturen hij komt.

#### De andere kant: het toezicht (`kern/overheid/btwtoezicht.js`)

Het Belastingkantoor had een btw-beeld maar geen enkel besef van wat een zaak
daarover had **aangegeven** — een cijfer zonder de vraag erachter. De vraag van
een inspecteur is niet "hoeveel btw zit er in het register", maar "klopt wat er
is aangegeven met wat er is gefactureerd, en wie heeft niets ingediend".

De aansluiting zet die twee naast elkaar, per zaak per periode, met vier standen:
`sluit_aan`, `wijkt_af`, `niet_aangegeven`, `alleen_concept`. Daaruit volgen de
btw-signalen in de inspecteurscockpit — maar **alleen over een afgesloten
periode**: over een lopend kwartaal weigert de aangifte van de ondernemer het
indienen met zoveel woorden, dus daar is "niets ingediend" de bedoeling en geen
bevinding. Het scherm opent om dezelfde reden op het laatst afgesloten kwartaal.

**Eén telling voor beide partijen.** Het geteld-uit-het-register komt bij de
inspecteur uit dezelfde routine als bij de aangever (`telPerZaak` naast
`telFacturen`, tot op de regelsom in `regelBtwCenten`). Dat is de kern van de
zaak en geen zuinigheid: een toezichthouder die anders rekent dan de aangever
vindt altijd een verschil, en dan zegt een verschil niets meer. Zo betekent een
verschil precies één ding — er is na het indienen iets aan de facturen veranderd,
of er is niets aangegeven.

Bij die verbouwing is ook het woord *omzet* in het btw-beeld rechtgezet: dat veld
droeg het factuurbedrag **inclusief** btw. Wie het naast een aangifte legde,
vergeleek twee verschillende dingen zonder dat iets dat zei. Het heet nu
`grondslag` en draagt ook dat getal.

| Endpoint | Doel |
|---|---|
| `POST /api/overheid/bd/btw/aansluiting` `{periode?}` | Per zaak: geteld uit het register naast de ingediende aangifte, met verschil en stand; zonder periode de laatst afgesloten |

#### En wat de inspecteur er dan van vindt: de naheffing (`kern/overheid/naheffing.js`)

Het is een **naheffing** en geen navordering. Btw is een aangiftebelasting — je
berekent en betaalt hem zelf, en wat er niet is betaald wordt nageheven (art. 20
AWR). Navordering hoort bij een aanslagbelasting zoals de inkomstenbelasting.
Andere bevoegdheden, andere termijnen; de twee door elkaar halen is geen
woordenspel.

**Het bedrag wordt niet getypt.** Het komt uit de aansluiting: gefactureerd min
aangegeven. Een naheffing met een invulveld is een tweede berekening naast het
register, en dan gaat de discussie over het getal in plaats van over de feiten.

**Vier ogen, en dezelfde ogen tellen nooit dubbel** (hetzelfde idioom als
`kern/uitgifte.js`): wie hem opmaakt stelt hem niet vast, en wie hem opmaakte of
vaststelde beslist niet op het bezwaar ertegen — een besluit laten heroverwegen
door dezelfde persoon is geen heroverweging. De namen komen uit de
personeelslogin op de persoonlijke pincode, nooit uit het verzoek.

**De boete ontstaat nooit vanzelf.** Geen enkele stand levert er een op; een mens
zet een percentage en schrijft erbij waarom. Zonder grond geen boete.

Verder: een concept is nog geen besluit (de zaak ziet het niet en er staat geen
bezwaar tegen open), een vastgestelde naheffing trek je niet stilletjes in, en
vaststellen hertelt eerst — zijn de cijfers sinds het opmaken veranderd, dan
weigert hij.

**En betalen is een echte boeking** (`kern/overheid/naheffing-betalen.js`). Hier
stond drie commits lang dat innen er níét was, met de reden erbij: een
`betaald = true` zonder boeking is een leugen in de database. Nu gebeurt het
zoals het hoort — een dubbele boeking in het grootboek van RTG Bank, van de
zakelijke rekening van de zaak naar `extern:belastingdienst`. Dat laatste is de
eerlijke tegenrekening: de Belastingdienst bankiert niet bij RTG, dus het geld
verlaat het platform. De som van alle saldi blijft exact nul.

**De volgorde is de hele zaak:** eerst boeken, dan pas op betaald. Andersom zou
een mislukte boeking een betaalde naheffing opleveren, en dat is het ergste van
de twee — dan denkt iedereen dat het klaar is. Wat de bank weigert (nog niet
live, geen zakelijke rekening, te weinig saldo) wordt ongeschonden doorgegeven,
met het tekort erbij en de mededeling dat er niets is afgeschreven.

Wordt een bezwaar tegen een al betaalde naheffing toegewezen, dan komt het geld
terug — een besluit dat de aanslag vernietigt en het bedrag laat staan, doet
niets.

#### En als er niet betaald wordt: de invordering (`kern/overheid/naheffing-invordering.js`)

De keten is één kant op en **elke stap wacht op de termijn van de vorige**:
vervallen → aanmaning → dwangbevel → beslag. Niet "na een dag of wat": de datum
staat op de naheffing en wordt nagerekend. Een invorderingsstap die te vroeg mag,
is een dwangmiddel zonder grond. Aanmaning en dwangbevel leggen kosten op (art.
63a IW en de Kostenwet, demo-peiljaar) en die tellen mee in wat er te betalen is
— een aanmaning die kosten oplegt maar het bedrag niet meebeweegt, houdt de
invordering aan de gang om acht euro.

**Beslag is de enige stap met vier ogen**, en met opzet de enige: hier gaat er
geld van een rekening af zonder dat de rekeninghouder tekent. Wie het dwangbevel
uitvaardigde, legt het beslag niet. Er wordt **nooit meer gepakt dan de schuld**;
staat er minder op de rekening, dan is het een deelbetaling en blijft de rest
openstaan. Een lege rekening levert een nette weigering op, geen mislukte
boeking.

**Er zit een rem en een stopknop in** (`kern/overheid/naheffing-rem.js`), en dat
is geen vriendelijkheid maar een voorwaarde. Een betalingsregeling schort de
invordering op zolang hij loopt; een ontvanger kan de invordering stopzetten met
een reden, in élke stand — ook na een beslag, want juist dan is er iets
misgegaan. Zonder die twee is dit een ratel die maar één kant op kan, en dat is
precies het soort systeem dat mensen kapotmaakt omdat niemand meer aan de
noodrem kon. De stopknop belooft níét dat het geld terugkomt: wat er al is
afgeschreven loopt via een besluit op bezwaar, niet via een pennenstreek van de
ontvanger.

**Wat er niet is, en niet komt:** beslag op iets anders dan de zakelijke rekening
waarop de aanslag is opgelegd. Geen loonbeslag, geen bodembeslag, geen
derdenbeslag. Dat zijn bevoegdheden met eigen waarborgen en eigen rechters, en
die verzin je er niet even bij.

| Endpoint | Doel |
|---|---|
| `POST /api/overheid/bd/naheffing/aanmaning` `{id}` | Na de betaaltermijn; legt aanmaningskosten op |
| `POST /api/overheid/bd/naheffing/dwangbevel` `{id}` | Na de aanmaningstermijn; betekeningskosten |
| `POST /api/overheid/bd/naheffing/beslag` `{id}` | Na het dwangbevel, door ándere ogen; nooit meer dan de schuld |
| `POST /api/overheid/bd/naheffing/regeling` `{id, maanden}` | De rem: 1–12 maanden, zet de invordering stil |
| `POST /api/overheid/bd/naheffing/stop` `{id, reden}` | De stopknop, in elke stand, met een reden |

| Endpoint | Doel |
|---|---|
| `POST /api/overheid/bd/naheffing/maak` `{periode?, code, boetePct?, boeteGrond?}` | Concept opmaken; bedrag uit de aansluiting |
| `POST /api/overheid/bd/naheffing/stelvast` `{id}` | Vaststellen — moet een ándere inspecteur zijn; maakt bekend aan de zaak |
| `POST /api/overheid/bd/naheffing/intrek` `{id, reden}` | Alleen een concept |
| `POST /api/overheid/bd/naheffing/bezwaar/beslis` `{id, toewijzen, motivering}` | Derde ogen; toewijzen laat niets staan |
| `POST /api/overheid/bd/naheffingen` `{status?, periode?}` | De lijst voor het kantoor |
| `POST /api/supplier/btw/naheffingen` | De zaak leest zijn eigen (geen concepten) |
| `POST /api/supplier/btw/naheffing/bezwaar` `{id, reden}` | De zaak maakt bezwaar |
| `POST /api/supplier/btw/naheffing/betaal` `{id}` | De zaak betaalt: een echte boeking van zijn zakelijke rekening |

#### En de oudere kant van hetzelfde kantoor: de IB-aanslag (`kern/overheid/kantoor-invordering.js`)

Er draaiden **twee invorderingsregimes naast elkaar in hetzelfde kantoor**. De
naheffing hierboven heeft vier ogen op elke stap die geld raakt; de oudere
IB-kant (herinnering, betalingsregeling, kwijtschelding) had er nul — één
inspecteur kon in zijn eentje een schuld wegstrepen. Dat is nu gelijkgetrokken
op het punt waar het ertoe doet: **kwijtschelden is de enige onomkeerbare
handeling in dat rijtje**, en die gaat in twee stappen door twee mensen. Een
herinnering kun je opnieuw sturen en een regeling kun je intrekken; een
kwijtgescholden aanslag komt niet terug.

De burger hoort pas van een kwijtschelding als er écht is besloten — een
voordracht is geen besluit, dus er valt nog niets mee te delen.

| Endpoint | Doel |
|---|---|
| `POST /api/overheid/bd/herinnering` `{ref}` | Betalingsherinnering via de Berichtenbox, op naam |
| `POST /api/overheid/bd/regeling` `{ref, maanden}` | 2–24 maanden, op naam |
| `POST /api/overheid/bd/kwijt/voordracht` `{ref, reden}` | Voordragen, met een verplichte grond; de burger hoort nog niets |
| `POST /api/overheid/bd/kwijt/besluit` `{ref, akkoord}` | Beslissen — moet een ándere inspecteur zijn; afwijzen laat de aanslag gewoon openstaan |

**Wat er aan deze kant (nog) niet is: termijnen.** De naheffing rekent na of een
vervaldatum echt is verstreken voordat de volgende stap mag, en kent aanmaning,
dwangbevel en beslag; de IB-kant kent alleen een herinnering zonder klok
erachter. Dat is met opzet niet half nagebootst — knoppen die een volgorde
suggereren zonder de datums na te rekenen zijn misleidender dan geen. Het staat
als 4.23 in `TAKEN.md`.

#### De herinnering rekent ook zelf (`kern/automatisering.js`)

Het btw-draaiboek NAM een bedrag, een periode en een deadline aan, en de route
gaf ze door uit het verzoek — dus wie de route aanriep bepaalde wat er in de
herinnering stond, ongeacht wat het register zei. Dat is dezelfde fout als een
aangifte met een invulveld, alleen dan in een e-mail. Nu telt het draaiboek zelf,
met dezelfde routine als de aangifte, en rekent het de aangiftetermijn uit (een
maand na afloop van het tijdvak, art. 10 AWR).

En hij zwijgt als er niets te herinneren valt: is er al ingediend of viel er
niets aan te geven, dan gaat er geen bericht. Een draaiboek dat ook mailt als
alles op orde is, leert de ondernemer zijn post te negeren — en dan mist hij de
keer dat het wel moest. `POST /api/supplier/rtmail/btw-herinner` geeft dan een
`200` met `bericht: null` en de reden erbij, want een stille 200 laat de zaak
denken dat er post onderweg is.

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

### RTG Hospitality Guest OS (de gastkant van de horecatoren)

`server/kern/gast/` + `server/routes/gast/` + `/apps/gast.html`. De Horeca OS hierboven was compleet voor de **zaak** en had geen enkele deur voor de **gast**: veertien modules, dertien verkoopkanalen — waaronder `qr`, `online`, `afhaal`, `bezorging` en `roomservice` — en alles achter `supplierAuth`. Een gast kon reserveren en verder niets.

Het dragende ontwerpbesluit is hetzelfde als bij de Media OS en de wereldlaag: **dit is geen tweede horecasysteem.** Er komt geen `db.data.gastorders` naast de rekeningen. Een gastbestelling is een regel op dezelfde rekening die de bediening op haar scherm ziet, gebouwd door dezelfde `kern/horeca/regel.js`, zichtbaar op hetzelfde keukenbord. Die regelbouwer is er in deze ronde uit `routes/supplier/horeca/rekening.js` gehaald en apart gezet: zolang alleen de bediening bestelde stond hij prima in de handler, maar met een tweede aanroeper zouden er twee antwoorden ontstaan op "wat kost dit met happy hour" (LAT-regel 4).

- **De poort is de tafelsleutel, geen inlog.** De QR hoort bij de *tafel* en niet bij de rekening — een gedrukte sticker gaat jaren mee — en het token staat **gehasht** in de opslag: wie de database leest, opent er geen tafelsessie mee. Aanschuiven levert een sleutel die bij díe open rekening hoort; is de rekening voldaan, dan is de sleutel niets meer waard. Op de rekening staat een handle, nooit een echte naam en nooit een ledensleutel.
- **Meerdere telefoons, één rekening.** Elke deelnemer krijgt het `gastNr` dat de rekening al kende, dus de bestaande splitlaag per persoon werkt meteen. Iedereen ziet dezelfde live rekening: wat er staat, wie het bestelde, wat er nog openstaat.
- **Het beleid van de zaak staat op één plek** (`kern/gast/beleid.js`) en elke uitkomst draagt drie dingen: of het mag, een machineleesbare code en de zin die de gast leest. Standaard: de gast mag bestellen, een **ernstige allergie gaat langs een medewerker**, alcohol vereist een **geverifieerde** leeftijd (een beweerde leeftijd opent die deur niet — LAT-regel 7). Die eerste is geen melding maar een grendel: zolang niemand heeft bevestigd, staat de regel **niet op het keukenbord**.
- **Waarom?** bestaat als route (`/api/gast/waarom`) en wordt beantwoord door dezelfde beleidslaag die het ook tegenhoudt. Een uitleg uit een andere bron dan de beslissing is vroeg of laat een uitleg die niet klopt.
- **Verdelen knipt de rekening niet.** Splitsen door de bediening (`horeca/schuif.js`) maakt twee rekeningen; een gast maakt een *afspraak over wie welk deel betaalt*. Dezelfde somdiscipline: 10,00 door drie is 3,34 + 3,33 + 3,33, en een verdeling die niet optelt wordt geweigerd in plaats van rechtgetrokken.
- **Afrekenen liegt niet.** Vanaf de telefoon van de gast lopen alleen de rails die er echt zijn: cadeaubon, tegoed en de hotelkamer (via de bestaande folio-laag). Kaart en online geven een **501 met de reden** in plaats van een groen vinkje.
- **Idempotentie en audit zitten er vanaf de eerste versie in.** Elke bestelling en betaling draagt een sleutel; dezelfde sleutel geeft hetzelfde antwoord zonder het nog een keer te doen. Elke mutatie legt actor, tijd, bron, apparaat, van, naar en reden vast — en de gast kan dat logboek zelf lezen (`/api/gast/logboek`).
- **De tijdlijn is een projectie en geen opslag.** De regel droeg al `at`, `vrijAt`, `startAt`, `klaarAt` en `uitAt`, gezet door het keukenscherm. De gast leest "de keuken is begonnen", de keuken ziet stations en urgentie. Eén gebeurtenis, twee perspectieven.

Aan de zaakkant staat dit in `routes/supplier/horeca/gastbeheer.js`: de QR per tafel uitgeven (opnieuw uitgeven is een aparte handeling met een waarschuwing, want het maakt elke gedrukte sticker dood), een gerecht op **uitverkocht** zetten, het gastbeleid, en de **wachtrij** met bevestigen of afwijzen — afwijzen kan niet zonder reden, want die reden leest de gast.

Bewezen door `test/gastorder.test.js` (elf toetsen, waaronder: een gastbestelling verschijnt in de rekeningenlijst van de zaak met hetzelfde bedrag; een prijs die de telefoon meestuurt verliest het van de kaart; twee keer bestellen met dezelfde sleutel levert één regel; een onbevestigde allergie blijft van het keukenbord). Zes mutaties nagetrokken, alle zes raak.

**Buiten de deur: bezorgen en afhalen** (`kern/gast/buitenshuis.js`, `routes/gast/bezorgen.js`). Dit is de tweede naad op dezelfde motor, en het verschil is leerzaam. Aan tafel bewijst de QR dat je er *bent* — of je lid bent doet er niet toe. Thuis bestaat dat bewijs niet en moet er iemand bereikbaar zijn, dus daar is de **ledensessie** de poort. Alles eronder is identiek: dezelfde rekening, dezelfde orderlaag, dezelfde idempotentie en audit. Dat is precies waarom de gastlaag geen generieke "bestelmotor" met een tafel als toevallige parameter is geworden — wat verschilt is hóe je bewijst dat een bestelling van jou is, en dat hoort gescheiden van de rest.

- **De volgorde is gedrag**: eerst de zone, dan het mandje, dan het tijdslot. Andersom reserveer je keukenminuten voor een rit die nooit gaat rijden, en die minuten knijpen dan een keuken dicht die leegstaat. Valt het adres buiten de zone, dan wordt er geen rekening geopend en geen minuut bezet.
- **De bezorgkosten staan als regel op de rekening**, niet als een veld ernaast: zo tellen ze mee in het totaal, de splitsing en de betaling zonder dat een van die drie er apart rekening mee hoeft te houden. Ze worden opnieuw berekend ná het mandje, want gratis-vanaf hangt aan het bedrag.
- **Een vol tijdslot noemt het eerstvolgende** en de bestelling blijft staan — alleen de tijd ontbreekt dan nog. Alles weggooien omdat het een kwartier te druk was, betekent dat de gast opnieuw mag kiezen.
- **Een lid heeft hooguit één lopende bestelling per zaak en per kanaal**, dezelfde regel als "een tafel heeft hooguit één open rekening" en om dezelfde reden.
- **De gegevenspoort bijt hier echt.** Bezorging vraagt telefoon én adres (er komt iemand langs), afhalen alleen een nummer (de tas ligt klaar op een code, een adres zou meer zijn dan nodig). Zonder die gegevens volgt een 428 die zegt wát er ontbreekt, en de app opent daarop het gegevensgesprek.
- De rekensom eronder — zones, kosten, tijdsloten — is uit de leveranciersroute gehaald naar `kern/horeca/bezorglaag.js`. Dezelfde verhuizing als bij `regel.js`, om dezelfde reden: een zone die de zaak anders uitrekent dan de gast levert een bestelling op die wordt aangenomen en niet gereden kan worden.

Bewezen door `test/gastbezorging.test.js` (acht toetsen, waaronder een die de zone-uitkomst van de gastroute naast die van de leveranciersroute legt). Vijf mutaties nagetrokken, alle vijf raak.

**Roomservice** (`routes/gast/tafel.js`, de kamer-variant). De derde naad, en de scherpste: hier kan het bewijs **verlopen**. Een sticker op tafel 12 is over een jaar nog geldig; een kaartje op kamer 308 is niets meer waard zodra die gast uitcheckt, want de volgende die daar binnenloopt is iemand anders. De grendel hangt daarom niet aan de QR maar aan de **folio**: geen open gastrekening op die kamer, geen roomservice — dezelfde regel die de betaalwijze `kamer` altijd al hanteerde, nu ook voor de deur ervoor. Die grendel geldt voor de plek en niet alleen voor het openen: stond hij alleen op het aanmaken, dan landde een vreemde na de check-out op de nog openstaande rekening van de vorige gast. De QR-laag is daarvoor van *tafel* naar *plek* gegeneraliseerd (`plekToken`, soort `tafel` of `kamer`); bestaande QR-rijen dragen geen soort en vallen terug op `tafel`.

**De club** (`routes/gast/club.js`). Hier bleek bijna niets nieuws nodig, en dat is de nuttigste uitkomst van de vijf: een polsband **is** in deze code al een tegoedbon (`club.js` maakt hem met `bonMaak`) en betalen met een tegoed liep al langs `bonBoek`. De gastkant kon dus vanaf dag één met een band afrekenen — alleen kon je je saldo niet zien. Wat eraan moest is het **bewijs-in-handen**: aan de bar geef je de band af, op een telefoon niet, en het bandnummer staat groot op de band en is te raden. De **boncode** niet — die staat als QR op de band, en wie hem heeft, heeft de band vastgehad.

**De foodcourt** (`kern/gast/foodcourt.js`). De enige naad die niet over toegang gaat maar over **verdeling**, en geen nieuw kanaal: wie in een foodcourt bestelt haalt af, bij meer loketten tegelijk. Dus per zaak een eigen rekening op het bestaande `afhaal`-kanaal — elke zaak zijn eigen keuken, kassa en omzet — met daarbovenop één `mandjeId` dat zegt dat ze bij elkaar horen. Dat is een **veld en geen tweede administratie**: "mijn mandje" is een zoekvraag over bestaande rekeningen. Binnen een zaak is een mandje atomair; over zaken heen kan dat niet, want de pizza is niet terug te halen als de sushi op blijkt. Deels gelukt geeft daarom een **207** met per loket wat er wel en niet doorging, en niet een vinkje of een fout die doet alsof er niets is gebeurd. Wachten doe je op het langzaamste loket, dus het mandje meldt `allesKlaar` en niet per loket.

Bewezen door `test/gastroomservice.test.js` (zeven toetsen, kamer en club) en `test/gastfoodcourt.test.js` (vier, waaronder een die bij beide zaken narekent dat ze precies hun eigen deel zien). Acht mutaties nagetrokken; zeven raak en **één gemist**, en die gemiste was de nuttigste: de idempotentiesleutel kreeg de zaakcode erbij "omdat twee loketten hem anders zouden delen", en de mutatie liet zien dat dat niet zo is — de idempotentiekaart staat al per zaak. Het achtervoegsel verdedigde tegen iets wat niet kan gebeuren en is eruit, met de meting in de code zodat niemand hem terugzet.

Wat er **nog niet** is, en dat is een grens en geen omissie: er is nog geen Rahul-conciërge op deze laag, geen gastscherm voor bezorgen, roomservice of foodcourt (`gast.html` dekt de tafel; de rest is API), geen service-request-kanaal, geen koppeling naar Work OS voor uitzonderingen, en beleid is één zaak per keer — multi-location en holdings raken het datamodel en zijn een eigen verbouwing.

### RTG Evening OS (een avond als plan, niet als product)

`server/kern/avond/` + `/api/avond/...`. De vraag die hieraan voorafging was niet "welke functie ontbreekt" maar "waarom heeft niemand dit eerder zo gebouwd". Het antwoord dat deze laag geeft: **een avond is geen app maar een plan over bestaande boekingen heen.** Een stap wijst naar een reservering in `db.data.reserveringen`, een rit in de mobiliteitskern, een rsvp bij een event — en bezit er geen kopie van. Dezelfde truc als het `mandjeId` van de foodcourt: één veld dat zegt "deze horen bij elkaar", en verder niets (LAT-regel 4).

Wat een avond wél bezit zijn drie beloften, en die staan als **som** in de code en niet als tekst:

1. **De klok klopt.** Elke stap begint nadat de vorige is afgelopen, met de reistijd ertussen, en het geheel eindigt vóór het tijdstip waarop je thuis wilt zijn. Haalt een plan dat niet, dan wordt het **geweigerd** met hoeveel het te laat is — niet geleverd met een sterretje.
2. **Het budget klopt.** Per persoon, inclusief vervoer, met ruimte voor fooi (die nooit wordt voorgevuld — dezelfde regel als in de horeca-kern). Een budget dat pas aan het eind blijkt te zijn overschreden, is geen budget.
3. **Niets is geboekt tot het geboekt is.** Elke stap draagt zijn eigen staat: `voorstel`, `aangevraagd`, `bevestigd`, `mislukt`. De staat van de avond volgt daaruit en wordt niet apart gezet, dus er kan nooit "rond" boven een plan staan waarvan de helft nog moet worden bevestigd. Een **tafel belooft deze laag nooit**: het lid vraagt aan, de zaak beslist — die regel stond al in de reserveringslaag en wordt hier niet omzeild omdat "geregeld" prettiger klinkt.

De samensteller (`samenstellen.js`) stelt **alleen voor wat bestaat**. Geen verzonnen cocktailbar, geen taxi van een vervoerder die we niet hebben: kan een stap niet worden gevuld, dan blijft hij leeg met de reden erbij. Elke keuze draagt zijn grond mee (`uitleg`) en de duurschattingen staan er als **aanname** bij, want een planner die doet alsof hij weet dat een diner 97 minuten duurt is nauwkeuriger dan hij kan zijn. En er wordt bewust geen urgentie gemaakt: geen "nog twee tafels!", niets voorgeselecteerd wat geld kost, en een plan verloopt niet.

**De Hospitality DNA** (`voorkeuren.js`) is de laag eronder: wat een zaak van je mag weten. Delen gaat **per soort** (tafelvoorkeur, drank, sfeer, toegankelijkheid, gelegenheden) en niet met één schakelaar, want je tafelvoorkeur en je verjaardag zijn niet hetzelfde soort gegeven. Drie standen: `nooit`, `gevraagd` (alleen als je het deze keer meegeeft) en `altijd`. Toegankelijkheid staat als enige standaard open — dat is de enige soort waar níét delen de gast schaadt in plaats van beschermt.

- **Het zorgprofiel blijft waar het staat.** Allergenen, dieet en medische punten zitten al in `kern/gastzorg.js` met hun eigen toestemmingsregel; die wordt hier gelezen en niet gekopieerd. Een tweede allergie-administratie is precies de fout die je bij allergieën niet wilt maken.
- **Een uitzondering per zaak kan alleen smaller maken.** Ruimer vragen legt niets vast en zegt waarom. Dat was eerst een clamp die de smallere waarde bewaarde — een val, want dan stond er een uitzondering die de gast nooit had gekozen, en die bleef hangen zodra hij de soort later ruimer zette.
- **RTG leidt geen voorkeuren af uit je gedrag.** Wat hier staat heb je zelf opgeschreven, en dat verschil staat als zin in het profiel. Een systeem dat uit je bestellingen afleidt dat je van pittig houdt en dat doorgeeft aan een zaak, is iets anders dan een gast die zijn voorkeur opschrijft.

Bewezen door `test/avond.test.js` (zestien toetsen: de klok en het budget weigeren echt, een tafel komt nooit verder dan `aangevraagd`, de aangevraagde reservering staat in de gewone reserveringenlijst, `gevraagd` lekt niet zonder te vragen, een avond van een ander is niet op te vragen, en het aanvragen loopt niet om de gegevenspoort heen die `/api/reserveer` wél heeft). Zeven mutaties nagetrokken, alle zeven raak.

**Het aanvragen** (`aanvragen.js`) is waar het plan werkelijkheid wordt, en waar het onderscheid tussen `aangevraagd` en `bevestigd` geen woordkeus is. Een **tafel** gaat naar aangevraagd — de zaak beslist. Een **rit** mag wél op bevestigd: de mobiliteitskern boekt hem en er komt een chauffeur; daar beslist niemand meer over. Twee dingen die in een lijstje hetzelfde lijken en volstrekt verschillen in wat je ervan mag verwachten.

De terugreis is de enige stap waarvoor de planner iets moet weten wat hij niet heeft: waar je woont. Dat staat in de kluis achter de gegevenspoort en blijft daar. De mobiliteitskern kent wél **favoriete plekken** die het lid zelf heeft opgeslagen, en dat is de goede haak: heb je er een die "thuis" heet, dan plant de avond je terugreis en boekt hem echt; heb je er geen, dan zegt hij dat en waar je hem zet. Een adres uit de kluis trekken omdat het toevallig handig is, is precies wat privacy by design moet voorkomen. De rit kiest de **goedkoopste** optie die binnen de resterende ruimte past — het budget is een grens die de gast stelde, snelheid een voorkeur die hij niet heeft uitgesproken — en past er niets, dan gaat er niets en noemt de weigering het bedrag.

Twee fouten die de mutaties hier vonden en die anders waren meegegaan: de **geboekte prijs landde niet op de stap**, waardoor het budget precies het geld niet meetelde dat werkelijk werd uitgegeven; en de prijs van een reisoptie zit in `optie.totaal.prijs` terwijl `totaal` een *object* is — de weigering luidde daardoor "de goedkoopste rit kost € NaN", een zin die een gast te zien zou krijgen. Er staat nu een toets die de hele uitvoer op `NaN` en `undefined` nakijkt.

**Het scherm** is `/apps/avond.html`: drie tabbladen (Plannen, Mijn avonden, Wat zaken van me weten). Het maakt niets mooier dan het is — de staat van een stap staat er als woord én als kleur, de zin boven het plan komt van de server (`zekerheid`) en niet uit de pagina, en de knop heet niet "Aanvragen" als er niets meer aan te vragen valt. Onder een stap met een zaak staat de pols van die zaak (hieronder).

**Uitgaan heeft twee aanvraagwegen, en welke het wordt hangt af van wat de zaak IS.** Een **club** werkt met een gastenlijst en een deur met capaciteit: het lid vraagt een plek aan op dezelfde lijst die de portier 's nachts voor zich heeft (`kern/horeca/clublaag.js`), en de club beslist. Een **bar** die reserveringen aanneemt gaat langs dezelfde tafelweg als het eten. Doet de zaak geen van beide, dan blijft de stap staan mét de reden — de derde uitkomst is net zo geldig als de andere twee. In geen van de gevallen wordt het `bevestigd`.

Daar hoort een regel bij die pas zichtbaar werd toen er een club in het plan kwam: **een club heeft geen kaart in RTG, en `null` is iets anders dan nul.** Een stap zonder bekende prijs telt niet mee in het budget en het budget zégt van hoeveel stappen het de prijs niet weet; het bedrag onder het plan krijgt een `+`. Als 0 opslaan zou het totaal laten kloppen terwijl het niet klopt.

Onderweg kwam de club-deurteller er beter uit dan hij in ging: de weigering van een niet-goedgekeurde aanvraag stond eerst *na* `d.binnen += personen`. Die tak bewaart niet, maar de teller staat wel in `db.data`, dus de eerstvolgende `save()` van een willekeurig ander verzoek legt hem alsnog vast — dan staan er mensen binnen die zijn geweigerd. Alle weigeringen staan nu vóór de teller, met een toets die dat vasthoudt.

Er staat nu ook een **democlub** in de seed (`NACHT`, Sal Nocturna, bewust zonder kaart). De hele clubkant van de horecatoren was compleet gebouwd en had geen enkele zaak om op te draaien: de gastenlijst en de deur waren met geen enkele toets te doorlopen.

Wat er **nog niet** is: gezelschapsafstemming, weer en herinneringen. Die vragen gegevens die dit huis niet heeft; de bodem waarop ze kunnen staan ligt er wel.

### De pols van een zaak (drie bronnen, nooit één cijfer)

`server/kern/horeca/pols.js` + `polsmeting.js` + `keukenlaag.js`, met drie deuren: `/api/supplier/horeca/pols(+/zet)` voor de zaak, `/api/gast/pols(+/meld)` vanaf de tafel, en `/api/avond/pols` voor een lid dat een avond plant. "Hoe druk is het daar nu" is de vraag waar elke restaurant-app een sterretje van maakt. Hier niet: er komen **drie blokken naast elkaar** uit, en ze worden nooit tot een getal geroerd.

1. **Wat wij meten.** De wachttijd is openstaande bereidingsminuten gedeeld door het aantal koks; de bezetting is open rekeningen tegenover de tafels die de zaak zelf heeft geregistreerd; de clubdeur telt hoeveel mensen er binnen zijn (nooit wie). Elk getal draagt zijn **rekensom** mee, want dat is de enige reden dat iemand een wachttijd gelooft.
2. **Wat de zaak invult.** Sfeer, geluid, temperatuur, terras, wachtrij. Daar is geen sensor voor, dus zegt de zaak het — met een tijdstip erbij, en na drie uur vervalt het.
3. **Wat gasten melden.** Dezelfde onderwerpen, vanaf de tafel waar ze zitten, met het aantal meldingen erbij.

Vier regels houden dat eerlijk, en ze staan alle vier als toets in `test/pols.test.js` (vijftien toetsen, acht mutaties nagetrokken, alle acht raak):

- **Niets gemeten is niet "rustig".** Een zaak zonder tafels in RTG krijgt geen percentage maar de reden waarom er niets staat. Een 0% dat "leeg" betekent zou elke zaak die RTG niet voor haar rekeningen gebruikt permanent uitgestorven laten lijken — en dat merkt de gast pas voor de deur.
- **Wie mag wat zeggen ligt vast.** De zaak kan haar eigen wachttijd niet invullen (dat getal komt uit haar keuken), gasten kunnen niets over het terras zeggen. De verdeling staat in de kern, niet in een scherm, zodat er niet omheen te werken valt.
- **Een mening verandert de volgorde niet.** De avondplanner weegt de pols mee, maar **uitsluitend het gemeten deel**. Een zaak die zichzelf "rustig" noemt zou zich anders naar boven schrijven; dat is geen signaal maar een advertentie.
- **Oud is weg.** Buiten het versvenster verdwijnt een uitspraak in plaats van met een oud tijdstip als "nu" te blijven staan.

Melden kan alleen achter `gastAuth`: de tafelsleutel is het bewijs dat je er zit, en hij verloopt als de rekening dichtgaat. De melding hangt aan de afdruk van je tafelsessie — geen naam, geen ledensleutel — en een tweede melding over hetzelfde onderwerp vervangt de eerste, zodat een tafel van vier hooguit vier keer telt.

Onderweg kwam `bereidingsMinuten` uit een leveranciersroute naar `kern/horeca/keukenlaag.js`: hij hing aan `kern` en was daardoor onbereikbaar voor de gastkant — dezelfde fout die `horecaFolioVan` eerder maakte.

### Iets vragen (het menselijke deel)

`server/kern/gast/verzoek.js` + `/api/gast/verzoek*` + `/api/supplier/horeca/verzoeken*`. De gastkant kon bestellen en afrekenen maar niet zeggen "kunt u even komen". Dat betekende in de praktijk: zwaaien. Software die het makkelijke deel (geld) digitaliseert en het menselijke deel (aandacht) laat liggen, verplaatst het werk naar de gast.

Zes soorten met een vaste lijst — bediening, de rekening, water, bestek, afruimen, "er is iets niet goed" — en vier regels die van een knop iets anders maken dan een belofte:

- **Een verzoek kost niets en zet niets op de rekening.** Wat wél geld kost gaat door de bestellaag met de beleidscontrole die daarbij hoort. Een "verzoekje" waar stilletjes een flesje water van € 4,50 uit volgt, is een bestelling met een vriendelijke naam.
- **Niemand belooft een tijd.** Er staat geen "iemand is er binnen twee minuten"; dat weten we niet, en een belofte die de zaak niet heeft gedaan moet de zaak wel inlossen. Wat er wél staat is hoeveel minuten het verzoek open staat. Om diezelfde reden zegt het gastscherm na een druk op de knop *"het staat nu op het scherm van de bediening"* en niet *"er komt iemand langs"*: het eerste is een feit dat wij kunnen waarmaken.
- **Twee keer drukken is één keer vragen.** Anders is de wachtrij onleesbaar precies wanneer het druk is, en lijdt de gast die één keer drukte onder de gast die tien keer drukte.
- **Oud staat bovenaan, niet tafel 1.** De wachtrij sorteert op wat het langst wacht. En "oud" hangt aan de soort: een servetje mag tien minuten wachten, "er is iets niet goed" drie.

Oppakken en afronden zijn twee knoppen en niet één. Tussen "ik ga erheen" en "het is gedaan" zit de tijd waarin een collega niet ook moet gaan; zonder die tussenstand lopen er op een drukke avond twee mensen naar dezelfde tafel, of geen. Intrekken kan wel zolang niemand het oppakte en niet daarna — dan is er iemand onderweg en is intrekken een mededeling, geen knop.

Bewezen door `test/gastverzoek.test.js` (twaalf toetsen, vijf mutaties, alle vijf raak). Eén toets kijkt naar de **hele** uitvoer van de wachtrij op een beloofde tijd, en niet naar een veld: zo'n belofte kan overal insluipen, ook in een `let`-zin.

### De klantnaad (één handle, vijf kanalen)

`server/kern/gast/naad.js`. De vijf gastkanalen bewijzen elk op hun eigen manier dat je ergens bij hoort — de sticker op tafel (een QR-sleutel), thuis (je ledensessie), de hotelkamer (een open gastrekening), de club (de code op je polsband), de foodcourt (ledensessie plus een mandje-id) — en dat verschil is echt; het hoort niet te worden weggepoetst tot één `wieBenJij()`. Maar één ding deelden ze wél, en dat stond woordelijk in twee routebestanden: **hoe een ledensessie een handle op een rekening wordt.** Zouden bezorgen en de foodcourt daarin uiteenlopen, dan vinden je bezorgbestellingen en je foodcourt-mandje elkaar niet meer, zónder enige foutmelding. Dezelfde vraag ("is deze rekening van mij?") stond bovendien vier keer los uitgeschreven; die loopt nu ook via de naad.

Het interessante zat in de toetsing: ik heb de twee beweringen die ik in het commentaar had opgeschreven allebei kapotgemaakt — een lege handle die overal bij hoort, en de volledige sessiesleutel in de handle — en de hele gastreeks bleef groen. Twee claims die niemand bewaakte (LAT-regel 10). `test/klantnaad.test.js` bewaakt ze nu wel; beide mutaties zakken.

Wat níét is samengevoegd: `kern/foodcourt.js` en `kern/gast/foodcourt.js`. Die staan al maanden naast elkaar en dat leek dubbelop, maar het zijn twee producten met dezelfde marktnaam en nul gedeelde code — het reserveerplein (restaurants met hun vrije tijdsloten) en het mandje bij meer loketten. Beide headers zeggen dat nu van elkaar, zodat niemand er nog een middag aan verliest.

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

### RTG Ondernemers-OS: drie assen, één bedrijfsobject

`server/kern/onderneming/` + `/api/onderneming/...`. De ruggengraat onder alles
wat een ondernemer hier kan: **één object dat bestaat vanaf "ik denk erover na"**
en dat meegroeit tot een groep met meerdere vennootschappen.

**Waarom het er is.** Een bedrijf bestond hier in twee gedaanten. Vóór de
oprichting was het een `aanmelding` (`kern/aanmeldingen/bedrijf.js`), daarna een
`supplier`, en `provisioneer()` maakte die tweede op het moment dat het personeel
de eerste termijn aftekende. Twee objecten voor één bedrijf is regel 4, en de
naad zat op de slechtst denkbare plek: alles vóór de oprichting -- het idee, de
verkenning, het plan, de rechtsvormkeuze -- had geen object om aan te hangen, en
alles erna had geen geheugen van wat er vooraf bedacht was.

De onderneming **wijst de zaak aan** in plaats van hem over te schrijven. De
supplier blijft wat hij is (het menu, de vloot, het personeel); de onderneming is
wie hij juridisch en in zijn leven is. De **naam woont daarbij op precies één
plek, en die plek verhuist**: zolang er geen zaak is staat hij op de onderneming,
en bij het koppelen wordt de lokale naam wéggegooid -- niet gekopieerd, want een
tweede naam die niemand meer bijwerkt is precies waar regel 4 over gaat.

**De drie assen komen samen in één capslijst:**

- **Wat zij DOET** -- `kern/werkvormen.js`, ongewijzigd: afgeleid uit vloot, menu,
  kamers, personeel.
- **Wat zij IS** -- `onderneming/rechtsvorm.js`: eenmanszaak, vof, bv, holding,
  stichting, vereniging, coöperatie. Dit wordt als enige **niet** afgeleid, en met
  reden: een rechtsvorm is een feit van de notaris en de KvK, en gokken zou hier
  betekenen dat iemand op de verkeerde aangifte belandt. Wat er wél uit volgt
  (verplichtingen, gereedschap, oprichtingsstappen) staat als data.
- **Waar zij STAAT** -- `onderneming/fase.js`: idee, validatie, oprichting, eerste
  klant, tractie, werkgever, vestigingen, groep. Afgeleid uit feiten en nooit
  gezet, want een opgeslagen fase loopt uiteen met de werkelijkheid en alles wat
  erop leunt is dan óók fout. Het is de **hoogste bereikte** fase en niet de
  eerste die zakt: wie eerst inschrijft en pas daarna zijn plan opschrijft blijft
  niet op 'idee' hangen. En zonder feiten geeft hij `null` en niet 'idee' (regel
  3: 'idee' is een geldige uitkomst en mag dus nooit het antwoord zijn op
  ontbrekende invoer).

**`verboden` is geen tweede capslijst maar het tegendeel ervan**, en het bestaat
apart omdat een verbod anders verliest van een andere as. Een stichting mag geen
winst uitkeren; zou `winstuitkering` alleen ontbréken in haar caps, dan zet de
eerste as die hem wél meebrengt de knop alsnog neer. `capsSamen()` trekt de
verboden er dus ná het samenvoegen af, en geeft terug wat er is geweerd en
waarom -- een knop die zonder uitleg ontbreekt leest als een storing.

**Geen paslaag op nadenken.** De zzp-belastingtool en de AI-boekhouder blijven
achter de Business Pass; de onderneming zelf niet. De eerste stand is letterlijk
"ik denk erover na", en iemand die dat denkt heeft nog geen zakelijke pas.

Getoetst in `test/onderneming.test.js` (22 toetsen). Vijf mutaties gedaan en alle
vijf zagen we de júiste toets laten zakken: de verboden niet meer aftrekken, de
fase stil op 'idee' laten vallen, de ladder bij het eerste gat laten stoppen, de
naam kopiëren in plaats van weggooien, en de eigendomscontrole op de routes
weghalen.

### De pre-oprichtingsfase: verkennen, doorrekenen, en mogen afraden

`server/kern/onderneming/{intake,kans,simulatie,stress,stress-toetsen,plan}.js`
+ `/api/onderneming/{intake,verkenning,plan/vastleggen}`. De vier stappen vóór
de oprichting, gebouwd op het ondernemingsobject hierboven. Ze leunen op elkaar
in één volgorde en worden daarom als één ketting aangeroepen
(`ondernemingVerkenning`) -- een scherm dat ze zelf moet ordenen, ordent ze ooit
verkeerd.

**De kansverkenning is een meter, en regel 10 gaat over meters.** Een score van
87/100 ziet eruit als een feit, wordt overgeschreven in een ondernemingsplan en
daarna aan een bank getoond. Drie dingen liggen daarom vast:

- **Niet gemeten is niet nul.** Een bron zonder data levert geen punten én telt
  niet mee in de noemer. Zou hij als nul meetellen, dan krijgt een leeg platform
  vanzelf een lage score en leest een gebrek aan méting als een gebrek aan kans.
- **Onder twee gemeten bronnen komt er geen cijfer**, maar `null` met de reden.
  Een getal met een voorbehoud eronder wordt een getal zodra iemand het overtypt.
- **De grondslag reist mee**: per bron of hij gemeten is, welke waarde eruit
  kwam en hoeveel punten dat gaf.

De vier bronnen zijn bestaande data en er komt geen register bij: concurrentie
(zaken van dezelfde soort in dezelfde plaats), vraag (hun boekingen en bonnen),
personeel (open vacatures in de branche -- een tekort is voor een starter een
risico) en bedrijfsruimte (leegstand uit het stadsweefsel, de bron die in de
praktijk het vaakst eerlijk 'niet gemeten' meldt). Nul concurrenten is bewust
**niet** de topscore: een markt waar niemand zit, is vaker geen markt dan een gat.

**Het volume komt van de ondernemer, niet van ons.** De simulatie rekent zijn
eigen aannames door over twaalf maanden in drie scenario's, en elke aanname staat
met **naam, getal en herkomst** in het antwoord -- `opgegeven` of `aanname`.
Zonder dat onderscheid lijkt onze startwaarde net zo hard als zijn eigen cijfer,
en zo wisselt een prognose ongemerkt van eigenaar. Ontbreekt er invoer, dan komt
er een fout met de ontbrekende velden en geen half doorgerekende maand.

**De stress test mag 'niet starten' zeggen.** Netjes doorgerekende aannames zien
er altijd goed uit, en dat is het probleem; deze module gaat er met opzet tegenin.
Verkopen onder de kostprijs is blokkerend (meer verkopen maakt het verlies
groter), net als een kas die in het *basisscenario* onder nul duikt -- niet in een
somber geval dat wij erbij verzinnen, maar in wat de ondernemer zelf verwacht. Er
staat ook in wat juist wél houdt: een lijst die alleen problemen noemt, wordt na
twee keer weggeklikt, en dan doet ook de blokkerende bevinding er niet meer toe.

**Het advies is geen slot.** Het levende ondernemingsplan wordt elke keer opnieuw
gebouwd en nergens bewaard (een kopie zou verouderen zodra de intake wijzigt).
Wat wél wordt bewaard is de **beslissing**: vastleggen zet een bevroren versie in
het archief, en bij een 'niet starten' gaat dat alleen door met een
uitdrukkelijke `tochDoorzetten` die mét het advies wordt opgeschreven. Software
die een mens verbiedt te ondernemen omdat een rekensom dat vindt, is niet aan
ons; zorgen dat niemand kan zeggen dat hij het niet wist, wel. Dat vastleggen is
tegelijk de fase-overgang van 'idee' naar 'validatie' -- geen knop die een fase
zet, maar het feit waar `fase.js` op kijkt.

Getoetst in `test/onderneming-verkenning.test.js` (20 toetsen). Zes mutaties
gedaan; vijf beten meteen. De zesde sloeg af en bleek een kapotte mutatie te zijn
(de cache die hij moest zetten werd nooit gevuld) -- opnieuw gedaan, en toen zakte
de juiste toets. De vijf andere: ontbrekende bronnen als nul meetellen, de
bronnendrempel weghalen, 'onder de kostprijs' van blokkerend naar zwaar zetten,
de simulatie op halve invoer laten rekenen, en de bevestiging bij 'niet starten'
overslaan.

### De schil: één scherm dat met het bedrijf meegroeit

`server/kern/onderneming/dagbeeld.js` + `/api/onderneming/dagbeeld` +
`/apps/onderneming.html`. De ondernemer hoort geen modules te zien. Hij opent
zijn bedrijf en ziet waar hij staat, wat er vandaag toe doet, en wat hij eraan
kan doen -- en dat scherm is **fase-bewust**, want dat is de hele belofte: een
idee krijgt geen debiteurenbeheer, een groep krijgt geen intakevragen meer.

**Het scherm verzint geen cijfers om zichzelf te vullen.** Een onderneming in de
ideefase heeft geen omzet, en dan staat er geen "€0" maar niets: nul is een
gemeten waarde en die suggereert dat er verkocht had kunnen worden. Elk cijfer
draagt `gemeten`, en wat niet gemeten is, staat als **reden** onder "niet
gemeten" in plaats van als getal.

**De gezondheidsscore loopt via dezelfde meter als de kansverkenning**
(`onderneming/meter.js`). Hoe je met ontbrekende bronnen omgaat is precies het
stuk dat je twee keer nét anders opschrijft, dus staat het één keer: niet-gemeten
telt ook niet mee in de noemer, onder twee bronnen komt er geen cijfer, en de
grondslag reist mee. Gevolg, en het is de bedoeling: **een onderneming zonder
zaak heeft één meetbare bron en krijgt dus geen cijfer.** Een bedrijf dat
gisteren begon en vandaag een 60 krijgt, heeft een cijfer over niets.

**De acties staan op gewicht, met een reden per stuk.** Wat het plan breekt
(een blokkerende bevinding) gaat vóór een ontbrekend intakeveld, en dat gaat vóór
"kies eens een rechtsvorm". Elke actie zegt waaróm hij er staat: een lijst
opdrachten zonder reden wordt een afvinklijst, en daarin verdwijnt ook de
belangrijke.

Eén ding dat het scherm bewust *niet* aanneemt: dat zijn eigen kopbalk blijft
staan. `shared/ios.js` bouwt de chrome om, en de eerste versie hier ging ervan
uit dat haar `<h1>` er daarna nog was -- waarop het hele scherm bleef hangen op
een `null`. Dat is geen fout van die laag maar van de aanname; er wordt nu alleen
naar de chrome geschreven als hij er nog is.

Getoetst in `test/onderneming-dagbeeld.test.js` (10) en
`test/onderneming-scherm.e2e.js` (4, in een echte browser). Zes mutaties, alle
zes raak: ontbrekende bronnen als nul meetellen, de bronnendrempel verlagen, een
omzet van nul tonen in plaats van niets, de acties niet meer op gewicht zetten,
de schil de 409 laten wegpoetsen door meteen `tochDoorzetten` mee te sturen, en
de schil ook de niet-gemeten cijfers laten tekenen.

### Het oprichtingsproject en de zaak: de reis afgemaakt

`server/kern/onderneming/{oprichting,aanvraag}.js` +
`/api/onderneming/{oprichting,oprichting/zet,aanvraag,aanvraag/stand}`. Het laatste
stuk: van een vastgelegd plan naar een zaak die draait.

**Zonder rechtsvorm geen lijst.** De oprichtingsstappen komen uit drie bronnen --
de rechtsvorm (gelezen uit `rechtsvorm.js`, niet overgetypt), de branche
(een restaurant heeft een alcoholvergunning nodig, een rijschool een
instructeurspas) en de situatie (samen ondernemen vraagt afspraken op papier,
geen startkapitaal vraagt een buffer). Omdat de helft van die stappen van de
rechtsvorm afhangt, geeft het project zonder die keuze géén halve lijst maar de
vraag: een lijst die compleet lijkt en het niet is, laat iemand langs de notaris
fietsen. En de lijst zegt zelf dat hij niet juridisch volledig is -- wie een
lijst afvinkt die zich compleet voordoet, controleert daarna niets meer.

**Er is geen tweede deur naar een zaak.** Een zaak aanmaken betekent partner
worden, en dat besluit is mensenwerk ("er is geen automatische toekenning",
`kern/aanmeldingen.js`). Het Ondernemers-OS maakt daarom **geen supplier** maar
een gewone aanmelding, precies zoals het aanmeldformulier -- alleen al ingevuld
met wat de intake weet. Zou het OS zelf provisioneren, dan stond er een deur
naast de deur waar een mens voor staat, en dat is de deur die niemand meer
bewaakt. De nog openstaande oprichtingsstappen gaan mee als `behoeften`, zodat de
bestaande provisioning ze omzet in de wensenlijst van de nieuwe zaak: wat hier
nog te doen stond, staat straks als startlijstje in de zaak zelf.

**Een fout die twee keer moest afgaan voordat hij goed gerepareerd was.** Beide
modules gaven een domeinstand terug in een veld `status` -- en `status` betekent
in elke route van dit huis de HTTP-code. `res.status('geen-rechtsvorm')` gooit,
dus een volstrekt correct verzoek viel om met een 500. De eerste reparatie
hernoemde het veld in één bestand; toen ging dezelfde fout af in het tweede. Dat
was symptoombestrijding (regel 1). De echte reparatie is nu tweeledig: de
kernmodules geven `stand`, én `stuur()` in de route leest alleen een écht
geheel getal tussen 100 en 599 als HTTP-code. Dat tweede maakt de hele klasse
onmogelijk in plaats van hem per aanroep te repareren. Die guard heeft zelf geen
eigen toets, want er is nu geen aanroeper meer die hem kan bereiken -- hij staat
hier genoemd zodat dat bekend is en geen belofte in tekst blijft.

Getoetst in `test/onderneming-oprichting.test.js` (14) en in de schermronde. Vier
mutaties, alle vier raak: zonder rechtsvorm tóch een lijst geven, een verzonnen
stap aannemen, het OS zelf een zaak laten aanmaken, en de aanvraag zonder
vastgelegd plan toelaten. De twee 500's hierboven zijn niet met een mutatie
gevonden maar in een echte ronde -- dat is sterker bewijs, geen zwakker.

### Klant nummer een, en de honderd daarna

`server/kern/onderneming/eersteklant.js` + `/api/onderneming/eersteklant`. Zodra
de zaak bestaat verandert het doel: niet meer "een bedrijf oprichten" maar er
moet iemand kopen. Deze laag meet hoe ver de zaak daarvoor klaarstaat en
verschuift daarna mee naar de volgende mijlpaal (1, 10, 25, 50, 100 klanten,
elk met wat er in die stap te leren valt -- een teller die alleen optelt is een
spelletje).

**De lijst hangt af van wat de zaak DOET, niet van een lijstje per genre.** Wat
"klaar" betekent komt uit de capslijst van `werkvormen.js`: een horecazaak
zonder kaart is niet klaar, een dienstverlener zonder diensten evenmin, maar een
dienstverlener heeft geen kaart nodig. Zet iemand een busje in de vloot, dan komt
de vlootstap er vanzelf bij. Een nieuw genre krijgt zo de goede lijst zonder dat
hier iets bij hoeft. En het mooiste geval staat als eigen toets vast: wie in zijn
eentje een restaurant runt **is** ook zelfstandige, en krijgt allebei.

**Er is geen tweede poort.** `kern/ondernemerpoort.js` loodst elke nieuwe zaak al
door de basis (Salon-pagina, rondleidingen) voordat zij online mag. Die stand
wordt hier gelezen en niet nagebouwd -- twee lijsten die allebei "is deze zaak er
klaar voor" beweren, lopen binnen een maand uiteen. Om diezelfde reden staat de
Salon-pagina hier **niet** als eigen stap: twee keer hetzelfde afvinken maakt van
een teller een leugen.

**Een percentage mag hier wel, en bij de kansscore niet.** Het verschil is dat
dit een telling is en geen weging: acht stappen, vijf gedaan, dat is exact. De
kansscore weegt bronnen van ongelijke betekenis en kan dat niet zijn. Zonder zaak
is er niets te tellen, en dan is het antwoord `null` en geen 0% -- 0% zou zeggen
dat er niets gedaan is, terwijl er niets te doen valt.

In het dagbeeld gaat deze stap vóór de losse openstaande aanvragen: een zaak die
niet online staat, krijgt er sowieso geen.

Getoetst in `test/onderneming-eersteklant.test.js` (16). Vijf mutaties, alle vijf
raak: de werkvormen negeren en iedereen alles vragen, een eigen Salon-stap naast
die van de poort zetten, zonder zaak toch 0% teruggeven, een wachtende boeking
als klant tellen, en de eerste-klant-actie onder de losse aanvragen laten zakken.

### Het Mall-profiel: de branche bepaalt de architectuur

`server/kern/onderneming/mallprofiel.js` + `/api/onderneming/mallprofiel`. De Mall
toont elke partner al, gegroepeerd per genre (`kern/mall/etalage.js`). Wat daar
niet stond is de vraag die de ondernemer stelt: **hoe hoort mijn pagina eruit te
zien, en wat mist er nog.** Een restaurant heeft een kaart, reserveren, bestellen
en bezorgen; een kapper heeft diensten, een agenda en vrije tijdvakken; een hotel
heeft kamers. Dat is geen opmaak maar architectuur.

**Maar niet via een lijst per branche.** Zo'n lijst zou de zoveelste genre-tabel
in dit huis zijn, en de eerste die vergeten wordt bij genre tweeëndertig. De
onderdelen hangen aan **caps**, en die komen uit `werkvormen.js` -- dezelfde
afleiding die de gereedschapskisten en de eerste-klant-lijst al gebruiken. Zet een
hotel er een busje bij, dan verschijnt het ritblok vanzelf. Drie onderdelen hangen
aan géén cap, omdat ze bij elke zaak horen: waar u zit, hoe het eruitziet, en uw
verhaal.

**Dit beslist niets over zichtbaarheid.** Of een zaak in de Mall stáát, bepalen de
ondernemerspoort en de salonregel, en die blijven de enige waarheid daarover. Deze
module beschrijft alleen de opbouw en zegt per onderdeel of de gegevens er zijn --
een zaak die offline staat kan een volledig ingevulde pagina hebben. Dat
voorbehoud staat in het antwoord zelf en niet alleen in de code.

`GENRE_PAGINA` (waar een genre in de app geboekt wordt) is voor deze module
geëxporteerd uit `kern/mall` in plaats van overgetypt: een tweede kaart met
dezelfde paden loopt uiteen zodra er een genre bij komt.

In het dagbeeld komt de Mall-pagina ná de etalage-check: online staan gaat voor,
want een pagina die niemand ziet is geen pagina.

Getoetst in `test/onderneming-mallprofiel.test.js` (10). Vijf mutaties, alle vijf
raak: de caps negeren en elke zaak alles geven, de vaste onderdelen tóch aan een
cap hangen, een eigen paginakaart naast die van de Mall zetten, het profiel over
zichtbaarheid laten beslissen, en de Mall-actie boven de etalage-check laten
kruipen.

### Het klantenboek en de relaties (het CRM)

`server/kern/klantenboek.js` + `server/kern/onderneming/relaties.js` +
`/api/onderneming/relaties{,/notitie}`.

**Er is nu één klantenboek.** Het stond in `kern/vakwerk/pro2.js` en gold alleen
voor de vakgenres, terwijl de vraag "wie zijn mijn klanten" niet aan een genre
hangt: een restaurant, een winkel en een hotel hadden er geen. Het staat nu in
`kern/klantenboek.js` en Vakwerk gebruikt diezelfde -- twee boeken naast elkaar
lopen uiteen. Twee dingen zijn bewust zo gebleven: de opslagsleutel blijft
`vakKlantNotities` (een mooiere naam is geen reden om data te verhuizen; een
migratie die niets oplost is puur risico), en het draait op **codenaam**. Dat
laatste is geen tekortkoming maar het ontwerp, en een CRM is precies de plek waar
die regel anders stilletjes zou sneuvelen. Wat er wél veranderde: **bonnen tellen
mee**. Wie bij dezelfde zaak at maar niet boekte, bestond in het oude boek niet.

**Er komen geen leads en prospects bij, en dat is een keuze.** Een echte
CRM-pijplijn begint bij een lead, maar binnen RTG bestaat geen enkel proces dat
leads *produceert*: niemand importeert een lijst, geen formulier maakt een
prospect. Zo'n register zou hier een lege tabel zijn die alleen met de hand te
vullen is -- precies het soort register dat na twee weken niemand bijhoudt en
daarna verkeerde cijfers geeft. Wat er wél is, is echt: transacties,
offerte-aanvragen en boekingen die op antwoord wachten. Komt er ooit een echte
leadbron, dan past die hier gewoon bij.

**De segmenten zijn geteld, niet geraden**: nieuw (kocht een keer), terugkerend,
en stilgevallen (kocht vaker, maar is 120+ dagen weg). Geen AI-oordeel, want dan
hangt de indeling af van een sleutel die er niet altijd is en verschuift zij
zonder dat er iets gebeurd is. Een **eenmalige** klant die lang wegblijft geldt
niet als stilgevallen: daar is stilte normaal, en dat verwijt slaat nergens op.

**De opvolging rust op wat er echt staat** -- openstaande aanvragen, offertes
zonder prijs (met apart wie er langer dan zeven dagen ligt), en vaste klanten die
stil vielen. Geen enkele regel is een herinnering die wij verzonnen: een rustige
zaak krijgt een lege lijst, want niets te doen is ook een uitkomst.

In het dagbeeld gaat de opvolging vóór de Mall-pagina (geld binnen handbereik gaat
voor een mooiere pagina), en de oude losse "aanvragen"-actie valt weg zodra de
opvolging hem al noemt -- twee keer hetzelfde vragen leest als een storing.

Getoetst in `test/onderneming-relaties.test.js` (12). Vijf mutaties, alle vijf
raak: bonnen niet meetellen, een wachtende boeking als klant tellen, eenmalige
klanten als stilgevallen bestempelen, offertes van andere zaken meetellen, en de
losse aanvragen-actie er tóch dubbel bij laten komen.

### Debiteuren: wat er nog open staat, en hoe lang al

`server/kern/onderneming/debiteuren.js` + `/api/onderneming/debiteuren`, met de
betaalstatus zelf in `kern/facturatie/motor.js` en het afboeken op
`/api/supplier/facturen/betaald`.

De facturatie bestond al -- nummers, btw, een PDF, per zaak uitgaand en inkomend.
Wat er niet was, is de vraag die elke ondernemer stelt zodra hij op rekening
werkt: **wat staat er nog open.** Facturen droegen geen betaalstatus en geen
vervaldatum, dus gold elke factuur impliciet als afgedaan en bestond er geen
debiteurenlijst. Die twee velden zitten er nu bij de bron in: de stand wordt niet
geraden waar hij gezegd kan worden (`betaald` van de aanroeper telt), en anders
geldt een aanwezige betaalmethode als bewijs -- die wordt alleen gezet als er echt
is afgerekend.

**De geschiedenis telt als betaald, en dat is expliciet.** Bestaande facturen
hebben het veld niet. Zou "geen veld" als open gelden, dan stond morgen alles wat
ooit gefactureerd is op de debiteurenlijst: een alarm dat niets betekent, en
precies daarom binnen een week niet meer gelezen wordt. Dezelfde grandfathering
als `online !== false` bij de ondernemerspoort.

**De ouderdomsgroepen zijn geteld, niet gewogen** -- loopt nog, 1-14, 15-30,
31-60, 60+ dagen over. Er komt bewust géén risicoscore uit: "betalingsrisico" zou
hier een getal zijn dat op niets rust, want wij zien alleen deze zaak en niet het
betaalgedrag van die klant elders. Een factuur zonder vervaldatum wordt apart
geteld in plaats van in de jongste groep gegooid: niets weten is iets anders dan
"loopt nog". De oudste post staat er apart bij, want een klein bedrag van drie
maanden oud zegt meer dan het totaal.

**Alleen de verkoper boekt af.** Een koper die zijn eigen factuur op betaald zet,
is geen betaling maar een bewering. Terugdraaien mag wel -- een vergissing hoort
herstelbaar te zijn.

In het dagbeeld gaan vervallen facturen vóór de rest van de opvolging: dat is het
meest concrete geld dat er ligt, al verdiend en alleen nog niet binnen. Wat nog
lóópt is geen actie maar de normale gang van zaken.

Getoetst in `test/onderneming-debiteuren.test.js` (12), inclusief alle vijf
groepsgrenzen. Vijf mutaties, alle vijf raak: "geen betaalstatus" als open lezen,
op de vervaldag al vervallen zijn, een factuur zonder vervaldatum in "loopt"
gooien, iedereen laten afboeken, en ook lopende facturen een actie laten worden.

### Crediteuren: wat er nog uit moet, en wanneer

`server/kern/onderneming/crediteuren.js` + `/api/onderneming/crediteuren`, met het
gedeelde rekenwerk in `server/kern/onderneming/ouderdom.js`.

De spiegel van de debiteuren, op dezelfde facturenlijst: waar de ene kant kijkt
naar wat deze zaak heeft **verstuurd** en nog niet binnen is, kijkt deze naar wat
zij heeft **ontvangen** en nog niet betaald.

**Het rekenwerk is gedeeld, de teksten niet.** Of iets twintig dagen over is, is
rekenkunde en aan beide kanten hetzelfde; dat staat nu één keer in `ouderdom.js`
(grenzen, `dagenOver`, `groepVan`, `deelIn`). Wat je eraan dóét verschilt wél: bij
een debiteur is "bel de klant" het advies, bij een crediteur "betaal, of uw
leverancier stopt met leveren". Die teksten wonen daarom bij de kant zelf --
zouden ze gedeeld zijn, dan stond er binnen een maand aan één van beide kanten een
zin die er niet hoort.

**Een asymmetrie die er echt is, en die niet wordt weggepoetst.** Een factuur
wordt afgeboekt door de **verkoper**, want alleen hij ziet of het geld binnen is.
Voor de koper betekent dat: een factuur die hij vandaag betaalt, blijft op zijn
lijst staan tot de verkoper hem afboekt. Dat is ongemakkelijk, maar het
alternatief is erger: een tweede vlag "ik heb betaald" naast de eerste maakt twee
waarheden over één factuur, en dan is niet meer te zeggen welke telt. Het staat
daarom in het antwoord, zodat een scherm het kan uitleggen in plaats van dat
iemand denkt dat de lijst kapot is.

**De vooruitblik is een optelsom, geen prognose.** Wat er de komende week en maand
uit moet, is de som van de vervaldata die er al liggen -- posten zónder
vervaldatum tellen niet mee, want dat zou een bedrag suggereren dat op een datum
rust die er niet is. Er zit geen voorspelling in van wat er nog bij komt, en dat
staat er ook bij: een liquiditeitsprognose die doet alsof zij de toekomst kent, is
precies het soort getal waar iemand een beslissing op neemt.

In het dagbeeld komen vervallen crediteuren direct ná de debiteuren: allebei geld
dat al vaststaat, maar wat binnenkomt betaalt wat eruit moet.

Getoetst in `test/onderneming-crediteuren.test.js` (11). Vijf mutaties, alle vijf
raak: de spiegel omdraaien, de debiteuren-teksten aan de crediteuren geven, de
vooruitblik posten zonder vervaldatum laten meetellen, van de gedeelde rekenkern
een eigen kopie maken, en uitgaand geld boven binnenkomend geld zetten.

### De contractklok op het dagbeeld

`server/kern/onderneming/contracten.js` + `/api/onderneming/{contracten,werkruimte}`,
met de gedeelde klok in `server/bedrijf/contractklok.js`.

**Hier is geen contractregister gebouwd, en dat is het hele punt.** RTG Werk OS
heeft er al een (`server/bedrijf/contract.js`): soorten, tekenen met twee namen,
opzeggen, en een klok die de laatste opzegdag **uitrekent** uit de einddatum en de
opzegtermijn in plaats van hem te laten overtypen. Dat is beter dan wat hier in
een middag zou ontstaan, en een tweede register zou vooral betekenen dat een
ondernemer twee lijsten heeft en niet weet welke telt.

Wat er wél ontbrak was de **brug**. De contractbibliotheek hangt aan een
werkruimte -- een eigen wereld met een eigen code en inlog -- en een onderneming
wist daar niets van. Een verzekering die stil afliep, stond dus in een systeem dat
de ondernemer op zijn dagbeeld niet zag. Die koppeling is er nu, en deze laag
**leest alleen**: aanmaken, tekenen en opzeggen blijft in het Werk OS achter zijn
eigen poort. De klok zelf is uit `contract.js` gelicht naar `contractklok.js`,
zodat beide kanten dezelfde berekening gebruiken (zelfde patroon als
`ouderdom.js` bij de debiteuren).

**Geen werkruimte is een eigen stand, geen lege lijst.** Wie niets koppelde, heeft
geen "nul contracten" maar een register dat wij niet kunnen zien -- `aantal` is
`null`, met de zin erbij dat dit géén bevestiging is dat er niets loopt. Een
ontbrekende koppeling die als "alles in orde" leest, is precies het soort stilte
waar deze module tegen bedoeld is.

**De klok is te zetten, want anders is hij niet te toetsen.** `contractklok.js`
neemt de dag als parameter, en `ondernemingDagbeeld(o, nu)` geeft hem door aan de
vier lagen die op de klok leunen (relaties, debiteuren, crediteuren, contracten).
In productie geeft niemand hem mee en geldt gewoon nu.

In het dagbeeld staat de contractklok ná het geld dat vaststaat, maar vóór de
gewone opvolging: een gemiste opzegdag is al gebeurd en kost een jaar, waar een
klant die niet terugbelt nog te bereiken is. En een gemiste opzegdag gaat voor een
naderende, om dezelfde reden.

Getoetst in `test/onderneming-contracten.test.js` (14). Vijf mutaties, alle vijf
raak: geen werkruimte als lege lijst tonen, een onbekende werkruimtecode aannemen,
ook concepten stilzwijgend laten verlengen, de opzegdag gelijkstellen aan de
einddatum, en een naderende opzegdag boven een gemiste zetten.

### Opzij zetten: de btw en de winstreservering

`server/kern/onderneming/belasting.js` + `/api/onderneming/belasting`.

De belastingtool bestond al (`kern/fiscaal/zzp.js`): een indicatieve
jaarberekening per land met een reserveringspercentage. Wat ontbrak was de
koppeling aan wat er **echt is gefactureerd** -- de ondernemer moest zelf een
verwachte jaarwinst intypen, en precies dat getal is het getal dat hij niet weet.
Deze laag rekent op de facturen die er staan, en houdt twee dingen streng uit
elkaar.

**De btw is geen schatting.** Wat u in rekening bracht min uw voorbelasting is een
optelsom uit uw eigen facturen. Dat geld is nooit van u geweest; het staat alleen
even op uw rekening. Het is het enige harde getal hier, en daarom het enige dat
een actie op het dagbeeld oplevert -- een herinnering hangen aan een indicatie zou
een schatting tot een schuld maken.

**Voor een rechtspersoon wordt er niets uitgerekend.** `zzpBerekening` is de
inkomstenbelasting van een IB-ondernemer; een B.V. betaalt vennootschapsbelasting
en kent DGA-loon, een stichting heeft geen winstoogmerk. Datzelfde sommetje op een
rechtspersoon loslaten geeft een getal dat er precies zo uitziet als een goed getal
en het niet is. Er komt dus geen bedrag maar de reden -- de rechtsvorm-as weet dat
al. De btw geldt intussen gewoon: die hangt niet aan de rechtsvorm.

**Extrapolatie heet extrapolatie.** Naast de reservering op wat er nu al staat
(een tarief toegepast op geld dat al verdiend is) staat wat het wordt als dit
tempo het hele jaar doorzet, met het aantal verstreken dagen erbij en het woord
"doortrekking van vandaag, geen prognose".

**De aannames staan in het antwoord, en waar wij iets niet weten kiezen we de
kant die de reservering hóger maakt.** Het urencriterium wordt afgeleid uit de
opgegeven uren (1225 uur per jaar is ruwweg 24 uur per week); staat er niets, dan
nemen we aan dat het gehaald wordt en zeggen we dat. De **startersaftrek rekenen
we niet mee**: die hangt af van hoe vaak iemand hem al gebruikte, en meenemen zou
de reservering te laag maken.

Getoetst in `test/onderneming-belasting.test.js` (16). Vijf mutaties; drie beten
meteen. **Twee sloegen af, en dat waren allebei echte bevindingen over mijn eigen
werk:**

- Er stond een `Math.max(percentage, berekende belasting)` "voor de zekerheid",
  met een comment dat bescherming beloofde bij hoge winsten. Nagemeten over elke
  winst van 1.000 tot een miljoen: die max bond **nul keer**. `reserveerPct` is het
  tarief plus vijf punten met een bodem van 20%, dus hij dekt de indicatie altijd
  al. Dode code met een belofte eraan is erger dan geen code; hij is weg, en de
  toets bewaakt nu de eigenschap die er wél is.
- De toets op "startersaftrek telt niet mee" las een hardgecodeerde `false` uit
  het antwoord in plaats van de werkelijk gebruikte optie. Die kon dus nooit
  zakken (regel 9). De waarde komt nu uit de opties, en de toets vergelijkt de
  uitkomst mét en zónder die aftrek.

### De kasvooruitblik: waar kom ik uit over dertig dagen

`server/kern/onderneming/kas.js` + `/api/onderneming/kas{,/saldo}`. Drie beelden
die er al waren, bij elkaar gelegd: wat er binnenkomt (debiteuren), wat eruit moet
(crediteuren) en wat er niet van u is (btw). Ze worden **meegegeven** en niet
opnieuw uitgerekend -- twee keer dezelfde vraag stellen kan twee antwoorden geven.

**Het grootste probleem is wat wij niet weten: het banksaldo.** RTG ziet facturen,
geen bankrekening. Een kaspositie zonder beginsaldo is dus geen positie maar een
som van bewegingen, en die twee door elkaar halen is precies hoe iemand denkt dat
het goed komt terwijl de rekening leeg is. Daarom staat er standaard een
**beweging**, en pas een stand zodra de ondernemer zelf een saldo opgeeft -- met
de datum erbij, want een saldo van drie maanden geleden is geen saldo. Boven de
31 dagen heet het verouderd, met de reden erbij.

**De onzekerheid ligt niet symmetrisch, en dat is expres.** Geld dat u nog moet
krijgen en al te laat is, telt **niet** mee als inkomend: te laat is precies de
reden om er niet op te rekenen. Geld dat u moet betalen en al te laat is, telt
**wel** mee: dat moet u sowieso voldoen. Beide keuzes maken het beeld somberder,
en dat is de kant waarop een kasprognose hoort te leunen. Een toets legt dat vast
met een geval waar de optimistische lezing +7.000 zou zeggen en de eerlijke -3.000.

Wat te laat openstaat verdwijnt daarmee niet uit beeld: het staat apart als
**onzeker**, met bedrag en aantal. Het is geen nul (het bestaat) en geen inkomen
(het had er al moeten zijn).

**Er zit geen voorspelling in.** Wat er de komende maand nog aan nieuwe omzet bij
komt, weten wij niet en verzinnen wij niet. Dit is een optelsom van wat er nu ligt,
met de vervaldata die er nu op staan; loon, huur en abonnementen buiten RTG zitten
er niet in, en dat staat in het antwoord.

Op het dagbeeld staat de kasvooruitblik bovenaan het geldblok -- de optelsom zegt
meer dan elke losse post eronder -- en alleen een negatieve beweging levert een
waarschuwing op. Een positieve maand is geen actie, en een waarschuwing die elke
maand komt is geen waarschuwing.

Getoetst in `test/onderneming-kas.test.js` (14). Zes mutaties, alle zes raak: te
late debiteuren tóch meetellen, te late crediteuren laten wegvallen, een
beginsaldo van nul verzinnen, een oud saldo niet laten verouderen, ook een
positieve maand laten waarschuwen, en de kasregel onder de losse posten laten
zakken.

### Capaciteit: kan er nog iets bij

`server/kern/onderneming/capaciteit.js` + `/api/onderneming/capaciteit`, met de
tijdhelpers in `server/kern/agendatijd.js`. Na het geld is dit wat een ondernemer
als eerste raakt. De gegevens stonden er al: werkdagen en openingstijden
(`vakUren`), de teamgrootte, en de boekingen met de duur van de dienst erbij.

**Wat hier niet wordt uitgerekend: gemiste omzet.** Het is verleidelijk om te
zeggen "u loopt 6.800 euro per maand mis door capaciteitsgebrek", en het klinkt
precies als het soort inzicht waar software voor is. Maar wij zien geen vraag die
nooit is gesteld: iemand die de agenda vol zag en wegklikte, staat nergens. Zo'n
bedrag zou een verzinsel zijn met een euroteken ervoor -- en juist dat wordt
overgeschreven in een besluit om iemand aan te nemen. Wat er wél staat is wat er
is: hoeveel dagen zaten vol, hoeveel procent van uw tijd is bezet, hoeveel
aanvragen bleven liggen. Een toets bewaakt dat de module nergens een bedrag
uitleest.

**De bezetting is een exacte deling** -- geboekte minuten door beschikbare minuten
-- en daarmee iets anders dan de scores elders in dit OS, die bronnen van ongelijk
gewicht optellen. Werk op een niet-werkdag telt wel als bezette tijd maar niet als
beschikbare; de uitkomst kan dus boven de 100% uitkomen, en dat is de eerlijke
uitkomst: u werkt dan meer dan u zelf hebt opgegeven.

**Zonder agenda geen bezetting.** Een winkel of restaurant heeft geen `vakUren`,
en daar betekent capaciteit iets heel anders (stoelen, voorraad, vierkante
meters). Dan komt er een eigen stand en geen 0%: een winkel die als "0% bezet"
leest, is een verkeerd antwoord op een vraag die niet is gesteld.

**Buiten de eigen uren werken weegt zwaarder dan een volle agenda.** Dat is al
gebeurd en het is de stille manier waarop iemand zichzelf opbrandt; een volle
agenda is nog te sturen. Op het dagbeeld staat capaciteit ná het geld en de klok,
maar vóór de gewone opvolging: meer klanten werven terwijl de agenda vol staat, is
werk dat u daarna moet weigeren.

De vier tijdhelpers (`datumVan`, `tijdVan`, `naarMin`, `naarTijd`) stonden inline
in `kern/vakwerk/index.js` en staan nu in `kern/agendatijd.js`. Ze zijn klein, maar
dragen een gedeelde waarheid: waar de datum en tijd van een boeking vandaan komen.

Getoetst in `test/onderneming-capaciteit.test.js` (15). Zes mutaties, alle zes
raak. Drie toetsen zakten eerst op mijn eigen aannames, niet op de code: `dag(5)`
bleek een zaterdag en geen vrijdag (nagerekend in plaats van aangenomen, en de
weekdagen staan nu als constante in de toets), een winkel van één persoon ís
volgens `werkvormen.js` ook zelfstandige en krijgt dus wél een agenda, en mijn
regex tegen "gemiste omzet" sloeg aan op mijn eigen voorbehoud en op het woord
"prijs" in een adviestekst -- die zoekt nu naar het uitlezen van een bedrag, wat
de eigenlijke vraag was.

### Werving: staat er iemand te wachten

`server/kern/onderneming/werving.js` + `/api/onderneming/werving`. Vacatures en
sollicitaties bestaan al (`db.data.vacatures`, `db.data.applications`); deze laag
bouwt daar niets naast maar **telt en klokt** ze, en legt de uitkomst naast de
bezetting.

**Hier staan geen namen.** Een sollicitatie draagt in de opslag een echte naam en
contactgegevens -- die heeft een werkgever ook nodig om iemand aan te nemen, en
daarvoor is de personeels-app. Maar dit is een signaallaag op het dagbeeld, en
daar is een aantal en een wachttijd genoeg. Elke naam die hier zou opduiken, is
een naam op een scherm waar hij niet voor nodig is; dat is precies hoe de
codenaam-regel elders sneuvelt. Een toets controleert dat er geen naam, geen
contactgegeven en zelfs geen codenaam in het antwoord terechtkomt.

**Het probleem is niet werven maar antwoorden.** Een sollicitatie die drie weken
blijft liggen, is een kandidaat die intussen ergens anders begint -- en de zaak
denkt dat er niemand reageerde. De wachttijd van de oudste openstaande
sollicitatie is daarom het getal dat op het dagbeeld komt, niet het aantal
vacatures.

**Wat een extra persoon doet, is rekenkunde en geen belofte.** De beschikbare tijd
in `capaciteit.js` schaalt recht evenredig met de teamgrootte, dus de bezetting bij
n+1 mensen is exact uit te rekenen: van 92% naar 61% bij een team van twee. Wat er
niet bij staat is of die persoon zichzelf terugverdient -- daarvoor zouden wij
vraag moeten kennen die nooit is gesteld.

Op het dagbeeld staat werving direct achter capaciteit: het is het antwoord op
dezelfde vraag. En "vol maar niemand gezocht" verschijnt alleen als de bezetting
echt gemeten is -- zonder agenda weten wij niet of het druk is.

Getoetst in `test/onderneming-werving.test.js` (15). Zes mutaties; vijf beten
meteen. **De zesde sloeg af en legde een gat in mijn toets bloot:** bij een team
van één is `n/(n+1)` toevallig gelijk aan de helft, dus een formule die altijd
halveert kwam er ongestraft doorheen. Er staat nu een tweede geval met een team
van drie (drie kwart, niet de helft); daarna beet de mutatie wel.

### De ondernemersregie: twee knoppen van de boardroom

`server/kern/onderneming/regie.js` + `/api/office/ondernemersregie{,/provisioning,/bijdrage}`.
RTG bepaalt zelf hoe streng of hoe soepel het Ondernemers-OS staat. Twee dingen
die niets met elkaar te maken hebben, en die daarom apart staan.

**1. Provisioning -- wanneer wordt de ZAAK klaargezet.** Drie standen: `mens`
(personeel beoordeelt elke aanvraag), `na-termijn` (de zaak komt er zodra de
eerste termijn is afgetekend) en `automatisch` (wie zijn plan vastlegt, krijgt
direct een werkende zaak).

**Een onderscheid dat nooit mag vervagen:** een *zaak* klaarzetten is
operationeel werk; een *pas* toekennen is toegang verlenen tot RTG zelf, en dat
blijft mensenwerk. `magAutomatischToekennen` in `kern/aanmeldingen.js` geeft voor
geen enkele pas `true`, in welke stand deze knop ook staat. Zou één knop beide
regelen, dan stond er een schuifje waarmee iemand per ongeluk de merkregel uitzet.
In de stand `automatisch` loopt het klaarzetten bovendien langs **dezelfde**
provisioning die het personeel anders in gang zet (`provisioneerId`), dus er komt
geen tweede manier bij om een zaak te maken -- en de idempotentie blijft staan.

**Soepeler zetten vraagt een naam, strenger zetten nooit.** Hetzelfde principe als
de bankregie: een terugval blokkeer je niet. Elke wijziging komt met wie hem zette
in een journaal.

**2. De bijdrage -- wat RTG per transactie inhoudt.** `rtgCut` was in het
partnerkanaal een constante 0 ("RTG verdient niets aan een boeking"); dat is nu een
knop. Staat de bijdrage uit, dan komt er nog steeds nul uit en verandert er niets
aan wat een partner krijgt. Drie dingen worden nooit geraden:

- **het percentage**, ten hoogste 5% -- die bovengrens staat in code en niet in
  een instelling, zodat hij niet per ongeluk hoger wordt gezet;
- **de grondslag**: `via-rtg` (het enige dat RTG zelf kan meten, en de
  beginstand), `betaald` (beschermender: over een factuur die nooit binnenkomt
  draagt niemand af) of `totaal` -- die laatste draagt zijn eigen waarschuwing dat
  RTG hem **niet** kan meten en dus op opgave rust;
- **de drempel** waaronder er niets wordt ingehouden. Dat is geen coulance maar
  het punt van de constructie: bij lage omzet hoort de bijdrage beschermend te
  werken, niet mee te zuigen.

De bijdrage wordt over de **service** genomen en niet over het totaal: de netto
reissom is het geld van de aanbieder, en een percentage over andermans inkoop is
geen bijdrage maar een boete op omzet. Aanzetten vraagt een naam én een
percentage -- een bijdrage die aanstaat op nul is een schakelaar die niets doet en
wel zo lijkt.

Getoetst in `test/onderneming-regie.test.js` (14). Zes mutaties, alle zes raak:
soepeler zetten zonder naam toestaan, strenger zetten óók een naam laten vragen,
de bovengrens van 5% weghalen, de drempel negeren, aanzetten op nul procent
toestaan, en de bijdrage van de netto reissom afhalen in plaats van van de service.

### Sales OS: de pijplijn

`server/kern/onderneming/pijplijn.js` + `pijplijn-opvolging.js` +
`/api/onderneming/pijplijn`. Offertes bestonden al (`db.data.vakOffertes`, gevuld
door `kern/vakwerk/pro.js`); deze laag bouwt er geen tweede stroom naast, maar
leest hem, groepeert hem in stadia en rekent uit wat er echt openstaat. Er staat
nergens een schrijfactie op die stroom: antwoorden, weigeren en akkoord geven
blijft waar de klant het ziet.

**Twee open stadia, en ze zijn niet hetzelfde.** Bij `aangevraagd` ligt de bal
bij de ondernemer -- en omdat er nog geen prijs op staat, heeft dat stadium
**geen bedrag**. Er komt daar geen schatting uit eerdere klussen: dat zou een
omzetverwachting zijn die de ondernemer nooit heeft uitgesproken. Bij
`aangeboden` ligt de bal bij de klant, en dat is het enige bedrag dat de pijplijn
kent.

**De forecast is een meting of hij is er niet** (lat-regel 10). De gewogen
verwachting is het openstaande bedrag maal de scoringskans, en die kans komt uit
de eigen beslissingsgeschiedenis van deze zaak. Onder vijf afgeronde offertes is
er geen kans en dus geen verwachting -- dan staat er `null` met de reden erbij, en
geen brancheaanname of vrolijke 50%.

**Wat de zaak zelf afwees, is geen verloren verkoop.** Een offerte die de
ondernemer weigerde en een offerte die de klant introk zijn twee verschillende
gebeurtenissen; opgeteld leest een volle agenda als een slecht verkoopjaar. Alleen
het tweede telt mee in de scoringskans, en beide worden apart geteld.

De wachttijd van een uitgebrachte offerte loopt vanaf de **prijs** en niet vanaf
de aanvraag: een klant die drie dagen nadenkt over een offerte van veertig dagen
oud, laat niets liggen. De doorlooptijd naar een prijs is een mediaan -- één
offerte die een half jaar bleef liggen laat een gemiddelde de hele zaak traag
maken. Op het dagbeeld staat de pijplijn vóór de gewone opvolging: een
uitgebrachte offerte is verricht werk dat staat te verdampen, waar een aanvraag
nog niets in zich heeft. Aanvragen zonder prijs noemt `relaties.js` al; de
pijplijn herhaalt die regel niet. Alles op codenaam.

Getoetst in `test/onderneming-pijplijn.test.js` (14). Zeven mutaties, alle zeven
raak: aanvragen tóch een bedrag van 0 geven, eigen weigeringen als verlies
meetellen, de drempel van vijf beslissingen weghalen, de stiltijd vanaf de
aanvraag klokken, de mediaan door een gemiddelde vervangen, het scorings-verwijt
ook zonder meting laten verschijnen, en de pijplijn-acties achter die van de
relaties zetten.

### Rechtsvormen: Nederland en het buitenland, automatisch bijgewerkt

`server/kern/onderneming/rechtsvorm.js` (het register en de logica),
`rechtsvorm-nl.js`, `rechtsvorm-europa.js` (BE, DE, FR, ES),
`rechtsvorm-angelsaksisch.js` (GB, US) en `rechtsvormwacht.js` +
`/api/onderneming/rechtsvormen[?land=DE]` en
`/api/office/rechtsvormwacht{,/check,/zet}`.

**Een register, elk met zijn land.** De Nederlandse vormen houden hun kale id
(`bv`, `stichting`): die staan in de opslag van bestaande ondernemingen, en een
hernoemde id laat een bestaand bedrijf achter zonder rechtsvorm. Buitenlandse
vormen dragen hun landcode in het id (`de-gmbh`). De twee landentabellen staan
apart omdat ze een andere rechtstraditie beschrijven -- op het continent
ontstaat een kapitaalvennootschap bij de **notaris**, in de angelsaksische
landen door **registratie** -- en dat verschil zit in bijna elke
oprichtingsstap.

**Wat wij niet weten, staat er niet.** Voor een land dat wij niet kennen komt er
geen ongeveer-Nederlandse lijst maar een expliciet "wij kennen de rechtsvormen
van dit land niet", met de landen die wij wel kennen erbij. Wie op de verkeerde
lijst afgaat, gaat naar de verkeerde instantie. Om dezelfde reden noemt elke
stap de instantie van het land zelf (KBO, Handelsregister, Companies House) en
draagt geen buitenlandse vorm een Nederlands fiscaal begrip als
`urencriterium` of `dga-loon` -- daar staat `winst-bij-eigenaar` of
`winstbelasting-rechtspersoon`. En de Verenigde Staten zeggen zelf dat het
bedrijfsrecht daar van de **staat** is en niet van de federatie.

**De Nederlandse belastingsom blijft Nederlands.** `zzpBerekening` rekent met
Nederlandse regels; `belasting.js` weigert daarom te rekenen zodra het land van
de rechtsvorm niet NL is, met de reden in het antwoord. De btw-optelsom uit de
eigen facturen blijft wel staan -- dat is een som en geen tarief.

**De Rechtsvormwacht** is dezelfde constructie als de Regelwacht: een
gevalideerde overlay op het gedeelde register, herstart-vast
(`db.data.rechtsvormRegels`), met een dagelijkse controle op
`RECHTSVORM_BRON_URL` en de ingebouwde tabel als veilige basis. Vier grendels
die een bron nooit kan openen:

- **verboden groeit alleen** -- een bron mag een verbod toevoegen en er nooit
  een weghalen, anders is één regel in een bestand genoeg om een stichting
  winst te laten uitkeren;
- **caps komen uit het woordenboek** van dit huis; een verzonnen naam vult geen
  scherm maar kan wel een knop laten opduiken die niemand ontwierp;
- **rechtspersoon en notarieel liggen vast** zodra een vorm bestaat -- die
  eerste stuurt de belastinggrendel aan;
- **een rechtsvorm verdwijnt nooit**: er kan een onderneming aan hangen.

Een nieuwe vorm (ook in een nieuw land) mag er wel bij, maar alleen compleet:
zonder label, landcode, expliciete `rechtspersoon` en een gevulde
oprichtingslijst komt hij er niet in. Een halve rechtsvorm is erger dan geen,
want hij verschijnt wel in de keuzelijst.

Getoetst in `test/onderneming-rechtsvormen.test.js` (21). Acht mutaties; zeven
beten meteen. **De achtste sloeg af en legde een gat in mijn toets bloot:** ik
toetste wel een vorm zónder `oprichting`-veld, maar niet een met een lege lijst
-- en juist die kwam er ongestraft doorheen. Er staat nu een geval met
`oprichting: []`; daarna beet de mutatie wel.

### De offertebouwer: een prijs die is opgebouwd in plaats van bedacht

`server/kern/onderneming/offertebouw.js` + `server/kern/regelsom.js`, gebruikt
door `offerteAntwoord` in `kern/vakwerk/pro.js`
(`/api/supplier/vak/offerte/antwoord`, ongewijzigde route).

De offertestroom vroeg de zaak om één getal. Dat werkt, en het gaat mis zodra
een klus uit meer dan één ding bestaat: de ondernemer rekent het op een kladje
uit, de klant krijgt een bedrag zonder te zien waarvoor, en bij het factureren
begint het rekenwerk opnieuw. Nu kan de prijs uit **regels** komen — uit het
eigen aanbod (de prijs komt daarvandaan, dus een tariefverhoging werkt door
zonder dat er een offerte wordt nagelopen) of los ingevoerd (materiaal,
voorrijkosten). De regels reizen mee naar de klant.

**Een dienst die niet bestaat wordt geweigerd, niet stil overgeslagen.** Anders
denkt de ondernemer dat zijn tarief in de offerte staat terwijl er iets anders
of niets staat — en dat is een te lage offerte die er compleet uitziet. Om
dezelfde reden heeft elke losse regel een omschrijving nodig: een bedrag zonder
reden leest de klant als willekeur.

**De som staat niet in de bouwer.** `kern/regelsom.js` is nieuw en rekent hem,
dezelfde functie die de factuurmotor nu gebruikt (die had zijn eigen kopie). Een
offerte van 1.000 euro die een factuur van 999,99 oplevert, is een cent waar een
klant een mail over stuurt en niemand het antwoord op weet. Stukprijzen zijn
inclusief btw en de btw wordt per regel teruggerekend, zodat 9% en 21% in
dezelfde offerte kunnen staan.

**De offertestroom blijft de enige schrijver.** De bouwer is puur: hij leest de
zaak en rekent. De status, de melding aan de klant en de boeking bij akkoord
blijven waar ze stonden. Alleen een prijs opgeven mag ook nog steeds — een klus
van een uur is soms gewoon een bedrag.

Getoetst in `test/onderneming-offertebouw.test.js` (15). Zeven mutaties, alle
zeven raak: een onbekende dienst stil overslaan, een meegestuurde prijs het
eigen tarief laten overschrijven, de btw-lijst laten uiteenlopen met die van de
facturatie, de btw verkeerd terugrekenen, een eigen tarief per regel negeren,
een fout uit de bouwer negeren, en een losse regel zonder omschrijving
doorlaten.

### Het bestuur: wie beslist, wie bezit, en wie er als UBO uit volgt

`server/kern/onderneming/bestuur.js` + `bestuur-handelingen.js` +
`/api/onderneming/bestuur{,/zet,/af}` en
`/api/onderneming/aandeel/{zet,weg}`.

**Dit bestaat alleen waar het echt bestaat.** Een eenmanszaak heeft geen bestuur
en geen aandeelhouders — de ondernemer *is* de onderneming. Zou dat scherm er
toch staan, leeg, dan leest het als "u moet dit nog invullen", en dan verzint
iemand een bestuur voor een bedrijf dat er geen kan hebben. Zonder rechtsvorm
komt er de vraag en geen register.

**Het verbod wint, ook hier.** Een stichting kent geen aandelen. Dat komt uit
dezelfde `verboden` als de capslijst — er staat in dit bestand geen enkele
rechtsvormnaam, want dat zou een tweede waarheid zijn. Onderweg bleek die
grendel eerst *decoratie*: de cap heet `aandeelhouders` en het verbod heet
`aandelen`, dus de aftrek raakte niets. Het bestuur leest nu de samengevoegde
capslijst van `beeld.js`, waarin `aandelen` als kandidaat meereist — pas daarna
wint het verbod ook van een werkvorm die de cap zou meebrengen.

**De UBO wordt afgeleid en niet ingevuld.** Meer dan 25% van de aandelen is
uiteindelijk belanghebbende; is er niemand, dan gelden de statutair bestuurders
(pseudo-UBO), en commissarissen en adviseurs tellen daar niet in mee. Er is dan
ook géén route en géén functie die de UBO zet: een aangevinkte UBO blijft staan
als de aandelen verschuiven, en dan klopt het register precies op het moment dat
het ertoe doet niet meer.

**Aftreden is geen wissen** — wie er ooit bestuurder was, was dat, en juist die
geschiedenis is waar een aansprakelijkheidsvraag over gaat. Een niet volledig
verdeeld kapitaal is een **melding en geen fout**: tijdens een oprichting is dat
normaal, en een register dat rood kleurt terwijl er niets mis is, leert iemand
rood te negeren. Alles op codenaam, en het antwoord zegt zelf dat dit niet de
UBO-opgave bij de KvK is.

Onderweg bleek de B.V. geen `bestuur`-cap te dragen, terwijl elke B.V. een
statutair bestuur heeft. Dat is in de tabel gerepareerd en niet omheen gewerkt:
de as is de waarheid.

Getoetst in `test/onderneming-bestuur.test.js` (19). Negen mutaties; zeven beten
meteen. **Twee sloegen af en legden allebei iets echts bloot:** de drempeltoets
had codenamen van één letter, die al op de lengte werden geweigerd — er waren dus
nooit aandeelhouders, en twee toetsen slaagden om de verkeerde reden. En de
verboden-aftrek bleek geen werk te doen, zoals hierboven beschreven. Na beide
reparaties beten de mutaties wel.

### De voorraad: wat er ligt, en wat wij niet kunnen zien

`server/kern/onderneming/voorraad.js` + `/api/onderneming/voorraad`.

Dit huis houdt voorraad al op **vier** plekken bij, en elke plek doet dat anders
omdat het werk anders is: de keuken (`s.voorraad`, met een minimum per artikel,
een kostprijs en een mutatiejournaal), retail (`s.artikelen` met varianten —
voorraad zit op de variant), de boerderij (`s.boerderij.producten`, gevuld door
de oogst) en de groothandel (`s.groothandel.producten`, met inkoopprijs). Een
vijfde register ernaast zou binnen een maand uiteenlopen met alle vier, en zou
de enige zijn die niemand bijwerkt omdat er niet in gewerkt wordt. Deze laag
**leest** ze en legt ze naast elkaar; er staat geen enkele schrijfactie in.

Drie dingen die het met opzet niet uitrekent:

- **geen voorraadwaarde op een verkoopprijs.** Retail en boerderij kennen geen
  inkoopprijs. Een waarde daarop bevat de winst al — dat is een
  omzetverwachting, geen voorraadwaarde. Daar komt `null` met de reden, en het
  totaal zegt erbij welke delen erbuiten vallen: een totaal dat stilzwijgend een
  deel mist, wordt overgetypt in een balans;
- **geen bestelpunt waar er geen is.** De groothandel heeft `minBestel`, en dat
  is de minimale hoeveelheid *per bestelling*, geen bestelpunt. Die twee
  verwarren meldt een volle groothandel als "bijna op". Bij de boerderij bepaalt
  wat er groeit de voorraad;
- **geen dekking in dagen.** Daarvoor zouden wij verbruik over tijd moeten
  kennen; alleen de keuken schrijft mutaties weg, en alleen binnen RTG. "Nog
  vier dagen" op zo'n grondslag is een getal waar iemand een bestelling op
  baseert.

Retail telt laag op de **variant** en niet op het artikel: maat 42 op is een
gemiste verkoop, ook al ligt de rest in het schap. De drempel van de zaak zelf
(`s.settings.retailDrempel`) wint van de standaard. Op het dagbeeld staat de
voorraad vóór de verkoopkant — wat u niet heeft kunt u ook niet verkopen.

Getoetst in `test/onderneming-voorraad.test.js` (13). Zeven mutaties, alle zeven
raak: de waarde op de verkoopprijs baseren, `minBestel` als bestelpunt
gebruiken, retail op het artikel in plaats van de variant tellen, een artikel
zonder minimum toch laag noemen, de eigen drempel negeren, een totaal geven
zonder enige bron, en inactieve groothandelsproducten meetellen.

### De klusketen: van akkoord tot geld, en waar hij blijft steken

`server/kern/onderneming/klussen.js` + `/api/onderneming/klussen`.

De keten bestond al, in drie objecten die elkaar met een **referentie**
vasthouden: een offerte krijgt bij akkoord een `boekingRef`, de boeking draagt
die `ref`, en een factuur draagt `ref`. Wat er niet was, is code die hem volgt —
`boekingRef` kwam nergens anders voor dan op de plek waar hij werd gezet. Deze
laag volgt hem, en zet er geen vierde object naast dat "project" heet: dat zou
met de hand bijgehouden moeten worden en loopt na twee weken achter op de drie
die vanzelf meebewegen.

**Vier plekken waar een klus blijft steken**, en alleen de laatste twee zijn "uw
geld ligt ergens anders": akkoord maar niet ingepland, ingepland, uitgevoerd
maar niet gefactureerd, en gefactureerd maar niet betaald. Ingepland werk telt
daarom **niet** mee in het openstaande bedrag — dat als openstaand geld tonen
maakt een drukke maand tot een incassoprobleem.

Drie dingen die het niet beweert:

- **geen factuur betekent niet dat er niet is gefactureerd.** Het betekent dat
  wij binnen RTG geen factuur met deze referentie zien; wie buiten RTG
  factureert doet dat gewoon;
- **de factuur wordt op referentie gevonden**, nooit op bedrag of klant — twee
  klussen van dezelfde klant voor hetzelfde bedrag zouden anders elkaars factuur
  opeisen;
- **geen doorlooptijd van klus tot geld.** Oplevering en goedkeuring meten wij
  niet; wat er wel staat is hoe lang elke stap nu open staat, en dat is een
  meting.

Betaald is betaald langs welke van de twee wegen dan ook: de boeking kent `paid`
(de kassa) en de factuur `betaald` (de facturatielaag). Eisen dat ze allebei
staan, toont een betaalde klus als onbetaald. Elke stap heeft zijn eigen
traagheidsdrempel, want ze betekenen iets anders.

Getoetst in `test/onderneming-klussen.test.js` (13). Zeven mutaties; zes beten
meteen. **De zevende sloeg af en legde een gat in mijn toets bloot:** één
drempel voor alle stappen liet niets zakken, omdat mijn gevallen toevallig aan
beide kanten van elke drempel hetzelfde uitvielen. Er staat nu een geval dat ze
scheidt — negen dagen is traag voor een onbetaalde uitvoering en juist niet voor
een factuur — en daarna beet de mutatie wel.

### De toegang: wie kan wat, over de twee werelden die er al zijn

`server/kern/onderneming/toegang.js` + `/api/onderneming/toegang`.

Toegang is in dit huis op twee plekken geregeld, en die twee zijn met opzet
verschillend: de **zaak** kent precies twee rollen (manager en staff — genoeg
voor een vloer waar iemand kassa draait), de **werkruimte** in RTG Werk OS kent
achttien rechten, veertien rollen, rollen met een einddatum, vier soorten inzage
die een *reden* vragen, en een journaal. Een derde model hierboven zou een derde
waarheid zijn over dezelfde vraag. Deze laag leest ze allebei en legt ze naast
elkaar.

**Het gat wordt benoemd en niet gedicht:** op de zaak kan een beheerder alles,
en dat staat er — een scherm dat nuance suggereert geeft schijnzekerheid.
**Er wordt niets gezet:** toegang verlenen gebeurt waar de rol woont, allebei
achter hun eigen poort met hun eigen journaal; een tweede deur naar hetzelfde
slot is een deur die niemand bewaakt. Het venster is precies dat van de poort:
een verlopen rol telt niet mee, een rol die nog moet ingaan ook niet, en een rol
die vandaag afloopt geldt vandaag nog. Geen namen — alleen aantallen, rollen en
vensters.

Onderweg bleek `server/bedrijf/rollen.js` zijn tabellen alleen binnen de factory
terug te geven. Ze staan nu ook op de module zelf, zodat deze laag ze kan lezen
in plaats van overtypen.

Getoetst in `test/onderneming-toegang.test.js` (12). Zeven mutaties, alle zeven
raak.

### De bedrijfsontwerper en de Mall-bouwer: AI die meedenkt en nergens over beslist

`server/kern/onderneming/ontwerper.js` +
`/api/onderneming/ontwerp{,/opdrachten}`.

Twee opdrachten met dezelfde grenzen: **ontwerp** (meedenken over het idee) en
**mall** (meeschrijven aan de Mall-pagina). Het model krijgt alleen wat er echt
staat — de eigen intake, de eigen kansverkenning en stress test, het eigen
mallprofiel — en wat ontbreekt heet **ONBEKEND** in de prompt, zodat het model
ernaar vraagt in plaats van het in te vullen. Een leeg veld leest een model als
"niet van toepassing".

**Het model schrijft niets weg.** De uitkomst is tekst die de ondernemer zelf
overneemt; een AI die zijn eigen voorstel opslaat, maakt van een suggestie een
feit en dan weet niemand later meer wie wat bedacht. Zelfde regel als bij
`kern/agent.js`: een voorstel wacht op een mens.

**Drie merkregels staan letterlijk in de systeemprompt, en gelden ook in de
uitwijk:** geen toegang beloven (Lifestyle en Business gaan uitsluitend na
menselijke goedkeuring), geen echt merk als bevestigde partner en nooit claimen
dat een boeking is verwerkt, en afwegingen in plaats van juridische of fiscale
zekerheid.

**Zonder sleutel komt er geen leeg scherm**, maar een antwoord uit de eigen data
met `demo: true` erbij — een demostand die doet alsof er een model meekeek is
erger dan geen demostand. Een kapot of leeg antwoordend model valt op diezelfde
uitwijk terug. Wie er op mag beslist de bestaande `kern/aipoort.js`; die poort
wordt hier niet nagebouwd.

Getoetst in `test/onderneming-ontwerper.test.js` (11). Acht mutaties, alle acht
raak. Eén toetsfout onderweg gerepareerd: de intake is genest (`persoon`/`idee`)
en werd plat aangeleverd, waardoor de prompt in twee toetsen over lege feiten
ging. De helper rekent nu na dat de intake echt is gezet.

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
| Recht | contractbibliotheek met een uitgerekende laatste opzegdag, en de bedrijfsregels die bepalen wie er moet goedkeuren |
| Governance | voorstel, adviesronde, stemronde, besluit met evaluatiemoment, de objecten die het besluit raakt en de uitkomst van het terugkijken |
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

#### Het werkregister: één objectmodel onder de tien modules

De tien modules kenden elkaar niet. Een contract wist niet welke projecten
eraan hingen, een klant niet welke tickets, een ticket niet welk issue — elke
module had zijn eigen lijst en zijn eigen zoekveld. De motoren die dat kunnen
beantwoorden stonden er al (`kern/command/zoek.js`, `object.js`, `graaf.js`,
`kwaliteit.js`): ze zijn expliciet gebouwd om **een register mee te krijgen**
in plaats van er een te importeren, en dat is precies waarom de zaak-kant ze
gescoped kan gebruiken. Wat ontbrak was dat de werkruimte-objecten in geen
enkel register stonden.

`server/kern/werkcommand/` is dat register — het derde in dit huis, naast dat
van RTG (`kern/command/register.js`) en dat van een zaak
(`kern/zaakcommand/register.js`). Vijftien soorten over de tien modules heen:
project, taak, kennisartikel, klant, kans, ticket, storing, repository, issue,
release, feature flag, apparaat, licentie, contract, besluit. Er wordt **geen
tabel verplaatst en geen kopie aangelegd**: elke soort leest de bak waar hij al
woonde (`db.data.werkruimtes[CODE]`).

Vier routes, en geen ervan rekent zelf iets uit — ze bouwen per verzoek het
register uit de rechten van het lid dat aanklopt en geven dat aan de bestaande
motoren (`server/bedrijf/inzicht.js`):

| Endpoint | Doel |
|---|---|
| `POST /api/bedrijf/zoek` `{q, type?}` | Eén zoekbalk over alle modules, met `bereik`: waar er is gezocht |
| `POST /api/bedrijf/dossier` `{type, id}` | De feiten, wie ernaar verwijst, en de tijdlijn uit het werkjournaal |
| `POST /api/bedrijf/samenhang` | De vorm van het geheel: soorten, randen, en wat niet gemeten mocht worden |
| `POST /api/bedrijf/wandel` `{type, id, diepte}` | Wat er twee stappen verderop ligt — de klant achter het ticket achter het issue |

**Daarnaast twee routes die géén vraag over een object beantwoorden**, en dat
onderscheid is precies waarom ze niet in de tabel hierboven staan:

| Endpoint | Doel |
|---|---|
| `POST /api/bedrijf/handeling/plan` · `/doe` · `/bonnen` | De balk mag ook handelen: bedoeling → plan → geraakte objecten → rechtencontrole → bevestiging door een mens → uitvoering → actiebon |
| `POST /api/bedrijf/gevolg` `{wijziging}` | Wat blijft er **open** als deze wijziging doorgaat — vooruit kijken in plaats van naar binnen |

De handelkant slaat geen schakel over: **plannen verandert niets** (de toets
legt de hele werkruimte voor en na naast elkaar), **zonder de bevestigingscode
gebeurt er niets**, en **het recht wordt bij de uitvoering opnieuw gerekend** —
anders overleeft een plan een rol die intussen is ingetrokken. De lijst
werkwoorden is gesloten (`bedrijf/handeling-lijst.js`); er is geen algemene
uitvoerknop.

De gevolgsimulatie is geen tweede lezing van dezelfde graaf. Het dossier kijkt
naar **binnen** (wat hoort bij dit object), `gevolg` kijkt **vooruit** (wat
breekt er als het weg is): een taak van iemand anders die op werk van de
vertrekker wacht, staat in geen enkel dossier van die vertrekker en valt wel
stil. Er staat geen `save()` in het bestand, hij volgt dezelfde rechten als de
rest, en wat hij níét rekent — kosten, contracten, controls, terugdraaien —
staat met reden in élk antwoord.

**Twee assen van scope, en allebei door weglaten.** De werkruimte: elke soort
draagt een `lees(db)` die alleen zijn eigen werkruimte opent, dus er bestaat
geen pad waarlangs een rij van een andere organisatie naar buiten komt. En het
recht: het Werk OS poort zijn modules per recht, dus een soort waarvoor u het
recht mist **zit niet in uw register** — hij wordt niet gefilterd, hij is er
niet. Dat verschil is hier alles: de afhankelijkhedenscan loopt álle soorten
van het register langs, en één vergeten filter levert dan de contracten van een
ander op. `rechten` heeft daarom geen standaardwaarde; wie hem vergeet krijgt
een leeg register, en dat is de goede kant om fout te gaan.

**De randen worden gemeten, niet getekend.** Niemand heeft ergens genoteerd dat
een ticket aan een klant hangt; `kwaliteit.js` meet welk veld in de praktijk
vrijwel altijd een bestaande sleutel van een andere soort bevat. Onder die
grens (te weinig rijen) is de samenhang **niet gemeten** — en dat staat er met
zoveel woorden, want een lege kaart leest anders als "geen samenhang".

**De mens staat er ook in, achter het recht `mens` — en met de prijs erbij.**
Dat was eerst bewust niet zo, want een lidrij draagt `token` (de inlogsleutel)
en `rtgKey` (de koppeling naar het persoonlijke RTG-account). Beide staan nu in
de VERBORGEN-lijst van `object.js`; die tweede is er expliciet voor dit doel bij
gekomen, want een dossier dat hem uitprint legt buiten de kluis om een verband
tussen twee identiteiten dat gescheiden hoort te blijven.

Het tweede probleem was ernstiger: geen enkele module verwees naar een mens met
zijn id — `eigenaar`, `wie` en `door` waren vrije tekst met een naam erin. De
soort `lid` kreeg daarom als enige in dit huis een eigen `verwijst` en werd op
**naam** gevonden, met alle risico van dien: twee mensen kunnen dezelfde naam
dragen, en een naam als "Open" is ook een statuswaarde.
`kern/werkcommand/naamgrens.js` meet allebei en zet het in de uitslag.

**Sinds `server/bedrijf/wieis.js` krimpt die gok.** Bij het vastleggen van een
naam wordt er ook een **id** opgeslagen, als dat id onbedubbelzinnig is —
precies één actief lid met die naam. Bij nul (een externe, een typefout) of bij
twee of meer blijft alleen de naam staan, **met de reden in het antwoord**. Drie
dingen gebeuren daar met opzet niet: er wordt niets afgedwongen (een taak moet
naar iemand van buiten kunnen), niets met terugwerkende kracht ingevuld (dat zou
precies de gok zijn die dit oplost), en de naam wordt niet vervangen — het id
komt ernaast.

Wat het oplevert is af te lezen: de afhankelijkhedenscan meldt het **veld**
waarop hij matchte, dus `via: 'wieId'` is exact en `via: 'wie'` is een naam. De
scan trekt daarbij een treffer op de sleutel vóór een treffer op de naam, ook
als het naamveld eerder op de rij staat — anders hing het oordeel af van de
volgorde waarin velden toevallig zijn gezet. Het persoonsdossier en `/mijnwerk`
tellen allebei hoeveel rijen op id zijn gevonden en hoeveel nog op naam. De
naamgok verdwijnt niet met een knop; hij krimpt, en hoeveel er nog van over is,
staat er.

Getoetst in `test/werkregister.test.js` (11). Negen mutaties, alle negen raak —
onder andere de rechten-zeef weghalen, de lezer over werkruimtes heen laten
lopen, de afscherming van de kennisbank slopen, de ticketsoort naar de verkeerde
bak wijzen, de mens op id in plaats van op naam zoeken en de naamgenoot niet
tellen. **Eén mutatie sloeg af en dat was de nuttigste**: `rtgKey` uit de
VERBORGEN-lijst halen veranderde niets, omdat de medewerker in die toets nooit
een RTG-account had gekoppeld en het veld dus niet bestond. Dat is een toets die
niet kon zakken (LAT-regel 9); de bewering staat nu op de functie zelf, en daar
bijt de mutatie wel.

#### Het geheugen van een besluit: waarom hebben we dit gedaan

De besluitvorming stond er al — voorstel, adviesronde met bezwaren, stemronde,
uitkomst, evaluatiedatum — maar een besluit hing aan **niets**. Het ging over
een leverancier, een project of een release, en nergens stond wélke. Daarmee is
"waarom kozen we leverancier X" over drie jaar onbeantwoordbaar, en "welke
projecten worden geraakt door dit contract" zelfs vandaag.

`server/bedrijf/geheugen.js` (schrijven) en `geheugenlezen.js` (lezen) leggen
die verbinding vast. **Dit is de enige koppeling in deze laag die niet gemeten
wordt, en dat is geen tekortkoming van de meter maar een eigenschap van wat er
wordt vastgelegd**: een besluit raakt meerdere objecten, dus het is een lijst —
en zowel `kwaliteit.js` als de afhankelijkhedenscan van `object.js` slaan
lijsten over. Hij wordt dus door een mens geschreven en expliciet teruggelezen.

| Endpoint | Doel |
|---|---|
| `POST /api/bedrijf/besluit/raakt` `{besluitId, type, id}` | Dit besluit gaat over dit object |
| `POST /api/bedrijf/besluit/raakt-terug` `{koppelId, reden}` | Intrekken — met een reden, en zonder te wissen |
| `POST /api/bedrijf/besluit/evaluatie` `{uitkomst, tekst}` | Wat het terugkijken opleverde; evaluaties stapelen |
| `POST /api/bedrijf/besluit/geheugen` `{besluitId}` | Onderbouwing, adviezen, bezwaren, stemmen, uitkomst, evaluaties en de geraakte objecten |
| `POST /api/bedrijf/dossier` | Draagt nu ook `besluiten`: welke besluiten dit object raken |

Vier regels dragen het, en alle vier komen ze uit dezelfde vraag — wat is dit
over drie jaar nog waard?

- **Een koppeling wordt bewezen, niet geloofd.** Het object moet bestaan in het
  register van degene die koppelt. Een id dat niet bestaat en een object dat de
  koppelaar niet mag zien geven **hetzelfde antwoord**: anders is dit veld een
  manier om te toetsen welke id's er in een gesloten module bestaan.
- **Een koppeling draagt wat het tóén was.** Niet alleen `{type, id}` maar ook
  de titel op het moment van koppelen. Een contract wordt hernoemd, een vlag
  wordt opgeruimd — en dan is "besluit 14 juni ging over c8f1a" geen antwoord
  meer. Een verdwenen object staat er als **verdwenen** met de titel van toen;
  het besluit ging er wel degelijk over.
- **Intrekken wist niets.** Een verkeerde koppeling wordt ingetrokken met een
  reden en blijft leesbaar staan. Wie kan wissen, kan de geschiedenis
  herschrijven — en dan is dit geen geheugen maar een prikbord.
- **Iedere lezer lost op met zijn eigen register.** Wie het recht voor een soort
  mist, krijgt een **telling** en nergens de titel — dezelfde vorm die de
  kennisbank al gebruikt met `verborgen: n`.

En de evaluatie is de andere helft: het Werk OS eiste al een evaluatiedatum bij
elk aangenomen besluit, maar er was geen manier om op te schrijven wát het
terugkijken opleverde. Een datum zonder uitkomst is een agendapunt. Evaluaties
stapelen, want een besluit mag na drie jaar anders uitpakken dan na drie
maanden, en dan horen ze allebei gelezen te worden.

Getoetst in `test/werkgeheugen.test.js` (7). Zes mutaties, alle zes raak — het
bewijs bij het koppelen weghalen, de lezer met een ander register laten
oplossen, intrekken laten wissen, de titel-van-toen vervangen door die van nu,
een evaluatie de vorige laten overschrijven, en het dossier de omgekeerde vraag
niet meer laten stellen.

#### Bedrijfsregels: beleid dat iets tegenhoudt

"Contract boven €50.000? Dan kijkt juridisch er altijd naar en tekent de CFO."
Dat soort afspraken stond hier nergens: het waren gewoontes, en een gewoonte is
precies zo sterk als de drukste dag.

`server/bedrijf/regels.js` (het register) en `regelpoort.js` (de handhaving)
maken er beleid van. **De ontwerpregel die alles draagt: een regel die niets
tegenhoudt is theater.** Je kunt hier daarom alleen een regel maken voor een
soort waar in de code ook echt een plek is die hem afdwingt — een regel voor
"project" wordt gewéigerd, met de reden erbij, zolang er geen moment is waarop
hij kan blokkeren. Een beleidsscherm vol regels die nergens langskomen is erger
dan geen beleidsscherm: het leest als bewaking die er niet is.

Er zijn twee plekken, en **ze houden verschillend tegen** — dat verschil staat in
de tabel in de code en het antwoord van `/regels` noemt het per regel:

| Soort | Voorwaarde | Hoe hij tegenhoudt |
|---|---|---|
| `contract` | boven een **bedrag** | **houdt vast**: een getekend contract blijft op `wacht op goedkeuring` staan in plaats van actief |
| `besluit` | een **besluitsoort** (investering, prijs, …) | **weigert**: de stemronde sluiten lukt niet, het besluit blijft in stemming |

Elke soort draagt zijn eigen voorwaarde, en meer vormen zijn er niet. Een
besluitregel met een bedrag erin wordt geweigerd: een instelling die nergens
wordt gelezen is dezelfde leugen als een regel die niets tegenhoudt. Dit is
bewust **geen regeltaal** — een taal in een configuratiebestand is een tweede
implementatie die je niet kunt toetsen, dezelfde afweging die
`kern/command/beleid.js` maakt.

| Endpoint | Doel |
|---|---|
| `POST /api/bedrijf/regel/zet` `{soort, boven, eist:[rechten]}` | Een regel vastleggen (recht `werkruimte`) |
| `POST /api/bedrijf/regels` | Alle regels, elk met wáár hij wordt afgedwongen |
| `POST /api/bedrijf/regel/weg` `{regelId, reden}` | Vervallen — met een reden |
| `POST /api/bedrijf/keur` `{soort, id, recht}` | Goedkeuren namens een recht dat u werkelijk draagt — één route voor alle soorten |
| `POST /api/bedrijf/keuring` `{soort, id}` | Wat dit object nog nodig heeft, en wie er al goedkeurde |

**Wat een regel wel en niet toevoegt.** Twee handtekeningen (wij en wederpartij)
waren er al en zijn structureel; daar gaat een regel niet over. Wat een regel
toevoegt is wie er van bínnen moet goedkeuren, uitgedrukt in **rechten en niet
in namen** — `recht` is juridisch, `geld.goedkeuren` is wie over geld gaat. Zo
blijft de regel staan als iemand anders die rol krijgt. Ontbreekt er een
goedkeuring, dan staat het contract op **wacht op goedkeuring** in plaats van
actief, met bij naam wat er mist.

Drie grendels, en ze komen alle drie uit de vraag hoe je hier onderuit zou komen:

- **Eén mens keurt één keer goed.** Wie `recht` en `geld.goedkeuren` allebei
  draagt, kan niet in zijn eentje een vier-ogen-regel afvinken. Daarmee is "twee
  rechten" ook echt twee mensen.
- **Het beheer-token keurt niet** — dezelfde regel als bij het stemmen over een
  besluit: anders staat er een goedkeuring zonder gezicht.
- **Een goedkeuring geldt voor het bedrag waarop hij is gegeven.** Gaat de
  waarde daarna omhoog, dan vervalt hij (met het bedrag van toen erbij) en valt
  het contract terug naar wacht. Zonder die grendel is de hele laag te omzeilen
  met een contract van een euro dat je achteraf ophoogt — niet theoretisch, maar
  de makkelijkste weg eromheen.

`regelpoort.js` is sindsdien de **enige** plek in dit huis die de status van een
contract op actief zet of terugzet. `contract.js` deed dat vroeger zelf; met een
tweede voorwaarde erbij zouden twee plekken bepalen wanneer een contract actief
is, en die lopen uiteen (LAT-regel 4).

Een nieuwe regel werkt **niet met terugwerkende kracht**: contracten die al
actief zijn worden er niet door teruggezet, want dat zou een lopende afspraak
stilzwijgend openbreken. Hij bijt zodra er aan zo'n contract iets verandert.

Er is **één goedkeurroute voor alle soorten**. Twee routes die hetzelfde doen
lopen uiteen zodra er een grendel bij komt — en juist bij een goedkeuring is dat
de grendel die je kwijtraakt.

Getoetst in `test/werkregels.test.js` (9). Zeven mutaties, alle zeven raak — de
drempel laten vervallen, één mens twee keer laten goedkeuren, het beheer-token
toelaten, de herwaardering bij ophoging weghalen (twee keer, aan beide kanten
van de naad), de status zetten zonder naar de goedkeuringen te kijken, en een
regel toelaten voor een soort die nergens wordt afgedwongen.

#### Instroom: de stap die het systeem ziet, wordt gemeten

Er stond een uitstroomproces met zes stappen en geen instroomproces. Dat is de
verkeerde helft om te hebben: bij vertrek is er een aanleiding, bij aankomst
niet — de nieuwe medewerker zit er gewoon, en wat er niet gebeurt merkt niemand
tot het misgaat.

`server/bedrijf/indienst.js` is de spiegel, met één verschil dat de hele reden
is dat hij bestaat: **een stap die het systeem zelf kan zien, wordt gemeten en
niet afgevinkt**. Bij de uitstroom weigert een vinkje zolang de meting hem
tegenspreekt; hier bestaat het vinkje niet eens. Een vinkje naast een meting is
dezelfde waarheid op twee plekken, en op de dag dat ze uiteenlopen gelooft
niemand meer welke van de twee klopt.

| Stap | Aard |
|---|---|
| functie en afdeling ingevuld | gemeten |
| rollen toegekend | gemeten |
| werkplek uitgegeven | gemeten (uit de IT-inventaris) |
| welkomstgesprek gevoerd | mensenwerk |
| veiligheids- en privacy-instructie | mensenwerk |
| eerste weken ingepland | mensenwerk |

Dat is wat "niemand hoeft dit te starten" hier betekent: niet dat een automaat
het werk doet, maar dat het werk zichzelf meldt zodra het gebeurt. IT geeft een
laptop uit in een heel andere module, en de stap staat vanzelf op groen — met de
meting erbij, zodat "nog niet" altijd een reden heeft. Wat dit huis níét kan
(een laptop bestellen, een badge maken, salaris aanmelden) is mensenwerk en zegt
dat ook; een stap die doet alsof is erger dan een stap die eerlijk is.

Getoetst in `test/werkindienst.test.js` (4). Vier mutaties, alle vier raak.

#### De organisatie op een datum, en wat er omvalt als een leverancier wegvalt

**`POST /api/bedrijf/toen` `{datum}`** (`server/bedrijf/toen.js`) zegt **wat er
bestond** op een datum — geteld uit het aanmaakmoment van elke rij. Wat hij
níét doet is de **toestand** van toen: of een contract op die dag al actief was,
wie er toen aan een project werkte, welke rollen iemand had. Een wijziging
overschrijft de vorige waarde en er ligt geen gebeurtenislaag onder de
schrijfhandelingen. Dat staat in elk antwoord, niet als voetnoot maar als
eigenschap van de uitslag — de volledige tijdmachine zou een organisatie tonen
waarin alles wat niet in het journaal staat er nooit is geweest.

Rijen zonder aanmaakmoment worden **geteld** (`zonderDatum`) in plaats van stil
buiten de telling te vallen: 40 met een verzwegen marge is geen 40. En hij erft
de twee scope-assen van het register — wie een soort niet mag zien, ziet hem ook
in het verleden niet.

**`POST /api/bedrijf/uitval` `{wederpartij}`** (`server/bedrijf/uitval.js`)
beantwoordt "welke klanten lopen risico als deze leverancier uitvalt". De vorm
wordt bepaald door één probleem: **een leverancier bestaat hier niet als
object** — er is alleen `wederpartij`, een vrij tekstveld op een contract. De
eerste stap gaat dus op naam, met dezelfde waarschuwing die de soort `lid`
draagt. Alles daarna loopt over echte sleutels (`klantId` → tickets, kansen), en
elke rij zegt met `via` welke van de twee het was — anders krijgt de hele keten
de hardheid van de zwakste schakel zonder dat je kunt zien welke dat is. De
besluiten waarin die leverancier ooit is gekozen komen mee uit het
besluitgeheugen; dat is de vraag die je stelt op de dag dat hij omvalt.

Wat er niet in staat: hoe waarschijnlijk uitval is, wat het zou kosten, en wie
er achter deze partij zit. Alle drie met de reden erbij.

Getoetst in `test/werktoen.test.js` (6). Vier mutaties, alle vier raak.

#### Twee grenzen die in de vorm zitten, niet in een controle

**Herkomst uit een andere RTG-app** (`server/bedrijf/herkomst.js`). "Bus 28 is
defect" gebeurt in RTG Mobility; het ticket, het project en het contract met de
leverancier gebeuren hier. Tot nu toe was er geen draad tussen die twee, dus
stond er hooguit "bus 28" in de vrije tekst — en dat is geen verwijzing maar een
hoop. Een ticket of taak draagt nu een `rtg://<soort>/<id>`, de vorm die
`kern/wereld/koppel.js` al kende; er komt geen tweede verwijsvorm naast.

**En de verwijzing wordt nooit opgelost.** Een werkruimtelid is geen RTG-lid —
dat zijn twee identiteiten, en dat is de regel waar deze hele laag op rust. Er
reist geen titel, geen status en geen enkel veld van de RTG-kant mee: bewaard en
getoond worden alleen de soort, het id en welke app hem opent. Wie de inhoud wil
zien, opent hem met zijn **eigen** RTG-sessie. Was het andersom, dan kon een
werkgever via zijn werkruimte in RTG-gegevens kijken zonder dat daar ooit een
deur voor is opengezet.

Onderweg bleek `koppel.ontleed()` twee vragen tegelijk te beantwoorden: is dit
een geldige verwijzing, én kent dit huis die soort? Voor een ticket over een
voertuig zijn dat verschillende antwoorden — de verwijzing is geldig, alleen
heeft `voertuig` hier (nog) geen bestemming. `koppel.vorm()` beantwoordt nu de
eerste vraag, `ontleed()` doet onveranderd de tweede. Een onbekende soort wordt
dus **bewaard en niet gegokt**: geen stille link naar de homepage.

**Uw eigen werk** (`server/bedrijf/mijnwerk.js`). "Waar was ik gebleven" is een
prettige app en, aan de andere kant van dezelfde tafel, een volgsysteem. Dit
huis trok die grens al bij de kijkplicht, en hier staat hij in de **vorm van de
route**: er is geen parameter om naar iemand anders te vragen. Geen `lidId`, dus
geen pad — niet een controle die iemand kan vergeten. Het beheer-token komt er
ook niet in, juist omdat het alle rechten draagt. En er wordt niets nieuws over
u vastgelegd: de laag leest het journaal dat de modules zelf al schrijven.

Getoetst in `test/werkgrens.test.js` (6). Vijf mutaties, alle vijf raak — de
vormcontrole eruit, de verwijzing tóch oplossen, een onbekende soort een gegokte
pagina geven, het meegestuurde `lidId` wél lezen, en het beheer-token toelaten.

#### "Dit project loopt achter. Waarom?"

`POST /api/bedrijf/project/waarom` (`server/bedrijf/waarom.js`) is de vraag waar
een dashboard normaal ophoudt en een mens begint met gokken. De hele waarde zit
in wat hij weigert te doen.

Elke bevinding is een geteld getal met de rijen erbij: taken over hun deadline,
taken die wachten op werk dat nog niet af is, het budget (geschreven uren maal
het uurtarief — geen schatting), mijlpalen waarvan de datum voorbij is. Wat een
mens zelf als **risico** noteerde staat apart van de metingen: dat is een
verwachting en geen waarneming, en door elkaar getoond krijgt het geheel de
hardheid van het zwakste deel.

**Het gedeelde patroon wordt gemeten met `kern/command/oorzaak.js`** — dezelfde
module die RTG Command gebruikt; er komt geen tweede naast. Die zoekt zelf welk
veld de gevallen het strakst clustert en zegt het als hij niets vindt. Eén ding
is er wél naast gezet, met de reden erbij: die module slaat een veld over waarin
*alle* gevallen dezelfde waarde hebben — in zijn eigen context (een storingslijst
groeperen) onderscheidt dat niets, maar hier is "alle tien de late taken staan op
naam van dezelfde persoon" juist het sterkste signaal dat er is. Dat is een
andere vraag, geen tweede implementatie van dezelfde.

**En wat dit huis niet weet, staat als niet gemeten.** Het voorbeeld dat bij deze
vraag altijd valt is "de leverancier wacht" — en dat is precies iets wat hier
nergens is vastgelegd: een project kent geen leverancier, en een taak kent geen
externe blokkade, alleen "wacht op" naar een andere taak. Die regel verzinnen zou
de rest van het antwoord waardeloos maken. Hij staat met naam bij `nietGemeten`,
en dat is geen voorbehoud maar een werklijst.

Getoetst in `test/werkwaarom.test.js` (5). Vier mutaties, alle vier raak.

#### Gezondheid en de dagbriefing: één cijfer dat niet liegt

`server/bedrijf/gezondheid.js` geeft één cijfer met de reden eronder —
`/api/bedrijf/gezondheid` en `/api/bedrijf/dagbeeld`. Het is de makkelijkste
plek in dit huis om een getal te verzinnen dat als feit gaat rondlopen, dus:

- **Hij meet niets zelf.** Elk signaal leest het directiebeeld dat er al was.
  Een gezondheidscijfer met een eigen meting zegt op een dag iets anders dan het
  scherm waar het over gaat — dezelfde reden die `kern/command/alarm.js` opgeeft.
- **Elk signaal weegt even zwaar, en dat staat erbij.** Gewichten zijn een
  mening, en een mening die als getal is vermomd valt niet meer te bespreken.
- **Wat niet gemeten kan worden, telt niet als gezond.** Een lege werkruimte
  krijgt geen 100% maar **geen cijfer**; anders is de score het hoogst op de dag
  dat er nog niets is. De noemer staat er altijd bij: groen van *meetbaar*.
- **Het cijfer komt nooit alleen** — wat eraf gaat staat er met naam, met het
  gemeten getal en met waar je het repareert.

De dagbriefing is hetzelfde in zinnen, en die zinnen komen **niet** uit een
taalmodel maar uit dezelfde signalen met dezelfde getallen. Een briefing die
iets anders zegt dan het bord waar hij op leunt, is precies wat een directie
leert om hem niet te lezen. Wat niet gemeten kon worden staat eronder en niet
tussen het advies: geen signaal is geen goed nieuws.

**Twee signalen zijn er bij het schrijven uitgegooid**, en dat is dezelfde fout
die LAT-regel 9 over toetsen maakt. "Teruggedraaide productiereleases" telt de
historie — eenmaal rood, nooit meer groen, dus dat meet een litteken en geen
gezondheid. En "opzegdag voorbij" bestond niet als meting, dus hij zou altijd op
nul staan: een signaal dat nooit kan uitslaan koopt vertrouwen dat er niet is.

Getoetst in `test/werkgezondheid.test.js` (5). Vier mutaties, alle vier raak.

### RTG Podium: werelden op één motor

Het Podium was één product achter één deur: geverifieerd paspoort en 18 jaar, voor iedereen die wilde kijken. Dat maakte de voorziening onbruikbaar voor alles wat die deur niet nodig heeft — een schoolstream, een productlancering, een concert — terwijl de techniek eronder (de relay-boom over kijkers, de chat, RTG Pay, de goedkeuring door een mens) voor al die dingen dezelfde is.

Een kanaal hoort nu in precies één **zone**, en de zone draagt het beleid (`server/kern/podium/zones.js`): wie mag kijken, wie mag zenden, hoe er geld mag lopen, of hij in de gedeelde index staat, en welke wachtrij van het kantoor hem behandelt.

| Zone | Deur | Geld | Index |
|---|---|---|---|
| **Live** (`open`) | elk lid | cadeaus | gedeeld |
| **Creator** | elk lid | cadeaus + maandabonnement | gedeeld |
| **Events** | lid met een kaartje | kaartje + cadeaus | gedeeld |
| **Besloten** | alleen wie de maker uitnodigt | cadeaus | geen |
| **18+** (`beperkt`) | geverifieerd paspoort, 18 jaar | cadeaus + abonnement | apart |
| **Business** (`zaak`) | alleen wie bij die organisatie werkt | geen | geen |
| **Commerce** (`handel`) | elk lid | cadeaus + verkoop | gedeeld |

**Waarom 18+ een eigen zone is en geen categorie.** Als "18+" een genre naast "koken" is, lekt het overal doorheen: in de lijst, in de zoekresultaten, in een aanbeveling, in een profielkaart. Als het een eigen zone met een eigen index is, is "niet lekken" een eigenschap van de code. `test/podiumzones.test.js` probeert precies dat: het kanaal is niet te zien in een andere zone, niet te openen met een geraden id, niet te bechatten, er gaat geen cadeau heen, en het staat niet in de gedeelde mediawereld — ook niet bij iemand die er wél in mag.

**De verhuizing van wat er al stond.** Elk bestaand kanaal is aangemeld toen het Podium als geheel achter de 18+-deur zat; die kanalen staan daarom in zone `beperkt`. Niet omdat hun inhoud dat is, maar omdat dat de deur is waar ze achter staan — **niemand wint of verliest toegang**. Verhuizen naar een andere zone is een besluit van een mens bij het kantoor.

Een **kaartje** (Events) is een eenmalige betaling via RTG Pay die voor een periode binnenlaat: geen abonnement dat doorloopt, geen incasso. Een **uitnodiging** (Besloten) is een handeling van de maker op codenaam; de genodigdenlijst komt niet naar buiten.

**Business hangt aan de personeelsadministratie die er al was.** Wie ergens werkt, staat als personeelsrij aan zijn RTG-account gekoppeld (`accounts.staffPositions` — dezelfde koppeling waarmee de werk-app meekomt bij het inloggen). Er is dus geen tweede ledenlijst per bedrijf gebouwd. Een interne uitzending start alleen de **leiding**, op naam van een zaak waar die leiding ook werkelijk zit, en het kanaal draagt die `zaakCode`. `test/podiumzaak.test.js` legt drie verschillende weigeringen vast: wie nergens werkt komt de wereld niet in, wie ergens ánders werkt komt de wereld wél in maar deze uitzending niet, en wie er werkt zonder leiding mag kijken en niet zenden. Er loopt geen geld: een town hall die fooien aanneemt van het eigen personeel is geen town hall, en een training met kaartverkoop is een evenement (dus een andere zone).

**Commerce verplaatst geld, geen dozen.** De maker zet productkaarten klaar (naam, prijs, voorraad, en zelf ingevuld hoe de koper het krijgt); een kijker rekent tijdens de uitzending af langs precies dezelfde RTG Pay-route als een cadeau — geen tweede betaalweg, geen tweede saldo. De voorraad daalt echt, uitverkocht is uitverkocht, en een dubbeltik met dezelfde idempotentiesleutel koopt er geen twee. De zaal hoort **dat** er een weg is (dat is het antwoord op "heeft kopen nog zin"), niet **wie** hem kocht; de bestelling gaat op codenaam naar de maker. Wat er níét is: RTG bezorgt niets — geen adres, geen verzending, geen retourregeling, en dus ook geen belofte daarover op het scherm. Staat als open punt in `TAKEN.md`.

### RTG Media OS (één mediawereld over vier apps)

Er waren vier media-apps die niets van elkaar wisten: **RTG Klankwerk** (zelf muziek maken en uitgeven), **RTG Theater** (video), **RTG Clips** (korte verticale video) en **RTG Podium** (live). Voor een lid was dat vier keer dezelfde maker, vier keer een volgknop en vier keer zoeken; voor een maker vier keer publiceren en vier keer bijhouden hoe het gaat.

`server/kern/mediaos/` legt daar één laag overheen met **drie standen op dezelfde wereld**: **Muziek**, **Kijk** (video + live) en **Flow** (korte video). Eén app: `/apps/media.html`.

Het ontwerpbesluit dat alles draagt: **de Media OS bezit die vier domeinen niet.** Elke rij wordt bij het opvragen uit het domein zelf gehaald en een volgknop schrijft in de volgerslijst van het domein zelf, dus er komt nergens een tweede administratie naast het origineel te staan (LAT.md regel 4). Wat de Media OS wél bezit, is precies wat nergens bestond: de bibliotheek over de vormen heen, het smaakprofiel dat u zelf invult, en de meldingsvoorkeur per maker.

- **Eén universele contentidentiteit.** Elk stuk heet `<vorm>:<domein-id>` (`track:u91c0`, `video:v3f1a2`, `clip:c77b0`, `live:p12`). Daarmee praten de bibliotheek, de hub en de smaak over de vier vormen heen zonder te weten waar iets vandaan komt.
- **Eén makersprofiel.** Al het werk van één codenaam bij elkaar, met één volgknop die onder water in Clips én in het Theaterkanaal schrijft. Het maandabonnement op een livekanaal blijft er met opzet buiten: dat kost geld en hoort een aparte, bewuste stap te zijn.
- **De stuk-hub.** Onder een uitgegeven nummer hangen de korte video's die dat nummer als geluid dragen (die verbinding bestaat écht: `kern/clips-studio.js` legt het track-id vast als een maker zijn eigen stuk onder een clip zet), plus zijn andere werk. Er wordt niets bij elkaar geraden — een "officiële videoclip bij dit nummer" bestaat niet in de gegevens en staat er dus ook niet.
- **De app is niet leeg op dag één, en waar hij dat wel is, zegt hij waarom.** Muziek is de enige van de vier vormen die dit huis zélf kan opwekken: een uitgave is geen audiobestand maar een rij getallen die het toestel van de luisteraar uitrekent. Een demo-installatie start daarom met vijf uitgegeven stukken uit de eigen klankmotor (`server/seed/media.js`, gemaakt met dezelfde tabellen als het voorstel van Rahul in de studio, met een vast zaad). Video, korte video en live worden bewust **niet** geseed — een geseede clip zou eeuwig "maker offline" zijn, en video zou verzonnen bytes vragen. Die standen tonen in plaats daarvan wat er komt, waarom het er nu niet is (nog niets gemaakt / een deur die dicht staat / uw eigen "nooit"-lijst) en een stap die echt werkt. In productie begint alles leeg, zoals het hoort.
- **Meldingen die je zelf richt.** Eén keer volgen, en dan per maker kiezen waarvoor je gewekt wilt worden (muziek, video, flow, live). Bij een uitgave, een video waarvan de bytes binnen zijn, een nieuwe clip of live gaan wekt `kern/mediaos/wekken.js` precies die mensen — en niemand anders; de maker zelf ook niet.
- **Een korte video speelt gewoon in de app.** Het clip-protocol staat als één gedeelde laag in `public/shared/clipdeler.js`: kijken, uitdienen, het toestelarchief, de knip en de ondertitels. `clips.html` en `media.html` gebruiken allebei die laag, dus er is geen tweede exemplaar van dezelfde waarheid — en een maker die in de Media OS zit, dient zijn eigen clips gewoon uit in plaats van "offline" te lijken. `test/clipdeler.e2e.js` laat een clip echt van de ene browser naar de andere reizen en controleert dat er géén clipbestand in de datamap van RTG belandt.
- **Uw eigen regelaars in plaats van een algoritme.** Geen stil meegeschreven kijkprofiel: alleen wat u zelf zegt (meer, minder, nooit, verras me, wissen). Bij élk stuk staat waarom het er staat, en die zin komt uit dezelfde code die de volgorde bepaalt. Geen volgorde op populariteit en geen oneindige feed — de drie apps eronder weigeren die alle drie met zoveel woorden.
- **Niets valt stil weg.** Een bron die dicht is (het Podium eist 18+ en verificatie) staat met de reden van dat domein zelf onder de wereld; wat u met "nooit" wegzet, wordt geteld getoond; een bewaard stuk dat de maker heeft weggehaald staat als verdwenen in plaats van te verdampen.
- **Het makersbord** telt alleen wat er écht geteld wordt (uitgaven, "mooi", reacties, volgers, Podium-abonnees en -omzet) en zet er met naam bij wat er níét geteld wordt: weergaven, kijktijd en bereik houdt RTG nergens bij. Liever geen getal dan een getal dat niets meet.

| Endpoint | Doel |
|---|---|
| `POST /api/mediaos/wereld` `{modus}` | De wereld in één stand (`muziek`, `kijk`, `flow`, `alles`), met per stuk een `waarom` |
| `POST /api/mediaos/stuk` `{id}` | De stuk-hub: dit stuk, de clips met dit geluid eronder, en ander werk van de maker |
| `POST /api/mediaos/maker` `{codenaam}` | Eén makersprofiel over de vier vormen heen, met de volgstand |
| `POST /api/mediaos/volg` `{codenaam, aan}` | Volgen/ontvolgen; schrijft in Clips en het Theater, nooit in een betaald abonnement |
| `POST /api/mediaos/meldingen` `{codenaam, soorten}` | Waarvoor u van deze maker gewekt wilt worden (muziek/video/flow/live); nieuw werk wekt precies die mensen |
| `POST /api/mediaos/bieb` · `/bewaar` `{id, aan}` | De bibliotheek over de vier vormen heen |
| `POST /api/mediaos/smaak` · `/stuur` `{richting, maker\|onderwerp}` | Het smaakprofiel lezen en bijsturen |
| `POST /api/mediaos/bord` | Het makersbord, inclusief wat er niet geteld wordt |
| `POST /api/mediaos/lijsten` · `/lijst` `{id}` | Uw afspeellijsten, en er een openen (opgelost met uw eigen sessie) |
| `POST /api/mediaos/lijst/maak` · `/zet` · `/stuk` | Een lijst maken of hernoemen, en er stukken in, uit en op volgorde zetten |
| `POST /api/member/dm/send` `{toKey, stukId}` | Een stuk delen in een gesprek -- de gewone berichtenweg, met alleen een verwijzing erin |
| `POST /api/mediaos/lijst/deel` `{id, codenaam, aan}` | Een lijst delen met iemand met wie u verbonden bent, om te LEZEN |
| `POST /api/mediaos/samen/*` | De luisterkamer: `mijn`, `start`, `nodig`, `in`, `uit`, `zet` |
| `POST /api/mediaos/wereld` `{modus:'zaak'}` | Media for Business: het interne werk van uw organisatie |
| `POST /api/theater/zaak` · `/zaak/aanmeld` | De interne videobibliotheek van een zaak lezen en (als leiding) beginnen |
| `POST /api/theater/kijkplicht/*` | De werklijst: `mijn`, `gedaan` (u tekent zelf af), `zet` en `stand` (de leiding) |
| `POST /api/theater/huisstijl` `{zaakCode, naam, payoff, accent, thema, logo}` | De eigen naam en kleur van de interne wereld (alleen de leiding) |

**Afspeellijsten over de vier vormen.** Een lijst mag muziek, video, korte video en live door elkaar dragen -- dat is het hele punt, want "de rit naar Ibiza" bestond in geen van de vier apps. Net als de bibliotheek bewaart een lijst **alleen id's**: wat een stuk is, blijft van zijn domein. Haalt de maker iets weg, dan speelt het niet meer mee maar staat het er als verdwenen, met uitleg en een knop om het eruit te halen -- geen kaart die niemand kan spelen. Een lijst is van u alleen; hem openen of aanvullen lukt een ander niet, ook niet met het id (`test/medialijsten.test.js`). Lijsten delen, samen aan een lijst werken en publieke lijsten van een maker bestaan hier **niet**, en staan als open punt in `TAKEN.md`.

**Media for Business: de interne mediawereld van een organisatie.** Het Podium had de live-kant al (zone `zaak`: een town hall die alleen het eigen personeel ziet); wat ontbrak was het **opgenomen** werk. Dat kon niet bestaan, want elk Theaterkanaal is openbaar zodra het kantoor het goedkeurt. Daarom ligt "intern" nu bij het **publiceren** vast en niet in een laag erboven: een filter over openbaar werk zou het woord intern gebruiken voor iets wat het niet is.

- `server/kern/theater/zaak.js` — de **interne videobibliotheek** van een zaak. Alleen de **leiding** begint hem, en alleen voor een zaak waar die leiding ook werkelijk zit; het kantoor keurt hem goed zoals elk kanaal. Een lid houdt daarnaast gewoon zijn eigen kanaal: dat zijn twee verschillende dingen.
- **De bytes zitten achter de deur, niet alleen de lijst.** `/api/theater/kijk/:id` vraagt opnieuw of dit lid bij die zaak werkt. Een interne bibliotheek die alleen uit de lijsten is weggelaten, is geen interne bibliotheek — wie het id heeft, haalt de beelden dan gewoon op met een link.
- **Drie verschillende antwoorden**, want als die op elkaar lijken is de deur niet te repareren: een collega ziet het, iemand van een ánder bedrijf komt de wereld wel in maar ziet dit werk niet, en wie nergens werkt komt er niet in. Reageren en melden zitten achter dezelfde deur.
- **De stand "Zaak"** van de Media OS (`server/kern/mediaos/zaakwereld.js`) zet de twee interne bronnen naast elkaar — de bibliotheek van het Theater en de interne uitzendingen van het Podium — en voegt niets samen wat niet al intern was. De stand verschijnt alleen bij wie ergens werkt: een tab die altijd nee zegt is geen stand.
- Wie waar werkt komt uit **één bron** (`server/kern/werkplekken.js`, de personeelsadministratie die er al was). Podium, Theater en Media OS stellen alle drie dezelfde vraag; twee antwoorden op een toegangsvraag is er één te veel.

**White-label, en waar het ophoudt.** De interne wereld draagt de **eigen naam, payoff, accentkleur, thema en logo** van de organisatie (`server/kern/theater/huisstijl.js`) -- de medewerker ziet "Sal de Mar intern" en niet "RTG Theater". Twee grenzen zitten in de code en niet alleen in dit document:

- **De kleur van een zaak geldt binnen haar eigen blok.** De balk, de navigatie en de rest van de app blijven van RTG. Een tenant die de hele app kan omverven, kan een lid laten denken dat hij ergens anders is dan hij is; `test/mediazaak.e2e.js` rekent af dat de RTG-balk niet meeverft.
- **Een eigen domein bestaat hier niet**, en dat is geen ontbrekende knop maar een keuze die dit huis al had gemaakt: er is geen externe hosting, geen certificaat-machinerie voor domeinen van derden en geen routering op hostnaam. `server/kern/webmaker.js` zegt het met zoveel woorden -- het eigen web draait op `naam.rtg` binnen het ecosysteem. De server stuurt die grens daarom mee in élk huisstijl-antwoord, zodat geen scherm er meer van kan maken dan het is.

**Wat uw werk u vraagt te bekijken.** Een organisatie kan interne video op een **werklijst** zetten (`server/kern/theater/kijkplicht.js`) -- de nieuwe werkinstructie, de verplichte training. De vraag is hóé je meet of het gezien is, en het antwoord is bewust niet "met kijkgedrag": RTG meet nergens weergaven, kijktijd of bereik, en een uitzondering "omdat het nu de baas is die het vraagt" is geen uitzondering maar het einde van die regel. De medewerker **tekent zelf af**, met een moment erbij — een verklaring van een mens, geen meting van een machine, en dat staat op beide schermen. De werkgever ziet wie heeft afgetekend en wanneer; of iemand tot het eind keek, hoe vaak of op welk apparaat bestaat hier niet. Beide kanten lezen dezelfde lijst: geen dossier waar de betrokkene zelf niet in kan. Alleen video uit de **eigen** interne bibliotheek kan erop — anders hangt de plicht aan werk dat een vreemde morgen weghaalt. De namen in die lijst zijn de personeelsnamen die de werkgever zelf invoerde; codenamen komen er niet voorbij.

`test/mediazaak.test.js` (6), `test/kijkplicht.test.js` (5) en `test/mediazaak.e2e.js` (het scherm) leggen dit vast; zeven mutaties, alle zeven RAAK — onder andere de deur op de bytes weghalen, intern werk toch in de openbare zaal zetten, en de zakenstand bij iedereen laten verschijnen.

**Een lijst delen is LEZEN.** Een lijst gaat naar iemand met wie u verbonden bent -- niet naar een vreemde, want een lijst die bij willekeurige mensen kan landen is een publicatie en daar is dit huis anders voor ingericht. De ander leest hem: hij zet er niets in, hernoemt hem niet en gooit hem niet weg. De vraag die onder delen ligt -- wat gebeurt er met een stuk dat voor de een wél en voor de ander niet opengaat -- valt samen met de regel hierboven: **iedere lezer lost de id's op met zijn eigen sessie**. `test/medialijstdelen.test.js` bewijst dat met een echte asymmetrie: een evenementkanaal van de eigenaar staat bij hem als kaart en bij de ander als verdwenen.

**Samen luisteren en kijken.** Een luisterkamer deelt de **aanwijzer**, niet het geluid: de gastheer zegt welk stuk, welke seconde, spelend of stil, en iedereen speelt dat af met zijn eigen middelen (de klankmotor op het toestel, de stroom uit het Theater, het datakanaal van Clips). Dat is niet een beperking maar de enige eerlijke vorm -- bij twee van de vier vormen is de bron het toestel van de maker en niet RTG, dus "u hoort allemaal hetzelfde geluid" zou een belofte zijn die de app niet kan waarmaken. Wat hij wél waarmaakt: u wijst allemaal naar hetzelfde stuk op dezelfde plek, en wie het niet mag openen krijgt **de reden** in plaats van een zwart scherm. Alleen wie de gastheer uitnodigt komt erin, en alleen wie hij kent; gaat de gastheer weg, dan gaat de kamer dicht (`test/mediasamen.test.js`).

**Een stuk delen in een gesprek.** Een bericht tussen twee leden kon al een Salon-post meedragen; nu ook een stuk uit de Media OS. Er gaat **alleen een id** mee, geen kopie -- en dat is meer dan zuinigheid: de ontvanger lost het stuk op met zijn *eigen* sessie, dus zijn eigen deuren gelden. Wat de maker weghaalt of wat achter een gesloten deur staat, is via een gesprek niet alsnog te zien; het bericht blijft wel staan, want een gesprek is geschiedenis. Aan de verzendkant staat dezelfde controle: u deelt alleen wat u op dat moment zelf ziet, zodat een gesprek geen manier wordt om te toetsen welke id's bestaan (`test/mediadelen.test.js`).

Wat er nog niet speelt in de Media OS zelf: een **livestream** van het Podium. Dat is een andere stroom (een relay-boom over kijkers, met een betaalde toegangsdeur ervoor) en geen kopie van het clip-protocol; de kaart verwijst daarvoor naar het Podium en zegt waarom. Staat als 4.12 in `TAKEN.md`.

De vier apps eronder blijven gewoon bestaan en werken los: wie recht naar de studio, de zaal of het Podium wil, hoort daar zonder omweg te kunnen. Zet de boardroom de schakelaar `mediaos` uit, dan verdwijnt alleen de verbindende laag.

### RTG Tenant Control Plane (de klant als ding, en het Werk OS onder zijn eigen naam)

`server/kern/tenant/` + `/api/tenant/...` + `/api/techniek/tenant`. Het
diepte-document is **`TENANT.md`**; hier staat wat er draait.

Dit huis had **drie codes die alle drie "de klant" leken te betekenen** --
`org` (de sleutel van `sso_koppelingen` en de SCIM-sleutels), de werkruimtecode
`W...` van het Werk OS, en de leverancierscode -- zonder een draad ertussen.
Daardoor kon niemand zeggen welke werkruimtes onder welk contract vielen, droeg
het Werk OS nergens de naam van zijn eigen klant, en moest een medewerker die
via de provider van zijn werkgever inlogde daarna alsnog met de hand in de
werkruimte worden gezet -- inclusief het met de hand weer weghalen, wat bij
uitdiensttreding de stap is die overslaat.

**`org` is vanaf nu de tenant**: de juridische, beveiligings- en contractgrens.
Een werkruimtecode is een productinstantie daarbinnen, een leverancierscode is
een zakelijke relatie en nooit een identiteit, en een RTG-account is een mens.
Er komt geen vierde identiteitsmodel bij; de bestaande worden verbonden. Een
tenant kan zonder SSO bestaan -- niet elke klant heeft een provider.

| Endpoint | Doel |
|---|---|
| `GET/POST /api/techniek/tenant` | De tenants lezen en zetten (eigenaar) |
| `POST /api/techniek/tenant/bind` `{org, soort, code}` | Een werkruimte of zaak eraan hangen (eigenaar) |
| `POST /api/techniek/tenant/merk` `{org, merk}` | Het merk van de tenant (eigenaar) |
| `POST /api/tenant/bootstrap` | Wie bedient dit scherm: tenant, werkruimte, merk, rollen, rechten |
| `POST /api/tenant/bootstrap/mijn` | Hetzelfde via de eigen RTG-sessie, voor wie via zijn provider binnenkwam |
| `POST /api/tenant/groep` · `/groepen` | Een IdP-groep aan een rol koppelen (beheerder van die werkruimte) |

- **Een werkruimte of zaak hoort bij hooguit EEN tenant.** Twee tenants die
  dezelfde werkruimte opeisen, geven een werkruimte waarvan het merk -- en
  straks het contract en de export -- afhangt van wie er het laatst schreef.
- **Drie presentatiemodi, en de derde weigert.** `powered` (klantmerk met
  zichtbare RTG-schil) en `private` (RTG alleen nog in de herkomst- en
  juridische regels) bestaan. `sovereign` belooft een eigen domein, eigen
  sleutels en een eigen runtime, en dit huis heeft geen externe hosting, geen
  certificaat-machinerie voor domeinen van derden en geen routering op
  hostnaam -- dus die modus weigert MET de reden en de volgorde uit `TAKEN.md`
  4.21. Weglaten leest als vergeten; weigeren met een reden leest als een
  besluit.
- **Een merkkern in plaats van een vierde huisstijlsysteem.**
  `kern/tenant/merkkern.js` is de definitie (welke velden, welke waarden, welke
  standaard, waar het ophoudt), en sinds kort ook echt de **enige**: het huis
  had het merk-idee vier keer, en die vier waren al uit elkaar gelopen. Het
  Theater weigerde een foute accentkleur met een melding; `kern/webmerk.js` en
  `kern/journalistiek.js` negeerden hem **stil** en gaven `ok: true` terug met
  de oude kleur erin. Voor wie de knop indrukt is dat het verschil tussen weten
  dat het niet mocht en denken dat het gelukt is. Alle drie lezen nu
  `leesMerkvelden()`; de opslag blijft per scope waar hij hoort, en de
  leesstandaard mag verschillen (een krant staat standaard op licht, een
  werkruimte op donker) -- alleen wat GELDIG is, is overal hetzelfde.
  `test/merkkern.test.js` bewaakt zowel de waarderegels als de structuur, want
  zonder dat tweede komt de vijfde kopie er gewoon weer bij.

  Het manifest is **ondertekend en aan de modus gebonden**: klopt het niet met
  zichzelf, dan komt de standaardstijl naar buiten met de reden erbij -- niet
  het manifest dat er stond. Het bestuurt alleen de schermen van het Werk OS;
  e-mail, documenten, facturen, meldingen, het PWA-manifest en de AI-toon
  dragen het niet.
- **De herkomstregel is in geen enkele modus uit te zetten.** Ook in `private`
  blijft in de voet staan wiens software dit is. Wie je personeelsdossier
  bewaart is geen merkvraag maar een AVG-vraag, en het antwoord mag niet
  afhangen van een verkoopcontract.
- **De kleur van een klant geldt binnen zijn eigen blok.** De accentkleur komt
  op de merkbalk en nergens anders; `test/werkmerk.e2e.js` loopt in een echte
  browser ELK element daarbuiten na op die kleur.
- **De identiteitsbrug**: IdP-groep -> tenant -> werkruimte -> tijdgebonden rol
  -> de 18 werkwoordrechten (`kern/tenant/brug.js`). Vier regels dragen hem:
  zonder groepsafbeelding komt er niemand binnen (de huisregel "aanmelden is
  niet binnen zijn" blijft dus staan), een IdP-rol is beheerd en vervalt met de
  groep terwijl handmatige rollen blijven, een IdP herstelt geen ontslag, en een
  SCIM-deactivatie sluit de werkplek in élke werkruimte van diezelfde tenant --
  synchroon binnen het verzoek, en zonder iets van een andere tenant te raken.
- **De bootstrap noemt wat er niet is.** `entitlements`, `quotas`, `policies`,
  `trust` en `lifecycle` staan in `nietGebouwd` met een reden per veld, en niet
  als lege waarde: een leeg quotum leest als "geen verbruik". Het Werk OS zet
  die lijst ook op het scherm.
- **Wat er is weggehaald.** `public/shared/enterprise-shell.{js,css}` was dode
  code -- door geen enkele pagina ingeladen -- die "Enterprise beveiligd · audit
  gereed · Commercial" beweerde zonder bron. Een enterprisebewering hoort een
  bron te hebben; tot die er is, staat de bewering er niet.

**De uitgang: weggaan zonder je geschiedenis te verliezen.**
`kern/tenant/uitgang.js` + `kern/tenant/levensloop.js`. Exit-recht is niet af
met een knop die JSON teruggeeft; de bewering wordt pas waar als de uitvoer
WEER IN TE LEZEN is en er hetzelfde uit komt.

| Endpoint | Doel |
|---|---|
| `POST /api/tenant/export` | De hele werkruimte eruit, met catalogus, checksums en het recept (beheer-token) |
| `POST /api/techniek/tenant/invoer` | Een uitvoer inlezen in een NIEUWE werkruimte (eigenaar) |
| `POST /api/techniek/tenant/levensloop` | Lezen en zetten: actief, opzegging, bewaring (eigenaar) |
| `POST /api/techniek/tenant/bewaringsplicht` | Een legal hold aan of uit, met grond (eigenaar) |
| `POST /api/techniek/tenant/vernietig` | Vernietigen na de termijn, met bewijs (eigenaar) |

- **De uitvoer neemt de hele subboom mee, met een lijst van wat eruit MOET.**
  Een soort die iemand vergeet toe te voegen ontbreekt anders stilzwijgend in de
  export van een vertrekkende klant. Eruit gaan `beheerToken`, `token`,
  `lidToken` en `rtgKey` -- die laatste niet uit geheimhouding maar omdat hij
  buiten de kluis om een werkruimtelid aan een RTG-account koppelt.
- **Het recept reist mee, en dat is het bewijs.** Een checksum die alleen de
  producent kan narekenen bewijst de ontvanger niets. De uitvoer zegt hoe:
  sha256 over de canonieke JSON per soort, en daarna over de catalogus. De som
  is ongezouten -- anders dan `lib/vingerafdruk.js`, die per proces zout omdat
  hij alleen mag tonen DAT er iets veranderde.
- **Inlezen maakt altijd een nieuwe werkruimte**, nooit over een bestaande heen,
  en de leden komen terug zonder sleutel: toegang teruggeven is een besluit.
- **Vier standen en geen zeven.** `voorbereiding`, `proef` en `beperkt` dwongen
  niets af en staan er dus niet. De bewaring sluit de toegang door de SLEUTELS
  in te trekken en niet met een vlag die elke route apart moet lezen.
- **Uitvoer kan in elke stand behalve `vernietigd`**, ook in de bewaring en ook
  bij een betalingsachterstand: een klant die zijn rekening niet betaalt
  verliest zijn geld en niet zijn geschiedenis.
- **Vernietigen kan niet voor de termijn en niet onder een bewaringsplicht**, en
  levert een bewijs met aantallen en checksums en zonder persoonsgegevens -- een
  vernietigingsbewijs met namen erin is een kopie van wat vernietigd moest
  worden.
- **De generieke veger komt hier niet langs.** `werkruimtes` en `tenants` stonden
  in de gatenlijst van het bewaarbeleid; ze er met een gewone termijn bij zetten
  zou erger zijn geweest dan het gat, want hun datumveld is een aanmaakmoment en
  90 dagen daarop wist elke klant die langer dan negentig dagen bestaat. Vandaar
  de derde vorm `eigenRegie` in `bewaarbeleid.js`: hij telt mee, verdwijnt uit de
  gatenlijst, en `veeg()` raakt hem nooit aan.

**Het contract en het quotum.** Drie pakketten (proef, zakelijk, concern) met
twee grenzen die echt bijten: het aantal werkruimtes onder de tenant en het
aantal verzoeken per uur. Wat een verkooppraatje verder belooft -- opslag,
aantal leden, supportvenster, hersteltijd -- staat in `nietAfgedwongen` met de
reden. Een **verlopen contract is geen noodknop**: het weigert nieuwe
inrichting en verder niets; wie er werkt blijft werken en de uitvoer blijft
open. De teller staat per uur in de opslag (een teller die bij elke herstart op
nul begint is geen quotum maar een suggestie) en wordt geteld op de twee deuren
van de werkruimte, niet op 104 routes.

**De bewijspoort.** `POST /api/tenant/status`. Zeven beweringen die elk OF een
bron OF een reden dragen -- versleutelde opslag (staat `RTG_ENC_KEY` gezet),
auditspoor (het aantal journaalregels), eigen identiteitsprovider (een actieve
koppeling), lopend contract, dagelijkse back-up, en twee die **altijd nee** zijn:
eigen domein en SLA. Die laatste is een berekening: vier voorwaarden, waarvan er
vandaag twee ontbreken. Er staat **geen beschikbaarheidsgetal** in de
tenantstand -- de meting is platformbreed, en een cijfer dat de meting niet kan
dragen is preciezer dan de werkelijkheid. Dit is de laag die de weggehaalde
enterprise-schil onmogelijk maakt: een bewering is nu een object met een bron,
en een scherm mag alleen tonen wat op `mag: true` staat.

**En dat scherm staat er nu ook** (`apps/werk/status.js`, onder Instellingen in
het Werk OS). Het is met opzet het tegenovergestelde van een badgemuur: de
beweringen die vandaag NIET waar zijn staan er ook, met hun reden, en de SLA
staat er uitgerekend -- vier voorwaarden, met de twee die ontbreken bij naam.
Er staat geen beschikbaarheidscijfer voor de klant op maar de zin waarom niet:
de telling gaat per routepatroon en draagt geen tenant.

Eén bewering op die pagina bleek zwakker dan hij eruitzag, en dat is
gerepareerd: **"Dagelijkse back-up" hing aan een mapNAAM.** Bestond er een map
die `YYYY-MM-DD` heette, dan stond de bewering op ja -- leeg, half weggeschreven
of met een `db.json` van nul bytes maakte niet uit. `server/backupstand.js`
kijkt nu na of elk bestand dat in de levende datamap staat ook in de back-up
staat en niet leeg is, en of `db.json` opent; de BAK-01-check in de technische
pagina leest dezelfde functie. Een leeg `-wal` telt daarbij als gezond (dat is
het na een checkpoint), en een bestand dat hier niet bestaat wordt de back-up
niet verweten -- allebei omdat een meter die vals alarm geeft, genegeerd wordt.
Het is een aanwezigheidscontrole met tanden en geen herstelproef: of de inhoud
klopt weet je pas als je hem terugzet.

Wat er wel staat is de **meting per capability** (`server/meting-capaciteit.js`).
Dat was het laatste open punt van deze laag, en het is opgelost door twee dingen
aan elkaar te knopen die er allebei al waren: de meting telt per routepatroon,
en `functies.functieVoorPad` weet welke functie bij welk pad hoort -- dezelfde
kaart waarmee een eigenaar een functie uitzet. Daarmee is de oorspronkelijke
bezwaar weg: een storing in een onderdeel dat u niet gebruikt is nu als zodanig
te zien in plaats van dat hij in uw cijfer verdwijnt. Onder de vloer van vijftig
verzoeken komt er **geen** percentage maar de reden (nul fouten op drie
verzoeken leest groener dan elk echt cijfer), routes zonder functie krijgen een
eigen regel in plaats van te verdwijnen, en het venster staat erbij: de meting
zit in het geheugen van dit proces en is dus geen maandcijfer. Op die pagina staat ook de enige regel die een klant zelf waar kan
maken: een knop **Herstelproef doen** (`kern/tenant/herstelproef.js`). Die
exporteert de werkruimte, leest de uitvoer terug in een tijdelijke werkruimte,
legt de inhoud per soort naast het origineel en ruimt die tijdelijke werkruimte
daarna op -- altijd, ook als er onderweg iets stukloopt. Het resultaat wordt
vastgelegd met een datum en wordt de bewering "Uitvoer teruggelezen en
gecontroleerd". Wat het bewijst is het **exit-pad**; wat het NIET bewijst is dat
onze eigen dagback-up terug te zetten is, en dat is de claim waar een SLA aan
hangt -- die voorwaarde blijft dus op nee staan, ook na een geslaagde proef.

De stand is zichtbaar voor het
beheer-token of voor een lid met het recht `werkruimte` (dat draagt alleen
`directie`) -- die tweede sleutel is er omdat het beheer-token in het Werk OS
nergens wordt ingetypt, en een pagina die niemand kan openen is hetzelfde als
een pagina die er niet is.

**SCIM `/Groups`.** Een groepswijziging bij de klant werkte pas door bij de
volgende inlog; bij een sessie van dertig dagen dus een maand. Nu duwt de IdP
hem naar ons toe en beweegt de werkruimte mee in hetzelfde verzoek -- ook, en
juist, voor wie eruit gaat. Een groep draagt een naam en leden en verder niets:
geen rechten (die staan in de groepsafbeelding, gezet door een mens) en geen
nesting. Bij het inloggen wordt de unie van de tokenclaim en de SCIM-tabel
genomen.

**SAML** (`server/sso/saml/`, `POST /api/sso/saml/acs`). Dit stond hier als een
besluit om het NIET te bouwen: een SAML-SP vraagt XML-canonicalisatie en
XML-DSig-verificatie, dit huis heeft nul runtime-afhankelijkheden, en de
faalvorm van zelfbouw is een **stille authenticatie-bypass**. Hij is er nu, en
wat die reden onschadelijk maakt is niet een belofte maar een aanvalstoets.

Hij komt uit op **hetzelfde claimcontract als OIDC** en loopt daarna door
dezelfde `sso/binnenkomst.js` -- dezelfde vijf stappen, dezelfde
identiteitsbrug, hetzelfde overdrachtsbewijs, geen enkele `if (saml)`. Het
profiel is smal met opzet: precies EEN `Assertion` en EEN `Signature` in het
document, het ondertekende element moet de OUDER van de handtekening zijn, een
ID moet naar precies EEN element wijzen, en **de assertie die we lezen moet een
nazaat zijn van het stuk dat is gecontroleerd** -- dat laatste is de regel waar
XML Signature Wrapping op stukloopt. Geen SHA-1, geen HMAC, geen XPath- of
XSLT-transform; de sleutel komt nooit uit `KeyInfo` maar uit de koppeling.
`InResponseTo` moet bij een verzoek horen dat wij hebben gestuurd (dat sluit de
ongevraagde, IdP-initiated inlog af), en zowel het verzoek als de assertie werkt
een keer. Niet gebouwd, met de reden: wij ondertekenen het AuthnRequest niet
(dat bewijst iets aan de provider en niets over het ANTWOORD, en daar zit de
aanval), geen versleutelde asserties en geen Single Logout.

**SAML vraagt een geconfigureerd webadres.** De entityID en het antwoordadres
van een SP zijn identiteit, en dat zijn precies de waarden waartegen de Audience
en de Recipient van een assertie worden gehouden. Ze komen daarom uit `APP_URL`
(of `RTG_DOMAINS`) en niet uit de Host- of Origin-kop van het verzoek -- anders
bepaalt de beller waartegen wij controleren. Staat er geen webadres, dan
weigeren de drie SAML-routes met die reden in plaats van open te gaan met een
gegokte naam.

Inrichten doet de eigenaar met `POST /api/techniek/sso/saml` (entityID, SSO-adres
en het ondertekencertificaat, dat meteen wordt gelezen); wat de klant bij zijn
provider invult staat op `/api/sso/saml/metadata`. De SAML-velden hangen aan de
BESTAANDE koppeling en niet aan een tweede tabel -- twee koppelingen zouden twee
domeinlijsten betekenen die uiteen kunnen lopen, en de domeinlijst is de
beveiliging.

`test/tenantspine.test.js` (15, de regels), `test/tenant.test.js` (8, over de
lijn), `test/tenantuitgang.test.js` (7, de uitgang), `test/tenantcontract.test.js`
(7), `test/tenantbewijs.test.js` (7), `test/scimgroepen.test.js` (5), de
SAML-toetsen (`samlxsw` 12 -- de aanvallen, `samlc14n` 5 -- libxml2 als
scheidsrechter, `samlpoort` 6, `samlacs` 4 -- de echte deur) en de schermtoetsen
`test/werkmerk.e2e.js` en `test/werkcommandbalk.e2e.js` leggen dit
vast; zesendertig mutaties, alle zesendertig RAAK -- onder andere de botsingscontrole weghalen, `sovereign` toestaan, de
merkcontrole overslaan, een leeg quotum in de bootstrap zetten, de IdP een
ontslag laten herstellen, deprovisioning over alle tenants laten lopen en de
accentkleur op de RTG-kopbalk lekken, de geheimen in de export laten staan, een
invoer over een bestaande werkruimte heen schrijven, de bewaringsplicht negeren
en de veger wel aan de eigen regie laten komen. Aan de SAML-kant: de
nazaat-regel eruit halen, de handtekening van zijn element losmaken, twee
asserties toestaan, dubbele ID's toestaan, de digestvergelijking altijd goed
laten zijn, SHA-1 alsnog toelaten, het publiek en het verlopen niet
controleren, de attributen en de naamruimten niet sorteren (die twee zakken
tegen libxml2 en niet tegen onszelf), een verzoek niet verwijderen bij gebruik,
de org-controle op een verzoek weghalen en een assertie zonder ID toelaten. Er
was ook een mutatie die NIET landde -- de gezochte zin stond ook in het
commentaar -- en die staat in `scripts/mutatie.js`, want een mutatie die je niet
hebt zien landen is geen mutatie.

### RTG Web Platform (de automatische bedrijfssite en de browser die bedrijven begrijpt)

De Website-maker (`/apps/sitemaker.html`, `kern/webmaker.js`) en de RTG-browser (`/apps/browser.html`, browserkant in `kern/webmaker-blader.js`) hebben er een laag bij: `server/kern/webplatform.js`, met een principe -- **automatic first, customizable forever**.

- **De automatische bedrijfssite.** `POST /api/supplier/site/genereer` (achter de zaak-inlog) maakt uit het bestaande zaakprofiel in een keer een complete site en zet hem online op de bedrijfsnaam (`es-vedra-cruises.rtg`; is dat adres bezet, dan naam-code). Geen kale profielpagina: hero, intro, en per bron die de zaak echt heeft een sectie. Daarna bewerkt de ondernemer hem met dezelfde maker als ieder lid (`/api/supplier/site/mijn|haal|bewaar|publiceer|offline`, eigenaar `zaak:CODE`). Nog eens genereren overschrijft het handwerk **niet** -- opnieuw beginnen is een aparte keuze (`opnieuw: true`).
- **Live blokken, geen kopieen.** Een gegenereerde site draagt `zaakdata`-blokken die alleen een bron aanwijzen (menu, diensten, kamers, agenda, fotos, reviews, contact). Bij het openen lost de server ze op dat moment uit het zaakprofiel op naar gewone blokken -- het zaakprofiel is het **Business Master Record**: wijzigt de menukaart in de zaak-app, dan staat hij op de site zonder dat iemand de site aanraakt. De browser hoeft er niets voor te kennen.
- **De koppeling komt uit de inlog.** Dat een site bij een bedrijf hoort is een feit uit `supplierAuth`, geen veld in het verzoek: een lid dat `zaakCode` in zijn ontwerp zet, krijgt niet de actiebalk en niet de data van andermans zaak.
- **De browser begrijpt bedrijven.** Hoort een site bij een zaak, dan geeft `/api/browser/open` de zaak-info mee (naam, type, stad, review-gemiddelde) plus de acties die de zaak écht kan (reserveren, bestellen, boeken, diensten, kamers, chat) -- het scherm toont die als actiebalk boven de site, met de leden-app als bestemming. Alleen wat de zaak kan komt terug: een knop die niets doet is erger dan geen knop.
- **Universeel zoeken.** `/api/browser/zoek` vindt sites en bedrijven in een adem; een bedrijf met een eigen online site krijgt het adres mee. Alleen wat toch al publiek is (naam, stad, type) -- het zoekvak is geen achterdeur naar het zaakprofiel, en offline sites zijn ook uit het zoeken weg.

- **De knop in de zaak-app.** `/apps/zaakweb.html` ("Mijn website" in het Meer-scherm van de leverancier-app, zelfde zaak-inlog): status, online/offline, bekijken in de browser, en opnieuw bouwen uit het profiel -- met de waarschuwing erbij dat dat het eigen handwerk weggooit.
- **Het formulier-blok.** Een bedrijfssite draagt een contactformulier; het bericht landt als **klus (ticket) in de werklijst die de zaak al heeft**, op de codenaam van het lid -- geen los postvak dat niemand leest, en de echte naam reist niet mee. Op een site zonder zaak erachter staat het formulier er niet: een knop zonder ontvanger is erger dan geen knop (`POST /api/browser/bericht`).
- **Bladwijzers en tabs in de browser.** Bladwijzers op het toestel zelf (localStorage), met een rij op RTG Start -- de server weet niet wat u bewaart. Tabs met elk hun eigen geschiedenis, in een eigen tabbalk onder de adresbalk.
- **De sjabloon-etalage.** De Website-studio van het Atelier kan een sjabloon **in de etalage** zetten (`/api/office/atelierweb/etalage`); leden zien die als startpunt in de Website-maker ("Begin met een sjabloon", `/api/site/sjablonen` + `/api/site/sjabloon`) en maken er met bewaren hun eigen site van. Vrijgeven is een uitdrukkelijke handeling van het kantoor: werk in uitvoering blijft binnen, ook met het id in de hand.

- **Meerdere pagina's per site.** Naast de voorpagina draagt een ontwerp tot zeven extra pagina's (`kern/webmaker-paginas.js`), elk met eigen naam, slug en blokken -- dezelfde schoonmaak en grenzen als de voorpagina, en dubbele slugs vallen weg. De browser toont een paginabalk en begrijpt `naam.rtg/contact` in de adresbalk; de maker heeft een pagina-wissel in de kop (toevoegen, hernoemen, weghalen). De automatische bedrijfssite gebruikt dit meteen: **Home** (hero, beeld, reviews), **Aanbod** (alles wat de zaak verkoopt, live) en **Contact** (bezoekgegevens + het formulier).

- **AI in de maker, als assistent en niet als black box.** De AI-knop in de Website-maker (`kern/webmaker-ai.js`, `POST /api/site/ai` en `/api/supplier/site/ai`) past het ontwerp aan zoals het NU op het doek staat -- "maak het luxer", "maak een pagina voor bruiloften", "herschrijf de intro zakelijker". Het antwoord is een aangepast ontwerp dat de maker toont; **er wordt niets opgeslagen** -- de gebruiker beoordeelt, verfijnt en bewaart zelf, en dan pas loopt het langs de gewone schoonmaak. Zonder AI-sleutel draait een demostand met drie eerlijke transformaties (luxer, licht/donker, pagina toevoegen); wat hij niet kan, zegt hij -- geen gedaan-vinkje zonder daad.

- **De persoonlijke site: ieders eigen plek op het RTG-web.** Een knop in de Website-maker ("Maak mijn persoonlijke pagina", `POST /api/site/persoonlijk`) genereert in een keer een eigen site op de **codenaam** (`codenaam.rtg`) -- de echte naam blijft in de kluis, ook hier. De browser begrijpt personen zoals hij bedrijven begrijpt: bij een ledensite komt de codenaam mee en biedt de balk "verbind & chat" aan.
- **Het formulier wordt een gesprek.** Op een ledensite landt een formulierbericht als **gesprek in de leden-app** -- maar alleen tussen **verbonden** leden, precies zoals de vriendenchat zelf (en langs dezelfde 9+-poort): een formulier is geen achterdeur om vreemden te bereiken; wie niet verbonden is, krijgt de reden en de weg. De browser-leeskant staat sindsdien in een eigen routebestand (`routes/webbrowser.js`).

- **Versiegeschiedenis en terugzetten.** Elke bewaring legt de **vorige** stand weg (`kern/webmaker-versies.js`, tien standen per site; `/api/site/versies` + `/api/site/herstel` en de zaak-varianten). Dat is er gekomen omdat twee knoppen werk kunnen overschrijven zonder dat de maker het meteen ziet: de AI-assistent en "opnieuw uit mijn profiel". Twee dingen liggen vast: **het adres en de online-stand reizen niet mee terug** (herstellen is een ontwerp-handeling, geen publicatie-handeling -- anders haalt terugkijken je site uit de lucht), en **herstellen is zelf ook een bewaring**, dus wie zich vergist kan weer vooruit. Zichtbaar als "Historie" in de maker en "Eerdere versies" in de zaak-app.

- **Concept en online zijn twee dingen (staging).** Wat de maker bewerkt is het **concept**; wat bezoekers zien is de **bevroren stand van het laatste publiceren**. Zonder dat onderscheid gaat elke halve zin die iemand intypt meteen het web op, en dat is voor een bedrijfssite geen werkbare manier van werken. Bewaren verandert dus het concept en niet het web; met "Zet wijzigingen online" (`/api/site/live`) gaat het naar buiten, en de maker ziet in het lint dát er iets klaarstaat. Een site van vóór deze laag heeft nog geen bevroren stand en serveert gewoon zijn concept, zodat er niets omvalt.
- **Bij een zaak is naar buiten brengen werk van de leiding.** Bewerken mag iedereen die bij de zaak werkt -- dat raakt het concept; online gaan, wijzigingen publiceren, genereren en uit de lucht halen zitten achter `managerOnly`, dezelfde grens als op de menukaart en de prijzen. Dat is de goedkeuringsflow in zijn eenvoudigste eerlijke vorm: de balie kan een voorstel klaarzetten, de leiding beslist of het buiten komt. De zaak-routes staan sindsdien in `routes/zaakweb.js`.

- **De componentbibliotheek: rijblokken en drie nieuwe live bronnen.** Naast de bestaande blokken zijn er nu **faq** (vraag en antwoord) en **prijzen** (dienst, prijs, omschrijving), allebei met rijen die per rij worden geschoond en begrensd op twaalf -- en met de lege rijen eruit **voor** het begrenzen, anders eet een lege regel in het midden een plek op die de maker wel had ingevuld. Nieuwe live bronnen: **events** (alleen gepubliceerde), **vacatures** (die stonden al in de publieke vacaturelijst van `kern/werk.js`) en **openingstijden** (de `vakUren` van een dienstverlenende zaak). De automatische bedrijfssite krijgt daarmee een pagina **Werken bij ons**.
- **Een pagina die niets te zeggen heeft, verdwijnt.** Draagt een pagina alleen live blokken en blijft er niets van over -- een zaak zonder vacatures -- dan staat hij niet in de navigatie: een deur naar een lege kamer is erger dan geen deur. Pagina's die de maker zelf vulde blijven altijd staan, ook als ze leeg zijn; die onder zijn handen laten verdwijnen zou hem overvallen.

- **Het team-blok, met een opt-in per mens.** Wie van het personeel op de site staat, is een **publicatiebesluit** en geen veld in de personeelsadministratie: "werkt hier" en "staat op onze site" zijn twee verschillende dingen, en het tweede hoort niemand te overkomen omdat het eerste waar is (`kern/webmaker-team.js`, `/api/supplier/site/team` + `/team/zet`, beide achter `managerOnly`). Vier dingen liggen vast: **niemand staat er vanzelf op** (de lijst begint leeg, de leiding zet per persoon aan), we bewaren **alleen verwijzingen** naar staff-id's zodat wie uit dienst gaat vanzelf van de site verdwijnt, er gaat **niet meer naar buiten dan naam en functie** (geen rol, geen lidmaatschap, geen contactgegevens), en een id van iemand die er niet werkt komt er niet in.

- **Publiceren op een gekozen moment.** De ondernemer werkt overdag aan zijn nieuwe kaart en wil hem zondagnacht buiten hebben, niet om half drie tussen de gasten door (`kern/webmaker-plan.js`, `/api/site/plan`). Twee dingen zijn geen detail: er gaat naar buiten **wat er op dat moment klaarstaat** en niet wat er stond toen u plande (anders verdwijnt alles wat u er daarna nog aan deed, en merkt u dat pas als het buiten staat), en plannen kan **alleen voor een site die al online is** -- online gaan is een eigen besluit met een adres erbij. Het geplande moment is een belofte aan de **bezoeker** en niet aan de klok van deze server: de bezoekkant vraagt het per site opnieuw, de veger is de achtervang voor sites die niemand bezoekt.
- **Het spoor: wie deed wat, wanneer** (`kern/webmaker-spoor.js`, `/api/site/spoor`). Dit hoort bij de afspraak dat alleen de leiding publiceert -- een goedkeuring waar geen verslag van is, is achteraf niet te controleren en dan is het geen goedkeuring maar een gewoonte. Bij een zaak staat de naam erbij waarmee die persoon inlogde; er staat nooit inhoud in (wat er veranderde staat in de versiegeschiedenis, hier alleen dát het gebeurde). Lezen is werk van de leiding.

- **Een site lezen in je eigen taal** (`kern/webplatform-taal.js`). Dit huis doet dat bij berichten al zo: iedereen schrijft de eigen taal, iedereen leest de zijne. Voor websites is dat de enige vorm die werkt -- een ondernemer die zijn site met de hand in zes talen moet bijhouden doet het niet, en dan staat er in vijf talen niets. Heeft een lid een vaste taal (`memberTaal`), dan komt de site in die taal binnen. Drie dingen liggen vast: **een naam is geen zin** (de sitetitel, de kop van een hero, de bron van een citaat en een prijs blijven staan; het is een **witte lijst** per bloktype, zodat een nieuw veld niet per ongeluk meegaat), **het wordt gezegd** (het antwoord draagt dat het machinevertaald is en uit welke taal -- een vertaling die zich voordoet als het origineel is een bewering die de maker niet heeft gedaan), en **het is begrensd** (hooguit tweehonderd unieke zinnen per site; liever een halve vertaling dan een pagina die blijft hangen). Zonder AI-sleutel doet het woordenboek wat het kan en blijft de rest staan.

- **Cijfers: interne analyse voor de ondernemer en voor RTG** (`kern/webmaker-meting.js`, `/api/site/cijfers`, `/api/supplier/site/cijfers`, `/api/office/web/overzicht`). Dit huis meet nergens mensen, en hier ook niet: wat wordt bijgehouden is een **telling van gebeurtenissen**, geen dossier van bezoekers. Wel: hoe vaak een site is geopend, per pagina, per dag, en hoeveel formulierberichten er binnenkwamen. Met opzet **niet**: geen bezoeker (geen codenaam, geen sleutel, geen "terugkerende bezoeker" -- dan is het een lijst van wie waar keek), **geen tijdstippen** (per dag een getal; op een site met drie bezoekers per dag is "om 14:32" een aanwijzing naar een mens), en geen herkomst, kijktijd of bereik. Het antwoord draagt zelf de lijst van wat er **niet** gemeten wordt, want anders leest iemand "12 bezoeken" als "12 mensen". Een eigen bezoek telt niet mee: wie zijn eigen site nakijkt, hoort zijn cijfers niet op te blazen. RTG ziet over het web heen hoeveel sites er zijn, hoeveel online, hoeveel zakelijk en welke het best bezocht worden -- ook daar alleen tellingen. Het onderscheid met het spoor is met opzet: **het spoor gaat over mensen** en is werk van de leiding, **de cijfers gaan over de site** en noemen niemand, dus die leest iedereen die er werkt.

- **Een merk met vestigingen: een hoofdontwerp, N lokale sites** (`kern/webmerk.js`, `/api/office/merk/*`). Dit ligt bij het **kantoor** en niet bij de zaken, en dat is de kern van het ontwerp: een zaak kan zich hier niet tot moederbedrijf van een andere zaak uitroepen -- zou dat kunnen, dan is het overnemen van andermans website een formulier ver weg. Het kantoor stelt het merk samen, koppelt bestaande zaken als vestiging (een zaak hoort bij hooguit een merk; twee merken die dezelfde vestiging opeisen geven een site die om beurten van huisstijl wisselt) en zet een hoofdontwerp. **Uitrollen** geeft elke vestiging dat ontwerp en zet haar online op haar eigen naam.
- **Waarom een sjabloon genoeg is voor zevenendertig sites.** De blokken van het hoofdontwerp zijn grotendeels **live** blokken: die lossen bij ieder bezoek op uit het profiel van *die* vestiging. Een sjabloon met een menu-blok levert in Amsterdam de Amsterdamse kaart en op Ibiza de Ibizaanse. Er wordt dus niets gekopieerd wat per vestiging verschilt -- dat was al opgelost toen het Business Master Record er kwam.
- **Wat de vestiging wel en niet mag.** Zij beheert haar eigen **inhoud**: openingstijden, foto's, menukaart, team -- dat staat in haar zaakprofiel en komt vanzelf op de site. Wat zij niet mag is de **huisstijl** veranderen: thema, accent en de vrije kleuren komen van het merk en worden bij **elke bewaring opnieuw opgelegd**. Een vestiging die het merk kan omverven, is precies waarom een keten centraal beheer wil. Uitrollen overschrijft het handwerk op een vestigingssite -- dat is het punt van centraal beheer, en het is niet stiekem: de vorige stand gaat gewoon de versiegeschiedenis in.

- **Het kantoorscherm** `/apps/merken.html`: merken maken, vestigingen koppelen en ontkoppelen, het hoofdontwerp zetten en uitrollen. De uitrol-knop zegt vooraf wat hij overschrijft en wat niet. Op het scherm van de vestiging (`/apps/zaakweb.html`) staat bij welk merk zij hoort en dat de huisstijl daarvandaan komt -- anders zet een vestiging kleuren die bij het bewaren stilletjes terugspringen, en een stille weigering is geen weigering.

- **Een formulier heeft een soort, en het bericht komt echt aan.** Zes soorten (vraag, offerte, sollicitatie, reservering, klacht, feedback); de soort bepaalt wat er gevraagd wordt en **hoe het bericht bij de ontvanger heet** -- een klacht die als "vraag" in een werklijst belandt, wordt ook als vraag behandeld. De zaak krijgt bovendien een **seintje** (een klus in een lijst is nog geen bericht: zonder melding kan een zaak dagen niet weten dat er iemand wacht), en de inzender krijgt een **bevestiging** in zijn eigen app -- anders stuurt hij het over een uur nog eens, of belt hij. Bij een ledensite draagt het gesprek de soort mee.

### Een eigen domein buiten het RTG-web (standaard uit)

`hotelazur.nl` naast `hotelazur.rtg`. Dit is de enige functie in het web-platform die **standaard uit** staat, en dat is precies de reden dat hij bestaat: een extern domein haalt een site **buiten** het RTG-web. Binnen het huis leest alleen een ingelogd lid een site; op een eigen adres leest iedereen hem. Dat is geen instelling maar een verandering van wie de lezers zijn, en dus een besluit van de boardroom (functie `dom-eigendomein`, `standaard: false`).

- **Twee sloten.** De boardroom zet de functie aan voor het hele huis; daarna koppelt de eigenaar per site zelf een adres. Een lid hoort niet publiek te worden doordat de boardroom een knop omzette.
- **"Standaard uit" betekende bijna niets.** De functieschakelaar-middleware had een snelle uitgang: is er nog nooit iets geschakeld, dan staat alles aan. Die klopte zolang élke functie standaard aan was -- en dit is de eerste die dat niet is; op een verse installatie stond hij daardoor gewoon open. De uitgang kijkt nu eerst of er ergens een functie standaard uit hoort te staan (`HEEFT_UIT_STANDAARD`).
- **Wat er wel en niet gebeurt.** Komt een verzoek binnen op een gekoppelde hostnaam, dan serveert `kern/webdomein-html.js` de **gepubliceerde** stand als echte HTML, voor een bezoeker zonder leden-app. Dát het verzoek hier aankomt is DNS en een certificaat, en dat draait buiten deze app.
- **Het formulier gaat niet mee naar buiten.** Dat landt hier als klus of als gesprek, en allebei hangen aan de codenaam van een ingelogd lid; een voorbijganger heeft die niet. Er staat een regel voor in de plaats die naar de leden-app wijst.
- **Offline is overal offline.** Uit de lucht halen op het RTG-web zet ook het eigen adres stil.

`test/webplatform.test.js` (zevenentwintig scenario's) legt dit vast; achtendertig mutaties (leden mogen zelf een zaakCode zetten; de live blokken worden niet meer opgelost; het formulier accepteert sites zonder ontvanger; de etalage-grendel valt weg; het oplossen slaat de extra pagina's over; de AI-demostand zegt "gedaan" zonder daad; het formulier bereikt ook niet-verbonden leden; het adres reist mee terug bij een herstel; herstellen legt zichzelf niet weg; de bevroren stand overleeft een bewaring niet; de browser leest het concept in plaats van wat gepubliceerd is; een medewerker mag zelf publiceren; een lege live-pagina blijft in de navigatie staan; de rijen van een faq-blok worden niet begrensd; het team staat standaard op de site; een medewerker mag zelf bepalen wie erop komt; een vreemd staff-id wordt aangenomen; een planning bevriest de stand van het plannen; plannen mag zonder online te zijn; het spoor staat open voor iedere medewerker; publiceren laat geen spoor na; de naam wordt meevertaald; de prijs wordt meevertaald; de vertaling wordt niet gemeld; de schakelaar staat standaard aan; de snelle uitgang negeert standaard-uit; een offline site blijft op het eigen adres staan; een eigen bezoek telt mee; bezoekers en tijdstippen worden bewaard; de huisstijl van het merk wordt niet opgelegd; een zaak mag bij twee merken horen; een verzonnen zaakcode wordt als vestiging aangenomen; het merk wordt niet aan de vestiging gemeld; de zaak krijgt geen seintje; de inzender krijgt geen bevestiging; de soort wordt genegeerd), alle achtendertig **RAAK**. De adres-mutatie overleefde de eerste opzet van die toets -- alle standen waren daar al gepubliceerd, dus het adres kwam toevallig identiek terug; de toets legt nu een stand weg van *voor* het publiceren, en toen was hij wel raak.
### RTG Wereld (één sociale app, vijf werelden)

*One identity. One network. One app. Your context.*

Er stonden vijf sociale apps naast elkaar: **De Salon** (het besloten netwerk), **Pulse** (het microblog), **RTG Zakelijk** (de LinkedIn-laag), de **genootschappen** en de **verhalen/snaps**. Voor een lid is dat vijf keer dezelfde vraag — *wat is er?* — met vijf antwoorden op vijf plekken. En het bracht precies het probleem van LinkedIn mee: om een zakelijk contact te spreken moest je naar een andere app, terwijl het gewoon één mens is.

`server/kern/wereld/` legt daar één laag overheen, met één app: `/apps/wereld.html`. Bovenaan staat één schakelaar — **Alles · Lifestyle · Business · Communities · Privé** — en die verandert niet van app maar van *wereld*. Dezelfde identiteit, dezelfde feed, dezelfde chat, andere context.

Het ontwerpbesluit dat alles draagt is hetzelfde als bij de Media OS: **de wereldlaag bezit die vijf domeinen niet.** Hij is een *leeslaag*. Er komt geen `db.data.wereld.posts` naast de bestaande opslag; elke bron wordt bij het opvragen uit zijn eigen domein gehaald en op één tijdlijn gezet. Plaatsen loopt er dan ook nooit langs: wie in Lifestyle plaatst, plaatst in De Salon, en die route houdt zijn eigen 9+-keuring, zijn eigen rem en zijn eigen eigenaarschap. Een tweede administratie zou LAT.md-regel 4 zijn, met als eerste zichtbare gevolg dat een verwijderde Salon-post hier gewoon blijft staan.

- **Wat een pas mag, staat op één plek.** `server/kern/wereld/rechten.js` is de enige waarheid over welke werelden opengaan, welke profiellagen je hebt en wat je verder mag. De server poort ermee én het scherm tekent zich ermee (via `/api/wereld/state`), dus een knop die zichtbaar is maar door de server geweigerd wordt, kan niet ontstaan. De trap is **cumulatief**: elke pas erft alles van de pas eronder, berekend en niet overgeschreven. Ook `routes/zakelijk.js` leest deze lijst — dat domein had eerst zijn eigen `PRO`-lijst, en die is weg.
- **Gratis is niet uitgekleed.** De RTG Pass krijgt een volwaardig netwerk: plaatsen, lezen, reageren, verhalen, genootschappen, chat. Wat de **Lifestyle Pass** erbij krijgt is de professionele wereld plus het gereedschap dat elders achter een abonnement zit (geavanceerd zoeken, wie je profiel bekeek, bereikcijfers, netwerkanalyse, de creator-laag). De **Business Pass** krijgt daar de kant van de onderneming bij: werving, sales, bedrijfsinzichten en het ondernemersprofiel. Inbegrepen in het lidmaatschap, niet apart verkocht.
- **Een gesloten wereld verdwijnt niet, hij staat er gedimd bij** — met de reden die de *server* meegaf. Wegstoppen wat je niet hebt is oneerlijk naar beide kanten: je weet niet wat je mist, en je merkt ook niet dat het bestaat.
- **De modus is een voorkeur, geen recht.** Je keuze wordt onthouden, maar bij het lezen altijd opnieuw langs de rechten gehaald. Wie ooit Business koos en later terugvalt naar de gratis pas, blijft daar niet in staan omdat er een oude waarde in de database stond (LAT.md-regel 7: de grendel hangt aan het doel).
- **Geen algoritme.** Chronologisch, aflopend, klaar — dezelfde merkregel als bij Pulse. De modus *filtert*, hij rangschikt niet. Geen "voor jou", geen oneindige trucs.

**En Berichten blijft een eigen app.** Dat is een bewuste keuze en geen tussenstand: `/apps/comm.html` (de Universal Inbox, met bellen en videobellen) wordt niet opgeslokt. Contact heeft een andere levensduur dan een tijdlijn — je berichten wil je kunnen openen als de feed plat ligt, vanaf een melding, naast de app. Een gesprek dat alleen bestaat als tabblad van iets anders, raak je kwijt zodra dat iets anders verandert.

De **naad** ertussen staat in `server/kern/wereld/koppel.js` en is één afspraak: een verwijzing heet `rtg://<soort>/<id>`, en die ene kaart zegt welke app hem opent. Geen enkel scherm bouwt zelf een app-URL, dus een app die verhuist laat geen dode links achter. Overal waar je in de wereld een mens ziet staat **Bericht**, en die brengt je in de aparte berichten-app, in het gesprek met die persoon — met het onderwerp als verwijzing klaar in het veld. De link draagt een **codenaam en nooit een sleutel**: hij belandt in een browserhistorie, een melding of een screenshot, en de identiteitskluis blijft gescheiden. Een vluchtig ding (een verhaal leeft 24 uur, een snap één keer) gaat er met opzet niet als verwijzing in mee; wie een soort toevoegt aan de kaart beantwoordt die vraag expliciet.

**Eén profiel met lagen, en de zichtbaarheid per veld.** `server/kern/wereld/profiel.js` legt vier lagen naast elkaar — persoonlijk, professioneel, creator, ondernemer — en welke je hebt volgt uit je pas. Ook dit is een **leeslaag**: alle vier bestaan al ergens (je bio in De Salon, je kop in RTG Zakelijk, je creator-kaart en je zaken bij je zaak, gevonden via de sleutelbos in `kern/eenaccount.js`). Er komt geen vijfde profiel naast; invullen doe je in de app die de laag bezit, en het scherm krijgt per laag de **bron** mee zodat het kan zeggen wáár dat is in plaats van een invoerveld te tonen dat niets opslaat.

Wat de wereldlaag hier wél bezit, is het stuk dat nergens bestond: **wie wat mag zien, per veld.** Vijf standen, en elk wijst aantoonbaar een andere groep aan — `iedereen`, `contacten` (je verbindingen), `zakelijk` (verbindingen die óók een zakelijk profiel hebben), `genootschap` (wie een genootschap met je deelt) en `alleenik`. De standaarden zijn een besluit, geen smaak: wat je over jezelf schrijft staat standaard bij je contacten, je functiekop staat standaard open — een zakelijk netwerk waarin niemand elkaar kan vinden is geen netwerk.

In de app zit dat achter de **Profiel**-tab: per laag zie je wat erin staat, waar je het invult, en wie het mag zien. Er staan hier bewust geen invoervelden — die horen in de app die de laag bezit.

Er stonden er eerst **zes**, met `vrienden` naast `contacten`. Bij het bouwen bleek dat een lege belofte: dit huis heeft één vriendengraaf, dus die twee zouden precies dezelfde mensen aanwijzen — twee knoppen met hetzelfde gevolg, waarbij je denkt iets af te schermen wat je niet afschermt. Die is weg. En een afgeschermd veld is van buiten **niet te onderscheiden** van een leeg veld, want "hij heeft wel iets ingevuld, maar niet voor jou" is zelf ook informatie.

**De vermogens van Lifestyle en Business, en een lijst die eerlijk blijft.** Elke naam in `rechten.js` is óf een echte poort, óf staat met een opgeschreven reden als *beschrijvend* — en `test/wereldvermogens.test.js` loopt over elke naam heen en zakt zodra er een bijkomt die geen van beide is. Dat is de belangrijkste uitkomst van deze laag: niet een functie, maar een handhaver.

Want de lijst stond vol beloftes die niets deden. `werving.suite`, `sales.suite`, `events.zakelijk`, `leren.certificaten`, `ai.loopbaan`, `creator.gereedschap` — en twee daarvan beloofden achter een **betaalde** pas iets wat elders **gratis** al bestond: Rahul als loopbaancoach staat in `kern/metier/ai.js` voor elk lid, en bevestigde kwalificaties staan in `kern/metier/bewijs.js`. Die namen zijn eruit in plaats van half aangezet.

- **Geavanceerd zoeken** (`/api/wereld/zoek`) zoekt op functiekop, sector, plaats, vaardigheid, open-voor-werk en een vrije term. Het dragende ontwerpbesluit: **zoeken vindt alleen wat je mag zien.** Wie zijn sector afschermt, is niet op sector te vinden — ook niet als je precies de goede term intikt, en ook niet via de vrije term. Elk filter noemt het véld waar het op kijkt en loopt langs dezelfde `magZien` als het profiel zelf. Een zoekmachine die matcht op velden die hij daarna niet toont, is een lek met een nette voorkant: je leest de waarde niet, maar je leidt hem af uit het feit dat iemand in de uitslag staat.
- **Netwerkanalyse** (`/api/wereld/introductie`) zegt wie je bij iemand kan introduceren — op codenaam, en bewust begrensd tot een handjevol: een volledige lijst van wie jullie allebei kennen is een sociale kaart van een ander, en dat is meer dan je nodig hebt om een introductie te vragen. Dezelfde som stond al in `routes/zakelijk.js` voor de gedeelde connecties in de gids; die staat nu één keer in `kern/wereld/netwerk.js` en beide gebruiken hem.
- **Bereik** (`/api/wereld/bereik`) — wat je plaatste over De Salon, Pulse en het zakelijke prikbord heen, en welke stukken het meest zijn opgepakt. Bewust **geen** vergelijking met vorige week, geen percentage, geen ranglijst: dat zijn de lussen die je aan het posten houden. En het antwoord zegt zelf dat het reacties telt en géén vertoningen — RTG houdt niet bij wie wat heeft gezien.
- **Bedrijfsbeeld** (`/api/wereld/bedrijf`) — wat er van een onderneming te zien is uit wat RTG al weet omdat het er gebeurt: de zaak, zijn open vacatures, zijn kansen. Geen ingekochte bedrijfsdata en geen geschatte omzet; wat we niet weten staat er als zodanig bij.
- **Talentpool en leads** (`/api/wereld/lijst`) — één implementatie, twee lijsten met eigen standen. Je bewaart een **codenaam met een notitie**, nooit een e-mailadres of een echte naam, en je kunt alleen bewaren wie je ook had kunnen vinden — anders is de lijst een omweg om te toetsen of iemand bestaat. Een volledige ATS of CRM zit er *niet* achter, en dat is opzet: een half aangezette wervingslaag is gevaarlijker dan een afwezige.
- **Rahul met drie lenzen** (`/api/wereld/rahul`) — netwerk, recruiter, sales. Ze werken uitsluitend op gegevens die jij zelf al mag zien, dus "vraag het aan Rahul" is geen achterdeur om de zichtbaarheid heen. Het antwoord draagt altijd de **stof** mee waarop het is gebaseerd: een advies waarvan je de grond niet kunt nakijken is een orakel.
- **Wie bekeek mijn profiel** (`/api/wereld/bezoekers`) — inbegrepen, niet verkocht, en zonder het addertje dat andere platformen eraan hangen. **Er is geen sluipstand:** wie kijkt wordt geteld, en de kijker krijgt dat te horen in hetzelfde antwoord. Een dienst waarin de een de ander onzichtbaar kan bekijken, verkoopt die asymmetrie zelf. Het is een logboek en geen groeiteller: per kijker één regel met de laatste keer en hoe vaak, geen grafiek. Bezoeken verdwijnen na 90 dagen, en dat gebeurt echt — de leeslijst ruimt ze op in plaats van ze te verbergen.

**De modus reist mee naar de inbox.** Kies je Business, dan opent de berichten-app in de la *zaken*. Die kaart staat in `koppel.js` en is met opzet bijna leeg: de inbox is geordend naar de **bron** van een gesprek, de wereldschakelaar gaat over **context**, en die twee vallen vandaag op precies één plek samen. Lifestyle, Communities en Privé zouden alle drie op *mensen* uitkomen — drie knoppen met hetzelfde gevolg, en dat is dezelfde leugen als `vrienden` naast `contacten` was. Een toets houdt de kaart tegen de échte ladenlijst aan, zodat een hernoemde la hier niet stil blijft staan.

De vijf apps eronder blijven gewoon bestaan en werken los: wie recht naar De Salon of naar het kansenbord wil, hoort daar zonder omweg te kunnen.

Bewezen door `test/wereldlaag.test.js` (veertien toetsen: de gesloten wereld is echt gesloten — ook bij een rechtstreekse aanvraag —, een zakelijke post lekt niet in de "Alles" van een gratis pas, een prikbordbericht komt bij de leden en juist niet bij wie erbuiten staat, de feed loopt aflopend over de héle lijst), `test/wereldprofiel.test.js` (zes toetsen, waaronder de vijf zichtbaarheden op ÉÉN opstelling van vier kijkers — de enige manier om te bewijzen dat ze echt iets verschillends doen) en `test/wereldlaag.e2e.js` (het scherm in een echte browser: Business staat gedimd, de Salon-post staat in de wereldfeed, en "Bericht" landt in het juiste gesprek in de aparte berichten-app zonder sleutel in de URL). Vijftien mutaties uit LAT.md-regel 2. Veertien raak op de juiste toets; de vijftiende **sloeg af**, en dat was de nuttigste van allemaal — hij legde bloot dat de schermtoets zelf niet kon zakken (een `waitForFunction` met een async functie wacht op een Promise, en die is altijd waar). Die toets stelt zijn vraag nu vanuit Node, en daarna bijt de mutatie wel.

Twee stille fouten kwamen bij dat bouwen boven water, allebei van het soort dat geen enkele foutmelding geeft. De genootschap-lezer las de opslag verkeerd (de groepen staan in `db.data.genootschap.groepen`, niet als losse sleutels) en gaf dus **altijd nul berichten**; en de auteursnaam liep via `liveCodename`, dat een sessie verwacht en voor een kale sleutel `null` teruggeeft — waarna elke auteur stil **"Een lid"** heette. Beide bleven staan omdat de toetsen keken of de bron meedeed in plaats van of er inhoud uitkwam, en of er een naam stond in plaats van wélke. Dat is precies LAT.md-regel 9, en de toetsen vergelijken nu de echte waarden.
### RTG Reizen (de reiswereld, laag 2)

`server/kern/reiswereld.js` + `/api/reis/wereld` + `/apps/reizen.html`. De eerste
super app die volgens de regel in `PLATFORM.md` is gebouwd: hij **orkestreert**
de reisdomeinen en vervangt ze niet. Verblijven, Reisbureau, Vluchten en Hangar
houden hun eigen catalogus, hun eigen diepte en hun eigen boekingsstroom.

Wat hij toevoegt is wat nergens bestond: **uw komende reis bij elkaar**, uit alle
domeinen tegelijk, op datum — de vlucht van dinsdag, het hotel van woensdag en de
aangevraagde reis van volgende maand in één tijdlijn, ongeacht in welke app u ze
boekte.

Wat hij met opzet **niet** heeft: een knop die boekt, wijzigt of annuleert. Elke
regel is een link naar de app die het echte werk doet. Zou dit scherm ook boeken,
dan was er een tweede plek waar een reis ontstaat, en dan is "waar staat mijn
boeking echt" binnen een maand niet meer te beantwoorden (LAT.md regel 4). De
module heeft dan ook geen eigen collectie, schrijft nooit, en bewaart niets: elke
regel wordt bij het opvragen uit het domein zelf gehaald via de functie die dat
domein al had. `test/reiswereld.test.js` bewijst dat door de domeinen te
veranderen *nadat* de wereld is samengesteld, en door te toetsen dat de laag
alleen `komend()` aanbiedt en verder niets.

**De regel die deze laag het scherpst maakt: een bron die stilvalt, verzwijgt
zichzelf niet.** Een reiswereld hangt per definitie aan drie andere domeinen.
Valt er één weg en toont het scherm gewoon de andere twee, dan *lijkt* het
reisschema compleet — en zo mist iemand een vlucht. Elke bron wordt daarom apart
opgehaald; wat niet lukte komt als naam terug in `stil`, en het scherm zegt dan
hardop dat dit een onvolledig en geen leeg reisschema is. De mutatie die de toets
laat zakken staat in het testbestand: laat `bron()` de fout stil opeten, en twee
toetsen vallen om terwijl de app er ongewijzigd uitziet.

De domeingrens deed hier trouwens zijn werk: `/api/reis/wereld` kreeg bij de
eerste aanroep een 500 omdat het domein `reis` `kern.reiswereld` niet in
`GRENZEN.json` had staan. Dat is geen hindernis maar de bedoeling — een domein
dat verder reikt dan het opschrijft, hoort te stuiten.

### RTG Bank & RTG Stad (de eigen infrastructuur)

- **RTG Bank** (`server/kern/bank/` + `kern/bankregie/`): een eigen dubbel-boekhoudend grootboek naast RTG Pay (som altijd exact nul, bewaakt door BANK-01 en PAY-02 op het technische bord). De boardroom-knop heeft drie standen (partner / hybride / eigen) met vier-ogen-autorisatie bij opschalen en een nood-fallback naar de kaart-rails; de leden-bank (rekeningen met echt IBAN, sparen, passen, krediet, salarisrun uit de klokuren) gaat pas open als de boardroom hem live zet en het lid akkoord geeft. In de eigen-stand lopen ook de Pay-autoload en de 30% RTFoundation-afdracht over de eigen rails. Alles wat het huis ECHT verlaat krijgt naast de boeking een **betaalopdracht** (`kern/betaalopdracht/`, voor de bank bedraad in `kern/bank/uitgang.js`): die wordt vastgelegd voordat de rail wordt gebeld, wordt bij een mislukking opnieuw ingediend met dezelfde idempotentiesleutel, en boekt het geld terug als de rail hem blijft weigeren. Het openstaande bedrag staat als **reconciliatie** naast de sluitcontrole in `/api/office/bank/gezond` (`railOpenCenten`) -- twee verschillende metingen, want een grootboek kan perfect sluiten terwijl er geen euro is aangekomen. De provider-webhook sluit een opdracht ook echt af: `payout.paid` zet hem op AFGEWIKKELD, `payout.failed`/`payout.canceled` boeken het geld terug -- de mislukte payout is daar het belangrijke geval, want dan staat het geld van de klant af zonder aan te komen. Alle drie de uitgangen delen die rij -- de bank-SEPA, de partneruitbetaling van RTG Pay en de 30%-afdracht van het fonds -- zodat `railOpenCenten` het getal van het hele huis is en niet van een van de drie. De teruggang blijft per rail, want elk boekt in zijn eigen grootboek terug; een soort zonder geregistreerde teruggang wordt geweigerd in plaats van geraden.
- **Van uren naar uitbetaling, in één keten.** Een medewerker klokt, het contract bepaalt het loon, de loonrun rekent (`kern/payroll/`), manager en administrateur tekenen apart, de run wordt definitief, en pas dan maakt het betaalbestand de **netto** posten die de bankbatch uitbetaalt (`/api/office/bank/salaris/run` met een `runId`). Dat was er niet: de bank had een eigen salarisrun die **bruto** uitbetaalde -- uren maal het uurloon van de zaak -- buiten de loonadministratie om, zonder inhouding, zonder vier ogen en zonder aangifte, terwijl payroll ondertussen het goede netto bestand maakte dat niemand uitbetaalde. Twee administraties van hetzelfde loon, en de verkeerde had de knop. De raming uit de geklokte uren bestaat nog wel (`/api/office/bank/salaris/voorstel`) maar zegt nu zelf `uitbetaalbaar: false`: hij is om mee te plannen, niet om mee te betalen. De loonrun levert de bedragen, de bank de bestemmingen (welk personeelslid aan welk RTG-lid hangt en welke rekening dat lid heeft) -- elk levert wat hij echt weet. Gevolg dat je moet kennen: een zaak in een land zonder geladen jaargang kan geen salaris meer uitbetalen, zie TAKEN.md 4.25. En een jaargang die in zijn eigen bestand meldt dat de cijfers niet tegen de bron zijn gelegd -- zoals de meegeleverde NL-jaargang -- gaat niet zomaar aan: aanmerken kan alleen uitdrukkelijk en met een reden die blijft staan, en elke run die erop draait draagt `opDemoTabellen` tot na definitief -- tot op de loonstrook van de medewerker, die dan zegt hem niet als inkomensbewijs te gebruiken, en op het dekkingsoverzicht per land.
- **De bevoegdheid** (`server/kern/bevoegdheid.js`): de zesde as waarop een functie dicht kan. De vijf uit `middleware/functieschakelaars.js` (globaal, pas, land, plaats, persoon, genre) gaan over wie de gebruiker is en wat de beheerder uitzette; deze gaat over wat **RTG zelf mag**. Veertien handelingen, elk met wat ze vragen: *software* (inzichten, budgetten, doelen -- rekenen op eigen gegevens, altijd toegestaan), *rail* (betalen, passen, rekeningen: via de kaart-naad is de partner bevoegd, over de eigen rails moeten we het zelf zijn) *vergunning* (krediet uit eigen boek, rente over spaargeld -- dat hangt aan geen enkele rail) en *besluit* (het walletsaldo: toegestaan omdat RTG heeft vastgesteld dat een gesloten circuit met plafonds erbuiten valt, met de grond erbij en met wanneer die grond vervalt). Die vierde soort is er zodat een aanname niet als weglating in de lijst zit; de partneruitbetaling van een zaak hangt aan dezelfde sepa-partnerrail als de bank, zodat die rail niet half uit kan staan. De rangen zijn betaalinstelling < elektronischgeldinstelling < bank. Wat er is afgegeven wordt in de boardroom **vastgelegd** en niet aangezet (`kern/bankregie/vergunning.js`; de twaalf handelingen zelf staan apart in `kern/bevoegdheid/lijst.js`, want dat is het stuk dat een bestuurder moet kunnen lezen zonder code): een lege registratie betekent nee, een verlopen of te lage vergunning ook. In de hybride stand telt de eigen rail en niet de partner die er ook nog is -- anders zou hybride de stand zijn waarin alles mag. Zonder vastgelegde vergunning clearen de eigen rails niet: de drie-standen-knop weigert het opschalen, ook met vier ogen. De matrix staat op `/api/office/bank/bevoegdheid` en **in de bankkamer van de boardroom** (`kantoren.html`, `?kamer=bank`), naast de rail-reconciliatie: per handeling of hij open staat, waarlangs, en anders waarom niet. Getoetst met `test/bank.test.js` (de regels) en `test/bankkamer.e2e.js` (het scherm liegt niet: hetzelfde bedrag als de API, de reden erbij, en het vergunningsformulier legt echt vast).
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
- **De ledeninlog remt op drie emmers, niet op één** (`server/routes/auth/inlog.js`): per IP+account (10, dan vijf minuten slot), per bron (50) en per doel-account (25). Die derde was er niet, en dat was een gat met een naam: een emmer op IP+account remt tien gokken van één adres en verder niets, dus veertig adressen op hetzelfde account waren veertig verse emmers. Gemeten voor de reparatie: veertig gokken, nul remmen, en het echte wachtwoord werkte daarna nog. De doel-emmer geeft bewust **geen slot maar een vertraging** van twee seconden per mislukte poging — een slot zou een vreemde de macht geven om een lid uit zijn eigen account te houden door vijfentwintig gokken te verbranden. Wie het wachtwoord weet komt tijdens een aanval dus zonder vertraging binnen. Het doel wordt gehasht voordat het een emmernaam wordt, zodat een e-mailadres nooit in het geheugen van de rem of in een beveiligingsmelding belandt. De passkey-kant deed dit al zo (`routes/auth/webauthn.js`); de wachtwoordkant liep achter. Bewaakt door `test/inlogrem.test.js`.
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

**Post van buiten komt nu ook echt binnen.** Tot voor kort kon dit huis post *versturen* (`server/smtp.js` naar een smarthost, `server/smtp-direct.js` rechtstreeks met DKIM) en kon een client *meelezen* -- maar er nam niets post **aan**. Alles van buiten moest door de HTTP-buitenpoort `/api/mail/binnen`, dus in de praktijk kwam er niets binnen tenzij iemand er met de hand een relay voor zette. Er luistert nu een echte SMTP-ontvanger: `server/smtp-in.js` (het gesprek), `server/smtp-in-data.js` (de DATA-fase) en `server/smtp-in-server.js` (de verbinding), aan te zetten met `MAIL_IN_POORT` -- uit tenzij gezet, net als IMAP. `MAIL_IN_KEY`/`MAIL_IN_CERT` maken STARTTLS mogelijk; zonder die twee gaat alles plat over de lijn en dat staat in het log bij het starten.

De regel die er het meest toe doet staat bij `RCPT TO`: **geen bekend postvak, geen post** -- en het antwoord (550) komt vóór er een byte inhoud is aangenomen. Een ontvanger die eerst aanneemt en daarna weigert, stuurt een foutbericht naar een afzender die meestal vervalst is (backscatter); een die doorstuurt voor vreemden is binnen een dag een spamrelay. Er is dan ook geen `AUTH`: dit is de deur naar binnen, niet naar buiten. `VRFY` doet geen uitspraak over wie hier woont -- dit huis draait op codenamen, en dat is de oudste adressen-oogstmachine die er is. De keten daarachter (ontleden, DKIM/SPF/DMARC stempelen, het origineel bewaren, bezorgen in de onbetrouwde baan, de bijlagen langs de scanner) staat op **één** plek, `kern/mailaanname.js`, en wordt door beide deuren gebruikt.

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

### De Mall: de commerciële voorkant van heel RTG

**apps/mall.html** was een winkel met spullen: zeven etages met boutieks, plus drie bibliotheken. Alles wat je verder bij RTG kon boeken, huren of aanvragen zat in zijn eigen app, en het reisbureau stond er zelfs helemaal niet in — het enige wat de Mall over reizen liet zien was een boekenkast met reisgidsen.

De Mall is nu een **discovery-laag boven op alle bestaande domeinen**. Die domeinen houden hun eigen systemen; de Mall maakt ze gezamenlijk vindbaar.

**Locatie en intentie eerst, type aanbieder daarna.** Bovenaan staat één zoekbalk en de plek waar je staat. "scooter huren Ibiza" zoekt tegelijk door leveranciers, verhuurbedrijven, marktplaats-aanbod en reisaanbod; wie de aanbieder is (professioneel, particulier, RTG) staat op elke kaart, zodat het verschil nooit hoeft te worden uitgelegd.

| deel | waar | wat |
|---|---|---|
| het aanbod-object | `kern/mall/aanbod.js` + `aanbodvorm.js` | twaalf typen (product, dienst, boeking, huur, ticket, reis, verblijf, eten, vervoer, marktplaats, abonnement, offerte) in één vorm, met elf verdiepingen |
| de bronnen | `kern/mall/aanbodzaken.js` (uit de zaken) + `aanbodrtg.js` (RTG-breed) | tien bronnen: reisbureau, logies, foodcourt, retail, eigen-merk, boerderij, dienstenplein, mobiliteit, marktplaats, thuis |
| locatie & servicegebied | `kern/mall/plek.js` | de plekken worden afgeleid uit het aanbod dat er echt is; per zaak een bereik (adres, straal, stad, land, Europa, online) |
| zoeken & rangschikken | `kern/mall/zoek.js` + `zoekweging.js` | `POST /api/mall/zoek`, `/api/mall/home`, `/api/mall/plekken` |

**Vier regels die in de code staan en niet alleen hier:**

1. **Rangschikken gebeurt niet op geld.** Een RTG Partner komt niet hoger omdat hij partner is; er is met opzet geen partner-term in de weging. Partners krijgen hun voordeel in integratie, niet in ranking. `test/mall-vindlaag.test.js` leest de weging en zakt zodra iemand er een aanbieder-term in zet.
2. **Relevantie en volgorde zijn niet hetzelfde.** Beschikbaarheid sorteert, maar laat niets toe dat niet gevraagd is. Toen dat één som was, gaf "scooter huren Ibiza" negen resultaten: vier ringen, drie potten honing en twee villa's, puur omdat die op voorraad stonden.
3. **De projectie wordt gedeeld, niet overgeschreven.** De prijs van een reis komt uit `reisAanbod(db)` in `kern/reisbureau.js`, de zichtbaarheid van een advertentie uit `kern/markt/openbaar.js`. Een reis die bij het bureau € 2.200 kost en in de Mall € 22 is precies het soort verschil dat niemand ziet aankomen.
4. **Een status is geen keurmerk.** RTG Partner, RTG Verified, RTG Business en Marktplaats-lid zeggen wat RTG over de aanbieder wéét. De Mall zegt er zelf bij dat RTG niet garant staat voor wat een ander levert.

**Wat er onderweg is gerepareerd:** de genres `jet`, `helikopter`, `taxi`, `charter`, `verhuur` en `tweewielers` stonden wel in de leveranciersgids maar hadden geen pagina, dus ze vielen terug op `/apps/app.html` met `boekbaar: false` — zichtbaar en tegelijk doodlopend, terwijl `hangar.html` en `ov.html` gewoon bestonden. Ze wijzen nu elk naar de plek waar je ze werkelijk aanvraagt.

**Tijd als context.** Zoeken kent naast een plek ook een periode (`van`/`tot`). Die stuurt de agenda-vraag aan: het eerstvolgende vrije tijdvak wordt binnen die periode gezocht in plaats van "de eerstvolgende week". Er wordt níéts weggefilterd — "niets vrij in deze periode" is een antwoord dat je wilt zien, geen reden om een zaak te verbergen. Een reismand (`lijst: <id>`) geeft haar plek en periode door, zodat zoeken vanuit een reis vanzelf de goede context heeft.

Dat is ook waar de **personalisatie** zit, en bewust niet verder: context die het lid zélf zet — een gekozen plek, een gekozen periode, de reismand waarin hij werkt. Er wordt niets onthouden om later mee te raden. Een gedragsprofiel opbouwen is precies wat dit huis niet doet.

**De zakelijke prijs.** Een Business Pass koopt op inkoopprijs waar die bestaat. Die prijs komt uit `prijsVoor()` van `kern/groothandel.js` zelf; de Mall *kiest* welke van de twee hij toont en rekent er geen. Zakelijk zien betekent ook `btw: 'ex'` erbij, want een inkoopprijs zonder die vermelding is een verkeerd getal. De pas komt van een mens: geen enkele registratie geeft zichzelf een Business Pass, dus niemand geeft zichzelf inkoopprijzen.

### Bewaren, een reis bouwen, en de vraagkant

**Lijsten en de reismand** (`server/kern/mall/lijsten.js`). Een verlanglijst en "voeg toe aan mijn reis" waren als aparte functies bedacht en zijn hetzelfde ding met twee velden verschil: een lijst met `soort: 'reis'` draagt een plek en een periode, en kan daarmee zeggen wat er nog ontbreekt (verblijf, vervoer, tafel, iets te doen). Twee systemen bouwen zou twee keer hetzelfde bewaren.

Dit is nadrukkelijk **geen winkelmand die afrekent**. Een reis met een hotel, een scooter en een tafel bestaat uit drie handelingen bij drie partijen, en doen alsof dat één knop is, belooft de klant iets wat er niet is. De lijst brengt ze bij elkaar en wijst per regel de weg.

Een bewaard aanbod dat verdwijnt — uitverkocht, zaak gestopt, reis vol — blijft in de lijst staan met `vervallen: true` en de reden erbij. De regel draagt zelf de titel en de prijs van het moment van bewaren, zodat je nog kunt zien *wat* je had bewaard en of het duurder is geworden. Stilweg verdwijnen laat iemand zoeken naar iets waarvan hij zeker weet dat hij het had.

**De vraagkant** (`server/kern/mall/aanvragen.js`). Een zoekmachine kan alleen vinden wat er staat: "ik heb morgen een fotograaf nodig op Ibiza" levert nul treffers zolang geen fotograaf zich heeft aangemeld — en die nul is geen antwoord maar een gemiste markt. Een lid plaatst zijn vraag, de zaken die hem kunnen bedienen zien hem en reageren.

Drie dingen die dit bewust niet doet:

1. **Geen veiling.** Geen aftellende klok, geen "nog 2 plekken". Dat zijn de patronen die `CLAUDE.md` verbiedt, en ze horen hier het minst thuis: wie een loodgieter zoekt is al gehaast genoeg.
2. **Geen automatische gunning.** Het lid kiest zelf, of kiest niet. Kiezen boekt niets en betaalt niets — de zaak krijgt bericht en neemt contact op via de gewone weg.
3. **Geen adres in de open aanvraag.** Een zaak ziet de plek en wat er nodig is, en de codenaam. In een vraag die voor meerdere zaken zichtbaar is, hoort niet te staan wanneer iemand niet thuis is.

Wie welke aanvraag ziet, hangt aan twee dingen: het genre moet bij de gevraagde verdieping horen, en de plek moet binnen het servicegebied van de zaak vallen. Een kapper in Haarlem krijgt geen loodgietersklus op Ibiza in beeld — en een wellness-zaak in Ibiza geen loodgietersklus in Ibiza.

### De schermen: Mijn Mall en de vraagkant van een zaak

**apps/mijnmall.html** is waar een lid zijn lijsten, zijn reismanden en zijn eigen aanvragen bij elkaar ziet. Een reismand toont vier vakjes — verblijf, vervoer ter plaatse, tafel, iets te doen — die aanvinken zodra er iets in zit, met de knop *Zoeken voor deze reis*: die opent de Mall met de plek en de periode van die reis al ingevuld. Een regel waarvan het aanbod verdwenen is blijft staan, doorzichtig, met de reden erbij; is de prijs veranderd sinds je hem bewaarde, dan staat het verschil erachter.

Er staat nergens een knop die doet alsof dit afrekent, en nergens een aftelklok of een "nog 2 beschikbaar". Een lijst is een geheugensteun.

**apps/leverancier-aanvragen.html** is de andere kant: een zaak ziet de vragen die bij haar vak en werkgebied passen, en reageert met wat zij kan bieden en wat het kost. Wie zich bedenkt werkt zijn eigen reactie bij in plaats van er een tweede naast te zetten. Staat er niets, dan zegt het scherm wat het werkgebied nu is en of dat een aanname is — want dat bepaalt precies welke vragen binnenkomen.

Wat de zaak ziet is beperkt en dat is met opzet: de vraag, de plaats, de dag, een eventueel budget en de codenaam. Geen adres.

### Het vraagbeeld: wat gevraagd wordt en niet geleverd

De Mall weet iets wat niemand anders weet: waar mensen naar zoeken en **niets vinden**. Dat is de eerlijkste marktinformatie die er is — iemand heeft de moeite genomen het te vragen en kreeg niets terug. Voor een ondernemer is dat een kans, voor een stad een tekort.

Dit is ook het onderdeel met de grootste kans om verkeerd gebouwd te worden, dus vier regels staan als code en niet als belofte (`server/kern/mall/vraagbeeld.js`):

1. **Geen sleutel.** Nergens wordt bijgehouden wíé iets zocht — geen lidsleutel, geen codenaam, geen sessie, geen IP. Een teller per woord per plaats per week, en verder niets. Zoekprofielen zijn hiermee ook achteraf niet te bouwen.
2. **Losse woorden, geen zinnen.** Er wordt per wóórd geteld. "kinderstoel huren voor de bruiloft van mijn zus" is als zin herkenbaar; als vier losse woorden in een weekteller is dat niemand meer. Dit is de belangrijkste van de vier.
3. **Een drempel.** Een woord komt pas naar buiten — naar een ondernemer of het kantoor — vanaf vijf keer. Wat een enkeling zocht blijft binnen.
4. **Het vervalt.** Acht weken, dan weg. Een vraagbeeld is om op te handelen, niet om een geschiedenis van een stad aan te leggen.

Cijfers, e-mailadressen en woorden langer dan 24 tekens gaan er sowieso niet in: die dragen het meeste risico en het minste nut. En alleen een echte zoekopdracht van een mens telt mee — de home, de reizenstrook en interne aanroepen niet, anders wijst het vraagbeeld naar binnen in plaats van naar de markt.

**De lus is rond.** Een tekort in de Mall is een vierde bron voor de Kansenlaag van het stadsweefsel (`server/kern/stadsweefsel/kansen.js`, gekoppeld in `server/opzet/weefseldraden.js`). Een openstaande vacature zegt "hier is werk", een lege zoekopdracht zegt "hier is een markt" — twee verschillende tekorten die allebei in de kansenlaag horen. Begint er een zaak, dan staat haar aanbod via `kern/mall/aanbod.js` vanzelf in dezelfde zoekmachine, en wordt het tekort kleiner. Die laatste stap is geen belofte maar de bestaande leeslaag.

Wat een ondernemer ziet (`POST /api/supplier/mall` → `vraag`) zijn de woorden uit zijn eigen vak en plaats, boven de drempel. Bewust géén bezoekersaantallen en géén conversie: dit zegt wat mensen zochten, niet wat zij deden.

### De Supplier OS ↔ Mall-koppeling

De Mall las tot nu toe alleen wat een zaak **is** (naam, adres, artikelen, prijzen) en niet wat zij op dit moment **doet**. Een gesloten kapper stond er net zo bij als een open kapper, een woensdagmiddag die de ondernemer in zijn eigen agenda blokkeerde was in de Mall niet te zien, en een artikel met voorraad nul verschilde in niets van een artikel dat op de plank ligt.

`server/kern/mall/stand.js` haalt die stand op uit de systemen waar de ondernemer al werkt. Er wordt niets opgeslagen en geen enkele openingstijd opnieuw gedefinieerd: het is dezelfde rij.

| wat | uit welk systeem |
|---|---|
| openingstijden, werkdagen, geblokkeerde dagen | `kern/vakwerk/agenda.js` (`s.vakUren`) |
| vrije tijdvakken en tafels | `vakwerk.slots` en `foodcourt.tijden` |
| aan/uit voor bestellen en reserveren | `kern/zaak.js` (`zaakFunctieAan`) |
| voorraad | de varianten van de zaak zelf |

**Wat we niet weten, zeggen we niet.** `openNu` geeft drie antwoorden: `true`, `false` en `null`. Null betekent "deze zaak heeft geen openingstijden vastgelegd" en is met opzet géén "open" — het filter *Nu open* laat zo'n zaak dus weg. Dat is eerlijker dan gokken, en voor de ondernemer meteen de reden om zijn uren wél in te vullen: iemand voor niets door de regen sturen is erger dan een treffer missen.

**Kosten.** `openNu` is goedkoop en wordt voor de hele Mall berekend, zodat het filter over álles kan werken. Het eerstvolgende vrije tijdvak vraagt per zaak per dag de agenda op en wordt daarom alleen voor de zichtbare pagina opgehaald (hoogstens zestig kaarten), niet voor duizenden aanbod-objecten.

**De andere kant: `POST /api/supplier/mall`.** Een ondernemer werkt in zijn eigen systeem en zag nooit wat daar aan de Mall-kant van terechtkomt — precies waar stille drift ontstaat. Deze weergave is een spiegel, geen dashboard: welk aanbod van u staat er, welke stand leest de Mall uit uw agenda en voorraad, en wat ontbreekt er nog (geen uren = niet in *Nu open*; geen werkgebied = de Mall neemt aan wat uw genre meebrengt). Bewust géén zoekvragen, bezoekersaantallen of conversie: dat is een leverancierdashboard en een eigen beslissing met een eigen privacyvraag.

**De klok is die van de zaak** (`server/kern/tijdzone.js`). Zolang alles op servertijd rekende was *Nu open* in Ibiza een uur mis — de stilste fout die er is, want de klant staat voor een dichte deur en denkt dat de zaak gesloten is. De zone komt uit `s.tijdzone` (IANA), anders uit de hoofdzone van het land van de zaak, en die tweede zegt van zichzelf dat het een aanname is. `POST /api/supplier/tijdzone` zet hem; `auto` zet hem terug. Er wordt niets zelf uitgerekend: `Intl` heeft de volledige zonedatabase inclusief zomertijd aan boord.

**Eén antwoord op "hoe laat is het bij deze zaak".** `zaakZone(s)` en `nuBijZaak(s)` worden gedeeld door de Mall, de vakwerk-agenda (`kern/vakwerk/agenda.js`) én de Food Court. Dat is geen netheid maar noodzaak: gaven die drie een verschillend antwoord, dan biedt de Mall een tijdvak aan dat het boekscherm niet kent. De landbepaling van de Reiswijzer wordt daarvoor één keer bij het opstarten geregistreerd (`kern/tijdzone.zetLandVind`, in `opzet/kernlaag4b.js`) — dezelfde overlay-gedachte waarmee de reisrijen op de landentabel worden gezet.

De reparatie zit dus **bij de oorzaak en niet in de leeslaag**: eerder rekende alleen de Mall in de zone van de zaak en filterde `vakwerk.slots()` nog op servertijd. Dat viel niet op omdat de Mall er zijn eigen filter overheen legde — precies het soort gat waar LAT-regel 1 over gaat. De Food Court had daarbij een eigen variant: de datum stond in UTC en de tijd in de zone van de server, twee klokken in dezelfde functie.

**Een kassasysteem van buiten** (`server/kern/mall/extern.js`, `POST /api/supplier/mall/sync`). Twee dingen mogen naar binnen en met opzet niet meer: **voorraad** per sku en **open/dicht**. Geen prijzen, geen artikelen, geen teksten — een koppeling die stilletjes productnamen kan overschrijven is een veel groter ding, met een eigen gesprek over wie wat mag.

Drie regels die de koppeling veilig maken:

1. **Houdbaarheid.** Een melding telt 30 minuten als actueel; daarna valt de Mall terug op wat zij zelf weet. Een kassa die stopt met melden is namelijk niet te onderscheiden van een kassa die "alles nog steeds op voorraad" bedoelt — behalve door de tijd. Zo houdt een uitgevallen koppeling nooit een winkel dagenlang open en gevuld.
2. **De zaak wint van de kassa.** Zet de ondernemer zijn zaak in RTG op "neemt geen reserveringen aan", dan telt dat zwaarder dan wat het kassasysteem meldt. Een schakelaar die je omzet en die niets doet is erger dan geen schakelaar. Voorraad werkt andersom: daar is het externe getal het meest actueel, want daar loopt de verkoop.
3. **Wat niet is aangenomen, wordt teruggemeld.** Regels zonder sku, een `open` die geen ja/nee is, sku's die hier niet bestaan: allemaal in het antwoord. Een koppeling die stil iets weggooit is niet te bouwen tegen.

De kassa overschrijft de **weergave**, niet de administratie: de eigen voorraadrij van de zaak blijft staan zoals hij stond.

### Kaart, land, filialen: waar iets is

**De kaart** (`server/kern/mall/kaart.js`) is nadrukkelijk **geen straatkaart**. De CSP van dit huis staat geen vreemde tegelserver toe, en een kaartdienst inhuren betekent dat elke zoekopdracht — inclusief waar het lid staat — langs een andere partij komt. Wat er wel is: de onderlinge ligging, geprojecteerd op een vierkant vlak met de zoeker in het midden. Je ziet daarmee wat je van een kaart wilt weten in een zoeklijst (ligt dit bij elkaar, ligt dit bij mij) zonder iets naar buiten te sturen. De kaart gaat over **alle** treffers, niet over de zichtbare pagina, en treffers zonder coördinaat verdwijnen niet stilletjes maar komen terug als `zonderPunt` met een regel erbij: *"8 van de 40 treffers staan hier niet op."*

**Het land** is de stap van een stad naar een werelddeel: filteren op `ES` zet Ibiza, Madrid en Marbella naast elkaar. Aanbod waarvan het land onbekend is valt weg — dat meenemen zou raden zijn. Het antwoord noemt zelf welke landen erin zitten (`landen`), zodat een scherm geen landenlijst hoeft te verzinnen.

**Filialen** (`server/kern/mall/vestigingen.js`). Een zaak had precies één stad, en dus was de vestiging in Haarlem onvindbaar zodra het hoofdadres in Amsterdam stond. Er wordt géén kopie van het aanbod per vestiging gemaakt — dan staat hetzelfde brood twintig keer in de lijst en moet elke prijswijziging op twintig plaatsen landen. Het blijft één aanbod met een lijst plekken: `bedient()` is raak zodra één vestiging de plek bedient, `afstandTot()` meet naar de dichtstbijzijnde, en de zaak telt mee in elke stad waar zij staat. Wat dit **niet** modelleert: filialen met eigen prijzen, voorraden of openingstijden. Elk aanbod draagt daarom `perVestiging: false`.

### Beoordelingen, bezorging, bewaren

**Beoordelingen** bestonden al (1–5 sterren na afronding, lopende som in `reviewStats`). De Mall rekent er geen tweede gemiddelde naast uit: de som staat één keer in `server/kern/ervaring/rating.js` en wordt door zowel de reviewlaag als de Mall gelezen. RTG Thuis houdt reviews per *huis* bij en geeft daarom zijn eigen cijfer mee. **Een cijfer is geen keurmerk van RTG**, en dat staat er in de Mall bij.

**Bezorging** leunt op de schakelaar die de zaak al had. De regel staat als pure functie in `server/kern/leverancier/bezorgregel.js`: bezorgen vraagt om *mogen* én *aanstaan*. Een zaak die de schakelaar uit heeft hoort niet in een bezorgfilter — anders stuurt de Mall iemand een bezorging in die niet komt.

**Bewaren** (`server/kern/mall/bewaard.js`) is een systeemlijst in de gewone lijsten, geen tweede opslag. Omdat elke bewaarde regel zijn prijs en beschikbaarheid van het moment van bewaren meekrijgt, is het "prijsalarm" geen machinerie maar een vergelijking. En het is met opzet **geen melding**: geen push, geen e-mail, geen badge. Je ziet het wanneer je zelf kijkt, zonder aftelklok en zonder voorspelling dat iets duurder wordt. Regels van vóór deze versie hebben geen vastgelegde beschikbaarheid; daarover doet de laag géén uitspraak, maar ze worden wel geteld in `zonderVergelijking`.

### Samengesteld aanbod en het bestellingenoverzicht

**Collecties, bundels, evenementen en seizoenen** (`server/kern/mall/collecties.js`) zijn één ding met per soort een veld erbij: een benoemde set aanbod met een reden. De losse prijs van een bundel wordt **altijd uit het levende aanbod opgeteld en nooit bewaard** — een opgeslagen optelsom is morgen een leugen. En een bundel die een onderdeel mist is kapot: hij komt terug met `compleet: false`, zegt wat er ontbreekt en toont géén prijsvergelijk. Doorrekenen zonder onderdeel laat iemand een korting kopen die hij niet krijgt. Wat er geldt komt uit de **datum** en niet uit een vinkje "actief" — een vinkje dat niemand omzet is hoe een winteractie in juli blijft staan. Een zaak bundelt alleen haar eigen aanbod; het kantoor stelt over zaken heen samen.

**Het bestellingenoverzicht** (`server/kern/mall/bestellingen.js`, `POST /api/mall/bestellingen`) doet wat de aanbodlaag doet, de andere kant op: uit vijf domeinen één overzicht van wat een lid lopen heeft. Er is **geen gezamenlijke afrekening** en die komt er niet: achter die regels zitten verschillende partijen met eigen bevestigingen. Elke regel wijst naar het domeinscherm dat hem beheert; er wordt hier niets geschreven. Een omvallende bron komt terug in `stuk` in plaats van als een korter lijstje, een onbekende status houdt zijn eigen naam, en `betaald` is `null` waar een bron het niet bijhoudt — `null` is niet `false`.

### De zakelijke ingang en de concierge

**De zakelijke Mall** (`POST /api/mall/zakelijk`) is geen tweede Mall maar dezelfde, anders gefilterd: alleen aanbod met een inkoopprijs, exclusief btw en met `btw:'ex'` erbij. De **pas** bepaalt dat, nooit het verzoek — een meegestuurd vinkje koopt geen inkoopprijs. Wie geen Business Pass heeft krijgt een 403 die naar een gesprek met RTG verwijst; de app mag zo'n pas nooit zelf verlenen.

**De concierge** (`server/kern/mall/concierge.js`, `POST /api/mall/concierge`) is het enige stuk van de Mall waar een taalmodel bij komt, en de vorm is de beveiliging: het model vertaalt de zin naar **filters** en schrijft geen antwoordtekst. Wat het lid leest is opgeteld uit de echte treffers. Een model dat over aanbod mag antwoorden verzint vroeg of laat een restaurant, een prijs of een beschikbaarheid — en juist bij een bevestigde boeking, een echt hotelmerk als "partner" of een belofte over een pas is die schade niet terug te draaien.

Drie dingen staan daarom in code en niet in de prompt:

1. **Vragen over een pas gaan niet naar het model.** Lifestyle, Business, de ballotage en De Salon worden vóór de AI-aanroep herkend en beantwoord met een vaste doorverwijzing naar een mens. De regel is afgebakend: *"beachclub met toegang tot het strand"* is een gewone zoekvraag.
2. **Wat uit het model komt is invoer.** Een verdieping of type dat niet bestaat wordt weggegooid én gemeld in `genegeerd`; "morgen" wordt niet tot een datum geraden. Een half begrepen vraag mag er niet uitzien als een goed begrepen vraag.
3. **Zonder sleutel geen verzonnen antwoord.** De zin gaat als gewone zoektekst door dezelfde zoeklaag, en dat staat in het antwoord.

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

Diezelfde toets vond er later nog één, en die was ouder dan de verhuizing: een gesprek draagt in `door` wie het opende, en dat veld is geen deelnemer en geen bericht — dus liep het langs allebei de wislussen heen. Dat het lang groen bleef, kwam doordat `tussen()` de twee sleutels alfabetisch zet en de blijver in de toets toevallig vooraan stond. Het gaat nu op `null` (niet naar de eerstvolgende deelnemer: die heeft het gesprek niet geopend, en een verkeerd antwoord is erger dan geen).

**Een deelnemer is niet meer per se een lid** (`server/kern/comm/wie.js`). Dit was het stuk dat de rest blokkeerde. Zolang alleen leden een sleutel hadden, kon een zaak geen deelnemer zijn — en dus bleven het gastcontact met een restaurant, de collega-DM op de werkvloer en de sollicitatiechat in hun eigen voorraad staan. Niet omdat ze anders waren, maar omdat de andere kant van het gesprek geen naam had in dit model. Er zijn nu vier soorten deelnemer, en de vorm is de hele beveiliging:

| | sleutel | |
|---|---|---|
| lid | `user-12` | de kale ledensleutel, **ongewijzigd** |
| zaak | `zaak:AB12` | de zaak als geheel; het team deelt hem |
| mens | `mens:AB12:7` | een persoon binnen die zaak |
| kantoor | `kantoor` | de backoffice van RTG |

Een lid houdt zijn kále sleutel, en dat is de reden dat dit zonder migratie kon: zo staan de bestaande gesprekken, leesstanden en SSE-routering er al in. De prijs staat in `lid()`: omdat een lid geen voorvoegsel draagt, is "geen dubbele punt" het enige wat hem van een actor onderscheidt — dus **gooit** die functie op een ledensleutel met een dubbele punt erin. Vandaag kan dat niet, maar "kan vandaag niet" is geen bewaking.

En de regel die alles draagt: **een sleutel wordt afgeleid, nooit aangeleverd.** `wie.vanZaak(req)` maakt hem uit de sessie die `supplierAuth` al controleerde; er is met opzet geen parameter waarin een verzoek kan zeggen wie het is. Zou die er wél zijn, dan vult een leverancier de sleutel van een lid in en leest hij mee in een gesprek tussen twee mensen die hem niet kennen. `test/comm-zaak.e2e.js` probeert dat expliciet — met alle veldnamen die een programmeur zou kiezen (`alsWie`, `van`, `sleutel`, `key`, `deelnemer`, `actor`, `mij`) — want de andere toetsen meten alleen dat de route de góéde sleutel gebruikt, niet dat er geen weg is om hem te kíézen.

De zakelijke deur is `routes/supplier/comm.js`: `/api/supplier/comm/{inbox,gesprek,stuur,lees,typt,zoek,collega}`, dezelfde kern, geen tweede berichtenmodel. Twee sleutels per sessie, en dat is het hele verschil tussen een gedeelde inbox (een bestelling is van het bedrijf) en eigen berichten (een collega-DM deelt het team juist niet).

**Van wie er namens de zaak antwoordde gaat alleen de voornaam naar buiten.** Het team ziet de hele naam van de collega die typte, de klant zijn voornaam. Dat eerste deel is een besluit: "Marta brengt het zo" is het verschil tussen een dienst en een systeem, en de gastchat deed het vóór de verhuizing ook al. Het tweede deel is de begrenzing erbij — vroeger ging de *hele* naam mee, want het personeelsregister draagt "Marta Colom", en een achternaam maakt iemand vindbaar terwijl een voornaam hem aanspreekbaar maakt. De knipregel staat op één plek (`wie.voornaam`, inclusief titels: "Dr. Elena Roig" → "Dr. Elena", want alleen "Dr." tonen is onbeleefd én onbruikbaar). In de **sollicitatiechat** wordt níét geknipt: daar staat aan de werkgeverskant geen persoon maar de zaak zelf ("Sal de Mar"), en die zou tot "Sal" verminken — dat staat als opmerking in `kern/comm/werk.js`, zodat niemand de drie later "gelijktrekt". Er is bewust géén `/begin` met een lid — een zakelijk gesprek met een klant ontstaat uit iets dat er al is (een bestelling, een rit, een boeking) en de module die dát weet maakt het via `comm.gesprekMaak()`. Wél een `/collega`, met de personeelslijst als poort in plaats van vriendschap.

**De collegaberichten zijn verhuisd** (`kern/comm/collega.js`) — de tweede voorraad, en de eerste die alleen kón verhuizen dankzij het actormodel: een collegachat loopt tussen twee *mensen binnen een zaak* (`mens:AB12:7` ↔ `mens:AB12:9`), en zulke deelnemers bestonden niet. Dezelfde drie regels als bij de privéberichten (een gesprek per paar uit de kern, de geschiedenis eenmalig mee op het moment dat het paar toch al wordt geopend, de oude voorraad blijft staan), maar twee dingen zijn hier anders en allebei zijn het valkuilen:

- **De zaakcode moet in de sleutel.** De oude opslag zette hem in het *pad* (`collegaChats[code][paar]`), dus twee medewerkers met toevallig dezelfde nummers bij twee bedrijven zaten vanzelf in twee bakjes. De kern heeft één platte lijst gesprekken — valt de code uit de sleutel, dan lopen die twee gesprekken in elkaar over, en dat is geen rommelig scherm maar een datalek tussen twee bedrijven. Staat als eigen toets in `test/comm-collega.test.js`.
- **Ongelezen was een teller, geen tijdstip.** De oude vorm hield `unread[staffId] = 3` bij; de kern rekent met "gelezen tot". Reken je dat niet om, dan springt bij iedereen elk oud gesprek op ongelezen.

De zaaksleutel zit er met opzet **niet** in: elke medewerker draagt hem in zijn sessie, dus zou hij in een collega-DM staan dan las het halve team mee. De routes (`/api/staff/dm/*`) en hun antwoordvorm veranderen niet, zodat `public/shared/collegachat.js`, de PDA en de zaak-app niets merken — een verhuizing van de opslag hoort niet zichtbaar te zijn in een scherm, want dan zijn het twee veranderingen tegelijk en weet je bij een storing niet welke van de twee het deed. `collegaChats` had trouwens **nooit** een bewaartermijn, ook niet vóór de verhuizing; die staat er nu, als bevroren archief.

**Het gastcontact is verhuisd** (`kern/comm/gast.js`) — de derde voorraad, en de eerste waarin een lid en een zaak sámen in één gesprek zitten: aan de ene kant een codenaam, aan de andere kant een bedrijf. Precies het gesprek waarvoor het actormodel bestaat. Drie dingen zijn hier eigen:

- **De afdeling hoort bij het gesprek.** Een hotel heeft Receptie, Roomservice, Housekeeping, Onderhoud en Security — vijf aparte lijnen. Vallen ze samen, dan leest Housekeeping mee met wat je aan Security schreef.
- **Twee tellers, één per kant** (`unreadGuest`/`unreadPartner`), omgerekend naar twee losse "gelezen tot"-standen.
- **Het systeembericht heeft geen afzender.** "U heeft nu een open lijn met X" stond er als `from:'systeem'`, maar de kern eist dat een afzender deelnemer is — en die poort zetten we niet open voor een uitzondering. Het komt nu van de zaak, met een eigen soort, en gaat naar buiten nog steeds als `systeem`.

En één ding dat pas bij het schrijven van de toets bleek, en dat de vorige twee verhuizingen niet hadden: **een lijst die uit de kern komt, ziet alleen wat al verhuisd is.** De import gebeurt per lijn, bij het openen — maar het gastenscherm van een zaak (en de gegevensuitvoer van een lid) leest rechtstreeks uit de kern. Zonder maatregel zou dat scherm op de dag van de verhuizing **leeg** staan en elk gesprek weg lijken, zonder weg terug: de lijst ís de manier om een gesprek te openen. `voorZaak()` en `voorLid()` halen daarom eerst hun eigen oude voorraad binnen, begrensd tot déze zaak of dít lid. Twee toetsen bootsen die dag na.

De gastchat verdween hierdoor ook uit `kern/comm/bronnen.js` — hij is nu een echt gesprek in de kern en zou anders dubbel in de inbox staan. Dat is precies wat de kop van dat bestand beloofde: *elke bron die later wel overgaat, verdwijnt gewoon uit dit bestand.* Dit is de eerste. Twee KPI-tellers op het afdelingenbord wezen nog naar de bevroren archieven en zijn meeverhuisd: een teller die stilvalt op het aantal van de verhuisdag ziet er hetzelfde uit als een teller waar niets gebeurt.

**De sollicitatiechat is verhuisd** (`kern/comm/werk.js`) — de vierde en laatste grote voorraad, en degene die als laatste kón. Een sollicitant is namelijk niet altijd een lid: hij kan ook een **profiel binnen een RTF-gezin** zijn (een jongere die via zijn gezin solliciteert, ingelogd op gezinscode en token, zonder ledensleutel en zonder codenaam). Daarvoor kwam er een vierde soort deelnemer bij, `gezin:FAM7:3`. Zonder die soort had deze voorraad maar half kunnen verhuizen — en een halve verhuizing is twee voorraden.

Twee dingen zijn hier eigen. De **kant** is een woord (`werkgever`/`sollicitant`) en geen naam; daar kleurt het scherm zijn bubbels op, dus als dat omklapt lijkt de sollicitant zichzelf te hebben afgewezen. En **zonder sleutel geen gesprek**: wie anoniem solliciteert heeft geen enkele sleutel, en een draad voor iemand die je niet kunt bereiken belandt in een lijst waar de werkgever wél op antwoordt. Anders dan bij het gastcontact blijft `applyChats[id]` wél staan — dat is geen berichtenvoorraad maar de *schakel* tussen een sollicitatie en haar gesprek, en hij draagt wie de sollicitant is. Wat eruit ging zijn de berichten; dat er niets meer bij komt in de oude tak is een eigen toets.

En bij deze tak zaten dezelfde twee gaten als eerder, allebei ouder dan de verhuizing: `applyChats` had **nooit** een bewaartermijn — terwijl de sollicitatie waar hij bij hoort er wel een had, dus het dossier verliep en het gesprek erover bleef eeuwig staan — en het **wisrecht** raakte hem niet: `vergeten/anoniem.js` haalde de persoon netjes uit `db.data.applications`, maar het chatrecord droeg diezelfde sleutel en naam nog een keer.

**`bronnen.js` is nu bijna leeg, en dat was het doel.** Er stonden vier kanalen buiten de kern; twee zijn er echt verhuisd, de andere twee hebben er nooit gestaan. Wat overblijft zijn twee **leeslijsten** — de Berichtenbox van MijnOverheid en het doorlopende gesprek met Rahul — en dat blijft waarschijnlijk zo: officiële post is eenrichtingsverkeer en Rahul heeft zijn eigen scherm. Daarmee verdween ook de tweede verstuurweg uit de app: er is nog één, en dat is precies wat "communicatie is infrastructuur" hoort te betekenen.

**Wat er nog niet in zit** — zodat niemand het hier gaat zoeken: end-to-end encryptie, rollen en rechten binnen een zaak (RBAC), SSO/SCIM, legal hold, eDiscovery, DLP en de publieke API voor externe ontwikkelaars. `podiumChat` staat er ook nog, maar dat is bewust: een livestream-chat is vluchtig en publiek — geen gesprek tussen partijen die elkaar kennen — en hoort niet in een model dat op deelnemerslijsten draait. Het model is op de rest gebouwd, maar het staat er niet. Een half aangezette compliance-laag is gevaarlijker dan een afwezige. Hetzelfde geldt voor groepsbellen met breakout rooms en opname: dat blijft voorlopig RTG Meet.

## De ledenbalie: de derde poort van het kantoor

Het RTG-kantoor is een ongedeelde ruimte die men binnenkomt met een **gedeelde** code, en die code wijst niemand aan. Voor het meeste kantoorwerk is dat prima: een wachtrij bekijken of een partner goedkeuren gaat over een dossier, niet over een mens. Iemand helpen met zijn abonnement of zijn wachtwoord is iets anders — dat raakt zijn *account*, en het is precies het soort handeling waarvan een lid later mag vragen: wie was dat, en waarom?

Vandaar de **zetel**: uitgedeeld vanuit de boardroom, gekoppeld aan een echte persoonlijke inlog — dezelfde constructie die die kamer zelf al gebruikt. Vijf regels, en het zijn allemaal een nee:

1. **Geen zetel, geen dossier** — ook niet met een geldige kantoorcode. De code opent het kantoor, niet de balie. En de zetel komt uit de sessie: er is geen veld waarin een verzoek zegt wie het is.
2. **Het dossier draagt de codenaam.** Precies acht velden (`codename`, `pas`, `sinds`, `stad`, `land`, `steuncode`, `abo`, `klachten`) en geen een erbij — de toets pint die lijst dicht af, zodat een veld dat er morgen bij wil eerst langs een mens moet. Geen naam, geen adres, geen telefoon, geen document. De steuncode is het handvat voor het gesprek: een kort kenmerk zodat beide kanten naar hetzelfde contact kunnen verwijzen zonder dat er ooit een naam over tafel gaat.
3. **Een reden van niks is geen reden.** "test", "x", "……" worden geweigerd — en zo'n geweigerde vraag is *geen* inzage, dus komt hij ook niet in het journaal. Anders vult het journaal zich met pogingen in plaats van met inzagen.
4. **De balie zet geen wachtwoord.** Herstel loopt via de bestaande stroom naar het lid zelf; de balie hoort alleen dát het in gang is gezet. Geen adres terug, geen link, geen code.
5. **Een abo-voorstel kent niets toe.** De balie mag een aanvraag klaarzetten voor een andere pas; het besluit blijft bij een mens via `/api/aanmelding/beslis` — dezelfde merkregel als overal.

Alles wat de balie wél doet — een dossier openen, een codenaam natrekken — gaat door het **bestaande** inzagejournaal (`server/inzagelog.js`), met de zetel als "wie" en de opgegeven aanleiding als "waarom". Bewust geen eigen logboek: een tweede journaal is een journaal dat bij een audit wordt vergeten. Ook zoeken telt als inzage, ook als er niets uitkomt — wie een codenaam natrekt om te zien óf hij bestaat, doet precies wat het journaal moet vastleggen.

Kern: `server/kern/ledenbalie.js`, routes `/api/office/balie/{zetels,zetel,zoek,dossier,herstel,klacht,klacht/status,abo}`, getoetst in `test/ledenbalie.test.js`.

## RTG Command: het kantoor als één app

Het RTG- en RTF-kantoor was een verzameling schermen: de backoffice, de kamers, het RTF-kantoor, de meldkamer, de techniek, de Office-suite. Elk scherm kende zijn eigen hoek van het platform, en niemand kende het geheel. **`/apps/command.html`** is die verzameling als één app — niet door er een menu overheen te leggen, maar door er één objectmodel onder te schuiven.

**Het register is de spil.** `server/kern/command/register.js` zegt welke objectsoorten er zijn, waar ze wonen en hoe ze heten. De zoekbalk leest hem, het objectdossier leest hem, de runbooks schrijven alleen via hem, en de puls telt eruit. Een soort erbij is één regel erbij; niemand hoeft de zoekbalk aan te raken. Dat is de reden dat dit een tabel is en geen veertig if-takken: een belofte als "één zoekbalk voor letterlijk alles" die per soort een eigen tak vraagt, is binnen twee maanden stil onwaar.

**De ontwerpregel, in elke module: handmatig, assisted, autonoom.** Welk van de drie geldt is nooit een eigenschap van de knop maar een uitkomst van `risico.js` uit het beleid van dat moment. Dezelfde handeling is autonoom bij één geval en mensenwerk bij honderd; de score draagt altijd zijn opbouw, zodat een mens kan zien *waarom* iets naar hem is gerouteerd — en het kan bestrijden.

**De operator.** Een vraag in gewone taal wordt een gemeten plan: hoeveel gevallen, welke oorzaken, hoeveel de machine veilig mag doen, wat een mens moet beoordelen. De oorzaakgroepering (`oorzaak.js`) *meet* welk veld de gevallen het strakst clustert in plaats van een tabel "wat verklaart wat" te raadplegen; vindt hij niets dat bijna alles verklaart, dan zegt hij dat er geen gedeelde oorzaak is. Daarna is er één knop: doe de veilige gevallen, en de uitzonderingen worden zaken met eigenaar, termijn en bewijs. De AI verwoordt hooguit — zonder API-sleutel werkt alles hetzelfde, alleen is de zin dan door ons geschreven.

**Schrijven kan maar op één manier.** Elke wijziging die Command aan gegevens maakt, loopt door een runbook: een veld op een object van een bekende soort krijgt een nieuwe waarde, en de oude waarde gaat mee in de ronde. Terugdraaien is daarmee geen extra code maar hetzelfde mechanisme omgekeerd — en het slaat over wat iemand anders sindsdien heeft gewijzigd, zodat een terugzetting nooit stilletjes andermans werk wist. Velden die een identiteit, een bedrag of een recht dragen staan op slot (`BEVROREN`) en worden bij het uitvoeren gecontroleerd, niet bij het opschrijven.

**Beleid is een gegeven, geen code.** Prijzen, grenzen, budgetten en de risicodrempels staan in één register met versies, herkomst en reden. Zware regels vragen twee paar ogen — en wie voorstelt kan niet zelf goedkeuren, afgedwongen op de server omdat een grendel die alleen in de knop zit er niet is. Terugzetten is de vólgende versie en niet het wissen van de vorige. Naast elke regel staat een proef die met een schaduw-beleid doorrekent wat de nieuwe waarde met de routering doet, zonder iets te zetten.

**Het journaal is een keten.** Elke handeling van mens én machine draagt oude toestand, nieuwe toestand, actor, reden en gebruikte regel, plus de hash van de vorige regel. `controleer()` wijst de eerste breuk aan; het scherm toont die uitslag bovenaan. De actor komt altijd uit de sessie en nooit uit de body — wie met de gedeelde kantoorcode binnenkomt heet `kantoor (gedeelde code)`, en daarmee vallen vier-ogen-goedkeuringen en zware rechten vanzelf om.

**Zware rechten verlopen vanzelf.** Tijdelijke bevoegdheid, mandaat en de nooddeur (break-glass) hebben allemaal een `tot`; er is niets dat blijft staan, dus er valt ook niets te vergeten in te trekken. De nooddeur vraagt een volledige reden en staat als zwaarste handeling in het journaal.

**En de meter waarop dit kan zakken.** Het werkbesparingsbord telt handminuten per duizend handelingen, de automatiseringsgraad per werkstroom en de lekken: veel volume dat nog nooit autonoom liep. Dalen die getallen niet, dan is er geen automatisering bijgekomen maar een dashboard. De minutenprijzen zijn schattingen en dat staat in de uitslag — een meter die zijn eigen onzekerheid verzwijgt, wordt gebruikt alsof hij zeker is.

De werkplek-tab opent de bestaande apps (Office, RTMail, Agenda, Meet, Bestanden, Personeel, Payroll, Balans, Techniek, RTF-kantoor …) vanuit dezelfde schil, met dezelfde inlog en dezelfde gegevens. Ze worden geopend, niet nagebouwd.

Kern: `server/kern/command/` (register, zoek, object, oorzaak, operator, risico, runbooks, beleid, journaal, zaken, toezicht, toegang, puls, simulatie, werkbesparing), routes `/api/command/*` in `server/routes/command/`, frontend `public/apps/command/` (gebundeld naar `public/apps/command.js`), getoetst in `test/command.test.js`.

### De gezondheidskaart: doen de vermogens het, en hoe hard weten we dat

De puls hierboven zegt hoe de **gegevens** ervoor staan: hoeveel objecten, wat staat er open, waar verloopt een termijn. Dat is een goede vraag en het is niet dezelfde vraag als *doet betalen het?*. Een domein kan brandschoon zijn terwijl de dienst eronder plat ligt, en andersom. `server/kern/command/gezondheid.js` beantwoordt die tweede vraag, en het verschil met elk ander statusbord zit in één veld: **de bewijsgraad**.

Een bord dat "Betalen: OK" toont, zegt niet waarom het dat weet. Dat kan zijn omdat er 4.812 verzoeken zonder fout langskwamen, omdat er zojuist een proef is gedraaid die het werkelijk heeft gedaan, omdat er geen klachten binnenkwamen, of omdat er niemand heeft gekeken. Vier graden dus -- **onbekend, vermoed, gemeten, bewezen** -- en daarnaast de uitslag **niet vast te stellen**, die geen storing is en geen groen. Zonder die laatste is de rest waardeloos: dan is het bord het groenst op de dag dat er nog niets draait.

**Twaalf vermogens en geen 191 schakelaars.** De kaart (`kern/command/vermogens.js`) groepeert de functiecatalogus per CATEGORIE: acht diensten (binnenkomen, betalen, de ledenkant, het sociale, de eigen apps, de zakenkant, de RTFoundation, het kantoor) en vier fundamenten die geen verkeer hebben en toch stuk kunnen zijn (bereikbaar, de gegevens, de sporen, het bewaren). Per categorie is grover en het veroudert niet: een nieuwe schakelaar landt vanzelf bij het goede vermogen. Bij het opstarten faalt de kaart als een categorie in geen enkel vermogen valt -- die schakelaars zouden anders stil van het bord verdwijnen, en dan staat er groen omdat er niets staat.

**Hij meet niets zelf**, en dat is dezelfde regel als in het alarm en om dezelfde reden. Elk getal komt uit een laag die er al was: de meting per capability, de servicedoelen, de sonde, het alarm, de gegevenskwaliteit, de hashketen van het journaal, de back-upstand. Een kaart met een eigen meting zegt op een dag iets anders dan het scherm waar hij over gaat.

**Elke bron draagt wat hij NIET aantoont**, op het scherm en niet in een voetnoot. De scherpste is de back-up: `server/backupstand.js` kijkt na of de bestanden er zijn en of db.json opent, en dat is geen terugzetproef -- die bestaat platformbreed niet. Dat vermogen heeft daarom een **plafond** en komt nooit hoger dan "gemeten", ook niet na een geslaagde controleronde. Elk ander bord zet hier "Backup: OK" neer.

**De doorwerking kleurt niets rood.** Een vermogen dat zelf klopt maar leunt op iets met een storing, blijft in orde staan met de zin erbij: *"De zakenkant werkt. Wat hier via betalen loopt, wacht."* Alles rood kleuren omdat er ergens iets stuk is, maakt van een kaart een alarmklok.

**En de knop Controleer weigert waar hij moet.** Een ronde voert echt iets uit -- de sonde loopt zijn reizen, de hashketen wordt nagerekend, de gegevens worden gescand, de back-up wordt opengemaakt. Maar voor de meeste diensten bestaat zo'n proef niet: betalen bewijzen betekent betalen, en dat doet dit huis niet met het geld van een lid om een scherm groen te krijgen. Zo'n ronde meldt "niets gecontroleerd", blijft staan als gebeurtenis met een datum en een naam, en geeft **geen oordeel**. Dat laatste is er na een echte fout: in de eerste ronde tegen een draaiende server zette een controle op *betalen* -- die niets kon doen -- dat vermogen van "niet vast te stellen" op "in orde". Een knop die groen maakt door hem in te drukken.

Werkplek **Gezondheid** onder *Zien*; kern in `server/kern/command/gezondheid.js` (met `vermogens.js`, `gezondheid-bronnen.js`, `gezondheid-fundament.js`, `gezondheid-proef.js`, `gezondheid-taal.js`), routes `/api/command/gezondheid*`, scherm `public/apps/command/command-17.js`. Getoetst in `test/gezondheidskaart.test.js` (veertien beweringen, acht mutaties). De richting waar deze laag in past, en de grenzen die daarbij horen, staan in **`BESTUUR.md`**.

### Herstel als transactie: de twee stappen die een herstelknop normaal niet heeft

De runbooks hadden de helft hiervan al. Elke wijziging heeft dezelfde vorm -- één veld op één object van een bekende soort -- en draagt de oude waarde per object mee, dus terugdraaien is geen extra code maar hetzelfde mechanisme omgekeerd. Dat is meteen de momentopname: een tweede kopie ernaast zou op een dag iets anders zeggen dan de eerste. Wat ontbrak zijn de twee stappen eromheen, en dat zijn precies de twee die op elk ander beheerscherm ontbreken. De keten is nu **voorcontrole → momentopname → uitvoeren → verificatie → vastleggen**, en bij een mislukte verificatie automatisch **terug**. `POST /api/command/runbook/voer` is het enige pad ernaartoe; rechtstreeks langs `runbooks.voer()` gaat niet meer, want een tweede ingang die de keten overslaat maakt de belofte meteen leeg.

**De voorcontrole** is vier genoemde voorwaarden, elk met een eigen uitslag en reden: het veld staat niet op de bevroren lijst, de weg terug bestaat werkelijk als het certificaat er een belooft, het aantal gevallen blijft binnen de bovengrens van het certificaat, en het fundament (bereikbaar, de gegevens, de sporen) staat niet op storing -- gegevens rechtzetten terwijl dat wankelt is hoe je er een tweede storing bij maakt. Een echte ronde wordt door een weigering tegengehouden; **een droogloop niet**, want droog draaien is juist hoe je erachter komt dat de voorcontrole niet houdt.

**Een voorwaarde die niet te controleren is, slaagt niet.** De zaak-kant draait dezelfde recepten zonder gezondheidskaart; die controle komt daar in de keten met `gecontroleerd: false` en de reden erbij, en blokkeert niets. Dat staat er dan ook zo, in plaats van stil voor geslaagd door te gaan.

**Het certificaat** staat bij het recept (`runbookcatalogus.js`): hoe groot het mag worden, hoe de weg terug loopt, waaraan achteraf wordt nagekeken, en een versie. `maxObjecten` is iets anders dan de rondegrens uit het beleid -- die zegt hoeveel er per keer mag, dit zegt op hoeveel gevallen dit recept ooit is beproefd. Een recept **zonder** certificaat draait gewoon door, maar de uitslag meldt dat erbij: geen bovengrens afgesproken, en de weg terug is alleen wat `terugDraaibaar` zegt. Een standaardcertificaat verzinnen zou een ongecertificeerd recept laten lezen als een gecertificeerd recept.

**De verificatie kijkt positief na**, en dat is de kern: niet "er ging niets mis" maar staat het veld werkelijk op de bedoelde waarde, en is de aanleiding werkelijk weg. Raakte de ronde nul objecten, dan is de uitslag `niet van toepassing` en uitdrukkelijk niet "geslaagd" -- een herstelknop die stil niets doet en groen meldt, is erger dan een knop die niets doet. Mislukt de verificatie, dan draait de ronde zichzelf terug, maar alleen als het certificaat die weg belooft: een automatische terugdraaiing op een recept dat daar niet voor staat, zou een tweede ongeplande wijziging zijn bovenop de eerste.

De uitslag gaat terug **op de ronde zelf** en in het journaal. Een verificatie die alleen in het antwoord van dat ene verzoek bestaat, is morgen weg -- en dan staat er in de historie een ronde zonder enig bewijs dat er ooit is nagekeken. In de rondelijst staat `niet nagekeken` daarom als uitslag en niet als leegte.

Kern: `server/kern/command/transactie.js` (de keten) en `transactie-poorten.js` (de voorcontrole en de verificatie); het teruglezen van rondes verhuisde naar `runbooks-historie.js` toen `runbooks.js` door zijn omvangsgrens ging, op de naad die er al lag. Getoetst in `test/hersteltransactie.test.js` (negen beweringen, zes mutaties) op de echte receptenmotor met een rij die zijn schrijfactie **weigert** -- zo ziet de transactie precies wat zij in het echt zou zien als een wijziging niet plakt. De bedrading in `test/command-routes-herstel.test.js`. De richting en de grenzen staan in **`BESTUUR.md`**.

### Het incident als object: de machine opent, een mens sluit

Zonder dit is een storing een alarm plus een journaalregel, en die twee verdwijnen allebei in een lijst: het alarm zwijgt zodra de drempel terugloopt, en de journaalregel staat tussen tienduizend andere. `server/kern/command/incident.js` maakt er een object van met een nummer waar je naar kunt verwijzen, een begin, een gemeten omvang, de maatregelen, een status en een verslag.

**Dit is geen tweede uitzonderingenrij.** `zaken.js` gaat over één geval dat de machine niet zelf kon afhandelen, met een eigenaar, een termijn en een besluit. Een incident gaat over een **vermogen** dat het niet doet -- andere gegevens, andere werkstroom, andere levensduur. Dat is de toetsvraag uit `PLATFORM.md`, en hij valt hier op "zelfstandige capability".

**De machine opent, een mens sluit.** `weeg()` leest de gezondheidskaart en opent een incident voor elk vermogen dat op storing komt; een storing die niemand vastlegt is een storing waar niemand van leert. Sluiten doet hij niet, want dan zou er een incident in de historie staan zonder conclusie: herstelt de bron zich, dan wordt het incident `hersteld` gemarkeerd en wacht het op een verslag. Dat is werkvoorraad van een eigen soort en wordt apart geteld -- de storing is weg en de les is nooit getrokken.

**Sluiten kan niet terwijl het nog stuk is.** Een gesloten incident boven een lopende storing is een leugen in de historie, en het is de makkelijkste om te vertellen: het scherm wordt er rustiger van. Het kan wel met `toch` en een reden, en dan staat dat in het verslag -- een besluit in plaats van een vergissing. Een grendel zonder uitweg wordt omzeild in plaats van gebruikt.

**De impact is gemeten, en wat niet te meten is staat erbij.** Dit is de gevaarlijkste tekst op een incidentscherm: *"23 facturen vertraagd, 0 verloren, 0 dubbel verwerkt"* is precies wat een eigenaar wil lezen en precies wat je niet mag schrijven zonder iets dat die drie kan tellen. Elk getal komt uit een bevinding van de gezondheidskaart; drie dingen staan er standaard als **niet gemeten** met de reden erbij, en dat zijn feiten over deze code: hoeveel leden of organisaties het raakte (`server/meting.js` telt per routepatroon en draagt geen tenant), of er iets verloren ging en of er iets dubbel is verwerkt (het transactie-grootboek dekt de collecties in `server/db/tx/collecties.js`, niet het hele platform). Dat blok staat op het scherm als eigen kop en niet in een voetnoot.

**De oorzaak is een aanleiding en geen feit.** Er is geen veld `oorzaak` met een zin erin maar een lijst aanleidingen met per stuk de bron en de hardheid. Leunt het vermogen op iets dat óók stuk is, dan is dat de sterkere kandidaat -- met de zin erbij dat gelijktijdigheid geen oorzaak bewijst. Vindt hij niets, dan staat er "geen aanleiding gevonden", en dat is een uitslag en geen reden om er een te verzinnen.

En de **momentopname bij het ontstaan blijft staan**, naast de stand van nu: alleen de eerste tonen laat een opgelost incident als lopend lezen, alleen de tweede maakt onzichtbaar wat er toen aan de hand was.

Kern: `server/kern/command/incident.js` (de levensloop), `incident-impact.js` (de omvang en de aanleidingen) en `incident-verslag.js` (afsluiten en teruglezen); routes `/api/command/incident*` achter `command-doen`; scherm `public/apps/command/command-18.js`. Getoetst in `test/incident.test.js` (tien beweringen, zes mutaties).

### De configuratietijdlijn: wat is er vlak daarvoor veranderd?

Bij een storing stelt iedereen dezelfde vraag als eerste, en die was hier niet te beantwoorden -- niet omdat het nergens stond maar omdat het op drie plekken stond in drie vormen: het journaal van RTG Command, de aanvragen aan de schakelkast (`techniek.functieVerzoeken`) en het auditspoor van de incidentcontrole. `server/kern/command/tijdlijn.js` legt ze op één lijn.

**Het is een samenvoeging en geen vierde opslag.** Er wordt niets bewaard; elke regel komt uit een bron die er al was en draagt de naam van die bron. Een eigen kopie zou op een dag iets anders zeggen dan het scherm waar zij vandaan kwam, en dan is de tijdlijn het minst betrouwbare bewijsstuk van de drie.

**Volgorde is geen oorzaak**, en die zin komt van de server en niet van het scherm. `rondom(moment, minuten)` zegt dat er zevenendertig seconden eerder iets is gewijzigd; hij zegt niet dat dat het veroorzaakte. Een tijdlijn zonder die zin wordt binnen een week gelezen als een oorzakenlijst.

**En "niets gevonden" is niet "niets gebeurd".** Een leeg venster antwoordt met zoveel woorden dat er in déze drie bronnen niets staat -- een uitrol, een wijziging op de machine of een schrijfactie buiten Command zou er ook niet in staan. Wat elke bron mist staat per bron; wat geen van drieën ziet staat als aparte lijst. Dat is precies de verwarring waarmee iemand een oorzaak uitsluit die er wel degelijk was.

**Een aanvraag die niets veranderde staat er toch in**, met de status erbij: wie zoekt naar wat er veranderde, wil ook zien wat er bíjna veranderde. Het aantal regels en het aantal dat werkelijk iets veranderde staan apart, anders leest "vijf wijzigingen vlak ervoor" als vijf wijzigingen.

De lijn staat op de werkplek **Journaal** en in het dossier van elk incident, achter de knop *"Wat veranderde er vlak hiervoor?"*. Getoetst in `test/tijdlijn.test.js` (acht beweringen, zes mutaties); één ervan legde een echte fout bloot die er al in zat: `Number(minuten || 30)` maakte van een gevraagd venster van **nul** minuten er stil dertig.

### RTG Bijstand: support die binnenkomt zonder de sleutel te krijgen

Een leverancier die zijn klanten wil helpen, geeft zijn supportafdeling meestal een beheerdersaccount op alles. Dat werkt, en het is de reden dat *"onze engineer heeft even in uw omgeving gekeken"* een zin is die niemand kan controleren: er was geen begin, geen einde, geen onderwerp en geen spoor.

**Toegang is hier een uitnodiging en geen recht, en dat is de vorm en niet een instelling.** Er is geen route aan de kantoorkant die een sessie aanmaakt. De klantkant staat in `server/kern/command/bijstand-klant.js`, de RTG-kant in `bijstand-rtg.js`, en wie dat wil veranderen moet aan de klantkant bijbouwen -- dat valt op. Er staat zelfs een fail-fast op een naam die aan beide kanten voorkomt: `Object.assign` laat de RTG-kant winnen, dus een functie die daar `vraag` gaat heten zou de klantkant stilzwijgend vervangen terwijl het andere bestand nog steeds de enige plek *lijkt* waar een sessie ontstaat.

Vier niveaus, elk met een eigen maximale looptijd: **kijken** (alleen de diagnose, 60 min), **meedenken** (mag voorstellen, 120 min), **herstellen** (uitvoeren ná goedkeuring per handeling, 60 min) en **nood** (30 min).

**Waarom `nood` geen uitzondering is op de eerste regel.** De verleiding is een stand waarin RTG bij een ernstig incident zelf naar binnen kan; die komt er niet. Wat `nood` doet is de goedkeuring **vooraf** geven in plaats van per handeling -- omdat een klant die om half drie 's nachts belt niet naast het scherm gaat zitten om vinkjes te zetten. Dat is zijn besluit, met een verplichte reden, voor een half uur, en elke handeling verschijnt onmiddellijk in het spoor dat hij live meeleest. Op de handeling staat dan letterlijk `besluitDoor: 'vooraf, bij het openen van de noodsessie'`; in het verslag moet leesbaar zijn wie wanneer ja zei.

**Verlopen is een toestand en geen opruimactie.** `stand()` rekent hem bij elke lezing uit de klok -- een sessie die pas dichtgaat als er een schoonmaker langskomt, staat tussendoor open, en dan hangt "verloopt vanzelf" van een cron af. **En de klant kan de uitnodiging terugnemen, zonder uit te leggen waarom**: `trekIn()` zet de sessie op `ingetrokken`, en daarmee staat RTG buiten -- niet met een 403 die zegt "mag niet meer", maar omdat de sessie niet meer loopt. De route vraagt met opzet geen reden; een uitnodiging die je niet zonder uitleg kunt terugnemen is een recht met een wachttijd. **Een gedeelde kantoorcode betreedt geen klantomgeving**: die naam kan niet in een verslag staan als degene die het deed, dus hij komt er niet in.

**Inhoud is dicht.** De diagnose geeft structuur, tellingen en toestanden, plus de platformstand met de zin erbij dat die over ons gaat en niet over deze klant. De *namen* van werkruimtes en groepen zitten achter een apart, gemotiveerd verzoek dat de klant goedkeurt. En er is een derde laag die niet bestaat: de identiteitskluis, persoonsgegevens en de inhoud van berichten en bestanden. Dat is geen strengheid maar bouw -- `server/accounts.js` heeft zijn eigen poort met een verplichte reden, een regel in het inzagejournaal en bericht aan de betrokkene, en die deur loopt niet door deze laag. Elk antwoord draagt die `nooit`-lijst met een reden per post.

**En deze laag voert zelf niets uit.** `voerUit()` bewaakt de toestemming en schrijft de uitslag op; wat er werkelijk aan gegevens verandert loopt door de hersteltransactie. Een tweede schrijfpad zou wijzigingen opleveren die de voorcontrole en de verificatie overslaan.

Kern: `server/kern/command/bijstand.js` (de vorm), `bijstand-klant.js` (uitnodigen, goedkeuren, intrekken), `bijstand-rtg.js` (betreden, kijken, voorstellen, uitvoeren, afsluiten), `bijstand-niveaus.js` en `bijstand-diagnose.js`. Klantroutes `/api/tenant/bijstand/*` (achter dezelfde poort als de rest van de tenantlaag, `server/routes/tenant/poort.js`), RTG-routes `/api/command/bijstand/*`. Schermen: werkplek **Bijstand** in RTG Command en een kaart in het Werk OS (`public/apps/werk/bijstand.js`). Getoetst in `test/bijstand.test.js` (twaalf beweringen, negen mutaties), `test/bijstandketen.test.js` (negen toetsen over de echte routes: de keten, de twee grenzen die alleen over de lijn te zien zijn, en het intrekken) en `test/bijstandscherm.e2e.js`.

De **domeingrens** geeft de tenantkant daarbij precies deze ene laag: `kern.bijstand` hangt los aan de kern, zodat `GRENZEN.json` niet heel RTG Command hoeft open te zetten voor een klantroute.

### Het vlootbeeld: alle organisaties, tot waar de uitnodiging begint

Twee dingen moeten hier tegelijk waar zijn en ze trekken tegengesteld. Support moet van alle organisaties naar één werkruimte kunnen zakken zonder van gereedschap te wisselen -- anders wordt één externe storing bij achthonderd klanten achthonderd keer hetzelfde uitzoekwerk. En tegelijk mag "ik kan tot op werkruimteniveau kijken" niet betekenen "ik mag alles lezen".

Vandaar de regel die `server/kern/command/vlootbeeld.js` zijn vorm geeft: **het vlootbeeld toont wat RTG zonder uitnodiging mag zien, en houdt op waar de uitnodiging begint.** De afdaling eindigt met `dieper.mag: false`, de reden erbij en hoe je dan wél verder komt. Een lege diepte leest als "er is niets"; dit zegt "hier mag ik niet zonder toestemming".

**Eén hoofdincident is één incident.** De incidenten hangen aan een *vermogen* en niet aan een klant. Er staat dus bij hoeveel organisaties er **bestaan**, en er staat `geraakteOrganisaties: null` -- want dat getal kan hier niemand tellen. Zou het er wel staan, dan wordt "812 organisaties" binnen een week gelezen als "812 klanten hadden hier last van". Om dezelfde reden staat er **geen beschikbaarheidscijfer per klant**: `server/meting.js` telt per routepatroon en kent geen tenant, `kern/tenant/bewijs.js` weigert dat cijfer al aan de klant, en het intern wél gebruiken zou betekenen dat wij een getal hanteren dat wij extern onwaar noemen.

Werkplek **De vloot** in RTG Command; getoetst in `test/vlootbeeld.test.js` (zeven beweringen, zes mutaties).

## De Regie van de zaak: dezelfde logica, maar alleen over de eigen zaak

RTG Command bestuurt het platform. Een partner heeft dat niet nodig en mag het niet zien -- hij heeft dezelfde soort laag nodig over **zijn eigen zaak**. Die staat in `server/kern/zaakcommand/` en hangt als werkgebied **Regie** in de zaak-app (`/apps/leverancier.html`) en als tegel **Regie** in de personeels-PDA (`/apps/personeel.html`).

**De motoren zijn dezelfde, de gegevens niet.** Journaal, beleid, risico, uitzonderingen, runbooks, operator en werkbesparing komen uit `kern/command/`; ze kregen daarvoor twee haken. De eerste is het **register als parameter**: `zoek.js` en `object.js` importeren geen register meer maar krijgen er een. De tweede is het **vak**: elke motor slaat op in een object dat de aanroeper aanwijst. Zo heeft elke zaak zijn eigen hashketen, zijn eigen grenzen en zijn eigen lijst, met één implementatie eronder.

**De scope heeft twee assen, en de tweede kwam er door een lek.** De eerste versie scoopte alleen op de zaak — en toen kon een ober via de zoekbalk de verlofaanvragen en sollicitaties van zijn collega's lezen, gegevens die overal elders achter `managerOnly` staan. De reparatie is **weglaten en niet filteren**: een soort met `as: 'leiding'` staat niet in het register van een medewerker. Hij is er niet, dus geen enkele lezer kan hem vinden — ook de afhankelijkhedenscan niet, die álle soorten langsloopt. Een filter had op één van die lezers vergeten kunnen worden. `leiding` staat standaard op false: wie de vlag vergeet ziet te weinig, en dat is de goede kant om fout te gaan.

**Isolatie is bouw, geen belofte.** De zaakcode komt uitsluitend uit de sessie (`supplierAuth` zet `req.supplier` uit `sess.code`); geen enkele route in dit domein leest een code uit de body. Het register van een zaak kent alleen de eigen soorten, en elk van die soorten draagt zijn eigen `lees()` die op de zaakcode sluit. Zoeken op de code van de buurman levert daarom niet "niets gevonden na filtering" op maar niets, omdat er niets te vinden is.

**De recepten verzinnen geen werkelijkheid.** Dat is bij een zaak een scherpere eis dan bij het platform: een bestelling op "in bereiding" zetten omdat hij te lang op "nieuw" staat, zou betekenen dat het systeem zegt dat de keuken begonnen is terwijl niemand iets deed. Wat de vier recepten wél doen is administratieve drift rechtzetten: een bestelling waarvan alle stations "klaar" melden maar de status achterliep, een ritstatus van vóór de huidige keten (`rijdt` → `aan-boord`), een bevestigde boeking waarvan de datum allang voorbij is, een klus die als opgelost is gemarkeerd maar nog openstaat. Alles wat de zaak moet *beslissen* — een boeking bevestigen, een chauffeur toewijzen, verlof toekennen — is geen recept maar een **signaal** dat een uitzondering wordt met eigenaar, termijn en bewijs.

**Die signalen bestonden al, met de hand geschreven.** Ze stonden als `alerts` in `routes/supplier/backoffice.js`. Dat werkte zolang er één lezer was; met de Regie erbij zouden er twee bijna-gelijke lijsten zijn geweest. Ze staan nu één keer, in `kern/zaakcommand/signalen.js`, en de backoffice leest dezelfde bron — met hetzelfde antwoord als voorheen, tweetalig en al.

Kern: `server/kern/zaakcommand/` (register, runbooks, signalen, index), routes `/api/supplier/command/*` in `server/routes/zaakcommand/`, scherm `public/shared/zaakcommand/` (gebundeld naar `public/shared/zaakcommand.js`, gedeeld door beide apps), schakelbaar als `zaakregie` en `zaakregie-beheer`. Getoetst in `test/zaakcommand.test.js` (acht beweringen, vier mutaties) en `test/zaakregie.e2e.js` (beide schermen in een echte browser).

### De drie bureau-PDA's draaien op één werking

`studio-pda.html` (198 regels), `hardware-pda.html` (199) en `architect-pda.html` (184) waren drie kopieën van hetzelfde ontwerp. Na het normaliseren van de bureaunaam verschilden ze 54 tot 73 regels — en dat waren geen drie ontwerpen maar één dat uit elkaar was gelopen: de studio kreeg de nieuwe deelmenu-stijl voor de disciplinerij, de architect bleef op de oude pillen; de studio nam elf kolommen mee bij het uitvoeren, de hardware zeven en de architect acht, met verschillende namen voor hetzelfde; de architect laadde `deur.js` in de kop en de andere twee in de body. Zo'n verschil merkt niemand, want niemand opent drie apps naast elkaar.

De werking staat nu één keer in **`public/shared/bureaupda.js`**. Wat per bureau verschilt — de naam, de brief-hint, de twee velden waarmee een concept wordt samengevat (silhouet/aandrijving, behuizing/chip, typologie/constructie) en de kolommen van het register — staat daar als **gegeven** in één tabel. Een vierde bureau is een regel in die tabel plus een pagina van tachtig regels.

De drie paden blijven bestaan als echte apps met hun eigen gids-ingang en hun eigen deur: er wordt vanuit `kantoren.html` drie keer naar gelinkt en er staat een toets op hun deur (`test/kantoordeuren.e2e.js`). Ze vervangen door een doorverwijzing zou werk kapotmaken om iets op te ruimen wat niemand stoorde.

Getoetst in `test/bureaupda.e2e.js`: alle drie komen op met hun eigen bureau, elk spreekt alleen zijn eigen endpoints aan (de fout die je bij een samengevoegde werking het eerst zou maken), en alle drie dragen nu dezelfde disciplinerij.

### Het belofteregister: wat is toegezegd, en waar staat het

Op de vraag "maak alles wat er nog niet is" is hier twee keer het verkeerde antwoord gegeven. De eerste keer werd alleen de bovenste maplaag gescand en kwamen RTG Sheets, Slides en Forms als ontbrekend terug — ze staan in `public/apps/office/`. De tweede keer kwamen CRM en BI als ontbrekend terug, terwijl CRM als `server/bedrijf/klant.js` bestaat (met gewogen pijplijn en een verplichte verliesreden) en de voorspellaag als `server/kern/voorspel/`.

Twee keer fout op dezelfde vraag betekent niet dat er beter gezocht moet worden. Het betekent dat er geen bron was om in te kijken. Dit huis heeft `GRENZEN.json` voor domeingrenzen, `NORM.json` voor meters, `BEWIJS.md` voor wat de toetsen beweren en `ARCHITECTUUR.md` voor de kaart — maar niets dat zei wat er is *beloofd* en waar dat staat.

**`BELOFTE.json`** is die bron; `npm run belofte` schrijft er `BELOFTE.md` uit. Elke belofte draagt haar dekking — bestandspaden en API-paden — en het script kijkt na of die er echt zijn:

- **gedekt** — elk bewijsstuk bestaat;
- **open** — nog geen dekking: werkvoorraad, en dat mag;
- **gebroken** — er wordt verwezen naar iets dat er niet (meer) is.

Die laatste is de enige alarmerende stand, en de reden dat het register bestaat: een belofte die nog open staat weet iedereen, maar een belofte die ooit waar was en stil verdween mist niemand. Bij het opschrijven sloeg hij meteen drie keer aan — drie paden wezen naar modules die ergens anders bleken te wonen. Keuringsregel 41b houdt het bestand actueel en laat de keuring zakken op elke gebroken belofte; `test/belofte.test.js` toetst de meter zelf met een bewijsstuk dat niet bestaat, want een meter die je niet hebt zien uitslaan meet niets.

Wat het register **niet** doet, is kwaliteit beoordelen. Dat een bestand bestaat, zegt niet dat de belofte goed is ingelost; daarvoor is `BEWIJS.md` er en de toetsen die daaronder liggen.

### Gegevenskwaliteit en de kennisgraaf: één meting, twee vragen

Twee van de open beloften zijn dicht, en ze delen hun fundament. `kern/command/kwaliteit.js` meet welk veld in de praktijk naar welke soort verwijst — er is geen tabel die zegt "orders.supplierCode wijst naar zaken", want zo'n tabel veroudert zodra er een collectie bij komt en controleert dan precies de nieuwe velden niet. Uit die ene meting komen twee dingen:

- **de wezen** — rijen waarvan de verwijzing nergens aankomt. Naast dubbele sleutels en rijen zonder sleutel vormt dat de kwaliteitslaag: niet wat er *verkeerd* staat (daar zijn de runbooks voor) maar wat er *kapot* is. Een dubbele sleutel is geen bedrijfsprobleem maar een administratieprobleem, en het valt zelden op — tot iemand op de verkeerde rij klikt.
- **de randen** van `kern/command/graaf.js` — de kennisgraaf. Het objectdossier beantwoordt één stap ("wie verwijst naar dit object"); de graaf beantwoordt de vraag erachter: hoe hangt dit samen, en wat ligt er twee stappen verderop.

De drempel ligt op 80%: een veld dat vier van de vijf keer een bestaande sleutel raakt, is een verwijzing met vier wezen; een veld dat de helft van de tijd raak is, is waarschijnlijk toeval en wordt niet gecontroleerd. Liever een wees missen dan een half platform als kapot melden — daar staat een toets op.

**Zeker en vermoed staan apart.** Een dubbele sleutel is een feit. Een waarde die één keer voorkomt terwijl de rest tientallen keren hetzelfde zegt, is een vermoeden (typefout, oude naam) en telt niet mee als defect. Een meter die vermoedens als feiten telt, wordt terecht genegeerd.

Beide lagen draaien op het register dat ze meekrijgen, dus de zaak-kant krijgt ze gratis en volledig gescoped: de graaf loopt juist wél door en zou ongescoped het gevaarlijkste stuk zijn. In RTG Command staan ze als werkplekken **Kwaliteit** en **Kennisgraaf**; in de zaak achter de managergrens.

### De laatste acht beloften, en wat ze bewust níet doen

Het belofteregister staat op **65 gedekt, 0 open, 0 gebroken**. De acht die als laatste dichtgingen raken uitrol, migratie en meerdere omgevingen — precies het gebied waar een knop makkelijk mooier is dan de werkelijkheid. Wat elk van ze weigert te doen is daarom net zo belangrijk als wat het doet.

| Laag | Wat het doet | Wat het bewust niet doet |
|---|---|---|
| **Canary** (`kern/command/canary.js`) | een functie uit de schakelkast gefaseerd openzetten, met een terugroldrempel op dezelfde tellers als de servicedoelen | niet wegen als de nulmeting kwijt is (na een herstart); anoniem verkeer valt nooit in een canary |
| **Zandbak** (`zandbak.js`) | dezelfde motoren op een DB-venster met zaaigegevens, met eigen journaal en beleid | geen productierijen kopiëren; geen tweede installatie — alleen de motoren van Command, niet de app-routes |
| **Master data** (`mdm.js`, `mdmsamen.js`) | gemeten dubbelen over bedrijven en locaties, met een gouden record per veld | nooit vanzelf samenvoegen; nooit iets wissen (verliezers houden een verwijzing) |
| **Overname** (`overname.js`) | inlezen → afbeelden → droogloop → uitvoeren, met terugdraaien per partij | niets overschrijven (een bestaande sleutel is een botsing); niet uitvoeren zonder het zegel van de bekeken droogloop |
| **API-poort** (`apipoort.js`) | sleutels, scopes, quota en uitfasering op `/api/extern/` | niets ontsluiten: de toelating begint leeg; scopes buiten de toelating worden geweigerd en niet stil ingeperkt |
| **Landpakketten** (`LANDEN.json`, `landpakket.js`) | munt, voertaal en schakelkaststand per land, geleund op wat het huis al weet | geen naleving: btw-registratie en loonaangifte blijven mensenwerk, en die lijst wordt niet korter door te activeren |
| **Stadsstart** (`stadstart.js`) | een stad met land, genormaliseerde naam en per-plaats-standen | niet doen alsof het weefsel meerdere steden draagt; die stap blijft openstaan met de reden erbij |
| **Chaosproef** (`scripts/chaos.js`) | een eigen trio starten en de **actieve** server met SIGKILL omleggen, en meten | niet op productie te richten; "geen onderbreking gemeten" nooit als "geen onderbreking" tonen |

Twee dingen die door deze ronde heen lopen. **Een nulmeting die je kwijt bent, is geen nul** — de canary weigert te wegen na een herstart, want doorrekenen zou een negatief foutaantal geven en dus altijd groen. En **een grens weigert, hij perkt niet stil in** — de API-poort maakt geen half-ingeperkte sleutel, want dan denkt een koppeling ergens bij te mogen en merkt hij pas in productie van niet.

De chaosproef leverde het eerste gemeten failover-cijfer op: SIGKILL op de actieve server, 535 verzoeken op 25 ms, **0 mislukt**. Dat staat in `SLO.md` naast de herstelmeting, met het voorbehoud erbij dat "geen onderbreking gemeten" iets anders is dan "geen onderbreking".

### Het stadsweefsel draagt meer dan één stad

De boom van het weefsel begint bij `stad` en is vijf niveaus diep, dus **meerdere wortels pasten er altijd al in**. Wat ontbrak waren drie dingen, en ze waren geen van drieën zichtbaar zolang er één stad was:

1. **Niemand bouwde er een tweede.** `zorgGeografie()` stopte zodra er iets stond.
2. **De bevragingen kenden geen stad.** `namen('zone')` gaf de zones van alles bij elkaar. Dat leest als één stad zolang er één is, en is stilzwijgend fout zodra er twee zijn — een veldploeg ziet dan zones die duizend kilometer verderop liggen. Dit is de gevaarlijkste van de drie, want er gaat niets kapot: er staat gewoon te veel.
3. **De grenzen waren die van Ibiza.** Elk punt werd getoetst aan de vaste rechthoek uit `kern/navigatie`, dus een gebied in een tweede stad viel per definitie "buiten de stadsgrenzen" en die stad kon nooit gevuld worden.

`kern/stadsweefsel/steden.js` lost alle drie op: `stadErbij()` bouwt hetzelfde startraster (zes zones, drie buurten, drie wijken, twee straatsegmenten per zone) rond een eigen middelpunt met een eigen id-voorvoegsel, elke bevraging kent een stad-as, en de grenzen komen van de stad zelf. Twee steden mogen elkaar **niet overlappen** — dan hoort een punt bij allebei en gaan er twee ploegen naar dezelfde lantaarn.

**Er wordt niets verhuisd.** De eerste stad houdt haar ids (`G-stad`, `G-marina`, `G-marina-laan`) letterlijk. Gegevens verplaatsen om een functie toe te voegen is de duurste manier om een fout te maken die je pas maanden later ziet.

Daarmee kan de **stadsstart** de stap doen die hij eerder als openstaand moest melden: met een middelpunt bouwt hij het weefsel echt. Mislukt dat — geen middelpunt, een stad die overlapt — dan blijft de stap open staan met de reden erbij, en wordt hij niet groen gemeld. Wat mensenwerk blijft is eerlijker geworden in plaats van korter: de zes zones dragen generieke namen die hernoemd horen te worden, en er ligt geen wegennet onder een tweede stad.

Twee echte fouten kwamen onderweg boven, allebei gevonden door een toets en geen van beide door een lezer:

- Bij het opknippen viel `zorgGeografie()` uit `stadErbij()` weg. Wie een tweede stad aanmaakte vóórdat er ooit een zone was opgevraagd, kreeg een platform waarin de **eerste stad nooit meer werd gezaaid**.
- `stadId()` gaf `null` voor zowel "geen stad gevraagd" als "een stad gevraagd die niet bestaat". Een vraag naar de zones van een nog niet gebouwde stad gaf dus de zones van **alle** steden terug — en de stadsstart las dat als "zes zones" en meldde de weefselstap groen terwijl er niets stond.

### De norm is weer een norm

`npm run norm` stond rood: elf meters waren weggelopen sinds 8 augustus, terwijl er een hele bestuurslaag bij kwam. Ze zijn met de hand vastgezet in `NORM.json` — niet met `--vastleggen`, want dat tilt ook meters op die niemand heeft aangeraakt — en met een geschreven reden per post, zoals dat bestand zelf voorschrijft: *"Herstel het, of verlaag de norm met de hand — dan staat het als bewuste keuze in de historie."*

Eerst gerepareerd wat te repareren was:

- **`endpointsZonderTest` 1188 → 1158** door `test/commandlagen.test.js`: elke nieuwe laag krijgt daar een echte route-aanroep plus een 401-controle zonder sessie. Die toets vond meteen een fout die geen enkele motortoets kon zien — `stadstart` eiste alleen dat er een landpakket *bestond*, terwijl zijn eigen foutmelding belooft dat het land is *ingericht*.
- **`inlineStijlAttributen` 5871 → 5850** door de `style=""`-attributen uit de nieuwe schermen te halen; er staan nu vier veldbreedte-klassen in `command.html`. Dat is geen smaak: elk style-attribuut houdt `style-src-attr` open in de CSP.

Bewust vastgelegd en niet gerepareerd: negen servermodules staan echt over de 10 kB-grens, en **geen ervan is in dit werk ontstaan** (`server.js`, `kern/comm/`, `opzet/kernlaag4.js`, `livinglab/kader.js`, `routes/auth.js`, …). Vastleggen is daar geen goedkeuring maar het weer laten werken van de meter; ze blijven werkvoorraad. Datzelfde geldt voor `toetsenNietGemeten`: de veertien nieuwe toetsbestanden zijn wél met de hand gemuteerd (27 mutaties, alle 27 raak, per bestand in de kop genoteerd), maar de mutatiemotor is er niet langs geweest — en dat wordt hier niet als hetzelfde geteld.

### Het alarm: piepen op verandering, niet elke ronde

`SLO.md` noemde het sinds de eerste versie als zijn tweede gat: de cijfers worden gemeten en het foutbudget wordt bijgehouden, maar er gaat niemand piepen. `kern/command/alarm.js` is die piep, en hij **meet niets zelf** — elke controle leest een laag die er al is (servicedoelen, sonde, canary, gegevenskwaliteit, de hashketen van het journaal). Een alarm met een eigen meting zegt op een dag iets anders dan het scherm waar het over gaat, en dan gelooft niemand meer welk van de twee.

De drempels staan in `SLO.json`, de controles in de module. Dat is een bewuste knip: getallen horen in gegevens, maar een regeltaal in een configuratiebestand is een tweede implementatie die je niet kunt toetsen.

Het belangrijkste is het ritme. Er gaat een regel in het journaal en een sein naar het kantoorbord bij het **ontstaan** en bij het **oplossen**, en daartussen niet meer — een melding die elke dertig seconden terugkomt leert mensen om hem weg te klikken, en dan is de volgende, echte melding ook weg. Stilzetten kan, met een maximum en een reden; die stilte staat zelf ook in het journaal, want anders is achteraf niet te zien dat iemand het heeft weggeklikt.

Wat er **niet** gebeurt: geen mail, geen telefoonmelding. Dat is een kanaalbesluit met een piket eraan vast, en dat hoort niet stilzwijgend ingebouwd te worden. De uitgangen die er zijn, staan in de uitslag.

### Herkomst: dezelfde meting, en bij elk antwoord hoe hard het is

`kern/command/herkomst.js` is de derde vraag op die ene meting. Per soort: waar het naartoe wijst, wie eraan mag schrijven (de runbookcatalogus), wie het werkelijk deed (het journaal), hoe lang het blijft (`server/bewaarbeleid.js`) en wat er wees wordt als het verdwijnt.

Twee dingen maken het meer dan een plaatje.

**Elk antwoord draagt zijn aard** — *gemeten* (uit de gegevens zelf), *aangegeven* (uit een tabel die een mens schreef, met erbij wélke tabel) of *afgeleid* (gerekend uit die twee). Door elkaar getoond krijgt het geheel de betrouwbaarheid van het zwakste deel, en kan niemand zien welk deel dat is.

**Stilte is geen bewijs.** Het journaal ziet alleen wat via RTG Command is gegaan; de gewone app-routes en de leverancierskant lopen er niet doorheen. "Geen schrijver" betekent hier dus niet "hier schrijft niemand in" — en precies die verwarring is hoe iemand iets weggooit waar wel degelijk aan wordt geschreven. Die zin staat bovenaan het scherm, niet in een voetnoot.

De zaak-kant draait dezelfde module op haar eigen register, journaal en receptenboek, maar **zonder bewaarbeleid**: die tabel is van RTG. Een ondernemer een termijn tonen die hij nooit heeft afgesproken is erger dan hem geen termijn tonen, dus staat er dan "geen termijn" — en dat is waar. Werkplek **Herkomst** onder Zien; in de zaak achter de managergrens.

### Servicedoelen en de sonde: de meter die niet geruststelt

`SLO.md` beschreef sinds de eerste versie wát wij onszelf opleggen, en noemde er even eerlijk bij wat eronder ontbrak. Twee van die gaten zijn nu dicht.

**De norm staat in `SLO.json`.** Daar leest `kern/command/slo.js` hem, en de tabel in `SLO.md` is een afdruk die door `npm run slo` wordt geschreven; `npm run check` regel 43 maakt de keuring rood zodra die afdruk achterloopt. Een streefwaarde die op twee plaatsen staat, staat er binnen een maand twee keer anders — en dan is het document dat een mens leest het verkeerde van de twee.

**Het foutbudget wordt bijgehouden**, per doel: hoeveel storingsminuten er in de marge tussen streefwaarde en 100% passen, hoeveel daarvan verbruikt is, en de brandsnelheid. Boven de 1 is het budget op vóórdat het venster om is. Zolang er budget over is mag er uitgerold worden; is het op, dan gaat de aandacht naar stabiliteit. Dat is de hele reden dat een foutbudget bestaat: het maakt de afweging tussen snelheid en stabiliteit een cijfer in plaats van een discussie.

**Maar het gevaarlijkste geval is niet "niet gehaald", het is "niets gemeten".** De tellers in `server/meting.js` beginnen bij elke herstart op nul. Een vers proces met drie verzoeken en nul fouten staat rekenkundig op 100% beschikbaar, en dát als "doel gehaald" tonen is de duurste leugen die dit scherm kan vertellen. Vandaar een derde uitslag naast gehaald en niet gehaald: **onvoldoende gemeten**, met een eigen kleur en de reden erbij, zolang er minder dan 200 verzoeken zijn of over minder dan 5% van het venster is gemeten. Die uitslag houdt de uitrol bewust *niet* tegen — een slot dat na elke herstart een dag dichtzit, wordt omzeild in plaats van gebruikt.

Snelheidsdoelen geven om dezelfde reden een **bovengrens en geen punt**: de duur zit in een histogram met vaste emmers, dus het eerlijke antwoord is "p90 ligt op of onder 0,25 s" en niet een kommagetal dat er niet in zit.

**De sonde** (`kern/command/sonde.js`) loopt de reizen uit `SLO.json`: `/api/health`, `/api/ready`, de voordeur, het publieke aanbod, en een inlogpoging die **met opzet verkeerd inlogt** en een afwijzing verwacht — de sonde toetst dat het pad antwoordt, niet dat hij binnenkomt. Een 200 daar zou een bevinding zijn en geen succes.

Binnen en buiten staan apart en worden nergens opgeteld:

| Kant | Hoe | Wat het bewijst |
|---|---|---|
| **binnen** | `POST /api/command/sonde/draai` | de HTTP-laag antwoordt — niet dat een klant erbij kan |
| **buiten** | `node scripts/sonde.js https://host --melden --token=…` op een andere machine, terug via `POST /api/sonde/melding` | TLS, DNS, de reverse proxy en het netwerk zitten erin |

Die meldingsingang is de enige route in Command zonder kantoorinlog, want hij bestaat juist voor een machine waar geen sessie is. Hij zit achter **dezelfde poort als `/api/metrics`** (`server/meetpoort.js`, token of intern adres, 404 in plaats van 403) — die poort stond in `routes/meting.js` met het commentaar "zodat er niet per ongeluk een tweede, lossere deur ontstaat", en dit wás die tweede deur, dus staat hij nu op één plek. En de kant van een melding staat vast op *buiten*: een melder die zijn eigen kant mag kiezen, kan het strenge cijfer opvullen met makkelijke metingen.

Wat er **niet** is en in `SLO.md` blijft staan: een cron die de sonde elke minuut van buitenaf start (een inrichtingsbesluit op een machine buiten deze repo), alertregels, en een gemeten basislijn in plaats van verstandig gekozen streefwaarden.

## Veiligheid & verbinding: vier apps op één ruggengraat
## RTG Veilig: vier standen op één ruggengraat

Eén app (`/apps/veilig.html`) met vier standen, op één kern
(`server/kern/veiligheid/`, routes onder `/api/veiligheid/*`):

| Stand | Wat het doet |
|---|---|
| **Thuiswacht** (`#wacht`) | "Ik ben over X minuten thuis." Meld je je niet, dan krijgt je kring bericht met je laatst bekende plek |
| **Codewoord** (`#codewoord`) | Een gewone zin tegen Rahul waarschuwt je kring stil; op je scherm gebeurt er zichtbaar niets |
| **Vitaal** (`#vitaal`) | Dagelijkse check-in voor medicijnen of voor wie alleen woont |
| **Thuisrust** (`#rust`) | Niet storen tot je thuis bent, met een veiligheidsbaan die je kring altijd doorlaat |

**Waarom dit één app werd.** Dit waren vier losse apps met elk een eigen
PWA-manifest en een eigen tegel. Ze deelden alleen niet "onderhuids iets" — ze
deelden *alles*: dezelfde serverkern, dezelfde clientlaag
(`shared/veiligheid.js`), dezelfde kring en dezelfde eerlijke grens. Wat ze
onderscheidde was de vraag die ze stelden, en dat is een tabblad, geen app. Vier
deuren naar één systeem betekende in de praktijk dat iemand de Thuiswacht kende
en het Codewoord nooit had gezien.

Wat de samenvoeging **niet** doet: er komt geen tweede administratie naast de
kern (LAT.md regel 4). Elke stand roept exact dezelfde routes aan als zijn app
dat deed. De winst zit in wat nu één keer bestaat in plaats van vier keer — de
kring (één verzoek in plaats van vier) en de grens — en in wat nu vindbaar is.

De vier oude paden blijven bestaan als omleiding naar hun eigen stand
(`/apps/thuiswacht.html` → `/apps/veilig.html#wacht`), inclusief de
querystring, want er wordt van buiten naar gelinkt: uit een alarmmail, uit een
bladwijzer, en vanaf een toestel waar zo'n app als PWA geïnstalleerd staat. Die
vier manifesten blijven daarom ook staan, met hun `start_url` naar de juiste
stand; een geïnstalleerde Thuiswacht opent nog steeds de Thuiswacht.

`test/veiligheid.e2e.js` loopt de vier standen binnen één pagina af en meet twee
dingen die je aan de bron niet ziet: dat de seconde-teller van een lopende wacht
**stopt** zodra je de stand verlaat (geteld op tikduur, want schrijven naar een
losgekoppelde DOM-knoop gooit geen fout — een lekkende teller is volkomen stil),
en dat het levensteken van twee minuten juist **doorloopt**, want de wacht loopt
op de server en niet op het scherm waar je toevallig naar kijkt.

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
regelantwoorden zonder API-sleutel (die komen niet langs een model, dus een
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

## Spellen: een platform onder de spellen

Negentien spellen (zestien potjes met beurten, drie arcadespellen met een
score) plus de kinderspellen van De Speeltuin en De Speelhal. Wat eronder ligt
is belangrijker dan het aantal: `server/kern/spellen/` is een platform, en een
spel is er een bestand in.

### Een spel beschrijft zichzelf

`spellen/register.js` scant de map en bouwt de dispatch-tabellen uit een
`spel`-descriptor die elk spel zelf meelevert. Er zijn twee vormen:

| | `vorm: 'potje'` | `vorm: 'arcade'` |
|---|---|---|
| Spelers | 2-6, om de beurt | alleen jij |
| Regels | server-authoritatief | **in de client**, tenzij `serverScore` |
| Zegt | `wereld`, `max`/`min`, `volwassen`, `buitenBeurt`, `teams`, `perTaal`, `vormen`, `zicht`, `init`/`zet`/`statisch` | `werelden` (lijst), `maxPunten`, `serverScore` |

Een spel toevoegen is dus: een bestand neerzetten. Vergeet je de descriptor,
dan **start de server niet**, met de bestandsnaam in de melding -- stil
overslaan zou betekenen dat een spel spoorloos uit de lobby verdwijnt, en dat
is precies de fout die dit register moet uitsluiten. In `lobby.js`, `partij.js`
en `spellen.js` staat geen enkele spelnaam meer.

### Wie ziet wat: drie lagen, en waarom het er twee waren

Een spel levert zijn weergave in `zicht`, met drie functies waarvan alleen de
eerste verplicht is:

| Laag | Krijgt wie | Ontbreekt hij? |
|---|---|---|
| `zicht.speler(p, st, mij)` | een deelnemer, inclusief zijn hand | kan niet ontbreken |
| `zicht.kijker(p, st)` | een vriend die meekijkt | dan is het spel **niet te bekijken** |
| `zicht.publiek(p, st)` | een gedeeld scherm in de kamer | dan is het **niet te projecteren** |

Hiervoor waren het er twee: de speler kreeg `view(p, st, mij)`, de kijker
dezelfde functie met `mij = null`, en `kijken: true` zei dat dat veilig was.
Die vlag was een **bewering naast de code**, en hij klopte bij drie van de
zestien spellen niet -- 30 Seconden toonde de kaart juist wél aan een kijker
(die heeft geen spelersindex, dus `indexOf(null)` is `-1` en nooit de rader),
en Reactieduel en Schatduel lazen `st.tijden[mij].length` op een `mij` die niet
bestond, wat `spelKijk` liet gooien en de route een 500 liet geven. Geen enkele
toets riep `spelKijk` op die twee aan; de catalogustoets keek alleen naar de
vlag.

Nu is de weergave zelf het antwoord en valt er niets meer te vergeten. Vijftien
spellen halen hun kijkweergave nog steeds uit de spelerweergave -- vijftien
bijna-kopieen zouden uiteenlopen -- maar dat is nu `kijker: ZONDER_SPELER`, een
claim die `zicht.lekken()` narekent in plaats van gelooft. Het register weigert
`view` en `kijken` **luid**: automatisch vertalen zou die drie fouten
meenemen naar de nieuwe vorm en er de schijn van een besluit aan geven.

**30 Seconden is daarmee het spel dat de laag verklaart.** Het heeft geen
kijkweergave (die zou de kaart lekken) en wél een projectie: score, klok en wie
er raadt. De kaart zit niet in wat een scherm ontvangt, dus het *kan* hem niet
krijgen -- dat is iets anders dan hem niet sturen.

### Een klok per beurt

Een potje kan een `tempo` dragen, maar alleen als het spel `vormen: [...,
'async']` zegt (zes doen dat: schaken, dammen, Woordduel, Rummi, mens-erger-je-
niet en Magnaat). Drie soorten: **live** (30s/5m/15m), **relaxed** (6u/12u) en
**long play** (24u/72u). De lijst staat op het platform en niet per spel, want
hij is voor elk async spel hetzelfde; zestien eigen lijstjes zijn zestien
plekken waar `12u` kan gaan afwijken.

**De klok verloopt naar een aanbod, niet naar een uitslag.** Loopt de beurt af,
dan kan de tegenstander de partij toewijzen -- doet hij niets, dan gebeurt er
niets. Verlies-door-tijd is eerlijk in een competitie en hard in een
vriendenpotje. Een **toernooiwedstrijd** is de uitzondering en verloopt wel
vanzelf, want daar houdt een hele ronde stil en hangt de uitslag aan een
afspraak die vooraf is gemaakt. Toewijzen loopt langs `spelOpgeven` namens wie
niet kwam, zodat er maar één plek is die een potje beeindigt.

De klok telt bij relaxed en long play bewust **niet zichtbaar af**: je ziet
"jouw beurt, nog 18 uur". Een wegtikkende klok op een partij van drie dagen is
de kunstmatige urgentie die `CLAUDE.md` verbiedt.

### Het beleid: alle toetredingsvragen op een plek

`spellen/beleid.js` stelt bij elke toetreding dezelfde vragen in dezelfde
volgorde -- bestaat het spel, mag deze app het starten, mag deze speler mee --
en geeft de eerste weigering terug. Hij **neemt geen enkele regel over**: hij
roept `gedeeld.js`, `grens.js` en `zicht.js` aan. Een policylaag die zelf gaat
beslissen is een tweede kopie, en dan zijn er weer twee antwoorden op dezelfde
vraag.

Twee dingen die daardoor uitgesproken zijn in plaats van impliciet:

- **Meedoen is een smallere vraag dan starten.** De leeftijdspoort geldt bij het
  accepteren, de wereldpoort niet -- `wereld` zegt welke app een potje mag
  *starten*, en meespelen kan altijd over en weer.
- **Het beleid komt nooit uit het verzoek.** Een potje draagt een `context`
  (`hall`, `chat`, `school`, `werk`, ...) uit een gesloten lijst, en de route
  stuurt hem bewust niet door: wie zijn eigen context mag meesturen, opent
  straks een 18+-spel als schoolsessie.

Let op wat de arcade-rij zegt: **een arcadescore is niet server-authoritatief.**
De client rekent en stuurt een getal; de puntengrens uit de descriptor is de
enige rem. Dat is te dragen voor een ranglijst onder vrienden en niet meer
zodra er een competitie of een prijs aan hangt (open punt in `TAKEN.md`).

**Sudoku is de uitzondering, en laat zien hoe die eruitziet.** Zijn regels zijn
narekenbaar, dus horen ze op de server: `sudoku-nieuw` geeft een puzzel uit en
houdt de oplossing hier, `sudoku-klaar` neemt alleen een ingevuld rooster aan
en de punten komen van de serverklok. `serverScore: true` in de descriptor laat
`arcade-score` een ingestuurd getal voor dit spel **weigeren** -- zonder die
weigering zou er gewoon een tweede deur naast staan. Wat het bewijst is dat
*iemand* een puzzel van ons heeft opgelost in de tijd die wij hebben gemeten;
niet dat een *mens* dat deed. Dat laatste is zonder de speler lastig te vallen
niet te bewijzen, en doen alsof van wel zou een belofte zijn die de code niet
waarmaakt. Sneek en Tetris hebben geen narekenbare regel en blijven dus zoals
ze waren.

**En daarom heeft Sudoku als enige een dagopgave** (`kern/spellen/dag.js`): een
puzzel per dag, dezelfde voor iedereen, met een bord dat 's nachts leeg is. Het
register weigert `dagelijks: true` zonder `serverScore: true` -- dat is de enige
harde koppeling die het kent, en hij staat er omdat een dagbord een competitie
is waarop ook mensen staan die je niet kent. Drie ingangen: `dag` kijkt (en
start geen klok), `dag-start` start hem, `dag-klaar` levert in. De laag noemt
geen enkel spel bij naam -- wat een opgave *is* komt uit twee haken in de
descriptor (`dagOpgave` en `dagKeur`), precies de twee die Sneek en Tetris
straks invullen met hun seed en hun invoerlogboek.

Wat er met opzet **niet** in zit, want dat is de helft van het ontwerp: geen
reeks ("vijf dagen op rij" straft je voor de dag dat je niet meedoet), geen
melding dat de opgave verloopt (structureel: de module krijgt `nudge` niet eens
binnen), en geen historie -- elke dag die niet vandaag is wordt gewist, opgave
en al. Je *plaats* gaat over het hele veld, de *namenlijst* blijft je eigen
kring: een lijst met codenamen van vreemden is een sociale laag die dit huis
nergens anders heeft.

### Magnaat: twee vormen, en een economie op een echte stad

Magnaat draagt sinds kort **twee vormen** (`variant: vorm`). `bord` is het
bordspel met veertig velden, dobbelstenen en huizen — ongewijzigd, want het is de
enige Magnaat die met zes mensen binnen een uur aan tafel te spelen is.
`economie` is een economische simulatie op een echte stad.

De economie (`kern/spellen/magnaat/`) bestaat uit een kaart (zones met een echt
karakter — haven, boulevard, centrum, station, bedrijventerrein — waaruit de
economische eigenschappen van elk kavel worden **afgeleid**), zeven sectoren op
**één** economische kern, een vraagmodel met zes bevolkingssegmenten, en een klok
die **bijrekent in plaats van tikt**: bij elke aanraking wordt uitgerekend
hoeveel spelmaanden er verstreken zijn. Dat overleeft een herstart, schrijft
niets terwijl niemand speelt, en is deterministisch — tien maanden in één keer
geeft hetzelfde als tien maanden los.

**De RTFoundation is er een economische actor**, geen sausje: een deel van de
omzet van de stad vult een lokale pot, die pot bouwt projecten, en die projecten
**verschuiven de eigenschappen van de zone** waar ze staan. Een bibliotheek
levert op termijn beter opgeleid personeel, en dat is in de simulatie te meten.

**De kaart is echt, en één filter draagt dat.** `scripts/kaart-import.js` zet
open adresdata om in kavels en gooit **alles met een woonfunctie eruit** — een
adres in het spel is dus per definitie een adres waar geen huishouden staat
ingeschreven. Zolang een stad `bron: 'handmatig'` draagt staan er echte
straatnamen maar géén huisnummers in: een huisnummer is een bewering over een
specifiek pand en hoort uit een register te komen.

### Varianten: hetzelfde spel, andere instellingen

Een spel kan zeggen wat er aan te kiezen valt (`varianten` in de descriptor), en
een potje draagt die keuze als `variant`. Quizduel is de eerste gebruiker:
algemene kennis of schoolvragen, en bij schoolvragen welke leerstof. Dat is
**hetzelfde spel met dezelfde motor** -- dezelfde beurten, dezelfde
winnaarsbepaling, dezelfde poorten -- want vier quiz-apps bouwen zou vier keer
dezelfde fouten opleveren.

Vier regels, elk met een reden (`kern/spellen/variant.js`):

- **elke keuze is een gesloten lijst**, uit de descriptor. Een vrij tekstveld is
  binnen een maand een verzameling spelfouten -- dezelfde reden waarom
  `CONTEXTEN` en de twaalf gesprekssoorten in `kern/comm` lijsten zijn. Het
  levert er iets voor terug: de lobby kan de keuzes uittekenen
  (`/spel/varianten`).
- **een variant mág uit het verzoek komen en `context` niet.** Dat is geen
  uitzondering maar het verschil tussen de twee: context zegt wie er wat mag,
  een variant zegt welk spel je speelt.
- **een verkeerde waarde is een 400, geen stille terugval.** Wie 'taal groep 3'
  koos en algemene kennis krijgt, merkt dat pas voor de klas.
- **de vraag over de velden heen is van het spel** (`variantFout`): het platform
  weet niet dat leerstof bij de schoolbron hoort.

De schoolvragen komen uit de **bestaande leerlijnen** (`kern/leerstof-data/`) en
niet uit een tweede bibliotheek -- die zou binnen een jaar achterlopen op die van
de school zelf. Alleen leerdoelen met echte meerkeuze doen mee, en **een
schoolquiz schrijft niets bij in het leerpaspoort**: een quiz tegen een
klasgenoot is een spel, en winnen van een klasgenoot hoort geen cijfer te worden.

### De progressiegrens: alles wat blijft, stopt bij 18+

Eén functie (`progressieMag` in `kern/spellen/grens.js`) bepaalt wie een spoor
achterlaat: highscores, ranglijsten, uitslagen, standen en prestaties bestaan
alleen voor leden die de 18+-poort halen -- dezelfde poort als Proost, dus met
een gecontroleerde paspoort-geboortedatum. **Onder die grens blijft elk spel
volledig speelbaar; er wordt alleen niets van bewaard.**

Dat is geen voorzichtigheid maar het rechttrekken van een tegenspraak: De Arena
belooft tieners met zoveel woorden "alles telt alleen binnen het potje; er
bestaat geen ranglijst", terwijl dezelfde app drie arcadeborden toonde.

### Wie er nu is

Presence is een **afgeleide, geen tabel**: de RTG-app (`/api/stream`) en de
RTF-app (`/api/rtf/social/stream`) schrijven hun open verbinding allebei in
dezelfde `sseClients`-lijst, dus "wie is er nu" is een vraag aan die lijst.
Vijf regels begrenzen hem, en vier ervan houden iets tegen:

- de kring (vrienden **en** klasgenoten) komt van de server, niet uit het
  verzoek -- anders kun je de aanwezigheid van willekeurige leden aftasten;
- **binair, geen "laatst gezien"** -- dat vraagt opslag die er niet is, en het
  is precies de druk die dit huis niet bouwt;
- geblokkeerd valt weg, aan beide kanten;
- wie de functie "spelen" heeft uitgezet telt als offline, want anders nodig je
  iemand uit die het verzoek gegarandeerd niet kan aannemen;
- wie zichzelf onzichtbaar zet komt in niemands stand -- **een kant op**: je
  bent niet te zien en je ziet anderen nog wel.

Klasgenoten tellen mee omdat beschermde tieners onvindbaar zijn via de
codenaam-zoeker: hun klas is de enige kring die ze hebben.

### Uitslagen, stand en prestaties: één bron, niets bijgehouden

Een klaar potje werd na 24 uur weggegooid, dus er bestond geen geschiedenis.
`db.data.spelUitslagen` legt nu per afgelopen potje vast wie wat won -- op
**één plek** in `partij.js`, voor allebei de manieren waarop een potje eindigt
(een winnende zet en opgeven).

De progressiegrens geldt ook voor het **bewaren**: de partij blijft, maar
alleen deelnemers binnen de grens staan er met codenaam in; wie erbuiten valt
staat er als `{ anoniem: true }`, en speelde niemand binnen de grens mee dan
wordt er niets bewaard. Zo raakt een volwassene zijn historie niet kwijt zodra
hij met een tiener speelt, en bouwt het systeem toch geen profiel van die
tiener op.

Stand (`spelStand`) en prestaties (`spelPrestaties`) worden **afgeleid** uit die
log en niet apart bijgehouden. Dat is een bewuste keuze: een eigen teller zou
blijvend zijn en dus buiten het bewaarbeleid vallen -- en dat beleid kent
alleen takken met een datum per item, dus zo'n teller zou permanent op de lijst
`zonderBeleid()` staan. Afleiden kost geen opslag, heeft geen tweede wispad
nodig en verloopt vanzelf mee.

Het gevolg staat in het antwoord en op het scherm: een stand gaat over het
**venster** van de log (een jaar, uit `bewaarbeleid.js` zelf) en niet over
altijd. "7 gewonnen" zonder tijdsaanduiding zou lezen als een totaal voor
altijd. Een prestatie kan dus ook weer verdwijnen -- geen bug maar het punt.

Prestaties tonen **alleen wat behaald is**. Geen "3 van de 12", geen lijst van
wat je nog kunt halen, geen reeksen. Een voortgangsbalk naar een doel dat je
niet zelf koos is de por die hier niet thuishoort; drie toetsen bewaken dat.

### Bewaren en vergeten

- **Bewaartermijn:** uitslagen verlopen na een jaar (`server/bewaarbeleid.js`).
  Ze staan op het hoogste niveau in `db.data` en niet genest onder `spellen`,
  want de bewaarmotor leest `db.data[tak]` -- genest zouden ze buiten het
  beleid vallen.
- **Verlaten partijen:** een potje met status `bezig` werd nooit opgeruimd. Nu
  verloopt het na dertig dagen, gemeten op de laatste **zet** en niet op het
  aanmaken.
- **Vergeten:** wie zijn account laat wissen geeft zijn lopende potjes op --
  de tegenstander wint, die overwinning landt in de uitslagen, en de vertrekker
  staat daar meteen anoniem in. Die volgorde is het hele punt en staat als
  toets.

Wat dat wel en niet beschermt, staat ook in de code: het voorkomt dat de
**server** een profiel opbouwt. Het verbergt niet dat je met iemand speelde
voor de tegenstander zelf -- die zat erbij.

### Rahul als spelmaatje

In elk potje op te roepen voor regels, een hint of een peptalk. Hij krijgt
bewust alleen het spel, wie aan zet is en jouw vraag mee -- niet het bord en
niet iemands hand. Hij *kan* dus niet verklappen. Zonder API-sleutel geeft
dezelfde motor een vaste, uitlegbare tip.

### Praten in het potje

Geen zevende berichtenvoorraad: een potjegesprek is een **gewoon gesprek in
`kern/comm`** (soort `group`, sleutel `potje:<id>`) en staat dus ook in de
Berichten-app, met de bewaartermijn, het wisrecht en de leesstand die daar al
liggen.

Erboven staat één regel: **een potje geeft geen nieuw recht om iemand te
bereiken.** Praten kan alleen als *elk paar* aan tafel elkaar buiten dit potje
ook al mag bereiken. De wachtrij koppelt willekeurige spelers -- zonder die
regel is "even een potje dammen" de kortste weg naar een open lijn met een
vreemde, en in de RTF-app zou dat precies de poort omzeilen die tieners
onvindbaar maakt in de zoeker. *Elk paar*, want in een groepsruimte praat B ook
tegen C.

Wie dat zijn staat in `kern/spellen/kring.js`, op één plek (het uitnodigen voor
een team stelt dezelfde vraag): **vrienden, klasgenoten, of hetzelfde gezin.**
Die derde ontbrak en viel pas op door het na te meten -- een ouder en een kind
die samen dammen zijn geen "vrienden" en geen klasgenoten, terwijl een
huishouden een sterkere kring is dan allebei.

### Teams

Een vaste club om mee te spelen: iedereen mag er een maken. Wat dat begrensd
houdt is de vorm, niet een moderatiewachtrij -- een team is **niet openbaar**
(geen zoeker, geen lijst; je ziet het alleen als je erin zit of ervoor bent
gevraagd), uitnodigen kan **alleen binnen je eigen kring**, en je zit er pas in
als je ja zegt. Een team heeft bewust **geen ranglijst**: die zou buiten het
potje blijven staan en dus onder de progressiegrens vallen, en dan krijgt een
schoolteam een bord waarop de helft van de leden niet mag staan.

### Wat er geteld wordt

`db.data.spelTelling` houdt per dag per spel bij hoeveel potjes er afliepen en
hoeveel stoelen daaraan zaten. **Meer staat er niet in** -- geen sleutel, geen
codenaam, geen winnaar. Juist daardoor mag hij álles tellen: de uitslagenlog
bewaart niets van een partij tussen tieners onderling, dus een teller die
daaruit zou lezen ziet De Arena nooit. De privacyregel maakt deze cijfers dus
beter en niet slechter. Ze staan op het techniekbord
(`/api/techniek/spelcijfers`).

## Partnerkanaal

Het partnerkanaal voor niet-leden draait server-side: boekingen worden per stuk opgeslagen in `server/data/db.json` onder `bookings`, met één totaalprijs voor de klant; nettoprijs en service zijn interne administratie. RTG verdiende niets aan een boeking (`rtgCut` was altijd 0). Sinds de ondernemersregie is dat een KNOP van de boardroom: staat de bijdrage uit -- de beginstand -- dan is `rtgCut` nul en gaat een eventuele service volledig naar de partner, precies als voorheen. Staat hij aan, dan houdt RTG het ingestelde promillage in op de SERVICE (nooit op de netto reissom van de aanbieder) en gaat de rest naar de partner. (De losse publieke boekingspagina is met de marketingsite verwijderd; het model en de endpoints blijven bestaan.)

## Documentatie

- **docs/de-lijn.md** — wat we zelf bouwen, wat bewust niet, en waarom (de filosofie achter de afhankelijkheden).
- **docs/architectuur.md** — gedeelde kern + aparte domeinmodules, gateway en losse processen.
- **docs/hardening.md** — beveiligings- en betrouwbaarheidskeuzes.
- **VERWERKINGSREGISTER.md** — het AVG-verwerkingsregister (art. 30), opgesteld op wat de code werkelijk doet. De plekken die alleen RTG weet vraagt Rahul uit op de technische pagina; zolang die openstaan blokkeert `npm run golive`.
- **DATALEK.md** — het datalek-draaiboek: de 72-uursklok van art. 33, wie wat doet, en wat er vooraf uitgevraagd moet zijn.
- **PRODUCTION.md** / **LAUNCH.md** — runbook en livegang-checklist.
- **scripts/mac/LEESMIJ.md** — RTG als launchd-dienst op een Mac (Mac mini als thuisserver): `sudo scripts/mac/installeer.sh`.
