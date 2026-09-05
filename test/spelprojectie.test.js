/* De projectiekamer: een potje op een gedeeld scherm.

   De televisie heeft geen ledenaccount. Een eenmalige 128-bits koppeling wordt
   atomair ingewisseld voor een aparte, intrekbare schermsessie. Alleen
   `zicht.publiek` mag daarna over de lijn. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const maakSpellen = require('../server/kern/spellen');
let idemTeller = 0;
const idem = () => 'projectie-test-' + String(++idemTeller).padStart(32, '0');

function opstelling({ volwassen = () => true, save = () => {} } = {}) {
  const db = { data: { spellen: { potjes: {}, wachtrij: {} } } };
  const kern = maakSpellen({ db, save, crypto, zijnVrienden: () => true,
    codenaamVan: (x) => 'CN-' + x, sseToCustomer() {}, isGeblokkeerd: () => false,
    socialZoek: async () => [], sociaalRate: () => true, volwassen,
    sseClients: [], lidBoardUit: () => false });
  return { db, kern };
}

async function seconden(o) {
  const r = await o.kern.spelNieuw('a', { soort: 'seconden', grootte: 4,
    vrienden: ['b', 'c', 'd'], wereld: 'rtg' });
  for (const x of ['b', 'c', 'd']) o.kern.spelAntwoord(x, r.id, true);
  o.kern.spelZet('a', r.id, { actie: 'kaart' });
  return r.id;
}

async function koppel(o, id, speler = 'a') {
  const uitgifte = await o.kern.projectieOpen(speler, id, idem());
  assert.equal(uitgifte.status, 200);
  assert.match(uitgifte.code, /^GAME\.[A-F0-9]{32}$/);
  const sessie = await o.kern.projectieKoppel(uitgifte.code);
  assert.equal(sessie.status, 200);
  assert.match(sessie.token, /^SCREEN\.[A-F0-9]{32}$/);
  return { uitgifte, sessie };
}

test('het gedeelde scherm van 30 Seconden krijgt de kaart niet', async () => {
  const o = opstelling(), id = await seconden(o), toegang = await koppel(o, id);
  const scherm = await o.kern.projectieStand(toegang.sessie.token);
  assert.equal(scherm.status, 200);
  assert.ok(o.db.data.spellen.potjes[id].staat.kaart, 'er ligt wel een kaart');
  assert.equal(scherm.staat.kaart, undefined, 'de publieke projectie ziet hem niet');
  assert.ok(Array.isArray(scherm.staat.scores));
  assert.equal(typeof scherm.staat.rader, 'number');
});

test('het scherm gebruikt alleen zijn eigen sessie en geen ledenidentiteit', async () => {
  const o = opstelling(), id = await seconden(o), toegang = await koppel(o, id);
  assert.equal(o.kern.projectieStand.length, 1);
  assert.equal((await o.kern.projectieStand(toegang.sessie.token)).status, 200);
  assert.equal((await o.kern.projectieStand('a', toegang.sessie.token)).status, 404,
    'een spelerssleutel is geen schermsessie');
});

test('alleen een speler geeft een code uit en een veilige idem is verplicht', async () => {
  const o = opstelling(), id = await seconden(o);
  assert.equal((await o.kern.projectieOpen('vreemde', id, idem())).status, 404);
  assert.equal((await o.kern.projectieOpen('a', id, '')).status, 400);
});

test('een uitgifte is eenmalig en een retry rediscloset geen code', async () => {
  const o = opstelling(), id = await seconden(o), sleutel = idem();
  const eerste = await o.kern.projectieOpen('a', id, sleutel);
  const tweede = await o.kern.projectieOpen('a', id, sleutel);
  assert.ok(eerste.code);
  assert.equal(tweede.status, 409);
  assert.equal(tweede.herhaald, true);
  assert.equal(tweede.code, undefined);
  const een = await o.kern.projectieKoppel(eerste.code);
  const twee = await o.kern.projectieKoppel(eerste.code);
  assert.ok(een.token);
  assert.equal(twee.status, 404);
  assert.equal(twee.token, undefined);
});

test('een nieuwe uitgifte roteert code en schermsessie onmiddellijk', async () => {
  const o = opstelling(), id = await seconden(o), oud = await koppel(o, id);
  const vers = await o.kern.projectieOpen('b', id, idem());
  assert.equal(vers.geroteerd, true);
  assert.notEqual(vers.code, oud.uitgifte.code);
  assert.equal((await o.kern.projectieStand(oud.sessie.token)).status, 404);
  assert.equal((await o.kern.projectieKoppel(oud.uitgifte.code)).status, 404);
  assert.equal((await o.kern.projectieKoppel(vers.code)).status, 200);
});

test('opslag bevat uitsluitend hashes en nooit kale credentials', async () => {
  const o = opstelling(), id = await seconden(o), toegang = await koppel(o, id);
  const json = JSON.stringify(o.db.data.spellen);
  assert.ok(!json.includes(toegang.uitgifte.code));
  assert.ok(!json.includes(toegang.sessie.token));
  const rij = o.db.data.spellen.projecties[0];
  assert.match(rij.koppeling.code_hash, /^[a-f0-9]{64}$/);
  assert.match(rij.scherm.code_hash, /^[a-f0-9]{64}$/);
});

test('verzonnen, verlopen en ingetrokken schermsessies doen niets', async () => {
  const o = opstelling(), id = await seconden(o), toegang = await koppel(o, id);
  assert.equal((await o.kern.projectieStand('SCREEN.' + 'A'.repeat(32))).status, 404);
  o.db.data.spellen.projecties[0].scherm.expires_at = new Date(Date.now() - 1000).toISOString();
  assert.equal((await o.kern.projectieStand(toegang.sessie.token)).status, 404);

  const vers = await koppel(o, id, 'b');
  assert.equal((await o.kern.projectieSluit('c', id)).status, 200);
  assert.equal((await o.kern.projectieStand(vers.sessie.token)).status, 404);
});

test('verdwijnt het potje, dan geeft de sessie niets meer prijs', async () => {
  const o = opstelling(), id = await seconden(o), toegang = await koppel(o, id);
  delete o.db.data.spellen.potjes[id];
  assert.equal((await o.kern.projectieStand(toegang.sessie.token)).status, 404);
});

test('legacy 32-bits codes worden gehasht en hard ingetrokken', async () => {
  const o = opstelling(), id = await seconden(o);
  o.db.data.spellen.projectie = { DEADBEEF: { potje: id, door: 'a',
    at: new Date().toISOString(), tot: new Date(Date.now() + 3600000).toISOString() } };
  const nieuw = await o.kern.projectieOpen('a', id, idem());
  assert.equal(nieuw.status, 200);
  const json = JSON.stringify(o.db.data.spellen);
  assert.ok(!json.includes('DEADBEEF'));
  assert.equal(o.db.data.spellen.projectie, undefined);
  assert.ok(o.db.data.spellen.projecties.some(x => /^legacy-/.test(x.id) && x.gesloten_at));
});

test('ook een aangeboden legacy-code wordt uit logpaden geredigeerd', () => {
  const { geheimVrij } = require('../server/log-redactie');
  const uit = geheimVrij('GET /api/projectie/DEADBEEF gaf 410');
  assert.equal(uit, 'GET /api/projectie/:credential gaf 410');
  assert.ok(!uit.includes('DEADBEEF'));
});

test('een opslagfout rolt de volledige credentialuitgifte terug', async () => {
  let stuk = false;
  const o = opstelling({ save(){ if (stuk) throw new Error('schijf stuk'); } });
  const id = await seconden(o); stuk = true;
  await assert.rejects(Promise.resolve().then(() => o.kern.projectieOpen('a', id, idem())), /schijf stuk/);
  assert.deepEqual(o.db.data.spellen.projecties, undefined);
});

test('een spel zonder publiek zicht en een klaar potje krijgen geen code', async () => {
  const o = opstelling();
  const r = await o.kern.spelNieuw('a', { soort: 'pesten', grootte: 2,
    vrienden: ['b'], wereld: 'rtf' });
  o.kern.spelAntwoord('b', r.id, true);
  assert.equal((await o.kern.projectieOpen('a', r.id, idem())).status, 400);

  const id = await seconden(o); o.kern.spelOpgeven('a', id);
  assert.equal((await o.kern.projectieOpen('b', id, idem())).status, 409);
});

test('elke projectie blijft binnen wat de spelers al zien', async () => {
  const o = opstelling(), id = await seconden(o), toegang = await koppel(o, id);
  const scherm = (await o.kern.projectieStand(toegang.sessie.token)).staat;
  const p = o.db.data.spellen.potjes[id];
  const REG = require('../server/kern/spellen/register')({ save() {}, crypto,
    schud: (x) => x, beurtDoor() {}, codenaamVan: (x) => x, nudge() {} });
  for (const veld of Object.keys(scherm)) {
    if (scherm[veld] === null || scherm[veld] === undefined) continue;
    const verborgen = p.spelers.some(sp => {
      const v = REG.ZICHT[p.soort].speler(p, p.staat, sp)[veld];
      return v === null || v === undefined;
    });
    assert.ok(!verborgen, 'het scherm toont `' + veld + '` terwijl een speler dat niet mag zien');
  }
});

test('de browser gebruikt fragment, vaste POST-routes en geen persoonlijke schil', () => {
  const lees = rel => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const html = lees('public/apps/spelscherm.html');
  const scherm = lees('public/apps/spelscherm.js');
  const spelen = lees('public/apps/spelen.html');
  const routes = lees('server/routes/spellen.js');
  const eenmalig = require('../server/lib/eenmalig-geheim-routes').ROUTES;
  assert.ok(html.indexOf('history.replaceState') < html.indexOf('rel="stylesheet"'),
    'het fragment wordt gewist voordat paginaresources laden');
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.match(html, /data-rtg-projectie/);
  assert.ok(!html.includes('/shared/metgezel.js'), 'een gedeeld apparaat krijgt geen persoonlijke metgezel');
  assert.ok(html.includes('/shared/wauw.js'), 'de technische wake-locklaag blijft beschikbaar');
  assert.doesNotMatch(html, /os-switcher|rtg-edge|appmenu|\/apps\/(?:app|rtg|kantoor|reizen)\.html/,
    'een gedeeld televisiescherm draagt geen wereld-, account- of appnavigatie');
  assert.match(scherm, /post\('\/api\/projectie\/koppel'/);
  assert.match(scherm, /post\('\/api\/projectie\/kijk'/);
  assert.match(scherm, /credentials:'omit'/);
  assert.doesNotMatch(scherm, /fetch\([^\n]*\/api\/projectie\/['"]?\s*\+/,
    'geen credential wordt aan een fetch-URL geplakt');
  assert.match(spelen, /RTGIdem\('spelprojectie'\)/);
  assert.match(spelen, /spelscherm\.html#/);
  assert.ok(eenmalig.has('POST /api/member/spel/projectie-open'));
  assert.ok(eenmalig.has('POST /api/rtf/spel/projectie-open'));
  assert.ok(eenmalig.has('POST /api/projectie/koppel'));
  assert.match(routes, /app\.get\('\/api\/projectie\/:code'[\s\S]*?status\(410\)/);
});
