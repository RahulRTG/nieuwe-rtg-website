'use strict';
/* De bevoegdheid als keten (server/kern/commercie/bevoegdheid.js): maken,
   delegeren, passen en terugvolgen.

   test/versmallingswetten.test.js bewijst de wetten van `versmal` op zich. Hier
   gaat het om wat er omheen staat en daar nergens werd beproefd: dat delegeren
   geen andere capability of een andere scope kan opleveren, dat de keten een
   diepte heeft, dat elke weigering in `past` en `pastBinnenDag` de reden draagt
   die bij haar grens hoort, en dat de herkomst de hele rij tot aan de wortel
   teruggeeft. */
const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('../server/kern/commercie/bevoegdheid');

const vast = () => 1760000000000;
const wortel = () => b.maakBevoegdheid({ capability: 'money.refund', scope: '*', grenzen: { maxCenten: 10000000 },
  door: 'directeur', nu: vast });

test('1. een bevoegdheid vraagt een expliciete scope en leesbare grenzen', () => {
  for (const scope of [undefined, null, '', '   '])
    assert.throws(() => b.maakBevoegdheid({ capability: 'x', scope, nu: vast }), /expliciete scope/);
  assert.throws(() => b.maakBevoegdheid({ capability: 'x', scope: '*', grenzen: { maxCenten: 'veel' } }), /Ongeldige grens/);
  const w = wortel();
  assert.equal(w.diepte, 0);
  assert.equal(w.bron, null);
  assert.equal(w.at, 1760000000000);
  assert.deepEqual(w.grenzen, { maxCenten: 10000000 });
  const zonderNaam = b.maakBevoegdheid({ scope: 'zaak:K1' });
  assert.equal(zonderNaam.capability, '');
  assert.equal(zonderNaam.door, null);
  assert.equal(typeof zonderNaam.at, 'number');
});

test('2. delegeren levert nooit een andere capability of een andere concrete scope', () => {
  assert.match(b.delegeer(null, {}).error, /geen bevoegdheid/);
  assert.match(b.delegeer(wortel(), { capability: 'money.payout' }).error, /andere bevoegdheid/);

  const manager = b.delegeer(wortel(), { scope: 'zaak:K1', grenzen: { maxCenten: 2000000 }, door: 'manager', nu: vast });
  assert.equal(manager.ok, true);
  assert.equal(manager.bevoegdheid.scope, 'zaak:K1');
  assert.equal(manager.bevoegdheid.diepte, 1);
  assert.match(b.delegeer(manager.bevoegdheid, { scope: 'zaak:K2' }).error, /valt daarbuiten/);
  assert.equal(b.delegeer(manager.bevoegdheid, { scope: 'zaak:K1' }).ok, true);
  assert.equal(b.delegeer(manager.bevoegdheid, {}).bevoegdheid.scope, 'zaak:K1');
  assert.match(b.delegeer(manager.bevoegdheid, { grenzen: { maxCenten: -5 } }).error, /ongeldige grens/);
});

test('3. een delegatie kan niet verruimen, en een vergeten grens blijft staan', () => {
  const manager = b.delegeer(wortel(), { grenzen: { maxCenten: 2000000 } }).bevoegdheid;
  const agent = b.delegeer(manager, { grenzen: { maxCenten: 20000000, apparaatVertrouwd: true } }).bevoegdheid;
  assert.equal(agent.grenzen.maxCenten, 2000000);
  assert.equal(agent.grenzen.apparaatVertrouwd, true);
  const vergeten = b.delegeer(agent, { grenzen: {} }).bevoegdheid;
  assert.deepEqual(vergeten.grenzen, agent.grenzen);
});

test('4. de keten heeft een diepte, en de herkomst loopt tot aan de wortel', () => {
  let k = wortel();
  for (let i = 1; i <= b.MAX_DIEPTE; i++) {
    const r = b.delegeer(k, { door: 'stap' + i });
    assert.equal(r.ok, true, 'stap ' + i);
    k = r.bevoegdheid;
  }
  assert.equal(k.diepte, b.MAX_DIEPTE);
  assert.match(b.delegeer(k, {}).error, /te diep/);
  const rij = b.herkomst(k);
  assert.equal(rij.length, b.MAX_DIEPTE + 1);
  assert.equal(rij[0].door, 'stap' + b.MAX_DIEPTE);
  assert.equal(rij.at(-1).door, 'directeur');
  assert.deepEqual(b.herkomst(null), []);
});

test('5. past: scope, bedrag, vestiging, apparaat en omkeerbaarheid elk met hun eigen reden', () => {
  assert.match(b.past(null, {}), /geen bevoegdheid/);
  const zaak = b.maakBevoegdheid({ capability: 'c', scope: 'zaak:K1',
    grenzen: { maxCenten: 25000, alleenEigenVestiging: true, apparaatVertrouwd: true, omkeerbaarVerplicht: true } });
  const ctx = { eigenVestiging: true, apparaatVertrouwd: true, omkeerbaar: true };
  assert.equal(b.past(zaak, { scope: 'zaak:K1', waardeCenten: 25000, context: ctx }), null);
  assert.match(b.past(zaak, { waardeCenten: 1, context: ctx }), /noemt niet waarvoor/);
  assert.match(b.past(zaak, { scope: 'zaak:K2', waardeCenten: 1, context: ctx }), /niet voor zaak:K2/);
  assert.match(b.past(zaak, { scope: 'zaak:K1', waardeCenten: 25001, context: ctx }), /hoger dan .*€ 250,01 tegen € 250/);
  assert.match(b.past(zaak, { scope: 'zaak:K1', context: { ...ctx, eigenVestiging: false } }), /eigen vestiging/);
  // onbekend is hier geen nee: alleen een uitdrukkelijk andere vestiging wordt geweigerd
  assert.equal(b.past(zaak, { scope: 'zaak:K1', context: { apparaatVertrouwd: true, omkeerbaar: true } }), null);
  assert.match(b.past(zaak, { scope: 'zaak:K1', context: { ...ctx, apparaatVertrouwd: 'ja' } }), /vertrouwd apparaat/);
  assert.match(b.past(zaak, { scope: 'zaak:K1', context: { ...ctx, omkeerbaar: false } }), /terug te draaien/);

  const kapot = { ...zaak, scope: '*', grenzen: { maxCenten: 'veel' } };
  assert.match(b.past(kapot, { waardeCenten: 1 }), /niet te lezen/);
  assert.equal(b.past(wortel(), { waardeCenten: 'niets' }), null);
});

test('6. pastBinnenDag telt bedrag en aantal over de dag', () => {
  assert.match(b.pastBinnenDag(null, {}), /geen bevoegdheid/);
  const dag = b.maakBevoegdheid({ capability: 'c', scope: '*', grenzen: { maxPerDagCenten: 10000, maxAantalPerDag: 3 } });
  assert.equal(b.pastBinnenDag(dag, { vandaagCenten: 9000, vandaagAantal: 2, waardeCenten: 1000 }), null);
  assert.match(b.pastBinnenDag(dag, { vandaagCenten: 9000, vandaagAantal: 0, waardeCenten: 1001 }), /dagtotaal boven/);
  assert.match(b.pastBinnenDag(dag, { vandaagCenten: 0, vandaagAantal: 3, waardeCenten: 1 }), /aantal handelingen .* bereikt \(3\)/);
  assert.equal(b.pastBinnenDag(wortel(), {}), null);
  assert.match(b.pastBinnenDag({ grenzen: { maxAantalPerDag: 1.5 } }, {}), /niet te lezen/);
});

test('7. euro schrijft centen zoals een mens ze leest', () => {
  assert.equal(b.euro(25000), '€ 250');
  assert.equal(b.euro(25001), '€ 250,01');
  assert.equal(b.euro(150), '€ 1,50');
  assert.equal(b.euro(10000000), '€ 100.000');
});
