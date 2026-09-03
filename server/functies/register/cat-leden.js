/* Functiecatalogus, deel "leden" (server/functies/register): de eerste drie
   categorieen - Leden (RTG-app), Genres & diensten en Sociaal (De Salon).
   Verbatim afgesplitst uit register.js; de leden-groepen komen uit
   ./doelgroepen. standaard: true = de functie staat normaal aan. */
const { LEDEN, LEDEN_RTF, LEDEN_GAST } = require('./doelgroepen');

module.exports = [
  // ---- Leden (RTG-app) ----
  { id: 'member', categorie: 'Leden (RTG-app)', naam: 'Leden-app (algemeen)', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Alle ledenfuncties in de RTG-app. Zet je dit uit, dan valt de hele ledenkant stil (behalve wat hieronder apart aan staat).', paden: ['/api/member'] },
  { id: 'member-dm', categorie: 'Leden (RTG-app)', naam: 'Directe berichten (DM)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Privéberichten tussen leden onderling.', paden: ['/api/member/dm'] },
  { id: 'member-snaps', categorie: 'Leden (RTG-app)', naam: 'Snaps & 24-uurs verhalen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Foto-snaps en verhalen die na 24 uur verdwijnen.', paden: ['/api/member/snap', '/api/member/story'] },
  { id: 'member-connect', categorie: 'Leden (RTG-app)', naam: 'Vrienden verbinden', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Vriendschapsverzoeken en de vriendengraaf tussen leden: zoeken op codenaam, of toevoegen met de eigen contactpin (ook als QR).', paden: ['/api/member/connect', '/api/member/pin'] },
  { id: 'member-werk', categorie: 'Leden (RTG-app)', naam: 'Vacatures & solliciteren (leden)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Leden solliciteren met hun cv op vacatures bij partners.', paden: ['/api/member/apply'] },
  /* DE RECHTERHAND STOND NERGENS IN DIT REGISTER, en dat maakte elke meting van
     "wat krijgt Lifestyle" onwaar. De veertien apps van de suite -- Reisboek,
     Cellier, Table, Maison, Garde-robe, Mecenaat, Nalatenschap, Logboek,
     Cercle, Hangar, Entourage, Attenties, Rendez-vous en de Rechterhand zelf --
     worden op de server WEL afgedwongen (routes/member/rechterhand.js weigert
     iedereen die geen lifestyle of business is), maar hun paden vielen onder
     `member` hierboven. Dat is de generieke ledenfunctie, en die draagt
     rtg + gast. Het bord zei dus dat een RTG-pas dit heeft terwijl de route 403
     gaf, GROEPEN.md telde nul functies die alleen Lifestyle heeft, en de enige
     knop die de suite kon raken was de knop die de hele ledenapp uitzet.

     Langste prefix wint (functies/toegang.js), dus deze regel neemt het van
     `member` over zodra hij hier staat. Er verandert niets aan wie er binnenkomt
     -- de route deed dat al -- alleen zegt het register nu hetzelfde. */
  /* `apps` STAAT ER OMDAT HET ELDERS AL STOND. De client houdt in
     apps/app-main-24a3.js een eigen `PREMIUM`-set met precies deze veertien
     sleutels, om ze bij een RTG-pas uit de mappen en uit Spotlight te houden.
     Dat is een tweede lijst over hetzelfde (LAT.md regel 4), en zolang die
     twee elkaar niet kenden kon er een app bijkomen die de server wel weigert
     en de client wel toont, of andersom. Hij staat nu HIER, en
     test/wereldregister.test.js legt de twee naast elkaar. */
  { id: 'rechterhand', categorie: 'Leden (RTG-app)', naam: 'De Rechterhand (Lifestyle-suite)', standaard: true, doelgroepen: ['lifestyle', 'business'],
    apps: ['rechterhand', 'reisboek', 'cellier', 'table', 'maison', 'garderobe', 'mecenaat',
      'nalatenschap', 'logboek', 'cercle', 'hangar', 'entourage', 'attenties', 'rendezvous'],
    uitleg: 'De veertien premium-apps van de Lifestyle Pass: Reisboek, Cellier, Table, Maison, Garde-robe, Mecenaat, Nalatenschap, Logboek, Cercle, Hangar, Entourage, Attenties en Rendez-vous. Uit = de hele suite is dicht; de rest van de ledenapp blijft draaien.', paden: ['/api/member/rechterhand', '/api/member/rendezvous'] },
  { id: 'zakelijk', categorie: 'Leden (RTG-app)', naam: 'RTG Zakelijk (professioneel netwerk)', standaard: true, doelgroepen: ['lifestyle', 'business'],
    uitleg: 'De LinkedIn-laag van de Lifestyle en Business Pass: zakelijk profiel, gids, verbinden, feed, aanbevelingen en het kansenbord.', paden: ['/api/zakelijk'] },
  { id: 'wereld', categorie: 'Leden (RTG-app)', naam: 'RTG Wereld (de ene sociale app)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De laag over De Salon, Pulse, RTG Zakelijk, de genootschappen en de verhalen heen: één tijdlijn met een schakelaar (Alles, Lifestyle, Business, Communities, Privé) en de sprong naar de berichten-app. Uit zetten laat de vijf onderliggende apps gewoon staan; alleen de verbindende laag verdwijnt -- net als bij de Media OS.',
    paden: ['/api/wereld'] },
  /* RTG SERVICE STOND HIER NIET, en daarmee viel de hele hulplijn buiten de
     boardroom: niet uit te zetten, niet per stad te sluiten, en de
     storingswachter greep er nooit op in. Gevonden door de volle suite te
     draaien (test/schakelkast-dekking.test.js), niet door te lezen -- precies
     het gat dat die toets beschrijft als "stap twee wordt vergeten".

     DRIE FUNCTIES EN GEEN EEN, want ze schakelen verschillende dingen. `service`
     is de hele ledenkant van de hulplijn; `service-bel` is de STEM en hoort bij
     Lifestyle en Business (SERVICE.md par. 13, en dat is de ladder en geen
     weglating); `ondertiteling` staat los omdat hij door elk gesprek in dit huis
     wordt gebruikt en niet alleen door de hulplijn.

     WAT ER GEBEURT ALS IEMAND `service` UITZET: een lid kan niets melden en niet
     om een mens vragen. Dat is een zware knop, en de uitleg zegt dat -- de
     ondergrens uit kern/service/mens.js is dan weg. */
  { id: 'service', categorie: 'Leden (RTG-app)', naam: 'RTG Service (hulp vragen)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De hulplijn van een lid: iets melden vanuit het scherm waar je stond, je lopende zaken zien, een medewerker toegang bevestigen, en om een MENS vragen. Uit zetten sluit die weg helemaal -- ook de ondergrens dat elk lid bij een mens kan uitkomen.',
    paden: ['/api/service'] },
  { id: 'service-bel', categorie: 'Leden (RTG-app)', naam: 'Bellen met RTG (in de app)', standaard: true, doelgroepen: ['lifestyle', 'business'],
    uitleg: 'Bellen met RTG Service binnen de app, zonder telefoonnet en zonder nummer. Hoort bij de Lifestyle en Business Pass; om een mens vragen blijft voor elk account bestaan en gaat hier niet mee uit.',
    paden: ['/api/service/bel'] },
  { id: 'ondertiteling', categorie: 'Leden (RTG-app)', naam: 'Automatisch ondertitelen in een gesprek', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Een deelnemer laat zijn eigen stem omzetten naar tekst met een LOKAAL model; de regel komt in de meeleesbaan van het gesprek. Uit zetten laat die baan staan -- meetypen blijft werken -- maar wie doof is is dan weer afhankelijk van de anderen.',
    paden: ['/api/ondertiteling'] },
  { id: 'privekantoor', categorie: 'Leden (RTG-app)', naam: 'Het Privékantoor (Lifestyle)', standaard: true, doelgroepen: ['lifestyle', 'business'],
    uitleg: 'De ene app van de Lifestyle Pass: de levensgraaf over de premium-apps heen, de Control Tower met alle termijnen, het mandaat (wat mag het kantoor zelf) en zaken met een team en een tijdlijn. Uit zetten laat de onderliggende apps staan; alleen de samenhang verdwijnt.',
    paden: ['/api/member/bureau', '/api/office/bureau'] },

  // ---- Genres & diensten (leden boeken/kopen per sector) ----
  { id: 'bestellen', categorie: 'Genres & diensten', naam: 'Bestellen & bezorgen', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Bestellen bij een zaak (ophalen of laten bezorgen) met live volgen.', paden: ['/api/order', '/api/orders', '/api/bezorg'] },
  { id: 'tickets', categorie: 'Genres & diensten', naam: 'Tickets & activiteiten', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Tickets kopen met tijdslot en een oplichtende entreecode.', paden: ['/api/tickets'] },
  { id: 'verhuur', categorie: 'Genres & diensten', naam: 'Autoverhuur', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Auto huren met foto\'s voor/na, borg, SOS-knop en live locatie.', paden: ['/api/huur', '/api/verhuur'] },
  { id: 'charter', categorie: 'Genres & diensten', naam: 'Boten & jachten (charter)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Vaartuigen charteren met schipper, borg, SOS op zee en live positie.', paden: ['/api/charter'] },
  { id: 'vastgoed', categorie: 'Genres & diensten', naam: 'Vastgoed', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Panden bekijken, interesse tonen of bieden en keyless bezichtigen.', paden: ['/api/vastgoed'] },
  { id: 'retail', categorie: 'Genres & diensten', naam: 'Mode & retail', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De modecatalogus: wishlist, apart leggen en de paskamer.', paden: ['/api/retail'] },
  { id: 'onderweg', categorie: 'Genres & diensten', naam: 'Onderweg (live locatie)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het live onderweg-scherm: positie, ETA en verbonden partners.', paden: ['/api/live'] },
  { id: 'contracten', categorie: 'Genres & diensten', naam: 'Contracten (leden tekenen)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Digitale contracten die een lid in de app ondertekent.', paden: ['/api/contract', '/api/contracten'] },
  { id: 'groothandel', categorie: 'Genres & diensten', naam: 'Groothandel & markt', standaard: true, doelgroepen: ['rtg', 'lifestyle', 'business', 'leverancier'],
    uitleg: 'De brede B2B/B2C-marktplaats: horeca koopt in, leden bestellen boodschappen, met AI-bijbestellen. Elke groothandel zet zijn eigen functies aan/uit.', paden: ['/api/groothandel', '/api/supplier/groothandel', '/api/supplier/inkoop'] },
  /* RTG Commerce (COMMERCE.md): de kopersKANT. Uit zetten haalt de mand, de
     afrekening, de overdracht en het retourverzoek weg; de domeinen zelf
     verkopen daarna gewoon door zoals ze dat altijd al deden -- deze laag
     bevestigt niets en is dus ook nergens de enige weg naar. De zaakkant staat
     bij Zaakregie. */
  { id: 'commerce', categorie: 'Genres & diensten', naam: 'RTG Commerce (mand & retour)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De verkooplaag boven de domeinen: wat er te koop staat en wat NIET met de reden erbij, een mand over verkopers heen met een afrekening per verkoper, de overdracht naar de deur die bevestigt, en de weg terug. RTG bevestigt hier zelf niets.',
    paden: ['/api/commerce'] },

  // ---- Sociaal (De Salon) ----
  { id: 'salon', categorie: 'Sociaal (De Salon)', naam: 'De Salon (feed, volgen, deals)', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'De Salon-tijdlijn: partner-posts volgen, aanbiedingen claimen, polls en de etalage.', paden: ['/api/salon'] },
  { id: 'ontmoetingen', categorie: 'Sociaal (De Salon)', naam: 'Salon-ontmoetingen (in de buurt)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Wederzijdse connecties die vlakbij zijn spreken veilig af (18+, geverifieerd), met contract, live-locatie naar RTG en SOS.', paden: ['/api/ontmoeten'] },
  { id: 'social', categorie: 'Sociaal (De Salon)', naam: 'Sociale laag (RTG + RTF)', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'De gedeelde sociale laag: zoeken, verbinden, DM, snaps, verhalen en bellen op codenaam. De kinderbescherming (t/m 15 gesloten) blijft altijd gelden.', paden: ['/api/rtf/social'] },
  { id: 'rtf-contacten', categorie: 'Sociaal (De Salon)', naam: 'RTF contacten & familiekoppeling', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'De contactenlaag van de RTFoundation: gezinnen koppelen, kanalen en meldingen tussen leden.', paden: ['/api/rtf'] }
];
