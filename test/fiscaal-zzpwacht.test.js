/* DE ZZP-REGIMES PER INGANGSDATUM.

   De landentabel stond al per jaargang vast; de zzp-tabel niet, en daardoor
   rekende de zzp-tool elk jaar met de tarieven van nu. Vijf beweringen:

   1. MET EEN VASTGELEGDE JAARGANG rekent een ander jaar met de regels van dat
      jaar, en dat is een ANDER BEDRAG -- anders bewijst de toets niets.
   2. ZONDER JAARGANG VOOR DAT JAAR komt er geen vals teruggerekend antwoord
      maar een waarschuwing. Dit is de valkuil waar de eerste versie in liep:
      regimeOp geeft altijd iets terug (de basis), en dat doorgeven als "de
      regels van 2023" is precies de schijnzekerheid die hier weg moest.
   3. DE SCHIJVENTABEL WORDT ALS GEHEEL VERVANGEN en nooit samengevoegd, en
      Infinity in de bovenste schijf overleeft de basiskopie. Dat laatste was
      stuk: de kopie liep door JSON en maakte er `null` van, waarna de
      toptariefschijf geen inkomen meer kreeg toegewezen.
   4. DE KEURING WEIGERT het onmogelijke: een aftrek van een miljoen, een
      tarief boven de honderd procent, een schijventabel die niet oploopt.
   5. DE HEFFINGSKORTINGEN ZIJN GENEST en worden per veld samengevoegd.

   Draai los: node --experimental-sqlite --test test/fiscaal-zzpwacht.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { ZZP, FISCAAL_PEILJAAR } = require('../server/kern/fiscaal');
const { diep } = require('../server/kern/fiscaal/jaargangen-tijdlijn');

/* Elke opstelling krijgt een verse db. De wacht projecteert op de GEDEELDE
   ZZP-tabel, dus wat een toets doorvoert moet daarna terug -- anders rekenen de
   volgende toetsen in dit proces met een tabel die hier is verzet. */
const SCHOON = diep(ZZP);
function opstelling() {
  for (const cc of Object.keys(ZZP)) ZZP[cc] = diep(SCHOON[cc]);
  const db = { data: {} };
  return require('../server/kern/fiscaal/zzpwacht')({ db, save: () => {}, peiljaar: FISCAAL_PEILJAAR }).zzpwacht;
}
test.after(() => { for (const cc of Object.keys(ZZP)) ZZP[cc] = diep(SCHOON[cc]); });

test('met een vastgelegde jaargang rekent een ander jaar met de regels van dat jaar', () => {
  const w = opstelling();
  const nu = w.bereken('NL', 60000, { urencriterium: true });
  assert.equal(nu.jaar, FISCAAL_PEILJAAR);
  assert.equal(nu.teruggehaald, false);

  const r = w.pasToe({ landen: { NL: { zelfstandigenaftrek: 5030, mkbVrijstelling: 0.14 } } },
    'kantoor', 'zzp-2023', { geldigVanaf: '2023-01-01', rechtsgrond: 'Belastingplan 2023' });
  assert.equal(r.landen, 1);

  const toen = w.bereken('NL', 60000, { urencriterium: true, jaar: 2023 });
  assert.equal(toen.teruggehaald, true, 'hij heeft de regels van dat jaar gebruikt');
  assert.ok(!toen.buitenPeiljaar, 'en waarschuwt dus niet');
  assert.ok(toen.belasting < nu.belasting,
    'een hogere aftrek en vrijstelling geven een lagere aanslag: ' + toen.belasting + ' < ' + nu.belasting);
  assert.match(toen.regels[toen.regels.length - 1], /tarieven van 2023/, 'de slotzin noemt het juiste jaar');
});

test('zonder jaargang voor dat jaar komt er geen vals teruggerekend antwoord', () => {
  const w = opstelling();
  const zonder = w.bereken('NL', 60000, { urencriterium: true, jaar: 2023 });
  assert.equal(zonder.buitenPeiljaar, true);
  assert.ok(!zonder.teruggehaald);
  assert.match(zonder.regels[0], /geen vastgelegde jaargang/i);

  // een jaargang van 2023 zegt niets over 2022
  w.pasToe({ landen: { NL: { zelfstandigenaftrek: 5030 } } }, 'kantoor', 'z', { geldigVanaf: '2023-01-01' });
  assert.equal(w.bereken('NL', 60000, { urencriterium: true, jaar: 2022 }).buitenPeiljaar, true,
    'de tijdlijn zegt niets over 2022, dus wordt er niets beweerd');
  assert.ok(!w.bereken('NL', 60000, { urencriterium: true, jaar: 2023 }).buitenPeiljaar);
});

test('de schijventabel wordt als geheel vervangen, en Infinity overleeft de basis', () => {
  const w = opstelling();
  // de bovenste schijf is open: [Infinity, tarief]
  assert.equal(SCHOON.NL.schijven[SCHOON.NL.schijven.length - 1][0], Infinity,
    'de basistabel houdt Infinity vast');
  assert.equal(w.regimeOp('NL', '2026-01-01').schijven[2][0], Infinity,
    'en een teruggehaald regime ook -- de kopie loopt niet door JSON');

  w.pasToe({ landen: { NL: { schijven: [[40000, 0.36], [null, 0.50]] } } }, 'kantoor', 's', { geldigVanaf: '2027-01-01' });
  const na = w.regimeOp('NL', '2027-06-01');
  assert.equal(na.schijven.length, 2, 'twee schijven, niet drie: de tabel is vervangen en niet samengevoegd');
  assert.equal(na.schijven[1][0], Infinity, 'een open bovenste schijf mag als null binnenkomen');
  // en ervoor gold de oude tabel nog
  assert.equal(w.regimeOp('NL', '2026-12-31').schijven.length, 3);
});

test('de keuring weigert het onmogelijke', () => {
  const w = opstelling();
  const voor = diep(ZZP.NL);
  const slecht = w.pasToe({ landen: {
    NL: { zelfstandigenaftrek: 1000000, mkbVrijstelling: 3, korGrens: -5, onzin: 'x' },
    XX: { zelfstandigenaftrek: 100 } } }, 'kantoor', 'fout');
  assert.equal(slecht.landen, 0, 'buiten bereik, onbekende velden en onbekende landen doen niets');
  assert.deepEqual(ZZP.NL, voor, 'de tabel is onaangeroerd');

  // een schijventabel die niet oploopt, of met een open schijf in het midden
  assert.equal(w.pasToe({ landen: { NL: { schijven: [[50000, 0.3], [20000, 0.4]] } } }, 'kantoor').landen, 0,
    'grenzen moeten oplopen');
  assert.equal(w.pasToe({ landen: { NL: { schijven: [[null, 0.3], [50000, 0.4]] } } }, 'kantoor').landen, 0,
    'alleen de bovenste schijf mag open zijn');
  assert.equal(w.pasToe({ landen: { NL: { schijven: [[50000, 1.4]] } } }, 'kantoor').landen, 0,
    'een tarief boven de honderd procent bestaat niet');
});

test('de heffingskortingen zijn genest en worden per veld samengevoegd', () => {
  const w = opstelling();
  const voor = diep(ZZP.NL.ahk);
  w.pasToe({ landen: { NL: { ahk: { max: 3200 } } } }, 'kantoor', 'k', { geldigVanaf: '2026-01-01' });
  const na = w.regimeOp('NL', '2026-06-01');
  assert.equal(na.ahk.max, 3200, 'het gewijzigde veld');
  assert.equal(na.ahk.afbouwVanaf, voor.afbouwVanaf, 'de rest van de korting blijft staan');
  assert.equal(na.ahk.afbouw, voor.afbouw);

  const g = w.geschiedenis('NL', 'ahk');
  assert.equal(g.length, 1);
  assert.equal(g[0].vorige.ahk.max, voor.max, 'en hij weet wat hij verving');
});
