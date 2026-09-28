/* ============================================================================
   HET ROOSTER VAN DE TEAM ROOM LEEST VERZUIM (PERSONEEL.md par. 4,
   kern/verzuimrooster.js legOp, /api/supplier/schedule).

   Wat hier vast moet blijven:
     1. wie afwezig is, staat niet meer op zijn dienst -- er staat "Afwezig";
     2. voor een collega staat er NIETS meer dan dat: geen soort, geen
        inzetbaarheid, en nergens het woord ziek;
     3. de manager ziet wat er gepland was, wat voor verzuim het is en hoeveel
        iemand nog kan, want die plant;
     4. wie vrij stond blijft vrij (een wijziging zou verraden dat er iets
        speelt), en zonder verzuimlaag zegt het rooster dat het niet is
        nagekeken.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakVerzuimRooster } = require('../server/kern/verzuimrooster');
const { startServer, stop } = require('./helper');

const VRIJ = 'Vrij';
const week = {
  shifts: ['Ochtend', 'Avond', VRIJ],
  days: [{ date: '2026-10-01', label: 'Vandaag', staff: [
    { id: 1, name: 'Amir', role: 'staff', shift: 'Ochtend' },
    { id: 2, name: 'Bo', role: 'staff', shift: VRIJ },
    { id: 3, name: 'Cas', role: 'manager', shift: 'Avond' }
  ] }]
};
const ziekVan = ids => maakVerzuimRooster((code, id) => (ids.includes(id) ? [{ wat: 'afwezig', inzetbaarheid: 'niets' }] : []));

test('1. een collega ziet "Afwezig" en verder niets', () => {
  const r = ziekVan([1]).legOp('Z', week, { manager: false }, VRIJ);
  assert.deepEqual(r.days[0].staff[0], { id: 1, name: 'Amir', role: 'staff', shift: 'Afwezig' });
  assert.equal(r.days[0].staff[2].shift, 'Avond', 'wie er is, blijft op zijn dienst');
  assert.equal(r.verzuimNagekeken, true);
  assert.equal(week.days[0].staff[0].shift, 'Ochtend', 'het geplande rooster wordt niet aangeraakt');
});

test('2. de manager ziet wat er gepland was en wat iemand nog kan', () => {
  const deels = maakVerzuimRooster((code, id) => (id === 1 ? [{ wat: 'afwezig', inzetbaarheid: 'deels' }] : []));
  const r = deels.legOp('Z', week, { manager: true }, VRIJ);
  assert.deepEqual(r.days[0].staff[0], { id: 1, name: 'Amir', role: 'staff', shift: 'Afwezig',
    gepland: 'Ochtend', afwezig: 'afwezig', inzetbaarheid: 'deels' });
});

test('3. wie vrij stond blijft vrij, en zonder verzuimlaag is er niet nagekeken', () => {
  const r = ziekVan([2]).legOp('Z', week, { manager: true }, VRIJ);
  assert.deepEqual(r.days[0].staff[1], week.days[0].staff[1], 'vrij blijft vrij, ook voor de manager');
  const blind = maakVerzuimRooster(() => null).legOp('Z', week, { manager: true }, VRIJ);
  assert.equal(blind.verzuimNagekeken, false);
  assert.deepEqual(blind.days, week.days, 'zonder verzuimlaag verandert er niets');
});

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-teamrooster-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
});
test.after(() => stop(srv && srv.child));

test('4. echte server: de zieke kok staat op "Afwezig", en alleen de manager ziet meer', async () => {
  const base = srv.base;
  const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const man = roster.staff.find(x => x.role === 'manager');
  const kok = roster.staff.find(x => x.role !== 'manager');
  const baas = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  const kokTok = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: kok.id, pin: '5678' })).body.token;

  const voor = (await api(base, '/api/supplier/schedule', {}, baas)).body;
  assert.equal(voor.verzuimNagekeken, true, 'de verzuimlaag antwoordt op de echte server');
  const gepland = voor.days.map(d => d.staff.find(m => m.id === kok.id).shift);
  assert.ok(gepland.some(s => s !== VRIJ), 'de kok heeft deze week een dienst');

  assert.equal((await api(base, '/api/staff/leave/request', { soort: 'ziek' }, kokTok)).status, 200);

  const mgr = (await api(base, '/api/supplier/schedule', {}, baas));
  assert.equal(mgr.status, 200);
  mgr.body.days.forEach((d, i) => {
    const rij = d.staff.find(m => m.id === kok.id);
    if (gepland[i] === VRIJ) return assert.equal(rij.shift, VRIJ, 'vrij blijft vrij');
    assert.equal(rij.shift, 'Afwezig', d.date + ': de zieke kok staat niet meer op ' + gepland[i]);
    assert.equal(rij.gepland, gepland[i], 'de manager ziet wat er gepland was');
    assert.equal(rij.afwezig, 'afwezig', 'en dat het verzuim is, zonder reden');
  });

  /* de kok zelf (hier de collega-blik): Afwezig en verder niets */
  const zelf = (await api(base, '/api/supplier/schedule', {}, kokTok)).body;
  const eigen = zelf.days.find((d, i) => gepland[i] !== VRIJ).staff.find(m => m.id === kok.id);
  assert.deepEqual(Object.keys(eigen).sort(), ['id', 'name', 'role', 'shift']);
  assert.equal(eigen.shift, 'Afwezig');
  assert.ok(!/ziek/i.test(JSON.stringify(zelf)), 'het rooster noemt geen ziekte');
  assert.ok(!/inzetbaarheid|gepland/.test(JSON.stringify(zelf)), 'een collega krijgt geen verzuimvelden');
  assert.equal((await api(base, '/api/supplier/schedule', {})).status, 401, 'zonder sessie geen rooster');
});
