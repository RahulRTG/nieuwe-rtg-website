/* DE DISPATCH-INDEX VAN DE ROUTER (server/web/routing.js).

   De router liep bij elk verzoek de hele lagenlijst af. Met 8.004 lagen op de
   bovenste stapel is dat gemiddeld vierduizend vergelijkingen per verzoek,
   synchroon, op de enige event-loop die er is. Sinds 24 augustus 2026 staat er
   een index voor: vaste paden in een Map op "METHODE\0pad", en alles wat geen
   vast pad is (mounts, middleware, :param, RegExp, .all) in een lijst die altijd
   meedoet. Een verzoek loopt die twee samengevoegd af.

   WAAROM DEZE TOETS ZO IS GEBOUWD. Een index die de goede route vindt is niet
   genoeg. Een router is VOLGORDEGEVOELIG: welke lagen er draaien, en in welke
   volgorde, is het gedrag. Een toets die alleen op de statuscode kijkt, ziet een
   overgeslagen middleware niet -- en dat is precies de fout die je hier maakt.

   Daarom staat de OUDE lineaire scan hieronder als referentie, en vergelijkt de
   toets het SPOOR: welke lagen draaiden, in welke volgorde, met welke uitkomst.
   Over willekeurig gebouwde routetabellen, met alle vormen die er in het echt
   ook zijn: middleware, gemounte routers, foutmiddleware, lagen die gooien,
   lagen die antwoorden, en -- de lastigste -- lagen die req.url herschrijven
   (dat doet server/middleware/voordeur.js op '/' echt).

   Draai los: node --test test/routerindex.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakRouter } = require('../server/web/routing.js');

/* ---------- de referentie: de lineaire scan, zoals hij was ---------- */
function padNaar(url) { const i = url.indexOf('?'); return i === -1 ? url : url.slice(0, i); }
function compilePad(pat) {
  if (pat instanceof RegExp) return { rx: pat, keys: [] };
  if (!/:/.test(pat)) return { str: pat };
  const keys = [];
  const bron = pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:([A-Za-z0-9_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
  return { rx: new RegExp('^' + bron + '\\/?$'), keys };
}
function padMatch(laag, pn) {
  if (laag.str != null) return (pn === laag.str || pn === laag.str + '/') ? {} : null;
  const m = laag.rx.exec(pn);
  if (!m) return null;
  const params = {};
  for (let i = 0; i < laag.keys.length; i++) { try { params[laag.keys[i]] = decodeURIComponent(m[i + 1]); } catch (e) { params[laag.keys[i]] = m[i + 1]; } }
  return params;
}
function mountMatch(prefix, pn) {
  if (prefix === '/' || prefix === '' || prefix == null) return { rest: pn, len: 0 };
  if (pn === prefix || pn.startsWith(prefix + '/')) return { rest: pn.slice(prefix.length) || '/', len: prefix.length };
  return null;
}
function traagRouter() {
  const lagen = [];
  function voegToe(method, pat, fns) {
    const c = compilePad(pat);
    for (const fn of fns) { if (typeof fn !== 'function') continue;
      lagen.push({ method, pad: pat, str: c.str, rx: c.rx, keys: c.keys || [], fn, fout: fn.length === 4, mount: false }); }
  }
  function handle(req, res, klaar) {
    let i = 0; const startUrl = req.url; const buitenParams = req.params || {};
    function next(err) {
      for (;;) {
        if (i >= lagen.length) { req.url = startUrl; return klaar(err); }
        const laag = lagen[i++];
        if (err && !laag.fout) continue;
        if (!err && laag.fout) continue;
        const methodeOk = !laag.method || laag.method === req.method || (laag.method === 'GET' && req.method === 'HEAD');
        if (laag.method && !methodeOk) continue;
        const pn = padNaar(req.url);
        if (laag.mount) {
          const mm = mountMatch(laag.prefix, pn);
          if (!mm) continue;
          req.params = { ...buitenParams };
          const oudUrl = req.url;
          req.url = mm.len ? req.url.slice(mm.len) || '/' : req.url;
          const oudVoor = req.routeVoorvoegsel || '';
          if (mm.len) req.routeVoorvoegsel = oudVoor + laag.prefix;
          const verder = (e) => { req.url = oudUrl; req.params = buitenParams; req.routeVoorvoegsel = oudVoor; next(e); };
          return laag.fout ? laag.fn(err, req, res, verder) : laag.fn(req, res, verder);
        }
        const params = padMatch(laag, pn);
        if (params === null) continue;
        req.params = { ...buitenParams, ...params };
        if (laag.method && typeof laag.pad === 'string')
          req.routePatroon = ((req.routeVoorvoegsel || '') + laag.pad).replace(/\/+$/, '') || '/';
        try { if (laag.fout) return laag.fn(err, req, res, next); return laag.fn(req, res, next); }
        catch (e) { err = e; continue; }
      }
    }
    next();
  }
  const router = function (req, res, next) { handle(req, res, next || (() => {})); };
  router._stack = lagen; router._handle = handle;
  router.use = function (arg0, ...rest) {
    if (typeof arg0 === 'string') { for (const fn of rest) { if (typeof fn !== 'function') continue; lagen.push({ method: null, mount: true, prefix: arg0, fn, fout: fn.length === 4 }); } }
    else { for (const fn of [arg0, ...rest]) { if (typeof fn !== 'function') continue; lagen.push({ method: null, mount: true, prefix: '/', fn, fout: fn.length === 4 }); } }
    return router;
  };
  for (const m of ['get', 'post', 'put', 'delete', 'patch', 'all', 'head', 'options'])
    router[m] = function (pat, ...fns) { voegToe(m === 'all' ? null : m.toUpperCase(), pat, fns); return router; };
  return router;
}

/* ---------- dezelfde routetabel in beide, uit hetzelfde zaad ---------- */
const SEG = ['api', 'member', 'office', 'supplier', 'x', 'y', 'apps', 'rtf'];
const HERSCHRIJF_NAAR = '/api/member';

function bouwPaar(zaadStart) {
  const spoor = [];
  let zaad = 0;
  const rnd = () => (zaad = (zaad * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const kies = a => a[Math.floor(rnd() * a.length) % a.length];
  function randPad() {
    const n = 1 + Math.floor(rnd() * 3);
    let p = '';
    for (let i = 0; i < n; i++) p += '/' + (rnd() < 0.12 ? ':id' + i : kies(SEG));
    return p;
  }
  const maak = (maker) => {
    zaad = zaadStart;
    const app = maker();
    const n = 40 + Math.floor(rnd() * 60);
    for (let i = 0; i < n; i++) {
      const id = i, r = rnd();
      if (r < 0.10) app.use((rq, rs, nx) => { spoor.push(id + 'mw'); nx(); });
      else if (r < 0.14) { const sub = maker(); sub.get('/binnen', (rq, rs, nx) => { spoor.push(id + 'sub'); nx(); }); app.use('/' + kies(SEG), sub); }
      else if (r < 0.17) app.use((err, rq, rs, nx) => { spoor.push(id + 'fout'); nx(err); });
      else if (r < 0.20) app.get(randPad(), () => { spoor.push(id + 'gooi'); throw new Error('x' + id); });
      else if (r < 0.24) app.get(randPad(), (rq, rs, nx) => { spoor.push(id + 'hs'); rq.url = HERSCHRIJF_NAAR; nx(); });
      else if (r < 0.30) app.get(randPad(), (rq, rs) => { spoor.push(id + 'eind'); rs.end(); });
      else { const m = kies(['get', 'post', 'put', 'delete', 'all']); app[m](randPad(), (rq, rs, nx) => { spoor.push(id + m); nx(); }); }
    }
    return app;
  };
  const traag = maak(traagRouter);
  const snel = maak(maakRouter);
  // verzoeken uit hetzelfde zaad, zodat beide precies dezelfde krijgen
  zaad = zaadStart + 55;
  const verzoeken = [];
  for (let q = 0; q < 250; q++) {
    const url = (rnd() < 0.15 ? HERSCHRIJF_NAAR : randPad().replace(/:id\d/g, () => 'v' + Math.floor(rnd() * 99)))
      + (rnd() < 0.2 ? '/' : '') + (rnd() < 0.2 ? '?a=1' : '');
    verzoeken.push({ methode: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'][Math.floor(rnd() * 5) % 5], url });
  }
  return { traag, snel, spoor, verzoeken };
}

function draai(app, spoor, methode, url) {
  spoor.length = 0;
  const res = { ended: false, end() { this.ended = true; }, on() {}, statusCode: 200 };
  let uitkomst = 'geen-klaar';
  app._handle({ method: methode, url, params: {} }, res, (err) => { uitkomst = err ? 'fout:' + err.message : 'klaar'; });
  return spoor.join(',') + ' | ' + uitkomst;
}

test('1. de index draait exact dezelfde lagen, in dezelfde volgorde, als de lineaire scan', () => {
  let verzoeken = 0;
  for (let ronde = 0; ronde < 40; ronde++) {
    const { traag, snel, spoor, verzoeken: vs } = bouwPaar(1000 + ronde * 7919);
    for (const v of vs) {
      verzoeken++;
      assert.equal(draai(snel, spoor, v.methode, v.url), draai(traag, spoor, v.methode, v.url),
        `spoor loopt uiteen bij ${v.methode} ${v.url} (ronde ${ronde})`);
    }
  }
  assert.ok(verzoeken >= 10000, 'genoeg verzoeken vergeleken: ' + verzoeken);
});

test('2. een middleware die req.url herschrijft wordt opgepikt (de voordeur op /)', () => {
  const app = maakRouter();
  const gezien = [];
  app.get('/', (req, res, next) => { req.url = '/apps/app.html'; next(); });
  app.get('/apps/app.html', (req, res) => { gezien.push('home'); res.end(); });
  draai(app, gezien, 'GET', '/');
  assert.deepEqual(gezien, ['home'], 'zonder herberekening op de nieuwe url zou / een 404 worden');
});

test('3. na een herschrijving begint de keten NIET opnieuw', () => {
  const app = maakRouter();
  const spoor = [];
  app.use((req, res, next) => { spoor.push('mw'); next(); });          // laag 0
  app.get('/', (req, res, next) => { spoor.push('hs'); req.url = '/doel'; next(); });
  app.get('/doel', (req, res) => { spoor.push('doel'); res.end(); });
  draai(app, spoor, 'GET', '/');
  assert.deepEqual(spoor, ['mw', 'hs', 'doel'], 'de middleware hoort EEN keer te draaien, niet twee');
});

test('4. HEAD valt terug op een GET-route, en een afsluitende slash matcht ook', () => {
  const app = maakRouter();
  const spoor = [];
  app.get('/api/x', (req, res) => { spoor.push('raak'); res.end(); });
  assert.match(draai(app, spoor, 'HEAD', '/api/x'), /raak/, 'HEAD hoort op de GET-route te vallen');
  assert.match(draai(app, spoor, 'GET', '/api/x/'), /raak/, 'een afsluitende slash matcht hetzelfde pad');
  assert.doesNotMatch(draai(app, spoor, 'POST', '/api/x'), /raak/, 'POST hoort er niet op te vallen');
});

test('5. een route die NA het eerste verzoek wordt bijgehangen, doet gewoon mee', () => {
  /* De index wordt bij het eerste verzoek gebouwd. Wie daarna registreert en
     geen ongeldigverklaring krijgt, hangt een route op die nooit matcht -- een
     fout die zich pas in productie laat zien. */
  const app = maakRouter();
  const spoor = [];
  app.get('/eerste', (req, res) => { spoor.push('eerste'); res.end(); });
  draai(app, spoor, 'GET', '/eerste');                 // bouwt de index
  app.get('/later', (req, res) => { spoor.push('later'); res.end(); });
  assert.match(draai(app, spoor, 'GET', '/later'), /later/, 'de index moet ongeldig zijn geworden');
  app.use('/gemount', (req, res, next) => { spoor.push('gemount'); next(); });
  assert.match(draai(app, spoor, 'GET', '/gemount/iets'), /gemount/, 'ook een late use() telt mee');
});

test('6. onbekende paden laten de kandidaatcache niet groeien (geen tarpit)', () => {
  /* Een scanner die duizend niet-bestaande adressen probeert, mag geen duizend
     lijsten achterlaten -- dezelfde redenering als waarom server/meting.js op
     het routepatroon telt en niet op het pad. */
  const app = maakRouter();
  app.get('/api/echt', (req, res) => res.end());
  const spoor = [];
  for (let i = 0; i < 2000; i++) draai(app, spoor, 'GET', '/api/bestaat-niet-' + i);
  const na = process.memoryUsage().heapUsed;
  for (let i = 0; i < 2000; i++) draai(app, spoor, 'GET', '/nog-een-ander-' + i);
  assert.ok(process.memoryUsage().heapUsed - na < 40 * 1024 * 1024,
    'de cache hoort begrensd te zijn door de routekaart, niet door het verkeer');
});

/* ---------------------------------------------------------------------------
   DE VANGRAIL: de index MOET meetbaar sneller zijn dan de scan.

   De toetsen hierboven bewaken dat het gedrag gelijk blijft. Dat is de helft:
   een index die zich precies zo gedraagt als de scan én precies zo traag is,
   haalt ze allemaal. Dan is de winst weg zonder dat er iets rood wordt -- en
   dat is nou juist de vorm van erosie waar scripts/norm.js voor bestaat.

   Deze proef meet daarom BEIDE implementaties in dezelfde run, op dezelfde
   routetabel, achter elkaar. Dat is met opzet geen absolute drempel in
   milliseconden: die zegt op een drukke bouwmachine niets en levert een toets
   op die willekeurig knippert. Een VERHOUDING tussen twee implementaties in
   hetzelfde proces valt weg tegen hoe snel de machine toevallig is.

   De marge is ruim. Losgemeten op de echte routeverdeling was de index 111x
   sneller in het midden van de tabel en 199x achteraan; hier staat 15x. We
   zakken dus pas als de winst grotendeels weg is, niet als hij een beetje
   schommelt -- dezelfde afweging als bij de voorcheck-vangrail in
   test/opslag-voorcheck.test.js.
   ------------------------------------------------------------------------ */
test('7. VANGRAIL: de index blijft meetbaar sneller dan de lineaire scan', () => {
  /* Dezelfde vorm als de echte routekaart, gemeten 24 augustus 2026: 8.004
     lagen, waarvan 7.939 een vast pad, 41 met een :param, 23 mounts. */
  const STATISCH = 7939, PARAM = 41, MOUNTS = 23;
  const groepen = ['supplier', 'office', 'member', 'rtf', 'rtfos', 'overheid', 'techniek', 'werkplek', 'lab2', 'command'];
  function bouw(maker) {
    const app = maker();
    for (let i = 0; i < MOUNTS; i++) app.use((rq, rs, nx) => nx());
    const paden = [];
    for (let i = 0; i < STATISCH; i++) {
      const p = '/api/' + groepen[i % groepen.length] + '/route' + i;
      paden.push(p);
      app.get(p, (rq, rs) => rs.end());
    }
    for (let i = 0; i < PARAM; i++) app.get('/api/ding' + i + '/:id', (rq, rs) => rs.end());
    return { app, paden };
  }
  const traag = bouw(traagRouter);
  const snel = bouw(maakRouter);

  const res = { ended: false, end() {}, on() {}, statusCode: 200 };
  function meet(app, url) {
    for (let i = 0; i < 2000; i++) app._handle({ method: 'GET', url, params: {} }, res, () => {});  // opwarmen
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 8000; i++) app._handle({ method: 'GET', url, params: {} }, res, () => {});
    return Number(process.hrtime.bigint() - t0) / 1e6;
  }
  // een route in het MIDDEN van de tabel: daar deed de scan gemiddeld werk
  const url = traag.paden[Math.floor(STATISCH / 2)];
  const msTraag = meet(traag.app, url);
  const msSnel = meet(snel.app, url);
  const factor = msTraag / msSnel;
  assert.ok(factor >= 15,
    'de index hoort minstens 15x sneller te zijn dan de scan; gemeten ' + factor.toFixed(1) + 'x ' +
    '(scan ' + msTraag.toFixed(1) + ' ms, index ' + msSnel.toFixed(1) + ' ms). ' +
    'Zakt dit, dan is de dispatch-index stuk of omzeild.');

  /* En de tweede belofte: de kosten zijn VLAK. Een route achteraan mag niet
     duurder zijn dan een route vooraan, want anders wordt de router alsnog
     trager naarmate de app groeit -- precies wat de index moest oplossen. */
  const vroeg = meet(snel.app, traag.paden[10]);
  const laat = meet(snel.app, traag.paden[STATISCH - 10]);
  assert.ok(laat < vroeg * 4,
    'de dispatch hoort vlak te zijn: achteraan ' + laat.toFixed(1) + ' ms tegen vooraan ' +
    vroeg.toFixed(1) + ' ms. Loopt dit uiteen, dan scant hij weer.');
});
