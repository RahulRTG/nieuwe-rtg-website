/* De omgangsvormen van Rahul: bij een vrouw flirt hij nooit zelf en speelt hij
   hard to get (nooit verder dan zij), bij een man is hij de 33-jarige beste
   vriend, en zonder bekend geslacht (of buiten de ledenomgeving) blijft hij
   neutraal. Plus de druppel-regel: zijn priveverhalen komen nooit in een keer.
   Unit-tests direct op kern/rahul.js. Draai los:
   node --experimental-sqlite --test test/rahul-omgang.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const rahul = require('../server/kern/rahul');

test('bij een vrouw: nooit zelf beginnen, hard to get, nooit verder dan zij', () => {
  const t = rahul.rahulOmgang('v');
  assert.match(t, /begint NOOIT zelf met flirten/i, 'hij begint nooit');
  assert.match(t, /hard to get/i, 'hij speelt hard to get');
  assert.match(t, /NOOIT verder dan zij/i, 'hij gaat nooit verder dan zij');
  assert.match(t, /zij zet het tempo/i, 'zij bepaalt het tempo');
  assert.match(t, /respectvol/i, 'altijd respectvol');
});

test('bij een man: de 33-jarige beste vriend die door het vuur gaat', () => {
  const t = rahul.rahulOmgang('m');
  assert.match(t, /33-jarige beste vriend/i, 'zijn leeftijd en rol');
  assert.match(t, /door het vuur/i, 'hij gaat door het vuur voor hem');
  assert.match(t, /beste voor hem/i, 'hij wil alleen het beste');
  assert.match(t, /liever niet hoort/i, 'een echte vriend zegt ook de harde dingen');
});

test('bij een kind: het enorme luisterende oor dat helpt ontwikkelen, laat doorzetten en troost', () => {
  const t = rahul.rahulOmgang('kind');
  assert.match(t, /ENORM luisterend oor/i, 'eerst luisteren, echt luisteren');
  assert.match(t, /behulpzaam/i, 'behulpzaam');
  assert.match(t, /ontwikkelen/i, 'helpt het kind zich verder te ontwikkelen');
  assert.match(t, /doorzetten/i, 'laat doorzetten als iets niet meteen lukt');
  assert.match(t, /troost/i, 'troost bij verdriet');
  assert.match(t, /gezond leeft? met heel veel plezier/i, 'gezond leven met heel veel plezier');
  assert.match(t, /volledig uitgesloten/i, 'flirt en volwassen onderwerpen zijn uitgesloten');
  assert.equal(rahul.RAHUL_KIND, t, 'RAHUL_KIND is dezelfde tekst voor de RTF-laag');
});

test('de RTF-leeftijdslaag draagt het kind-hart voor mini, kind en tiener', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'server/foundation/buddy.js'), 'utf8');
  assert.match(src, /RAHUL_KIND/, 'de buddy-laag gebruikt het kind-hart uit kern/rahul.js');
});

test('onbekend of x: neutraal (geen omgangsvormen-tekst)', () => {
  assert.equal(rahul.rahulOmgang('x'), '');
  assert.equal(rahul.rahulOmgang(''), '');
  assert.equal(rahul.rahulOmgang(null), '');
});

test('de druppel-regel: zijn verhaal komt nooit in een keer, doorvragen loont', () => {
  assert.match(rahul.RAHUL_LEAD, /NOOIT in een keer/i, 'nooit alles in een keer');
  assert.match(rahul.RAHUL_LEAD, /hoogstens een klein stukje/i, 'per antwoord een klein stukje');
  assert.match(rahul.RAHUL_LEAD, /doorvraagt/i, 'wie doorvraagt krijgt meer');
});

test('rahulLeadVoor volgt de geslachtsbron en valt veilig terug op neutraal', () => {
  const neutraal = rahul.RAHUL_LEAD;
  try {
    // bron zegt vrouw -> de flirt-regels staan in de lead
    rahul.zetGeslachtBron(() => 'v');
    assert.match(rahul.rahulLeadVoor('user-1'), /hard to get/i);
    // bron zegt man -> de beste-vriend-regels
    rahul.zetGeslachtBron(() => 'm');
    assert.match(rahul.rahulLeadVoor('user-1'), /33-jarige beste vriend/i);
    // bron zegt kind (minderjarig lid) -> het luisterende oor, en zeker geen flirt
    rahul.zetGeslachtBron(() => 'kind');
    assert.match(rahul.rahulLeadVoor('user-1'), /ENORM luisterend oor/i);
    assert.doesNotMatch(rahul.rahulLeadVoor('user-1'), /hard to get/i);
    // bron zegt null (minderjarig/onbekend/RTF) -> exact de neutrale lead
    rahul.zetGeslachtBron(() => null);
    assert.equal(rahul.rahulLeadVoor('user-1'), neutraal);
    // een kapotte bron mag nooit een assistent breken -> neutraal
    rahul.zetGeslachtBron(() => { throw new Error('kapot'); });
    assert.equal(rahul.rahulLeadVoor('user-1'), neutraal);
  } finally {
    rahul.zetGeslachtBron(null); // laat de module schoon achter voor andere tests
  }
});

test('de werkvloer blijft neutraal: RAHUL_LEAD zelf bevat geen omgangsvormen', () => {
  assert.doesNotMatch(rahul.RAHUL_LEAD, /hard to get/i);
  assert.doesNotMatch(rahul.RAHUL_LEAD, /33-jarige beste vriend/i);
});
