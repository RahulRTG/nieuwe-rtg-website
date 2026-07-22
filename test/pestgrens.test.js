/* De pestgrens van Rahul: drie waarschuwingen bij pesten, daarna een vurig
   slotantwoord (waarin hij zegt dat hij hier zelf geen behoefte aan had) en
   24 uur weg; na die 24 uur opent alleen een oprecht excuus de deur, en
   weigeren betekent opnieuw 24 uur stilte. Draai los:
   node --experimental-sqlite --test test/pestgrens.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const db = { data: {} };
const { pestgrens } = require('../server/kern/pestgrens')({ db, save: () => {} });
const KEY = 'user-777';

test('gewone berichten gaan gewoon door; drie keer pesten geeft drie oplopende waarschuwingen', () => {
  assert.equal(pestgrens.poort(KEY, 'Plan mijn dag in Ibiza'), null, 'een nette vraag passeert de poort');
  const w1 = pestgrens.poort(KEY, 'je bent dom');
  assert.equal(w1.waarschuwing, 1);
  const w2 = pestgrens.poort(KEY, 'stomme ai, hou je bek');
  assert.equal(w2.waarschuwing, 2);
  const w3 = pestgrens.poort(KEY, 'sukkel');
  assert.equal(w3.waarschuwing, 3);
  assert.match(w3.antwoord, /laatste waarschuwing/i);
  assert.equal(pestgrens.poort(KEY, 'oke sorry, terug naar mijn reis'), null, 'na een waarschuwing kan het gesprek gewoon verder');
});

test('de vierde keer: een vurig slotantwoord (zonder er zin in te hebben) en 24 uur weg', () => {
  const slot = pestgrens.poort(KEY, 'loser');
  assert.equal(slot.vurig, true);
  assert.equal(slot.weg, true);
  assert.match(slot.antwoord, /geen zin in/i, 'hij zegt dat hij hier zelf geen zin in had');
  assert.match(slot.antwoord, /24 uur/i, 'en dat hij 24 uur weg is');
  assert.match(slot.antwoord, /excuses/i, 'en dat het straks met excuses begint');
  const dicht = pestgrens.poort(KEY, 'hallo? ben je er nog?');
  assert.equal(dicht.weg, true, 'tijdens de 24 uur is Rahul er echt niet');
  assert.match(dicht.antwoord, /er even niet/i);
});

test('na 24 uur: excuses openen de deur (schone lei), weigeren betekent opnieuw 24 uur weg', () => {
  // draai de klok terug alsof de 24 uur voorbij zijn
  db.data.rahulRespect[KEY].wegTot = Date.now() - 1000;
  const vraag = pestgrens.poort(KEY, 'doe je werk eens');
  assert.equal(vraag.blok, true);
  assert.match(vraag.antwoord, /excuses/i, 'eerst de excuses-poort, dan pas het gesprek');
  const weiger = pestgrens.poort(KEY, 'waarom zou ik sorry zeggen');
  assert.equal(weiger.weg, true, 'weigeren en hij is weer weg');
  db.data.rahulRespect[KEY].wegTot = Date.now() - 1000;
  const zoen = pestgrens.poort(KEY, 'sorry Rahul, dat was niet oke van mij');
  assert.equal(zoen.verzoend, true, 'excuses aanvaard');
  assert.equal(pestgrens.poort(KEY, 'zullen we verder met mijn reis?'), null, 'de lei is schoon en het gesprek loopt weer');
  assert.equal(pestgrens.stand(KEY).n, 0, 'de teller staat op nul');
});
