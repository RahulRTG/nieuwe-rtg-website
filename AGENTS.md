# Rahul Travel Group — projectregels voor elke agent

Dit bestand is de ene bron voor elke agent die in deze repository werkt: Codex leest het rechtstreeks, Claude Code via `CLAUDE.md`. Wat hier staat geldt voor allebei.

## Wat dit project is

Website + ledenportaal + app (PWA) voor Rahul Travel Group (RTG) — een membership-reisbureau met drie passen (RTG Pass, Lifestyle Pass, Business Pass), een partnerkanaal voor niet-leden, De Salon (besloten sociaal netwerk), en een RTFoundation die 30% van de bijdragen naar liefdadigheid brengt.

**`README.md` is de actuele technische documentatie** (structuur, starten, API-overzicht, PWA, partnerkanaal) — lees die eerst bij technische vragen. Dit CLAUDE.md bevat vooral de merkregels en afspraken die niet uit de code af te leiden zijn.

## Documenten

Per diepte-document staat de samenvatting woordelijk in `DOCUMENTENKAART.md`; dat bestand laadt niet vanzelf. Lees de kaart en daarna het document zelf vóór je aan het onderwerp werkt. Hieronder staat alleen de kop van elke samenvatting.

- `PLATFORM.md` bevat de super-app-regel
- `SCHERMEIGENAAR.json` zegt per zichtbare functie wie de eigenaar is
- `GELD.md`, `LEVEN.md` en `LIFE.md` zijn de diepte-documenten per wereld.
- `REIZEN.md` is het diepte-document van RTG Reizen
- `TRAVELCOMMERCE.md` is de handelskant daarvan
- `KAARTEN.md` is de kaartlaag onder de navigatie
- `NAVIGATIE.md` is de plaats-these
- `FOUNDATION.md` is het diepte-document van de RTFoundation als platform
- `BENOEMING.md` is RTFoundation Roles & Governance 2.0
- `AUTHORITY.md` is de RTG Authority Engine
- `HDI.md` is de laag BOVEN de Foundation
- `SAMENLEVING.md` is de grondwet boven de hele ladder
- `CONNECT.md` is het diepte-document van Foundation Connect
- `VERDER.md` is de lus van FoundationOS
- `POLITIEK.md` is het masterplan voor DemocratieOS en de partij
- `ONTMOETEN.md` is het diepte-document van de twee datingapps
- `TOKEN.md` gaat over de geldvorm zelf
- `WAARDE.md` is de laag onder het geld
- `ECONOMIE.md` is de laag erboven
- `KOSTEN.md` is de kostprijskant
- `GIFT.md` is het besluit vóór de doneerknop
- `CARRIERE.md` is de laag BOVEN de rugdekking
- `RUGDEKKING.md` is het besluit vóór de sponsorknop
- `MENSNETWERK.md` is de grondwet voor menselijke vertegenwoordiging
- `BEWIJSMACHINE.md` par. 6a is de les erboven, en hij geldt huisbreed: een proef kan een geldige uitslag geven en toch het verkeerde experiment zijn uitgevoerd.
- `STAGE.md` is de publieke laag boven de media- en eventdomeinen
- `CONCERN.md` is het diepte-document van de bedrijvenkant
- `PLANNING.md` is de tijd- en capaciteitslaag
- `VRIJHEID.md` is de mens die in dat rooster staat
- `OFFICE.md` is de richting van RTG Office Next
- `ARBEID.md` is het Work Kernel-voorstel, gemeten
- `LINK.md` is de adres- en capabilitylaag
- `COMMERCIE.md` is de Commercial Core
- `PRIJZEN.md` is de commerciële architectuur
- `CONTROLPLANE.md` is het Economic Control Plane
- `AFSPRAAK.md` is de laag die die vier aan elkaar knoopt
- `KANTOORMACHT.md` is de kantoorkant daarvan
- `KANTOOR.md` is de mens in die kamer
- `PERSONEEL.md` is wat die mens ERVAART
- `MUTATIECONTRACT.md` is de laag ernaast
- `TENANT.md` is de buitenkant van de bedrijvenkant
- `HORECA.md` is het diepte-document van de horecakant
- `CONCIERGE.md` is de lus rond een wens
- `BESTUUR.md` is het besturingsvlak
- `APPSTORE.md` is het derdenkanaal
- `COMMERCE.md` is de verkooplaag boven de domeinen
- `DEVELOPERCLOUD.md` is de richting boven de App Store
- `CREATE.md` is de laag bóven de Developer Cloud
- `OS.md` is de laag ónder de Developer Cloud
- `MAGNAATLAB.md` is Magnaat als testhal
- `BEWIJSMACHINE.md` is de lat boven de testhal
- `SERVICE.md` is de laag die de hulplijnen orkestreert
- `ONTWERP.md` is het RTG Design System 2.0
- `MATERIAAL.md` is de materialenleer
- `WERELD.md` beschrijft het beginscherm
- `WERELDEN.md` is de kaart
- `ADAPTIEF.md` is de adaptieve interactielaag
- `GRAMMATICA.md` is de RTG Mobile Interaction Grammar
- `EDGE.md` is RTG Edge 3.0
- `WERKRUIMTE.md` is het desktopparadigma
- `ONDERHOUD.md` is de onderhoudslaag
- `BETROUWBAARHEID.md` zegt wanneer een functie BESTAAT
- `TIKKEN.md` zegt hoe diep het huis is
- `TOEGANKELIJK.md` zegt wat een mens met een handicap hier wel en niet kan
- `PROOF.md` is het diepte-document van de vertrouwenslaag
- `FABRIC.md` is het richtingsdocument van de laag BOVEN PROOF
- `EXECUTIE.md` is de laag eronder
- `INTELLIGENTIE.md` is de laag BOVEN het stuur
- `AUTONOMIE.md` is de RTG Autonomy Kernel
- `CODE.md` is de laag waarin RTG naar zijn EIGEN software kijkt
- `TOESTEL.md` is AI op het toestel van het lid
- `MACHINE.md` is de laag die de motoren aan elkaar riemt
- `LAT.md` is de technische lat
- `BEWIJSLUS.md` is het besluit om GEEN laag boven de bewijsmachine te bouwen

## Structuur en starten (kort)

- `public/` — de webroot: `apps/` (portaal, PWA-app, leverancier, backoffice; 222 schermen), `apps/foundation/` (de RTFoundation, 85), `apps/juridisch/` (3), `site/` (`404.html`, `passen/` met vijf paspagina's, `werelden/` met vier wereldpagina's, en `start/` met de stijl en het script van de landing), `shared/` (i18n, realtime), `fonts/`, `campagne/`, `sw.js` + `manifest.webmanifest` (PWA). Tellingen gemeten op 19 september 2026.
- **De voordeur is een openbare landing, en `index.html` staat in de REPOSITORYROOT en niet onder `public/`.** Dat is één bron voor twee omgevingen: dat bestand is de canonieke GitHub Pages-pagina, en de Node-server levert hetzelfde bestand uit op `/` via `server/middleware/landing.js`, dat alleen de adressen aanpast die per webroot verschillen (`./public/site/…` wordt `/site/…`, en het productiedomein wordt dezelfde origin). Twee HTML-bestanden zouden na de eerstvolgende ontwerpwijziging uiteenlopen; vandaar één bron. `test/startpagina.test.js` bewaakt de statische Pages-variant. De landing draagt de ankers `#passen` en `#werelden` waar de negen pagina's onder `public/site/` aan hangen, en die pagina's linken er ook naar terug. **De inlog woont op `/apps/app.html`**; de oude bureau-URL's komen daar zonder 302 op uit via `server/middleware/voordeur.js`, zodat de nonce-laag er gewoon overheen gaat
- `server/` — Node/Express-backend: `server.js`, `accounts.js` (identiteitskluis + codenamen), `db.js`/`seed.js`, `data/` (runtime: db.json, rtg.db, sleutels — **staat in .gitignore, nooit committen**)
- Starten: `npm start` (vereist Node 22.13+; `node:sqlite` laadt sinds die versie zonder vlag, dus `--experimental-sqlite` is overal weg) → http://localhost:3000
- AI is optioneel en lokaal-eerst: regelwerk en controleerbare extractie gebruiken geen model; vrije verrijking loopt bij voorkeur via `LOCAL_AI_URL`. `RTG_EXTERNE_AI_UIT=1` sluit externe modellen hard af. Zonder model blijven alle kernprocessen in handmatige werkmodus beschikbaar. Sleutels nooit in de repo of client-side JS zetten.
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

**Regel: bordeaux is een accent, nooit een tekstkleur op zwarte achtergrond** (te weinig contrast). Op zwart: wit of `--burgundy-on-dark` — maar `--burgundy-on-dark` is zelf óók een accent en haalt op `--black` **3,78:1**: genoeg voor grote tekst (WCAG AA vraagt 3,0 vanaf 24px, of 18,66px vet), te weinig voor lopende tekst en kleine labels (4,5). Voor kleine tekst op zwart is het dus **wit**. Gemeten op 17 augustus 2026, toen de a11y-scan over alle 258 schermen ging; `--grey-soft` haalt daar 5,41 en is wel goed, `--grey` haalt 2,22 en hoort niet op zwart.

### Typografie
- **Bodoni Moda** voor koppen/display
- **Inter** voor functionele tekst (nav, knoppen, chat-UI, formulieren) en lopende tekst
- Beide **zelf gehost** in `public/fonts/` (woff2 + `@font-face` in `public/fonts/fonts.css`), niet van Google Fonts of een andere CDN. De CSP staat dat ook niet toe (`default-src 'self'`, `font-src 'self'`), dus een externe font-link laadt gewoon niet. Zelfde lettertypes, alleen niet van een vreemde server.
- In deze versie wordt **geen EB Garamond** meer geladen (dat was de body-font van de oude statische versie) — niet opnieuw introduceren, en ook geen andere fonts toevoegen zonder overleg

### Design-principes
1. **Premium, ook aan de onderkant.** RTG Pass is de instap, maar mag nooit budget aanvoelen.
2. **Eén signatuurelement, geen stapeling van trucjes.** Niet steeds nieuwe visuele devices toevoegen.
3. **Modern Heritage-ritme**, met de geometrie uit `HERITAGE.md`: inhoudsvlakken
   zijn recht of vrijwel recht (0-4px), terwijl uitsluitend systeemlagen zoals
   Edge, een modale laag, Side Sheet en Continue Key herkenbaar afgerond zijn
   (16-28px). Een statusstip, monogram of avatar mag een echte cirkel zijn.
   Willekeurige kaart-, veld- en knopafrondingen blijven verboden: de toegestane
   waarden wonen alleen in de centrale Heritage-tokens en componentcontracten.
   `scripts/check.js` regel 58 bewaakt precies die grens, zodat een route niet
   alsnog een eigen SaaS-vormtaal kan invoeren.
4. **Veel lucht** — genereuze verticale padding; bij twijfel meer ruimte.
5. **De Salon levert het beeld.** Site- en campagnebeeld zijn uitgelichte Salon-posts (featured, altijd met naamsvermelding — label "Uit De Salon · naam"; endpoint `/api/salon/promo`, alleen featured posts, RTG cureert). De onderliggende demo-beelden zijn AI-gegenereerd in eigen huis (`public/campagne/`, via Pollinations; quiet luxury, gedempte tinten, géén mensen) — geen stockfoto's, geen modellen, geen extern beeld. Overige visuals met CSS/SVG bouwen.

### Tone of voice — verschilt per pass, bewust zo
- **RTG Pass**: "old money" — ingetogen, zeker, "je/jij"-vorm
- **Lifestyle Pass**: "vertrouwde rechterhand" — voorkomend, "u"-vorm
- **Business Pass**: "efficiënte strategische partner" — zakelijk, scherp, "u"-vorm

### Toegangs- en AI-regels (gelden ook voor system prompts)
- **RTG Pass**: voor iedereen, na de "ballotage" (AI-intake); volledig AI-gedreven klantcontact
- **Lifestyle & Business Pass**: uitsluitend na menselijke goedkeuring of op uitnodiging — de AI mag **nooit** zelf toegang beloven of verlenen
- Nooit echte hotel-/luchtvaartmerken als bevestigde partners opvoeren; nooit claimen dat een boeking daadwerkelijk verwerkt is
- **Privacy by design (codenamen)**: klantdata draait op codenamen, echte namen staan in de gescheiden kluis (`accounts.js`) — dit ontwerp niet omzeilen
- **Fiscale uitspraken zijn geklasseerd, niet vlak.** Elke fiscale uitkomst droeg dezelfde zin — "voorlichting, geen bindend fiscaal advies" — en die stond zowel onder een btw-aangifte die tot op de cent uit het factuurregister is geteld als onder een zzp-schatting op een verwachte jaarwinst. Dat doet allebei tekort en wordt na een week niet meer gelezen. Er zijn nu vier klassen (`server/kern/fiscaal/zekerheid.js`): **bepaald** (wet + gegevens leiden eenduidig tot deze uitkomst; mag als feit worden gepresenteerd), **uitlegbaar** (meerdere verdedigbare behandelingen; wij kiezen er één en zeggen welke en waarom), **advies** (wij rekenen voor, een mens met vakkennis beoordeelt) en **voorbehouden** (dit mag RTG juridisch of procedureel niet zelfstandig doen). De regel eronder: **automatiseer wat objectief automatiseerbaar is, en maak nergens zekerheid waar die niet is.** Drie dingen mogen niet sneuvelen: een uitkomst die niemand heeft ingedeeld valt terug op de vóórzichtige klasse en zegt dat hij niet is ingedeeld (nooit stilzwijgend "bepaald"); `voorbehouden` is een grens en geen nog-te-bouwen functie — indienen namens een ondernemer, een boete opleggen, een naheffing vaststellen en toegang tot een pas beloven staan er alle vier in; en `bepaald` betekent "over de uitkomst is geen discussie als de gegevens kloppen", niet "gegarandeerd juist" — waarvoor de bewijsketen (`kern/fiscaal/herkomst.js`) laat zien waar het getal vandaan komt. Deze klassen gelden ook in system prompts: een AI-antwoord over de boekhouding sluit af met de zin van zijn klasse en niet met een zelfbedacht voorbehoud.
- **De zaak wordt gecontroleerd én de mens.** Acht genres houden de ZAAK tegen tot een medewerker een vergunning heeft gezien (`server/kern/aanmeldingen/bewijs.js`); daarnaast vraagt een genre iets van de PERSOON die er werkt — `server/kern/persoonseis.js`, met de stukken in `server/kern/vakbewijs.js`. Twee reikwijdtes: **werk** houdt de sessie tegen (kinderopvang, beveiliging, hulpdiensten — ook voor de manager, want juist de vrijstelling voor de baas is de deur waar een fraudeur op mikt), **handeling** houdt alleen die handeling tegen (voorschrijven, verwijzen, uitreiken). Een balie van een huisartsenpraktijk werkt dus gewoon en schrijft niets voor. Het documentNUMMER woont in de identiteitskluis (`member_state`, versleuteld en gebonden aan de rij) en niet in de operationele data: een BIG-registratie staat in een openbaar register, dus een nummer naast een codenaam voert die codenaam terug naar een echte naam. Het kantoor opent dat met een verplichte reden, een regel in het inzagejournaal en bericht aan de betrokkene; zelf-inzage gaat vrij. Drie regels die niet mogen sneuvelen: een ingediend stuk is geen bewijs (een mens van RTG tekent af, en nooit de werkgever zelf), een stuk verloopt en wordt bij élke vraag opnieuw gerekend, en RTG valideert niets inhoudelijk — wij bellen het BIG-register niet en doen niet alsof. Een handeling in het register die nergens wordt afgedwongen, laat `test/persoonseis.test.js` zakken.

## Wat NIET te doen

- **Geen TWEEDE marketingsite ernaast bouwen.** Er is er één, en het is `index.html` in de repositoryroot plus de negen pagina's onder `public/site/` — zie de structuurparagraaf hierboven. Maak daar dus geen kopie van onder `public/`: twee HTML-voordeuren lopen na de eerstevolgende ontwerpwijziging uiteen, en dat is precies waarom `server/middleware/landing.js` bestaat. Een nieuwe losse landingspagina, "over ons" of prijzenpagina is geen ontbrekend stuk dat je even aanvult — het hoort in de bestaande landing of het is een besluit
- Geen "verslavende" engagement-patronen (kunstmatige urgentie, oneindige scroll-tricks)
- **De progressielaag stopt bij 18+.** Alles wat een prestatie bewaart búiten het potje — highscores, ranglijsten, niveaus, prestaties, toernooien, seizoenen — bestaat alleen voor leden die de 18+-poort halen (`volwassen()` in `server/kern/volwassen.js`: een eigen account, door RTG gekeurd — betrouwbaarheidsniveau A3, het identiteitsbewijs is gezien — én 18 of ouder). Onder die grens blijft elk spel volledig speelbaar; er wordt alleen niets van bewaard. De Arena belooft tieners met zoveel woorden "alles telt alleen binnen het potje; er bestaat geen ranglijst", en School houdt vast aan "leren is geen wedstrijd". De grens staat op één plek in de code (`progressieMag` in `server/kern/spellen/grens.js`, die `volwassen()` leest); nieuwe progressievormen hangen daaraan en krijgen geen eigen kopie van de regel. **Wat hier onder valt is de COMPETITIEVE laag — bewaren om te vergelijken of als stand te laten gelden — en niet een leerdossier** (besluit van 14 september 2026, uitgeschreven in `FOUNDATION.md` par. 5.5 en `SCHOOL.md` par. 11.1): de letterlijke lezing zou betekenen dat School van een kind niets vastlegt, en dat is niet de bescherming die deze grens bedoelt maar het tegenovergestelde. Een leerdossier mag op elke leeftijd bestaan zolang het over de persoon zelf gaat en nooit vergelijkt, geen blijvend niveau-label draagt, alleen leesbaar is voor de leerling en wie al een rechtmatige verhouding tot hem heeft, en aan de codenaam hangt; valt er een van die vier weg, dan geldt `progressieMag` weer. Let op de tweede helft: de gecontroleerde geboortedatum komt pas van het document als de keurder hem bij de goedkeuring overneemt (`server/routes/office/verificaties.js`). Doet hij dat niet, dan is de identiteit wél gezien maar staat de datum nog zoals het lid hem opgaf; RTG iD en de stempoort tonen dat verschil met `leeftijdBron`.
- Geen nieuwe kleuren of fonts zonder de merkregels hierboven te checken
- `server/data/` (database, sleutels) en `.env` nooit committen
- Bij CSS-zoek-vervang: daarna clamp()/calc()-waarden en brace-balans controleren (eerder misgegaan)

## Workflow-voorkeur

Bij twijfel over een designkeuze: klein en omkeerbaar voorstellen, niet meteen hele bestanden herschrijven. Laat zien wat er verandert voordat je doorpakt naar de volgende pagina.

**Vragen stellen doe je met meerkeuze.** Moet je iets weten, stel dan geen open vraag maar geef opties waar je uit kunt kiezen, met per optie wat het betekent en wat het kost. Zet je eigen aanbeveling vooraan. Dat scheelt heen-en-weer en maakt zichtbaar welke keuzes er werkelijk zijn.
