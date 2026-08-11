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
| Functieschakelaars (aan/uit per functie) | **145** in 16 categorieën |
| Apps in de leden-catalogus | **83** in 8 categorieën |
| Bedrijfsgenres | **73** in 26 sectoren |
| Capabilities (waar de apps op sturen) | **40** |
| API-endpoints | ~2.950 |
| Kernmodules (`server/kern/**`) | ~905 |
| App-pagina's (`public/apps/**.html`) | 212 |
| Testbestanden | 722 |

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

# 1. De 145 functieschakelaars

### Leden (RTG-app) — 19

- **Leden-app (algemeen)** (`member`) — Alle ledenfuncties in de RTG-app. Zet je dit uit, dan valt de hele ledenkant stil (behalve wat hieronder apart aan staat).  
  _voor: rtg, lifestyle, business, gast_
- **Directe berichten (DM)** (`member-dm`) — Privéberichten tussen leden onderling.  
  _voor: rtg, lifestyle, business_
- **Snaps & 24-uurs verhalen** (`member-snaps`) — Foto-snaps en verhalen die na 24 uur verdwijnen.  
  _voor: rtg, lifestyle, business_
- **Vrienden verbinden** (`member-connect`) — Vriendschapsverzoeken en de vriendengraaf tussen leden.  
  _voor: rtg, lifestyle, business_
- **Vacatures & solliciteren (leden)** (`member-werk`) — Leden solliciteren met hun cv op vacatures bij partners.  
  _voor: rtg, lifestyle, business_
- **RTG Zakelijk (professioneel netwerk)** (`zakelijk`) — De LinkedIn-laag van de Lifestyle en Business Pass: zakelijk profiel, gids, verbinden, feed, aanbevelingen en het kansenbord.  
  _voor: lifestyle, business_
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

### Diensten (leden) — 22

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

### Toegang en identiteit — 8

- **Inloggen en registreren** (`tg-inlog`) — De voordeur: inloggen, uitloggen, registreren en wachtwoord vergeten. Uit betekent dat niemand meer binnenkomt; de eigenaar houdt het techniekbord.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Account en profiel** (`tg-account`) — Het eigen account: rollen, koppelingen en het cv van een lid.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Inloggen via een andere partij (SSO)** (`tg-sso`) — De terugkeer van een identiteitsprovider, met de ondertekende state als poort.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Pincode en sleutelwoorden** (`tg-pin`) — De algemene pin voor prive-apps en de sleutelwoord-inlog met zijn uitdaging.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Zegel, codes en rechtenbeheer** (`tg-zegel`) — Het RTG-zegel, dynamische codes, scanbare codes en de rechtenlaag op media.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **De gegevenspoort** (`tg-gegevens`) — Het gesprek waarin een lid zelf zijn ontbrekende gegevens aanvult, inclusief het opzoeken van een adres bij postcode en huisnummer.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Aanmelden voor een pas** (`tg-aanmeld`) — Het aanmeldgesprek en de aanmeldingen die daaruit volgen; het besluit blijft mensenwerk.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Wervingslink van een werkgever** (`tg-werving`) — De link /werken/<code> waarmee een werkgever iemand uitnodigt die nog geen account heeft; aanmelden en in dienst treden worden dan een handeling.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_

### Genres & diensten — 9

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

### Sociaal (De Salon) — 4

- **De Salon (feed, volgen, deals)** (`salon`) — De Salon-tijdlijn: partner-posts volgen, aanbiedingen claimen, polls en de etalage.  
  _voor: rtg, lifestyle, business, gast_
- **Salon-ontmoetingen (in de buurt)** (`ontmoetingen`) — Wederzijdse connecties die vlakbij zijn spreken veilig af (18+, geverifieerd), met contract, live-locatie naar RTG en SOS.  
  _voor: rtg, lifestyle, business_
- **Sociale laag (RTG + RTF)** (`social`) — De gedeelde sociale laag: zoeken, verbinden, DM, snaps, verhalen en bellen op codenaam. De kinderbescherming (t/m 15 gesloten) blijft altijd gelden.  
  _voor: rtg, lifestyle, business, foundation_
- **RTF contacten & familiekoppeling** (`rtf-contacten`) — De contactenlaag van de RTFoundation: gezinnen koppelen, kanalen en meldingen tussen leden.  
  _voor: rtg, lifestyle, business, foundation_

### Eigen apps — 13

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
- **RTG Office (kantoorpakket)** (`kantoorpakket`) — Het eigen kantoorpakket: tekstdocumenten en rekenbladen op uw account, alleen-lezen te delen op codenaam.  
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

### Winkel en media — 8

- **De Mall** (`dom-mall`) — De etages en de gids met alle partners.  
  _voor: rtg, lifestyle, business, gast_
- **Bestanden (kluis)** (`dom-bestanden`) — De persoonlijke bestandenkluis.  
  _voor: rtg, lifestyle, business, foundation_
- **Notities** (`dom-notities`) — De notitie-app: losse aantekeningen en lijstjes van een lid.  
  _voor: rtg, lifestyle, business, foundation_
- **Leden-website** (`dom-site`) — De eigen website die een lid of zaak kan bouwen.  
  _voor: rtg, lifestyle, business_
- **Media-assets** (`dom-asset`) — Het uitleveren van geuploade media.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Home Kit (slim huis)** (`dom-home`) — De aansturing van apparaten in huis.  
  _voor: rtg, lifestyle, business_
- **Media uitleveren** (`ov-media`) — Het uitleveren van geuploade afbeeldingen en bestanden aan de app.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_
- **Browser** (`ov-browser`) — De ingebouwde browser met zijn gids.  
  _voor: rtg, lifestyle, business_

### Partners (leveranciers) — 8

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

### Werk (zaken en personeel) — 10

- **De werkvloer** (`dom-werkvloer`) — Tafels, keukenbord en bedieningskaart op de vloer van een zaak.  
  _voor: leverancier, personeel_
- **De werkplek** (`dom-werkplek`) — Het persoonlijke werkstation van een medewerker.  
  _voor: leverancier, personeel_
- **Metier (vakwerk)** (`dom-metier`) — Het vakwerk van zelfstandigen en ambachtslieden.  
  _voor: leverancier, personeel_
- **Vakritmes** (`dom-vak`) — Werkritmes en tijdregistratie per vak.  
  _voor: leverancier, personeel_
- **Verkoop** (`dom-verkoop`) — De verkoopkant van een zaak, inclusief proefritten.  
  _voor: leverancier, personeel_
- **De zaakdoos** (`dom-doos`) — De doos op locatie: zaakserver, netwerk en updates.  
  _voor: leverancier, personeel_
- **Facturen** (`dom-facturen`) — De facturatie van en naar een zaak.  
  _voor: leverancier, personeel_
- **Kantoorgesprek** (`ov-kantoorgesprek`) — Het gesprek waarmee een zaak zijn kantoor inricht.  
  _voor: leverancier, personeel_
- **Werkmail bezorgen** (`ov-werkmail`) — De bezorging van interne werkmail.  
  _voor: leverancier, personeel_
- **RTG Mail: post van buiten aannemen** (`ov-mail-binnen`) — De buitenpoort die echte e-mail van een vreemde mailserver aanneemt, uitpakt en in het juiste postvak aflevert. Uit betekent: post van buiten komt niet meer binnen.  
  _voor: leverancier, personeel_

### RTG-Backoffice — 3

- **Backoffice (algemeen)** (`office`) — Het RTG-actiecentrum: orders, ritten, prestaties, verificaties en partneraanvragen.  
  _voor: intern_
- **Schoolgoedkeuring (RTF School)** (`office-school`) — Scholen goedkeuren of afwijzen voordat ze personeel en klassen kunnen aanmaken.  
  _voor: intern_
- **Werk OS (werkruimtes)** (`bedrijf`) — De werkplek van een organisatie: leden, rollen, startscherm, projecten, kennis, klanten, service, bouw, contracten, IT en besluiten. Uit = geen enkele werkruimte werkt meer.  
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

### Betalen & verificatie — 4

- **Betaalverkeer** (`betalen`) — Betalingen (demo of Stripe) en de RTG Pay-wallet. Uit = er kan tijdelijk niet betaald worden.  
  _voor: rtg, lifestyle, business, gast_
- **Passkeys (WebAuthn)** (`webauthn`) — Inloggen met vingerafdruk, gezicht of beveiligingssleutel. Wachtwoord-inloggen blijft altijd werken.  
  _voor: rtg, lifestyle, business_
- **Identiteitsverificatie (KYC)** (`verificatie`) — Leden uploaden hun identiteitsbewijs en RTG beoordeelt het.  
  _voor: rtg, lifestyle, business, gast_
- **Paspoort delen (gecontroleerd)** (`paspoort`) — Het toestemmingsgestuurde kanaal waarlangs een partner een identiteit opvraagt (ja/nee, ID-kaart of scan), met melding en weigering voor het lid.  
  _voor: rtg, lifestyle, business, leverancier_

### Geld — 8

- **RTG Rekening** (`dom-rekening`) — Saldo, afschriften en betalingen op de eigen rekeninglaag.  
  _voor: rtg, lifestyle, business_
- **Wallet** (`dom-wallet`) — De wallet van een lid binnen RTG Pay.  
  _voor: rtg, lifestyle, business, gast_
- **Betalen en betaalverzoeken** (`gld-munt`) — Rechtstreeks betalen aan een partner, betaalverzoeken en de betaalopties.  
  _voor: rtg, lifestyle, business, gast_
- **Rekening en facturen** (`gld-rekening`) — De openstaande rekening, het afrekenen daarvan en losse facturen.  
  _voor: rtg, lifestyle, business_
- **Rekening splitsen** (`gld-splitsen`) — Een rekening samen delen en ieders deel betalen.  
  _voor: rtg, lifestyle, business_
- **Cadeaukaarten** (`gld-cadeau`) — Cadeaukaarten kopen en de eigen kaarten bekijken.  
  _voor: rtg, lifestyle, business_
- **Punten en verzilveren** (`gld-punten`) — Gespaarde punten en het verzilveren daarvan.  
  _voor: rtg, lifestyle, business_
- **Pasprijzen en balans** (`gld-prijzen`) — De publieke prijslijst van de passen en het balansoverzicht van een lid.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel, foundation_

### Personeel & integraties — 3

- **Personeels-app (PDA)** (`staff`) — De personeels-app: rooster, klokken, verlof/ziek, taken, team en de vertrouwenspersoon.  
  _voor: personeel_
- **Wervingslink (in dienst via een link)** (`werving`) — De uitnodigingslink van een werkgever: kijken wie je uitnodigt (openbaar, alleen bedrijfsnaam en functie) en jezelf eraan verbinden met je eigen RTG-account.  
  _voor: leverancier, personeel_
- **Rahul doet het (AI-stuur)** (`stuur`) — De AI voert acties uit op elk toegestaan API-pad, met de eigen inlog van wie het vraagt (nooit meer rechten dan de persoon zelf). Geld-acties vragen altijd eerst een bevestiging.  
  _voor: rtg, lifestyle, business, gast, leverancier, personeel_

---

# 2. De 83 apps in de leden-catalogus

Wat een lid op zijn homescreen kan zetten. De schakelaars hierboven bepalen of
ze werken; dit is wat hij ziet.

### Sociaal & contact — 10

- **Berichten** `/apps/comm.html` — Alle gesprekken van het platform op een plek -- mensen, zaken, onderweg, officieel -- met bellen en videobellen in de kop van het gesprek.
- **De Salon** `/apps/salon.html` — Het besloten sociale netwerk van RTG: zelf plaatsen met foto's en onderwerpen, leden volgen, bewaren en reageren.
- **Genootschap** `/apps/genootschap.html` — Besloten groepen met een prikbord, peilingen en bijeenkomsten.
- **Pulse** `/apps/pulse.html` — De hoogtepunten van vandaag in jouw RTG-wereld, rustig gebundeld, geen eindeloze feed.
- **Cercle** `/apps/cercle.html` — Je besloten kring: de mensen die dichtbij staan, op één plek.
- **Entourage** `/apps/entourage.html` — Je vaste mensen en hun rol om je heen, overzichtelijk bij elkaar.
- **Rendez-vous** `/apps/rendezvous.html` — Afspraken en ontmoetingen plannen met je kring.
- **Vonk** `/apps/vonk.html` — RTG Vonk: kennismaken op wens; bij een wederzijdse match reserveert RTG een tafel in het midden.
- **Attenties** `/apps/attenties.html` — Attenties en cadeaus regelen voor wie je waardeert.
- **Meet** `/apps/meet.html` — Vergaderen op codenaam: kamers met een korte code, scherm delen, en een Vergaderruimte-knop op elke agenda-afspraak.

### Reizen & verblijf — 11

- **Het Huis** `/apps/rtg.html` — Reserveren, boeken en bestellen bij alle partners, alles op codenaam.
- **Verblijven** `/apps/hotels.html` — Hotels, appartementen en villa's met ledenprijzen en keyless toegang.
- **Reisbureau** `/apps/reisbureau.html` — Samengestelde reizen tegen de nettoprijs, met AI-reisadvies in gewone woorden.
- **Reisboek** `/apps/reisboek.html` — Je reisdagboek: boekingen en momenten worden vanzelf een mooi verslag.
- **Vluchten** `/apps/vluchten.html` — Vluchten zoeken, boeken en volgen.
- **Hangar** `/apps/hangar.html` — De Hangar: privéjets en charters vanaf Business Aviation.
- **RTG OV** `/apps/ov.html` — Bus, trein, metro, veerboot en taxi in één reisapp, met live GPS en snelle check-in.
- **Navigatie** `/apps/navigatie.html` — Navigeren met de RTG-kaart.
- **Flits** `/apps/flits.html` — Een ingetogen rijscherm met community-meldingen (flitser, file, ongeval) en spraak.
- **Mijn Stad** `/apps/stad.html` — Alles om je heen in het RTG-web, op de kaart van je stad.
- **Maison** `/apps/maison.html` — Je vaste verblijven en tweede huizen bij elkaar.

### Eten & uitgaan — 4

- **Food Court** `/apps/foodcourt.html` — Alle restaurants op een rij; reserveren met tijdsloten in een paar tikken.
- **Table** `/apps/table.html` — Je tafelreserveringen en gastenlijsten.
- **Cellier** `/apps/cellier.html` — Je wijnkelder en proefnotities.
- **Uitgaan** `/apps/uitgaan.html` — Bars, clubs en beachclubs met hun avonden en gastenlijsten.

### Media & creatie — 24

- **RTG Media** `/apps/media.html` — Eén mediawereld over Klankwerk, Theater, Clips en Podium heen: muziek, kijk en flow als drie standen op dezelfde catalogus, met één makersprofiel en uw eigen regelaars in plaats van een algoritme.
- **Camera** `/apps/camera.html` — Fotograferen, plus RTG Eye: voertuigschouw en hands-free werkvloerlog.
- **RTG Sound** `/apps/muziek.html` — Je muziek, rustig en zonder reclame.
- **Theater** `/apps/theater.html` — Videobibliotheek op bioscoopniveau, tot 4K, met kanalen en reacties.
- **Clips** `/apps/clips.html` — Korte video's die lokaal bij de maker blijven; een eindige dagselectie.
- **RTG Klankwerk** `/apps/klankwerk.html` — Zelf muziek maken: een raster, een notenrol en Rahul die iets neerzet.
- **De Zaal** `/apps/zaal.html` — Wat leden zelf gemaakt hebben, op volgorde van wanneer het uitkwam.
- **Podium** `/apps/podium.html` — Je eigen live-kanaal (18+), met chat, RTG Pay-cadeaus en abonnementen.
- **Website-maker** `/apps/sitemaker.html` — Bouw met blokken je eigen RTG-site, met eigen foto's en beeld uit De Salon.
- **RTG Browser** `/apps/browser.html` — Blader door de sites die leden in het RTG-web publiceren.
- **RTG Werk OS** `/apps/werk.html` — De werkplek van een hele organisatie: startscherm per rol, projecten, kennisbank, klanten, servicedesk, bouw, apparaten, contracten en besluiten.
- **RTG Office** `/apps/office.html` — Tekst en rekenblad met autosave, delen op codenaam en export.
- **Agenda** `/apps/agenda.html` — Maand, week en lijst; uitnodigen op codenaam, herinneringen, en je RTG-boekingen staan er vanzelf in.
- **Notities & Taken** `/apps/notities.html` — Notities en lijstjes met vinkjes; delen op codenaam is samen werken, en een datum wordt vanzelf een agenda-afspraak.
- **Bestanden** `/apps/bestanden.html` — De versleutelde kluis: mappen, versies, delen op codenaam en een prullenbak die 30 dagen bewaart.
- **Galerij** `/apps/galerij.html` — Al je beelden op een plek: tijdlijn per maand, albums en favorieten.
- **Gereedschap** `/apps/gereedschap.html` — Rekenmachine (met btw en rekening delen), wekkers en timers die op de server aftellen, stopwatch en wereldklok.
- **Vertaler** `/apps/vertaler.html` — Typen of spreken, live vertalen, voorlezen en reiszinnen per situatie.
- **Memo** `/apps/memo.html` — Spraakmemo's opnemen; de audio staat als gewoon bestand in je Bestanden-kluis.
- **Scanner** `/apps/scanner.html` — Documenten vastleggen met de camera of uit je foto's, documentmodus voor leesbaar papier, en bewaren als PDF of losse foto's in je Bestanden-kluis.
- **Boeken** `/apps/boeken.html` — De huisbibliotheek plus je eigen tekstbestanden uit de kluis, met een rustige lezer.
- **RTG Krant** `/apps/krant.html` — De kiosk: de kranten die nieuwsbedrijven binnen RTG uitgeven, elk in de eigen huisstijl.
- **Nieuws** `/apps/nieuws.html` — RTG Nieuws per rubriek, met wat je later wilt lezen bewaard.
- **Garde-robe** `/apps/garderobe.html` — Je kledingkast en looks bij elkaar.

### Geld & werk — 8

- **Métier** `/apps/metier.html` — Je beroepsprofiel op codenaam, met de rollen die RTG zelf heeft bevestigd.
- **Wie betaalt wat** `/apps/wbw.html` — Groepsuitgaven met live balans en verrekenen via RTG Pay.
- **Balans** `/apps/balans.html` — Je saldo en tikgeschiedenis in één overzicht.
- **RTG-code** `/apps/rtgcode.html` — Je betaal- en toegangscodes veilig op één plek.
- **Logboek** `/apps/logboek.html` — Je acties en bevestigingen, netjes vastgelegd.
- **Mecenaat** `/apps/mecenaat.html` — Steun projecten en goede doelen als mecenas.
- **Lab-fonds** `/apps/labfonds.html` — Steun het RTG-onderzoekslab en volg waar je bijdrage heen gaat.
- **Nalatenschap** `/apps/nalatenschap.html` — Regel wat er later met je account en bezittingen gebeurt.

### Spelen & sport — 2

- **Spelen** `/apps/spelen.html` — Dammen, rummikub, Magnaat, partyspellen, sudoku en meer, samen of alleen.
- **Sport** `/apps/sport.html` — Je sportactiviteiten en clubs.

### Veiligheid & identiteit — 7

- **Thuiswacht** `/apps/thuiswacht.html` — Zeg hoe lang je onderweg bent; meld je je niet, dan krijgt je kring bericht met je laatst bekende plek.
- **Codewoord** `/apps/codewoord.html` — Een gewone zin die je kring stil waarschuwt met je plek; op je scherm gebeurt er niets zichtbaars.
- **Vitaal** `/apps/vitaal.html` — Een knop per dag: het gaat goed.
- **Thuisrust** `/apps/thuisrust.html` — Niet storen tot je thuis bent; je eigen kring komt er altijd doorheen.
- **Wie ben ik** `/apps/ik.html` — Wat Rahul over je mag weten: hoe hij tegen je doet, je voornaamwoorden en je eigen geloofskeuze.
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

---

# 3. De 73 genres in 26 sectoren

Er is **één** partner-app en **één** personeels-PDA. Welke schermen een zaak
krijgt volgt niet uit zijn genre maar uit zijn *capabilities*: een hotel en een
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

De 40 capabilities waar de apps naar kijken (nooit naar het genre zelf):

`advies`, `alpine`, `beauty`, `beveiliging`, `bezorgen`, `boerderij`, `bookings`, `care`, `charter`, `creator`, `doors`, `fitclub`, `fleet`, `gebouw`, `gemeente`, `golf`, `groothandel`, `huur`, `location`, `luchthaven`, `marechaussee`, `marina`, `menu`, `opvang`, `orders`, `ov`, `petcare`, `polis`, `pricing`, `redactie`, `reservations`, `retail`, `rides`, `rijk`, `services`, `sportclub`, `tickets`, `vastgoed`, `vracht`, `weddings`
---

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
