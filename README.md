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

Er is geen losse marketingsite meer: `/` stuurt meteen door naar het RTG-OS-inlogscherm (`/apps/app.html`). Alle onderlinge links en assets gebruiken absolute paden vanaf de webroot (bijv. `/shared/i18n.js`, `/apps/app.html`), zodat mappen verplaatsen geen links breekt.

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

Open daarna **http://localhost:3000** — dat brengt je meteen op het RTG-OS-inlogscherm van de leden-app.

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

## Privacy & security

- **Pseudonimisering by design:** klanten staan in alle operationele systemen op hun codenaam; echte namen liggen in een gescheiden kluis en worden pas bij ticketing/check-in gekoppeld.
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

Elk lid heeft een **notificatiebel**: reacties, likes en privéberichten op je eigen posts komen binnen als in-app melding, als systeemmelding wanneer het scherm openstaat, en als **web-push** wanneer het scherm dicht is. Push draait op VAPID (`web-push`), met de service worker als ontvanger; de publieke sleutel komt van `GET /api/push/key`, subscriptions gaan naar `POST /api/push/subscribe`.

## De app (PWA)

**apps/app.html** is de RTG-app als installeerbare web-app (PWA, met `manifest.webmanifest` + `sw.js`): mobiele app-schil met tabbalk (Home, Reizen, Betalen met Face ID, AI en De Salon), draaiend op dezelfde backend als de site. Open op een telefoon en kies "Zet op beginscherm" om te installeren.

**Codenaam (privacy by design):** elke klant krijgt een codenaam (bijv. *Zilveren Valk*). Reserveringen, betalingen en reisdata staan in de systemen op de codenaam; de echte naam ligt in een gescheiden kluis en wordt pas bij ticketing/check-in gekoppeld. Wordt reisdata ooit gestolen, dan heeft de aanvaller nooit de juiste naam.

## Partnerkanaal

Het partnerkanaal voor niet-leden draait server-side: boekingen worden per stuk opgeslagen in `server/data/db.json` onder `bookings`, met één totaalprijs voor de klant; nettoprijs en service zijn interne administratie. RTG verdient niets aan een boeking (`rtgCut` is altijd 0): een eventuele service gaat volledig naar de partner. RTG's enige inkomsten zijn de abonnementen. (De losse publieke boekingspagina is met de marketingsite verwijderd; het model en de endpoints blijven bestaan.)

## Documentatie

- **docs/de-lijn.md** — wat we zelf bouwen, wat bewust niet, en waarom (de filosofie achter de afhankelijkheden).
- **docs/architectuur.md** — gedeelde kern + aparte domeinmodules, gateway en losse processen.
- **docs/hardening.md** — beveiligings- en betrouwbaarheidskeuzes.
- **PRODUCTION.md** / **LAUNCH.md** — runbook en livegang-checklist.
