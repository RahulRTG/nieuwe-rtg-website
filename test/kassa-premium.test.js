/* De premium-laag van De Kassa, gewoon inbegrepen: derving (verspil, breuk,
   eigen gebruik, repro), retour als minbon, wachtbonnen (parkeren en
   terughalen), korting met reden op de bon, het dagrapport en de kasopmaak.
   Draai: node --test test/kassa-premium.test.js */
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

/* EEN RETOUR IS GELD UIT DE LADE, EN HIJ WAS ONBEGRENSD.

   De bon wordt vrij samengesteld -- naam, aantal en prijs komen alle drie uit
   het verzoek -- en er hoeft geen oorspronkelijke verkoop tegenover te staan.
   Elke medewerker met een pincode kon dus een retour van een willekeurig
   bedrag boeken en dat contant uit de kassa nemen; de kasopmaak klopte daarna
   keurig, want de minbon stond er netjes bij. Dit is de klassieke
   kassafraude. Onder de grens doet de medewerker het zelf, daarboven komt de
   manager erbij -- en de grens zelf is een managerinstelling, want wie hem
   zelf mocht zetten zette hem op oneindig. */
test('de retourgrens: onder de grens boekt de medewerker zelf, daarboven de manager', async () => {
  const roster = await json(await api('/api/supplier/roster', { code: 'KIKUNOI' }));
  const mgr = roster.staff.find(x => x.role === 'manager');
  const mgrToken = (await json(await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' }))).token;
  assert.ok(mgrToken, 'de manager is ingelogd');

  const groot = [{ name: 'Menu compleet', qty: 10, price: 95 }]; // EUR 950
  const geweigerd = await api('/api/supplier/kassa/retour', { items: groot, reden: 'zogenaamd geannuleerd' }, stafToken);
  assert.equal(geweigerd.status, 403, 'een medewerker boekt geen retour van EUR 950');
  const uitleg = await json(geweigerd);
  assert.equal(uitleg.managerNodig, true, 'en de kassa weet WAAROM, zodat hij het kan zeggen');
  assert.equal(uitleg.grens, 50, 'de standaardgrens');

  // de manager kan het wel
  const mgrRetour = await json(await api('/api/supplier/kassa/retour', { items: groot, reden: 'echt geannuleerd' }, mgrToken));
  assert.equal(mgrRetour.sale.total, -950, 'de manager heeft geen grens -- die IS de grens');

  // en de zaak mag de grens zelf zetten; alleen de manager
  assert.equal((await api('/api/supplier/kassa/instel', { retourGrens: 1000 }, stafToken)).status, 403,
    'de grens verzetten is niet iets wat je onder je eigen grens uit doet');
  const gezet = await json(await api('/api/supplier/kassa/instel', { retourGrens: 1000 }, mgrToken));
  assert.equal(gezet.retourGrens, 1000, 'de manager zet hem op EUR 1.000');
  const nu = await json(await api('/api/supplier/kassa/retour', { items: groot, reden: 'binnen de nieuwe grens' }, stafToken));
  assert.equal(nu.sale.total, -950, 'en dan mag de medewerker het wel');

  // nul betekent: altijd de manager
  await api('/api/supplier/kassa/instel', { retourGrens: 0 }, mgrToken);
  const klein = [{ name: 'Koffie', qty: 1, price: 3 }];
  assert.equal((await api('/api/supplier/kassa/retour', { items: klein, reden: 'koud' }, stafToken)).status, 403,
    'op nul komt de manager er bij elk bedrag bij');
  assert.equal((await json(await api('/api/supplier/kassa/retour', { items: klein, reden: 'koud' }, mgrToken))).sale.total, -3);
  // en netjes terug, zodat een volgende test niet op deze stand landt
  await api('/api/supplier/kassa/instel', { retourGrens: 50 }, mgrToken);
});
