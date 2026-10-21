'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { oordeel, ROUTES } = require('../scripts/lib/verificatie-isolatie');
const { beoordeelIdorRij } = require('../scripts/bevoegdronde');
const h = n => String(n).repeat(64);
function bewijs(pad = ROUTES[1]) {
  const write = !pad.endsWith('/status');
  const poging = { methode: 'POST', pad, status: 200, voor: { a: h(1), b: h(2), overig: h(8) }, na: { a: h(1), b: h(2), overig: h(8) } };
  const eigen = ['a', 'b'].map(actor => ({ ...structuredClone(poging), actor }));
  if (write) { eigen[0].na.a = h(3); eigen[1].na.b = h(4); }
  const kruis = { ...structuredClone(poging), actor: h(6), doel: h(5), antwoordStatus: 'none' };
  if (write) kruis.na.b = h(7);
  return { gang: 'verificatie-opslag', staat: 'opslaggescheiden', bewijsVersie: 1, methode: 'POST', pad,
    proef: { actorA: h(5), actorB: h(6), eigen, kruis, statusA: 'pending', statusB: 'none',
      sessies: ['a', 'b'].map(actor => ({ actor, voor: 200, na: 200 })),
      rollen: ['supplier', 'office', 'anoniem'].map(rol => ({ ...structuredClone(poging), rol, status: 403, lek: null, eigenVoor: 200, eigenNa: 200 })) } };
}
test('alleen volledige opslagproeven op drie bekende POST-routes tellen', () => {
  for (const pad of ROUTES) {
    const r = bewijs(pad);
    assert.equal(oordeel(r).stand, 'gemeten');
    assert.equal(beoordeelIdorRij(r, { methode: 'POST', pad }).stand, 'gemeten');
    assert.equal(beoordeelIdorRij(r, { methode: 'GET', pad }).stand, 'open');
    assert.equal(beoordeelIdorRij(r, { methode: 'POST', pad: '/anders' }).stand, 'open');
  }
});
test('ontbrekende controles, verlopen sessies, verkeerde methode en lege ok zijn geen bewijs', () => {
  const wijzigingen = [
    r => { delete r.proef; }, r => { r.proef.eigen = [null, null]; },
    r => { r.proef.rollen = [null, null, null]; }, r => { r.proef.sessies = [null, null]; }, r => { r.methode = 'GET'; }, r => { r.pad = '/api/ander'; },
    r => { r.proef.actorB = r.proef.actorA; }, r => { r.proef.eigen.pop(); },
    r => { r.proef.eigen[0].status = 403; }, r => { r.proef.eigen[0].na.a = r.proef.eigen[0].voor.a; },
    r => { r.proef.kruis.na.b = r.proef.kruis.voor.b; }, r => { r.proef.kruis.doel = h(8); },
    r => { r.proef.rollen.pop(); }, r => { r.proef.rollen[0].eigenNa = 401; },
    r => { r.proef.rollen[1].status = 400; }, r => { r.proef.sessies[1].na = 401; },
    r => { delete r.proef.kruis.voor; }, r => { r.proef.kruis.voor.a = ''; }
  ];
  for (const wijzig of wijzigingen) { const r = bewijs(); wijzig(r); assert.notEqual(oordeel(r).stand, 'gemeten', wijzig.toString()); }
});
test('status vereist verschillende werkelijk waargenomen eigenaarstanden', () => {
  for (const wijzig of [r => { r.proef.statusB = r.proef.statusA; }, r => { r.proef.kruis.antwoordStatus = 'pending'; }]) {
    const r = bewijs(ROUTES[0]); wijzig(r); assert.equal(oordeel(r).stand, 'open');
  }
});
test('ruwe ongeoorloofde mutatie, toegang of lek blijven een defect', () => {
  for (const wijzig of [
    r => { r.proef.kruis.na.a = h(9); },
    r => { r.proef.rollen[0].na.b = h(9); },
    r => { r.proef.rollen[0].na.overig = h(9); },
    r => { r.proef.kruis.na.overig = h(9); },
    r => { r.proef.rollen[1].status = 200; },
    r => { r.proef.rollen[2].lek = 'paspoort'; }
  ]) { const r = bewijs(); wijzig(r); assert.equal(oordeel(r).stand, 'gebroken'); }
});
