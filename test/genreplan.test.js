/* Genrepols 2: het draaiboek van vandaag en de week vooruit voor de acht
   dunnere genres. Bewaakt dat /api/supplier/puls/plan een geprioriteerd,
   afvinkbaar draaiboek uit de eigen genre-motor haalt (met "dit eerst"-
   advies), dat vinkjes per dag bewaard en omkeerbaar zijn, dat
   /api/supplier/puls/blik zeven dagen vooruitkijkt op echte agenda-data,
   en dat genres met een eigen plus-laag niets krijgen.
   Draai los: node --experimental-sqlite --test test/genreplan.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, haven, opvang, golf, resto;
let gewired = true; // deel 1: de routes worden in de wiring-commit aangesloten
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-plan-'));

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
  haven = await supLogin('PORTELL');
  opvang = await supLogin('NIDO');
  golf = await supLogin('SAROCA');
  resto = await supLogin('KIKUNOI');
  assert.ok(haven && opvang && golf && resto, 'de vier zaken zijn binnen');
  // bewust NIET voorseeden via de genre-routes: het draaiboek en het
  // weekblik wekken de genre-motor zelf, en dat bewijzen deze tests
  gewired = (await api('supplier/puls/plan', {}, haven)).status !== 404;
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. het marina-draaiboek: vertrek als NU-taak, service en concierge als dagtaken', async t => {
  if (!gewired) return t.skip('wiring volgt');
  const r = await api('supplier/puls/plan', {}, haven);
  assert.equal(r.status, 200);
  const plan = r.body.plan;
  assert.ok(plan && plan.taken.length >= 3, 'er staat een draaiboek');
  const uit = plan.taken.find(t => t.id.indexOf('uit-') === 0);
  assert.ok(uit && uit.prio === 1 && uit.tekst.indexOf('Petit Nord') >= 0, 'de vertrekdag is de NU-taak');
  assert.ok(plan.taken.some(t => t.id.indexOf('srv-') === 0 && t.prio === 2), 'de open servicekaart staat als dagtaak');
  assert.ok(plan.taken.some(t => t.id.indexOf('con-') === 0 && t.tekst.indexOf('mens bevestigt') >= 0), 'concierge blijft een mensen-bevestiging');
  assert.equal(plan.taken[0].prio, 1, 'gesorteerd op prioriteit');
  assert.ok(plan.advies.indexOf('Begin hier:') === 0, 'het advies wijst de eerste open taak aan');
});

test('2. afvinken: het vinkje blijft staan, het advies schuift door, en het is omkeerbaar', async t => {
  if (!gewired) return t.skip('wiring volgt');
  const voor = (await api('supplier/puls/plan', {}, haven)).body.plan;
  const eerste = voor.taken[0];
  const vink = await api('supplier/puls/plan/klaar', { taakId: eerste.id }, haven);
  assert.equal(vink.body.klaar, true);
  const na = (await api('supplier/puls/plan', {}, haven)).body.plan;
  assert.equal(na.taken.find(t => t.id === eerste.id).klaar, true, 'het vinkje is bewaard');
  assert.equal(na.open, voor.open - 1);
  assert.ok(na.advies.indexOf(eerste.tekst) < 0, 'het advies wijst nu een andere taak aan');
  const terug = await api('supplier/puls/plan/klaar', { taakId: eerste.id }, haven);
  assert.equal(terug.body.klaar, false, 'terugvinken kan altijd');
  assert.equal((await api('supplier/puls/plan/klaar', {}, haven)).status, 400, 'zonder taakId geen vinkje');
});

test('3. de opvang plant slim: nanny-aanvraag wordt een taak en telt mee in de week', async t => {
  if (!gewired) return t.skip('wiring volgt');
  const d = new Date().toISOString().slice(0, 10);
  const vraag = await api('supplier/opvang/nanny', { gezin: 'Fam. Leeuwenberg', datum: d, van: '09:00', tot: '12:00', wens: 'Twee kinderen thuis.' }, opvang);
  assert.equal(vraag.status, 200);
  const plan = (await api('supplier/puls/plan', {}, opvang)).body.plan;
  const nb = plan.taken.find(t => t.id.indexOf('nb-') === 0);
  assert.ok(nb && nb.tekst.indexOf('Leeuwenberg') >= 0 && nb.tekst.indexOf('gescreende nanny') >= 0, 'de aanvraag staat als taak met de screeningsregel');
  assert.ok(plan.taken.some(t => t.id === 'verslag' && t.prio === 3), 'de dagverslagen staan als weektaak klaar');
  const blik = (await api('supplier/puls/blik', {}, opvang)).body.blik;
  assert.ok(blik.dagen.length === 8 && blik.dagen[0].items.join(' ').indexOf('Leeuwenberg') >= 0, 'de nanny-boeking staat in de week vooruit');
});

test('4. de golfclub kijkt vooruit: de wedstrijd staat in draaiboek en weekblik', async t => {
  if (!gewired) return t.skip('wiring volgt');
  const plan = (await api('supplier/puls/plan', {}, golf)).body.plan;
  assert.ok(plan.taken.some(t => t.id.indexOf('wed-') === 0 && t.tekst.indexOf('Maandbeker') >= 0), 'de Maandbeker staat als voorbereidingstaak');
  const blik = (await api('supplier/puls/blik', {}, golf)).body.blik;
  const met = blik.dagen.find(x => x.items.some(s => s.indexOf('Maandbeker') >= 0));
  assert.ok(met, 'de wedstrijddag is zichtbaar in de week vooruit');
});

test('5. een genre met een eigen plus-laag krijgt geen draaiboek of weekblik', async t => {
  if (!gewired) return t.skip('wiring volgt');
  assert.equal((await api('supplier/puls/plan', {}, resto)).body.plan, null);
  assert.equal((await api('supplier/puls/blik', {}, resto)).body.blik, null);
});

test('6. zonder inlog blijven draaiboek en weekblik dicht', async t => {
  if (!gewired) return t.skip('wiring volgt');
  assert.equal((await api('supplier/puls/plan', {})).status, 401);
  assert.equal((await api('supplier/puls/blik', {})).status, 401);
});

test('7. De Ibiza Bode heeft een redactie: ook de laatste demo-zaak kan inloggen', async t => {
  if (!gewired) return t.skip('wiring volgt');
  const roster = await api('supplier/roster', { code: 'BODE' });
  const mgr = (roster.body.staff || []).find(x => x.role === 'manager');
  assert.ok(mgr, 'de hoofdredactie staat op het rooster');
  const tk = (await api('supplier/login', { code: 'BODE', staffId: mgr.id, pin: '1234' })).body.token;
  assert.ok(tk, 'de hoofdredacteur kan inloggen');
  assert.equal((await api('supplier/dorp', {}, tk)).status, 200, 'en heeft het vangnet-bedrijfsdorp');
});
