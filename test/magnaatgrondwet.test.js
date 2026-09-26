/* De ratel onder MAGNAAT.md: economische integriteit in Magnaat kan vanaf de
   nulstand alleen nog verbeteren.

   MAGNAATGRONDWET.json is de bevroren nulstand (npm run magnaat:grondwet --
   --vastleggen). Deze toets meet VERS en eist:
     - niet meer VIOLATION-regels en niet meer schendende plekken dan de nulstand
     - niet minder PASS-regels en niet minder afgedwongen regels
     - geen enkele regel zakt, en geen regel verdwijnt
     - elk citaat en elke toets in de verklaring wordt ook echt gevonden
     - het regeldeel van MAGNAAT.md is gelijk aan wat de meter nu zou schrijven
   Achteruitgaan kan alleen door de nulstand opnieuw vast te leggen, en dat is
   een zichtbare wijziging in de diff (MAGNAAT.md par. 5).

   scripts/lib/metingen.js wijst dit bestand aan als eigenRatel van
   MAGNAATGRONDWET.json. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { meet, STANDEN, documentBlok, blokUitDocument, DOCUMENT } = require('../scripts/magnaatgrondwet');

const WORTEL = path.join(__dirname, '..');
const RANG = Object.fromEntries(STANDEN.map((s, i) => [s, i])); // VIOLATION 0 .. PASS 3
const nulstand = () => JSON.parse(fs.readFileSync(path.join(WORTEL, 'MAGNAATGRONDWET.json'), 'utf8'));
const nu = meet();

test('de nulstand bestaat en draagt een stempel', () => {
  const n = nulstand();
  assert.ok(n.stempel && n.stempel.commit, 'MAGNAATGRONDWET.json mist zijn stempel');
  assert.equal(n.regels, n.perRegel.length);
});

test('er komen geen schendingen bij', () => {
  const n = nulstand();
  assert.ok(nu.telling.VIOLATION <= n.telling.VIOLATION,
    'VIOLATION ging van ' + n.telling.VIOLATION + ' naar ' + nu.telling.VIOLATION);
  assert.ok(nu.schendingen <= n.schendingen,
    'schendende plekken gingen van ' + n.schendingen + ' naar ' + nu.schendingen +
    ' -- zie npm run magnaat:grondwet -- --json voor de plekken');
});

test('PASS en afgedwongen dalen nooit', () => {
  const n = nulstand();
  assert.ok(nu.telling.PASS >= n.telling.PASS, 'PASS ging van ' + n.telling.PASS + ' naar ' + nu.telling.PASS);
  assert.ok(nu.vier.afgedwongen >= n.vier.afgedwongen,
    'afgedwongen ging van ' + n.vier.afgedwongen + ' naar ' + nu.vier.afgedwongen);
});

test('geen enkele regel zakt en geen regel verdwijnt', () => {
  const huidig = new Map(nu.perRegel.map(r => [r.id, r]));
  for (const oud of nulstand().perRegel) {
    const r = huidig.get(oud.id);
    assert.ok(r, oud.id + ' staat in de nulstand en niet meer in de verklaring');
    assert.ok(RANG[r.stand] >= RANG[oud.stand], oud.id + ' zakte van ' + oud.stand + ' naar ' + r.stand +
      '. Achteruit mag alleen als constitutionele wijziging: leg de nulstand opnieuw vast, met een reden.');
  }
});

test('elk citaat en elke toets in de verklaring wordt gevonden', () => {
  const missers = [];
  for (const r of nu.perRegel) for (const [naam, sc] of Object.entries(r.scopes)) {
    for (const m of sc.missers) missers.push(r.id + ' ' + naam + ': ' + m);
  }
  assert.deepEqual(missers, [], 'de verklaring beweert iets wat niet (meer) waar is');
});

test('het regeldeel van MAGNAAT.md volgt de meting', () => {
  const tekst = fs.readFileSync(path.join(WORTEL, DOCUMENT), 'utf8');
  const blok = blokUitDocument(tekst);
  assert.ok(blok, DOCUMENT + ' mist de merktekens van het gegenereerde deel');
  assert.equal(blok, documentBlok(nu), DOCUMENT + ' loopt achter. Draai: npm run magnaat:grondwet -- --document');
  for (const r of nu.perRegel) assert.ok(r.gedocumenteerd, r.id + ' staat niet woordelijk in ' + DOCUMENT);
});

test('de ratel draagt meer dan wat ergens afgedwongen wordt: ABSENT en VIOLATION staan erin', () => {
  /* Een grondwet die alleen noemt wat al werkt, is een brochure. */
  assert.ok(nu.telling.ABSENT + nu.telling.VIOLATION > 0);
});

/* DE METER SLAAT UIT. LAT.md regel 10: een meter die je niet hebt zien
   uitslaan, meet niets. Op een nagebouwde boom met een verklaring waarvan de
   uitkomst vaststaat. */
test('de meter slaat uit op commentaar, op een lege toets en op een schending', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grondwet-'));
  try {
    fs.mkdirSync(path.join(tmp, 'mot'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'mot/a.js'),
      '/* weiger(x) staat hier alleen in commentaar */\nfunction boek() { return 1; }\nsaldo[h] += 5;\n');
    fs.writeFileSync(path.join(tmp, 'mot/bord.js'), 'saldo[h] += 200;\n');
    fs.writeFileSync(path.join(tmp, 't.test.js'), "test('boekt in balans', () => { assert.ok(true); });\n");
    fs.writeFileSync(path.join(tmp, DOCUMENT), 'X-001 Iets is waar.\n');
    const regel = (id, sc) => ({ id, familie: 'M-0', invariant: 'Iets is waar.', scope: { world: sc }, migratie: '', faalwijze: '' });
    const wet = { FAMILIES: { 'M-0': { naam: 'x' } }, REGELS: [
      regel('X-001', { autoriteit: '', handhaver: [{ bestand: 'mot/a.js', citaat: 'function boek()' }],
        toets: [{ bestand: 't.test.js', naam: 'boekt in balans' }] }),
      regel('X-002', { autoriteit: '', handhaver: [{ bestand: 'mot/a.js', citaat: 'weiger(x)' }],
        toets: [{ bestand: 't.test.js', naam: 'boekt in balans' }] }),
      regel('X-003', { autoriteit: '', handhaver: [{ bestand: 'mot/a.js', citaat: 'function boek()' }],
        toets: [{ bestand: 't.test.js', naam: 'boekt in balans', bewijst: 'debet === credit' }] }),
      regel('X-004', { autoriteit: '', handhaver: [{ bestand: 'mot/a.js', citaat: 'function boek()' }],
        toets: [{ bestand: 't.test.js', naam: 'boekt in balans' }],
        schending: { bestanden: { map: 'mot', zonder: ['bord.js'] }, patroon: '\\bsaldo\\s*\\[[^\\]]+\\]\\s*[-+]?=(?!=)', wat: 'x' } }),
      regel('X-005', { autoriteit: '', handhaver: 'NIEMAND', toets: 'NIEMAND' })
    ] };
    const m = meet({ wortel: tmp, wet });
    const stand = Object.fromEntries(m.perRegel.map(r => [r.id, r.stand]));
    assert.equal(stand['X-001'], 'PASS', 'een echte handhaver en toets');
    assert.equal(stand['X-002'], 'PARTIAL', 'een citaat dat alleen in commentaar staat, telt niet');
    assert.equal(stand['X-003'], 'PARTIAL', 'een toets met de goede naam die het ding niet controleert, telt niet');
    assert.equal(stand['X-004'], 'VIOLATION', 'een schending wint van handhaver en toets');
    assert.equal(m.perRegel.find(r => r.id === 'X-004').schendingen, 1, 'het uitgesloten bestand telt niet mee');
    assert.equal(stand['X-005'], 'ABSENT', 'NIEMAND is ABSENT');
    assert.ok(m.perRegel.find(r => r.id === 'X-001').gedocumenteerd);
    assert.ok(!m.perRegel.find(r => r.id === 'X-002').gedocumenteerd, 'een id dat niet in het document staat');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
