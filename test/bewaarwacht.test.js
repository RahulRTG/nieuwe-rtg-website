/* DE BEWAARWACHT -- kijkt vanzelf, en houdt zich in.

   Een bewaarbeleid faalt op twee manieren die allebei stil zijn:

     niemand kijkt ooit   -> de termijn staat op papier en nergens anders
     de wacht wist zelf   -> data verdwijnt zonder dat iemand het besloot

   De eerste test hieronder is de belangrijkste van het hele bestand: de wacht
   mag tellen en melden, en verder niets. Alles wat vanzelf draait en kan wissen
   is een ramp die op zijn beurt wacht.

   Draai los: node --test test/bewaarwacht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const wacht = require('../server/bewaarwacht');

const DAG = 86400000;
const geleden = (dagen) => new Date(Date.now() - dagen * DAG).toISOString();

function verseDb() {
  return {
    data: {
      invoices: [{ id: 'vers', date: geleden(30) }, { id: 'oud', date: geleden(8 * 365) }],
      securityLog: [{ at: geleden(1) }, { at: geleden(730) }],
      notifications: { 'user-7': [{ at: geleden(2), title: 'vers' }, { at: geleden(365), title: 'oud' }] }
    }
  };
}

// een melder die onthoudt wat er gemeld is, zodat de test het kan nalopen
function vangerMelder() {
  const gezien = [];
  return { gezien, meld: (type, ernst, tekst, meta) => gezien.push({ type, ernst, tekst, meta }) };
}

test('de wacht WIST NOOIT -- ook niet wat allang over de termijn is', () => {
  const db = verseDb();
  const voor = JSON.stringify(db.data);
  const m = vangerMelder();

  wacht.ronde(db, { beveilig: m });

  const na = JSON.parse(JSON.stringify(db.data));
  delete na.techniek;                    // zijn eigen stand bijhouden mag wel
  assert.equal(JSON.stringify(na), voor, 'geen byte aan gegevens veranderd');
  assert.equal(db.data.securityLog.length, 2, 'de logregel van twee jaar terug staat er gewoon nog');
  assert.equal(db.data.invoices.length, 2, 'en de factuur van acht jaar ook');
  assert.equal(db.data.notifications['user-7'].length, 2);
});

test('hij meldt wat over de termijn staat, met de posten bij naam', () => {
  const db = verseDb();
  const m = vangerMelder();
  const r = wacht.ronde(db, { beveilig: m });

  assert.equal(r.gemeld, true);
  assert.equal(m.gezien.length, 1, 'er is precies een melding');
  assert.equal(m.gezien[0].type, 'bewaartermijn-verlopen');
  assert.equal(m.gezien[0].ernst, 'waarschuwing');
  assert.match(m.gezien[0].tekst, /over hun bewaartermijn/);
  assert.match(m.gezien[0].tekst, /niets gewist/, 'de tekst zegt erbij dat er niets is gewist');
  assert.match(m.gezien[0].tekst, /beveiligingslogboek|meldingen|facturen/, 'de posten staan bij naam');
});

test('is er niets over de termijn, dan is er ook geen melding', () => {
  /* Geen nieuws is geen alarm. Een wacht die elke maand "alles in orde" roept,
     leert je zijn meldingen weg te klikken -- en dan mis je de keer dat het wel
     ergens over gaat. */
  const db = { data: { securityLog: [{ at: geleden(1) }], invoices: [{ date: geleden(30) }] } };
  const m = vangerMelder();
  const r = wacht.ronde(db, { beveilig: m });

  assert.equal(r.verlopen, 0);
  assert.equal(r.gemeld, false);
  assert.equal(m.gezien.length, 0);
  assert.ok(db.data.techniek.bewaarwacht.laatst, 'hij noteert wel dat hij gekeken heeft');
  assert.equal(db.data.techniek.bewaarwacht.laatstGemeld, null);
});

test('hij meldt hoogstens eens per maand, ook over een herstart heen', () => {
  /* De reden dat "laatst gemeld" in de database staat en niet in het geheugen:
     anders begint elke herstart opnieuw en krijg je bij een onrustige server
     alsnog elke dag dezelfde melding. */
  const db = verseDb();
  const m = vangerMelder();
  const nu = Date.now();

  assert.equal(wacht.ronde(db, { beveilig: m, nu }).gemeld, true, 'de eerste ronde meldt');
  assert.equal(wacht.ronde(db, { beveilig: m, nu: nu + DAG }).gemeld, false, 'een dag later niet');
  assert.equal(wacht.ronde(db, { beveilig: m, nu: nu + 29 * DAG }).gemeld, false, 'na 29 dagen nog niet');
  assert.equal(m.gezien.length, 1, 'tot hier is er precies een melding geweest');

  assert.equal(wacht.ronde(db, { beveilig: m, nu: nu + 31 * DAG }).gemeld, true, 'na een maand mag het weer');
  assert.equal(m.gezien.length, 2);
});

test('hij legt zijn stand vast, zodat het bord kan tonen hoe vers hij is', () => {
  /* Zonder "laatst gekeken" weet je niet of een leeg bord betekent dat het in
     orde is of dat er al een maand niemand gekeken heeft. */
  const db = verseDb();
  const nu = Date.now();
  wacht.ronde(db, { nu });                     // zonder melder mag ook

  const w = db.data.techniek.bewaarwacht;
  assert.equal(w.laatst, new Date(nu).toISOString());
  assert.ok(w.verlopen >= 2, 'met het getal dat hij zag');
  assert.equal(typeof w.gaten, 'number', 'en hoeveel takken nog zonder termijn zijn');
});

test('een save-fout of melder-fout trekt de ronde niet om', () => {
  /* De wacht draait op de achtergrond. Als hij omvalt bij een hik in de opslag,
     valt hij stil zonder dat iemand het merkt -- en dan is er weer niemand die
     kijkt. */
  const db = verseDb();
  const stukkeMelder = { meld: () => { throw new Error('melden mislukt'); } };
  const stukkeSave = () => { throw new Error('opslaan mislukt'); };

  const r = wacht.ronde(db, { beveilig: stukkeMelder, save: stukkeSave });
  assert.equal(r.gemeld, true, 'hij heeft zijn werk gedaan');
  assert.equal(db.data.securityLog.length, 2, 'en nog steeds niets gewist');
});

test('een lege of rare database laat niets omvallen', () => {
  for (const db of [null, {}, { data: null }, { data: {} }, { data: { invoices: 'geen lijst' } }]) {
    const r = wacht.ronde(db);
    assert.equal(typeof r.verlopen, 'number');
    assert.equal(r.gemeld, false, 'zonder gegevens valt er niets te melden');
  }
});
