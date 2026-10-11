/* RTG Horeca: EEN LEEN EN HET EINDE VAN DE DIENST.

   HORECA.md, "Wat de vloer nog niet kan": een leen kende geen einde van de
   dienst. Wie een tafel leende en naar huis ging zonder hem terug te geven,
   liet hem op zijn naam staan -- zichtbaar, maar niemand werd eraan herinnerd.

   De oplossing is met opzet GEEN automatische teruggave. Een leen eindigt
   doordat iemand hem teruggeeft (kern/horeca/wijk-leen.js), want een tafel die
   stil terugspringt naar iemand die er niet op rekent, is dezelfde fout als een
   tafel die tussen twee mensen door valt. Wat er wel bij komt, en wat hier
   bewezen wordt:

   1. De Vloer ziet of de drager er nog is, uit het klokboek dat de zaak al
      heeft -- in DRIE standen, want "niemand klokte" is geen "hij is weg".
   2. Uitklokken geeft NIETS terug: de tafel blijft op zijn naam.
   3. De PDA van de drager zegt welke tafels hij van een collega draagt, met
      de weg om ze terug te geven.
   4. Wie zijn wijk loslaat terwijl hij nog geleende tafels draagt, krijgt dat
      te horen -- en wie niets draagt, niet.

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

test('1. zonder klokregel is de drager niet-gemeten, en nooit "weg"', async () => {
  const d = await wijken(M);
  assert.equal(d.leningen.length, 1);
  assert.equal(d.leningen[0].drager.stand, 'niet-gemeten',
    'een zaak die (nog) niet klokt mag geen vloer vol verlaten tafels krijgen');
  assert.match(d.leningen[0].drager.reden, /klokboek|weet het systeem niet/);
  assert.equal(d.dragerWeg, 0);
});

test('2. ingeklokt, dan uitgeklokt -- en de tafel blijft op zijn naam', async () => {
  const inn = await B('/api/staff/clock', {});
  assert.equal(inn.status, 200, JSON.stringify(inn.body));
  assert.equal(inn.body.actie, 'in');
  assert.equal((await wijken(M)).leningen[0].drager.stand, 'ingeklokt');

  const uit = await B('/api/staff/clock', {});
  assert.equal(uit.body.actie, 'uit');
  const d = await wijken(A);
  assert.equal(d.leningen.length, 1, 'uitklokken geeft niets vanzelf terug');
  assert.equal(d.leningen[0].naam, naamB, 'de tafel staat nog op naam van wie hem leende');
  assert.equal(d.leningen[0].drager.stand, 'uitgeklokt');
  assert.ok(Date.parse(d.leningen[0].drager.om), 'met het tijdstip erbij');
  assert.equal(d.dragerWeg, 1, 'en de vloer telt het als tafel, niet als mens');
  /* Besluit 1A: de Vloer krijgt de STAND, nooit wat klokVan teruggeeft -- geen
     uren van een collega, geen klokregels (test/horeca-klokgrens.test.js). */
  for (const l of d.leningen) {
    assert.deepEqual(Object.keys(l.drager).filter((k) => !['stand', 'om', 'reden'].includes(k)), []);
    // en de leen zelf draagt niets bij dat erbij is gekomen (geen klokantwoord ernaast)
    assert.deepEqual(Object.keys(l).filter((k) => !['tafel', 'staffId', 'naam', 'at', 'vanId', 'vanNaam',
      'wijkId', 'wijkNaam', 'staat', 'drager', 'vanMij', 'naarMij'].includes(k)), []);
  }

  // weer inklokken haalt de waarschuwing weg
  await B('/api/staff/clock', {});
  assert.equal((await wijken(M)).leningen[0].drager.stand, 'ingeklokt');
  await B('/api/staff/clock', {});
});

test('3. de PDA van de drager draagt de geleende tafel als vaste regel', async () => {
  const vanB = await lijst(B);
  assert.deepEqual(vanB.geleend.map((l) => l.tafel), ['Z1']);
  assert.equal(vanB.geleend[0].vanNaam, naamA, 'met van wie hij komt');
  assert.deepEqual((await lijst(A)).geleend, [], 'de uitlener draagt hem niet');
});

test('4. loslaten met een geleende tafel in de hand zegt het; zonder niet', async () => {
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

test('5. teruggeven sluit alles: geen leen, geen teller, geen regel op de PDA', async () => {
  const terug = await A('/api/supplier/horeca/wijk/tafel-terug', { tafel: 'Z1' });
  assert.equal(terug.status, 200, JSON.stringify(terug.body));
  const d = await wijken(M);
  assert.equal(d.leningen.length, 0);
  assert.equal(d.dragerWeg, 0);
  assert.deepEqual((await lijst(B)).geleend, []);
});

test('6. de drager wordt uit de prikklok gelezen: wie uitklokte VOOR de leen is niet-gemeten', () => {
  const leen = require('../server/kern/horeca/wijk-leen')({ horeca: { nu: () => new Date().toISOString() }, schoon: (t) => String(t) });
  /* De echte klokVan uit kern/personeel.js, op een nagemaakt klokboek: de
     afleiding gaat door dezelfde functie als op de server. */
  const boek = [];
  const { klokVan } = require('../server/kern/personeel').maakPersoneel({ db: { data: { klok: { Z: boek }, trustLine: [] } }, accounts: {}, afwezigOp: () => null });
  const kv = (id) => klokVan('Z', id);
  const l = { staffId: '7', naam: 'Bram', at: '2026-10-11T20:00:00.000Z' };
  const zet = (...r) => { boek.length = 0; boek.push(...r); };

  assert.equal(leen.drager(l, null).stand, 'niet-gemeten');
  zet({ staffId: 7, in: '2026-10-11T17:00:00.000Z', out: '2026-10-11T19:00:00.000Z' });
  assert.equal(leen.drager(l, kv(l.staffId)).stand, 'niet-gemeten',
    'een dienst die eindigde voordat hij de tafel kreeg, zegt niets over nu');
  zet({ staffId: 7, in: '2026-10-11T17:00:00.000Z', out: '2026-10-11T23:00:00.000Z' });
  assert.equal(leen.drager(l, kv(l.staffId)).stand, 'uitgeklokt');
  assert.equal(leen.drager(l, kv(l.staffId)).om, '2026-10-11T23:00:00.000Z');
  zet({ staffId: 8, in: '2026-10-11T17:00:00.000Z', out: '2026-10-11T23:00:00.000Z' });
  assert.equal(leen.drager(l, kv(l.staffId)).stand, 'niet-gemeten', 'de klokregel van een ander telt niet');
  zet({ staffId: 7, in: '2026-10-11T23:30:00.000Z', out: null },
    { staffId: 7, in: '2026-10-11T17:00:00.000Z', out: '2026-10-11T23:00:00.000Z' });
  assert.equal(leen.drager(l, kv(l.staffId)).stand, 'ingeklokt');
  // het gewone geval: hij werkte al toen hij de tafel kreeg
  zet({ staffId: '7', in: '2026-10-11T18:00:00.000Z', out: null });
  assert.equal(leen.drager(l, kv(l.staffId)).stand, 'ingeklokt');
  // een leen zonder leesbaar tijdstip zegt niet dat een oude uitklok "erna" kwam
  zet({ staffId: 7, in: '2026-10-10T17:00:00.000Z', out: '2026-10-10T23:00:00.000Z' });
  assert.equal(leen.drager({ staffId: '7', naam: 'Bram' }, kv('7')).stand, 'niet-gemeten');
});
