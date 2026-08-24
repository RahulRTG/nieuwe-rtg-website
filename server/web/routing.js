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

/* ---------- de dispatch-index ----------
   DE LINEAIRE SCAN WAS DE STAART. De router liep bij ELK verzoek de hele
   lagenlijst af tot er iets matchte. Met 8.004 lagen op de bovenste stapel
   (7.939 daarvan een vast pad, gemeten 24 augustus 2026) is dat gemiddeld
   vierduizend keer een methodevergelijking, een padNaar() en een stringgelijkheid
   -- per verzoek, synchroon, op de enige event-loop die er is. Gemeten kostte
   dat 0,18 ms voor een route in het midden en 0,33 ms voor een route achteraan.
   Dat is geen traagheid van een route maar een vaste heffing op ALLE verkeer, en
   omdat de lus niet onderbreekt, telt hij bij de wachttijd van elk ander verzoek
   op. Precies de vorm die p99 optilt zonder dat p50 iets verraadt.

   De index draait dat om. 99,2% van de lagen is een vast pad met een vaste
   methode; die gaan in een Map op "METHODE\0pad". Alles wat NIET één vast pad
   is -- mounts, middleware, :param-routes, RegExp-paden, .all() -- blijft
   altijd kandidaat en staat in één oplopende lijst. Een verzoek voegt die twee
   samen en loopt alleen dat af: in de praktijk de ~65 algemene lagen plus de
   ene route die echt past, in plaats van vierduizend.

   DRIE DINGEN DIE HIER MIS KUNNEN GAAN, en waarom ze dat niet doen:

   1. DE VOLGORDE. Een router is volgordegevoelig: middleware op plek 600 hoort
      ná een route op plek 500 te draaien. De index bewaart daarom globale
      indexen en voegt de twee gesorteerde lijsten samen tot één oplopende --
      dezelfde volgorde als de scan, alleen zonder de gaten ertussen.

   2. EEN HERSCHREVEN URL. server/middleware/voordeur.js en routes/werving.js
      zetten req.url middenin de keten om. De oude lus las req.url elke ronde
      opnieuw en pikte dat vanzelf op. De index hoort bij één url, dus zodra
      req.url verandert wordt de lijst opnieuw gemaakt en met een binaire zoek
      teruggezet op de eerstvolgende laag ná de huidige -- niet op het begin,
      want dan zou de keten zich herhalen.

   3. DE CACHE ALS TARPIT. De samengevoegde lijst per pad wordt bewaard, maar
      ALLEEN voor paden die echt een route raken. Een scanner die duizend
      niet-bestaande adressen probeert, krijgt de algemene lijst terug en laat
      niets achter -- dezelfde redenering als waarom de meting op het patroon
      telt en niet op het pad. De cache is daarmee begrensd door de routekaart,
      en niet door het verkeer; CACHE_MAX is het vangnet daaronder. */
const CACHE_MAX = 20000;

// Twee oplopende lijsten samenvoegen tot één oplopende. Geen dubbelen mogelijk:
// een laag staat in precies één emmer, of in de algemene lijst.
function samenvoegen(a, b) {
  if (!a || !a.length) return b;
  if (!b.length) return a;
  const uit = new Array(a.length + b.length);
  let i = 0, j = 0, n = 0;
  while (i < a.length && j < b.length) uit[n++] = a[i] < b[j] ? a[i++] : b[j++];
  while (i < a.length) uit[n++] = a[i++];
  while (j < b.length) uit[n++] = b[j++];
  return uit;
}
// Eerste positie in de (oplopende) lijst met een waarde groter dan `na`.
function eersteNa(lijst, na) {
  if (na < 0) return 0;
  let lo = 0, hi = lijst.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (lijst[m] > na) hi = m; else lo = m + 1; }
  return lo;
}

/* ---------- een router (ook de app is er een) ---------- */
function maakRouter() {
  const lagen = [];
  /* De index wordt bij het EERSTE verzoek gebouwd en niet bij het registreren:
     op dat moment staat de routekaart vast. Elke registratie erna gooit hem weg
     (dynamisch bijhangen mag, het kost dan één herbouw). */
  let index = null;
  const kandidaatCache = new Map();
  function indexWeg() { index = null; kandidaatCache.clear(); }

  function bouwIndex() {
    const exact = new Map();
    const algemeen = [];
    for (let i = 0; i < lagen.length; i++) {
      const l = lagen[i];
      // Alles wat niet ÉÉN vast pad met ÉÉN methode is, blijft altijd kandidaat.
      if (l.mount || !l.method || l.str == null) { algemeen.push(i); continue; }
      const k = l.method + '\0' + l.str;
      const a = exact.get(k);
      if (a) a.push(i); else exact.set(k, [i]);
    }
    index = { exact, algemeen };
    return index;
  }

  /* De lagen die voor dit verzoek überhaupt kunnen matchen, op oplopende index. */
  function kandidaten(methode, pn) {
    const ix = index || bouwIndex();
    const ck = methode + '\0' + pn;
    const uitCache = kandidaatCache.get(ck);
    if (uitCache) return uitCache;
    let lijst = ix.algemeen;
    let raak = false;
    /* padMatch() laat een vast pad ook matchen mét afsluitende slash, en de
       lus hieronder laat HEAD op een GET-route vallen. Allebei zijn het dus
       extra sleutels om op te zoeken -- niet iets wat de index mag missen. */
    const paden = pn.length > 1 && pn.charCodeAt(pn.length - 1) === 47 ? [pn, pn.slice(0, -1)] : [pn];
    const methodes = methode === 'HEAD' ? ['HEAD', 'GET'] : [methode];
    for (const m of methodes) for (const p of paden) {
      const a = ix.exact.get(m + '\0' + p);
      if (a) { lijst = samenvoegen(a, lijst); raak = true; }
    }
    // Alleen paden die echt een route raken komen in de cache: zie punt 3 hierboven.
    if (raak && kandidaatCache.size < CACHE_MAX) kandidaatCache.set(ck, lijst);
    return lijst;
  }

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
      try {
        if (laag.fout) return laag.fn(err, req, res, next);
        return laag.fn(req, res, next);
      } catch (e) { err = e; continue; }
      }
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
    indexWeg();
    return router;
  };
  for (const m of ['get', 'post', 'put', 'delete', 'patch', 'all', 'head', 'options']) {
    router[m] = function (pat, ...fns) { voegToe(m === 'all' ? null : m.toUpperCase(), pat, fns); return router; };
  }
  return router;
}


module.exports = { maakRouter, padNaar, leesLagen, opPatroon };
