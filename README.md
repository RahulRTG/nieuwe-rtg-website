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
- **Persoonlijke login bij partners:** in een partner-app logt iedereen in op de eigen naam met een persoonlijke pincode (of het bedrijfsaccount met gebruikersnaam en wachtwoord). Alleen de bedrijfscode geeft geen toegang; zo staat elke handeling op een persoon.
- **Ledenprijsgarantie in code:** een lid betaalt bij een partner nooit meer dan de eigen publieke prijs van die partner. De ledenprijs wordt server-side afgekapt op de publieke prijs, zowel bij het opslaan van de menukaart als bij het plaatsen van een bestelling.
- **Security-headers:** Content-Security-Policy (geen extern verkeer behalve Google Fonts), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (camera, microfoon en locatie alleen voor de eigen apps).
- **AVG-rechten in de app:** elk lid kan onderin het meldingenpaneel zijn volledige dossier downloaden (inzagerecht, JSON) en zijn gegevens definitief laten wissen (vergetelheid): cv, chats, likes, live-locatie en account inclusief geupload document; sollicitaties bij bedrijven worden geanonimiseerd en alle sessies uitgelogd.
- **Wachtwoorden en PIN's** worden gehasht met scrypt; identiteitsdocumenten staan buiten de webroot en zijn alleen voor de backoffice toegankelijk.
- **Juridisch:** [privacybeleid](public/apps/juridisch/privacy.html), [algemene voorwaarden](public/apps/juridisch/voorwaarden.html) en [partnervoorwaarden](public/apps/juridisch/partnervoorwaarden.html) staan gebundeld in de juridische ROS-app (`/apps/juridisch.html`) en kloppen met wat de techniek doet.

## Partner worden & e-mail

Bedrijven worden aangemaakt vanuit de backoffice (de losse publieke wervingspagina is met de marketingsite verwijderd; het aanvraag-endpoint blijft bestaan). Bij goedkeuring maakt de server het bedrijf aan (leverancierscode + manager-PIN) en mailt die naar de aanvrager, waarna de hele partner-app direct werkt.

E-mail (verificatie, wachtwoord-herstel, sollicitatie- en partner-besluiten) is af: met `SMTP_URL` (+ optioneel `MAIL_FROM`) in de omgeving verstuurt nodemailer echte mail; zonder gaan berichten naar `server/data/outbox/` en werken alle links gewoon.

Zie **LAUNCH.md** voor de volledige livegang-checklist (hosting, domein, betalingen, sleutels).

## Live updates & push-notificaties

Website-portaal en app delen dezelfde backend en werken **live bij zonder herladen**, via Server-Sent Events (`GET /api/stream`). Betaal je in de app, dan daalt het openstaande bedrag in een geopend website-portaal meteen; reageert iemand op je post, dan verschijnt de reactie live in beide.

Elk lid heeft een **notificatiebel**: reacties, likes en privéberichten op je eigen posts komen binnen als in-app melding, als systeemmelding wanneer het scherm openstaat, en als **web-push** wanneer het scherm dicht is. Push draait op VAPID via onze eigen, dependency-loze implementatie (`server/webpush.js`: RFC 8292 + RFC 8291 op Node's `crypto`), met de service worker als ontvanger; de publieke sleutel komt van `GET /api/push/key`, subscriptions gaan naar `POST /api/push/subscribe`.

## De app (PWA)

**apps/app.html** is de RTG-app als installeerbare web-app (PWA, met `manifest.webmanifest` + `sw.js`): mobiele app-schil met tabbalk (Home, Reizen, Betalen met Face ID, AI en De Salon), draaiend op dezelfde backend als de site. Open op een telefoon en kies "Zet op beginscherm" om te installeren.

**Codenaam (privacy by design):** elke klant krijgt een codenaam (bijv. *Zilveren Valk*). Reserveringen, betalingen en reisdata staan in de systemen op de codenaam; de echte naam ligt in een gescheiden kluis en wordt pas bij ticketing/check-in gekoppeld. Wordt reisdata ooit gestolen, dan heeft de aanvaller nooit de juiste naam.

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
- **PRODUCTION.md** / **LAUNCH.md** — runbook en livegang-checklist.
- **scripts/mac/LEESMIJ.md** — RTG als launchd-dienst op een Mac (Mac mini als thuisserver): `sudo scripts/mac/installeer.sh`.
