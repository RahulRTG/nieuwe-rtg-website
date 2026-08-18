/* De eigen JSON-motor (server/lib/rtgjson): in huis gecodeerd in plaats van
   de ingebouwde JSON, en op de grenzen ingebouwd (HTTP-body in, res.json
   uit, db-snapshots). Bewijs in drie lagen: (1) spec-randgevallen en een
   differentiele fuzz tegen de ingebouwde motor (zelfde bytes, beide kanten
   op), (2) de schilden die de ingebouwde niet heeft (__proto__ geweerd,
   diepte-grens, strikte afwijzing van rommel), (3) end-to-end door de echte
   server: een verzoek gaat er via de eigen parser in en via de eigen
   stringifier uit. Draai los: node --test test/rtgjson.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const rtgjson = require('../server/lib/rtgjson');
const { startServer, stop } = require('./helper');

test('1. spec-randgevallen: byte-voor-byte gelijk aan de ingebouwde motor', () => {
  const gevallen = [null, true, false, 0, -0, 1.5, 1e21, 5e-324, -3.25e-7, 0.1 + 0.2,
    Number.MAX_SAFE_INTEGER, 'hoi', '', 'a"b\\c', 'regel1\nregel2\ttab\rterug\fboog\bbel',
    'unicode: € en emoji 😀', String.fromCharCode(0xD800), String.fromCharCode(0xDC00),
    'stuurteken', [1, [2, [3, []]]], { a: 1, b: { c: [true, null, 'x'] }, leeg: {}, lijst: [] },
    { datum: new Date(0) }, { u: undefined, f: () => 1, n: 9 }, [undefined, () => 1, Symbol('s')],
    { getallen: [NaN, Infinity, -Infinity] }];
  for (const w of gevallen) {
    assert.equal(rtgjson.stringify(w), JSON.stringify(w), 'stringify van ' + String(JSON.stringify(w)).slice(0, 60));
  }
  // parse: witruimte, exponents, escapes, dubbele sleutels (laatste wint)
  assert.deepEqual(rtgjson.parse('  { "a" : [ 1 , 2.5e2 , -0.5 , "\\u0041\\n" ] } '), { a: [1, 250, -0.5, 'A\n'] });
  assert.deepEqual(rtgjson.parse('{"k":1,"k":2}'), { k: 2 });
  assert.deepEqual(rtgjson.parse('"\\ud83d\\ude00"'), '😀', 'surrogaatpaar via escapes');
});

test('2. strikt volgens de spec: wat de ingebouwde weigert, weigeren wij ook', () => {
  const rommel = ['', '  ', '{', '[1,]', '{"a":}', '{a:1}', "{'a':1}", '01', '1.', '.5', '+1', '1e',
    'nul', 'True', '"open', '"\\x41"', '"\\u12g4"', '"regel\nerin"', '[1] extra', '{}{}', 'NaN', 'Infinity'];
  for (const r of rommel) {
    assert.throws(() => rtgjson.parse(r), (e) => e.rtgjson === true, 'hoort te weigeren: ' + JSON.stringify(r));
    assert.throws(() => JSON.parse(r), 'de ingebouwde weigert dit ook: ' + JSON.stringify(r));
  }
});

test('3. differentiele fuzz: 5000 willekeurige documenten, beide kanten op identiek', () => {
  let R = 20260721;
  const rnd = () => (R = (R * 1103515245 + 12345) >>> 0) / 4294967296;
  function maak(d) {
    const r = rnd();
    if (d > 5 || r < 0.15) {
      const blad = [null, true, false, rnd() * 1e9 - 5e8, Math.round(rnd() * 1000),
        'tekst"met\\rare\n' + String.fromCharCode(32 + Math.floor(rnd() * 0x2fff)), ''];
      return blad[Math.floor(rnd() * blad.length)];
    }
    if (r < 0.55) {
      const o = {}; const n = Math.floor(rnd() * 5);
      for (let i = 0; i < n; i++) o['s' + Math.floor(rnd() * 1000) + String.fromCharCode(35 + Math.floor(rnd() * 80))] = maak(d + 1);
      return o;
    }
    const a = []; const n = Math.floor(rnd() * 5);
    for (let i = 0; i < n; i++) a.push(maak(d + 1));
    return a;
  }
  for (let i = 0; i < 5000; i++) {
    const x = maak(0);
    const eigen = rtgjson.stringify(x), inge = JSON.stringify(x);
    assert.equal(eigen, inge, 'stringify wijkt af in fuzz-ronde ' + i);
    assert.equal(JSON.stringify(rtgjson.parse(inge)), JSON.stringify(JSON.parse(inge)), 'parse wijkt af in fuzz-ronde ' + i);
  }
});

/* De SNELLE WEG in strEsc. Verreweg de meeste tekst hoeft niet ge-escaped en
   krijgt sinds taak 17 alleen nog een regex-test in plaats van een lus per
   teken (3,7x sneller; stringify was 12% van de warme rekentijd). Zo'n voorwacht
   is precies het soort optimalisatie dat een STIL verschil kan opleveren: een
   teken dat de detector mist gaat rauw de uitvoer in en dat merk je pas als een
   ander systeem de JSON weigert.

   Daarom uitputtend en niet steekproefsgewijs: elk teken van 0x00 tot 0x2FFF op
   drie posities, elk los surrogaat, en een raster van complete paren.

   MUTATIE-BEWIJS: haal 0x00-0x1f uit BIJZONDER en deze toets zakt op teken 0
   (een rauw stuurteken in de uitvoer); haal de surrogaten eruit en hij zakt op
   het eerste losse surrogaat. */
test('3b. de snelle weg escapeert precies wat de ingebouwde escapeert', () => {
  for (let i = 0; i <= 0x2fff; i++) {
    const c = String.fromCharCode(i);
    for (const s of [c, 'x' + c, 'x' + c + 'y']) {
      assert.equal(rtgjson.stringify(s), JSON.stringify(s), 'teken 0x' + i.toString(16));
    }
    assert.equal(rtgjson.stringify({ [c]: 1 }), JSON.stringify({ [c]: 1 }), 'als SLEUTEL, teken 0x' + i.toString(16));
  }
  for (let h = 0xd800; h <= 0xdfff; h++) {
    const s = 'a' + String.fromCharCode(h) + 'b';
    assert.equal(rtgjson.stringify(s), JSON.stringify(s), 'los surrogaat 0x' + h.toString(16));
  }
  for (let h = 0xd800; h <= 0xdbff; h += 7) {
    for (let l = 0xdc00; l <= 0xdfff; l += 13) {
      const s = String.fromCharCode(h) + String.fromCharCode(l);
      assert.equal(rtgjson.stringify(s), JSON.stringify(s), 'compleet paar ' + h + '/' + l);
    }
  }
});

test('4. de schilden: __proto__ bestaat niet eens, en nestings-bommen ketsen af', () => {
  const g = rtgjson.parse('{"__proto__":{"besmet":1},"constructor":{"prototype":{"besmet":1}},"a":2}');
  assert.equal({}.besmet, undefined, 'het wereldwijde prototype is schoon');
  assert.equal(g.besmet, undefined, 'niets geerfd');
  assert.equal(g.a, 2, 'gewone velden gewoon aanwezig');
  assert.ok(!Object.prototype.hasOwnProperty.call(g, '__proto__'), 'de sleutel is niet eens gebouwd');
  assert.throws(() => rtgjson.parse('['.repeat(100) + ']'.repeat(100)), (e) => /te diep/.test(e.message), 'standaardgrens 64');
  assert.deepEqual(rtgjson.parse('[[[1]]]', { maxDiepte: 3 }), [[[1]]], 'precies op de grens mag');
  assert.throws(() => rtgjson.parse('[[[[1]]]]', { maxDiepte: 3 }), (e) => e.rtgjson === true, 'erover niet');
});

test('5. end-to-end: het verzoek gaat via de eigen parser erin en de eigen stringifier eruit', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-json-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  try {
    const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: typeof body === 'string' ? body : JSON.stringify(body || {}) });
    const u = Date.now().toString().slice(-8);
    const reg = await (await api('/api/auth/register', { name: 'Json Lid', email: 'js' + u + '@x.nl', phone: '06' + u,
      password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' })).json();
    assert.ok(reg.token, 'registreren werkt door de eigen parser heen');
    // unicode en escapes overleven de rondreis lid -> server -> lid
    const titel = 'Cadeau € 🎁 met "quotes" en \\backslash';
    const voeg = await (await api('/api/wallet/voeg', { soort: 'klantenkaart', titel, code: 'K-1' }, reg.token)).json();
    assert.equal(voeg.item.titel, titel.replace(/[<>]/g, '').trim(), 'unicode intact (na de gewone ontsmetting)');
    // kapotte JSON is een nette 400, geen serverfout
    const kapot = await api('/api/wallet/voeg', '{"soort": kapot}', reg.token);
    assert.equal(kapot.status, 400);
    // een nestings-bom ketst al in de parser af
    const bom = await api('/api/wallet/voeg', '['.repeat(200) + ']'.repeat(200), reg.token);
    assert.equal(bom.status, 400, 'diepte-bom is een 400');
    // en het antwoord zelf is geldige JSON uit de eigen stringifier
    const w = await (await api('/api/wallet', {}, reg.token)).json();
    assert.ok(Array.isArray(w.items) && w.items.length === 1);
  } finally {
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
