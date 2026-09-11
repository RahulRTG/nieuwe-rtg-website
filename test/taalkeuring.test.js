/* De taalkeuring: mag dit modelantwoord een vertaling heten?

   Het gat dat deze laag dicht is GEMETEN en niet vermoed: met een nagebootst
   model kwamen zes faalvormen ongehinderd langs de oude weg, waaronder een
   antwoord in het Engels op een vraag om Japans. Sinds de vertaalkast landde
   zoiets bovendien op schijf. Elke toets hieronder is een van die faalvormen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { keur, getallenIn, cijfersNormaal } = require('../server/kern/taalkeuring');

const reden = (r) => r.redenen.map(x => x.code).sort();

test('een antwoord in het verkeerde schrift is geen vertaling', () => {
  const r = keur('Boek deze reis', 'Book this trip', 'ja');
  assert.equal(r.oordeel, 'afgewezen');
  assert.ok(reden(r).includes('verkeerd-schrift'));
});

test('bij een Latijns-schriftige doeltaal zwijgt de schriftcontrole eerlijk', () => {
  /* Dit is de grens van deze laag: "Book this trip" als Franse vertaling komt
     er gewoon doorheen, want Frans en Engels delen hun letters. Dat mag geen
     stilte zijn -- het oordeel draagt `schriftBeslissend: false`. */
  const r = keur('Boek deze reis', 'Book this trip', 'fr');
  assert.equal(r.oordeel, 'goed');
  assert.equal(r.schriftBeslissend, false);
  assert.equal(keur('Boek deze reis', 'この旅行を予約する', 'ja').schriftBeslissend, true);
});

test('een weggevallen plaatshouder wordt afgewezen', () => {
  const r = keur('Hallo {naam}, u heeft {n} berichten', 'こんにちは、メッセージがあります', 'ja');
  assert.equal(r.oordeel, 'afgewezen');
  assert.ok(reden(r).includes('plaatshouder-weg'));
  assert.equal(keur('Hallo {naam}', 'こんにちは {naam}', 'ja').oordeel, 'goed');
});

test('een veranderd bedrag wordt afgewezen, een ander cijferstelsel niet', () => {
  assert.equal(keur('Betaal EUR 65', 'EUR 95 をお支払いください', 'ja').oordeel, 'afgewezen');
  assert.equal(keur('Betaal EUR 65', 'EUR 65 をお支払いください', 'ja').oordeel, 'goed');
  /* Arabische cijfers zijn hetzelfde bedrag, geen ander bedrag. */
  assert.equal(keur('Betaal EUR 65', 'ادفع ٦٥ يورو', 'ar').oordeel, 'goed');
  assert.deepEqual(getallenIn('٦٥'), ['65']);
  assert.equal(cijfersNormaal('٦٥ / ६५ / 65'), '65 / 65 / 65');
});

test('een vertaalde merknaam wordt afgewezen', () => {
  const r = keur('Welkom bij Rahul Travel Group', 'ラフル旅行団体へようこそ', 'ja');
  assert.equal(r.oordeel, 'afgewezen');
  assert.ok(reden(r).includes('merk-vertaald'));
  assert.equal(keur('Welkom bij Rahul Travel Group', 'Rahul Travel Group へようこそ', 'ja').oordeel, 'goed');
});

test('een weigering van het model is geen vertaling', () => {
  const r = keur('Reserveer een tafel', 'I cannot help with that request.', 'fr');
  assert.equal(r.oordeel, 'afgewezen');
  assert.ok(reden(r).includes('weigering'));
});

test('leeg en letterlijk-de-bron zijn allebei geen vertaling', () => {
  assert.equal(keur('Opslaan', '', 'ja').oordeel, 'afgewezen');
  assert.equal(keur('Opslaan', 'Opslaan', 'ja').oordeel, 'afgewezen');
});

test('lengte levert nooit een afwijzing op, alleen een verdenking', () => {
  /* Een verhouding is geen bewijs: Japans is compact, Duits lang, en dat is per
     taal nooit gemeten. Wat hier gebeurt is dus hoogstens "niet vast te
     stellen" -- en die regel gaat wel op het scherm, maar niet op schijf. */
  const lang = keur('Annuleren', 'はい、承知いたしました。それでは以下のように進めさせていただきます。まず最初にご確認ください。', 'ja');
  assert.equal(lang.oordeel, 'verdacht');
  assert.ok(reden(lang).includes('erg-lang'));
  /* Onder de acht tekens zegt een verhouding niets: een beleefde vorm van "Ja"
     is zo vier keer zo lang. */
  assert.equal(keur('Ja', 'はい、承知いたしました', 'ja').oordeel, 'goed');
});

test('een regel die alleen uit merk, getal of plaatshouder bestaat zakt niet op schrift', () => {
  /* Er valt niets te vertalen, dus het ontbreken van Japans schrift bewijst
     niets. Wie dat toch afwijst, verwijdert een correcte regel van het scherm. */
  assert.equal(keur('RTG 2026', 'RTG 2026', 'ja').redenen.every(r => r.code !== 'verkeerd-schrift'), true);
  assert.equal(keur('{naam}', '{naam}', 'ja').redenen.every(r => r.code !== 'verkeerd-schrift'), true);
});

/* ---- de poort in de keten: wat mag er BLIJVEN? --------------------------- */

const fs = require('fs');
const os = require('os');
const path = require('path');
const i18n = require('../server/translate');
const { maakVertaalkast } = require('../server/lib/vertaalkast');

/* Een verse bron per toets, zodat de geheugencache van een vorige toets niet
   meetelt. Met LETTERS en niet met een tijdstempel: een getal in de bron moet
   volgens de keuring in de vertaling terugkomen, dus een tijdstempel liet deze
   toetsen terecht zakken op `getal-weg`. De poort had gelijk, de toets niet. */
let teller = 0;
const vers = () => ' q' + 'abcdefghijklmnop'[teller++ % 16];

function metNepModel(antwoord, fn) {
  i18n.setAnthropic({ messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify([antwoord]) }] }) } });
  try { return fn(); } finally { i18n.setAnthropic(null); }
}

test('een afgewezen regel komt niet op het scherm en niet in de kast', async () => {
  const kast = maakVertaalkast({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-keur-')), venster: 0 });
  i18n.setVertaalkast(kast);
  try {
    const bron = 'Boek deze bijzondere reis' + vers();   // vers, dus geen cachetreffer
    const r = await metNepModel('Book this special trip', () =>
      i18n.translateBatch([bron], 'ja', undefined, { ai: () => true, bewaar: true }));
    assert.equal(r.keuring.afgewezen, 1, 'de keuring wijst het Engelse antwoord af');
    assert.equal(r[0].text, bron, 'het scherm houdt de brontaal');
    assert.equal(kast.lees('ja', bron), null, 'en er staat niets op schijf');
    assert.equal(kast.stand().bewaard, 0);
  } finally { i18n.setVertaalkast(null); }
});

test('een verdachte regel mag op het scherm maar wordt niet permanent', async () => {
  const kast = maakVertaalkast({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-keur-')), venster: 0 });
  i18n.setVertaalkast(kast);
  try {
    const bron = 'Annuleren' + vers();   // kort, want deze toets gaat over de LENGTEverhouding
    const lang = 'はい、承知いたしました。それでは以下のように進めさせていただきます。まず最初にご確認ください。もう一度お願いします。';
    const r = await metNepModel(lang, () =>
      i18n.translateBatch([bron], 'ja', undefined, { ai: () => true, bewaar: true }));
    assert.equal(r.keuring.verdacht, 1);
    assert.equal(r[0].text, lang, 'verdacht gaat wel naar het scherm');
    assert.equal(kast.lees('ja', bron), null, 'maar nooit naar de schijf');
  } finally { i18n.setVertaalkast(null); }
});

test('een goed gekeurde regel gaat wel de kast in', async () => {
  const kast = maakVertaalkast({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-keur-')), venster: 0 });
  i18n.setVertaalkast(kast);
  try {
    const bron = 'Boek deze reis vandaag' + vers();
    const r = await metNepModel('この旅行を今日予約する', () =>
      i18n.translateBatch([bron], 'ja', undefined, { ai: () => true, bewaar: true }));
    assert.equal(r.keuring.goed, 1);
    assert.equal(kast.lees('ja', bron), 'この旅行を今日予約する');
  } finally { i18n.setVertaalkast(null); }
});
