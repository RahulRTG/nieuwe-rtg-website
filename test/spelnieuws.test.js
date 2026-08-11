/* MAGNAAT: WERELDNIEUWS -- wat er in de stad gebeurt terwijl jij onderneemt.

   ZEVEN BEWERINGEN, en ze zijn alle zeven stil terug te draaien:

   1. DE CYCLUS IS DE WIND, DIT ZIJN DE BUIEN. Een bericht raakt EEN zone of EEN
      sector, niet de hele stad.
   2. HET RAAKT EEN GETAL DAT DE MOTOR AL GEBRUIKT, en niet "de sfeer".
   3. HET IS VOORAF AANGEKONDIGD. Wie oplet kan reageren; dat is het verschil
      tussen een mechaniek en pech.
   4. HET IS PUBLIEK.
   5. HET MAAKT NOOIT GELD.
   6. HET IS DETERMINISTISCH (GAMEHALL.md 12.4).
   7. HET IS ZELDZAAM GENOEG OM BIJZONDER TE BLIJVEN, en begrensd genoeg om niet
      te bepalen wie er wint.

   Draai los: node --experimental-sqlite --test test/spelnieuws.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const N = require('../server/kern/spellen/magnaat/nieuws');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const { SECTORLIJST } = require('../server/kern/spellen/magnaat/sectoren');

const ZONES = [...new Set(kaart('ijmuiden').kavels.map(k => k.zone))];
const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kavelIn = (zone, n = 0) => kaart('ijmuiden').kavels.filter(k => k.zone === zone)[n];

function opstelling(id = 'p1') {
  const m = maakMagnaat();
  const p = { id, soort: 'magnaat', spelers: ['anna', 'boris'], teams: [0, 1], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of p.spelers) p.staat.geld[h] = 2000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 40 });
  return { m, p, st: p.staat, A: p.staat.vestigingen.anna[0] };
}
const maand = (m, p, n = 1) => {
  for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); }
};

/* ================= 1. het raakt een zone of een sector ================= */

test('elk bericht raakt precies een zone of precies een sector', () => {
  for (const sleutel of N.SOORTLIJST) {
    const k = N.SOORTEN[sleutel];
    assert.ok(['zone', 'sector'].includes(k.doel), sleutel + ' raakt "' + k.doel + '"');
  }
  for (let mnd = 0; mnd < 200; mnd++) {
    const b = N.berichtVan('p1', mnd, ZONES);
    if (!b) continue;
    const lijst = b.doelSoort === 'zone' ? ZONES : SECTORLIJST;
    assert.ok(lijst.includes(b.doel), b.naam + ' raakt "' + b.doel + '", en dat bestaat niet');
  }
});

test('een bericht raakt niet de hele stad', () => {
  /* DE SCHEIDSLIJN MET DE CYCLUS. Een golf waar iedereen in zit is een economie;
     een bui die alleen jouw straat raakt is een verhaal. Zou nieuws iedereen
     tegelijk raken, dan is het een tweede conjunctuur met een krantenkop erop. */
  let gevonden = 0;
  for (let mnd = 0; mnd < 120; mnd++) {
    const zonenieuws = N.lopend('p1', mnd, ZONES).filter(b => b.doelSoort === 'zone');
    if (!zonenieuws.length) continue;
    /* MET EEN SECTOR DIE ZELF GEEN NIEUWS HEEFT, anders meet je het sectornieuws.
       Dat gebeurde ook: met horeca vast ingesteld leek in maand 21 de hele stad
       geraakt, terwijl daar een branchekwestie liep die niets met de zones te
       maken had. */
    const rustig = SECTORLIJST.find(sec => !N.lopend('p1', mnd, ZONES)
      .some(b => b.doelSoort === 'sector' && b.doel === sec));
    if (!rustig) continue;
    const geraakt = ZONES.filter(z => N.factorVoor('p1', mnd, ZONES, { zone: z, sector: rustig }) !== 1);
    assert.ok(geraakt.length < ZONES.length, 'in maand ' + mnd + ' is de hele stad geraakt');
    assert.ok(geraakt.length > 0, 'maar er is wel iets geraakt');
    gevonden++;
  }
  assert.ok(gevonden > 10, 'er is genoeg nieuws langsgekomen om dit te meten: ' + gevonden);
});

/* ================= 2. het raakt een getal van de motor ================= */

test('de vraag beweegt met het nieuws mee, en alleen waar het valt', () => {
  const N2 = require('../server/kern/spellen/magnaat/nieuws');
  const echt = N2.factorVoor;
  const meet = (factor) => {
    N2.factorVoor = () => factor;
    try {
      const { m, p, st } = opstelling('gelijk');
      maand(m, p, 6);
      const r = st.laatste.anna.regels[0];
      return r.eenheden + r.gemist;
    } finally { N2.factorVoor = echt; }
  };
  const festival = meet(1.22), wegwerk = meet(0.82);
  assert.ok(festival > wegwerk, 'een festival trekt meer volk dan een opengebroken weg: ' +
    festival + ' tegen ' + wegwerk);
  /* IN DE ORDE VAN DE FACTOR en niet exact. De vraag koppelt terug: meer volk
     betekent een vollere zaak, en een vollere zaak levert lagere kwaliteit en
     dus een lagere reputatie, en die drukt de vraag weer. Over zes maanden
     dempt dat de verhouding merkbaar, en een toets die de kale factor eist meet
     die terugkoppeling in plaats van het nieuws. */
  const verwacht = 1.22 / 0.82;
  const gemeten = festival / wegwerk;
  assert.ok(gemeten > 1 && gemeten < verwacht + 0.05,
    'in de orde van de factor: ' + gemeten.toFixed(2) + ' tegen ' + verwacht.toFixed(2));
  // en de echte functie beweegt ook, anders raakt de mutatie alleen de vervanger
  const echteWaarden = new Set();
  for (let mnd = 0; mnd < 60; mnd++)
    echteWaarden.add(echt('p1', mnd, ZONES, { zone: 'boulevard', sector: 'horeca' }));
  assert.ok(echteWaarden.size >= 2, 'het nieuws valt werkelijk ergens: ' + [...echteWaarden].join(', '));
});

test('een bericht op de haven raakt een zaak op de boulevard niet', () => {
  let gemeten = 0;
  for (let mnd = 0; mnd < 120; mnd++) {
    for (const b of N.lopend('p1', mnd, ZONES)) {
      if (b.doelSoort !== 'zone') continue;
      const elders = ZONES.find(z => z !== b.doel);
      const f = N.factorVoor('p1', mnd, ZONES, { zone: elders, sector: 'kantoor' });
      const raakt = N.lopend('p1', mnd, ZONES).some(x =>
        (x.doelSoort === 'zone' && x.doel === elders) || (x.doelSoort === 'sector' && x.doel === 'kantoor'));
      if (!raakt) { assert.equal(f, 1, 'een zone verderop hoort niets te merken'); gemeten++; }
    }
  }
  assert.ok(gemeten > 5, 'er zijn genoeg gevallen gemeten: ' + gemeten);
});

/* ================= 3. het is vooraf aangekondigd ================= */

test('elk bericht staat in de krant voordat het begint', () => {
  for (let mnd = 0; mnd < 120; mnd++) {
    const b = N.berichtVan('p1', mnd, ZONES);
    if (!b) continue;
    assert.ok(b.aangekondigd < b.begint, b.naam + ' komt zonder waarschuwing');
    assert.ok(b.begint - b.aangekondigd >= 2, 'en met genoeg tijd om te reageren');
    // en hij staat dan ook werkelijk in de "komt eraan"-lijst
    const komt = N.komend('p1', b.aangekondigd, ZONES);
    assert.ok(komt.some(x => x.begint === b.begint && x.soort === b.soort),
      b.naam + ' van maand ' + b.begint + ' staat niet aangekondigd in maand ' + b.aangekondigd);
  }
});

test('wat er loopt en wat er komt zijn twee verschillende lijsten', () => {
  for (const mnd of [0, 5, 13, 26]) {
    const b = N.beeld('p1', mnd, ZONES);
    for (const x of b.nu) {
      assert.ok(x.begint <= mnd && mnd < x.eindigt, 'wat loopt, loopt ook echt');
      assert.ok(x.nog >= 1, 'met hoeveel maanden het nog duurt');
    }
    for (const x of b.komt) {
      assert.ok(x.begint > mnd, 'wat komt, is nog niet begonnen');
      assert.ok(x.over >= 1, 'met over hoeveel maanden');
    }
    const dubbel = b.nu.filter(x => b.komt.some(y => y.begint === x.begint && y.soort === x.soort));
    assert.deepEqual(dubbel, [], 'niets staat in beide lijsten');
  }
});

/* ================= 4. publiek ================= */

test('de krant is voor iedereen dezelfde, ook op een gedeeld scherm', () => {
  const { m, p, st } = opstelling();
  maand(m, p, 7);
  const anna = m.eco.zicht(p, st, 'anna').nieuws;
  const boris = m.eco.zicht(p, st, 'boris').nieuws;
  assert.deepEqual(anna, boris, 'nieuws is van de stad en niet van jou');
  assert.deepEqual(m.eco.publiek(p, st).nieuws, anna);
  assert.ok(anna.nu.every(x => x.tekst && x.doelNaam), 'en het staat er in woorden');
});

/* ================= 5. het maakt nooit geld ================= */

test('geen enkel bericht zet een bedrag op een rekening', () => {
  /* Dezelfde wet als bij onderzoek. Een gebeurtenis verandert
     productievoorwaarden -- vraag -- en verder niets. */
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/nieuws.js'), 'utf8');
  assert.ok(!/st\.geld/.test(bron), 'de nieuwslaag raakt de kas aan');
  for (const sleutel of N.SOORTLIJST)
    assert.deepEqual(Object.keys(N.SOORTEN[sleutel]).sort(),
      ['aankondiging', 'duur', 'doel', 'kans', 'naam', 'tekst', 'vraag'].sort(),
      sleutel + ' heeft een uitgang die er niet hoort te zijn');
});

test('de kas beweegt alleen met de regels op het maandoverzicht', () => {
  const { m, p, st } = opstelling();
  for (let i = 0; i < 24; i++) {
    const voor = st.geld.anna;
    maand(m, p, 1);
    const som = st.laatste.anna.regels.reduce((n, r) => n + (r.resultaat || 0), 0);
    assert.ok(Math.abs((st.geld.anna - voor) - som) < 1.5,
      'maand ' + st.maand + ': de kas bewoog met ' + Math.round(st.geld.anna - voor) +
      ' terwijl de regels ' + Math.round(som) + ' zeggen');
  }
});

/* ================= 6. deterministisch ================= */

test('dezelfde partij krijgt dezelfde krant, een andere partij niet', () => {
  const krant = (id) => Array.from({ length: 60 }, (_, m) => {
    const b = N.berichtVan(id, m, ZONES);
    return b ? b.soort + '@' + b.doel : '';
  }).join(',');
  assert.equal(krant('p1'), krant('p1'));
  assert.notEqual(krant('p1'), krant('p2'), 'twee campagnes krijgen niet hetzelfde nieuws');
});

test('tien maanden in een keer geeft dezelfde uitkomst als tien maanden los', () => {
  const draai = (stappen) => {
    const { m, p, st, A } = opstelling('zelfde');
    for (const n of stappen) maand(m, p, n);
    return { geld: Math.round(st.geld.anna), omzet: Math.round(A.omzetTotaal || 0),
      reputatie: Math.round(A.reputatie) };
  };
  assert.deepEqual(draai([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]), draai([10]));
});

/* ================= 7. zeldzaam en begrensd ================= */

test('er gebeurt niet elke maand iets bijzonders', () => {
  /* Een stad waarin elke maand iets bijzonders gebeurt heeft geen bijzondere
     gebeurtenissen meer. */
  let stil = 0;
  for (let mnd = 0; mnd < 120; mnd++) if (!N.berichtVan('p1', mnd, ZONES)) stil++;
  assert.ok(stil / 120 > 0.5, 'de meeste maanden is het gewoon een stad: ' + stil + '/120');
});

test('opgestapeld nieuws blijft binnen de band', () => {
  const uit = new Set();
  for (const id of ['p1', 'p2', 'p3', 'p4'])
    for (let mnd = 0; mnd < 200; mnd++)
      for (const z of ZONES) for (const s of SECTORLIJST)
        uit.add(N.factorVoor(id, mnd, ZONES, { zone: z, sector: s }));
  const laag = Math.min(...uit), hoog = Math.max(...uit);
  assert.ok(laag >= N.BAND[0] - 1e-9 && hoog <= N.BAND[1] + 1e-9,
    'buiten de band: ' + laag.toFixed(2) + ' .. ' + hoog.toFixed(2));
  assert.ok(hoog > 1.1 && laag < 0.95, 'en de band wordt ook echt gebruikt');
});

test('niets doen verliest ook met de beste krant', () => {
  const S = require('../scripts/magnaat-strateeg');
  let gewonnen = 0;
  for (let o = 0; o < 6; o++) {
    const stand = S.campagne('niets', 'horeca', o);
    if (stand.find(x => x.codenaam === 'a').vermogen > stand.find(x => x.codenaam === 'b').vermogen) gewonnen++;
  }
  assert.equal(gewonnen, 0, 'geen enkele gebeurtenis maakt niets doen de beste zet');
});
