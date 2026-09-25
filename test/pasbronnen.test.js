/* DE TWEE BRONNEN ONDER RETENTIE, NIEUW LID, COHORT EN CHURN
   (kern/pasgeschiedenis.js en kern/aanwezigheid.js; besluiten van de eigenaar,
   25 september 2026).

   Wat hier vastligt:
   1. de pasgeschiedenis legt een overgang vast met codenaam, van, naar en dag --
      en niets anders; een niet-overgang (van === naar) of een onbekende pas niet;
   2. de accountlaag meldt ELKE aanmaak en ELKE verandering via setTier, ook een
      die de luisteraar laat vallen, zonder de overgang zelf tegen te houden;
   3. de aanwezigheid schrijft per lid hooguit een keer per dag, en alleen de dag;
   4. de bewaarveger laat een verlopen lid ook als SLEUTEL verdwijnen, en de
      schrijver gaat door bewerkCollectie (een eigen transactie, buiten de
      requestcommit) zonder dat een fout daar de melder raakt;
   5. beide takken staan in het bewaarbeleid, met de termijnen van het besluit.

   Draai los: node --test test/pasbronnen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function nepDb() { return { data: {} }; }

test('1. de pasgeschiedenis legt alleen een echte overgang vast, en alleen de kale feiten', () => {
  const db = nepDb(); let saves = 0;
  let luisteraar = null;
  const accounts = { opPasOvergang: (fn) => { luisteraar = fn; } };
  const P = require('../server/kern/pasgeschiedenis')({ db, save: () => saves++, accounts });
  assert.equal(typeof luisteraar, 'function', 'de module meldt zich aan bij de accountlaag');
  assert.equal(luisteraar({ codenaam: 'Amberen Vos', van: null, naar: 'rtg', bron: 'aanmaak', naam: 'Jan Jansen' }), true);
  assert.equal(P.noteerPasOvergang({ codenaam: 'Amberen Vos', van: 'rtg', naar: 'rtg' }), false, 'geen overgang');
  assert.equal(P.noteerPasOvergang({ codenaam: 'Amberen Vos', van: 'rtg', naar: 'koning' }), false, 'geen pas');
  assert.equal(P.noteerPasOvergang({ van: 'rtg', naar: 'business' }), false, 'geen codenaam');
  const rijen = P.pasOvergangen();
  assert.equal(rijen.length, 1);
  assert.deepEqual(Object.keys(rijen[0]).sort(), ['bron', 'codenaam', 'naar', 'op', 'van'], 'geen naam, geen reden, geen bedrag');
  assert.equal(saves, 1);
});

test('2. de accountlaag meldt aanmaak en optillen, en een vallende luisteraar houdt niets tegen', async () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-pasbron-'));
  const oud = process.env.RTG_DATA_DIR;
  process.env.RTG_DATA_DIR = map;
  try {
    const accounts = require('../server/accounts');
    if (typeof accounts.init === 'function') accounts.init();
    const gezien = [];
    accounts.opPasOvergang((o) => gezien.push(o));
    const u = accounts.createUserSync({ email: 'pasbron' + Date.now() + '@voorbeeld.test', password: 'geheim123', tier: 'rtg', realName: 'Pas Bron' });
    assert.equal(gezien.length, 1);
    assert.deepEqual([gezien[0].van, gezien[0].naar, gezien[0].bron], [null, 'rtg', 'aanmaak']);
    assert.equal(gezien[0].codenaam, u.codename);
    assert.ok(!JSON.stringify(gezien[0]).includes('Pas Bron'), 'de kluis geeft geen naam mee');
    accounts.setTier(u.id, 'business');
    assert.deepEqual([gezien[1].van, gezien[1].naar, gezien[1].bron], ['rtg', 'business', 'besluit']);
    accounts.setTier(u.id, 'business');
    assert.equal(gezien.length, 2, 'dezelfde pas opnieuw zetten is geen overgang');
    accounts.opPasOvergang(() => { throw new Error('stuk'); });
    const na = accounts.setTier(u.id, 'lifestyle');
    assert.equal(na.tier, 'lifestyle', 'de overgang gaat door');
    assert.equal(accounts.pasMeldStand().fouten, 1, 'maar de gemiste melding telt');
    accounts.opPasOvergang(null);
  } finally {
    if (oud == null) delete process.env.RTG_DATA_DIR; else process.env.RTG_DATA_DIR = oud;
  }
});

test('3. aanwezigheid: een dag per lid, een keer per dag', () => {
  const db = nepDb(); let saves = 0; let t = Date.parse('2026-09-25T09:00:00Z');
  const A = require('../server/kern/aanwezigheid')({ db, save: () => saves++, nu: () => t });
  assert.equal(A.raakAanwezig('Amberen Vos'), true);
  assert.equal(A.raakAanwezig('Amberen Vos'), false, 'tweede bezoek op dezelfde dag schrijft niets');
  t += 86400000;
  assert.equal(A.raakAanwezig('Amberen Vos'), true);
  const rijen = A.laatstActief();
  assert.equal(rijen.length, 1);
  assert.deepEqual(rijen[0], { codenaam: 'Amberen Vos', dag: '2026-09-26' }, 'alleen de dag');
  assert.equal(saves, 2);
  assert.equal(A.raakAanwezig(''), false);
});

test('4. de bewaarveger laat een verlopen lid verdwijnen, ook als sleutel', () => {
  const db = nepDb(); let t = Date.now() - 400 * 86400000;
  const A = require('../server/kern/aanwezigheid')({ db, save: () => {}, nu: () => t });
  A.raakAanwezig('Amberen Vos');
  t = Date.now();
  A.raakAanwezig('Blauwe Reiger');
  const { veeg, rapport } = require('../server/bewaartermijnen');
  rapport(db);
  assert.ok('Amberen Vos' in db.data.laatstActief, 'het rapport wijzigt niets');
  veeg(db, { echt: true });
  assert.deepEqual(Object.keys(db.data.laatstActief), ['Blauwe Reiger'],
    'na dertien maanden is de codenaam weg, niet alleen zijn dag');
});

test('4b. met bewerkCollectie schrijft hij in een eigen transactie, en een fout houdt niets tegen', () => {
  const db = nepDb(); const sleutels = [];
  const bewerk = (sleutel, werk) => { sleutels.push(sleutel); const w = db.data[sleutel] || (db.data[sleutel] = {}); return werk(w); };
  const A = require('../server/kern/aanwezigheid')({ db, save: () => { throw new Error('mag niet: de transactie bewaart zelf'); }, bewerkCollectie: bewerk });
  const P = require('../server/kern/pasgeschiedenis')({ db, save: () => { throw new Error('idem'); }, bewerkCollectie: bewerk });
  assert.equal(A.raakAanwezig('Amberen Vos'), true);
  assert.equal(P.noteerPasOvergang({ codenaam: 'Amberen Vos', van: null, naar: 'rtg' }), true);
  assert.deepEqual(sleutels, ['laatstActief', 'pasOvergangen']);
  assert.equal(P.pasOvergangen()[0].codenaam, 'Amberen Vos');
  const stuk = require('../server/kern/pasgeschiedenis')({ db, save: () => {}, bewerkCollectie: () => Promise.reject(new Error('botsing')) });
  const fout = console.error; console.error = () => {};
  try {
    assert.equal(stuk.noteerPasOvergang({ codenaam: 'Blauwe Reiger', van: null, naar: 'rtg' }), true, 'de melder merkt niets');
  } finally { console.error = fout; }
});

test('5. beide takken staan in het bewaarbeleid met de termijnen van het besluit', () => {
  const { BELEID } = require('../server/bewaarbeleid');
  const pas = BELEID.find(r => r.tak === 'pasOvergangen');
  const aw = BELEID.find(r => r.tak === 'laatstActief');
  assert.ok(pas && aw);
  assert.equal(pas.dagen, 7 * 365, 'pasgeschiedenis: zeven jaar');
  assert.equal(pas.datum, 'op');
  assert.ok(pas.leegWeg && aw.leegWeg, 'de codenaam gaat mee weg');
  assert.equal(aw.dagen, 395, 'laatst actief: dertien maanden');
  assert.equal(aw.datum, 'dag');
});
