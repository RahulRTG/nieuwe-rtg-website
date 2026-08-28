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

test('1. spec-randgevallen: de uitvoer staat vast, teken voor teken', () => {
  /* GOUDEN WAARDEN, GEEN VERGELIJKING MET DE INGEBOUWDE.

     Hier stond `assert.equal(rtgjson.stringify(w), JSON.stringify(w))`. Dat was
     de juiste toets zolang stringify een EIGEN implementatie was: twee wegen
     naar hetzelfde antwoord, en de toets zag het als ze uiteenliepen. Sinds
     stringify de ingebouwde aanroept, vergelijkt die bewering de ingebouwde met
     zichzelf -- een toets die niet meer kan zakken, en dat is slechter dan geen
     toets (LAT.md regel 9).

     Vaste verwachtingen kunnen wel zakken: als de delegatie ooit breekt, als
     iemand er een eigen weg naast legt, of als een nieuwe Node-versie een van
     deze randgevallen anders opschrijft (1e+21, 5e-324, \ud800, -0 dat "0"
     wordt, Date via toJSON, undefined dat in een array "null" wordt en in een
     object verdwijnt). Juist dat laatste wil je horen, en de oude vorm kon het
     per definitie niet melden. */
  const GOUD = [
    [null, "null"],
    [true, "true"],
    [false, "false"],
    [0, "0"],
    [-0, "0"],
    [1.5, "1.5"],
    [1e21, "1e+21"],
    [5e-324, "5e-324"],
    [-3.25e-7, "-3.25e-7"],
    [0.1 + 0.2, "0.30000000000000004"],
    [Number.MAX_SAFE_INTEGER, "9007199254740991"],
    ['hoi', "\"hoi\""],
    ['', "\"\""],
    ['a"b\\c', "\"a\\\"b\\\\c\""],
    ['regel1\nregel2\ttab\rterug\fboog\bbel', "\"regel1\\nregel2\\ttab\\rterug\\fboog\\bbel\""],
    ['unicode: \u20ac en emoji \ud83d\ude00', "\"unicode: \u20ac en emoji \ud83d\ude00\""],
    [String.fromCharCode(0xD800), "\"\\ud800\""],
    [String.fromCharCode(0xDC00), "\"\\udc00\""],
    ['stuur\u0000teken', "\"stuur\\u0000teken\""],
    [[1, [2, [3, []]]], "[1,[2,[3,[]]]]"],
    [{ a: 1, b: { c: [true, null, 'x'] }, leeg: {}, lijst: [] }, "{\"a\":1,\"b\":{\"c\":[true,null,\"x\"]},\"leeg\":{},\"lijst\":[]}"],
    [{ datum: new Date(0) }, "{\"datum\":\"1970-01-01T00:00:00.000Z\"}"],
    [{ u: undefined, f: () => 1, n: 9 }, "{\"n\":9}"],
    [{ getallen: [NaN, Infinity, -Infinity] }, "{\"getallen\":[null,null,null]}"]
  ];
  for (const [waarde, verwacht] of GOUD) {
    assert.equal(rtgjson.stringify(waarde), verwacht, 'stringify van ' + String(verwacht).slice(0, 60));
  }
  // een functie of symbool als hele waarde levert undefined, net als een lege plek
  assert.equal(rtgjson.stringify(() => 1), undefined);
  assert.equal(rtgjson.stringify(Symbol('s')), undefined);
  // en een BigInt blijft een NETTE rtgjson-fout, geen kale TypeError
  assert.throws(() => rtgjson.stringify(10n), (e) => e.rtgjson === true, 'BigInt hoort een rtgjson-fout te geven');
  assert.throws(() => rtgjson.stringify({ a: 10n }), (e) => e.rtgjson === true, 'ook genest');


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
    /* PARSE blijft een echte differentiele toets: onze parser is eigen werk en
       moet hetzelfde document opleveren als de ingebouwde. */
    assert.equal(JSON.stringify(rtgjson.parse(inge)), JSON.stringify(JSON.parse(inge)), 'parse wijkt af in fuzz-ronde ' + i);
    /* STRINGIFY is dat niet meer -- die roept de ingebouwde aan, dus `eigen ===
       inge` zou de ingebouwde met zichzelf vergelijken en nooit meer kunnen
       zakken (LAT.md regel 9). Wat hier wel iets bewijst is de RONDRIT door de
       eigen motor: wat wij opschrijven moet onze eigen parser identiek
       teruggeven. Dat bijt op allebei de helften, en juist op hun naad. */
    assert.deepEqual(rtgjson.parse(eigen), x, 'rondrit door de eigen motor wijkt af in fuzz-ronde ' + i);
  }
});

/* DE ESCAPE-CONTRACTEN, ALS EIGENSCHAPPEN.

   Hier stond een uitputtende vergelijking met de ingebouwde motor: elk teken
   van 0x00 tot 0x2FFF op drie posities, elk los surrogaat, en een raster van
   complete paren -- allemaal via `assert.equal(rtgjson.stringify(s),
   JSON.stringify(s))`. Die toets was er om de eigen escape-voorwacht (strEsc)
   te bewaken, en dat deed hij goed.

   Die voorwacht bestaat niet meer: stringify roept de ingebouwde aan. Daarmee
   werd elke bewering hier de ingebouwde tegen zichzelf -- ruim twaalfduizend
   vergelijkingen die niet meer konden zakken (LAT.md regel 9). Zoiets weggooien
   mag niet, maar laten staan is erger: het is precies de vorm die vertrouwen
   koopt dat er niet is.

   Dus dezelfde uitputtendheid, maar met beweringen die WEL kunnen zakken, en
   die bovendien iets zeggen wat we werkelijk nodig hebben in plaats van "gelijk
   aan de buurman":

     1. de uitvoer draagt nooit een rauw stuurteken. Zo'n teken maakt de JSON
        ongeldig voor elke andere lezer, en dat merk je pas ver weg.
     2. een LOS surrogaat staat er ge-escapet. Rauw is het ongeldige UTF-8 en
        knapt de bezorging.
     3. een COMPLEET paar blijft rauw: geen escaping-laag over een tekst die al
        goed was.
     4. alles komt via ONZE eigen parser identiek terug -- de rondrit is het
        eigenlijke contract tussen de twee helften van deze motor.

   MUTATIE-BEWIJS: laat stringify het escapen van stuurtekens achterwege en punt
   1 zakt op teken 0; laat een los surrogaat rauw staan en punt 2 zakt op de
   eerste. Beide zijn geprobeerd en beide sloegen aan. */
test('3b. de uitvoer draagt geen rauw stuurteken, en losse surrogaten staan ge-escaped', () => {
  const RAUW_STUUR = /[\x00-\x1f]/;
  const controleer = (s, waar) => {
    const uit = rtgjson.stringify(s);
    assert.ok(!RAUW_STUUR.test(uit), 'rauw stuurteken in de uitvoer bij ' + waar);
    assert.equal(rtgjson.parse(uit), s, 'rondrit door de eigen motor wijkt af bij ' + waar);
  };
  for (let i = 0; i <= 0x2fff; i++) {
    const c = String.fromCharCode(i);
    for (const s of [c, 'x' + c, 'x' + c + 'y']) controleer(s, 'teken 0x' + i.toString(16));
    // ook als SLEUTEL: daar geldt exact hetzelfde, en een sleutel loopt langs een andere weg
    const uitSleutel = rtgjson.stringify({ [c]: 1 });
    assert.ok(!RAUW_STUUR.test(uitSleutel), 'rauw stuurteken in een SLEUTEL, teken 0x' + i.toString(16));
    assert.deepEqual(rtgjson.parse(uitSleutel), { [c]: 1 }, 'rondrit van een SLEUTEL, teken 0x' + i.toString(16));
  }
  for (let h = 0xd800; h <= 0xdfff; h++) {
    const c = String.fromCharCode(h);
    const uit = rtgjson.stringify('a' + c + 'b');
    assert.ok(uit.includes('\\u' + h.toString(16)),
      'los surrogaat 0x' + h.toString(16) + ' hoort ge-escapet in de uitvoer te staan, niet rauw');
    assert.ok(!RAUW_STUUR.test(uit), 'los surrogaat 0x' + h.toString(16));
  }
  for (let h = 0xd800; h <= 0xdbff; h += 7) {
    for (let l = 0xdc00; l <= 0xdfff; l += 13) {
      const s = String.fromCharCode(h) + String.fromCharCode(l);
      const uit = rtgjson.stringify(s);
      assert.ok(!/\\u/.test(uit), 'compleet paar ' + h + '/' + l + ' hoort RAUW te blijven, niet ge-escaped');
      assert.equal(rtgjson.parse(uit), s, 'rondrit van een compleet paar ' + h + '/' + l);
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
