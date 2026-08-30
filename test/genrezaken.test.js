/* De genrezaken: een zaaksessie per bedrijfssoort.

   Deze toets meet GEDRAG en geen brontekst. Dat staat hier omdat de vorige
   toets op een opwaarderingsregel wel naar de bron keek en daardoor niet zakte
   toen de regel eruit ging (LAT.md regel 9). */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { ZAKEN, ROSTER_BUDGET, zaakVoor, rolVanZaak, genreRolVoor } = require('../scripts/lib/genrezaken');

test('elke zaak draagt een code, een genre, voorvoegsels en een reden', () => {
  for (const z of ZAKEN) {
    assert.match(z.code, /^[A-Z0-9]{3,12}$/, 'code van ' + JSON.stringify(z));
    assert.ok(z.genre && typeof z.genre === 'string', 'genre van ' + z.code);
    assert.ok(Array.isArray(z.prefixen) && z.prefixen.length, 'voorvoegsels van ' + z.code);
    for (const p of z.prefixen) assert.ok(p.startsWith('/api/'), z.code + ': ' + p);
    assert.ok((z.waarom || '').length >= 30, 'de reden van ' + z.code + ' is te kort om na te lopen');
  }
});

test('geen twee zaken op dezelfde code', () => {
  assert.equal(new Set(ZAKEN.map(z => z.code)).size, ZAKEN.length);
});

/* De rem op /api/supplier/roster is een echte poort met een reden erachter.
   Deze toets zakt zodra de lijst eroverheen groeit, zodat de staart niet stil
   niets meet. */
test('de lijst blijft onder de roster-rem', () => {
  assert.ok(ZAKEN.length <= ROSTER_BUDGET,
    ZAKEN.length + ' zaken tegen een rem van ' + ROSTER_BUDGET + ' opvragingen per kwartier');
});

test('het langste voorvoegsel wint', () => {
  /* /api/supplier/zorgpolis mag niet bij het ziekenhuis belanden, ook al
     begint het met /api/supplier/zorg. */
  assert.equal(zaakVoor('/api/supplier/zorgpolis/lijst').code, 'SEGUR');
  assert.equal(zaakVoor('/api/supplier/zorg/seh/binnen').code, 'CANMISSES');
});

test('een pad zonder genrezaak levert niets op', () => {
  assert.equal(zaakVoor('/api/mall/bestel'), null);
  assert.equal(genreRolVoor('supplier', '/api/mall/bestel').rol, null);
});

test('een zaaksessie wordt verfijnd naar de juiste zaak', () => {
  const g = genreRolVoor('supplier', '/api/supplier/marina/passant');
  assert.equal(g.rol, rolVanZaak('PORTELL'));
  assert.equal(g.reden, null);
});

/* DE GRENS. Alleen `supplier` gaat naar een genrezaak. De burgerroutes onder
   /api/overheid/ en /api/gemeente/ dragen rol `member` -- 48 stuks, gemeten --
   en die horen daar te blijven: een burger die een bezwaar indient is geen
   ambtenaar. Zonder deze grens zou de proef ze met een rijkssessie beproeven
   en dus iets anders meten dan de route doet. */
test('een andere rol dan supplier gaat NIET naar een genrezaak', () => {
  for (const rol of ['member', 'office', 'boardroom', 'openbaar', 'lijfsleutel']) {
    const g = genreRolVoor(rol, '/api/overheid/bezwaar/beslis');
    assert.equal(g.rol, null, rol + ' werd toch naar een genrezaak gestuurd');
    assert.match(g.reden, /geen zaaksessie/);
  }
});

test('de rolnaam van een zaak is eigen en niet "supplier"', () => {
  assert.equal(rolVanZaak('RIJK'), 'zaak:RIJK');
  assert.notEqual(rolVanZaak('RIJK'), 'supplier');
});
