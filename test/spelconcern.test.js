/* MAGNAAT: HET CONCERN -- wat het kost om een bedrijf te zijn in plaats van een zaak.

   ZES BEWERINGEN, en ze zijn alle zes stil terug te draaien:

   1. DE OVERHEAD GROEIT SNELLER DAN HET AANTAL, maar nooit tot een verbod.
   2. FOCUS IS GOEDKOPER DAN SPREIDING.
   3. HET IS EEN ZICHTBARE POST met zijn opbouw erbij, en geen verborgen aftrek.
   4. JE ZIET VOORAF WAT DE VOLGENDE ZAAK KOST.
   5. HET GELD VERLAAT DE WERELD, zoals rente en premie.
   6. HIJ TREKT DE OPEN DRAAD DICHT: met een schaalnadeel is doorbouwen niet
      langer de enige zet.

   Draai los: node --experimental-sqlite --test test/spelconcern.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const C = require('../server/kern/spellen/magnaat/concern');
const { kaart } = require('../server/kern/spellen/magnaat/kaart');

const maakMagnaat = () => require('../server/kern/spellen/magnaat/index')({
  save() {}, crypto: require('crypto'), codenaamVan: (h) => 'CN-' + h, nudge() {}
});
const ECO = { vorm: 'economie', stad: 'IJmuiden', duur: 'weekend' };
const kavelsIn = (zone) => kaart('ijmuiden').kavels.filter(k => k.zone === zone);
const zone = (v) => v.zone;
const rij = (n, sector = 'horeca', z = 'boulevard') =>
  Array.from({ length: n }, () => ({ sector, zone: z }));

function opstelling(id = 'p1', hoeveel = 1) {
  const m = maakMagnaat();
  const p = { id, soort: 'magnaat', spelers: ['anna', 'boris'], teams: [0, 1], modus: 'vrij',
    status: 'bezig', beurt: 0, winnaar: null, variant: ECO };
  m.spel.init(p);
  for (const h of p.spelers) p.staat.geld[h] = 6000000;
  const kav = kavelsIn('boulevard');
  for (let i = 0; i < hoeveel; i++)
    m.eco.zet(p, 'anna', { actie: 'open', kavel: kav[i].id, sector: 'horeca', omvang: 24 });
  const maand = (n = 1) => { for (let i = 0; i < n; i++) { p.staat.gerekendTot -= p.staat.maandMs; m.eco.bijrekenen(p); } };
  return { m, p, st: p.staat, maand };
}

/* ================= 1. sneller dan het aantal, nooit een verbod =========== */

test('twee zaken kosten meer dan twee keer een zaak', () => {
  const een = C.kosten(rij(1), zone).totaal;
  const twee = C.kosten(rij(2), zone).totaal;
  assert.ok(twee > een * 2, 'superlineair: ' + een + ' -> ' + twee);
  assert.ok(twee < een * 4, 'maar niet kwadratisch, anders is de vierde al onbetaalbaar');
});

test('de kosten per zaak lopen op, en blijven eindig', () => {
  const perZaak = [1, 2, 5, 10, 20, 40].map(n => C.kosten(rij(n), zone).perZaak || C.kosten(rij(n), zone).totaal);
  for (let i = 1; i < perZaak.length; i++)
    assert.ok(perZaak[i] > perZaak[i - 1], 'elke stap kost meer per zaak: ' + perZaak.join(' '));
  assert.ok(perZaak[perZaak.length - 1] < perZaak[0] * 6,
    'maar veertig zaken kosten niet zes keer zoveel per stuk; dan is groeien verboden');
});

test('een zaak alleen heeft geen hoofdkantoor van betekenis', () => {
  const k = C.kosten(rij(1), zone);
  assert.equal(k.totaal, C.BASIS, 'een ondernemer met een zaak heeft een keukentafel');
  assert.equal(C.kosten([], zone).totaal, 0, 'en wie niets heeft betaalt niets');
});

/* ================= 2. focus is goedkoper dan spreiding ================= */

test('acht zaken in een sector kosten minder dan acht over zeven sectoren', () => {
  const gefocust = C.kosten(rij(8), zone).totaal;
  const gespreid = C.kosten([['horeca', 'boulevard'], ['hotel', 'centrum'], ['retail', 'station'],
    ['logistiek', 'terrein'], ['kantoor', 'centrum'], ['industrie', 'haven'],
    ['vrije-tijd', 'sluizen'], ['horeca', 'haven']].map(([s, z]) => ({ sector: s, zone: z })), zone).totaal;
  assert.ok(gespreid > gefocust, 'spreiden kost meer: ' + gefocust + ' -> ' + gespreid);
  assert.ok(gespreid <= gefocust * C.MAX_SPREIDING + 1,
    'maar hoogstens het plafond; anders is spreiden verboden in plaats van duur');
});

test('een tweede buurt kost minder dan een tweede sector', () => {
  /* Tien restaurants in twee straten runnen is eenvoudiger dan vijf restaurants
     en vijf loodsen in een straat. Zou dat andersom zijn, dan loont uitwijken
     naar een andere sector boven uitwijken naar een andere buurt, en dat is niet
     wat een concern moeilijk maakt. */
  const buurt = C.kosten(rij(4).concat(rij(4, 'horeca', 'centrum')), zone).totaal;
  const sector = C.kosten(rij(4).concat(rij(4, 'hotel', 'boulevard')), zone).totaal;
  assert.ok(buurt < sector, 'een tweede sector weegt zwaarder: ' + buurt + ' tegen ' + sector);
  assert.ok(C.PER_SECTOR > C.PER_ZONE);
});

/* ================= 3. een zichtbare post ================= */

test('het hoofdkantoor staat als eigen regel op het maandoverzicht', () => {
  const { m, p, st, maand } = opstelling('p1', 3);
  maand(2);
  const regel = st.laatste.anna.regels.find(r => r.soort === 'concern');
  assert.ok(regel, 'er staat een regel');
  assert.ok(regel.resultaat < 0, 'en het is een kostenpost');
  assert.equal(regel.zaken, 3, 'met het aantal zaken erbij');
  assert.ok(regel.schaal > 1, 'en waar de opslag vandaan komt');
  assert.equal(regel.sectoren, 1);
  assert.equal(regel.zones, 1);
});

test('de kas beweegt alleen met de regels op het overzicht', () => {
  const { m, p, st, maand } = opstelling('p1', 3);
  for (let i = 0; i < 12; i++) {
    const voor = st.geld.anna;
    maand(1);
    const som = st.laatste.anna.regels.reduce((n, r) => n + (r.resultaat || 0), 0);
    assert.ok(Math.abs((st.geld.anna - voor) - som) < 1.5,
      'maand ' + st.maand + ': kas ' + Math.round(st.geld.anna - voor) + ' tegen regels ' + Math.round(som));
  }
});

test('je eigen concern zie je, dat van een ander niet', () => {
  const { m, p, st, maand } = opstelling('p1', 3);
  maand(1);
  const eigen = m.eco.zicht(p, st, 'anna').concern;
  assert.equal(eigen.aantal, 3);
  assert.deepEqual(eigen.perSector, { horeca: 3 });
  assert.ok(eigen.uitleg, 'met een uitleg erbij');
  const vanBoris = m.eco.zicht(p, st, 'boris').concern;
  assert.equal(vanBoris.aantal, 0, 'boris ziet zijn eigen concern en niet dat van anna');
});

/* ================= 4. je ziet vooraf wat de volgende kost ================= */

test('wat een zaak erbij kost staat er voordat je bouwt', () => {
  const v = C.volgende(rij(4), zone, 'horeca', 'boulevard');
  assert.equal(v.nu, C.kosten(rij(4), zone).totaal);
  assert.equal(v.straks, C.kosten(rij(5), zone).totaal);
  assert.equal(v.erbij, v.straks - v.nu);
  assert.ok(v.erbij > 0, 'en het is een echt bedrag: ' + v.erbij);
  // en een zaak in een NIEUWE sector kost meer dan een in dezelfde
  const zelfde = C.volgende(rij(4), zone, 'horeca', 'boulevard').erbij;
  const nieuw = C.volgende(rij(4), zone, 'industrie', 'haven').erbij;
  assert.ok(nieuw > zelfde, 'uitwijken kost extra: ' + zelfde + ' -> ' + nieuw);
});

test('het scherm noemt wat de volgende zaak kost', () => {
  const { m, p, st, maand } = opstelling('p1', 2);
  maand(1);
  assert.ok(m.eco.zicht(p, st, 'anna').concern.erbij > 0);
});

/* ================= 5. het verlaat de wereld ================= */

test('het hoofdkantoor telt mee als lek', () => {
  const { m, p, st, maand } = opstelling('p1', 3);
  st.gerekendTot -= st.maandMs;
  const [verslag] = m.eco.bijrekenen(p);
  assert.ok(verslag.concernlast > 0, 'de maand meldt wat het hoofdkantoor kostte');
  const uitRegels = st.laatste.anna.regels.filter(r => r.soort === 'concern')
    .reduce((n, r) => n - r.resultaat, 0);
  assert.equal(verslag.concernlast, Math.round(uitRegels));
});

test('de geldpompkeuring blijft schoon met een concern', () => {
  const { meet, SCENARIOS } = require('../scripts/magnaat-pomp');
  for (const sleutel of ['wederzijdseFacturen', 'bouwenEnSluiten', 'beheerlaten'])
    assert.equal(meet(sleutel, 12).klacht, null, sleutel);
  assert.ok(Object.keys(SCENARIOS).length > 10);
});

/* ================= 6. de open draad ================= */

test('met een schaalnadeel is doorbouwen niet langer de enige zet', () => {
  /* DE DRAAD DIE HIER DICHTGAAT. Het toernooi meldde het rondes lang: zolang er
     goede kavels vrij zijn verslaat uitbreiden ELKE investering die alleen
     kosten verlaagt -- onderzoek, beheer, financiering, alles verloor van
     `handwerk`, dezelfde stijl die gewoon doorbouwt. De oorzaak was niet dat die
     lagen te duur waren maar dat groei nergens een nadeel had. */
  const S = require('../scripts/magnaat-strateeg');
  const gemiddeld = (profiel) => {
    let som = 0, n = 0;
    for (const teg of ['onderhoud', 'horeca', 'inkoper']) for (let o = 0; o < 4; o++) {
      som += S.campagne(profiel, teg, o).find(x => x.codenaam === 'a').vermogen; n++;
    }
    return som / n;
  };
  const handwerk = gemiddeld('handwerk'), uitvinder = gemiddeld('uitvinder');
  assert.ok(uitvinder > handwerk,
    'onderzoek hoort te lonen zodra groei een prijs heeft: ' +
    Math.round(handwerk) + ' tegen ' + Math.round(uitvinder));
});

test('en de kaart wordt nog steeds bespeeld', () => {
  /* De andere kant van dezelfde ijking. Bij een te zware rem werd er nog maar
     24% van de kavels bebouwd tegen 48% ervoor, en dan is de rem geen afweging
     meer maar een verbod op groeien -- dezelfde fout in spiegelbeeld. */
  const { veld } = require('../scripts/magnaat-strateeg');
  let bezet = 0;
  const zes = ['horeca', 'mobility', 'inkoper', 'toelever', 'keten', 'onderhoud'];
  for (let o = 0; o < 3; o++) bezet += veld(zes, o).vol;
  assert.ok(bezet / 3 > 0.28, 'er wordt om de kaart gespeeld: ' + Math.round(bezet / 3 * 100) + '%');
  assert.ok(bezet / 3 < 0.75, 'en hij loopt niet vanzelf vol');
});
