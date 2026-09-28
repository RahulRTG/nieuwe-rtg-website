/* ============================================================================
   VERZUIM IN HET ROOSTER (PLANNING.md par. 7, PERSONEEL.md par. 4).

   Geen enkele roostermotor las verzuim: de beveiligingsplanner en het
   AI-weekrooster zetten een zieke medewerker gewoon op een dienst, terwijl
   kern/payroll/verzuim.js al wist dat hij er niet was. Deze toetsen houden vast:

     1. de regel zelf (kern/verzuimrooster.js), inclusief dat een ONTBREKENDE
        verzuimlaag "onbekend" is en geen "niemand is ziek";
     2. de beveiligingsplanner op een nagebouwde context;
     3. tegen een echte server: een bewaker die zich ziek meldt, wordt door de
        autoplanner niet ingepland -- en het antwoord noemt hem "afwezig",
        nooit "ziek";
     4. tegen een echte server: het AI-weekrooster zet een zieke kok op vrij;
     5. tegen een echte server: afgewezen verlof verdwijnt uit de verzuimlaag,
        want het ging er al bij het AANVRAGEN in;
     7-10. een MENS die toch een afwezige medewerker inplant, krijgt het erbij
        te zien en wordt niet tegengehouden -- bij een losse dienst van de
        beveiliging en bij het vaststellen van het weekrooster. De automaat
        krijgt een tweede grendel.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakVerzuimRooster } = require('../server/kern/verzuimrooster');
const { BEVEILIGING_SHIFTS } = require('../server/kern/beveiliging');
const { startServer, stop } = require('./helper');

test('1. de regel: wie er niet (volledig) is, is niet inplanbaar -- en geen lezer is onbekend', () => {
  const met = (regels) => maakVerzuimRooster(() => regels);
  assert.equal(maakVerzuimRooster(null).stand('Z', 1, '2026-09-24').stand, 'onbekend',
    'zonder verzuimlaag is het antwoord onbekend, niet inplanbaar');
  assert.equal(met(null).stand('Z', 1, '2026-09-24').stand, 'onbekend');
  assert.equal(maakVerzuimRooster(() => { throw new Error('stuk'); }).stand('Z', 1, 'd').stand, 'onbekend',
    'een lezer die gooit, maakt de planner niet stuk en telt niet als niemand ziek');
  assert.equal(met([]).stand('Z', 1, 'd').stand, 'inplanbaar');
  const ziek = met([{ wat: 'afwezig', inzetbaarheid: 'niets' }]).stand('Z', 1, 'd');
  assert.deepEqual(ziek, { stand: 'afwezig', wat: 'afwezig', inzetbaarheid: 'niets' });
  assert.equal(met([{ wat: 'afwezig', inzetbaarheid: 'volledig' }]).stand('Z', 1, 'd').stand, 'inplanbaar',
    'weer volledig inzetbaar is gewoon inplanbaar');
  assert.equal(met([{ wat: 'afwezig', inzetbaarheid: 'deels' }]).stand('Z', 1, 'd').stand, 'afwezig',
    'deels inzetbaar plant een MENS in, niet de automaat');
  assert.equal(met([{ wat: 'Vakantie', inzetbaarheid: null }]).stand('Z', 1, 'd').wat, 'Vakantie');
  const r = maakVerzuimRooster(null);
  assert.equal(r.verzuimZin(0, 0), '');
  assert.match(r.verzuimZin(0, 3), /niet worden nagekeken/);
  assert.match(r.verzuimZin(2, 0), /^2 medewerker/);
});

function wereld(lezer) {
  const ctx = {
    db: { data: { bevDiensten: [{ supplierCode: 'Z', status: 'gepland', postId: 'P', guardId: 2, datum: '2026-09-01', shiftId: 'dag' }] } },
    save() {}, sseToSupplier() {},
    BEV_SHIFTS: BEVEILIGING_SHIFTS,
    shiftVan: sid => BEVEILIGING_SHIFTS.find(x => x.id === sid) || null,
    functieAan: () => true, vandaag: () => '2026-09-24', nu: () => 't',
    id: (() => { let n = 0; return p => p + (++n); })(),
    guards: () => [{ id: 1 }, { id: 2 }], guardNaam: (s, g) => 'Bewaker ' + g,
    postVan: () => ({ id: 'P', naam: 'Post', klant: 'K' }),
    diensten: () => ctx.db.data.bevDiensten,
    verzuim: lezer === undefined ? undefined : maakVerzuimRooster(lezer)
  };
  Object.assign(ctx, require('../server/kern/beveiliging/rooster/planning')(ctx));
  ctx.rooster = () => ({ dagen: [{ posten: [{ postId: 'P', shifts: [{ shiftId: 'dag', open: 1 }] }] }] });
  Object.assign(ctx, require('../server/kern/beveiliging/rooster/aanvragen')(ctx));
  return ctx;
}

test('2. de beveiligingsplanner slaat een zieke bewaker over, ook als hij de minste uren heeft', () => {
  /* bewaker 1 heeft nul uren deze maand en bewaker 2 acht: zonder verzuim kiest
     de eerlijke verdeling bewaker 1. Hij is ziek, dus het wordt bewaker 2. */
  const ziek = wereld((code, gid) => (gid === 1 ? [{ wat: 'afwezig', inzetbaarheid: 'niets' }] : []));
  const r = ziek.planAuto({ code: 'Z' }, '2026-09-24');
  assert.equal(r.gemaakt.length, 1);
  assert.equal(r.gemaakt[0].guardId, 2, 'de collega, niet de zieke bewaker');
  assert.deepEqual(r.nietIngepland, [{ guardId: 1, wat: 'afwezig', inzetbaarheid: 'niets' }]);
  assert.equal(r.verzuimNagekeken, true);
  assert.match(r.uitleg, /niet ingepland omdat er verzuim of verlof loopt/);

  const gezond = wereld(() => []).planAuto({ code: 'Z' }, '2026-09-24');
  assert.equal(gezond.gemaakt[0].guardId, 1, 'tegenproef: zonder verzuim kiest de verdeling wel bewaker 1');

  const blind = wereld(undefined).planAuto({ code: 'Z' }, '2026-09-24');
  assert.equal(blind.gemaakt.length, 1, 'zonder verzuimlaag wordt er gepland zoals voorheen');
  assert.equal(blind.verzuimNagekeken, false);
  assert.match(blind.uitleg, /niet worden nagekeken/, 'maar het antwoord zegt dat er niet is gekeken');
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

test('3. echte server: de autoplanner van de beveiliging plant een zieke bewaker niet in', async () => {
  const login = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  const mgr = login.body.token;
  const guards = (login.body.state.staff || []).filter(x => x.role === 'staff');
  assert.ok(guards.length >= 2, 'een ploeg bewakers');
  const ziek = guards[0];
  const tok = (await api(base, '/api/supplier/login', { code: 'AEGIS', staffId: ziek.id, pin: '5678' })).body.token;
  assert.equal((await api(base, '/api/staff/leave/request', { soort: 'ziek' }, tok)).status, 200);

  const r = await api(base, '/api/supplier/beveiliging/planauto', { datum: vandaag() }, mgr);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  /* eerst: er IS gepland -- anders slaagt "hij staat op geen dienst" vanzelf */
  assert.ok(r.body.gemaakt.length >= 1, 'de planner vulde diensten met de rest van de ploeg');
  assert.ok(!r.body.gemaakt.some(d => d.guardId === ziek.id), 'de zieke bewaker staat op geen enkele dienst');
  const niet = r.body.nietIngepland.find(n => n.guardId === ziek.id);
  assert.ok(niet, 'en de uitslag zegt waarom hij ontbreekt');
  assert.equal(niet.wat, 'afwezig');
  assert.equal(r.body.verzuimNagekeken, true, 'de verzuimlaag is aangesloten');
  assert.ok(!/ziek/i.test(JSON.stringify(r.body)), 'het antwoord aan de planner noemt geen ziekte');
});

test('4. echte server: het AI-weekrooster zet een zieke medewerker vandaag op vrij', async () => {
  const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const man = roster.staff.find(x => x.role === 'manager');
  const kok = roster.staff.find(x => x.role !== 'manager');
  const baas = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  const kokTok = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: kok.id, pin: '5678' })).body.token;
  assert.equal((await api(base, '/api/staff/leave/request', { soort: 'ziek' }, kokTok)).status, 200);

  const r = await api(base, '/api/supplier/rooster/voorstel', {}, baas);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const dag0 = r.body.rooster.days[0];
  const rij = dag0.staff.find(x => x.id === kok.id);
  assert.equal(rij.shift, 'Vrij', 'de zieke kok staat vandaag niet op een dienst');
  assert.equal(rij.afwezig, 'afwezig');
  assert.equal(r.body.rooster.verzuimNagekeken, true);
  assert.match(r.body.rooster.verzuim, /niet ingepland/);
  assert.ok(!/ziek/i.test(JSON.stringify(r.body)), 'het voorstel noemt geen ziekte');
});

test('5. echte server: afgewezen verlof staat niet meer in de verzuimlaag', async () => {
  const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const man = roster.staff.find(x => x.role === 'manager');
  const kok = roster.staff.find(x => x.role !== 'manager');
  const baas = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  const kokTok = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: kok.id, pin: '5678' })).body.token;
  const van = '2027-03-01', tot = '2027-03-05';
  const aan = await api(base, '/api/staff/leave/request', { soort: 'verlof', van, tot }, kokTok);
  assert.equal(aan.status, 200);
  const staatEr = async () => {
    const p = await api(base, '/api/supplier/verzuim/planning', { van, tot }, baas);
    const rij = (p.body.afwezig || []).find(a => a.staffId === kok.id);
    return !!(rij && rij.regels.some(x => x.wat === 'Vakantie'));
  };
  assert.equal(await staatEr(), true, 'de aanvraag staat zichtbaar op het planbord (zo was het al)');
  const nee = await api(base, '/api/supplier/leave/decide', { id: aan.body.entry.id, action: 'afwijzen' }, baas);
  assert.equal(nee.status, 200);
  assert.equal(await staatEr(), false, 'afgewezen verlof is geen verlof: de loonrun en het rooster zien het niet meer');
});

test('6. vragen of iemand er is, laat geen lege verzuimrij achter', () => {
  const { maakVerzuim } = require('../server/kern/payroll/verzuim');
  const opslag = { data: {}, bak(k) { return (this.data[k] = this.data[k] || {}); } };
  const v = maakVerzuim({ opslag, save() {} });
  assert.deepEqual(v.voorPlanning('Z', 7, '2026-09-24', '2026-09-24'), []);
  assert.deepEqual(Object.keys(opslag.data.payrollVerzuim || {}), [],
    'een rooster dat het hele team afloopt, schreef voor iedereen een lege rij');
  assert.equal(v.schrap('Z', 7, '2026-09-24', 'ziek').status, 400, 'een ziekmelding wordt niet afgewezen');
  assert.equal(v.schrap('Z', 7, '2026-09-24', 'vakantie').status, 404);
});

test('7. een mens mag een afwezige bewaker zetten maar ziet het erbij; de automaat niet', () => {
  const ziek = wereld((code, gid) => (gid === 1 ? [{ wat: 'afwezig', inzetbaarheid: 'deels' }] : []));
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

  const gezond = wereld(() => []).zetDienst({ code: 'Z' }, dienst);
  assert.equal(gezond.status, 200);
  assert.equal(gezond.verzuimWaarschuwing, undefined, 'tegenproef: niemand afwezig, geen waarschuwing');
  const blind = wereld(undefined).zetDienst({ code: 'Z' }, dienst);
  assert.equal(blind.status, 200);
  assert.equal(blind.verzuimNagekeken, false, 'zonder verzuimlaag zegt het antwoord dat er niet is gekeken');
});

test('8. naKijken: wie op een dienst staat terwijl hij afwezig is, en niemand op vrij', () => {
  const r = maakVerzuimRooster((code, id, van) => (id === 1 && van === '2026-09-25' ? [{ wat: 'Vakantie', inzetbaarheid: null }] : []));
  const dagen = [
    { date: '2026-09-24', staff: [{ id: 1, name: 'Kok', shift: 'Ochtend' }] },
    { date: '2026-09-25', staff: [{ id: 1, name: 'Kok', shift: 'Ochtend' }, { id: 2, name: 'Bar', shift: 'Avond' }] },
    { date: '2026-09-26', staff: [{ id: 1, name: 'Kok', shift: 'Vrij' }] }
  ];
  assert.deepEqual(r.naKijken('Z', dagen, 'Vrij'),
    [{ datum: '2026-09-25', id: 1, naam: 'Kok', wat: 'Vakantie', inzetbaarheid: null }]);
  const vrij = maakVerzuimRooster(() => [{ wat: 'afwezig', inzetbaarheid: 'niets' }]);
  assert.deepEqual(vrij.naKijken('Z', [{ date: 'd', staff: [{ id: 1, shift: 'Vrij' }] }], 'Vrij'), [],
    'wie al vrij staat, hoeft niet gemeld te worden');
});

test('9. echte server: een manager zet toch een dienst voor een zieke bewaker, en ziet het', async () => {
  const login = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  const mgr = login.body.token;
  const guards = (login.body.state.staff || []).filter(x => x.role === 'staff');
  const ziek = guards[0];   // meldde zich in toets 3 ziek
  const rooster = (await api(base, '/api/supplier/beveiliging/rooster', { van: vandaag(), dagen: 1 }, mgr)).body;
  const post = rooster.dagen[0].posten[0];
  const r = await api(base, '/api/supplier/beveiliging/dienst',
    { postId: post.postId, shiftId: post.shifts[post.shifts.length - 1].shiftId, datum: vandaag(), guardId: ziek.id }, mgr);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.match(r.body.verzuimWaarschuwing || '', /staat op \d{4}-\d{2}-\d{2} als afwezig .*in de verzuimlaag/, JSON.stringify(r.body).slice(0, 400));
  assert.equal(r.body.verzuimNagekeken, true);
  assert.ok(!/ziek/i.test(JSON.stringify(r.body)), 'de waarschuwing noemt geen ziekte');
});

test('10. echte server: wie na het voorstel afwezig wordt, staat erbij als het rooster wordt vastgesteld', async () => {
  const roster = (await api(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const man = roster.staff.find(x => x.role === 'manager');
  const baas = (await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' })).body.token;
  const v = await api(base, '/api/supplier/rooster/voorstel', {}, baas);
  assert.equal(v.status, 200);
  /* KIKUNOI heeft een manager en een medewerker, en die staat sinds toets 4 ziek
     op vrij. De manager werkt elke dag; hij vraagt daarna voor morgen verlof aan. */
  const dag = v.body.rooster.days[1].date;
  const rij = v.body.rooster.days[1].staff.find(x => x.id === man.id);
  assert.notEqual(rij.shift, 'Vrij', 'de manager werkt morgen in het voorstel');
  assert.equal((await api(base, '/api/staff/leave/request', { soort: 'verlof', van: dag, tot: dag }, baas)).status, 200);

  const r = await api(base, '/api/supplier/rooster/beslis', { actie: 'akkoord' }, baas);
  assert.equal(r.status, 200, 'vaststellen wordt niet tegengehouden');
  const w = r.body.verzuimBijVaststellen;
  assert.ok(Array.isArray(w), 'de verzuimlaag is nagekeken');
  assert.ok(w.some(x => x.id === rij.id && x.datum === dag && x.wat === 'Vakantie'),
    'de manager ziet wie er intussen afwezig is: ' + JSON.stringify(w));
  /* de zieke kok uit toets 4 staat in dit voorstel al op vrij, dus die hoort er niet in */
  assert.ok(!/ziek/i.test(JSON.stringify(w)), 'en noemt geen ziekte');
});
