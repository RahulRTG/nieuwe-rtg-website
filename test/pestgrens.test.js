/* De pestgrens van Rahul: drie waarschuwingen bij pesten, daarna een vurig
   slotantwoord (waarin hij zegt dat hij hier zelf geen behoefte aan had) en
   24 uur weg; na die 24 uur opent alleen een oprecht excuus de deur, en
   weigeren betekent opnieuw 24 uur stilte. Draai los:
   node --test test/pestgrens.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const db = { data: {} };
const { pestgrens } = require('../server/kern/pestgrens')({ db, save: () => {} });
const KEY = 'user-777';

/* EEN NET GESPREK LAAT GEEN SPOOR NA, EN DAT WAS NIET ZO.

   `S(key)` legde bij ELKE oproep een record aan in `rahulRespect` -- ook bij een
   vriendelijke vraag, en ook wanneer de route daarna 400 gaf. Twee gevolgen: een
   geweigerd verzoek veranderde de toestand (de staatproef vond het, door de
   OPSLAG te meten in plaats van het antwoord), en de collectie groeide mee met
   het aantal sessies in plaats van met het aantal incidenten -- lege regels over
   leden die niets verkeerd deden.

   Deze toets kijkt in de bak in plaats van naar het antwoord, want precies daar
   zat het verschil.

   DE MUTATIE: laat S(key) het lege record weer wegschrijven -> deze toets zakt. */
test('een net gesprek laat niets achter in de teller', () => {
  const eigen = { data: {} };
  const bak = () => (eigen.data.rahulRespect || {});
  const grens = require('../server/kern/pestgrens')({ db: eigen, save: () => {} }).pestgrens;

  assert.equal(grens.poort('user-net', 'Plan mijn dag in Ibiza'), null);
  assert.deepEqual(Object.keys(bak()), [], 'een nette vraag hoort niets op te slaan');

  /* Lezen mag ook niets aanmaken: het bord vraagt de stand van iedereen op. */
  assert.deepEqual(grens.stand('user-net'), { n: 0, weg: false, wachtExcuus: false });
  assert.deepEqual(Object.keys(bak()), [], 'de stand opvragen is lezen, geen schrijven');

  /* En zodra er WEL iets voorvalt, staat het er gewoon. */
  grens.poort('user-net', 'sukkel');
  assert.deepEqual(Object.keys(bak()), ['user-net'], 'een waarschuwing hoort wel bewaard te worden');
  assert.equal(bak()['user-net'].n, 1);
});

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
