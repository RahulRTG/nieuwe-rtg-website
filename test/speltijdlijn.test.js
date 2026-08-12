/* MAGNAAT: DE TIJDLIJN -- waar de tafel het over heeft.

   Fase D, `chat-integratie`. "Een spel koppelen aan de chat" is de kortste weg
   naar twee dingen die niet mogen, dus de meeste beweringen gaan daarover.

   Zes beweringen, en ze zijn alle zes stil terug te draaien:

   1. HIJ STUURT NIETS. Geen bericht, geen sein, geen duwtje, geen push.
   2. HIJ MAAKT GEEN GESPREK, en geeft dus geen nieuw recht om iemand te
      bereiken -- de regel uit spellen/praat.js en spellen/kring.js.
   3. ER STAAT ALLEEN IN WAT AL PUBLIEK IS. Geen kas, geen omzet, geen vermogen.
   4. HIJ WORDT GEREKEND EN NIET BEWAARD, dus niemand mist een regel.
   5. HIJ IS VOOR IEDEREEN HETZELFDE, en in dezelfde volgorde.
   6. HET WERELDNIEUWS STAAT ER NIET IN, en dat is geen weglating.

   Draai los: node --experimental-sqlite --test test/speltijdlijn.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };

function opstelling() {
  const m = maakMagnaat();
  const p = { id: 't1', soort: 'magnaat', spelers: ['anna', 'boris', 'chris'], teams: [0, 1, 2],
    modus: 'vrij', status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  const kav = kaart('ijmuiden').kavels.filter(k => k.zone === 'boulevard');
  for (const h of p.spelers) p.staat.geld[h] = 5000000;
  p.spelers.forEach((h, i) => m.eco.zet(p, h, { actie: 'open', kavel: kav[i].id, sector: 'horeca', omvang: 30 }));
  const maand = (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } };
  return { m, p, st: p.staat, maand };
}

/* ================= 1 en 2. hij stuurt niets en maakt geen gesprek ================= */

test('de module schrijft nergens en stuurt niemand iets', () => {
  /* DE BELANGRIJKSTE TOETS. Een spellaag die zelf gaat sturen kan een mens
     buiten het spel om bereiken, en dan is "mag dit bericht" op twee plekken
     beantwoord. routes/member/werk.js kneep daar al op. */
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/tijdlijn.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/'[^']*'/g, "''");
  /* `push` staat er niet bij: dat is de Array-methode waarmee de lijst wordt
     opgebouwd. Wat hier gescand wordt zijn de namen waarmee je in deze kern
     werkelijk iets naar buiten stuurt. */
  for (const woord of ['chatStuur', 'gesprekMaak', 'nudge', 'sse', 'webpush', 'save(',
    'mail', 'webhook', 'zijnVrienden', 'db.', 'fetch('])
    assert.ok(!bron.includes(woord), 'tijdlijn.js doet aan ' + woord);
  /* En hij verandert de staat niet: hem twee keer vragen geeft twee keer
     hetzelfde, en de staat is er niet door bewogen. */
  const { m, p, maand } = opstelling();
  maand(30);
  const voor = JSON.stringify(p.staat);
  const a = m.eco.tijdlijn(p), b = m.eco.tijdlijn(p);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(p.staat), voor, 'kijken verandert niets');
});

test('hij weet niet wie er praat, en kan dus geen lijn openen', () => {
  const { m, p } = opstelling();
  /* Een tijdlijn neemt een POTJE en geen speler. Zou er een lezer in gaan, dan
     is hij te personaliseren en is de volgende stap "stuur het hem even". */
  assert.equal(m.eco.tijdlijn.length, 1, 'tijdlijn(potje) -- geen tweede argument');
});

/* ================= 3. alleen wat al publiek is ================= */

test('er staat geen kas, geen omzet en geen vermogen in', () => {
  const { m, p, maand } = opstelling();
  maand(40);
  m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'boris' });
  const rijen = m.eco.tijdlijn(p);
  assert.ok(rijen.length >= 2, 'er is wat gebeurd: ' + rijen.length);
  const tekst = JSON.stringify(rijen);
  assert.ok(!/\d{4,}/.test(tekst), 'geen bedragen: ' + tekst);
  for (const woord of ['geld', 'omzet', 'vermogen', 'winst', 'kas', 'loon'])
    assert.ok(!tekst.includes(woord), 'de tijdlijn noemt ' + woord);
  /* Op codenaam, want zo kent de tafel elkaar. */
  assert.ok(tekst.includes('CN-anna'));
  assert.ok(!/"anna"|\banna\b/.test(tekst.replace(/CN-anna/g, '')), 'geen handles: ' + tekst);
});

test('een contract tussen twee anderen is niemands nieuws', () => {
  const { m, p, st, maand } = opstelling();
  maand(6);
  const c = m.eco.zet(p, 'boris', { actie: 'contract-voorstel', soort: 'levering',
    aan: 'chris', vestiging: st.vestigingen.boris[0].id,
    tegenVestiging: st.vestigingen.chris[0].id, prijs: 1000, hoeveelheid: 5, looptijd: 12 });
  const tekst = JSON.stringify(m.eco.tijdlijn(p));
  assert.ok(!tekst.includes('contract'), 'iemands boeken zijn niet van jou: ' + tekst);
});

/* ================= 4 en 5. gerekend, en voor iedereen gelijk ================= */

test('hij wordt gerekend uit de staat en niet bijgehouden', () => {
  const a = opstelling(), b = opstelling();
  a.maand(40);
  for (let i = 0; i < 40; i++) b.maand(1);
  assert.deepEqual(a.m.eco.tijdlijn(a.p), b.m.eco.tijdlijn(b.p),
    'veertig maanden in een keer geven dezelfde tijdlijn als veertig los');
  /* En er staat geen tijdlijn in de staat: hij is nergens opgeslagen. */
  assert.ok(!('tijdlijn' in a.st) && !('tijdlijnLog' in a.st));
});

test('hij loopt op de maand, oudste eerst', () => {
  const { m, p, maand } = opstelling();
  maand(40);
  m.eco.zet(p, 'anna', { actie: 'uitstappen' });
  const rijen = m.eco.tijdlijn(p);
  const maanden = rijen.map(r => r.maand);
  assert.deepEqual(maanden.slice().sort((x, y) => x - y), maanden, 'op volgorde: ' + maanden);
  assert.equal(rijen[rijen.length - 1].soort, 'uitstap', 'het laatste is het laatst gebeurd');
});

test('wie de tafel verliet staat erop, met of zonder opvolger', () => {
  const { m, p, maand } = opstelling();
  maand(10);
  m.eco.zet(p, 'anna', { actie: 'uitstappen', naar: 'boris' });
  m.eco.zet(p, 'chris', { actie: 'uitstappen' });
  const zinnen = m.eco.tijdlijn(p).filter(r => r.soort === 'uitstap').map(r => r.zin);
  assert.equal(zinnen.length, 2);
  assert.ok(zinnen.some(z => /CN-anna.*CN-boris.*verder/.test(z)), zinnen.join(' | '));
  assert.ok(zinnen.some(z => /CN-chris.*afgewikkeld|CN-chris.*wikkelde/.test(z)), zinnen.join(' | '));
});

test('wat de Foundation bouwde staat erop, met de buurt erbij', () => {
  const { m, p, maand } = opstelling();
  maand(40);
  const f = m.eco.tijdlijn(p).filter(r => r.soort === 'foundation');
  assert.ok(f.length >= 1, 'er is echt gebouwd');
  for (const r of f) {
    assert.match(r.zin, /gebouwd in /);
    assert.equal(typeof r.maand, 'number', 'zonder datum hoort het niet op een tijdlijn');
  }
});

/* ================= 6. geen wereldnieuws ================= */

test('het wereldnieuws staat er niet in, en er komt geen log voor', () => {
  /* ./nieuws.js REKENT het per maand uit een hash op de partij-id. Een tweede
     voorraad naast een deterministische som is een tweede waarheid. */
  const { m, p, st, maand } = opstelling();
  maand(40);
  assert.ok(!('nieuwsLog' in st), 'er hoort geen nieuwslog te ontstaan');
  assert.ok(!m.eco.tijdlijn(p).some(r => r.soort === 'nieuws'));
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/tijdlijn.js'), 'utf8');
  assert.match(bron, /geen log/, 'en de reden staat erbij');
});

test('een lege campagne geeft een lege tijdlijn en geen fout', () => {
  const { m, p } = opstelling();
  assert.deepEqual(m.eco.tijdlijn(p), []);
});
