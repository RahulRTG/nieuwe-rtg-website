/* RTG Horeca OS, deel 2: het keukenscherm. Getoetst zijn de beloftes, niet de
   knoppen:

   - de keuken ziet niets van een gang die de zaal nog niet heeft vrijgegeven;
   - de allergie staat op elke weergave, ook op het regiescherm;
   - tijd is een feit met een norm ernaast, en "te laat" volgt uit dat getal;
   - een stand terugzetten kan alleen met een reden, en die blijft staan;
   - het regiescherm zegt hoe lang het eerste bord al KOUD staat te worden;
   - de drukterem waarschuwt met zijn eigen rekensom en zet nooit zelf iets dicht.
   Draai: node --experimental-sqlite --test test/horeca-keuken.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kds-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const H = (pad, body) => api('/api/supplier/horeca' + pad, body, tok);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  tok = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function tafel(naam, regels) {
  const r = (await H('/rekening/open', { kanaal: 'tafel', tafel: naam, gasten: regels.length })).body.rekening;
  const uit = [];
  for (const x of regels) uit.push((await H('/rekening/regel', Object.assign({ rekeningId: r.id }, x))).body.regel);
  return { id: r.id, regels: uit };
}

test('de keuken ziet niets van een gang die de zaal nog niet heeft vrijgegeven', async () => {
  const t = await tafel('Tafel 24', [
    { naam: 'Tournedos', prijs: 34.5, aantal: 2, gang: 2, station: 'grill', allergie: 'noten' },
    { naam: 'Oesters', prijs: 18, gang: 1, station: 'koud' }
  ]);
  let bord = (await H('/keuken/bord', {})).body;
  assert.equal(bord.aantal, 0, 'niets vrijgegeven, dus niets op het bord');

  await H('/gang/vrij', { rekeningId: t.id, gang: 1 });
  bord = (await H('/keuken/bord', {})).body;
  assert.equal(bord.aantal, 1);
  assert.equal(bord.bonnen[0].naam, 'Oesters');
  assert.equal(bord.bonnen[0].station, 'koud');

  // per station gefilterd
  await H('/gang/vrij', { rekeningId: t.id, gang: 2, serveerOm: '19:42' });
  const grill = (await H('/keuken/bord', { station: 'grill' })).body;
  assert.equal(grill.aantal, 1);
  assert.equal(grill.bonnen[0].naam, 'Tournedos');
  assert.equal(grill.bonnen[0].serveerOm, '19:42');
  assert.equal(grill.bonnen[0].allergie, 'noten', 'de allergie staat op de bon');
});

test('tijd is een feit: elke bon draagt zijn looptijd naast zijn norm', async () => {
  await H('/keuken/tijden', { tijden: { 'trage stoof': 45 }, kokken: 2 });
  const t = await tafel('Tafel 30', [{ naam: 'Trage stoof', prijs: 26, gang: 1, station: 'warm' }]);
  await H('/gang/vrij', { rekeningId: t.id, gang: 1 });
  const bord = (await H('/keuken/bord', { station: 'warm' })).body;
  const bon = bord.bonnen.find(b => b.naam === 'Trage stoof');
  assert.equal(bon.norm, 45, 'de ingestelde bereidingstijd wint van de standaard');
  assert.equal(bon.loopt, 0);
  assert.equal(bon.over, 0);
  assert.equal(bon.urgentie, 'op tijd');
  assert.equal(bord.teLaat, 0);
});

test('een stand gaat vooruit zonder uitleg, terug alleen met een reden', async () => {
  const t = await tafel('Tafel 31', [{ naam: 'Zeebaars', prijs: 29, gang: 1, station: 'warm' }]);
  await H('/gang/vrij', { rekeningId: t.id, gang: 1 });
  const regelId = t.regels[0].id;

  assert.equal((await H('/keuken/stand', { rekeningId: t.id, regelId, stand: 'gaar' })).status, 400);
  const gestart = (await H('/keuken/stand', { rekeningId: t.id, regelId, stand: 'gestart' })).body;
  assert.equal(gestart.regel.stand, 'gestart');
  assert.equal((await H('/keuken/stand', { rekeningId: t.id, regelId, stand: 'klaar' })).body.regel.stand, 'klaar');

  const terug = await H('/keuken/stand', { rekeningId: t.id, regelId, stand: 'gestart' });
  assert.equal(terug.status, 400);
  assert.match(terug.body.error, /noteer waarom/);
  const metReden = (await H('/keuken/stand', { rekeningId: t.id, regelId, stand: 'gestart', reden: 'bord gevallen' })).body;
  assert.equal(metReden.regel.stand, 'gestart');

  // de correctie blijft op de regel staan
  const rek = (await H('/rekening', { rekeningId: t.id })).body.rekening;
  assert.equal(rek.regels[0].correcties.length, 1);
  assert.match(rek.regels[0].correcties[0].reden, /bord gevallen/);
});

test('het regiescherm: een gang is pas gereed als alles klaar is, met de allergie erbij', async () => {
  const t = await tafel('Tafel 32', [
    { naam: 'Steak', prijs: 30, gang: 2, station: 'grill', allergie: 'gluten' },
    { naam: 'Risotto', prijs: 22, gang: 2, station: 'warm' }
  ]);
  await H('/gang/vrij', { rekeningId: t.id, gang: 2, serveerOm: '20:10' });

  let regie = (await H('/keuken/regie', {})).body;
  let rij = regie.tafels.find(x => x.tafel === 'Tafel 32');
  assert.equal(rij.totaal, 2);
  assert.equal(rij.klaar, 0);
  assert.equal(rij.gereed, false);
  assert.deepEqual(rij.allergieen, ['gluten'], 'de allergie staat ook op het regiescherm');

  await H('/keuken/stand', { rekeningId: t.id, regelId: t.regels[0].id, stand: 'klaar' });
  regie = (await H('/keuken/regie', {})).body;
  rij = regie.tafels.find(x => x.tafel === 'Tafel 32');
  assert.equal(rij.klaar, 1);
  assert.equal(rij.gereed, false, 'een gang gaat pas de deur uit als alles klaar is');
  assert.equal(typeof rij.staatKoud, 'number', 'en er staat bij hoe lang het eerste bord al wacht');

  await H('/keuken/stand', { rekeningId: t.id, regelId: t.regels[1].id, stand: 'klaar' });
  regie = (await H('/keuken/regie', {})).body;
  rij = regie.tafels.find(x => x.tafel === 'Tafel 32');
  assert.equal(rij.gereed, true);
  assert.equal(rij.staatKoud, 0, 'als alles klaar is, staat er niets meer koud');

  // uitgegeven verdwijnt van beide schermen
  for (const r of t.regels) await H('/keuken/stand', { rekeningId: t.id, regelId: r.id, stand: 'uitgegeven' });
  regie = (await H('/keuken/regie', {})).body;
  assert.ok(!regie.tafels.some(x => x.tafel === 'Tafel 32'), 'uitgegeven is van het bord');
});

test('de drukterem waarschuwt met zijn rekensom en zet zelf niets dicht', async () => {
  const rustig = (await H('/keuken/druk', { kokken: 8 })).body;
  assert.equal(rustig.waarschuwing, null);
  assert.match(rustig.let, /Het systeem zet zelf niets dicht/);

  // een stapel werk erin, met een kok
  const t = await tafel('Tafel 40', Array.from({ length: 6 }, (_, i) => ({
    naam: 'Stoofpot ' + i, prijs: 24, gang: 1, station: 'warm', aantal: 2 })));
  await H('/gang/vrij', { rekeningId: t.id, gang: 1 });
  const druk = (await H('/keuken/druk', { kokken: 1 })).body;
  assert.ok(druk.openMinuten >= 6 * 2 * 12, 'alle openstaande bereidingsminuten tellen mee');
  assert.equal(druk.verwachteWachttijd, Math.round(druk.openMinuten / 1));
  assert.match(druk.waarschuwing, /minuten wachttijd/);
  assert.match(druk.waarschuwing, /gedeeld door 1 kok/);

  // en met acht koks is dezelfde stapel geen probleem meer
  const met8 = (await H('/keuken/druk', { kokken: 8 })).body;
  assert.equal(met8.verwachteWachttijd, Math.round(druk.openMinuten / 8));
});
