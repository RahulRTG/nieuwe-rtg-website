# Rahul Travel Group — Projectcontext voor Claude Code

Dit bestand wordt automatisch gelezen bij elke Claude Code-sessie in deze map.

## Wat dit project is

Website + ledenportaal + app (PWA) voor Rahul Travel Group (RTG) — een membership-reisbureau met drie passen (RTG Pass, Lifestyle Pass, Business Pass), een partnerkanaal voor niet-leden, De Salon (besloten sociaal netwerk), en een RTFoundation die 30% van de bijdragen naar liefdadigheid brengt.

**`README.md` is de actuele technische documentatie** (structuur, starten, API-overzicht, PWA, partnerkanaal) — lees die eerst bij technische vragen. Dit CLAUDE.md bevat vooral de merkregels en afspraken die niet uit de code af te leiden zijn.

**`PLATFORM.md` bevat de super-app-regel** — lees die vóór je apps samenvoegt of
een nieuwe app aanmaakt. In één zin: super apps vervangen geen domeinsoftware,
ze orkestreren die; alleen apps die dezelfde kern, data én workflow dupliceren
mogen samensmelten. De toetsvraag is niet "kan dit in een super-app?" maar "is
dit een zelfstandige capability, of een tweede ingang naar dezelfde?". Daar
staat ook **het wereldpatroon**: samenvoegen is stap een, niet de bedoeling —
een wereld is pas af als hij zijn onderwerp begrijpt (graaf, beleid, cockpit,
gegronde Rahul, actielog).

**`GELD.md`, `LEVEN.md` en `LIFE.md` zijn de diepte-documenten per wereld.** GELD.md
maakt van RTG Geld een financieel besturingssysteem; de harde grens daar is
dat geld het huis nooit vanzelf verlaat. LEVEN.md maakt van RTFoundation een
Life OS dat een mens vanaf de geboorte begeleidt — lees vóór je daaraan werkt
vooral paragraaf 2, de grenzen: een kind is geen profiel, nooit sturen maar
openen, en de bijdrage-spiegel is nooit vergelijkend. Waar een functie botst
met een grens, vervalt de functie. LIFE.md maakt van RTG Sociaal een Life OS:
niet een sociaal netwerk maar het leven tússen mensen, waarbij een lid geen app
opent maar een levensmoment. Het werkwoord daar is **samenstellen en klaarzetten
— bevestigen doet de mens**: alles wat een tweede persoon bereikt (uitnodiging,
bericht, boeking, betaling) wordt nooit automatisch. Lees ook daar paragraaf 4,
de grenzen: een relatie is geen trechter, en er komt geen score op het leven
tussen mensen.

**`REIZEN.md` is het diepte-document van RTG Reizen** — het Travel OS: niet een
reisbureau met een boekingssite, maar een wereld die reizen beheert, ook de reis
die RTG niet verkocht heeft. Het werkwoord daar is **vóór zijn**: opmerken en
klaarzetten voordat de reiziger het merkt, en uitvoeren alleen waar het domein
dat al mocht. De zin die het ontwerp stuurt: het maakt niet uit waar een
onderdeel vandaan komt, het maakt wel uit dat RTG dat weet — vandaar dat elk
reisonderdeel een **soort** (wat de reiziger ziet) én een **herkomst** (wat het
systeem weet) draagt. Lees vóór je hieraan werkt vooral paragraaf 2.1 en de
grenzen: de Reis bezit geen boeking maar een verwijzing, een voornemen en een
bewijs; een wachter zonder bron zegt dat hij niet kijkt; een ingelezen waarde
wordt nooit stilletjes verbeterd, en de barcode blijft van de uitgever.
**`FOUNDATION.md` is het diepte-document van de RTFoundation als platform** —
Personal & Civic Operating System, op drie niveaus tegelijk: individu,
professional, organisatie. Het doet LEVEN.md niet over (dat blijft gelden en gaat
over de mens zelf) maar voegt de civiele helft toe: zaken over meerdere
instanties, documenten die iets van iemand vragen, processen met een
doorlooptijd, en het bewijs eronder. Lees vóór je hieraan werkt vooral
paragraaf 2, het werkwoord: **de Foundation opent en zet klaar — bevestigen doet
de mens**, en uitvoeren richting een instantie doet zij nooit zelf. Er is bewust
geen `EXECUTE_LOW_RISK`: wie bouwt weet niet in wiens leven hij staat, en een
grens die per geval anders had gemoeten is geen grens. Paragraaf 5 heeft zeven
eigen grenzen bovenop die van LEVEN.md; de scherpste twee zijn dat een
eligibility-motor alleen mag tóevoegen (nooit "dit is niets voor jou") en dat de
meeteenheid van een capaciteitsmotor de taak is en nooit de mens. Paragraaf 7
zet vijftig voorgestelde onderdelen op een rij met per stuk of hij al bestaat en
welke grens hem eerlijk houdt.

**`CONCERN.md` is het diepte-document van de bedrijvenkant** — RTG Concern,
het Company Launch & Workforce OS: van bedrijfsnaam of idee naar een ingericht
concern, en daarna mensen er moeiteloos in laten werken. Lees vóór je aan
bedrijven, vestigingen, rollen of personeel werkt vooral de paragraaf *De
grenzen*: de AI is hier geen juridische autoriteit (elk juridisch gegeven heeft
een bron én een geschiedenis), een werknemer koopt nooit een pas om te mogen
werken, en toegang verlenen gebeurt waar de rol woont — er komt geen derde
rechtenmodel bij. De kern in één zin: **één bedrijf is niet één KvK**, dus
concern, entiteit, registratie, vestiging, merk en operating unit zijn zes
begrippen en geen zes velden.

**`ONTWERP.md` is het RTG Design System 2.0** — de vormtaal: merk-elementen
tegenover werk-elementen (Bodoni is ceremonieel en staat op een gesloten lijst
rollen), de drie modi World/Pro/Command, uitzonderingsgestuurd ontwerpen, kleur
als betekenis, en de eigen componenten (Signal Rail, Reference, Action Line,
Context Pane, Command Palette). In één zin: **van veraf classy, van dichtbij
extreem krachtig.** Lees die vóór je aan een scherm begint; `test/ontwerp.test.js`
handhaaft wat machinaal te handhaven is.

**`MATERIAAL.md` is de materialenleer** — een luxemerk denkt niet in kleuren
maar in materialen en licht. Vijf materialen met elk een basis, een glans en een
rand: Pearl (gepolijst keramiek, warm en nooit blauw), Gold (geborsteld
champagnegoud, mat), Onyx (pianolak, nooit egaal), Bordeaux (fluweel, absorbeert
licht) en Royal (satijn, als enige koel). Plus de twee letterrollen. Kies een
materiaal, geen kleur; `test/materiaal.test.js` meet of het er nog een is.

**`WERELD.md` beschrijft het beginscherm** — en de harde regel daar is: er is er
één, en dat is de werktafel van RTG Command. Inloggen, je laatste werkblad
sluiten en op Home drukken komen alle drie op dezelfde lege keuze uit. De klok
was hier ooit de kern, met de werelden als merken op een bezel eromheen; die is
weg (17 augustus 2026), en het springboard eronder is hem gevolgd. Het horloge
staat nu alleen nog op het inlogscherm. De werelden staan bovenaan de bank, hun
onderdelen op hun eigen huis, en de enige lijst werelden blijft `MAPPEN` in
app-main. Rahul woont in de schilbalk zelf: zijn mond staat rechts in de balk
"Kies een wereld", en een tik maakt van diezelfde balk een vraagveld
(`shared/command/praat.js`) — geen paneel dat erover komt. Het bedieningspaneel
(met uitloggen) staat in de voet van die bank. De schil van `apps/app.html`
bestaat nog als **la** voor die panelen, niet als scherm. Lees ook wat er bewust NIET staat (een verzonnen statusstrook, een
voorgekookt werkblad) vóór je er iets bij zet.

**`WERELDEN.md` is de kaart** — vier werelden, een kern eronder, en de pas die er
dwars op staat. **LivingOS** (mijn dagelijks leven), **WorkOS** (mijn werk en
organisaties), **TravelOS** (mijn reizen) en **FoundationOS** (RTFoundation en
haar maatschappelijke werk), met de domeinen een niveau lager. Het document trekt
vier begrippen uit elkaar die steeds door elkaar liepen: **World** (waar ben ik),
**Capability** (wat kan het systeem), **Access** (wat mag ik) en **Pass** (waar
betaal ik voor) — *Core ondersteunt Worlds, Worlds organiseren Experiences,
Access bepaalt wat zichtbaar is, Passes bepalen commerciële rechten.* Bij twijfel
is er één vraag: **in welke context denkt de mens dat hij zich bevindt wanneer hij
dit gebruikt?** Daaruit volgt dat de bouwer van een capability niet bepaalt in
welke wereld hij hoort — RTFoundation mag eigenaar zijn van iets dat in LivingOS
verschijnt. Twee harde regels: **een wereld draagt nooit de naam van een pas, ook
niet de stam ervan** (`LifeOS` sneuvelde daarop tegenover Lifestyle Pass), en
**RTG Core is geen wereld** — 24 functies zitten in élke doelgroep en reizen met
de mens mee. `test/wereldregister.test.js` houdt het register fail-closed en
vergelijkt de kaart met de code, zodat een document dat niet meer klopt de bouw
laat zakken in plaats van stil verkeerd te blijven staan.

**Wat er precies in elke wereld hangt staat in `WERELDLIJST.md`** — zeventig
onderdelen met hun adres, geschreven uit `MAPPEN` met `npm run wereldlijst` en
bewaakt door regel 50 van `scripts/check.js`. Wat daar bewust NIET in staat is de
laag ertussen: welke onderdelen samen "het huishouden" of "zorg en gezin" heten
staat nergens in de code, en dat is een ontwerpbesluit en geen afleiding.

**De ladder van de drie passen staat daar ook**, en hij is na te rekenen met
`npm run groepen` (dat schrijft `GROEPEN.md` uit de bron): **RTG Pass** is het
hele platform voor één mens (140 functies), **Lifestyle** is hetzelfde platform
maar er doet iemand het vóór je (143, met De Rechterhand, RTG Zakelijk en het
Privékantoor als verschil — je koopt uitvoering, geen functies), en **Business**
krijgt daarbovenop een hele wereld (157, waarvan twaalf van de veertien
exclusieve functies WorkOS zijn). Lifestyle is een strikte deelverzameling van
Business; er is geen enkele functie die alleen Lifestyle heeft, en dat is een
vorm en geen gat. **Waar de prijs aan hangt is wel besloten en staat in
WERELDEN.md:** RTG betaalt voor het platform, Lifestyle voor **uitvoering** (er
doet iemand het vóór je) en Business voor **schaal** (per organisatie, per
vestiging, per medewerker). Niet op functies — drie functies verschil dragen geen
factor driehonderd, en functies weghalen bij RTG Pass botst met "premium, ook aan
de onderkant". Het bedrag zelf staat nergens in de code.

**`ADAPTIEF.md` is de adaptieve interactielaag** — hoe dezelfde capability zich
gedraagt op bureau, tablet, telefoon en stem. In één zin: **bureau toont veel
context tegelijk, telefoon toont één duidelijke taak met zijn handelingen binnen
bereik, en de capability zelf verandert niet — alleen zijn vorm.** Geen mobiele
versie en geen responsive-ronde: een capability declareert per vorm zijn
presentatie (werkbalk, contextmenu, selectiebalk, lade, paneel, taakmodus), en de
harde grens is dat **verbergen niet bestaat** — een handeling die op bureau
bestaat en op telefoon geen vorm heeft, is een gebrek en laat de toets zakken.
De schilbalk onderin is het eerste instrument: zijn middenzone draagt de werelden,
de bladacties of de selectieacties, met links altijd de bank en rechts altijd
Rahul. Lees die vóór je iets mobiel "even responsive" maakt.

**`GRAMMATICA.md` is de RTG Mobile Interaction Grammar** — de vaste manier waarop
álle RTG-software op een telefoon reageert, in zeven zinnen: *ik wil iets doen →
mijn duim vindt het onderaan; ik wil meer → ik trek de interface naar me toe; ik
selecteer iets → RTG begrijpt mijn context; ik wil weten wat er gebeurt → RTG toont
de toestand zonder mij te storen; ik doe iets gevoeligs → RTG vertraagt precies
genoeg; ik maak een fout → ik kan bijna altijd terug; ik wissel van RTG-product →
de bediening voelt bekend.* Vijf gebaren met elk één betekenis (tik doet, lang
drukken legt uit, omhoog trekken geeft meer, selectie verandert de acties, de orb
stelt voor), vijf gewichten van `licht` tot `plechtig`, en drie grenzen die niet
mogen sneuvelen: **ongedaan vóór bevestigen** (twintig "weet u het zeker?"-vragen
leren mensen op ja drukken), **een verhindering draagt altijd een reden** (er komt
geen grijze knop zonder uitleg bij), en **de orb stelt voor maar beslist nooit** —
wat er gebeurt loopt langs capability, verhindering en gewicht, en `plechtig` wordt
door een mens afgemaakt. Lees die vóór je een handeling toevoegt aan een scherm.

**`WERKRUIMTE.md` is het desktopparadigma** — RTG Desktop is not a collection of
pages, it is a movable operational space. Surfaces met een gouden greep rond een
centrale console, en Context Linking dat alleen een verwijzing rondstuurt.

**`ONDERHOUD.md` is de onderhoudslaag** — vier wachters voor de grond die
zonder commit verschuift (runtime, browser, live-site, wet) en de herstellus
die van elk rood licht een fix-issue met diagnose maakt. De twee vaste grenzen
daar: mergen blijft mensenwerk (met als enige, gesloten uitzondering de
Dependabot-klassen in `automerge.yml`), en de wetwacht meldt alleen — het
juridische oordeel blijft bij een mens.

**`TOEGANKELIJK.md` zegt wat een mens met een handicap hier wel en niet kan** — per soort barrière, met de meting erbij en met de dingen die geen poort ooit ziet. Lees die vóór je iets aan een scherm verandert. De harde poorten (contrast en structuur op nul in beide staten, de springlink, het ondertitelregister, en elk raakvlak minstens 24x24 op telefoonformaat) staan erin met wat ze tegenhouden; daaronder staat per mens waar het ophoudt. De belangrijkste zin is de laatste: er is nog nooit iemand met een handicap door dit huis gelopen, dus alles wat daar staat is gemeten met een browser en niet met een mens.

**`LAT.md` is de technische lat** — negen regels die allemaal uit een fout komen die hier écht is gemaakt, met per regel wat hem handhaaft en waar er alleen op mensen wordt vertrouwd. Lees die vóór je code schrijft of repareert. De belangrijkste twee: repareer de oorzaak en niet het symptoom, en trek elke bewering na met een mutatie (een toets die je niet hebt zien zakken is geen toets). LAT.md gaat over de code, CLAUDE.md over het merk.

## Structuur en starten (kort)

- `public/` — de webroot: `apps/` (portaal, PWA-app, leverancier, backoffice; 182 schermen), `apps/foundation/` (de RTFoundation, 71), `apps/juridisch/` (3), `site/` (alleen `404.html`), `shared/` (i18n, realtime), `fonts/`, `campagne/`, `sw.js` + `manifest.webmanifest` (PWA). **Er is geen `index.html` en geen marketingsite**: wie naar `/` gaat krijgt `/apps/app.html` via een interne herschrijving in `server/middleware/voordeur.js` (bewust geen 302, zodat de nonce-laag er gewoon overheen gaat), en die pagina draagt de inlogpoort zelf. Je komt dus direct bij de inlog
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
3. **Stark zwart/wit ritme**, geen beige/marmer-gradients, geen ronde hoeken of gouden randjes.
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
- **De zaak wordt gecontroleerd én de mens.** Acht genres houden de ZAAK tegen tot een medewerker een vergunning heeft gezien (`server/kern/aanmeldingen/bewijs.js`); daarnaast vraagt een genre iets van de PERSOON die er werkt — `server/kern/persoonseis.js`, met de stukken in `server/kern/vakbewijs.js`. Twee reikwijdtes: **werk** houdt de sessie tegen (kinderopvang, beveiliging, hulpdiensten — ook voor de manager, want juist de vrijstelling voor de baas is de deur waar een fraudeur op mikt), **handeling** houdt alleen die handeling tegen (voorschrijven, verwijzen, uitreiken). Een balie van een huisartsenpraktijk werkt dus gewoon en schrijft niets voor. Het documentNUMMER woont in de identiteitskluis (`member_state`, versleuteld en gebonden aan de rij) en niet in de operationele data: een BIG-registratie staat in een openbaar register, dus een nummer naast een codenaam voert die codenaam terug naar een echte naam. Het kantoor opent dat met een verplichte reden, een regel in het inzagejournaal en bericht aan de betrokkene; zelf-inzage gaat vrij. Drie regels die niet mogen sneuvelen: een ingediend stuk is geen bewijs (een mens van RTG tekent af, en nooit de werkgever zelf), een stuk verloopt en wordt bij élke vraag opnieuw gerekend, en RTG valideert niets inhoudelijk — wij bellen het BIG-register niet en doen niet alsof. Een handeling in het register die nergens wordt afgedwongen, laat `test/persoonseis.test.js` zakken.

## Wat NIET te doen

- **Geen marketingsite terugbouwen.** De publieke marketingpagina's zijn er bewust uit; `/` komt direct op de inlog uit. Een landingspagina, "over ons", een prijzenpagina of een publieke homepage is dus geen ontbrekend stuk dat je even aanvult — het is een besluit. Alleen terugbouwen als daar expliciet om gevraagd wordt
- Geen "verslavende" engagement-patronen (kunstmatige urgentie, oneindige scroll-tricks)
- **De progressielaag stopt bij 18+.** Alles wat een prestatie bewaart búiten het potje — highscores, ranglijsten, niveaus, prestaties, toernooien, seizoenen — bestaat alleen voor leden die de 18+-poort halen (`volwassen()` in `server/kern/volwassen.js`: een eigen account, door RTG gekeurd — betrouwbaarheidsniveau A3, het identiteitsbewijs is gezien — én 18 of ouder). Onder die grens blijft elk spel volledig speelbaar; er wordt alleen niets van bewaard. De Arena belooft tieners met zoveel woorden "alles telt alleen binnen het potje; er bestaat geen ranglijst", en School houdt vast aan "leren is geen wedstrijd". De grens staat op één plek in de code (`progressieMag` in `server/kern/spellen/grens.js`, die `volwassen()` leest); nieuwe progressievormen hangen daaraan en krijgen geen eigen kopie van de regel. Let op de tweede helft: de gecontroleerde geboortedatum komt pas van het document als de keurder hem bij de goedkeuring overneemt (`server/routes/office/verificaties.js`). Doet hij dat niet, dan is de identiteit wél gezien maar staat de datum nog zoals het lid hem opgaf; RTG iD en de stempoort tonen dat verschil met `leeftijdBron`.
- Geen nieuwe kleuren of fonts zonder de merkregels hierboven te checken
- `server/data/` (database, sleutels) en `.env` nooit committen
- Bij CSS-zoek-vervang: daarna clamp()/calc()-waarden en brace-balans controleren (eerder misgegaan)

## Workflow-voorkeur

Bij twijfel over een designkeuze: klein en omkeerbaar voorstellen, niet meteen hele bestanden herschrijven. Laat zien wat er verandert voordat je doorpakt naar de volgende pagina.

**Vragen stellen doe je met meerkeuze.** Moet je iets weten, stel dan geen open vraag maar geef opties waar je uit kunt kiezen, met per optie wat het betekent en wat het kost. Zet je eigen aanbeveling vooraan. Dat scheelt heen-en-weer en maakt zichtbaar welke keuzes er werkelijk zijn.
