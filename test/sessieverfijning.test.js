/* De sessieverfijning: drie registers, een regel. Meet gedrag. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { REGISTERS, verfijn } = require('../scripts/lib/sessieverfijning');
const alles = () => true;

/* HIER STOND "elk register verfijnt een andere uitgangsrol", en dat was een
   PROXY. Hij hield tot er een vijfde register bij kwam: `pas` verfijnt net als
   `account` vanaf `member`, en de toets zakte terecht -- maar op het verkeerde
   kenmerk. Wat er werkelijk toe doet is dat geen PAD door twee registers wordt
   geclaimd; dan kan de volgorde nooit beslissen wat er gebeurt. */
test('geen pad wordt door twee registers geclaimd', () => {
  const alle = [];
  for (const r of REGISTERS) {
    assert.ok(Array.isArray(r.paden), r.naam + ' hoort zijn paden te noemen, anders is dit niet te toetsen');
    for (const p of r.paden) alle.push({ register: r.naam, pad: p });
  }
  assert.ok(alle.length > 5, 'er horen paden te zijn om te vergelijken');
  const botsingen = [];
  for (const a of alle) for (const b of alle) {
    if (a.register === b.register) continue;
    const raakt = a.pad === b.pad || a.pad.startsWith(b.pad + '/') || b.pad.startsWith(a.pad + '/');
    if (raakt) botsingen.push(a.register + ' ' + a.pad + '  <->  ' + b.register + ' ' + b.pad);
  }
  assert.deepEqual(botsingen, [], 'twee registers claimen hetzelfde pad; dan beslist de volgorde');
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
