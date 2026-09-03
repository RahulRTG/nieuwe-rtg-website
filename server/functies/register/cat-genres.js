/* Functiecatalogus, deel "genres": de categorie Genres & diensten -- wat een lid
   per sector boekt of koopt.

   Verbatim afgesplitst uit ./cat-leden.js, dat er met 11,4 KB over de
   omvangsgrens van keuringsregel 13 ging toen RTG Service er drie functies bij
   kreeg. De naad ligt op een echte grens: dat bestand houdt de LEDEN-app en De
   Salon, dit de sectoren. Wie een genre toevoegt raakt het andere bestand niet
   aan, en omgekeerd. standaard: true = de functie staat normaal aan. */
const { LEDEN, LEDEN_GAST } = require('./doelgroepen');

module.exports = [
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
    paden: ['/api/commerce'] }
];
