/* ============================================================================
   DE VERTROUWENSSTAND -- afgeleid uit harde feiten, en nergens bewaard.

   DE BEWERING DIE ERTOE DOET staat in toets 3: een conclusie is nooit harder
   dan haar zachtste premisse. Zonder die regel lezen drie halve zekerheden
   samen als een hele, en dat is precies het samengestelde groene cijfer dat
   LAT-regel 11 en check.js regel 48 verbieden.

   En toets 5, die structureel is: deze stand wordt NIET opgeslagen. Een
   afgeleide waarde die je bewaart is een tweede waarheid die veroudert -- de
   sessie zegt dan "sterk" terwijl het toestel er inmiddels uit ligt. Het veld
   `vertrouwen` is daarom uit sessievelden.js gehaald in plaats van gevuld.

   Draai los: node --test test/vertrouwen.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { standVan, STANDEN, NIET_MEEGEWOGEN } = require('../server/kern/identiteit/vertrouwen');

const g = (x) => ({ graad: x, aanwezig: x !== 'onbekend' });

/* ---------------------------------------------------------------------------
   1. DE VIER STANDEN, en wat ze betekenen.
   ------------------------------------------------------------------------- */
test('1. zonder authenticator is de stand onbekend, niet zwak', () => {
  const s = standVan({});
  assert.equal(s.stand, 'onbekend');
  assert.equal(s.graad, 'onbekend');
  assert.match(s.graadReden, /niets vastgesteld/,
    '"wij hebben nooit vastgelegd" is iets anders dan "dit is zwak"');
});

test('1b. een wachtwoord is KENNIS en dat is over te dragen', () => {
  const s = standVan({ authenticator: g('gemeten') }, 'wachtwoord');
  assert.equal(s.stand, 'kennis');
  assert.match(s.uitleg, /over te dragen/,
    'het verschil tussen weten en hebben is de hele reden dat deze stand bestaat');
});

test('1c. een passkey is BEZIT', () => {
  assert.equal(standVan({ authenticator: g('bewezen') }, 'passkey').stand, 'bezit');
});

test('1d. een bewezen toestelbinding tilt een wachtwoordsessie naar bezit', () => {
  const s = standVan({ authenticator: g('gemeten'), toestel: g('bewezen') }, 'wachtwoord');
  assert.equal(s.stand, 'bezit', 'het toestel heeft een sleutel aangetoond die het niet kan verlaten');
});

test('1e. sleutelbinding tilt naar gebonden, maar alleen boven op bezit', () => {
  assert.equal(standVan({ authenticator: g('bewezen'), sleutelbinding: g('bewezen') }).stand, 'gebonden');
  assert.equal(standVan({ authenticator: g('gemeten'), sleutelbinding: g('bewezen') }).stand, 'kennis',
    'een gebonden token boven op alleen kennis is nog steeds kennis: er is niets bezeten aangetoond');
});

/* ---------------------------------------------------------------------------
   2. HET IS GEEN SCORE.
   ------------------------------------------------------------------------- */
test('2. er komt geen cijfer uit', () => {
  const s = standVan({ authenticator: g('bewezen'), toestel: g('bewezen'), sleutelbinding: g('bewezen') });
  const plat = JSON.stringify(s);
  assert.equal(/"(score|punten|percentage|cijfer)"/.test(plat), false,
    'een mens die "72" leest weet niet of hij iets moet doen');
  for (const k of Object.keys(s)) assert.equal(typeof s[k] === 'number', false, k + ' is een getal');
});

/* ---------------------------------------------------------------------------
   3. DE KERN: nooit harder dan de zachtste premisse.
   ------------------------------------------------------------------------- */
test('3. een vermoede authenticator maakt de hele stand vermoed', () => {
  const s = standVan({ authenticator: g('vermoed'), toestel: g('bewezen'), sleutelbinding: g('bewezen') }, 'overdracht');
  assert.equal(s.stand, 'gebonden', 'de stand zelf mag best hoog zijn');
  assert.equal(s.graad, 'vermoed', 'maar de zekerheid erover is die van het zwakste feit eronder');
  assert.match(s.graadReden, /zwakste feit/);
});

test('3b. alles bewezen geeft ook bewezen', () => {
  const s = standVan({ authenticator: g('bewezen'), toestel: g('bewezen'), sleutelbinding: g('bewezen') });
  assert.equal(s.graad, 'bewezen');
});

test('3c. een zacht feit dat NIET meetelt, verzwakt de graad ook niet', () => {
  const s = standVan({ authenticator: g('bewezen'), toestel: g('vermoed') });
  assert.equal(s.graad, 'bewezen',
    'de vermoede toestelbinding draagt deze stand niet, dus hij hoort hem ook niet omlaag te halen');
  const grond = s.gronden.find(x => x.feit === 'Toestelbinding');
  assert.equal(grond.staat, 'vermoed', 'maar hij staat er wel eerlijk bij');
});

/* ---------------------------------------------------------------------------
   4. HIJ ZEGT WAT HIJ NIET BEKEEK.
   ------------------------------------------------------------------------- */
test('4. wat niet meeweegt staat erbij, met een reden per regel', () => {
  const s = standVan({ authenticator: g('bewezen') });
  assert.ok(s.nietMeegewogen.length >= 3);
  for (const n of s.nietMeegewogen) {
    assert.ok(n.wat && n.reden && n.reden.length > 25,
      n.wat + ' staat er zonder reden bij; een stand die zwijgt over wat hij niet bekeek, laat een mens denken dat hij alles bekeek');
  }
  assert.ok(s.nietMeegewogen.some(n => /gedrag/i.test(n.wat)), 'gedrag hoort hier expliciet buiten te staan');
});

test('4b. elke grond draagt een betekenis en niet alleen een woord', () => {
  const s = standVan({ authenticator: g('gemeten') }, 'wachtwoord');
  for (const grond of s.gronden) {
    assert.ok(grond.feit && grond.staat && grond.betekenis && grond.betekenis.length > 15,
      grond.feit + ' zegt niet wat het betekent');
  }
});

/* ---------------------------------------------------------------------------
   5. HIJ WORDT NIET BEWAARD -- structureel, niet als belofte.
   ------------------------------------------------------------------------- */
test('5. het veld vertrouwen bestaat niet meer in de sessie', () => {
  const { VELDEN } = require('../server/kern/identiteit/sessievelden');
  assert.equal(VELDEN.vertrouwen, undefined,
    'een afgeleide waarde opslaan maakt er een tweede waarheid van die veroudert');
});

test('5b. de module kent geen opslag', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'identiteit', 'vertrouwen.js'), 'utf8');
  const code = bron.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const verboden of ['db.data', 'save(', 'eigencollectie', 'require(\'../eigencollectie\')']) {
    assert.equal(code.includes(verboden), false,
      'kern/identiteit/vertrouwen.js raakt "' + verboden + '" aan; deze stand hoort te worden berekend en niet bewaard');
  }
});

test('5c. het register levert hem mee zonder hem op te slaan', () => {
  const { maakSessieregister } = require('../server/kern/identiteit/sessieregister');
  const db = { data: {} };
  const reg = maakSessieregister({ db, save() {} });
  const nu = new Date().toISOString();
  reg.open('aaaaaaaaaaaa', 'user-1', { authenticator: { type: 'passkey', authenticatorId: 'c1',
    herkomst: { bron: 't', methode: 'cryptografisch', vastgesteldOp: nu, regelversie: 'v1' } } });
  assert.equal(reg.vanLid('user-1')[0].vertrouwen.stand, 'bezit');
  assert.equal(JSON.stringify(db.data.sessiecontext).includes('vertrouwen'), false,
    'de berekende stand hoort niet in de opslag te belanden');
});

test('6. de standen zijn geordend en compleet', () => {
  const rangen = Object.values(STANDEN).map(s => s.rang).sort();
  assert.deepEqual(rangen, [0, 1, 2, 3]);
  for (const [id, s] of Object.entries(STANDEN)) {
    assert.ok(s.naam && s.uitleg && s.uitleg.length > 25, id + ' mist een uitleg die een mens iets zegt');
  }
  assert.ok(NIET_MEEGEWOGEN.length >= 3);
});
