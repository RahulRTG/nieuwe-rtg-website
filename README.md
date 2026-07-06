# Rahul Travel Group — website & ledenportaal

Conceptwebsite van Rahul Travel Group: homepage, drie passen (RTG / Lifestyle / Business), een ledenportaal met betalingen, reizen & diensten, een persoonlijke AI, een digitale toegangskaart voor de toekomstige RTG-app en **De Salon** — het besloten sociale netwerk van RTG.

## Starten (met backend)

Vereist Node.js 18+.

```bash
npm install
npm start
```

Open daarna **http://localhost:3000/portaal.html** (de rest van de site staat op http://localhost:3000).

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
| `POST /api/comment` `{postId, text}` | Reageren — rechten per pas, server-side afgedwongen |
| `POST /api/dm` `{postId, text}` | Privébericht — zelfde rechten als reageren |
| `POST /api/ai` `{messages}` | Persoonlijke AI (Claude indien key aanwezig, anders demo) |
| `POST /api/logout` | Sessie beëindigen |
