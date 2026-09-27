/* ============================================================================
   HET LEERHUIS -- besluit B1 in de schaduw: een echte RTG-handeling leest de
   geschiktheid mee, en houdt NIEMAND tegen.

   Besluit B1 (ACADEMY.md par. 5, 27 september 2026): eerst EEN handeling, in de
   vorm van de beleidsmotor (kern/beleidsmotor/, besluit A3): meelezen en
   tellen. Wat hier geteld wordt is precies de vraag die afdwingen later zou
   stellen: van de keren dat de kantoorpoort iemand toeliet, hoe vaak was die
   mens volgens het leerhuis GESCHIKT voor deze handeling?

     eens      toegelaten, en AUTHORITY_ELIGIBLE
     oneens    toegelaten, en NOT_ELIGIBLE -- afdwingen had hem tegengehouden
     onbekend  geen mens op naam (de gedeelde code), of geen leerhuis van die
               organisatie; ONBEKEND is geen WEIGEREN (AUTHORITY.md grens 5)

   Alleen een AFGEROND antwoord met 2xx telt: een weigering door de poort zelf is
   geen waarneming over het leerhuis.

   EEN TELLER EN GEEN JOURNAAL, woord voor woord de grens van de beleidsmotor:
   per route drie getallen, geen wie, geen wanneer. Een "oneens" met een naam
   erbij is een lijst medewerkers die straks niets meer mogen, en die hoort niet
   te bestaan voordat een mens heeft besloten dat er afgedwongen wordt.

   WAAROM NIET IN kern/beleidsmotor/index.js: dat bestand staat op 9372 bytes,
   net onder de band van keuringsregel 13, en een deur-motor die per handeling
   gaat denken is een ontwerpstap van AUTHORITY.md en geen bijzin. Zodra die
   motor handelingen als feit kent, verhuist deze teller erheen.
   ========================================================================== */
'use strict';

const { maakLeerhuis } = require('./index');

/* De ene handeling. De sleutel is METHODE + routepatroon, zoals de beleidsmotor
   hem telt; de organisatie is het RTG-eigen leerhuis (besluit B7 vult het). */
const SCHADUW = Object.freeze({
  'POST /api/office/pay/factuurcorrectie': { org: 'RTG', handeling: 'betaling.terugboeken' }
});
const VELDEN = ['eens', 'oneens', 'onbekend'];

function maakSchaduw({ db, save, sessionFor }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/leerhuis', bezit: { leerhuisSchaduw: 'kaart' } });
  const lh = maakLeerhuis({ db, save });

  function persoonVan(req) {
    const kop = (req && typeof req.get === 'function' && req.get('authorization')) || '';
    const token = kop.startsWith('Bearer ') ? kop.slice(7) : null;
    let sess = null;
    try { sess = token && typeof sessionFor === 'function' ? sessionFor(token) : null; } catch (e) { sess = null; }
    const m = /^user-(\d+)$/.exec(String((sess && sess.lidKey) || ''));
    return m ? 'lid:' + m[1] : null;
  }

  function oordeel(sleutel, req) {
    const d = SCHADUW[sleutel];
    if (!d) return null;
    const p = persoonVan(req);
    if (!p || !lh.stand(d.org).org) return 'onbekend';
    return lh.lees.geschiktheid(d.org, p, d.handeling).uitkomst === 'AUTHORITY_ELIGIBLE' ? 'eens' : 'oneens';
  }

  function tel(sleutel, veld) {
    const bak = eigen.bak('leerhuisSchaduw');
    const r = bak[sleutel] || (bak[sleutel] = { eens: 0, oneens: 0, onbekend: 0, sinds: new Date().toISOString() });
    r[veld] = (r[veld] || 0) + 1;
    save();
  }

  /* Na afloop, op 'close' (niet op 'finish': daar hangen op een kantoorroute
     al tien luisteraars, zie kern/beleidsmotor/index.js). Een fout in deze
     meting raakt nooit het antwoord. */
  function meelezer(req, res, next) {
    /* Het volle pad en niet req.path: die is binnen een app.use relatief aan het
       koppelpunt (server/web/verrijk.js zet originalUrl een keer, bij binnenkomst). */
    const sleutel = (req.method || 'POST') + ' ' + String(req.originalUrl || req.url || '').split('?')[0];
    if (SCHADUW[sleutel] && res && typeof res.once === 'function') {
      res.once('close', () => {
        try {
          if (res.writableFinished === false || res.statusCode < 200 || res.statusCode >= 300) return;
          const veld = oordeel(sleutel, req);
          if (veld && VELDEN.includes(veld)) tel(sleutel, veld);
        } catch (e) { /* een meting raakt geen antwoord */ }
      });
    }
    next();
  }

  function stand() {
    const bak = eigen.kijk('leerhuisSchaduw') || {};
    return {
      uitleg: 'Besluit B1 in de schaduw: bij elke toegelaten aanroep leest het leerhuis mee of deze mens geschikt is. Het houdt niets tegen.',
      grens: 'Een teller en geen journaal: geen namen, geen tijden. oneens = hoe vaak afdwingen iemand had tegengehouden; onbekend is geen weigeren.',
      routes: Object.entries(SCHADUW).map(([route, d]) => Object.assign({ route, org: d.org, handeling: d.handeling },
        { eens: 0, oneens: 0, onbekend: 0, sinds: null }, bak[route] || {}))
    };
  }

  return { meelezer, stand, oordeel, SCHADUW };
}

module.exports = { maakSchaduw, SCHADUW };
