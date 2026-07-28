/* De premium-laag van De Kassa, gewoon inbegrepen: derving (verspil, breuk,
   eigen gebruik, repro), retour als minbon, wachtbonnen (parkeren en
   terughalen), korting met reden op de bon, het dagrapport en de kasopmaak.
   Draai: node --experimental-sqlite --test test/kassa-premium.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kaspr-'));
let child, stafToken;

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = await json(await api('/api/supplier/roster', { code: 'KIKUNOI' }));
  const staf = roster.staff.find(x => x.role !== 'manager');
  stafToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: staf.id, pin: '5678' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('derving: verspil/breuk/eigen gebruik worden geboekt met waarde; onzin en lege bonnen niet', async () => {
  assert.equal((await api('/api/supplier/kassa/derving', { soort: 'zwevend', items: [{ name: 'X', qty: 1, price: 1 }] }, stafToken)).status, 400);
  assert.equal((await api('/api/supplier/kassa/derving', { soort: 'breuk', items: [] }, stafToken)).status, 400);
  const br = await json(await api('/api/supplier/kassa/derving', { soort: 'breuk',
    items: [{ name: 'Cava-glas', qty: 2, price: 12 }], notitie: 'dienblad gevallen', kassa: 'Kassa bar' }, stafToken));
  assert.equal(br.derving.label, 'breuk');
  assert.equal(br.derving.waarde, 24);
  const eg = await json(await api('/api/supplier/kassa/derving', { soort: 'eigen',
    items: [{ name: 'Lunch personeel', qty: 1, price: 8 }] }, stafToken));
  assert.equal(eg.derving.label, 'eigen gebruik');
});

test('retour: een teruggave is een minbon in dezelfde kassastroom', async () => {
  const r = await json(await api('/api/supplier/kassa/retour', {
    items: [{ name: 'Gazpacho', qty: 1, price: 16 }], reden: 'verkeerd gerecht', kassa: 'Kassa bar' }, stafToken));
  assert.equal(r.sale.total, -16);
  assert.equal(r.sale.retour, true);
  assert.match(r.sale.desc, /verkeerd gerecht/);
});

test('wachtbonnen: parkeren, in de lijst zien en op elk scherm terughalen', async () => {
  const p = await json(await api('/api/supplier/kassa/parkeer', { naam: 'tafel raam',
    items: [{ name: 'Pulpo', qty: 1, price: 28 }], kassa: 'Kassa bar' }, stafToken));
  assert.equal(p.bon.naam, 'tafel raam');
  const l = await json(await api('/api/supplier/kassa/wachtbon', {}, stafToken));
  assert.ok(l.wachtbonnen.some(b => b.id === p.bon.id));
  const terug = await json(await api('/api/supplier/kassa/wachtbon', { id: p.bon.id }, stafToken));
  assert.equal(terug.bon.items[0].name, 'Pulpo');
  // twee keer terughalen kan niet: hij is van de lijst
  assert.equal((await api('/api/supplier/kassa/wachtbon', { id: p.bon.id }, stafToken)).status, 404);
});

test('korting met reden reist mee op de bon en telt mee in het dagrapport', async () => {
  const s = await json(await api('/api/supplier/pos/sale', {
    total: 22.5, method: 'contant', kassa: 'Kassa bar',
    korting: { bedrag: 2.5, reden: 'vaste klant' },
    items: [{ name: 'Lamsrack-deel', qty: 1, price: 25 }]
  }, stafToken));
  assert.equal(s.sale.korting.bedrag, 2.5);
  assert.equal(s.sale.korting.reden, 'vaste klant');
});

test('het dagrapport telt omzet, betaalwijzen, kassa-namen, retouren, kortingen en derving bij elkaar', async () => {
  const d = await json(await api('/api/supplier/kassa/dagrapport', {}, stafToken));
  assert.equal(d.omzet, 6.5, 'EUR 22,50 verkoop min EUR 16 retour');
  assert.equal(d.retouren, 1);
  assert.equal(d.retourBedrag, 16);
  assert.equal(d.kortingen, 2.5);
  assert.equal(d.perKassa['Kassa bar'], 6.5);
  assert.equal(d.derving.regels, 2, 'breuk en eigen gebruik; een repro telt niet als derving');
  assert.equal(d.derving.waarde, 32);
  assert.equal(d.derving.perSoort['breuk'], 1);
});

test('de kasopmaak: geteld tegen het verwachte contant van vandaag', async () => {
  // contant vandaag: 22,50 verkoop - 16 retour = 6,50; de lade telt 6,00
  const r = await json(await api('/api/supplier/kassa/kasopmaak', { geteld: 6, kassa: 'Kassa bar' }, stafToken));
  assert.equal(r.opmaak.verwacht, 6.5);
  assert.equal(r.opmaak.verschil, -0.5);
  assert.equal((await api('/api/supplier/kassa/kasopmaak', { geteld: -1 }, stafToken)).status, 400);
});
