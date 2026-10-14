/* HET INZAGEJOURNAAL ALS DE OPSLAG HAPERT (server/inzagelog.js, -vast.js,
   -lezen.js en -veel.js).

   Het journaal is het antwoord op "wie heeft mijn naam opgezocht, en waarom?".
   noteerVast() is de vorm die mag WEIGEREN: geen aantoonbaar spoor, geen
   inzage. Deze toets zet elke voorwaarde onder dat spoor om de beurt plat --
   geen opslag, geen vastlegger, een vastlegger die weigert, een opslag die
   haar duurzaamheid niet kan tonen -- en kijkt of de uitslag dat eerlijk zegt.

   Wat hier niet mag sneuvelen:
   1. zonder opslag of zonder duurzame vastlegger is de uitslag 503 en wordt er
      niets geschreven -- nooit een geslaagde regel over iets dat nergens staat;
   2. een vastlegger die weigert zonder status geeft toch een 503, en zijn
      foutmelding gaat ongewijzigd door;
   3. een opslag die niet kan tonen dat ze duurzaam is (of wier controle zelf
      omvalt) geeft `vast: false` met een reden, BINNEN de hash -- geen valse
      bevestiging, en de keten blijft heel;
   4. zelf-inzage is ok zonder regel; een lege of ontbrekende trefferlijst is ok
      zonder regel (geen 503 op een zoekopdracht zonder resultaat);
   5. het verzoek-id en de release staan in de regel en de hash dekt ze: wie
      het verzoek-id achteraf wijzigt, breekt de keten;
   6. een save() die gooit houdt het spoor niet tegen;
   7. de leeskant: filteren op kijker, en een onbekende termijn of een
      onleesbare noodremteller wordt geen valse belofte van volledigheid.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in inzagelog-vast `if (!heeftOpslag())` vervangen door `if (false)`
     -> "1. zonder opslag" ZAKT (RAAK)
   - in inzagelog-vast `catch (e) { return false; }` in kanBewijzen vervangen
     door `return true` -> "3. een opslag die het niet kan tonen" ZAKT (RAAK)
   - in inzagelog-vast `uit.status || 503` vervangen door `uit.status`
     -> "2. een weigerende vastlegger" ZAKT (RAAK)

   Draai: node --test test/inzagejournaal-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const inzagelog = require('../server/inzagelog');
const maakLezen = require('../server/inzagelog-lezen');
const verzoekcontext = require('../server/db/verzoekcontext');
const releaseId = require('../server/lib/releaseidentiteit');

test.after(() => inzagelog.zet(null, null));
const opdracht = { door: { id: 7, naam: 'balie' }, over: { id: 42, codenaam: 'ZILVEREN HERT' }, waarom: 'KYC-controle', bron: 'balie' };

test('1. zonder opslag of zonder vastlegger: 503 en niets geschreven', async () => {
  inzagelog.zet(null, null);
  const geen = await inzagelog.noteerVast(opdracht);
  assert.deepEqual([geen.ok, geen.status, geen.reden], [false, 503, 'geen-opslag']);
  const db = { data: {} };
  inzagelog.zet(db, () => {}, null);
  const los = await inzagelog.noteerVast(opdracht);
  assert.deepEqual([los.ok, los.status, los.reden], [false, 503, 'geen-vastlegger']);
  assert.equal((db.data.inzageLog || []).length, 0, 'er staat niets');
});

test('2. een vastlegger die weigert zonder status geeft toch een 503', async () => {
  const db = { data: {} };
  inzagelog.zet(db, () => {}, async (m) => { await m(); return { error: 'commit niet bevestigd' }; }, () => true);
  const uit = await inzagelog.noteerVast(opdracht);
  assert.deepEqual(uit, { ok: false, status: 503, reden: 'niet-bevestigd', error: 'commit niet bevestigd' });
  inzagelog.zet(db, () => {}, async () => ({ status: 507, error: 'vol' }));
  assert.equal((await inzagelog.noteerVast(opdracht)).status, 507, 'een eigen status gaat door');
});

test('3. een opslag die haar duurzaamheid niet kan tonen: vast false, met reden, binnen de hash', async () => {
  for (const bevestigbaar of [() => false, () => { throw new Error('teller kapot'); }]) {
    const db = { data: {} };
    inzagelog.zet(db, () => {}, async (m) => { await m(); }, bevestigbaar);
    const uit = await inzagelog.noteerVast(opdracht);
    assert.equal(uit.ok, true, 'de inzage gaat door: de weigering hangt aan de commit');
    assert.equal(uit.regel.vast, false);
    assert.equal(uit.regel.vastWaarom, 'deze opslag kan duurzaamheid niet bevestigen');
    assert.equal(inzagelog.controleer().ok, true, 'de keten dekt de regel zoals hij is geschreven');
  }
  const db = { data: {} };
  inzagelog.zet(db, () => {}, async (m) => { await m(); });
  const hard = await inzagelog.noteerVast(opdracht);
  assert.equal(hard.regel.vast, true, 'zonder controle op bewijsbaarheid: bevestigd');
});

test('4. zelf-inzage en een lege trefferlijst zijn ok zonder regel', async () => {
  const db = { data: {} };
  inzagelog.zet(db, () => {}, async (m) => { await m(); });
  assert.deepEqual(await inzagelog.noteerVast({ door: { id: 5 }, over: { id: '5' }, waarom: 'eigen dossier' }), { ok: true, zelf: true, regel: null });
  assert.deepEqual(await inzagelog.noteerVeelVast({ door: { id: 7 }, overIds: [], waarom: 'zoeken' }), { ok: true, leeg: true, regel: null });
  assert.deepEqual(await inzagelog.noteerVeelVast({ door: { id: 7 }, overIds: 'geen-lijst', waarom: 'zoeken' }), { ok: true, leeg: true, regel: null });
  assert.equal(inzagelog.noteerVeel({ door: { id: 7 }, waarom: 'zoeken' }), null);
  const veel = await inzagelog.noteerVeelVast({ door: { id: 7 }, overIds: [1, 2, 3], waarom: 'lijstscherm', bron: 'leden' });
  assert.equal(veel.ok, true);
  assert.deepEqual([veel.regel.overId, veel.regel.aantal, veel.regel.overIds], [null, 3, ['1', '2', '3']]);
  assert.equal(db.data.inzageLog.length, 1);
});

test('5. verzoek-id en release staan in de regel, en de hash dekt ze', () => {
  const db = { data: {} };
  inzagelog.zet(db, () => {});
  releaseId.release({ vers: true, env: { RTG_RELEASE_COMMIT: 'abcdef1234567' } });
  try {
    const r = verzoekcontext.voer(verzoekcontext.nieuw({ id: 'verzoek-' + 'x'.repeat(60) }), () => inzagelog.noteer(opdracht));
    assert.equal(r.verzoek, 'verzoek-' + 'x'.repeat(32), 'begrensd op veertig tekens');
    assert.equal(r.release, 'abcdef1234567');
    assert.equal(inzagelog.controleer().ok, true);
    db.data.inzageLog[0].verzoek = 'een-ander-verzoek';
    assert.equal(inzagelog.controleer().ok, false, 'achteraf het verzoek wijzigen breekt de keten');
    const zonder = verzoekcontext.voer(verzoekcontext.nieuw({}), () => inzagelog.noteer(opdracht));
    assert.equal('verzoek' in zonder, false, 'geen verzonnen id');
  } finally { releaseId.release({ vers: true }); }
});

test('6. een save() die gooit houdt het spoor niet tegen', () => {
  const db = { data: {} };
  inzagelog.zet(db, () => { throw new Error('schijf vol'); });
  const r = inzagelog.noteer(opdracht);
  assert.equal(r.overId, '42');
  assert.equal(db.data.inzageLog.length, 1);
});

test('7. de leeskant: kijkerfilter, en geen valse volledigheid', () => {
  const db = { data: {} };
  inzagelog.zet(db, () => {});
  inzagelog.noteer(opdracht);
  inzagelog.noteer({ ...opdracht, door: { id: 8, naam: 'tweede' } });
  assert.deepEqual(inzagelog.lijst({ doorId: 8 }).map(r => r.door), ['tweede']);
  assert.deepEqual(inzagelog.lijst({ doorId: '7', overId: 42 }).map(r => r.door), ['balie']);
  Object.defineProperty(db.data, 'inzageLogAfgekapt', { get() { throw new Error('onleesbaar'); } });
  assert.equal(inzagelog.samenvatting().bewaring.afgekaptDoorNoodrem, 0);

  const l = maakLezen({ rij: () => [], bewaardagen: undefined, afgekapt: () => { throw new Error('weg'); } });
  const b = l.voorBetrokkene(42);
  assert.equal(b.bewaardagen, null);
  assert.equal(b.belofte, 'De bewaartermijn van dit journaal is hier niet vast te stellen.');
  const gebeten = maakLezen({ rij: () => [], bewaardagen: 730, afgekapt: () => 3 }).voorBetrokkene(42);
  assert.equal(gebeten.volledig, false);
  assert.match(gebeten.tekort, /3 regel\(s\) door de noodrem/);
});
