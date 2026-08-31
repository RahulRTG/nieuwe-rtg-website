/* De kleine wortels: negen dingen die elk hun eigen domein openen.

   Geen ketens maar een oproep per stuk -- daarom een module en geen negen
   werelden. Wat deze toets bewaakt is de VORM van die lijst, want dat is wat
   de volgende toevoeging fout kan doen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { WORTELS, lijfVoor } = require('../scripts/lib/wereld-wortels');

test('elke wortel noemt een pad, een rol, een voorvoegsel en een reden', () => {
  for (const w of WORTELS) {
    assert.ok(w.pad.startsWith('/api/'), w.naam);
    assert.ok(w.prefix.startsWith('/api/'), w.naam);
    assert.ok(w.rol, w.naam);
    assert.equal(typeof w.haal, 'function', w.naam + ' hoort te zeggen waar het id staat');
    assert.ok(Number.isInteger(w.gemeten) && w.gemeten > 0, w.naam);
    assert.ok((w.waarom || '').length >= 25, 'de reden bij ' + w.naam + ' is te kort om na te lopen');
  }
});

/* Het PAD dat de wortel maakt hoort onder het VOORVOEGSEL te vallen dat hij
   opent -- anders opent hij een ander domein dan hij zegt. */
test('elke wortel maakt zijn ding binnen het domein dat hij opent', () => {
  for (const w of WORTELS) {
    assert.ok(w.pad === w.prefix || w.pad.startsWith(w.prefix + '/'),
      w.naam + ': maakt op ' + w.pad + ' maar opent ' + w.prefix);
  }
});

test('geen twee wortels op hetzelfde voorvoegsel', () => {
  const p = WORTELS.map(w => w.prefix);
  assert.equal(new Set(p).size, p.length, 'twee wortels op een domein: dan telt de volgorde');
});

/* Het langste voorvoegsel wint, zodat /api/office/architect niet onder een
   korter /api/office valt. */
test('het langste voorvoegsel wint', () => {
  const per = { '/api/office': { id: 'KORT' }, '/api/office/architect': { id: 'LANG' } };
  assert.equal(lijfVoor(per, '/api/office/architect/zet').id, 'LANG');
  assert.equal(lijfVoor(per, '/api/office/iets').id, 'KORT');
});

test('een pad buiten elk domein krijgt niets', () => {
  assert.deepEqual(lijfVoor({ '/api/clips': { id: 'C' } }, '/api/mall/bestel'), {});
  /* En de padgrens: /api/clipsdienst valt niet onder /api/clips. */
  assert.deepEqual(lijfVoor({ '/api/clips': { id: 'C' } }, '/api/clipsdienst/x'), {});
});
