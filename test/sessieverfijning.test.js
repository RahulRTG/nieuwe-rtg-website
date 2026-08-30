/* De sessieverfijning: drie registers, een regel. Meet gedrag. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { REGISTERS, verfijn } = require('../scripts/lib/sessieverfijning');
const alles = () => true;

test('elk register verfijnt een andere uitgangsrol', () => {
  const van = REGISTERS.map(r => r.van);
  assert.equal(new Set(van).size, van.length, 'twee registers op dezelfde uitgangsrol: dan telt de volgorde');
});

test('elk register verfijnt naar een andere rol', () => {
  const naar = REGISTERS.map(r => r.naar);
  assert.equal(new Set(naar).size, naar.length);
});

test('de drie verfijningen doen wat ze beloven', () => {
  assert.equal(verfijn('member', '/api/ik', alles).rol, 'member-account');
  assert.equal(verfijn('supplier', '/api/staff/pauze', alles).rol, 'zaak-persoonlijk');
  assert.equal(verfijn('office', '/api/rtfos/stad', alles).rol, 'kantoor-op-naam');
});

test('een pad dat geen register dekt blijft zoals het is', () => {
  const v = verfijn('member', '/api/mall/bestel', alles);
  assert.equal(v.rol, null);
  assert.equal(v.register, null);
});

/* DE GRENS DIE DRIE KEER DEZELFDE IS. Vanaf een andere rol is het geen
   verfijning maar een ander antwoord. Zonder die grens werd `openbaar` ooit
   `member-zakelijk` (zie NOOIT_OPWAARDEREN in lijfsleutels.js). */
test('vanaf een vreemde rol verfijnt geen enkel register', () => {
  for (const pad of ['/api/ik', '/api/staff/pauze', '/api/rtfos/stad']) {
    for (const rol of ['boardroom', 'techniek', 'openbaar', 'lijfsleutel', 'omgeving']) {
      assert.equal(verfijn(rol, pad, alles).rol, null, rol + ' werd verfijnd op ' + pad);
    }
  }
});

/* EN DE TWEEDE GRENS. Verfijnen naar een rol waar geen sessie voor is
   opgehaald, laat de proef zonder sleutel aankloppen: dat meet niets en ziet
   er in de uitslag uit als een gemeten route. */
test('zonder sessie voor de doelrol wordt er niet verfijnd, met reden', () => {
  const v = verfijn('member', '/api/ik', () => false);
  assert.equal(v.rol, null);
  assert.equal(v.register, 'account');
  assert.match(v.reden, /geen sessie opgehaald/);
});
