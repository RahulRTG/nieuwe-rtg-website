/* MAGNAAT FASE B: CONTRACTEN -- spelers die elkaar werkelijk raken.

   Fase A eindigde met een meting die niet opgelost was: `scripts/magnaat-
   strateeg.js` liet zien dat wie zich op een sector stort wint van wie spreidt,
   en de oorzaak was dat een duel van twee op 144 kavels GEEN SCHAARSTE kent --
   de spelers lopen elkaar nooit tegen het lijf. Een contract is de eerste plek
   waar dat wel gebeurt.

   WAT HIER ONDER TOETS STAAT ZIJN DE BEWERINGEN DIE DE LAAG DRAGEN, en ze zijn
   alle zes stil terug te draaien:

   1. EEN CONTRACT VERANDERT DE CIJFERS. Zonder dat is het een handtekening in
      een chatvenster. De afnemer ziet zijn inkooppost dalen, de leverancier
      ziet omzet die niet van de straat komt.
   2. LEVERING GAAT VOOR VRIJE VERKOOP, en dat is wat een contract DUUR maakt.
      Wie zich vol tekent, ziet zijn eigen klanten aan de deur staan.
   3. WIE TEKORT KOMT, BETAALT. Pro rata voor wat er geleverd is, plus de boete.
      Ook wie levert maar de kwaliteitseis niet haalt.
   4. DE KLOK BLIJFT DETERMINISTISCH. Dat is de eis onder GAMEHALL.md 12.4 en
      een boete die van de volgorde afhangt zou hem breken.
   5. HET GELD KLOPT. Elke euro die de ene speler verlaat komt bij de andere aan.
      Een contractlaag is de makkelijkste plek om per ongeluk geld te drukken.
   6. EEN DERDE ZIET DE VOORWAARDEN NIET. Zodra er onderhandeld wordt, is
      "iedereen ziet alles" niet meer waar -- de waarschuwing stond al in de
      descriptor voordat deze laag bestond.

   Draai los: node --experimental-sqlite --test test/spelhandel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const H = require('../server/kern/spellen/magnaat/handel');
const { SECTOREN } = require('../server/kern/spellen/magnaat/sectoren');
const { MARKTPRIJS } = H;
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'quick' };
const kavelIn = (zone, n = 0) => kaart('ijmuiden').kavels.filter(k => k.zone === zone)[n];

/* Een opstelling die in bijna elke toets terugkomt: een vervoerder (A) en een
   restaurant (B) dat vervoer inkoopt. Met genoeg geld, want deze toetsen gaan
   niet over de vraag of je het kunt betalen. */
function opstelling(opties = {}) {
  const m = maakMagnaat();
  const p = { id: 'p1', soort: 'magnaat', spelers: ['anna', 'boris'], teams: [0, 1], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  const st = p.staat;
  st.geld.anna = st.geld.boris = 5000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('terrein').id, sector: 'logistiek',
    omvang: opties.vloot || 12, naam: 'Atlas' });
  m.eco.zet(p, 'boris', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca',
    omvang: 60, naam: 'Zeezicht' });
  return { m, p, st, A: st.vestigingen.anna[0], B: st.vestigingen.boris[0] };
}
const maand = (m, p, n = 1) => {
  for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); }
};
/* Een contract sluiten in twee zetten, want dat is de enige weg: je eigen
   voorstel tekenen kan niet. */
function sluitContract(m, p, van, naar, x) {
  const r = m.eco.zet(p, van, Object.assign({ actie: 'contract-voorstel' }, x));
  assert.ok(r.ok, 'voorstel: ' + (r.error || ''));
  const t = m.eco.zet(p, naar, { actie: 'contract-antwoord', id: r.id, antwoord: 'ja' });
  assert.ok(t.ok, 'tekenen: ' + (t.error || ''));
  return p.staat.contracten.find(c => c.id === r.id);
}

/* ================= de tabel eronder ================= */

test('elke sector koopt precies 100% van zijn inkoop ergens, en niets valt buiten de boot', () => {
  for (const [naam, s] of Object.entries(SECTOREN)) {
    const som = Object.values(s.koopt || {}).reduce((n, x) => n + x, 0);
    assert.ok(Math.abs(som - 1) < 1e-9, naam + ' verdeelt zijn inkoop over ' + som + ' in plaats van 1');
    for (const soort of Object.keys(s.koopt || {}))
      assert.ok(MARKTPRIJS[soort], naam + ' koopt ' + soort + ', maar die soort bestaat niet');
  }
  /* Elke soort moet ergens vandaan KUNNEN komen. Een post die geen enkele
     sector levert is een contract dat nooit gesloten kan worden, en dat zie je
     pas als een speler het probeert. */
  for (const soort of Object.keys(MARKTPRIJS))
    assert.ok(H.LEVERANCIERS[soort].length > 0, 'niemand levert ' + soort);
});

test('zonder contracten rekent de economie precies zoals in fase A', () => {
  /* De eis achter de hele laag: een economie die anders rekent zodra er een
     laag bijkomt, is twee economieen. Meetbaar doordat `koopt` alleen de
     BESTAANDE inkooppost verdeelt en er niets aan toevoegt. */
  const { m, p, st, B } = opstelling();
  maand(m, p, 6);
  const r = st.laatste.boris.regels[0];
  const s = SECTOREN[B.sector];
  assert.equal(r.korting, 0, 'zonder contract is er niets gedekt');
  assert.equal(r.inkoop, Math.round(r.omzet * s.inkoop), 'de inkooppost is onveranderd');
  assert.equal(r.levering, null, 'en er wordt niets geleverd');
});

/* ================= 1. een contract verandert de cijfers ================= */

test('een contract verlaagt de inkooppost van de afnemer en levert de leverancier omzet op', () => {
  const { m, p, st, A, B } = opstelling();
  maand(m, p, 2);
  const zonder = st.laatste.boris.regels[0];
  const eenheden = Math.max(1, Math.round(H.behoefte(B, zonder.omzet, 'vervoer')));
  sluitContract(m, p, 'boris', 'anna', { mijn: B.id, hun: A.id, soort: 'vervoer',
    eenheden, bedrag: 1000, looptijd: 12, eis: 0, boete: 1000, vooraf: 0, exclusief: false });
  maand(m, p, 1);
  const met = st.laatste.boris.regels[0];
  assert.ok(met.korting > 0, 'de dekking is een bedrag en geen vinkje');
  assert.ok(met.inkoop < Math.round(met.omzet * SECTOREN[B.sector].inkoop),
    'de inkooppost is werkelijk lager dan de marktvariant');
  const lev = st.laatste.anna.regels[0];
  assert.ok(lev.levering && lev.levering.omzet === 1000, 'de leverancier boekt de contractomzet');
});

test('een goedkoop contract maakt de afnemer beter af, een duur contract slechter', () => {
  /* Dit is de hele onderhandeling. Zonder deze eigenschap is de prijs een
     versiering en tekent iedereen alles. */
  const meting = (bedrag) => {
    const { m, p, st, A, B } = opstelling();
    maand(m, p, 2);
    const marktkosten = st.laatste.boris.regels[0].omzet * SECTOREN.horeca.inkoop * SECTOREN.horeca.koopt.vervoer;
    const eenheden = Math.max(1, Math.round(H.behoefte(B, st.laatste.boris.regels[0].omzet, 'vervoer')));
    sluitContract(m, p, 'boris', 'anna', { mijn: B.id, hun: A.id, soort: 'vervoer',
      eenheden, bedrag: Math.round(marktkosten * bedrag), looptijd: 12, eis: 0, boete: 1, vooraf: 0, exclusief: false });
    const voor = st.geld.boris;
    maand(m, p, 1);
    return st.geld.boris - voor;
  };
  const goedkoop = meting(0.5), duur = meting(2.0);
  assert.ok(goedkoop > duur + 100,
    'de helft betalen hoort merkbaar beter uit te pakken dan het dubbele: ' + goedkoop + ' vs ' + duur);
});

/* ================= 2. levering gaat voor vrije verkoop ================= */

test('wie zich vol tekent, kan zijn eigen klanten niet meer helpen', () => {
  const { m, p, st, A, B } = opstelling({ vloot: 6 });
  maand(m, p, 2);
  const vrij = st.laatste.anna.regels[0];
  assert.ok(vrij.eenheden > 0, 'er is vrije vraag om te verdringen');
  const cap = vrij.capaciteit;
  sluitContract(m, p, 'boris', 'anna', { mijn: B.id, hun: A.id, soort: 'vervoer',
    eenheden: Math.round(cap * 0.9), bedrag: 1000, looptijd: 12, eis: 0, boete: 1, vooraf: 0, exclusief: false });
  maand(m, p, 1);
  const bezet = st.laatste.anna.regels[0];
  assert.ok(bezet.eenheden < vrij.eenheden,
    'de vrije verkoop hoort te wijken voor de levering: ' + bezet.eenheden + ' vs ' + vrij.eenheden);
  assert.ok(bezet.gemist > vrij.gemist, 'en dat hoort als gemiste vraag zichtbaar te zijn');
  assert.equal(bezet.levering.geleverd, bezet.levering.toegezegd, 'de levering zelf is wel vol');
});

test('een vergeven capaciteit drukt net zo hard op de kwaliteit als een volle zaak', () => {
  /* Anders is een contract een gratis manier om je zaak vol te zetten: de
     leverancier zou zijn hele capaciteit kunnen vergeven en toch honderd
     scoren, omdat er "geen klanten" waren. Het onderscheid tussen een klant en
     een levering bestaat voor het personeel niet. */
  const meting = (deelVanCapaciteit) => {
    const { m, p, st, A, B } = opstelling({ vloot: 10 });
    maand(m, p, 1);
    const cap = st.laatste.anna.regels[0].capaciteit;
    // de vrije vraag wegdrukken, zodat alleen de levering de zaak vult
    m.eco.zet(p, 'anna', { actie: 'beleid', id: A.id, prijs: 'hoog' });
    sluitContract(m, p, 'boris', 'anna', { mijn: B.id, hun: A.id, soort: 'vervoer',
      eenheden: Math.max(1, Math.round(cap * deelVanCapaciteit)), bedrag: 1000,
      looptijd: 12, eis: 0, boete: 1, vooraf: 0, exclusief: false });
    maand(m, p, 1);
    const r = st.laatste.anna.regels[0];
    return { kwaliteit: r.kwaliteit, verkocht: r.eenheden, bezetting: r.bezetting };
  };
  const leeg = meting(0.01), vol = meting(1.0);
  assert.ok(vol.bezetting >= 95, 'de zaak zit vol met leveringen: ' + vol.bezetting + '%');
  assert.ok(vol.kwaliteit < leeg.kwaliteit - 15,
    'en dat hoort de kwaliteit te drukken: ' + vol.kwaliteit + ' tegenover ' + leeg.kwaliteit);
});

/* ================= 3. wie tekort komt, betaalt ================= */

test('een leverancier die zijn capaciteit niet haalt levert pro rata, wordt pro rata betaald en krijgt de boete', () => {
  const { m, p, st, A, B } = opstelling({ vloot: 5 });
  maand(m, p, 1);
  const cap = st.laatste.anna.regels[0].capaciteit;
  const c = sluitContract(m, p, 'boris', 'anna', { mijn: B.id, hun: A.id, soort: 'vervoer',
    eenheden: cap * 3, bedrag: 30000, looptijd: 12, eis: 0, boete: 7500, vooraf: 0, exclusief: false });
  maand(m, p, 1);
  const regel = st.laatste.boris.contracten.find(x => x.id === c.id);
  assert.ok(regel.tekort, 'drie keer de capaciteit toezeggen levert een tekort op');
  assert.ok(regel.geleverd < c.eenheden && regel.geleverd > 0, 'en pro rata levering: ' + regel.geleverd);
  assert.ok(regel.bedrag > 0 && regel.bedrag < c.bedrag,
    'pro rata betalen, niet alles en niet niets: ' + regel.bedrag);
  assert.equal(regel.boete, 7500, 'en de boete valt');
  assert.equal(c.maandenTekort, 1);
});

test('leveren mag, maar de kwaliteitseis niet halen kost ook', () => {
  /* De eis is de reden dat "goedkoop personeel" niet gratis is. Twee identieke
     opstellingen, alleen de eis verschilt: alles wat overblijft is de eis. */
  const meting = (eis) => {
    const { m, p, st, A, B } = opstelling({ vloot: 5 });
    maand(m, p, 1);
    // de zaak zo vol zetten dat de kwaliteit onder de honderd zakt
    m.eco.zet(p, 'anna', { actie: 'beleid', id: A.id, personeel: 5, onderhoud: 0 });
    const cap = st.laatste.anna.regels[0].capaciteit;
    const c = sluitContract(m, p, 'boris', 'anna', { mijn: B.id, hun: A.id, soort: 'vervoer',
      eenheden: Math.round(cap * 0.8), bedrag: 5000, looptijd: 12, eis, boete: 9000, vooraf: 0, exclusief: false });
    maand(m, p, 4);
    return { c, kwaliteit: st.laatste.anna.regels[0].kwaliteit };
  };
  const laag = meting(0), hoog = meting(95);
  assert.ok(laag.kwaliteit < 95, 'de opstelling levert inderdaad onder de 95: ' + laag.kwaliteit);
  assert.equal(laag.c.boetes, 0, 'zonder eis geen boete');
  assert.ok(hoog.c.boetes > 0, 'met een eis die niet gehaald wordt wel: ' + hoog.c.boetes);
  assert.ok(hoog.c.maandenTekort > 0 && hoog.c.maandenGeleverd < 4);
});

/* ================= 4. de klok blijft deterministisch ================= */

test('tien maanden in een keer geeft hetzelfde als tien maanden los, ook met contracten', () => {
  /* Dezelfde eis als in fase A (GAMEHALL.md 12.4), maar nu met een laag erin
     die per maand geld heen en weer schuift. Een boete die van de volgorde
     afhangt zou "sinds je weg was" van je pollgedrag laten afhangen. */
  const opzet = () => {
    const o = opstelling({ vloot: 5 });
    maand(o.m, o.p, 1);
    sluitContract(o.m, o.p, 'boris', 'anna', { mijn: o.B.id, hun: o.A.id, soort: 'vervoer',
      eenheden: 700, bedrag: 24000, looptijd: 24, eis: 80, boete: 6000, vooraf: 15000, exclusief: false });
    return o;
  };
  const los = opzet();
  for (let i = 0; i < 10; i++) maand(los.m, los.p, 1);
  const bulk = opzet();
  bulk.p.staat.gerekendTot -= bulk.p.staat.maandMs * 10;
  bulk.m.eco.bijrekenen(bulk.p);

  for (const wie of ['anna', 'boris'])
    assert.equal(Math.round(los.st.geld[wie]), Math.round(bulk.st.geld[wie]),
      wie + ' hoort er hetzelfde voor te staan');
  const cl = los.st.contracten[0], cb = bulk.st.contracten[0];
  assert.deepEqual(
    { g: cl.maandenGeleverd, t: cl.maandenTekort, b: Math.round(cl.boetes), p: Math.round(cl.betaald) },
    { g: cb.maandenGeleverd, t: cb.maandenTekort, b: Math.round(cb.boetes), p: Math.round(cb.betaald) });
});

/* ================= 5. het geld klopt ================= */

test('elke euro die de ene speler verlaat komt bij de andere aan', () => {
  /* Een contractlaag is de makkelijkste plek om per ongeluk geld te drukken:
     de leverancier krijgt zijn bedrag via zijn OMZET (../stap.js) en de afnemer
     betaalt het apart. Vergeet je een van beide, dan klopt er niets meer -- en
     dat merk je niet, want beide spelers zien alleen hun eigen kant.

     Gemeten door het contract UIT te zetten en het verschil te leggen naast wat
     er over de contractregels is gelopen. */
  const meting = (metContract) => {
    const { m, p, st, A, B } = opstelling({ vloot: 8 });
    maand(m, p, 1);
    if (metContract) sluitContract(m, p, 'boris', 'anna', { mijn: B.id, hun: A.id, soort: 'vervoer',
      eenheden: 400, bedrag: 18000, looptijd: 12, eis: 0, boete: 3000, vooraf: 50000, exclusief: false });
    maand(m, p, 3);
    return { anna: st.geld.anna, boris: st.geld.boris, st };
  };
  const met = meting(true), zonder = meting(false);
  /* De SOM van beide spelers mag wel verschillen -- een contract verandert de
     economie -- maar wat er OVER het contract loopt hoort exact een overdracht
     te zijn. Dus: wat de afnemer aan het contract kwijt was, is precies wat de
     leverancier eraan verdiende. */
  const c = met.st.contracten[0];
  const overdracht = c.betaald - c.boetes + c.vooraf;
  const annaExtra = met.anna - zonder.anna;
  const borisExtra = met.boris - zonder.boris;
  assert.ok(overdracht > 0, 'er is werkelijk geld gelopen: ' + overdracht);
  /* Bij de leverancier komt de overdracht binnen; wat hij ervoor moest doen
     (capaciteit vergeven, dus vrije verkoop laten lopen) trekt eraf. Bij de
     afnemer gaat de overdracht eruit en komt de bespaarde inkoop erbij. Het
     verschil tussen die twee is dus NOOIT meer dan wat de economie zelf deed --
     en zeker geen bedrag dat uit het niets komt. */
  assert.ok(Math.abs(annaExtra + borisExtra) < overdracht,
    'samen mogen ze er niet meer op vooruit gaan dan er is omgegaan: ' +
    Math.round(annaExtra) + ' + ' + Math.round(borisExtra) + ' vs ' + Math.round(overdracht));
});

test('geld tussen twee spelers heen en weer schuiven maakt de Foundation-pot niet groter', () => {
  /* De afdracht rust op de omzet van de STAD, en een levering tussen twee
     spelers is geen nieuwe bedrijvigheid -- het is dezelfde euro die twee keer
     langskomt. Zonder die aftrek is er een knop waarmee twee spelers samen de
     Foundation kunnen opblazen door elkaar miljoenen te factureren, en dat is
     precies het soort maas dat je pas ontdekt als iemand hem gebruikt. */
  const afdrachtBij = (bedrag) => {
    const { m, p, st, A, B } = opstelling({ vloot: 10 });
    maand(m, p, 1);
    sluitContract(m, p, 'boris', 'anna', { mijn: B.id, hun: A.id, soort: 'vervoer',
      eenheden: 100, bedrag, looptijd: 12, eis: 0, boete: 1, vooraf: 0, exclusief: false });
    p.staat.gerekendTot -= p.staat.maandMs;
    return m.eco.bijrekenen(p)[0].afdracht;
  };
  const klein = afdrachtBij(1), gigantisch = afdrachtBij(2000000);
  assert.ok(klein.lokaal > 0, 'er wordt werkelijk afgedragen: ' + klein.lokaal);
  assert.equal(Math.round(gigantisch.lokaal), Math.round(klein.lokaal),
    'twee miljoen aan onderlinge facturen hoort geen cent extra af te dragen');
  assert.equal(Math.round(gigantisch.centraal), Math.round(klein.centraal));
});

test('een boete gaat naar de wederpartij en niet naar de bank', () => {
  const { m, p, st, A, B } = opstelling({ vloot: 4 });
  maand(m, p, 1);
  sluitContract(m, p, 'boris', 'anna', { mijn: B.id, hun: A.id, soort: 'vervoer',
    eenheden: 100000, bedrag: 1, looptijd: 12, eis: 0, boete: 25000, vooraf: 0, exclusief: false });
  const voorA = st.geld.anna, voorB = st.geld.boris;
  const eigenA = st.laatste.anna.regels[0].resultaat, eigenB = st.laatste.boris.regels[0].resultaat;
  maand(m, p, 1);
  const c = st.contracten[0];
  assert.equal(c.boetes, 25000);
  // wat er buiten de eigen bedrijfsvoering om is verschoven
  const verschovenA = (st.geld.anna - voorA) - st.laatste.anna.regels[0].resultaat;
  const verschovenB = (st.geld.boris - voorB) - st.laatste.boris.regels[0].resultaat;
  assert.ok(Math.abs(verschovenA + verschovenB) < 1,
    'de boete plus de betaling hoort tussen twee spelers op nul uit te komen: ' +
    Math.round(verschovenA) + ' / ' + Math.round(verschovenB));
  assert.ok(eigenA !== undefined && eigenB !== undefined);
});

/* ================= 6. een derde ziet de voorwaarden niet ================= */

test('een kijker en een gedeeld scherm zien geen enkele contractvoorwaarde', () => {
  const { m, p, st, A, B } = opstelling();
  maand(m, p, 1);
  sluitContract(m, p, 'boris', 'anna', { mijn: B.id, hun: A.id, soort: 'vervoer',
    eenheden: 200, bedrag: 987654, looptijd: 12, eis: 44, boete: 33221, vooraf: 0, exclusief: false });
  for (const laag of ['kijker', 'publiek']) {
    const tekst = JSON.stringify(m.spel.zicht[laag](p, st));
    assert.ok(!/987654/.test(tekst), laag + ' hoort het contractbedrag niet te tonen');
    assert.ok(!/33221/.test(tekst), laag + ' hoort de boete niet te tonen');
    assert.ok(!/"eis"/.test(tekst), laag + ' hoort de kwaliteitseis niet te tonen');
  }
});

test('een derde speler ziet de contracten van twee anderen niet', () => {
  const m = maakMagnaat();
  const p = { id: 'p1', soort: 'magnaat', spelers: ['anna', 'boris', 'cato'], teams: [0, 1, 2],
    modus: 'vrij', status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  const st = p.staat;
  for (const h of p.spelers) st.geld[h] = 5000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('terrein').id, sector: 'logistiek', omvang: 12, naam: 'Atlas' });
  m.eco.zet(p, 'boris', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 60, naam: 'Zeezicht' });
  m.eco.zet(p, 'cato', { actie: 'open', kavel: kavelIn('centrum').id, sector: 'retail', omvang: 40, naam: 'Derde' });
  maand(m, p, 1);
  const c = sluitContract(m, p, 'boris', 'anna', { mijn: st.vestigingen.boris[0].id, hun: st.vestigingen.anna[0].id,
    soort: 'vervoer', eenheden: 200, bedrag: 456789, looptijd: 12, eis: 0, boete: 1, vooraf: 0, exclusief: false });
  const cato = JSON.stringify(m.eco.zicht(p, st, 'cato'));
  assert.ok(!/456789/.test(cato), 'cato hoort het bedrag niet te zien');
  assert.equal(m.eco.zicht(p, st, 'cato').contracten.length, 0, 'en geen enkel contract in zijn lijst');
  // maar hij mag wel weten DAT er een vervoerder aan de Zeehavenweg zit -- dat
  // staat op straat, en zonder dat kan hij nooit zelf een contract voorstellen
  const zaken = m.eco.zicht(p, st, 'cato').anderen.flatMap(a => a.zaken);
  assert.ok(zaken.some(z => z.naam === 'Atlas' && z.levert === 'vervoer'));
  assert.ok(!JSON.stringify(zaken).includes('reputatie'), 'maar niet hoe het hem vergaat');
  // en met een geraden id komt hij er ook niet in
  const stiekem = m.eco.zet(p, 'cato', { actie: 'contract-antwoord', id: c.id, antwoord: 'ja' });
  assert.equal(stiekem.status, 404);
});

/* ================= het onderhandelen zelf ================= */

test('je kunt je eigen voorstel niet tekenen, en na een tegenvoorstel draait de beurt om', () => {
  const { m, p, st, A, B } = opstelling();
  maand(m, p, 1);
  const voorstel = { actie: 'contract-voorstel', mijn: B.id, hun: A.id, soort: 'vervoer',
    eenheden: 200, bedrag: 9000, looptijd: 12, eis: 50, boete: 2000, vooraf: 0, exclusief: false };
  const r = m.eco.zet(p, 'boris', voorstel);
  assert.equal(m.eco.zet(p, 'boris', { actie: 'contract-antwoord', id: r.id, antwoord: 'ja' }).status, 409);
  // anna doet een tegenvoorstel -- nu is boris aan zet en anna niet
  const t = m.eco.zet(p, 'anna', { actie: 'contract-antwoord', id: r.id, antwoord: 'tegen',
    eenheden: 200, bedrag: 14000, looptijd: 12, eis: 50, boete: 2000, vooraf: 0, exclusief: false });
  assert.ok(t.ok && t.ronde === 2);
  assert.equal(m.eco.zet(p, 'anna', { actie: 'contract-antwoord', id: r.id, antwoord: 'ja' }).status, 409);
  const ja = m.eco.zet(p, 'boris', { actie: 'contract-antwoord', id: r.id, antwoord: 'ja' });
  assert.ok(ja.ok);
  assert.equal(st.contracten[0].bedrag, 14000, 'het tegenvoorstel is wat er getekend wordt');
});

test('een tegenvoorstel gaat door dezelfde zeef als een eerste voorstel', () => {
  /* De klassieke fout: streng bij het openen, laks bij het bijstellen. Een
     looptijd die bij het voorstel geweigerd wordt, hoort bij een tegenvoorstel
     net zo hard geweigerd te worden. */
  const { m, p, st, A, B } = opstelling();
  maand(m, p, 1);
  const r = m.eco.zet(p, 'boris', { actie: 'contract-voorstel', mijn: B.id, hun: A.id, soort: 'vervoer',
    eenheden: 200, bedrag: 9000, looptijd: 12, eis: 50, boete: 2000, vooraf: 0, exclusief: false });
  const tegen = m.eco.zet(p, 'anna', { actie: 'contract-antwoord', id: r.id, antwoord: 'tegen',
    eenheden: 200, bedrag: 9000, looptijd: 999, eis: 50, boete: 2000, vooraf: 0, exclusief: false });
  assert.equal(tegen.status, 400, 'een looptijd van 999 hoort ook in ronde twee te stuiten');
  assert.equal(st.contracten[0].looptijd, 12, 'en het voorstel is niet stilletjes veranderd');
});

test('de rol volgt uit de sector en niet uit het verzoek', () => {
  const { m, p, st, A, B } = opstelling();
  maand(m, p, 1);
  // boris (horeca) stelt voor; hij KOOPT vervoer, dus hij is per definitie de afnemer
  const r = m.eco.zet(p, 'boris', { actie: 'contract-voorstel', mijn: B.id, hun: A.id, soort: 'vervoer',
    eenheden: 100, bedrag: 5000, looptijd: 6, eis: 0, boete: 1, vooraf: 0, exclusief: false });
  assert.equal(st.contracten[0].leverancier, 'anna');
  assert.equal(r.leverancier, 'zij');
  // en een restaurant dat belooft vervoer te leveren is geen onderhandeling maar een fout
  const fout = m.eco.zet(p, 'anna', { actie: 'contract-voorstel', mijn: A.id, hun: B.id, soort: 'goederen',
    eenheden: 100, bedrag: 5000, looptijd: 6, eis: 0, boete: 1, vooraf: 0, exclusief: false });
  assert.equal(fout.status, 400);
  assert.match(fout.error, /levert geen goederen/);
});

test('exclusiviteit bindt de leverancier, en alleen in de zone waar hij verkocht is', () => {
  const m = maakMagnaat();
  const p = { id: 'p1', soort: 'magnaat', spelers: ['anna', 'boris', 'cato'], teams: [0, 1, 2],
    modus: 'vrij', status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  const st = p.staat;
  for (const h of p.spelers) st.geld[h] = 9000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('terrein').id, sector: 'logistiek', omvang: 40, naam: 'Atlas' });
  m.eco.zet(p, 'boris', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 60, naam: 'Zeezicht' });
  // cato: een restaurant NAAST boris (zelfde zone), en een tweede in het centrum
  m.eco.zet(p, 'cato', { actie: 'open', kavel: kavelIn('boulevard', 1).id, sector: 'horeca', omvang: 50, naam: 'Buurman' });
  m.eco.zet(p, 'cato', { actie: 'open', kavel: kavelIn('centrum').id, sector: 'horeca', omvang: 50, naam: 'Elders' });
  maand(m, p, 1);
  const A = st.vestigingen.anna[0];
  const voorA = st.geld.anna, voorB = st.geld.boris;
  sluitContract(m, p, 'boris', 'anna', { mijn: st.vestigingen.boris[0].id, hun: A.id, soort: 'vervoer',
    eenheden: 100, bedrag: 8000, looptijd: 12, eis: 0, boete: 1, vooraf: 200000, exclusief: true });
  // de vooruitbetaling gaat bij het TEKENEN over, niet bij de eerste levering:
  // dat is precies wat een speler ervoor terugkrijgt
  assert.equal(Math.round(st.geld.anna - voorA), 200000, 'de leverancier heeft de vooruitbetaling gekregen');
  assert.equal(Math.round(st.geld.boris - voorB), -200000, 'en de afnemer heeft hem betaald');
  const buur = m.eco.zet(p, 'cato', { actie: 'contract-voorstel', mijn: st.vestigingen.cato[0].id, hun: A.id,
    soort: 'vervoer', eenheden: 100, bedrag: 9000, looptijd: 12, eis: 0, boete: 1, vooraf: 0, exclusief: false });
  assert.equal(buur.status, 409, 'de buurman in dezelfde zone stuit op de exclusiviteit');
  const elders = m.eco.zet(p, 'cato', { actie: 'contract-voorstel', mijn: st.vestigingen.cato[1].id, hun: A.id,
    soort: 'vervoer', eenheden: 100, bedrag: 9000, looptijd: 12, eis: 0, boete: 1, vooraf: 0, exclusief: false });
  assert.ok(elders.ok, 'buiten die zone mag het wel: ' + (elders.error || ''));
});

test('afkopen kost, en het geld gaat naar de wederpartij', () => {
  const { m, p, st, A, B } = opstelling();
  maand(m, p, 1);
  const c = sluitContract(m, p, 'boris', 'anna', { mijn: B.id, hun: A.id, soort: 'vervoer',
    eenheden: 100, bedrag: 5000, looptijd: 24, eis: 0, boete: 4000, vooraf: 0, exclusief: false });
  const voorA = st.geld.anna, voorB = st.geld.boris;
  const r = m.eco.zet(p, 'boris', { actie: 'contract-opzeggen', id: c.id });
  assert.ok(r.ok);
  assert.equal(r.afkoop, 4000 * H.AFKOOP_MAANDEN, 'drie maanden boete');
  assert.equal(Math.round(st.geld.boris - voorB), -r.afkoop);
  assert.equal(Math.round(st.geld.anna - voorA), r.afkoop);
  assert.equal(c.status, 'afgekocht');
  maand(m, p, 1);
  assert.equal((st.laatste.anna.contracten || []).length, 0, 'een afgekocht contract levert niets meer');
});

test('een vestiging sluiten is geen achterdeur uit een contract', () => {
  const { m, p, st, A, B } = opstelling();
  maand(m, p, 1);
  const c = sluitContract(m, p, 'boris', 'anna', { mijn: B.id, hun: A.id, soort: 'vervoer',
    eenheden: 100, bedrag: 5000, looptijd: 24, eis: 0, boete: 8000, vooraf: 0, exclusief: false });
  const voorB = st.geld.boris;
  const dicht = m.eco.zet(p, 'anna', { actie: 'sluiten', id: A.id });
  assert.ok(dicht.ok);
  assert.equal(dicht.afgekocht, 1);
  assert.equal(dicht.afkoop, 8000 * H.AFKOOP_MAANDEN);
  assert.equal(Math.round(st.geld.boris - voorB), dicht.afkoop, 'de wederpartij krijgt de afkoopsom');
  assert.equal(c.status, 'afgekocht');
  // en er blijft geen verplichting achter die aan een verdwenen zaak hangt
  maand(m, p, 2);
  assert.equal((st.contracten || []).filter(x => x.status === 'loopt').length, 0);
});

test('twee contracten voor dezelfde inkooppost kunnen niet', () => {
  const { m, p, st, A, B } = opstelling();
  maand(m, p, 1);
  sluitContract(m, p, 'boris', 'anna', { mijn: B.id, hun: A.id, soort: 'vervoer',
    eenheden: 100, bedrag: 5000, looptijd: 12, eis: 0, boete: 1, vooraf: 0, exclusief: false });
  const tweede = m.eco.zet(p, 'boris', { actie: 'contract-voorstel', mijn: B.id, hun: A.id, soort: 'vervoer',
    eenheden: 100, bedrag: 5000, looptijd: 12, eis: 0, boete: 1, vooraf: 0, exclusief: false });
  assert.equal(tweede.status, 409);
});

test('een contract kan niet langer lopen dan de campagne, en de rondes zijn eindig', () => {
  const { m, p, st, A, B } = opstelling();
  const basis = { actie: 'contract-voorstel', mijn: B.id, hun: A.id, soort: 'vervoer',
    eenheden: 100, bedrag: 5000, eis: 0, boete: 1, vooraf: 0, exclusief: false };
  assert.equal(m.eco.zet(p, 'boris', Object.assign({}, basis, { looptijd: 120 })).status, 400);
  const r = m.eco.zet(p, 'boris', Object.assign({}, basis, { looptijd: 12 }));
  let beurt = 'anna';
  for (let i = 0; i < 20; i++) {
    const t = m.eco.zet(p, beurt, { actie: 'contract-antwoord', id: r.id, antwoord: 'tegen',
      eenheden: 100, bedrag: 5000 + i, looptijd: 12, eis: 0, boete: 1, vooraf: 0, exclusief: false });
    if (!t.ok) { assert.equal(t.status, 409); assert.match(t.error, /rondes/); break; }
    beurt = beurt === 'anna' ? 'boris' : 'anna';
    assert.ok(i < 6, 'er hoort na zes rondes een einde aan te komen');
  }
});

test('onderhandelen is een vrije actie, en dat staat ook in de descriptor', () => {
  /* Zonder dit staat een partij van zes met 24 uur per beurt een week stil voor
     een contract, en dan is fase B onspeelbaar. */
  const m = maakMagnaat();
  for (const actie of ['contract-voorstel', 'contract-antwoord', 'contract-opzeggen'])
    assert.ok(m.spel.buitenBeurt.includes(actie), actie + ' hoort buiten de beurt te mogen');
  assert.ok(!m.spel.buitenBeurt.includes('open'), 'openen blijft een grote zet');
});

test('de afkoopsom loopt nooit op tot meer dan de resterende looptijd', () => {
  const c = { boete: 1000, eindMaand: 30 };
  assert.equal(H.afkoopsom(c, 10), 3000, 'ver van het einde: drie maanden');
  assert.equal(H.afkoopsom(c, 29), 1000, 'vlak voor het einde: nog een maand');
  assert.equal(H.afkoopsom(c, 30), 0, 'op het einde: niets');
  assert.equal(H.afkoopsom(c, 40), 0, 'en er voorbij ook niets');
});

test('de dekking gaat nooit boven de post die hij vervangt', () => {
  /* Wie zich overtekent koopt meer dan hij nodig heeft en betaalt dat gewoon;
     zonder dit plafond zou een absurd groot contract de inkooppost negatief
     maken en dus geld opleveren. */
  const v = { sector: 'horeca' };
  const omzet = 100000;
  const nodig = H.behoefte(v, omzet, 'goederen');
  const vol = H.dekking(v, omzet, 'goederen', nodig);
  const teveel = H.dekking(v, omzet, 'goederen', nodig * 50);
  assert.ok(Math.abs(vol.deel - 1) < 1e-9);
  assert.equal(teveel.deel, 1, 'vijftig keer zoveel dekt nog steeds precies de post');
  assert.equal(teveel.bedrag, vol.bedrag);
  assert.ok(vol.bedrag > 0);
});
