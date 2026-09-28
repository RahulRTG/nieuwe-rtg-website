'use strict';
/* HET ROOSTER LEEST VERZUIM (PLANNING.md par. 6, kern/payroll/inplanbaar.js).

   Geen roostermotor keek naar afwezigheid: een zieke of vrije medewerker kon
   gewoon worden ingepland terwijl het verzuimregister het al wist. Drie lagen:
   de regel zelf, de autoplanner van de beveiliging op zijn echte planninglaag,
   en het weekrooster plus het AI-voorstel op een echte server. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakInplanbaar, NIET_GELEZEN } = require('../server/kern/payroll/inplanbaar');
const { BEVEILIGING_SHIFTS } = require('../server/kern/beveiliging');
const { startServer, stop } = require('./helper');

test('de regel: automatisch alleen wie er volledig is, en een onleesbaar register is geen "niemand afwezig"', () => {
  const ip = (a) => maakInplanbaar(() => a)('Z', 1, '2026-10-08');
  assert.deepEqual(ip(null), { plan: true });
  assert.equal(ip({ wat: 'afwezig', inzetbaarheid: 'volledig' }).plan, true);
  assert.equal(ip({ wat: 'RTG Day', inzetbaarheid: null }).plan, false);
  const deels = ip({ wat: 'afwezig', inzetbaarheid: 'deels' });
  assert.equal(deels.plan, false, 'deels inzetbaar plant een mens in, geen machine');
  assert.match(deels.zin, /plan dit zelf in/);
  assert.equal(ip({ wat: 'afwezig', inzetbaarheid: 'niets' }).zin, 'afwezig.', 'wie niets kan, plant ook een mens niet in');
  assert.deepEqual(ip({ onbekend: true }), { plan: true, onbekend: true });
  assert.deepEqual(maakInplanbaar(undefined)('Z', 1, 'x'), { plan: true, onbekend: true });
  assert.deepEqual(maakInplanbaar(() => { throw new Error('weg'); })('Z', 1, 'x'), { plan: true, onbekend: true });
});

function bev(afwezigOp) {
  const ctx = {
    db: { data: { bevDiensten: [] } }, save() {}, sseToSupplier() {}, afwezigOp,
    BEV_SHIFTS: BEVEILIGING_SHIFTS, shiftVan: sid => BEVEILIGING_SHIFTS.find(x => x.id === sid) || null,
    functieAan: () => true, vandaag: () => '2026-09-24', nu: () => 't',
    id: (() => { let n = 0; return p => p + (++n); })(),
    guards: () => [{ id: 1 }, { id: 2 }], guardNaam: (s, g) => 'Bewaker ' + g,
    postVan: () => ({ id: 'P', naam: 'Post', klant: 'K' }), diensten: () => ctx.db.data.bevDiensten
  };
  Object.assign(ctx, require('../server/kern/beveiliging/rooster/planning')(ctx));
  ctx.rooster = () => ({ dagen: [{ posten: [{ postId: 'P', shifts: [{ shiftId: 'dag', open: 1 }] }] }] });
  Object.assign(ctx, require('../server/kern/beveiliging/rooster/aanvragen')(ctx));
  return ctx;
}

test('de autoplanner van de beveiliging zet geen zieke bewaker op een post', () => {
  const ziek1 = (code, id) => id === 1 ? { wat: 'afwezig', inzetbaarheid: 'niets' } : null;
  const r = bev(ziek1).planAuto({ code: 'Z' }, '2026-09-24');
  assert.equal(r.gemaakt.length, 1);
  assert.equal(r.gemaakt[0].guardId, 2, 'bewaker 1 heeft de minste uren, maar is ziek');
  assert.equal(r.afwezig, 1);
  assert.match(r.uitleg, /afwezig en niet ingepland/);
  const allebei = bev(() => ({ wat: 'afwezig', inzetbaarheid: null })).planAuto({ code: 'Z' }, '2026-09-24');
  assert.equal(allebei.gemaakt.length, 0);
  assert.equal(allebei.onvervuld, 1, 'de plek blijft open, en dat staat er');
  assert.ok(bev(undefined).planAuto({ code: 'Z' }, '2026-09-24').uitleg.includes(NIET_GELEZEN), 'geen register: dat staat erbij');
});

test('op een echte server: wie zich ziek meldt, staat vrij in het weekrooster en in het AI-voorstel, zonder verlofsoort', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-roosterverzuim-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const api = (pad, body, token) => fetch(srv.base + '/api/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  try {
    const rooster = (await api('supplier/roster', { code: 'KIKUNOI' })).body.staff;
    const mw = rooster.find(x => x.role === 'staff'), baas = rooster.find(x => x.role === 'manager');
    const tMw = (await api('supplier/login', { code: 'KIKUNOI', staffId: mw.id, pin: '5678' })).body.token;
    const tBaas = (await api('supplier/login', { code: 'KIKUNOI', staffId: baas.id, pin: '1234' })).body.token;
    const vandaag = new Date().toISOString().slice(0, 10);
    const voor = (await api('supplier/schedule', {}, tBaas)).body.days[0].staff.find(x => x.id === mw.id);
    assert.equal(voor.afwezig, undefined, 'voor de melding staat hij gewoon in het rooster');

    const z = await api('staff/leave/request', { soort: 'ziek', van: vandaag }, tMw);
    assert.equal(z.status, 200, JSON.stringify(z.body));

    const na = (await api('supplier/schedule', {}, tBaas)).body.days[0];
    assert.equal(na.date, vandaag);
    const rij = na.staff.find(x => x.id === mw.id);
    assert.equal(rij.shift, 'Vrij');
    assert.equal(rij.afwezig, true);
    assert.doesNotMatch(JSON.stringify(rij), /[Zz]iek/, 'het teamrooster zegt DAT hij er niet is, niet waarom');

    const v = await api('supplier/rooster/voorstel', {}, tBaas);
    assert.equal(v.status, 200, JSON.stringify(v.body));
    const vr = v.body.rooster.days[0].staff.find(x => x.id === mw.id);
    assert.equal(vr.shift, 'Vrij', 'het AI-voorstel plant een zieke niet in');
    assert.equal(vr.afwezig, 'afwezig.', 'vrij OMDAT hij afwezig is, niet toevallig volgens het patroon');
    assert.match(v.body.rooster.afwezigheid, /^[1-9]\d* dienst\(en\) vrijgehouden/);
    assert.doesNotMatch(v.body.rooster.afwezigheid, /niet te lezen/, 'op de server is het register er gewoon');
  } finally {
    stop(srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen mag falen */ }
  }
});

test('een al vastgestelde dienst van wie zich daarna ziek meldt, vult de post niet meer; bij herstel wel', () => {
  let ziek = false;
  const ctx = {
    db: { data: { bevDiensten: [] } }, save() {}, sseToSupplier() {},
    afwezigOp: (code, id) => (ziek && id === 1 ? { wat: 'afwezig', inzetbaarheid: 'niets' } : null),
    BEV_SHIFTS: BEVEILIGING_SHIFTS, shiftVan: sid => BEVEILIGING_SHIFTS.find(x => x.id === sid) || null,
    functieAan: () => true, vandaag: () => '2026-09-24', nu: () => 't',
    getal: (v, min, max, std) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std; },
    defaults: () => ({ posten: [{ id: 'P', naam: 'Post', klant: 'K', shifts: ['dag'], minMan: 1 }] }),
    id: (() => { let n = 0; return p => p + (++n); })(),
    guards: () => [{ id: 1 }, { id: 2 }], guardNaam: (s, g) => 'Bewaker ' + g,
    postVan: () => ({ id: 'P', naam: 'Post', klant: 'K' }), diensten: () => ctx.db.data.bevDiensten
  };
  Object.assign(ctx, require('../server/kern/beveiliging/rooster/planning')(ctx));
  assert.ok(ctx.zetDienst({ code: 'Z' }, { postId: 'P', shiftId: 'dag', datum: '2026-09-24', guardId: 1 }).ok);
  const shift = () => ctx.rooster({ code: 'Z' }, '2026-09-24', 1).dagen[0].posten[0].shifts[0];
  assert.equal(shift().open, 0, 'vastgesteld en gedekt');
  ziek = true;
  const na = shift();
  assert.equal(na.open, 1, 'de post meldt zich weer als open');
  assert.equal(na.afwezig, 1);
  assert.equal(na.bezet[0].afwezig, 'afwezig.', 'de dienst blijft zichtbaar, met DAT hij afwezig is en niet waarom');
  assert.equal(ctx.db.data.bevDiensten[0].status, 'gepland', 'er is niets geschrapt: herplannen doet een mens');
  ziek = false;
  assert.equal(shift().open, 0, 'hersteld: vanzelf weer gedekt');
});
