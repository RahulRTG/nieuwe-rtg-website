/* De 9+-ronde: de app-gids dekt elke app-pagina met echte uitleg, en Rahul
   is er kindveilig voor het hele gezin in de RTFoundation.
   Draai los: node --experimental-sqlite --test test/negenplus.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body) {
  return fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, gezin, kind;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-negenplus-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  gezin = (await api(base, '/api/foundation/gezin/maak', { gezinsnaam: 'Testgezin', naam: 'Ouder', pin: '1234' })).body;
  const kp = (await api(base, '/api/foundation/gezin/profiel/maak', { code: gezin.code, token: gezin.token, naam: 'Kim', rol: 'kind', groep: 'kind' })).body;
  kind = (await api(base, '/api/foundation/gezin/profiel/kies', { code: gezin.code, profielId: kp.profiel.id })).body;
  assert.ok(kind.token, 'het kind-profiel heeft een token');
});
test.after(() => stop(srv && srv.child));

test('1. de app-gids dekt ELKE app-pagina met een eigen uitleg (wat, doe, tip)', async () => {
  const wortel = path.join(__dirname, '..', 'public', 'apps');
  const paginas = [];
  (function loop(dir, pre) {
    for (const f of fs.readdirSync(dir)) {
      const vol = path.join(dir, f);
      if (fs.statSync(vol).isDirectory()) loop(vol, pre + f + '/');
      else if (f.endsWith('.html')) paginas.push(pre + f);
    }
  })(wortel, '/apps/');
  assert.ok(paginas.length >= 115, 'alle app-pagina\'s gevonden (' + paginas.length + ')');
  for (const p of paginas) {
    const r = await api(base, '/api/gids/app', { pad: p });
    assert.equal(r.status, 200, p);
    const g = r.body.gids;
    assert.ok(g && g.wat && g.wat.length > 20, p + ': echte wat-uitleg');
    assert.ok(Array.isArray(g.doe) && g.doe.length >= 2, p + ': doe-stappen');
    assert.ok(g.tip && g.tip.length > 15, p + ': een leerzame tip');
    assert.ok(!g.algemeen, p + ': eigen uitleg, niet de terugval');
  }
});

test('2. de gids kent de werelden: RTF kindvriendelijk, en buiten /apps/ geen gids', async () => {
  const rtf = (await api(base, '/api/gids/app', { pad: '/apps/foundation/bieb.html' })).body.gids;
  assert.equal(rtf.wereld, 'rtf');
  assert.match(rtf.wat + rtf.tip, /gratis/i, 'de RTF-uitleg benadrukt dat alles gratis is');
  const onbekend = (await api(base, '/api/gids/app', { pad: '/apps/bestaat-niet.html' })).body.gids;
  assert.ok(onbekend.algemeen, 'een onbekende app-pagina krijgt nette terugval-hulp');
  assert.equal((await api(base, '/api/gids/app', { pad: '/site/index.html' })).status, 404);
  assert.equal((await api(base, '/api/gids/app', { pad: '../../etc/passwd' })).status, 404);
});

test('3. Rahul voor het gezin: warm demo-antwoord, kindveilig bij zware onderwerpen', async () => {
  const r = await api(base, '/api/rtf/rahul', { code: gezin.code, token: kind.token, q: 'Hoe kan ik beter woordjes leren?' });
  assert.equal(r.status, 200);
  assert.match(r.body.antwoord, /leren|oefenen|School/i, 'een leervraag krijgt leeradvies');
  const zwaar = await api(base, '/api/rtf/rahul', { code: gezin.code, token: kind.token, q: 'Ik word gepest en ben bang' });
  assert.match(zwaar.body.antwoord, /grote|Steun|Veilig/i, 'een zwaar onderwerp wijst naar een vertrouwde grote en de hulp-pagina\'s');
  assert.equal((await api(base, '/api/rtf/rahul', { code: gezin.code, token: kind.token, q: '' })).status, 400);
  assert.equal((await api(base, '/api/rtf/rahul', { code: gezin.code, token: 'fout', q: 'hoi' })).status, 403, 'zonder geldig profiel geen Rahul');
});

test('4. de uurgrens: na dertig vragen krijgt het kind vriendelijk pauze', async () => {
  let laatste = null;
  for (let i = 0; i < 31; i++) laatste = await api(base, '/api/rtf/rahul', { code: gezin.code, token: kind.token, q: 'vraag ' + i });
  assert.equal(laatste.status, 429);
  assert.match(laatste.body.error, /pauze/i);
});
