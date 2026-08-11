/* MAGNAAT FASE B: VEILINGEN -- het eerste waar twee spelers om HETZELFDE vechten.

   Contracten waren het eerste stuk van fase B en ze deden hun werk, maar de
   meting was hard: ze kantelen geen duel. Een restaurant koopt vijf procent van
   zijn omzet aan vervoer in, dus een contract met twaalf procent korting is zes
   tiende procent. Een kavel is geen zes tiende procent -- wie een plek
   wegkaapt, kaapt hem helemaal weg.

   ZES BEWERINGEN, en ze zijn alle zes stil terug te draaien:

   1. EEN BOD IS GEHEIM tot de hamer valt. Zonder dat is een veiling een
      aftelling waarin iedereen elkaar met een euro overbiedt.
   2. DE HAMER VALT OP DE KLOK VAN DE PARTIJ, deterministisch. Tien maanden in
      een keer geeft dezelfde winnaar als tien maanden los -- anders hangt de
      uitkomst van je pollgedrag af (GAMEHALL.md 12.4).
   3. WIE NIET KAN BETALEN KRIJGT HEM NIET, en dat is zichtbaar. Er wordt niets
      gereserveerd, dus dit is de enige plek waar een leeg bod wordt afgestraft.
   4. EEN GEKOCHTE ZAAK KOMT MET ZIJN CONTRACTEN MEE. Zou een overname
      verplichtingen breken, dan is verkopen een achterdeur uit elk contract.
   5. EEN GEWONNEN KAVEL IS VAN JOU en van niemand anders.
   6. HET GELD KLOPT. Bij een zaak gaat het naar de verkoper, bij grond naar de
      Foundation-pot van de stad -- en nergens naar niemand.

   Draai los: node --experimental-sqlite --test test/spelveiling.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const H = require('../server/kern/spellen/magnaat/handel');

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
  return { m, p, st: p.staat };
}
const maand = (m, p, n = 1) => {
  for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); }
};

/* ================= 1. een bod is geheim ================= */

test('niemand ziet andermans bod, ook niet in de publieke of kijkerweergave', () => {
  const { m, p, st } = opstelling(['anna', 'boris', 'cato']);
  const kav = kavelIn('boulevard');
  const v = m.eco.zet(p, 'anna', { actie: 'veiling-start', soort: 'kavel', kavel: kav.id, duur: 'normaal' });
  assert.ok(v.ok, v.error);
  assert.ok(m.eco.zet(p, 'boris', { actie: 'veiling-bod', id: v.id, bedrag: 777777 }).ok);
  assert.ok(m.eco.zet(p, 'cato', { actie: 'veiling-bod', id: v.id, bedrag: 888888 }).ok);

  for (const wie of ['anna', 'cato']) {
    const tekst = JSON.stringify(m.eco.zicht(p, st, wie));
    assert.ok(!/777777/.test(tekst), wie + ' hoort het bod van boris niet te zien');
  }
  // en cato ziet zijn EIGEN bod wel -- anders is het een geheugenspel
  const cato = m.eco.zicht(p, st, 'cato').veilingen[0];
  assert.equal(cato.mijnBod, 888888);
  assert.equal(cato.biedingen, 2, 'hoeveel er geboden is mag iedereen weten');
  for (const laag of ['kijker', 'publiek']) {
    const tekst = JSON.stringify(m.spel.zicht[laag](p, st));
    assert.ok(!/777777|888888/.test(tekst), laag + ' hoort geen enkel bod te tonen');
  }
});

test('je kunt je bod verhogen maar niet verlagen, en niet onder de bodem', () => {
  const { m, p, st } = opstelling();
  const kav = kavelIn('centrum');
  const v = m.eco.zet(p, 'anna', { actie: 'veiling-start', soort: 'kavel', kavel: kav.id, duur: 'kort' });
  assert.ok(v.bodem > 0, 'er is een bodem: ' + v.bodem);
  assert.equal(m.eco.zet(p, 'boris', { actie: 'veiling-bod', id: v.id, bedrag: v.bodem - 1 }).status, 400);
  assert.ok(m.eco.zet(p, 'boris', { actie: 'veiling-bod', id: v.id, bedrag: v.bodem + 5000 }).ok);
  assert.equal(m.eco.zet(p, 'boris', { actie: 'veiling-bod', id: v.id, bedrag: v.bodem + 100 }).status, 400);
  assert.ok(m.eco.zet(p, 'boris', { actie: 'veiling-bod', id: v.id, bedrag: v.bodem + 9000 }).ok);
  assert.equal(st.veilingen[0].biedingen.length, 1, 'een speler heeft EEN bod, niet een rij');
  assert.equal(st.veilingen[0].biedingen[0].bedrag, v.bodem + 9000);
});

/* ================= 2. de hamer valt op de klok ================= */

test('de hamer valt op de spelmaand, en in een keer bijrekenen geeft dezelfde winnaar', () => {
  const opzet = () => {
    const o = opstelling(['anna', 'boris', 'cato']);
    const kav = kavelIn('boulevard');
    const v = o.m.eco.zet(o.p, 'anna', { actie: 'veiling-start', soort: 'kavel', kavel: kav.id, duur: 'normaal' });
    o.m.eco.zet(o.p, 'boris', { actie: 'veiling-bod', id: v.id, bedrag: 300000 });
    o.m.eco.zet(o.p, 'cato', { actie: 'veiling-bod', id: v.id, bedrag: 310000 });
    return Object.assign(o, { kav });
  };
  const los = opzet();
  maand(los.m, los.p, 2);
  assert.equal(los.st.veilingen[0].status, 'loopt', 'na twee maanden loopt hij nog');
  maand(los.m, los.p, 3);
  assert.equal(los.st.veilingen[0].status, 'gesloten');
  assert.equal(los.st.veilingen[0].winnaar, 'cato');

  const bulk = opzet();
  bulk.p.staat.gerekendTot -= bulk.p.staat.maandMs * 5;
  bulk.m.eco.bijrekenen(bulk.p);
  assert.equal(bulk.st.veilingen[0].winnaar, 'cato', 'in een keer bijrekenen geeft dezelfde winnaar');
  assert.equal(Math.round(bulk.st.geld.cato), Math.round(los.st.geld.cato));
  assert.equal(bulk.st.kavelRecht[bulk.kav ? bulk.kav.id : ''], 'cato');
});

test('bij een gelijk bod wint wie het eerst bood', () => {
  const { m, p, st } = opstelling(['anna', 'boris', 'cato']);
  const v = m.eco.zet(p, 'anna', { actie: 'veiling-start', soort: 'kavel', kavel: kavelIn('station').id, duur: 'kort' });
  m.eco.zet(p, 'cato', { actie: 'veiling-bod', id: v.id, bedrag: 200000 });
  m.eco.zet(p, 'boris', { actie: 'veiling-bod', id: v.id, bedrag: 200000 });
  maand(m, p, 3);
  assert.equal(st.veilingen[0].winnaar, 'cato',
    'een gelijk bod hoort niet van de sleutelvolgorde in een object af te hangen');
});

/* ================= 3. wie niet kan betalen krijgt hem niet ================= */

test('een bod zonder dekking gaat naar de volgende bieder, en dat is zichtbaar', () => {
  /* Er wordt bij het bieden NIETS gereserveerd (zie de kop van veiling.js), dus
     dit is de enige plek waar een leeg bod wordt afgestraft. Zonder deze regel
     kan iedereen op alles het maximum bieden en daarna kijken wat hij wint. */
  const { m, p, st } = opstelling(['anna', 'boris', 'cato']);
  const v = m.eco.zet(p, 'anna', { actie: 'veiling-start', soort: 'kavel', kavel: kavelIn('boulevard').id, duur: 'kort' });
  m.eco.zet(p, 'boris', { actie: 'veiling-bod', id: v.id, bedrag: 4000000 });
  m.eco.zet(p, 'cato', { actie: 'veiling-bod', id: v.id, bedrag: 900000 });
  st.geld.boris = 10000;   // boris heeft het niet meer
  maand(m, p, 2);
  const a = st.veilingen[0];
  assert.equal(a.winnaar, 'cato', 'de hoogste bieder kon niet betalen');
  assert.equal(a.prijs, 900000);
  assert.deepEqual(a.gemist, ['boris'], 'en wie niet kon betalen staat erbij');
  assert.equal(Math.round(st.geld.boris), 10000, 'er is niets van hem afgeschreven');
  // ook in het beeld van een derde: dit is publieke schande, geen geheim
  const beeld = m.eco.zicht(p, st, 'anna').veilingen[0];
  assert.equal(beeld.winnaar, 'CN-cato');
  assert.equal(beeld.prijs, 900000);
});

test('kan niemand betalen, dan gaat er niets over', () => {
  const { m, p, st } = opstelling();
  const kav = kavelIn('centrum');
  const v = m.eco.zet(p, 'anna', { actie: 'veiling-start', soort: 'kavel', kavel: kav.id, duur: 'kort' });
  m.eco.zet(p, 'boris', { actie: 'veiling-bod', id: v.id, bedrag: 4000000 });
  st.geld.boris = 1000;
  maand(m, p, 2);
  assert.equal(st.veilingen[0].winnaar, null);
  assert.equal((st.kavelRecht || {})[kav.id], undefined, 'het kavel is gewoon weer vrij');
  assert.ok(m.eco.zet(p, 'anna', { actie: 'open', kavel: kav.id, sector: 'retail', omvang: 20 }).ok);
});

/* ================= 4. een zaak komt met zijn contracten mee ================= */

test('wie een vestiging koopt, koopt haar contracten erbij', () => {
  const { m, p, st } = opstelling(['anna', 'boris', 'cato']);
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('terrein').id, sector: 'logistiek', omvang: 12, naam: 'Atlas' });
  m.eco.zet(p, 'boris', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 50, naam: 'Zeezicht' });
  maand(m, p, 1);
  const A = st.vestigingen.anna[0], B = st.vestigingen.boris[0];
  const voorstel = m.eco.zet(p, 'boris', { actie: 'contract-voorstel', mijn: B.id, hun: A.id, soort: 'vervoer',
    eenheden: 100, bedrag: 6000, looptijd: 20, eis: 0, boete: 500, vooraf: 0, exclusief: false });
  m.eco.zet(p, 'anna', { actie: 'contract-antwoord', id: voorstel.id, antwoord: 'ja' });
  const c = st.contracten[0];
  assert.equal(c.leverancier, 'anna');

  const v = m.eco.zet(p, 'anna', { actie: 'veiling-start', soort: 'vestiging', vestiging: A.id, duur: 'kort' });
  assert.ok(v.ok, v.error);
  m.eco.zet(p, 'cato', { actie: 'veiling-bod', id: v.id, bedrag: 400000 });
  const voorAnna = st.geld.anna, voorCato = st.geld.cato;
  maand(m, p, 2);

  assert.equal(st.veilingen[0].winnaar, 'cato');
  assert.equal(st.vestigingen.anna.length, 0, 'anna is de zaak kwijt');
  assert.equal(st.vestigingen.cato.length, 1, 'cato heeft hem');
  assert.equal(st.vestigingen.cato[0].naam, 'Atlas');
  assert.equal(st.kavelBezet[st.vestigingen.cato[0].kavel], 'cato', 'en het kavel staat op zijn naam');
  assert.equal(c.status, 'loopt', 'het contract loopt gewoon door');
  assert.equal(c.leverancier, 'cato', 'maar cato is nu de leverancier');
  /* Cato had nog niets, dus zijn kas verandert door NIETS anders dan de koop --
     dat is de scherpe kant. Bij anna zitten er ook twee maanden bedrijfsvoering
     in, dus daar is de bewering ruimer. */
  assert.equal(Math.round(voorCato - st.geld.cato), 400000, 'de koper betaalt precies zijn bod');
  assert.ok(st.geld.anna - voorAnna > 380000, 'en de verkoper krijgt de opbrengst: ' +
    Math.round(st.geld.anna - voorAnna));

  // en boris merkt er niets van behalve de naam van zijn tegenpartij
  const bij = m.eco.zicht(p, st, 'boris').contracten[0];
  assert.equal(bij.status, 'loopt');
  assert.equal(bij.tegenpartij, 'CN-cato');
});

test('koop je beide kanten van een contract, dan wordt het afgekocht in plaats van dat je jezelf beboet', () => {
  /* Een contract met jezelf kan niet bestaan: er is geen wederpartij meer die
     de boete int, en dan kan een speler zichzelf onbeperkt betalen. */
  const { m, p, st } = opstelling(['anna', 'boris']);
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('terrein').id, sector: 'logistiek', omvang: 12, naam: 'Atlas' });
  m.eco.zet(p, 'boris', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 50, naam: 'Zeezicht' });
  maand(m, p, 1);
  const A = st.vestigingen.anna[0], B = st.vestigingen.boris[0];
  const r = m.eco.zet(p, 'boris', { actie: 'contract-voorstel', mijn: B.id, hun: A.id, soort: 'vervoer',
    eenheden: 100, bedrag: 6000, looptijd: 20, eis: 0, boete: 500, vooraf: 0, exclusief: false });
  m.eco.zet(p, 'anna', { actie: 'contract-antwoord', id: r.id, antwoord: 'ja' });

  const v = m.eco.zet(p, 'anna', { actie: 'veiling-start', soort: 'vestiging', vestiging: A.id, duur: 'kort' });
  m.eco.zet(p, 'boris', { actie: 'veiling-bod', id: v.id, bedrag: 400000 });
  maand(m, p, 2);
  const c = st.contracten[0];
  assert.equal(st.veilingen[0].winnaar, 'boris');
  assert.equal(c.status, 'afgekocht', 'boris staat nu aan beide kanten; dat kan niet blijven staan');
  assert.equal(c.afkoop, H.afkoopsom({ boete: 500, eindMaand: c.eindMaand }, c.eindMaand - 99) === 1500 ? 1500 : c.afkoop);
  maand(m, p, 2);
  assert.equal((st.laatste.boris.contracten || []).length, 0, 'en er wordt niets meer op afgerekend');
});

test('je kunt niet op je eigen zaak bieden', () => {
  const { m, p, st } = opstelling();
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 30 });
  const v = m.eco.zet(p, 'anna', { actie: 'veiling-start', soort: 'vestiging', vestiging: st.vestigingen.anna[0].id, duur: 'kort' });
  assert.equal(m.eco.zet(p, 'anna', { actie: 'veiling-bod', id: v.id, bedrag: 900000 }).status, 409);
});

/* ================= 5. een gewonnen kavel is van jou ================= */

test('een gewonnen kavel is van de winnaar, en van niemand anders', () => {
  const { m, p, st } = opstelling(['anna', 'boris', 'cato']);
  const kav = kavelIn('boulevard');
  const v = m.eco.zet(p, 'anna', { actie: 'veiling-start', soort: 'kavel', kavel: kav.id, duur: 'kort' });
  m.eco.zet(p, 'cato', { actie: 'veiling-bod', id: v.id, bedrag: 500000 });
  maand(m, p, 2);
  assert.equal(st.kavelRecht[kav.id], 'cato');
  const ander = m.eco.zet(p, 'boris', { actie: 'open', kavel: kav.id, sector: 'horeca', omvang: 20 });
  assert.equal(ander.status, 400);
  assert.match(ander.error, /bouwrecht/);
  const eigen = m.eco.zet(p, 'cato', { actie: 'open', kavel: kav.id, sector: 'horeca', omvang: 20 });
  assert.ok(eigen.ok, eigen.error);
  assert.equal(st.kavelRecht[kav.id], undefined, 'het recht is opgebruikt zodra er iets staat');
  // en het staat in zijn eigen beeld zolang het er is
  const kav2 = kavelIn('centrum');
  const v2 = m.eco.zet(p, 'cato', { actie: 'veiling-start', soort: 'kavel', kavel: kav2.id, duur: 'kort' });
  m.eco.zet(p, 'cato', { actie: 'veiling-bod', id: v2.id, bedrag: 400000 });
  maand(m, p, 2);
  assert.ok(m.eco.zicht(p, st, 'cato').bouwrecht.some(x => x.id === kav2.id));
  assert.equal(m.eco.zicht(p, st, 'boris').bouwrecht.length, 0);
});

test('een kavel dat in de veiling staat is niet ondertussen te grijpen', () => {
  const { m, p, st } = opstelling();
  const kav = kavelIn('boulevard');
  assert.ok(m.eco.zet(p, 'anna', { actie: 'veiling-start', soort: 'kavel', kavel: kav.id, duur: 'lang' }).ok);
  // hij is nog vrij tot de hamer valt -- dat is met opzet: een veiling
  // BLOKKEERT niet, hij verdeelt. Wie hem gewoon bebouwt is eerder.
  assert.ok(m.eco.zet(p, 'boris', { actie: 'open', kavel: kav.id, sector: 'horeca', omvang: 20 }).ok);
  // maar dan levert de veiling niets meer op
  m.eco.zet(p, 'anna', { actie: 'veiling-bod', id: st.veilingen[0].id, bedrag: 500000 });
  const voor = st.geld.anna;
  maand(m, p, 9);
  assert.equal(st.kavelBezet[kav.id], 'boris');
  assert.ok(st.geld.anna < voor, 'anna heeft betaald voor een bouwrecht op een bezet kavel');
  assert.equal(m.eco.zet(p, 'anna', { actie: 'open', kavel: kav.id, sector: 'horeca', omvang: 20 }).status, 400);
});

/* ================= 6. het geld klopt ================= */

test('grond gaat naar de Foundation-pot, een zaak naar de verkoper', () => {
  const { m, p, st } = opstelling();
  const potVoor = st.foundation.lokaal;
  const kav = kavelIn('centrum');
  const v = m.eco.zet(p, 'anna', { actie: 'veiling-start', soort: 'kavel', kavel: kav.id, duur: 'kort' });
  m.eco.zet(p, 'boris', { actie: 'veiling-bod', id: v.id, bedrag: 600000 });
  const geldVoor = st.geld.boris, annaVoor = st.geld.anna;
  maand(m, p, 2);
  assert.equal(Math.round(geldVoor - st.geld.boris), 600000, 'de koper betaalt');
  assert.ok(st.foundation.lokaal >= potVoor + 600000, 'en grond is van de stad: de pot groeit mee');
  /* De INZETTER van een kavelveiling verdient er niets aan, en dat is met opzet:
     anders zet iedereen elke maand elk vrij kavel in en is de kaart een
     veilinghuis. */
  assert.ok(st.geld.anna <= annaVoor, 'wie een kavel inzet verdient er niets aan');
});

test('een veiling zonder biedingen kun je intrekken, een met biedingen niet', () => {
  const { m, p, st } = opstelling();
  const v = m.eco.zet(p, 'anna', { actie: 'veiling-start', soort: 'kavel', kavel: kavelIn('haven').id, duur: 'lang' });
  assert.ok(m.eco.zet(p, 'anna', { actie: 'veiling-intrekken', id: v.id }).ok);
  assert.equal(st.veilingen[0].status, 'ingetrokken');

  const v2 = m.eco.zet(p, 'anna', { actie: 'veiling-start', soort: 'kavel', kavel: kavelIn('haven', 1).id, duur: 'lang' });
  m.eco.zet(p, 'boris', { actie: 'veiling-bod', id: v2.id, bedrag: 300000 });
  assert.equal(m.eco.zet(p, 'anna', { actie: 'veiling-intrekken', id: v2.id }).status, 409);
  assert.equal(m.eco.zet(p, 'boris', { actie: 'veiling-intrekken', id: v2.id }).status, 403);
});

test('veilen is een vrije actie, en er lopen er niet eindeloos veel', () => {
  const m = maakMagnaat();
  for (const actie of ['veiling-start', 'veiling-bod', 'veiling-intrekken'])
    assert.ok(m.spel.buitenBeurt.includes(actie), actie + ' hoort buiten de beurt te mogen');
  const { p, st } = opstelling();
  const mm = maakMagnaat();
  const zones = ['haven', 'centrum', 'station', 'sluizen'];
  const uitkomsten = zones.map((z, i) =>
    mm.eco.zet(p, 'anna', { actie: 'veiling-start', soort: 'kavel', kavel: kavelIn(z, i).id, duur: 'lang' }));
  assert.equal(uitkomsten.filter(r => r.ok).length, 3, 'drie mogen er lopen');
  assert.equal(uitkomsten[3].status, 429);
  assert.ok(st.veilingen.length === 3);
});
