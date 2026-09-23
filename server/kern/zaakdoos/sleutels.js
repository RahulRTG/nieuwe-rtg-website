/* EEN SLEUTEL PER ZAAKDOOS -- AUTHORITY.md fase 7, gebouwd naast de gedeelde sleutel.

   De meting (23 september 2026): de doos-vloot authenticeert met EEN gedeelde
   sleutel (RTG_DOOS_SLEUTEL) en de doos noemt zichzelf in het verzoek
   (`body.doos`). Wie de sleutel heeft, kan zich dus voor ELKE doos uitgeven, en
   een identiteit daarop zou een verzonnen identiteit bewijzen.

   Dit register geeft een doos een EIGEN sleutel, zoals een gekoppeld toestel die
   heeft (../toestellen.js): 48 hex-tekens, een keer getoond, in de opslag alleen
   een hash. Met die sleutel is de naam van de doos BEWEZEN -- hij komt uit het
   register en niet uit het verzoek. De gedeelde sleutel blijft werken (dezelfde
   schaduwvorm als fase 2); elke doos-aanroep telt mee onder de weg waarlangs hij
   kwam, en pas als `gedeeld` niet meer stijgt kan die sleutel weg -- een apart
   besluit. */
'use strict';

const NAAM = /^[a-z0-9][a-z0-9-]{1,39}$/;

function maakDoosSleutels({ db, save, crypto }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/zaakdoos/sleutels',
    bezit: { doosSleutels: 'kaart', doosSleutelwegen: 'kaart' } });
  const kaart = () => eigen.bak('doosSleutels');
  const hash = (s) => crypto.createHash('sha256').update(String(s || '')).digest('hex');

  /* Een nieuwe sleutel voor een doos. Een oude sleutel van dezelfde doos is
     daarmee meteen niets meer waard: er is er per doos een. */
  function geef(naam) {
    const n = String(naam || '').trim().toLowerCase();
    if (!NAAM.test(n)) return { status: 400, error: 'Een doosnaam is 2 tot 40 tekens: kleine letters, cijfers en streepjes.' };
    const sleutel = crypto.randomBytes(24).toString('hex');
    kaart()[n] = { hash: hash(sleutel), sinds: new Date().toISOString() };
    save();
    return { ok: true, doos: n, sleutel,
      let: 'Deze sleutel wordt maar een keer getoond. Zet hem op de doos als RTG_DOOS_EIGEN_SLEUTEL, met RTG_DOOS_ID=' + n + '.' };
  }

  function trekIn(naam) {
    const n = String(naam || '').trim().toLowerCase();
    const k = kaart();
    const was = !!k[n];
    if (was) { delete k[n]; save(); }
    return { ok: true, ingetrokken: was };
  }

  /* Welke doos is dit? Alleen als id EN sleutel kloppen; anders null. De
     vergelijking loopt over de hash, in constante tijd. */
  function welke(id, sleutel) {
    const n = String(id || '').trim().toLowerCase();
    const s = String(sleutel || '');
    if (!NAAM.test(n) || !/^[0-9a-f]{48}$/.test(s)) return null;
    const r = (eigen.kijk('doosSleutels') || {})[n];
    if (!r || !r.hash) return null;
    const a = Buffer.from(r.hash, 'hex'), b = Buffer.from(hash(s), 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? n : null;
  }

  /* De schaduw: langs welke weg kwam een geldige doos-aanroep. Een teller en
     geen journaal; in het verzoek, dus save() mag hier. */
  function telWeg(weg) {
    const k = eigen.bak('doosSleutelwegen');
    k[weg] = (k[weg] || 0) + 1;
    save();
  }

  function overzicht() {
    const k = eigen.kijk('doosSleutels') || {};
    return {
      dozen: Object.keys(k).sort().map(n => ({ doos: n, sinds: k[n].sinds })),
      wegen: Object.assign({ gedeeld: 0, eigen: 0 }, eigen.kijk('doosSleutelwegen') || {}),
      uitleg: 'Fase 7 in de schaduw: de gedeelde doos-sleutel werkt nog. Zodra wegen.gedeeld niet meer stijgt, ' +
        'kan hij weg -- dat is een apart besluit.'
    };
  }

  return { geef, trekIn, welke, telWeg, overzicht };
}

/* EEN INSTANTIE PER DATABASE. Twee domeinen gebruiken dit register (de vloot in
   routes/doos.js, het uitgeven in routes/kantoren/doossleutels.js), en zonder
   deze cache zouden er twee zijn met elk een eigen greep op dezelfde collectie. */
const cache = new WeakMap();
function doosSleutelsVan({ db, save, crypto }) {
  if (!cache.has(db)) cache.set(db, maakDoosSleutels({ db, save, crypto }));
  return cache.get(db);
}

module.exports = { maakDoosSleutels, doosSleutelsVan };
