/* Magnaat Van Nul: WAT EEN LEVEN IS, en de twee dingen die iedereen hier doet.

   Een leven begint met een mens, een baan en € 63 (./regels.js). Alles wat
   daarna gebeurt komt uit wat de speler doet (./acties.js) of uit wat de dagen
   brengen (./dag.js). Deze module maakt de beginstand en kent twee handelingen
   die overal voorkomen: iets melden, en een RTG-functie laten verschijnen op
   het moment dat hij relevant wordt -- met de reden erbij, en maar een keer. */
'use strict';
const R = require('./regels');

const MAX_MELDINGEN = 40;

function nieuw({ wereld, nu }) {
  return {
    versie: 1, regelversie: R.REGELVERSIE, wereld,
    dag: R.START_DAG, dagMs: R.DAG_MS, begonnen: nu, gerekendTot: nu,
    kas: 0,
    baan: Object.assign({ actief: true }, R.BAAN),
    uren: R.isWeekend(R.START_DAG) ? R.UREN.weekend : R.UREN.werkdag,
    project: null, onderneming: null,
    deals: [], dealTeller: 0, factuurTeller: 0,
    lening: null, rood: false, overwerkDag: null,
    rtg: [], meldingen: [],
    boek: null
  };
}

function meld(st, tekst, soort = 'info') {
  st.meldingen.unshift({ dag: st.dag, tekst, soort });
  if (st.meldingen.length > MAX_MELDINGEN) st.meldingen.length = MAX_MELDINGEN;
}

function ontgrendel(st, id) {
  if (!R.RTG[id] || st.rtg.some(x => x.id === id)) return false;
  st.rtg.push({ id, naam: R.RTG[id].naam, waarom: R.RTG[id].waarom, dag: st.dag });
  meld(st, 'Nieuw in je RTG: ' + R.RTG[id].naam + ' -- ' + R.RTG[id].waarom + '.', 'rtg');
  return true;
}

const aanbod = (st) => (st.project ? R.AANBOD[st.project.aanbod] : null);
const klantVan = (st, klantId) => {
  const a = aanbod(st);
  return a ? a.klanten.find(k => k.id === klantId) || null : null;
};
const deal = (st, id) => st.deals.find(d => d.id === String(id || '')) || null;
/* Bedragen in spelteksten; het scherm zet ze zelf in de taal van de speler. */
const euro = (cent) => {
  const a = Math.abs(cent), heel = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (cent < 0 ? '€ -' : '€ ') + heel + ',' + String(a % 100).padStart(2, '0');
};

module.exports = { nieuw, meld, ontgrendel, aanbod, klantVan, deal, euro };
