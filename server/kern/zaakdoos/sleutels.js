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
   kwam, en die sleutel gaat dicht als elke doos er een heeft (besluit van
   23 september 2026) -- `nogGedeeld` in het overzicht zegt welke nog niet. */
'use strict';

const NAAM = /^[a-z0-9][a-z0-9-]{1,39}$/;

function maakDoosSleutels({ db, save, crypto, nu }) {
  const tijd = nu || Date.now;
  const eigen = require('../eigencollectie')({ db, domein: 'kern/zaakdoos/sleutels',
    bezit: { doosSleutels: 'kaart', doosSleutelwegen: 'kaart', doosGedeeldGezien: 'kaart' } });
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
     geen journaal; in het verzoek, dus save() mag hier.

     Bij de GEDEELDE weg onthouden we ook de naam die de doos ZELF opgaf, met de
     laatste keer: zo ziet het kantoor welke dozen nog een eigen sleutel nodig
     hebben (besluit van de eigenaar, 23 september 2026: de gedeelde sleutel gaat
     pas dicht als elke doos er een heeft). Die naam is een ZELFOPGAVE en geen
     identiteit -- het overzicht zegt dat er ook bij. Per naam een regel, geen
     reeks; wat dertig dagen niet meer is gezien valt eraf, en er staan er nooit
     meer dan MAX_GEZIEN (wie de gedeelde sleutel heeft, kan namen verzinnen). */
  const MAX_GEZIEN = 200, VERGEET = 30 * 86400000, VENSTER = 7 * 86400000;
  function telWeg(weg, opgegeven) {
    const k = eigen.bak('doosSleutelwegen');
    k[weg] = (k[weg] || 0) + 1;
    if (weg === 'gedeeld') {
      const g = eigen.bak('doosGedeeldGezien');
      const nuT = tijd();
      const n = String(opgegeven || '').trim().toLowerCase();
      const naam = NAAM.test(n) ? n : '(geen geldige naam)';
      for (const x of Object.keys(g)) if (nuT - Date.parse(g[x].laatst) > VERGEET) delete g[x];
      if (!g[naam] && Object.keys(g).length >= MAX_GEZIEN) {
        const oudste = Object.keys(g).sort((a, b) => Date.parse(g[a].laatst) - Date.parse(g[b].laatst))[0];
        delete g[oudste];
      }
      g[naam] = { laatst: new Date(nuT).toISOString(), aantal: ((g[naam] && g[naam].aantal) || 0) + 1 };
    }
    save();
  }

  function overzicht() {
    const k = eigen.kijk('doosSleutels') || {};
    const g = eigen.kijk('doosGedeeldGezien') || {};
    const nuT = tijd();
    return {
      dozen: Object.keys(k).sort().map(n => ({ doos: n, sinds: k[n].sinds })),
      nogGedeeld: Object.keys(g).filter(n => nuT - Date.parse(g[n].laatst) <= VENSTER).sort()
        .map(n => ({ doos: n, laatst: g[n].laatst, aantal: g[n].aantal, heeftEigen: !!k[n] })),
      nogGedeeldUitleg: 'Dozen die de afgelopen zeven dagen met de gedeelde sleutel meldden, onder de naam die ze ZELF ' +
        'opgaven: een zelfopgave en geen identiteit. heeftEigen betekent dat er al een eigen sleutel voor die naam is ' +
        'uitgegeven maar nog niet op de doos staat. Zodra deze lijst leeg blijft, kan de gedeelde sleutel dicht.',
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
