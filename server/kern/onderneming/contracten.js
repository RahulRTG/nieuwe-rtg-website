/* DE CONTRACTEN VAN DE ONDERNEMING: de klok op het dagbeeld.

   HIER WORDT GEEN CONTRACTREGISTER GEBOUWD, en dat is het hele punt. RTG Werk OS
   heeft er al een (server/bedrijf/contract.js): soorten, tekenen met twee namen,
   opzeggen, en een klok die de laatste opzegdag UITREKENT in plaats van hem te
   laten overtypen. Dat is beter dan wat hier in een middag zou ontstaan, en een
   tweede register zou vooral betekenen dat een ondernemer straks twee lijsten
   heeft en niet weet welke telt (lat-regel 4).

   Wat er wel ontbrak, is de brug. De contractbibliotheek hangt aan een
   WERKRUIMTE (een eigen wereld met een eigen code en een eigen inlog), en een
   onderneming wist daar niets van. Een verzekering die stil afliep, stond dus
   in een systeem dat de ondernemer op zijn dagbeeld niet zag.

   DEZE MODULE LEEST, EN SCHRIJFT NIETS. Contracten aanmaken, tekenen en
   opzeggen blijft in het Werk OS, achter zijn eigen poort. Wat hier gebeurt is
   uitsluitend: welke contracten horen bij de werkruimte die deze onderneming
   heeft gekoppeld, wat zegt de klok erover, en wat moet er vandaag op het
   dagbeeld staan.

   GEEN WERKRUIMTE IS EEN EIGEN STAND, GEEN LEGE LIJST. Wie geen werkruimte
   heeft gekoppeld, heeft niet "nul contracten" -- hij heeft een register dat wij
   niet kunnen zien. Dat verschil hoort zichtbaar te zijn, anders leest een
   ontbrekende koppeling als "alles in orde". */
'use strict';

const KLOK = require('../../bedrijf/contractklok');

/* Binnen hoeveel dagen een naderende opzegdag op het dagbeeld komt. Ruim
   genoeg om nog iets te kunnen doen; een signaal op de dag zelf is geen
   signaal maar een mededeling. */
const WAARSCHUW_DAGEN = 30;

module.exports = ({ db }) => {

  const werkruimtes = () => (db.data.werkruimtes && typeof db.data.werkruimtes === 'object'
    ? db.data.werkruimtes : {});

  /* De werkruimte koppelen. Hij moet bestaan -- een code uit het lichaam is
     geen bewijs dat er iets achter zit, en een koppeling naar het niets zou
     later als "geen contracten" lezen. */
  function ondernemingWerkruimte(o, code, save) {
    const c = String(code || '').trim().toUpperCase();
    if (!c) { delete o.werkruimte; save(); return { ok: true, werkruimte: null }; }
    if (!werkruimtes()[c]) return { status: 404, error: 'Deze werkruimte bestaat niet.' };
    o.werkruimte = c;
    save();
    return { ok: true, werkruimte: c };
  }

  function contracten(o, vandaag) {
    if (!o) return null;
    if (!o.werkruimte) {
      return { ok: true, stand: 'geen-werkruimte', aantal: null, contracten: [],
        uitleg: 'De contractbibliotheek hoort bij een werkruimte van RTG Werk OS. Koppel er een, dan zetten wij de klok van uw contracten op dit scherm.',
        /* Expliciet null en niet 0: wij weten het niet, en dat is iets anders
           dan "er zijn er geen". */
        let: 'Zonder koppeling weten wij niet of u contracten heeft; dit is geen bevestiging dat er niets loopt.' };
    }
    const w = werkruimtes()[o.werkruimte];
    if (!w) {
      return { ok: true, stand: 'werkruimte-weg', aantal: null, contracten: [],
        uitleg: 'De gekoppelde werkruimte (' + o.werkruimte + ') bestaat niet meer.' };
    }
    const dagStr = vandaag || new Date().toISOString().slice(0, 10);
    const rijen = Object.values(w.contracten || {}).map(c => Object.assign({
      id: c.id, titel: c.titel, wederpartij: c.wederpartij, soort: c.soort,
      status: c.status, eindigt: c.eindigt || null, stilzwijgend: !!c.stilzwijgend
    }, KLOK.klok(c, dagStr)));

    const actief = rijen.filter(r => r.status === 'actief');
    /* Drie soorten aandacht, en ze sluiten elkaar uit -- een contract staat in
       precies een emmer, zodat de tellingen naast elkaar te leggen zijn. */
    const opzegdagVoorbij = actief.filter(r =>
      r.dagenTotOpzegdag != null && r.dagenTotOpzegdag < 0 && r.dagenTotEinde >= 0);
    const binnenkortOpzeggen = actief.filter(r =>
      r.dagenTotOpzegdag != null && r.dagenTotOpzegdag >= 0 && r.dagenTotOpzegdag <= WAARSCHUW_DAGEN);
    const zonderEinddatum = rijen.filter(r => !r.eindigt);

    return {
      ok: true, stand: 'gekoppeld', werkruimte: o.werkruimte,
      aantal: rijen.length,
      contracten: rijen.sort((a, b) =>
        (a.dagenTotOpzegdag == null ? 99999 : a.dagenTotOpzegdag) -
        (b.dagenTotOpzegdag == null ? 99999 : b.dagenTotOpzegdag)).slice(0, 50),
      opzegdagVoorbij, binnenkortOpzeggen, zonderEinddatum: zonderEinddatum.length,
      verlopen: rijen.filter(r => r.stand === 'verlopen').length,
      let: 'Wat verlopen is blijft staan: bij een geschil is juist de oude tekst het bewijs. Aanmaken, tekenen en opzeggen gaat in RTG Werk OS.'
    };
  }

  return { CONTRACTEN_WAARSCHUW_DAGEN: WAARSCHUW_DAGEN, contracten, ondernemingWerkruimte };
};

/* De opvolgregels voor het dagbeeld. Twee, en in deze volgorde: een gemiste
   opzegdag is al gebeurd en kost een jaar; een naderende is nog te halen. */
function contractenOpvolging(c) {
  if (!c || c.stand !== 'gekoppeld') return [];
  const uit = [];
  if (c.opzegdagVoorbij.length) {
    const eerste = c.opzegdagVoorbij[0];
    uit.push({ id: 'opzegdag-voorbij', aantal: c.opzegdagVoorbij.length,
      kop: c.opzegdagVoorbij.length + ' contract' + (c.opzegdagVoorbij.length === 1 ? '' : 'en') +
        ' is de opzegdag voorbij',
      waarom: 'Dit verlengt stilzwijgend' + (eerste.titel ? ' (' + eerste.titel + ')' : '') +
        '. Opzeggen kan pas weer aan het eind van de nieuwe termijn.' });
  }
  if (c.binnenkortOpzeggen.length) {
    const eerste = c.binnenkortOpzeggen[0];
    uit.push({ id: 'opzegdag-nadert', aantal: c.binnenkortOpzeggen.length,
      kop: c.binnenkortOpzeggen.length + ' contract' + (c.binnenkortOpzeggen.length === 1 ? '' : 'en') +
        ' nadert de laatste opzegdag',
      waarom: (eerste.titel ? eerste.titel + ': nog ' : 'Nog ') + eerste.dagenTotOpzegdag +
        ' dagen om te beslissen. Daarna loopt hij door.' });
  }
  return uit;
}

module.exports.contractenOpvolging = contractenOpvolging;
module.exports.WAARSCHUW_DAGEN = WAARSCHUW_DAGEN;
