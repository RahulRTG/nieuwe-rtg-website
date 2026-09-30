/* ============================================================================
   EEN MENS DIE TOCH EEN AFWEZIGE MEDEWERKER INPLANT, ZIET HET ERBIJ
   (PERSONEEL.md par. 4, PLANNING.md par. 7).

   Dat de AUTOPLANNERS niemand inplannen die afwezig is, staat al in
   kern/payroll/inplanbaar.js en test/rooster-verzuim.test.js. Wat hier vast
   moet blijven is de menselijke kant ernaast, op dezelfde regel:

     1. een losse dienst van de beveiliging voor een afwezige bewaker gaat door
        met een `verzuimWaarschuwing` (aangepast werk is het besluit van een
        mens), maar de automaat wordt ook langs zetDienst tegengehouden;
     2. naKijken(): wie op een dienst staat terwijl hij niet inplanbaar is, en
        niemand die al op vrij stond; een onleesbaar register is null;
     3. tegen een echte server: de waarschuwing noemt nooit ziekte;
     4. tegen een echte server: wie NA het voorstel afwezig wordt (hier goed-
        gekeurd verlof), staat erbij als het weekrooster wordt vastgesteld.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakInplanbaar, naKijken } = require('../server/kern/payroll/inplanbaar');
const { BEVEILIGING_SHIFTS } = require('../server/kern/beveiliging');
const { startServer, stop } = require('./helper');

function wereld(afwezigOp) {
  const ctx = {
    db: { data: { bevDiensten: [] } },
    save() {}, sseToSupplier() {},
    BEV_SHIFTS: BEVEILIGING_SHIFTS,
    shiftVan: sid => BEVEILIGING_SHIFTS.find(x => x.id === sid) || null,
    functieAan: () => true, vandaag: () => '2026-09-24', nu: () => 't',
    id: (() => { let n = 0; return p => p + (++n); })(),
    guards: () => [{ id: 1 }, { id: 2 }], guardNaam: (s, g) => 'Bewaker ' + g,
    postVan: () => ({ id: 'P', naam: 'Post', klant: 'K' }),
    diensten: () => ctx.db.data.bevDiensten,
    afwezigOp
  };
  Object.assign(ctx, require('../server/kern/beveiliging/rooster/planning')(ctx));
  return ctx;
}

test('1. een mens mag een afwezige bewaker zetten maar ziet het erbij; de automaat niet', () => {
  const ziek = wereld((code, gid) => (gid === 1 ? { wat: 'afwezig', inzetbaarheid: 'deels' } : null));
  const dienst = { postId: 'P', shiftId: 'dag', datum: '2026-09-24', guardId: 1 };
  const mens = ziek.zetDienst({ code: 'Z' }, dienst);
  assert.equal(mens.status, 200, 'een mens wordt niet tegengehouden: aangepast werk is zijn besluit');
  assert.match(mens.verzuimWaarschuwing, /Bewaker 1 staat op 2026-09-24 als afwezig/);
  assert.match(mens.verzuimWaarschuwing, /inzetbaar: deels/);
  assert.equal(mens.verzuimNagekeken, true);
  /* een andere week, zodat de rustregel niet meespeelt: alleen verzuim kan hier weigeren */
  const auto = ziek.zetDienst({ code: 'Z' }, { ...dienst, datum: '2026-10-08' }, { door: 'autoplan' });
  assert.equal(auto.status, 409, 'de automaat plant nooit wie afwezig is, ook niet langs zetDienst');
  assert.match(auto.error, /als afwezig/);

  const gezond = wereld(() => null).zetDienst({ code: 'Z' }, dienst);
  assert.equal(gezond.status, 200);
  assert.equal(gezond.verzuimWaarschuwing, undefined, 'tegenproef: niemand afwezig, geen waarschuwing');
  assert.equal(gezond.verzuimNagekeken, true);
  const blind = wereld(undefined).zetDienst({ code: 'Z' }, dienst);
  assert.equal(blind.status, 200);
  assert.equal(blind.verzuimNagekeken, false, 'zonder register zegt het antwoord dat er niet is gekeken');
});

test('2. naKijken: wie op een dienst staat terwijl hij afwezig is, en niemand op vrij', () => {
  const ip = maakInplanbaar((code, id, datum) => (id === 1 && datum === '2026-09-25' ? { wat: 'Vakantie', inzetbaarheid: null } : null));
  const dagen = [
    { date: '2026-09-24', staff: [{ id: 1, name: 'Kok', shift: 'Ochtend' }] },
    { date: '2026-09-25', staff: [{ id: 1, name: 'Kok', shift: 'Ochtend' }, { id: 2, name: 'Bar', shift: 'Avond' }] },
    { date: '2026-09-26', staff: [{ id: 1, name: 'Kok', shift: 'Vrij' }] }
  ];
  assert.deepEqual(naKijken(ip, 'Z', dagen, 'Vrij'),
    [{ datum: '2026-09-25', id: 1, naam: 'Kok', wat: 'Vakantie', inzetbaarheid: null }]);
  const altijd = maakInplanbaar(() => ({ wat: 'afwezig', inzetbaarheid: 'niets' }));
  assert.deepEqual(naKijken(altijd, 'Z', [{ date: 'd', staff: [{ id: 1, shift: 'Vrij' }] }], 'Vrij'), [],
    'wie al vrij staat, hoeft niet gemeld te worden');
  assert.equal(naKijken(maakInplanbaar(undefined), 'Z', dagen, 'Vrij'), null,
    'een onleesbaar register is niet nagekeken, en niet "niemand afwezig"');
});

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const vandaag = () => new Date().toISOString().slice(0, 10);

let srv, base;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-verzuimrooster-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'AEGIS' } });
  base = srv.base;
});
test.after(() => stop(srv && srv.child));

test('3. echte server: een manager zet toch een dienst voor een zieke bewaker, en ziet het', async () => {
  const login = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  const mgr = login.body.token;
  const guards = (login.body.state.staff || []).filter(x => x.role === 'staff');
  const ziek = guards[0];
  const tok = (await api(base, '/api/supplier/login', { code: 'AEGIS', staffId: ziek.id, pin: '5678' })).body.token;
  assert.equal((await api(base, '/api/staff/leave/request', { soort: 'ziek' }, tok)).status, 200);
  const rooster = (await api(base, '/api/supplier/beveiliging/rooster', { van: vandaag(), dagen: 1 }, mgr)).body;
  const post = rooster.dagen[0].posten[0];
  const r = await api(base, '/api/supplier/beveiliging/dienst',
    { postId: post.postId, shiftId: post.shifts[post.shifts.length - 1].shiftId, datum: vandaag(), guardId: ziek.id }, mgr);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.match(r.body.verzuimWaarschuwing || '', /staat op \d{4}-\d{2}-\d{2} als afwezig .*in de verzuimlaag/, JSON.stringify(r.body).slice(0, 400));
  assert.equal(r.body.verzuimNagekeken, true);
  assert.ok(!/ziek/i.test(JSON.stringify(r.body)), 'de waarschuwing noemt geen ziekte');
});

test('4. echte server: wie na het voorstel afwezig wordt, staat erbij als het rooster wordt vastgesteld', async () => {
  const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const man = roster.staff.find(x => x.role === 'manager');
  const baas = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  const v = await api(base, '/api/supplier/rooster/voorstel', {}, baas);
  assert.equal(v.status, 200);
  /* De manager werkt elke dag; hij vraagt daarna voor morgen verlof aan, en dat
     wordt goedgekeurd -- pas dan staat het in het register. */
  const dag = v.body.rooster.days[1].date;
  const rij = v.body.rooster.days[1].staff.find(x => x.id === man.id);
  assert.notEqual(rij.shift, 'Vrij', 'de manager werkt morgen in het voorstel');
  const aan = await api(base, '/api/staff/leave/request', { soort: 'verlof', van: dag, tot: dag }, baas);
  assert.equal(aan.status, 200);
  assert.equal((await api(base, '/api/supplier/leave/decide', { id: aan.body.entry.id, action: 'goedkeuren' }, baas)).status, 200);

  const r = await api(base, '/api/supplier/rooster/beslis', { actie: 'akkoord' }, baas);
  assert.equal(r.status, 200, 'vaststellen wordt niet tegengehouden');
  const w = r.body.verzuimBijVaststellen;
  assert.ok(Array.isArray(w), 'het register is nagekeken');
  assert.ok(w.some(x => x.id === rij.id && x.datum === dag && x.wat === 'Vakantie'),
    'de manager ziet wie er intussen afwezig is: ' + JSON.stringify(w));
  assert.ok(!/ziek/i.test(JSON.stringify(w)), 'en noemt geen ziekte');
});
