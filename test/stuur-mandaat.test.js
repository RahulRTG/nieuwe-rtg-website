/* HET MANDAAT (server/kern/stuur/mandaat.js, EXECUTIE.md blok 6).

   De dragende regel van deze laag staat in EXECUTIE.md grens 2 en moet hier
   afgedwongen zijn en niet beloofd:

     EEN MANDAAT VERLEENT NOOIT VERMOGEN. Het versmalt bestaand vermogen.

   Daaruit volgen de toetsen. De speelruimte is een DOORSNEDE, dus wat eruit komt
   zat er al in -- structureel, niet als vuistregel. Een mandaat kan geen niveau
   ophogen, dus wat een menselijke bevestiging vroeg blijft dat vragen. En geld
   blijft mensenwerk hoeveel er ook in het mandaat staat (GELD.md), net als het
   pasbesluit (CLAUDE.md).

   DE STILSTE FOUT die deze suite vangt: leeg lezen als open. Een agent zonder
   mandaat, of met een mandaat zonder capabilities, hoort NIETS zelfstandig te
   mogen -- niet alles. Dat is de klassieke omkering in dit soort lagen, en zij
   is van buiten niet te zien omdat er gewoon iets gebeurt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { speelruimte, magZelfstandig, geldig, NOOIT_AUTONOOM } = require('../server/kern/stuur/mandaat');
const { toegestanePaden, beleidVoor } = require('../server/kern/stuur/beleid');

const ALLE = [...new Set((require('../IDEMPROEF.json').perRoute || [])
  .filter(r => r && r.methode === 'POST' && typeof r.pad === 'string').map(r => r.pad))].sort();
const TOE = toegestanePaden(ALLE, 'member');
const RUIM = { capabilities: ['/api/*'], budget: { centen: 100000 } };

test('0. de meting deugt: er is een echte toegestane lijst', () => {
  assert.ok(TOE.length > 50, 'te weinig toegestane paden: ' + TOE.length);
});

test('1. DE SPEELRUIMTE IS EEN DOORSNEDE: er komt nooit een pad bij', () => {
  const binnen = new Set(TOE);
  for (const m of [RUIM, { capabilities: ['/api/auth/*', '/api/verzonnen/*'] }, { capabilities: ['*'] }]) {
    for (const p of speelruimte(TOE, 'member', m).paden)
      assert.ok(binnen.has(p), 'pad kwam erbij dat niet in de toegestane lijst zat: ' + p);
  }
});

test('2. LEEG IS DICHT: geen mandaat betekent niets, niet alles', () => {
  for (const m of [null, undefined, {}, { capabilities: [] }, 'ja', 42]) {
    const r = speelruimte(TOE, 'member', m);
    assert.deepEqual(r.paden, [], 'zonder geldig mandaat is er zelfstandigheid: ' + JSON.stringify(m));
    assert.ok(r.reden && r.reden.length > 15, 'geweigerd zonder reden');
  }
});

test('3. EEN MANDAAT HOOGT GEEN NIVEAU OP: wat bevestiging vroeg, blijft dat vragen', () => {
  const r = speelruimte(TOE, 'member', RUIM);
  for (const p of r.paden)
    assert.notEqual(beleidVoor(p, 'member').niveau, 'voorstel',
      p + ' mag zelfstandig terwijl het beleid een menselijke bevestiging vraagt');
  const voorstellen = TOE.filter(p => beleidVoor(p, 'member').niveau === 'voorstel');
  assert.ok(voorstellen.length > 5, 'te weinig voorstel-paden om iets te bewijzen');
  for (const p of voorstellen.slice(0, 5))
    assert.equal(magZelfstandig(p, 'member', RUIM).mag, false, p + ' mag zelfstandig en dat hoort niet');
});

test('4. GELD BLIJFT MENSENWERK, hoeveel het mandaat ook toestaat', () => {
  for (const p of ['/api/bank/overboek', '/api/pay/stuur', '/api/bank/sepa']) {
    const r = magZelfstandig(p, 'member', RUIM);
    assert.equal(r.mag, false, p + ' mag zelfstandig met een ruim mandaat');
    assert.match(r.reden, /geld|mensenwerk|bevestigt/i, p + ': de reden noemt de grond niet');
  }
  assert.ok(NOOIT_AUTONOOM.some(re => re.test('/api/aanmelding/beslis')),
    'het pasbesluit staat niet op de nooit-autonoom-lijst');

  /* EN OP EEN GELDPAD DAT GEEN BEVESTIGING VRAAGT. De drie hierboven zijn
     `voorstel`, dus zij worden ook door de niveau-regel tegengehouden -- een
     mutatie die de geldregel weghaalt bleef daardoor groen. /api/pay/saldo is
     `lezen`: alleen de geldregel houdt die tegen, en daarmee wordt zij hier
     werkelijk getoetst in plaats van meegelift. */
  const lezendGeld = magZelfstandig('/api/pay/saldo', 'member', RUIM);
  assert.equal(lezendGeld.mag, false,
    '/api/pay/saldo mag zelfstandig; dan bewaakt de geldregel niets wat de niveau-regel niet al deed');
  assert.match(lezendGeld.reden, /geld|mensenwerk/i);
});

test('5. een verlopen of onleesbaar mandaat geeft niets', () => {
  assert.equal(geldig({ capabilities: ['/api/*'], tot: '2020-01-01T00:00:00Z' }).ok, false);
  assert.equal(geldig({ capabilities: ['/api/*'], tot: 'ooit' }).ok, false);
  const r = speelruimte(TOE, 'member', { capabilities: ['/api/*'], tot: '2020-01-01T00:00:00Z' });
  assert.deepEqual(r.paden, []);
  assert.match(r.reden, /verlopen/);
});

test('6. de plafonds houden tegen, en boven een plafond beslist een mens', () => {
  const leesbaar = speelruimte(TOE, 'member', RUIM).paden[0];
  assert.ok(leesbaar, 'geen enkel pad binnen het ruime mandaat');
  const m = { capabilities: ['/api/*'], budget: { handelingen: 3 } };
  assert.equal(magZelfstandig(leesbaar, 'member', m, { gebruikt: { handelingen: 1 }, nodig: { handelingen: 1 } }).mag, true);
  const stuk = magZelfstandig(leesbaar, 'member', m, { gebruikt: { handelingen: 3 }, nodig: { handelingen: 1 } });
  assert.equal(stuk.mag, false);
  assert.match(stuk.reden, /plafond/);
});

test('7. wat afvalt, valt af MET een reden -- niet stilzwijgend', () => {
  const r = speelruimte(TOE, 'member', RUIM);
  assert.ok(r.geweigerd.length > 0, 'niets geweigerd bij een ruim mandaat -- verdacht');
  for (const g of r.geweigerd) assert.ok(g.pad && g.reden && g.reden.length > 25, 'weigering zonder reden: ' + g.pad);
});

test('8. hij voert niets uit', () => {
  const ruw = fs.readFileSync(path.join(__dirname, '..', 'server/kern/stuur/mandaat.js'), 'utf8');
  const bron = ruw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  for (const verboden of [/\bfetch\s*\(/, /stuurRoep/, /child_process/])
    assert.ok(!verboden.test(bron), 'mandaat.js bevat een weg naar uitvoering: ' + verboden);
});

test('9. de uitslag zegt zelf dat hij een doorsnede is en geen toekenning', () => {
  const r = speelruimte(TOE, 'member', RUIM);
  assert.match(r.grens, /doorsnede|versmalt/i);
  assert.ok(r.aantalVoor >= r.paden.length, 'de speelruimte is groter dan wat erin ging');
});
