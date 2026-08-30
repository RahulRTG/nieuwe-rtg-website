# Alle functies van Rahul Travel Group

Eén overzicht van wat dit platform kan. Niet met de hand opgeschreven maar
afgelezen uit de bron, want een met de hand bijgehouden functielijst loopt
binnen een week uit de pas met de code:

- de functieschakelaars uit `server/functies/register/` (het techniekbord),
- de app-catalogus uit `server/kern/appcatalogus-data.js`,
- het genre-register uit `server/seed/genres-lijst.js`.

`README.md` blijft de technische documentatie, `PLATFORM.md` de richting,
`ARCHITECTUUR.md` de plattegrond. Dit bestand beantwoordt één vraag: **wat kan
het?**

## In getallen

| | |
|---|---|
| Functieschakelaars (aan/uit per functie) | **204** in 17 categorieën |
| Apps in de leden-catalogus | **84** in 8 categorieën |
| Bedrijfsgenres | **73** in 26 sectoren |
| Genre-caps (waar de apps op sturen) | **40** |
| API-routes (uit de router) | **4738** |
| Kernmodules (`server/kern/**`) | **1800** |
| App-pagina's (`public/apps/**.html`) | **276** |
| Testbestanden | **1426** |

## De vier werelden

Het is één systeem met vier soorten gebruikers, en elke functie noemt zelf voor
wie zij bedoeld is:

1. **Leden** — drie passen. **RTG Pass** (instap, na de AI-ballotage, volledig
   AI-gedreven contact), **Lifestyle Pass** (alleen op uitnodiging of na
   menselijke goedkeuring; het Privékantoor en een menselijke concierge) en
   **Business Pass** (op maat, geen vaste maandprijs — `kern/pasprijs.js` geeft
   daar bewust `null` en niet nul). Plus **gast**: het partnerkanaal voor
   niet-leden.
2. **Partners (leveranciers)** — één app die zich naar het genre voegt.
3. **Personeel** — één PDA die zich naar functie en zaak voegt.
4. **RTFoundation** — de gratis onderwijs- en gezinskant; 30% van de bijdragen
   gaat daarheen.

Daarnaast **intern**: de RTG-backoffice en het techniekbord.

## Hoe een functie aan- en uitgaat

Elke functie hieronder is een echte schakelaar in de backoffice, geen label.
Zij bewaakt één of meer pad-prefixen (`/api/member/dm`), en een verzoek wordt
getoetst aan de **meest specifieke** functie die op het pad past. Naast de
globale stand kan zij gericht uit voor een **pas**, een **land** of een
**persoon**. Alles staat standaard aan; elke expliciete `false` op welke as dan
ook blokkeert.

---

# 1. De 204 functieschakelaars

### Leden (RTG-app) — 21

- **Leden-app (algemeen)** (`member`) — Alle ledenfuncties in de RTG-app. Zet je dit uit, dan valt de hele ledenkant stil (behalve wat hieronder apart aan staat).  
  _voor: rtg, lifestyle, business, gast_
- **Directe berichten (DM)** (`member-dm`) — Privéberichten tussen leden onderling.  
  _voor: rtg, lifestyle, business_
- **Snaps & 24-uurs verhalen** (`member-snaps`) — Foto-snaps en verhalen die na 24 uur verdwijnen.  
  _voor: rtg, lifestyle, business_
- **Vrienden verbinden** (`member-connect`) — Vriendschapsverzoeken en de vriendengraaf tussen leden: zoeken op codenaam, of toevoegen met de eigen contactpin (ook als QR).  
  _voor: rtg, lifestyle, business_
- **Vacatures & solliciteren (leden)** (`member-werk`) — Leden solliciteren met hun cv op vacatures bij partners.  
  _voor: rtg, lifestyle, business_
- **De Rechterhand (Lifestyle-suite)** (`rechterhand`) — De veertien premium-apps van de Lifestyle Pass: Reisboek, Cellier, Table, Maison, Garde-robe, Mecenaat, Nalatenschap, Logboek, Cercle, Hangar, Entourage, Attenties en Rendez-vous. Uit = de hele suite is dicht; de rest van de ledenapp blijft draaien.  
  _voor: lifestyle, business_
- **RTG Zakelijk (professioneel netwerk)** (`zakelijk`) — De LinkedIn-laag van de Lifestyle en Business Pass: zakelijk profiel, gids, verbinden, feed, aanbevelingen en het kansenbord.  
  _voor: lifestyle, business_
- **RTG Wereld (de ene sociale app)** (`wereld`) — De laag over De Salon, Pulse, RTG Zakelijk, de genootschappen en de verhalen heen: één tijdlijn met een schakelaar (Alles, Lifestyle, Business, Communities, Privé) en de sprong naar de berichten-app. Uit zetten laat de vijf onderliggende apps gewoon staan; alleen de verbindende laag verdwijnt -- net als bij de Media OS.  
  _voor: rtg, lifestyle, business_
- **Het Privékantoor (Lifestyle)** (`privekantoor`) — De ene app van de Lifestyle Pass: de levensgraaf over de premium-apps heen, de Control Tower met alle termijnen, het mandaat (wat mag het kantoor zelf) en zaken met een team en een tijdlijn. Uit zetten laat de onderliggende apps staan; alleen de samenhang verdwijnt.  
  _voor: lifestyle, business_
- **De app-staat** (`kern-state`) — De ene aanroep waarmee de app zijn hele beeld ophaalt. Uit betekent een lege app voor iedereen.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **De live-verbinding** (`kern-live`) — De open lijn (SSE) waarover meldingen en verversingen binnenkomen, plus de verbindingsgegevens voor bellen.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Meldingen en push** (`kern-meldingen`) — De meldingen in de app, de voorkeuren daarvoor en de push naar het toestel.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Berichten en gesprekken** (`kern-berichten`) — De chat met de concierge, prive-berichten op codenaam en de groepsklets.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Communicatieplatform** (`kern-comm`) — Het ene gespreksmodel: de inbox met al zijn laden, threads, reacties, zoeken over alles, en @Rahul die opstelt maar nooit verstuurt. Ook de gesprekken die modules aanmaken (een rit, een bestelling) lopen hierlangs.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Taal en vertaling** (`kern-taal`) — De talenlijst en het vertalen van schermteksten en berichten.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Locatie delen** (`kern-locatie`) — Het delen van de eigen positie onderweg, en het stoppen daarvan.  
  _voor: rtg, lifestyle, business_
- **Klok, timer en wekker** (`kern-klok`) — De klok-app met timers en wekkers.  
  _voor: rtg, lifestyle, business, foundation_
- **Memo en samenvatten** (`kern-memo`) — De memo-app en de samenvatting van een opname of transcript.  
  _voor: rtg, lifestyle, business_
- **Rahul (de assistent)** (`kern-rahul`) — De assistent zelf: zijn stemming, zijn blik op een scherm en de bibliotheekhulp.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **App-gids en uitleg** (`kern-gids`) — De gids die per scherm uitlegt wat je er kunt doen.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Waarderen en reageren** (`kern-waardering`) — Likes, reacties, reviews en favorieten door het hele platform.  
  _voor: rtg, lifestyle, business, gast_

### Genres & diensten — 10

- **Bestellen & bezorgen** (`bestellen`) — Bestellen bij een zaak (ophalen of laten bezorgen) met live volgen.  
  _voor: rtg, lifestyle, business, gast_
- **Tickets & activiteiten** (`tickets`) — Tickets kopen met tijdslot en een oplichtende entreecode.  
  _voor: rtg, lifestyle, business, gast_
- **Autoverhuur** (`verhuur`) — Auto huren met foto's voor/na, borg, SOS-knop en live locatie.  
  _voor: rtg, lifestyle, business_
- **Boten & jachten (charter)** (`charter`) — Vaartuigen charteren met schipper, borg, SOS op zee en live positie.  
  _voor: rtg, lifestyle, business_
- **Vastgoed** (`vastgoed`) — Panden bekijken, interesse tonen of bieden en keyless bezichtigen.  
  _voor: rtg, lifestyle, business_
- **Mode & retail** (`retail`) — De modecatalogus: wishlist, apart leggen en de paskamer.  
  _voor: rtg, lifestyle, business_
- **Onderweg (live locatie)** (`onderweg`) — Het live onderweg-scherm: positie, ETA en verbonden partners.  
  _voor: rtg, lifestyle, business_
- **Contracten (leden tekenen)** (`contracten`) — Digitale contracten die een lid in de app ondertekent.  
  _voor: rtg, lifestyle, business_
- **Groothandel & markt** (`groothandel`) — De brede B2B/B2C-marktplaats: horeca koopt in, leden bestellen boodschappen, met AI-bijbestellen. Elke groothandel zet zijn eigen functies aan/uit.  
  _voor: rtg, lifestyle, business, leverancier_
- **RTG Commerce (mand & retour)** (`commerce`) — De verkooplaag boven de domeinen: wat er te koop staat en wat NIET met de reden erbij, een mand over verkopers heen met een afrekening per verkoper, de overdracht naar de deur die bevestigt, en de weg terug. RTG bevestigt hier zelf niets.  
  _voor: rtg, lifestyle, business_

### Sociaal (De Salon) — 4

- **De Salon (feed, volgen, deals)** (`salon`) — De Salon-tijdlijn: partner-posts volgen, aanbiedingen claimen, polls en de etalage.  
  _voor: rtg, lifestyle, business, gast_
- **Salon-ontmoetingen (in de buurt)** (`ontmoetingen`) — Wederzijdse connecties die vlakbij zijn spreken veilig af (18+, geverifieerd), met contract, live-locatie naar RTG en SOS.  
  _voor: rtg, lifestyle, business_
- **Sociale laag (RTG + RTF)** (`social`) — De gedeelde sociale laag: zoeken, verbinden, DM, snaps, verhalen en bellen op codenaam. De kinderbescherming (t/m 15 gesloten) blijft altijd gelden.  
  _voor: rtg, lifestyle, business, foundation_
- **RTF contacten & familiekoppeling** (`rtf-contacten`) — De contactenlaag van de RTFoundation: gezinnen koppelen, kanalen en meldingen tussen leden.  
  _voor: rtg, lifestyle, business, foundation_

### Eigen apps — 34

- **Spelen (spellen met vrienden)** (`spellen`) — Alle spellen: schaken, dammen, rummi, Magnaat, sudoku en de partyspellen.  
  _voor: rtg, lifestyle, business, foundation_
- **RTG Podium (live, in zones)** (`podium`) — Live uitzenden op één motor, in gescheiden werelden: Live (open voor leden), Creator (abonnement en cadeaus), Events (op een kaartje), Besloten (op uitnodiging) en 18+ (geverifieerd paspoort, eigen lijst en eigen wachtrij bij het kantoor). De 18+-eis geldt onverkort in die zone, en die zone heeft een eigen index: hij komt nergens anders voorbij.  
  _voor: rtg, lifestyle, business_
- **RTG Theater (video)** (`theater`) — De videobibliotheek op bioscoopniveau, inclusief het Thuisarchief (P2P).  
  _voor: rtg, lifestyle, business_
- **RTG Flits (rijscherm)** (`flits`) — Het rijscherm met meldingen uit het eigen netwerk (flitser, file, ongeval) en de vooruitblik. Op de PDA standaard alleen voor rijdende genres.  
  _voor: rtg, lifestyle, business, personeel_
- **RTG OV (reizen)** (`ov`) — Alle vervoer in een app: de kaart, twee snelle check-ins, de dienst-PDA en de routetekenaar. De zaak-kant is alleen voor OV-zaken.  
  _voor: rtg, lifestyle, business, leverancier, personeel_
- **RTG Vervoer (Mobility OS)** (`mobiliteit`) — De vervoerskern: een rit aanvragen en volgen, de vloot en de dispatch van een vervoerder, en de bedrijfspendel. WELK vervoer er in een stad bestaat staat los hiervan, in het vervoersmoduleregister (backoffice); deze schakelaar zet de hele app aan of uit.  
  _voor: rtg, lifestyle, business, leverancier, personeel_
- **Wie betaalt wat** (`wbw`) — Groepsuitgaven met een live balans en verrekenen via RTG Pay.  
  _voor: rtg, lifestyle, business_
- **RTG Geld (financieel besturingssysteem)** (`geldwereld`) — Het command center over alle gelddomeinen: hoe u ervoor staat, wat eraan komt, uw eigen beleidsregels met reserveringspotten, het actielog en de gegronde Rahul. Uit = het overzicht en de regels verdwijnen; betalen en verrekenen blijven werken via hun eigen schakelaars.  
  _voor: rtg, lifestyle, business_
- **RTFoundation (levenslijn, mentor en levenspas)** (`levenos`) — De levenslijn met wat er speelt en wat eraan komt, de mentor die opent en nooit stuurt, en de levenspas: wie mag wat van u zien. De eerste twee lezen alleen; uitzetten verwijdert daar geen enkel gegeven. De levenspas beheert wel iets, namelijk uw TOESTEMMING -- uitzetten bevriest die dus: bestaande banden blijven staan zoals ze zijn, maar niemand kan er meer een leggen, verbreken of intrekken.  
  _voor: rtg, lifestyle, business, foundation_
- **RTG Sociaal (de kring op een plek)** (`socialewereld`) — De samenhanglaag over De Salon, berichten, pulse en de ontmoetingen: wat er tussen u en uw kring speelt. De onderliggende apps hebben hun eigen schakelaars.  
  _voor: rtg, lifestyle, business_
- **RTG Office (kantoorpakket)** (`kantoorpakket`) — Het eigen kantoorpakket: tekstdocumenten en rekenbladen op uw account, alleen-lezen te delen op codenaam.  
  _voor: rtg, lifestyle, business_
- **RTG Ondernemers-OS** (`ondernemersos`) — Van "ik denk erover na" tot een draaiend bedrijf in een scherm: de verkenning en de stress test, de rechtsvorm en het oprichtingsproject, het dagbeeld met debiteuren, btw, kas en capaciteit, de verkooppijplijn en het bestuur met de UBO-afleiding.  
  _voor: rtg, lifestyle, business_
- **RTG Vonk (dating)** (`vonk`) — Dating op codenaam met de Salon-veiligheidslat: 18+, geverifieerd paspoort, een eindige dagselectie, en bij een match automatisch een tafel rond het midden van beide woonplaatsen (EUR 10 p.p., waarvan EUR 5 voor RTG).  
  _voor: rtg, lifestyle, business_
- **RTG Media (één mediawereld)** (`mediaos`) — De laag die Klankwerk, Theater, Clips en Podium tot één wereld maakt: drie standen (muziek, kijk, flow) op dezelfde catalogus, één makersprofiel, één volgrelatie, één bibliotheek en de eigen smaakregelaars. Zet u hem uit, dan blijven de vier apps eronder gewoon werken.  
  _voor: rtg, lifestyle, business_
- **RTG Clips (korte video’s)** (`clips`) — Korte verticale video’s die alleen op het toestel van de maker staan (OPFS); kijken is rechtstreeks P2P. De feed is een eindige dagselectie, bewust zonder oneindige scroll.  
  _voor: rtg, lifestyle, business_
- **RTG Eye (werkvloer-camera)** (`oog`) — De camerablik van de werkvloer: voertuigschouw en het handsfree uitgifteregister. Standaard voor genres met voertuigen of voorraad; de boardroom kan per genre bijsturen.  
  _voor: leverancier, personeel_
- **Ghost Driver (simulatie)** (`ghost`) — De voorspellende verkeers- en logistieksimulatie. Standaard alleen voor vervoerders; de verkeersleiding (kantoor) ziet altijd alles.  
  _voor: leverancier, intern_
- **RTG Hospitality Guest OS (de gastkant)** (`gastos`) — Bestellen vanaf je eigen telefoon: aan tafel via de QR, op je hotelkamer op de gastrekening, in de club op je polsband, en van huis uit laten bezorgen, afhalen of een foodcourt-mandje bij meer loketten. Dezelfde rekening die de bediening ziet; dit zet de gastdeur open of dicht, niet het horecasysteem van de zaak.  
  _voor: rtg, lifestyle, business, gast_
- **RTG Evening OS (een avond plannen)** (`avondos`) — Een hele avond als plan: eten, iets drinken en de rit naar huis, binnen je budget en op tijd thuis. Elke stap wijst naar een echte boeking in zijn eigen domein en draagt zijn eigen staat; een tafel wordt aangevraagd en nooit door de planner bevestigd. Hier zit ook de Hospitality DNA: wat een zaak van je te zien krijgt, per soort en per zaak.  
  _voor: rtg, lifestyle, business_
- **RTG Invisible Arrival** (`arrival`) — Een beveiligde aankomstpas voor reservering, capaciteitscontrole en minimale live aankomststatus.  
  _voor: rtg, lifestyle, business, gast_
- **RTG Het Vooruitzicht (scenario- en eventlaag)** (`instantreality`) — De persoonlijke scenario- en eventlaag waarmee een lid een toekomstige ervaring veilig kan verkennen: intenties, drie werelden, providerbewijs en herstel bij een verstoring.  
  _voor: rtg, lifestyle, business_
- **RTG One** (`rtgone`) — De bestuurlijke regielaag voor intenties, beloften, overdracht, goedkeuringen, projecten en herstelbare automatisering.  
  _voor: intern_
- **RTG Life (het ene scherm)** (`life`) — Het overzichtsscherm en de dagcoach: ze lezen de lagen hieronder en leggen ze naast elkaar. Ze meten zelf niets en bezitten niets, dus uitzetten haalt geen gegevens weg.  
  _voor: rtg, lifestyle, business_
- **Doelen** (`doelen`) — Waar u begon, waar u heen wilt en waarom; de mijlpalen worden afgeleid en niet bewaard.  
  _voor: rtg, lifestyle, business_
- **Dagmetingen en toestellen** (`dagmetingen`) — Slaap, beweging, water en gewicht, zelf ingevuld of door een gekoppeld toestel weggeschreven. Zet u dit uit, dan kunt u ook geen nieuw toestel meer koppelen.  
  _voor: rtg, lifestyle, business_
- **Dagcheck-in (hoe zit u erbij)** (`gemoed`) — Een tik per dag, met de keuze om er iets bij te schrijven. Wat u schrijft gaat door de grens uit kern/zorgniveau.js.  
  _voor: rtg, lifestyle, business_
- **Gewoonten** (`gewoonten`) — Kleine dingen die u vaker wilt doen; de dagenteller staat uit tot u hem zelf aanzet.  
  _voor: rtg, lifestyle, business_
- **Gedachtenboek** (`gedachten`) — Opschrijven voor uzelf. Er leest geen model mee en er wordt niets samengevat.  
  _voor: rtg, lifestyle, business_
- **Medicijnen (eigen schema)** (`medicijnen`) — Uw eigen medicatieschema en voorraad. RTG bepaalt nooit een dosering en controleert geen combinaties.  
  _voor: rtg, lifestyle, business_
- **Training (eigen schema)** (`training`) — Uw eigen trainingsschema en wat u ervan deed. RTG schrijft geen training voor en rekent geen belasting uit.  
  _voor: rtg, lifestyle, business_
- **Tijdlijn (terugkijken)** (`tijdlijn`) — Wat er in de tijd met u gebeurd is, gelezen uit de lagen die u al had. Legt zelf niets vast, dus uitzetten haalt geen gegevens weg.  
  _voor: rtg, lifestyle, business_
- **Voeding (weekplan)** (`voeding`) — Een weekplan voor wat u wilt eten. Er wordt niets geteld en er komt geen oordeel over wat u eet.  
  _voor: rtg, lifestyle, business_
- **Noodkaart** (`noodkaart`) — Een noodcontact en, als u dat wilt, uw allergenen en middelen. U toont hem zelf; niemand kan hem opvragen.  
  _voor: rtg, lifestyle, business_
- **Verzorging (kapper, barbier, nagels)** (`verzorging`) — De salonagenda vanaf de kant van het lid, op codenaam. Zorg en verzorging staan naast elkaar maar niet door elkaar: hier reist geen zorgprofiel mee.  
  _voor: rtg, lifestyle, business_

### Partners (leveranciers) — 10

- **Partner-app (algemeen)** (`supplier`) — Alle leveranciersfuncties. Uit = partners kunnen niets meer doen (behalve wat hieronder apart aan staat).  
  _voor: leverancier_
- **Kassa (POS)** (`supplier-pos`) — Het kassascherm per sector: afrekenen en RTG-code innen.  
  _voor: leverancier_
- **Partner-Salon (marketing)** (`supplier-salon`) — Het bedrijfsprofiel op De Salon: posts, aanbiedingen, polls en volgers.  
  _voor: leverancier_
- **Events & mise-en-place** (`supplier-events`) — Eventkeuken, menukeuze met allergenen en de mise-en-place-planner.  
  _voor: leverancier_
- **Financiën & AI-boekhouder** (`supplier-finance`) — Dagcijfers, btw per genre/land en de AI-boekhouder van de zaak.  
  _voor: leverancier_
- **Kamers & slimme deuren (hotel)** (`supplier-rooms`) — Hotelkamers, housekeeping en de app-bediende deuren.  
  _voor: leverancier_
- **Ritten & vloot (vervoer)** (`supplier-ride`) — Taxi- en jetritten accepteren en de vloot beheren.  
  _voor: leverancier_
- **Sollicitaties bij partners** (`supplier-apply`) — Vacatures uitzetten en sollicitaties ontvangen bij de partner.  
  _voor: leverancier_
- **Regie: zien & op de lijst zetten** (`zaakregie`) — De stand van de eigen zaak, de zoekbalk erover, het objectdossier en de uitzonderingenrij -- ook op de PDA van de vloer.  
  _voor: leverancier_
- **Regie: rechtzetten & regels** (`zaakregie-beheer`) — Administratieve drift rechtzetten, een ronde terugdraaien, de eigen grenzen zetten en het spoor van de zaak lezen.  
  _voor: leverancier_

### RTG-Backoffice — 7

- **Backoffice (algemeen)** (`office`) — Het RTG-actiecentrum: orders, ritten, prestaties, verificaties en partneraanvragen.  
  _voor: intern_
- **Schoolgoedkeuring (RTF School)** (`office-school`) — Scholen goedkeuren of afwijzen voordat ze personeel en klassen kunnen aanmaken.  
  _voor: intern_
- **Werk OS (werkruimtes)** (`bedrijf`) — De werkplek van een organisatie: leden, rollen, startscherm, projecten, kennis, klanten, service, bouw, contracten, IT en besluiten. Uit = geen enkele werkruimte werkt meer.  
  _voor: intern, business, leverancier, personeel_
- **RTG Command: zien** (`command-zien`) — De puls van alle domeinen, de zoekbalk over alles en het objectdossier met zijn tijdlijn.  
  _voor: intern_
- **RTG Command: doen** (`command-doen`) — De operator, de runbooks en de uitzonderingenrij: herstellen en afhandelen.  
  _voor: intern_
- **RTG Command: besturen** (`command-besturen`) — Beleidsregels zetten, simuleren, agents begrenzen en zware rechten tijdelijk uitdelen.  
  _voor: intern_
- **Tenant Control Plane (white-label)** (`tenant`) — Welke organisatie een werkruimte draait, welk merk zij daar voert, en hoe een groep van haar identiteitsprovider een rol wordt. Uit = de werkruimtes werken door onder de RTG-huisstijl, en een inlog via een provider levert geen rollen meer op.  
  _voor: intern, business_

### RTFoundation — 14

- **RTFoundation-app (onderwijs)** (`foundation`) — De gratis onderwijs-app: live schoolbord, leerling-schrift en de AI-bijleshulp.  
  _voor: foundation_
- **RTF School (scholen & leraren)** (`foundation-school`) — Het schoolkanaal: klassen, rooster, huiswerk, cijfers, ziekmelden en berichten met de leraar.  
  _voor: foundation_
- **Vacatures & solliciteren (RTF)** (`werk-rtf`) — De vacature- en sollicitatielaag binnen de RTFoundation-app.  
  _voor: foundation_
- **Het RTF-kantoor** (`dom-rtfkantoor`) — Het eigen kantoor van de stichting: kamers, clubs en het onderzoekslab.  
  _voor: foundation_
- **Foundation OS** (`dom-rtfos`) — Steden, partnerstichtingen, projecten, vrijwilligers, geld, hulpvragen en verantwoording.  
  _voor: foundation_
- **Het Onderzoekslab** (`dom-lab`) — Projecten, fases, bevindingen en de kennisbank van het lab.  
  _voor: foundation_
- **Het RTF Living Lab** (`dom-livinglab`) — De onderzoekscyclus, de ethieklaag, de bewijsmotor, de apparatuur en de pijplijn naar verandering.  
  _voor: foundation_
- **Living Lab: de bewonerskant** (`dom-livinglab-bewoner`) — Meedoen met een labpas, een onderzoeksvraag aandragen, stemmen en het labpaspoort.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Het labfonds** (`dom-labfonds`) — De financiering van onderzoeksprojecten.  
  _voor: foundation_
- **Samen (stadsraad)** (`dom-samen`) — De gezamenlijke uitslagen en besluiten met stadspartners.  
  _voor: foundation_
- **Klaslokaal (lesmaker)** (`dom-les`) — De live les: klascode, vragen en antwoorden.  
  _voor: foundation_
- **Leerstof** (`dom-leerstof`) — Het lesmateriaal achter het onderwijs.  
  _voor: foundation_
- **Onderwijs (paspoort en ladder)** (`dom-onderwijs`) — Inschrijven, het leerpaspoort en de leerladder.  
  _voor: foundation_
- **Bijles** (`ov-bijles`) — Het bijlesgesprek met de begeleider.  
  _voor: foundation_

### Betalen & verificatie — 5

- **Betaalverkeer** (`betalen`) — Betalingen (demo of Stripe) en de RTG Pay-wallet. Uit = er kan tijdelijk niet betaald worden.  
  _voor: rtg, lifestyle, business, gast_
- **Passkeys (WebAuthn)** (`webauthn`) — Inloggen met vingerafdruk, gezicht of beveiligingssleutel. Wachtwoord-inloggen blijft altijd werken.  
  _voor: rtg, lifestyle, business_
- **Identiteitsverificatie (KYC)** (`verificatie`) — Leden uploaden hun identiteitsbewijs en RTG beoordeelt het.  
  _voor: rtg, lifestyle, business, gast_
- **Paspoort delen (gecontroleerd)** (`paspoort`) — Het toestemmingsgestuurde kanaal waarlangs een partner een identiteit opvraagt (ja/nee, ID-kaart of scan), met melding en weigering voor het lid.  
  _voor: rtg, lifestyle, business, leverancier_
- **Vakbewijs indienen** (`vakbewijs`) — Leden leggen de stukken vast die hun werk vraagt (VOG, BIG-registratie, legitimatiebewijs); RTG tekent af dat het stuk is gezien en beoordeelt de inhoud niet.  
  _voor: rtg, lifestyle, business_

### Personeel & integraties — 3

- **Personeels-app (PDA)** (`staff`) — De personeels-app: rooster, klokken, verlof/ziek, taken, team en de vertrouwenspersoon.  
  _voor: personeel_
- **Wervingslink (in dienst via een link)** (`werving`) — De uitnodigingslink van een werkgever: kijken wie je uitnodigt (openbaar, alleen bedrijfsnaam en functie) en jezelf eraan verbinden met je eigen RTG-account.  
  _voor: intern, business, leverancier, personeel_
- **Rahul doet het (AI-stuur)** (`stuur`) — De AI voert acties uit op elk toegestaan API-pad, met de eigen inlog van wie het vraagt (nooit meer rechten dan de persoon zelf). Geld-acties vragen altijd eerst een bevestiging.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel_

### Diensten (leden) — 23

- **Overheidsloket** (`dom-overheid`) — Belasting, toeslagen, rijbewijs, voertuigen, KVK, uitkeringen, bezwaar, subsidies en waterschap in een loket.  
  _voor: rtg, lifestyle, business_
- **Gemeenteloket** (`dom-gemeente`) — Meldingen, aanvragen en gemeentezaken.  
  _voor: rtg, lifestyle, business_
- **Thuis (verhuur en logeren)** (`dom-thuis`) — Advertenties, reviews en boekingen tussen leden onderling.  
  _voor: rtg, lifestyle, business_
- **Residentie** (`dom-residentie`) — Het woon- en verblijfsdeel van het platform.  
  _voor: rtg, lifestyle, business_
- **Luchtvaart en luchthaven** (`dom-lucht`) — Vluchten, boarding passes en de luchthavendiensten.  
  _voor: rtg, lifestyle, business_
- **Reisbureau** (`dom-reisbureau`) — Reisadvies en het samenstellen van een reis.  
  _voor: rtg, lifestyle, business, gast_
- **Zorg en welzijn** (`dom-care`) — De zorgkant: intakes, begeleiding en welzijnsdiensten.  
  _voor: rtg, lifestyle, business_
- **Agenda** (`dom-agenda`) — De agenda: afspraken, uitnodigingen en planning.  
  _voor: rtg, lifestyle, business, foundation_
- **RTG Meet (vergaderkamers)** (`dom-meet`) — Vergaderkamers op codenaam; beeld en geluid lopen peer-to-peer.  
  _voor: rtg, lifestyle, business_
- **Navigatie** (`dom-nav`) — Routes en navigatie onderweg.  
  _voor: rtg, lifestyle, business_
- **Plaats (aanwezigheid en nadering)** (`dom-plaats`) — Hekken, toestemmingsvensters en waarnemingen; de motor draait op het toestel.  
  _voor: rtg, lifestyle, business_
- **Reizen boeken** (`bk-reizen`) — Het boeken zelf: aanbod, slots, betalen en de eigen boekingen, inclusief het partnerkanaal voor niet-leden.  
  _voor: rtg, lifestyle, business, gast_
- **Verblijf en reserveringen** (`bk-verblijf`) — Verblijf, de deur van een kamer, reserveren en het annuleren daarvan.  
  _voor: rtg, lifestyle, business_
- **Reiswijzer en landeninfo** (`bk-reiswijzer`) — De wijzer met landen, regels en wat je moet weten voor je gaat.  
  _voor: rtg, lifestyle, business, gast_
- **Ritten en transfers** (`bk-ritten`) — Een rit aanvragen en betalen, en de transfer die bij een ticket hoort.  
  _voor: rtg, lifestyle, business_
- **Tickets en evenementen** (`bk-tickets`) — Kaarten kopen, uitgaan, aanmelden voor een evenement en de wachtlijst.  
  _voor: rtg, lifestyle, business_
- **Bezorgen en vracht** (`bk-bezorgen`) — Bezorging van mode en goederen, pakketten en het volgen van vracht.  
  _voor: rtg, lifestyle, business_
- **Foodcourt** (`bk-eten`) — Het foodcourt met de vrije tijdsloten van de zaken.  
  _voor: rtg, lifestyle, business, gast_
- **Stad en zaakdoos** (`ov-stad`) — De stadslaag met bewoners, en de hartslag en metingen van een zaakdoos ter plaatse.  
  _voor: rtg, lifestyle, business_
- **Partneroverzicht** (`ov-suppliers`) — De lijst met aangesloten partners die een lid kan zien.  
  _voor: rtg, lifestyle, business, gast_
- **Zorgprofiel** (`ov-zorgprofiel`) — Het zorgprofiel van een lid: allergieen en wat een zaak moet weten.  
  _voor: rtg, lifestyle, business_
- **Aandacht en voorspellen** (`ov-aandacht`) — De aandachtslaag en de vooruitblik op wat een lid waarschijnlijk nodig heeft.  
  _voor: rtg, lifestyle, business_
- **Sparren en parkeren** (`ov-spar`) — De sparlijst: iets parkeren om er later op terug te komen.  
  _voor: rtg, lifestyle, business_

### Cultuur en gezelschap — 7

- **Het Genootschap** (`dom-genootschap`) — Het besloten genootschap: kringen, bijeenkomsten en beheer.  
  _voor: rtg, lifestyle, business_
- **Sport** (`dom-sport`) — Sportprogramma's, teams en wedstrijden.  
  _voor: rtg, lifestyle, business, foundation_
- **Muziek** (`dom-muziek`) — Van lied tot zaal: maken, uitgeven en beluisteren.  
  _voor: rtg, lifestyle, business, foundation_
- **Galerij** (`dom-galerij`) — De beeldgalerij van leden en partners.  
  _voor: rtg, lifestyle, business_
- **Boeken** (`dom-boeken`) — De bibliotheek en het lezen.  
  _voor: rtg, lifestyle, business, foundation_
- **Fluister** (`dom-fluister`) — De fluisterlijn binnen de sociale laag.  
  _voor: rtg, lifestyle, business_
- **De krant** (`ov-krant`) — De openbare krant: de gids, een uitgave openen en een artikel lezen.  
  _voor: rtg, lifestyle, business, gast_

### Werk (zaken en personeel) — 10

- **De werkvloer** (`dom-werkvloer`) — Tafels, keukenbord en bedieningskaart op de vloer van een zaak.  
  _voor: intern, business, leverancier, personeel_
- **De werkplek** (`dom-werkplek`) — Het persoonlijke werkstation van een medewerker.  
  _voor: intern, business, leverancier, personeel_
- **Metier (vakwerk)** (`dom-metier`) — Het vakwerk van zelfstandigen en ambachtslieden.  
  _voor: intern, business, leverancier, personeel_
- **Vakritmes** (`dom-vak`) — Werkritmes en tijdregistratie per vak.  
  _voor: intern, business, leverancier, personeel_
- **Verkoop** (`dom-verkoop`) — De verkoopkant van een zaak, inclusief proefritten.  
  _voor: intern, business, leverancier, personeel_
- **De zaakdoos** (`dom-doos`) — De doos op locatie: zaakserver, netwerk en updates.  
  _voor: intern, business, leverancier, personeel_
- **Facturen** (`dom-facturen`) — De facturatie van en naar een zaak.  
  _voor: intern, business, leverancier, personeel_
- **Kantoorgesprek** (`ov-kantoorgesprek`) — Het gesprek waarmee een zaak zijn kantoor inricht.  
  _voor: intern, business, leverancier, personeel_
- **Werkmail bezorgen** (`ov-werkmail`) — De bezorging van interne werkmail.  
  _voor: leverancier, personeel_
- **RTG Mail: post van buiten aannemen** (`ov-mail-binnen`) — De buitenpoort die echte e-mail van een vreemde mailserver aanneemt, uitpakt en in het juiste postvak aflevert. Uit betekent: post van buiten komt niet meer binnen.  
  _voor: intern, business, leverancier, personeel_

### Winkel en media — 11

- **De Mall** (`dom-mall`) — De etages en de gids met alle partners.  
  _voor: rtg, lifestyle, business, gast_
- **App Store (apps van derden)** (`dom-appstore`) — De winkelkant van het derdenkanaal: bladeren, installeren, machtigen, kopen en openen in de cel. Zet dit uit en er draait geen enkele app van een derde meer; wat al is toegelaten blijft staan.  
  _voor: rtg, lifestyle, business, gast_
- **App Store: inzenden door uitgevers** (`dom-appstore-uitgever`) — De uitgeverskant: een organisatie vraagt een uitgeversplek aan en zendt een app in. Zet dit uit en er komt niets nieuws binnen, terwijl de winkel gewoon doorloopt.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Bestanden (kluis)** (`dom-bestanden`) — De persoonlijke bestandenkluis.  
  _voor: rtg, lifestyle, business, foundation_
- **Notities** (`dom-notities`) — De notitie-app: losse aantekeningen en lijstjes van een lid.  
  _voor: rtg, lifestyle, business, foundation_
- **Leden-website** (`dom-site`) — De eigen website die een lid of zaak kan bouwen.  
  _voor: rtg, lifestyle, business_
- **Eigen domein (buiten het RTG-web)** (`dom-eigendomein`) — Een eigen adres zoals hotelazur.nl naast hotelazur.rtg. Zet dit aan en een site kan buiten het RTG-web leesbaar worden -- ook voor wie geen lid is.  
  _voor: rtg, lifestyle, business_
- **Media-assets** (`dom-asset`) — Het uitleveren van geuploade media.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Home Kit (slim huis)** (`dom-home`) — De aansturing van apparaten in huis.  
  _voor: rtg, lifestyle, business_
- **Media uitleveren** (`ov-media`) — Het uitleveren van geuploade afbeeldingen en bestanden aan de app.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Browser** (`ov-browser`) — De ingebouwde browser met zijn gids.  
  _voor: rtg, lifestyle, business_

### Identiteit en veiligheid — 5

- **Storingsmelding uit de browser** (`dom-foutmelder`) — Meldt een onafgevangen fout aan het logboek: melding, bestand, regel en pagina. Geen naam, geen codenaam, geen ingetypte tekst.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **RTG iD** (`dom-rtgid`) — De digitale identiteit en het delen daarvan.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Veiligheidsdiensten** (`dom-veiligheid`) — De beveiligingskant voor leden en zaken.  
  _voor: rtg, lifestyle, business_
- **Grensdiensten (KMar)** (`dom-kmar`) — De grens- en documentcontrole bij reizen.  
  _voor: rtg, lifestyle, business_
- **Onboarding** (`dom-onboarding`) — De eerste stappen na aanmelden: profiel compleet maken.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_

### Geld — 29

- **RTG Rekening** (`dom-rekening`) — Saldo, afschriften en betalingen op de eigen rekeninglaag.  
  _voor: rtg, lifestyle, business_
- **Uitgaven-inzichten** (`dom-bank-inzicht`) — Uitgaven per maand en per soort, en het gezamenlijke afschrift.  
  _voor: rtg, lifestyle, business_
- **Vaste-lasten-radar** (`dom-bank-vastelasten`) — Terugkerende afschrijvingen die vanzelf worden herkend.  
  _voor: rtg, lifestyle, business_
- **Spaardoelen** (`dom-bank-spaardoel`) — Een streefbedrag op een spaarrekening, en het wisselgeld erheen vegen.  
  _voor: rtg, lifestyle, business_
- **Rekeningen aanhouden** (`dom-bank-rekening-open`) — Een eigen betaal-, spaar- of zakelijke rekening met een IBAN.  
  _voor: rtg, lifestyle, business_
- **Storten op de rekening** (`dom-bank-storten`) — Geld op de eigen rekening zetten, via de kaart-naad of eigen emissie.  
  _voor: rtg, lifestyle, business_
- **SEPA versturen** (`dom-bank-sepa`) — Een overboeking naar een rekening buiten RTG.  
  _voor: rtg, lifestyle, business_
- **Terugkerende betalingen** (`dom-bank-incasso`) — Een vaste overboeking per week of maand.  
  _voor: rtg, lifestyle, business_
- **Passen en creditcards** (`dom-bank-passen`) — Een betaalpas of creditcard op een rekening, met limiet.  
  _voor: rtg, lifestyle, business_
- **Krediet en leningen** (`dom-bank-krediet`) — Een lening aanvragen en aflossen; rood staan valt hier ook onder.  
  _voor: rtg, lifestyle, business_
- **Zakelijk bankieren** (`dom-bank-zakelijk`) — Bulkbetalingen en de salarisrun vanaf een zakelijke rekening.  
  _voor: business_
- **De AI-bankier** (`dom-bank-advies`) — Rahul kijkt mee met de rekeningen en geeft advies; hij besluit niets.  
  _voor: rtg, lifestyle, business_
- **Wallet** (`dom-wallet`) — De wallet van een lid binnen RTG Pay.  
  _voor: rtg, lifestyle, business, gast_
- **Walletsaldo en betalen binnen RTG** (`dom-pay-wallet`) — Saldo aanhouden, opladen, tikken en betaalverzoeken binnen het gesloten RTG-circuit.  
  _voor: rtg, lifestyle, business, gast_
- **Tegoed voor een ander** (`dom-pay-tegoed`) — Tegoed kopen voor iemand anders, verzilveren met een code, en verlopen tegoed terugnemen.  
  _voor: rtg, lifestyle, business_
- **Tegoed vanuit een zaak** (`dom-pay-tegoed-zaak`) — Een zaak zet tegoed klaar voor personeel of klanten, en neemt verlopen tegoed terug.  
  _voor: leverancier_
- **Saldo terugstorten naar het lid** (`dom-pay-terug`) — Het eigen walletsaldo terugstorten naar de eigen bankrekening.  
  _voor: rtg, lifestyle, business_
- **Vooraf vastzetten aan de kassa** (`dom-pay-vooraf`) — Een zaak zet een maximum vast op de code van een lid (borg, open rekening, ritprijs) en legt later het werkelijke bedrag vast.  
  _voor: leverancier_
- **Partnersaldo uitbetalen** (`dom-partner-uitbetaling`) — Het RTG Pay-saldo van een zaak naar zijn bankrekening sturen.  
  _voor: leverancier_
- **Wat mijn gebruik kost** (`dom-kosten`) — Het lid ziet wat zijn eigen gebruik van RTG kost, met de bewijsgraad erbij, en wie dat betaalt.  
  _voor: rtg, lifestyle, business_
- **Betalen en betaalverzoeken** (`gld-munt`) — Rechtstreeks betalen aan een partner, betaalverzoeken en de betaalopties.  
  _voor: rtg, lifestyle, business, gast_
- **Rekening en facturen** (`gld-rekening`) — De openstaande rekening, het afrekenen daarvan en losse facturen.  
  _voor: rtg, lifestyle, business_
- **Rekening splitsen** (`gld-splitsen`) — Een rekening samen delen en ieders deel betalen.  
  _voor: rtg, lifestyle, business_
- **Cadeaukaarten** (`gld-cadeau`) — Cadeaukaarten kopen en de eigen kaarten bekijken.  
  _voor: rtg, lifestyle, business_
- **Punten en verzilveren** (`gld-punten`) — Gespaarde punten en het verzilveren daarvan naar tegoed.  
  _voor: rtg, lifestyle, business_
- **Pasprijzen en balans** (`gld-prijzen`) — De publieke prijslijst van de passen en het balansoverzicht van een lid.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Commerciele claims en tarieven** (`gld-claims`) — Wat RTG publiek belooft over prijzen, vergoedingen en de sociale afdracht, met per bewering de bron en hoe hard zij is. Voedt de voorwaardenpagina's.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Ledenprijsgarantie melden** (`gld-prijsgarantie`) — Een lid meldt dat het bij de zaak zelf goedkoper zag; de zaak erkent of betwist, en het verschil wordt rechtgezet.  
  _voor: rtg, lifestyle, business_
- **AI-tegoed en bundels** (`gld-aitegoed`) — De stand van het inbegrepen AI-tegoed, wat er bij het plafond gebeurt, en het bijkopen van een bundel.  
  _voor: rtg, lifestyle, business_

### Toegang en identiteit — 8

- **Inloggen en registreren** (`tg-inlog`) — De voordeur: inloggen, uitloggen, registreren en wachtwoord vergeten. Uit betekent dat niemand meer binnenkomt; de eigenaar houdt het techniekbord.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Account en profiel** (`tg-account`) — Het eigen account: rollen, koppelingen en het cv van een lid.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Inloggen via een andere partij (SSO en SCIM)** (`tg-sso`) — De terugkeer van een identiteitsprovider, met de ondertekende state als poort, en de SCIM-deur waarlangs die provider accounts aanmaakt en uitzet.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Pincode en sleutelwoorden** (`tg-pin`) — De algemene pin voor prive-apps en de sleutelwoord-inlog met zijn uitdaging.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Zegel, codes en rechtenbeheer** (`tg-zegel`) — Het RTG-zegel, dynamische codes, scanbare codes en de rechtenlaag op media.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **RTG Link (scannen en capabilities)** (`tg-link`) — De adres- en capabilitylaag: een gescande code duiden, het bedoelingsscherm, tijdelijke capabilities (zoals een vraagcode of een kassacode) en de eigen koppelingenlijst.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **De gegevenspoort** (`tg-gegevens`) — Het gesprek waarin een lid zelf zijn ontbrekende gegevens aanvult, inclusief het opzoeken van een adres bij postcode en huisnummer.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Aanmelden voor een pas** (`tg-aanmeld`) — Het aanmeldgesprek en de aanmeldingen die daaruit volgen; het besluit blijft mensenwerk.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_

### Festival — 3

- **Festival: terrein en poort** (`fs-terrein`) — Het terrein draaien: de poort en de scans, plekken en ruimtes, de dag en het podiumbeeld, en de uitzonderingen die aandacht vragen.  
  _voor: leverancier, personeel_
- **Festival: diensten, artiesten en verkoop** (`fs-werk`) — De organisatie eromheen: roosters en diensten, de rider en het bewijs van een artiest, boekingen, producten en de verkoop.  
  _voor: leverancier, personeel_
- **Festival: uw pas, programma en groep** (`fs-gast`) — De kant van de bezoeker: de eigen pas en edities, het programma met wat er getekend is, en een groep waarvan u zelf de code deelt.  
  _voor: rtg, lifestyle, business, gast_

# 2. De 84 apps in de leden-catalogus

Wat een lid op zijn homescreen kan zetten. De schakelaars hierboven bepalen of
ze werken; dit is wat hij ziet.

### Sociaal & contact — 11

- **RTG Sociaal** `/apps/sociaal.html` — Wat er tussen u en de mensen om u heen speelt -- gesprekken die op antwoord wachten, aanstaande bijeenkomsten, en wat er in uw kring geplaatst is. Praten en plaatsen blijft in de app die het echte werk doet.
- **Berichten** `/apps/comm.html` — Alle gesprekken van het platform op een plek -- mensen, zaken, onderweg, officieel -- met bellen en videobellen in de kop van het gesprek. Rahul vat samen, stelt een antwoord op en haalt de afspraken eruit.
- **De Salon** `/apps/salon.html` — Het besloten sociale netwerk van RTG: zelf plaatsen met foto's en onderwerpen, leden volgen, bewaren en reageren. Rahul schrijft een bijschrift mee en vat de reacties samen.
- **Genootschap** `/apps/genootschap.html` — Besloten groepen met een prikbord, peilingen en bijeenkomsten. Geheim is echt geheim, en er is geen enkele groeitruc.
- **Pulse** `/apps/pulse.html` — De hoogtepunten van vandaag in jouw RTG-wereld, rustig gebundeld, geen eindeloze feed.
- **Cercle** `/apps/cercle.html` — Uw besloten clubs en lidmaatschappen: stad, lidnummer, dresscode, met welke clubs er reciprociteit is en hoeveel gastpassen u nog heeft. Vraag "waar kan ik in Milaan terecht" en u ziet op welk lidmaatschap.
- **Entourage** `/apps/entourage.html` — Uw vaste reisgezelschap: wie u meeneemt, hun band, dieet en documenten met vervaldatum. Stel een gezelschap samen en zie wat er ontbreekt voordat u aan de balie staat.
- **Rendez-vous** `/apps/rendezvous.html` — Besloten introducties voor Lifestyle en Business: waar u tegelijk bent en welk dagdeel u beiden uitkomt, en met Arrange it regelt De Rechterhand de ontmoeting.
- **Vonk** `/apps/vonk.html` — RTG Vonk: zeg wat er echt toe doet (verplicht, sterke voorkeur, leuk meegenomen); hooguit zes mensen per dag, en bij een match kiest u blind uit drie plekken op gelijke reistijd.
- **Attenties** `/apps/attenties.html` — Uw relatiebeheer: per relatie de band, de belangrijke data en hun voorkeuren, plus de giftgeschiedenis zodat u nooit twee keer hetzelfde geeft.
- **Meet** `/apps/meet.html` — Vergaderen op codenaam: kamers met een korte code, scherm delen, en een Vergaderruimte-knop op elke agenda-afspraak. Beeld en geluid lopen peer-to-peer.

### Reizen & verblijf — 13

- **RTG Reizen** `/apps/reizen.html` — Uw komende reis bij elkaar -- vlucht, verblijf, reis en charter -- ongeacht in welke app u hem boekte. Boeken en annuleren blijft in de app die het echte werk doet.
- **Het Huis** `/apps/rtg.html` — Reserveren, boeken en bestellen bij alle partners, alles op codenaam.
- **Verblijven** `/apps/hotels.html` — Hotels, appartementen en villa's met ledenprijzen en keyless toegang.
- **Reisbureau** `/apps/reisbureau.html` — Samengestelde reizen tegen de nettoprijs, met AI-reisadvies in gewone woorden.
- **Mijn Mall** `/apps/mijnmall.html` — Je lijsten, je reismanden en de vragen die je in de Mall hebt uitgezet.
- **Reisboek** `/apps/reisboek.html` — Uw prive-reisdossier: per reis een draaiboek met de heen- en terugreis, de verblijven, de reisdocumenten met geldigheid en een dag-tot-dag-programma.
- **Vluchten** `/apps/vluchten.html` — Vluchten zoeken, boeken en volgen.
- **Hangar** `/apps/hangar.html` — Uw privevliegtuigen en charters: per toestel type, registratie, thuishaven en stoelen, met de vluchten, de vlieguren en de laatst bekende positie.
- **RTG OV** `/apps/ov.html` — Bus, trein, metro, veerboot en taxi in één reisapp, met live GPS en snelle check-in.
- **Navigatie** `/apps/navigatie.html` — Navigeren met de RTG-kaart.
- **Flits** `/apps/flits.html` — Een ingetogen rijscherm met community-meldingen (flitser, file, ongeval) en spraak.
- **Mijn Stad** `/apps/stad.html` — Alles om je heen in het RTG-web, op de kaart van je stad.
- **Maison** `/apps/maison.html` — Huishouden en staf: uw huishoudelijk personeel met rol en contact, de lopende taken met wie en wanneer, en een logboek van wat er in en om huis speelt.

### Eten & uitgaan — 4

- **Food Court** `/apps/foodcourt.html` — Alle restaurants op een rij; reserveren met tijdsloten in een paar tikken.
- **Table** `/apps/table.html` — De prive-diners en events die u zelf geeft: gastenlijst met dieet en voorkeuren, tafelindeling, menu per gang. Herbruikbaar voor de volgende keer.
- **Cellier** `/apps/cellier.html` — Uw wijnkelder: per fles domein, jaargang, aantal, waarde en drinkvenster. Het overzicht wijst aan wat nu op dronk is, met de kelderwaarde. Een fles schenken telt af.
- **Uitgaan** `/apps/uitgaan.html` — Bars, clubs en beachclubs met hun avonden en gastenlijsten.

### Media & creatie — 25

- **RTG Media** `/apps/media.html` — Eén mediawereld over Klankwerk, Theater, Clips en Podium heen: muziek, kijk en flow als drie standen op dezelfde catalogus, met één makersprofiel en uw eigen regelaars in plaats van een algoritme.
- **Camera** `/apps/camera.html` — Fotograferen, plus RTG Eye: voertuigschouw en hands-free werkvloerlog.
- **RTG Sound** `/apps/muziek.html` — Je muziek, rustig en zonder reclame.
- **Theater** `/apps/theater.html` — Videobibliotheek op bioscoopniveau, tot 4K, met kanalen en reacties.
- **Clips** `/apps/clips.html` — Korte video's die lokaal bij de maker blijven; een eindige dagselectie.
- **RTG Klankwerk** `/apps/klankwerk.html` — Zelf muziek maken: een raster, een notenrol en Rahul die iets neerzet. Alles wordt opgewekt, dus alles is van jou.
- **De Zaal** `/apps/zaal.html` — Wat leden zelf gemaakt hebben, op volgorde van wanneer het uitkwam. Geen hitlijst.
- **Podium** `/apps/podium.html` — Je eigen live-kanaal (18+), met chat, RTG Pay-cadeaus en abonnementen.
- **Website-maker** `/apps/sitemaker.html` — Bouw met blokken je eigen RTG-site, met eigen foto's en beeld uit De Salon.
- **RTG Browser** `/apps/browser.html` — Blader door de sites die leden in het RTG-web publiceren.
- **RTG Werk OS** `/apps/werk.html` — De werkplek van een hele organisatie: startscherm per rol, projecten, kennisbank, klanten, servicedesk, bouw, apparaten, contracten en besluiten. Wat niet gemeten wordt, staat er als niet gemeten en niet als nul.
- **RTG Kantoor** `/apps/kantoor.html` — Uw werkdag bij elkaar -- afspraken, open taken, documenten en gedeelde bestanden -- ongeacht in welke app ze leven. Maken en wijzigen blijft in de app die het echte werk doet.
- **RTG Office** `/apps/office.html` — Tekst en rekenblad met autosave, delen op codenaam en export.
- **Agenda** `/apps/agenda.html` — Maand, week en lijst; uitnodigen op codenaam, herinneringen, en je RTG-boekingen staan er vanzelf in.
- **Notities & Taken** `/apps/notities.html` — Notities en lijstjes met vinkjes; delen op codenaam is samen werken, en een datum wordt vanzelf een agenda-afspraak.
- **Bestanden** `/apps/bestanden.html` — De versleutelde kluis: mappen, versies, delen op codenaam en een prullenbak die 30 dagen bewaart. Je Office-werk staat er vanzelf bij.
- **Galerij** `/apps/galerij.html` — Al je beelden op een plek: tijdlijn per maand, albums en favorieten. Leest De Salon en Bestanden; niets dubbel, geen gezichtsherkenning.
- **Gereedschap** `/apps/gereedschap.html` — Rekenmachine (met btw en rekening delen), wekkers en timers die op de server aftellen, stopwatch en wereldklok. Rahul zet ze ook voor je.
- **Vertaler** `/apps/vertaler.html` — Typen of spreken, live vertalen, voorlezen en reiszinnen per situatie. Geschiedenis blijft op het toestel; zonder AI-sleutel vertaalt het huiswoordenboek eerlijk.
- **Memo** `/apps/memo.html` — Spraakmemo's opnemen; de audio staat als gewoon bestand in je Bestanden-kluis. Het toestel luistert mee voor een transcript en Rahul vat samen als jij dat vraagt.
- **Scanner** `/apps/scanner.html` — Documenten vastleggen met de camera of uit je foto's, documentmodus voor leesbaar papier, en bewaren als PDF of losse foto's in je Bestanden-kluis.
- **Boeken** `/apps/boeken.html` — De huisbibliotheek plus je eigen tekstbestanden uit de kluis, met een rustige lezer. Alleen je leesplek reist mee; geen leesdoelen, geen reeksen.
- **RTG Krant** `/apps/krant.html` — De kiosk: de kranten die nieuwsbedrijven binnen RTG uitgeven, elk in de eigen huisstijl.
- **Nieuws** `/apps/nieuws.html` — RTG Nieuws per rubriek, met wat je later wilt lezen bewaard.
- **Garde-robe** `/apps/garderobe.html` — Uw digitale garderobe: per stuk type, merk, kleur, maat en waar het hangt -- welke woning, welke kast. Plus uw vaklui: kleermaker, schoenmaker, stomerij.

### Geld & werk — 8

- **Métier** `/apps/geld.html#metier` — Je beroepsprofiel op codenaam, met de rollen die RTG zelf heeft bevestigd. Je naam geef je per werkgever vrij, en je trekt hem net zo makkelijk weer in.
- **Wie betaalt wat** `/apps/geld.html#wbw` — Groepsuitgaven met live balans en verrekenen via RTG Pay.
- **Balans** `/apps/geld.html#balans` — Je saldo en tikgeschiedenis in één overzicht.
- **RTG-code** `/apps/geld.html#rtgcode` — Je betaal- en toegangscodes veilig op één plek.
- **Logboek** `/apps/geld.html#logboek` — Het onderhoudsboek van uw jacht, jet, oldtimer of ander kostbaar bezit: keuringen, servicebeurten, reparaties en verzekeringen met datum, kosten en wanneer het weer aan de beurt is.
- **Mecenaat** `/apps/geld.html#mecenaat` — Uw filantropie op orde: per gift het doel, het thema, het bedrag, en of het een toezegging is of al betaald. Het overzicht toont wat er via de RTFoundation loopt.
- **Lab-fonds** `/apps/geld.html#labfonds` — Steun het RTG-onderzoekslab en volg waar je bijdrage heen gaat.
- **Nalatenschap** `/apps/geld.html#nalatenschap` — Een discreet, versleuteld dossier voor later: welke documenten er zijn en waar ze liggen, uw vertrouwenspersonen, en uw persoonlijke wensen.

### Spelen & sport — 2

- **Spelen** `/apps/spelen.html` — Dammen, rummikub, Magnaat, partyspellen, sudoku en meer, samen of alleen.
- **Sport** `/apps/sport.html` — Je sportactiviteiten en clubs.

### Veiligheid & identiteit — 4

- **RTG Veilig** `/apps/veilig.html` — Thuiswacht, Codewoord, Vitaal en Thuisrust in een app: zeggen hoe lang je onderweg bent, je kring stil waarschuwen, dagelijks laten weten dat het goed gaat, en stil zijn zonder onbereikbaar te worden. De klok tikt op de server, dus het werkt ook als je telefoon uitvalt.
- **Wie ben ik** `/apps/ik.html` — Wat Rahul over je mag weten: hoe hij tegen je doet, je voornaamwoorden en je eigen geloofskeuze. Alles optioneel.
- **Passkeys** `/apps/passkeys.html` — Inloggen met vingerafdruk, gezicht of een fysieke sleutel.
- **Juridisch** `/apps/juridisch.html` — Voorwaarden, contracten en je eigen akkoorden.

### RTFoundation (gratis) — 17

- **RTFoundation** `/apps/foundation/index.html` — Gratis hulp voor je gezin: alles wat de RTFoundation biedt op één plek.
- **Vrienden** `/apps/foundation/vrienden.html` — Vrienden, snaps en 24-uursverhalen, veilig en op codenaam.
- **Leren** `/apps/foundation/leren.html` — Oefenen, overhoren en samen leren.
- **School** `/apps/foundation/school.html` — Klas, rooster, huiswerk en cijfers voor het hele gezin.
- **Toetsen** `/apps/foundation/toetsen.html` — De toetsplanner voor tieners.
- **Zakgeld** `/apps/foundation/zakgeld.html` — Het zakgeldpotje, samen bijgehouden.
- **Babyboek** `/apps/foundation/babyboek.html` — Het fotoboekje en de eerste momenten, met AI die de mooie zinnen schrijft.
- **Gezondheid** `/apps/foundation/gezondheid.html` — Het gezinsgezondheidsboekje.
- **Veilig** `/apps/foundation/veilig.html` — Hulp bij online veiligheid voor kinderen en ouders.
- **Pesten** `/apps/foundation/pesten.html` — Steun en een luisterend oor bij pesten.
- **Kompas** `/apps/foundation/kompas.html` — Het tienerkompas: koers houden in een druk hoofd.
- **Schrijven** `/apps/foundation/schrijven.html` — Samen verhalen maken en schrijven.
- **Projecten** `/apps/foundation/projecten.html` — Werkstukken en groepswerk begeleiden.
- **Markt** `/apps/foundation/markt.html` — Ruilen en delen in de buurt.
- **Rust** `/apps/foundation/rust.html` — Even tot jezelf komen; een rustige plek in de app.
- **RTF-Bibliotheek** `/apps/foundation/bieb.html` — Gratis kind- en gezinsapps van de RTFoundation.
- **Geloof & Wijsheid** `/apps/foundation/geloofbieb.html` — De Geloof & Wijsheid-Bibliotheek: alle tradities als gelijken, met echte leesbare teksten.

# 3. De 73 genres in 26 sectoren

Er is **één** partner-app en **één** personeels-PDA. Welke schermen een zaak
krijgt volgt niet uit zijn genre maar uit zijn *genre-caps*: een hotel en een
appartement delen `bookings`, een restaurant en een beachclub delen `menu`. Dat
is de reden dat er geen 130 losse apps zijn.

- **agriculture** (1) — Boerderij & landbouw (`boerderij`)
- **automotive** (1) — Autogarage & werkplaats (`autogarage`)
- **aviation** (3) — Privéjet (`jet`), Helikopter transfers (`helikopter`), Luchthaven (`luchthaven`)
- **beauty** (3) — Beauty-salon & barbier (`beautysalon`), Beauty medical (`beautymedical`), Wellness & spa (`wellness`)
- **childcare** (1) — Kinderopvang & nanny (`kinderopvang`)
- **construction** (6) — Bouw & installatie (`bouw`), Vakwerk & klussen (`vakwerk`), Schoonmaak & huishouden (`schoonmaak`), Hovenier & tuinen (`hovenier`), Wasserij & stomerij (`wasserij`), Verhuisservice (`verhuizer`)
- **education** (1) — Rijschool (`rijschool`)
- **events** (5) — Events & festivals (`events`), Activiteiten & musea (`activiteit`), Activiteiten & excursies (`activiteiten`), Kunst & galerie (`galerie`), Weddings & prive-events (`weddingplanner`)
- **facility** (1) — Kantoorgebouw (RTG Enterprise) (`kantoorgebouw`)
- **government** (2) — Gemeente & overheid (`gemeente`), Rijksoverheid (`rijk`)
- **healthcare** (6) — Zorg & welzijn (`zorg`), Zorg aan huis (`care`), Ziekenhuis (`ziekenhuis`), Huisarts (`huisarts`), Medisch specialist (`specialist`), Tandartspraktijk (`tandarts`)
- **horeca** (6) — Restaurant (`restaurant`), Bar (`bar`), Club (`club`), Beachclub (`beachclub`), Koffie & patisserie (`koffie`), Privéchef & catering (`chef`)
- **hospitality** (4) — Hotel (`hotel`), Appartement (`apartment`), Villa's & fincas (`villa`), Wintersport & seizoensresort (`wintersport`)
- **insurance** (1) — Verzekeringen (advies) (`verzekeringen`)
- **maritime** (2) — Boten & jachten (`charter`), Marina & jachthaven (`marina`)
- **media** (3) — Journalistiek (`journalistiek`), Content creator (`creator`), Fotografie & film (`fotograaf`)
- **mobility** (6) — Taxi (`taxi`), Autoverhuur (`verhuur`), Tweewielers & quads (`tweewielers`), Vervoer & transfers (`vervoer`), Openbaar vervoer (`ov`), Vracht & expeditie (`vracht`)
- **pharmacy** (1) — Apotheek (`apotheek`)
- **professional** (2) — Professionele diensten (`professioneel`), Zelfstandig professional (`zzp`)
- **realestate** (1) — Vastgoed & makelaar (`vastgoed`)
- **retail** (3) — Mode & retail (`retail`), Modehuis & atelier (`modehuis`), Juwelier & horloges (`juwelier`)
- **safety** (7) — Politie (`politie`), Brandweer (`brandweer`), Ambulance (`ambulance`), Marechaussee (`marechaussee`), Defensie (`defensie`), Special Forces (`specials`), Beveiliging & security (`beveiliging`)
- **sports** (3) — Sportclub (`sportclub`), Golf & countryclub (`golfclub`), Sport & fitnessclub (`fitnessclub`)
- **technology** (1) — IT-hulp aan huis (`ithulp`)
- **veterinary** (2) — Dierenartspraktijk (`dierenarts`), Petcare & pension (`petcare`)
- **wholesale** (1) — Groothandel & markt (`groothandel`)

De 40 genre-caps waar de apps naar kijken (nooit naar het genre zelf):

`advies`, `alpine`, `beauty`, `beveiliging`, `bezorgen`, `boerderij`, `bookings`, `care`, `charter`, `creator`, `doors`, `fitclub`, `fleet`, `gebouw`, `gemeente`, `golf`, `groothandel`, `huur`, `location`, `luchthaven`, `marechaussee`, `marina`, `menu`, `opvang`, `orders`, `ov`, `petcare`, `polis`, `pricing`, `redactie`, `reservations`, `retail`, `rides`, `rijk`, `services`, `sportclub`, `tickets`, `vastgoed`, `vracht`, `weddings`

# 4. De lagen die overal doorheen lopen

Deze staan in geen enkele categorie omdat ze onder alles liggen.

## Privacy by design: codenamen

Het hele platform draait op **codenamen**. Echte namen staan in een gescheiden
identiteitskluis (`server/accounts.js`); een zaak, een chat, een boeking of een
vergaderkamer ziet een codenaam. Ook het salongesprek tussen twee AI's krijgt
verzonnen zaaknamen mee: binnen een gesprek consequent, tussen gesprekken
verschillend, zodat je ze niet naast elkaar kunt leggen.

## Rahul, de assistent

Elke AI-aanroep loopt door één deur (`server/ai.js`): één `messages.create` met
een uitwijkketen erachter (Claude, dan OpenAI, dan Gemini; alleen aanbieders met
een sleutel doen mee). Zonder sleutel geeft hij vaste demo-antwoorden — een
AI-storing mag nooit een besluit forceren.

- **Het AI-stuur** (`stuur`) voert opdrachten écht uit, met de inlog van wie het
  vraagt: nooit meer rechten dan de persoon zelf. Accounts, techniekbord en
  zaakdoos zijn verboden terrein; elke geld-actie vraagt eerst bevestiging.
- **De AI mag nooit zelf toegang beloven** tot de Lifestyle- of Business Pass.
  Dat blijft mensenwerk.
- Bij Lifestyle en Business schrijft de AI niets in het chatdraadje — dat is de
  lijn naar een menselijke concierge.

## Muisvrij: alles met de mond of met typen

Eén balk onderaan elke app-pagina, met vier standen die zichzelf zetten.
Navigeren gaat lokaal (geen ronde langs de server), luisteren staat **uit** tot
je het zelf aanzet, en de grens is scherp: de balk herkent navigatie en verder
niets.

**Wat geld kost, typ je.** "Boek een taxi", "stuur 20 euro" — Rahul zet de zin
klaar, jij stuurt hem zelf. Wie het tóch met de mond wil krijgt een disclaimer
bij elke keer aanzetten, een bevestiging per opdracht, en daarna nog de
geld-drempel van de server.

## Het OS is iOS

Eén homescreen, een navigatiebalk van 44 punten die verdwijnt als er niets te
navigeren valt, een home-indicator, een randveeg terug, bladen in plaats van
vensters, en één hamburger die de functies van het huidige scherm *leest* in
plaats van ze per app op te schrijven. Split View blijft. Alles op één plek:
`public/shared/ios.css` + `ios.js`.

## De mediapoort

Camera en microfoon lopen door één deur (`shared/media.js`), die de diagnose
stelt vóór hij het de browser vraagt: **onveilig** (geen https), **kader**
(iframe), **geweigerd**, **geenapparaat**, **bezet**. Vijf oorzaken, vijf
verschillende handelingen — want "geen toegang tot de camera" stuurt de
gebruiker naar een knop die er niet is.

Twee camera's, met een echt verschil: **Kijk** stuurt die ene foto naar het
model en bewaart hem nergens; **RTG Eye** draait volledig op het toestel en laat
geen beeld het apparaat verlaten.

## De Salon en de curatie

Het besloten sociale netwerk levert ook het site- en campagnebeeld (uitgelichte
posts, altijd met naamsvermelding). De feed laat alleen door wat viraal gaat of
maatschappelijk belangrijk is. Viraliteit rekent zichzelf uit; **belang** is een
AI-oordeel en staat met opzet niet in het leespad — een lezer wacht nooit op een
AI-aanroep. Zonder AI-sleutel geldt de vaste woordencheck.

Rechten worden server-side afgedwongen: zonder pas alleen liken, RTG-leden
onderling reageren en dm'en, Lifestyle en Business volledige interactie. Creators
verdienen reiskorting met hun content (elke 50 likes = 1% korting, tot 10% per
kwartaal).

## Geld

RTG Pay (wallet, betaalverzoeken, splitsen, cadeaukaarten, punten), de RTG
Rekening, facturatie, payroll, het grootboek en de settlement. Betalen kan in
demo-modus of via Stripe. De pasprijs staat op één plek in de boardroom — de
Business Pass heeft er bewust geen.

## Identiteit en veiligheid

Passkeys (WebAuthn), SSO en SCIM, TOTP, pincode en sleutelwoorden, KYC, het
RTG-zegel met dynamische codes, en de paspoortpoort waarlangs een partner een
identiteit opvraagt — met melding en weigeringsrecht voor het lid. Plus de
persoonlijke veiligheidsapps: Thuiswacht, Codewoord, Vitaal, Thuisrust.

## Het RTF Living Lab

Eén onderzoekscyclus van tien stappen, twaalf projectsoorten, een ethieklaag en
een bewijsmotor. De voorkant mag speels zijn, de achterkant is een
onderzoeksinstituut. Het verschil tussen een sensorproject en een sociaal
project zit in het *gewicht* — als data in `kader.js`, niet als apart codepad,
anders krijgt de sociale kant vanzelf de tweederangs versie.

## Wat er bewust níet is

- Geen oneindige scroll: de Clips-feed en de Vonk-selectie zijn eindig per dag.
- Geen kunstmatige urgentie of andere verslavende engagement-patronen.
- Geen echte hotel- of luchtvaartmerken als bevestigde partners.
- Geen externe fonts, geen CDN's, geen stockfoto's — alles zelf gehost, en de
  CSP staat het andere ook niet toe.
