/* De accountroutes: deuren die een echt account vragen en niet alleen een pas.
   Meet gedrag, geen brontekst. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { VOORVOEGSELS, PADEN, dektPad, accountRolVoor } = require('../scripts/lib/accountroutes');
const { ligtBinnen } = require('../scripts/lib/padgrens');

test('elk voorvoegsel draagt een meting en een reden', () => {
  for (const v of VOORVOEGSELS) {
    assert.ok(v.pad.startsWith('/api/'), v.pad);
    assert.ok(Number.isInteger(v.gemeten) && v.gemeten > 0, 'het aantal bij ' + v.pad);
    assert.ok((v.waarom || '').length >= 30, 'de reden bij ' + v.pad + ' is te kort om na te lopen');
  }
});

/* Een voorvoegsel dat een ander overlapt betekent dat er een domein twee keer
   wordt geclaimd; dan is niet meer te zeggen welke regel iets opende. */
test('geen voorvoegsel ligt binnen een ander', () => {
  for (const a of VOORVOEGSELS) for (const b of VOORVOEGSELS) {
    if (a === b) continue;
    assert.ok(!ligtBinnen(a.pad, b.pad), a.pad + ' ligt binnen ' + b.pad);
  }
});

/* De losse paden zitten er juist omdat hun domein NIET in zijn geheel
   accountgebonden is. Staat er toch een onder een voorvoegsel, dan is de
   scheiding tussen de twee vormen weg. */
test('geen los pad ligt onder een voorvoegsel', () => {
  for (const p of PADEN) {
    for (const v of VOORVOEGSELS) {
      assert.ok(!ligtBinnen(p, v.pad), p + ' ligt al onder het voorvoegsel ' + v.pad);
    }
  }
});

test('een pad onder een voorvoegsel telt mee, een ander niet', () => {
  assert.equal(dektPad('/api/ontmoeten/aan'), true);
  assert.equal(dektPad('/api/ik'), true);
  assert.equal(dektPad('/api/ik/geloof'), true);
  assert.equal(dektPad('/api/mall/bestel'), false);
  /* /api/ikea zou niet onder /api/ik mogen vallen: dat is een woordgrens en
     geen padgrens. */
  assert.equal(dektPad('/api/ikea/bestel'), false);
});

test('een los pad telt mee, zijn buren niet', () => {
  assert.equal(dektPad('/api/member/dossier'), true);
  assert.equal(dektPad('/api/member/reizen'), false);
});

/* DE GRENS. Alleen `member` gaat naar een accountsessie. Zonder die grens zou
   bijvoorbeeld een kantoorroute onder /api/member/ met een ledensessie worden
   beproefd, en dan meet de proef iets anders dan de route doet. */
test('een andere rol dan member gaat NIET naar een accountsessie', () => {
  for (const rol of ['office', 'boardroom', 'supplier', 'openbaar', 'lijfsleutel', 'member-lifestyle']) {
    const a = accountRolVoor(rol, '/api/ik');
    assert.equal(a.rol, null, rol + ' werd toch naar een accountsessie gestuurd');
    assert.match(a.reden, /geen ledensessie/);
  }
});

test('member op een gedekt pad krijgt de accountsessie', () => {
  assert.equal(accountRolVoor('member', '/api/webauthn/lijst').rol, 'member-account');
  assert.equal(accountRolVoor('member', '/api/mall/bestel').rol, null);
});
