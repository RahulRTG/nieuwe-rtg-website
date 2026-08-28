/* ============================================================================
   DE WOONPLAATS MAG NIET STIL VERDWIJNEN.

   De intake vraagt sinds de momenten geen adres meer (kern/onboarding.js). Dat is
   de bedoeling, maar er hing nog iets aan: het ledenregister van het kantoor
   toont leden PER STAD en haalt die stad uit het onboardingprofiel
   (kern/ledenregister.js regel 31: p.velden.woonplaats). De enige voeding van dat
   veld was de intake-vragenlijst. Zonder tegenmaatregel valt dus elk nieuw lid
   permanent in de bak "Onbekend", zonder dat er iets omvalt of iets meldt --
   precies de stille soort van LAT.md regel 5.

   test/ledenregister.test.js kan dat niet zien: die injecteert de profielen
   rechtstreeks en blijft dus groen terwijl de bron droogstaat. Deze toets zet
   daarom de ECHTE keten neer -- de onboarding-motor, de gegevenspoort, het
   gegevensgesprek en het ledenregister, alle vier de echte modules -- en meet aan
   het eind wat de boardroom te zien krijgt.

   En de tegenkant staat er ook in: er wordt NIETS verzonnen. Kunnen we de plaats
   niet met zekerheid uit de eigen zin van het lid halen, dan raden we niet maar
   vragen we hem, en een antwoord dat geen plaatsnaam is wordt niet geslikt.

   Draai los: node --test test/woonplaats-poort.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeCrypto = require('node:crypto');

const { maakOnboarding } = require('../server/kern/onboarding.js');
const { maakGegevenspoort } = require('../server/kern/gegevenspoort.js');
const { maakGegevensgesprek } = require('../server/kern/gegevensgesprek.js');
const maakLedenregister = require('../server/kern/ledenregister.js');

const schoon = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').slice(0, n || 200).trim();

/* De hele keten, met de echte modules aan elkaar. Alleen de accountlaag is
   nagebootst: die praat met sqlite en de kluis, en dat is hier niet wat we
   willen bewijzen. */
function keten() {
  const db = { data: {} };
  const dossiers = new Map();
  const telefoons = new Map();
  const accounts = {
    getMemberState: (id) => dossiers.get(id) || {},
    saveMemberState: (id, md) => dossiers.set(id, md),
    setPhone: (id, nr) => telefoons.set(id, nr),
    phoneOf: (u) => telefoons.get(u && u.id) || null,
    realNameOf: () => 'Vera Verhuis',
    emailOf: () => 'vera@voorbeeld.test',
    ledenRegisterRijen: () => [{ id: 7, key: 'user-7', tier: 'rtg', codename: 'Anemoon', geslacht: 'v', land: 'NL' }]
  };
  const onboarding = maakOnboarding({ db, save: () => {}, crypto: nodeCrypto, accounts, anthropic: null, schoon });
  const gegevenspoort = maakGegevenspoort({ accounts, getMemberState: accounts.getMemberState });
  const gesprek = maakGegevensgesprek({ accounts, gegevenspoort,
    saveMemberState: accounts.saveMemberState, getMemberState: accounts.getMemberState, schoon, onboarding });
  const { ledenregister } = maakLedenregister({ accounts, onboarding,
    geldPasprijzen: () => ({ passen: { rtg: { maandCenten: 6500 }, lifestyle: { maandCenten: 2000000 } } }),
    ledenAantal: () => 1 });
  const sessie = { key: 'user-7', tier: 'rtg', account: { id: 7, verified: '' } };
  return { db, accounts, onboarding, gesprek, ledenregister, sessie, dossiers };
}
// de stad zoals de boardroom hem ziet
const steden = (lr) => Object.fromEntries(lr.register().perStad.map(s => [s.naam, s.aantal]));

/* Het gesprek voor een bezorging tot en met het adres. Geeft alle beurten terug,
   zodat een toets kan nakijken wat er onderweg gevraagd is. */
function bezorging(k, antwoorden) {
  const s = k.gesprek.gegevensStart(k.sessie, 'bezorging');
  const beurten = [s];
  for (const a of antwoorden) beurten.push(k.gesprek.gegevensZeg(k.sessie, s.id, a));
  return beurten;
}

test('1. de intake vraagt de woonplaats niet meer -- dat is de aanleiding', () => {
  const k = keten();
  const st = k.onboarding.status('rtg', k.sessie);
  assert.equal(st.velden.some(v => v.id === 'woonplaats'), false, 'niet aan de voordeur');
  assert.equal(st.laterVelden.some(v => v.id === 'woonplaats'), true, 'wel als later-veld');
  assert.deepEqual(steden(k.ledenregister), { Onbekend: 1 }, 'en dus is de stad nog onbekend');
});

test('2. de adresstap van de poort schrijft de woonplaats mee, en de boardroom ziet hem', () => {
  const k = keten();
  const beurten = bezorging(k, ['0612345678', 'Keizersgracht 123, 1015 CJ Amsterdam']);
  assert.equal(beurten[1].veld, 'adres', 'na het nummer komt het adres');
  assert.equal(beurten[2].klaar, true, 'en daarna is het rond: ' + JSON.stringify(beurten[2]));

  // het bezorgadres staat waar het hoort: in het ledendossier
  assert.equal(k.accounts.getMemberState(7).adres, 'Keizersgracht 123, 1015 CJ Amsterdam');
  // en de stad staat in het onboardingprofiel, waar het ledenregister hem leest
  const st = k.onboarding.status('rtg', k.sessie);
  const woon = st.laterVelden.find(v => v.id === 'woonplaats');
  assert.equal(woon.waarde, 'Amsterdam', 'de woonplaats komt uit de zin die het lid zelf typte');
  assert.equal(woon.ingevuld, true);
  /* De echte bewering, want dit is wat er zonder deze reparatie stil verdween. */
  assert.deepEqual(steden(k.ledenregister), { Amsterdam: 1 }, 'de boardroom telt hem in Amsterdam');
});

test('3. zonder komma en zonder postcode: hij RAADT niet, hij vraagt het', () => {
  const k = keten();
  const s = k.gesprek.gegevensStart(k.sessie, 'bezorging');
  k.gesprek.gegevensZeg(k.sessie, s.id, '0612345678');
  const na = k.gesprek.gegevensZeg(k.sessie, s.id, 'Damstraat 5 Berlijn');
  assert.equal(na.klaar, undefined, 'het gesprek is nog niet rond');
  assert.equal(na.veld, 'adres');
  assert.match(na.tekst, /welke plaats/i, 'hij vraagt de plaats gewoon: ' + na.tekst);
  assert.deepEqual(steden(k.ledenregister), { Onbekend: 1 }, 'en tot dan staat er niets verzonnen in het register');

  // onzin wordt niet geslikt: een huisnummer is geen plaatsnaam
  const onzin = k.gesprek.gegevensZeg(k.sessie, s.id, '12345');
  assert.match(onzin.tekst, /geen plaatsnaam/i, onzin.tekst);
  assert.deepEqual(steden(k.ledenregister), { Onbekend: 1 });

  const klaar = k.gesprek.gegevensZeg(k.sessie, s.id, 'Berlijn');
  assert.equal(klaar.klaar, true, JSON.stringify(klaar));
  assert.deepEqual(steden(k.ledenregister), { Berlijn: 1 });
});

test('4. een buitenlandse postcode wordt niet tot een Nederlandse afgehakt', () => {
  /* Dit is de val uit de vorige ronde, een laag hoger: "10115 Berlin" mag nooit
     stilletjes 1011 (Amsterdam) worden. Wat we bewaren is een LETTERLIJK stuk
     van de zin van het lid of anders niets. */
  const k = keten();
  const s = k.gesprek.gegevensStart(k.sessie, 'bezorging');
  k.gesprek.gegevensZeg(k.sessie, s.id, '0612345678');
  const na = k.gesprek.gegevensZeg(k.sessie, s.id, 'Hauptstrasse 5, 10115 Berlin');
  assert.match(na.tekst, /welke plaats/i, 'geen gok op een Nederlandse postcode: ' + na.tekst);
  k.gesprek.gegevensZeg(k.sessie, s.id, 'Berlin');
  assert.deepEqual(steden(k.ledenregister), { Berlin: 1 });
  const woon = k.onboarding.status('rtg', k.sessie).laterVelden.find(v => v.id === 'woonplaats');
  assert.equal(woon.waarde, 'Berlin', 'precies wat het lid zei, niets bijgeschaafd');
});

test('5. een adres zonder postcode maar met komma levert de plaats gewoon op', () => {
  const k = keten();
  const beurten = bezorging(k, ['0612345678', 'Kerkstraat 12, Utrecht']);
  assert.equal(beurten[2].klaar, true, JSON.stringify(beurten[2]));
  assert.deepEqual(steden(k.ledenregister), { Utrecht: 1 });
});

test('6. wie halverwege afhaakt houdt zijn bezorgadres; alleen de stad blijft leeg', () => {
  /* Eerlijk gevolg van een afgebroken gesprek, en met opzet deze kant op: de
     bezorging heeft het adres nodig, het register alleen een facet. */
  const k = keten();
  const s = k.gesprek.gegevensStart(k.sessie, 'bezorging');
  k.gesprek.gegevensZeg(k.sessie, s.id, '0612345678');
  k.gesprek.gegevensZeg(k.sessie, s.id, 'Damstraat 5 Berlijn');   // vraagt de plaats
  k.gesprek.gegevensZeg(k.sessie, s.id, 'laat maar');
  assert.equal(k.accounts.getMemberState(7).adres, 'Damstraat 5 Berlijn', 'het adres staat er');
  assert.deepEqual(steden(k.ledenregister), { Onbekend: 1 }, 'de stad niet, en er is niets verzonnen');
});
