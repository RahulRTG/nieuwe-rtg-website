/* DE BEWIJSKETEN: waar komt dit bedrag vandaan, en klopt het nog.

   Vijf beweringen:

   1. VERKLAREN vouwt een periode open per tarief, met de facturen eronder, en
      controleert zichzelf tegen de aggregaat-telling die de aangifte gebruikt.
   2. EEN PERCENTAGE DAT DIE DAG NIET BESTOND wordt gemeld -- en de bewering
      blijft smal: niet "dit had 10% moeten zijn", maar "13% bestond die dag
      niet in dit land".
   3. HERBOUWEN uit de primaire bronnen komt op de cent uit, en meldt het
      verschil zodra er iets aan de facturen is veranderd.
   4. DE OMGEKEERDE WEG telt wat een regelwijziging raakt.
   5. EEN WIJZIGING DIE GEEN TARIEF RAAKT zegt dat, in plaats van een leeg
      lijstje dat op "niets aan de hand" lijkt.

   Draai los: node --experimental-sqlite --test test/fiscaal-herkomst.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { LANDEN, FISCAAL_PEILJAAR } = require('../server/kern/fiscaal');
const { maakJaargangen } = require('../server/kern/fiscaal/jaargangen');
const { maakHerkomst } = require('../server/kern/fiscaal/herkomst');

const ZAAK = { code: 'KIKUNOI', name: 'Kikunoi', settings: { land: 'NL' } };

// een factuur zoals de facturatiemotor hem boekt: het tarief staat PER REGEL
function factuur(nummer, datum, regels, verkoper) {
  const btwBedrag = regels.reduce((x, r) => x + Math.round(r.incl * 100) - Math.round(Math.round(r.incl * 100) / (1 + r.btw / 100)), 0) / 100;
  return { nummer, datum, verkoper: { code: verkoper || 'KIKUNOI', naam: 'Kikunoi' }, regels, btwBedrag };
}

function opstelling(facturen, wijziging) {
  const db = { data: { facturen: facturen || [] } };
  const { jaargangen } = maakJaargangen({ db, save: () => {}, LANDEN, peiljaar: FISCAAL_PEILJAAR });
  if (wijziging) jaargangen.neemOp(Object.assign({ land: 'NL', bron: { soort: 'kantoor' } }, wijziging));
  const { herkomst } = maakHerkomst({ db, jaargangen });
  return { db, jaargangen, herkomst };
}

test('verklaren vouwt de periode open per tarief en controleert zichzelf', () => {
  const o = opstelling([
    factuur('F-1', '2026-07-05', [{ incl: 109, btw: 9 }, { incl: 121, btw: 21 }]),
    factuur('F-2', '2026-08-11', [{ incl: 218, btw: 9 }]),
    factuur('F-3', '2026-10-01', [{ incl: 109, btw: 9 }]),          // buiten K3
    factuur('F-4', '2026-07-20', [{ incl: 121, btw: 21 }], 'ANDERE') // andere zaak
  ]);
  const v = o.herkomst.verklaar(ZAAK, '2026K3');

  assert.equal(v.periode, '2026K3');
  assert.deepEqual([v.van, v.tot], ['2026-07-01', '2026-09-30']);
  assert.equal(v.facturen, 2, 'alleen de eigen facturen binnen het vak');

  const negen = v.tarieven.find(t => t.tarief === 9);
  const eenentwintig = v.tarieven.find(t => t.tarief === 21);
  assert.equal(negen.btwCenten, 900 + 1800, 'F-1 regel 1 (9) + F-2 (18)');
  assert.equal(eenentwintig.btwCenten, 2100);
  assert.equal(v.verschuldigdCenten, 4800);

  // de facturen liggen eronder, per tarief
  assert.deepEqual(negen.facturen.map(f => f.nummer), ['F-1', 'F-2']);
  assert.equal(negen.facturen[0].btwCenten, 900);

  // en de opbouw sluit aan op de telling die de aangifte gebruikt
  assert.equal(v.sluitAan, true);
  assert.equal(v.afwijkingCenten, 0);
  assert.match(v.let, /nooit een factuur kreeg/i, 'de rand reist mee met de verklaring');
});

test('een percentage dat op die dag niet bestond, wordt gemeld -- en niet meer dan dat', () => {
  // NL kent op het peiljaar 0, 9 en 21. 13% bestaat daar niet.
  const o = opstelling([
    factuur('F-1', '2026-07-05', [{ incl: 113, btw: 13 }, { incl: 109, btw: 9 }])
  ]);
  const v = o.herkomst.verklaar(ZAAK, '2026K3');

  assert.equal(v.vreemdeTarieven.length, 1, 'alleen de 13% valt op');
  assert.equal(v.vreemdeTarieven[0].tarief, 13);
  assert.equal(v.vreemdeTarieven[0].nummer, 'F-1');
  assert.ok(v.vreemdeTarieven[0].bestond.includes(9) && v.vreemdeTarieven[0].bestond.includes(21),
    'hij zegt erbij welke tarieven er die dag wel waren');
  // de 9% is gewoon goed en wordt niet aangewezen
  assert.ok(!v.vreemdeTarieven.some(x => x.tarief === 9));

  /* Na een wijziging verschuift wat er "bestond": gaat eten op 1 augustus naar
     10%, dan is 10 vanaf dan een bestaand tarief en daarvoor niet. */
  const o2 = opstelling([
    factuur('F-A', '2026-07-05', [{ incl: 110, btw: 10 }]),
    factuur('F-B', '2026-08-05', [{ incl: 110, btw: 10 }])
  ], { wijzigingen: { tarieven: { eten: 10 } }, geldigVanaf: '2026-08-01' });
  const v2 = o2.herkomst.verklaar(ZAAK, '2026K3');
  assert.equal(v2.vreemdeTarieven.length, 1, 'alleen de julifactuur draagt een tarief dat toen niet bestond');
  assert.equal(v2.vreemdeTarieven[0].nummer, 'F-A');

  // zonder jaargangen wordt er niets beweerd: een controle zonder tabel is geen controle
  const zonder = maakHerkomst({ db: { data: { facturen: [factuur('F-1', '2026-07-05', [{ incl: 113, btw: 13 }])] } }, jaargangen: null });
  assert.equal(zonder.herkomst.verklaar(ZAAK, '2026K3').vreemdeTarieven.length, 0);
});

test('herbouwen komt op de cent uit, en meldt het verschil zodra het register wijzigt', () => {
  const o = opstelling([factuur('F-1', '2026-07-05', [{ incl: 121, btw: 21 }])]);
  const aangifte = { id: 'btw_1', code: 'KIKUNOI', periode: '2026K3', van: '2026-07-01', tot: '2026-09-30',
    stand: 'ingediend', verschuldigdCenten: 2100, voorbelastingCenten: 0, saldoCenten: 2100 };

  const groen = o.herkomst.herbouw(aangifte);
  assert.equal(groen.gelijk, true);
  assert.equal(groen.verschilCenten, 0);
  assert.equal(groen.herbouwd.verschuldigdCenten, 2100);
  assert.match(groen.uitslag, /op de cent gelijk/i);

  // er komt een factuur bij ná het indienen
  o.db.data.facturen.push(factuur('F-2', '2026-08-01', [{ incl: 121, btw: 21 }]));
  const rood = o.herkomst.herbouw(aangifte);
  assert.equal(rood.gelijk, false);
  assert.equal(rood.herbouwd.verschuldigdCenten, 4200);
  assert.equal(rood.verschilCenten, 2100);
  assert.match(rood.uitslag, /NIET gelijk/);
});

test('de omgekeerde weg: wat raakt deze regelwijziging', () => {
  const o = opstelling([
    factuur('F-1', '2026-06-20', [{ incl: 109, btw: 9 }]),   // voor de ingangsdatum
    factuur('F-2', '2026-07-05', [{ incl: 109, btw: 9 }]),   // erna, nog het oude tarief
    factuur('F-3', '2026-07-06', [{ incl: 110, btw: 10 }]),  // erna, het nieuwe
    factuur('F-4', '2026-07-07', [{ incl: 109, btw: 9 }], 'ANDERE')
  ], { wijzigingen: { tarieven: { eten: 10 } }, geldigVanaf: '2026-07-01' });

  const id = o.jaargangen.geschiedenis('NL')[0].id;
  const g = o.herkomst.geraakt('NL', id);

  assert.equal(g.tariefwijziging, true);
  assert.deepEqual(g.vervangen, [9], 'het percentage dat is vervangen');
  assert.equal(g.facturen, 2, 'F-2 en F-4: na de ingangsdatum en nog op 9%');
  assert.equal(g.regels, 2);
  assert.deepEqual(g.zaken.map(z => z.code).sort(), ['ANDERE', 'KIKUNOI']);
  assert.match(g.let, /hoeft niet fout te zijn/i, 'de nuance reist mee');

  assert.equal(o.herkomst.geraakt('NL', 'bestaatniet').status, 404);
});

test('een wijziging die geen tarief raakt, zegt dat met zoveel woorden', () => {
  const o = opstelling([factuur('F-1', '2026-07-05', [{ incl: 109, btw: 9 }])],
    { wijzigingen: { uurloonMin: 15.9 }, geldigVanaf: '2026-07-01' });
  const g = o.herkomst.geraakt('NL', o.jaargangen.geschiedenis('NL')[0].id);

  assert.equal(g.tariefwijziging, false);
  assert.equal(g.facturen, 0);
  assert.match(g.let, /raakt geen btw-tarief/i);
});

/* ------------------------------------------------------- door de API heen ---
   De poorten doen er hier meer toe dan bij de aangifte zelf: een verklaring
   vouwt de complete omzet per tarief open MET de factuurnummers eronder. Dat is
   zo mogelijk gevoeliger dan het totaal, dus dezelfde twee grenzen moeten
   gelden -- de zaak uit het token, en alleen een manager. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-herkomst-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  base = srv.base;
});
test.after(() => stop(srv && srv.child));

test('de zaak vouwt zijn eigen periode open en herbouwt zijn eigen aangifte', async () => {
  const tok = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  assert.ok(tok, 'leverancier-login');

  const f = await api(base, '/api/supplier/facturen/maak',
    { omschrijving: 'Consult', aantal: 1, bedrag: 121, koperNaam: 'Klant' }, tok);
  assert.equal(f.status, 200);
  const btwOpFactuur = Math.round(f.body.factuur.btwBedrag * 100);

  const nu = new Date();
  const periode = nu.getUTCFullYear() + 'K' + (Math.floor(nu.getUTCMonth() / 3) + 1);

  const v = await api(base, '/api/supplier/btw/verklaar', { periode }, tok);
  assert.equal(v.status, 200);
  assert.equal(v.body.periode, periode);
  assert.ok(v.body.verschuldigdCenten >= btwOpFactuur, 'de factuur van zojuist telt mee');
  assert.equal(v.body.sluitAan, true, 'de opbouw sluit aan op de telling van de aangifte');
  // de factuur ligt echt onder een tarief
  assert.ok(v.body.tarieven.some(t => t.facturen.some(x => x.nummer === f.body.factuur.nummer)),
    'het factuurnummer staat onder zijn tarief');

  // herbouwen van de eigen aangifte komt op de cent uit
  const op = await api(base, '/api/supplier/btw/opmaken', { periode }, tok);
  assert.equal(op.status, 200);
  const h = await api(base, '/api/supplier/btw/herbouw', { id: op.body.aangifte.id }, tok);
  assert.equal(h.status, 200);
  assert.equal(h.body.gelijk, true);
  assert.equal(h.body.verschilCenten, 0);
  assert.match(h.body.uitslag, /op de cent gelijk/i);
});

test('de bewijsketen laat niets van een andere zaak los', async () => {
  const tok = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
  const nu = new Date();
  const periode = nu.getUTCFullYear() + 'K' + (Math.floor(nu.getUTCMonth() / 3) + 1);

  // een code in het lijf verandert de zaak niet
  const eigen = (await api(base, '/api/supplier/btw/verklaar', { periode }, tok)).body;
  const gepoogd = await api(base, '/api/supplier/btw/verklaar', { periode, code: 'ANDERS', supplierCode: 'ANDERS' }, tok);
  assert.equal(gepoogd.status, 200);
  assert.equal(gepoogd.body.code, eigen.code, 'nog steeds de eigen zaak');

  // een aangifte-id dat niet van deze zaak is, bestaat hier niet
  const vreemd = await api(base, '/api/supplier/btw/herbouw', { id: 'btw_bestaatniet' }, tok);
  assert.equal(vreemd.status, 404);

  // en zonder geldig token komt er niets uit
  for (const pad of ['/api/supplier/btw/verklaar', '/api/supplier/btw/herbouw']) {
    assert.equal((await api(base, pad, { periode })).status, 401, pad + ' zonder token');
    assert.equal((await api(base, pad, { periode }, 'nep-token')).status, 401, pad + ' met een verzonnen token');
  }
});
