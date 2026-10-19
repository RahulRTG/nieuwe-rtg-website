/* DE MEDISCHE CONTEXT VAN EEN CARE-INTAKE STAAT NERGENS LEESBAAR IN DE OPSLAG.

   Gevonden door de voltooiproef van de zorgtab (scripts/lib/voltooi/tabzorg.js):
   zonder RTG_ENC_KEY stond wat een lid de behandelaar vooraf liet weten (art. 9
   AVG) gewoon leesbaar in de database, en een kopie ervan in elke boeking. Nu
   versleutelt server/kern/care/intakesleutel.js het veld zelf, gebonden aan de
   rij, en faalt het dicht.

   Drie dingen:
   1. na een intake en een boeking staat de tekst in GEEN enkel bestand in de
      datamap leesbaar -- ook niet zonder RTG_ENC_KEY;
   2. de behandelaar (de rechthebbende) ziet hem in zijn agenda, ook na een
      herstart van de server op dezelfde datamap;
   3. kan er niet versleuteld worden, dan wordt er niets gedeeld en niets
      bewaard -- geen leesbare terugval.

   Draai los: node --test test/care-intake-versleuteld.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-care-intake-'));
const MEDISCH = 'Ik gebruik bloedverdunners en ben allergisch voor penicilline ' + Date.now().toString(36);
let srv, base;
const api = (pad, body, t) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const start = async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'ZENITH', RTG_ENC_KEY: '' } }); base = srv.base; };

/* Elk bestand in de datamap, als ruwe bytes: wat een dief van de schijf ziet. */
function leesbaarOpSchijf(tekst) {
  const uit = [];
  (function loop(map) {
    for (const n of fs.readdirSync(map, { withFileTypes: true })) {
      const vol = path.join(map, n.name);
      if (n.isDirectory()) loop(vol);
      else if (fs.readFileSync(vol).includes(Buffer.from(tekst, 'utf8'))) uit.push(path.relative(TMP, vol));
    }
  })(TMP);
  return uit;
}

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een intake staat nergens leesbaar op schijf, en de behandelaar ziet hem, ook na een herstart', async () => {
  await start();
  const lid = (await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'rtg' }) }).then(r => r.json())).token;
  const spa = (await api('care', {}, lid)).body.aanbieders.find(a => a.soort === 'spa');
  const beh = spa.behandelingen[0];
  const deel = await api('care/intake/deel', { aanbiederId: spa.id, medisch: MEDISCH }, lid);
  assert.equal(deel.status, 200);
  const boek = await api('care/boek', { aanbiederId: spa.id, behandelingId: beh.id, datum: morgen(), tijd: beh.tijden[beh.tijden.length - 1] }, lid);
  assert.equal(boek.status, 200);
  assert.equal(boek.body.boeking.intake, MEDISCH, 'het lid ziet zijn eigen intake terug');
  assert.equal((await api('care/betaal', { ref: boek.body.boeking.ref }, lid)).status, 200);

  assert.deepEqual(leesbaarOpSchijf(MEDISCH), [], 'de medische context staat leesbaar op schijf');

  const agenda = async () => {
    const sup = (await api('supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
    const ag = await api('supplier/care/agenda', { datum: morgen() }, sup);
    return (ag.body.afspraken || []).find(x => x.ref === boek.body.boeking.ref) || {};
  };
  assert.equal((await agenda()).intake, MEDISCH, 'de behandelaar ziet de gedeelde intake');

  stop(srv.child);
  await start();
  assert.equal((await agenda()).intake, MEDISCH, 'na een herstart ziet de behandelaar hem nog steeds');
  assert.deepEqual(leesbaarOpSchijf(MEDISCH), [], 'ook na de herstart staat hij nergens leesbaar');
});

test('kan er niet versleuteld worden, dan wordt er niets gedeeld en niets bewaard', () => {
  const bak = { careIntake: [] };
  const opslag = { bak: (n) => (bak[n] = bak[n] || []), kijk: (n) => bak[n] || [], zetBak: (n, v) => { bak[n] = v; } };
  const leden = require('../server/kern/care/leden')({
    opslag, save: () => {}, crypto, schoon: (t, n) => String(t || '').slice(0, n), notify: () => {},
    zorgVoor: () => null, zorgMee: () => null, nu: () => new Date().toISOString(), vandaag: () => '2026-10-19',
    eur: (x) => x, INTAKE_DAGEN: 90, lijsten: () => {},
    aanbiederVan: () => ({ id: 'a1', naam: 'Kliniek' }), behandelingVan: () => null, intakeActief: () => null,
    intakesleutel: require('../server/kern/care/intakesleutel')({ haalSleutel: () => { throw new Error('geen sleutel'); } })
  });
  const r = leden.careIntakeDeel('lid-1', 'a1', 'Gevoelige medische tekst');
  assert.equal(r.status, 503, 'zonder sleutel hoort het delen te weigeren');
  assert.match(r.error, /niets gedeeld/);
  assert.equal(bak.careIntake.length, 0, 'er bleef toch een intake achter');
});

test('intakedeling blijft per lid en aanbieder, werkt dezelfde deling bij en laat alleen de eigenaar stoppen', () => {
  const rows = [], meldingen = [];
  let saves = 0;
  const sleutel = require('../server/kern/care/intakesleutel')({ haalSleutel: () => Buffer.alloc(32, 7) });
  const leden = require('../server/kern/care/leden')({
    opslag: { bak: n => { assert.equal(n, 'careIntake'); return rows; } },
    save: () => { saves++; }, crypto, schoon: (s, n) => String(s || '').slice(0, n),
    notify: (key, bericht) => meldingen.push({ key, bericht }), nu: () => '2026-10-20T00:00:00Z',
    INTAKE_DAGEN: 90, lijsten: () => {},
    aanbiederVan: id => id === 'a1' ? { id, naam: 'Kliniek' } : null,
    intakeActief: (key, id) => rows.find(r => r.key === key && r.aanbiederId === id && r.status === 'actief'),
    intakesleutel: sleutel
  });
  assert.equal(leden.careIntakeDeel('lid-1', 'onbekend', 'context').status, 404);
  assert.equal(leden.careIntakeDeel('lid-1', 'a1', '').status, 400);
  assert.equal(saves, 0);
  const eerste = leden.careIntakeDeel('lid-1', 'a1', 'eerste context');
  const tweede = leden.careIntakeDeel('lid-1', 'a1', 'nieuwe context');
  assert.equal(eerste.intake.id, tweede.intake.id);
  assert.equal(rows.length, 1);
  assert.equal(sleutel.open(rows[0].medisch, 'intake|' + eerste.intake.id + '|lid-1'), 'nieuwe context');
  assert.equal(sleutel.open(rows[0].medisch, 'intake|' + eerste.intake.id + '|lid-2'), null);
  assert.equal(leden.careIntakeStop('lid-2', eerste.intake.id).status, 404);
  assert.equal(rows[0].status, 'actief');
  assert.equal(saves, 2);
  assert.equal(leden.careIntakeStop('lid-1', eerste.intake.id).ok, true);
  assert.equal(leden.careIntakeStop('lid-1', eerste.intake.id).status, 404);
  assert.equal(saves, 3);
  assert.equal(rows[0].status, 'gestopt');
  assert.equal(meldingen.length, 2);
  assert.ok(meldingen.every(m => m.key === 'lid-1'));
});
