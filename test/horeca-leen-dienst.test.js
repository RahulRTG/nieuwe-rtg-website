/* RTG Horeca: EEN LEEN EN HET EINDE VAN DE DIENST.

   HORECA.md, "Wat de vloer nog niet kan": een leen kende geen einde van de
   dienst. Wie een tafel leende en naar huis ging zonder hem terug te geven,
   liet hem op zijn naam staan -- zichtbaar, maar niemand werd eraan herinnerd.

   De oplossing is met opzet GEEN automatische teruggave. Een leen eindigt
   doordat iemand hem teruggeeft (kern/horeca/wijk-leen.js), want een tafel die
   stil terugspringt naar iemand die er niet op rekent, is dezelfde fout als een
   tafel die tussen twee mensen door valt. Wat er wel bij komt, en wat hier
   bewezen wordt:

   1. Uitklokken geeft NIETS terug: de tafel blijft op zijn naam.
   2. De PDA van de drager zegt welke tafels hij van een collega draagt, met
      de weg om ze terug te geven.
   3. Wie zijn wijk loslaat terwijl hij nog geleende tafels draagt, krijgt dat
      te horen -- en wie niets draagt, niet.

   Wat hier NIET staat: of de Vloer ziet dat de drager al is uitgeklokt. Dat
   leest de prikklok, en die ligt in een ander domein; de koppeling kost een
   normbesluit (zie HORECA.md) en ligt klaar op een eigen tak.

   Draai: node --test test/horeca-leen-dienst.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tokM, tokA, tokB, naamA, naamB, idB;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leendienst-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const M = (pad, body) => api(pad, body, tokM);
const A = (pad, body) => api(pad, body, tokA);
const B = (pad, body) => api(pad, body, tokB);
const wijken = async (fn) => (await fn('/api/supplier/horeca/wijken', {})).body;
const wijkMet = async (fn, naam) => (await wijken(fn)).wijken.find((w) => w.naam === naam);
const lijst = async (fn) => (await fn('/api/supplier/horeca/werklijst', { modus: 'alles' })).body;

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '', RTG_DEMO: '1' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  const vloer = roster.staff.find(x => x.id !== mgr.id);
  naamA = vloer.name;
  tokM = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  tokA = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: vloer.id, pin: '5678' })).body.token;
  const nieuw = (await api('/api/supplier/staff/add', { name: 'Bram' }, tokM)).body;
  assert.ok(nieuw.staff && nieuw.pin, 'er komt een derde bij: ' + JSON.stringify(nieuw));
  tokB = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: nieuw.staff.id, pin: nieuw.pin })).body.token;
  naamB = nieuw.staff.name; idB = String(nieuw.staff.id);
  assert.ok(tokM && tokA && tokB, 'drie inlogs');

  // Ayla draagt Zaal en leent Z1 uit aan Bram
  const z = (await M('/api/supplier/horeca/wijk/zet', { naam: 'Zaal', tafels: ['Z1', 'Z2', 'Z3'] })).body.wijk;
  await A('/api/supplier/horeca/wijk/neem', { wijkId: z.id });
  const bod = await A('/api/supplier/horeca/wijk/bied', { wijkId: z.id, naarId: idB, naarNaam: naamB, tafels: ['Z1'] });
  assert.equal(bod.status, 200, JSON.stringify(bod.body));
  assert.equal((await B('/api/supplier/horeca/wijk/aanvaard', { overdrachtId: bod.body.overdracht.id })).status, 200);
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. uitklokken geeft niets terug: de tafel blijft op zijn naam', async () => {
  const inn = await B('/api/staff/clock', {});
  assert.equal(inn.status, 200, JSON.stringify(inn.body));
  assert.equal(inn.body.actie, 'in');
  const uit = await B('/api/staff/clock', {});
  assert.equal(uit.body.actie, 'uit');
  const d = await wijken(A);
  assert.equal(d.leningen.length, 1, 'uitklokken geeft niets vanzelf terug');
  assert.equal(d.leningen[0].naam, naamB, 'de tafel staat nog op naam van wie hem leende');
});

test('2. de PDA van de drager draagt de geleende tafel als vaste regel', async () => {
  const vanB = await lijst(B);
  assert.deepEqual(vanB.geleend.map((l) => l.tafel), ['Z1']);
  assert.equal(vanB.geleend[0].vanNaam, naamA, 'met van wie hij komt');
  assert.deepEqual((await lijst(A)).geleend, [], 'de uitlener draagt hem niet');
});

test('3. loslaten met een geleende tafel in de hand zegt het; zonder niet', async () => {
  const eigen = (await M('/api/supplier/horeca/wijk/zet', { naam: 'Bar', tafels: ['B1'] })).body.wijk;
  await B('/api/supplier/horeca/wijk/neem', { wijkId: eigen.id });
  const laat = await B('/api/supplier/horeca/wijk/laat', { wijkId: eigen.id });
  assert.equal(laat.status, 200, JSON.stringify(laat.body));
  assert.deepEqual(laat.body.nogGeleend.map((l) => l.tafel), ['Z1']);
  assert.match(laat.body.herinnering, /Z1/);
  assert.match(laat.body.herinnering, new RegExp(naamA), 'met de naam van wie hem uitleende');
  assert.equal((await wijken(M)).leningen.length, 1, 'loslaten gaat over de wijk, niet over de leen');

  await A('/api/supplier/horeca/wijk/neem', { wijkId: eigen.id });
  const zonder = await A('/api/supplier/horeca/wijk/laat', { wijkId: eigen.id });
  assert.equal(zonder.status, 200);
  assert.equal(zonder.body.herinnering, undefined, 'wie niets van een collega draagt, krijgt geen herinnering');
});

test('4. teruggeven sluit alles: geen leen, geen teller, geen regel op de PDA', async () => {
  const terug = await A('/api/supplier/horeca/wijk/tafel-terug', { tafel: 'Z1' });
  assert.equal(terug.status, 200, JSON.stringify(terug.body));
  const d = await wijken(M);
  assert.equal(d.leningen.length, 0);
  assert.deepEqual((await lijst(B)).geleend, []);
});
