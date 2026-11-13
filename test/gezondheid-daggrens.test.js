'use strict';
/* De huisdag van de voltooi-fixture moet dezelfde zijn als die van de echte
   dageigenaren. Pure regressie: geen server, geen actuele klok als testdata. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const tijdzone = require('../server/kern/tijdzone');
const maakGewoonten = require('../server/kern/gewoonten');
const maakMetingen = require('../server/kern/metingen');
const maakGemoed = require('../server/kern/gemoed');
const maakLife = require('../server/kern/life');

function wereld() {
  const db = { data: {} };
  const invoer = { db, save() {}, crypto: require('node:crypto'),
    schoon: (s, n) => String(s == null ? '' : s).trim().slice(0, n) };
  return { db, g: maakGewoonten(invoer), m: maakMetingen(invoer), c: maakGemoed(invoer) };
}

for (const [naam, moment, vandaag] of [
  ['voltooi-fout na lokale middernacht', '2026-11-11T23:13:50Z', '2026-11-12'],
  ['zomernacht', '2026-07-15T22:30:00Z', '2026-07-16'],
  ['vlak voor lokale middernacht', '2026-11-11T22:59:00Z', '2026-11-11'],
  ['gewone middag', '2026-11-12T12:00:00Z', '2026-11-12']
]) {
  const nu = new Date(moment);
  const morgen = tijdzone.plusDagen(vandaag, 1);

  test('gewoonten: ' + naam + ' deelt de fixturedag en behoudt de tik', () => {
    const { g } = wereld();
    const id = g.gewoonteMaak('lid', { naam: 'Wandelen' }, nu).gewoonte.id;
    const aan = g.gewoonteTik('lid', { id, op: vandaag }, nu);
    assert.equal(aan.ok, true, JSON.stringify(aan));
    assert.equal(aan.gewoonte.vandaagGedaan, true);
    assert.deepEqual(aan.gewoonte.dagen, [vandaag]);
    assert.equal(g.gewoonteTik('lid', { id, op: morgen }, nu).status, 400);
    assert.equal(g.gewoonteTik('ander', { id, op: vandaag }, nu).status, 404);
    assert.deepEqual(g.gewoonteTik('lid', { id }, nu).gewoonte.dagen, [], 'impliciet vandaag is dezelfde dag');
    g.gewoonteTik('lid', { id }, nu);
    assert.equal(g.gewoonteReeks('lid', { id, aan: true }, nu).gewoonte.reeks, 1);
    assert.deepEqual(g.gewoonteReeks('lid', { id, aan: false }, nu).gewoonte.dagen, [vandaag]);
  });

  test('metingen en check-in: ' + naam + ' schrijven en wissen dezelfde huisdag', () => {
    const { m, c } = wereld();
    assert.equal(m.metingZet('lid', { onderwerp: 'slaap', waarde: 7.5 }, nu).ok, true);
    assert.equal(m.metingenVan('lid', nu).vandaag, vandaag);
    assert.equal(m.metingenHistorie('lid')[0].op, vandaag);
    assert.equal(m.metingZet('lid', { onderwerp: 'slaap', waarde: 8, op: morgen }, nu).status, 400);
    assert.equal(m.metingenVan('ander', nu).beeld.slaap.vandaag, null);
    assert.equal(m.metingWeg('lid', { onderwerp: 'slaap', op: vandaag }, nu).ok, true);
    assert.equal(m.metingWeg('lid', { onderwerp: 'slaap', op: vandaag }, nu).status, 404);
    assert.equal(m.metingenVan('lid', nu).beeld.slaap.vandaag, null);

    assert.equal(c.gemoedZet('lid', { stemming: 'goed' }, nu).ok, true);
    const gelezen = c.gemoedVan('lid', nu);
    assert.equal(gelezen.vandaag, vandaag);
    assert.equal(gelezen.recent[0].op, vandaag);
    assert.equal(gelezen.vandaagIngevuld.stemming, 'goed');
    assert.equal(c.gemoedVan('ander', nu).vandaagIngevuld, null);
    assert.equal(c.gemoedWeg('lid', { op: vandaag }, nu).ok, true);
    assert.equal(c.gemoedWeg('lid', { op: vandaag }, nu).status, 404);
  });

  test('Life: ' + naam + ' noemt de meetdag vandaag en de volgende afspraak morgen', () => {
    const { m, c } = wereld();
    m.metingZet('lid', { onderwerp: 'slaap', waarde: 7.5 }, nu);
    c.gemoedZet('lid', { stemming: 'goed' }, nu);
    const l = maakLife({ kern: { metingenVan: m.metingenVan,
      careMijn: () => ({ boekingen: [tijdzone.plusDagen(vandaag, -1), morgen].map(datum =>
        ({ datum, tijd: '10:00', behandelingNaam: 'Controle', aanbiederNaam: 'Praktijk' })) }) } });
    const beeld = l.lifeVoor('lid', 'naam', nu);
    assert.equal(beeld.vandaag, vandaag);
    assert.equal(beeld.vandaag, m.metingenVan('lid', nu).vandaag);
    assert.equal(beeld.vandaag, c.gemoedVan('lid', nu).vandaag);
    assert.deepEqual(beeld.afspraken.map(a => a.datum), [morgen], 'gisteren blijft niet als komende afspraak staan');
    assert.equal(beeld.winst.kop, 'Morgen');
    assert.equal(beeld.signalen.find(s => s.id === 'slaap').waarde, 7.5);
    assert.doesNotMatch(beeld.signalen.find(s => s.id === 'slaap').uitleg, /Vandaag nog niets/);
  });
}

for (const [naam, moment, vandaag] of [
  ['zomertijd begint', '2026-03-30T22:30:00Z', '2026-03-31'],
  ['zomertijd eindigt', '2026-10-25T22:30:00Z', '2026-10-25']
]) {
  test('kalenderdagen: ' + naam + ' telt geen dag dubbel en slaat geen dag over', () => {
    const nu = new Date(moment);
    const dagen = Array.from({ length: 4 }, (_, i) => tijdzone.plusDagen(vandaag, i - 3));
    assert.equal(maakGewoonten.reeksVan(dagen, nu), 4);
    assert.equal(maakGewoonten.reeksVan(dagen.slice(0, -1), nu), 3, 'vandaag mag nog open staan');
    const { g } = wereld();
    const id = g.gewoonteMaak('lid', { naam: 'Wandelen' }, nu).gewoonte.id;
    const grens = tijdzone.plusDagen(vandaag, -(maakGewoonten.VENSTER - 1));
    g.gewoonteTik('lid', { id, op: tijdzone.plusDagen(grens, -1) }, nu);
    g.gewoonteTik('lid', { id, op: grens }, nu);
    assert.deepEqual(g.gewoontenVan('lid', nu).gewoonten[0].dagen, [grens]);
    const meetGrens = tijdzone.plusDagen(vandaag, -(maakMetingen.VENSTER - 1));
    const beeld = maakMetingen.beeldVan([
      { op: tijdzone.plusDagen(meetGrens, -1), waarde: 24, bron: 'zelf' },
      { op: meetGrens, waarde: 6, bron: 'zelf' },
      { op: vandaag, waarde: 8, bron: 'zelf' }
    ], 'slaap', nu);
    assert.equal(beeld.dagen, 2);
    assert.equal(beeld.gemiddelde, 7);
    assert.equal(beeld.vandaag, 8);
  });
}

test('ook zonder meegegeven Date delen fixture en dageigenaren de bestaande proefklok', () => {
  const uit = execFileSync(process.execPath, ['-e', `
    const tijdzone = require('./server/kern/tijdzone');
    const invoer = { db: { data: {} }, save() {}, crypto: require('node:crypto'), schoon: s => String(s || '') };
    const g = require('./server/kern/gewoonten')(invoer);
    const m = require('./server/kern/metingen')(invoer);
    const c = require('./server/kern/gemoed')(invoer);
    const l = require('./server/kern/life')({ kern: m });
    const id = g.gewoonteMaak('lid', { naam: 'Wandelen' }).gewoonte.id;
    console.log(JSON.stringify([tijdzone.huis().datum, g.gewoonteTik('lid', { id }).gewoonte.dagen[0],
      m.metingenVan('lid').vandaag, c.gemoedVan('lid').vandaag, l.lifeVoor('lid', 'naam').vandaag]));
  `], { encoding: 'utf8', cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, TZ: 'UTC', NODE_ENV: 'test', RTG_KLOK: '2026-11-11T23:13:50Z' } });
  assert.deepEqual(JSON.parse(uit.trim()), Array(5).fill('2026-11-12'));
});
