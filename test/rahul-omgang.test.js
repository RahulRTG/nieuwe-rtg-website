/* De omgangsvormen van Rahul, gezien vanaf kern/rahul.js (de plek waar de
   assistenten hem ophalen). Dit bestand toetste de OUDE opzet: bij een vrouw
   flirtte hij en speelde hij hard to get, bij een man was hij de beste vriend.
   Dat liep op geslacht en is bewust vervangen -- het lid kiest nu zelf, en de
   levensfase bepaalt de rol (kern/rahul-omgang.js en kern/rahul-fases.js
   leggen uit waarom). De toetsen hieronder bewaken de nieuwe opzet, en met
   name de dingen die NOOIT mogen verschuiven.

   De tekstinhoud per stand en per fase staat in test/rahul-mens.test.js; hier
   gaat het om de bedrading. Draai los:
   node --test test/rahul-omgang.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const rahul = require('../server/kern/rahul');

test('geslacht bepaalt niets meer: v, m en x leveren hetzelfde op', () => {
  const v = rahul.rahulOmgang('v');
  assert.equal(v, rahul.rahulOmgang('m'));
  assert.equal(v, rahul.rahulOmgang('x'));
  assert.equal(v, rahul.rahulOmgang(''));
  assert.equal(v, rahul.rahulOmgang(null));
  // en zeker geen crush-toon op grond van wie iemand is
  assert.doesNotMatch(v, /hard to get|stille crush/i);
});

test('de welkomstregel staat er altijd, ook in het kind-hart', () => {
  for (const wie of ['v', 'kind', null]) {
    const t = rahul.rahulOmgang(wie);
    assert.match(t, /ga je nergens vanuit/i, 'stand: ' + String(wie));
    assert.match(t, /homo, lesbisch, bi, trans, non-binair, queer/i, 'stand: ' + String(wie));
  }
});

test('bij een kind: de grote broer die luistert, helpt en troost', () => {
  const t = rahul.rahulOmgang('kind');
  assert.match(t, /grote broer/i, 'geen leraar maar een grote broer');
  assert.match(t, /luistert eerst echt/i, 'eerst luisteren');
  assert.match(t, /koetjes en kalfjes/i, 'ook een gesprek over niets mag');
  assert.match(t, /troost/i, 'troost bij verdriet');
  assert.match(t, /nooit over: je laat het/i, 'hij neemt het huiswerk niet over');
  assert.match(t, /volledig uitgesloten/i, 'flirten en volwassen onderwerpen zijn uitgesloten');
  assert.equal(rahul.RAHUL_KIND, t, 'RAHUL_KIND is dezelfde tekst voor de RTF-laag');
});

test('de RTF-leeftijdslaag draagt het kind-hart voor mini, kind en tiener', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'server/foundation/buddy.js'), 'utf8');
  assert.match(src, /RAHUL_KIND/, 'de buddy-laag gebruikt het kind-hart uit kern/rahul.js');
});

test('de druppel-regel: zijn verhaal komt nooit in een keer, doorvragen loont', () => {
  assert.match(rahul.RAHUL_LEAD, /NOOIT in een keer/i, 'nooit alles in een keer');
  assert.match(rahul.RAHUL_LEAD, /hoogstens een klein stukje/i, 'per antwoord een klein stukje');
  assert.match(rahul.RAHUL_LEAD, /doorvraagt/i, 'wie doorvraagt krijgt meer');
});

test('rahulLeadVoor volgt de profielbron en valt veilig terug', () => {
  try {
    // het lid koos plagerig EN is volwassen -> de plagerige stand mag
    rahul.zetGeslachtBron(() => ({ fase: 'volwassen', omgang: 'plagerig', volwassen: true }));
    assert.match(rahul.rahulLeadVoor('user-1'), /stille crush/i);

    // DE GRENS: dezelfde keuze zonder bevestigde leeftijd -> nee
    rahul.zetGeslachtBron(() => ({ fase: 'volwassen', omgang: 'plagerig' }));
    assert.doesNotMatch(rahul.rahulLeadVoor('user-1'), /stille crush/i);

    // DE GRENS: en bij een jeugdfase al helemaal niet
    for (const fase of ['kind', 'scholier']) {
      rahul.zetGeslachtBron(() => ({ fase, omgang: 'plagerig', volwassen: true }));
      const t = rahul.rahulLeadVoor('user-1');
      assert.doesNotMatch(t, /stille crush/i, 'plagerig kwam door bij ' + fase);
      assert.match(t, /volledig uitgesloten/i, 'de uitsluiting ontbreekt bij ' + fase);
    }

    // elke fase komt ook echt in de lead terecht
    rahul.zetGeslachtBron(() => ({ fase: 'senior' }));
    assert.match(rahul.rahulLeadVoor('user-1'), /luisterend oor/i);
    rahul.zetGeslachtBron(() => ({ fase: 'student' }));
    assert.match(rahul.rahulLeadVoor('user-1'), /rondkomen/i);

    // geen bron-uitkomst -> de welkomstregel met de maatje-toon, geen fase-tekst
    rahul.zetGeslachtBron(() => null);
    const zonder = rahul.rahulLeadVoor('user-1');
    assert.match(zonder, /ga je nergens vanuit/i);
    assert.doesNotMatch(zonder, /grote broer|luisterend oor|rondkomen/i);

    // een kapotte bron mag nooit een assistent breken -> zelfde als geen bron
    rahul.zetGeslachtBron(() => { throw new Error('kapot'); });
    assert.equal(rahul.rahulLeadVoor('user-1'), zonder);
  } finally {
    rahul.zetGeslachtBron(null); // laat de module schoon achter voor andere tests
  }
});

test('de werkvloer blijft neutraal: RAHUL_LEAD zelf bevat geen omgangsvormen', () => {
  assert.doesNotMatch(rahul.RAHUL_LEAD, /stille crush/i);
  assert.doesNotMatch(rahul.RAHUL_LEAD, /grote broer/i);
  assert.doesNotMatch(rahul.RAHUL_LEAD, /ga je nergens vanuit/i);
});
