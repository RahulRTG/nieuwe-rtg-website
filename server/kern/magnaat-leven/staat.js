/* Magnaat FROM ZERO: WAT EEN LEVEN IS, en de handelingen die iedereen hier doet.

   Een leven begint op een maandag (./regels.js). Alles wat daarna gebeurt komt
   uit wat de speler doet (de actiebestanden) of uit wat de dagen brengen
   (./dag.js). Deze module maakt de beginstand en kent de gedeelde handelingen:
   iets melden, een RTG-functie laten verschijnen wanneer hij relevant wordt
   (met de reden, en maar een keer), en een betaling klaarzetten. */
'use strict';
const R = require('./regels');
const { klantenVan } = require('./klanten');

const MAX_MELDINGEN = 60;

function nieuw({ wereld, nu, moeilijkheid = 'normaal' }) {
  const st = {
    versie: 2, regelversie: R.REGELVERSIE, wereld, moeilijkheid,
    dag: 1, dagMs: R.DAG_MS, begonnen: nu, gerekendTot: nu,
    kas: 0,
    baan: Object.assign({ actief: true }, R.BAAN),
    bezit: ['telefoon', 'eenvoudige laptop'],
    agenda: {},
    aanbod: null, portfolio: 0, geleerd: 0,
    deals: [], dealTeller: 0, factuurTeller: 0, postTeller: 0, betaald: 0,
    posten: [],
    software: null, lening: null,
    onderneming: null, ondernemingVraag: null, zelfstandig: null,
    team: [], handel: null, leveringen: [], contracten: [], contractTeller: 0,
    rtg: [], meldingen: [],
    boek: null
  };
  for (const v of R.VERPLICHTINGEN) post(st, { soort: v.id, naam: v.naam, bedrag: R.verplichtingBedrag(st, v), dag: v.eerste });
  return zorgBedrijf(st);
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

/* Een betaling klaarzetten: hij wordt op zijn dag betaald als er geld is. Het
   id komt uit een teller en nooit uit de lengte van de lijst: dat id is ook de
   grootboeksleutel, en een sleutel die terugkomt boekt niets. */
const AAN_WIE = { huur: 'je verhuurder', vast: 'je provider en je verzekeraar', uitstel: 'je provider en je verzekeraar',
  software: 'de maker van je software', aanmaning: 'het incassobureau', aflossing: 'je familie' };
/* Een betaling van het bedrijf (V2) zegt zelf naar welke rekening hij gaat
   (`naar`, met de soort boeking), en bij loon voor wie hij is. */
function post(st, { soort, naam, bedrag, dag, leverancier, naar, boekSoort, medewerker }) {
  const p = { id: soort + ':' + (++st.postTeller), soort, naam, leverancier: leverancier || AAN_WIE[soort] || 'onbekend', bedrag, dag };
  if (naar) Object.assign(p, { naar, boekSoort });
  if (medewerker) p.medewerker = medewerker;
  st.posten.push(p);
  return p;
}

/* Een leven van voor V2 krijgt de lege velden van een bedrijf erbij, zonder
   opnieuw te beginnen: er is nog niets van, dus er valt niets om te bouwen. */
function zorgBedrijf(st) {
  for (const [k, v] of [['team', []], ['handel', null], ['leveringen', []], ['contracten', []], ['contractTeller', 0]]) {
    if (st[k] === undefined) st[k] = Array.isArray(v) ? [] : v;
  }
  /* V3: de markt en waar je bedrijf zit. De concurrenten beginnen op hun eigen prijs. */
  if (!st.vestiging) st.vestiging = { wijk: 'thuis', sinds: st.dag, volgende: null };
  if (!st.markt) {
    const prijzen = {};
    for (const lijst of Object.values(require('./regels-markt').CONCURRENTEN)) for (const c of lijst) prijzen[c.id] = c.prijsPct;
    st.markt = { prijzen, klanten: [], leadTeller: 0 };
  }
  return st;
}

const klantVan = (st, klantId) => klantenVan(st.aanbod).find(k => k.id === klantId) ||
  ((st.markt || {}).klanten || []).find(k => k.id === klantId) || null;
const deal = (st, id) => st.deals.find(d => d.id === String(id || '')) || null;
const euro = (cent) => {
  const a = Math.abs(cent), heel = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (cent < 0 ? '€ -' : '€ ') + heel + ',' + String(a % 100).padStart(2, '0');
};
const tijd = (min) => {
  const u = Math.floor(min / 60), m = min % 60;
  return u && m ? u + 'u ' + m + 'm' : u ? u + 'u' : m + 'm';
};

module.exports = { nieuw, zorgBedrijf, meld, ontgrendel, post, klantVan, deal, euro, tijd };
