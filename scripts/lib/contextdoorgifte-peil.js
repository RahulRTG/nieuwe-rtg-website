/* DE PEILING IN DE SERVER -- de helft van scripts/contextdoorgifte.js die in het
   serverproces draait (`node -r` voor server/server.js).

   Hij leest alleen: de getters van de contexten, een omhulling van
   kern/envelop.maak, van kostenhaak.binnen (het auth-punt waar elke drager wordt
   gezet) en van de drie timerfuncties. Niets in het gedrag verandert; de
   uitslag gaat bij afsluiten naar CONTEXTDOORGIFTE_UIT.

   DE IJKING DRAAIT EERST, in hetzelfde proces en langs dezelfde omhullingen:
   een nagebootst verzoek zet een timer die na afloop vuurt, maakt een envelop
   met de verzoekcorrelatie, en een auth-punt zonder verzoek wordt aangeroepen.
   Ziet de peiling die drie niet, dan is het instrument stuk en zegt de meter
   dat -- in plaats van een nul die op "alles in orde" lijkt (LAT.md regel 10).
   De ijking telt apart (R.ijk) en nooit mee met de meting. */
'use strict';
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { AsyncResource } = require('async_hooks');

const WORTEL = path.join(__dirname, '..', '..');
const UIT = process.env.CONTEXTDOORGIFTE_UIT;
const S = (p) => require(path.join(WORTEL, 'server', p));
const handeling = S('opzet/handeling');
const kenv = S('kern/envelop');
const haak = S('kern/kosten/haak');
const em = S('effectmeter');
const aic = S('ai-context');
const vf = S('opzet/verzoekframe');

const leeg = () => ({
  envelop: { binnenVerzoek: 0, metVerzoekCorrelatie: 0, metActor: 0, metSessie: 0, kanalen: {} },
  auth: { n: 0, post: 0, metHandeling: 0, metAiContext: 0, metEffectteller: 0, postMetAlleDrie: 0,
    correlatieEens: 0, correlatieOneens: 0, metFrame: 0, frameEens: 0, frameOneens: 0, frameWaarom: {} },
  i2: [],
  timers: { gezetInVerzoek: 0, gevuurdMetVerzoek: 0, gevuurdNaAfloop: 0, naAfloopMetDrager: 0,
    naAfloopMetAiSessie: 0, plekken: {} }
});
const R = { meting: leeg(), ijk: leeg(), ijkKlaar: false };
let doel = R.ijk;

const plek = () => {
  const r = (new Error().stack.split('\n').slice(2)
    .find(l => !l.includes('contextdoorgifte-peil') && !l.includes('node:')) || '').trim();
  return r.replace(/^at /, '').replace(/\(.*?\/server\//, '(server/').replace(/:\d+\)$/, ')').slice(0, 140);
};

/* I1: een envelop die binnen een open verzoek wordt gemaakt. */
const echtMaak = kenv.maak;
kenv.maak = function (o) {
  const r = echtMaak.apply(this, arguments);
  try {
    const h = handeling.huidige();
    if (h && !h.gesloten) {
      const e = doel.envelop;
      e.binnenVerzoek++;
      e.kanalen[r.kanaal] = (e.kanalen[r.kanaal] || 0) + 1;
      if (r.correlatie && r.correlatie === h.correlatie) e.metVerzoekCorrelatie++;
      if (r.actor) e.metActor++;
      if (haak.wieNu() !== haak.HUIS) e.metSessie++;
    }
  } catch (e) { /* peilen breekt nooit een verzoek */ }
  return r;
};

/* I3 en I10: het auth-punt. Daar is de identiteit vastgesteld en het lijf gelezen. */
const echtBinnen = haak.binnen;
haak.binnen = function (d, fn, pas, herkomst) {
  return echtBinnen.call(this, d, () => {
    try {
      const a = doel.auth, h = handeling.huidige(), c = aic.huidig(), t = em.huidig();
      const req = c && c.req;
      a.n++;
      if (h) a.metHandeling++;
      if (c) a.metAiContext++;
      if (t) a.metEffectteller++;
      if (req && req.method === 'POST') { a.post++; if (h && c && t) a.postMetAlleDrie++; }
      /* I2: de proefverzoeken van de meter dragen een X-Request-Id die met I2-
         begint; hier staat wat de server ervan maakte (correlatie en extern). */
      const kop = req && req.headers && req.headers['x-request-id'];
      if (typeof kop === 'string' && kop.startsWith('I2-') && doel.i2.length < 20) {
        doel.i2.push({ kopLengte: kop.length, kopIsCorrelatie: req.id === kop,
          handelingIsKop: !!h && h.correlatie === kop, extern: req.externeId === undefined ? '(ontbreekt)' : req.externeId });
      }
      if (h && req) {
        const env = req.envelop;
        const eens = req.id === h.correlatie && (!env || env.correlatie === h.correlatie);
        if (eens) a.correlatieEens++; else a.correlatieOneens++;
      }
      /* I14: het verzoekframe is op het auth-punt aanwezig en eens met de rest:
         correlatie (handeling, req.id), extern, actor (req.envelop) en drager
         (de kostenhaak). Bij oneens telt het EERSTE vak dat verschilt. */
      const f = vf.huidig();
      if (f) {
        a.metFrame++;
        const env = req && req.envelop;
        const waarom = !h || f.correlatie !== h.correlatie ? 'correlatie-handeling'
          : !req || f.correlatie !== req.id ? 'correlatie-req'
          : f.extern !== (req.externeId == null ? null : req.externeId) ? 'extern'
          : env && (!f.actor || f.actor.sleutel !== (env.actor && env.actor.id || null)) ? 'actor'
          : !f.drager || f.drager.drager !== haak.wieNu() ? 'drager' : null;
        if (waarom) { a.frameOneens++; a.frameWaarom[waarom] = (a.frameWaarom[waarom] || 0) + 1; }
        else a.frameEens++;
      }
    } catch (e) { /* idem */ }
    return fn();
  }, pas, herkomst);
};

/* I4: een timer die binnen een verzoek wordt gezet en NA afloop vuurt, en dan
   nog de identiteit van dat verzoek draagt. */
for (const naam of ['setTimeout', 'setInterval', 'setImmediate']) {
  const echt = global[naam];
  global[naam] = function (fn, ...rest) {
    if (typeof fn !== 'function') return echt.call(this, fn, ...rest);
    const bij = doel;
    const h0 = handeling.huidige();
    const waar = h0 ? plek() : null;
    if (h0) bij.timers.gezetInVerzoek++;
    const omhuld = function () {
      try {
        const h = handeling.huidige();
        if (h) {
          bij.timers.gevuurdMetVerzoek++;
          if (h.gesloten) {
            const t = bij.timers;
            t.gevuurdNaAfloop++;
            const k = haak.wieNu(), c = aic.huidig();
            const sessie = !!(c && c.req && c.req.session);
            if (k !== haak.HUIS) t.naAfloopMetDrager++;
            if (sessie) t.naAfloopMetAiSessie++;
            const s = waar || '?';
            t.plekken[s] = (t.plekken[s] || 0) + 1;
          }
        }
      } catch (e) { /* idem */ }
      return fn.apply(this, arguments);
    };
    return echt.call(this, omhuld, ...rest);
  };
}

/* DE IJKING. Een nagebootst verzoek langs de echte handelingsmiddleware. */
function ijk() {
  const req = { id: 'ijk-correlatie', path: '/ijk', method: 'POST', ip: '127.0.0.1', session: { key: 'ijk' } };
  const res = new EventEmitter();
  const mw = handeling.middleware({ data: () => null, log: () => {} });
  let naAfloop = null;
  /* Het frame krijgt met opzet een ANDERE correlatie dan de handeling (I14 moet
     oneens zien) en wordt twee keer geidentificeerd met een andere sleutel (I13). */
  vf.middleware()(Object.assign(Object.create(req), { id: 'ijk-anders' }), res, () => mw(req, res, () => {
    vf.identificeer({ sleutel: 'ijk-a' });
    try { vf.identificeer({ sleutel: 'ijk-b' }); } catch (e) { /* verwacht: dat is de ijking */ }
    aic.inContext({ ip: req.ip, req }, () => {
      haak.binnen(haak.drager('lid', 'ijk'), () => {
        kenv.maak({ kanaal: 'ijk', correlatie: req.id });
        naAfloop = AsyncResource.bind(() => setTimeout(() => {}, 1));
      });
    });
  }));
  res.emit('finish');
  /* De timer wordt NA afloop gezet maar in de context van het verzoek: precies
     de vorm van een gedeelde spoeltimer die zijn ronde begint. */
  naAfloop();
  haak.binnen(haak.HUIS, () => {});   // een auth-punt zonder verzoek: moet als ZONDER tellen
  setTimeout(() => { R.ijkKlaar = true; R.frameIjk = vf.tellers(); doel = R.meting; }, 30);
}
try { ijk(); } catch (e) { R.ijkFout = String(e && e.message || e).slice(0, 200); doel = R.meting; }

/* Atomair (tmp + rename): de meter leest terwijl dit nog loopt, en een half
   geschreven bestand hoort geen lege uitslag te worden. Een mislukte schrijf
   breekt de server niet; de meter ziet dan geen bestand en stopt. */
const schrijf = () => {
  if (!UIT) return;
  R.frameTellers = vf.tellers();
  try { fs.writeFileSync(UIT + '.tmp', JSON.stringify(R)); fs.renameSync(UIT + '.tmp', UIT); }
  catch (e) { process.stderr.write('contextdoorgifte-peil: schrijven mislukt: ' + e.message + '\n'); }
};
const t = setInterval(schrijf, 1000); t.unref();
process.on('exit', schrijf);
