const test = require('node:test');
const assert = require('node:assert/strict');
const maak = require('../server/kern/magnaat-economie');

function motor(motorklant) {
  const wereld = {};
  let saves = 0;
  const economie = maak({ wereldState: () => wereld, save: () => { saves += 1; }, motorklant });
  return { wereld, economie, saves: () => saves };
}

function bedrijf(overzicht, id) {
  return overzicht.bedrijven.find(b => b.id === id);
}

test('de openingsbalans en iedere economische journaalpost zijn exact in balans', () => {
  const { wereld, economie } = motor();
  const start = economie.overzicht();
  assert.equal(start.grootboek.controle.inBalans, true);
  const dag = economie.volgendeDag('econoom', 'balans-dag-1');
  assert.equal(dag.grootboek.controle.verschil, 0);
  for (const post of wereld.economie.journaal) {
    assert.equal(post.debet, post.credit, post.omschrijving);
    assert.ok(Number.isInteger(post.debet));
    assert.ok(post.regels.length >= 2);
  }
});

test('het economiebeeld maakt de actieve rekenlaag en veilige terugval zichtbaar', () => {
  const lokaal = motor({ aan: false, status: () => ({ aan: false, circuit: 'niet-van-toepassing' }) }).economie.overzicht();
  assert.equal(lokaal.rekenlaag.actief, 'javascript-lokaal');
  const rust = motor({ aan: true, status: () => ({ aan: true, circuit: 'gesloten', actief: 2, maxTegelijk: 32 }) }).economie.overzicht();
  assert.deepEqual(rust.rekenlaag, {
    actief: 'rust-native', circuit: 'gesloten', gelijktijdig: 2, grens: 32,
    terugval: 'atomair naar dezelfde deterministische JavaScript-regels'
  });
});

test('dezelfde beginsituatie en besluiten geven reproduceerbaar dezelfde economie', () => {
  const a = motor().economie;
  const b = motor().economie;
  a.beslis('a', { prijs: 117, personeelDoel: 21, loonMaand: 3650, trainingDag: 1800, bestelling: 340, impactPct: 1.4 });
  b.beslis('b', { prijs: 117, personeelDoel: 21, loonMaand: 3650, trainingDag: 1800, bestelling: 340, impactPct: 1.4 });
  const ad = a.volgendeDag('a', 'zelfde-1');
  const bd = b.volgendeDag('b', 'zelfde-1');
  assert.deepEqual(ad.macro, bd.macro);
  assert.deepEqual(ad.bedrijven, bd.bedrijven);
  assert.deepEqual(ad.grootboek.controle, bd.grootboek.controle);
});

test('een herhaald commando verwerkt nooit tweemaal dezelfde economische dag', () => {
  const { economie } = motor();
  const eerste = economie.volgendeDag('econoom', 'idempotent-1');
  const boekingen = eerste.grootboek.boekingen;
  const tweede = economie.volgendeDag('econoom', 'idempotent-1');
  assert.equal(eerste.dag, 1);
  assert.equal(tweede.dag, 1);
  assert.equal(tweede.herhaald, true);
  assert.equal(tweede.grootboek.boekingen, boekingen);
});

test('prijs, capaciteit en voorraad begrenzen aantoonbaar de marktuitkomst', () => {
  const basis = motor().economie;
  const prijsvechter = motor().economie;
  prijsvechter.beslis('directie', { prijs: 79 });
  const normaal = basis.volgendeDag('directie', 'basis-1');
  const laag = prijsvechter.volgendeDag('directie', 'laag-1');
  const n = bedrijf(normaal, 'praktijk');
  const l = bedrijf(laag, 'praktijk');
  assert.ok(l.vraagVandaag > n.vraagVandaag, 'een lagere prijs verhoogt vraag via de elasticiteit');
  for (const b of laag.bedrijven) {
    assert.ok(b.verkopenVandaag <= b.vraagVandaag);
    assert.ok(b.verkopenVandaag <= b.capaciteitVandaag);
  }
});

test('leveranciersuitval en arbeidstekort lopen via afzonderlijke economische regels', () => {
  const keten = motor().economie;
  keten.kiesSchok('scenarioleider', 'leveranciersuitval');
  const uitval = keten.volgendeDag('scenarioleider', 'uitval-1');
  assert.equal(uitval.actieveSchok.id, 'leveranciersuitval');
  assert.ok(bedrijf(uitval, 'praktijk').levergraad < 100);
  assert.ok(uitval.macro.aanbodIndex < 100);

  const arbeid = motor().economie;
  arbeid.beslis('directie', { personeelDoel: 30 });
  arbeid.kiesSchok('scenarioleider', 'arbeidstekort');
  const krap = arbeid.volgendeDag('scenarioleider', 'arbeid-1');
  assert.equal(krap.actieveSchok.id, 'arbeidstekort');
  assert.ok(bedrijf(krap, 'praktijk').personeel < 30, 'niet iedere vacature kan direct worden gevuld');
});

test('werk uit de echte RTG-missielaag verhoogt pas in de volgende dag de productiviteit', () => {
  const zonder = motor().economie;
  const met = motor().economie;
  const effect = met.registreerWerk('medewerker', {
    id: 'taak-1', functieId: 'supplier-operatie', spelvorm: 'operatie', punten: 375,
    stappen: [{ soort: 'software' }, { soort: 'keuze' }, { soort: 'keuze' }, { soort: 'keuze' }]
  });
  assert.equal(effect.soort, 'productiviteit');
  assert.equal(met.overzicht().werkvoorraad.aantal, 1);
  const a = zonder.volgendeDag('systeem', 'zonder-werk');
  const b = met.volgendeDag('systeem', 'met-werk');
  assert.ok(bedrijf(b, 'praktijk').productiviteit > bedrijf(a, 'praktijk').productiviteit);
  assert.equal(b.werkvoorraad.aantal, 0, 'verwerkt werk wordt niet een tweede dag gratis hergebruikt');
});

test('leningen creëren een bankvordering en bedrijfsschuld zonder balansverschil', () => {
  const { wereld, economie } = motor();
  const r = economie.beslis('directie', { lening: 100000 });
  assert.equal(bedrijf(r, 'praktijk').schuld, 10000000);
  assert.equal(r.grootboek.controle.verschil, 0);
  assert.ok(wereld.economie.rekeningen['bank.leningen'].saldo > 0);
  assert.ok(wereld.economie.rekeningen['praktijk.schuld'].saldo < 0);
});

test('een onbereikbare Rust-motor laat geen halve dag achter en valt exact terug op JavaScript', async () => {
  const normaal = motor({ aan: false }).economie;
  const storing = motor({ aan: true, async markt() { throw new Error('teststoring'); } }).economie;
  for (const e of [normaal, storing]) {
    e.beslis('directie', { personeelDoel: 30, loonMaand: 3650, bestelling: 340 });
    e.kiesSchok('scenarioleider', 'arbeidstekort');
  }
  const verwacht = normaal.volgendeDag('directie', 'fallback-1');
  const oudeFout = console.error;
  console.error = () => {};
  let werkelijk;
  try { werkelijk = await storing.volgendeDagAsync('directie', 'fallback-1'); }
  finally { console.error = oudeFout; }
  assert.equal(werkelijk.dag, 1);
  assert.deepEqual(werkelijk.macro, verwacht.macro);
  assert.deepEqual(werkelijk.bedrijven, verwacht.bedrijven);
  assert.deepEqual(werkelijk.grootboek, verwacht.grootboek);
});

test('een aanhoudende Rust-storing begrenst foutlogs en blijft veilig doorrekenen', async () => {
  const { economie } = motor({ aan: true, async markt() { throw new Error('teststoring'); } });
  const oudeFout = console.error;
  const meldingen = [];
  console.error = (...delen) => meldingen.push(delen);
  try {
    for (let dag = 1; dag <= 6; dag++) {
      const antwoord = await economie.volgendeDagAsync('econoom', `storing-${dag}`);
      assert.equal(antwoord.dag, dag);
      assert.equal(antwoord.grootboek.controle.verschil, 0);
    }
  } finally {
    console.error = oudeFout;
  }
  assert.equal(meldingen.length, 1, 'een storing mag de logs niet onbeperkt vullen');
});

test('een strategie die tijdens een Rust-aanvraag binnenkomt gaat bij terugval niet verloren', async () => {
  let weiger;
  const { economie } = motor({
    aan: true,
    markt() { return new Promise((resolve, reject) => { weiger = reject; }); }
  });
  const dagBelofte = economie.volgendeDagAsync('econoom', 'gelijktijdig-1');
  while (!weiger) await new Promise(resolve => setImmediate(resolve));
  const besluit = economie.beslis('directie', { prijs: 79 });
  assert.equal(besluit.strategie.prijs, 7900);
  weiger(new Error('teststoring na gelijktijdig besluit'));
  const oudeFout = console.error;
  console.error = () => {};
  let dag;
  try { dag = await dagBelofte; }
  finally { console.error = oudeFout; }
  assert.equal(dag.dag, 1);
  assert.equal(dag.strategie.prijs, 7900, 'het besluit dat tijdens de await kwam blijft de waarheid');
  assert.equal(dag.grootboek.controle.verschil, 0);
});
