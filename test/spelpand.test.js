/* HET PAND ALS PERSONAGE -- wat er op deze plek stond, over campagnes heen.

   De eerste wervel van de geschiedenislaag, en met opzet op het onderwerp met
   de minste uitzonderingen: een stuk grond.

   Acht beweringen, en ze zijn alle acht stil terug te draaien:

   1. WAT GEBEURD IS BLIJFT WAAR. Een periode wordt nooit herschreven.
   2. ER STAAT GEEN PERSOON IN -- alleen het bord op de gevel. Daarom valt deze
      laag buiten de 18+-poort, net als het stadsgeheugen.
   3. ER STAAT GEEN BEDRAG IN.
   4. HET LOG IS APPEND-ONLY en de volgorde is de waarheid.
   5. EEN OVERDRACHT BREEKT DE ZAAK NIET; het bord blijft hangen.
   6. HET WORDT EEN KEER OPGESCHREVEN, ook als de partij twee keer afsluit.
   7. HIJ SLIJT OP DE KLOK VAN DE STAD en niet op de kalender.
   8. DE SOORTEN ZIJN EEN GESLOTEN LIJST ZONDER DODE INGANGEN.

   Draai los: node --experimental-sqlite --test test/spelpand.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const LOG = require('../server/kern/spellen/magnaat/kavellog');
const maakPand = require('../server/kern/spellen/pandgeheugen');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };

function opstelling() {
  const m = maakMagnaat();
  const p = { id: 'pd1', soort: 'magnaat', spelers: ['anna', 'boris'], teams: [0, 1],
    modus: 'vrij', status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of p.spelers) p.staat.geld[h] = 5000000;
  const kav = kaart('ijmuiden').kavels.filter(k => k.zone === 'boulevard');
  const maand = (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } };
  return { m, p, st: p.staat, kav, maand };
}
const pandLaag = () => { const db = { data: {} }; return { db, P: maakPand({ db, save() {} }) }; };

/* ================= 1 en 4. het feit blijft staan ================= */

test('openen, sluiten en opnieuw openen geven drie perioden op een rij', () => {
  const { m, p, st, kav, maand } = opstelling();
  const k = kav[0].id;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: k, sector: 'retail', omvang: 20, naam: 'Bakkerij De Haven' });
  maand(12);
  m.eco.zet(p, 'anna', { actie: 'sluiten', id: st.vestigingen.anna[0].id });
  maand(6);
  m.eco.zet(p, 'boris', { actie: 'open', kavel: k, sector: 'kantoor', omvang: 20, naam: 'Rahul Hospitality' });
  const per = LOG.perioden(st, k);
  assert.equal(per.length, 2);
  assert.equal(per[0].naam, 'Bakkerij De Haven');
  assert.equal(per[0].sector, 'retail');
  assert.equal(per[0].tot, 12, 'de bakkerij liep tot maand 12');
  assert.equal(per[1].naam, 'Rahul Hospitality');
  assert.equal(per[1].vanaf, 18);
  assert.equal(per[1].tot, null, 'die loopt nog');
});

test('een oude periode wordt nooit herschreven door wat er later kwam', () => {
  const { m, p, st, kav, maand } = opstelling();
  const k = kav[0].id;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: k, sector: 'retail', omvang: 20, naam: 'De Eerste' });
  maand(5);
  m.eco.zet(p, 'anna', { actie: 'sluiten', id: st.vestigingen.anna[0].id });
  const eerst = JSON.stringify(LOG.perioden(st, k)[0]);
  m.eco.zet(p, 'boris', { actie: 'open', kavel: k, sector: 'hotel', omvang: 8, naam: 'De Tweede' });
  maand(9);
  assert.equal(JSON.stringify(LOG.perioden(st, k)[0]), eerst,
    'de eerste zaak staat er nog precies zoals hij was');
});

test('het log is append-only: er wordt nergens in geknipt', () => {
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/kavellog.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const woord of ['splice', 'shift(', 'pop(', 'sort(', 'reverse(', 'delete '])
    assert.ok(!bron.includes(woord), 'kavellog.js doet aan ' + woord);
  assert.ok(bron.includes('log.push('), 'hij schrijft alleen bij');
});

/* ================= 2 en 3. geen persoon, geen bedrag ================= */

test('er staat een bord op de gevel en geen eigenaar', () => {
  const { m, p, st, kav } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kav[0].id, sector: 'retail', omvang: 20, naam: 'De Haven' });
  const tekst = JSON.stringify(st.kavelLog);
  assert.ok(tekst.includes('De Haven'));
  for (const woord of ['anna', 'CN-', 'eigenaar', 'speler', 'werkgever'])
    assert.ok(!tekst.includes(woord), 'het log noemt ' + woord + ': ' + tekst);
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/kavellog.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/'[^']*'/g, "''");
  for (const woord of ['codenaam', 'eigenaar', 'geld', 'vermogen', 'progressieMag'])
    assert.ok(!bron.includes(woord), 'kavellog.js kent ' + woord);
});

test('hij valt buiten de 18+-poort, en dat kan omdat er niemand in staat', () => {
  /* Woordelijk dezelfde reden als bij stadsgeheugen.js: daar staat geen persoon
     in. De toets is de bouw -- deze modules krijgen geen `progressieMag` en
     kunnen er dus ook niet omheen. */
  for (const pad of ['../server/kern/spellen/pandgeheugen.js',
    '../server/kern/spellen/magnaat/kavellog.js']) {
    const bron = require('fs').readFileSync(require.resolve(pad), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!bron.includes('progressieMag'), pad + ' kent de poort');
  }
  const kop = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/pandgeheugen.js'), 'utf8');
  assert.match(kop, /geen persoon in/, 'en zegt zelf waarom dat mag');
});

test('er komt geen bedrag mee naar de stad', () => {
  const { m, p, st, kav, maand } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kav[0].id, sector: 'hotel', omvang: 9, naam: 'Grand' });
  maand(8);
  p.status = 'klaar';
  const { P } = pandLaag();
  P.onthoud(p);
  const opslag = JSON.stringify(P.voorKavel('IJmuiden', kav[0].id));
  assert.ok(!/\d{4,}/.test(opslag), 'geen bedragen: ' + opslag);
  for (const woord of ['geld', 'waarde', 'bouwsom', 'omzet'])
    assert.ok(!opslag.includes(woord), 'de stad onthoudt ' + woord);
});

/* ================= 5. een overdracht breekt de zaak niet ================= */

test('wie zijn zaak doorgeeft laat het bord hangen', () => {
  const { m, p, st, kav, maand } = opstelling();
  const k = kav[0].id;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: k, sector: 'horeca', omvang: 25, naam: 'Havenzicht' });
  maand(20);
  assert.ok(m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'boris' }).ok);
  const per = LOG.perioden(st, k);
  assert.equal(per.length, 1, 'een overdracht is geen nieuwe zaak: ' + JSON.stringify(per));
  assert.equal(per[0].naam, 'Havenzicht');
  assert.equal(per[0].vanaf, 0);
  assert.equal(per[0].tot, null, 'hij draait door');
  /* Maar de gebeurtenis staat er wel: het FEIT blijft waar. */
  assert.ok(st.kavelLog.some(r => r.wat === 'overgedragen' && r.kavel === k));
});

test('wie zonder opvolger uitstapt, laat het pand leeg achter', () => {
  const { m, p, st, kav, maand } = opstelling();
  const k = kav[0].id;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: k, sector: 'horeca', omvang: 25, naam: 'Havenzicht' });
  maand(14);
  assert.ok(m.eco.zet(p, 'anna', { actie: 'uitstappen' }).ok);
  const per = LOG.perioden(st, k);
  assert.equal(per[0].tot, 14, 'de zaak eindigde toen hij vertrok');
  assert.equal(st.kavelBezet[k], undefined, 'en het kavel is weer vrij');
});

/* ================= de stad onthoudt het ================= */

test('de stad houdt over wat er stond, oudste eerst', () => {
  const { m, p, st, kav, maand } = opstelling();
  const k = kav[0].id;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: k, sector: 'retail', omvang: 20, naam: 'Bakkerij De Haven' });
  maand(30);
  m.eco.zet(p, 'anna', { actie: 'sluiten', id: st.vestigingen.anna[0].id });
  maand(12);
  m.eco.zet(p, 'boris', { actie: 'open', kavel: k, sector: 'kantoor', omvang: 20, naam: 'Rahul Hospitality' });
  maand(20);
  p.status = 'klaar';
  const { P } = pandLaag();
  const r = P.onthoud(p);
  assert.ok(r && r.perioden >= 2, JSON.stringify(r));
  const g = P.voorKavel('IJmuiden', k);
  assert.equal(g.perioden.length, 2);
  assert.equal(g.perioden[0].naam, 'Bakkerij De Haven');
  assert.equal(g.perioden[1].naam, 'Rahul Hospitality');
  assert.ok(g.perioden[0].vanaf < g.perioden[1].vanaf, 'oudste eerst');
});

test('een kavel waar nooit iets stond heeft geen geschiedenis en geen fout', () => {
  const { P } = pandLaag();
  assert.deepEqual(P.voorKavel('IJmuiden', 'bestaat-niet').perioden, []);
  assert.equal(P.beeld('Atlantis').kavels, 0);
});

/* ================= 6, 7, 8 ================= */

test('een partij wordt maar een keer opgevouwen', () => {
  const { m, p, kav, maand } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kav[0].id, sector: 'retail', omvang: 20, naam: 'Een' });
  maand(6);
  p.status = 'klaar';
  const { P } = pandLaag();
  assert.ok(P.onthoud(p));
  assert.equal(P.onthoud(p), null, 'de tweede keer gebeurt er niets');
  assert.equal(P.voorKavel('IJmuiden', kav[0].id).perioden.length, 1);
});

test('een periode zakt van het bord na genoeg campagnes, niet na genoeg dagen', () => {
  const { m, p, kav, maand } = opstelling();
  const k = kav[0].id;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: k, sector: 'retail', omvang: 20, naam: 'De Oudste' });
  maand(6);
  p.status = 'klaar';
  const { db, P } = pandLaag();
  P.onthoud(p);
  assert.equal(P.voorKavel('IJmuiden', k).perioden.length, 1);
  db.data.pandgeheugen.ijmuiden.potjes += maakPand.SLIJTAGE_POTJES;
  assert.deepEqual(P.voorKavel('IJmuiden', k).perioden, [], 'na genoeg campagnes is hij vergeten');
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(JSON.stringify(db.data.pandgeheugen)), 'geen kalender in de opslag');
});

test('een plek onthoudt hoogstens twaalf voorgangers, en vergeet de oudste', () => {
  const { db, P } = pandLaag();
  const nep = (n) => ({ id: 'x' + n, status: 'klaar', variant: { stad: 'IJmuiden' },
    staat: { kavelLog: [{ maand: 0, kavel: 'k1', wat: 'geopend', naam: 'Zaak ' + n, sector: 'retail' },
      { maand: 5, kavel: 'k1', wat: 'gesloten' }] } });
  for (let i = 0; i < maakPand.MAX_PERIODEN + 4; i++) P.onthoud(nep(i));
  const rij = P.voorKavel('IJmuiden', 'k1').perioden;
  assert.equal(rij.length, maakPand.MAX_PERIODEN);
  assert.equal(rij[rij.length - 1].naam, 'Zaak ' + (maakPand.MAX_PERIODEN + 3), 'het jongste staat er nog');
  assert.ok(!rij.some(p => p.naam === 'Zaak 0'), 'en het oudste is eruit gevallen');
});

test('de soorten zijn een gesloten lijst zonder dode ingangen', () => {
  /* Een lijst met soorten die niemand schrijft, zegt niet meer wat er kan
     gebeuren. Elke soort hoort door minstens een aanroeper gebruikt te worden. */
  const fs = require('fs'), path = require('path');
  const map = path.dirname(require.resolve('../server/kern/spellen/magnaat/kavellog.js'));
  let bron = '';
  for (const f of fs.readdirSync(map))
    if (f.endsWith('.js') && f !== 'kavellog.js') bron += fs.readFileSync(path.join(map, f), 'utf8');
  for (const soort of LOG.SOORTEN)
    assert.ok(bron.includes("wat: '" + soort + "'"), 'niemand schrijft ooit ' + soort);
  assert.throws(() => LOG.schrijf({ maand: 0 }, { kavel: 'k', wat: 'verzonnen' }), /onbekende gebeurtenis/);
});
