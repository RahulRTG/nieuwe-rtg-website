# Rahul Travel Group — Projectcontext voor Claude Code

Dit bestand wordt automatisch gelezen bij elke Claude Code-sessie in deze map. Het bevat de merkregels, ontwerpbeslissingen en structuur zodat niets steeds opnieuw uitgelegd hoeft te worden.

## Wat dit project is

Website + ledenportaal voor Rahul Travel Group (RTG) — een membership-reisbureau met drie passen (RTG Pass, Lifestyle Pass, Business Pass), een inkoopprijs-model via gespecialiseerde groothandelskanalen, en een RTFoundation die 30% van de bijdragen naar liefdadigheid brengt.

Er is geen apart productplan-bestand in deze map (een eerder verwachte `RTG-specificatie.md` bestaat niet) — dit CLAUDE.md is de enige projectcontext.

## Bestandsstructuur

- `index.html` — homepage (hero, manifesto, intel, passen, foundation, cta)
- `rtg-pass.html` + `rtg-pass.css` + `rtg-pass.js` — RTG Pass-pagina met de "Butler": een echte AI-chat (zie Technische afspraken), CSS/JS in losse bestanden i.p.v. inline
- `lifestyle-pass.html` + `lifestyle-pass.js` — Lifestyle Pass-pagina met live AI-conciërge-chat (CSS inline in het bestand zelf)
- `business-pass.html` + `business-pass.js` — Business Pass-pagina met live AI-assistent-chat (CSS inline in het bestand zelf)
- `rtfoundation.html` — RTFoundation-pagina (waarom, het 30%-mechanisme incl. "Foundation koopt in via RTG, geen euro verspild", house-ad naar de passen; CSS inline, reveal/leesbalk-scripts inline — geen chat op deze pagina)
- `rahul-travel-group.html` — "Over RTG"-pagina (missie: iedereen moet kunnen reizen/service voor iedereen/meer waarde voor je geld; de RTG App als dagelijkse lifestyle-concierge — reizen boeken, kleding kopen, events organiseren; kantoor in de A'DAM Toren, Amsterdam; zelfde opzet als rtfoundation.html)
- `toegang.html` — Toegangspagina (RTG Pass voor iedereen, na "ballotage": een AI-intakegesprek dat alle info opvraagt; daarna één persoonlijke ledenmap met gesprekken, reizen, allergieën/voorkeuren; CTA's linken naar de Butler op rtg-pass.html#butler — bewust géén eigen chatwidget op deze pagina; linkt door naar portaal.html)
- `portaal.html` + `portaal.js` — Ledenportaal, expliciet gelabeld als **voorbeeldweergave**: tabbladen Gesprekken (WhatsApp-archief), Reizen & aankopen, Diensten (incl. account-koppeling met de toekomstige RTG App) en "Je assistent" — een échte AI-chat (pass:"portaal" op dezelfde api/chat.js-backend) die automatisch helpt en naar een mens escaleert. De demodata is fictief en zo gelabeld; echte data vereist WhatsApp-/account-/boekingskoppelingen die nog niet bestaan. De assistent-prompt verbiedt claims over inzage in echte gegevens.
- `api/chat.js` — Vercel serverless function, de gedeelde Claude-API-backend voor alle drie de chatwidgets
- `package.json` — geen dependencies, alleen `engines` om de Node-runtime te pinnen
- `.env.example` — documenteert `ANTHROPIC_API_KEY` (nooit de echte waarde committen)

Alle pagina's die vanuit `index.html` gelinkt worden bestaan inmiddels — er zijn geen dode links meer.

## Merkregels — ALTIJD toepassen

### Kleuren (exact uit het logo, nooit wijzigen zonder expliciete opdracht)
```css
--white:#FFFFFF
--black:#0C0C0B
--burgundy:#7F1634       /* primaire accentkleur */
--burgundy-bright:#9E1C40 /* hover-states */
--burgundy-on-dark:#C23A5E /* tekst op zwarte achtergrond */
--gold:#857007
--line:#DEDBD5           /* dunne scheidingslijnen */
--grey:#4D4A45            /* lopende tekst */
--grey-soft:#8A8680       /* onderschriften/meta */
```

**Regel: bordeaux is een accent, nooit een tekstkleur op zwarte achtergrond** (te weinig contrast, oogt vies — dit was een eerder gemaakte fout). Op zwart: wit of `--burgundy-on-dark`.

### Typografie
- **Bodoni Moda** (Google Fonts) voor alle koppen/display — hoog-contrast Didone-serif, het "modehuis"-lettertype
- **EB Garamond** (Google Fonts) voor alle redactionele lopende tekst (body-default, decks, kickers erven mee) — de klassieke "elite-tijdschrift"-serif; op expliciet verzoek toegevoegd (juli 2026) toen Inter als lopende tekst te modern/neutraal bleek
- **Inter** alleen nog functioneel: navigatie, knoppen, folio's, chat-UI/bubbles, formulierelementen, pager-label
- Geen andere lettertypes toevoegen zonder overleg
- Let op: EB Garamond rendert kleiner dan Inter — body staat daarom op 1.0625rem en de kleine kaart-/stap-paragrafen zijn opgehoogd (0.92-0.95rem → 1-1.02rem). Bij nieuwe kleine tekststijlen: niet onder ~1rem gaan.

### Design-principes (in volgorde van belang)
1. **Premium, ook aan de onderkant.** RTG Pass is de laagdrempelige instap ("voor de fans"), maar mag nooit budget/goedkoop aanvoelen.
2. **Eén signatuurelement, geen stapeling van trucjes.** De vorige iteraties gingen fout door custom cursors + chat-demo's + groeiende lijnen + ornamenten tegelijk te stapelen — dat oogde amateuristisch. Blijf bij wat al staat (de rode/bordeaux lijn-motieven, folio-nummers) in plaats van steeds iets nieuws toe te voegen.
3. **Stark zwart/wit ritme.** Secties wisselen tussen puur wit en puur zwart. Geen beige/marmer-gradients (eerder geprobeerd, verwijderd — voelde te "travel brochure").
4. **Veel lucht.** Genereuze padding tussen secties (10-14rem verticaal is normaal voor deze site). Bij twijfel: meer ruimte, niet minder.
5. **Redactionele/magazine-taal wordt spaarzaam gebruikt**: folio-nummers (N° 01, 02...), dropcaps, kicker-headline-deck-structuur, en (sinds de Vogue-stijl-update) één pull-quote per pas-pagina. Dit zijn bewuste devices, geen decoratie — niet zomaar uitbreiden. Index.html kreeg bewust géén pull-quote (de manifesto-sectie met dropcap+signature doet dat werk al) — dat onderscheid niet ongedaan maken.
6. **De site leidt de lezer** (sinds de "tijdschrift dat je omslaat"-update): elke pagina eindigt vóór de footer met een `.pager` ("Sla de pagina om" → volgende pas; business → terug naar de cover), er loopt een 2px bordeaux `.leesbalk` (leesvoortgang) bovenaan, secties hebben `.reveal`-scroll-animaties, en paginawissels gebruiken CSS view-transitions (omslag-effect). Dit is de vaste leesroute: cover → RTG → Lifestyle → Business → cover. `rtfoundation.html`, `rahul-travel-group.html` en `toegang.html` zijn bewuste zijsporen: bereikbaar via de nav en de cover, met een pager terug naar de cover — niet in de hoofdketting. Nieuwe pas-/feature-pagina's moeten wél in de hoofdketting worden opgenomen.

### Tone of voice — verschilt per pass, dit is bewust zo
- **RTG Pass**: "old money" — ingetogen, zeker, nooit opzichtig, "je/jij"-vorm, warm zonder onderdanig te zijn
- **Lifestyle Pass**: "vertrouwde rechterhand" — ingetogen, "u"-vorm, voorkomend zonder stijf te zijn
- **Business Pass**: "efficiënte strategische partner" — zakelijk, scherp, "u"-vorm, geen overbodige woorden

### Automatiseringsprincipe (bepaalt copy én techniek)
Alle drie de passen zijn AI-gedreven in het klantcontact — dit is een bewuste koerswijziging (Lifestyle Pass was eerder "volledig menselijk, geen chatbot"; dat is losgelaten omdat de gebruiker expliciet voor AI-first over de hele linie heeft gekozen).
- **RTG Pass**: volledig geautomatiseerd, AI-only, WhatsApp is de voordeur. Geen menselijk team — de AI is de enige lijn. **Toegang: voor iedereen**, na de "ballotage" (AI-intakegesprek); daarna een persoonlijke ledenmap (gesprekken, reizen, allergieën, voorkeuren — zie toegang.html).
- **Lifestyle Pass**: AI-first ("vertrouwde rechterhand"), mét een echt vast conciergeteam ernaast voor escalatie en alles wat persoonlijke aandacht vraagt. Niet meer "geen chatbot" — wel nog steeds de belofte van één vertrouwd aanspreekpunt en een team achter de hand. **Toegang: uitsluitend na menselijke goedkeuring, of op uitnodiging** — de AI mag nooit zelf toegang beloven/verlenen.
- **Business Pass**: hybride, ongewijzigd in de kern — vaste accountmanager voor de relatie/strategie/escalaties, AI-assistent voor de uitvoering. **Toegang: uitsluitend na menselijke goedkeuring, of op uitnodiging** — zelfde regel als Lifestyle.

## Technische afspraken

- **Alles in losse HTML-bestanden**, CSS inline in `<style>` — geen build-stap, geen frameworks voor de frontend. Dit blijft zo tenzij expliciet anders gevraagd. Uitzonderingen, niet opnieuw ter discussie stellen: rtg-pass.css/rtg-pass.js zijn losse bestanden i.p.v. inline; en alle drie de pas-pagina's hebben inmiddels een eigen los `.js`-bestand (rtg-pass.js/lifestyle-pass.js/business-pass.js) voor de live AI-chatclient — bij lifestyle/business blijft de CSS wél inline, alleen de chat-logica is uitgefactored.
- **Masthead-navigatie (sinds de Vogue-stijl-update)**: gecentreerd wordmerk boven een dunne lijn, gecentreerde nav eronder, identiek op alle 4 pagina's, blijft `position:fixed`. Koptypografie is bewust tweeledig: index.html (de "cover") krijgt de grootste/dramatischste h1-schaal, de drie pas-pagina's (de "feature spreads") een iets kleinere schaal — dat onderscheid niet plat slaan door alles gelijk te maken.
- **Geen stockfoto's/echte productfoto's.** Visuele elementen worden met CSS/SVG gebouwd (zie de procedurele marmertextuur en de skyline-silhouet-CSS als voorbeeld) — geen auteursrecht-risico, en het houdt de uitstraling exclusief voor RTG.
- **De AI-gesprekken op alle drie de passen zijn een echte Claude-koppeling**, geen gescripte simulatie meer. Architectuur: één Vercel serverless function (`api/chat.js`, CommonJS, geen SDK/dependencies — pure `fetch` naar de Anthropic Messages API) die per pass een eigen system prompt kiest. De `ANTHROPIC_API_KEY` staat alleen als environment variable in Vercel, nooit in de repo of in client-side JS — dat was precies waarom een eerdere directe client-side koppeling niet werkte. `package.json` bevat bewust geen dependencies (alleen `engines` om de Node-runtime te pinnen), zodat de "geen build-stap"-filosofie voor de rest van de site intact blijft.
- **Nog niet gebouwd, wel de richting**: WhatsApp als echte voordeur (vereist Meta WhatsApp Business Cloud API-goedkeuring — extern traject) en boekingen/back-office automatiseren (vereist leverancier-/groothandelskanaal-API-toegang die nog niet bestaat). Beide zijn business-/partnerschapstrajecten, geen codeertaken die alleen hier opgelost kunnen worden.
- **Voor elke CSS-wijziging**: controleer altijd op broken clamp()/calc()-waarden na een zoek-vervang-actie (eerder gebeurd: een brede vw-vervanging corrumpeerde clamp-waarden als `3.6vw` → `3.7.5vw`). Doe een brace-balans-check na grote bewerkingen.
- **Float-elementen (zoals dropcaps) altijd clearen** met `display:flow-root` op de ouder — anders klapt de hoogte in en lijkt tekst te overlappen.

## Wat NIET te doen

- Geen ronde hoeken, gouden randjes, of de oude "gradient-bordeaux-met-foto"-stijl van de originele rtravelgroup.store terugbrengen — dat is bewust vervangen.
- Geen "verslavende" engagement-patronen (kunstmatige urgentie, oneindige scroll-tricks).
- Niet zomaar echte hotel-/luchtvaartmaatschappij-merknamen gebruiken alsof het bevestigde partners zijn — alleen illustratief, of generiek. Dit geldt ook voor de AI-system prompts: nooit specifieke partnerschappen verzinnen, nooit claimen dat een boeking daadwerkelijk is verwerkt (er is geen boekingssysteem gekoppeld).
- Geen nieuwe kleuren/fonts introduceren zonder het hierboven te checken.

## Workflow-voorkeur

Bij twijfel over een designkeuze: klein en omkeerbaar voorstellen, niet meteen het hele bestand herschrijven. Laat zien wat er verandert (diff-achtig) voordat je doorpakt naar de volgende pagina.
