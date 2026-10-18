/* DE STIJL- EN SCRIPTBUNDEL -- alleen eigen bestanden, en een wijziging verandert de stempel.

   server/middleware/stijlbundel.js en scriptbundel.js voegen bestanden uit de
   webroot samen tot een antwoord, op een lijst paden die de BROWSER aanlevert
   (base64url in ?f=). Dat is invoer van buiten die over het bestandssysteem
   beslist, dus de randen worden hier op een wegwerp-webroot geduwd.

   Wat hier niet mag sneuvelen:
   1. Een pad met .., een vreemd adres (//cdn...), een verkeerde extensie of te
      veel paden is 400; een ontbrekend bestand of een map gaat naar de 404.
   2. Een @import wordt alleen ingesloten als het een EIGEN .css-pad is; een
      kring wordt een keer ingesloten, de diepte is begrensd, vreemd blijft staan.
   3. Verandert een INGESLOTEN blad, dan verandert de ETag (anders serveert de
      cache oude thema's); dezelfde ETag geeft 304.
   4. br en gzip leveren een antwoord dat terug-uitpakt naar exact de bundel.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - stijlbundel.js metImports(): `if (gezien.has(dAbs)) return ...` weg -> toets 2 zakt (eindeloze kring tot de dieptegrens).
   - stijlbundel.js: `const stempel = alles.map(` -> `bestanden.map(` -> toets 3 zakt.
   - scriptbundel.js: `p.indexOf('..') !== -1` uit de padcontrole -> toets 1 zakt.

   Draai los: node --test test/bundels-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { stijlbundel } = require('../server/middleware/stijlbundel');
const { scriptbundel } = require('../server/middleware/scriptbundel');

/* PROEFMAP en niet WORTEL: dit is een wegwerpmap, geen repositorywortel, en
   test/bronmutanten.test.js leest WORTEL terecht als de echte bron. */
const PROEFMAP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bundel-'));
test.after(() => fs.rmSync(PROEFMAP, { recursive: true, force: true }));
const schrijf = (p, inhoud, mtime) => {
  const abs = path.join(PROEFMAP, p);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, inhoud);
  if (mtime) fs.utimesSync(abs, mtime, mtime);
};
schrijf('css/a.css', '@import "/css/b.css";\n@import url(https://vreemd.test/x.css);\n@import "/css/../geheim.css";\n@import "/css/weg.css";\n@import "/css/map.css";\n.a{}');
schrijf('css/b.css', '@import "/css/a.css";\n.b{}');
for (let i = 0; i < 7; i++) schrijf('css/d' + i + '.css', '@import "/css/d' + (i + 1) + '.css";\n.d' + i + '{}');
fs.mkdirSync(path.join(PROEFMAP, 'css/map.css'));
schrijf('js/een.js', 'var een = 1;');
schrijf('js/twee.js', 'var twee = 2;');
fs.mkdirSync(path.join(PROEFMAP, 'js/map.js'));

const f = (...paden) => Buffer.from(paden.join('\n'), 'utf8').toString('base64url');
function roep(mw, pad, q, headers = {}) {
  const res = { statusCode: 200, kop: {}, lijf: null, door: false,
    status(c) { this.statusCode = c; return this; }, type() { return this; }, send(b) { this.lijf = b; return this; },
    setHeader(k, v) { this.kop[k.toLowerCase()] = v; }, end(b) { this.lijf = b === undefined ? null : b; return this; } };
  mw({ path: pad, query: q === undefined ? {} : { f: q }, headers }, res, () => { res.door = true; });
  return res;
}

test('1. alleen eigen bestanden; vreemd of buiten de wortel is 400', () => {
  for (const [mw, pad, ext] of [[stijlbundel(PROEFMAP), '/stijlbundel.css', 'css'], [scriptbundel(PROEFMAP), '/scriptbundel.js', 'js']]) {
    for (const slecht of ['/' + ext + '/../geheim.' + ext, '//cdn.test/x.' + ext, '/a.txt', 'a.' + ext, '/a b.' + ext]) {
      const r = roep(mw, pad, f(slecht));
      assert.equal(r.statusCode, 400, slecht);
      assert.equal(r.door, false);
    }
    assert.equal(roep(mw, pad, f(...Array.from({ length: 61 }, (_, i) => '/x' + i + '.' + ext))).statusCode, 400, 'te veel paden');
    assert.equal(roep(mw, pad, undefined).statusCode, 400, 'geen bundel gevraagd');
    assert.equal(roep(mw, pad, f('/' + ext + '/bestaat-niet.' + ext)).door, true, 'ontbrekend: de 404 antwoordt');
    assert.equal(roep(mw, pad, f('/' + ext + '/map.' + ext)).door, true, 'een map is geen bestand');
    assert.equal(roep(mw, '/iets-anders', f('/x.' + ext)).door, true);
  }
});

test('2. @import: eigen pad ingesloten, kring een keer, diepte begrensd, vreemd blijft staan', () => {
  const css = roep(stijlbundel(PROEFMAP), '/stijlbundel.css', f('/css/a.css')).lijf.toString();
  assert.match(css, /\/\* @import \/css\/b\.css \*\/\n.*\.b\{\}/s);
  assert.match(css, /@import \/css\/a\.css: al ingesloten/, 'de kring a -> b -> a eindigt');
  assert.match(css, /@import url\(https:\/\/vreemd\.test\/x\.css\);/, 'een vreemd blad wordt niet opgehaald');
  assert.match(css, /@import "\/css\/\.\.\/geheim\.css";/);
  assert.match(css, /@import "\/css\/weg\.css";/);
  assert.match(css, /@import "\/css\/map\.css";/);
  const diep = roep(stijlbundel(PROEFMAP), '/stijlbundel.css', f('/css/d0.css')).lijf.toString();
  assert.match(diep, /\.d5\{\}/);
  assert.doesNotMatch(diep, /\.d6\{\}/, 'na vijf lagen houdt het insluiten op');
  assert.match(diep, /@import "\/css\/d6\.css";/);
});

test('3. een gewijzigd INGESLOTEN blad verandert de ETag; dezelfde ETag is 304', () => {
  const mw = stijlbundel(PROEFMAP);
  const een = roep(mw, '/stijlbundel.css', f('/css/a.css'));
  const etag = een.kop.etag;
  assert.equal(roep(mw, '/stijlbundel.css', f('/css/a.css'), { 'if-none-match': etag }).statusCode, 304);
  schrijf('css/b.css', '@import "/css/a.css";\n.b{color:red}', new Date(Date.parse('2026-01-01T00:00:00Z')));
  const twee = roep(mw, '/stijlbundel.css', f('/css/a.css'));
  assert.notEqual(twee.kop.etag, etag);
  assert.match(twee.lijf.toString(), /color:red/, 'de cache serveert niet de oude versie');
  const js = scriptbundel(PROEFMAP);
  const s1 = roep(js, '/scriptbundel.js', f('/js/een.js', '/js/twee.js'));
  assert.equal(roep(js, '/scriptbundel.js', f('/js/een.js', '/js/twee.js'), { 'if-none-match': s1.kop.etag }).statusCode, 304);
  schrijf('js/twee.js', 'var twee = 22;', new Date(Date.parse('2026-02-01T00:00:00Z')));
  assert.notEqual(roep(js, '/scriptbundel.js', f('/js/een.js', '/js/twee.js')).kop.etag, s1.kop.etag);
});

test('4. br en gzip pakken terug uit naar exact de bundel', () => {
  for (const [mw, pad, q] of [[stijlbundel(PROEFMAP), '/stijlbundel.css', f('/css/b.css')], [scriptbundel(PROEFMAP), '/scriptbundel.js', f('/js/een.js')]]) {
    const kaal = roep(mw, pad, q).lijf;
    const br = roep(mw, pad, q, { 'accept-encoding': 'gzip, br' });
    assert.equal(br.kop['content-encoding'], 'br');
    assert.deepEqual(zlib.brotliDecompressSync(br.lijf), kaal);
    const gz = roep(mw, pad, q, { 'accept-encoding': 'gzip' });
    assert.equal(gz.kop['content-encoding'], 'gzip');
    assert.deepEqual(zlib.gunzipSync(gz.lijf), kaal);
    assert.notEqual(br.kop.etag, gz.kop.etag, 'elke codering een eigen ETag');
    assert.match(roep(mw, pad, q, { 'accept-encoding': 'br' }).kop.etag, /-b"$/, 'tweede keer uit de cache');
  }
  assert.match(roep(scriptbundel(PROEFMAP), '/scriptbundel.js', f('/js/een.js')).lijf.toString(), /try \{\nvar een = 1;\n\} catch/);
});
