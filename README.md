# Rahul Travel Group, website & ledenportaal

Conceptwebsite van Rahul Travel Group: homepage, drie passen (RTG / Lifestyle / Business), een ledenportaal met betalingen, reizen & diensten, een persoonlijke AI, een digitale toegangskaart voor de toekomstige RTG-app en **De Salon**, het besloten sociale netwerk van RTG.

## Projectstructuur

```
public/            alles wat de browser laadt (de webroot die de server serveert)
├── index.html     homepage (bereikbaar op /)
├── sw.js          service worker (staat bewust in de root: scope /)
├── manifest.webmanifest
├── icon.svg
├── shared/        gedeelde client-scripts (i18n.js, realtime.js)
├── site/          marketingpagina's (passen, foundation, boeken, toegang, download, bloomingdale)
└── apps/          alle web-apps, per doelgroep en genre:
    ├── index.html         app-overzicht (hub)
    ├── leden.html         leden-app (de passen; alias van app.html)
    ├── personeel.html     personeels-app (rooster, taken, walkie-talkie, SOS)
    ├── partners.html      werkgevers-app (alias van leverancier.html, alle genres)
    ├── restaurant/bar/hotel/appartement/taxi/privejet.html  eigen app per genre
    ├── portaal.html       ledenportaal (web)
    └── backoffice.html    RTG-backoffice
server/            Node.js/Express-backend + data (db.json, rtg.db, sleutels, uploads)
```

Alle onderlinge links en assets gebruiken absolute paden vanaf de webroot (bijv. `/shared/i18n.js`, `/apps/app.html`), zodat mappen verplaatsen geen links breekt.

## Starten (met backend)

Vereist Node.js 18+.

```bash
npm install
npm start
```

Open daarna **http://localhost:3000/apps/portaal.html** (de rest van de site staat op http://localhost:3000).

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
| `POST /api/partner` `{code}` | Partnercode valideren (demo-codes: `NOVA`, `ATLAS`, `BLOOM`) |
| `POST /api/staff` `{staffCode}` | Personeelscode van een partnerbedrijf valideren (demo: `BLOOM-TEAM`) |
| `POST /api/partnertrips` `{staffCode?}` | Gecureerde reizen, alleen totaalprijzen; met geldige personeelscode ook personeelsprijzen |
| `POST /api/book` `{code \| staffCode, tripId, name, email}` | Boeking zonder pas via een partner of personeelscode |
| `POST /api/cv/get` / `POST /api/cv/save` | Het RTG-cv van het lid (de cv-builder in de leden-app) |
| `POST /api/member/apply` `{supplierCode, func}` | Solliciteren bij een partner; kan pas met een afgerond cv |
| `POST /api/supplier/apply` `{code, name, func, contact}` | Open sollicitatie via het startscherm van een partner-app |

**Blijf ingelogd:** sessies worden bewaard (server-side in `db.json`, client-side in de browser). Wie inlogt blijft ingelogd, ook na een herstart van de server of het sluiten van de app. Uitloggen kan in elke app (leden-app: onderin het meldingenpaneel; partner-app: de gebruikerschip rechtsboven; personeels-app: Wissel). Personeels-PIN's zijn beschermd tegen raden: na vijf foute pogingen volgt een minuut wachttijd.

## Live updates & push-notificaties

Website-portaal en app delen dezelfde backend en werken **live bij zonder herladen**, via Server-Sent Events (`GET /api/stream`). Betaal je in de app, dan daalt het openstaande bedrag in een geopend website-portaal meteen; reageert iemand op je post, dan verschijnt de reactie live in beide.

Elk lid heeft een **notificatiebel**: reacties, likes en privéberichten op je eigen posts komen binnen als in-app melding, als systeemmelding wanneer het scherm openstaat, en als **web-push** wanneer het scherm dicht is. Push draait op VAPID (`web-push`), met de service worker als ontvanger; de publieke sleutel komt van `GET /api/push/key`, subscriptions gaan naar `POST /api/push/subscribe`.

## De app (PWA)

**apps/app.html** is de RTG-app als installeerbare web-app (PWA, met `manifest.webmanifest` + `sw.js`): mobiele app-schil met tabbalk (Home, Reizen, Betalen met Face ID, AI en De Salon), draaiend op dezelfde backend als de site. Open op een telefoon en kies "Zet op beginscherm" om te installeren.

**Codenaam (privacy by design):** elke klant krijgt een codenaam (bijv. *Zilveren Valk*). Reserveringen, betalingen en reisdata staan in de systemen op de codenaam; de echte naam ligt in een gescheiden kluis en wordt pas bij ticketing/check-in gekoppeld. Wordt reisdata ooit gestolen, dan heeft de aanvaller nooit de juiste naam.

## Partnerkanaal

Niet-leden boeken via **site/boeken.html**, bereikbaar via een partnerlink zoals `/site/boeken.html?via=NOVA`. De klant ziet uitsluitend één totaalprijs; nettoprijs, service en de commissieverdeling tussen partner en RTG zijn interne administratie en worden per boeking opgeslagen in `server/data/db.json` onder `bookings`.

**Bloomingdale Bloemendaal** (`site/bloomingdale.html`) is de voorbeeld-pagina van de partnertool voor bedrijven: een co-branded pagina met twee kanalen. Een klantenkanaal (gasten boeken onder het merk van de partner) en een personeelskanaal (medewerkers boeken met personeelsvoordeel via code `BLOOM-TEAM`, als secundaire arbeidsvoorwaarde). Beide kanalen leveren RTG én de partner omzet op; de verdeling blijft onzichtbaar voor de boeker.
