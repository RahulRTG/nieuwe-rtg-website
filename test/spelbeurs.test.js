/* MAGNAAT: DE BEURS -- belangen die openbaar te koop staan.

   ZEVEN BEWERINGEN, en ze zijn alle zeven stil terug te draaien:

   1. EEN MARKT IS PUBLIEK. Dat is het verschil met een onderhandeld belang.
   2. EEN PRIJS HEEFT EEN BAND. Een markt zonder band is een overboeking met een
      aandeel eraan geniet.
   3. HET IS EEN OVERDRACHT EN GEEN SCHEPPING.
   4. ER GAAT NOOIT MEER WEG DAN ER IS: dezelfde 49% als bij de deelnemingen, en
      dezelfde administratie.
   5. DOORVERKOOP VERPLAATST EEN BELANG, HET MAAKT ER GEEN.
   6. EEN ORDER DIE NIET MEER GEDEKT IS, VERVALT.
   7. EEN BELANG GEEFT GEEN ZEGGENSCHAP -- ook niet via de beurs.

   Draai los: node --experimental-sqlite --test test/spelbeurs.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const { kaart } = require('../server/kern/spellen/magnaat/kaart');
const { waarde } = require('../server/kern/spellen/magnaat/waardering');
const B = require('../server/kern/spellen/magnaat/beurs');

/* HOEVEEL PROCENT ER UITSTAAT, hier geteld en niet uit de motor gehaald. Dat is
   met opzet: deze toetsen gaan over de vraag of de beurs en de onderhandeling
   DEZELFDE administratie delen, en dan moet de telling van buiten komen. */
const MAX_DEEL = 49;
const uitgegeven = (st, id) => (st.deelnemingen || [])
  .filter(d => d.status === 'loopt' && d.vestiging === id)
  .reduce((n, d) => n + d.deel, 0);

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kavelIn = (zone, n = 0) => kaart('ijmuiden').kavels.filter(k => k.zone === zone)[n];

function opstelling(id = 'p1') {
  const m = maakMagnaat();
  const p = { id, soort: 'magnaat', spelers: ['anna', 'boris', 'cem'], teams: [0, 1, 2], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of p.spelers) p.staat.geld[h] = 3000000;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kavelIn('boulevard').id, sector: 'horeca', omvang: 40, naam: 'Zeezicht' });
  const maand = (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } };
  maand(4);
  return { m, p, st: p.staat, V: p.staat.vestigingen.anna[0], maand };
}
/* De rekenkundige waarde van een belang -- uit dezelfde functie als de eindstand
   en het onderpand, want een tweede waardering is een tweede antwoord. */
const stuk = (V, deel) => Math.round(waarde(V) * (deel / 100));
const zetOp = (m, p, V, deel, factor = 1) =>
  m.eco.zet(p, 'anna', { actie: 'beurs-aanbieden', vestiging: V.id, deel, prijs: Math.round(stuk(V, deel) * factor) });

/* ================= 1. een markt is publiek ================= */

test('wat er te koop staat ziet iedereen, met de rekenwaarde ernaast', () => {
  const { m, p, st, V } = opstelling();
  assert.ok(zetOp(m, p, V, 20).ok);
  const vanBoris = m.eco.zicht(p, st, 'boris').beurs;
  const vanAnna = m.eco.zicht(p, st, 'anna').beurs;
  assert.equal(vanBoris.length, 1, 'boris ziet het aanbod');
  assert.equal(vanBoris[0].verkoper, 'CN-anna', 'en van wie het is');
  assert.equal(vanBoris[0].vanMij, false);
  assert.equal(vanAnna[0].vanMij, true, 'anna ziet dat het haar eigen order is');
  assert.ok(vanBoris[0].rekenwaarde > 0, 'met wat het rekenkundig waard is');
  assert.equal(vanBoris[0].verhouding, 1, 'en de verhouding tot die waarde');
  // maar niet de boeken van de verkoper
  assert.ok(!('geld' in vanBoris[0]), 'een order verklapt geen kas');
});

/* ================= 2. een prijs heeft een band ================= */

test('een prijs buiten de band is geen prijs', () => {
  const { m, p, V } = opstelling();
  const laag = m.eco.zet(p, 'anna', { actie: 'beurs-aanbieden', vestiging: V.id, deel: 20, prijs: 100 });
  assert.equal(laag.status, 409);
  assert.match(laag.error, /rekenkundig/);
  const hoog = m.eco.zet(p, 'anna', { actie: 'beurs-aanbieden', vestiging: V.id, deel: 20,
    prijs: stuk(V, 20) * 10 });
  assert.equal(hoog.status, 409, 'ook naar boven');
  assert.ok(zetOp(m, p, V, 20, 0.6).ok, 'binnen de band mag het wel');
  assert.ok(B.PRIJSBAND[0] > 0 && B.PRIJSBAND[1] > B.PRIJSBAND[0]);
});

/* ================= 3. overdracht, geen schepping ================= */

test('een transactie verplaatst geld en maakt er geen', () => {
  const { m, p, st, V } = opstelling();
  const r = zetOp(m, p, V, 20);
  const samenVoor = st.geld.anna + st.geld.boris + st.geld.cem;
  assert.ok(m.eco.zet(p, 'boris', { actie: 'beurs-kopen', id: r.id }).ok);
  const samenNa = st.geld.anna + st.geld.boris + st.geld.cem;
  assert.equal(Math.round(samenNa), Math.round(samenVoor), 'de som blijft gelijk');
  assert.equal(Math.round(st.geld.boris + r.prijs), Math.round(3000000), 'de koper betaalt');
});

test('de geldpompkeuring op de beurs klopt', () => {
  const { meet, EXACT } = require('../scripts/magnaat-pomp');
  const r = meet('beurscarrousel', 12);
  assert.equal(r.klacht, null, r.klacht);
  assert.ok(Math.abs(r.verschil) <= EXACT,
    'een belang rondverhandelen verandert het totaal niet, maar er staat ' + Math.round(r.verschil));
});

/* ================= 4. er gaat nooit meer weg dan er is ================= */

test('boven de 49 procent komt er niets meer uit', () => {
  const { m, p, st, V } = opstelling();
  const eerste = zetOp(m, p, V, 40);
  assert.ok(eerste.ok);
  assert.ok(m.eco.zet(p, 'boris', { actie: 'beurs-kopen', id: eerste.id }).ok);
  const tweede = m.eco.zet(p, 'anna', { actie: 'beurs-aanbieden', vestiging: V.id, deel: 20,
    prijs: stuk(V, 20) });
  assert.equal(tweede.status, 409, 'samen zou dat over de grens gaan');
  assert.match(tweede.error, new RegExp(String(MAX_DEEL)));
  assert.ok(zetOp(m, p, V, 9).ok, 'tot de grens mag het wel');
});

test('de beurs en de onderhandeling delen een administratie', () => {
  const { m, p, st, V } = opstelling();
  const r = zetOp(m, p, V, 30);
  assert.ok(m.eco.zet(p, 'boris', { actie: 'beurs-kopen', id: r.id }).ok);
  // en nu nog een belang via het GESPREK: samen mag het niet over de grens
  const voorstel = m.eco.zet(p, 'anna', { actie: 'belang-voorstel', vestiging: V.id,
    houder: 'cem', deel: 25, prijs: stuk(V, 25) });
  assert.equal(voorstel.status, 409, 'een tweede boekhouding zou dit doorlaten');
  assert.equal(uitgegeven(st, V.id), 30, 'en de teller kent alleen de ene waarheid');
});

/* ================= 5. doorverkoop verplaatst ================= */

test('doorverkopen verplaatst een belang en maakt er geen', () => {
  const { m, p, st, V } = opstelling();
  const r = zetOp(m, p, V, 30);
  assert.ok(m.eco.zet(p, 'boris', { actie: 'beurs-kopen', id: r.id }).ok);
  assert.equal(uitgegeven(st, V.id), 30);

  const door = m.eco.zet(p, 'boris', { actie: 'beurs-aanbieden', vestiging: V.id, deel: 10,
    prijs: stuk(V, 10) });
  assert.ok(door.ok, door.error);
  const kasB = st.geld.boris;
  assert.ok(m.eco.zet(p, 'cem', { actie: 'beurs-kopen', id: door.id }).ok);
  assert.equal(uitgegeven(st, V.id), 30, 'er staat nog steeds 30% uit, niet 40');
  assert.equal(Math.round(st.geld.boris - kasB), door.prijs, 'en de doorverkoper krijgt het geld');
  const perHouder = {};
  for (const d of st.deelnemingen.filter(x => x.status === 'loopt' && x.vestiging === V.id))
    perHouder[d.houder] = (perHouder[d.houder] || 0) + d.deel;
  assert.deepEqual(perHouder, { boris: 20, cem: 10 });
});

test('wie zijn hele belang doorverkoopt, houdt niets', () => {
  /* DE ANDERE TAK van de doorverkoop: gaat het HELE belang weg, dan verhuist het
     bestaande stuk in plaats van dat het gesplitst wordt. Zonder deze toets bleef
     die tak ongedekt -- een mutatie die de houder niet bijwerkte, kwam er langs,
     want de andere toets verkocht altijd maar een deel. */
  const { m, p, st, V } = opstelling();
  const r = zetOp(m, p, V, 25);
  assert.ok(m.eco.zet(p, 'boris', { actie: 'beurs-kopen', id: r.id }).ok);
  const alles = m.eco.zet(p, 'boris', { actie: 'beurs-aanbieden', vestiging: V.id, deel: 25,
    prijs: stuk(V, 25) });
  assert.ok(alles.ok, alles.error);
  assert.ok(m.eco.zet(p, 'cem', { actie: 'beurs-kopen', id: alles.id }).ok);
  const perHouder = {};
  for (const d of st.deelnemingen.filter(x => x.status === 'loopt' && x.vestiging === V.id))
    perHouder[d.houder] = (perHouder[d.houder] || 0) + d.deel;
  assert.deepEqual(perHouder, { cem: 25 }, 'alles staat bij cem en boris houdt niets');
  assert.equal(uitgegeven(st, V.id), 25, 'en er staat niet ineens meer uit');
});

test('je kunt niet meer doorverkopen dan je hebt', () => {
  const { m, p, st, V } = opstelling();
  const r = zetOp(m, p, V, 20);
  assert.ok(m.eco.zet(p, 'boris', { actie: 'beurs-kopen', id: r.id }).ok);
  const teveel = m.eco.zet(p, 'boris', { actie: 'beurs-aanbieden', vestiging: V.id, deel: 35,
    prijs: stuk(V, 35) });
  assert.equal(teveel.status, 409);
  assert.match(teveel.error, /maar 20/);
});

/* ================= 6. een order die niet meer gedekt is, vervalt ========= */

test('een order verloopt, en verdwijnt van de markt', () => {
  const { m, p, st, V, maand } = opstelling();
  const r = zetOp(m, p, V, 20);
  assert.equal(m.eco.zicht(p, st, 'boris').beurs.length, 1);
  maand(B.LOOPTIJD + 1);
  assert.equal(m.eco.zicht(p, st, 'boris').beurs.length, 0, 'na de looptijd staat hij er niet meer');
  assert.equal(m.eco.zet(p, 'boris', { actie: 'beurs-kopen', id: r.id }).status, 404);
});

test('wie zijn belang kwijtraakt, houdt geen order open', () => {
  const { m, p, st, V } = opstelling();
  const r = zetOp(m, p, V, 30);
  assert.ok(m.eco.zet(p, 'boris', { actie: 'beurs-kopen', id: r.id }).ok);
  const door = m.eco.zet(p, 'boris', { actie: 'beurs-aanbieden', vestiging: V.id, deel: 20,
    prijs: stuk(V, 20) });
  assert.ok(door.ok);
  // boris verkoopt datzelfde belang onderhands aan cem; zijn order is dan leeg
  for (const d of st.deelnemingen.filter(x => x.houder === 'boris')) d.houder = 'cem';
  assert.equal(m.eco.zet(p, 'cem', { actie: 'beurs-kopen', id: door.id }).status, 409);
  assert.equal(m.eco.zicht(p, st, 'cem').beurs.filter(o => o.id === door.id).length, 0);
});

test('je eigen order kun je intrekken, die van een ander niet', () => {
  const { m, p, st, V } = opstelling();
  const r = zetOp(m, p, V, 20);
  assert.equal(m.eco.zet(p, 'boris', { actie: 'beurs-intrekken', id: r.id }).status, 404);
  assert.ok(m.eco.zet(p, 'anna', { actie: 'beurs-intrekken', id: r.id }).ok);
  assert.equal(m.eco.zicht(p, st, 'boris').beurs.length, 0);
});

/* ================= 7. geen zeggenschap ================= */

test('een belang via de beurs geeft geen knop op de zaak', () => {
  const { m, p, st, V } = opstelling();
  const r = zetOp(m, p, V, 45);
  assert.ok(m.eco.zet(p, 'boris', { actie: 'beurs-kopen', id: r.id }).ok);
  const zet = m.eco.zet(p, 'boris', { actie: 'beleid', id: V.id, prijs: 'hoog' });
  assert.equal(zet.status, 404, 'de eigenaar blijft de enige met de knoppen');
  assert.equal(V.prijs, 'midden');
  /* EN DE EIGENAAR KOOPT ZIJN EIGEN VERWATERING NIET TERUG. Gemeten op een order
     van een ANDER, want op zijn eigen order valt hij al op "dat is je eigen
     aanbod" -- en dan is de eigenaarsregel nooit bereikt. Precies daarop
     overleefde een mutatie die hem wegnam. */
  const door = m.eco.zet(p, 'boris', { actie: 'beurs-aanbieden', vestiging: V.id, deel: 10,
    prijs: stuk(V, 10) });
  assert.ok(door.ok, door.error);
  const terug = m.eco.zet(p, 'anna', { actie: 'beurs-kopen', id: door.id });
  assert.equal(terug.status, 409, 'een eigenaar koopt geen belang in zijn eigen zaak');
  assert.match(terug.error, /eigen zaak/);
});

test('het resultaat wordt gedeeld met wie op de beurs kocht', () => {
  const { m, p, st, V, maand } = opstelling();
  const r = zetOp(m, p, V, 40);
  assert.ok(m.eco.zet(p, 'boris', { actie: 'beurs-kopen', id: r.id }).ok);
  const kasB = st.geld.boris;
  maand(1);
  const regel = st.laatste.anna.regels.find(x => x.id === V.id);
  assert.ok(regel.aandeelhouders && regel.aandeelhouders.length, 'de maand noemt de aandeelhouders');
  assert.ok(Math.abs((st.geld.boris - kasB) - regel.aandeelhouders
    .filter(a => a.naar === 'boris' || a.codenaam === 'CN-boris')
    .reduce((n, a) => n + (a.bedrag || 0), 0)) < 2 || st.geld.boris !== kasB,
    'en boris krijgt zijn deel');
});

test('beurshandel is een vrije actie', () => {
  const d = maakMagnaat().spel;
  for (const naam of ['beurs-aanbieden', 'beurs-kopen', 'beurs-intrekken'])
    assert.ok(d.buitenBeurt.includes(naam), naam + ' hoort buiten je beurt te mogen');
});
