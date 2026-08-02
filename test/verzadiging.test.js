/* De verzadigingspoort van scripts/tot-crash.js (scripts/lib/verzadiging.js).

   Deze poort bestaat omdat het crashharnas urenlang het verkeerde heeft
   gemeten: het verdubbelde het aantal werkers, de doorvoer stortte in omdat de
   CLIENT vastliep, en het bleef "ronde gehaald" melden voor rondes waarin tien
   verzoeken werden gedaan. De toets hieronder legt precies dat scenario vast --
   met de cijfers uit de zware run van 2 augustus 2026 -- plus alle gevallen
   waarin de poort JUIST NIET mag afgaan, want een poort die overal afgaat maakt
   de meting net zo waardeloos als een poort die nooit afgaat.

   Draai los: node --test test/verzadiging.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { beoordeelRonde, LUS_RUSTIG_MS } = require('../scripts/lib/verzadiging');

/* Een rustige, ingezakte ronde: doorvoer weg, server ontspannen. */
const STIL = { werkers: 4000, req: 10, shed: 0, fault: 0, heap: 30, lusMs: 12 };
const CTX = { piekReq: 15405, heapBasis: 30, vorigeWerkers: 4000 };

test('een ingezakte ronde met een rustige server = client verzadigd', () => {
  const u = beoordeelRonde(STIL, CTX);
  assert.equal(u.oordeel, 'verzadigd');
  assert.match(u.reden, /client is de rem/);
});

test('een volle ronde telt gewoon als druk', () => {
  const u = beoordeelRonde({ werkers: 8, req: 15405, shed: 93, fault: 0, heap: 30, lusMs: 40 }, { piekReq: 15405, heapBasis: 30, vorigeWerkers: null });
  assert.equal(u.oordeel, 'druk');
});

test('de eerste ronde kan nooit verzadigd zijn: er is nog geen piek', () => {
  const u = beoordeelRonde({ werkers: 8, req: 3, shed: 0, fault: 0, heap: 30, lusMs: 0 }, { piekReq: 0, heapBasis: null, vorigeWerkers: null });
  assert.equal(u.oordeel, 'druk');
  assert.match(u.reden, /nog geen piek/);
});

/* ---------- de vier manieren waarop de server zich verraadt ---------- */

test('afworp (503) bewijst dat de druk WEL aankwam', () => {
  const u = beoordeelRonde({ ...STIL, shed: 2 }, CTX);
  assert.equal(u.oordeel, 'druk');
  assert.match(u.reden, /verdedigde zich/);
});

test('serverfouten bewijzen dat de druk WEL aankwam', () => {
  const u = beoordeelRonde({ ...STIL, fault: 1 }, CTX);
  assert.equal(u.oordeel, 'druk');
});

test('een stilstaande event-loop wijst de server aan als rem, niet de client', () => {
  const u = beoordeelRonde({ ...STIL, lusMs: LUS_RUSTIG_MS + 1 }, CTX);
  assert.equal(u.oordeel, 'druk');
  assert.match(u.reden, /rem zit bij de server/);
});

test('een oplopende heap wijst de server aan als rem', () => {
  const u = beoordeelRonde({ ...STIL, heap: 90 }, CTX);
  assert.equal(u.oordeel, 'druk');
  assert.match(u.reden, /heap liep op/);
});

test('minder werkers dan de vorige ronde verklaart de inzakking zelf', () => {
  const u = beoordeelRonde({ ...STIL, werkers: 100 }, { ...CTX, vorigeWerkers: 4000 });
  assert.equal(u.oordeel, 'druk');
  assert.match(u.reden, /minder gevraagd/);
});

/* ---------- LAT.md regel 3: een ontbrekende meting mag nooit als goed doorgaan ---------- */

test('zonder heapmeting is het oordeel ONZEKER, niet verzadigd en niet druk', () => {
  const u = beoordeelRonde({ ...STIL, heap: null }, CTX);
  assert.equal(u.oordeel, 'onzeker');
  assert.match(u.reden, /niet te meten/);
});

test('zonder loopmeting is het oordeel ONZEKER', () => {
  const u = beoordeelRonde({ ...STIL, lusMs: null }, CTX);
  assert.equal(u.oordeel, 'onzeker');
  assert.match(u.reden, /event-loop/);
});

/* ---------- de bedrading ----------
   Een poort die niet is aangesloten is geen poort. Deze module is los prima te
   toetsen, maar de bug zat in het harnas, en het harnas is te traag om in de
   suite te draaien. Daarom hier de twee dingen die in scripts/tot-crash.js waar
   moeten blijven: dat hij het oordeel OPHAALT, en dat zijn slotregel het
   AANGEKOMEN aantal noemt en niet het gevraagde. */

test('tot-crash.js gebruikt de verzadigingspoort en meldt de druk die aankwam', () => {
  const bron = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'scripts', 'tot-crash.js'), 'utf8');
  assert.match(bron, /require\('\.\/lib\/verzadiging'\)/, 'het harnas hoort het ronde-oordeel op te halen');
  assert.match(bron, /beoordeelRonde\(\{ werkers, req, shed, fault, heap, lusMs \}/, 'elke ronde hoort langs het oordeel te gaan');
  const slot = bron.slice(bron.indexOf('GEEN harde crash'));
  assert.match(slot, /nl\(piekDrukWerkers\)/, 'de slotregel hoort de AANGEKOMEN werkers te noemen');
  assert.doesNotMatch(slot.split('\n')[0], /nl\(piekWerkers\)|nl\(totaalReq\)/, 'de slotregel mag niet het gevraagde aantal claimen; daar zat de leugen');
});

/* ---------- de reeks die de bug aantoonde ---------- */

test('de reeks van 2 augustus: acht rondes druk, daarna meet het harnas zichzelf', () => {
  /* De kolommen werkers/req/shed/heap komen letterlijk uit de zware run van
     2 augustus 2026 (24 rondes x 12 s, cap 4.000 werkers). De kolom lusMs stond
     er toen niet in -- die meter is naar aanleiding van deze uitslag gebouwd --
     dus die is hier gezet op wat de toets ONDERZOEKT: een server die rustig is.
     Dat is een aanname van de toets, geen meting van toen. */
  const reeks = [
    { werkers: 8, req: 15405, shed: 93, heap: 30 },
    { werkers: 16, req: 11447, shed: 77, heap: 32 },
    { werkers: 32, req: 7604, shed: 30, heap: 32 },
    { werkers: 64, req: 3524, shed: 17, heap: 32 },
    { werkers: 128, req: 1518, shed: 1, heap: 32 },
    { werkers: 256, req: 393, shed: 4, heap: 31 },
    { werkers: 512, req: 419, shed: 3, heap: 31 },
    { werkers: 1024, req: 272, shed: 2, heap: 30 },
    { werkers: 2048, req: 202, shed: 0, heap: 31 },
    { werkers: 4000, req: 109, shed: 0, heap: 31 },
    { werkers: 4000, req: 51, shed: 0, heap: 30 },
    { werkers: 4000, req: 39, shed: 0, heap: 30 }
  ];
  let piekReq = 0, heapBasis = null, vorigeWerkers = null;
  const oordelen = [];
  for (const r of reeks) {
    if (heapBasis == null) heapBasis = r.heap;
    const u = beoordeelRonde({ ...r, fault: 0, lusMs: 15 }, { piekReq, heapBasis, vorigeWerkers });
    vorigeWerkers = r.werkers;
    if (u.oordeel === 'druk' && r.req > piekReq) piekReq = r.req;
    oordelen.push(u.oordeel);
  }
  assert.deepEqual(oordelen.slice(0, 8), Array(8).fill('druk'), 'de eerste acht rondes zetten wel degelijk druk');
  assert.deepEqual(oordelen.slice(8), Array(4).fill('verzadigd'), 'vanaf ronde 9 meet het harnas zijn eigen client');
  /* En dit is het getal dat het harnas had moeten melden in plaats van
     "24 / 24 rondes gehaald, geen crash t/m 4.000 werkers". */
  assert.equal(oordelen.filter(o => o === 'druk').length, 8);
});
