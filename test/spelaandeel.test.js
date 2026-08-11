/* MAGNAAT FASE B: DEELNEMINGEN -- verdienen aan een zaak waar je niet aan de knoppen zit.

   Het derde stuk van fase B. Een contract koppelt twee bedrijven aan een
   LEVERING; een deelneming koppelt ze aan een RESULTAAT. Dat is een ander soort
   afhankelijkheid, en het is de plek waar "concern" iets betekent zonder dat er
   een tweede spel bij komt.

   VIJF BEWERINGEN, en ze hangen alle vijf aan dezelfde vraag -- wie is de baas?

   1. EEN BELANG GEEFT GEEN ZEGGENSCHAP. De eigenaar blijft de enige die aan de
      knoppen zit. Zonder die regel is een vestiging met drie aandeelhouders een
      object waarvan onduidelijk is wie er een zet op mag doen.
   2. HOOGSTENS 49% GAAT WEG. Wie het hele bedrijf wil, koopt het in de veiling.
   3. VERLIES DEEL JE MEE. Anders is een belang verkopen in een slechte zaak
      gratis geld.
   4. DE OPTELSOM KLOPT. Dezelfde euro mag niet bij twee mensen op de eindstand
      staan -- dat is de makkelijkste fout in een laag die waarde verplaatst.
   5. HET BELANG HANGT AAN DE VESTIGING. Wordt de zaak verkocht, dan blijft het
      belang staan; anders schud je je aandeelhouders af door te verkopen.

   Draai los: node --experimental-sqlite --test test/spelaandeel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const { waarde } = require('../server/kern/spellen/magnaat/stap');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'quick' };
const kavelIn = (zone, n = 0) => kaart('ijmuiden').kavels.filter(k => k.zone === zone)[n];

function opstelling(spelers = ['anna', 'boris']) {
  const m = maakMagnaat();
  const p = { id: 'p1', soort: 'magnaat', spelers, teams: spelers.map((_, i) => i), modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of spelers) p.staat.geld[h] = 5000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 40, naam: 'Zeezicht' });
  return { m, p, st: p.staat, A: p.staat.vestigingen.anna[0] };
}
const maand = (m, p, n = 1) => {
  for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); }
};
function koop(m, p, van, naar, x) {
  const r = m.eco.zet(p, van, Object.assign({ actie: 'belang-voorstel' }, x));
  assert.ok(r.ok, 'voorstel: ' + (r.error || ''));
  const t = m.eco.zet(p, naar, { actie: 'belang-antwoord', id: r.id, antwoord: 'ja' });
  assert.ok(t.ok, 'tekenen: ' + (t.error || ''));
  return p.staat.deelnemingen.find(d => d.id === r.id);
}

/* ================= 1. geen zeggenschap ================= */

test('een aandeelhouder mag niet aan de knoppen van andermans zaak', () => {
  const { m, p, st, A } = opstelling();
  maand(m, p, 1);
  koop(m, p, 'boris', 'anna', { vestiging: A.id, deel: 40, prijs: 200000 });
  for (const wat of [{ prijs: 'hoog' }, { personeel: 1 }, { marketing: 5000 }, { onderhoud: 0 }]) {
    const r = m.eco.zet(p, 'boris', Object.assign({ actie: 'beleid', id: A.id }, wat));
    assert.equal(r.status, 404, 'boris heeft 40% en mag toch niets zetten');
  }
  assert.ok(m.eco.zet(p, 'anna', { actie: 'beleid', id: A.id, prijs: 'hoog' }).ok, 'de eigenaar wel');
  // en verkopen of sluiten al helemaal niet
  assert.equal(m.eco.zet(p, 'boris', { actie: 'sluiten', id: A.id }).status, 404);
  assert.equal(m.eco.zet(p, 'boris', { actie: 'veiling-start', soort: 'vestiging', vestiging: A.id, duur: 'kort' }).status, 404);
});

/* ================= 2. hoogstens 49% ================= */

test('meer dan de helft van een zaak kun je niet weggeven', () => {
  const { m, p, st, A } = opstelling(['anna', 'boris', 'cato']);
  maand(m, p, 1);
  assert.equal(m.eco.zet(p, 'anna', { actie: 'belang-voorstel', vestiging: A.id, houder: 'boris',
    deel: 50, prijs: 100000 }).status, 400);
  koop(m, p, 'anna', 'boris', { vestiging: A.id, houder: 'boris', deel: 30, prijs: 100000 });
  koop(m, p, 'anna', 'cato', { vestiging: A.id, houder: 'cato', deel: 19, prijs: 100000 });
  const derde = m.eco.zet(p, 'anna', { actie: 'belang-voorstel', vestiging: A.id, houder: 'cato',
    deel: 5, prijs: 10000 });
  assert.equal(derde.status, 409);
  assert.match(derde.error, /49/);
  assert.equal(m.eco.zicht(p, st, 'anna').vestigingen[0].eigenDeel, 51);
});

/* ================= 3. verlies deel je mee ================= */

test('een aandeelhouder deelt in de winst en net zo hard in het verlies', () => {
  const meting = (verpest) => {
    const { m, p, st, A } = opstelling();
    maand(m, p, 1);
    koop(m, p, 'boris', 'anna', { vestiging: A.id, deel: 40, prijs: 1 });
    // een zaak die verlies draait: geen personeel, dus geen omzet, wel lasten
    if (verpest) m.eco.zet(p, 'anna', { actie: 'beleid', id: A.id, personeel: 0, marketing: 150000 });
    const voor = st.geld.boris;
    maand(m, p, 1);
    const regel = st.laatste.anna.regels[0];
    return { resultaat: regel.resultaat, boris: st.geld.boris - voor, aandeelhouders: regel.aandeelhouders };
  };
  const goed = meting(false), slecht = meting(true);
  assert.ok(goed.resultaat > 0 && goed.boris > 0, 'winst wordt gedeeld: ' + Math.round(goed.boris));
  assert.ok(Math.abs(goed.boris - goed.resultaat * 0.4) < 2, 'en precies naar rato');
  assert.ok(slecht.resultaat < 0, 'de opstelling draait werkelijk verlies: ' + slecht.resultaat);
  assert.ok(slecht.boris < 0, 'en dan gaat er geld AF bij de aandeelhouder: ' + Math.round(slecht.boris));
  assert.ok(Math.abs(slecht.boris - slecht.resultaat * 0.4) < 2, 'ook naar rato');
  assert.equal(goed.aandeelhouders.length, 1, 'en het staat op het maandoverzicht van de eigenaar');
});

/* ================= 4. de optelsom klopt ================= */

test('een belang verplaatst waarde, het maakt er geen bij', () => {
  /* De makkelijkste fout in een laag die waarde verplaatst: de eigenaar telt
     zijn hele pand mee EN de aandeelhouder zijn deel, en dan staat dezelfde
     euro twee keer op de eindstand. */
  const zonder = opstelling();
  maand(zonder.m, zonder.p, 6);
  const s0 = zonder.m.eco.eindstand(zonder.p);
  const totaal0 = s0.reduce((n, x) => n + x.vermogen, 0);

  const met = opstelling();
  maand(met.m, met.p, 1);
  koop(met.m, met.p, 'boris', 'anna', { vestiging: met.A.id, deel: 40, prijs: 300000 });
  maand(met.m, met.p, 5);
  const s1 = met.m.eco.eindstand(met.p);
  const totaal1 = s1.reduce((n, x) => n + x.vermogen, 0);

  assert.ok(Math.abs(totaal1 - totaal0) < totaal0 * 0.02,
    'het totale vermogen aan tafel hoort nauwelijks te verschillen: ' + totaal0 + ' tegen ' + totaal1);
  // maar het is wel VERSCHOVEN
  const annaZonder = s0.find(x => x.codenaam === 'CN-anna').vermogen;
  const annaMet = s1.find(x => x.codenaam === 'CN-anna').vermogen;
  assert.ok(annaMet < annaZonder, 'anna heeft 40% van haar zaak weggegeven: ' + annaMet + ' tegen ' + annaZonder);
  const borisMet = s1.find(x => x.codenaam === 'CN-boris').vermogen;
  assert.ok(borisMet > s0.find(x => x.codenaam === 'CN-boris').vermogen, 'en boris heeft er iets voor teruggekregen');
  // en de waarde van het belang staat er ook echt als bedrag bij
  const belang = met.m.eco.zicht(met.p, met.st, 'boris').belangen[0];
  assert.ok(Math.abs(belang.mijnWaarde - waarde(met.st.vestigingen.anna[0]) * 0.4) < 2);
});

test('wat er wordt uitgekeerd houdt de eigenaar niet ook nog eens zelf', () => {
  /* Een laag die een resultaat VERDEELT is de makkelijkste plek om geld te
     drukken: de aandeelhouder krijgt zijn deel en de eigenaar houdt per ongeluk
     het hele bedrag. De waardetoets hierboven ziet dat niet -- die kijkt naar
     wat een pand waard is, en dit gaat over de KAS. Gemeten: het resultaat van
     de zaak hoort precies over de twee verdeeld te zijn, tot op de euro.

     Deze toets is er nadat een mutatie ("de eigenaar houdt toch alles") als
     enige van de tien de hele set groen liet. */
  const { m, p, st, A } = opstelling();
  maand(m, p, 1);
  koop(m, p, 'boris', 'anna', { vestiging: A.id, deel: 35, prijs: 1 });
  const voorA = st.geld.anna, voorB = st.geld.boris;
  maand(m, p, 1);
  const resultaat = st.laatste.anna.regels[0].resultaat;
  const naarA = st.geld.anna - voorA, naarB = st.geld.boris - voorB;
  assert.ok(resultaat > 0, 'de zaak draait winst: ' + resultaat);
  assert.ok(Math.abs(naarA + naarB - resultaat) < 1,
    'samen hoort dat precies het resultaat te zijn: ' + Math.round(naarA) + ' + ' + Math.round(naarB) +
    ' = ' + Math.round(naarA + naarB) + ' tegenover ' + resultaat);
  assert.ok(Math.abs(naarB - resultaat * 0.35) < 1, 'en boris krijgt precies 35%');
  assert.ok(Math.abs(naarA - resultaat * 0.65) < 1, 'en anna houdt de andere 65%');
});

test('de prijs gaat van de koper naar de eigenaar, en verder nergens heen', () => {
  const { m, p, st, A } = opstelling();
  maand(m, p, 1);
  const voorA = st.geld.anna, voorB = st.geld.boris;
  koop(m, p, 'boris', 'anna', { vestiging: A.id, deel: 25, prijs: 175000 });
  assert.equal(Math.round(st.geld.anna - voorA), 175000);
  assert.equal(Math.round(st.geld.boris - voorB), -175000);
});

/* ================= 5. het belang hangt aan de vestiging ================= */

test('wie zijn zaak verkoopt, schudt zijn aandeelhouders er niet mee af', () => {
  const { m, p, st, A } = opstelling(['anna', 'boris', 'cato']);
  maand(m, p, 1);
  const d = koop(m, p, 'boris', 'anna', { vestiging: A.id, deel: 40, prijs: 200000 });
  const v = m.eco.zet(p, 'anna', { actie: 'veiling-start', soort: 'vestiging', vestiging: A.id, duur: 'kort' });
  m.eco.zet(p, 'cato', { actie: 'veiling-bod', id: v.id, bedrag: 600000 });
  maand(m, p, 2);
  assert.equal(st.veilingen[0].winnaar, 'cato');
  assert.equal(d.status, 'loopt', 'het belang blijft staan');
  const voor = st.geld.boris;
  maand(m, p, 1);
  assert.ok(st.geld.boris !== voor, 'en boris deelt nog steeds mee in het resultaat');
  const beeld = m.eco.zicht(p, st, 'boris').belangen[0];
  assert.equal(beeld.tegenpartij, 'CN-cato', 'zijn tegenpartij is nu de nieuwe eigenaar');
});

test('een belang kopen in een zaak die niet meer bestaat kan niet', () => {
  const { m, p, st, A } = opstelling();
  maand(m, p, 1);
  const r = m.eco.zet(p, 'boris', { actie: 'belang-voorstel', vestiging: A.id, deel: 20, prijs: 100000 });
  assert.ok(r.ok);
  m.eco.zet(p, 'anna', { actie: 'sluiten', id: A.id });
  const t = m.eco.zet(p, 'anna', { actie: 'belang-antwoord', id: r.id, antwoord: 'ja' });
  assert.equal(t.status, 409);
  assert.match(t.error, /bestaat niet meer/);
});

/* ================= het onderhandelen ================= */

test('je tekent je eigen voorstel niet, en een tegenvoorstel draait de beurt om', () => {
  const { m, p, st, A } = opstelling();
  maand(m, p, 1);
  const r = m.eco.zet(p, 'boris', { actie: 'belang-voorstel', vestiging: A.id, deel: 30, prijs: 100000 });
  assert.equal(m.eco.zet(p, 'boris', { actie: 'belang-antwoord', id: r.id, antwoord: 'ja' }).status, 409);
  const tegen = m.eco.zet(p, 'anna', { actie: 'belang-antwoord', id: r.id, antwoord: 'tegen', deel: 30, prijs: 400000 });
  assert.ok(tegen.ok && tegen.ronde === 2);
  assert.equal(m.eco.zet(p, 'anna', { actie: 'belang-antwoord', id: r.id, antwoord: 'ja' }).status, 409);
  const voorA = st.geld.anna;
  assert.ok(m.eco.zet(p, 'boris', { actie: 'belang-antwoord', id: r.id, antwoord: 'ja' }).ok);
  assert.equal(Math.round(st.geld.anna - voorA), 400000, 'het tegenvoorstel is wat er getekend wordt');
});

test('een tegenvoorstel gaat door dezelfde zeef als een eerste voorstel', () => {
  const { m, p, st, A } = opstelling();
  maand(m, p, 1);
  const r = m.eco.zet(p, 'boris', { actie: 'belang-voorstel', vestiging: A.id, deel: 30, prijs: 100000 });
  const tegen = m.eco.zet(p, 'anna', { actie: 'belang-antwoord', id: r.id, antwoord: 'tegen', deel: 80, prijs: 400000 });
  assert.equal(tegen.status, 400, 'tachtig procent hoort ook in ronde twee te stuiten');
  assert.equal(st.deelnemingen[0].deel, 30, 'en het voorstel is niet stil veranderd');
});

test('een derde ziet niet wat er tussen twee anderen is afgesproken', () => {
  const { m, p, st, A } = opstelling(['anna', 'boris', 'cato']);
  maand(m, p, 1);
  koop(m, p, 'boris', 'anna', { vestiging: A.id, deel: 33, prijs: 654321 });
  const cato = JSON.stringify(m.eco.zicht(p, st, 'cato'));
  assert.ok(!/654321/.test(cato), 'cato hoort de prijs niet te zien');
  assert.equal(m.eco.zicht(p, st, 'cato').belangen.length, 0);
  for (const laag of ['kijker', 'publiek'])
    assert.ok(!/654321/.test(JSON.stringify(m.spel.zicht[laag](p, st))), laag + ' evenmin');
  // en met een geraden id komt hij er niet tussen
  assert.equal(m.eco.zet(p, 'cato', { actie: 'belang-antwoord', id: st.deelnemingen[0].id, antwoord: 'ja' }).status, 404);
});

test('een belang kopen zonder geld kan niet', () => {
  const { m, p, st, A } = opstelling();
  maand(m, p, 1);
  const r = m.eco.zet(p, 'boris', { actie: 'belang-voorstel', vestiging: A.id, deel: 20, prijs: 4000000 });
  st.geld.boris = 1000;
  const t = m.eco.zet(p, 'anna', { actie: 'belang-antwoord', id: r.id, antwoord: 'ja' });
  assert.equal(t.status, 400);
  assert.equal(st.deelnemingen[0].status, 'voorgesteld', 'en het voorstel blijft gewoon liggen');
});

test('deelnemen is een vrije actie', () => {
  const m = maakMagnaat();
  for (const actie of ['belang-voorstel', 'belang-antwoord'])
    assert.ok(m.spel.buitenBeurt.includes(actie), actie + ' hoort buiten de beurt te mogen');
});
