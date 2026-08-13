/* WAT ER GEBEURT ALS EEN PARTIJ AFLOOPT TERWIJL NIEMAND EEN ZET DOET.

   Twee beweringen, en ze komen allebei uit een fout die niet door een toets maar
   door een SCHERMFOTO aan het licht kwam (.shot/maak.js: een echte partij
   opzetten en er daarna naar kijken).

   1. EEN CAMPAGNE DIE OP DE KLOK AFLOOPT WORDT OPGESCHREVEN. Magnaat rekent zijn
      maanden bij op AANRAKING (magnaat/economie.js `bijrekenen`), dus de laatste
      maand valt net zo goed tijdens een `spelStaat` als tijdens een zet. Hing
      `naPotje` alleen aan `spelZet`, dan verdween zo'n campagne spoorloos: geen
      uitslag, geen loopbaan, geen stadsgeheugen -- en `spelZet` weigert een
      klaar potje al bij de deur, dus er kwam ook nooit meer een tweede kans.
      Wie een campagne uitspeelt door hem te VOLGEN, hield niets over.

   2. EN DE SPELER ZIET DE ECHTE STAND. De weergave werd opgebouwd VOORDAT de
      motor draaide, dus een potje dat tijdens diezelfde aanroep afliep werd nog
      als `bezig` teruggegeven -- met de eindstand er al onder.

   Draai los: node --experimental-sqlite --test test/spelnapotje.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

/* Een partijlaag met een NEPSPEL erin. Het spel doet maar een ding, en dat is
   precies het ding waar het om gaat: bij het TEKENEN van de weergave loopt de
   tijd door, en daarmee kan de partij aflopen. Zo hoeft deze toets geen halve
   Magnaat op te tuigen om over Magnaats klok iets te kunnen zeggen. */
function laag({ looptAfBijTekenen }) {
  const potjes = {};
  const geschreven = [];
  const p = { id: 'p1', soort: 'nep', spelers: ['a', 'b'], teams: [0, 1], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, staat: { maand: 0 } };
  potjes[p.id] = p;
  const ctx = {
    db: { data: {} }, save() {}, crypto: require('crypto'),
    codenaamVan: (h) => 'CN-' + h, nu: () => new Date().toISOString(),
    S: () => ({ potjes }),
    SPEL: { nep: { sleutel: 'nep', naam: 'Nep', buitenBeurt: [] } },
    SOORTEN: { nep: 'Nep' },
    nudge() {},
    ZICHT: { nep: { speler: (potje, st) => {
      /* HIER LOOPT DE TIJD. Een weergave die de motor aanraakt is precies wat
         Magnaat doet; dat is geen kunstgreep van deze toets. */
      if (looptAfBijTekenen && potje.status === 'bezig') {
        potje.status = 'klaar';
        potje.winnaar = 'CN-a';
      }
      return { maand: st.maand };
    } } },
    ZETTEN: { nep: () => ({ status: 200, ok: true }) },
    STATISCH: {},
    noteerUitslag: (potje) => { if (!potje.uitslagGenoteerd) { potje.uitslagGenoteerd = true; geschreven.push('uitslag'); } },
    noteerZet() {},
    noteerLoopbaan: (potje) => { if (!potje.loopbaanGenoteerd) { potje.loopbaanGenoteerd = true; geschreven.push('loopbaan'); } },
    zijnVrienden: () => true, isGeblokkeerd: () => false, klok: null, beleid: null
  };
  return { p, geschreven, api: require('../server/kern/spellen/partij')(ctx) };
}

test('een partij die tijdens het KIJKEN afloopt wordt opgeschreven', () => {
  const w = laag({ looptAfBijTekenen: true });
  const r = w.api.spelStaat('a', 'p1');
  assert.equal(r.status, 200);
  assert.deepEqual(w.geschreven, ['uitslag', 'loopbaan'],
    'uitslag en loopbaan horen vastgelegd te zijn, ook zonder dat er iemand een zet deed');
});

test('en de kijker krijgt de ECHTE stand terug, niet die van voor het rekenen', () => {
  const w = laag({ looptAfBijTekenen: true });
  const r = w.api.spelStaat('a', 'p1');
  assert.equal(r.potje.status, 'klaar');
  assert.equal(r.potje.winnaar, 'CN-a');
});

test('een lopende partij wordt NIET opgeschreven -- kijken is geen einde', () => {
  const w = laag({ looptAfBijTekenen: false });
  const r = w.api.spelStaat('a', 'p1');
  assert.equal(r.potje.status, 'bezig');
  assert.deepEqual(w.geschreven, []);
});

test('twee keer kijken schrijft een keer op', () => {
  const w = laag({ looptAfBijTekenen: true });
  w.api.spelStaat('a', 'p1');
  w.api.spelStaat('b', 'p1');
  w.api.spelStaat('a', 'p1');
  assert.deepEqual(w.geschreven, ['uitslag', 'loopbaan'],
    'de poll van 2,5 seconde mag geen tweede regel opleveren');
});
