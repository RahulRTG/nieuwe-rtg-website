/* RTMAIL: het interne postsysteem (de rail voor de automatiseringen). Unit-test
   op de motor met een nep-db, zodat we send/postvak/ongelezen/lees los kunnen
   bewijzen zonder de server te starten.
   node --test test/rtmail.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function maak() {
  const db = { data: {} };
  let saves = 0;
  const rtmail = require('../server/kern/rtmail')({ db, save: () => { saves++; }, crypto });
  return { rtmail, db, saves: () => saves };
}

test('adres normaliseren: kleine letters en @rtmail erachter', () => {
  const { rtmail } = maak();
  assert.equal(rtmail.normAdres('SAKURA'), 'sakura@rtmail');
  assert.equal(rtmail.normAdres(' Bloem 12 '), 'bloem12@rtmail');
  assert.equal(rtmail.normAdres('rtg@rtmail'), 'rtg@rtmail');
  assert.equal(rtmail.normAdres(''), '');
});

test('systeem stuurt, het postvak ontvangt, en de teller telt ongelezen', () => {
  const { rtmail } = maak();
  const m = rtmail.systeemStuur('sakura', 'Welkom bij RTG', 'Uw zaak staat live.');
  assert.equal(m.van, 'rtg@rtmail');
  assert.equal(m.naar, 'sakura@rtmail');
  assert.equal(m.gelezen, false);
  const vak = rtmail.postvak('sakura');
  assert.equal(vak.length, 1);
  assert.equal(vak[0].onderwerp, 'Welkom bij RTG');
  assert.equal(rtmail.ongelezen('sakura'), 1);
  // een ander postvak blijft leeg
  assert.equal(rtmail.postvak('bloem').length, 0);
});

test('lezen markeert alleen het eigen bericht, en verlaagt de teller', () => {
  const { rtmail } = maak();
  const m = rtmail.systeemStuur('sakura', 'Sollicitatie binnen', 'Een nieuwe sollicitant.');
  // een ander adres mag dit bericht niet als gelezen markeren
  assert.ok(rtmail.lees('bloem', m.id).error, 'niet jouw postvak -> fout');
  assert.equal(rtmail.ongelezen('sakura'), 1);
  const gelezen = rtmail.lees('sakura', m.id);
  assert.equal(gelezen.gelezen, true);
  assert.equal(rtmail.ongelezen('sakura'), 0);
});

test('een leeg ontvang-adres wordt geweigerd', () => {
  const { rtmail } = maak();
  assert.ok(rtmail.stuur({ van: 'rtg@rtmail', naar: '', onderwerp: 'x', tekst: 'y' }).error);
});

test('zaak naar zaak: verzonden-lijst en ontvang-lijst kloppen', () => {
  const { rtmail } = maak();
  rtmail.stuur({ van: 'sakura', naar: 'bloem', onderwerp: 'Inkoop', tekst: '10 dozen graag' });
  assert.equal(rtmail.verzonden('sakura').length, 1);
  assert.equal(rtmail.postvak('bloem').length, 1);
  assert.equal(rtmail.postvak('bloem')[0].van, 'sakura@rtmail');
});
