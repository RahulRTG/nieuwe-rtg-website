/* Magnaat V3: DE KALENDER VAN OUDWIJK -- maand, seizoen en het weer van de dag.

   Een maand duurt hier vier weken, zodat een jaar in een speelbare tijd rond
   is. Het weer is geen dobbelsteen: het volgt uit de wereld en de dag, dus wie
   hetzelfde leven opnieuw speelt, krijgt hetzelfde weer -- en wie een ander
   leven begint, ander weer. Hetzelfde getal ligt onder de fouten van
   concurrenten en de klanten die de markt brengt (./markt.js). */
'use strict';
const crypto = require('crypto');
const M = require('./regels-markt');

/* Een vast getal van 0 tot `mod` voor deze wereld en dit label. */
function lot(st, label, mod) {
  return parseInt(crypto.createHash('sha256').update(st.wereld + ':' + label).digest('hex').slice(0, 8), 16) % mod;
}

const maandVan = (dag) => (M.START_MAAND + Math.floor((dag - 1) / M.MAANDDAGEN)) % 12;
const seizoenVan = (dag) => Object.keys(M.SEIZOENEN).find(s => M.SEIZOENEN[s].includes(maandVan(dag)));
const weekVan = (dag) => Math.ceil(dag / 7);

function weerVan(st, dag) {
  const kans = M.WEER.kans[seizoenVan(dag)], r = lot(st, 'weer:' + dag, 100);
  let som = 0;
  for (const soort of Object.keys(kans)) {
    som += kans[soort];
    if (r < som) return soort;
  }
  return 'bewolkt';
}

function kalender(st, dag = st.dag) {
  const weer = weerVan(st, dag);
  return { maand: M.MAANDEN[maandVan(dag)], seizoen: seizoenVan(dag), weer, weerFactor: M.WEER.soorten[weer] };
}

module.exports = { lot, maandVan, seizoenVan, weekVan, weerVan, kalender };
