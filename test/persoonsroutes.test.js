/* De persoonsroutes: deuren die een medewerker vragen en niet een bedrijf. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { VOORVOEGSELS, PADEN, dektPad, persoonsRolVoor } = require('../scripts/lib/persoonsroutes');
const { ligtBinnen } = require('../scripts/lib/padgrens');

test('elk voorvoegsel draagt een meting en een reden', () => {
  for (const v of VOORVOEGSELS) {
    assert.ok(v.pad.startsWith('/api/'), v.pad);
    assert.ok(Number.isInteger(v.gemeten) && v.gemeten > 0, 'het aantal bij ' + v.pad);
    assert.ok((v.waarom || '').length >= 30, 'de reden bij ' + v.pad);
  }
});

test('geen los pad ligt onder een voorvoegsel', () => {
  for (const p of PADEN) for (const v of VOORVOEGSELS) {
    assert.ok(!ligtBinnen(p, v.pad), p + ' ligt al onder ' + v.pad);
  }
});

test('het voorvoegsel dekt op een padgrens', () => {
  assert.equal(dektPad('/api/staff/pauze'), true);
  assert.equal(dektPad('/api/staffing/x'), false);
  assert.equal(dektPad('/api/supplier/horeca/wijk/neem'), true);
  /* De rest van de horeca -- 118 routes -- blijft bij de bedrijfssessie. */
  assert.equal(dektPad('/api/supplier/horeca/rekening'), false);
});

/* DE GRENS. Alleen `supplier`. Een genrezaak is al verfijnd naar een ANDERE
   zaak; die overschrijven met de demo-zaak zou de proef bij het verkeerde
   bedrijf laten aankloppen. */
test('een andere rol dan supplier gaat NIET naar een persoonlijke login', () => {
  for (const rol of ['member', 'office', 'boardroom', 'zaak:KIKUNOI', 'zaak:PORTELL', 'lijfsleutel']) {
    const w = persoonsRolVoor(rol, '/api/staff/pauze');
    assert.equal(w.rol, null, rol + ' werd toch naar een persoonlijke login gestuurd');
    assert.match(w.reden, /verfijnt alleen `supplier`/);
  }
});

test('supplier op een gedekt pad krijgt de persoonlijke login', () => {
  assert.equal(persoonsRolVoor('supplier', '/api/staff/clock').rol, 'zaak-persoonlijk');
  assert.equal(persoonsRolVoor('supplier', '/api/supplier/horeca/rekening').rol, null);
});
