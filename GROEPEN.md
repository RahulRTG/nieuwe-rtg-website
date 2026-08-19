# Alle functies per groep

Afgelezen uit `server/functies/register/` en uit de `PREMIUM`-set van
`apps/app-main`. Niet met de hand bijgehouden: draai `npm run groepen`.

`WERELDEN.md` zegt WAAR iets hoort, dit zegt WIE het krijgt. De twee assen
staan loodrecht op elkaar: een wereld is een plek, een groep is een publiek.

## In getallen

| groep | functies | wie dat is |
|---|---:|---|
| **RTG-leden** | 140 | Leden met de RTG Pass. |
| **Lifestyle** | 143 | Leden met de Lifestyle Pass. |
| **Business** | 157 | Leden met de Business Pass (zakelijk). |
| **Gratis app** | 44 | De gratis RTG-app, zonder pas (rondkijken en bij partners bestellen). |
| **Leveranciers** | 54 | Partners en hun personeel in de partner-app. |
| **Personeel** | 42 | Medewerkers in de personeels-app (PDA). |
| **Foundation** | 48 | Gezinnen, leerlingen en scholen in de RTF-app. |
| **RTG intern** | 20 | De RTG-backoffice en integraties (intern). |

Totaal 191 functieschakelaars in 16 categorieën.

## Het verschil tussen de passen

Dit is de vraag waar een prijskaartje aan hangt, dus hier staat hij kaal:

| | functies | waarvan uniek |
|---|---:|---:|
| RTG Pass | 140 | . |
| Lifestyle Pass | 143 | 0 |
| Business Pass | 157 | 14 |
| Gratis app | 44 | . |

**Wat er boven de RTG Pass uit komt, de hele lijst:**

- **De Rechterhand (Lifestyle-suite)** -- Lifestyle + Business
  <br>De veertien premium-apps van de Lifestyle Pass: Reisboek, Cellier, Table, Maison, Garde-robe, Mecenaat, Nalatenschap, Logboek, Cercle, Hangar, Entourage, Attenties en Rendez-vous.
- **RTG Zakelijk (professioneel netwerk)** -- Lifestyle + Business
  <br>De LinkedIn-laag van de Lifestyle en Business Pass: zakelijk profiel, gids, verbinden, feed, aanbevelingen en het kansenbord.
- **Het Privékantoor (Lifestyle)** -- Lifestyle + Business
  <br>De ene app van de Lifestyle Pass: de levensgraaf over de premium-apps heen, de Control Tower met alle termijnen, het mandaat (wat mag het kantoor zelf) en zaken met een team en een tijdlijn.
- **Werk OS (werkruimtes)** -- Business
  <br>De werkplek van een organisatie: leden, rollen, startscherm, projecten, kennis, klanten, service, bouw, contracten, IT en besluiten.
- **Wervingslink (in dienst via een link)** -- Business
  <br>De uitnodigingslink van een werkgever: kijken wie je uitnodigt (openbaar, alleen bedrijfsnaam en functie) en jezelf eraan verbinden met je eigen RTG-account.
- **De werkvloer** -- Business
  <br>Tafels, keukenbord en bedieningskaart op de vloer van een zaak.
- **De werkplek** -- Business
  <br>Het persoonlijke werkstation van een medewerker.
- **Metier (vakwerk)** -- Business
  <br>Het vakwerk van zelfstandigen en ambachtslieden.
- **Vakritmes** -- Business
  <br>Werkritmes en tijdregistratie per vak.
- **Verkoop** -- Business
  <br>De verkoopkant van een zaak, inclusief proefritten.
- **De zaakdoos** -- Business
  <br>De doos op locatie: zaakserver, netwerk en updates.
- **Facturen** -- Business
  <br>De facturatie van en naar een zaak.
- **Zakelijk bankieren** -- Business
  <br>Bulkbetalingen en de salarisrun vanaf een zakelijke rekening.
- **Kantoorgesprek** -- Business
  <br>Het gesprek waarmee een zaak zijn kantoor inricht.
- **Instant Reality** -- Business
  <br>De controleerbare Business-wereld voor intenties, voorbereiding, providerbewijs en uitzonderingen.
- **Werkmail bezorgen** -- Business
  <br>De bezorging van interne werkmail.
- **RTG Mail: post van buiten aannemen** -- Business
  <br>De buitenpoort die echte e-mail van een vreemde mailserver aanneemt, uitpakt en in het juiste postvak aflevert.

## En de tweede lijst, die de eerste niet kent

De client houdt daarnaast 14 APPS achter een dure pas
(`PREMIUM` in `apps/app-main`, `premiumPas = lifestyle || business`):

`rechterhand` · `reisboek` · `cellier` · `table` · `maison` · `garderobe` · `mecenaat` · `nalatenschap` · `logboek` · `cercle` · `hangar` · `entourage` · `attenties` · `rendezvous`

Die set staat los van het functieregister hierboven en kent geen onderscheid
tussen Lifestyle en Business. Wat een pas krijgt, staat dus op twee plekken
met verschillende inhoud en verschillende korrel -- server op functie,
client op app. Zie de opmerking bovenaan `scripts/groepen.js`.

---

## Gratis app -- 44 functies

*De gratis RTG-app, zonder pas (rondkijken en bij partners bestellen).*

### Leden (RTG-app)

- **Leden-app (algemeen)** -- Alle ledenfuncties in de RTG-app.
- **De app-staat** -- De ene aanroep waarmee de app zijn hele beeld ophaalt.
- **De live-verbinding** -- De open lijn (SSE) waarover meldingen en verversingen binnenkomen, plus de verbindingsgegevens voor bellen.
- **Meldingen en push** -- De meldingen in de app, de voorkeuren daarvoor en de push naar het toestel.
- **Berichten en gesprekken** -- De chat met de concierge, prive-berichten op codenaam en de groepsklets.
- **Communicatieplatform** -- Het ene gespreksmodel: de inbox met al zijn laden, threads, reacties, zoeken over alles, en @Rahul die opstelt maar nooit verstuurt.
- **Taal en vertaling** -- De talenlijst en het vertalen van schermteksten en berichten.
- **Rahul (de assistent)** -- De assistent zelf: zijn stemming, zijn blik op een scherm en de bibliotheekhulp.
- **App-gids en uitleg** -- De gids die per scherm uitlegt wat je er kunt doen.
- **Waarderen en reageren** -- Likes, reacties, reviews en favorieten door het hele platform.

### Genres & diensten

- **Bestellen & bezorgen** -- Bestellen bij een zaak (ophalen of laten bezorgen) met live volgen.
- **Tickets & activiteiten** -- Tickets kopen met tijdslot en een oplichtende entreecode.

### Sociaal (De Salon)

- **De Salon (feed, volgen, deals)** -- De Salon-tijdlijn: partner-posts volgen, aanbiedingen claimen, polls en de etalage.

### Eigen apps

- **RTG Hospitality Guest OS (de gastkant)** -- Bestellen vanaf je eigen telefoon: aan tafel via de QR, op je hotelkamer op de gastrekening, in de club op je polsband, en van huis uit laten bezorgen, afhalen of een foodcourt-mandje bij meer loketten.
- **RTG Invisible Arrival** -- Een beveiligde aankomstpas voor reservering, capaciteitscontrole en minimale live aankomststatus.

### Betalen & verificatie

- **Betaalverkeer** -- Betalingen (demo of Stripe) en de RTG Pay-wallet.
- **Identiteitsverificatie (KYC)** -- Leden uploaden hun identiteitsbewijs en RTG beoordeelt het.

### Personeel & integraties

- **Rahul doet het (AI-stuur)** -- De AI voert acties uit op elk toegestaan API-pad, met de eigen inlog van wie het vraagt (nooit meer rechten dan de persoon zelf).

### Diensten (leden)

- **Reisbureau** -- Reisadvies en het samenstellen van een reis.
- **Reizen boeken** -- Het boeken zelf: aanbod, slots, betalen en de eigen boekingen, inclusief het partnerkanaal voor niet-leden.
- **Reiswijzer en landeninfo** -- De wijzer met landen, regels en wat je moet weten voor je gaat.
- **Foodcourt** -- Het foodcourt met de vrije tijdsloten van de zaken.
- **Partneroverzicht** -- De lijst met aangesloten partners die een lid kan zien.
- **Invisible Arrival** -- De publieke aankomstpas, voorbereiding en live aankomststatus voor een gast en de ontvangende zaak.

### RTFoundation

- **Living Lab: de bewonerskant** -- Meedoen met een labpas, een onderzoeksvraag aandragen, stemmen en het labpaspoort.

### Winkel en media

- **De Mall** -- De etages en de gids met alle partners.
- **Media-assets** -- Het uitleveren van geuploade media.
- **Media uitleveren** -- Het uitleveren van geuploade afbeeldingen en bestanden aan de app.

### Identiteit en veiligheid

- **Storingsmelding uit de browser** -- Meldt een onafgevangen fout aan het logboek: melding, bestand, regel en pagina.
- **RTG iD** -- De digitale identiteit en het delen daarvan.
- **Onboarding** -- De eerste stappen na aanmelden: profiel compleet maken.

### Geld

- **Wallet** -- De wallet van een lid binnen RTG Pay.
- **Walletsaldo en betalen binnen RTG** -- Saldo aanhouden, opladen, tikken en betaalverzoeken binnen het gesloten RTG-circuit.
- **Betalen en betaalverzoeken** -- Rechtstreeks betalen aan een partner, betaalverzoeken en de betaalopties.
- **Pasprijzen en balans** -- De publieke prijslijst van de passen en het balansoverzicht van een lid.

### Toegang en identiteit

- **Inloggen en registreren** -- De voordeur: inloggen, uitloggen, registreren en wachtwoord vergeten.
- **Account en profiel** -- Het eigen account: rollen, koppelingen en het cv van een lid.
- **Inloggen via een andere partij (SSO)** -- De terugkeer van een identiteitsprovider, met de ondertekende state als poort.
- **Pincode en sleutelwoorden** -- De algemene pin voor prive-apps en de sleutelwoord-inlog met zijn uitdaging.
- **Zegel, codes en rechtenbeheer** -- Het RTG-zegel, dynamische codes, scanbare codes en de rechtenlaag op media.
- **De gegevenspoort** -- Het gesprek waarin een lid zelf zijn ontbrekende gegevens aanvult, inclusief het opzoeken van een adres bij postcode en huisnummer.
- **Aanmelden voor een pas** -- Het aanmeldgesprek en de aanmeldingen die daaruit volgen; het besluit blijft mensenwerk.
- **Wervingslink van een werkgever** -- De link /werken/<code> waarmee een werkgever iemand uitnodigt die nog geen account heeft; aanmelden en in dienst treden worden dan een handeling.

### Cultuur en gezelschap

- **De krant** -- De openbare krant: de gids, een uitgave openen en een artikel lezen.

---

## RTG-leden -- 140 functies

*Leden met de RTG Pass.*

### Leden (RTG-app)

- **Leden-app (algemeen)** -- Alle ledenfuncties in de RTG-app.
- **Directe berichten (DM)** -- Privéberichten tussen leden onderling.
- **Snaps & 24-uurs verhalen** -- Foto-snaps en verhalen die na 24 uur verdwijnen.
- **Vrienden verbinden** -- Vriendschapsverzoeken en de vriendengraaf tussen leden: zoeken op codenaam, of toevoegen met de eigen contactpin (ook als QR).
- **Vacatures & solliciteren (leden)** -- Leden solliciteren met hun cv op vacatures bij partners.
- **RTG Wereld (de ene sociale app)** -- De laag over De Salon, Pulse, RTG Zakelijk, de genootschappen en de verhalen heen: één tijdlijn met een schakelaar (Alles, Lifestyle, Business, Communities, Privé) en de sprong naar de berichten-app.
- **De app-staat** -- De ene aanroep waarmee de app zijn hele beeld ophaalt.
- **De live-verbinding** -- De open lijn (SSE) waarover meldingen en verversingen binnenkomen, plus de verbindingsgegevens voor bellen.
- **Meldingen en push** -- De meldingen in de app, de voorkeuren daarvoor en de push naar het toestel.
- **Berichten en gesprekken** -- De chat met de concierge, prive-berichten op codenaam en de groepsklets.
- **Communicatieplatform** -- Het ene gespreksmodel: de inbox met al zijn laden, threads, reacties, zoeken over alles, en @Rahul die opstelt maar nooit verstuurt.
- **Taal en vertaling** -- De talenlijst en het vertalen van schermteksten en berichten.
- **Locatie delen** -- Het delen van de eigen positie onderweg, en het stoppen daarvan.
- **Klok, timer en wekker** -- De klok-app met timers en wekkers.
- **Memo en samenvatten** -- De memo-app en de samenvatting van een opname of transcript.
- **Rahul (de assistent)** -- De assistent zelf: zijn stemming, zijn blik op een scherm en de bibliotheekhulp.
- **App-gids en uitleg** -- De gids die per scherm uitlegt wat je er kunt doen.
- **Waarderen en reageren** -- Likes, reacties, reviews en favorieten door het hele platform.

### Genres & diensten

- **Bestellen & bezorgen** -- Bestellen bij een zaak (ophalen of laten bezorgen) met live volgen.
- **Tickets & activiteiten** -- Tickets kopen met tijdslot en een oplichtende entreecode.
- **Autoverhuur** -- Auto huren met foto's voor/na, borg, SOS-knop en live locatie.
- **Boten & jachten (charter)** -- Vaartuigen charteren met schipper, borg, SOS op zee en live positie.
- **Vastgoed** -- Panden bekijken, interesse tonen of bieden en keyless bezichtigen.
- **Mode & retail** -- De modecatalogus: wishlist, apart leggen en de paskamer.
- **Onderweg (live locatie)** -- Het live onderweg-scherm: positie, ETA en verbonden partners.
- **Contracten (leden tekenen)** -- Digitale contracten die een lid in de app ondertekent.
- **Groothandel & markt** -- De brede B2B/B2C-marktplaats: horeca koopt in, leden bestellen boodschappen, met AI-bijbestellen.

### Sociaal (De Salon)

- **De Salon (feed, volgen, deals)** -- De Salon-tijdlijn: partner-posts volgen, aanbiedingen claimen, polls en de etalage.
- **Salon-ontmoetingen (in de buurt)** -- Wederzijdse connecties die vlakbij zijn spreken veilig af (18+, geverifieerd), met contract, live-locatie naar RTG en SOS.
- **Sociale laag (RTG + RTF)** -- De gedeelde sociale laag: zoeken, verbinden, DM, snaps, verhalen en bellen op codenaam.
- **RTF contacten & familiekoppeling** -- De contactenlaag van de RTFoundation: gezinnen koppelen, kanalen en meldingen tussen leden.

### Eigen apps

- **Spelen (spellen met vrienden)** -- Alle spellen: schaken, dammen, rummi, Magnaat, sudoku en de partyspellen.
- **RTG Podium (live, in zones)** -- Live uitzenden op één motor, in gescheiden werelden: Live (open voor leden), Creator (abonnement en cadeaus), Events (op een kaartje), Besloten (op uitnodiging) en 18+ (geverifieerd paspoort, eigen lijst en eigen wachtrij bij het kantoor).
- **RTG Theater (video)** -- De videobibliotheek op bioscoopniveau, inclusief het Thuisarchief (P2P).
- **RTG Flits (rijscherm)** -- Het rijscherm met meldingen uit het eigen netwerk (flitser, file, ongeval) en de vooruitblik.
- **RTG OV (reizen)** -- Alle vervoer in een app: de kaart, twee snelle check-ins, de dienst-PDA en de routetekenaar.
- **RTG Vervoer (Mobility OS)** -- De vervoerskern: een rit aanvragen en volgen, de vloot en de dispatch van een vervoerder, en de bedrijfspendel.
- **Wie betaalt wat** -- Groepsuitgaven met een live balans en verrekenen via RTG Pay.
- **RTG Geld (financieel besturingssysteem)** -- Het command center over alle gelddomeinen: hoe u ervoor staat, wat eraan komt, uw eigen beleidsregels met reserveringspotten, het actielog en de gegronde Rahul.
- **RTFoundation (levenslijn, mentor en levenspas)** -- De levenslijn met wat er speelt en wat eraan komt, de mentor die opent en nooit stuurt, en de levenspas: wie mag wat van u zien.
- **RTG Sociaal (de kring op een plek)** -- De samenhanglaag over De Salon, berichten, pulse en de ontmoetingen: wat er tussen u en uw kring speelt.
- **RTG Office (kantoorpakket)** -- Het eigen kantoorpakket: tekstdocumenten en rekenbladen op uw account, alleen-lezen te delen op codenaam.
- **RTG Ondernemers-OS** -- Van "ik denk erover na" tot een draaiend bedrijf in een scherm: de verkenning en de stress test, de rechtsvorm en het oprichtingsproject, het dagbeeld met debiteuren, btw, kas en capaciteit, de verkooppijplijn en het bestuur met de UBO-afleiding.
- **RTG Vonk (dating)** -- Dating op codenaam met de Salon-veiligheidslat: 18+, geverifieerd paspoort, een eindige dagselectie, en bij een match automatisch een tafel rond het midden van beide woonplaatsen (EUR 10 p.p., waarvan EUR 5 voor RTG).
- **RTG Media (één mediawereld)** -- De laag die Klankwerk, Theater, Clips en Podium tot één wereld maakt: drie standen (muziek, kijk, flow) op dezelfde catalogus, één makersprofiel, één volgrelatie, één bibliotheek en de eigen smaakregelaars.
- **RTG Clips (korte video’s)** -- Korte verticale video’s die alleen op het toestel van de maker staan (OPFS); kijken is rechtstreeks P2P.
- **RTG Hospitality Guest OS (de gastkant)** -- Bestellen vanaf je eigen telefoon: aan tafel via de QR, op je hotelkamer op de gastrekening, in de club op je polsband, en van huis uit laten bezorgen, afhalen of een foodcourt-mandje bij meer loketten.
- **RTG Evening OS (een avond plannen)** -- Een hele avond als plan: eten, iets drinken en de rit naar huis, binnen je budget en op tijd thuis.
- **RTG Invisible Arrival** -- Een beveiligde aankomstpas voor reservering, capaciteitscontrole en minimale live aankomststatus.
- **RTG Instant Reality** -- De persoonlijke scenario- en eventlaag waarmee een lid een toekomstige ervaring veilig kan verkennen.
- **RTG Life (het ene scherm)** -- Het overzichtsscherm en de dagcoach: ze lezen de lagen hieronder en leggen ze naast elkaar.
- **Doelen** -- Waar u begon, waar u heen wilt en waarom; de mijlpalen worden afgeleid en niet bewaard.
- **Dagmetingen en toestellen** -- Slaap, beweging, water en gewicht, zelf ingevuld of door een gekoppeld toestel weggeschreven.
- **Dagcheck-in (hoe zit u erbij)** -- Een tik per dag, met de keuze om er iets bij te schrijven.
- **Gewoonten** -- Kleine dingen die u vaker wilt doen; de dagenteller staat uit tot u hem zelf aanzet.
- **Gedachtenboek** -- Opschrijven voor uzelf.
- **Medicijnen (eigen schema)** -- Uw eigen medicatieschema en voorraad.
- **Training (eigen schema)** -- Uw eigen trainingsschema en wat u ervan deed.
- **Tijdlijn (terugkijken)** -- Wat er in de tijd met u gebeurd is, gelezen uit de lagen die u al had.
- **Voeding (weekplan)** -- Een weekplan voor wat u wilt eten.
- **Noodkaart** -- Een noodcontact en, als u dat wilt, uw allergenen en middelen.
- **Verzorging (kapper, barbier, nagels)** -- De salonagenda vanaf de kant van het lid, op codenaam.

### Betalen & verificatie

- **Betaalverkeer** -- Betalingen (demo of Stripe) en de RTG Pay-wallet.
- **Passkeys (WebAuthn)** -- Inloggen met vingerafdruk, gezicht of beveiligingssleutel.
- **Identiteitsverificatie (KYC)** -- Leden uploaden hun identiteitsbewijs en RTG beoordeelt het.
- **Paspoort delen (gecontroleerd)** -- Het toestemmingsgestuurde kanaal waarlangs een partner een identiteit opvraagt (ja/nee, ID-kaart of scan), met melding en weigering voor het lid.
- **Vakbewijs indienen** -- Leden leggen de stukken vast die hun werk vraagt (VOG, BIG-registratie, legitimatiebewijs); RTG tekent af dat het stuk is gezien en beoordeelt de inhoud niet.

### Personeel & integraties

- **Rahul doet het (AI-stuur)** -- De AI voert acties uit op elk toegestaan API-pad, met de eigen inlog van wie het vraagt (nooit meer rechten dan de persoon zelf).

### Diensten (leden)

- **Overheidsloket** -- Belasting, toeslagen, rijbewijs, voertuigen, KVK, uitkeringen, bezwaar, subsidies en waterschap in een loket.
- **Gemeenteloket** -- Meldingen, aanvragen en gemeentezaken.
- **Thuis (verhuur en logeren)** -- Advertenties, reviews en boekingen tussen leden onderling.
- **Residentie** -- Het woon- en verblijfsdeel van het platform.
- **Luchtvaart en luchthaven** -- Vluchten, boarding passes en de luchthavendiensten.
- **Reisbureau** -- Reisadvies en het samenstellen van een reis.
- **Zorg en welzijn** -- De zorgkant: intakes, begeleiding en welzijnsdiensten.
- **Agenda** -- De agenda: afspraken, uitnodigingen en planning.
- **RTG Meet (vergaderkamers)** -- Vergaderkamers op codenaam; beeld en geluid lopen peer-to-peer.
- **Navigatie** -- Routes en navigatie onderweg.
- **Reizen boeken** -- Het boeken zelf: aanbod, slots, betalen en de eigen boekingen, inclusief het partnerkanaal voor niet-leden.
- **Verblijf en reserveringen** -- Verblijf, de deur van een kamer, reserveren en het annuleren daarvan.
- **Reiswijzer en landeninfo** -- De wijzer met landen, regels en wat je moet weten voor je gaat.
- **Ritten en transfers** -- Een rit aanvragen en betalen, en de transfer die bij een ticket hoort.
- **Tickets en evenementen** -- Kaarten kopen, uitgaan, aanmelden voor een evenement en de wachtlijst.
- **Bezorgen en vracht** -- Bezorging van mode en goederen, pakketten en het volgen van vracht.
- **Foodcourt** -- Het foodcourt met de vrije tijdsloten van de zaken.
- **Stad en zaakdoos** -- De stadslaag met bewoners, en de hartslag en metingen van een zaakdoos ter plaatse.
- **Partneroverzicht** -- De lijst met aangesloten partners die een lid kan zien.
- **Zorgprofiel** -- Het zorgprofiel van een lid: allergieen en wat een zaak moet weten.
- **Aandacht en voorspellen** -- De aandachtslaag en de vooruitblik op wat een lid waarschijnlijk nodig heeft.
- **Sparren en parkeren** -- De sparlijst: iets parkeren om er later op terug te komen.
- **Invisible Arrival** -- De publieke aankomstpas, voorbereiding en live aankomststatus voor een gast en de ontvangende zaak.

### Cultuur en gezelschap

- **Het Genootschap** -- Het besloten genootschap: kringen, bijeenkomsten en beheer.
- **Sport** -- Sportprogramma's, teams en wedstrijden.
- **Muziek** -- Van lied tot zaal: maken, uitgeven en beluisteren.
- **Galerij** -- De beeldgalerij van leden en partners.
- **Boeken** -- De bibliotheek en het lezen.
- **Fluister** -- De fluisterlijn binnen de sociale laag.
- **De krant** -- De openbare krant: de gids, een uitgave openen en een artikel lezen.

### RTFoundation

- **Living Lab: de bewonerskant** -- Meedoen met een labpas, een onderzoeksvraag aandragen, stemmen en het labpaspoort.

### Winkel en media

- **De Mall** -- De etages en de gids met alle partners.
- **Bestanden (kluis)** -- De persoonlijke bestandenkluis.
- **Notities** -- De notitie-app: losse aantekeningen en lijstjes van een lid.
- **Leden-website** -- De eigen website die een lid of zaak kan bouwen.
- **Eigen domein (buiten het RTG-web)** -- Een eigen adres zoals hotelazur.nl naast hotelazur.rtg.
- **Media-assets** -- Het uitleveren van geuploade media.
- **Home Kit (slim huis)** -- De aansturing van apparaten in huis.
- **Media uitleveren** -- Het uitleveren van geuploade afbeeldingen en bestanden aan de app.
- **Browser** -- De ingebouwde browser met zijn gids.

### Identiteit en veiligheid

- **Storingsmelding uit de browser** -- Meldt een onafgevangen fout aan het logboek: melding, bestand, regel en pagina.
- **RTG iD** -- De digitale identiteit en het delen daarvan.
- **Veiligheidsdiensten** -- De beveiligingskant voor leden en zaken.
- **Grensdiensten (KMar)** -- De grens- en documentcontrole bij reizen.
- **Onboarding** -- De eerste stappen na aanmelden: profiel compleet maken.

### Geld

- **RTG Rekening** -- Saldo, afschriften en betalingen op de eigen rekeninglaag.
- **Uitgaven-inzichten** -- Uitgaven per maand en per soort, en het gezamenlijke afschrift.
- **Vaste-lasten-radar** -- Terugkerende afschrijvingen die vanzelf worden herkend.
- **Spaardoelen** -- Een streefbedrag op een spaarrekening, en het wisselgeld erheen vegen.
- **Rekeningen aanhouden** -- Een eigen betaal-, spaar- of zakelijke rekening met een IBAN.
- **Storten op de rekening** -- Geld op de eigen rekening zetten, via de kaart-naad of eigen emissie.
- **SEPA versturen** -- Een overboeking naar een rekening buiten RTG.
- **Terugkerende betalingen** -- Een vaste overboeking per week of maand.
- **Passen en creditcards** -- Een betaalpas of creditcard op een rekening, met limiet.
- **Krediet en leningen** -- Een lening aanvragen en aflossen; rood staan valt hier ook onder.
- **De AI-bankier** -- Rahul kijkt mee met de rekeningen en geeft advies; hij besluit niets.
- **Wallet** -- De wallet van een lid binnen RTG Pay.
- **Walletsaldo en betalen binnen RTG** -- Saldo aanhouden, opladen, tikken en betaalverzoeken binnen het gesloten RTG-circuit.
- **Betalen en betaalverzoeken** -- Rechtstreeks betalen aan een partner, betaalverzoeken en de betaalopties.
- **Rekening en facturen** -- De openstaande rekening, het afrekenen daarvan en losse facturen.
- **Rekening splitsen** -- Een rekening samen delen en ieders deel betalen.
- **Cadeaukaarten** -- Cadeaukaarten kopen en de eigen kaarten bekijken.
- **Punten en verzilveren** -- Gespaarde punten en het verzilveren daarvan.
- **Pasprijzen en balans** -- De publieke prijslijst van de passen en het balansoverzicht van een lid.

### Toegang en identiteit

- **Inloggen en registreren** -- De voordeur: inloggen, uitloggen, registreren en wachtwoord vergeten.
- **Account en profiel** -- Het eigen account: rollen, koppelingen en het cv van een lid.
- **Inloggen via een andere partij (SSO)** -- De terugkeer van een identiteitsprovider, met de ondertekende state als poort.
- **Pincode en sleutelwoorden** -- De algemene pin voor prive-apps en de sleutelwoord-inlog met zijn uitdaging.
- **Zegel, codes en rechtenbeheer** -- Het RTG-zegel, dynamische codes, scanbare codes en de rechtenlaag op media.
- **De gegevenspoort** -- Het gesprek waarin een lid zelf zijn ontbrekende gegevens aanvult, inclusief het opzoeken van een adres bij postcode en huisnummer.
- **Aanmelden voor een pas** -- Het aanmeldgesprek en de aanmeldingen die daaruit volgen; het besluit blijft mensenwerk.
- **Wervingslink van een werkgever** -- De link /werken/<code> waarmee een werkgever iemand uitnodigt die nog geen account heeft; aanmelden en in dienst treden worden dan een handeling.

---

## Lifestyle -- 143 functies

*Leden met de Lifestyle Pass.*

### Leden (RTG-app)

- **Leden-app (algemeen)** -- Alle ledenfuncties in de RTG-app.
- **Directe berichten (DM)** -- Privéberichten tussen leden onderling.
- **Snaps & 24-uurs verhalen** -- Foto-snaps en verhalen die na 24 uur verdwijnen.
- **Vrienden verbinden** -- Vriendschapsverzoeken en de vriendengraaf tussen leden: zoeken op codenaam, of toevoegen met de eigen contactpin (ook als QR).
- **Vacatures & solliciteren (leden)** -- Leden solliciteren met hun cv op vacatures bij partners.
- **De Rechterhand (Lifestyle-suite)** -- De veertien premium-apps van de Lifestyle Pass: Reisboek, Cellier, Table, Maison, Garde-robe, Mecenaat, Nalatenschap, Logboek, Cercle, Hangar, Entourage, Attenties en Rendez-vous.
- **RTG Zakelijk (professioneel netwerk)** -- De LinkedIn-laag van de Lifestyle en Business Pass: zakelijk profiel, gids, verbinden, feed, aanbevelingen en het kansenbord.
- **RTG Wereld (de ene sociale app)** -- De laag over De Salon, Pulse, RTG Zakelijk, de genootschappen en de verhalen heen: één tijdlijn met een schakelaar (Alles, Lifestyle, Business, Communities, Privé) en de sprong naar de berichten-app.
- **Het Privékantoor (Lifestyle)** -- De ene app van de Lifestyle Pass: de levensgraaf over de premium-apps heen, de Control Tower met alle termijnen, het mandaat (wat mag het kantoor zelf) en zaken met een team en een tijdlijn.
- **De app-staat** -- De ene aanroep waarmee de app zijn hele beeld ophaalt.
- **De live-verbinding** -- De open lijn (SSE) waarover meldingen en verversingen binnenkomen, plus de verbindingsgegevens voor bellen.
- **Meldingen en push** -- De meldingen in de app, de voorkeuren daarvoor en de push naar het toestel.
- **Berichten en gesprekken** -- De chat met de concierge, prive-berichten op codenaam en de groepsklets.
- **Communicatieplatform** -- Het ene gespreksmodel: de inbox met al zijn laden, threads, reacties, zoeken over alles, en @Rahul die opstelt maar nooit verstuurt.
- **Taal en vertaling** -- De talenlijst en het vertalen van schermteksten en berichten.
- **Locatie delen** -- Het delen van de eigen positie onderweg, en het stoppen daarvan.
- **Klok, timer en wekker** -- De klok-app met timers en wekkers.
- **Memo en samenvatten** -- De memo-app en de samenvatting van een opname of transcript.
- **Rahul (de assistent)** -- De assistent zelf: zijn stemming, zijn blik op een scherm en de bibliotheekhulp.
- **App-gids en uitleg** -- De gids die per scherm uitlegt wat je er kunt doen.
- **Waarderen en reageren** -- Likes, reacties, reviews en favorieten door het hele platform.

### Genres & diensten

- **Bestellen & bezorgen** -- Bestellen bij een zaak (ophalen of laten bezorgen) met live volgen.
- **Tickets & activiteiten** -- Tickets kopen met tijdslot en een oplichtende entreecode.
- **Autoverhuur** -- Auto huren met foto's voor/na, borg, SOS-knop en live locatie.
- **Boten & jachten (charter)** -- Vaartuigen charteren met schipper, borg, SOS op zee en live positie.
- **Vastgoed** -- Panden bekijken, interesse tonen of bieden en keyless bezichtigen.
- **Mode & retail** -- De modecatalogus: wishlist, apart leggen en de paskamer.
- **Onderweg (live locatie)** -- Het live onderweg-scherm: positie, ETA en verbonden partners.
- **Contracten (leden tekenen)** -- Digitale contracten die een lid in de app ondertekent.
- **Groothandel & markt** -- De brede B2B/B2C-marktplaats: horeca koopt in, leden bestellen boodschappen, met AI-bijbestellen.

### Sociaal (De Salon)

- **De Salon (feed, volgen, deals)** -- De Salon-tijdlijn: partner-posts volgen, aanbiedingen claimen, polls en de etalage.
- **Salon-ontmoetingen (in de buurt)** -- Wederzijdse connecties die vlakbij zijn spreken veilig af (18+, geverifieerd), met contract, live-locatie naar RTG en SOS.
- **Sociale laag (RTG + RTF)** -- De gedeelde sociale laag: zoeken, verbinden, DM, snaps, verhalen en bellen op codenaam.
- **RTF contacten & familiekoppeling** -- De contactenlaag van de RTFoundation: gezinnen koppelen, kanalen en meldingen tussen leden.

### Eigen apps

- **Spelen (spellen met vrienden)** -- Alle spellen: schaken, dammen, rummi, Magnaat, sudoku en de partyspellen.
- **RTG Podium (live, in zones)** -- Live uitzenden op één motor, in gescheiden werelden: Live (open voor leden), Creator (abonnement en cadeaus), Events (op een kaartje), Besloten (op uitnodiging) en 18+ (geverifieerd paspoort, eigen lijst en eigen wachtrij bij het kantoor).
- **RTG Theater (video)** -- De videobibliotheek op bioscoopniveau, inclusief het Thuisarchief (P2P).
- **RTG Flits (rijscherm)** -- Het rijscherm met meldingen uit het eigen netwerk (flitser, file, ongeval) en de vooruitblik.
- **RTG OV (reizen)** -- Alle vervoer in een app: de kaart, twee snelle check-ins, de dienst-PDA en de routetekenaar.
- **RTG Vervoer (Mobility OS)** -- De vervoerskern: een rit aanvragen en volgen, de vloot en de dispatch van een vervoerder, en de bedrijfspendel.
- **Wie betaalt wat** -- Groepsuitgaven met een live balans en verrekenen via RTG Pay.
- **RTG Geld (financieel besturingssysteem)** -- Het command center over alle gelddomeinen: hoe u ervoor staat, wat eraan komt, uw eigen beleidsregels met reserveringspotten, het actielog en de gegronde Rahul.
- **RTFoundation (levenslijn, mentor en levenspas)** -- De levenslijn met wat er speelt en wat eraan komt, de mentor die opent en nooit stuurt, en de levenspas: wie mag wat van u zien.
- **RTG Sociaal (de kring op een plek)** -- De samenhanglaag over De Salon, berichten, pulse en de ontmoetingen: wat er tussen u en uw kring speelt.
- **RTG Office (kantoorpakket)** -- Het eigen kantoorpakket: tekstdocumenten en rekenbladen op uw account, alleen-lezen te delen op codenaam.
- **RTG Ondernemers-OS** -- Van "ik denk erover na" tot een draaiend bedrijf in een scherm: de verkenning en de stress test, de rechtsvorm en het oprichtingsproject, het dagbeeld met debiteuren, btw, kas en capaciteit, de verkooppijplijn en het bestuur met de UBO-afleiding.
- **RTG Vonk (dating)** -- Dating op codenaam met de Salon-veiligheidslat: 18+, geverifieerd paspoort, een eindige dagselectie, en bij een match automatisch een tafel rond het midden van beide woonplaatsen (EUR 10 p.p., waarvan EUR 5 voor RTG).
- **RTG Media (één mediawereld)** -- De laag die Klankwerk, Theater, Clips en Podium tot één wereld maakt: drie standen (muziek, kijk, flow) op dezelfde catalogus, één makersprofiel, één volgrelatie, één bibliotheek en de eigen smaakregelaars.
- **RTG Clips (korte video’s)** -- Korte verticale video’s die alleen op het toestel van de maker staan (OPFS); kijken is rechtstreeks P2P.
- **RTG Hospitality Guest OS (de gastkant)** -- Bestellen vanaf je eigen telefoon: aan tafel via de QR, op je hotelkamer op de gastrekening, in de club op je polsband, en van huis uit laten bezorgen, afhalen of een foodcourt-mandje bij meer loketten.
- **RTG Evening OS (een avond plannen)** -- Een hele avond als plan: eten, iets drinken en de rit naar huis, binnen je budget en op tijd thuis.
- **RTG Invisible Arrival** -- Een beveiligde aankomstpas voor reservering, capaciteitscontrole en minimale live aankomststatus.
- **RTG Instant Reality** -- De persoonlijke scenario- en eventlaag waarmee een lid een toekomstige ervaring veilig kan verkennen.
- **RTG Life (het ene scherm)** -- Het overzichtsscherm en de dagcoach: ze lezen de lagen hieronder en leggen ze naast elkaar.
- **Doelen** -- Waar u begon, waar u heen wilt en waarom; de mijlpalen worden afgeleid en niet bewaard.
- **Dagmetingen en toestellen** -- Slaap, beweging, water en gewicht, zelf ingevuld of door een gekoppeld toestel weggeschreven.
- **Dagcheck-in (hoe zit u erbij)** -- Een tik per dag, met de keuze om er iets bij te schrijven.
- **Gewoonten** -- Kleine dingen die u vaker wilt doen; de dagenteller staat uit tot u hem zelf aanzet.
- **Gedachtenboek** -- Opschrijven voor uzelf.
- **Medicijnen (eigen schema)** -- Uw eigen medicatieschema en voorraad.
- **Training (eigen schema)** -- Uw eigen trainingsschema en wat u ervan deed.
- **Tijdlijn (terugkijken)** -- Wat er in de tijd met u gebeurd is, gelezen uit de lagen die u al had.
- **Voeding (weekplan)** -- Een weekplan voor wat u wilt eten.
- **Noodkaart** -- Een noodcontact en, als u dat wilt, uw allergenen en middelen.
- **Verzorging (kapper, barbier, nagels)** -- De salonagenda vanaf de kant van het lid, op codenaam.

### Betalen & verificatie

- **Betaalverkeer** -- Betalingen (demo of Stripe) en de RTG Pay-wallet.
- **Passkeys (WebAuthn)** -- Inloggen met vingerafdruk, gezicht of beveiligingssleutel.
- **Identiteitsverificatie (KYC)** -- Leden uploaden hun identiteitsbewijs en RTG beoordeelt het.
- **Paspoort delen (gecontroleerd)** -- Het toestemmingsgestuurde kanaal waarlangs een partner een identiteit opvraagt (ja/nee, ID-kaart of scan), met melding en weigering voor het lid.
- **Vakbewijs indienen** -- Leden leggen de stukken vast die hun werk vraagt (VOG, BIG-registratie, legitimatiebewijs); RTG tekent af dat het stuk is gezien en beoordeelt de inhoud niet.

### Personeel & integraties

- **Rahul doet het (AI-stuur)** -- De AI voert acties uit op elk toegestaan API-pad, met de eigen inlog van wie het vraagt (nooit meer rechten dan de persoon zelf).

### Diensten (leden)

- **Overheidsloket** -- Belasting, toeslagen, rijbewijs, voertuigen, KVK, uitkeringen, bezwaar, subsidies en waterschap in een loket.
- **Gemeenteloket** -- Meldingen, aanvragen en gemeentezaken.
- **Thuis (verhuur en logeren)** -- Advertenties, reviews en boekingen tussen leden onderling.
- **Residentie** -- Het woon- en verblijfsdeel van het platform.
- **Luchtvaart en luchthaven** -- Vluchten, boarding passes en de luchthavendiensten.
- **Reisbureau** -- Reisadvies en het samenstellen van een reis.
- **Zorg en welzijn** -- De zorgkant: intakes, begeleiding en welzijnsdiensten.
- **Agenda** -- De agenda: afspraken, uitnodigingen en planning.
- **RTG Meet (vergaderkamers)** -- Vergaderkamers op codenaam; beeld en geluid lopen peer-to-peer.
- **Navigatie** -- Routes en navigatie onderweg.
- **Reizen boeken** -- Het boeken zelf: aanbod, slots, betalen en de eigen boekingen, inclusief het partnerkanaal voor niet-leden.
- **Verblijf en reserveringen** -- Verblijf, de deur van een kamer, reserveren en het annuleren daarvan.
- **Reiswijzer en landeninfo** -- De wijzer met landen, regels en wat je moet weten voor je gaat.
- **Ritten en transfers** -- Een rit aanvragen en betalen, en de transfer die bij een ticket hoort.
- **Tickets en evenementen** -- Kaarten kopen, uitgaan, aanmelden voor een evenement en de wachtlijst.
- **Bezorgen en vracht** -- Bezorging van mode en goederen, pakketten en het volgen van vracht.
- **Foodcourt** -- Het foodcourt met de vrije tijdsloten van de zaken.
- **Stad en zaakdoos** -- De stadslaag met bewoners, en de hartslag en metingen van een zaakdoos ter plaatse.
- **Partneroverzicht** -- De lijst met aangesloten partners die een lid kan zien.
- **Zorgprofiel** -- Het zorgprofiel van een lid: allergieen en wat een zaak moet weten.
- **Aandacht en voorspellen** -- De aandachtslaag en de vooruitblik op wat een lid waarschijnlijk nodig heeft.
- **Sparren en parkeren** -- De sparlijst: iets parkeren om er later op terug te komen.
- **Invisible Arrival** -- De publieke aankomstpas, voorbereiding en live aankomststatus voor een gast en de ontvangende zaak.

### Cultuur en gezelschap

- **Het Genootschap** -- Het besloten genootschap: kringen, bijeenkomsten en beheer.
- **Sport** -- Sportprogramma's, teams en wedstrijden.
- **Muziek** -- Van lied tot zaal: maken, uitgeven en beluisteren.
- **Galerij** -- De beeldgalerij van leden en partners.
- **Boeken** -- De bibliotheek en het lezen.
- **Fluister** -- De fluisterlijn binnen de sociale laag.
- **De krant** -- De openbare krant: de gids, een uitgave openen en een artikel lezen.

### RTFoundation

- **Living Lab: de bewonerskant** -- Meedoen met een labpas, een onderzoeksvraag aandragen, stemmen en het labpaspoort.

### Winkel en media

- **De Mall** -- De etages en de gids met alle partners.
- **Bestanden (kluis)** -- De persoonlijke bestandenkluis.
- **Notities** -- De notitie-app: losse aantekeningen en lijstjes van een lid.
- **Leden-website** -- De eigen website die een lid of zaak kan bouwen.
- **Eigen domein (buiten het RTG-web)** -- Een eigen adres zoals hotelazur.nl naast hotelazur.rtg.
- **Media-assets** -- Het uitleveren van geuploade media.
- **Home Kit (slim huis)** -- De aansturing van apparaten in huis.
- **Media uitleveren** -- Het uitleveren van geuploade afbeeldingen en bestanden aan de app.
- **Browser** -- De ingebouwde browser met zijn gids.

### Identiteit en veiligheid

- **Storingsmelding uit de browser** -- Meldt een onafgevangen fout aan het logboek: melding, bestand, regel en pagina.
- **RTG iD** -- De digitale identiteit en het delen daarvan.
- **Veiligheidsdiensten** -- De beveiligingskant voor leden en zaken.
- **Grensdiensten (KMar)** -- De grens- en documentcontrole bij reizen.
- **Onboarding** -- De eerste stappen na aanmelden: profiel compleet maken.

### Geld

- **RTG Rekening** -- Saldo, afschriften en betalingen op de eigen rekeninglaag.
- **Uitgaven-inzichten** -- Uitgaven per maand en per soort, en het gezamenlijke afschrift.
- **Vaste-lasten-radar** -- Terugkerende afschrijvingen die vanzelf worden herkend.
- **Spaardoelen** -- Een streefbedrag op een spaarrekening, en het wisselgeld erheen vegen.
- **Rekeningen aanhouden** -- Een eigen betaal-, spaar- of zakelijke rekening met een IBAN.
- **Storten op de rekening** -- Geld op de eigen rekening zetten, via de kaart-naad of eigen emissie.
- **SEPA versturen** -- Een overboeking naar een rekening buiten RTG.
- **Terugkerende betalingen** -- Een vaste overboeking per week of maand.
- **Passen en creditcards** -- Een betaalpas of creditcard op een rekening, met limiet.
- **Krediet en leningen** -- Een lening aanvragen en aflossen; rood staan valt hier ook onder.
- **De AI-bankier** -- Rahul kijkt mee met de rekeningen en geeft advies; hij besluit niets.
- **Wallet** -- De wallet van een lid binnen RTG Pay.
- **Walletsaldo en betalen binnen RTG** -- Saldo aanhouden, opladen, tikken en betaalverzoeken binnen het gesloten RTG-circuit.
- **Betalen en betaalverzoeken** -- Rechtstreeks betalen aan een partner, betaalverzoeken en de betaalopties.
- **Rekening en facturen** -- De openstaande rekening, het afrekenen daarvan en losse facturen.
- **Rekening splitsen** -- Een rekening samen delen en ieders deel betalen.
- **Cadeaukaarten** -- Cadeaukaarten kopen en de eigen kaarten bekijken.
- **Punten en verzilveren** -- Gespaarde punten en het verzilveren daarvan.
- **Pasprijzen en balans** -- De publieke prijslijst van de passen en het balansoverzicht van een lid.

### Toegang en identiteit

- **Inloggen en registreren** -- De voordeur: inloggen, uitloggen, registreren en wachtwoord vergeten.
- **Account en profiel** -- Het eigen account: rollen, koppelingen en het cv van een lid.
- **Inloggen via een andere partij (SSO)** -- De terugkeer van een identiteitsprovider, met de ondertekende state als poort.
- **Pincode en sleutelwoorden** -- De algemene pin voor prive-apps en de sleutelwoord-inlog met zijn uitdaging.
- **Zegel, codes en rechtenbeheer** -- Het RTG-zegel, dynamische codes, scanbare codes en de rechtenlaag op media.
- **De gegevenspoort** -- Het gesprek waarin een lid zelf zijn ontbrekende gegevens aanvult, inclusief het opzoeken van een adres bij postcode en huisnummer.
- **Aanmelden voor een pas** -- Het aanmeldgesprek en de aanmeldingen die daaruit volgen; het besluit blijft mensenwerk.
- **Wervingslink van een werkgever** -- De link /werken/<code> waarmee een werkgever iemand uitnodigt die nog geen account heeft; aanmelden en in dienst treden worden dan een handeling.

---

## Business -- 157 functies

*Leden met de Business Pass (zakelijk).*

### Leden (RTG-app)

- **Leden-app (algemeen)** -- Alle ledenfuncties in de RTG-app.
- **Directe berichten (DM)** -- Privéberichten tussen leden onderling.
- **Snaps & 24-uurs verhalen** -- Foto-snaps en verhalen die na 24 uur verdwijnen.
- **Vrienden verbinden** -- Vriendschapsverzoeken en de vriendengraaf tussen leden: zoeken op codenaam, of toevoegen met de eigen contactpin (ook als QR).
- **Vacatures & solliciteren (leden)** -- Leden solliciteren met hun cv op vacatures bij partners.
- **De Rechterhand (Lifestyle-suite)** -- De veertien premium-apps van de Lifestyle Pass: Reisboek, Cellier, Table, Maison, Garde-robe, Mecenaat, Nalatenschap, Logboek, Cercle, Hangar, Entourage, Attenties en Rendez-vous.
- **RTG Zakelijk (professioneel netwerk)** -- De LinkedIn-laag van de Lifestyle en Business Pass: zakelijk profiel, gids, verbinden, feed, aanbevelingen en het kansenbord.
- **RTG Wereld (de ene sociale app)** -- De laag over De Salon, Pulse, RTG Zakelijk, de genootschappen en de verhalen heen: één tijdlijn met een schakelaar (Alles, Lifestyle, Business, Communities, Privé) en de sprong naar de berichten-app.
- **Het Privékantoor (Lifestyle)** -- De ene app van de Lifestyle Pass: de levensgraaf over de premium-apps heen, de Control Tower met alle termijnen, het mandaat (wat mag het kantoor zelf) en zaken met een team en een tijdlijn.
- **De app-staat** -- De ene aanroep waarmee de app zijn hele beeld ophaalt.
- **De live-verbinding** -- De open lijn (SSE) waarover meldingen en verversingen binnenkomen, plus de verbindingsgegevens voor bellen.
- **Meldingen en push** -- De meldingen in de app, de voorkeuren daarvoor en de push naar het toestel.
- **Berichten en gesprekken** -- De chat met de concierge, prive-berichten op codenaam en de groepsklets.
- **Communicatieplatform** -- Het ene gespreksmodel: de inbox met al zijn laden, threads, reacties, zoeken over alles, en @Rahul die opstelt maar nooit verstuurt.
- **Taal en vertaling** -- De talenlijst en het vertalen van schermteksten en berichten.
- **Locatie delen** -- Het delen van de eigen positie onderweg, en het stoppen daarvan.
- **Klok, timer en wekker** -- De klok-app met timers en wekkers.
- **Memo en samenvatten** -- De memo-app en de samenvatting van een opname of transcript.
- **Rahul (de assistent)** -- De assistent zelf: zijn stemming, zijn blik op een scherm en de bibliotheekhulp.
- **App-gids en uitleg** -- De gids die per scherm uitlegt wat je er kunt doen.
- **Waarderen en reageren** -- Likes, reacties, reviews en favorieten door het hele platform.

### Genres & diensten

- **Bestellen & bezorgen** -- Bestellen bij een zaak (ophalen of laten bezorgen) met live volgen.
- **Tickets & activiteiten** -- Tickets kopen met tijdslot en een oplichtende entreecode.
- **Autoverhuur** -- Auto huren met foto's voor/na, borg, SOS-knop en live locatie.
- **Boten & jachten (charter)** -- Vaartuigen charteren met schipper, borg, SOS op zee en live positie.
- **Vastgoed** -- Panden bekijken, interesse tonen of bieden en keyless bezichtigen.
- **Mode & retail** -- De modecatalogus: wishlist, apart leggen en de paskamer.
- **Onderweg (live locatie)** -- Het live onderweg-scherm: positie, ETA en verbonden partners.
- **Contracten (leden tekenen)** -- Digitale contracten die een lid in de app ondertekent.
- **Groothandel & markt** -- De brede B2B/B2C-marktplaats: horeca koopt in, leden bestellen boodschappen, met AI-bijbestellen.

### Sociaal (De Salon)

- **De Salon (feed, volgen, deals)** -- De Salon-tijdlijn: partner-posts volgen, aanbiedingen claimen, polls en de etalage.
- **Salon-ontmoetingen (in de buurt)** -- Wederzijdse connecties die vlakbij zijn spreken veilig af (18+, geverifieerd), met contract, live-locatie naar RTG en SOS.
- **Sociale laag (RTG + RTF)** -- De gedeelde sociale laag: zoeken, verbinden, DM, snaps, verhalen en bellen op codenaam.
- **RTF contacten & familiekoppeling** -- De contactenlaag van de RTFoundation: gezinnen koppelen, kanalen en meldingen tussen leden.

### Eigen apps

- **Spelen (spellen met vrienden)** -- Alle spellen: schaken, dammen, rummi, Magnaat, sudoku en de partyspellen.
- **RTG Podium (live, in zones)** -- Live uitzenden op één motor, in gescheiden werelden: Live (open voor leden), Creator (abonnement en cadeaus), Events (op een kaartje), Besloten (op uitnodiging) en 18+ (geverifieerd paspoort, eigen lijst en eigen wachtrij bij het kantoor).
- **RTG Theater (video)** -- De videobibliotheek op bioscoopniveau, inclusief het Thuisarchief (P2P).
- **RTG Flits (rijscherm)** -- Het rijscherm met meldingen uit het eigen netwerk (flitser, file, ongeval) en de vooruitblik.
- **RTG OV (reizen)** -- Alle vervoer in een app: de kaart, twee snelle check-ins, de dienst-PDA en de routetekenaar.
- **RTG Vervoer (Mobility OS)** -- De vervoerskern: een rit aanvragen en volgen, de vloot en de dispatch van een vervoerder, en de bedrijfspendel.
- **Wie betaalt wat** -- Groepsuitgaven met een live balans en verrekenen via RTG Pay.
- **RTG Geld (financieel besturingssysteem)** -- Het command center over alle gelddomeinen: hoe u ervoor staat, wat eraan komt, uw eigen beleidsregels met reserveringspotten, het actielog en de gegronde Rahul.
- **RTFoundation (levenslijn, mentor en levenspas)** -- De levenslijn met wat er speelt en wat eraan komt, de mentor die opent en nooit stuurt, en de levenspas: wie mag wat van u zien.
- **RTG Sociaal (de kring op een plek)** -- De samenhanglaag over De Salon, berichten, pulse en de ontmoetingen: wat er tussen u en uw kring speelt.
- **RTG Office (kantoorpakket)** -- Het eigen kantoorpakket: tekstdocumenten en rekenbladen op uw account, alleen-lezen te delen op codenaam.
- **RTG Ondernemers-OS** -- Van "ik denk erover na" tot een draaiend bedrijf in een scherm: de verkenning en de stress test, de rechtsvorm en het oprichtingsproject, het dagbeeld met debiteuren, btw, kas en capaciteit, de verkooppijplijn en het bestuur met de UBO-afleiding.
- **RTG Vonk (dating)** -- Dating op codenaam met de Salon-veiligheidslat: 18+, geverifieerd paspoort, een eindige dagselectie, en bij een match automatisch een tafel rond het midden van beide woonplaatsen (EUR 10 p.p., waarvan EUR 5 voor RTG).
- **RTG Media (één mediawereld)** -- De laag die Klankwerk, Theater, Clips en Podium tot één wereld maakt: drie standen (muziek, kijk, flow) op dezelfde catalogus, één makersprofiel, één volgrelatie, één bibliotheek en de eigen smaakregelaars.
- **RTG Clips (korte video’s)** -- Korte verticale video’s die alleen op het toestel van de maker staan (OPFS); kijken is rechtstreeks P2P.
- **RTG Hospitality Guest OS (de gastkant)** -- Bestellen vanaf je eigen telefoon: aan tafel via de QR, op je hotelkamer op de gastrekening, in de club op je polsband, en van huis uit laten bezorgen, afhalen of een foodcourt-mandje bij meer loketten.
- **RTG Evening OS (een avond plannen)** -- Een hele avond als plan: eten, iets drinken en de rit naar huis, binnen je budget en op tijd thuis.
- **RTG Invisible Arrival** -- Een beveiligde aankomstpas voor reservering, capaciteitscontrole en minimale live aankomststatus.
- **RTG Instant Reality** -- De persoonlijke scenario- en eventlaag waarmee een lid een toekomstige ervaring veilig kan verkennen.
- **RTG Life (het ene scherm)** -- Het overzichtsscherm en de dagcoach: ze lezen de lagen hieronder en leggen ze naast elkaar.
- **Doelen** -- Waar u begon, waar u heen wilt en waarom; de mijlpalen worden afgeleid en niet bewaard.
- **Dagmetingen en toestellen** -- Slaap, beweging, water en gewicht, zelf ingevuld of door een gekoppeld toestel weggeschreven.
- **Dagcheck-in (hoe zit u erbij)** -- Een tik per dag, met de keuze om er iets bij te schrijven.
- **Gewoonten** -- Kleine dingen die u vaker wilt doen; de dagenteller staat uit tot u hem zelf aanzet.
- **Gedachtenboek** -- Opschrijven voor uzelf.
- **Medicijnen (eigen schema)** -- Uw eigen medicatieschema en voorraad.
- **Training (eigen schema)** -- Uw eigen trainingsschema en wat u ervan deed.
- **Tijdlijn (terugkijken)** -- Wat er in de tijd met u gebeurd is, gelezen uit de lagen die u al had.
- **Voeding (weekplan)** -- Een weekplan voor wat u wilt eten.
- **Noodkaart** -- Een noodcontact en, als u dat wilt, uw allergenen en middelen.
- **Verzorging (kapper, barbier, nagels)** -- De salonagenda vanaf de kant van het lid, op codenaam.

### RTG-Backoffice

- **Werk OS (werkruimtes)** -- De werkplek van een organisatie: leden, rollen, startscherm, projecten, kennis, klanten, service, bouw, contracten, IT en besluiten.

### Betalen & verificatie

- **Betaalverkeer** -- Betalingen (demo of Stripe) en de RTG Pay-wallet.
- **Passkeys (WebAuthn)** -- Inloggen met vingerafdruk, gezicht of beveiligingssleutel.
- **Identiteitsverificatie (KYC)** -- Leden uploaden hun identiteitsbewijs en RTG beoordeelt het.
- **Paspoort delen (gecontroleerd)** -- Het toestemmingsgestuurde kanaal waarlangs een partner een identiteit opvraagt (ja/nee, ID-kaart of scan), met melding en weigering voor het lid.
- **Vakbewijs indienen** -- Leden leggen de stukken vast die hun werk vraagt (VOG, BIG-registratie, legitimatiebewijs); RTG tekent af dat het stuk is gezien en beoordeelt de inhoud niet.

### Personeel & integraties

- **Wervingslink (in dienst via een link)** -- De uitnodigingslink van een werkgever: kijken wie je uitnodigt (openbaar, alleen bedrijfsnaam en functie) en jezelf eraan verbinden met je eigen RTG-account.
- **Rahul doet het (AI-stuur)** -- De AI voert acties uit op elk toegestaan API-pad, met de eigen inlog van wie het vraagt (nooit meer rechten dan de persoon zelf).

### Diensten (leden)

- **Overheidsloket** -- Belasting, toeslagen, rijbewijs, voertuigen, KVK, uitkeringen, bezwaar, subsidies en waterschap in een loket.
- **Gemeenteloket** -- Meldingen, aanvragen en gemeentezaken.
- **Thuis (verhuur en logeren)** -- Advertenties, reviews en boekingen tussen leden onderling.
- **Residentie** -- Het woon- en verblijfsdeel van het platform.
- **Luchtvaart en luchthaven** -- Vluchten, boarding passes en de luchthavendiensten.
- **Reisbureau** -- Reisadvies en het samenstellen van een reis.
- **Zorg en welzijn** -- De zorgkant: intakes, begeleiding en welzijnsdiensten.
- **Agenda** -- De agenda: afspraken, uitnodigingen en planning.
- **RTG Meet (vergaderkamers)** -- Vergaderkamers op codenaam; beeld en geluid lopen peer-to-peer.
- **Navigatie** -- Routes en navigatie onderweg.
- **Reizen boeken** -- Het boeken zelf: aanbod, slots, betalen en de eigen boekingen, inclusief het partnerkanaal voor niet-leden.
- **Verblijf en reserveringen** -- Verblijf, de deur van een kamer, reserveren en het annuleren daarvan.
- **Reiswijzer en landeninfo** -- De wijzer met landen, regels en wat je moet weten voor je gaat.
- **Ritten en transfers** -- Een rit aanvragen en betalen, en de transfer die bij een ticket hoort.
- **Tickets en evenementen** -- Kaarten kopen, uitgaan, aanmelden voor een evenement en de wachtlijst.
- **Bezorgen en vracht** -- Bezorging van mode en goederen, pakketten en het volgen van vracht.
- **Foodcourt** -- Het foodcourt met de vrije tijdsloten van de zaken.
- **Stad en zaakdoos** -- De stadslaag met bewoners, en de hartslag en metingen van een zaakdoos ter plaatse.
- **Partneroverzicht** -- De lijst met aangesloten partners die een lid kan zien.
- **Zorgprofiel** -- Het zorgprofiel van een lid: allergieen en wat een zaak moet weten.
- **Aandacht en voorspellen** -- De aandachtslaag en de vooruitblik op wat een lid waarschijnlijk nodig heeft.
- **Sparren en parkeren** -- De sparlijst: iets parkeren om er later op terug te komen.
- **Invisible Arrival** -- De publieke aankomstpas, voorbereiding en live aankomststatus voor een gast en de ontvangende zaak.
- **Instant Reality** -- De controleerbare Business-wereld voor intenties, voorbereiding, providerbewijs en uitzonderingen.

### Cultuur en gezelschap

- **Het Genootschap** -- Het besloten genootschap: kringen, bijeenkomsten en beheer.
- **Sport** -- Sportprogramma's, teams en wedstrijden.
- **Muziek** -- Van lied tot zaal: maken, uitgeven en beluisteren.
- **Galerij** -- De beeldgalerij van leden en partners.
- **Boeken** -- De bibliotheek en het lezen.
- **Fluister** -- De fluisterlijn binnen de sociale laag.
- **De krant** -- De openbare krant: de gids, een uitgave openen en een artikel lezen.

### Werk (zaken en personeel)

- **De werkvloer** -- Tafels, keukenbord en bedieningskaart op de vloer van een zaak.
- **De werkplek** -- Het persoonlijke werkstation van een medewerker.
- **Metier (vakwerk)** -- Het vakwerk van zelfstandigen en ambachtslieden.
- **Vakritmes** -- Werkritmes en tijdregistratie per vak.
- **Verkoop** -- De verkoopkant van een zaak, inclusief proefritten.
- **De zaakdoos** -- De doos op locatie: zaakserver, netwerk en updates.
- **Facturen** -- De facturatie van en naar een zaak.
- **Kantoorgesprek** -- Het gesprek waarmee een zaak zijn kantoor inricht.
- **Werkmail bezorgen** -- De bezorging van interne werkmail.
- **RTG Mail: post van buiten aannemen** -- De buitenpoort die echte e-mail van een vreemde mailserver aanneemt, uitpakt en in het juiste postvak aflevert.

### RTFoundation

- **Living Lab: de bewonerskant** -- Meedoen met een labpas, een onderzoeksvraag aandragen, stemmen en het labpaspoort.

### Winkel en media

- **De Mall** -- De etages en de gids met alle partners.
- **Bestanden (kluis)** -- De persoonlijke bestandenkluis.
- **Notities** -- De notitie-app: losse aantekeningen en lijstjes van een lid.
- **Leden-website** -- De eigen website die een lid of zaak kan bouwen.
- **Eigen domein (buiten het RTG-web)** -- Een eigen adres zoals hotelazur.nl naast hotelazur.rtg.
- **Media-assets** -- Het uitleveren van geuploade media.
- **Home Kit (slim huis)** -- De aansturing van apparaten in huis.
- **Media uitleveren** -- Het uitleveren van geuploade afbeeldingen en bestanden aan de app.
- **Browser** -- De ingebouwde browser met zijn gids.

### Identiteit en veiligheid

- **Storingsmelding uit de browser** -- Meldt een onafgevangen fout aan het logboek: melding, bestand, regel en pagina.
- **RTG iD** -- De digitale identiteit en het delen daarvan.
- **Veiligheidsdiensten** -- De beveiligingskant voor leden en zaken.
- **Grensdiensten (KMar)** -- De grens- en documentcontrole bij reizen.
- **Onboarding** -- De eerste stappen na aanmelden: profiel compleet maken.

### Geld

- **RTG Rekening** -- Saldo, afschriften en betalingen op de eigen rekeninglaag.
- **Uitgaven-inzichten** -- Uitgaven per maand en per soort, en het gezamenlijke afschrift.
- **Vaste-lasten-radar** -- Terugkerende afschrijvingen die vanzelf worden herkend.
- **Spaardoelen** -- Een streefbedrag op een spaarrekening, en het wisselgeld erheen vegen.
- **Rekeningen aanhouden** -- Een eigen betaal-, spaar- of zakelijke rekening met een IBAN.
- **Storten op de rekening** -- Geld op de eigen rekening zetten, via de kaart-naad of eigen emissie.
- **SEPA versturen** -- Een overboeking naar een rekening buiten RTG.
- **Terugkerende betalingen** -- Een vaste overboeking per week of maand.
- **Passen en creditcards** -- Een betaalpas of creditcard op een rekening, met limiet.
- **Krediet en leningen** -- Een lening aanvragen en aflossen; rood staan valt hier ook onder.
- **Zakelijk bankieren** -- Bulkbetalingen en de salarisrun vanaf een zakelijke rekening.
- **De AI-bankier** -- Rahul kijkt mee met de rekeningen en geeft advies; hij besluit niets.
- **Wallet** -- De wallet van een lid binnen RTG Pay.
- **Walletsaldo en betalen binnen RTG** -- Saldo aanhouden, opladen, tikken en betaalverzoeken binnen het gesloten RTG-circuit.
- **Betalen en betaalverzoeken** -- Rechtstreeks betalen aan een partner, betaalverzoeken en de betaalopties.
- **Rekening en facturen** -- De openstaande rekening, het afrekenen daarvan en losse facturen.
- **Rekening splitsen** -- Een rekening samen delen en ieders deel betalen.
- **Cadeaukaarten** -- Cadeaukaarten kopen en de eigen kaarten bekijken.
- **Punten en verzilveren** -- Gespaarde punten en het verzilveren daarvan.
- **Pasprijzen en balans** -- De publieke prijslijst van de passen en het balansoverzicht van een lid.

### Toegang en identiteit

- **Inloggen en registreren** -- De voordeur: inloggen, uitloggen, registreren en wachtwoord vergeten.
- **Account en profiel** -- Het eigen account: rollen, koppelingen en het cv van een lid.
- **Inloggen via een andere partij (SSO)** -- De terugkeer van een identiteitsprovider, met de ondertekende state als poort.
- **Pincode en sleutelwoorden** -- De algemene pin voor prive-apps en de sleutelwoord-inlog met zijn uitdaging.
- **Zegel, codes en rechtenbeheer** -- Het RTG-zegel, dynamische codes, scanbare codes en de rechtenlaag op media.
- **De gegevenspoort** -- Het gesprek waarin een lid zelf zijn ontbrekende gegevens aanvult, inclusief het opzoeken van een adres bij postcode en huisnummer.
- **Aanmelden voor een pas** -- Het aanmeldgesprek en de aanmeldingen die daaruit volgen; het besluit blijft mensenwerk.
- **Wervingslink van een werkgever** -- De link /werken/<code> waarmee een werkgever iemand uitnodigt die nog geen account heeft; aanmelden en in dienst treden worden dan een handeling.

---

## Personeel -- 42 functies

*Medewerkers in de personeels-app (PDA).*

### Eigen apps

- **RTG Flits (rijscherm)** -- Het rijscherm met meldingen uit het eigen netwerk (flitser, file, ongeval) en de vooruitblik.
- **RTG OV (reizen)** -- Alle vervoer in een app: de kaart, twee snelle check-ins, de dienst-PDA en de routetekenaar.
- **RTG Vervoer (Mobility OS)** -- De vervoerskern: een rit aanvragen en volgen, de vloot en de dispatch van een vervoerder, en de bedrijfspendel.
- **RTG Eye (werkvloer-camera)** -- De camerablik van de werkvloer: voertuigschouw en het handsfree uitgifteregister.

### RTG-Backoffice

- **Werk OS (werkruimtes)** -- De werkplek van een organisatie: leden, rollen, startscherm, projecten, kennis, klanten, service, bouw, contracten, IT en besluiten.

### Personeel & integraties

- **Personeels-app (PDA)** -- De personeels-app: rooster, klokken, verlof/ziek, taken, team en de vertrouwenspersoon.
- **Wervingslink (in dienst via een link)** -- De uitnodigingslink van een werkgever: kijken wie je uitnodigt (openbaar, alleen bedrijfsnaam en functie) en jezelf eraan verbinden met je eigen RTG-account.
- **Rahul doet het (AI-stuur)** -- De AI voert acties uit op elk toegestaan API-pad, met de eigen inlog van wie het vraagt (nooit meer rechten dan de persoon zelf).

### Werk (zaken en personeel)

- **De werkvloer** -- Tafels, keukenbord en bedieningskaart op de vloer van een zaak.
- **De werkplek** -- Het persoonlijke werkstation van een medewerker.
- **Metier (vakwerk)** -- Het vakwerk van zelfstandigen en ambachtslieden.
- **Vakritmes** -- Werkritmes en tijdregistratie per vak.
- **Verkoop** -- De verkoopkant van een zaak, inclusief proefritten.
- **De zaakdoos** -- De doos op locatie: zaakserver, netwerk en updates.
- **Facturen** -- De facturatie van en naar een zaak.
- **Kantoorgesprek** -- Het gesprek waarmee een zaak zijn kantoor inricht.
- **Werkmail bezorgen** -- De bezorging van interne werkmail.
- **RTG Mail: post van buiten aannemen** -- De buitenpoort die echte e-mail van een vreemde mailserver aanneemt, uitpakt en in het juiste postvak aflevert.

### RTFoundation

- **Living Lab: de bewonerskant** -- Meedoen met een labpas, een onderzoeksvraag aandragen, stemmen en het labpaspoort.

### Winkel en media

- **Media-assets** -- Het uitleveren van geuploade media.
- **Media uitleveren** -- Het uitleveren van geuploade afbeeldingen en bestanden aan de app.

### Identiteit en veiligheid

- **Storingsmelding uit de browser** -- Meldt een onafgevangen fout aan het logboek: melding, bestand, regel en pagina.
- **RTG iD** -- De digitale identiteit en het delen daarvan.
- **Onboarding** -- De eerste stappen na aanmelden: profiel compleet maken.

### Toegang en identiteit

- **Inloggen en registreren** -- De voordeur: inloggen, uitloggen, registreren en wachtwoord vergeten.
- **Account en profiel** -- Het eigen account: rollen, koppelingen en het cv van een lid.
- **Inloggen via een andere partij (SSO)** -- De terugkeer van een identiteitsprovider, met de ondertekende state als poort.
- **Pincode en sleutelwoorden** -- De algemene pin voor prive-apps en de sleutelwoord-inlog met zijn uitdaging.
- **Zegel, codes en rechtenbeheer** -- Het RTG-zegel, dynamische codes, scanbare codes en de rechtenlaag op media.
- **De gegevenspoort** -- Het gesprek waarin een lid zelf zijn ontbrekende gegevens aanvult, inclusief het opzoeken van een adres bij postcode en huisnummer.
- **Aanmelden voor een pas** -- Het aanmeldgesprek en de aanmeldingen die daaruit volgen; het besluit blijft mensenwerk.
- **Wervingslink van een werkgever** -- De link /werken/<code> waarmee een werkgever iemand uitnodigt die nog geen account heeft; aanmelden en in dienst treden worden dan een handeling.

### Leden (RTG-app)

- **De app-staat** -- De ene aanroep waarmee de app zijn hele beeld ophaalt.
- **De live-verbinding** -- De open lijn (SSE) waarover meldingen en verversingen binnenkomen, plus de verbindingsgegevens voor bellen.
- **Meldingen en push** -- De meldingen in de app, de voorkeuren daarvoor en de push naar het toestel.
- **Berichten en gesprekken** -- De chat met de concierge, prive-berichten op codenaam en de groepsklets.
- **Communicatieplatform** -- Het ene gespreksmodel: de inbox met al zijn laden, threads, reacties, zoeken over alles, en @Rahul die opstelt maar nooit verstuurt.
- **Taal en vertaling** -- De talenlijst en het vertalen van schermteksten en berichten.
- **Rahul (de assistent)** -- De assistent zelf: zijn stemming, zijn blik op een scherm en de bibliotheekhulp.
- **App-gids en uitleg** -- De gids die per scherm uitlegt wat je er kunt doen.

### Geld

- **Pasprijzen en balans** -- De publieke prijslijst van de passen en het balansoverzicht van een lid.

### Diensten (leden)

- **Invisible Arrival** -- De publieke aankomstpas, voorbereiding en live aankomststatus voor een gast en de ontvangende zaak.

---

## Leveranciers -- 54 functies

*Partners en hun personeel in de partner-app.*

### Genres & diensten

- **Groothandel & markt** -- De brede B2B/B2C-marktplaats: horeca koopt in, leden bestellen boodschappen, met AI-bijbestellen.

### Eigen apps

- **RTG OV (reizen)** -- Alle vervoer in een app: de kaart, twee snelle check-ins, de dienst-PDA en de routetekenaar.
- **RTG Vervoer (Mobility OS)** -- De vervoerskern: een rit aanvragen en volgen, de vloot en de dispatch van een vervoerder, en de bedrijfspendel.
- **RTG Eye (werkvloer-camera)** -- De camerablik van de werkvloer: voertuigschouw en het handsfree uitgifteregister.
- **Ghost Driver (simulatie)** -- De voorspellende verkeers- en logistieksimulatie.

### Partners (leveranciers)

- **Partner-app (algemeen)** -- Alle leveranciersfuncties.
- **Kassa (POS)** -- Het kassascherm per sector: afrekenen en RTG-code innen.
- **Partner-Salon (marketing)** -- Het bedrijfsprofiel op De Salon: posts, aanbiedingen, polls en volgers.
- **Events & mise-en-place** -- Eventkeuken, menukeuze met allergenen en de mise-en-place-planner.
- **Financiën & AI-boekhouder** -- Dagcijfers, btw per genre/land en de AI-boekhouder van de zaak.
- **Kamers & slimme deuren (hotel)** -- Hotelkamers, housekeeping en de app-bediende deuren.
- **Ritten & vloot (vervoer)** -- Taxi- en jetritten accepteren en de vloot beheren.
- **Sollicitaties bij partners** -- Vacatures uitzetten en sollicitaties ontvangen bij de partner.
- **Regie: zien & op de lijst zetten** -- De stand van de eigen zaak, de zoekbalk erover, het objectdossier en de uitzonderingenrij -- ook op de PDA van de vloer.
- **Regie: rechtzetten & regels** -- Administratieve drift rechtzetten, een ronde terugdraaien, de eigen grenzen zetten en het spoor van de zaak lezen.

### RTG-Backoffice

- **Werk OS (werkruimtes)** -- De werkplek van een organisatie: leden, rollen, startscherm, projecten, kennis, klanten, service, bouw, contracten, IT en besluiten.

### Betalen & verificatie

- **Paspoort delen (gecontroleerd)** -- Het toestemmingsgestuurde kanaal waarlangs een partner een identiteit opvraagt (ja/nee, ID-kaart of scan), met melding en weigering voor het lid.

### Personeel & integraties

- **Wervingslink (in dienst via een link)** -- De uitnodigingslink van een werkgever: kijken wie je uitnodigt (openbaar, alleen bedrijfsnaam en functie) en jezelf eraan verbinden met je eigen RTG-account.
- **Rahul doet het (AI-stuur)** -- De AI voert acties uit op elk toegestaan API-pad, met de eigen inlog van wie het vraagt (nooit meer rechten dan de persoon zelf).

### Werk (zaken en personeel)

- **De werkvloer** -- Tafels, keukenbord en bedieningskaart op de vloer van een zaak.
- **De werkplek** -- Het persoonlijke werkstation van een medewerker.
- **Metier (vakwerk)** -- Het vakwerk van zelfstandigen en ambachtslieden.
- **Vakritmes** -- Werkritmes en tijdregistratie per vak.
- **Verkoop** -- De verkoopkant van een zaak, inclusief proefritten.
- **De zaakdoos** -- De doos op locatie: zaakserver, netwerk en updates.
- **Facturen** -- De facturatie van en naar een zaak.
- **Kantoorgesprek** -- Het gesprek waarmee een zaak zijn kantoor inricht.
- **Werkmail bezorgen** -- De bezorging van interne werkmail.
- **RTG Mail: post van buiten aannemen** -- De buitenpoort die echte e-mail van een vreemde mailserver aanneemt, uitpakt en in het juiste postvak aflevert.

### RTFoundation

- **Living Lab: de bewonerskant** -- Meedoen met een labpas, een onderzoeksvraag aandragen, stemmen en het labpaspoort.

### Winkel en media

- **Media-assets** -- Het uitleveren van geuploade media.
- **Media uitleveren** -- Het uitleveren van geuploade afbeeldingen en bestanden aan de app.

### Identiteit en veiligheid

- **Storingsmelding uit de browser** -- Meldt een onafgevangen fout aan het logboek: melding, bestand, regel en pagina.
- **RTG iD** -- De digitale identiteit en het delen daarvan.
- **Onboarding** -- De eerste stappen na aanmelden: profiel compleet maken.

### Geld

- **Partnersaldo uitbetalen** -- Het RTG Pay-saldo van een zaak naar zijn bankrekening sturen.
- **Pasprijzen en balans** -- De publieke prijslijst van de passen en het balansoverzicht van een lid.

### Toegang en identiteit

- **Inloggen en registreren** -- De voordeur: inloggen, uitloggen, registreren en wachtwoord vergeten.
- **Account en profiel** -- Het eigen account: rollen, koppelingen en het cv van een lid.
- **Inloggen via een andere partij (SSO)** -- De terugkeer van een identiteitsprovider, met de ondertekende state als poort.
- **Pincode en sleutelwoorden** -- De algemene pin voor prive-apps en de sleutelwoord-inlog met zijn uitdaging.
- **Zegel, codes en rechtenbeheer** -- Het RTG-zegel, dynamische codes, scanbare codes en de rechtenlaag op media.
- **De gegevenspoort** -- Het gesprek waarin een lid zelf zijn ontbrekende gegevens aanvult, inclusief het opzoeken van een adres bij postcode en huisnummer.
- **Aanmelden voor een pas** -- Het aanmeldgesprek en de aanmeldingen die daaruit volgen; het besluit blijft mensenwerk.
- **Wervingslink van een werkgever** -- De link /werken/<code> waarmee een werkgever iemand uitnodigt die nog geen account heeft; aanmelden en in dienst treden worden dan een handeling.

### Leden (RTG-app)

- **De app-staat** -- De ene aanroep waarmee de app zijn hele beeld ophaalt.
- **De live-verbinding** -- De open lijn (SSE) waarover meldingen en verversingen binnenkomen, plus de verbindingsgegevens voor bellen.
- **Meldingen en push** -- De meldingen in de app, de voorkeuren daarvoor en de push naar het toestel.
- **Berichten en gesprekken** -- De chat met de concierge, prive-berichten op codenaam en de groepsklets.
- **Communicatieplatform** -- Het ene gespreksmodel: de inbox met al zijn laden, threads, reacties, zoeken over alles, en @Rahul die opstelt maar nooit verstuurt.
- **Taal en vertaling** -- De talenlijst en het vertalen van schermteksten en berichten.
- **Rahul (de assistent)** -- De assistent zelf: zijn stemming, zijn blik op een scherm en de bibliotheekhulp.
- **App-gids en uitleg** -- De gids die per scherm uitlegt wat je er kunt doen.

### Diensten (leden)

- **Invisible Arrival** -- De publieke aankomstpas, voorbereiding en live aankomststatus voor een gast en de ontvangende zaak.

---

## Foundation -- 48 functies

*Gezinnen, leerlingen en scholen in de RTF-app.*

### Sociaal (De Salon)

- **Sociale laag (RTG + RTF)** -- De gedeelde sociale laag: zoeken, verbinden, DM, snaps, verhalen en bellen op codenaam.
- **RTF contacten & familiekoppeling** -- De contactenlaag van de RTFoundation: gezinnen koppelen, kanalen en meldingen tussen leden.

### Eigen apps

- **Spelen (spellen met vrienden)** -- Alle spellen: schaken, dammen, rummi, Magnaat, sudoku en de partyspellen.
- **RTFoundation (levenslijn, mentor en levenspas)** -- De levenslijn met wat er speelt en wat eraan komt, de mentor die opent en nooit stuurt, en de levenspas: wie mag wat van u zien.

### RTFoundation

- **RTFoundation-app (onderwijs)** -- De gratis onderwijs-app: live schoolbord, leerling-schrift en de AI-bijleshulp.
- **RTF School (scholen & leraren)** -- Het schoolkanaal: klassen, rooster, huiswerk, cijfers, ziekmelden en berichten met de leraar.
- **Vacatures & solliciteren (RTF)** -- De vacature- en sollicitatielaag binnen de RTFoundation-app.
- **Het RTF-kantoor** -- Het eigen kantoor van de stichting: kamers, clubs en het onderzoekslab.
- **Foundation OS** -- Steden, partnerstichtingen, projecten, vrijwilligers, geld, hulpvragen en verantwoording.
- **Het Onderzoekslab** -- Projecten, fases, bevindingen en de kennisbank van het lab.
- **Het RTF Living Lab** -- De onderzoekscyclus, de ethieklaag, de bewijsmotor, de apparatuur en de pijplijn naar verandering.
- **Living Lab: de bewonerskant** -- Meedoen met een labpas, een onderzoeksvraag aandragen, stemmen en het labpaspoort.
- **Het labfonds** -- De financiering van onderzoeksprojecten.
- **Samen (stadsraad)** -- De gezamenlijke uitslagen en besluiten met stadspartners.
- **Klaslokaal (lesmaker)** -- De live les: klascode, vragen en antwoorden.
- **Leerstof** -- Het lesmateriaal achter het onderwijs.
- **Onderwijs (paspoort en ladder)** -- Inschrijven, het leerpaspoort en de leerladder.
- **Bijles** -- Het bijlesgesprek met de begeleider.

### Diensten (leden)

- **Agenda** -- De agenda: afspraken, uitnodigingen en planning.
- **Invisible Arrival** -- De publieke aankomstpas, voorbereiding en live aankomststatus voor een gast en de ontvangende zaak.

### Cultuur en gezelschap

- **Sport** -- Sportprogramma's, teams en wedstrijden.
- **Muziek** -- Van lied tot zaal: maken, uitgeven en beluisteren.
- **Boeken** -- De bibliotheek en het lezen.

### Winkel en media

- **Bestanden (kluis)** -- De persoonlijke bestandenkluis.
- **Notities** -- De notitie-app: losse aantekeningen en lijstjes van een lid.
- **Media-assets** -- Het uitleveren van geuploade media.
- **Media uitleveren** -- Het uitleveren van geuploade afbeeldingen en bestanden aan de app.

### Identiteit en veiligheid

- **Storingsmelding uit de browser** -- Meldt een onafgevangen fout aan het logboek: melding, bestand, regel en pagina.
- **RTG iD** -- De digitale identiteit en het delen daarvan.
- **Onboarding** -- De eerste stappen na aanmelden: profiel compleet maken.

### Toegang en identiteit

- **Inloggen en registreren** -- De voordeur: inloggen, uitloggen, registreren en wachtwoord vergeten.
- **Account en profiel** -- Het eigen account: rollen, koppelingen en het cv van een lid.
- **Inloggen via een andere partij (SSO)** -- De terugkeer van een identiteitsprovider, met de ondertekende state als poort.
- **Pincode en sleutelwoorden** -- De algemene pin voor prive-apps en de sleutelwoord-inlog met zijn uitdaging.
- **Zegel, codes en rechtenbeheer** -- Het RTG-zegel, dynamische codes, scanbare codes en de rechtenlaag op media.
- **De gegevenspoort** -- Het gesprek waarin een lid zelf zijn ontbrekende gegevens aanvult, inclusief het opzoeken van een adres bij postcode en huisnummer.
- **Aanmelden voor een pas** -- Het aanmeldgesprek en de aanmeldingen die daaruit volgen; het besluit blijft mensenwerk.
- **Wervingslink van een werkgever** -- De link /werken/<code> waarmee een werkgever iemand uitnodigt die nog geen account heeft; aanmelden en in dienst treden worden dan een handeling.

### Leden (RTG-app)

- **De app-staat** -- De ene aanroep waarmee de app zijn hele beeld ophaalt.
- **De live-verbinding** -- De open lijn (SSE) waarover meldingen en verversingen binnenkomen, plus de verbindingsgegevens voor bellen.
- **Meldingen en push** -- De meldingen in de app, de voorkeuren daarvoor en de push naar het toestel.
- **Berichten en gesprekken** -- De chat met de concierge, prive-berichten op codenaam en de groepsklets.
- **Communicatieplatform** -- Het ene gespreksmodel: de inbox met al zijn laden, threads, reacties, zoeken over alles, en @Rahul die opstelt maar nooit verstuurt.
- **Taal en vertaling** -- De talenlijst en het vertalen van schermteksten en berichten.
- **Klok, timer en wekker** -- De klok-app met timers en wekkers.
- **Rahul (de assistent)** -- De assistent zelf: zijn stemming, zijn blik op een scherm en de bibliotheekhulp.
- **App-gids en uitleg** -- De gids die per scherm uitlegt wat je er kunt doen.

### Geld

- **Pasprijzen en balans** -- De publieke prijslijst van de passen en het balansoverzicht van een lid.

---

## RTG intern -- 20 functies

*De RTG-backoffice en integraties (intern).*

### Eigen apps

- **Ghost Driver (simulatie)** -- De voorspellende verkeers- en logistieksimulatie.
- **RTG One** -- De bestuurlijke regielaag voor intenties, beloften, overdracht, goedkeuringen, projecten en herstelbare automatisering.

### RTG-Backoffice

- **Backoffice (algemeen)** -- Het RTG-actiecentrum: orders, ritten, prestaties, verificaties en partneraanvragen.
- **Schoolgoedkeuring (RTF School)** -- Scholen goedkeuren of afwijzen voordat ze personeel en klassen kunnen aanmaken.
- **RTG Command: zien** -- De puls van alle domeinen, de zoekbalk over alles en het objectdossier met zijn tijdlijn.
- **RTG Command: doen** -- De operator, de runbooks en de uitzonderingenrij: herstellen en afhandelen.
- **RTG Command: besturen** -- Beleidsregels zetten, simuleren, agents begrenzen en zware rechten tijdelijk uitdelen.
- **Werk OS (werkruimtes)** -- De werkplek van een organisatie: leden, rollen, startscherm, projecten, kennis, klanten, service, bouw, contracten, IT en besluiten.

### Personeel & integraties

- **Wervingslink (in dienst via een link)** -- De uitnodigingslink van een werkgever: kijken wie je uitnodigt (openbaar, alleen bedrijfsnaam en functie) en jezelf eraan verbinden met je eigen RTG-account.

### Werk (zaken en personeel)

- **De werkvloer** -- Tafels, keukenbord en bedieningskaart op de vloer van een zaak.
- **De werkplek** -- Het persoonlijke werkstation van een medewerker.
- **Metier (vakwerk)** -- Het vakwerk van zelfstandigen en ambachtslieden.
- **Vakritmes** -- Werkritmes en tijdregistratie per vak.
- **Verkoop** -- De verkoopkant van een zaak, inclusief proefritten.
- **De zaakdoos** -- De doos op locatie: zaakserver, netwerk en updates.
- **Facturen** -- De facturatie van en naar een zaak.
- **Kantoorgesprek** -- Het gesprek waarmee een zaak zijn kantoor inricht.
- **RTG One** -- Het enterprise-commandocentrum met beloften, intenties, overdracht, frictie en gecontroleerde automatisering.
- **Werkmail bezorgen** -- De bezorging van interne werkmail.
- **RTG Mail: post van buiten aannemen** -- De buitenpoort die echte e-mail van een vreemde mailserver aanneemt, uitpakt en in het juiste postvak aflevert.

