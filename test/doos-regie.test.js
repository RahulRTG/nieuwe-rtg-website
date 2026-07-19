/* De doos-regie: het beheer op afstand van de Zaakdoos-vloot. Het kantoor
   zet een doelversie en per doos een netwerkrol (accesspoint, versterker,
   gastwifi); de doos haalt beide zelf op bij zijn eigen melding en meldt de
   uitslag van zijn update-hook terug. De stroomwacht kleurt het wereldbord
   oranje zodra een zaak op batterij draait. Draai los:
   node --experimental-sqlite --test test/doos-regie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doosregie-'));
const SLEUTEL = 'test-doos-sleutel-1234567890';

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
function doosApi(pad, body, methode) {
  return fetch(base + pad, {
    method: methode || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', 'x-doos-sleutel': SLEUTEL },
    body: body ? JSON.stringify(body) : undefined
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DOOS_SLEUTEL: SLEUTEL } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(office, 'het kantoor is ingelogd');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het kantoor zet een doelversie; een doos op een oudere versie krijgt de update-opdracht, precies een keer per kwartier', async () => {
  const zet = await api('/api/office/doos/update-zet', { versie: '2.4.0', notities: 'kassa-fix', naam: 'Imran' }, office);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.update.versie, '2.4.0');
  // de doos meldt zich met een oudere versie en krijgt de opdracht mee
  const m1 = await doosApi('/api/doos/meting', { doos: 'IBIZA-1', rtt: 40, modus: 'cloud', versie: '2.3.0', wifi: 'accesspoint' });
  assert.equal(m1.status, 200);
  assert.equal(m1.body.opdracht, 'update', 'de oude versie krijgt de update-opdracht');
  // direct opnieuw melden: geen tweede opdracht (het kwartier-slot)
  const m2 = await doosApi('/api/doos/meting', { doos: 'IBIZA-1', rtt: 40, modus: 'cloud', versie: '2.3.0' });
  assert.equal(m2.body.opdracht, undefined, 'niet nog een keer binnen het kwartier');
  // een doos die al op de doelversie zit, krijgt niets
  const m3 = await doosApi('/api/doos/meting', { doos: 'IBIZA-2', rtt: 30, modus: 'cloud', versie: '2.4.0' });
  assert.equal(m3.body.opdracht, undefined, 'de doelversie zelf krijgt geen opdracht');
});

test('2. het update-kanaal zit achter de sleutel; de doos haalt de doelversie op en meldt de uitslag terug', async () => {
  const zonder = await fetch(base + '/api/doos/update');
  assert.equal(zonder.status, 403, 'zonder sleutel dicht');
  const doel = await doosApi('/api/doos/update');
  assert.equal(doel.status, 200);
  assert.equal(doel.body.versie, '2.4.0');
  assert.equal(doel.body.notities, 'kassa-fix');
  const uitslag = await doosApi('/api/doos/update/status', { doos: 'IBIZA-1', van: '2.3.0', naar: '2.4.0', gelukt: false, melding: 'geen update-hook (RTG_DOOS_UPDATE_CMD) op dit kastje' });
  assert.equal(uitslag.status, 200);
  const regie = await api('/api/office/doos/regie', {}, office);
  assert.equal(regie.body.statussen[0].doos, 'IBIZA-1');
  assert.equal(regie.body.statussen[0].gelukt, false);
  const board = await api('/api/office/boardroom', {}, office);
  assert.ok(board.body.audit.some(a => /update NIET gelukt/.test(a.wat)), 'de uitslag staat in het auditlog');
});

test('3. de netwerkrol: het kantoor zet accesspoint of versterker, de doos krijgt hem met zijn eigen melding mee', async () => {
  const fout = await api('/api/office/doos/netwerk-zet', { doos: 'BESTAAT-NIET', instellingen: { rol: 'versterker' } }, office);
  assert.equal(fout.status, 404, 'een onbekende doos moet zich eerst zelf melden');
  const zet = await api('/api/office/doos/netwerk-zet', { doos: 'IBIZA-1', naam: 'Imran',
    instellingen: { rol: 'versterker', ssid: 'RTG Beachclub', gastwifi: true, gastSsid: 'RTG Beachclub Gasten', kanaal: 6 } }, office);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.netwerk.rol, 'versterker');
  const m = await doosApi('/api/doos/meting', { doos: 'IBIZA-1', rtt: 35, modus: 'cloud', versie: '2.3.0' });
  assert.equal(m.body.netwerk.rol, 'versterker', 'de rol reist met de eigen melding mee');
  assert.equal(m.body.netwerk.gastSsid, 'RTG Beachclub Gasten');
  assert.equal((await api('/api/office/doos/netwerk-zet', { doos: 'IBIZA-1', instellingen: { rol: 'zendmast' } }, office)).status, 400, 'een onbekende rol wordt geweigerd');
});

test('4. de stroomwacht en het wereldbord: op batterij kleurt de doos oranje, met versie en wifi in het detail', async () => {
  await doosApi('/api/doos/meting', { doos: 'IBIZA-1', rtt: 35, modus: 'cloud', versie: '2.3.0', wifi: 'versterker', stroom: { bron: 'batterij', pct: 61 } });
  const w = await api('/api/office/wereld', {}, office);
  const bol = w.body.items.find(i => i.id === 'doos:IBIZA-1');
  assert.equal(bol.status, 'oranje', 'op batterij is oranje');
  assert.match(bol.detail, /op batterij \(61%\)/);
  assert.match(bol.detail, /v2\.3\.0 \(doel v2\.4\.0\)/, 'de versie-achterstand staat in het detail');
  assert.match(bol.detail, /wifi: versterker/);
  assert.ok(bol.acties.includes('update'), 'de update-knop staat erbij zolang de doos achterloopt');
  // de wereldknop zet een update-opdracht klaar die de doos ophaalt
  const actie = await api('/api/office/wereld/actie', { id: 'doos:IBIZA-1', actie: 'update', naam: 'Imran' }, office);
  assert.equal(actie.status, 200);
  const m = await doosApi('/api/doos/meting', { doos: 'IBIZA-1', rtt: 35, modus: 'cloud', versie: '2.3.0' });
  assert.equal(m.body.opdracht, 'update', 'de doos haalt de wereldknop-opdracht op');
});

test('5. de doos-kant (beheer-module): netwerkrol toepassen en de stroomwacht lezen, zonder hardware-hooks', async () => {
  const beheerTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-beheer-'));
  const beheer = require('../server/kern/zaakdoos/beheer')({ dataDir: beheerTmp, cloud: () => base, sleutel: SLEUTEL, doosNaam: 'UNIT-DOOS' });
  assert.ok(beheer.versie, 'de doos kent zijn eigen versie');
  assert.equal(beheer.wifiRol(), 'uit', 'zonder instellingen staat de wifi-rol uit');
  // een nieuwe stand wordt toegepast; dezelfde stand een tweede keer niet
  assert.equal(beheer.pasNetwerkToe({ rol: 'accesspoint', ssid: 'Test', at: 1000 }), true);
  assert.equal(beheer.wifiRol(), 'accesspoint');
  assert.equal(beheer.pasNetwerkToe({ rol: 'versterker', ssid: 'Test', at: 1000 }), false, 'een oude stand wordt genegeerd');
  assert.equal(beheer.wifiRol(), 'accesspoint');
  // de stroomwacht leest het UPS-bestand
  const stroomBestand = path.join(beheerTmp, 'stroom.txt');
  fs.writeFileSync(stroomBestand, 'batterij 84');
  process.env.RTG_DOOS_STROOM_BESTAND = stroomBestand;
  assert.deepEqual(beheer.stroom(), { bron: 'batterij', pct: 84 });
  delete process.env.RTG_DOOS_STROOM_BESTAND;
  // de update zonder hook meldt eerlijk dat het kastje geen hook heeft
  delete process.env.RTG_DOOS_UPDATE_CMD;
  await beheer.doeUpdate();
  const regie = await api('/api/office/doos/regie', {}, office);
  const eigen = regie.body.statussen.find(s => s.doos === 'UNIT-DOOS');
  assert.ok(eigen, 'de uitslag van de unit-doos staat bij de cloud');
  assert.equal(eigen.gelukt, false);
  assert.match(eigen.melding, /geen update-hook/);
  try { fs.rmSync(beheerTmp, { recursive: true, force: true }); } catch (e) {}
});
