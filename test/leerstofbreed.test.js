/* RTG School, de brede leerlijn: van twee vakken naar een echt curriculum.
   Basisschool: rekenen, taal, aardrijkskunde, geschiedenis, natuur, verkeer
   en Engels. VO: negen-plus vakken per niveau. En de dekkingswacht: ELK
   leerdoel in de bibliotheek moet een werkende opgave-generator hebben.
   Draai los: node --test test/leerstofbreed.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { DOELEN, PER_FASE } = require('../server/kern/leerstof');
const { opgave } = require('../server/kern/leerstof-gen');

test('1. de basisschool is breed: zeven vakken over de groepen verdeeld', () => {
  const vakken = new Set(Object.values(DOELEN).filter(d => d.groep).map(d => d.vak));
  for (const v of ['rekenen', 'taal', 'aardrijkskunde', 'geschiedenis', 'natuur', 'verkeer', 'engels']) {
    assert.ok(vakken.has(v), 'de basisschool heeft ' + v);
  }
  // wereldorientatie begint in de middenbouw, Engels in de bovenbouw
  assert.ok(Object.values(DOELEN).some(d => d.vak === 'natuur' && d.groep === 4));
  assert.ok(Object.values(DOELEN).some(d => d.vak === 'engels' && d.groep === 7));
});

test('2. het VO is breed: vmbo, havo en vwo hebben elk een echt vakkenpakket', () => {
  const vakkenVan = fase => new Set((PER_FASE[fase] || []).map(id => DOELEN[id].vak));
  const vmbo = vakkenVan('vmbo-tl');
  for (const v of ['wiskunde', 'nederlands', 'engels', 'biologie', 'geschiedenis', 'aardrijkskunde', 'maatschappijleer', 'duits']) {
    assert.ok(vmbo.has(v), 'vmbo heeft ' + v);
  }
  const havo = vakkenVan('havo');
  for (const v of ['natuurkunde', 'scheikunde', 'frans', 'informatica', 'economie']) {
    assert.ok(havo.has(v), 'havo heeft er ' + v + ' bij');
  }
  assert.ok(havo.size >= 12, 'havo telt een volwaardig pakket (' + havo.size + ' vakken)');
  // en het vervolgonderwijs heeft zijn eigen vakken
  assert.ok(vakkenVan('mbo-2').has('digitaal'), 'mbo leert digitaal vaardig werken');
  assert.ok(vakkenVan('hbo-b').has('communicatie'));
  assert.ok(vakkenVan('wo-b').has('academisch'));
});

test('3. de dekkingswacht: elk leerdoel in de hele bibliotheek maakt echte opgaven', () => {
  const ids = Object.keys(DOELEN);
  assert.ok(ids.length >= 60, 'de bibliotheek is gegroeid (' + ids.length + ' leerdoelen)');
  for (const id of ids) {
    const doel = DOELEN[id];
    assert.ok(doel.les && doel.les.length > 40, id + ' heeft een echte les');
    for (let i = 0; i < 3; i++) {
      const o = opgave(doel.gen); // gooit luid bij een onbekende soort
      assert.ok(o.v && o.a, id + ' maakt een vraag met een antwoord op de server');
      if (o.opties) assert.ok(o.opties.includes(o.a), id + ': het juiste antwoord zit bij de opties');
    }
  }
});
