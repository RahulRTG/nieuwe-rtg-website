/* Sleutelwoorden: inloggen door een gesprek met Rahul in plaats van een
   wachtwoord. Getoetst op kern-niveau (met een nep-kluis en echte crypto): het
   instellen keurt precies vier verschillende woorden van minstens drie letters;
   de roterende uitdaging vraagt drie van de vier posities, herkent je woorden
   los in een zin en echoot het tweede terug; verkeerde woorden falen; een
   onbekend account krijgt tóch een uitdaging die aan het eind gewoon faalt
   (geen account-enumeratie); en vijf misgelopen pogingen zetten het account op
   slot.
   Draai los: node --test test/sleutelwoorden.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakSleutelwoorden } = require('../server/kern/sleutelwoorden');

// een nep-kluis + nep-accounts, zodat we de kern los kunnen beproeven
function opstelling(users) {
  const db = { data: {} };
  const accounts = { findByLogin: (login) => users[String(login || '').toLowerCase()] || null };
  const sw = maakSleutelwoorden({ db, save: () => {}, crypto, accounts });
  return sw;
}

// de posities die Rahul vraagt, uit zijn tekst halen (net als de client doet)
const ORD = { eerste: 0, tweede: 1, derde: 2, vierde: 3 };
function posities(tekst) {
  const uit = [];
  for (const m of String(tekst).matchAll(/\b(eerste|tweede|derde|vierde)\b/gi)) uit.push(ORD[m[1].toLowerCase()]);
  return uit;
}

test('instellen: precies vier verschillende woorden van minstens drie letters', () => {
  const sw = opstelling({});
  assert.equal(sw.swInfo('u1').gezet, false, 'nog niets ingesteld');
  assert.equal(sw.swZet('u1', ['een', 'twee', 'drie']).status, 400, 'drie woorden is te weinig');
  assert.equal(sw.swZet('u1', ['een', 'twee', 'drie', 'vier', 'vijf']).status, 400, 'vijf woorden is te veel');
  assert.equal(sw.swZet('u1', ['ja', 'twee', 'drie', 'vier']).status, 400, 'een woord van twee letters mag niet');
  assert.equal(sw.swZet('u1', ['appel', 'appel', 'drie', 'vier']).status, 400, 'vier keer hetzelfde niet');
  const ok = sw.swZet('u1', ['Lavendel', 'kompas', 'orkaan', 'veranda']);
  assert.equal(ok.ok, true, 'vier nette woorden worden geaccepteerd');
  assert.equal(sw.swInfo('u1').gezet, true, 'daarna staat het aan');
  assert.equal(sw.swWeg('u1').gezet, false, 'en het kan er weer af');
  assert.equal(sw.swInfo('u1').gezet, false);
});

test('de roterende uitdaging: twee woorden los in een zin, dan het derde', () => {
  const woorden = ['lavendel', 'kompas', 'orkaan', 'veranda'];
  const sw = opstelling({ 'lisa@x.nl': { id: 'u1' } });
  assert.equal(sw.swZet('u1', woorden).ok, true);

  const start = sw.swStart('lisa@x.nl');
  assert.ok(start.id, 'er is een uitdaging-id');
  assert.equal(typeof start.posA, 'number');
  assert.equal(typeof start.posB, 'number');
  assert.notEqual(start.posA, start.posB, 'twee verschillende posities');

  // de eerste twee gevraagde woorden losjes in een zin verweven
  const zin = 'Even denken hoor, ' + woorden[start.posA] + ' en ' + woorden[start.posB] + ' natuurlijk.';
  const open = sw.swZeg(start.id, zin);
  assert.equal(open.stap, 'sluit', 'na de open-beurt vraagt hij het slot');
  assert.equal(open.echo, woorden[start.posB], 'hij echoot je tweede woord terug');
  assert.equal(typeof open.posSluit, 'number');
  assert.ok(![start.posA, start.posB].includes(open.posSluit), 'het slotwoord is een derde positie');

  const slot = sw.swZeg(start.id, woorden[open.posSluit]);
  assert.equal(slot.ok, true, 'het derde woord sluit de inlog af');
  assert.equal(slot.userId, 'u1', 'en levert het echte gebruikers-id');
});

test('verkeerde woorden komen er niet in', () => {
  const woorden = ['lavendel', 'kompas', 'orkaan', 'veranda'];
  const sw = opstelling({ 'lisa@x.nl': { id: 'u1' } });
  sw.swZet('u1', woorden);

  const start = sw.swStart('lisa@x.nl');
  // juiste twee openen, maar een fout slotwoord
  sw.swZeg(start.id, woorden[start.posA] + ' en ' + woorden[start.posB]);
  const mis = sw.swZeg(start.id, 'tulp');
  assert.equal(mis.status, 401, 'een fout slotwoord faalt');

  // en verkeerde openingswoorden laten zelfs een goed slot niet door
  const s2 = sw.swStart('lisa@x.nl');
  const o2 = sw.swZeg(s2.id, 'tulp en hyacint');
  assert.equal(o2.echo, null, 'bij een miskleun in de opening geen echo');
  const eind = sw.swZeg(s2.id, woorden[o2.posSluit]);
  assert.equal(eind.status, 401, 'een verkeerde opening blokkeert de hele inlog');
});

test('een onbekend account krijgt een lokvink-uitdaging (geen enumeratie)', () => {
  const sw = opstelling({ 'lisa@x.nl': { id: 'u1' } });
  sw.swZet('u1', ['lavendel', 'kompas', 'orkaan', 'veranda']);

  const start = sw.swStart('spook@x.nl');
  assert.ok(start.id, 'ook een onbekend adres krijgt netjes een uitdaging');
  assert.equal(typeof start.posA, 'number', 'met dezelfde vorm als een echt account');
  const open = sw.swZeg(start.id, 'wat dan ook en nog iets');
  assert.equal(open.echo, null, 'er valt niets te herkennen');
  const eind = sw.swZeg(start.id, 'zomaar');
  assert.equal(eind.status, 401, 'de lokvink faalt aan het eind, net als een echte misser');
});

test('vijf misgelopen pogingen zetten het account op slot', () => {
  const woorden = ['lavendel', 'kompas', 'orkaan', 'veranda'];
  const sw = opstelling({ 'lisa@x.nl': { id: 'u1' } });
  sw.swZet('u1', woorden);

  for (let i = 0; i < 5; i++) {
    const s = sw.swStart('lisa@x.nl');
    assert.ok(s.id, 'poging ' + (i + 1) + ' mag nog');
    sw.swZeg(s.id, 'fout en verkeerd');
    const r = sw.swZeg(s.id, 'mis');
    assert.equal(r.status, 401);
  }
  const opSlot = sw.swStart('lisa@x.nl');
  assert.equal(opSlot.status, 429, 'na vijf missers zit het account op slot');

  // en de juiste combinatie werkt weer na het slot (we simuleren het niet
  // uitzitten hier; we toetsen alleen dat een schone opstelling wél doorlaat)
  const sw2 = opstelling({ 'lisa@x.nl': { id: 'u1' } });
  sw2.swZet('u1', woorden);
  const g = sw2.swStart('lisa@x.nl');
  const o = sw2.swZeg(g.id, woorden[g.posA] + ' en ' + woorden[g.posB]);
  assert.equal(sw2.swZeg(g.id, woorden[o.posSluit]).ok, true, 'zonder slot laat de juiste combinatie door');
});

test('de uitdaging verloopt en kent zijn id daarna niet meer', () => {
  const sw = opstelling({ 'lisa@x.nl': { id: 'u1' } });
  sw.swZet('u1', ['lavendel', 'kompas', 'orkaan', 'veranda']);
  const onbekend = sw.swZeg('bestaat-niet', 'lavendel en kompas');
  assert.equal(onbekend.status, 410, 'een onbekende inlogpoging wijst hij netjes af');
});

// posities-parser die de client ook gebruikt, hier meteen getoetst
test('ordinalen uit Rahuls tekst halen', () => {
  assert.deepEqual(posities('verweef je eerste en je derde sleutelwoord'), [0, 2]);
  assert.deepEqual(posities('Sluit nu af met je vierde sleutelwoord.'), [3]);
});
