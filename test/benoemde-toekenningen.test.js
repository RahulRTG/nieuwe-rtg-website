/* BENOEMDE TOEKENNINGEN OP DE HUISWET (Fase 1, spoor 2).

   De machtiging van een vertegenwoordiger en de servicemachtiging hadden elk
   een eigen doorsnede. Ze lopen nu allebei over versmalNamens uit
   kern/namens/versmalling.js. Deze toetsen houden drie dingen vast:

   - wat de gever zelf mag, is een BRON van de doorsnede. Bij service is dat
     wat het lid bevestigde; zonder bevestiging gaat er niets open;
   - een onbekende bron levert nooit iets op (P4, over 10.000 gevallen);
   - de uitkomst voegt nooit iets toe (`overtreding()` blijft null). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { versmalNamens, overtreding } = require('../server/kern/namens/versmalling');
const M = require('../server/kern/vertegenwoordiging/machtiging');
const { SLEUTELS } = require('../server/kern/vertegenwoordiging/bevoegdheden');
const { versmalService } = require('../server/kern/service/machtiging-grenzen');

/* Een vaste generator, zodat een gevonden tegenvoorbeeld te herhalen is. */
function rng(zaad) {
  let s = zaad >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const kies = (r, lijst) => lijst.filter(() => r() < 0.5);
const RAAR = [null, undefined, 'tekst', 42, {}, new Set(['a'])];

test('P4. een onbekende of kapotte bron levert nooit iets op (10.000 gevallen)', () => {
  const r = rng(4);
  const ALLE = ['a', 'b', 'c', 'd', 'e'];
  let onbekendGezien = 0;
  for (let i = 0; i < 10000; i++) {
    const invoer = {};
    for (const k of ['gevraagd', 'geverEffectief', 'beleid', 'context']) {
      invoer[k] = r() < 0.2 ? RAAR[Math.floor(r() * RAAR.length)] : kies(r, ALLE);
    }
    const u = versmalNamens(invoer);
    const onbekend = ['gevraagd', 'geverEffectief', 'beleid', 'context']
      .some(k => !(Array.isArray(invoer[k]) || invoer[k] instanceof Set));
    if (onbekend) {
      onbekendGezien++;
      assert.equal(u.ok, false, 'een onbekende bron gaf ok: ' + JSON.stringify(invoer));
      assert.deepEqual(u.effectief, []);
      assert.equal(u.weigering.code, 'RTG_VERSMALLING_ONBEPAALBAAR');
    } else {
      assert.equal(overtreding(u, invoer), null, 'de doorsnede voegde iets toe');
    }
  }
  assert.ok(onbekendGezien > 1000, 'de generator maakte te weinig onbekende bronnen om iets te bewijzen');
});

const lijf = (extra) => M.vorm(Object.assign({
  client: 'C1', vertegenwoordiger: 'V1', hoedanigheid: 'zaakwaarnemer',
  bevoegdheden: SLEUTELS.slice(0, 4),
  tot: new Date(Date.now() + 30 * 86400000).toISOString()
}, extra || {})).machtiging;

test('vertegenwoordiging: weet niemand wat de cliënt mag, dan gaat er niets open', () => {
  const m = lijf();
  assert.ok(m, 'het lijf van de machtiging is ongeldig');
  for (const onbekend of [null, undefined, 'alles', {}]) {
    const r = M.versmalMachtiging(onbekend, m);
    assert.deepEqual(r.bevoegdheden, [], 'een onbekende cliëntgrens opende ' + JSON.stringify(r.bevoegdheden));
    assert.equal(r.onbepaalbaar.code, 'RTG_VERSMALLING_ONBEPAALBAAR');
    assert.deepEqual(r.buiten, m.bevoegdheden);
  }
  /* Een GEMETEN lege grens is iets anders: die is dicht, maar niet onbekend. */
  const leeg = M.versmalMachtiging([], m);
  assert.deepEqual(leeg.bevoegdheden, []);
  assert.equal(leeg.onbepaalbaar, null);
});

test('vertegenwoordiging: de uitkomst zit altijd in wat de cliënt mag EN in de machtiging (10.000 gevallen)', () => {
  const r = rng(7);
  for (let i = 0; i < 10000; i++) {
    const eigen = kies(r, SLEUTELS);
    const m = lijf({ bevoegdheden: kies(r, SLEUTELS).concat(r() < 0.3 ? ['verzonnen.recht'] : []) });
    if (!m) continue;
    const u = M.versmalMachtiging(eigen, m);
    for (const k of u.bevoegdheden) {
      assert.ok(eigen.includes(k) && m.bevoegdheden.includes(k), k + ' kwam erbij');
    }
    assert.equal(u.bevoegdheden.length + u.buiten.length, m.bevoegdheden.filter(k => SLEUTELS.includes(k)).length);
  }
});

test('service: zonder bevestiging van het lid gaat er niets open', () => {
  const u = versmalService({ gevraagd: ['organisatie.stand'], teamMag: ['organisatie.stand'], mens: 'nadia' });
  assert.deepEqual(u.gekregen, []);
  assert.equal(u.onbepaalbaar.code, 'RTG_VERSMALLING_ONBEPAALBAAR');
  assert.deepEqual(u.onbepaalbaar.onbekend, ['geverEffectief']);
});

test('service: wat het lid niet bevestigde, valt af met de gever als reden', () => {
  const u = versmalService({ gevraagd: ['organisatie.stand', 'betaling.stand'], bevestigd: ['organisatie.stand'],
    teamMag: ['organisatie.stand', 'betaling.stand'], mens: 'nadia' });
  assert.deepEqual(u.gekregen, ['organisatie.stand']);
  assert.deepEqual(u.geweigerd, ['betaling.stand']);
  assert.equal(u.versmald.find(v => v.sleutel === 'betaling.stand').bron, 'geverEffectief');
});

test('service: de route weigert zonder bevestiging en schrijft dan geen machtiging', () => {
  const db = { data: {} };
  const zaken = require('../server/kern/service/zaak')({ db, save: () => {}, crypto });
  const mach = require('../server/kern/service/machtiging')({ db, save: () => {}, crypto, zaken });
  const z = zaken.open({ melder: 'user-1', onderwerp: 'zaak', titel: 'Werkruimte reageert niet' }).zaak;
  const v = mach.verleen({ zaakId: z.id, mens: 'nadia', capabilities: ['organisatie.stand'],
    reden: 'de werkruimte reageert sinds gisteren niet' });
  assert.equal(v.status, 409, JSON.stringify(v));
  assert.equal((db.data.serviceMachtigingen || []).length, 0, 'er ontstond een machtiging zonder bevestiging');
  const ja = mach.verleen({ zaakId: z.id, mens: 'nadia', capabilities: ['organisatie.stand'],
    bevestigd: ['organisatie.stand'], reden: 'de werkruimte reageert sinds gisteren niet' });
  assert.ok(ja.ok, JSON.stringify(ja));
  assert.deepEqual(ja.machtiging.capabilities, ['organisatie.stand']);
});

/* A9: geldigheid en verval rekenen met de huisklok. Met RTG_KLOK een jaar
   vooruit is een machtiging van dertig dagen verlopen, ook al zegt de echte
   klok iets anders. Met Date.now zou deze toets slagen op de echte datum en
   de verschoven klok negeren. */
test('A9. een vertegenwoordigingsmachtiging verloopt op de huisklok', () => {
  const { execFileSync } = require('child_process');
  const prog = "const M=require('./server/kern/vertegenwoordiging/machtiging');" +
    "const {SLEUTELS}=require('./server/kern/vertegenwoordiging/bevoegdheden');" +
    "const m={hoedanigheid:'zaakwaarnemer',bevoegdheden:SLEUTELS.slice(0,2),ingetrokken:null," +
    "tot:new Date(Date.now()+30*86400000).toISOString(),aanvaard:{at:new Date().toISOString()}};" +
    "process.stdout.write(M.stand(m))";
  const stand = (klok) => execFileSync(process.execPath, ['-e', prog],
    { cwd: require('path').join(__dirname, '..'), env: Object.assign({}, process.env, { RTG_KLOK: klok, NODE_ENV: 'test' }) }).toString();
  assert.equal(stand(''), 'actief');
  assert.equal(stand('+1j'), 'verlopen', 'de machtiging negeert de huisklok');
});
