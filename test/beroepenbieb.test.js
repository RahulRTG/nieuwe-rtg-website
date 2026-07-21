/* De Beroepen-Bibliotheek van de RTFoundation: twee werelden van elk precies
   een miljoen gratis leer-apps (technisch/agrarisch + bedrijfsleven).
   Draai los: node --experimental-sqlite --test test/beroepenbieb.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body) {
  return fetch(base + '/api/rtf/beroepen' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, sess;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-beroepen-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const post = (p, b) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
  const g = await post('/api/foundation/gezin/maak', { gezinsnaam: 'Vakgezin', naam: 'Mam', pin: '1234' });
  const kp = await post('/api/foundation/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Sem', rol: 'kind', groep: 'tiener' });
  const kies = await post('/api/foundation/gezin/profiel/kies', { code: g.code, profielId: kp.profiel.id });
  sess = { code: g.code, token: kies.token };
  assert.ok(sess.token, 'het kind-profiel is ingelogd');
});
test.after(() => stop(srv && srv.child));

test('1. twee werelden van elk precies een miljoen apps, allemaal gratis', async () => {
  const r = await api(base, '', sess);
  assert.equal(r.status, 200);
  assert.equal(r.body.totaal, 2000000);
  assert.equal(r.body.perWereld, 1000000);
  assert.equal(r.body.werelden.length, 2);
  for (const w of r.body.werelden) {
    assert.equal(w.aantal, 1000000, w.label);
    assert.equal(w.beroepen.length, 100);
    assert.equal(w.soorten.length, 50);
  }
  assert.ok(r.body.gratis);
  // de wereld-ids kloppen met de vraag: technisch/agrarisch en bedrijfsleven
  assert.deepEqual(r.body.werelden.map(w => w.id).sort(), ['techniek', 'zaken']);
});

test('2. zoeken op een beroep werkt in beide werelden; alles is gratis en deterministisch', async () => {
  const las = await api(base, '/catalogus', { ...sess, wereld: 'techniek', zoek: 'lasser' });
  assert.equal(las.body.totaal, 10000, 'een beroep heeft 10.000 apps (50 soorten x 200 edities/niveaus)');
  for (const a of las.body.items) { assert.equal(a.beroep, 'Lasser'); assert.equal(a.prijsCenten, 0); assert.match(a.uitleg, /altijd gratis/); }
  const ond = await api(base, '/catalogus', { ...sess, wereld: 'zaken', zoek: 'ondernemer' });
  assert.ok(ond.body.totaal >= 10000, 'ondernemer-apps in de zakenwereld');
  assert.ok(ond.body.items.every(a => a.wereld === 'zaken'));
  // soort x beroep combineert; dezelfde pagina geeft dezelfde apps
  const a1 = await api(base, '/catalogus', { ...sess, wereld: 'techniek', beroep: 'Melkveehouder', soort: 'Leerpad', pagina: 2 });
  const a2 = await api(base, '/catalogus', { ...sess, wereld: 'techniek', beroep: 'Melkveehouder', soort: 'Leerpad', pagina: 2 });
  assert.equal(a1.body.totaal, 200);
  assert.deepEqual(a1.body.items.map(x => x.id), a2.body.items.map(x => x.id));
  const niks = await api(base, '/catalogus', { ...sess, wereld: 'techniek', zoek: 'qqqxyz' });
  assert.ok(niks.body.hint, 'een misser legt uit hoe je wel zoekt');
  assert.equal((await api(base, '/catalogus', { ...sess, wereld: 'bestaatniet' })).status, 404);
});

test('3. installeren en verwijderen per profiel; zonder gezinsprofiel blijft alles dicht', async () => {
  const eerste = (await api(base, '/catalogus', { ...sess, wereld: 'zaken', beroep: 'Ondernemer' })).body.items[0];
  const i1 = await api(base, '/installeer', { ...sess, id: eerste.id });
  assert.equal(i1.status, 200);
  assert.equal(i1.body.aantal, 1);
  assert.ok((await api(base, '/installeer', { ...sess, id: eerste.id })).body.alGeinstalleerd);
  const mijn = await api(base, '/mijn', sess);
  assert.equal(mijn.body.apps.length, 1);
  assert.equal(mijn.body.apps[0].id, eerste.id);
  assert.equal((await api(base, '/weg', { ...sess, id: eerste.id })).body.aantal, 0);
  assert.equal((await api(base, '/installeer', { ...sess, id: 'techniek-1000000' })).status, 404, 'buiten de wereld bestaat niets');
  assert.equal((await api(base, '', { code: sess.code, token: 'fout' })).status, 403, 'zonder profiel geen bibliotheek');
});
