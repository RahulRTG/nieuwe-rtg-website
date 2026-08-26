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

**`WAARDE.md` is de laag onder het geld** — RTG Value: niet wat één lid met zijn
geld doet (dat is GELD.md) maar wat waarde binnen RTG zélf is. De kern in één
zin: elke euro, elk tegoed en elk budget weet wie het bezit, waarvoor het
gebruikt mag worden, wie het mag verplaatsen en welk bewijs daarvoor bestaat.
Lees die vóór je aan saldo, tegoeden, vouchers, budgetten of uitbetalen werkt.
Zes waardeklassen met elk een **grond** (`kern/waarde/klassen.js`), drie
beleidslagen van hard naar zacht (`kern/waarde/policy.js`), en één poort waar
elke betaling langs gaat (`kern/pay/poort.js`). Twee manieren waarop geld
vaststaat en ze zijn met opzet niet hetzelfde: een **reservering** is iemand
anders die uw geld vasthoudt en die vervalt (`kern/waarde/reserve.js`), een
**oormerk** is u die uw eigen geld apart zet en dat blijft
(`kern/waarde/oormerk.js`). Verder: budgetten van een werkgever of gemeente als
eigen positie, slim betalen uit meerdere potjes waarbij het meest beperkte potje
eerst opgaat, een eigen geldgrens die wél weigert (`kern/geldbeleid/grens.js`),
treasury voor ondernemers, een terugstorting naar de eigen bankrekening
(`kern/pay/terug.js`), en een bewijsbord dat drie standen kent en géén groen
(`kern/pay/bewijs.js`). Vier grenzen die niet mogen sneuvelen: er komt geen
tweede boekhouding bij, **uitbetaalbaar hangt altijd aan een bevoegdheid en
nooit aan een boolean** (elke uitbetaalbare klasse noemt haar
`uitbetaalVermogen`), het plafond per wallet is een grond en geen instelling, en
de AI beweegt geen geld. Waarom "voucher" het verkeerde woord was, staat in
paragraaf 1: transactiekosten verdwijnen niet, ze verhuizen naar het
oplaadmoment — en dát is het echte voordeel.

**`ECONOMIE.md` is de laag erboven** -- RTG Economic Control Plane: de financiële
intelligentielaag van het hele ecosysteem, als richtingsdocument met per onderdeel
of het **staat**, **een stap weg** is, **een besluit vraagt** of **jaren weg** is
(zoals PLATFORM.md en DEVELOPERCLOUD.md). Lees die vóór je aan doorbelasten,
werelden of financiële voorspellingen werkt. De kern in één zin: **de RTFoundation
is geen kostenpost van RTG die je over gebruikers uitsmeert, maar een eigen
rechtspersoon met een eigen vermogen** -- en dat wordt afgedwongen en niet
beloofd. Vier economische werelden (`consument`, `commercieel`, `rtg-intern`,
`rtfoundation`) waarvan de wereld een eigenschap is van de IDENTITEIT en niet van
de transactie, met een **firewall** ertussen die standaard weigert
(`kern/economie/firewall.js`): een relatie tussen twee werelden bestaat alleen met
een grondslag én een plafond, het register is standaard leeg, en een weigering
zegt altijd hoe het wel kan. De nota's van de infrastructuur gaan daarom eerst
over de vier werelden en pas daarna binnen elke wereld over haar eigen gebruikers.
Er is een tweede poort die geen relatie kan openen: een rekening landt bij de
ENTITEIT van een wereld, nooit bij een gebruiker ervan -- RTG mag de stichting
factureren, nooit een gezin. Wat er nog niet is (economische graaf, provenance tot
de providerfactuur, periode sluiten, forecast, cost routing) staat in ECONOMIE.md
mét de reden en de stand, niet als lege functie.

**`KOSTEN.md` is de kostprijskant** -- RTG Kostprijs: wat kost elke gebruiker ons,
en wie betaalt dat. WAARDE.md gaat over waarde die BINNEN RTG beweegt; dit gaat
over het geld dat het huis er zelf aan uitgeeft. Lees die vóór je aan tarieven,
verbruik, doorbelasten of "wat kost een gratis account" werkt. De kern in één zin:
**elke euro die dit huis uitgeeft krijgt een eigenaar, of de eerlijke mededeling
dat hij er geen heeft.** Negen kostensoorten (`kern/kosten/soorten.js`) waarvan er
zeven per gebruiker meetbaar zijn en twee niet; stroom en serverhuur worden
verdeeld uit de echte nota met de sleutel erbij en dragen daarom altijd de graad
`vermoed` -- het plafond volgt uit de meetweg en staat níét per regel, want die
tweede plek werd door de toerekening genegeerd. De meter houdt tellers en geen
journaal (een gedragslogboek per lid is voor een factuur niet nodig), de drager
komt uit de async-context die de poort zet (`kern/kosten/haak.js`), en de AI-meter
hangt op de enige plek waar élke modelaanroep langskomt (`server/ai.js`). Drie
grenzen die niet mogen sneuvelen: er staat nooit een getal waar er geen is (geen
tarief of nota = een REDEN, geen nul), deze laag kent geen namen (sessiesleutel,
zaakcode, gezinscode -- nooit de kluis), en de machine zet klaar terwijl een mens
uit de boardroom vrijgeeft. Wie wat betaalt staat in `kern/kosten/beleidkaart.js`:
vier standen, met **RTG Lite en Business Lite er al in en `bestaatNog: false`
erbij**, en met `gezin` en `huis` als beloften die géén schakelaar zijn -- de
RTFoundation blijft gratis voor elk gezin, dat gezin ziet alleen wát het kost
(`/api/foundation/kosten`, alleen de beheerder, en het antwoord opent met de
belofte en niet met het bedrag).

**Let op de terugstortstand (24 augustus 2026).** Of leden hun saldo terugkrijgen
is een schakelaar in de boardroom (`/api/office/bank/terugstorting`), en die
schakelaar *ís* de juridische positie — geen twee dingen die toevallig
samenhangen. `WALLET_SALDO` is daarom geen vaste soort maar **afhankelijk**, met
twee uitgeschreven gezichten in `kern/bevoegdheid/lijst.js`:

| Stand | `WALLET_SALDO` | `LID_UITBETALING` | Wat RTG dan is |
|---|---|---|---|
| `gesloten` | besluit, met grond | bestaat niet | beperkt netwerk, geen vergunning |
| `open` (standaard) | rail, e-geldinstelling | rail, sepa | uitgever van elektronisch geld |

Saldo dat tegen de nominale waarde inwisselbaar is voor de houder ís elektronisch
geld; dat valt niet weg te schrijven. Bouw hier dus nooit een pad omheen dat de
belofte aan leden verandert zonder dat de bevoegdheidsvraag meebeweegt — dan is
de knop een manier om om de vergunningplicht heen te komen. Ontbreekt de stand,
dan geldt per vermogen het strengste gezicht, en dat is niet voor allebei
hetzelfde.

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

**`TENANT.md` is de buitenkant van de bedrijvenkant** — hoe een partner het
Werk OS onder zijn eigen naam gebruikt zonder dat er een tweede platform
ontstaat. Lees die vóór je aan white-label, SSO-inrichting of "enterprise"
werkt. De kern in vier regels: **`org` IS de klant** (de juridische,
beveiligings- en contractgrens), een werkruimtecode is een productinstantie
daarbinnen, een leverancierscode is een relatie en nooit een identiteit, en er
komt geen vijfde begrip bij. Drie grenzen die niet mogen sneuvelen: het merk
van een klant geldt binnen zijn eigen blok (de RTG-schil verft niet mee), de
herkomstregel is in geen enkele modus uit te zetten (wiens software je
personeelsdossier bewaart is een AVG-vraag, geen merkvraag), en een
enterprisebewering op een scherm heeft een bron — daarom weigert de modus
`sovereign` mét de reden in plaats van te bestaan als knop. Levenscyclus,
uitgang, contract, quota, bewijspoort, de commandobalk met een actiebon, de
gevolgsimulatie en SAML staan er inmiddels; wat er nog steeds níét is, staat in
het antwoord van de server als `nietGebouwd` mét de reden en niet als lege
waarde. Dezelfde regel geldt in het klein overal in deze laag: `nietAfgedwongen`
in het contract, `nietGerekend` in een gevolgsimulatie, en een geweigerde modus
die zegt waarom.

**`HORECA.md` is het diepte-document van de horecakant** — RTG Service
Choreography OS. In één zin: **een kassa registreert wat besteld is; RTG
regisseert wat er nú moet gebeuren om de hele tafel op het juiste moment een
goede ervaring te geven.** Eén servicestroom met zes werkstanden (TAFEL, PDA
SERVICE, VLOER, VUUR, BAR, REGIE) op één gedeelde werkelijkheid — en de PDA is
daarvan de belangrijkste, niet de kleinste. Lees vóór je aan een horecascherm of
de keukenlaag werkt vooral de paragraaf *De grenzen*: generatieve AI bepaalt
nooit of iets veilig is om te eten, een gast is een codenaam (geen labels als
"grote spender"), er komt geen ranglijst op medewerkers, het systeem vinkt niets
zelf af, en wat niet gemeten is wordt niet als getal getoond. Daar staat ook wat
er al staat en dus NIET opnieuw gebouwd moet worden — de rekening is al één
waarheid over alle kanalen, en het ontbrekende scharnier is de **stoel**.

**`BESTUUR.md` is het besturingsvlak** — de achterkant van RTG niet als
backoffice maar als één laag waarin een mens ziet wat er draait, of het gezond
is, en **hoe hard dat bewijs is**. Lees die vóór je aan een bestuursscherm, een
meter of een herstelknop werkt. De kern in één zin: *een cockpit die niet kan
zakken, is een dashboard.* Daaruit volgt de huisregel die overal geldt waar dit
huis iets beweert: elke bewering draagt een **bewijsgraad** (onbekend, vermoed,
gemeten, bewezen) met een datum, `niet vast te stellen` is een eersteklas uitslag
naast in orde en storing, en **vervallen bewijs is geen bewijs**. Twee grenzen
die niet mogen sneuvelen: de laag die iets toont, meet het niet (anders zeggen
twee schermen op een dag iets anders over hetzelfde), en toegang van RTG tot de
omgeving van een klant is een **uitnodiging en geen recht** — geen permanent
`admin = true`, ook niet voor ons eigen kantoor. Wat er wel en niet staat, staat
er gemeten bij; wat er nog niet is, staat er mét de grens waarbinnen het gebouwd
moet worden.

**`APPSTORE.md` is het derdenkanaal** — hoe een app van BUITEN dit huis
binnenkomt. Lees die vóór je aan de App Store, aan een uitgever of aan de cel
werkt. De kern in één zin: **een App Store is geen etalage maar een poort met een
cel erachter.** Zes begrippen (uitgever, app, versie, manifest, keuring,
machtiging) en zes grenzen, waarvan er drie niet mogen sneuvelen: derdencode
draait nooit op de RTG-herkomst (een naamloze cel zonder netwerk, en geen vlag
die dat uitzet), de machinepoort keurt nooit goed (hij laat alleen door naar een
mens van RTG, en nooit naar de uitgever zelf), en een machtiging die een lid niet
heeft VERLEEND bestaat niet — het manifest vraagt, het lid geeft. Er zijn er drie,
en alle drie worden ze uitgevoerd; wat er niet is, staat er met de reden. **Een
app mag geld kosten** (besluit van de eigenaar): de prijs staat in het manifest
en gaat dus door dezelfde keuring, kopen gebeurt in de WINKEL en nooit in de app
(GELD.md par. 3: alles wat een derde raakt is maximaal klaarzetten), de btw hoort
in het land van het LID en wordt nooit geraden, de afdracht van RTG staat op 0%
tot de eigenaar hem zet en werkt alleen vooruit, en een ingetrokken gekochte app
laat een teruggaveRECHT achter dat een mens afhandelt — grens 5 blijft absoluut.
Er komt geen tweede geldstroom: alles loopt over RTG Pay. **De
verantwoordingskant staat er ook**: het inkoopdossier (wie is de leverancier, wat
draait er, wat krijgt de app nooit, waar blijven de gegevens, wat vond de poort,
hoe werkt de uitgang) met per bewering een bron in de code, de tijdlijn van het
lid (wat gaf ik, wanneer nam ik het terug — groeit aan, wordt nooit herschreven,
en de sleutel komt uit de sessie), en de controleronde die eruit haalt wat niet
meer byte voor byte klopt met wat een mens aftekende. Twee dingen daar niet
wegpoetsen: het dossier staat bij het LID en niet achter een kantoorpoort, en het
blok "wat dit dossier NIET zegt" staat er even groot bij — een leverancierspak
dat overal ja zegt is niets waard. Het dossier heeft drie lezers en dus drie
ingangen (kaart in de Mall, `/apps/appstore-dossier.html` als adres dat je
doorstuurt, en "wat de klant leest" op het uitgeversbureau) maar blijft één
bron. Diezelfde pagina zonder app is het **kanaaldossier**: wat voor élke app
hier geldt, met de zes machtigingen die met opzet niet bestaan — die vraag stelt
een inkoper maar één keer, en dat kan alleen omdat elke app op dezelfde cel
draait.

**`DEVELOPERCLOUD.md` is de richting boven de App Store** — RTG Developer Cloud:
een ontwikkelaar bouwt hier in dagen wat elders maanden kost, omdat hij auth,
billing, compliance, hosting, permissies, observability en enterprise-controls
niet zelf hoeft te bouwen. Lees die vóór je aan een SDK, een objectmodel of een
ontwikkelaarsvoorziening begint. Het is een richtingsdocument zoals PLATFORM.md:
per onderdeel staat er of het **staat**, **een stap weg** is, **een besluit
vraagt** of **jaren weg** is — zodat niemand die vier voor elkaar aanziet. De
belangrijkste zin staat in paragraaf 2: **een universeel objectmodel moet worden
GEVONDEN in de domeinen, niet eroverheen verklaard** — dat is precies de fout die
de oude super-app-regel al een keer heeft voorkomen. **Die meting is gedaan**
(`scripts/objectmodel.js`, `OBJECTMODEL.json`) en de uitkomst is streng: 71% van
de velden hoort bij precies één domein, en **`Asset` bestaat niet** — tafel,
kamer, podium en leaseauto delen niets buiten hun verpakking. Wat er wél uitkwam
zijn vier kandidaten, waarvan er één de drempel haalt: een **ontwerpopdracht**,
gedeeld door architect, atelier, hardwarelab en studio. Voeg geen type toe dat
niet uit die meting komt.

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

**`WERKRUIMTE.md` is het desktopparadigma** — RTG Desktop is not a collection of
pages, it is a movable operational space. Surfaces met een gouden greep rond een
centrale console, en Context Linking dat alleen een verwijzing rondstuurt.

**`TOEGANKELIJK.md` zegt wat een mens met een handicap hier wel en niet kan** — per soort barrière, met de meting erbij en met de dingen die geen poort ooit ziet. Lees die vóór je iets aan een scherm verandert. De harde poorten (contrast en structuur op nul in beide staten, de springlink, het ondertitelregister, en elk raakvlak minstens 24x24 op telefoonformaat) staan erin met wat ze tegenhouden; daaronder staat per mens waar het ophoudt. De belangrijkste zin is de laatste: er is nog nooit iemand met een handicap door dit huis gelopen, dus alles wat daar staat is gemeten met een browser en niet met een mens.

**`LAT.md` is de technische lat** — negen regels die allemaal uit een fout komen die hier écht is gemaakt, met per regel wat hem handhaaft en waar er alleen op mensen wordt vertrouwd. Lees die vóór je code schrijft of repareert. De belangrijkste twee: repareer de oorzaak en niet het symptoom, en trek elke bewering na met een mutatie (een toets die je niet hebt zien zakken is geen toets). LAT.md gaat over de code, CLAUDE.md over het merk.

## Structuur en starten (kort)

- `public/` — de webroot: `apps/` (portaal, PWA-app, leverancier, backoffice; 141 schermen), `apps/foundation/` (de RTFoundation, 68), `apps/juridisch/` (3), `site/` (alleen `404.html`), `shared/` (i18n, realtime), `fonts/`, `campagne/`, `sw.js` + `manifest.webmanifest` (PWA). **Er is geen `index.html` en geen marketingsite**: wie naar `/` gaat krijgt `/apps/app.html` via een interne herschrijving in `server/middleware/voordeur.js` (bewust geen 302, zodat de nonce-laag er gewoon overheen gaat), en die pagina draagt de inlogpoort zelf. Je komt dus direct bij de inlog
- `server/` — Node/Express-backend: `server.js`, `accounts.js` (identiteitskluis + codenamen), `db.js`/`seed.js`, `data/` (runtime: db.json, rtg.db, sleutels — **staat in .gitignore, nooit committen**)
- Starten: `npm start` (gebruikt `--experimental-sqlite`, vereist Node 22+) → http://localhost:3000
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
- **De progressielaag stopt bij 18+.** Alles wat een prestatie bewaart búiten het potje — highscores, ranglijsten, niveaus, prestaties, toernooien, seizoenen — bestaat alleen voor leden die de 18+-poort halen (`volwassen()`: paspoort-geboortedatum gecontroleerd én 18 of ouder). Onder die grens blijft elk spel volledig speelbaar; er wordt alleen niets van bewaard. De Arena belooft tieners met zoveel woorden "alles telt alleen binnen het potje; er bestaat geen ranglijst", en School houdt vast aan "leren is geen wedstrijd". De grens staat op één plek in de code (`progressieMag` in `server/kern/spellen/grens.js`); nieuwe progressievormen hangen daaraan en krijgen geen eigen kopie van de regel.
- Geen nieuwe kleuren of fonts zonder de merkregels hierboven te checken
- `server/data/` (database, sleutels) en `.env` nooit committen
- Bij CSS-zoek-vervang: daarna clamp()/calc()-waarden en brace-balans controleren (eerder misgegaan)

## Workflow-voorkeur

Bij twijfel over een designkeuze: klein en omkeerbaar voorstellen, niet meteen hele bestanden herschrijven. Laat zien wat er verandert voordat je doorpakt naar de volgende pagina.

**Vragen stellen doe je met meerkeuze.** Moet je iets weten, stel dan geen open vraag maar geef opties waar je uit kunt kiezen, met per optie wat het betekent en wat het kost. Zet je eigen aanbeveling vooraan. Dat scheelt heen-en-weer en maakt zichtbaar welke keuzes er werkelijk zijn.
