/* ============================================================================
   DE POORT VOOR DE AI-AANBIEDER.

   /api/translate is publiek en dat hoort ook -- de taalkiezer staat al op het
   inlogscherm. Maar de AI-tak erachter kost geld en stuurt elke ingetypte zin
   naar een derde partij. server/translate.js waarschuwt daar zelf voor: zonder
   grens is dit een gratis doorgeefluik naar een betaalde aanbieder.

   DE GRENS STOND ER EN BEWEES NIETS:

       const ingelogd = /^Bearer\s+\S/i.test(req.get('authorization') || '');

   Een vormcontrole op een header. Wie `Authorization: Bearer x` meestuurde,
   zette de AI-weg aan zonder enig account. Geen token dat ergens tegen gehouden
   werd, geen lid, geen rekening. LAT.md regel 8.

   Waarom dit een UNIT-toets is en geen integratietoets. De AI-tak is van
   buitenaf niet waarneembaar: zonder ANTHROPIC_API_KEY staat `anthropic` op
   null, dus met en zonder poort komt er hetzelfde woordenboekantwoord terug.
   Een integratietoets zou dus groen blijven bij precies de fout die we
   repareren. De beslissing is daarom uit de route gehaald; hier wordt hij
   rechtstreeks beproefd, met een nagemaakte resolveSession.

   Draai los: node --experimental-sqlite --test test/aipoort.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakAiPoort } = require('../server/kern/aipoort');

/* Een nagemaakte sessielaag met precies de vormen die de echte teruggeeft:
   - een echt account  -> { tier, key, account }
   - een demo-pas      -> { tier, key }
   - een anonieme gast -> { tier: 'guest', key: 'guest-...' }
   Alles wat er niet in staat is een onbekend token. */
const SESSIES = {
  'echt-lid':   { tier: 'rtg', key: 'user-42', account: { id: 42, tier: 'rtg' } },
  'demo-pas':   { tier: 'lifestyle', key: 'demo-7' },
  'gast':       { tier: 'guest', key: 'guest-abc' }
};
const poort = maakAiPoort({ resolveSession: t => SESSIES[t] || null });
const req = (kop) => ({ get: (n) => (String(n).toLowerCase() === 'authorization' ? kop : undefined) });

test('1. zonder Authorization-kop gaat er niets naar de aanbieder', () => {
  assert.equal(poort.magAi(req(undefined)), false);
  assert.equal(poort.magAi(req('')), false);
  assert.equal(poort.magAi({}), false, 'een request zonder get() ook niet');
  assert.equal(poort.magAi(null), false, 'en helemaal geen request al helemaal niet');
});

/* DE BEWERING DIE DE FOUT VASTPINT. Dit is precies wat de oude regex goedkeurde:
   het woord Bearer met iets erachter. */
test('2. een verzonnen Bearer-token komt er NIET langs', () => {
  for (const kop of ['Bearer x', 'Bearer 1', 'Bearer onzin', 'Bearer ' + 'a'.repeat(200),
    'bearer x', 'Bearer  spaties']) {
    assert.equal(poort.magAi(req(kop)), false, JSON.stringify(kop) + ' hoort geweigerd te worden');
  }
});

test('3. een kop zonder Bearer-vorm ook niet', () => {
  for (const kop of ['Basic abc', 'Token echt-lid', 'echt-lid', 'Bearer', 'Bearer ']) {
    assert.equal(poort.magAi(req(kop)), false, JSON.stringify(kop));
  }
});

/* Een gastsessie is met een enkele aanroep te maken (POST /api/login, tier
   guest). Toelaten zou de lat maar EEN verzoek hoger leggen. Dezelfde afweging
   als bij het Lab-fonds, waar een gastsessie ook langs de "log in met je
   RTG-account"-grens kwam omdat zij nu eenmaal een key heeft. */
test('4. een anonieme gastsessie is geen inlog', () => {
  assert.equal(poort.magAi(req('Bearer gast')), false,
    'gratis aan te maken, dus geen grens');
});

test('5. een echt account en een demo-pas mogen wel', () => {
  assert.equal(poort.magAi(req('Bearer echt-lid')), true);
  assert.equal(poort.magAi(req('Bearer demo-pas')), true);
});

test('6. een sessielaag die gooit betekent dicht, niet open', () => {
  const stuk = maakAiPoort({ resolveSession: () => { throw new Error('kapot'); } });
  assert.equal(stuk.magAi(req('Bearer echt-lid')), false,
    'bij twijfel dicht: een dichte poort kost een woordenboekvertaling, een open poort kost geld');
});

test('7. zonder sessielaag start de poort niet', () => {
  assert.throws(() => maakAiPoort({}), /resolveSession/,
    'liever een server die niet start dan een AI-weg die publiek is');
});
