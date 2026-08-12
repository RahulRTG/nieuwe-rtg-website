/* DE LOOPBAAN -- wat er van een mens overblijft als het potje voorbij is.

   VERHAAL.md stap 0, 2, 4 en 5. Acht beweringen, en ze zijn alle acht stil
   terug te draaien:

   1. ACHTTIEN PLUS, PER PERSOON. Een werkverleden is bewaarde progressie tussen
      twee mensen, dus geldt `progressieMag` -- en per PERSOON, niet per potje.
   2. ER KOMT GEEN BEDRAG MEE. Blijvende waarde komt uit tijd en uit wat je
      deed, nooit uit geld.
   3. HET IS VAN DE PERSOON, op zijn codenaam.
   4. EEN MOMENT BESTAAT ALLEEN MET EEN TWEEDE MENS.
   5. EEN EERSTE IS MAAR EEN KEER EEN EERSTE.
   6. HET WORDT EEN KEER OPGESCHREVEN, ook als de partij twee keer afsluit.
   7. WIE STOPT NEEMT ZIJN EIGEN KANT MEE, en die van de ander blijft staan.
   8. DE TERUGBLIK IS EEN VERHAAL EN GEEN TABEL.

   Draai los: node --experimental-sqlite --test test/spelloopbaan.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const maakLoopbaan = require('../server/kern/spellen/loopbaan');
const { MOMENTEN, duur } = require('../server/kern/spellen/loopbaan-momenten');

/* `volwassen` is hier een lijst en geen ja/nee, want de scherpste vraag van deze
   laag is wat er gebeurt als een volwassene en een tiener SAMEN speelden. */
function opstelling(volwassenen) {
  const db = { data: {} };
  const groep = new Set(volwassenen || ['rahul', 'mike']);
  const L = maakLoopbaan({ db, save() {}, codenaamVan: (h) => 'CN-' + h,
    progressieMag: (h) => groep.has(h), GEEN_PROGRESSIE: 'Alleen voor 18-plus.' });
  return { db, L };
}
const potjeMet = (diensten, vestigingen) => ({ id: 'p1', status: 'klaar',
  staat: { diensten, vestigingen: vestigingen || {} } });

/* ================= 1. de grens, en hij geldt per persoon ================= */

test('onder de achttien wordt er niets bewaard, en dat wordt gezegd', () => {
  const { db, L } = opstelling([]);           // niemand is volwassen
  const r = L.onthoudBaan('mike', 'CN-mike', { werkgever: 'CN-rahul', rol: 'hulp', maanden: 12 });
  assert.equal(r.bewaard, false);
  assert.match(r.reden, /18/);
  assert.deepEqual(L.alle(), {}, 'er staat geen spoor, ook geen leeg vakje');
  /* En het wordt GEZEGD in plaats van stil weggelaten: een tiener die denkt dat
     zijn loopbaan bewaard wordt, komt bedrogen uit. */
  assert.equal(L.terugblik('mike', 'CN-mike').mag, false);
  assert.match(L.terugblik('mike', 'CN-mike').reden, /18/);
});

test('de grens geldt per PERSOON en niet per potje', () => {
  /* DE SCHERPSTE VRAAG VAN DEZE LAAG. Een volwassene die met een tiener speelde
     houdt zijn eigen kant; de tiener houdt niets. Zou de grens per POTJE gelden,
     dan verliest de volwassene zijn geschiedenis omdat er een kind meespeelde,
     of -- veel erger -- krijgt het kind er een. */
  const { L } = opstelling(['rahul']);        // alleen de werkgever is volwassen
  L.noteerLoopbaan(potjeMet([{ werknemer: 'mike', werkgever: 'rahul', rol: 'hulp', maanden: 14 }]));
  assert.equal(L.terugblik('mike', 'CN-mike').mag, false, 'de tiener houdt niets');
  const vanRahul = L.terugblik('rahul', 'CN-rahul');
  assert.equal(vanRahul.mag, true);
  assert.equal(vanRahul.momenten.length, 1, 'en de volwassene houdt zijn eigen kant');
  assert.equal(vanRahul.momenten[0].soort, 'eerste_mens');
  assert.equal(vanRahul.banen.length, 0, 'hij had zelf geen baan');
});

/* ================= 2 en 3. tijd, geen geld, en van wie ================= */

test('er komt geen bedrag mee, hoe verleidelijk het ook in de gegevens staat', () => {
  /* In `diensten` staan een `loon` en een `betaaldTotaal`. Die blijven waar ze
     horen: in het potje. Blijvende waarde komt uit tijd en uit wat je deed. */
  const { L } = opstelling();
  L.noteerLoopbaan(potjeMet([{ werknemer: 'mike', werkgever: 'rahul', rol: 'bedrijfsleider',
    rolnaam: 'Bedrijfsleider', maanden: 20, loon: 4320, betaaldTotaal: 86400 }]));
  const alles = JSON.stringify(L.alle());
  assert.ok(!alles.includes('4320'), 'geen loon');
  assert.ok(!alles.includes('86400'), 'geen totaal');
  assert.ok(alles.includes('20'), 'wel de maanden');
  const t = L.terugblik('mike', 'CN-mike');
  assert.ok(!JSON.stringify(t).includes('4320'));
  assert.equal(t.gewerkt, '1 jaar 8 maanden');
});

test('een loopbaan staat op de codenaam en draagt geen mens', () => {
  const { db, L } = opstelling();
  L.noteerLoopbaan(potjeMet([{ werknemer: 'mike', werkgever: 'rahul', rol: 'hulp', maanden: 9 }]));
  assert.deepEqual(Object.keys(db.data.loopbaan).sort(), ['CN-mike', 'CN-rahul']);
  const alles = JSON.stringify(db.data.loopbaan);
  assert.ok(!alles.includes('"mike"'), 'de sleutel van de speler staat er niet in');
  assert.ok(!alles.includes('"rahul"'));
});

/* ================= 4 en 5. de momenten ================= */

test('een moment zonder tweede mens bestaat niet', () => {
  /* DE WET VAN DEZE LAAG. Hij maakt het onvervalsbaar -- je kunt jezelf geen
     verleden geven -- en het is precies waarom die zinnen blijven hangen. */
  const { L } = opstelling();
  const r = L.onthoud('mike', 'CN-mike', 'eerste_zaak', { wat: 'iets' });
  assert.equal(r.bewaard, false);
  assert.match(r.reden, /tweede mens/);
  assert.equal(L.terugblik('mike', 'CN-mike').momenten.length, 0);
  assert.ok(L.onthoud('mike', 'CN-mike', 'eerste_zaak', { samen: 'CN-rahul', wat: 'twee jaar' }).bewaard);
});

test('een eerste is maar een keer een eerste', () => {
  const { L } = opstelling();
  assert.ok(L.onthoud('mike', 'CN-mike', 'eerste_baan', { samen: 'CN-rahul', wat: 'hulp' }).bewaard);
  const twee = L.onthoud('mike', 'CN-mike', 'eerste_baan', { samen: 'CN-lisa', wat: 'hulp' });
  assert.equal(twee.bewaard, false);
  assert.match(twee.reden, /had je al/);
  // maar wat geen eerste is, mag wel vaker
  assert.ok(L.onthoud('mike', 'CN-mike', 'opgeleid', { samen: 'CN-a', wat: 'een jaar' }).bewaard);
  assert.ok(L.onthoud('mike', 'CN-mike', 'opgeleid', { samen: 'CN-b', wat: 'twee jaar' }).bewaard);
  assert.equal(L.terugblik('mike', 'CN-mike').momenten.length, 3);
});

test('een verzonnen soort moment bestaat niet', () => {
  const { L } = opstelling();
  assert.equal(L.onthoud('mike', 'CN-mike', 'won_de_loterij', { samen: 'CN-x' }).bewaard, false);
});

test('de leerling die zelf begon levert aan BEIDE kanten een moment op', () => {
  /* Hoofdstuk 9, en de mooiste van de zes. Alleen als hij aan het eind ook echt
     een eigen zaak had -- anders is het een voornemen en geen moment. */
  const { L } = opstelling();
  L.noteerLoopbaan(potjeMet(
    [{ werknemer: 'mike', werkgever: 'rahul', rol: 'hulp', maanden: 38 }],
    { mike: [{ id: 'v1' }] }));
  const soortenVan = (h, c) => L.terugblik(h, c).momenten.map(m => m.soort).sort();
  assert.deepEqual(soortenVan('mike', 'CN-mike'), ['eerste_baan', 'eerste_zaak']);
  assert.deepEqual(soortenVan('rahul', 'CN-rahul'), ['eerste_mens', 'opgeleid']);
  // zonder eigen zaak blijft het bij de baan
  const b = opstelling();
  b.L.noteerLoopbaan(potjeMet([{ werknemer: 'mike', werkgever: 'rahul', rol: 'hulp', maanden: 38 }]));
  assert.deepEqual(b.L.terugblik('mike', 'CN-mike').momenten.map(m => m.soort), ['eerste_baan']);
});

/* ================= 6. een keer opschrijven ================= */

test('een afgelopen partij wordt EEN keer opgeschreven', () => {
  /* Hij hangt aan `naPotje` in spellen/partij.js, en dat is dezelfde plek als
     de uitslag en het toernooi -- aangeroepen vanuit een winnende zet EN vanuit
     opgeven. Zonder de vlag staat dezelfde baan er twee keer. */
  const { L } = opstelling();
  const p = potjeMet([{ werknemer: 'mike', werkgever: 'rahul', rol: 'hulp', maanden: 9 }]);
  L.noteerLoopbaan(p);
  L.noteerLoopbaan(p);
  L.noteerLoopbaan(p);
  assert.equal(L.terugblik('mike', 'CN-mike').banen.length, 1);
});

test('een lopende partij en een partij zonder dienstverbanden leveren niets op', () => {
  const { L } = opstelling();
  assert.equal(L.noteerLoopbaan({ id: 'p', status: 'bezig', staat: { diensten: [
    { werknemer: 'mike', werkgever: 'rahul', rol: 'hulp', maanden: 9 }] } }), null);
  assert.equal(L.noteerLoopbaan({ id: 'q', status: 'klaar', staat: {} }), null);
  /* En een dienstverband dat nooit een maand liep is geen werkverleden -- aan
     GEEN van beide kanten. Die tweede helft is de helft die telt: iemand
     aannemen die nooit begon, is geen herinnering. Zonder deze regel krijgt de
     werkgever een `eerste_mens` voor een naam die er nooit was. */
  L.noteerLoopbaan(potjeMet([{ werknemer: 'mike', werkgever: 'rahul', rol: 'hulp', maanden: 0 }]));
  assert.equal(L.terugblik('mike', 'CN-mike').banen.length, 0);
  assert.equal(L.terugblik('mike', 'CN-mike').momenten.length, 0);
  assert.equal(L.terugblik('rahul', 'CN-rahul').momenten.length, 0, 'ook de werkgever houdt niets');
});

/* ================= 7. wie stopt ================= */

test('wie stopt neemt zijn eigen kant mee, en die van de ander blijft', () => {
  /* Drie dingen, alle drie asymmetrisch met opzet: dat jij drie jaar voor
     iemand werkte is ook DIENS geschiedenis, en die mag niet verdwijnen omdat
     de ander vertrekt. Wat overblijft is een codenaam zonder mens. */
  const { L } = opstelling();
  L.noteerLoopbaan(potjeMet([{ werknemer: 'mike', werkgever: 'rahul', rol: 'hulp', maanden: 38 }]));
  assert.ok(L.terugblik('mike', 'CN-mike').banen.length);
  const r = L.stoptErmee('CN-mike');
  assert.equal(r.weg, true);
  assert.equal(L.terugblik('mike', 'CN-mike').banen.length, 0, 'zijn eigen kant is weg');
  const vanRahul = L.terugblik('rahul', 'CN-rahul');
  assert.equal(vanRahul.momenten.length, 1, 'en die van rahul staat er nog');
  assert.equal(vanRahul.momenten[0].samen, 'CN-mike', 'op codenaam, zonder mens erachter');
});

/* ================= 8. een verhaal en geen tabel ================= */

test('de terugblik geeft zinnen, geen cijfers', () => {
  /* Hoofdstuk 13. Een terugblik die uit getallen bestaat is de eindstand met
     een andere naam; die staat er al. */
  const { L } = opstelling();
  L.noteerLoopbaan(potjeMet(
    [{ werknemer: 'mike', werkgever: 'rahul', rol: 'hulp', maanden: 38 }],
    { mike: [{ id: 'v1' }] }));
  const t = L.terugblik('mike', 'CN-mike');
  assert.equal(t.begin.werkgever, 'CN-rahul', 'waar je begon is de zin waar het om draait');
  assert.equal(t.begin.duur, '3 jaar 2 maanden');
  for (const m of t.momenten) {
    assert.ok(typeof m.zin === 'string' && m.zin.length > 10, m.soort + ' heeft een zin');
    assert.ok(!/\d[\d.,]*\s*(euro|EUR|â‚¬)/i.test(m.zin), 'en er staat geen bedrag in: ' + m.zin);
    assert.ok(m.zin.includes(m.samen), 'en de ander staat erin: ' + m.zin);
  }
  assert.ok(t.momenten.some(m => /afwasser|hulp/.test(m.zin) || m.soort === 'eerste_baan'));
});

test('een duur wordt uitgesproken zoals een mens hem zegt', () => {
  assert.equal(duur(1), '1 maand');
  assert.equal(duur(11), '11 maanden');
  assert.equal(duur(12), '1 jaar');
  assert.equal(duur(24), '2 jaar');
  assert.equal(duur(38), '3 jaar 2 maanden');
  assert.equal(duur(13), '1 jaar 1 maand');
});

test('elk soort moment heeft een zin die de tweede mens noemt', () => {
  /* De tabel zelf onder toets: wie er een toevoegt zonder `samen` in de zin, is
     de wet van deze laag vergeten. */
  for (const [soort, m] of Object.entries(MOMENTEN)) {
    const zin = m.zin({ samen: 'CN-iemand', wat: 'iets' });
    assert.ok(zin.includes('CN-iemand'), soort + ' noemt de tweede mens niet: ' + zin);
    assert.ok(m.naam && m.naam.length > 3, soort + ' heeft geen naam');
  }
});
