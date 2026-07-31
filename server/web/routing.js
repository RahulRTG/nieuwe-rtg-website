/* web, deel "routing": pad-parsing en de router. Compileert :params en RegExp-
   paden, matcht routes en gemounte sub-routers, en voert de middleware-keten uit
   met next(err)-foutafhandeling. Zuiver op strings/arrays; geen http/fs nodig. */
'use strict';

function padNaar(url) { const i = url.indexOf('?'); return i === -1 ? url : url.slice(0, i); }

// String-pad -> { str } (snelle gelijkheid) of { rx, keys } (met :params).
function compilePad(pat) {
  if (pat instanceof RegExp) return { rx: pat, keys: [] };
  if (!/:/.test(pat)) return { str: pat };            // geen params: directe vergelijking (snel)
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
// Prefix-mount ('/api/foundation'): matcht op grens, geeft de rest-url terug om te strippen.
function mountMatch(prefix, pn) {
  if (prefix === '/' || prefix === '' || prefix == null) return { rest: pn, len: 0 };
  if (pn === prefix || pn.startsWith(prefix + '/')) return { rest: pn.slice(prefix.length) || '/', len: prefix.length };
  return null;
}

/* ---------- de volledige routekaart ----------
   app._router.stack (zie web/index.js) geeft alleen de BOVENSTE laag, in de
   express-vorm die kern/stuur.js verwacht. Dat is een half beeld: alles wat via
   app.use('/api/foundation', router) of via een voorvoegsel-hulpje hangt staat
   er niet in. Wie op dat halve beeld toetst, meldt kloppende paden als kapot.

   Deze functie loopt de mounts wel na en geeft elk ECHT pad terug met zijn
   methode. Ze leest alleen; er verandert niets aan het routeren zelf. */
function leesLagen(lagen, voorvoegsel) {
  const uit = [];
  for (const l of lagen) {
    if (l.mount) {
      const kind = l.fn && l.fn._stack;
      if (!Array.isArray(kind)) continue;                 // gewone middleware
      const p = l.prefix === '/' ? '' : String(l.prefix || '');
      for (const r of leesLagen(kind, voorvoegsel + p)) uit.push(r);
      continue;
    }
    if (typeof l.pad !== 'string') continue;              // RegExp-pad: niet te noemen
    const pad = (voorvoegsel + l.pad).replace(/\/+$/, '') || '/';
    uit.push({ pad, methode: l.method || 'ALL' });
  }
  return uit;
}

/* ---------- meekijken welke routes er matchen ----------
   Eén optionele haak, gezet door wie dat wil weten (server/routelog.js voor de
   dekkingsmeting). Bewust hier en niet als middleware op 'finish': een route is
   aangeraakt zodra hij matcht, ook als het antwoord daarna nooit aankomt.
   Zonder haak kost dit niets, en deze module weet niet wie er meekijkt. */
let patroonHaak = null;
function opPatroon(fn) { patroonHaak = typeof fn === 'function' ? fn : null; }

/* ---------- een router (ook de app is er een) ---------- */
function maakRouter() {
  const lagen = [];

  function voegToe(method, pat, fns) {
    const c = compilePad(pat);
    for (const fn of fns) {
      if (typeof fn !== 'function') continue;
      lagen.push({ method, pad: pat, str: c.str, rx: c.rx, keys: c.keys || [], fn, fout: fn.length === 4, mount: false });
    }
  }

  function handle(req, res, klaar) {
    let i = 0;
    const startUrl = req.url;
    const buitenParams = req.params || {};
    function next(err) {
      if (i >= lagen.length) { req.url = startUrl; return klaar(err); }
      const laag = lagen[i++];
      // fout-middleware draait alleen bij een fout; gewone middleware alleen zonder.
      if (err && !laag.fout) return next(err);
      if (!err && laag.fout) return next();
      const methodeOk = !laag.method || laag.method === req.method ||
        (laag.method === 'GET' && req.method === 'HEAD');
      if (laag.method && !methodeOk) return next(err);
      const pn = padNaar(req.url);

      if (laag.mount) {
        const mm = mountMatch(laag.prefix, pn);
        if (!mm) return next(err);
        req.params = { ...buitenParams };
        const oudUrl = req.url;
        req.url = mm.len ? req.url.slice(mm.len) || '/' : req.url;
        /* Het voorvoegsel meenemen naar binnen. Zonder dit heet een route in een
           gemounte router naar zichzelf: /api/foundation/leden meldde zich als
           /leden, en dat botst met elke andere router die ook een /leden heeft.
           De meting telde die dan als EEN reeks, en de dekkingsmeting kon een
           waargenomen route niet terugvinden op de routekaart. */
        const oudVoor = req.routeVoorvoegsel || '';
        if (mm.len) req.routeVoorvoegsel = oudVoor + laag.prefix;
        const verder = (e) => { req.url = oudUrl; req.params = buitenParams; req.routeVoorvoegsel = oudVoor; next(e); };
        return laag.fout ? laag.fn(err, req, res, verder) : laag.fn(req, res, verder);
      }

      const params = padMatch(laag, pn);
      if (params === null) return next(err);
      req.params = { ...buitenParams, ...params };
      /* Het PATROON onthouden, niet het pad. De meting (server/meting.js) telt
         hierop: op het patroon zijn het een paar duizend waarden, op het pad is
         het er een per gebruiker-id -- en dan legt de monitoring zichzelf om.
         Alleen bij een echte route (laag.method gezet), niet bij middleware,
         want die matcht op alles en zou het patroon overschrijven. */
      if (laag.method && typeof laag.pad === 'string') {
        req.routePatroon = ((req.routeVoorvoegsel || '') + laag.pad).replace(/\/+$/, '') || '/';
        /* Wie wil weten WELKE routes er geraakt zijn, hoort dat hier: op het
           moment dat de route matcht. Niet bij 'finish' van het antwoord --
           dat is een ander moment, en het kan er nooit komen (een afgebroken
           verbinding, een proces dat gestopt wordt). De route is dan wel
           degelijk aangeraakt. De haak is optioneel; zonder haak kost dit
           een null-check. */
        if (patroonHaak) { try { patroonHaak(req.method, req.routePatroon); } catch (e) { /* nooit het verzoek raken */ } }
      }
      try {
        if (laag.fout) return laag.fn(err, req, res, next);
        return laag.fn(req, res, next);
      } catch (e) { return next(e); }
    }
    next();
  }

  // de router is zelf een middleware (voor mounten in een andere router)
  const router = function (req, res, next) { handle(req, res, next || (() => {})); };
  router._stack = lagen;
  router._handle = handle;
  router._routes = function (voorvoegsel) { return leesLagen(lagen, voorvoegsel || ''); };

  router.use = function (arg0, ...rest) {
    if (typeof arg0 === 'string') {
      for (const fn of rest) {
        if (typeof fn !== 'function') continue;
        lagen.push({ method: null, mount: true, prefix: arg0, fn, fout: fn.length === 4 });
      }
    } else {
      for (const fn of [arg0, ...rest]) {
        if (typeof fn !== 'function') continue;
        lagen.push({ method: null, mount: true, prefix: '/', fn, fout: fn.length === 4 });
      }
    }
    return router;
  };
  for (const m of ['get', 'post', 'put', 'delete', 'patch', 'all', 'head', 'options']) {
    router[m] = function (pat, ...fns) { voegToe(m === 'all' ? null : m.toUpperCase(), pat, fns); return router; };
  }
  return router;
}


module.exports = { maakRouter, padNaar, leesLagen, opPatroon };
