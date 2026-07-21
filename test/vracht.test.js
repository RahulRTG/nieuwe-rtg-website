/* RTG Vracht: internationale zendingen over lucht, water en land voor
   expediteurs (demo TerraMar Cargo). Bewaakt de etappeketen met de juiste
   documenten, de douane-stap bij een grensoverschrijding, het publieke
   volgen zonder klantgegevens en de cap-poort.
   Draai los: node --experimental-sqlite --test test/vracht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, vracht, resto;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vracht-'));

const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

async function supLogin(code) {
  const roster = await api('supplier/roster', { code });
  const manager = (roster.body.staff || []).find(x => x.role === 'manager');
  return (await api('supplier/login', { code, staffId: manager.id, pin: '1234' })).body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  vracht = await supLogin('TERRAMAR');
  resto = await supLogin('KIKUNOI');
  assert.ok(vracht && resto, 'de expediteur en het restaurant zijn binnen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let zending;

test('1. de expediteur ziet zijn bord met KPI\'s en de demo-zendingen', async () => {
  const r = await api('supplier/vracht', {}, vracht);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.zendingen) && r.body.zendingen.length >= 2, 'de demo staat klaar');
  assert.ok(r.body.kpi.onderweg >= 1 && r.body.kpi.afgeleverd >= 1);
  assert.ok(r.body.kpi.perModaliteit.zee >= 1, 'de lopende demo-zending vaart');
  assert.deepEqual(Object.keys(r.body.modaliteiten).sort(), ['binnenvaart', 'lucht', 'spoor', 'weg', 'zee'], 'lucht, water en land');
});

test('2. een multimodale internationale zending: elk vervoer krijgt zijn eigen document', async () => {
  const r = await api('supplier/vracht/maak', {
    klant: 'Maison Solene', inhoud: 'Zijden stoffen, 3 pallets', gewichtKg: 1200, colli: 3, incoterm: 'CIP',
    van: { plaats: 'Kyoto', land: 'Japan' }, naar: { plaats: 'Ibiza', land: 'Spanje' },
    etappes: [
      { modaliteit: 'lucht', van: 'Osaka KIX', naar: 'Madrid MAD' },
      { modaliteit: 'spoor', van: 'Madrid', naar: 'Valencia' },
      { modaliteit: 'zee', van: 'Valencia', naar: 'Ibiza-haven' },
      { modaliteit: 'weg', van: 'Ibiza-haven', naar: 'Ibiza-stad' }
    ]
  }, vracht);
  assert.equal(r.status, 200);
  zending = r.body.zending;
  assert.equal(zending.status, 'onderweg');
  assert.equal(zending.etappes[0].status, 'bezig', 'de eerste etappe loopt meteen');
  assert.deepEqual(zending.etappes.map(e => e.document), [
    'AWB (luchtvrachtbrief)', 'CIM-vrachtbrief', 'B/L (cognossement)', 'CMR-vrachtbrief'
  ], 'per modaliteit het juiste vervoersdocument');
  assert.match(zending.volgcode, /^RTG-[0-9A-F]{8}$/);
  // en onzin wordt netjes geweigerd
  assert.equal((await api('supplier/vracht/maak', { klant: 'X', inhoud: 'Y', gewichtKg: 10, colli: 1, van: { plaats: 'A', land: 'B' }, naar: { plaats: 'C', land: 'D' }, etappes: [{ modaliteit: 'teleport', van: 'A', naar: 'C' }] }, vracht)).status, 400);
});

test('3. de keten loopt netjes: etappes af, dan de douane (internationaal), dan afleveren', async () => {
  for (let i = 0; i < 3; i++) {
    const r = await api('supplier/vracht/etappe', { id: zending.id }, vracht);
    assert.equal(r.status, 200);
    assert.equal(r.body.zending.status, 'onderweg');
    assert.equal(r.body.zending.etappes[i + 1].status, 'bezig', 'de volgende etappe start vanzelf');
  }
  const laatste = await api('supplier/vracht/etappe', { id: zending.id }, vracht);
  assert.equal(laatste.body.zending.status, 'douane', 'Japan naar Spanje gaat langs de douane');
  // afleveren kan pas na de inklaring
  assert.equal((await api('supplier/vracht/afleveren', { id: zending.id }, vracht)).status, 400);
  const vrij = await api('supplier/vracht/douane', { id: zending.id }, vracht);
  assert.equal(vrij.body.zending.status, 'aangekomen');
  await api('supplier/vracht/melding', { id: zending.id, tekst: 'Chauffeur onderweg naar de boutique.' }, vracht);
  const af = await api('supplier/vracht/afleveren', { id: zending.id }, vracht);
  assert.equal(af.body.zending.status, 'afgeleverd');
});

test('4. de klant volgt publiek op volgcode, zonder klant of lading te zien', async () => {
  const r = await api('vracht/volg', { code: zending.volgcode.toLowerCase() });
  assert.equal(r.status, 200);
  const z = r.body.zending;
  assert.equal(z.ref, zending.ref);
  assert.equal(z.status, 'afgeleverd');
  assert.equal(z.etappes.length, 4);
  const plat = JSON.stringify(r.body);
  assert.ok(!plat.includes('Maison Solene') && !plat.includes('Zijden stoffen'), 'geen klantgegevens op de volgcode');
  assert.ok(z.gebeurtenissen.some(g => /boutique/.test(g.tekst)), 'de meldingen van de expediteur wel');
  assert.equal((await api('vracht/volg', { code: 'RTG-BESTAATNIET' })).status, 404);
});

test('5. de poorten: zonder vracht-cap 403, zonder inlog 401', async () => {
  assert.equal((await api('supplier/vracht', {}, resto)).status, 403, 'een restaurant is geen expediteur');
  assert.equal((await api('supplier/vracht/maak', { klant: 'X' }, resto)).status, 403);
  assert.equal((await api('supplier/vracht')).status, 401);
});
