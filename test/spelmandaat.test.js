/* MAGNAAT: MANDATEN -- wat iemand mag beslissen, en tot welk bedrag.

   De laag die van "de wereld gaat door zonder jou" een SPEL maakt in plaats van
   een straf (VERHAAL.md hoofdstuk 13). Bevoegdheid bestond al, twee keer, en
   allebei als JA of NEE; wat ontbrak is de GRENS.

   ACHT BEWERINGEN:

   1. EEN MANDAAT IS EEN PLAFOND EN NOOIT EEN OPDRACHT.
   2. GEEN MANDAAT IS GEEN BEVOEGDHEID -- delegeren is een handeling en geen
      beginwaarde.
   3. `true` IS ONBEGRENSD, ook bij een bevoegdheid die in euro's telt.
   4. PERSOONLIJKE BESLISSINGEN WORDEN NOOIT GEDELEGEERD.
   5. EEN AFWIJZING DRAAGT EEN REDEN, want een manager die stilvalt zonder te
      zeggen waarom is niet bij te sturen.
   6. DE MANAGER HOUDT ZICH ERAAN, en zegt het in zijn log.
   7. EEN PARTIJ ZONDER MANDATEN DRAAIT PRECIES ZOALS EERST.
   8. ER KOMT GEEN GELD BIJ: een mandaat staat iets toe, het betaalt niets.

   Draai los: node --experimental-sqlite --test test/spelmandaat.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const M = require('../server/kern/spellen/magnaat/mandaat');
const BEHEER = require('../server/kern/spellen/magnaat/beheer');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => h, nudge() {} });
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kav = (z, n = 0) => kaart('ijmuiden').kavels.filter(k => k.zone === z)[n];

function opstelling(id = 'm1', geld = 400000) {
  const m = maakMagnaat();
  const p = { id, soort: 'magnaat', spelers: ['anna'], teams: [0], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  p.staat.geld.anna = geld;
  m.eco.zet(p, 'anna', { actie: 'open', kavel: kav('boulevard').id, sector: 'horeca', omvang: 30 });
  const maand = (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } };
  return { m, p, st: p.staat, zaak: p.staat.vestigingen.anna[0], maand };
}

/* ============ 1 t/m 5: de regels zelf ============ */

test('een mandaat is een plafond, en eronder mag alles', () => {
  const mand = M.schoon({ onderhoud: 7500 });
  assert.equal(M.magVoor(mand, 'onderhoud', 7499).mag, true);
  assert.equal(M.magVoor(mand, 'onderhoud', 7500).mag, true, 'precies op de grens mag');
  assert.equal(M.magVoor(mand, 'onderhoud', 7501).mag, false, 'erboven niet');
  assert.equal(M.magVoor(mand, 'onderhoud', 0).mag, true, 'en niets doen mag altijd');
});

test('geen mandaat is geen bevoegdheid', () => {
  /* Delegeren is een handeling, geen beginwaarde. Zou een lege mandaatlijst
     "alles mag" betekenen, dan is niet-instellen de ruimste stand -- en dan is
     governance iets wat je kwijtraakt door op te letten. */
  for (const wat of ['onderhoud', 'lenen', 'prijs', 'investeren'])
    assert.equal(M.magVoor(M.LEEG, wat, 1).mag, false, wat + ' hoort dicht te staan');
  assert.match(M.magVoor(M.LEEG, 'lenen', 1).reden, /geen mandaat/);
  assert.equal(M.magVoor(M.schoon({ lenen: 0 }), 'lenen', 1).mag, false,
    'een grens van nul is geen bevoegdheid');
  assert.equal(M.magVoor(M.schoon({ lenen: -5000 }), 'lenen', 1).mag, false,
    'en een negatieve grens betekent "niet", geen schuld');
});

test('`true` is onbegrensd, ook waar het in euros telt', () => {
  /* Dit ging een keer mis en het is een leerzame: `Number(true)` is 1, dus een
     eigenaar die zei "je mag lenen" gaf zijn manager een mandaat van EEN EURO.
     De manager viel stil, precies bij degene die van zijn eigenaar juist alles
     mocht. */
  const mand = M.schoon({ lenen: true });
  assert.equal(mand.lenen, true, 'true blijft true en wordt geen bedrag');
  assert.equal(M.magVoor(mand, 'lenen', 999999999).mag, true);
  assert.equal(M.magVoor(mand, 'lenen', 999999999).grens, null, 'er is geen plafond');
});

test('persoonlijke beslissingen worden nooit gedelegeerd', () => {
  /* Niveau 1 uit hoofdstuk 13: niemand handelt hierin namens een mens. Ook niet
     als de eigenaar het zelf zou willen -- daarom weigert `magVoor` ze en
     gooit `schoon` ze weg in plaats van ze op te slaan. */
  assert.ok(M.PERSOONLIJK.length, 'er zijn persoonlijke beslissingen');
  for (const wat of M.PERSOONLIJK) {
    assert.equal(M.magVoor(M.schoon({ [wat]: true }), wat, 0).mag, false);
    assert.match(M.magVoor(M.LEEG, wat, 0).reden, /de eigenaar zelf/);
    assert.equal(M.schoon({ [wat]: 999999 })[wat], undefined,
      wat + ' hoort niet eens bewaard te worden');
  }
});

test('een afwijzing draagt een reden, met het bedrag erin', () => {
  const uit = M.magVoor(M.schoon({ onderhoud: 500 }), 'onderhoud', 1200);
  assert.equal(uit.mag, false);
  assert.match(uit.reden, /500/);
  assert.match(uit.reden, /1200/);
  assert.equal(uit.grens, 500, 'en de grens staat erbij, zodat een scherm hem kan tonen');
  assert.match(M.magVoor(M.LEEG, 'bestaatniet', 1).reden, /onbekende bevoegdheid/);
});

test('de vier niveaus zijn een gesloten lijst', () => {
  /* De lijst met wat GEEN besluit is (`LOPEND`) hoort er net zo goed in als de
     rest: zonder die eerste is "de huur is afgeschreven terwijl ik weg was" een
     bug die iemand komt melden in plaats van de wereld die doorloopt. */
  for (const wat of M.SOORTLIJST)
    assert.ok(['gedelegeerd', 'strategisch', 'persoonlijk'].includes(M.SOORTEN[wat].niveau),
      wat + ' heeft een niveau dat niet bestaat');
  assert.ok(M.LOPEND.includes('huur') && M.LOPEND.includes('loon') && M.LOPEND.includes('rente'),
    'wat altijd doorloopt staat opgeschreven');
  for (const wat of M.LOPEND)
    assert.equal(M.SOORTEN[wat], undefined, wat + ' loopt door en is dus geen bevoegdheid');
});

/* ============ 6 en 7: de manager houdt zich eraan ============ */

test('de manager blijft binnen zijn mandaat, en zegt het', () => {
  const o = opstelling('m-a');
  o.m.eco.zet(o.p, 'anna', { actie: 'beheer-aan' });
  o.m.eco.zet(o.p, 'anna', { actie: 'beheer-regels', kasbuffer: 0, mag: { onderhoud: 200 } });
  o.m.eco.zet(o.p, 'anna', { actie: 'beleid', id: o.zaak.id, onderhoud: 0 });
  o.maand(8);
  const log = o.st.beheer.anna.log || [];
  const geweigerd = log.find(x => x.wat === 'onderhoud niet verhoogd');
  assert.ok(geweigerd, 'hij hoort te melden dat hij tegen zijn mandaat aan liep: '
    + JSON.stringify(log.slice(0, 4)));
  assert.match(geweigerd.waarom, /mandaat van 200/);
  assert.ok(o.zaak.onderhoudBudget <= 200,
    'en hij blijft eronder: ' + o.zaak.onderhoudBudget);
});

test('zonder mandaat draait een partij precies zoals eerst', () => {
  /* ACHTERWAARTS COMPATIBEL, en dat is geen beleefdheid maar een eis: een partij
     die begon voordat mandaten bestonden hoort niet ineens een manager te
     hebben die stilvalt. Geen grens gezet = geen grens. */
  const zonder = opstelling('m-b');
  const met = opstelling('m-b');
  for (const o of [zonder, met]) {
    o.m.eco.zet(o.p, 'anna', { actie: 'beheer-aan' });
    o.m.eco.zet(o.p, 'anna', { actie: 'beleid', id: o.zaak.id, onderhoud: 0 });
  }
  /* De een krijgt een mandaat dat ruim boven alles ligt, de ander geen enkel. */
  met.m.eco.zet(met.p, 'anna', { actie: 'beheer-regels', mag: { onderhoud: 99999999 } });
  zonder.maand(10); met.maand(10);
  assert.equal(met.zaak.onderhoudBudget, zonder.zaak.onderhoudBudget,
    'een ruim mandaat en geen mandaat geven hetzelfde onderhoud');
  assert.equal(met.st.geld.anna, zonder.st.geld.anna, 'en dezelfde kas');
});

test('de manager leent niet boven zijn mandaat, en meldt dat', () => {
  const o = opstelling('m-c', -80000);
  o.m.eco.zet(o.p, 'anna', { actie: 'beheer-aan' });
  o.m.eco.zet(o.p, 'anna', { actie: 'beheer-regels', kasbuffer: 0, mag: { lenen: 1000 } });
  o.maand(2);
  const log = o.st.beheer.anna.log || [];
  const nee = log.find(x => x.wat === 'niet geleend');
  assert.ok(nee, 'hij hoort te melden dat hij niet mocht lenen: ' + JSON.stringify(log.slice(0, 3)));
  assert.match(nee.waarom, /mandaat van 1000/);
  assert.equal((o.st.leningen || []).length, 0, 'en er staat geen lening');
});

/* ============ 8: er komt geen geld bij ============ */

test('een mandaat staat iets toe en betaalt niets', () => {
  /* Zou een mandaat geld verplaatsen, dan is delegeren een geldpomp met een
     nette naam. Meetbaar: het INSTELLEN van een mandaat raakt de kas niet, en
     twee identieke werelden met een verschillend mandaat verschillen alleen in
     wat de manager DEED. */
  const o = opstelling('m-d');
  const voor = o.st.geld.anna;
  o.m.eco.zet(o.p, 'anna', { actie: 'beheer-regels', mag: { onderhoud: 500000, lenen: 900000 } });
  assert.equal(o.st.geld.anna, voor, 'instellen kost en levert niets');
  /* En het staat er ook echt: een mandaat dat stil verdwijnt is erger dan geen. */
  const regels = BEHEER.regelsVan(o.st, 'anna');
  assert.equal(regels.mandaat.onderhoud, 500000);
  assert.equal(regels.mandaat.lenen, 900000);
});

test('het beeld toont wat er gedelegeerd is, zonder er een cijfer van te maken', () => {
  /* Een getal dat "hoe goed is mijn governance" heet, wordt een ding om te
     maximaliseren -- en dan is de progressiemaat uit hoofdstuk 13 (kan het
     bedrijf zonder mij?) een balk geworden in plaats van een vraag. */
  const b = M.beeld(M.schoon({ onderhoud: 7500, prijs: true }));
  /* HET GAAT OM EEN OPTELSOM EN NIET OM EEN WOORD. `niveau` staat er wel in, als
     CATEGORIE (gedelegeerd/strategisch) -- dat is een naam en geen rangorde. Een
     eerdere versie van deze toets verbood het woord en zakte daarmee op zijn
     eigen uitvoer; wat verboden hoort te zijn is een getal dat de hele
     inrichting samenvat. */
  assert.ok(Array.isArray(b), 'het beeld is een lijst en geen samenvatting');
  for (const r of b) {
    assert.deepEqual(Object.keys(r).sort(), ['eenheid', 'grens', 'niveau', 'uitleg', 'wat']);
    assert.ok(['gedelegeerd', 'strategisch'].includes(r.niveau),
      'niveau is een categorie en geen cijfer: ' + r.niveau);
  }
  const tekst = JSON.stringify(b);
  for (const woord of ['score', 'punten', 'totaal', 'percentage', 'sterren'])
    assert.equal(new RegExp(woord, 'i').test(tekst), false,
      woord + ' hoort niet in een mandaatbeeld');
  const onderhoud = b.find(x => x.wat === 'onderhoud');
  assert.equal(onderhoud.grens, 7500);
  assert.equal(b.find(x => x.wat === 'prijs').grens, true);
  assert.equal(b.find(x => x.wat === 'lenen').grens, null, 'niet gedelegeerd is null, niet 0');
  for (const wat of M.PERSOONLIJK)
    assert.equal(b.some(x => x.wat === wat), false, wat + ' valt niet te delegeren');
});
