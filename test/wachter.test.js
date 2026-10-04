/* De storingswachter: de automaat van de schakelkast (server/functies/wachter.js).

   Elke regel van de wachter staat hier als eigen toets, want elke regel kan
   afzonderlijk wegvallen zonder dat de anderen het merken:

     1. dicht op bewijs (drempel EN meerderheid), niet op een incident
     2. een 503 telt nooit mee (anders klapt de kast zichzelf dicht)
     3. de hand wint: standen zonder automaat-merk blijven met rust gelaten
     4. proefopening met verdubbelende wachttijd
     5. herstel na tien schone proefvensters wist de rondes

   De klok is geinjecteerd (nu), dus geen enkele toets slaapt echt: tijd
   verstrijkt door de klok te verzetten. Het pad '/api/salon/x' hoort bij de
   echte functie 'salon' uit de catalogus -- de padkoppeling loopt dus ook
   echt, niet via een verzonnen functie-id.

   Draai los: node --test test/wachter.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakWachter } = require('../server/functies/wachter');

const PAD = '/api/salon/x';   // valt onder functie 'salon'
const ID = 'salon';

function bouw(instel, maak = maakWachter) {
  const db = { data: { techniek: { functies: {} } } };
  let tijd = 1000000;
  const stappen = [];
  const w = maak({
    db,
    save: () => stappen.push('save'),
    sseToOffice: (ev, d) => stappen.push('sse:' + (d && d.scope)),
    nu: () => tijd,
    instel: Object.assign({ vensterMs: 60000, drempel: 5, aandeel: 0.5, herstelMs: 120000, proefMs: 120000 }, instel)
  });
  return { db, w, stappen, zetTijd: t => { tijd = t; }, tik: ms => { tijd += ms; },
    stand: () => db.data.techniek.functies[ID] || {},
    log: () => db.data.techniek.wachterLog || [] };
}

test('1a. vijf serverfouten binnen het venster gooien de functie dicht', () => {
  const { w, stand, log, stappen } = bouw();
  for (let i = 0; i < 5; i++) w.meet(PAD, 500);
  assert.equal(stand().aan, false, 'de functie staat dicht');
  assert.ok(stand().storing && /Automaat/.test(stand().storing.reden), 'met de automaat als afzender op de storing');
  assert.equal(stand().automaat.ronde, 1, 'ronde 1');
  assert.equal(log()[0].wat, 'dicht');
  assert.ok(stappen.includes('save') && stappen.includes('sse:functies'), 'bewaard en live gemeld');
});

test('1b. vijf fouten tussen twintig successen zijn een bug, geen uitval: open blijven', () => {
  const { w, stand } = bouw();
  for (let i = 0; i < 20; i++) w.meet(PAD, 200);
  for (let i = 0; i < 5; i++) w.meet(PAD, 500);
  assert.notEqual(stand().aan, false, 'de meerderheids-eis houdt hem open');
});

test('1c. vier fouten zijn onder de drempel: open blijven', () => {
  const { w, stand } = bouw();
  for (let i = 0; i < 4; i++) w.meet(PAD, 500);
  assert.notEqual(stand().aan, false);
});

test('1d. fouten buiten het venster tellen niet meer mee', () => {
  const { w, stand, tik } = bouw();
  for (let i = 0; i < 4; i++) w.meet(PAD, 500);
  tik(61000);                         // het venster verschuift voorbij de vier
  w.meet(PAD, 500);
  assert.notEqual(stand().aan, false, 'een verse enkele fout staat er weer alleen voor');
});

test('2. een 503 telt nooit mee -- dat is de taal van bewust dicht', () => {
  const { w, stand } = bouw();
  for (let i = 0; i < 30; i++) w.meet(PAD, 503);
  assert.notEqual(stand().aan, false, 'dertig 503s en de automaat verroert zich niet');
});

test('3a. een stand die de HAND dicht zette, opent de automaat nooit', () => {
  const { db, w, tik } = bouw();
  db.data.techniek.functies[ID] = { aan: false };   // geen automaat-merk: dit was een mens
  tik(10 * 3600000);
  w.herstelronde();
  assert.equal(db.data.techniek.functies[ID].aan, false, 'tien uur later staat hij nog precies zo');
});

test('3b. wachter uit voor een functie: de automaat blijft er volledig af', () => {
  const { db, w, stand } = bouw();
  db.data.techniek.functies[ID] = { wachter: false };
  for (let i = 0; i < 25; i++) w.meet(PAD, 500);
  assert.notEqual(stand().aan, false, 'een kwart honderd fouten en hij grijpt niet');
});

test('4. proefopening na de wachttijd, en de wachttijd verdubbelt per ronde', () => {
  const { w, stand, tik } = bouw();
  for (let i = 0; i < 5; i++) w.meet(PAD, 500);
  assert.equal(stand().aan, false);
  tik(119000); w.herstelronde();
  assert.equal(stand().aan, false, 'voor de wachttijd om is blijft hij dicht');
  tik(2000); w.herstelronde();
  assert.notEqual(stand().aan, false, 'na de wachttijd gaat hij op proef open');
  assert.equal(stand().storing, null, 'de storing is dan van het bord');
  // hij valt meteen weer om: ronde 2, en nu duurt het TWEE keer zo lang
  for (let i = 0; i < 5; i++) w.meet(PAD, 500);
  assert.equal(stand().automaat.ronde, 2);
  tik(121000); w.herstelronde();
  assert.equal(stand().aan, false, 'na een enkel herstelvenster nog dicht (backoff)');
  tik(120000); w.herstelronde();
  assert.notEqual(stand().aan, false, 'na het dubbele venster weer op proef open');
});

test('5. tien schone proefvensters en de automaat vergeet de rondes', () => {
  const { w, stand, tik, log } = bouw();
  for (let i = 0; i < 5; i++) w.meet(PAD, 500);
  tik(121000); w.herstelronde();                    // op proef open
  assert.ok(stand().automaat && stand().automaat.proefAt, 'het automaat-merk blijft tijdens de proef');
  tik(10 * 120000 + 1000); w.herstelronde();
  assert.equal(stand().automaat, undefined, 'het merk is weg: hersteld');
  assert.equal(log()[0].wat, 'hersteld');
});

test('6. een pad zonder functie raakt niets (en crasht niets)', () => {
  const { db, w } = bouw();
  for (let i = 0; i < 25; i++) w.meet('/api/bestaat-echt-niet-xyz', 500);
  assert.deepEqual(db.data.techniek.functies, {}, 'geen enkele stand aangeraakt');
});

// Observeer de eigen Map zonder introspectiedeur in de productie-API.
function inspecteer() {
  const bestand = require.resolve('../server/functies/wachter');
  const ramen = [];
  const module = { exports: {} };
  require('node:vm').runInNewContext(require('node:fs').readFileSync(bestand, 'utf8'), {
    module, require: require('node:module').createRequire(bestand),
    Map: class extends Map { constructor() { super(); ramen.push(this); } }
  }, { filename: bestand });
  return Object.assign(bouw({}, module.exports.maakWachter), { ramen: ramen[0] });
}

test('7. herstelronde ruimt verlopen stille functies op zonder opslag of SSE', () => {
  const { w, ramen, tik, stappen } = inspecteer();
  const paden = ['/api/state', '/api/notifications', '/api/verkoop/mijn',
    '/api/pay/overzicht', '/api/office/state', '/api/supplier/backoffice'];
  for (const pad of paden) for (let n = 0; n < 3; n++) w.meet(pad, 200);
  assert.equal(ramen.size, 6, 'zes echte catalogusfuncties gemeten');
  tik(60000); assert.equal(w.herstelronde(), false);
  assert.equal(ramen.size, 6, 'exact op de venstergrens blijven ze geldig');
  tik(1); assert.equal(w.herstelronde(), false);
  assert.equal(ramen.size, 0, 'ook zonder volgend verzoek zijn alle verlopen objecten vrij');
  assert.deepEqual(stappen, [], 'geheugenopruiming muteert geen persistentie of signalen');
});

test('8. alleen gelijke tijdstippen delen opslag, alle responses blijven meetellen', () => {
  const { w, ramen, tik, stand } = inspecteer();
  for (let n = 0; n < 20; n++) w.meet(PAD, 200);
  for (let n = 0; n < 5; n++) w.meet(PAD, 500);
  w.meet(PAD, 503);
  const raam = ramen.get(ID);
  assert.ok(Array.isArray(raam.rijen), 'getelde rijen in plaats van een object per response');
  assert.equal(raam.rijen.length, 1);
  assert.equal(raam.aantal, 25); assert.equal(raam.fouten, 5);
  assert.notEqual(stand().aan, false);
  tik(1); w.meet(PAD, 502);
  assert.equal(raam.rijen.length, 2, 'een andere milliseconde houdt haar eigen grens');
  tik(60000); w.herstelronde();
  assert.equal(raam.rijen.length, 1); assert.equal(raam.aantal, 1);
  assert.equal(raam.fouten, 1, 'alleen de nieuwste fout is nog geldig');
  for (let n = 0; n < 4; n++) w.meet(PAD, 500);
  assert.equal(stand().aan, false, 'de overgebleven fout telt mee voor de vijf');
});

test('9. exact getelde tijdstippen volgen het individuele-responsemodel', () => {
  // Het model bewaart bewust iedere response afzonderlijk en berekent steeds
  // opnieuw. Geen aggregatie, cache of productiehelper in het verwachte oordeel.
  for (const [drempel, aandeel] of [[5, 0.5], [7, 0.25], [2, 0.8]]) {
    for (let seed = 1; seed <= 8; seed++) {
      const b = bouw({ vensterMs: 31, drempel, aandeel });
      let tijd = 1000000, punten = [], rng = seed, gesloten = 0;
      const trek = n => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng % n; };
      for (let stap = 0; stap < 500; stap++) {
        const burst = stap < drempel + 2;
        tijd += burst ? 0 : [0, 0, 0, 1, 30, 31, 32][trek(7)]; b.zetTijd(tijd);
        const mode = burst ? 2 : trek(11);
        b.db.data.techniek.functies[ID] = mode === 0 ? { aan: false } : mode === 1 ? { wachter: false } : {};
        const voor = b.stappen.length;
        if (stap % 17 === 0) {
          b.w.herstelronde(); punten = punten.filter(p => p.t >= tijd - 31);
        }
        const status = burst ? 500 : [200, 400, 500, 502, 503][trek(5)];
        if (status !== 503) {
          punten.push({ t: tijd, fout: status >= 500 });
          punten = punten.filter(p => p.t >= tijd - 31);
        }
        const fouten = punten.filter(p => p.fout).length;
        const sluit = status >= 500 && status !== 503 && mode > 1 &&
          fouten >= drempel && fouten > punten.length * aandeel;
        b.w.meet(PAD, status);
        assert.equal(b.stappen.length - voor, sluit ? 2 : 0, `seed ${seed}, stap ${stap}`);
        assert.equal(b.stand().aan === false, mode === 0 || sluit);
        if (sluit) { gesloten++; assert.equal(b.log()[0].fouten, fouten); }
      }
      assert.ok(gesloten > 0, 'iedere reeks oefent ook echte sluitingen');
    }
  }
});
