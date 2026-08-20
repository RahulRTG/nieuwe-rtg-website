/* De poortwachters die voor alle routers hangen (server/middleware/).

   Waarom deze test bestaat: bij het uit elkaar halen van server.js bleek de
   voordeur zijn scriptbeveiliging te missen. De site-root wordt intern
   herschreven naar /apps/app.html, maar de eigen webmotor (server/web) zet
   req.path eenmalig als gewone eigenschap in plaats van als getter. Alleen
   req.url herschrijven liet req.path dus op '/' staan, en de nonce-laag sloeg
   de pagina over. Gevolg: juist de meest bezochte pagina van de site viel
   terug op een CSP met 'unsafe-inline'.

   We rijden hier geen echte HTTP-server op: de lagen krijgen een nagebouwd
   req/res-paar met precies de methoden die de webmotor ze aanreikt. Dat is
   sneller, bindt geen poorten, en laat per laag zien wat hij doet.
   Draai los: node --experimental-sqlite --test test/middleware.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { herschrijf, cspNonce, bureaublad, CSP, magnaatHtml } = require('../server/middleware/voordeur');
const { jsonGzip, statischGzip, wilGzip, wilBrotli } = require('../server/middleware/compressie');
const { opslagPoort, hoofdzekering } = require('../server/middleware/remmen');
const { natieNaarLand, ZIN } = require('../server/middleware/functieschakelaars');

const PUBLIC = path.join(__dirname, '..', 'public');

/* Een response zoals de webmotor hem aanlevert: set/type/send/status/json en
   de kale setHeader/end eronder. Alles wat eruit gaat wordt onthouden, zodat
   een test kan nakijken wat er werkelijk over de lijn zou zijn gegaan. */
function nepRes() {
  let meld;
  const r = {
    kop: {}, code: 200, body: null, klaar: false,
    wacht: new Promise(res => { meld = res; }),
    setHeader(k, v) { r.kop[k.toLowerCase()] = v; return r; },
    set(k, v) { return r.setHeader(k, v); },
    type(t) { return r.setHeader('Content-Type', t === 'html' ? 'text/html; charset=utf-8' : t); },
    status(s) { r.code = s; return r; },            // ketent: res.status(503).json(...)
    writeHead(s, koppen) { r.code = s; Object.assign(r.kop, koppen || {}); return r; },
    send(b) { return af(b); },
    end(b) { return af(b); },
    json(d) { return af(JSON.stringify(d)); }
  };
  function af(b) { if (b !== undefined) r.body = b; r.klaar = true; meld(r); return r; }
  Object.defineProperty(r, 'statusCode', { get: () => r.code, set: v => { r.code = v; } });
  Object.defineProperty(r, 'headersSent', { get: () => r.klaar });
  return r;
}
/* Een verzoek zoals de webmotor hem aanlevert: path is een gewone eigenschap. */
function nepReq(url, koppen) {
  return { url, path: url.split('?')[0], method: 'GET', headers: koppen || {},
    query: {}, get: n => (koppen || {})[String(n).toLowerCase()] || '' };
}
/* Een laag draaien en wachten tot hij het verzoek afhandelt of doorgeeft.
   Wat als eerste komt wint; een tweede resolve doet niets meer. Geen pollen,
   dus ook geen lus die de gebeurtenislus wakker houdt als de test al klaar is. */
function draai(laag, req, res) {
  return new Promise((klaar) => {
    let door = false;
    res.wacht.then(() => klaar({ door, res }));
    laag(req, res, () => { door = true; klaar({ door, res }); });
  });
}

test('1. de interne herschrijving neemt req.path mee, niet alleen req.url', () => {
  const req = nepReq('/');
  herschrijf(req, '/apps/app.html');
  assert.equal(req.url, '/apps/app.html');
  assert.equal(req.path, '/apps/app.html', 'anders slaat de nonce-laag de voordeur over');
});

test('2. op een getter (Express) blijft req.path met rust', () => {
  const req = { url: '/' };
  Object.defineProperty(req, 'path', { get() { return this.url.split('?')[0]; } });
  herschrijf(req, '/apps/app.html');
  assert.equal(req.path, '/apps/app.html', 'de getter leidt het zelf af');
});

test('3. de voordeur zet beide ingangen op hetzelfde bureaublad', () => {
  const routes = {};
  bureaublad({ get: (pad, fn) => { routes[pad] = fn; } });
  for (const ingang of ['/', '/apps/bureau.html']) {
    const req = nepReq(ingang);
    let door = false;
    routes[ingang](req, nepRes(), () => { door = true; });
    assert.equal(req.path, '/apps/app.html', ingang + ' komt op het bureaublad uit');
    assert.ok(door, 'en gaat door naar de volgende laag');
  }
});

test('4. de nonce-laag geeft kop en pagina dezelfde verse nonce', async () => {
  const laag = cspNonce(PUBLIC, true);
  const een = await draai(laag, nepReq('/apps/app.html'), nepRes());
  assert.ok(een.res.klaar, 'de pagina is verstuurd');
  const uitKop = /'nonce-([^']+)'/.exec(een.res.kop['content-security-policy'] || '');
  assert.ok(uitKop, 'de CSP draagt een nonce');
  assert.ok(!/script-src[^;]*unsafe-inline/.test(een.res.kop['content-security-policy']),
    'en scripts staan niet meer op unsafe-inline');
  const inBody = [...String(een.res.body).matchAll(/<script nonce="([^"]+)"/g)].map(m => m[1]);
  assert.ok(inBody.length > 0, 'de scripttags dragen de nonce');
  assert.ok(inBody.every(n => n === uitKop[1]), 'kop en pagina noemen dezelfde nonce');

  // elk antwoord een nieuwe: een vaste nonce is geen nonce
  const twee = await draai(laag, nepReq('/apps/app.html'), nepRes());
  const tweede = /'nonce-([^']+)'/.exec(twee.res.kop['content-security-policy']);
  assert.notEqual(tweede[1], uitKop[1], 'per antwoord een verse nonce');

  // wat er niet is, en wat geen pagina is, gaat door naar de volgende laag
  assert.equal((await draai(laag, nepReq('/bestaat-niet.html'), nepRes())).door, true);
  assert.equal((await draai(laag, nepReq('/shared/qr.js'), nepRes())).door, true);
  // en met de schakelaar uit doet hij helemaal niets
  assert.equal((await draai(cspNonce(PUBLIC, false), nepReq('/apps/app.html'), nepRes())).door, true);
});

test('4b. ieder appscherm krijgt in Magnaat vóór zijn eigen code de dichte trainingslaag', async () => {
  const req = nepReq('/apps/medicijnen.html?magnaat=1');
  req.query = { magnaat: '1' };
  const uit = await draai(cspNonce(PUBLIC, true), req, nepRes());
  const html = String(uit.res.body);
  const csp = uit.res.kop['content-security-policy'] || '';
  /* Het pad zonder querystring, want elke verwijzing draagt sinds
     server/middleware/versieadres.js de versie van het bestand mee (?v=...).
     Dat verandert niets aan WELK script er staat of in welke VOLGORDE -- en dat
     is precies wat deze toets bewaakt -- dus vergelijken we op het pad. */
  const padVan = (u) => String(u).split('?')[0];
  const sandboxTags = [...html.matchAll(/src="([^"]*magnaat-sandbox\.js[^"]*)"/g)];
  assert.equal(sandboxTags.length, 1, 'de blokkade staat er precies een keer');
  assert.equal(padVan(sandboxTags[0][1]), '/apps/magnaat-sandbox.js');
  const externeScripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => padVan(m[1]));
  assert.equal(externeScripts[0], '/apps/magnaat-sandbox.js',
    'de blokkade draait vóór het eerste externe paginascript');
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.doesNotMatch(CSP('abc123'), /connect-src 'none'/, 'de gewone RTG-app behoudt zijn verbindingen');
  assert.equal(magnaatHtml('<head></head>', false), '<head></head>');

  const tag = '<script src="/apps/magnaat-sandbox.js"></script>';
  const genest = magnaatHtml('<html><head></head><body><scr' + tag + 'ipt>alert(1)</script></body></html>', true);
  assert.equal((genest.match(/src="\/apps\/magnaat-sandbox\.js"/g) || []).length, 1,
    'alleen de nieuwe, vroege sandbox-tag blijft staan');
  assert.doesNotMatch(genest, /<script>alert\(1\)<\/script>/i,
    'het verplaatsen voegt geen twee losse taghelften samen tot uitvoerbare HTML');
});

test('5. de compressielaag laat kleine antwoorden met rust', async () => {
  const klein = { hallo: 'wereld' };
  const groot = { rij: new Array(400).fill('een tamelijk lange tekst per element') };
  const proef = async (data, encoding) => {
    const req = nepReq('/api/iets', encoding ? { 'accept-encoding': encoding } : {});
    const res = nepRes();
    await draai(jsonGzip(), req, res);
    res.json(data);
    return res.kop['content-encoding'] || 'geen';
  };
  assert.equal(await proef(klein, 'gzip'), 'geen', 'onder een kilobyte kost gzip meer dan het oplevert');
  assert.equal(await proef(groot, 'gzip'), 'gzip', 'een groot antwoord gaat wel gecomprimeerd');
  assert.equal(await proef(groot, null), 'geen', 'en nooit als de client er niet om vraagt');
  // brotli waar de client hem aanbiedt, en hij WINT van gzip als beide mogen
  assert.equal(await proef(groot, 'br'), 'br');
  assert.equal(await proef(groot, 'gzip, deflate, br'), 'br');
  assert.equal(await proef(groot, 'deflate'), 'geen', 'deflate vragen is geen gzip vragen');
});

test('5b. brotli levert echt kleinere bytes, en alleen aan wie erom vraagt', async () => {
  /* Het punt van brotli is niet dat de kop anders is maar dat er MINDER over
     de lijn gaat. Een laag die de kop op "br" zet en gzip-bytes stuurt, zou
     hier groen blijven als we alleen de kop controleerden -- en bij de client
     gewoon stuk gaan. */
  const groot = { rij: new Array(400).fill('een tamelijk lange tekst per element') };
  const meet = async (encoding) => {
    const req = nepReq('/api/iets', { 'accept-encoding': encoding });
    const res = nepRes();
    await draai(jsonGzip(), req, res);
    res.json(groot);
    return { kop: res.kop['content-encoding'], bytes: Buffer.from(res.body) };
  };
  const g = await meet('gzip'), b = await meet('br');
  assert.equal(g.kop, 'gzip'); assert.equal(b.kop, 'br');
  assert.ok(b.bytes.length < g.bytes.length, 'brotli is kleiner dan gzip: ' + b.bytes.length + ' vs ' + g.bytes.length);
  // en de bytes zijn ECHT brotli: ze pakken uit tot precies het antwoord
  const zlib = require('zlib');
  assert.deepEqual(JSON.parse(zlib.brotliDecompressSync(b.bytes).toString()), groot);
  assert.deepEqual(JSON.parse(zlib.gunzipSync(g.bytes).toString()), groot);
});

test('6. wilGzip en wilBrotli lezen de accept-encoding zorgvuldig', () => {
  assert.equal(wilGzip({ headers: { 'accept-encoding': 'gzip, deflate, br' } }), true);
  assert.equal(wilGzip({ headers: { 'accept-encoding': 'br' } }), false);
  assert.equal(wilGzip({ headers: {} }), false);
  assert.equal(wilBrotli({ headers: { 'accept-encoding': 'gzip, deflate, br' } }), true);
  assert.equal(wilBrotli({ headers: { 'accept-encoding': 'gzip' } }), false);
  assert.equal(wilBrotli({ headers: {} }), false);
  /* "brotli" is geen "br", en een woord dat toevallig br bevat ook niet -- de
     kop is een lijst van tokens en geen zoekopdracht. */
  assert.equal(wilBrotli({ headers: { 'accept-encoding': 'brotli-achtig' } }), false);
});

test('7. de statische laag comprimeert, cachet en laat de rest gaan', async () => {
  const laag = statischGzip(PUBLIC);
  const gz = { 'accept-encoding': 'gzip' };
  const een = await draai(laag, nepReq('/shared/qr.js', gz), nepRes());
  assert.equal(een.res.kop['content-encoding'], 'gzip');
  assert.match(een.res.kop['content-type'], /javascript/);
  assert.equal(een.res.kop['vary'], 'Accept-Encoding',
    'anders bewaart een tussenliggende cache het verkeerde antwoord voor de verkeerde client');
  assert.ok(een.res.body.length > 0, 'er komen bytes uit');

  // tweede keer: uit de cache, en byte voor byte hetzelfde
  const twee = await draai(laag, nepReq('/shared/qr.js', gz), nepRes());
  assert.ok(Buffer.compare(Buffer.from(een.res.body), Buffer.from(twee.res.body)) === 0,
    'de cache levert precies hetzelfde');

  /* DEZELFDE BESTANDEN, ANDERE VORM. Beide vormen staan in dezelfde cache-rij,
     dus dit is de plek waar een verwisseling zou ontstaan: brotli-bytes onder
     een gzip-kop, of andersom. Daarom wordt hier niet alleen de kop maar ook
     de INHOUD nagerekend -- en de ETag moet verschillen, anders geeft een
     tussenliggende cache het verkeerde antwoord aan de verkeerde client. */
  const zlib = require('zlib');
  const brRes = await draai(laag, nepReq('/shared/qr.js', { 'accept-encoding': 'br' }), nepRes());
  assert.equal(brRes.res.kop['content-encoding'], 'br');
  assert.ok(brRes.res.body.length < een.res.body.length,
    'brotli is kleiner: ' + brRes.res.body.length + ' vs ' + een.res.body.length);
  const uitBr = zlib.brotliDecompressSync(Buffer.from(brRes.res.body));
  const uitGz = zlib.gunzipSync(Buffer.from(een.res.body));
  assert.ok(Buffer.compare(uitBr, uitGz) === 0, 'beide vormen leveren hetzelfde bestand op');
  assert.notEqual(brRes.res.kop['etag'], een.res.kop['etag'], 'een andere vorm hoort een andere ETag te hebben');

  // wie niet om gzip vraagt, een onbekende soort, of een pad omhoog: doorgeven
  assert.equal((await draai(laag, nepReq('/shared/qr.js'), nepRes())).door, true);
  assert.equal((await draai(laag, nepReq('/../server/server.js', gz), nepRes())).door, true,
    'geen weg omhoog uit public/');
  assert.equal((await draai(laag, nepReq('/bestaat-niet.js', gz), nepRes())).door, true);
});

test('8. de opslag-poort laat health door en houdt de rest tegen', () => {
  const vraag = (pad, klaar) => {
    const res = nepRes(); let door = false;
    opslagPoort(() => klaar)({ path: pad }, res, () => { door = true; });
    return { door, status: res.code, kop: res.kop };
  };
  assert.equal(vraag('/api/health', false).door, true, 'de load balancer moet blijven kijken');
  assert.equal(vraag('/api/ready', false).door, true);
  assert.equal(vraag('/api/techniek/status', false).door, true, 'de eigenaar moet erbij kunnen');
  assert.equal(vraag('/apps/app.html', false).door, true, 'gewone pagina´s zijn geen API');
  const dicht = vraag('/api/orders', false);
  assert.equal(dicht.door, false, 'schrijven op een half geladen instance is precies het gevaar');
  assert.equal(dicht.status, 503);
  assert.equal(dicht.kop['retry-after'], '2');
  assert.equal(vraag('/api/orders', true).door, true, 'met de opslag klaar gaat alles gewoon door');
});

test('9. de hoofdzekering laat de eigenaar erbij, en verder niemand', () => {
  const db = { data: { techniek: { zekeringen: { onderhoud: { aan: false } } } } };
  const accounts = { verifyToken: t => (t === 'baas' ? { id: 1 } : null) };
  const eigenaar = { isEigenaar: (a, u) => !!(u && u.id === 1) };
  const laag = hoofdzekering({ db, accounts, eigenaar });
  const vraag = (pad, token) => {
    const res = nepRes(); let door = false;
    laag({ path: pad, get: () => (token ? 'Bearer ' + token : ''), query: {} }, res, () => { door = true; });
    return { door, status: res.code };
  };
  assert.equal(vraag('/api/orders').status, 503, 'in onderhoud is de app dicht');
  assert.equal(vraag('/api/orders', 'baas').door, true, 'behalve voor de eigenaar');
  assert.equal(vraag('/api/orders', 'vreemde').status, 503, 'een willekeurig token opent niets');
  assert.equal(vraag('/api/health').door, true, 'de health-check blijft altijd bereikbaar');
  assert.equal(vraag('/api/techniek/zekeringen', 'baas').door, true,
    'anders krijgt niemand de zekering er weer in');
  db.data.techniek.zekeringen.onderhoud.aan = true;
  assert.equal(vraag('/api/orders').door, true, 'zekering erin: niemand merkt iets');
});

test('10. de functieschakelaars leggen per reden een andere zin klaar', () => {
  for (const reden of ['globaal', 'pas', 'land', 'persoon', 'genre']) {
    assert.ok(ZIN[reden] && ZIN[reden].length > 10, 'reden "' + reden + '" heeft uitleg in gewone taal');
  }
  assert.notEqual(ZIN.land, ZIN.globaal, 'een landregel is iets anders dan een globale uitschakeling');
  assert.equal(natieNaarLand('Nederlandse'), 'NL');
  assert.equal(natieNaarLand('duits'), 'DE');
  assert.equal(natieNaarLand(''), null);
  assert.equal(natieNaarLand('Marsbewoner'), null, 'onbekend is null, geen gok');
});

test('11. de CSP noemt geen unsafe-inline voor scripts, en voor stijlblokken evenmin', () => {
  const c = CSP('abc123');
  assert.match(c, /script-src 'self' 'nonce-abc123'/);
  assert.ok(!/script-src[^;]*unsafe-inline/.test(c), 'scripts nooit op unsafe-inline');
  /* Stijlblokken werken sinds kort ook op de nonce. De losse richtlijn moet
     exact matchen: `style-src` is ook het begin van `style-src-attr`, en die
     laatste MAG 'unsafe-inline' houden (de 8957 style="..."-attributen in
     public/, zie de kop van middleware/voordeur.js). Zonder die woordgrens
     leest deze toets de verkeerde regel en kan hij nooit falen. */
  const richtlijn = (naam) => (new RegExp('(?:^|;)\\s*' + naam + '(\\s[^;]*)').exec(c) || [, ''])[1] || '';
  assert.match(richtlijn('style-src'), /'nonce-abc123'/, 'stijlblokken op dezelfde nonce als de scripts');
  assert.ok(!/unsafe-inline/.test(richtlijn('style-src')), 'stijlblokken niet meer op unsafe-inline');
  assert.match(richtlijn('style-src-attr'), /'unsafe-inline'/,
    'de attributen mogen nog wel: benoemde schuld, geen vergissing');
  assert.match(c, /object-src 'none'/);
  assert.match(c, /frame-ancestors 'self'/);
  assert.match(c, /base-uri 'self'/);
});
