/* De pasroutes: deuren die om een betaalde pas vragen.

   De eenvoudigste van de vijf verfijningen -- geen account, geen persoon, geen
   geverifieerde identiteit, gewoon een andere pas. En juist daarom de plek waar
   het makkelijkst iets te veel wordt beloofd. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { VOORVOEGSELS, dektPad, pasRolVoor } = require('../scripts/lib/pasroutes');

test('elk voorvoegsel noemt een pas, een meting en een reden', () => {
  for (const v of VOORVOEGSELS) {
    assert.ok(v.pad.startsWith('/api/'), v.pad);
    assert.ok(['member-lifestyle', 'member-zakelijk'].includes(v.naar), v.pad + ' -> ' + v.naar);
    assert.ok(Number.isInteger(v.gemeten) && v.gemeten > 0, v.pad);
    assert.ok((v.waarom || '').length >= 25, 'de reden bij ' + v.pad);
  }
});

/* HET VERSCHIL DAT NIET COSMETISCH IS. Waar de route "Lifestyle en Business"
   zegt, opent een Lifestyle Pass hem; waar hij alleen "Business" zegt, niet.
   Ze op een hoop gooien zou de proef laten meten dat een Lifestyle Pass iets
   opent wat hij niet opent. */
test('een Business-only deur krijgt geen Lifestyle-sessie', () => {
  assert.equal(pasRolVoor('member', '/api/member/bord').rol, 'member-zakelijk');
  assert.equal(pasRolVoor('member', '/api/member/accountant').rol, 'member-zakelijk');
  assert.equal(pasRolVoor('member', '/api/member/zzp').rol, 'member-zakelijk');
});

test('een Lifestyle-of-Business deur krijgt de Lifestyle-sessie', () => {
  assert.equal(pasRolVoor('member', '/api/zakelijk/aanbevelen').rol, 'member-lifestyle');
  assert.equal(pasRolVoor('member', '/api/wereld/bereik').rol, 'member-lifestyle');
});

test('een pad zonder paseis blijft zoals het is', () => {
  assert.equal(dektPad('/api/mall/bestel'), false);
  assert.equal(pasRolVoor('member', '/api/mall/bestel').rol, null);
  /* En de padgrens: /api/wereldwinkel valt niet onder /api/wereld. */
  assert.equal(dektPad('/api/wereldwinkel/x'), false);
});

/* Alleen vanaf `member`. Wie al een zwaardere pas heeft hoeft niet verfijnd te
   worden, en wie een heel andere soort sessie heeft klopt hier niet aan. */
test('alleen een RTG-passessie wordt verfijnd', () => {
  for (const rol of ['member-lifestyle', 'member-zakelijk', 'office', 'supplier', 'boardroom']) {
    const uit = pasRolVoor(rol, '/api/zakelijk/aanbevelen');
    assert.equal(uit.rol, null, rol + ' werd toch verfijnd');
  }
});
