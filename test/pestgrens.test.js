/* Alleen de verdachte beurt wordt gestopt. Trefwoorden, een oude teller en
   het weigeren van excuses mogen geen langdurige chatsanctie veroorzaken.
   Draai los:
   node --test test/pestgrens.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

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
  assert.equal(w3.beoordelingNodig, true);
  assert.match(w3.antwoord, /beoordeling door een mens/i);
  assert.equal(pestgrens.poort(KEY, 'oke sorry, terug naar mijn reis'), null, 'na een waarschuwing kan het gesprek gewoon verder');
});

test('herhaalde signalen blokkeren alleen de beurt, niet het volgende verzoek', () => {
  const slot = pestgrens.poort(KEY, 'loser');
  assert.equal(slot.blok, true);
  assert.equal(slot.bescherming, 'bericht');
  assert.equal(slot.weg, false);
  assert.equal(slot.beoordelingNodig, true);
  assert.equal(slot.service, '/apps/service.html');
  assert.match(slot.antwoord, /nog geen melding .* verstuurd/i);
  assert.doesNotMatch(slot.antwoord, /24 uur|excuses/);
  for (const vraag of ['hallo? ben je er nog?', 'Ik wil opzeggen', 'Ik wil mijn factuur betalen',
    'Ik wil een medewerker spreken', 'Waarom zou ik sorry zeggen?']) {
    assert.equal(pestgrens.poort(KEY, vraag), null, vraag);
  }
  assert.equal(pestgrens.stand(KEY).weg, false);
});

test('een oude automatische blokkade geeft ook na herstart geen nieuwe sanctie', () => {
  const oud = { n: 7, wegTot: Date.now() + 86400000, wachtExcuus: true };
  const eigen = { data: { rahulRespect: { oud } } };
  const grens = require('../server/kern/pestgrens')({ db: eigen, save() { throw Error('lezen schrijft niet'); } }).pestgrens;
  for (const vraag of ['Ik betwist de blokkade', 'Waarom zou ik sorry zeggen?', 'Ik heb nazorg nodig'])
    assert.equal(grens.poort('oud', vraag), null);
  assert.deepEqual(grens.stand('oud'), { n: 7, weg: false, wachtExcuus: false });
  assert.deepEqual(eigen.data.rahulRespect.oud, oud, 'historisch spoor blijft staan, maar geeft geen sanctiebevoegdheid');
});

test('ziektewoorden alleen zijn geen misbruiksignaal', () => {
  for (const vraag of ['Ik heb kanker en moet mijn reis wijzigen', 'Welke vaccinaties zijn er tegen tyfus?'])
    assert.equal(pestgrens.poort('zorg', vraag), null);
  assert.equal(db.data.rahulRespect.zorg, undefined);
});

test('de echte fluisterroute stopt de verdachte uitvoering maar laat de volgende beurt door', async () => {
  let handler, uitgevoerd = 0;
  const lokaal = require('../server/kern/pestgrens')({ db: { data: {} }, save() {} }).pestgrens;
  require('../server/routes/member/persoonlijk-rahul')({
    app: { post(pad, ...stappen) { assert.equal(pad, '/api/fluister'); handler = stappen.at(-1); } },
    auth() {}, pestgrens: lokaal, liveCodename: () => 'TESTLID',
    contextDomeinen: { scherm: () => ({}) },
    fluister: { async fluisterZeg() { uitgevoerd++; return { status: 418, error: 'Einde van de proef na de beschermpoort' }; } }
  });
  async function vraag(q) {
    let antwoord, status = 200;
    const res = { status(n) { status = n; return res; }, json(r) { antwoord = r; return res; } };
    await handler({ body: { q }, session: { key: 'user-echt', tier: 'guest' } }, res);
    return { status, antwoord };
  }
  for (let i = 0; i < 5; i++) {
    const r = await vraag('je bent dom');
    assert.equal(r.status, 200);
    assert.equal(r.antwoord.bescherming, 'bericht');
    assert.equal(r.antwoord.weg, false);
    assert.equal(r.antwoord.service, '/apps/service.html');
  }
  assert.equal(uitgevoerd, 0, 'verdachte berichten bereiken de uitvoering niet');
  assert.equal((await vraag('Ik wil een medewerker spreken')).status, 418);
  assert.equal(uitgevoerd, 1, 'geen automatische 24-uursban na de vijfde keer');
});
