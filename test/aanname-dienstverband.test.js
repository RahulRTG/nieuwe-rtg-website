/* ============================================================================
   DE BRUG VAN AANNAME NAAR DIENSTVERBAND (ARBEID.md par. 7a, besluit 1).

   De Adamproef schakel 16 vond dat een aanname via de werving eindigde bij een
   personeelsnummer aan een ZAAK, zonder dienstverband bij de entiteit. Deze
   toetsen houden vast wat de brug in kern/concern/aanname.js wel en niet doet:

     1. een zaak op een vestiging geeft een dienstverband bij DIE entiteit, op
        die vestiging, met de functie als rol;
     2. een zaak die nergens aan hangt geeft GEEN dienstverband, met de reden en
        de weg eromheen -- er wordt geen werkgever geraden;
     3. een tweede aanname in dezelfde rol maakt er geen tweede bij;
     4. zonder lidsleutel geen dienstverband;
     5. de brug loopt een kant op: hij maakt nooit een personeelsplek.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function bouw() {
  const db = { data: {} };
  db.capsVan = () => [];
  const zaken = { BRISA: { code: 'BRISA', name: 'Cafe Brisa' }, LOS: { code: 'LOS', name: 'Losse zaak' } };
  return require('../server/kern/concern')({
    db, save: () => {}, crypto,
    schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n),
    findSupplier: (c) => zaken[String(c || '').toUpperCase()] || null, vandaag: () => '2026-09-23'
  });
}

function wereld() {
  const K = bouw();
  const e = K.entiteitVind(K.entiteitNieuw('user-1', { naam: 'Brisa BV', land: 'ES' }).entiteit.id);
  const v = K.vestigingNieuw(e, { naam: 'Ibiza' }).vestiging;
  const u = K.vestigingUnit(K.vestigingVind(v.id), 'BRISA', () => true);
  assert.ok(u.ok, 'de zaak hangt aan de vestiging');
  return { K, e, v };
}

test('1. een aanname bij een gekoppelde zaak wordt een dienstverband bij de entiteit', () => {
  const { K, e, v } = wereld();
  const r = K.dienstverbandUitAanname({ zaak: 'BRISA', persoon: 'user-7', rol: 'Keukenhulp' });
  assert.equal(r.gemaakt, true, JSON.stringify(r));
  assert.equal(r.entiteit, e.id);
  assert.equal(r.vestiging, v.id);
  const lijst = K.employmentVanPersoon('user-7', false);
  assert.equal(lijst.length, 1);
  assert.equal(lijst[0].rol, 'Keukenhulp');
  assert.equal(K.werkOverzicht('user-7').werkplekken.length, 1, 'mijnwerk ziet hem');
});

test('2. een zaak zonder vestiging geeft geen dienstverband, met de reden en de weg', () => {
  const { K } = wereld();
  const r = K.dienstverbandUitAanname({ zaak: 'LOS', persoon: 'user-7', rol: 'Kok' });
  assert.equal(r.gemaakt, false);
  assert.match(r.reden, /geen vestiging/);
  assert.match(r.hoe, /vestiging\/zaak/);
  assert.equal(K.employmentVanPersoon('user-7', false).length, 0, 'er wordt geen werkgever geraden');
});

test('3. een tweede aanname in dezelfde rol maakt er geen tweede bij', () => {
  const { K } = wereld();
  K.dienstverbandUitAanname({ zaak: 'BRISA', persoon: 'user-7', rol: 'Keukenhulp' });
  const r = K.dienstverbandUitAanname({ zaak: 'BRISA', persoon: 'user-7', rol: 'Keukenhulp' });
  assert.equal(r.gemaakt, false);
  assert.equal(r.bestond, true);
  assert.equal(K.employmentVanPersoon('user-7', false).length, 1);
});

test('4. zonder lidsleutel geen dienstverband', () => {
  const { K } = wereld();
  const r = K.dienstverbandUitAanname({ zaak: 'BRISA', persoon: '', rol: 'Keukenhulp' });
  assert.equal(r.gemaakt, false);
  assert.match(r.reden, /RTG-account/);
});

test('5. de brug loopt een kant op: hij raakt het personeelsregister niet aan', () => {
  const bron = fs.readFileSync(path.join(__dirname, '../server/kern/concern/aanname.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(bron, /createStaff|createAccountStaff|activateStaff|accounts\./,
    'een dienstverband maakt nooit een personeelsplek; twee lijsten die elkaar bijwerken hebben geen waarheid');
});

test('6. de claim geeft de uitslag van de brug mee, en hij valt niet stil weg', () => {
  const na = require('../server/routes/supplier/werving/uitnodiging-na');
  const log = [];
  const ctx = { accounts: { getMemberState: () => ({ via: 1 }), saveMemberState() {} },
    logActivity: (...a) => log.push(a), notifySupplier() {} };
  const zonder = na(Object.assign({}, ctx, { kern: {} })).neveneffecten({ id: 7 }, { code: 'BRISA' }, 'N', { func: 'Kok' });
  assert.equal(zonder.gemaakt, false, 'zonder brug: een uitslag met reden, geen stilte');
  assert.ok(zonder.reden);
  const gegooid = na(Object.assign({}, ctx, { kern: { get dienstverbandUitAanname() { throw new Error('grens'); } } }))
    .neveneffecten({ id: 7 }, { code: 'BRISA' }, 'N', { func: 'Kok' });
  assert.equal(gegooid.gemaakt, false, 'een gooiende grens breekt de aanmelding niet');
  let gevraagd = null;
  const met = na(Object.assign({}, ctx, { kern: { dienstverbandUitAanname: (x) => { gevraagd = x; return { gemaakt: true }; } } }))
    .neveneffecten({ id: 7 }, { code: 'BRISA' }, 'N', { func: 'Kok' });
  assert.equal(met.gemaakt, true);
  assert.deepEqual(gevraagd, { zaak: 'BRISA', persoon: 'user-7', rol: 'Kok' }, 'de persoon is de ledensleutel uit het account');
  assert.equal(log.length, 3, 'het activiteitenlog loopt gewoon door');
});

/* ---- DE LOONKANT LEEST HET DIENSTVERBAND (dienstverbandToets) ---- */

test('7. wie een strook krijgt zonder lopend dienstverband, komt als bevinding in de run', () => {
  const { K } = wereld();
  K.dienstverbandUitAanname({ zaak: 'BRISA', persoon: 'user-7', rol: 'Kok' });
  const t = K.dienstverbandToets({ zaak: 'BRISA', periode: '2026-09',
    personeel: [{ id: 1, naam: 'Met', memberId: 7 }, { id: 2, naam: 'Zonder', memberId: 8 }] });
  assert.equal(t.getoetst, true);
  const zonder = t.bevindingen.filter(b => b.soort === 'loon_zonder_dienstverband');
  assert.deepEqual(zonder.map(b => b.staffId), [2], 'alleen wie geen dienstverband heeft');
  assert.equal(zonder[0].ernst, 'midden', 'zichtbaar maar niet blokkerend: de aannames van voor de brug hebben er nog geen');
});

test('8. een dienstverband bij een ANDERE entiteit telt niet, en een beeindigd dienstverband ook niet', () => {
  const { K } = wereld();
  const e2 = K.entiteitVind(K.entiteitNieuw('user-9', { naam: 'Andere BV', land: 'NL' }).entiteit.id);
  K.employmentNieuw({ persoon: 'user-7', entiteit: e2.id, rol: 'Kok' });
  const oud = K.employmentNieuw({ persoon: 'user-8', entiteit: K.vestigingVanUnit('BRISA').entiteit, rol: 'Kok',
    van: '2026-01-01', tot: '2026-06-30' });
  assert.ok(oud.ok);
  const t = K.dienstverbandToets({ zaak: 'BRISA', periode: '2026-09',
    personeel: [{ id: 1, memberId: 7 }, { id: 2, memberId: 8 }] });
  assert.deepEqual(t.bevindingen.filter(b => b.soort === 'loon_zonder_dienstverband').map(b => b.staffId), [1, 2]);
});

test('9. wat niet getoetst kan worden, staat er met de reden bij en valt niet weg', () => {
  const { K } = wereld();
  const los = K.dienstverbandToets({ zaak: 'LOS', periode: '2026-09', personeel: [{ id: 1, memberId: 7 }] });
  assert.equal(los.getoetst, false);
  assert.match(los.bevindingen[0].uitleg, /geen vestiging/);
  const zonderAccount = K.dienstverbandToets({ zaak: 'BRISA', periode: '2026-09', personeel: [{ id: 3, memberId: null }] });
  assert.equal(zonderAccount.bevindingen.length, 1);
  assert.equal(zonderAccount.bevindingen[0].soort, 'dienstverband_niet_getoetst');
  assert.notEqual(zonderAccount.bevindingen[0].ernst, 'hoog', 'niet te toetsen is geen overtreding');
});

/* ---- DE INHAALSLAG voor aannames van voor de brug (dienstverbandInhaal) ---- */

const ploeg = [{ id: 1, naam: 'Al', rol: 'Kok', memberId: 7 }, { id: 2, naam: 'Nieuw', rol: '', memberId: 8 },
  { id: 3, naam: 'Los', memberId: null }];

test('10. zonder keuze alleen een voorstel: er wordt niets vastgelegd', () => {
  const { K } = wereld();
  K.dienstverbandUitAanname({ zaak: 'BRISA', persoon: 'user-7', rol: 'Kok' });
  const r = K.dienstverbandInhaal({ zaak: 'BRISA', personeel: ploeg });
  assert.equal(r.uitgevoerd, false);
  assert.deepEqual(r.voorstel, [{ staffId: 2, naam: 'Nieuw', rol: 'Medewerker' }], 'wie al binnen is en wie geen account heeft, vallen erbuiten');
  assert.equal(r.alBinnen, 1);
  assert.equal(r.zonderAccount, 1);
  assert.equal(K.employmentVanPersoon('user-8', false).length, 0, 'een voorstel is geen dienstverband');
  assert.ok(!JSON.stringify(r).includes('user-8'), 'de ledensleutel gaat niet mee naar buiten');
});

test('11. met keuze alleen wie gekozen is EN in het voorstel staat', () => {
  const { K, e } = wereld();
  const r = K.dienstverbandInhaal({ zaak: 'BRISA', personeel: ploeg, keuze: [2, 3, 99] });
  assert.equal(r.uitgevoerd, true);
  assert.deepEqual(r.gemaakt.map(g => g.staffId), [2]);
  assert.deepEqual(r.overgeslagen.map(o => o.staffId).sort(), [3, 99], 'wie niet in het voorstel staat, wordt overgeslagen met de reden');
  assert.equal(K.employmentVanPersoon('user-8', false)[0].entiteit, e.id);
  assert.equal(K.employmentVanPersoon('user-7', false).length, 0, 'niet gekozen, dus niet vastgelegd');
  const t = K.dienstverbandToets({ zaak: 'BRISA', periode: '2026-09', personeel: ploeg });
  assert.deepEqual(t.bevindingen.filter(b => b.soort === 'loon_zonder_dienstverband').map(b => b.staffId), [1],
    'de loonrun ziet de inhaalslag');
});

test('12. een zaak op een andere vestiging geeft hetzelfde als niet bestaan', () => {
  const { K, e } = wereld();
  const ander = K.vestigingNieuw(e, { naam: 'Elders' }).vestiging;
  assert.equal(K.dienstverbandInhaal({ zaak: 'BRISA', vestiging: ander.id, personeel: ploeg, keuze: [2] }).status, 404);
  assert.equal(K.dienstverbandInhaal({ zaak: 'LOS', vestiging: ander.id, personeel: ploeg }).status, 404);
  assert.equal(K.employmentVanPersoon('user-8', false).length, 0);
  assert.equal(K.dienstverbandInhaal({ zaak: 'LOS', personeel: ploeg }).status, 409);
});

/* ---- DE DEUR, tegen een echte server (LAT: geen route zonder treffer) ----
   De volle weg met een gekoppelde zaak loopt in scripts/adamproef.js schakel 18;
   hier gaat het om de montage, de domeingrens en de eigendomscontrole. */
test('13. de inhaalroute draait mee en opent niets van een ander', async () => {
  const os = require('node:os');
  const { startServer, stop } = require('./helper');
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-inhaal-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  const post = async (pad, body, token) => {
    const r = await fetch(srv.base + pad, { method: 'POST', body: JSON.stringify(body || {}),
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  try {
    const lid = async (n) => (await post('/api/auth/register', { name: 'Inhaal ' + n, email: 'inh' + n + Date.now() + '@e.test',
      phone: '06' + String(Date.now() + n).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })).body.token;
    const A = await lid(1), B = await lid(2);
    const ent = (await post('/api/concern/entiteit/nieuw', { naam: 'Inhaal BV', land: 'NL' }, A)).body.entiteit;
    const ves = (await post('/api/concern/vestiging/nieuw', { entiteit: ent.id, naam: 'Hier' }, A)).body.vestiging;
    assert.ok(ves && ves.id, 'een vestiging om mee te werken');
    assert.equal((await post('/api/concern/vestiging/inhaal', { vestiging: ves.id, code: 'BRISA' })).status, 401);
    const vreemd = await post('/api/concern/vestiging/inhaal', { vestiging: ves.id, code: 'BRISA', keuze: [1] }, B);
    assert.equal(vreemd.status, 404, 'de vestiging van een ander: ' + JSON.stringify(vreemd.body));
    const los = await post('/api/concern/vestiging/inhaal', { vestiging: ves.id, code: 'BRISA', keuze: [1] }, A);
    assert.equal(los.status, 404, 'een zaak die niet aan deze vestiging hangt: ' + JSON.stringify(los.body));
    assert.equal((await post('/api/concern/mensen', { entiteit: ent.id }, A)).body.mensen.length, 0, 'er is niets vastgelegd');
  } finally { await stop(srv); fs.rmSync(TMP, { recursive: true, force: true }); }
});
