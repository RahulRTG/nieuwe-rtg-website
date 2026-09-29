/* RUST EINDIGT VANZELF -- eis 2 van SAMENLEVING.md par. 6.

   "Stilte is standaard bereikbaar en eindigt vanzelf." Een ruststand die blijft
   staan, is geen rust maar een vergeten schakelaar: het lid mist dan dagen
   later nog steeds wat er wel door had moeten komen. kern/veiligheid/rust.js
   belooft dat in zijn kop ("geen enkele rustoptie blijft per ongeluk dagen aan
   staan"); dit bestand maakt van die zin een toets.

   Wat hier vastligt:
     1. elke stand krijgt een einddatum, ook de stand die aan de thuiskomst hangt
     2. die einddatum ligt nooit verder dan 24 uur weg, wat de aanroeper ook vraagt
     3. na die einddatum staat rust UIT, zonder dat iemand iets doet
     4. de kring komt er altijd door (de reden dat mensen rust durven aanzetten)

   Wat hier met opzet NIET staat: hoe lang iemand rust gebruikt. SAMENLEVING.md
   par. 6 zegt dat dat niemand iets aangaat, en SAM-05 zegt dat rust niets
   maximaliseert -- een toets die gebruikstijd leest, zou dat zelf schenden.

   Draai los: node --test test/rust-eindigt.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const DAG = 24 * 60 * 60 * 1000;

function maak() {
  const tak = {};
  const rust = require('../server/kern/veiligheid/rust.js')({
    opslag: { tak: () => tak },
    save: () => {},
    schoon: (s, n) => String(s || '').slice(0, n)
  });
  return { rust, tak };
}

test('1. elke stand krijgt een einddatum, ook "tot ik thuis ben"', () => {
  const { rust } = maak();
  for (const s of rust.STANDEN) {
    const r = rust.rustAan('lid-' + s.id, { stand: s.id });
    assert.equal(r.ok, true, s.id + ' ging niet aan');
    assert.ok(r.rust.tot, s.id + ' staat aan zonder einddatum');
    assert.ok(Number.isFinite(new Date(r.rust.tot).getTime()), s.id + ' heeft een onleesbare einddatum');
  }
});

test('2. de einddatum ligt nooit verder dan 24 uur weg, wat er ook gevraagd wordt', () => {
  const { rust } = maak();
  for (const s of rust.STANDEN) {
    for (const minuten of [1e9, 60 * 24 * 365, Infinity, '9999999', -5, 0, undefined, 'abc']) {
      const voor = Date.now();
      const r = rust.rustAan('lid', { stand: s.id, minuten });
      const tot = new Date(r.rust.tot).getTime();
      assert.ok(tot > voor, s.id + ' met minuten=' + minuten + ' eindigt niet in de toekomst');
      assert.ok(tot - voor <= DAG + 1000,
        s.id + ' met minuten=' + minuten + ' blijft ' + Math.round((tot - voor) / 3600000) + ' uur staan (maximaal 24)');
    }
  }
});

test('3. na de einddatum staat rust uit, zonder dat iemand iets doet', (t) => {
  const { rust } = maak();
  rust.rustAan('lid', { stand: 'slaap', minuten: 30 });
  assert.equal(rust.rustStand('lid').aan, true);
  const echt = Date.now;
  t.after(() => { Date.now = echt; });
  Date.now = () => echt() + DAG + 60000;
  const st = rust.rustStand('lid');
  assert.equal(st.aan, false, 'rust staat na zijn einddatum nog aan');
  assert.equal(st.netAf, true, 'het lid hoort te zien dat rust net is afgelopen');
});

test('4. de kring en de veiligheidsbaan komen er altijd door', () => {
  const { rust } = maak();
  for (const s of rust.STANDEN) {
    rust.rustAan('lid', { stand: s.id });
    assert.equal(rust.magDoor('lid', { scope: 'salon', uitKring: true }), true, s.id + ' houdt de kring tegen');
    assert.equal(rust.magDoor('lid', { scope: 'veiligheid' }), true, s.id + ' houdt de veiligheidsbaan tegen');
  }
});
