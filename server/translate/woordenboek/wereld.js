/* Het wereld-kernwoordenboek: 30 school-kernwoorden in ELKE registertaal,
   zodat de woord-voor-woord-terugval ook zonder AI-sleutel in alle talen
   iets zinnigs teruggeeft. De regels staan compact (|-gescheiden, vaste
   KERN-volgorde) in wereld1..wereld8; hier worden ze pas bij gebruik per
   taal uitgepakt en gecachet -- opstarten kost zo vrijwel niets. */
const { KERN } = require('./wereld-kern');
const DELEN = Object.assign({},
  require('./wereld1'), require('./wereld2'), require('./wereld3'), require('./wereld4'),
  require('./wereld5'), require('./wereld6'), require('./wereld7'), require('./wereld8'));

const cache = Object.create(null);
function dictVan(code) {
  code = String(code || '').toLowerCase();
  if (cache[code]) return cache[code];
  const regel = Object.prototype.hasOwnProperty.call(DELEN, code) ? DELEN[code] : null;
  if (!regel) return null;
  const woorden = regel.split('|');
  const d = {};
  KERN.forEach((nl, i) => { if (woorden[i]) d[nl] = woorden[i]; });
  return (cache[code] = d);
}

module.exports = { KERN, dictVan, TALEN_MET_KERN: Object.keys(DELEN) };
