'use strict';
/* Het terrein van RTG Festival als boom (server/kern/festival/terrein.js), met
   alle deuren.

   test/festival.test.js bouwt een terrein dat klopt en kijkt wat de poort
   ermee doet. Hier gaat het om wat er bij het BOUWEN wordt geweigerd, want elke
   weigering in die module staat er omdat de boom anders stil scheef komt te
   hangen: een onbekende soort die nooit meetelt, iets in een poort, een lus, een
   boom die dieper gaat dan plekPad nog wil volgen, en een plek met kinderen die
   weg moet. Geen weigering mag de boom veranderen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { schoon } = require('../server/kern/util');
const maakFestival = require('../server/kern/festival');

function wereld() {
  const db = { data: {} };
  const k = maakFestival({ db, save() {}, crypto, schoon });
  const fid = k.festivalNieuw('ZAAK1', { naam: 'Testival' }).festival.id;
  const eid = k.editieNieuw(fid, { jaar: 2027 }).editie.id;
  const zet = (d) => k.plekZet(fid, eid, d);
  const e = () => k.editieVind(fid, eid);
  return { k, fid, eid, zet, e };
}

test('1. een plek vraagt een naam en een soort die bestaat', () => {
  const w = wereld();
  assert.equal(w.k.plekZet(w.fid, 'ed-weg', { naam: 'x', soort: 'terrein' }).status, 404);
  assert.match(w.zet({ soort: 'terrein' }).error, /naam/);
  assert.match(w.zet({ naam: 'Wei' }).error, /\(leeg\)/);
  assert.match(w.zet({ naam: 'Wei', soort: 'toiletten' }).error, /toiletten/);
  assert.match(w.zet({ naam: 'Wei', soort: 'toString' }).error, /Onbekende soort/);
  assert.deepEqual(w.e().plekken, {});
});

test('2. capaciteit, veilige capaciteit, ombouwtijd en doorstroom worden begrensd', () => {
  const w = wereld();
  const t = w.zet({ naam: 'Wei', soort: 'terrein', capaciteit: '5000', veiligeCapaciteit: '4000',
    changeover: '999', doorstroom: '-3' }).plek;
  assert.equal(t.capaciteit, 5000);
  assert.equal(t.veiligeCapaciteit, 4000);
  assert.equal(t.changeover, 240);
  assert.equal(t.doorstroom, 0);
  assert.equal(t.besloten, false);
  const standaard = w.zet({ naam: 'Wei 2', soort: 'terrein', capaciteit: 100 }).plek;
  assert.equal(standaard.veiligeCapaciteit, 100);
  assert.equal(standaard.changeover, 0);
  assert.match(w.zet({ naam: 'Te vol', soort: 'terrein', capaciteit: 10, veiligeCapaciteit: 11 }).error, /veilige capaciteit/);
  const kaal = w.zet({ naam: 'Kaal', soort: 'terrein', capaciteit: 'veel', besloten: 'ja' }).plek;
  assert.equal(kaal.capaciteit, 0);
  assert.equal(kaal.besloten, false);
});

test('3. alleen een terrein is een wortel, en in een poort ligt niets', () => {
  const w = wereld();
  const t = w.zet({ naam: 'Wei', soort: 'terrein' }).plek;
  assert.match(w.zet({ naam: 'Zweef', soort: 'terrein', ouder: t.id }).error, /geen ouder/);
  assert.match(w.zet({ naam: 'Los', soort: 'zone' }).error, /hoort in een terrein/);
  assert.equal(w.zet({ naam: 'Nergens', soort: 'zone', ouder: 'plek-weg' }).status, 404);
  const poort = w.zet({ naam: 'Noord', soort: 'ingang', ouder: t.id }).plek;
  assert.match(w.zet({ naam: 'Bar', soort: 'bar', ouder: poort.id }).error, /In een poort ligt niets/);
  const zone = w.zet({ naam: 'Zone A', soort: 'zone', ouder: t.id, besloten: true }).plek;
  assert.equal(zone.besloten, true);
});

test('4. een boom gaat niet dieper dan acht lagen', () => {
  const w = wereld();
  let ouder = w.zet({ naam: 'Wei', soort: 'terrein' }).plek.id;
  for (let i = 2; i <= 8; i++) ouder = w.zet({ naam: 'Laag ' + i, soort: 'zone', ouder }).plek.id;
  assert.equal(w.k.plekPad(w.e(), ouder).length, 8);
  assert.match(w.zet({ naam: 'Laag 9', soort: 'zone', ouder }).error, /8 lagen/);
});

test('5. een plek kan niet in zichzelf liggen, en een scheve boom wordt eerst hersteld', () => {
  const w = wereld();
  const t = w.zet({ naam: 'Wei', soort: 'terrein' }).plek;
  const a = w.zet({ naam: 'A', soort: 'zone', ouder: t.id }).plek;
  const b = w.zet({ naam: 'B', soort: 'zone', ouder: a.id }).plek;
  assert.match(w.zet({ id: a.id, naam: 'A', soort: 'zone', ouder: a.id }).error, /in zichzelf/);
  assert.match(w.zet({ id: a.id, naam: 'A', soort: 'zone', ouder: b.id }).error, /in zichzelf/);
  assert.equal(w.zet({ id: 'plek-weg', naam: 'A', soort: 'zone', ouder: t.id }).status, 404);

  // een bijgewerkte plek houdt zijn id en neemt de nieuwe waarden over
  const hernoemd = w.zet({ id: b.id, naam: 'B nieuw', soort: 'podium', ouder: t.id, changeover: 30 });
  assert.equal(hernoemd.plek.id, b.id);
  assert.equal(hernoemd.plek.soort, 'podium');
  assert.equal(hernoemd.plek.changeover, 30);
  assert.equal(w.k.plekIn(w.e(), b.id, t.id), true);
  assert.equal(w.k.plekIn(w.e(), b.id, a.id), false);

  // een ouder die verdwenen is: het pad is niet te vertrouwen, en er komt niets bij
  w.e().plekken[a.id].ouder = 'plek-weg';
  assert.equal(w.k.plekPad(w.e(), a.id), null);
  assert.equal(w.k.plekIn(w.e(), a.id, t.id), false);
  assert.equal(w.zet({ naam: 'C', soort: 'zone', ouder: a.id }).status, 409);
  assert.equal(w.k.plekPad(w.e(), 'plek-weg'), null);
});

test('6. een lus in opgeslagen gegevens laat plekPad stoppen in plaats van hangen', () => {
  const w = wereld();
  const t = w.zet({ naam: 'Wei', soort: 'terrein' }).plek;
  const a = w.zet({ naam: 'A', soort: 'zone', ouder: t.id }).plek;
  const b = w.zet({ naam: 'B', soort: 'zone', ouder: a.id }).plek;
  w.e().plekken[a.id].ouder = b.id;
  assert.equal(w.k.plekPad(w.e(), b.id), null);
});

test('7. weghalen kan alleen bij een lege plek, en de boom toont wat er is', () => {
  const w = wereld();
  const t = w.zet({ naam: 'Wei', soort: 'terrein' }).plek;
  const z = w.zet({ naam: 'Zone', soort: 'zone', ouder: t.id }).plek;
  w.zet({ naam: 'Bar', soort: 'bar', ouder: z.id });
  assert.equal(w.k.plekWeg(w.fid, 'ed-weg', t.id).status, 404);
  assert.equal(w.k.plekWeg(w.fid, w.eid, 'plek-weg').status, 404);
  assert.match(w.k.plekWeg(w.fid, w.eid, t.id).error, /\(1\)/);

  const boom = w.k.plekBoom(w.fid, w.eid);
  assert.equal(boom.boom.length, 1);
  assert.equal(boom.boom[0].rol.wortel, true);
  assert.equal(boom.boom[0].in[0].in[0].naam, 'Bar');
  assert.deepEqual(boom.boom[0].in[0].in[0].rol, {});
  assert.equal(w.k.plekBoom(w.fid, 'ed-weg').status, 404);

  const bar = boom.boom[0].in[0].in[0].id;
  assert.deepEqual(w.k.plekWeg(w.fid, w.eid, bar), { ok: true });
  assert.deepEqual(w.k.plekWeg(w.fid, w.eid, z.id), { ok: true });
  assert.equal(w.k.plekVind(w.e(), z.id), null);
  assert.equal(w.k.plekVind(null, t.id), null);
});
