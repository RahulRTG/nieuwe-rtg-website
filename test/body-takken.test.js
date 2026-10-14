/* De takken van server/web/body.js die geen enkele toets raakte.

   test/web.test.js toetst web.json en web.raw van buitenaf, via een echte
   http-server: één geldig lichaam, één te groot, één kapot, één Zaakdoos-
   buffer. Daarmee bleven de beslissingen ERONDER ongetoetst: hoe een limiet
   als tekst wordt gelezen ('1mb', ' 2 KB ', een getal, onzin), wanneer een
   verzoek een lichaam heeft (transfer-encoding, content-length '0', HTTP/2
   zonder beide), welk content-type als JSON telt, en wat de lezer doet met
   brokken die NA een weigering of na het einde nog binnenkomen.

   Dat zijn precies de grenzen waar een aanvaller op mikt (een lichaam dat
   doorstroomt na de 413, een fout-event dat de terugroep twee keer laat
   vuren), dus we roepen de functies hier rechtstreeks aan met een nep-verzoek
   (een kale EventEmitter met headers), zonder server ertussen. Zo staat elke
   tak los en is zichtbaar welke beslissing er zakt.
   Los: node --test test/body-takken.test.js */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { json, raw, limietBytes, leesBody, heeftBody, typeMatcht } = require('../server/web/body');

/* Een nep-verzoek: headers, methode, HTTP-versie, en events die wij zelf
   afvuren. `stuur` levert de brokken en het einde na de huidige tik, zodat de
   middleware eerst zijn luisteraars kan aanhangen, net als bij een echte stream. */
function nepReq(o = {}) {
  const req = new EventEmitter();
  req.headers = o.headers || {};
  req.method = 'method' in o ? o.method : 'POST';
  // Een expliciet `httpVersionMajor: undefined` laat het veld weg, zodat de
  // terugval op httpVersion te toetsen is.
  req.httpVersionMajor = 'httpVersionMajor' in o ? o.httpVersionMajor : 1;
  if (o.httpVersion !== undefined) req.httpVersion = o.httpVersion;
  return req;
}
function stuur(req, brokken, { fout } = {}) {
  setImmediate(() => {
    for (const b of brokken) req.emit('data', Buffer.from(b));
    if (fout) req.emit('error', fout); else req.emit('end');
  });
}
/* Draai een middleware en wacht op next(); geeft de fout (of undefined) terug. */
function draai(mw, req) {
  return new Promise((resolve) => mw(req, {}, (err) => resolve(err)));
}
const JSONKOP = { 'content-type': 'application/json', 'content-length': '10' };

/* ---------- limietBytes ---------- */

test('limietBytes: ontbrekend is onbegrensd, een getal blijft een getal', () => {
  assert.equal(limietBytes(undefined), Infinity);
  assert.equal(limietBytes(null), Infinity);
  assert.equal(limietBytes(0), 0, 'een getal 0 is een echte limiet van nul bytes, geen "geen limiet"');
  assert.equal(limietBytes(512), 512);
});

test('limietBytes: eenheden b/kb/mb/gb, hoofdletterongevoelig, met spaties', () => {
  assert.equal(limietBytes('100'), 100, 'zonder eenheid zijn het bytes');
  assert.equal(limietBytes('7b'), 7);
  assert.equal(limietBytes('1kb'), 1024);
  assert.equal(limietBytes(' 2 KB '), 2048);
  assert.equal(limietBytes('1mb'), 1024 * 1024);
  assert.equal(limietBytes('1.5MB'), 1.5 * 1024 * 1024);
  assert.equal(limietBytes('1gb'), 1024 * 1024 * 1024);
});

test('limietBytes: onleesbare tekst valt terug op onbegrensd', () => {
  // Gedocumenteerd gedrag van de huidige code: een limiet die niet te lezen is
  // betekent GEEN limiet (fail-open). Zie het rapport bij deze toetsen.
  assert.equal(limietBytes('veel'), Infinity);
  assert.equal(limietBytes('10 tb'), Infinity);
  assert.equal(limietBytes(''), Infinity);
});

/* ---------- heeftBody ---------- */

test('heeftBody: transfer-encoding of een content-length anders dan "0" betekent een lichaam', () => {
  assert.equal(heeftBody(nepReq({ headers: { 'transfer-encoding': 'chunked' } })), true);
  assert.equal(heeftBody(nepReq({ headers: { 'content-length': '12' } })), true);
  assert.equal(heeftBody(nepReq({ headers: { 'content-length': '0' } })), false);
  assert.equal(heeftBody(nepReq({ headers: {} })), false, 'HTTP/1 zonder beide koppen: geen lichaam');
});

test('heeftBody: HTTP/2 zonder koppen gaat uit van een lichaam, behalve bij GET en HEAD', () => {
  assert.equal(heeftBody(nepReq({ httpVersionMajor: 2, method: 'POST' })), true);
  assert.equal(heeftBody(nepReq({ httpVersionMajor: 2, method: 'put' })), true, 'methode hoofdletterongevoelig');
  assert.equal(heeftBody(nepReq({ httpVersionMajor: 2, method: 'GET' })), false);
  assert.equal(heeftBody(nepReq({ httpVersionMajor: 2, method: 'head' })), false);
  assert.equal(heeftBody(nepReq({ httpVersionMajor: 3, method: undefined })), true, 'geen methode telt niet als GET');
});

test('heeftBody: zonder httpVersionMajor wordt httpVersion gelezen, en anders HTTP/1 aangenomen', () => {
  assert.equal(heeftBody(nepReq({ httpVersionMajor: undefined, httpVersion: '2.0', method: 'POST' })), true);
  assert.equal(heeftBody(nepReq({ httpVersionMajor: undefined, httpVersion: '1.1', method: 'POST' })), false);
  assert.equal(heeftBody(nepReq({ httpVersionMajor: undefined, method: 'POST' })), false);
});

/* ---------- typeMatcht ---------- */

test('typeMatcht: een functie beslist zelf, en de uitkomst wordt een boolean', () => {
  const req = nepReq({ headers: { 'content-type': 'text/plain' } });
  assert.equal(typeMatcht(req, () => 'ja'), true);
  assert.equal(typeMatcht(req, () => 0), false);
  assert.equal(typeMatcht(req, (r) => r === req), true, 'de functie krijgt het verzoek');
});

test('typeMatcht: */* en geen type passen op alles, ook zonder content-type', () => {
  assert.equal(typeMatcht(nepReq(), '*/*'), true);
  assert.equal(typeMatcht(nepReq(), null), true);
  assert.equal(typeMatcht(nepReq({ headers: { 'content-type': 'image/png' } }), undefined), true);
});

test('typeMatcht: JSON is elke subtype op json of +json, niet een type dat er alleen mee begint', () => {
  const ct = (v) => nepReq({ headers: v === undefined ? {} : { 'content-type': v } });
  for (const t of ['application/json', 'json']) {
    assert.equal(typeMatcht(ct('application/json'), t), true);
    assert.equal(typeMatcht(ct('application/json; charset=utf-8'), t), true);
    assert.equal(typeMatcht(ct('APPLICATION/JSON'), t), true);
    assert.equal(typeMatcht(ct('application/vnd.api+json'), t), true);
    assert.equal(typeMatcht(ct('text/json'), t), true);
    assert.equal(typeMatcht(ct('application/jsonp'), t), false, 'jsonp is geen json');
    assert.equal(typeMatcht(ct('text/plain'), t), false);
    assert.equal(typeMatcht(ct(undefined), t), false, 'zonder content-type geen JSON');
  }
});

test('typeMatcht: een ander type is een voorvoegsel, hoofdletterongevoelig', () => {
  const req = nepReq({ headers: { 'content-type': 'Text/Plain; charset=utf-8' } });
  assert.equal(typeMatcht(req, 'text/plain'), true);
  assert.equal(typeMatcht(req, 'TEXT/'), true);
  assert.equal(typeMatcht(req, 'application/xml'), false);
  assert.equal(typeMatcht(nepReq(), 'text/plain'), false, 'leeg content-type past niet op een concreet type');
});

/* ---------- leesBody ---------- */

test('leesBody: plakt de brokken aan elkaar en roept één keer terug', async () => {
  const req = nepReq();
  let keer = 0;
  const uit = await new Promise((resolve) => {
    leesBody(req, 100, (err, buf) => { keer++; resolve({ err, buf }); });
    stuur(req, ['ab', 'cd', 'ef']);
  });
  assert.equal(uit.err, null);
  assert.equal(uit.buf.toString(), 'abcdef');
  req.emit('end'); req.emit('error', new Error('na afloop'));
  assert.equal(keer, 1, 'een late end of error mag de terugroep niet nog eens laten vuren');
});

test('leesBody: precies op de limiet mag, één byte erover is 413 en de rest wordt genegeerd', async () => {
  const opLimiet = nepReq();
  const ok = await new Promise((resolve) => { leesBody(opLimiet, 4, (err, buf) => resolve({ err, buf })); stuur(opLimiet, ['ab', 'cd']); });
  assert.equal(ok.err, null); assert.equal(ok.buf.length, 4);

  const req = nepReq();
  const roepen = [];
  await new Promise((resolve) => {
    leesBody(req, 4, (err, buf) => { roepen.push({ err, buf }); resolve(); });
    stuur(req, ['abc', 'de', 'nog meer', 'en meer']);
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(roepen.length, 1, 'na de weigering vuren data en end niets meer af');
  assert.equal(roepen[0].err.status, 413);
  assert.equal(roepen[0].err.type, 'entity.too.large');
  assert.equal(roepen[0].buf, undefined);
});

test('leesBody: een streamfout gaat door, en een late end daarna niet', async () => {
  const req = nepReq();
  const roepen = [];
  const fout = new Error('verbinding verbroken');
  await new Promise((resolve) => {
    leesBody(req, 100, (err, buf) => { roepen.push({ err, buf }); resolve(); });
    stuur(req, ['ab'], { fout });
  });
  req.emit('end');
  assert.equal(roepen.length, 1);
  assert.equal(roepen[0].err, fout);
});

test('leesBody: limiet 0 weigert al bij de eerste byte', async () => {
  const req = nepReq();
  const err = await new Promise((resolve) => { leesBody(req, 0, (e) => resolve(e)); stuur(req, ['x']); });
  assert.equal(err.status, 413);
});

test('leesBody: een Zaakdoos-buffer wordt gebruikt en daarna van het verzoek gehaald', async () => {
  const req = nepReq();
  req._rtgProxyBody = Buffer.from('abc');
  const uit = await new Promise((resolve) => leesBody(req, 3, (err, buf) => resolve({ err, buf })));
  assert.equal(uit.err, null);
  assert.equal(uit.buf.toString(), 'abc');
  assert.equal('_rtgProxyBody' in req, false, 'de buffer mag niet twee keer gelezen worden');
  assert.equal(req.listenerCount('data'), 0, 'met een buffer wordt de stream niet aangesproken');
});

/* ---------- json ---------- */

test('json: een verzoek dat al gelezen is, wordt niet nog eens gelezen', async () => {
  const req = nepReq({ headers: JSONKOP });
  req._body = true; req.body = { al: 'gelezen' };
  const err = await draai(json(), req);
  assert.equal(err, undefined);
  assert.deepEqual(req.body, { al: 'gelezen' });
  assert.equal(req.listenerCount('data'), 0);
});

test('json: geen lichaam of geen JSON-type laat het verzoek ongelezen door', async () => {
  const zonder = nepReq({ headers: { 'content-type': 'application/json' } });
  assert.equal(await draai(json(), zonder), undefined);
  assert.equal(zonder.body, undefined);
  assert.equal(zonder._body, undefined);

  const tekst = nepReq({ headers: { 'content-type': 'text/plain', 'content-length': '3' } });
  assert.equal(await draai(json(), tekst), undefined);
  assert.equal(tekst.body, undefined);
  assert.equal(tekst.listenerCount('data'), 0);
});

test('json: een leeg of alleen-witruimte lichaam wordt {}', async () => {
  for (const inhoud of [[], ['  \n\t ']]) {
    const req = nepReq({ headers: JSONKOP });
    const p = draai(json(), req); stuur(req, inhoud);
    assert.equal(await p, undefined);
    assert.deepEqual(req.body, {});
    assert.equal(req._body, true);
  }
});

test('json: het lichaam null wordt {}, maar een array of getal blijft staan', async () => {
  const gevallen = [['null', {}], [' null ', {}], ['[1,2]', [1, 2]], ['42', 42], ['"tekst"', 'tekst'], ['false', false]];
  for (const [inhoud, verwacht] of gevallen) {
    const req = nepReq({ headers: JSONKOP });
    const p = draai(json(), req); stuur(req, [inhoud]);
    assert.equal(await p, undefined, inhoud);
    assert.deepEqual(req.body, verwacht, inhoud);
  }
});

test('json: kapotte JSON is een 400 met entity.parse.failed, en het verzoek telt als gelezen', async () => {
  const req = nepReq({ headers: JSONKOP });
  const p = draai(json(), req); stuur(req, ['{a:1}']);
  const err = await p;
  assert.equal(err.status, 400);
  assert.equal(err.type, 'entity.parse.failed');
  assert.equal(req._body, true);
  assert.equal(req.body, undefined);
});

test('json: __proto__ in het lichaam vervuilt het prototype niet', async () => {
  const req = nepReq({ headers: JSONKOP });
  const p = draai(json(), req); stuur(req, ['{"__proto__":{"vervuild":true},"a":1}']);
  assert.equal(await p, undefined);
  assert.equal(req.body.a, 1);
  assert.equal(req.body.vervuild, undefined);
  assert.equal({}.vervuild, undefined);
});

test('json: de standaardlimiet is 100kb, een getal als limiet geldt in bytes', async () => {
  const grens = 100 * 1024;
  const net = '"' + 'x'.repeat(grens - 2) + '"';
  const ok = nepReq({ headers: JSONKOP });
  const p1 = draai(json(), ok); stuur(ok, [net]);
  assert.equal(await p1, undefined);
  assert.equal(ok.body.length, grens - 2);

  const teVeel = nepReq({ headers: JSONKOP });
  const p2 = draai(json(), teVeel); stuur(teVeel, [net + ' ']);
  assert.equal((await p2).status, 413);

  const klein = nepReq({ headers: JSONKOP });
  const p3 = draai(json({ limit: 5 }), klein); stuur(klein, ['{"a":1}']);
  const err = await p3;
  assert.equal(err.status, 413);
  assert.equal(klein._body, undefined, 'een geweigerd lichaam telt niet als gelezen');
});

test('json: een eigen type (tekst of functie) bepaalt wat gelezen wordt', async () => {
  const req = nepReq({ headers: { 'content-type': 'text/plain', 'content-length': '7' } });
  const p = draai(json({ type: 'text/plain' }), req); stuur(req, ['{"a":2}']);
  assert.equal(await p, undefined);
  assert.deepEqual(req.body, { a: 2 });

  const viaFunctie = nepReq({ headers: { 'content-length': '7' } });
  const p2 = draai(json({ type: (r) => r.headers['x-rtg'] === undefined }), viaFunctie); stuur(viaFunctie, ['[3]']);
  assert.equal(await p2, undefined);
  assert.deepEqual(viaFunctie.body, [3]);
});

test('json: een streamfout gaat ongewijzigd naar next', async () => {
  const req = nepReq({ headers: JSONKOP });
  const fout = new Error('reset'); fout.code = 'ECONNRESET';
  const p = draai(json(), req); stuur(req, ['{"a"'], { fout });
  assert.equal(await p, fout);
  assert.equal(req._body, undefined);
});

/* ---------- raw ---------- */

test('raw: standaard alleen application/octet-stream, en het lichaam blijft een Buffer', async () => {
  const req = nepReq({ headers: { 'content-type': 'application/octet-stream' } });
  const p = draai(raw(), req); stuur(req, [Buffer.from([0, 255, 1])]);
  assert.equal(await p, undefined);
  assert.ok(Buffer.isBuffer(req.body));
  assert.deepEqual([...req.body], [0, 255, 1]);
  assert.equal(req._body, true);

  const ander = nepReq({ headers: { 'content-type': 'application/json' } });
  assert.equal(await draai(raw(), ander), undefined);
  assert.equal(ander.body, undefined);
  assert.equal(ander.listenerCount('data'), 0);
});

test('raw: een al gelezen verzoek wordt overgeslagen', async () => {
  const req = nepReq({ headers: { 'content-type': 'application/octet-stream' } });
  req._body = true; req.body = 'eerder';
  assert.equal(await draai(raw(), req), undefined);
  assert.equal(req.body, 'eerder');
});

test('raw: limiet uit de opties geldt, ook als tekst, en de standaard is 100kb', async () => {
  const req = nepReq({ headers: { 'content-type': 'application/octet-stream' } });
  const p = draai(raw({ limit: '1kb' }), req); stuur(req, ['x'.repeat(1025)]);
  const err = await p;
  assert.equal(err.status, 413);
  assert.equal(err.type, 'entity.too.large');
  assert.equal(req._body, undefined);

  const groot = nepReq({ headers: { 'content-type': 'application/octet-stream' } });
  const p2 = draai(raw(), groot); stuur(groot, ['x'.repeat(100 * 1024 + 1)]);
  assert.equal((await p2).status, 413);
});

test('raw: een streamfout gaat naar next', async () => {
  const req = nepReq({ headers: { 'content-type': 'application/octet-stream' } });
  const fout = new Error('stuk');
  const p = draai(raw({ type: '*/*' }), req); stuur(req, ['a'], { fout });
  assert.equal(await p, fout);
});

test('leesBody: een Zaakdoos-buffer boven de routelimiet is 413, en wordt ook dan weggehaald', async () => {
  const req = nepReq();
  req._rtgProxyBody = Buffer.from('abcd');
  const uit = await new Promise((resolve) => leesBody(req, 3, (err, buf) => resolve({ err, buf })));
  assert.equal(uit.err.status, 413);
  assert.equal(uit.err.type, 'entity.too.large');
  assert.equal(uit.buf, undefined);
  assert.equal('_rtgProxyBody' in req, false);
});
