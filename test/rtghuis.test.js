'use strict';
/* RTG zelf als werkgever (kern/rtghuis.js): precies een zaak, door de eigenaar
   aangemaakt met een echt persoonlijk account, nooit online, in de wereld
   rtg-intern; de kamers van het kantoor zijn zijn afdelingen. De bronnen
   hebben de vorm van de echte (accounts, economie, afdelingen). */
const test = require('node:test');
const assert = require('node:assert/strict');
const maak = require('../server/kern/rtghuis');

function wereld() {
  const db = { data: { suppliers: [] } };
  const staff = []; const identiteit = {};
  const kern = {
    afdelingen: { KAMER_IDS: ['financien', 'hr', 'klantenservice'] },
    accounts: {
      findByLogin: (l) => l === 'ria@rtg.test' ? { id: 42, tier: 'rtg' } : null,
      isActief: () => true,
      createAccountStaff: (r) => { const s = { id: staff.length + 1, supplier_code: r.supplierCode, role: r.role, member_id: r.memberId }; staff.push(s); return s; },
      listStaff: (code) => staff.filter(s => s.supplier_code === code)
    },
    makeSupplierCode: (n) => String(n).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6),
    ensureSupplierDefaults: (s) => { if (s.online === undefined) s.online = true; },
    economie: { identiteitZet: (x) => { identiteit[x.drager] = x.wereld; return { ok: true }; }, wereldVanDrager: (d) => identiteit[d] || null }
  };
  return { db, staff, identiteit, h: maak({ db, save: () => {}, kern: () => kern }) };
}

test('er is precies een RTG-zaak, met een echte leidinggevende, nooit online, in rtg-intern', () => {
  const { h, db, identiteit, staff } = wereld();
  assert.equal(h.stand().bestaat, false);
  assert.equal(h.maak({ beheerder: 'Ria' }, 'eigenaar').status, 409, 'zonder bestaand account geen zaak');
  const r = h.maak({ beheerder: 'Ria', beheerderLogin: 'ria@rtg.test' }, 'eigenaar');
  assert.ok(r.ok);
  const s = db.data.suppliers[0];
  assert.equal(s.type, 'rtg'); assert.equal(s.online, false); assert.equal(s.geseed, undefined);
  assert.equal(identiteit['zaak:' + s.code], 'rtg-intern');
  assert.equal(staff[0].member_id, 42);
  assert.equal(h.maak({ beheerder: 'X', beheerderLogin: 'ria@rtg.test' }, 'eigenaar').status, 409, 'geen tweede');
  assert.ok(h.isRtgZaak(s.code.toLowerCase()));
  assert.equal(h.isRtgZaak('KIKUNOI'), false);
});

test('de kamers zijn de afdelingen; alleen een leidinggevende van RTG zet iemand erin', () => {
  const { h, db } = wereld();
  h.maak({ beheerder: 'Ria', beheerderLogin: 'ria@rtg.test' }, 'eigenaar');
  const code = db.data.suppliers[0].code;
  assert.equal(h.afdelingZet('KIKUNOI', '1', ['hr'], { door: '1', leidinggevende: true }).status, 404, 'alleen in de zaak van RTG');
  assert.equal(h.afdelingZet(code, '1', ['hr'], { door: '1', leidinggevende: false }).status, 403);
  assert.equal(h.afdelingZet(code, '1', ['verzonnen'], { door: '1', leidinggevende: true }).status, 422);
  assert.equal(h.afdelingZet(code, '99', ['hr'], { door: '1', leidinggevende: true }).status, 404);
  assert.deepEqual(h.afdelingZet(code, '1', ['hr', 'financien', 'hr'], { door: '1', leidinggevende: true }).kamers, ['hr', 'financien']);
  assert.deepEqual(h.ledenVan('hr'), ['1']);
  assert.deepEqual(h.afdelingZet(code, '1', [], { door: '1', leidinggevende: true }).kamers, []);
  assert.deepEqual(h.ledenVan('hr'), []);
});
