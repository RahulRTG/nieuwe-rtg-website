'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { scanHtml, nieuweVangst } = require('../scripts/tekstoppervlak');

function meet(html) {
  const v = nieuweVangst();
  scanHtml(html, 'formulier.html', v);
  assert.deepEqual(v.parsefouten, []);
  return { los: v.perBestand.get('formulier.html') || 0, gebonden: v.perBestandSleutel.get('formulier.html') || 0 };
}

test('de tekstmeter erkent de drie werkelijk ondersteunde attribuutbindingen', () => {
  for (const [attr, binding] of [['placeholder', 'data-i18n-ph'], ['title', 'data-i18n-title'], ['aria-label', 'data-i18n-aria']]) {
    for (const quote of ['"', "'", '']) {
      const bron = '<input ' + attr + '=' + quote + 'Zoeken' + quote + ' ' + binding + '=' + quote + 'form.search' + quote + '>';
      assert.deepEqual(meet(bron), { los: 0, gebonden: 1 });
      // Dezelfde invoer zonder zijn binding moet weer als ongebonden tellen.
      assert.deepEqual(meet('<input ' + attr + '=' + quote + 'Zoeken' + quote + '>'), { los: 1, gebonden: 0 });
    }
  }
});

test('tekstbinding, naburige sleutels en lege sleutels binden geen attributen', () => {
  for (const bron of [
    '<input placeholder="Zoeken" data-i18n="form.search">',
    '<input placeholder="Zoeken" data-i18n-title="form.search">',
    '<input placeholder="Zoeken" data-i18n-ph="">',
    '<input placeholder="Zoeken" data-i18n-ph="  ">',
    '<input placeholder="Zoeken"><input data-i18n-ph="form.search">',
    '<input placeholder="Zoeken" data-uitleg="data-i18n-ph=onjuist">'
  ]) assert.equal(meet(bron).los, 1, bron);
});

test('attribuutmeting blijft exact bij regeleinden, tekens in quotes en dubbele attributen', () => {
  assert.deepEqual(meet('<input\nplaceholder="Zoek > verder"\ndata-i18n-ph="form.search">'), { los: 0, gebonden: 1 });
  assert.deepEqual(meet('<input data-placeholder="Zoeken">'), { los: 0, gebonden: 0 });
  assert.equal(meet('<input placeholder="Zoeken" data-i18n-ph="" data-i18n-ph="form.search">').los, 1);
  assert.equal(meet('<img alt="Uw afbeelding" data-i18n="image">').los, 1);
});
