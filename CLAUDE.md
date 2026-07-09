# Rahul Travel Group — Projectcontext voor Claude Code

Dit bestand wordt automatisch gelezen bij elke Claude Code-sessie in deze map.

## Wat dit project is

Website + ledenportaal + app (PWA) voor Rahul Travel Group (RTG) — een membership-reisbureau met drie passen (RTG Pass, Lifestyle Pass, Business Pass), een partnerkanaal voor niet-leden, De Salon (besloten sociaal netwerk), en een RTFoundation die 30% van de bijdragen naar liefdadigheid brengt.

**`README.md` is de actuele technische documentatie** (structuur, starten, API-overzicht, PWA, partnerkanaal) — lees die eerst bij technische vragen. Dit CLAUDE.md bevat vooral de merkregels en afspraken die niet uit de code af te leiden zijn.

## Structuur en starten (kort)

- `public/` — de webroot: `index.html` (homepage), `site/` (marketingpagina's), `apps/` (portaal, PWA-app, leverancier, backoffice), `shared/` (i18n, realtime), `sw.js` + `manifest.webmanifest` (PWA)
- `server/` — Node/Express-backend: `server.js`, `accounts.js` (identiteitskluis + codenamen), `db.js`/`seed.js`, `data/` (runtime: db.json, rtg.db, sleutels — **staat in .gitignore, nooit committen**)
- Starten: `npm start` (gebruikt `--experimental-sqlite`, vereist Node 22+) → http://localhost:3000
- Echte AI: `ANTHROPIC_API_KEY` als environment variable; zonder key vaste demo-antwoorden. De key nooit in de repo of client-side JS zetten.
- `server/data/db.json` verwijderen = terug naar de seed-data. Sleutels (`secret.key`, `vault.key`) worden automatisch aangemaakt.

## Geschiedenis

De eerdere **statische versie** (losse HTML-bestanden in de root + Vercel `api/chat.js`) is vervangen door deze Express-versie. De laatste stand ervan staat in de git-historie (commit `b0baef8`, juli 2026) — niet terughalen tenzij expliciet gevraagd.

## Merkregels — ALTIJD toepassen

### Kleuren (exact uit het logo, nooit wijzigen zonder expliciete opdracht)
```css
--white:#FFFFFF
--black:#0C0C0B
--burgundy:#7F1634        /* primaire accentkleur */
--burgundy-bright:#9E1C40 /* hover-states */
--burgundy-on-dark:#C23A5E /* tekst op zwarte achtergrond */
--gold:#857007
--line:#DEDBD5            /* dunne scheidingslijnen */
--grey:#4D4A45            /* lopende tekst */
--grey-soft:#8A8680       /* onderschriften/meta */
```

**Regel: bordeaux is een accent, nooit een tekstkleur op zwarte achtergrond** (te weinig contrast). Op zwart: wit of `--burgundy-on-dark`.

### Typografie
- **Bodoni Moda** (Google Fonts) voor koppen/display
- **Inter** voor functionele tekst (nav, knoppen, chat-UI, formulieren) en lopende tekst
- In deze versie wordt **geen EB Garamond** meer geladen (dat was de body-font van de oude statische versie) — niet opnieuw introduceren, en ook geen andere fonts toevoegen zonder overleg

### Design-principes
1. **Premium, ook aan de onderkant.** RTG Pass is de instap, maar mag nooit budget aanvoelen.
2. **Eén signatuurelement, geen stapeling van trucjes.** Niet steeds nieuwe visuele devices toevoegen.
3. **Stark zwart/wit ritme**, geen beige/marmer-gradients, geen ronde hoeken of gouden randjes.
4. **Veel lucht** — genereuze verticale padding; bij twijfel meer ruimte.
5. **Geen stockfoto's, geen modellen, geen extern beeld.** Campagnefoto's zijn AI-gegenereerd in eigen huis (staan in `public/campagne/`, gemaakt via Pollinations; stijl: quiet luxury, gedempte tinten, bordeaux-accenten, géén mensen) en worden eerlijk gelabeld ("AI · eigen huis"). Overige visuals met CSS/SVG bouwen.

### Tone of voice — verschilt per pass, bewust zo
- **RTG Pass**: "old money" — ingetogen, zeker, "je/jij"-vorm
- **Lifestyle Pass**: "vertrouwde rechterhand" — voorkomend, "u"-vorm
- **Business Pass**: "efficiënte strategische partner" — zakelijk, scherp, "u"-vorm

### Toegangs- en AI-regels (gelden ook voor system prompts)
- **RTG Pass**: voor iedereen, na de "ballotage" (AI-intake); volledig AI-gedreven klantcontact
- **Lifestyle & Business Pass**: uitsluitend na menselijke goedkeuring of op uitnodiging — de AI mag **nooit** zelf toegang beloven of verlenen
- Nooit echte hotel-/luchtvaartmerken als bevestigde partners opvoeren; nooit claimen dat een boeking daadwerkelijk verwerkt is
- **Privacy by design (codenamen)**: klantdata draait op codenamen, echte namen staan in de gescheiden kluis (`accounts.js`) — dit ontwerp niet omzeilen

## Wat NIET te doen

- Geen "verslavende" engagement-patronen (kunstmatige urgentie, oneindige scroll-tricks)
- Geen nieuwe kleuren of fonts zonder de merkregels hierboven te checken
- `server/data/` (database, sleutels) en `.env` nooit committen
- Bij CSS-zoek-vervang: daarna clamp()/calc()-waarden en brace-balans controleren (eerder misgegaan)

## Workflow-voorkeur

Bij twijfel over een designkeuze: klein en omkeerbaar voorstellen, niet meteen hele bestanden herschrijven. Laat zien wat er verandert voordat je doorpakt naar de volgende pagina.
