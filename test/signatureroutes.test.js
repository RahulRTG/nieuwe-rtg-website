/* De signatureroutes: deuren achter de KYC-poort.

   Vierde variant van de sessieverfijning, en de enige die vanaf MEER dan een
   uitgangsrol werkt -- de ontmoetpoort vraagt drie dingen tegelijk (een pas,
   een geverifieerd account en 18 jaar) en geen van de drie ledensessies heeft
   ze alle drie. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { VOORVOEGSELS, VANAF, dektPad, signatureRolVoor } = require('../scripts/lib/signatureroutes');

test('elk voorvoegsel draagt een meting en een reden', () => {
  for (const v of VOORVOEGSELS) {
    assert.ok(v.pad.startsWith('/api/'), v.pad);
    assert.ok(Number.isInteger(v.gemeten) && v.gemeten > 0, v.pad);
    assert.ok((v.waarom || '').length >= 30, 'de reden bij ' + v.pad);
  }
});

test('de poort dekt Rendez-vous en Vonk, en niets ernaast', () => {
  assert.equal(dektPad('/api/member/rendezvous/akkoord'), true);
  assert.equal(dektPad('/api/vonk/kies'), true);
  assert.equal(dektPad('/api/member/reizen'), false);
  /* /api/vonkelend zou niet onder /api/vonk mogen vallen. */
  assert.equal(dektPad('/api/vonkelend/x'), false);
});

test('alle drie de ledensessies mogen hierheen worden verfijnd', () => {
  for (const rol of ['member', 'member-account', 'member-lifestyle']) {
    assert.equal(signatureRolVoor(rol, '/api/vonk/kies').rol, 'member-signature', rol);
  }
});

/* `member-zakelijk` heeft de pas wel maar het account niet. Hem hier toelaten
   zou de meting laten denken dat een Business Pass alleen genoeg is. */
test('een sessie die de poort niet kan halen wordt niet verfijnd', () => {
  for (const rol of ['member-zakelijk', 'office', 'supplier', 'boardroom', 'lijfsleutel']) {
    const uit = signatureRolVoor(rol, '/api/vonk/kies');
    assert.equal(uit.rol, null, rol + ' werd toch verfijnd');
    assert.match(uit.reden, /geen ledensessie/);
  }
  assert.ok(!VANAF.has('member-zakelijk'));
});
