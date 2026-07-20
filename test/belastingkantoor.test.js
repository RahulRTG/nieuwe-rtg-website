/* Het Belastingkantoor (kern/overheid/kantoor.js): de inspecteurscockpit met
   invordering via de Berichtenbox, het btw-beeld uit de facturatiemotor + KVK,
   de slimme signalen en de AI-chef-inspecteur. Alleen voor het rijk. Draai los:
   node --experimental-sqlite --test test/belastingkantoor.test.js */
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

let srv, base, lid, lid2, rijk, partner;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bdkantoor-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Inwoner Een', email: 'b1' + u + '@x.nl',
    phone: '061' + u.slice(1), password: 'geheim123', geboortedatum: '1985-04-04', tier: 'rtg', pasApp: 'rtg' })).body.token;
  lid2 = (await api(base, '/api/auth/register', { name: 'Inwoner Twee', email: 'b2' + u + '@x.nl',
    phone: '062' + u.slice(1), password: 'geheim123', geboortedatum: '1979-09-09', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const roster = await api(base, '/api/supplier/roster', { code: 'RIJK' });
  const man = roster.body.staff.find(m => m.role === 'manager');
  rijk = (await api(base, '/api/supplier/login', { code: 'RIJK', staffId: man.id, pin: '1234' })).body.token;
  partner = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  // twee aangiftes: een met openstaand saldo (niets ingehouden) en een met hoge aftrek (controle-signaal)
  await api(base, '/api/overheid/aangifte', { inkomen: 90000, aftrek: 1000, ingehouden: 0 }, lid);
  await api(base, '/api/overheid/aangifte', { inkomen: 50000, aftrek: 30000, ingehouden: 20000 }, lid2);
});
test.after(() => stop(srv && srv.child));

test('1. de cockpit toont het hele beeld: te ontvangen, openstaand en de signalen', async () => {
  const c = await api(base, '/api/overheid/bd/cockpit', {}, rijk);
  assert.equal(c.status, 200);
  assert.ok(c.body.teOntvangen > 0, 'er staat een aanslag open');
  assert.ok(c.body.openstaand >= 1);
  assert.ok(Array.isArray(c.body.signalen));
  assert.ok(c.body.signalen.some(s => s.soort === 'controle'), 'de hoge aftrek valt op als controle-signaal');
  assert.ok('btwDitJaar' in c.body && 'ondernemingen' in c.body, 'het btw/KVK-beeld zit in de cockpit');
});

test('2. invordering: herinnering en betalingsregeling landen in de Berichtenbox van de inwoner', async () => {
  const a = await api(base, '/api/overheid/bd/aanslagen', { stand: 'open' }, rijk);
  assert.equal(a.status, 200);
  const open = a.body.aanslagen[0];
  assert.ok(open && open.saldo > 0);
  // herinnering
  assert.equal((await api(base, '/api/overheid/bd/herinnering', { ref: open.ref }, rijk)).status, 200);
  // regeling: 6 maanden, netjes verdeeld
  const r = await api(base, '/api/overheid/bd/regeling', { ref: open.ref, maanden: 6 }, rijk);
  assert.equal(r.status, 200);
  assert.equal(r.body.regeling.maanden, 6);
  assert.ok(r.body.regeling.per >= Math.floor(open.saldo / 6));
  // een onzinnige regeling wordt geweigerd
  assert.equal((await api(base, '/api/overheid/bd/regeling', { ref: open.ref, maanden: 99 }, rijk)).status, 400);
  // beide besluiten staan in de Berichtenbox van het lid
  const box = await api(base, '/api/overheid/berichten', {}, lid);
  assert.ok(box.body.berichten.some(b => /herinnering/i.test(b.titel)), 'de herinnering is bezorgd');
  assert.ok(box.body.berichten.some(b => /regeling/i.test(b.titel)), 'de regeling is bezorgd');
});

test('3. kwijtschelding maakt de aanslag dicht en meldt het de inwoner', async () => {
  // de tweede inwoner heeft door de hoge aftrek en lage inhouding ook een openstaand saldo
  const a = await api(base, '/api/overheid/bd/aanslagen', { stand: 'open' }, rijk);
  const open = a.body.aanslagen[0];
  assert.ok(open, 'er staat nog een aanslag open');
  const k = await api(base, '/api/overheid/bd/kwijt', { ref: open.ref, reden: 'schrijnend geval' }, rijk);
  assert.equal(k.status, 200);
  // dubbel kwijtschelden kan niet
  assert.equal((await api(base, '/api/overheid/bd/kwijt', { ref: open.ref }, rijk)).status, 409);
  const na = await api(base, '/api/overheid/bd/aanslagen', {}, rijk);
  assert.ok(na.body.aanslagen.find(x => x.ref === open.ref).kwijtgescholden);
});

test('4. het btw-beeld komt uit de facturatiemotor, gekoppeld aan het KVK-register', async () => {
  const b = await api(base, '/api/overheid/bd/btw', {}, rijk);
  assert.equal(b.status, 200);
  assert.ok(Array.isArray(b.body.zaken));
  assert.ok('totaalBtw' in b.body && 'totaalOmzet' in b.body);
  // elke zaak in het beeld draagt de KVK-koppeling (ingeschreven ja/nee)
  for (const z of b.body.zaken) assert.ok('ingeschreven' in z);
});

test('5. de AI-chef-inspecteur adviseert op het hele beeld (en beslist niets)', async () => {
  const r = await api(base, '/api/overheid/bd/ai', { vraag: 'Wat pak ik als eerste op?' }, rijk);
  assert.equal(r.status, 200);
  assert.ok(r.body.antwoord && r.body.antwoord.length > 20);
  assert.match(r.body.antwoord, /beslis|besluit|zelf/i, 'het advies benadrukt dat de mens beslist');
});

test('6. het kantoor is alleen voor het rijk: partner en anoniem komen er niet in', async () => {
  assert.equal((await api(base, '/api/overheid/bd/cockpit', {}, partner)).status, 403);
  assert.equal((await api(base, '/api/overheid/bd/cockpit', {}, null)).status, 401);
  assert.equal((await api(base, '/api/overheid/bd/herinnering', { ref: 'x' }, partner)).status, 403);
});
