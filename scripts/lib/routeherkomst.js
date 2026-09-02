/* WELK BESTAND HANGT WELKE ROUTE OP.

   scripts/routekaart.js legt uit waarom dit niet uit de brontekst te lezen is:
   routes worden op vier manieren opgehangen (letterlijk, via een gemounte
   router, via een voorvoegsel-hulpje, en via een hulpje in een hulpje), en een
   scanner die de bron leest mist de laatste twee. Diezelfde reden geldt hier,
   alleen wil deze lezer niet weten OF een pad bestaat maar WIE hem ophangt.

   Daarom vragen we het de router zelf, op het moment van ophangen: server/web/
   routing.js wordt vooraf geladen en zijn maakRouter() ingepakt, zodat elke
   laag de stapel meekrijgt van waar hij vandaan kwam. Daarna start de app in
   dit proces (op een vrije poort, in een tijdelijke datamap) en lezen we de
   lagen uit.

   DE HANDLER IS DE LAATSTE LAAG. Een route is hier een reeks lagen met hetzelfde
   pad en dezelfde methode: alles vóór de laatste is een bewaker. Wie de EERSTE
   laag als eigenaar neemt, schrijft elke route van het huis toe aan de bewaker
   die ervoor hangt. Die regel staat niet hier verzonnen maar in
   server/kern/routedekking.js, en wordt daar ook zo gebruikt.

   DE WIKKEL. Alle 4748 routes dragen server/lib/foutisolatie.js als bovenste
   stapelframe -- dat is de wikkel waar elke handler doorheen gaat, en niet de
   eigenaar. Hij staat hieronder in een tabel met die meting erbij; wie er een
   tweede wikkel bij zet, doet dat met een reden en een getal.

   EN DE KERN-TAS, want zonder die is de meting eromheen fictie. De meeste
   route-bestanden van dit huis hebben NUL requires: server/routes/gewoonten.js
   begint met `module.exports = (kern) => { const { app, auth, gewoontenVan, ...
   } = kern; }` en krijgt zijn hele domein via die tas binnen. Een meting die
   alleen de require-graaf leest, ziet zo'n functie dus als een eiland van een
   bestand -- en dat is niet voorzichtig maar gewoon fout.

   De tas wordt gevuld met `Object.assign(kern, require('../kern/X')(...))` in
   server/opzet/kernlaag*.js. Daarom wordt tijdens het opstarten bijgehouden
   welk BESTAND welke sleutel heeft bijgedragen: require() geeft een gemerkt
   antwoord terug (een Proxy die het resultaat van een fabriek merkt), en
   Object.assign onthoudt per doel welke sleutel van welk bestand kwam. Na het
   opstarten is de tas het doel met de meeste bijdragen -- hij heeft geen naam
   die van buiten te zien is, dus hij wordt HERKEND en niet aangewezen.

   HET MERK MOET OP DE WAARDE EN NIET ALLEEN OP HET OBJECT. Een deel van de tas
   wordt gevuld met een LETTERLIJK object: `Object.assign(kern, { vonkBericht:
   mod.bericht, vonkBetaal: mod.betaal })`. Zo'n literaal komt niet uit een
   require en draagt dus geen merk -- en negen routes van RTG Vonk zagen er
   daardoor uit als een bestand zonder enige afhankelijkheid. Daarom wordt bij
   het merken van een object ook elke functie ERIN gemerkt, zodat een sleutel
   die via een literaal binnenkomt alsnog terug te voeren is op zijn bestand.

   Wat daarna niet herleidbaar is, staat er ook niet: `app` en `auth` komen niet
   uit een module maar uit server.js zelf, en blijven dus onbekend. Dat is een
   uitslag, geen gat om op te vullen.

   Deze module START DE APP. Dat kost seconden en een tijdelijke datamap; een
   toets hoort hem dus niet aan te roepen. De analyse eromheen
   (scripts/activering.js) is puur en werkt op de uitkomst. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..', '..');

/* Bestanden die op de stapel staan zonder de eigenaar te zijn. Elke regel
   draagt de meting die hem rechtvaardigt -- een skiplijst zonder getal is een
   plek waar een echte eigenaar stilletjes in verdwijnt. */
const WIKKELS = [
  ['server/lib/foutisolatie.js',
   'de foutwikkel om elke handler; stond op 2 september 2026 bij 4748 van de 4748 routes als bovenste frame']
];
const isWikkel = rel => WIKKELS.some(w => w[0] === rel);

function vrijePoort() {
  const uit = require('child_process').execFileSync(process.execPath, ['-e',
    "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{" +
    "process.stdout.write(String(s.address().port));s.close();});"],
  { encoding: 'utf8', timeout: 10000 });
  const n = Number(String(uit).trim());
  if (!(n > 1024 && n < 65536)) throw new Error('geen vrije poort gekregen');
  return n;
}

/* De stapel op het moment van ophangen, teruggebracht tot bestanden van dit
   huis. server/web/ valt eruit: dat is de router zelf. */
function frames() {
  const oud = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, s) => s;
  const e = new Error();
  Error.captureStackTrace(e, frames);
  const st = e.stack;
  Error.prepareStackTrace = oud;
  const uit = [];
  for (const f of st) {
    const fn = f.getFileName && f.getFileName();
    if (!fn) continue;
    const rel = path.relative(WORTEL, fn).replace(/\\/g, '/');
    if (!rel.startsWith('server/') || rel.startsWith('server/web/')) continue;
    if (uit[uit.length - 1] !== rel) uit.push(rel);
    if (uit.length >= 6) break;
  }
  return uit;
}

/* De eigenaar: het eerste frame dat geen wikkel is. Blijft er niets over, dan
   is dat een eigen uitslag (null) en geen gok. */
function eigenaarVan(stapel) {
  for (const f of stapel || []) if (!isWikkel(f)) return f;
  return null;
}

/* Het merken. Een fabriek (module.exports = (deps) => obj) geeft bij elke
   aanroep een nieuw object terug; dat object draagt geen spoor van waar het
   vandaan komt. De Proxy hieronder merkt het resultaat op het moment dat de
   fabriek wordt aangeroepen. Alles gebeurt in een try: een meter mag het
   opstarten nooit tegenhouden. */
function merkRequire(BRON, BRON_FN) {
  /* Merk het object EN zijn functiewaarden: zie de kop, het literaal-geval. */
  const merk = (o, rel) => {
    try {
      if (!o || (typeof o !== 'object' && typeof o !== 'function')) return;
      if (!BRON.has(o)) BRON.set(o, rel);
      if (typeof o === 'object') {
        for (const k of Object.keys(o)) {
          let v; try { v = o[k]; } catch (e) { continue; }
          if (typeof v === 'function' && !BRON_FN.has(v)) BRON_FN.set(v, rel);
        }
      }
    } catch (e) { /* bevroren of exotisch object */ }
  };
  const Module = require('module');
  const orig = Module.prototype.require;
  Module.prototype.require = function (id) {
    const uit = orig.apply(this, arguments);
    try {
      const f = Module._resolveFilename(id, this);
      if (typeof f === 'string' && f.startsWith(path.join(WORTEL, 'server') + path.sep)) {
        const rel = path.relative(WORTEL, f).replace(/\\/g, '/');
        if (typeof uit === 'function' && !BRON.has(uit)) {
          const p = new Proxy(uit, { apply(t, th, a) {
            const r = Reflect.apply(t, th, a);
            merk(r, rel);
            return r;
          } });
          BRON.set(p, rel);
          return p;
        }
        if (uit && typeof uit === 'object') merk(uit, rel);
      }
    } catch (e) { /* nooit het laden raken */ }
    return uit;
  };
  return () => { Module.prototype.require = orig; };
}

function lees() {
  if (!process.env.PORT) process.env.PORT = String(vrijePoort());
  if (!process.env.RTG_DATA_DIR) process.env.RTG_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-activering-'));
  process.env.SMTP_URL = process.env.SMTP_URL || '';
  process.env.STUN_UIT = '1';

  const routing = require(path.join(WORTEL, 'server', 'web', 'routing.js'));
  const origMaak = routing.maakRouter;
  const ROUTERS = [];
  routing.maakRouter = function () {
    const r = origMaak.apply(this, arguments);
    ROUTERS.push(r);
    const zet = () => {
      const f = frames();
      /* Achterstevoren tot de eerste laag die al een herkomst draagt: een
         aanroep kan meer dan een laag tegelijk ophangen (app.get met drie
         functies), en die horen allemaal bij dezelfde regel code. */
      for (let i = r._stack.length - 1; i >= 0; i--) {
        if (r._stack[i].herkomst) break;
        r._stack[i].herkomst = f;
      }
    };
    for (const m of ['get', 'post', 'put', 'delete', 'patch', 'all', 'head', 'options', 'use']) {
      const o = r[m];
      r[m] = function () { const uit = o.apply(this, arguments); zet(); return uit; };
    }
    return r;
  };

  /* De twee merkingen om het opstarten heen. Allebei worden ze daarna weer
     teruggedraaid, ook als het laden stukloopt. */
  const BRON = new WeakMap();
  const BRON_FN = new WeakMap();
  const herstelRequire = merkRequire(BRON, BRON_FN);
  const DOELEN = [];
  const bijdragen = new WeakMap();
  const origAssign = Object.assign;
  Object.assign = function (doel, ...bronnen) {
    const uit = origAssign.apply(this, arguments);
    try {
      if (doel && typeof doel === 'object') {
        let m = bijdragen.get(doel);
        if (!m) { m = new Map(); bijdragen.set(doel, m); DOELEN.push(doel); }
        for (const b of bronnen) {
          if (!b || (typeof b !== 'object' && typeof b !== 'function')) continue;
          const bronVanObject = BRON.get(b);
          for (const k of Object.keys(b)) {
            if (m.has(k)) continue;
            let waarde; try { waarde = b[k]; } catch (e) { waarde = undefined; }
            /* De waarde gaat VOOR: bij `Object.assign(kern, { x: mod.x })` weet
               alleen de waarde waar zij vandaan komt. */
            const bron = (typeof waarde === 'function' && BRON_FN.get(waarde)) ||
              (waarde && typeof waarde === 'object' && BRON.get(waarde)) || bronVanObject;
            if (bron) m.set(k, bron);
          }
        }
      }
    } catch (e) { /* nooit het laden raken */ }
    return uit;
  };

  const echt = { log: console.log, warn: console.warn, info: console.info, error: console.error };
  console.log = console.warn = console.info = () => {};
  let app;
  try { app = require(path.join(WORTEL, 'server', 'server')).app; }
  finally { Object.assign = origAssign; herstelRequire(); Object.assign(console, echt); }

  /* De tas herkennen: het doel met de meeste herleidbare sleutels. */
  let tas = null, grootste = 0;
  for (const d of DOELEN) { const m = bijdragen.get(d); if (m && m.size > grootste) { grootste = m.size; tas = d; } }
  const kernBron = {};
  if (tas) for (const [k, v] of bijdragen.get(tas)) kernBron[k] = v;
  /* EN DE SLEUTELS DIE ER RECHTSTREEKS IN GEZET ZIJN. Niet alles komt via
     Object.assign binnen: `kern.vakwerk = require(...)(...)` zet een sleutel
     zonder dat er iets te onderscheppen valt. Die kwamen als onbekend terug, en
     32 functies leken daardoor een envelop van EEN knoop te hebben -- wat op een
     scherm leest als "raakt bijna niets" terwijl het "hierover is niets bekend"
     betekent. Dat verschil is de hele meter.

     Nu de tas eenmaal herkend is, kan het achteraf: elke sleutel die nog geen
     bron heeft, wordt op zijn WAARDE opgezocht. */
  if (tas) {
    for (const k of Object.keys(tas)) {
      if (kernBron[k]) continue;
      let v; try { v = tas[k]; } catch (e) { continue; }
      const bron = (typeof v === 'function' && BRON_FN.get(v)) ||
        (v && (typeof v === 'object' || typeof v === 'function') && BRON.get(v)) || null;
      if (bron) kernBron[k] = bron;
    }
  }

  const aantal = app._routes().length;
  const wortelRouter = ROUTERS.find(r => r._routes('').length === aantal);
  if (!wortelRouter) throw new Error('de wortelrouter is niet terug te vinden; is web/index.js veranderd?');

  const lagen = [];
  (function loop(stack, voor) {
    for (const l of stack) {
      if (l.mount) {
        const kind = l.fn && l.fn._stack;
        if (!Array.isArray(kind)) continue;
        loop(kind, voor + (l.prefix === '/' ? '' : String(l.prefix || '')));
        continue;
      }
      if (typeof l.pad !== 'string') continue;
      lagen.push({ pad: (voor + l.pad).replace(/\/+$/, '') || '/', methode: l.method || 'ALL', stapel: l.herkomst || [] });
    }
  })(wortelRouter._stack, '');

  /* Per route de LAATSTE laag: de handler. */
  const perRoute = new Map();
  for (const l of lagen) perRoute.set(l.methode + ' ' + l.pad, l);
  const routes = [...perRoute.values()].map(l => ({
    methode: l.methode, pad: l.pad, bestand: eigenaarVan(l.stapel), stapel: l.stapel
  }));

  return { routes, lagen: lagen.length, zonderEigenaar: routes.filter(r => !r.bestand).length,
    wikkels: WIKKELS, kernBron, kernSleutels: Object.keys(kernBron).length,
    kernTasGevonden: !!tas };
}

module.exports = { lees, eigenaarVan, WIKKELS };
