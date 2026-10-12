/* Rahul in het genootschap krijgt een LEESWEERGAVE, nooit de modules zelf.

   kern/genootschap/ai.js kreeg het hele prikbord, de hele bijeenkomstmodule en
   het hele genootschap mee -- dus `stem`, `weg`, `plaats`, `roepBijeen` en
   `afgelast` lagen binnen bereik van de code die met een model praat. Zijn eigen
   kop belooft "hij stelt voor, de mens plaatst", maar niets hield dat tegen
   behalve dat niemand het nog had opgeschreven (GEMEENSCHAP-FASE0.md par. 6,
   gebrek 4). Nu krijgt hij vier leesfuncties, bevroren, en de module noemt de
   drie domeinobjecten niet eens meer.

   MUTATIES GEZIEN ZAKKEN: (a) in leesweergave.js `stem: prikbord.stem` erbij --
   toets 1 zakt; (b) in ai.js de parameter `prikbord` terug en
   `prikbord.stem(...)` aanroepen -- toets 3 zakt; (c) in kernlaag4-gemeenschap.js weer
   `prikbord: kern.prikbord` meegeven -- toets 4 zakt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { zonderCommentaar, zonderTekst } = require('../scripts/lib/bron');

const WORTEL = path.join(__dirname, '..');
const { leesweergave } = require('../server/kern/genootschap/leesweergave.js');

const schrijft = () => { throw new Error('de AI-laag riep een schrijffunctie aan'); };
function domein() {
  const gr = { id: 1, naam: 'De Proefclub', leden: [{ key: 'a', rol: 'beheerder' }, { key: 'b', rol: 'lid' }] };
  return {
    genootschap: { groepMet: id => (String(id) === '1' ? gr : null), isLid: (g, k) => g.leden.some(l => l.key === k),
      isBeheer: schrijft, richtOp: schrijft, nodigUit: schrijft },
    prikbord: { regels: () => ['Codenaam-a: Donderdag vergaderen we.'], stem: schrijft, weg: schrijft,
      plaats: schrijft, reageer: schrijft, lees: schrijft },
    bijeenkomst: { agenda: () => ({ ok: true, komt: [{ datum: '2099-01-01', tijd: '20:00', wat: 'Borrel',
      ja: 1, misschien: 0, nee: 0 }], geweest: [] }), roepBijeen: schrijft, afgelast: schrijft, antwoord: schrijft }
  };
}

test('1. de leesweergave draagt precies vier leesfuncties, en is bevroren', () => {
  const lees = leesweergave(domein());
  assert.deepEqual(Object.keys(lees).sort(), ['agenda', 'groepMet', 'isLid', 'regels']);
  assert.ok(Object.isFrozen(lees), 'een weergave die je kunt aanvullen is geen grens');
  for (const f of Object.values(lees)) assert.equal(typeof f, 'function');
});

test('2. Rahul werkt op de leesweergave, en raakt geen schrijffunctie', async () => {
  const ai = require('../server/kern/genootschap/ai.js')({ anthropic: null, lees: leesweergave(domein()) });
  const s = await ai.prikbordSamen({ key: 'b' }, 1);
  assert.ok(s.ok, s.reden);
  assert.equal(s.aantal, 1);
  const d = await ai.datumRaad({ key: 'b' }, 1);
  assert.ok(d.ok, d.reden);
  assert.equal(d.beste, '2099-01-01');
  const geen = await ai.prikbordSamen({ key: 'vreemd' }, 1);
  assert.equal(geen.status, 403, 'wie geen lid is, krijgt niets');
});

test('3. kern/genootschap/ai.js noemt de domeinobjecten niet', () => {
  const bron = zonderTekst(zonderCommentaar(fs.readFileSync(path.join(WORTEL, 'server/kern/genootschap/ai.js'), 'utf8')));
  for (const naam of ['prikbord', 'bijeenkomst', 'genootschap'])
    assert.ok(!new RegExp('\\b' + naam + '\\b').test(bron),
      'ai.js noemt `' + naam + '`: dan ligt een schrijffunctie weer binnen bereik van de AI-laag');
  assert.ok(!/\.(stem|weg|plaats|reageer|roepBijeen|afgelast|antwoord|richtOp|nodigUit)\s*\(/.test(bron),
    'ai.js roept een schrijffunctie aan');
});

test('4. de montage geeft de AI-laag de leesweergave en niet de modules', () => {
  const bron = zonderCommentaar(fs.readFileSync(path.join(WORTEL, 'server/opzet/kernlaag4-gemeenschap.js'), 'utf8'));
  const i = bron.indexOf("require('../kern/genootschap/ai')");
  assert.ok(i >= 0, 'de AI-laag van het genootschap wordt niet meer gemonteerd waar deze toets hem zoekt');
  const aanroep = bron.slice(i, bron.indexOf(');', i));
  assert.match(aanroep, /\blees\s*:\s*leesweergave\(/, 'de AI-laag krijgt geen leesweergave');
  // wat BINNEN leesweergave(...) staat is juist de bedoeling; wat de AI-laag zelf krijgt, niet
  const zelf = aanroep.replace(/leesweergave\(\{[^}]*\}\)/, 'leesweergave(...)');
  assert.ok(!/\b(prikbord|bijeenkomst|genootschap)\s*:\s*kern\./.test(zelf), 'de AI-laag krijgt een hele module mee');
});
