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

// Sync en async middleware volgen dezelfde foutketen.
function voer(fn, args, volgende) {
  try {
    const uit = fn(...args);
    if (uit && typeof uit.then === 'function') uit.catch(volgende);
    return uit;
  } catch (e) { return volgende(e); }
}

/* ---------- de volledige routekaart ----------
   app._router.stack (zie web/index.js) geeft alleen de BOVENSTE laag, in de
   express-vorm die kern/stuur.js verwacht. Dat is een half beeld: alles wat via
   app.use('/api/foundation', router) of via een voorvoegsel-hulpje hangt staat
   er niet in. Wie op dat halve beeld toetst, meldt kloppende paden als kapot.

   Deze functie loopt de mounts wel na en geeft elk ECHT pad terug met zijn
   methode. Ze leest alleen; er verandert niets aan het routeren zelf.

   EN MET DE NAAM VAN DE FUNCTIE OP DIE LAAG (`laagNaam`). Een route is hier EEN
   laag per middleware, zelfde pad en methode, in ophangvolgorde: de laatste is
   de handler, alles ervoor een bewaker. Met de naam erbij is uit de ROUTER te
   lezen wie een route beschermt (officeAuth, supplierAuth, techAuth) in plaats
   van dat uit brontekst te raden -- en dat raden was duur: de regex van
   scripts/lib/routes.js ziet niet wat via app.use('/api/foundation', router) of
   een voorvoegsel-hulpje hangt, en de vier bewijsproeven (rol, idempotentie,
   invoer, staat) misten daardoor alle vier exact dezelfde 1257 routes.
   `laagNaam` is leeg bij een anonieme functie -- de meeste handlers, en dat
   hoort: alleen de bewakers zijn benoemd. De wikkel in opzet/verzoekketen.js
   geeft zijn naam door, anders was dit veld op het topniveau altijd leeg. */
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
    uit.push({ pad, methode: l.method || 'ALL', laagNaam: (l.fn && l.fn.name) || '' });
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

/* De dispatch-index staat in ./routeindex.js -- waarom hij er is, en de drie
   dingen die er mis mee kunnen gaan, staan in de kop van dat bestand. */
const { maakDispatchIndex } = require('./routeindex');

/* ---------- een router (ook de app is er een) ---------- */
function maakRouter() {
  const lagen = [];
  const ix = maakDispatchIndex(lagen);
  const indexWeg = ix.weg, kandidaten = ix.kandidaten, eersteNa = ix.eersteNa;

  function voegToe(method, pat, fns) {
    const c = compilePad(pat);
    for (const fn of fns) {
      if (typeof fn !== 'function') continue;
      lagen.push({ method, pad: pat, str: c.str, rx: c.rx, keys: c.keys || [], fn, fout: fn.length === 4, mount: false });
    }
    indexWeg();
  }

  function handle(req, res, klaar) {
    const startUrl = req.url;
    const buitenParams = req.params || {};
    /* De kandidatenlijst hoort bij ÉÉN url. kandUrl bewaart bij welke; zodra
       req.url verandert (voordeur.js, werving.js) wordt de lijst opnieuw
       gemaakt en teruggezet op de eerstvolgende laag ná de huidige. */
    let kand = null, kandUrl = null, pn = '', k = 0, vorige = -1;
    /* HET OVERSLAAN IS EEN LUS, HET AANROEPEN BLIJFT RECURSIE.

       Elke laag die niet past werd overgeslagen met `return next(err)` -- een
       nieuwe stapelframe per laag. Met een paar duizend geregistreerde routes
       (2535 vandaag) viel het proces daardoor om op een verzoek dat nergens op
       matcht: RangeError: Maximum call stack size exceeded, uncaughtException,
       server weg. Een POST naar een niet-bestaand pad was genoeg, zonder inlog.

       Het overslaan gaat nu met `continue` in deze lus, dus zonder stapel. Een
       laag die WEL past wordt onveranderd aangeroepen met `next` als vervolg:
       roept die synchroon next() aan, dan loopt dat precies zoals eerst (de
       rest van de keten draait binnen die aanroep). Zo blijft het gedrag van
       elke middleware gelijk en groeit de stapel alleen nog met het aantal
       lagen dat echt matcht -- een handvol, geen paar duizend. */
    function next(err) {
      for (;;) {
      if (kandUrl !== req.url) {
        kandUrl = req.url;
        pn = padNaar(kandUrl);
        kand = kandidaten(req.method, pn);
        k = eersteNa(kand, vorige);
      }
      if (k >= kand.length) { req.url = startUrl; return klaar(err); }
      const laag = lagen[vorige = kand[k++]];
      // fout-middleware draait alleen bij een fout; gewone middleware alleen zonder.
      if (err && !laag.fout) continue;
      if (!err && laag.fout) continue;
      const methodeOk = !laag.method || laag.method === req.method ||
        (laag.method === 'GET' && req.method === 'HEAD');
      if (laag.method && !methodeOk) continue;

      if (laag.mount) {
        const mm = mountMatch(laag.prefix, pn);
        if (!mm) continue;
        req.params = { ...buitenParams };
        const oudUrl = req.url;
        req.url = mm.len ? req.url.slice(mm.len) || '/' : req.url;
        /* Het voorvoegsel voorkomt dat gelijknamige routes uit gemounte routers
           in routekaart en meting op één hoop belanden. */
        const oudVoor = req.routeVoorvoegsel || '';
        if (mm.len) req.routeVoorvoegsel = oudVoor + laag.prefix;
        const verder = (e) => { req.url = oudUrl; req.params = buitenParams; req.routeVoorvoegsel = oudVoor; next(e); };
        return voer(laag.fn, laag.fout ? [err, req, res, verder] : [req, res, verder], verder);
      }

      const params = padMatch(laag, pn);
      if (params === null) continue;
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
      return voer(laag.fn, laag.fout ? [err, req, res, next] : [req, res, next], next);
      }
    }
    next();
  }

  // de router is zelf een middleware (voor mounten in een andere router)
  const router = function (req, res, next) { handle(req, res, next || (() => {})); };
  router._stack = lagen;
  router._handle = handle;
  router._routes = function (voorvoegsel) { return leesLagen(lagen, voorvoegsel || ''); };

  // Een array van paden wordt een laag per pad.
  router.use = function (arg0, ...rest) {
    const pn = typeof arg0 === 'string' ? [arg0]
      : Array.isArray(arg0) && arg0.length && arg0.every(x => typeof x === 'string') ? arg0 : null;
    for (const prefix of pn || ['/']) {
      for (const fn of (pn ? rest : [arg0, ...rest])) {
        if (typeof fn === 'function') lagen.push({ method: null, mount: true, prefix, fn, fout: fn.length === 4 });
      }
    }
    indexWeg();
    return router;
  };
  for (const m of ['get', 'post', 'put', 'delete', 'patch', 'all', 'head', 'options']) {
    router[m] = function (pat, ...fns) { voegToe(m === 'all' ? null : m.toUpperCase(), pat, fns); return router; };
  }
  return router;
}


module.exports = { maakRouter, padNaar, leesLagen, opPatroon };
