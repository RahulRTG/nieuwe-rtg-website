/* DE TWEE GRENZEN -- wat er bewaard mag worden, en wat je mag doen.

   Hier stond er EEN, en dat was te weinig: "mag hier iets van bewaard worden"
   en "mag deze persoon dit doen" zijn verschillende vragen die hetzelfde
   antwoord kregen omdat er maar een drempel was.

   Negen beweringen, en ze zijn alle negen stil terug te draaien:

   1. DE PROGRESSIEGRENS BLIJFT 18+. De Arena's belofte aan tieners verschuift
      niet: geen ranglijst, op geen enkele leeftijd onder de achttien.
   2. DE WERKGRENS IS 16. Een biografie is geen wedstrijd.
   3. ZONDER GECONTROLEERDE LEEFTIJD BEN JE `kind`. Geen gegeven is geen
      toestemming.
   4. EEN ZESTIENJARIGE MAG DE BIJBAAN en niets van de volwassen laag.
   5. HIJ IS FAIL-CLOSED: wat niet op de witte lijst staat, mag niet.
   6. DE TWEE LIJSTEN SLUITEN OP ELKAAR AAN -- geen actie valt tussen wal en schip.
   7. EEN KIND SPEELT ALLES; er wordt alleen niets bewaard.
   8. EEN SPEL ZONDER LEEFTIJDSLAGEN KOMT ONGEHINDERD LANGS.
   9. EEN ZESTIENJARIGE WORDT GEEN BEDRIJFSLEIDER -- dat is werkgeverschap met
      een andere naam.

   Draai los: node --experimental-sqlite --test test/spelleeftijd.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const maakGrens = require('../server/kern/spellen/grens');
const LEEFTIJDEN = { oma: 71, rahul: 40, sven: 18, yara: 17, mo: 16, tess: 15, kind: 9, vreemd: null };
const grens = () => maakGrens({
  volwassen: (h) => LEEFTIJDEN[h] != null && LEEFTIJDEN[h] >= 18,
  leeftijd: (h) => (h in LEEFTIJDEN ? LEEFTIJDEN[h] : null)
});

/* ================= 1. de progressiegrens verschuift niet ================= */

test('scores en ranglijsten blijven 18+, ook voor een zestienjarige', () => {
  const G = grens();
  assert.equal(G.progressieMag('rahul'), true);
  assert.equal(G.progressieMag('sven'), true);
  assert.equal(G.progressieMag('yara'), false, 'zeventien is geen achttien');
  assert.equal(G.progressieMag('mo'), false);
  assert.equal(G.progressieMag('kind'), false);
  assert.match(G.GEEN_PROGRESSIE, /volwassen/);
});

/* ================= 2 en 3. de werkgrens ================= */

test('een werkverleden wordt bewaard vanaf zestien', () => {
  const G = grens();
  assert.equal(G.werkMag('mo'), true, 'zestien mag een zaterdagbaan onthouden');
  assert.equal(G.werkMag('yara'), true);
  assert.equal(G.werkMag('tess'), false, 'vijftien nog niet');
  assert.equal(G.werkMag('kind'), false);
  assert.equal(G.JONG_VANAF, 16);
  assert.equal(G.VOLWASSEN_VANAF, 18);
});

test('zonder gecontroleerde leeftijd ben je kind, niet waarschijnlijk oud genoeg', () => {
  const G = grens();
  assert.equal(G.laagVan('vreemd'), 'kind');
  assert.equal(G.laagVan('bestaat-niet'), 'kind');
  assert.equal(G.werkMag('vreemd'), false, 'geen gegeven is geen toestemming');
});

test('de drie lagen liggen waar ze horen', () => {
  const G = grens();
  assert.equal(G.laagVan('kind'), 'kind');
  assert.equal(G.laagVan('tess'), 'kind');
  assert.equal(G.laagVan('mo'), 'jong');
  assert.equal(G.laagVan('yara'), 'jong');
  assert.equal(G.laagVan('sven'), 'volwassen');
  assert.equal(G.laagVan('oma'), 'volwassen');
});

/* ================= 4, 5, 9. wat een zestienjarige mag ================= */

test('een zestienjarige mag de bijbaan en niets van de volwassen laag', () => {
  const G = grens();
  for (const mag of ['solliciteren', 'dienst-opzeggen', 'werk-beleid', 'foundation-stem',
    'vakantie-aan', 'vakantie-uit'])
    assert.equal(G.magHandeling('mo', mag), true, 'zestien hoort ' + mag + ' te mogen');
  for (const niet of ['open', 'uitbreiden', 'krediet-opnemen', 'functie-openen', 'aannemen',
    'bestuur-zet', 'beurs-kopen', 'overname-bod', 'veiling-bod', 'polis-sluiten', 'uitstappen'])
    assert.equal(G.magHandeling('mo', niet), false, 'zestien hoort ' + niet + ' NIET te mogen');
});

test('de lijst is wit: een verzonnen actie mag niet', () => {
  /* FAIL-CLOSED. Een zwarte lijst zou betekenen dat elke vergeten toevoeging
     stilzwijgend voor zestienjarigen opengaat, en dat is de verkeerde kant om
     fout te gaan. */
  const G = grens();
  assert.equal(G.magHandeling('mo', 'nog-niet-bedacht'), false);
  assert.equal(G.magHandeling('rahul', 'nog-niet-bedacht'), true, 'voor een volwassene beslist deze laag niets');
});

test('een zestienjarige wordt geen bedrijfsleider', () => {
  /* Een bedrijfsleider runt een zaak en stuurt mensen aan; dat is
     werkgeverschap met een andere naam. */
  const G = grens();
  for (const rol of ['hulp', 'vakkracht'])
    assert.equal(G.magRolAannemen('mo', rol), true, rol + ' hoort te kunnen');
  for (const rol of ['bedrijfsleider', 'coo', 'cfo', 'ceo'])
    assert.equal(G.magRolAannemen('mo', rol), false, rol + ' hoort niet te kunnen');
  assert.equal(G.magRolAannemen('rahul', 'ceo'), true);
  assert.equal(G.magRolAannemen('kind', 'ceo'), true, 'een kind speelt alles; er wordt niets bewaard');
});

/* ================= 6. de twee lijsten sluiten aan ================= */

test('geen enkele actie valt tussen de witte lijst en de descriptor', () => {
  /* TWEE SLOTEN. ../grens.js zegt wat een zestienjarige mag; de descriptor van
     Magnaat zegt welke acties bij de volwassen laag horen. Ze horen elkaars
     complement te zijn -- staat een actie in geen van beide, dan mag een
     zestienjarige hem stilzwijgend. */
  const m = require('../server/kern/spellen/magnaat/index')({
    save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {} });
  const alle = Object.keys(m.eco.acties());
  const volwassen = new Set(m.spel.volwassenLaag);
  const vrij = alle.filter(a => !volwassen.has(a));
  assert.deepEqual(vrij.slice().sort(), maakGrens.JONG_MAG.slice().sort(),
    'wat niet in de volwassen laag staat, hoort precies de witte lijst te zijn');
  for (const a of m.spel.volwassenLaag)
    assert.ok(alle.includes(a) || ['bouw', 'verkoop'].includes(a),
      m.spel.volwassenLaag + ': ' + a + ' bestaat niet als actie');
});

/* ================= 7 en 8. de randen ================= */

test('een kind speelt alles, er wordt alleen niets bewaard', () => {
  const G = grens();
  for (const actie of ['open', 'krediet-opnemen', 'solliciteren'])
    assert.equal(G.magHandeling('kind', actie), true, 'onder de grens blijft alles speelbaar');
  assert.equal(G.werkMag('kind'), false, 'er wordt alleen niets van bewaard');
});

test('een spel zonder leeftijdslagen komt ongehinderd langs', () => {
  const REG = require('../server/kern/spellen/register')({ save() {}, crypto: require('crypto'),
    schud: (a) => a, beurtDoor() {}, codenaamVan: (h) => h, nudge() {} });
  const zonder = Object.entries(REG.SPEL).filter(([, s]) => !s.volwassenLaag);
  assert.ok(zonder.length > 5, 'de meeste spellen kennen geen leeftijdslagen');
  assert.ok(REG.SPEL.magnaat.volwassenLaag.length > 20, 'en Magnaat wel');
});

test('valt de leeftijd weg, dan gedraagt alles zich als voorheen', () => {
  /* Een aanroeper die alleen `volwassen` doorgeeft (oudere bedrading, en de
     meeste toetsen) hoort te blijven werken -- en de terugval gaat de
     STRENGSTE kant op: er is dan geen middelste laag. */
  const G = maakGrens({ volwassen: (h) => h === 'rahul' });
  assert.equal(G.laagVan('rahul'), 'volwassen');
  assert.equal(G.laagVan('mo'), 'kind', 'zonder leeftijd geen tussenlaag');
  assert.equal(G.werkMag('mo'), false);
});

/* ================= en nu door de echte deur ================= */

/* De toetsen hierboven vragen het de GRENS. Maar een grens die niemand
   afdwingt is een commentaar: de handhaving zit in server/kern/spellen/partij.js,
   naast de beurtbewaking, en die wordt hier pas geraakt. Precies dezelfde les
   als bij de beurtvolgorde, die jarenlang niet doorging omdat elke toets de
   motor rechtstreeks aansprak. */
function aanTafel(leeftijden) {
  const db = { data: { spellen: { potjes: {}, wachtrij: {} } } };
  const kern = require('../server/kern/spellen')({
    db, save() {}, crypto: require('crypto'), zijnVrienden: () => true,
    codenaamVan: (x) => x, sseToCustomer() {}, isGeblokkeerd: () => false,
    socialZoek: async () => [], sociaalRate: () => true,
    volwassen: (h) => leeftijden[h] != null && leeftijden[h] >= 18,
    leeftijd: (h) => (h in leeftijden ? leeftijden[h] : null),
    sseClients: [], lidBoardUit: () => false });
  const REG = require('../server/kern/spellen/register')({ save() {}, crypto: require('crypto'),
    schud: (a) => a, beurtDoor() {}, codenaamVan: (x) => x, nudge() {} });
  const spelers = Object.keys(leeftijden);
  const p = { id: 'p1', soort: 'magnaat', modus: 'vrij', spelers, uitgenodigd: [], beurt: 0,
    teams: spelers.map((_, i) => i), status: 'bezig', winnaar: null,
    at: new Date().toISOString(), variant: { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' } };
  REG.INITS.magnaat(p);
  db.data.spellen.potjes.p1 = p;
  for (const h of spelers) p.staat.geld[h] = 3000000;
  const kavels = require('../server/kern/spellen/magnaat/kaart')
    .kaart('ijmuiden').kavels.filter(k => k.zone === 'boulevard');
  let n = 0;
  const open = (h) => kern.spelZet(h, 'p1',
    { actie: 'open', kavel: kavels[n++].id, sector: 'horeca', omvang: 20 });
  return { kern, p, open };
}

test('een zestienjarige komt door de echte deur niet aan een vestiging', () => {
  const { kern, p, open } = aanTafel({ rahul: 40, mo: 16 });
  assert.ok(open('rahul').ok, 'de volwassene bouwt gewoon');
  assert.equal(p.beurt, 1, 'en mo is aan zet');
  const r = open('mo');
  assert.equal(r.ok, undefined, 'zestien opent geen zaak');
  assert.equal(r.status, 403);
  assert.match(r.error, /volwassen laag|bijbaan/i, r.error);
  assert.equal((p.staat.vestigingen.mo || []).length, 0);
});

test('en hij kan wel solliciteren op de zaak van de volwassene', () => {
  const { kern, p, open } = aanTafel({ rahul: 40, mo: 16 });
  assert.ok(open('rahul').ok);
  const zaak = p.staat.vestigingen.rahul[0];
  const f = kern.spelZet('rahul', 'p1', { actie: 'functie-openen', vestiging: zaak.id, rol: 'vakkracht' });
  assert.ok(f.ok, JSON.stringify(f));
  const s = kern.spelZet('mo', 'p1', { actie: 'solliciteren', id: f.id });
  assert.ok(s.ok, 'een bijbaan hoort te kunnen: ' + JSON.stringify(s));
  assert.ok(kern.spelZet('rahul', 'p1', { actie: 'aannemen', id: f.id, speler: 'mo' }).ok);
  /* En meewerken in de zaak waar hij in dienst is. WAT hij dan mag verzetten
     hangt aan zijn ROL en niet aan zijn leeftijd: een vakkracht zet het
     onderhoud, een hulpkracht beslist niets (magnaat/dienst-rollen.js). Twee
     grenzen die elkaar niet in de weg zitten. */
  assert.ok(kern.spelZet('mo', 'p1', { actie: 'werk-beleid', onderhoud: 400 }).ok);
  const teVer = kern.spelZet('mo', 'p1', { actie: 'werk-beleid', prijs: 'hoog' });
  assert.equal(teVer.status, 403, 'de prijs zetten is de bedrijfsleider, niet de vakkracht');
});

test('lenen, aannemen en besturen blijven voor hem dicht', () => {
  const { kern, p, open } = aanTafel({ rahul: 40, mo: 16 });
  assert.ok(open('rahul').ok);
  for (const zet of [{ actie: 'krediet-opnemen', bedrag: 50000 },
    { actie: 'functie-openen', rol: 'hulp', vestiging: p.staat.vestigingen.rahul[0].id },
    { actie: 'bestuur-zet', actie2: 'open' },
    { actie: 'beurs-kopen', id: 'x' },
    { actie: 'uitstappen' }]) {
    const r = kern.spelZet('mo', 'p1', zet);
    assert.equal(r.status, 403, zet.actie + ' hoorde geweigerd te worden: ' + JSON.stringify(r));
  }
});

test('een kind speelt door de echte deur ook alles', () => {
  /* Onder de grens verandert er niets: elk spel blijft volledig speelbaar, er
     wordt alleen niets van bewaard. Dat is iets anders dan een verbod. */
  const { p, open } = aanTafel({ rahul: 40, tess: 12 });
  assert.ok(open('rahul').ok);
  assert.ok(open('tess').ok, 'een kind opent gewoon een zaak');
  assert.equal(p.staat.vestigingen.tess.length, 1);
});

test('een zestienjarige kan promotie krijgen, maar geen bedrijfsleider worden', () => {
  /* De grens zit op het moment van AANVAARDEN. Een werkgever mag voorstellen wat
     hij wil; verantwoordelijkheid aannemen waar je te jong voor bent kan niet.
     Hulp naar vakkracht is vakinhoudelijk en hoort juist wel te kunnen. */
  const { kern, p, open } = aanTafel({ rahul: 40, mo: 16 });
  assert.ok(open('rahul').ok);
  const zaak = p.staat.vestigingen.rahul[0];
  const f = kern.spelZet('rahul', 'p1', { actie: 'functie-openen', vestiging: zaak.id, rol: 'hulp' });
  kern.spelZet('mo', 'p1', { actie: 'solliciteren', id: f.id });
  kern.spelZet('rahul', 'p1', { actie: 'aannemen', id: f.id, speler: 'mo' });
  const d = require('../server/kern/spellen/magnaat/dienst').dienstVan(p.staat, 'mo');

  const naarVak = kern.spelZet('rahul', 'p1', { actie: 'promotie-aanbieden', dienst: d.id, rol: 'vakkracht' });
  assert.ok(naarVak.ok, JSON.stringify(naarVak));
  assert.ok(kern.spelZet('mo', 'p1', { actie: 'promotie-antwoord', id: naarVak.id, antwoord: 'ja' }).ok,
    'beter worden in je vak hoort te kunnen op je zestiende');
  assert.equal(require('../server/kern/spellen/magnaat/dienst').dienstVan(p.staat, 'mo').rol, 'vakkracht');

  const naarLeider = kern.spelZet('rahul', 'p1', { actie: 'promotie-aanbieden', dienst: d.id, rol: 'bedrijfsleider' });
  assert.ok(naarLeider.ok, 'aanbieden mag de werkgever');
  const r = kern.spelZet('mo', 'p1', { actie: 'promotie-antwoord', id: naarLeider.id, antwoord: 'ja' });
  assert.equal(r.status, 403, 'maar aannemen kan hij niet: ' + JSON.stringify(r));
  assert.equal(require('../server/kern/spellen/magnaat/dienst').dienstVan(p.staat, 'mo').rol, 'vakkracht');
  /* En weigeren mag altijd -- dat is geen verantwoordelijkheid. */
  assert.ok(kern.spelZet('mo', 'p1', { actie: 'promotie-antwoord', id: naarLeider.id, antwoord: 'nee' }).ok);
});

test('een zestienjarige solliciteert niet op een bedrijfsleidersvacature', () => {
  const { kern, p, open } = aanTafel({ rahul: 40, mo: 16 });
  assert.ok(open('rahul').ok);
  const zaak = p.staat.vestigingen.rahul[0];
  const f = kern.spelZet('rahul', 'p1', { actie: 'functie-openen', vestiging: zaak.id, rol: 'bedrijfsleider' });
  assert.ok(f.ok);
  const r = kern.spelZet('mo', 'p1', { actie: 'solliciteren', id: f.id });
  assert.equal(r.status, 403, JSON.stringify(r));
});
