/* PREMIUMDEKKING, STAP A -- het blokformaat en de lezer.

   scripts/lib/premiumdekking.js leest eindcontracten uit docs/domeinkaarten/ en
   rekent per criterium uit of het bewezen is. Hier staat vast: wat een blok is,
   wanneer een criterium telt (alleen een bestaande, verse, gesloten stap),
   dat alleen het toegezegde in de noemer staat, en dat een app met volle
   dekking en een rood bewijs NOOIT Beyond Premium is. Alles op nagemaakte
   kaarten en registers; er wordt niets toegezegd.

   Los: node --test test/premiumdekking.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../scripts/lib/premiumdekking');
const { BEWIJZEN } = require('../scripts/lib/appcontract');

const blok = (json) => '# kaart\n\n```premiumdekking\n' + JSON.stringify(json) + '\n```\n';
const REG = JSON.stringify({ stempel: { op: 'nu', commit: 'abc' }, apps: { 'link:x': { voltooibaar: {
  schakels: [{ nr: 1, stand: 'gesloten' }, { nr: 2, stand: 'stuk' }], storingen: [{ nr: 1, stand: 'gehouden' }] } } } });
const lees = (extra = {}) => (rel) => (rel in extra ? extra[rel] : rel === 'R.json' ? REG : null);
const VERS = () => ({ vers: true, reden: 'nu' });
const OUD = () => ({ vers: false, reden: 'code gewijzigd' });
const door = (soort, nr, pad = ['apps', 'link:x', 'voltooibaar']) => ({ register: 'R.json', pad, stap: { soort, nr } });

test('de lezer vindt blokken in de kaarten en weigert wat geen blok is', () => {
  const kaarten = {
    'docs/domeinkaarten/a.md': blok({ app: 'link:x', criteria: [{ id: 'X1', dimensie: 'los', zin: 'z' }] }) +
      blok({ app: 'link:y', criteria: [{ id: 'X1', dimensie: 'los', zin: 'dubbel id' }, { id: 'Y2', dimensie: 'glamour', zin: 'z' }] }) +
      '```premiumdekking\n{ geen json\n```\n' + blok({ criteria: [] })
  };
  const r = P.leesKaarten({ lees: (k) => kaarten[k] || null, lijst: () => Object.keys(kaarten) });
  assert.deepEqual(r.blokken.map((b) => [b.app, b.criteria.map((c) => c.id)]), [['link:x', ['X1']], ['link:y', []]]);
  assert.ok(r.fouten.some((f) => /id staat al in/.test(f)), r.fouten.join('\n'));
  assert.ok(r.fouten.some((f) => /"glamour" is niet een van de acht/.test(f)), r.fouten.join('\n'));
  assert.ok(r.fouten.some((f) => /geen geldige JSON/.test(f)), r.fouten.join('\n'));
  assert.ok(r.fouten.some((f) => /noemt geen app/.test(f)), r.fouten.join('\n'));
  assert.equal(P.DIMENSIES.length, 8);
});

test('een criterium telt alleen op een bestaande, verse, geslaagde stap', () => {
  const u = (bewezenDoor, versheid = VERS) => P.criteriumUitslag({ id: 'c', dimensie: 'los', zin: 'z', bewezenDoor }, { lees: lees(), versheid });
  assert.equal(u(door('schakel', 1)).bewezen, true);
  assert.equal(u(door('storing', 1)).bewezen, true);
  assert.match(u(door('schakel', 2)).reden, /staat stuk/);
  assert.match(u(door('schakel', 9)).reden, /geen schakel 9/);
  assert.match(u(door('schakel', 1, ['apps', 'link:z', 'voltooibaar'])).reden, /kent apps\/link:z/);
  assert.match(u(door('schakel', 1), OUD).reden, /^vervallen/, 'een verouderd register bewijst niets, ook niet een gesloten stap');
  assert.match(u(undefined).reden, /toegezegd, niet beproefd/);
  assert.match(u({ register: 'R.json' }).reden, /onvolledig/);
  assert.match(u(Object.assign(door('schakel', 1), { register: 'WEG.json' })).reden, /bestaat niet/);
});

test('de dekking is per dimensie bewezen tegen toegezegd; niet toegezegd telt nergens', () => {
  const d = P.dekking([
    { id: 'a', dimensie: 'los', zin: 'z', bewezenDoor: door('schakel', 1) },
    { id: 'b', dimensie: 'los', zin: 'z', bewezenDoor: door('schakel', 2) },
    { id: 'c', dimensie: 'ketens', zin: 'z' }
  ], { lees: lees(), versheid: VERS });
  assert.deepEqual(Object.keys(d).sort(), ['ketens', 'los'], 'alleen dimensies met een toezegging');
  assert.equal(d.los.bewezen, 1); assert.equal(d.los.toegezegd, 2);
  assert.deepEqual(d.los.open.map((o) => o.id), ['b']);
  assert.equal(d.ketens.bewezen, 0); assert.equal(d.ketens.toegezegd, 1);
});

test('volle dekking met een rood bewijs is NOOIT Beyond Premium', () => {
  const rij = (rood) => ({ bewijzen: Object.fromEntries(BEWIJZEN.map((n) => [n, { status: n === rood ? 'GEBLOKKEERD_DOOR_DEFECT' : 'BEWEZEN' }])) });
  const vol = P.dekking(P.DIMENSIES.map((dim, i) => ({ id: 'v' + i, dimensie: dim, zin: 'z', bewezenDoor: door('schakel', 1) })), { lees: lees(), versheid: VERS });
  assert.equal(Object.keys(vol).length, 8);
  assert.equal(P.beyondPremium(rij(null), vol), true);
  for (const n of BEWIJZEN) assert.equal(P.beyondPremium(rij(n), vol), false, n + ' rood en toch Beyond Premium');
  const nietGetest = rij(null); nietGetest.bewijzen.bevoegd.status = 'NIET_GETEST';
  assert.equal(P.beyondPremium(nietGetest, vol), false, 'een ongemeten bewijs is geen groen bewijs');
  /* En een lege dekking is ook geen Beyond Premium: er is niets toegezegd. */
  assert.equal(P.beyondPremium(rij(null), {}), false);
  const half = P.dekking([{ id: 'h', dimensie: 'los', zin: 'z', bewezenDoor: door('schakel', 2) }], { lees: lees(), versheid: VERS });
  assert.equal(P.beyondPremium(rij(null), half), false);
});

test('de echte kaarten: elk blok dat er staat, is geldig (een lege map is ook goed)', () => {
  const r = P.leesKaarten();
  assert.deepEqual(r.fouten, []);
});
