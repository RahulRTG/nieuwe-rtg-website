/* Magnaat V3: WAAR JE BEDRIJF ZIT -- huur tegenover zichtbaarheid.

   Thuis kost niets en ziet bijna niemand je. Een bedrijfsruimte kost een keer
   verhuizen en daarna elke vier weken huur, en maakt je zichtbaarder: meer
   kopers vinden je handel, en meer klanten uit de markt vinden jou
   (./markt.js). Buiten Thuis heb je ruimte voor je team, en vervallen de losse
   werkplekken (./team.js). */
'use strict';
const M = require('./regels-markt');
const R = require('./regels');
const { meld, post, euro } = require('./staat');
const { boekVan } = require('./boek');
const { betaalWatVervalt } = require('./geld');
const { mijlpaal } = require('./gids');

const fout = (error) => ({ status: 400, error });

function huurPost(st) {
  const w = M.WIJKEN[st.vestiging.wijk];
  post(st, { soort: 'huisvesting', naam: 'Huur ' + w.naam, bedrag: w.huur, dag: st.dag, leverancier: 'verhuurder ' + w.naam,
    naar: ['kosten', 'huisvesting'], boekSoort: 'HUUR_BEDRIJF' });
  st.vestiging.volgende = st.dag + R.PERIODE;
}

/* Elke dag: vervalt de huur van je ruimte vandaag? */
function huurDag(st) {
  if (st.vestiging.volgende != null && st.vestiging.volgende <= st.dag && M.WIJKEN[st.vestiging.wijk].huur) huurPost(st);
}

function vestig(st, z) {
  if (!st.onderneming) return fout('Een bedrijfsruimte huur je als onderneming.');
  const w = M.WIJKEN[z.wijk];
  if (!w) return fout('Kies een plek: ' + Object.values(M.WIJKEN).map(x => x.naam).join(', ') + '.');
  if (z.wijk === st.vestiging.wijk) return fout('Je zit al in ' + w.naam + '.');
  if (st.kas < w.verhuis + w.huur) return fout('Verhuizen naar ' + w.naam + ' kost ' + euro(w.verhuis) + ' plus de eerste huur van ' + euro(w.huur) + ', en er staat ' + euro(st.kas) + ' op je rekening.');
  const oud = M.WIJKEN[st.vestiging.wijk];
  st.posten = st.posten.filter(p => p.soort !== 'huisvesting' || p.achterstand);
  if (w.verhuis) boekVan(st).boekOver(st, { soort: 'VERHUIZING', van: ['kas'], naar: ['kosten', 'huisvesting'], bedrag: w.verhuis,
    omschrijving: 'Verhuizing naar ' + w.naam, sleutel: 'verhuis:' + st.dag });
  st.vestiging = { wijk: z.wijk, sinds: st.dag, volgende: null };
  if (w.huur) mijlpaal(st, 'vestiging', 'Je eerste bedrijfsruimte: ' + w.naam + '.');
  if (w.huur) { huurPost(st); betaalWatVervalt(st); }
  meld(st, 'Je bedrijf zit nu in ' + w.naam + (oud.huur ? ' en niet meer in ' + oud.naam : '') + '. ' +
    (w.huur ? 'Huur ' + euro(w.huur) + ' per vier weken; je team werkt hier, dus losse werkplekken zijn niet meer nodig.' : 'Geen huur, en ook minder mensen die je zien.'), 'goed');
  return { ok: true };
}

module.exports = { vestig, huurDag };
