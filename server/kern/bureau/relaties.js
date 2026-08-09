/* Het Privekantoor, deelbestand "relaties": relatiebeheer met geheugen.

   Attenties wist wie er jarig is. Dat is een agenda met namen erin. Wat een
   chef de bureau werkelijk bijhoudt is iets anders:

     banden        wie bij wie hoort. De partner van, het kind van, de compagnon
                   van. Zonder die lijnen is "Van Doorn" drie losse mensen.
     ontmoetingen  wanneer u elkaar zag, waar, en waarover het ging. Dit is het
                   veld waardoor u bij de volgende ontmoeting weet dat u de
                   vorige keer over dat huis in Toscane hebt gesproken.
     context       wat iemand doet, welke onderwerpen goed vallen -- en welke
                   niet.

   DAT LAATSTE VELD IS MET OPZET ZO GENOEMD. `nooitOver` is geen roddel maar een
   hoffelijkheid: een scheiding, een overleden kind, een zaak die verkeerd
   afliep. Wie personeel of een gastheer briefing geeft, geeft juist dit door.
   Het is ook precies het veld dat verkeerd kan vallen als het ergens belandt
   waar het niet hoort -- vandaar dat dit hele dossier VERTROUWELIJK is en niet
   verder reikt dan uw Rechterhand. Het concierge-bureau krijgt het niet.

   EEN GRENS DIE HIER GELDT EN NERGENS ANDERS: dit gaat over ANDERE MENSEN. Zij
   hebben er niet om gevraagd om in uw dossier te staan. Daarom staat er geen
   veld voor gezondheid, geloof, geaardheid of politieke voorkeur, en komt dat er
   ook niet: dat zijn bijzondere persoonsgegevens, en die horen niet in een
   relatiebestand van een reisbureau. Wat er wel staat, is wat u ook in een
   adresboek zou schrijven.

   Gemount via ./index.js. */
'use strict';

const BANDEN = ['partner', 'kind', 'ouder', 'broer of zus', 'compagnon', 'collega', 'vriend', 'overig'];

module.exports = (ctx) => {
  const { db, save, nu, rid, schoon, isDatum } = ctx;

  const relatiesVan = key => {
    const l = (db.data && db.data.lifestyle && db.data.lifestyle[key]) || {};
    return ((l.attenties || {}).relaties) || [];
  };
  function R(key, relatieId, maak) {
    if (!relatiesVan(key).some(r => r.id === relatieId)) return null;
    const l = db.data.lifestyle[key];
    if (!l.relatieContext || typeof l.relatieContext !== 'object') l.relatieContext = {};
    if (!l.relatieContext[relatieId]) {
      if (!maak) return { banden: [], ontmoetingen: [], context: {} };
      l.relatieContext[relatieId] = { banden: [], ontmoetingen: [], context: {} };
    }
    const d = l.relatieContext[relatieId];
    for (const v of ['banden', 'ontmoetingen']) if (!Array.isArray(d[v])) d[v] = [];
    if (!d.context || typeof d.context !== 'object') d.context = {};
    return d;
  }
  const dossierVan = (key, id) => {
    const l = (db.data && db.data.lifestyle && db.data.lifestyle[key]) || {};
    return (l.relatieContext || {})[id] || { banden: [], ontmoetingen: [], context: {} };
  };
  const geenRelatie = { status: 404, error: 'Deze relatie staat niet in uw Attenties.' };

  /* Een band leggen. Hij wordt aan BEIDE kanten opgeslagen, met de spiegelrol
     erbij -- anders staat "kind van" alleen bij de ouder en ziet u bij het kind
     niets. Twee rijen die samen een lijn zijn is geen dubbeling: het is dezelfde
     lijn vanaf twee kanten, en er is geen derde plek waar hij nog eens staat. */
  const SPIEGEL = { partner: 'partner', kind: 'ouder', ouder: 'kind',
    'broer of zus': 'broer of zus', compagnon: 'compagnon', collega: 'collega', vriend: 'vriend', overig: 'overig' };
  function relBand(key, x) {
    const a = String(x.relatieId || ''), b = String(x.naarId || '');
    if (a === b) return { status: 400, error: 'Een relatie is geen band met zichzelf.' };
    const da = R(key, a, true), dbb = R(key, b, true);
    if (!da || !dbb) return geenRelatie;
    const wat = BANDEN.includes(x.wat) ? x.wat : 'overig';
    if (da.banden.some(y => y.naarId === b)) return { status: 400, error: 'Deze band staat er al.' };
    if (da.banden.length >= 60 || dbb.banden.length >= 60) return { status: 400, error: 'Er staan al veel banden.' };
    da.banden.push({ id: rid(), naarId: b, wat });
    dbb.banden.push({ id: rid(), naarId: a, wat: SPIEGEL[wat] || 'overig' });
    save();
    return { status: 200, ok: true };
  }
  function relBandWeg(key, x) {
    const a = String(x.relatieId || ''), b = String(x.naarId || '');
    const da = R(key, a, false), dbb = R(key, b, false);
    if (!da || !dbb) return geenRelatie;
    da.banden = da.banden.filter(y => y.naarId !== b);
    dbb.banden = dbb.banden.filter(y => y.naarId !== a);
    save();
    return { status: 200, ok: true };
  }

  function relOntmoeting(key, x) {
    const d = R(key, String(x.relatieId || ''), true);
    if (!d) return geenRelatie;
    const wat = schoon(x.wat, 400);
    if (!wat) return { status: 400, error: 'Waar ging het over?' };
    if (d.ontmoetingen.length >= 300) d.ontmoetingen.pop();
    d.ontmoetingen.unshift({ id: rid(), op: isDatum(x.op) ? x.op : new Date().toISOString().slice(0, 10),
      waar: schoon(x.waar, 100), wat, at: nu() });
    save();
    return { status: 200, ok: true };
  }
  function relOntmoetingWeg(key, x) {
    const d = R(key, String(x.relatieId || ''), false);
    if (!d) return geenRelatie;
    d.ontmoetingen = d.ontmoetingen.filter(y => y.id !== x.id); save();
    return { status: 200, ok: true };
  }

  function relContext(key, x) {
    const d = R(key, String(x.relatieId || ''), true);
    if (!d) return geenRelatie;
    d.context = { werk: schoon(x.werk, 160), onderwerpen: schoon(x.onderwerpen, 300),
      nooitOver: schoon(x.nooitOver, 300), aanspreek: schoon(x.aanspreek, 60) };
    save();
    return { status: 200, ok: true, context: d.context };
  }

  function relaties(key, relatieId) {
    const alle = relatiesVan(key);
    const naam = id => { const r = alle.find(x => x.id === id); return r ? r.naam : ''; };
    const kop = alle.map(r => {
      const d = dossierVan(key, r.id);
      return { id: r.id, naam: r.naam, band: r.band, banden: d.banden.length,
        ontmoetingen: d.ontmoetingen.length,
        laatstGezien: (d.ontmoetingen[0] || {}).op || '',
        letOp: !!(d.context && d.context.nooitOver) };
    });
    if (!relatieId) return { status: 200, relaties: kop, gekozen: null, banden: BANDEN };
    const r = alle.find(x => x.id === relatieId);
    if (!r) return geenRelatie;
    const d = dossierVan(key, relatieId);
    return { status: 200, relaties: kop, banden: BANDEN,
      gekozen: Object.assign({}, r, {
        kring: d.banden.map(b => ({ id: b.id, naarId: b.naarId, naam: naam(b.naarId), wat: b.wat }))
          .filter(b => b.naam),
        ontmoetingen: d.ontmoetingen, context: d.context }) };
  }

  return { relaties, relBand, relBandWeg, relOntmoeting, relOntmoetingWeg, relContext,
    RELATIE_BANDEN: BANDEN };
};
