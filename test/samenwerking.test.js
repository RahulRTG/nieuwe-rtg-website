/* End-to-end tests voor de samenwerkingslaag (kern/samenwerking.js): EGn knop om
   als creator een leverancier voor te stellen, en een oproep waarop creators
   reageren en de leverancier er een kiest. We loggen als manager van twee
   verschillende bedrijven in (creator LUMINA en horeca KIKUNOI). Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function managerLogin(base, code) {
  const roster = (await api(base, '/api/supplier/roster', { code })).body;
  const m = roster.staff.find(x => x.role === 'manager');
  const r = await api(base, '/api/supplier/login', { code, staffId: m.id, pin: '1234' });
  return r.body.token;
}

let srv, base, creatorTok, horecaTok;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sw-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  creatorTok = await managerLogin(base, 'LUMINA');
  horecaTok = await managerLogin(base, 'KIKUNOI');
  assert.ok(creatorTok && horecaTok, 'beide managers ingelogd');
});
test.after(() => stop(srv && srv.child));

test('1. de lijsten kloppen: creator ziet leveranciers, leverancier ziet creators', async () => {
  const mijnCr = (await api(base, '/api/supplier/samenwerking/mijn', {}, creatorTok)).body;
  assert.equal(mijnCr.isCreator, true, 'LUMINA is een creator');
  const lev = (await api(base, '/api/supplier/samenwerking/leveranciers', {}, creatorTok)).body;
  assert.ok(lev.leveranciers.some(l => l.code === 'KIKUNOI'), 'creator ziet KIKUNOI');
  assert.ok(!lev.leveranciers.some(l => l.code === 'LUMINA'), 'creators staan niet in de leveranciers-lijst');
  const cre = (await api(base, '/api/supplier/samenwerking/creators', {}, horecaTok)).body;
  assert.ok(cre.creators.some(c => c.code === 'LUMINA' && c.bereik > 0), 'leverancier ziet LUMINA met bereik');
});

test('2. EGn knop: creator stelt een leverancier voor, leverancier accepteert', async () => {
  const v = await api(base, '/api/supplier/samenwerking/voorstel', { naarCode: 'KIKUNOI', bericht: 'Ik maak graag een reel over jullie.', soort: 'reel', budget: 850 }, creatorTok);
  assert.equal(v.status, 200);
  // KIKUNOI ziet het als binnenkomend
  let mijn = (await api(base, '/api/supplier/samenwerking/mijn', {}, horecaTok)).body;
  const inkomend = mijn.voorstellen.in.find(x => x.ander.code === 'LUMINA');
  assert.ok(inkomend && inkomend.status === 'voorgesteld', 'voorstel staat binnen');
  const b = await api(base, '/api/supplier/samenwerking/beslis', { id: inkomend.id, actie: 'accepteren' }, horecaTok);
  assert.equal(b.body.status, 'geaccepteerd');
  // de creator ziet de acceptatie aan zijn uitgaande kant
  mijn = (await api(base, '/api/supplier/samenwerking/mijn', {}, creatorTok)).body;
  assert.ok(mijn.voorstellen.uit.some(x => x.ander.code === 'KIKUNOI' && x.status === 'geaccepteerd'), 'creator ziet geaccepteerd');
});

test('3. dubbel voorstel wordt geweigerd zolang er een openstaat', async () => {
  await api(base, '/api/supplier/samenwerking/voorstel', { naarCode: 'PONTO', bericht: 'hoi' }, creatorTok);
  const tweede = await api(base, '/api/supplier/samenwerking/voorstel', { naarCode: 'PONTO', bericht: 'nog eens' }, creatorTok);
  assert.equal(tweede.status, 400, 'geen dubbel openstaand voorstel');
});

test('4. leverancier roept creators op, creator reageert, leverancier kiest', async () => {
  const op = await api(base, '/api/supplier/samenwerking/oproep', { titel: 'Zomercampagne 2026', omschrijving: '3 reels over onze zomerkaart', soort: 'reel', budget: 2000 }, horecaTok);
  assert.equal(op.status, 200);
  // de creator ziet de open oproep
  let mijnCr = (await api(base, '/api/supplier/samenwerking/mijn', {}, creatorTok)).body;
  const open = mijnCr.openOproepen.find(o => o.id === op.body.id);
  assert.ok(open, 'creator ziet de open oproep');
  // reageren
  const reac = await api(base, '/api/supplier/samenwerking/reageer', { oproepId: op.body.id, bericht: 'Ik doe dit graag!' }, creatorTok);
  assert.equal(reac.status, 200);
  // dubbel reageren mag niet
  const nogmaals = await api(base, '/api/supplier/samenwerking/reageer', { oproepId: op.body.id, bericht: 'nog eens' }, creatorTok);
  assert.equal(nogmaals.status, 400);
  // de leverancier ziet de reactie en kiest de creator
  let mijnLev = (await api(base, '/api/supplier/samenwerking/mijn', {}, horecaTok)).body;
  const mopr = mijnLev.mijnOproepen.find(o => o.id === op.body.id);
  assert.equal(mopr.reacties.length, 1, 'EGn reactie zichtbaar voor de leverancier');
  const kies = await api(base, '/api/supplier/samenwerking/kies', { oproepId: op.body.id, creatorCode: 'LUMINA' }, horecaTok);
  assert.equal(kies.status, 200);
  // de creator heeft nu een geaccepteerde samenwerking uit de oproep
  mijnCr = (await api(base, '/api/supplier/samenwerking/mijn', {}, creatorTok)).body;
  assert.ok(mijnCr.voorstellen.in.some(x => x.uitOproep && x.status === 'geaccepteerd'), 'creator is gekozen en heeft de samenwerking');
});

test('5. een creator kan geen oproep plaatsen (dat is voor leveranciers)', async () => {
  const r = await api(base, '/api/supplier/samenwerking/oproep', { titel: 'mag niet' }, creatorTok);
  assert.equal(r.status, 400);
});
