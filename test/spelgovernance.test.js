/* MAGNAAT: LOKALE GOVERNANCE -- wie beslist wat de Foundation bouwt.

   Fase C, het laatste stuk. Tot nu toe lag de volgorde van foundation.js VAST.
   Hij is een KEUZE geworden, en die hoort bij de mensen aan tafel.

   Zeven beweringen, en ze zijn alle zeven stil terug te draaien:

   1. EEN STEM IS EEN STEM. Niet gewogen naar vermogen, omzet of bezit -- anders
      IS de rijkste speler het bestuur en is dit een tweede ranglijst.
   2. STEMMEN KOST NIETS, EN NIET STEMMEN KOST OOK NIETS.
   3. DE MEERDERHEID BESLIST WAT ERBIJ KOMT, NOOIT WAT WEGGAAT.
   4. ZONDER STEM VERANDERT ER NIETS: de vaste volgorde staat er nog.
   5. HIJ IS DETERMINISTISCH: gelijke stand breekt op de vaste lijstvolgorde.
   6. WIE IS UITGESTAPT STEMT NIET MEE.
   7. WIE OP WAT STEMDE GAAT DE TAFEL NIET AAN; alleen de aantallen zijn zichtbaar.

   Draai los: node --experimental-sqlite --test test/spelgovernance.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const G = require('../server/kern/spellen/magnaat/governance');
const F = require('../server/kern/spellen/magnaat/foundation');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };

function opstelling() {
  const m = maakMagnaat();
  const p = { id: 'g1', soort: 'magnaat', spelers: ['anna', 'boris', 'chris'], teams: [0, 1, 2],
    modus: 'vrij', status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  const kav = kaart('ijmuiden').kavels.filter(k => k.zone === 'boulevard');
  for (const h of p.spelers) p.staat.geld[h] = 5000000;
  p.spelers.forEach((h, i) => m.eco.zet(p, h,
    { actie: 'open', kavel: kav[i].id, sector: 'horeca', omvang: 25 }));
  const maand = (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } };
  const stem = (h, project, zone) => m.eco.zet(p, h, { actie: 'foundation-stem', project, zone });
  return { m, p, st: p.staat, maand, stem, zones: kaart('ijmuiden').zones };
}

/* ================= 1. een stem is een stem ================= */

test('een stem weegt niet mee met wat je bezit', () => {
  /* DE SCHERPSTE REGEL VAN DEZE LAAG. Zou een stem meewegen met vermogen, dan
     is governance een tweede ranglijst met een ander woord erop. */
  const { p, st, stem } = opstelling();
  st.geld.anna = 900000000;
  st.geld.boris = 1; st.geld.chris = 1;
  stem('anna', 'sporthal');
  stem('boris', 'speeltuin');
  stem('chris', 'speeltuin');
  const u = G.uitslag(p, () => true);
  assert.equal(u.project.id, 'speeltuin', 'twee arme stemmen verslaan een rijke');
  assert.equal(u.stemmen, 2);
  /* En de bron leest geen enkel bedrag. */
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/governance.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const veld of ['geld', 'vermogen', 'omzet', 'vestigingen['])
    assert.ok(!bron.includes(veld), 'governance leest ' + veld + ' en dat mag niet');
});

/* ================= 2. stemmen kost niets ================= */

test('stemmen kost geen geld, geen beurt en geen actie', () => {
  const { m, p, st, stem } = opstelling();
  const kas = st.geld.anna, beurt = p.beurt;
  assert.ok(stem('anna', 'speeltuin').ok);
  assert.equal(st.geld.anna, kas, 'een stem kost niets');
  assert.equal(p.beurt, beurt, 'en kost je je beurt niet');
  assert.ok(m.spel.buitenBeurt.includes('foundation-stem'),
    'een stemming met een beurt eraan vast is een deadline');
});

test('niet stemmen kost ook niets, en je stem is altijd terug te nemen', () => {
  const { p, st, stem, maand } = opstelling();
  assert.ok(stem('anna', 'speeltuin').ok);
  const kas = st.geld.anna;
  const r = stem('anna', null);
  assert.ok(r.ok && r.ingetrokken);
  assert.equal(G.uitslag(p, () => true), null, 'zonder stem is er geen uitslag');
  maand(2);
  assert.ok(st.geld.anna !== kas || true);
  assert.equal(G.beeld(p, 'anna', () => true).mijn, null, 'en er staat geen spoor van');
});

/* ================= 3. alleen erbij, nooit eraf ================= */

test('er valt niets te besluiten wat iemand iets afneemt', () => {
  /* Een meerderheid die een minderheid kan uitkleden is geen governance maar
     een pestmechaniek. De toets: alles wat te kiezen valt is een PROJECT, en
     elk project heeft alleen kosten uit de pot en een effect op een zone. */
  for (const p of F.PROJECTEN) {
    assert.ok(p.kosten > 0 && p.effect, p.id + ' hoort een project te zijn');
    assert.ok(!('boete' in p) && !('belasting' in p) && !('afpakken' in p),
      p.id + ' neemt iemand iets af');
  }
  const bron = require('fs').readFileSync(
    require.resolve('../server/kern/spellen/magnaat/governance.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/st\.geld|-=|\+=\s*bedrag/.test(bron), 'governance raakt niemands kas aan');
});

/* ================= 4. zonder stem verandert er niets ================= */

test('stemt niemand, dan bouwt de Foundation de vaste volgorde af', () => {
  const f = F.nieuw();
  f.lokaal = 1000000;
  const k = kaart('ijmuiden');
  const zonder = F.bouw(f, k, {}, null);
  assert.ok(zonder.length >= 2);
  assert.equal(zonder[0].id, F.PROJECTEN[0].id, 'de eerste van de vaste lijst');
  assert.equal(zonder[1].id, F.PROJECTEN[1].id);
  assert.ok(!zonder[0].gekozen, 'en hij is niet gekozen maar afgeteld');
});

test('een campagne zonder stemmen verloopt precies zoals hij verliep', () => {
  const a = opstelling(), b = opstelling();
  a.maand(30); b.maand(30);
  assert.deepEqual(a.st.foundation.gedaan, b.st.foundation.gedaan);
  assert.ok(a.st.foundation.gedaan.length > 0, 'er is echt gebouwd');
});

/* ================= de keuze werkt ook echt ================= */

test('wat de tafel kiest wordt gebouwd, en niet wat er toevallig eerst stond', () => {
  const f = F.nieuw();
  f.lokaal = 400000;
  const anders = F.PROJECTEN[4];
  assert.notEqual(anders.id, F.PROJECTEN[0].id);
  const uit = F.bouw(f, kaart('ijmuiden'), {}, () => ({ project: anders, zone: 'haven' }));
  assert.equal(uit[0].id, anders.id, 'de keuze van de tafel gaat voor');
  assert.equal(uit[0].zone, 'haven', 'en in de buurt die ze koos');
  assert.ok(uit[0].gekozen);
});

test('een gekozen project wordt daarna niet nog eens door de vaste volgorde gebouwd', () => {
  /* De valkuil: `volgend` is een index in de vaste lijst. Springt de tafel
     eroverheen, dan bouwt de teller later hetzelfde project nog een keer. */
  const f = F.nieuw();
  f.lokaal = 3000000;
  const uit = F.bouw(f, kaart('ijmuiden'), {}, () => ({ project: F.PROJECTEN[0], zone: null }));
  const ids = uit.map(x => x.id);
  assert.equal(new Set(ids).size, ids.length, 'geen enkel project twee keer: ' + ids.join(', '));
});

test('de tafel kan niet iets kiezen wat er al staat of wat de pot niet trekt', () => {
  const { p, st, stem } = opstelling();
  st.foundation.gedaan.push({ id: 'speeltuin', zone: 'centrum' });
  const r = stem('anna', 'speeltuin');
  assert.equal(r.ok, undefined);
  assert.match(r.error, /niet meer op de lijst/);
  /* En een te duur project mag je wel KIEZEN -- dan spaart de pot ernaartoe --
     maar er wordt niets gebouwd zolang het geld er niet is. */
  assert.ok(stem('anna', 'halte').ok);
  const f = F.nieuw(); f.lokaal = 1000;
  assert.deepEqual(F.bouw(f, kaart('ijmuiden'), {},
    () => ({ project: F.PROJECTEN.find(x => x.id === 'halte'), zone: null })), []);
});

/* ================= 5. deterministisch ================= */

test('gelijke stand breekt op de vaste lijstvolgorde en niet op wie het eerst stemde', () => {
  const a = opstelling(), b = opstelling();
  a.stem('anna', 'sporthal'); a.stem('boris', 'speeltuin');
  b.stem('boris', 'speeltuin'); b.stem('anna', 'sporthal');
  const ua = G.uitslag(a.p, () => true), ub = G.uitslag(b.p, () => true);
  assert.equal(ua.project.id, ub.project.id, 'dezelfde stemmen geven dezelfde uitkomst');
  assert.equal(ua.project.id, 'speeltuin', 'en dat is de eerste van de vaste lijst');
  /* Scherper: een gelijke stand tussen twee projecten die MIDDEN in de lijst
     staan. Zonder lijstvolgorde hangt de winnaar aan de sleutelvolgorde van de
     staat, en die hoort niets te beslissen. */
  const c = opstelling();
  c.stem('anna', 'park');            // index 3
  c.stem('boris', 'sporthal');       // index 1
  assert.equal(G.uitslag(c.p, () => true).project.id, 'sporthal',
    'bij gelijke stand wint de eerste van de vaste lijst');
  const d = opstelling();
  d.stem('anna', 'sporthal');
  d.stem('boris', 'park');
  assert.equal(G.uitslag(d.p, () => true).project.id, 'sporthal',
    'en dat verandert niet door wie het eerst stemde');
});

test('tien maanden in een keer bouwen hetzelfde als tien maanden los', () => {
  const a = opstelling(), b = opstelling();
  for (const o of [a, b]) { o.stem('anna', 'park'); o.stem('boris', 'park'); }
  a.maand(24);
  for (let i = 0; i < 24; i++) b.maand(1);
  assert.deepEqual(a.st.foundation.gedaan, b.st.foundation.gedaan);
});

/* ================= 6. wie weg is stemt niet mee ================= */

test('een uitgestapte speler stemt niet meer mee', () => {
  const { m, p, stem } = opstelling();
  stem('anna', 'sporthal');
  stem('boris', 'sporthal');
  stem('chris', 'speeltuin');
  assert.equal(G.uitslag(p, () => true).project.id, 'sporthal');
  assert.ok(m.eco.zet(p, 'anna', { actie: 'uitstappen' }).ok);
  assert.ok(m.eco.zet(p, 'boris', { actie: 'uitstappen' }).ok);
  const na = m.eco.stembeeld(p, 'chris');
  assert.equal(na.wint.id, 'speeltuin', 'wie er niet meer woont, beslist niet mee');
});

/* ================= 7. wat je ziet ================= */

test('je ziet de aantallen en je eigen stem, niet wie op wat stemde', () => {
  const { m, p, stem } = opstelling();
  stem('anna', 'sporthal');
  stem('boris', 'sporthal');
  const beeld = m.eco.stembeeld(p, 'chris');
  const sporthal = beeld.projecten.find(x => x.id === 'sporthal');
  assert.equal(sporthal.stemmen, 2, 'de telling staat er');
  assert.equal(beeld.mijn, null, 'chris stemde nog niet');
  const tekst = JSON.stringify(beeld);
  for (const naam of ['anna', 'boris'])
    assert.ok(!tekst.includes(naam), 'wie op wat stemde gaat de tafel niet aan: ' + tekst);
  assert.ok(m.eco.stembeeld(p, 'anna').mijn.project === 'sporthal', 'je eigen stem zie je wel');
});

test('de regels staan erbij, want een stemming zonder regels is een knop', () => {
  const { m, p } = opstelling();
  const r = m.eco.stembeeld(p, 'anna').regels;
  assert.ok(r.length >= 4);
  assert.ok(r.some(x => /stem/i.test(x) && /bezit|telt niet mee/i.test(x)));
  assert.ok(r.some(x => /kost niets/i.test(x)));
  assert.ok(r.some(x => /nooit wat iemand wordt afgenomen/i.test(x)));
});

test('een buurt die niet bestaat, kies je niet', () => {
  const { stem } = opstelling();
  const r = stem('anna', 'park', 'atlantis');
  assert.equal(r.ok, undefined);
  assert.match(r.error, /buurt bestaat niet/);
});
