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
    uitleg: 'Vriendschapsverzoeken en de vriendengraaf tussen leden.', paden: ['/api/member/connect'] },
  { id: 'member-werk', categorie: 'Leden (RTG-app)', naam: 'Vacatures & solliciteren (leden)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Leden solliciteren met hun cv op vacatures bij partners.', paden: ['/api/member/apply'] },
  { id: 'zakelijk', categorie: 'Leden (RTG-app)', naam: 'RTG Zakelijk (professioneel netwerk)', standaard: true, doelgroepen: ['lifestyle', 'business'],
    uitleg: 'De LinkedIn-laag van de Lifestyle en Business Pass: zakelijk profiel, gids, verbinden, feed, aanbevelingen en het kansenbord.', paden: ['/api/zakelijk'] },

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
