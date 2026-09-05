/* RTG Vracht: internationale zendingen over lucht, water en land voor
   expediteurs (demo TerraMar Cargo). Bewaakt de etappeketen met de juiste
   documenten, de douane-stap bij een grensoverschrijding, het publieke
   volgen zonder klantgegevens en de cap-poort.
   Draai los: node --test test/vracht.test.js */
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
}).then(async r => ({ status: r.status, headers:r.headers, body: await r.json().catch(() => ({})) }));

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
const maakIdem = 'vracht-test-maak-00000001';
const maakLijf = () => ({
  idem: maakIdem,
  klant: 'Maison Solene', inhoud: 'Zijden stoffen, 3 pallets', gewichtKg: 1200, colli: 3, incoterm: 'CIP',
  van: { plaats: 'Kyoto', land: 'Japan' }, naar: { plaats: 'Ibiza', land: 'Spanje' },
  etappes: [
    { modaliteit: 'lucht', van: 'Osaka KIX', naar: 'Madrid MAD' },
    { modaliteit: 'spoor', van: 'Madrid', naar: 'Valencia' },
    { modaliteit: 'zee', van: 'Valencia', naar: 'Ibiza-haven' },
    { modaliteit: 'weg', van: 'Ibiza-haven', naar: 'Ibiza-stad' }
  ]
});

test('1. de expediteur ziet zijn bord met KPI\'s en de demo-zendingen', async () => {
  const r = await api('supplier/vracht', {}, vracht);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.zendingen) && r.body.zendingen.length >= 2, 'de demo staat klaar');
  assert.ok(r.body.kpi.onderweg >= 1 && r.body.kpi.afgeleverd >= 1);
  assert.ok(r.body.kpi.perModaliteit.zee >= 1, 'de lopende demo-zending vaart');
  assert.deepEqual(Object.keys(r.body.modaliteiten).sort(), ['binnenvaart', 'lucht', 'spoor', 'weg', 'zee'], 'lucht, water en land');
  assert.ok(r.body.zendingen.every(z => !z.volgcode), 'een voorbeeld krijgt geen verloren actief geheim');
  assert.ok(!JSON.stringify(r.body).includes('code_hash'), 'het beheerantwoord lekt nooit een credentialhash');
});

test('2. een multimodale internationale zending: elk vervoer krijgt zijn eigen document', async () => {
  const r = await api('supplier/vracht/maak', maakLijf(), vracht);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control') || '', /no-store/, 'een eenmalig geheim is nooit cachebaar');
  zending = r.body.zending;
  assert.equal(zending.status, 'onderweg');
  assert.equal(zending.etappes[0].status, 'bezig', 'de eerste etappe loopt meteen');
  assert.deepEqual(zending.etappes.map(e => e.document), [
    'AWB (luchtvrachtbrief)', 'CIM-vrachtbrief', 'B/L (cognossement)', 'CMR-vrachtbrief'
  ], 'per modaliteit het juiste vervoersdocument');
  assert.match(zending.volgcode, /^VRT\.[0-9A-F]{32}$/);
  assert.equal(zending.volgcode_eenmalig, true);
  const herhaal = await api('supplier/vracht/maak', maakLijf(), vracht);
  assert.equal(herhaal.status, 409, 'een retry voert niet opnieuw uit');
  assert.equal(herhaal.body.herhaald, true);
  assert.equal(herhaal.body.zending.volgcode, undefined, 'een retry toont het geheim niet opnieuw');
  const anders = maakLijf(); anders.inhoud = 'Een andere lading';
  const botsing = await api('supplier/vracht/maak', anders, vracht);
  assert.equal(botsing.status, 409, 'dezelfde sleutel met ander werk wordt geweigerd');
  // en onzin wordt netjes geweigerd
  assert.equal((await api('supplier/vracht/maak', { idem:'vracht-test-onzin-0001', klant: 'X', inhoud: 'Y', gewichtKg: 10, colli: 1, van: { plaats: 'A', land: 'B' }, naar: { plaats: 'C', land: 'D' }, etappes: [{ modaliteit: 'teleport', van: 'A', naar: 'C' }] }, vracht)).status, 400);
});

test('3. de keten loopt netjes: etappes af, dan de douane (internationaal), dan afleveren', async () => {
  for (let i = 0; i < 3; i++) {
    const idem = 'vracht-test-etappe-00000' + i;
    const r = await api('supplier/vracht/etappe', { id: zending.id, idem }, vracht);
    assert.equal(r.status, 200);
    assert.equal(r.body.zending.status, 'onderweg');
    assert.equal(r.body.zending.etappes[i + 1].status, 'bezig', 'de volgende etappe start vanzelf');
    if (i === 0) {
      const herhaal = await api('supplier/vracht/etappe', { id:zending.id, idem }, vracht);
      assert.equal(herhaal.status, 200);
      assert.equal(herhaal.body.herhaald, true);
      assert.equal(herhaal.body.zending.etappes[2].status, 'gepland', 'een retry vinkt geen tweede etappe af');
    }
  }
  const laatste = await api('supplier/vracht/etappe', { id: zending.id, idem:'vracht-test-etappe-laatste' }, vracht);
  assert.equal(laatste.body.zending.status, 'douane', 'Japan naar Spanje gaat langs de douane');
  // afleveren kan pas na de inklaring
  assert.equal((await api('supplier/vracht/afleveren', { id: zending.id, idem:'vracht-test-tevroeg-aflever' }, vracht)).status, 400);
  const vrij = await api('supplier/vracht/douane', { id: zending.id, idem:'vracht-test-douane-vrij-01' }, vracht);
  assert.equal(vrij.body.zending.status, 'aangekomen');
  const melding = { id:zending.id, tekst:'Chauffeur onderweg naar de boutique.', idem:'vracht-test-melding-00001' };
  await api('supplier/vracht/melding', melding, vracht);
  const meldHerhaal = await api('supplier/vracht/melding', melding, vracht);
  assert.equal(meldHerhaal.body.herhaald, true, 'een retry maakt geen dubbele klantmelding');
  const af = await api('supplier/vracht/afleveren', { id: zending.id, idem:'vracht-test-afleveren-0001' }, vracht);
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
  assert.equal(z.gebeurtenissen.filter(g => /boutique/.test(g.tekst)).length, 1, 'de melding staat eenmaal in het logboek');
  assert.equal((await api('vracht/volg', { code: 'VRT.BESTAATNIET000000000000000000' })).status, 404);
});

test('5. een volgcode roteert en trekt direct in zonder geheim in een lijst of retry', async () => {
  const oud = zending.volgcode;
  const idem = 'vracht-test-roteer-000001';
  const r = await api('supplier/vracht/volgcode/roteer', { id:zending.id, idem }, vracht);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('cache-control') || '', /no-store/);
  const vers = r.body.zending.volgcode;
  assert.match(vers, /^VRT\.[0-9A-F]{32}$/);
  assert.notEqual(vers, oud);
  assert.equal((await api('vracht/volg', { code:oud })).status, 404, 'de oude code is meteen dood');
  assert.equal((await api('vracht/volg', { code:vers })).status, 200, 'de nieuwe code werkt');

  const herhaal = await api('supplier/vracht/volgcode/roteer', { id:zending.id, idem }, vracht);
  assert.equal(herhaal.status, 409);
  assert.equal(herhaal.body.zending.volgcode, undefined, 'rotatieretry herhaalt geen geheim');
  const bord = await api('supplier/vracht', {}, vracht);
  const plat = JSON.stringify(bord.body);
  assert.ok(!plat.includes(oud) && !plat.includes(vers) && !plat.includes('code_hash'), 'bord en status blijven geheimvrij');

  const weg = await api('supplier/vracht/volgcode/intrek', { id:zending.id, reden:'klant heeft de link niet meer nodig' }, vracht);
  assert.equal(weg.status, 200);
  const ingetrokken = await api('vracht/volg', { code:vers });
  const onbekend = await api('vracht/volg', { code:'VRT.00000000000000000000000000000000' });
  assert.equal(ingetrokken.status, 404);
  assert.deepEqual(ingetrokken.body, onbekend.body, 'ingetrokken en onbekend zijn publiek niet te onderscheiden');
  const nogmaals = await api('supplier/vracht/volgcode/intrek', { id:zending.id }, vracht);
  assert.equal(nogmaals.status, 200);
  assert.equal(nogmaals.body.al, true, 'intrekken is veilig herhaalbaar');
});

test('6. de poorten: zonder vracht-cap 403, zonder inlog 401', async () => {
  assert.equal((await api('supplier/vracht', {}, resto)).status, 403, 'een restaurant is geen expediteur');
  assert.equal((await api('supplier/vracht/maak', { klant: 'X' }, resto)).status, 403);
  assert.equal((await api('supplier/vracht')).status, 401);
});
