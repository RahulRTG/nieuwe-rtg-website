/* MAGNAAT: HET BALANSLAB -- meet het wat het zegt te meten?

   Een meetopstelling is zelf software, en een kapotte meter is duurder dan geen
   meter: hij geeft een getal en je gelooft het. Dit bestand toetst het lab en
   niet het spel. Zeven beweringen:

   1. DE OPSOMMING HERHAALT ZICH NIET. Vraag je er duizend, dan krijg je duizend
      VERSCHILLENDE campagnes, of er komen er zoveel als er bestaan.
   2. DE WERELD DOET ER WERKELIJK TOE. Een andere partij-id is een andere
      conjunctuur, een andere krant en andere branden.
   3. DE DRAWDOWN MEET DE VAL EN NIET DE EINDSTAND.
   4. DOMINANTIE MOET TOT HET EIND WORDEN VASTGEHOUDEN.
   5. DE COUNTER KOMT UIT ONTMOETINGEN EN NIET UIT WINST.
   6. INSOLVENTIE WORDT ONDERWEG GEMETEN, niet aan het eind.
   7. EEN MEETOPSTELLING LAAT NIETS ACHTER. De proefstijlen van de sectorproef
      staan na afloop niet in de profielenlijst van de strateeg.

   Draai los: node --experimental-sqlite --test test/spellab.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const L = require('../scripts/magnaat-lab');
const S = require('../scripts/magnaat-strateeg');

const sleutel = (c) => c.tafel + '|' + c.wereld + '|' + c.opstelling + '|' + c.namen.join(',');

/* ================= 1. de opsomming herhaalt zich niet ================= */

test('elke gevraagde campagne is een andere campagne', () => {
  /* DE FOUT DIE HIER DICHTGAAT. De eerste opsomming liet zijn vier assen zo
     doorlopen dat de reeks na 144 campagnes rondliep: een run van driehonderd
     speelde er honderdvierenveertig, tweemaal, en meldde er driehonderd. */
  for (const n of [12, 48, 300, 1000]) {
    const lijst = L.opzet(n);
    assert.equal(lijst.length, Math.min(n, L.RUIMTE), 'aantal bij ' + n);
    assert.equal(new Set(lijst.map(sleutel)).size, lijst.length, 'allemaal uniek bij ' + n);
  }
});

test('boven de ruimte houdt hij op in plaats van te herhalen', () => {
  const alles = L.opzet(L.RUIMTE * 3);
  assert.equal(alles.length, L.RUIMTE);
  assert.equal(new Set(alles.map(sleutel)).size, L.RUIMTE);
});

test('een kleine run raakt alle tafelgroottes en alle stijlen', () => {
  /* Waarom de volgorde van de assen ertoe doet: wie er honderd draait hoort
     niet drie keer dezelfde tafel te krijgen. */
  const lijst = L.opzet(48);
  assert.deepEqual([...new Set(lijst.map(c => c.tafel))].sort(), [...L.TAFELS].sort());
  const gezien = new Set(lijst.flatMap(c => c.namen));
  for (const naam of L.POOL) assert.ok(gezien.has(naam), naam + ' komt niet aan tafel in 48 campagnes');
});

/* ================= 2. de wereld doet er werkelijk toe ================= */

test('een andere wereld is een andere campagne', () => {
  /* DE REDEN DAT DIT LAB BESTAAT. Het toernooi speelde al zijn campagnes onder
     partij-id 'p'; uit die id komen de conjunctuur, de krant, de risico's en de
     onderzoeksuitkomsten. Alle achthonderd campagnes deelden dus EEN weer, en
     aan de uitslag was niet te zien of een winnaar een sterke stijl had of goed
     weer. Draai `wereld` uit `veld` weg en deze toets valt om. */
  const namen = ['horeca', 'mobility', 'onderhoud'];
  const uitslagen = ['w0', 'w1', 'w2', 'w3', 'w4', 'w5']
    .map(w => S.veld(namen, 0, 24, w).stand.map(x => Math.round(x.vermogen)).join(','));
  assert.ok(new Set(uitslagen).size > 1,
    'zes werelden geven dezelfde partij: ' + uitslagen[0]);
});

test('dezelfde wereld geeft dezelfde partij', () => {
  // deterministisch, zoals alles in deze map; anders is een afwijking geen bevinding
  const a = S.veld(['horeca', 'mobility'], 1, 18, 'w3').stand.map(x => x.vermogen);
  const b = S.veld(['horeca', 'mobility'], 1, 18, 'w3').stand.map(x => x.vermogen);
  assert.deepEqual(a, b);
});

/* ================= 3, 4, 6: de meters op verzonnen invoer ================= */

const reeksVan = (getallen) => getallen.map(v => ({ a: { vermogen: v }, b: { vermogen: 100 } }));

test('de drawdown is de diepste val vanaf de eigen top', () => {
  assert.equal(L.drawdown(reeksVan([100, 200, 100, 400]), 'a'), 0.5);
  assert.equal(L.drawdown(reeksVan([100, 200, 300, 400]), 'a'), 0, 'wie alleen stijgt valt niet');
  /* En de eindstand zegt het niet: deze twee eindigen gelijk en hadden een
     totaal verschillende campagne. Dat is precies wat deze meter toevoegt. */
  assert.ok(L.drawdown(reeksVan([100, 400, 40, 400]), 'a')
    > L.drawdown(reeksVan([100, 200, 300, 400]), 'a'));
});

test('dominant ben je pas als je het tot het eind volhoudt', () => {
  // 'a' tegen een vaste 100 van 'b': boven de 100 heeft hij meer dan de helft
  assert.equal(L.dominantieVanaf(reeksVan([50, 50, 300, 400, 500]), 'a'), 3);
  assert.equal(L.dominantieVanaf(reeksVan([500, 500, 50, 50]), 'a'), null,
    'wie het kwijtraakt was aan het winnen en niet dominant');
  assert.equal(L.dominantieVanaf(reeksVan([50, 50, 50]), 'a'), null);
});

test('insolventie telt onderweg en niet alleen aan het eind', () => {
  /* Deze economie kent geen faillissement: wie onder nul zakt gaat rood staan.
     Wat hier gemeten wordt is dus dat het vermogen negatief WERD, ook als het
     daarna weer goed kwam -- want dat is een heel andere campagne dan een die
     nooit onder water stond, ook bij dezelfde eindstand. */
  const rijen = reeksVan([100, -20, 100, 400]);
  assert.ok(rijen.some(r => r.a.vermogen <= 0));
  assert.equal(rijen[rijen.length - 1].a.vermogen, 400, 'en hij eindigt gewoon in de plus');
});

/* ================= 5. de counter komt uit ontmoetingen ================= */

test('wie elkaar nooit tegenkomt is elkaars tegenstijl niet', () => {
  /* Twee campagnes die elkaar niet raken: alfa verslaat beta, gamma verslaat
     delta. Zonder de ontmoetingsteller zou alfa "100% wint van gamma" melden
     op nul ontmoetingen, en dat is een verzonnen tegenstijl. */
  const rijen = [
    { campagne: 0, naam: 'alfa', tafel: 2, won: true, vermogen: 900, vestigingen: 3, drawdown: 0,
      insolvent: false, schuldDeel: 0, contractDeel: 0, concernDeel: 0, dominantVanaf: null, boven: [] },
    { campagne: 0, naam: 'beta', tafel: 2, won: false, vermogen: 100, vestigingen: 1, drawdown: 0,
      insolvent: false, schuldDeel: 0, contractDeel: 0, concernDeel: 0, dominantVanaf: null, boven: ['alfa'] },
    { campagne: 1, naam: 'gamma', tafel: 2, won: true, vermogen: 900, vestigingen: 3, drawdown: 0,
      insolvent: false, schuldDeel: 0, contractDeel: 0, concernDeel: 0, dominantVanaf: null, boven: [] },
    { campagne: 1, naam: 'delta', tafel: 2, won: false, vermogen: 100, vestigingen: 1, drawdown: 0,
      insolvent: false, schuldDeel: 0, contractDeel: 0, concernDeel: 0, dominantVanaf: null, boven: ['gamma'] }
  ];
  const tabel = L.tel(rijen, 100);
  const beta = tabel.find(s => s.naam === 'beta');
  assert.equal(beta.counter, null, 'twee ontmoetingen is te weinig voor een uitspraak');
  assert.equal(beta.winrate, 0);
  assert.equal(tabel.find(s => s.naam === 'alfa').winrate, 1);
});

test('de keuring meet overwicht per tafel en niet over alles heen', () => {
  /* Dezelfde 40% is aan een tafel van twee onder het midden en aan een tafel van
     zes een monopolie. Een keuring die dat niet scheidt, meldt het verkeerde. */
  const maak = (winPerTafel) => [{
    naam: 'proef', n: 60, winrate: 0.4, rendement: 3, drawdown: 0.1, ergsteDrawdown: 0.2,
    insolvent: 0, vestigingen: 4, schuldDeel: 0, contractDeel: 0, concernDeel: 0,
    domKans: 0, domMaand: null, counter: { naam: 'ander', deel: 0.9, n: 30 },
    perTafel: L.TAFELS.map((t, i) => ({ tafel: t, n: 20, winrate: winPerTafel[i] }))
  }];
  assert.equal(L.keur(maak([0.4, 0.2, 0.15])).length, 0, 'eerlijk verdeeld geeft geen klacht');
  const klachten = L.keur(maak([0.4, 0.9, 0.9]));
  assert.ok(klachten.some(k => k.includes('tafel van 4')), klachten.join(' | '));
  assert.ok(klachten.some(k => k.includes('tafel van 6')));
  assert.ok(!klachten.some(k => k.includes('tafel van 2')), 'aan een tafel van twee is 40% niets');
});

test('een stijl zonder tegenstijl is een bevinding', () => {
  const zonder = [{
    naam: 'proef', n: 60, winrate: 0.4, rendement: 3, drawdown: 0.1, ergsteDrawdown: 0.2,
    insolvent: 0, vestigingen: 4, schuldDeel: 0, contractDeel: 0, concernDeel: 0,
    domKans: 0, domMaand: null, counter: { naam: 'ander', deel: 0.1, n: 30 },
    perTafel: L.TAFELS.map(t => ({ tafel: t, n: 20, winrate: 1 / t }))
  }];
  assert.ok(L.keur(zonder).some(k => k.includes('geen tegenstijl')));
});

test('een sector die geen zaak opent is een bevinding, en zo ook de spreiding', () => {
  const sectoren = [{ sector: 'goud', vermogen: 9000000, vestigingen: 12, zones: ['a'] },
    { sector: 'lood', vermogen: 250000, vestigingen: 0, zones: ['b'] }];
  const klachten = L.keur([], sectoren);
  assert.ok(klachten.some(k => k.includes('lood') && k.includes('geen enkele zaak')));
  assert.ok(klachten.some(k => k.includes('36x') || k.includes('x de slechtste')));
  assert.equal(L.keur([], [{ sector: 'a', vermogen: 3000000, vestigingen: 8, zones: [] },
    { sector: 'b', vermogen: 1000000, vestigingen: 6, zones: [] }]).length, 0,
  'drie keer zoveel is een verschil en geen scheefheid');
});

/* ================= 7. een meetopstelling laat niets achter ================= */

test('de sectorproef schrijft geen stijlen in de profielenlijst', () => {
  /* Anders verandert een meting de tafel van iedereen die daarna in hetzelfde
     proces meet, en dan is de volgende uitslag afhankelijk van of dit lab
     toevallig eerder draaide. */
  const voor = Object.keys(S.PROFIELEN).length;
  const uit = L.sectorproef(2, 12);
  assert.equal(Object.keys(S.PROFIELEN).length, voor, 'PROFIELEN is niet gegroeid');
  assert.ok(!Object.keys(S.PROFIELEN).some(n => n.startsWith('proef-')));
  assert.ok(uit.length >= 7, 'alle sectoren zijn geprobeerd');
  for (const s of uit) assert.ok(s.zones.length, s.sector + ' hoort ergens thuis op de kaart');
});

test('elke sector wordt in zijn EIGEN buurten geprobeerd', () => {
  /* Uit de kaart en niet uit een lijst hier: welke sectoren in een zone
     thuishoren staat op de zone. Een tweede lijst gaat stil uit de pas lopen. */
  const { kaart } = require('../server/kern/spellen/magnaat/kaart');
  const k = kaart('ijmuiden');
  for (const s of L.sectorproef(1, 6))
    for (const z of s.zones)
      assert.ok(k.zone.get(z).sectoren.includes(s.sector), s.sector + ' hoort niet in ' + z);
});

/* ================= het geheel draait ================= */

test('het lab draait van begin tot eind en levert een leesbare tabel', () => {
  const r = L.draai(12, 18);
  assert.equal(r.campagnes, 12);
  assert.ok(r.tabel.length > 3, 'meerdere stijlen gemeten');
  for (const s of r.tabel) {
    assert.ok(s.n > 0);
    assert.ok(s.winrate >= 0 && s.winrate <= 1, s.naam + ' winrate ' + s.winrate);
    assert.ok(s.drawdown >= 0 && s.drawdown <= 1);
    assert.ok(Number.isFinite(s.rendement) && s.rendement >= 0, s.naam + ' rendement');
  }
  assert.ok(r.tabel.reduce((n, s) => n + s.winrate * s.n, 0) >= 12 - 0.5,
    'elke campagne heeft een winnaar');
  assert.ok(Array.isArray(r.klachten));
});
