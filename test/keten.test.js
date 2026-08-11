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
const { schakel, hangAan, verifieer, top, hashVan, kanoniek } = require('../server/lib/keten');
const { verankerPunt, verifieerTegenAnker } = require('../server/lib/keten-anker');

/* Een journaal opbouwen zoals het inzagejournaal dat doet: nieuwste vooraan. */
function journaal(n) {
  const l = [];
  for (let i = 0; i < n; i++) l.unshift(hangAan(l, { at: '2026-08-11T10:0' + i + ':00Z', wat: 'inzage ' + i }));
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

/* ---------- lokale integriteit versus externe verankering ----------

   HET ONDERSCHEID DAT DEZE HELE AFDELING DRAAGT. De toetsen hierboven bewijzen
   dat WIJZIGEN en MIDDEN-VERWIJDEREN opvallen. Ze bewijzen NIET dat de
   geschiedenis nog even lang is, en dat is een ander soort vraag: wie de
   nieuwste regels weggooit, houdt een keten over die van voor naar achter
   perfect klopt.

   De eerste toets hieronder legt die blindheid vast als FEIT in plaats van hem
   te verzwijgen. Zou iemand later denken dat een hashketen ook dat afdekt, dan
   staat hier zwart op wit van niet. */

test('LOKAAL BLIND: de nieuwste regels wegknippen laat een perfect kloppende keten achter', () => {
  const l = journaal(6);
  const ingekort = l.slice(3);              // de drie nieuwste weg -- sporen wissen
  const uit = verifieer(ingekort);
  assert.equal(uit.ok, true,
    'dit HOORT lokaal groen te zijn; daarom is een anker geen luxe maar de enige uitweg');
  assert.equal(uit.gebroken.length, 0);
});

test('elke regel draagt een oplopend volgnummer, zodat een anker ermee kan afrekenen', () => {
  const l = journaal(4);
  assert.deepEqual(l.map(r => r.nr), [4, 3, 2, 1]);
});

test('hangAan() rekent de vorige hash en het volgnummer samen uit', () => {
  const l = [];
  l.unshift(hangAan(l, { wat: 'een' }));
  l.unshift(hangAan(l, { wat: 'twee' }));
  assert.equal(l[0].nr, 2);
  assert.equal(l[0].vorige, l[1].hash);
  assert.equal(verifieer(l).ok, true);
});

test('een anker legt de kop vast: volgnummer, hash en moment', () => {
  const l = journaal(3);
  const a = verankerPunt(l);
  assert.equal(a.nr, 3);
  assert.equal(a.hash, l[0].hash);
  assert.equal(verankerPunt([]), null);
});

test('MET ANKER: de nieuwste regels wegknippen wordt wel betrapt', () => {
  const l = journaal(6);
  const a = verankerPunt(l);                // eerst naar buiten gebracht
  const uit = verifieerTegenAnker(l.slice(3), a);
  assert.equal(uit.ok, false);
  assert.equal(uit.ingekort, true);
  assert.equal(uit.kwijt, 3);
  assert.match(uit.reden, /verdwenen/);
});

test('MET ANKER: de hele keten opnieuw uitrekenen wordt betrapt', () => {
  /* Dit is de aanval die lokaal per definitie onzichtbaar is: een beheerder
     bouwt een nieuwe, kloppende geschiedenis. Het anker houdt de oude vast. */
  const echt = journaal(4);
  const a = verankerPunt(echt);
  const vervalst = journaal(4);             // even lang, andere inhoud, klopt intern
  vervalst[0].wat = 'een nettere werkelijkheid';
  const herbouwd = [];
  for (const r of [...vervalst].reverse()) herbouwd.unshift(hangAan(herbouwd, { at: r.at, wat: r.wat }));
  assert.equal(verifieer(herbouwd).ok, true, 'de vervalsing klopt intern -- dat is het punt');
  assert.equal(verifieerTegenAnker(herbouwd, a).herschreven, true);
});

test('een anker dat uit het begrensde journaal is geschoven, oordeelt niet', () => {
  /* Niet te beoordelen is iets anders dan in orde, en allebei iets anders dan
     een aanval. Ze door elkaar halen levert of vals alarm of valse rust. */
  const l = journaal(8);
  const oudAnker = { nr: 2, hash: 'wat dan ook' };
  const uit = verifieerTegenAnker(l.slice(0, 3), oudAnker);   // alleen nr 8,7,6 over
  assert.equal(uit.ok, true);
  assert.equal(uit.weg, true);
  assert.ok(!uit.ingekort);
});

test('een ongemoeid journaal rekent netjes af met zijn anker', () => {
  const l = journaal(5);
  const a = verankerPunt(l);
  l.unshift(hangAan(l, { wat: 'daarna nog iets' }));
  const uit = verifieerTegenAnker(l, a);
  assert.equal(uit.ok, true);
  assert.equal(uit.sindsAnker, 1);
});

test('zonder bruikbaar anker weigert de controle te oordelen', () => {
  assert.equal(verifieerTegenAnker(journaal(3), null).ok, false);
  assert.equal(verifieerTegenAnker(journaal(3), {}).ok, false);
});

test('inzagejournaal: anker en afrekening lopen door tot in het journaal zelf', () => {
  const { log, db } = nepJournaal();
  for (const over of ['b', 'c', 'd', 'e']) log.noteer({ door: { id: 'a' }, over: { id: over }, waarom: 'KYC', bron: 'test' });
  const a = log.anker();
  assert.equal(a.nr, 4);
  assert.equal(log.tegenAnker(a).ok, true);

  db.data.inzageLog.splice(0, 2);           // de twee nieuwste inzages wegpoetsen
  assert.equal(log.controleer().ok, true, 'lokaal valt dit niet op -- dat is de hele reden voor het anker');
  const uit = log.tegenAnker(a);
  assert.equal(uit.ingekort, true);
  assert.equal(uit.kwijt, 2);
});
