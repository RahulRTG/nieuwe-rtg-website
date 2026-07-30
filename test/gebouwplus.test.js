/* RTG Enterprise (gebouwplus): de plus-laag van het kantoorgebouw.
   Getoetst: de manager van de demo-toren legt een huurcontract vast,
   verlengt en beeindigt het; leads schuiven door de fasen; energie-weken
   worden geklemd en de signalenlijst ziet een aflopend contract.
   Draai los: node --experimental-sqlite --test test/gebouwplus.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, sup;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geb-'));
const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();
const overDagen = d => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await json(await raw('/supplier/roster', { code: 'MERIDIAAN' }))).staff;
  const mgr = roster.find(x => x.role === 'manager');
  sup = (await json(await raw('/supplier/login', { code: 'MERIDIAAN', staffId: mgr.id, pin: '1234' }))).token;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. huurcontracten: vastleggen, aflopend contract geeft een signaal, verlengen en beeindigen', async () => {
  let r = await json(await raw('/supplier/gebouwplus/contract', { huurder: 'Vermeer Advocaten', maandhuur: 18500, start: overDagen(-300) }, sup));
  assert.ok(r.error, 'zonder einddatum geen contract');
  r = await json(await raw('/supplier/gebouwplus/contract', { huurder: 'Vermeer Advocaten', verdiepingen: '4+5', maandhuur: 18500, start: overDagen(-300), eind: overDagen(45) }, sup));
  assert.equal(r.ok, true);
  const cid = r.contract.id;
  // het contract loopt binnen 90 dagen af: dat hoort een signaal te zijn
  let o = await json(await raw('/supplier/gebouwplus/overzicht', {}, sup));
  assert.ok(o.signalen.some(s => s.soort === 'contract' && s.tekst.indexOf('Vermeer') >= 0), 'aflopend contract staat in de signalen');
  r = await json(await raw('/supplier/gebouwplus/contract/zet', { id: cid, actie: 'verleng', eind: overDagen(400) }, sup));
  assert.equal(r.contract.eind, overDagen(400));
  o = await json(await raw('/supplier/gebouwplus/overzicht', {}, sup));
  assert.ok(!o.signalen.some(s => s.soort === 'contract'), 'na verlenging is het signaal weg');
  r = await json(await raw('/supplier/gebouwplus/contract/zet', { id: cid, actie: 'beeindig' }, sup));
  assert.equal(r.contract.status, 'beeindigd');
});

test('2. leads schuiven door de fasen; onzin-fasen blijven buiten', async () => {
  let r = await json(await raw('/supplier/gebouwplus/lead', { naam: 'Atelier Fonteyn', wens: '600 m2, hoog, per september' }, sup));
  assert.equal(r.ok, true);
  const lid = r.lead.id;
  r = await json(await raw('/supplier/gebouwplus/lead/fase', { id: lid, fase: 'rondleiding' }, sup));
  assert.equal(r.lead.fase, 'rondleiding');
  r = await json(await raw('/supplier/gebouwplus/lead/fase', { id: lid, fase: 'tekenen-met-goud' }, sup));
  assert.ok(r.error, 'een verzonnen fase wordt geweigerd');
});

test('3. energie: weekvorm geklemd, dubbele week overschrijft, uitschieter geeft een signaal', async () => {
  let r = await json(await raw('/supplier/gebouwplus/energie', { week: 'ooit', stroomKwh: 100, waterM3: 5 }, sup));
  assert.ok(r.error, 'een rare weekvorm wordt geweigerd');
  for (let i = 1; i <= 3; i++) {
    r = await json(await raw('/supplier/gebouwplus/energie', { week: '2026-W2' + i, stroomKwh: 1000, waterM3: 40 }, sup));
    assert.equal(r.ok, true);
  }
  r = await json(await raw('/supplier/gebouwplus/energie', { week: '2026-W24', stroomKwh: 2000, waterM3: 40 }, sup));
  assert.equal(r.ok, true);
  const o = await json(await raw('/supplier/gebouwplus/overzicht', {}, sup));
  assert.ok(o.signalen.some(s => s.soort === 'energie'), 'de uitschieter van W24 staat in de signalen');
  // dezelfde week nogmaals: overschrijft, geen tweede regel
  r = await json(await raw('/supplier/gebouwplus/energie', { week: '2026-W24', stroomKwh: 1100, waterM3: 41 }, sup));
  assert.equal(r.energie.filter(x => x.week === '2026-W24').length, 1);
});

test('4. het hele pand: keuringsbewaking, mailroom en de BHV-klok', async () => {
  // een keuring die volgende maand verloopt: dat hoort een signaal te zijn
  let r = await json(await raw('/supplier/gebouwpand/installatie', { soort: 'lift', naam: 'Lift A', keuringTot: overDagen(20) }, sup));
  assert.equal(r.ok, true);
  const iid = r.installatie.id;
  let o = await json(await raw('/supplier/gebouwpand/overzicht', {}, sup));
  assert.ok(o.signalen.some(s => s.soort === 'keuring' && s.tekst.indexOf('Lift A') >= 0), 'aflopende keuring staat in de signalen');
  assert.ok(o.signalen.some(s => s.soort === 'bhv'), 'zonder oefening dringt de BHV-klok aan');
  r = await json(await raw('/supplier/gebouwpand/installatie/keuring', { id: iid, keuringTot: overDagen(400) }, sup));
  assert.equal(r.installatie.keuringTot, overDagen(400));
  // mailroom: aannemen en ophalen
  r = await json(await raw('/supplier/gebouwpand/post', { voorWie: 'Vermeer Advocaten', omschrijving: 'aangetekend' }, sup));
  assert.equal(r.post.status, 'aangekomen');
  r = await json(await raw('/supplier/gebouwpand/post/opgehaald', { id: r.post.id }, sup));
  assert.equal(r.post.status, 'opgehaald');
  // parkeren: toewijzen en weer vrijgeven overschrijft dezelfde plek
  r = await json(await raw('/supplier/gebouwpand/parkeer', { plek: 'P1-04', huurder: 'Vermeer Advocaten' }, sup));
  assert.ok(r.parkeer.some(x => x.plek === 'P1-04' && x.huurder === 'Vermeer Advocaten'));
  r = await json(await raw('/supplier/gebouwpand/parkeer', { plek: 'P1-04', huurder: '' }, sup));
  assert.equal(r.parkeer.filter(x => x.plek === 'P1-04').length, 1, 'zelfde plek blijft een regel');
  // BHV-oefening vastgelegd: het signaal verdwijnt
  r = await json(await raw('/supplier/gebouwpand/bhv', { opkomst: 84, verbeterpunten: 'Trap B ontruimde traag' }, sup));
  assert.equal(r.oefening.opkomst, 84);
  o = await json(await raw('/supplier/gebouwpand/overzicht', {}, sup));
  assert.ok(!o.signalen.some(s => s.soort === 'bhv'), 'na de oefening zwijgt de BHV-klok');
});
