/* DE DOORWERKING VAN HET ZORGPROFIEL (scripts/doorwerking.js).

   MAATSTAF.md U10: een gegeven wordt één keer gevraagd en alleen hergebruikt
   met doel, toestemming, bron en actualiteit. Het zorgprofiel staat op één
   plek en reist door twaalf domeinen -- dat deel was al gebouwd. Wat de meting
   vond, was de andere helft: veertien lezers gaven het aan een tweede partij
   ZONDER een zaak te noemen (dus geen regel in het inzagejournaal), en twaalf
   schreven het als kopie in een bestelling, waar intrekken niet meer terugwerkt.

   Deze toets bewaakt dat die twee getallen op nul blijven. Een nieuwe lezer die
   zorgVoor gebruikt waar hij zorgMee hoort te gebruiken, laat hem zakken.

   Draai los: node --test test/doorwerking.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const M = require('../scripts/doorwerking');
const maakProfiel = require('../server/kern/gastzorg-profiel');

const WORTEL = path.join(__dirname, '..');
const profiel = { allergenen: ['noten'], dieet: 'geen varken', medisch: '' };
const maak = (nu = () => '2026-09-03T10:00:00.000Z', p = profiel) =>
  maakProfiel({ zorgVoor: () => (p ? { allergenen: p.allergenen, dieet: p.dieet, medisch: p.medisch } : null), nu });

test('1. niemand geeft het profiel aan een derde zonder een zaak te noemen', () => {
  const u = M.meet();
  assert.deepEqual(u.naamloos, [],
    'deze lezers geven het zorgprofiel weg zonder zaak; dan komt er geen regel in het inzagejournaal ' +
    'en ziet het lid nooit wie zijn allergieen las. Gebruik zorgMee(key, { zaak, reden }).');
});

test('2. elke bewaarde kopie draagt een stempel', () => {
  const u = M.meet();
  assert.deepEqual(u.bevroren, [],
    'deze kopie draagt geen datum en geen bron; niemand kan zien dat hij oud is, en intrekken werkt niet terug');
  assert.ok(u.telling.kopieen > 0, 'er is geen enkele kopie meer -- dan meet deze toets niets');
});

test('3. de uitzonderingslijst noemt per plek een reden', () => {
  for (const [plek, waarom] of Object.entries(M.EIGEN)) {
    assert.ok(fs.existsSync(path.join(WORTEL, plek)), plek + ' bestaat niet');
    assert.ok(waarom && waarom.length > 25, plek + ': "eigen" zonder uitleg is een gat dat is weggeschreven');
  }
});

test('4. zorgMee weigert zonder zaak, en stempelt met zaak', () => {
  const m = maak();
  assert.equal(m.zorgMee('k', null), null, 'een kopie zonder ontvanger is een afdruk en niet in te trekken');
  assert.equal(m.zorgMee('k', {}), null);
  const uit = m.zorgMee('k', { zaak: 'KIKUNOI', reden: 'diner' });
  assert.equal(uit.bron, 'zorgprofiel');
  assert.equal(uit.voor, 'KIKUNOI');
  assert.ok(uit.op, 'de kopie draagt geen datum');
});

test('5. de projectie laat de bron winnen, en kent intrekken apart van leeg', () => {
  const kopie = maak().zorgMee('k', { zaak: 'X' });

  const gelijk = maak().zorgActueel('k', kopie);
  assert.equal(gelijk.stand, 'gelijk');

  const gewijzigd = maak(undefined, { allergenen: ['noten', 'schaaldieren'], dieet: '', medisch: '' })
    .zorgActueel('k', kopie);
  assert.equal(gewijzigd.stand, 'gewijzigd');
  assert.deepEqual(gewijzigd.zorg.allergenen, ['noten', 'schaaldieren'], 'de kopie won van de bron');
  assert.match(gewijzigd.uitleg, /gewijzigd na/);

  /* Ingetrokken is met opzet iets anders dan leeg: het eerste is een besluit
     van het lid en hoort als zodanig te klinken bij wie de kopie nog heeft. */
  const weg = maak(undefined, null).zorgActueel('k', kopie);
  assert.equal(weg.stand, 'ingetrokken');
  assert.equal(weg.zorg, null);
  assert.match(weg.uitleg, /niet meer/);
});

test('6. een kopie van voor deze laag draagt geen datum, en dat wordt gezegd', () => {
  const oud = { allergenen: ['gluten'], dieet: '', medisch: '' };   // geen `op`
  const u = maak().zorgActueel('k', oud);
  assert.equal(u.stand, 'gewijzigd');
  assert.equal(u.kopieOp, null);
  assert.match(u.uitleg, /geen datum/, 'een kopie zonder datum wordt behandeld alsof hij er wel een had');
});

test('7. het register bestaat en loopt gelijk met de code', () => {
  const pad = path.join(WORTEL, 'DOORWERKING.json');
  assert.ok(fs.existsSync(pad), 'DOORWERKING.json ontbreekt -- draai: npm run doorwerking:vast');
  const j = JSON.parse(fs.readFileSync(pad, 'utf8'));
  assert.equal(j.telling.naamloos, M.meet().telling.naamloos, 'het register loopt achter -- draai npm run doorwerking:vast');
  assert.ok((j.nietGemeten || []).length >= 3, 'wat deze meter niet ziet, hoort er even groot bij te staan');
});
