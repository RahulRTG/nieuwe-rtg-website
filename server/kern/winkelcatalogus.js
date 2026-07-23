/* De vaste RTG-winkelcatalogus: hardware en uitbreidingen (de Zaakdoos en
   toebehoren). Een gedeelde bron zodat zowel het partnerkanaal (bestel-endpoint,
   verkooppagina) als de RTG Mall dezelfde producten en prijzen tonen. Prijzen in
   euro, exclusief btw; een bestelling legt de prijs vast die op dat moment gold.
   De door RTG Hardwarelab gepubliceerde ontwerpen komen hier los bij, uit
   db.data.winkelProducten. */

const WINKEL = {
  zaakdoos:           { naam: 'RTG Zaakdoos',              eenmalig: 100, perMaand: 150, eenheid: 'per doos' },
  'slimme-deur':      { naam: 'RTG Slimme Deur',           eenmalig: 120, perMaand: 5,   eenheid: 'per deur' },
  'kamerservice':     { naam: 'RTG Kamerservice',          eenmalig: 180, perMaand: 5,   eenheid: 'per kamer' },
  toegangspoort:      { naam: 'RTG Toegangspoort',         eenmalig: 450, perMaand: 5,   eenheid: 'per zuil' },
  paniekknop:         { naam: 'RTG Paniekknop',            eenmalig: 60,  perMaand: 5,   eenheid: 'per knop' },
  'gast-piepers':     { naam: 'RTG Gast-piepers',          eenmalig: 250, perMaand: 5,   eenheid: 'per set van 10' },
  'rtg-pda':          { naam: 'RTG PDA',                   eenmalig: 220, perMaand: 5,   eenheid: 'per stuk' },
  'rit-tracker':      { naam: 'RTG Rit-tracker',           eenmalig: 80,  perMaand: 5,   eenheid: 'per voertuig' },
  veldsensor:         { naam: 'RTG Veldsensor-set',        eenmalig: 350, perMaand: 5,   eenheid: 'per set' },
  schermen:           { naam: 'RTG Keuken- en kassascherm', eenmalig: 300, perMaand: 5,  eenheid: 'per scherm' },
  'satelliet-pakket': { naam: 'RTG Satelliet-startpakket', eenmalig: 900, perMaand: 150, eenheid: 'per locatie' }
};

// de vaste catalogus samengevoegd met de door RTG gepubliceerde ontwerpen
function alleProducten(db) {
  const extra = (db && db.data && db.data.winkelProducten && typeof db.data.winkelProducten === 'object') ? db.data.winkelProducten : {};
  return Object.assign({}, WINKEL, extra);
}

module.exports = { WINKEL, alleProducten };
