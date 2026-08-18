/* MAGNAAT: VERZEKERINGEN -- risico als keuze in plaats van een vinkje.

   ACHT BEWERINGEN, en ze zijn alle acht stil terug te draaien:

   1. HET TOEVAL IS DETERMINISTISCH. Dat is de zwaarste eis: de klok REKENT BIJ
      (GAMEHALL.md 12.4), dus tien maanden in een keer moeten dezelfde branden
      geven als tien maanden los. Met een `Math.random()` erin zou het van je
      pollgedrag afhangen of je bedrijf afbrandt.
   2. OVERVERZEKEREN IS NOOIT WINSTGEVEND. Een uitkering komt nooit boven de
      aantoonbare schade, en de premie draagt een opslag. Anders is een brand
      een verdienmodel.
   3. EEN EIGEN RISICO VERLAAGT DE PREMIE. Zonder die korting is het puur
      verlies en kiest niemand het ooit.
   4. DE UITSLUITING IS EEN KOPPELING EN GEEN KLEINE LETTERTJES. Verwaarlozing
      is niet verzekerd, en dat maakt onderhoud een knop met twee staarten.
   5. ELK RISICO HANGT AAN IETS ANDERS. Een risico dat alleen een andere kans
      is, hoort er niet te zijn.
   6. GEVOLGSCHADE VOLGT ERGENS OP. Bedrijfsschade zonder brand is een achtste
      dobbelsteen met een duur woord erop.
   7. SCHADE WERKT DOOR. Een brand is geen rekening maar een pand dat achteruit
      gaat -- anders raakt hij kwaliteit en reputatie niet.
   8. EEN MEDESPELER ZIET JE POLISSEN NIET.

   Draai los: node --test test/spelverzekering.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const R = require('../server/kern/spellen/magnaat/risico');
const P = require('../server/kern/spellen/magnaat/polis');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

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
  for (const h of p.spelers) p.staat.geld[h] = 5000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 40, naam: 'Zeezicht' });
  return { m, p, st: p.staat, A: p.staat.vestigingen.anna[0] };
}
const maand = (m, p, n = 1) => {
  for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); }
};

/* ================= 1. het toeval is deterministisch ================= */

test('tien maanden in een keer geeft dezelfde branden als tien maanden los', () => {
  const opzet = () => {
    const o = opstelling();
    maand(o.m, o.p, 2);
    o.m.eco.zet(o.p, 'anna', { actie: 'polis-sluiten', vestiging: o.A.id, risico: 'brand',
      dekking: 1, eigenRisico: 0, maximum: 5000000 });
    return o;
  };
  const los = opzet();
  for (let i = 0; i < 10; i++) maand(los.m, los.p, 1);
  const bulk = opzet();
  bulk.p.staat.gerekendTot -= bulk.p.staat.maandMs * 10;
  bulk.m.eco.bijrekenen(bulk.p);
  assert.equal(Math.round(los.st.geld.anna), Math.round(bulk.st.geld.anna),
    'dezelfde maanden horen dezelfde voorvallen te geven');
  assert.equal(Math.round(los.st.polissen[0].uitgekeerd), Math.round(bulk.st.polissen[0].uitgekeerd));
  assert.equal(los.st.polissen[0].voorvallen, bulk.st.polissen[0].voorvallen);
});

test('twee partijen op dezelfde plek krijgen NIET dezelfde ongelukken', () => {
  /* Anders is het toeval geen toeval maar een rooster: wie een keer heeft
     gespeeld weet wanneer het misgaat. De partij-id zit daarom in de trekking. */
  const a = opstelling('partij-een'), b = opstelling('partij-twee');
  maand(a.m, a.p, 40);
  maand(b.m, b.p, 40);
  assert.notEqual(Math.round(a.st.geld.anna), Math.round(b.st.geld.anna),
    'twee partijen horen een ander verloop te hebben');
});

test('een trekking is stabiel en netjes verdeeld', () => {
  assert.equal(R.trek('abc'), R.trek('abc'), 'dezelfde invoer, hetzelfde getal');
  assert.notEqual(R.trek('abc'), R.trek('abd'));
  const n = 4000;
  let som = 0, laag = 0;
  for (let i = 0; i < n; i++) { const x = R.trek('x' + i); som += x; if (x < 0.5) laag++; }
  assert.ok(Math.abs(som / n - 0.5) < 0.03, 'gemiddeld rond de helft: ' + (som / n).toFixed(3));
  assert.ok(Math.abs(laag / n - 0.5) < 0.05, 'en ongeveer de helft eronder');
});

/* ================= 2. oververzekeren is nooit winstgevend ================= */

test('een uitkering komt nooit boven de aantoonbare schade', () => {
  /* DE HARDE GRENS van deze hele laag. Wie zich voor het tienvoudige verzekert,
     krijgt niet het tienvoudige -- hij betaalt alleen tien keer de premie. */
  const zaak = { sector: 'horeca', onderhoud: 100, gebouwdVoor: 200000, omvang: 40 };
  const ruim = { risico: 'brand', dekking: 1, eigenRisico: 0, maximum: 20000000 };
  assert.equal(P.uitkering(ruim, zaak, 30000).bedrag, 30000, 'precies de schade en geen cent meer');
  assert.equal(P.uitkering(ruim, zaak, 0).bedrag, 0);
  // en met een maximum eronder krijg je minder, niet meer
  const krap = { risico: 'brand', dekking: 1, eigenRisico: 0, maximum: 10000 };
  assert.equal(P.uitkering(krap, zaak, 30000).bedrag, 10000);

  /* EN HET VANGNET, met een polis die de actielaag nooit zou toelaten. `dekking`
     is daar op 1 begrensd, dus zolang die grens staat is de laatste stap in
     `uitkering` onbereikbaar -- een mutatie die hem weghaalde liet alle toetsen
     groen. Dat is precies het soort bescherming dat je pas mist als er een laag
     bijkomt die de dekking mag oprekken (een R&D-voordeel, een clausule), en
     dan is de fout stil. Hier wordt hij rechtstreeks aangeroepen. */
  const absurd = { risico: 'brand', dekking: 3, eigenRisico: 0, maximum: 20000000 };
  assert.equal(P.uitkering(absurd, zaak, 30000).bedrag, 30000,
    'ook een polis die driemaal dekt, keert nooit meer dan de schade uit');
});

test('alles maximaal verzekeren kost geld -- gemiddeld, niet per partij', () => {
  /* DE BEWERING GELDT IN VERWACHTING EN NIET PER RUN, en dat is geen slap
     aftreksel maar precies wat een verzekering IS. In een partij met veel pech
     betaalt een polis zich terug -- als dat nooit zo was, zou niemand er ooit
     een nemen. Wat niet mag is dat verzekeren GEMIDDELD loont: dan is het geen
     ruil maar gratis geld.

     De eerste versie van deze toets mat EEN partij en sloeg aan omdat die
     partij toevallig veel schade had. Dat mat het toeval en niet de premie. */
  const meting = (id, verzekeren) => {
    const { m, p, st, A } = opstelling(id);
    maand(m, p, 2);
    if (verzekeren)
      for (const risico of R.RISICOLIJST)
        m.eco.zet(p, 'anna', { actie: 'polis-sluiten', vestiging: A.id, risico,
          dekking: 1, eigenRisico: 0, maximum: 20000000 });
    maand(m, p, 36);
    return m.eco.eindstand(p).find(x => x.codenaam === 'CN-anna').vermogen;
  };
  let metSom = 0, zonderSom = 0, metWint = 0;
  const N = 12;
  for (let i = 0; i < N; i++) {
    const met = meting('partij-' + i, true), zonder = meting('partij-' + i, false);
    metSom += met; zonderSom += zonder;
    if (met > zonder) metWint++;
  }
  assert.ok(metSom < zonderSom,
    'over ' + N + ' partijen hoort verzekeren geld te kosten: ' +
    Math.round(metSom / N) + ' tegen ' + Math.round(zonderSom / N));
  /* Maar niet altijd, want dan is het geen verzekering maar een boete: er hoort
     een partij bij te zitten waarin het zich terugbetaalt. */
  assert.ok(metWint > 0, 'in geen enkele partij loonde het; dan is het een boete en geen ruil');
  assert.ok(metWint < N, 'in elke partij loonde het; dan is het gratis geld');
  // en het hoort een prijs te zijn, geen straf
  assert.ok(metSom > zonderSom * 0.85, 'de prijs hoort in de orde van de opslag te liggen');
});

test('de premie ligt boven de verwachte schade, anders is verzekeren gratis', () => {
  const { m, p, st, A } = opstelling();
  maand(m, p, 6);
  for (const risico of R.RISICOLIJST) {
    const o = m.eco.zet(p, 'anna', { actie: 'polis-sluiten', vestiging: A.id, risico,
      dekking: 1, eigenRisico: 0, maximum: 20000000 });
    assert.ok(o.ok, risico + ': ' + o.error);
  }
  const beeld = m.eco.zicht(p, st, 'anna').verzekering;
  for (const post of beeld.risicos[0].posten) {
    if (post.verwachteSchade < 1) continue;
    assert.ok(post.premie > post.verwachteSchade,
      post.risico + ': premie ' + post.premie + ' onder de verwachte schade ' + post.verwachteSchade);
    assert.ok(post.premie < post.verwachteSchade * 2,
      post.risico + ': de opslag hoort geen verdubbeling te zijn');
  }
});

/* ================= 3. een eigen risico verlaagt de premie ================= */

test('wie zelf risico draagt, betaalt minder premie', () => {
  const { m, p, st, A } = opstelling();
  maand(m, p, 6);
  const zonder = m.eco.zet(p, 'anna', { actie: 'polis-sluiten', vestiging: A.id, risico: 'brand',
    dekking: 1, eigenRisico: 0, maximum: 20000000 });
  m.eco.zet(p, 'anna', { actie: 'polis-opzeggen', id: zonder.id });
  const met = m.eco.zet(p, 'anna', { actie: 'polis-sluiten', vestiging: A.id, risico: 'brand',
    dekking: 1, eigenRisico: 50000, maximum: 20000000 });
  assert.ok(met.premie < zonder.premie,
    'een eigen risico hoort de premie te drukken: ' + met.premie + ' tegen ' + zonder.premie);
  // en halve dekking kost ongeveer de helft
  m.eco.zet(p, 'anna', { actie: 'polis-opzeggen', id: met.id });
  const half = m.eco.zet(p, 'anna', { actie: 'polis-sluiten', vestiging: A.id, risico: 'brand',
    dekking: 0.5, eigenRisico: 0, maximum: 20000000 });
  assert.ok(Math.abs(half.premie - zonder.premie / 2) <= 1, 'dekking werkt recht evenredig');
});

test('het eigen risico gaat er bij een uitkering ook echt af', () => {
  const zaak = { sector: 'horeca', onderhoud: 100, gebouwdVoor: 200000, omvang: 40 };
  const polis = { risico: 'brand', dekking: 1, eigenRisico: 10000, maximum: 20000000 };
  assert.equal(P.uitkering(polis, zaak, 30000).bedrag, 20000);
  assert.equal(P.uitkering(polis, zaak, 8000).bedrag, 0, 'een klein voorval draag je zelf');
});

/* ================= 4. de uitsluiting is een koppeling ================= */

test('verwaarlozing is niet verzekerd, en dat maakt onderhoud een knop met twee staarten', () => {
  const verwaarloosd = { sector: 'horeca', onderhoud: 10, gebouwdVoor: 200000, omvang: 40 };
  const netjes = { sector: 'horeca', onderhoud: 90, gebouwdVoor: 200000, omvang: 40 };
  const polis = { risico: 'brand', dekking: 1, eigenRisico: 0, maximum: 20000000 };
  assert.equal(P.uitkering(polis, netjes, 50000).bedrag, 50000);
  const uit = P.uitkering(polis, verwaarloosd, 50000);
  assert.equal(uit.bedrag, 0, 'onder de onderhoudsgrens keert brand niets uit');
  assert.match(uit.reden, /uitgesloten/);
  // en het geldt alleen voor de risico's die het kunnen: storm is geen verwijt
  const storm = { risico: 'storm', dekking: 1, eigenRisico: 0, maximum: 20000000 };
  assert.equal(P.uitkering(storm, verwaarloosd, 50000).bedrag, 50000);
});

test('een verwaarloosd pand brandt ook nog eens vaker', () => {
  const verwaarloosd = { sector: 'horeca', onderhoud: 0, gebouwdVoor: 200000, omvang: 40 };
  const netjes = { sector: 'horeca', onderhoud: 100, gebouwdVoor: 200000, omvang: 40 };
  assert.ok(R.kansOp('brand', verwaarloosd, {}) > R.kansOp('brand', netjes, {}) * 4,
    'verwaarlozing hoort de kans fors te verhogen');
  /* Samen met de uitsluiting hierboven is dat de hele koppeling: je loopt meer
     risico EN je bent er niet voor verzekerd. Onderhoud overslaan is daarmee
     geen besparing maar een weddenschap. */
});

/* ================= 5. elk risico hangt aan iets anders ================= */

test('de acht risico\'s hangen aan acht verschillende knoppen', () => {
  const basis = { sector: 'horeca', onderhoud: 60, gebouwdVoor: 200000, omvang: 40 };
  const varianten = {
    onderhoud: Object.assign({}, basis, { onderhoud: 0 }),
    omvang: Object.assign({}, basis, { omvang: 200 }),
    sector: Object.assign({}, basis, { sector: 'industrie' })
  };
  const vingerafdruk = (v, ctx) => R.RISICOLIJST.map(r => R.kansOp(r, v, ctx || {}).toFixed(5)).join('|');
  const kaal = vingerafdruk(basis);
  for (const [knop, v] of Object.entries(varianten))
    assert.notEqual(vingerafdruk(v), kaal, knop + ' hoort ergens iets te veranderen');
  assert.notEqual(vingerafdruk(basis, { winter: true }), vingerafdruk(basis, { winter: false }),
    'het seizoen hoort iets te doen');
  assert.notEqual(vingerafdruk(basis, { bezetting: 1 }), vingerafdruk(basis, { bezetting: 0 }),
    'de bezetting hoort iets te doen');
  // en geen twee risico's reageren identiek op alles
  const profielen = R.RISICOLIJST.map(r => [basis, varianten.onderhoud, varianten.omvang,
    varianten.sector].map(v => R.kansOp(r, v, { winter: true, bezetting: 1 }).toFixed(6)).join('|'));
  assert.equal(new Set(profielen).size, R.RISICOLIJST.length,
    'twee risico\'s die overal hetzelfde doen zijn een risico met twee namen');
});

/* ================= 6. gevolgschade volgt ergens op ================= */

test('bedrijfsschade bestaat alleen na schade aan het pand', () => {
  assert.deepEqual(R.RISICOS.bedrijfsschade.volgtOp, ['brand', 'storm']);
  assert.equal(R.kansOp('bedrijfsschade', { sector: 'horeca', onderhoud: 50, gebouwdVoor: 1, omvang: 1 }, {}), 0,
    'hij heeft geen eigen kans');
  // over veel maanden: geen enkele bedrijfsschade zonder brand of storm in dezelfde maand
  const v = { id: 'v1', sector: 'horeca', onderhoud: 20, gebouwdVoor: 200000, omvang: 40 };
  let gevolg = 0, los = 0;
  for (let maand = 0; maand < 600; maand++) {
    const rij = R.voorvallen('p', maand, v, { winter: maand % 12 < 3 });
    const heeft = (k) => rij.some(x => x.risico === k);
    if (heeft('bedrijfsschade')) {
      gevolg++;
      if (!heeft('brand') && !heeft('storm')) los++;
    }
  }
  assert.ok(gevolg > 0, 'hij komt werkelijk voor: ' + gevolg + ' keer in 600 maanden');
  assert.equal(los, 0, 'maar nooit los van pandschade');
});

/* ================= 7. schade werkt door ================= */

test('een brand is geen rekening maar een pand dat achteruit gaat', () => {
  const { m, p, st, A } = opstelling();
  A.onderhoud = 100;
  const voor = A.onderhoud;
  let geraakt = false;
  for (let i = 0; i < 60 && !geraakt; i++) {
    maand(m, p, 1);
    const rij = (st.laatste.anna.regels || []).filter(r => r.id === 'brand' || r.id === 'storm');
    if (rij.length && rij[0].schade > 0) geraakt = true;
  }
  assert.ok(geraakt, 'er is binnen vijf jaar een keer pandschade');
  assert.ok(A.onderhoud < voor, 'en de staat van het pand is eronder geleden');
});

/* ================= 8. een medespeler ziet je polissen niet ================= */

test('je polissen zijn van jou', () => {
  const { m, p, st, A } = opstelling();
  maand(m, p, 2);
  m.eco.zet(p, 'anna', { actie: 'polis-sluiten', vestiging: A.id, risico: 'brand',
    dekking: 1, eigenRisico: 12345, maximum: 20000000 });
  const boris = JSON.stringify(m.eco.zicht(p, st, 'boris'));
  assert.ok(!/12345/.test(boris), 'boris hoort je eigen risico niet te zien');
  assert.equal(m.eco.zicht(p, st, 'boris').verzekering.polissen.length, 0);
  for (const laag of ['kijker', 'publiek'])
    assert.ok(!/12345/.test(JSON.stringify(m.spel.zicht[laag](p, st))), laag + ' evenmin');
  // en opzeggen van andermans polis kan niet
  assert.equal(m.eco.zet(p, 'boris', { actie: 'polis-opzeggen', id: st.polissen[0].id }).status, 404);
});

test('twee polissen op hetzelfde risico kunnen niet', () => {
  const { m, p, st, A } = opstelling();
  maand(m, p, 2);
  assert.ok(m.eco.zet(p, 'anna', { actie: 'polis-sluiten', vestiging: A.id, risico: 'brand',
    dekking: 1, eigenRisico: 0, maximum: 20000000 }).ok);
  const tweede = m.eco.zet(p, 'anna', { actie: 'polis-sluiten', vestiging: A.id, risico: 'brand',
    dekking: 1, eigenRisico: 0, maximum: 20000000 });
  assert.equal(tweede.status, 409);
});

test('verzekeren is een vrije actie', () => {
  const m = maakMagnaat();
  for (const actie of ['polis-sluiten', 'polis-opzeggen'])
    assert.ok(m.spel.buitenBeurt.includes(actie), actie + ' hoort buiten de beurt te mogen');
});

test('de twee pomproutes op verzekeren maken geen waarde uit het niets', () => {
  const { meet, EXACT } = require('../scripts/magnaat-pomp');
  for (const naam of ['oververzekeren', 'poliscarrousel']) {
    const r = meet(naam, 12);
    assert.ok(Math.abs(r.verschil) <= EXACT,
      naam + ': premie en schade horen exact als lek terug te komen, maar er staat ' + Math.round(r.verschil));
  }
});
