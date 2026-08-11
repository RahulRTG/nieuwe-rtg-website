/* DE KETEN (server/lib/keten.js) en het inzagejournaal dat eraan hangt.

   WAT HIER BEWEZEN WORDT. Een auditlog beantwoordt de vraag "wat is er gebeurd",
   en dat antwoord is precies zoveel waard als de zekerheid dat niemand het
   achteraf heeft bijgesteld. Die zekerheid had dit huis niet: wie bij de
   database kon, kon een regel wijzigen of weghalen zonder dat er daarna nog iets
   afweek.

   De vier manieren waarop iemand geschiedenis zou willen herschrijven, staan
   hieronder allemaal als toets: een regel WIJZIGEN, een regel WEGHALEN, een
   regel ERTUSSEN schuiven, en de volgorde OMDRAAIEN. Alle vier horen op een
   aanwijsbaar punt te breken.

   EN DE EERLIJKE GRENS, want die hoort er even hard bij: dit houdt STILLE
   wijziging tegen. Wie bij de database kan, kan de hele keten opnieuw uitrekenen
   en er weer een kloppend geheel van maken. Daarvoor moet de top periodiek naar
   buiten. Dat de keten dat niet zelf oplost, staat in de kop van de module en
   wordt hier niet weggepoetst.

   Draai los: node --test test/keten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { schakel, verifieer, top, hashVan, kanoniek } = require('../server/lib/keten');

/* Een journaal opbouwen zoals het inzagejournaal dat doet: nieuwste vooraan. */
function journaal(n) {
  const l = [];
  for (let i = 0; i < n; i++) l.unshift(schakel({ at: '2026-08-11T10:0' + i + ':00Z', wat: 'inzage ' + i }, top(l)));
  return l;
}

test('een ongemoeide keten is heel', () => {
  const uit = verifieer(journaal(5));
  assert.equal(uit.ok, true);
  assert.deepEqual(uit.gebroken, []);
  assert.equal(uit.afgekapt, false);
  assert.equal(uit.geteld, 5);
});

test('elke regel draagt de hash van de vorige, en de oudste draagt niets', () => {
  const l = journaal(3);
  assert.equal(l[0].vorige, l[1].hash);
  assert.equal(l[1].vorige, l[2].hash);
  assert.equal(l[2].vorige, null);
});

/* ---------- de vier manieren om geschiedenis te herschrijven ---------- */

test('een regel WIJZIGEN breekt de keten op die regel', () => {
  const l = journaal(5);
  l[3].waarom = 'iets heel anders';
  const uit = verifieer(l);
  assert.equal(uit.ok, false);
  assert.equal(uit.gebroken.length, 1);
  assert.equal(uit.gebroken[0].index, 3);
  assert.match(uit.gebroken[0].waarom, /inhoud/);
});

test('een regel WEGHALEN valt op bij zijn opvolger', () => {
  const l = journaal(5);
  l.splice(2, 1);                       // de derde verdwijnt
  const uit = verifieer(l);
  assert.equal(uit.ok, false);
  assert.equal(uit.gebroken[0].index, 1, 'de regel erboven verwijst nu naar iets wat weg is');
  assert.match(uit.gebroken[0].waarom, /tussenuit|veranderd/);
});

test('een regel ERTUSSEN schuiven valt op', () => {
  const l = journaal(5);
  l.splice(2, 0, schakel({ at: '2026-08-11T10:99:00Z', wat: 'nooit gebeurd' }, 'verzonnenhash'));
  const uit = verifieer(l);
  assert.equal(uit.ok, false);
  assert.ok(uit.gebroken.length >= 1);
});

test('de VOLGORDE omdraaien valt op', () => {
  const uit = verifieer(journaal(5).reverse());
  assert.equal(uit.ok, false);
});

/* ---------- de afkap is een grens en geen breuk ---------- */

test('een begrensd journaal dat zijn oudste kwijtraakt, is afgekapt en niet gebroken', () => {
  /* Zou dit als breuk tellen, dan stond de controle na 5000 regels voor altijd
     rood en zette iemand hem uit. Dan is er niets meer over. */
  const l = journaal(5).slice(0, 3);    // de twee oudste vallen eraf
  const uit = verifieer(l);
  assert.equal(uit.ok, true, 'afkappen is geen vervalsing');
  assert.equal(uit.afgekapt, true, 'maar het hoort wel apart gemeld te worden');
});

test('regels van vóór de keten worden geteld en niet veroordeeld', () => {
  const l = [...journaal(2), { at: '2020-01-01T00:00:00Z', wat: 'oud, zonder hash' }];
  const uit = verifieer(l);
  assert.equal(uit.ok, true);
  assert.equal(uit.zonderKeten, 1);
});

test('een leeg journaal is heel en heeft geen top', () => {
  assert.equal(verifieer([]).ok, true);
  assert.equal(top([]), null);
  assert.equal(top(null), null);
});

/* ---------- de hash zelf ---------- */

test('de volgorde van de velden verandert de hash niet', () => {
  /* Anders breekt de keten op een herschikking die niets betekent -- en dan
     verliest een echte breuk zijn betekenis tussen de valse. */
  assert.equal(hashVan({ a: 1, b: 2 }), hashVan({ b: 2, a: 1 }));
});

test('de hash van de regel zelf telt niet mee in de hash', () => {
  assert.equal(kanoniek({ a: 1, hash: 'x' }), kanoniek({ a: 1 }));
});

test('de LINK telt wel mee: aan vorige sleutelen valt op', () => {
  const a = schakel({ wat: 'x' }, 'aaa');
  const b = { ...a, vorige: 'bbb' };
  assert.notEqual(hashVan(b), b.hash);
});

test('schakel() laat de invoer met rust', () => {
  const invoer = { wat: 'x' };
  schakel(invoer, null);
  assert.deepEqual(invoer, { wat: 'x' }, 'de aanroeper houdt geen halve regel over');
});

test('top() geeft de nieuwste hash en slaat regels zonder keten over', () => {
  const l = journaal(3);
  assert.equal(top(l), l[0].hash);
  assert.equal(top([{ wat: 'geen hash' }, ...l]), l[0].hash);
});

/* ---------- het inzagejournaal in de praktijk ---------- */

function nepJournaal() {
  const log = require('../server/inzagelog');
  const db = { data: { inzageLog: [] } };
  log.zet(db, () => {});
  return { log, db };
}

test('inzagejournaal: elke genoteerde inzage komt geketend in het journaal', () => {
  const { log, db } = nepJournaal();
  log.noteer({ door: { id: 'a', naam: 'Balie' }, over: { id: 'b', codenaam: 'Cellier' }, waarom: 'KYC', bron: 'test' });
  log.noteer({ door: { id: 'a', naam: 'Balie' }, over: { id: 'c', codenaam: 'Aster' }, waarom: 'KYC', bron: 'test' });
  assert.equal(db.data.inzageLog.length, 2);
  assert.equal(log.controleer().ok, true);
  assert.equal(db.data.inzageLog[0].vorige, db.data.inzageLog[1].hash);
});

test('inzagejournaal: een beheerder die een reden bijstelt, wordt betrapt', () => {
  const { log, db } = nepJournaal();
  log.noteer({ door: { id: 'a' }, over: { id: 'b' }, waarom: 'nieuwsgierigheid', bron: 'test' });
  log.noteer({ door: { id: 'a' }, over: { id: 'c' }, waarom: 'KYC', bron: 'test' });
  assert.equal(log.controleer().ok, true);

  db.data.inzageLog[1].waarom = 'KYC-controle';    // achteraf mooier maken
  const uit = log.controleer();
  assert.equal(uit.ok, false);
  assert.equal(uit.gebroken[0].index, 1);
});

test('inzagejournaal: een inzage helemaal wegpoetsen valt op', () => {
  const { log, db } = nepJournaal();
  for (const over of ['b', 'c', 'd']) log.noteer({ door: { id: 'a' }, over: { id: over }, waarom: 'KYC', bron: 'test' });
  db.data.inzageLog.splice(1, 1);                  // de middelste nooit gebeurd
  assert.equal(log.controleer().ok, false);
});

test('inzagejournaal: de groepsregel wordt gehasht zoals hij wordt opgeslagen', () => {
  /* Dit is de val die noteerVeel() had: de drie extra velden werden NA het
     wegschrijven op de regel gezet. Met een keten eronder dekt de hash dan een
     regel die nooit bestond, en meldt de controle een vervalsing op de enige
     plek waar niemand heeft gesjoemeld. */
  const { log } = nepJournaal();
  const r = log.noteerVeel({ door: { id: 'a' }, overIds: ['x', 'y', 'z'], waarom: 'lijstscherm', bron: 'test' });
  assert.equal(r.aantal, 3);
  assert.equal(r.overId, null);
  assert.equal(log.controleer().ok, true, 'de hash hoort de regel te dekken zoals hij is opgeslagen');
});

test('inzagejournaal: de samenvatting draagt de ketenstand mee', () => {
  const { log, db } = nepJournaal();
  log.noteer({ door: { id: 'a' }, over: { id: 'b' }, waarom: 'KYC', bron: 'test' });
  assert.equal(log.samenvatting().keten.ok, true);
  db.data.inzageLog[0].door = 'iemand anders';
  assert.equal(log.samenvatting().keten.ok, false,
    'wie de samenvatting leest, hoort te zien dat er aan het spoor is gezeten');
});

test('inzagejournaal: de top is het getal dat naar buiten moet', () => {
  const { log, db } = nepJournaal();
  assert.equal(log.ketenTop(), null, 'een leeg journaal heeft geen top');
  log.noteer({ door: { id: 'a' }, over: { id: 'b' }, waarom: 'KYC', bron: 'test' });
  assert.equal(log.ketenTop(), db.data.inzageLog[0].hash);
});
