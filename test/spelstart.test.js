/* DE ECHTE START -- je begint als mens, niet als ondernemer.

   VERHAAL.md par. 0d. Het spel begon met 250.000 euro en een lege kaart, en
   daarmee spawnde iedereen als volwassen ondernemer. Dat is niet veiliger, het
   is alleen minder waar.

   Zeven beweringen, en ze zijn alle zeven stil terug te draaien:

   1. DE WERELD BESTAAT AL VOORDAT JIJ BINNENKOMT. AI-bedrijven draaien, en ze
      zoeken personeel.
   2. JIJ HEBT BIJNA NIETS. Geen bedrijf, en te weinig om er een te openen.
   3. DE HELE KETEN LOOPT: vacature zien, solliciteren, aangenomen worden,
      salaris ontvangen.
   4. DE AI SPREEKT DEZELFDE WERKWOORDEN. Geen eigen wervingssysteem.
   5. HIJ NEEMT AAN OP VOLGORDE VAN BINNENKOMST, en rangschikt geen mensen.
   6. HIJ WERFT WAT HIJ NODIG HEEFT EN NIET MEER.
   7. DE OUDE START BLIJFT WERKEN en is nog steeds de standaard.

   Draai los: node --experimental-sqlite --test test/spelstart.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const D = require('../server/kern/spellen/magnaat/dienst');
const W = require('../server/kern/spellen/magnaat/concurrent-werven');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {}
});

function wereld({ start = 'mens', ai = 2, maanden = 10 } = {}) {
  const m = maakMagnaat();
  const p = { id: 'st1', soort: 'magnaat', spelers: ['ik', 'ai1', 'ai2'], teams: [0, 1, 2],
    modus: 'vrij', status: 'bezig', beurt: 0, winnaar: null,
    variant: { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend', start, ai } };
  m.spel.init(p);
  const maand = (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } };
  maand(maanden);
  return { m, p, st: p.staat, maand };
}
const openVacatures = (st) => D.functies(st).filter(f => f.status === 'open');

/* ================= 1 en 2. de wereld draait, jij niet ================= */

test('de stad draait al voordat jij binnenkomt, en zoekt personeel', () => {
  const { st } = wereld();
  const zaken = (st.vestigingen.ai1 || []).length + (st.vestigingen.ai2 || []).length;
  assert.ok(zaken >= 3, 'de AI-bedrijven hebben echt gebouwd: ' + zaken);
  assert.ok(openVacatures(st).length >= 1, 'en er staan vacatures open');
});

test('jij hebt geen bedrijf en te weinig om er een te openen', () => {
  const { m, p, st } = wereld();
  assert.equal(st.vestigingen.ik.length, 0);
  assert.ok(st.geld.ik > 0 && st.geld.ik < 5000, 'genoeg om van te leven, niet om te bouwen: ' + st.geld.ik);
  const kav = require('../server/kern/spellen/magnaat/kaart').kaart('ijmuiden')
    .kavels.find(k => !st.kavelBezet[k.id]);
  const r = m.eco.zet(p, 'ik', { actie: 'open', kavel: kav.id, sector: 'horeca', omvang: 10 });
  assert.equal(r.ok, undefined, 'openen kan hij niet betalen');
  assert.match(r.error, /dat heb je niet/i);
});

test('de AI houdt wel kapitaal, want die IS de bestaande economie', () => {
  const { st } = wereld();
  assert.ok(st.geld.ai1 > 50000 || (st.vestigingen.ai1 || []).length > 0,
    'zonder geld bouwt de AI niets en is er niets om op te solliciteren');
});

/* ================= 3. de hele keten ================= */

test('vacature zien, solliciteren, aangenomen worden, salaris krijgen', () => {
  /* DE INTRO UIT DE VISIE, end-to-end en zonder een enkele speler die eerst
     een bedrijf moest openen. */
  const { m, p, st, maand } = wereld();
  const f = openVacatures(st)[0];
  assert.ok(f, 'er is een baan te vinden');
  const s = m.eco.zet(p, 'ik', { actie: 'solliciteren', id: f.id });
  assert.ok(s.ok, JSON.stringify(s));
  /* De werkgever antwoordt in zijn eigen maand -- er is geen speler die op de
     knop hoeft te drukken. */
  maand(1);
  const dienst = D.dienstVan(st, 'ik');
  assert.ok(dienst, 'iemand heeft je aangenomen');
  assert.equal(dienst.werknemer, 'ik');
  assert.ok(['ai1', 'ai2'].includes(dienst.werkgever));
  const kas = st.geld.ik;
  maand(1);
  assert.ok(st.geld.ik > kas, 'en er komt loon binnen: ' + kas + ' -> ' + st.geld.ik);
  assert.equal(Math.round(st.geld.ik - kas), Math.round(dienst.loon));
});

test('je eerste baan wordt onthouden als het eerste moment van je loopbaan', () => {
  const { m, p, st, maand } = wereld();
  const f = openVacatures(st)[0];
  m.eco.zet(p, 'ik', { actie: 'solliciteren', id: f.id });
  maand(2);
  const L = require('../server/kern/spellen/loopbaan')({ db: { data: {} }, save() {},
    codenaamVan: (h) => 'CN-' + h, progressieMag: () => true, GEEN_PROGRESSIE: 'x' });
  p.status = 'klaar';
  L.noteerLoopbaan(p);
  const t = L.terugblik('ik', 'CN-ik');
  assert.ok(t.begin, 'waar je begon staat er');
  assert.ok(t.momenten.some(x => x.soort === 'eerste_baan'), JSON.stringify(t.momenten));
});

/* ================= 4, 5, 6. hoe de AI werft ================= */

test('de AI gebruikt dezelfde acties als een speler', () => {
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/concurrent-werven.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(bron.includes("ACTIES['functie-openen']") && bron.includes('ACTIES.aannemen'),
    'hij roept de gewone acties aan');
  for (const eigen of ['st.diensten.push', 'st.functies.push', 'd.loon ='])
    assert.ok(!bron.includes(eigen), 'hij bouwt een eigen arbeidsmarkt: ' + eigen);
});

test('hij neemt aan op volgorde van binnenkomst en rangschikt geen mensen', () => {
  /* Een AI die kandidaten rangschikt, rangschikt MENSEN -- en dan bestaat er
     een cijfer dat zegt wie een betere werknemer is. Dat is de ranglijst die
     VERHAAL.md uitsluit. */
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/concurrent-werven.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const woord of ['sort(', 'beste', 'score', 'rang'])
    assert.ok(!bron.includes(woord), 'concurrent-werven.js doet aan ' + woord);
  assert.ok(bron.includes('[0]'), 'de eerste sollicitant krijgt de baan');
});

test('hij zet nooit meer dan twee vacatures tegelijk open', () => {
  /* Een rij van tien openstaande functies bij dezelfde werkgever is geen
     arbeidsmarkt maar een muur. Na 24 maanden hebben de AI's genoeg zaken om
     die muur te KUNNEN bouwen -- dus dit bijt alleen als de rem er is. */
  const { st } = wereld({ maanden: 24 });
  for (const h of ['ai1', 'ai2']) {
    const zaken = (st.vestigingen[h] || []).length;
    const open = D.functies(st).filter(f => f.status === 'open' && f.werkgever === h).length;
    assert.ok(open <= W.MAX_OPEN, h + ' heeft ' + open + ' vacatures open (max ' + W.MAX_OPEN + ')');
    assert.ok(zaken >= 3, h + ' heeft genoeg zaken om er meer te kunnen openen: ' + zaken);
  }
});

test('een kleine zaak zoekt handen, geen bedrijfsleider', () => {
  /* De rol groeit mee met de bezetting die de motor zelf rekent -- geen apart
     getal, en geen zaak van acht stoelen met een directie. */
  const maak = require('../server/kern/spellen/magnaat/concurrent-werven');
  const geroepen = [];
  const W2 = maak({ ACTIES: { 'functie-openen': (p, h, z) => { geroepen.push(z); return { ok: true, id: 'f' + geroepen.length }; },
    aannemen: () => ({ ok: false }) } });
  const st = { maand: 0, functies: [], diensten: [],
    vestigingen: { ai: [{ id: 'v1', sector: 'retail', omvang: 10, prijs: 'midden', tech: [] }] } };
  assert.equal(W2.ontbrekendeRol(st, st.vestigingen.ai[0]), 'hulp', 'een kleine zaak zoekt handen');
  /* DE SCHERPE: een kleine zaak waar hulp EN vakkracht al zitten, zoekt daarna
     NIETS. Zonder de drempel zou hij een bedrijfsleider zoeken voor een zaak
     met een man of twee -- en dan heeft elke kiosk een directie. */
  const klein = st.vestigingen.ai[0];
  st.diensten.push({ id: 'd1', status: 'loopt', vestiging: 'v1', rol: 'hulp', werkgever: 'ai', werknemer: 'x' },
    { id: 'd2', status: 'loopt', vestiging: 'v1', rol: 'vakkracht', werkgever: 'ai', werknemer: 'y' });
  assert.equal(W2.ontbrekendeRol(st, klein), null, 'een kleine zaak is dan klaar');
  const groot = { id: 'v2', sector: 'hotel', omvang: 60, prijs: 'midden', tech: [] };
  st.vestigingen.ai.push(groot);
  st.diensten.push({ id: 'd3', status: 'loopt', vestiging: 'v2', rol: 'hulp', werkgever: 'ai', werknemer: 'p' },
    { id: 'd4', status: 'loopt', vestiging: 'v2', rol: 'vakkracht', werkgever: 'ai', werknemer: 'q' });
  assert.equal(W2.ontbrekendeRol(st, groot), 'bedrijfsleider', 'een grote zaak zoekt er wel een');
  /* En een zaak waar de rol al vervuld is, zoekt hem niet nog eens. */
  st.diensten.push({ id: 'd5', status: 'loopt', vestiging: 'v2', rol: 'bedrijfsleider', werkgever: 'ai', werknemer: 'z' });
  assert.equal(W2.ontbrekendeRol(st, groot), null);
});

test('er wordt om handen gevraagd en nooit om een bestuur', () => {
  const { st } = wereld({ maanden: 24 });
  const rollen = new Set(D.functies(st).map(f => f.rol));
  assert.ok(rollen.has('hulp'), 'er wordt om handen gevraagd');
  for (const bestuur of ['ceo', 'cfo', 'coo'])
    assert.ok(!rollen.has(bestuur), 'een AI werft geen ' + bestuur);
});

test('een zaak zoekt geen tweede hulpkracht als de eerste er zit', () => {
  const { m, p, st, maand } = wereld();
  const f = openVacatures(st)[0];
  const vestiging = f.vestiging, werkgever = f.werkgever;
  m.eco.zet(p, 'ik', { actie: 'solliciteren', id: f.id });
  maand(3);
  const dubbel = D.functies(st).filter(x => x.status === 'open'
    && x.vestiging === vestiging && x.rol === f.rol);
  assert.equal(dubbel.length, 0, 'die rol is vervuld');
  assert.ok(D.dienstenBij(st, vestiging).some(d => d.rol === f.rol));
  assert.equal(werkgever, D.dienstVan(st, 'ik').werkgever);
});

/* ================= 7. de oude start blijft ================= */

test('de ondernemersstart werkt nog en is nog steeds de standaard', () => {
  const { st } = wereld({ start: 'ondernemer', maanden: 2 });
  assert.equal(st.geld.ik, 250000, 'met startkapitaal');
  assert.equal(st.startvorm, 'ondernemer');
  const m = maakMagnaat();
  assert.equal(m.spel.varianten.start.standaard, 'ondernemer');
  assert.deepEqual(m.spel.varianten.start.keuze, ['ondernemer', 'mens']);
});

test('zonder AI is er niemand die personeel zoekt, en dat is eerlijk zichtbaar', () => {
  /* Een menselijke start zonder bestaande economie is een lege stad waarin
     niemand iets kan. Dat hoort geen verborgen val te zijn. */
  const { st } = wereld({ ai: 0, maanden: 6 });
  assert.equal(openVacatures(st).length, 0);
  assert.equal(st.startvorm, 'mens');
});
