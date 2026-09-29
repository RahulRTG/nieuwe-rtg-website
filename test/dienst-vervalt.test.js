'use strict';
/* EEN DIENST DIE VERVALT, KRIJGT EEN BERICHT (kern/beveiliging/rooster/vervallen.js).

   Twee helften. De haak in het verzuimregister (kern/payroll/index.js,
   `naMelding`) roept een luisteraar aan bij een GEGEVEN melding en niet bij een
   geweigerde, en een luisteraar die gooit breekt de melding niet. De melding
   aan de zaak zegt DAT iemand afwezig is en welke post open ligt, nooit waarom,
   meldt per regel een keer, en schrapt niets. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakPayrollOS } = require('../server/kern/payroll/index.js');
const { BEVEILIGING_SHIFTS } = require('../server/kern/beveiliging');

test('het verzuimregister laat luisteraars horen wat er bijkwam, en een luisteraar breekt niets', () => {
  const os = maakPayrollOS({ db: { data: {} }, save: () => {}, crypto: require('node:crypto'), accounts: {} }).payrollOS;
  const gehoord = [];
  os.verzuim.naMelding(() => { throw new Error('stuk'); });
  os.verzuim.naMelding((code, staffId, m) => gehoord.push([code, staffId, m]));
  const fout = console.error; console.error = () => {};
  try {
    const r = os.verzuim.meld('Z', 7, { soort: 'ziek', van: '2026-10-01' }, 'Lid');
    assert.equal(r.ok, true, 'een luisteraar die gooit breekt de melding niet');
    assert.equal(os.verzuim.meld('Z', 7, { soort: 'ziek', van: '2026-10-01' }, '').ok, undefined);
  } finally { console.error = fout; }
  assert.equal(gehoord.length, 1, 'een geweigerde melding (zonder wie) wordt niet doorgegeven');
  assert.deepEqual(gehoord[0].slice(0, 2), ['Z', 7]);
  assert.equal(gehoord[0][2].soort, 'ziek', 'de luisteraar krijgt de vastgelegde regel');
});

function wereld(afwezig) {
  const berichten = [];
  const ctx = {
    db: { data: { bevDiensten: [] } }, save() {}, sseToSupplier() {},
    notifySupplier: (code, n) => berichten.push({ code, ...n }),
    afwezigOp: (code, id, datum) => afwezig(id, datum),
    findSupplier: code => (code === 'Z' ? { code: 'Z', type: 'beveiliging' } : code === 'H' ? { code: 'H', type: 'horeca' } : null),
    isBeveiliging: s => s.type === 'beveiliging',
    BEV_SHIFTS: BEVEILIGING_SHIFTS, shiftVan: sid => BEVEILIGING_SHIFTS.find(x => x.id === sid) || null,
    functieAan: () => true, vandaag: () => '2026-10-01', nu: () => 't',
    getal: (v, min, max, std) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : std; },
    defaults: () => ({ posten: [{ id: 'P', naam: 'Hoofdingang', klant: 'K', shifts: ['dag'], minMan: 1 }] }),
    id: (() => { let n = 0; return p => p + (++n); })(),
    guards: () => [{ id: 1 }, { id: 2 }], guardNaam: (s, g) => 'Bewaker ' + g,
    postVan: () => ({ id: 'P', naam: 'Hoofdingang', klant: 'K' }), diensten: () => ctx.db.data.bevDiensten
  };
  Object.assign(ctx, require('../server/kern/beveiliging/rooster/planning')(ctx));
  Object.assign(ctx, require('../server/kern/beveiliging/rooster/vervallen')(ctx));
  return { ctx, berichten };
}

test('een vastgestelde dienst van wie afwezig is, geeft een bericht: DAT, welke post, nooit waarom', () => {
  let ziek = false;
  const { ctx, berichten } = wereld((id) => (ziek && id === 1 ? { wat: 'afwezig', inzetbaarheid: 'niets' } : null));
  for (const datum of ['2026-09-30', '2026-10-01', '2026-10-03', '2026-10-30'])
    assert.ok(ctx.zetDienst({ code: 'Z' }, { postId: 'P', shiftId: 'dag', datum, guardId: 1 }).ok);
  assert.ok(ctx.zetDienst({ code: 'Z' }, { postId: 'P', shiftId: 'dag', datum: '2026-10-01', guardId: 2 }).ok);
  const melding = { id: 'vz_1-20261001-ziek', soort: 'ziek', van: '2026-10-01', tot: null };

  assert.equal(ctx.dienstVervalt('Z', 1, melding), 0, 'wie niet afwezig is, laat niets vervallen');
  ziek = true;
  assert.equal(ctx.dienstVervalt('Z', 1, melding), 2, 'vandaag en overmorgen; gisteren is voorbij en de 30e valt buiten twee weken');
  assert.equal(berichten.length, 1, 'een bericht voor alle geraakte diensten samen');
  const b = berichten[0];
  assert.equal(b.code, 'Z');
  assert.match(b.body, /^Bewaker 1 is afwezig\. Deze posten liggen weer open: Hoofdingang, .* op 2026-10-01; Hoofdingang, .* op 2026-10-03\. Herplannen doet een mens\.$/);
  assert.doesNotMatch(JSON.stringify(b), /ziek|verlof|vakantie/i, 'het bericht zegt nooit waarom');
  assert.ok(ctx.db.data.bevDiensten.every(d => d.status === 'gepland'), 'er is niets geschrapt');

  assert.equal(ctx.dienstVervalt('Z', 1, melding), 0, 'dezelfde regel opnieuw: geen tweede bericht');
  assert.equal(ctx.dienstVervalt('Z', 1, { ...melding, id: 'vz_1-20261001-ziek-b' }), 2, 'een nieuwe regel wel');
  assert.equal(ctx.dienstVervalt('Z', 1, { ...melding, id: 'x', van: '2026-10-02', tot: '2026-10-02' }), 0,
    'een afwezigheid op een dag zonder dienst raakt niets');
});

test('geen beveiligingszaak of geen melding: niets, en geen fout', () => {
  const { ctx, berichten } = wereld(() => ({ wat: 'afwezig', inzetbaarheid: null }));
  // ook als er (om wat voor reden ook) een dienst op de code van een andere zaak staat
  ctx.db.data.bevDiensten.push({ id: 'h1', supplierCode: 'H', guardId: 1, datum: '2026-10-01', shiftId: 'dag', postId: 'P', status: 'gepland' });
  assert.equal(ctx.dienstVervalt('H', 1, { id: 'a', van: '2026-10-01' }), 0);
  assert.equal(ctx.dienstVervalt('?', 1, { id: 'a', van: '2026-10-01' }), 0);
  assert.equal(ctx.dienstVervalt('Z', 1, null), 0);
  assert.equal(berichten.length, 0);
});
