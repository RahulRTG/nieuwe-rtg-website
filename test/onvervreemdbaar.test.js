/* DE UNIVERSELE BODEM -- de nulmeting, en vooral wat zij niet mag beweren.

   scripts/onvervreemdbaar.js vraagt voor SAMENLEVING.md SAM-01 of een werkwoord
   van de bodem (leren, ontwikkelen, orienteren, verbinden, rust, hulp vinden,
   opnieuw beginnen) achter betaling verdwijnt. De meting zelf draait tegen een
   wegwerpserver; dit bestand bewaakt het instrument en houdt de uitslag als
   ratel vast (ONVERVREEMDBAAR.json).

   DE LES DIE HIER VASTLIGT (toets 5). De eerste versie van de meter gebruikte de
   demo-gast uit lib/doelgroepsessies.js als "gratis" sessie. Dat is een
   bezoeker ZONDER account, en die weigert `geenGast()` in server/server.js met
   opzet -- een gratis account met paspoort mag wel. De meter vond daardoor vijf
   functies "achter betaling" die in werkelijkheid achter een ACCOUNT zaten.
   Een geldige uitslag van het verkeerde experiment (BEWIJSMACHINE.md par. 6a).

   Draai los: node --test test/onvervreemdbaar.test.js
   De meting zelf: npm run onvervreemdbaar */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const { WERKWOORDEN, VERKLARING, AFGETEKEND } = require('../scripts/lib/onvervreemdbaar-verklaring');
const { klasseRoute, klasseFunctie, klasseWerkwoord } = require('../scripts/onvervreemdbaar');
const { FUNCTIES } = require('../server/functies/register');
const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'onvervreemdbaar.js'), 'utf8');
const accountBron = fs.readFileSync(path.join(WORTEL, 'scripts', 'lib', 'gratisaccount.js'), 'utf8');
const meting = JSON.parse(fs.readFileSync(path.join(WORTEL, 'ONVERVREEMDBAAR.json'), 'utf8'));

test('1. de verklaring kent precies de zeven werkwoorden van SAMENLEVING.md par. 2', () => {
  assert.deepEqual(WERKWOORDEN, ['leren', 'ontwikkelen', 'orienteren', 'verbinden', 'rust', 'hulp-vinden', 'opnieuw-beginnen']);
  assert.deepEqual(Object.keys(VERKLARING).sort(), [...WERKWOORDEN].sort(),
    'een werkwoord dat in de verklaring ontbreekt, verdwijnt stil uit de meting');
});

test('2. elke verklaarde functie bestaat, en een versmalling blijft binnen de functie', () => {
  for (const [ww, regels] of Object.entries(VERKLARING)) {
    for (const r of regels) {
      if (r.scherm) {
        assert.ok(fs.existsSync(path.join(WORTEL, 'public', r.scherm)), ww + ': scherm ' + r.scherm + ' bestaat niet');
        continue;
      }
      const f = FUNCTIES.find((x) => x.id === r.functie);
      assert.ok(f, ww + ': functie ' + r.functie + ' staat niet in het functieregister');
      assert.ok(r.waarom, ww + ': ' + r.functie + ' zegt niet waarom hij dit werkwoord draagt');
      for (const p of r.paden || []) {
        assert.ok((f.paden || []).some((q) => p === q || p.startsWith(q + '/')),
          ww + ': ' + r.functie + ' versmalt naar ' + p + ', en dat valt buiten de paden van de functie');
      }
    }
  }
});

test('3. een niet-afgetekende verklaring zegt dat ze een voorstel is', () => {
  /* CODE.md par. 7: een voorgestelde meter promoveert niets tot een mens hem
     aftekent. Zolang `door` leeg is, moet de uitslag dat zelf dragen. */
  if (!AFGETEKEND.door) {
    assert.match(AFGETEKEND.stand, /voorstel/);
    assert.equal(meting.verklaring.door, null);
  }
  assert.equal(meting.graad, 'vermoed', 'achter-betaling leest een sessieverschil als pasverschil; dat is vermoed');
});

test('4. de classificatie per route, functie en werkwoord', () => {
  const s = (status) => ({ status });
  assert.equal(klasseRoute({ gratis: s(400), rtg: s(400) }), 'open', 'een 400 is een deur die openging');
  assert.equal(klasseRoute({ gratis: s(404), rtg: s(403) }), 'open');
  assert.equal(klasseRoute({ gratis: s(403), rtg: s(404) }), 'achter-betaling');
  assert.equal(klasseRoute({ gratis: s(401), rtg: s(200) }), 'achter-betaling');
  assert.equal(klasseRoute({ gratis: s(403), rtg: s(403) }), 'ook-rtg-geweigerd',
    'als de RTG Pass ook geweigerd wordt, zegt de route niets over betalen');
  assert.equal(klasseRoute({ gratis: { status: 429, onbepaald: true }, rtg: s(200) }), 'onbepaald');
  assert.equal(klasseRoute({ gratis: s(403), rtg: { status: 0, onbepaald: true } }), 'onbepaald');

  assert.equal(klasseFunctie(['open', 'open']).stand, 'open');
  assert.equal(klasseFunctie(['open', 'achter-betaling']).stand, 'deels-achter-betaling');
  assert.equal(klasseFunctie(['achter-betaling', 'ook-rtg-geweigerd']).stand, 'achter-betaling');
  assert.equal(klasseFunctie(['ook-rtg-geweigerd']).stand, 'buiten-bereik');
  assert.equal(klasseFunctie(['ook-rtg-geweigerd', 'onbepaald']).stand, 'onbepaald');
  assert.equal(klasseFunctie([]).stand, 'niet-beproefd');

  assert.equal(klasseWerkwoord([]), 'geen-eigenaar', 'een werkwoord zonder functie is nooit aanwezig');
  assert.equal(klasseWerkwoord(['achter-betaling', 'achter-betaling']), 'verdwenen');
  assert.equal(klasseWerkwoord(['achter-betaling', 'deels-achter-betaling']), 'aanwezig');
  assert.equal(klasseWerkwoord(['achter-betaling', 'onbepaald']), 'onbepaald',
    'verdwenen is een beschuldiging; een onbepaalde functie ernaast maakt hem onbewezen');
});

test('5. "gratis" is een geregistreerd account en niet de demo-gast zonder account', () => {
  assert.match(bron, /require\('\.\/lib\/gratisaccount'\)/, 'het gratis account komt niet meer uit de gedeelde registratie');
  assert.match(accountBron, /\/api\/auth\/register/);
  assert.match(accountBron, /tier: 'guest'/);
  assert.match(accountBron, /gebruiker\.tier === 'guest'/, 'een registratie die geen gast-account opleverde, telt als gratis account');
  assert.match(bron, /const gratisKop = \{ Authorization: 'Bearer ' \+ gratisAccount\.token \}/);
  assert.match(bron, /keurLidGoed\(srv\.basis, gratisAccount\.token/, 'het oordeel hoort op een GECONTROLEERD gratis account te staan');
  assert.match(bron, /klop\(srv\.basis, r, gratisKop\)/,
    'de gratis kolom moet de geregistreerde sessie gebruiken, anders meet hij een bezoeker zonder account');
  assert.doesNotMatch(bron, /klop\(srv\.basis, r, kop\(sessies\.gast\)\)/);
});

test('6. de meting laat niets stil vallen', () => {
  assert.deepEqual(meting.overgeslagen, [], 'een ontbrekende sessie is niet gemeten, en dat is geen uitslag');
  const verklaard = Object.values(VERKLARING).reduce((n, r) => n + r.length, 0);
  assert.equal(meting.functies.length, verklaard, 'elke regel van de verklaring hoort een uitslag te dragen');
  assert.deepEqual(Object.keys(meting.werkwoorden).sort(), [...WERKWOORDEN].sort());
});

test('7. de ratel: de bodem mag alleen breder worden', () => {
  /* GRONDWAARDE van 27 september 2026. Deze getallen mogen alleen dalen; wie
     er een verhoogt, zet een deel van de bodem achter betaling en hoort dat
     in SAMENLEVING.md uit te schrijven in plaats van hier een getal op te
     hogen. */
  const GROND = { verdwenen: 0, geenEigenaar: 1, achterBetaling: 1, deelsAchterBetaling: 5 };
  assert.ok(meting.telling.verdwenen <= GROND.verdwenen, 'SAM-01: een werkwoord verdween achter betaling');
  assert.ok(meting.telling['geen-eigenaar'] <= GROND.geenEigenaar);
  assert.ok(meting.achterBetaling.length <= GROND.achterBetaling,
    'meer functies achter betaling dan de grondwaarde: ' + meting.achterBetaling.join(', '));
  assert.ok(meting.deelsAchterBetaling.length <= GROND.deelsAchterBetaling,
    'meer functies deels achter betaling dan de grondwaarde: ' + meting.deelsAchterBetaling.join(', '));
  assert.equal(meting.klopt, meting.telling.verdwenen === 0 && meting.overgeslagen.length === 0);
});
