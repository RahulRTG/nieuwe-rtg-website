/* Het inzagejournaal: wie keek er in wiens identiteitskluis.

   De twee regels die dit journaal bruikbaar EN veilig maken staan hier als
   test, want ze zijn allebei makkelijk stuk te maken zonder dat je het merkt:

     1. de opgevraagde NAAM staat er niet in -- anders bouw je een tweede,
        onversleutelde kopie van de kluis en is het auditlog zelf het lek;
     2. zelf-inzage komt er niet in -- anders verdrinkt de gerichte opzoeking
        van een persoon in miljoenen regels "lid bekijkt eigen profiel".

   Draai los: node --test test/inzagelog.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const inzagelog = require('../server/inzagelog');

// een nepdatabase: het journaal draait op db.data, meer heeft het niet nodig
function verseDb() {
  const db = { data: {} };
  let bewaard = 0;
  inzagelog.zet(db, () => { bewaard++; });
  return { db, tel: () => bewaard };
}

test('een inzage komt in het journaal, met reden en bron', () => {
  const { db, tel } = verseDb();
  const r = inzagelog.noteer({
    door: { id: 7, naam: 'eigenaar' },
    over: { id: 42, codenaam: 'ZILVEREN HERT' },
    waarom: 'KYC-controle', bron: 'backoffice/verificaties'
  });
  assert.equal(r.doorId, '7');
  assert.equal(r.overId, '42');
  assert.equal(r.over, 'ZILVEREN HERT');
  assert.equal(r.waarom, 'KYC-controle');
  assert.ok(Date.parse(r.at), 'met een tijdstempel');
  assert.equal(db.data.inzageLog.length, 1);
  assert.ok(tel() >= 1, 'en het wordt duurzaam bewaard');
});

test('de opgevraagde naam staat NIET in het journaal', () => {
  const { db } = verseDb();
  inzagelog.noteer({
    door: { id: 7, naam: 'eigenaar' },
    over: { id: 42, codenaam: 'ZILVEREN HERT', naam: 'Anna Aardenburg', email: 'anna@voorbeeld.nl' },
    waarom: 'KYC-controle'
  });
  const alles = JSON.stringify(db.data.inzageLog);
  assert.ok(!/Aardenburg/.test(alles), 'geen echte naam');
  assert.ok(!/anna@voorbeeld/.test(alles), 'geen e-mailadres');
  assert.ok(/ZILVEREN HERT/.test(alles), 'de codenaam mag wel: dat is juist het pseudoniem');
});

test('zelf-inzage wordt niet genoteerd', () => {
  const { db } = verseDb();
  const r = inzagelog.noteer({ door: { id: 42 }, over: { id: 42 }, waarom: 'eigen profiel' });
  assert.equal(r, null);
  assert.equal((db.data.inzageLog || []).length, 0);
  // ook als de een een getal is en de ander een tekst: dezelfde persoon
  assert.equal(inzagelog.noteer({ door: { id: '42' }, over: { id: 42 }, waarom: 'x' }), null);
});

test('een lege reden wordt zichtbaar gemaakt, niet weggemoffeld', () => {
  const { db } = verseDb();
  inzagelog.noteer({ door: { id: 1 }, over: { id: 2 } });
  assert.equal(db.data.inzageLog[0].waarom, 'GEEN REDEN OPGEGEVEN');
  assert.equal(inzagelog.samenvatting().zonderReden, 1,
    'en de samenvatting telt ze, zodat de eigenaar ze op het techniekbord ziet');
});

test('een lijstscherm is EEN regel, geen vijftig', () => {
  const { db } = verseDb();
  const r = inzagelog.noteerVeel({
    door: { naam: 'backoffice' }, overIds: [1, 2, 3, 4, 5],
    waarom: 'KYC: wachtrij bekijken', bron: 'backoffice/verificaties'
  });
  assert.equal(db.data.inzageLog.length, 1, 'een handeling, een regel');
  assert.equal(r.aantal, 5);
  assert.deepEqual(r.overIds, ['1', '2', '3', '4', '5']);
  assert.equal(r.overId, null, 'het gaat niet om een enkele persoon');
  // een leeg scherm is geen inzage
  assert.equal(inzagelog.noteerVeel({ door: { naam: 'x' }, overIds: [], waarom: 'y' }), null);
});

test('een betrokkene ziet wanneer en waarom, niet wie', () => {
  const { } = verseDb();
  inzagelog.noteer({ door: { id: 7, naam: 'Karel de Controleur' }, over: { id: 42 }, waarom: 'KYC-controle', bron: 'backoffice' });
  inzagelog.noteer({ door: { id: 9, naam: 'Iemand anders' }, over: { id: 99 }, waarom: 'iets anders' });
  const mijn = inzagelog.voorBetrokkene(42);
  assert.equal(mijn.length, 1, 'alleen regels over mij');
  assert.equal(mijn[0].waarom, 'KYC-controle');
  assert.equal(mijn[0].bron, 'backoffice');
  assert.equal(mijn[0].door, undefined, 'de naam van de kijker is de persoonsdata van een ander');
  assert.equal(mijn[0].doorId, undefined);
});

test('een groepsregel telt mee voor iedereen die erin stond', () => {
  const { } = verseDb();
  inzagelog.noteerVeel({ door: { naam: 'backoffice' }, overIds: [11, 22, 33], waarom: 'KYC-wachtrij' });
  assert.equal(inzagelog.voorBetrokkene(22).length, 1, 'lid 22 zat in de lijst en hoort dat te zien');
  assert.equal(inzagelog.voorBetrokkene(44).length, 0, 'lid 44 niet');
});

test('het journaal loopt niet oneindig vol', () => {
  const { db } = verseDb();
  for (let i = 0; i < inzagelog.MAX + 25; i++)
    inzagelog.noteer({ door: { id: 1 }, over: { id: 2 }, waarom: 'nummer ' + i });
  assert.equal(db.data.inzageLog.length, inzagelog.MAX);
  assert.match(db.data.inzageLog[0].waarom, /nummer \d+/);
  assert.ok(Number(db.data.inzageLog[0].waarom.slice(7)) > inzagelog.MAX,
    'de nieuwste staat bovenaan; de oudste valt eraf');
});

test('rommel in de invoer maakt geen rommel in het journaal', () => {
  const { db } = verseDb();
  inzagelog.noteer({
    door: { id: 1, naam: '<script>x</script>' },
    over: { id: 2, codenaam: 'A'.repeat(500) },
    waarom: 'B'.repeat(500), bron: 'C'.repeat(500)
  });
  const r = db.data.inzageLog[0];
  assert.ok(!/[<>]/.test(JSON.stringify(r)), 'geen punthaken');
  assert.ok(r.over.length <= 60 && r.waarom.length <= 120 && r.bron.length <= 60, 'alles begrensd');
});

test('zonder database valt er niets om', () => {
  inzagelog.zet(null, null);
  assert.equal(inzagelog.noteer({ door: { id: 1 }, over: { id: 2 }, waarom: 'x' }).overId, '2');
  assert.deepEqual(inzagelog.lijst(), []);
  assert.equal(inzagelog.samenvatting().totaal, 0);
});
