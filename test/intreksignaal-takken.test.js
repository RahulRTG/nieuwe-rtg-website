/* HET INTREKSIGNAAL ONDER WEDLOOP (kern/intreksignaal.js), aanvulling op
   test/intreksignaal-weerbaar.test.js.

   Daar staat het signaal onder vergiftigde berichten en een omvallende bus.
   Hier gaat het om de VOLGORDE: Redis meldt "gereed", de herhaling begint, en
   halverwege meldt Redis "weg". Een herhaling uit een oudere verbinding die
   daarna toch afloopt, mag de stand niet op gereed zetten -- dan zouden
   intrekkingen als duurzaam gelden op een leiding die er niet meer is.

   Wat hier niet mag sneuvelen:
   1. een verouderde herhaling (na Redis, of na de outbox) zet de stand niet
      op gereed als er intussen een nieuwere standmelding kwam;
   2. een verouderde herhaling die faalt, besmet de nieuwe verbinding niet met
      haar fout;
   3. een herstelpoging waarvan de herhaling faalt, bewaart die fout (luid in
      wachtDuurzaam) en plant opnieuw; twee fouten kort na elkaar geven één
      herstelpoging en geen storm;
   4. een outbox die niets teruggeeft (null) breekt het herstel niet;
   5. een bus zonder publishDirect publiceert via publish, en ook dan reist er
      alleen een vinger;
   6. een ontbrekend token of sid is nooit "ingetrokken" voor iedereen.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in hydrateer() de eerste `if (huidig !== generatie) return;` weggehaald
     -> "1. een verouderde herhaling na Redis" ZAKT (RAAK)
   - in de onStand-catch `if (huidig !== generatie) return;` weggehaald
     -> "2. een verouderde mislukte herhaling" ZAKT (RAAK)
   - in planHerstel `if (herstelTimer || ...)` vervangen door `if (...)` zonder
     herstelTimer -> "3. een herstel dat faalt" ZAKT (RAAK): twee herhalingen

   Draai: node --test test/intreksignaal-takken.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const signaal = require('../server/kern/intreksignaal');

test.beforeEach(() => signaal._wis());
test.afterEach(() => signaal._wis());

const SID = 'abcdefghijkl';
const straks = () => Date.now() + 60000;
function uitgesteld() { let los, weg; const p = new Promise((a, b) => { los = a; weg = b; }); return { p, los, weg }; }
async function rust() { for (let i = 0; i < 50; i++) await Promise.resolve(); }
function redisBus(herhaal) {
  const b = { soort: 'redis', standFn: null, isGereed: true, herhaald: 0, bewaarFout: null,
    publish() {}, subscribe() {}, onStand(fn) { b.standFn = fn; }, gereed: () => b.isGereed,
    async bewaar() { if (b.bewaarFout) throw b.bewaarFout; },
    herhaal: (...a) => { b.herhaald++; return herhaal(...a); } };
  return b;
}

test('1. een verouderde herhaling na Redis zet de stand niet op gereed', async () => {
  const d = uitgesteld();
  const bus = redisBus(() => d.p);
  signaal.koppelBus(bus);
  bus.standFn({ soort: 'redis', gereed: true });
  bus.standFn({ soort: 'redis', gereed: false });
  d.los([{ versie: 1, bron: 'elders', soort: 'sessie', waarde: SID, verloopt: straks() }]);
  await rust();
  assert.equal(signaal.stand().gereed, false, 'de oude herhaling telt niet meer');
  assert.equal(signaal.sessieIngetrokken(SID), false, 'en levert niets meer af');
});

test('1b. een verouderde herhaling na de outbox zet de stand ook niet op gereed', async () => {
  const d = uitgesteld();
  const bus = redisBus(async () => null);
  signaal.koppelBus(bus);
  signaal.koppelOutbox({ lijst: () => null, voltooi: () => 0, gedeeld: () => d.p });
  bus.standFn({ soort: 'redis', gereed: true });
  await rust();
  bus.standFn({ soort: 'redis', gereed: false });
  d.los(null);
  await rust();
  assert.equal(signaal.stand().gereed, false);
});

test('2. een verouderde mislukte herhaling besmet de nieuwe verbinding niet', async () => {
  const d = uitgesteld();
  const bus = redisBus(() => d.p);
  signaal.koppelBus(bus);
  bus.standFn({ soort: 'redis', gereed: true });
  bus.standFn({ soort: 'lokaal' });
  d.weg(new Error('oude SCAN brak af'));
  await rust();
  assert.equal(await signaal.wachtDuurzaam(), true, 'de fout van de oude verbinding blijft daar');
  assert.equal(signaal.stand().gereed, true);
});

test('3. een herstel dat faalt wordt luid bewaard en opnieuw gepland, zonder storm', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let fout = null;
  const bus = redisBus(async () => { if (fout) throw fout; return []; });
  signaal.koppelBus(bus);
  bus.standFn({ soort: 'redis', gereed: true });
  await rust();
  bus.herhaald = 0;
  assert.equal(signaal.stand().gereed, true);
  bus.bewaarFout = new Error('verbinding weg');
  signaal.meldSessie(SID, straks());
  signaal.meldSessie('tweedesessie', straks());
  await rust();
  assert.equal(signaal.stand().gereed, false);
  fout = new Error('SCAN mislukt in herstel');
  t.mock.timers.tick(500);
  await rust();
  assert.equal(bus.herhaald, 1, 'twee fouten, een herstelpoging');
  await assert.rejects(signaal.wachtDuurzaam(), /SCAN mislukt in herstel/);
  fout = null; bus.bewaarFout = null;
  t.mock.timers.tick(500);
  await rust();
  assert.equal(bus.herhaald, 2, 'na een mislukt herstel komt er een volgende');
  assert.equal(signaal.stand().gereed, true);
  assert.equal(await signaal.wachtDuurzaam(), true);
});

test('4. een outbox die null teruggeeft breekt het herstel niet', async () => {
  const bus = redisBus(async () => undefined);
  signaal.koppelBus(bus);
  signaal.koppelOutbox({ lijst: () => null, voltooi: () => { throw new Error('niets te voltooien'); }, gedeeld: async () => null });
  bus.standFn({ soort: 'redis', gereed: true });
  await rust();
  assert.equal(signaal.stand().gereed, true);
});

test('5. zonder publishDirect via publish, en alleen een vinger', () => {
  const uit = [];
  signaal.koppelBus({ soort: 'lokaal', publish: (k, m) => uit.push(m), subscribe() {} });
  const token = Buffer.from('7').toString('base64url') + '.' + 'f'.repeat(32);
  assert.equal(signaal.meldToken(token), true, 'een token zonder leesbaar verval krijgt de ruime standaard');
  assert.equal(uit.length, 1);
  assert.equal(uit[0].waarde, crypto.createHash('sha256').update(token).digest('hex'));
  assert.ok(uit[0].verloopt > Date.now() + 29 * 86400000);
});

test('6. een ontbrekend token of sid is nooit ingetrokken', () => {
  signaal.meldVinger(crypto.createHash('sha256').update('').digest('hex'), straks());
  assert.equal(signaal.tokenIngetrokken(undefined), true, 'de lege vinger is alleen ingetrokken als iemand hem meldde');
  signaal._wis();
  assert.equal(signaal.tokenIngetrokken(undefined), false);
  assert.equal(signaal.sessieIngetrokken(undefined), false);
  assert.equal(signaal.meldVinger(undefined, straks()), false);
  assert.equal(signaal.meldVinger(null), false);
  const af = signaal.abonneer(42); af();
  const af2 = signaal.bewaakStand('x'); af2();
  const gezien = [];
  const weg = signaal.bewaakStand(s => gezien.push(s.soort));
  weg();
  signaal.koppelBus({ soort: 'lokaal', publish() {}, subscribe() {} });
  assert.deepEqual(gezien, ['geen'], 'na afmelden hoort de standwacht niets meer');
});
