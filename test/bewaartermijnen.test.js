/* BEWAARTERMIJNEN -- houden we niet langer dan mag, en niet korter dan moet?

   Twee kanten die allebei fout kunnen gaan, en die elkaars tegenpool zijn:

     te LANG bewaren  -> overtreding van opslagbeperking (AVG art. 5 lid 1 e)
     te KORT bewaren  -> overtreding van de fiscale bewaarplicht (7 jaar)

   Een opruimtaak die alleen op het eerste let, wist vrolijk je administratie
   weg. Daarom staat de tweede test hieronder er net zo hard in als de eerste.

   Draai los: node --test test/bewaartermijnen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const bt = require('../server/bewaartermijnen');

const DAG = 86400000;
const geleden = (dagen) => new Date(Date.now() - dagen * DAG).toISOString();

function verseDb() {
  return {
    data: {
      // facturen: een van vorige maand, een van acht jaar terug
      invoices: [{ id: 'vers', date: geleden(30) }, { id: 'oud', date: geleden(8 * 365) }],
      // beveiligingslogboek: een van vandaag, een van twee jaar terug
      securityLog: [{ at: geleden(1), kanaal: 'inlog' }, { at: geleden(730), kanaal: 'inlog' }],
      // meldingen per lid: een verse, een van een jaar terug
      notifications: { 'user-7': [{ at: geleden(2), title: 'vers' }, { at: geleden(365), title: 'oud' }] },
      // sollicitaties per vacature
      applications: { 'vac-1': [{ at: geleden(10), key: 'user-7' }, { at: geleden(500), key: 'user-9' }] }
    }
  };
}

test('het rapport telt wat over de termijn is, en verandert niets', () => {
  const db = verseDb();
  const voor = JSON.stringify(db.data);
  const r = bt.rapport(db);

  assert.equal(JSON.stringify(db.data), voor, 'een rapport hoort niets aan te raken');
  const per = Object.fromEntries(r.regels.map(x => [x.tak, x]));
  assert.equal(per.securityLog.verlopen, 1, 'de logregel van twee jaar terug is over de termijn van een jaar');
  assert.equal(per.securityLog.totaal, 2);
  assert.equal(per.notifications.verlopen, 1, 'de melding van een jaar terug is over de 180 dagen');
  assert.equal(per.applications.verlopen, 1, 'de sollicitatie van 500 dagen terug is over het jaar');
  assert.ok(r.verlopenTotaal >= 3);
});

test('zonder bevestiging wordt er NIETS gewist -- dat is de standaard', () => {
  const db = verseDb();
  const voor = JSON.stringify(db.data);
  const r = bt.veeg(db);                       // geen { echt: true }

  assert.equal(r.echt, false);
  assert.ok(r.totaal >= 3, 'hij vertelt wel wat er zou gebeuren');
  assert.equal(JSON.stringify(db.data), voor, 'maar er is geen byte veranderd');
});

test('met bevestiging gaat weg wat over zijn termijn is, en alleen dat', () => {
  const db = verseDb();
  const r = bt.veeg(db, { echt: true });

  assert.equal(r.echt, true);
  assert.equal(db.data.securityLog.length, 1, 'de oude logregel is weg');
  assert.equal(db.data.securityLog[0].at, db.data.securityLog[0].at, 'de verse blijft');
  assert.equal(db.data.notifications['user-7'].length, 1, 'de oude melding is weg');
  assert.equal(db.data.notifications['user-7'][0].title, 'vers');
  assert.equal(db.data.applications['vac-1'].length, 1, 'de oude sollicitatie is weg');
  assert.equal(db.data.applications['vac-1'][0].key, 'user-7', 'de verse blijft');
});

test('een factuur binnen de fiscale bewaarplicht mag NIET weg', () => {
  /* Dit is de test die de andere kant bewaakt. Zeven jaar administratie
     bewaren is geen keuze maar een plicht (art. 52 AWR); een opruimtaak die
     hem te vroeg wist, maakt een nieuwe overtreding terwijl hij er een
     oplost. */
  const db = { data: { invoices: [
    { id: 'drie-jaar', date: geleden(3 * 365) },
    { id: 'zes-jaar', date: geleden(6 * 365) },
    { id: 'acht-jaar', date: geleden(8 * 365) }
  ] } };
  bt.veeg(db, { echt: true });

  const over = db.data.invoices.map(f => f.id);
  assert.ok(over.includes('drie-jaar'), 'een factuur van drie jaar blijft');
  assert.ok(over.includes('zes-jaar'), 'en die van zes jaar ook -- de plicht loopt tot zeven');
  assert.ok(!over.includes('acht-jaar'), 'pas na zeven jaar mag hij weg');
});

test('items zonder bruikbare datum blijven staan', () => {
  /* Geen datum betekent "ik weet niet hoe oud dit is". Dan is weggooien een
     gok, en bij onomkeerbare acties gok je niet. */
  const db = { data: { securityLog: [{ kanaal: 'zonder datum' }, { at: 'onzin' }, { at: geleden(730) }] } };
  bt.veeg(db, { echt: true });
  assert.equal(db.data.securityLog.length, 2, 'alleen de regel met een echte, oude datum ging weg');
});

test('elke termijn heeft een grond en een uitleg', () => {
  /* Een bewaartermijn zonder reden is een willekeurig getal. Als iemand vraagt
     "waarom een jaar?" hoort daar een antwoord op te staan, niet een schouderophalen. */
  for (const r of bt.BELEID) {
    assert.ok(r.dagen > 0, r.tak + ' heeft een termijn');
    assert.ok(['wettelijk', 'audit', 'nodig'].includes(r.grond), r.tak + ' heeft een geldige grond');
    assert.ok(r.waarom && r.waarom.length > 15, r.tak + ' legt uit waarom');
    assert.ok(r.label, r.tak + ' heeft een leesbare naam');
  }
  // de wettelijke termijnen zijn niet korter dan zeven jaar
  for (const r of bt.BELEID.filter(x => x.grond === 'wettelijk'))
    assert.ok(r.dagen >= 7 * 365, r.tak + ' respecteert de fiscale bewaarplicht');
});

test('de gatenlijst noemt takken zonder termijn', () => {
  /* Het eerlijke deel: een beleid dat doet alsof het compleet is terwijl het
     de helft overslaat, is misleidender dan geen beleid. */
  const db = { data: { securityLog: [{ at: geleden(1) }], eigenNieuweTak: [1, 2, 3], leegDing: [] } };
  const gaten = bt.zonderBeleid(db).map(g => g.tak);
  assert.ok(gaten.includes('eigenNieuweTak'), 'een tak met data en zonder termijn wordt genoemd');
  assert.ok(!gaten.includes('securityLog'), 'een tak mét termijn niet');
  assert.ok(!gaten.includes('leegDing'), 'een lege tak is geen gat');
});

test('een lege of rare database laat niets omvallen', () => {
  for (const db of [null, {}, { data: null }, { data: {} }, { data: { invoices: 'geen lijst' } }]) {
    assert.ok(bt.rapport(db).regels.length > 0);
    assert.equal(bt.veeg(db, { echt: true }).totaal, 0);
    assert.ok(Array.isArray(bt.zonderBeleid(db)));
  }
});
