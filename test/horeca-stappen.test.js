/* RTG Horeca: BEREIDINGSSTAPPEN -- een gerecht is zelden één handeling.

   De keten in HORECA.md loopt bestelling -> gang -> gerecht ->
   BEREIDINGSSTAPPEN -> station, en die ene schakel was er niet. Een regel droeg
   één station en één norm, dus rekende de cadans één startmoment terug. Voor een
   tournedos die drie minuten koud gemarineerd wordt, acht minuten grilt en drie
   minuten saus krijgt, is dat één moment voor drie plekken -- en dan begint de
   grill te vroeg of de sauzier te laat.

   Wat hier vastligt:

   1. DE NORM IS DE SOM VAN DE STAPPEN, en er staat geen tweede getal naast. Een
      eigen bereidingstijd naast stappen zou uiteenlopen zodra iemand er één
      aanpast.
   2. GEEN STAPPEN VERANDERT NIETS. Verreweg de meeste gerechten zijn één
      handeling; wie niets invult houdt exact het oude gedrag.
   3. DE STAPPEN LOPEN NA ELKAAR EN NIET PARALLEL. Aannemen dat twee stappen
      tegelijk gaan, maakt de belofte aan de gast korter dan hij is.
   4. ELKE STAP DRAAGT ZIJN EIGEN STARTMOMENT, teruggerekend vanaf de pas. De
      eerste stap begint precies waar het gerecht zonder stappen ook zou zijn
      begonnen -- de som is immers de norm.
   5. WISSEN IS TERUGVALLEN EN GEEN NUL. "Geen stappen" mag nooit "nul minuten"
      betekenen.
   6. EEN HALVE STAP IS GEEN STAP. Zonder station of zonder minuten valt hij weg
      in plaats van als nul mee te tellen.

   Draai: node --experimental-sqlite --test test/horeca-stappen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tokM, tokV;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stappen-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const M = (pad, body) => api('/api/supplier/horeca' + pad, body, tokM);
const V = (pad, body) => api('/api/supplier/horeca' + pad, body, tokV);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  const ander = roster.staff.find(x => x.id !== mgr.id);
  tokM = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  tokV = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: ander.id, pin: '5678' })).body.token;
  assert.ok(tokM && tokV, 'manager en vloer zijn ingelogd');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* Een tafel met één gerecht, vrijgegeven, zodat de cadans hem ziet. */
async function opTafel(tafel, naam, station) {
  const r = (await M('/rekening/open', { kanaal: 'tafel', tafel, gasten: 1 })).body.rekening;
  await M('/rekening/regel', { rekeningId: r.id, naam, prijs: 30, aantal: 1, gang: 1, station });
  await M('/gang/vrij', { rekeningId: r.id, gang: 1 });
  return r.id;
}
const bord = async () => (await M('/keuken/bord', {})).body;
const opBord = async (naam) => (await bord()).bonnen.find(x => x.naam === naam);

test('1. de som van de stappen is de bereidingstijd', async () => {
  await opTafel('S1', 'Tournedos', 'warm');
  const zonder = (await M('/keuken/druk', {})).body;
  assert.ok(zonder.openMinuten >= 12, 'zonder stappen geldt de standaard van het station (14 voor warm)');

  const gezet = await M('/keuken/stappen', { naam: 'Tournedos', stappen: [
    { station: 'koud', minuten: 3, wat: 'marineren' },
    { station: 'grill', minuten: 8, wat: 'grillen' },
    { station: 'warm', minuten: 3, wat: 'saus afwerken' }
  ] });
  assert.equal(gezet.status, 200);
  assert.equal(gezet.body.minuten, 14, '3 + 8 + 3');
  assert.equal(gezet.body.stappen.length, 3);

  const met = (await M('/keuken/druk', {})).body;
  assert.equal(met.openMinuten, 14, 'de drukterem rekent met de som en niet met de stationstandaard');
});

test('2. een eigen bereidingstijd verliest van de stappen, en staat er niet naast', async () => {
  await M('/keuken/tijden', { tijden: { tournedos: 40 } });
  const met = (await M('/keuken/druk', {})).body;
  assert.equal(met.openMinuten, 14, 'de stappen winnen; er is maar een getal');

  await M('/keuken/stappen', { naam: 'Tournedos', stappen: [] });
  const na = (await M('/keuken/druk', {})).body;
  assert.equal(na.openMinuten, 40, 'na wissen valt hij terug op de eigen tijd van de zaak');

  await M('/keuken/tijden', { tijden: {} });
});

test('3. elke stap draagt zijn eigen startmoment, na elkaar', async () => {
  await M('/keuken/stappen', { naam: 'Tournedos', stappen: [
    { station: 'koud', minuten: 3, wat: 'marineren' },
    { station: 'grill', minuten: 8, wat: 'grillen' },
    { station: 'warm', minuten: 3, wat: 'saus afwerken' }
  ] });
  const rij = await opBord('Tournedos');
  assert.ok(rij, 'het gerecht staat op het keukenbord');
  assert.ok(Array.isArray(rij.stappen), 'met zijn stappen erbij');
  assert.equal(rij.stappen.length, 3);
  assert.deepEqual(rij.stations, ['koud', 'grill', 'warm'], 'en de stations in volgorde');

  const t = rij.stappen.map(s => Date.parse(s.startOm));
  assert.ok(t[1] > t[0] && t[2] > t[1], 'de stappen lopen na elkaar en niet tegelijk');
  assert.equal((t[1] - t[0]) / 60000, 3, 'de tweede begint precies na de eerste');
  assert.equal((t[2] - t[1]) / 60000, 8, 'en de derde na de tweede');
  assert.equal(Date.parse(rij.startOm), t[0],
    'het startmoment van de regel is dat van de eerste stap; de som is de norm');
  assert.equal(Date.parse(rij.stappen[2].klaarOm) - Date.parse(rij.startOm), 14 * 60000,
    'en het einde van de laatste stap is precies de norm later');
});

test('4. een gerecht zonder stappen verandert niet', async () => {
  await opTafel('S4', 'Gazpacho', 'koud');
  const rij = await opBord('Gazpacho');
  assert.ok(rij, 'hij staat op het bord');
  assert.equal(rij.stappen, null, 'zonder stappen staat er niets');
  assert.equal(rij.stations, null);
  assert.equal(rij.norm, 6, 'en de norm is nog steeds de standaard van het koude station');
});

test('5. een halve stap valt weg in plaats van als nul mee te tellen', async () => {
  const r = await M('/keuken/stappen', { naam: 'Zeebaars', stappen: [
    { station: 'grill', minuten: 7 },
    { station: '', minuten: 5 },          // geen station
    { station: 'warm', minuten: 0 },      // geen tijd
    { station: 'warm', minuten: 4, wat: 'afwerken' }
  ] });
  assert.equal(r.body.stappen.length, 2, 'twee echte stappen');
  assert.equal(r.body.minuten, 11, '7 + 4, en geen nullen ertussen');
});

test('6. stappen vastleggen is manager-werk', async () => {
  const nee = await V('/keuken/stappen', { naam: 'Zeebaars', stappen: [{ station: 'grill', minuten: 9 }] });
  assert.ok(nee.status === 403 || nee.status === 401, 'de vloer legt geen planning vast: ' + nee.status);
  const nog = await V('/keuken/stappen', { naam: 'Zeebaars' });
  assert.equal(nog.status, 200, 'lezen mag wel: een kok hoort te zien wat er staat');
  assert.equal(nog.body.stappen.length, 2, 'en er is niets veranderd');
});
