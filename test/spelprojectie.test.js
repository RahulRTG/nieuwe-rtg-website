/* De projectiekamer: een potje op een gedeeld scherm.

   Alles hier hangt aan één zin: EEN SCHERM IS EEN PROJECTIE EN GEEN DEELNEMER.
   Het heeft geen sessie en geen sleutel, het krijgt uitsluitend
   `zicht.publiek`, en het kan niets terugsturen. De zwaarste toets is daarom
   niet "werkt de code" maar "kan het scherm de kaart van 30 Seconden krijgen" --
   en het antwoord moet nee zijn omdat die kaart niet in die laag ZIT, niet
   omdat we hem niet meesturen.

   Draai los: node --experimental-sqlite --test test/spelprojectie.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakSpellen = require('../server/kern/spellen');

function opstelling({ volwassen = () => true } = {}) {
  const db = { data: { spellen: { potjes: {}, wachtrij: {} } } };
  const kern = maakSpellen({ db, save() {}, crypto: require('crypto'), zijnVrienden: () => true,
    codenaamVan: (x) => 'CN-' + x, sseToCustomer() {}, isGeblokkeerd: () => false,
    socialZoek: async () => [], sociaalRate: () => true, volwassen,
    sseClients: [], lidBoardUit: () => false });
  return { db, kern };
}

// een lopend potje 30 Seconden MET een kaart op tafel
async function seconden(o) {
  const r = await o.kern.spelNieuw('a', { soort: 'seconden', grootte: 4, vrienden: ['b', 'c', 'd'], wereld: 'rtg' });
  for (const x of ['b', 'c', 'd']) o.kern.spelAntwoord(x, r.id, true);
  o.kern.spelZet('a', r.id, { actie: 'kaart' });
  return r.id;
}

/* ---------- waar het allemaal om begonnen is ---------- */

test('het gedeelde scherm van 30 Seconden krijgt de kaart NIET', async () => {
  /* Het spel dat het meest om een televisie vraagt was tot nu toe het enige dat
     er niet op kon: de spelerweergave verbergt de kaart op spelersindex en een
     scherm heeft er geen. Nu krijgt het scherm een eigen laag, en de kaart zit
     daar niet in. */
  const o = opstelling();
  const id = await seconden(o);
  const k = o.kern.projectieOpen('a', id);
  assert.equal(k.status, 200);
  const scherm = o.kern.projectieStand(k.code);
  assert.equal(scherm.status, 200);
  assert.ok(o.db.data.spellen.potjes[id].staat.kaart, 'er ligt wel degelijk een kaart');
  assert.equal(scherm.staat.kaart, undefined, 'maar het scherm ziet hem niet');
  assert.ok(Array.isArray(scherm.staat.scores), 'wel de stand');
  assert.equal(typeof scherm.staat.rader, 'number', 'en wie er raadt');
});

test('het scherm heeft geen sessie nodig, en dat is de hele opzet', async () => {
  /* `projectieStand` neemt geen speler aan -- er is niets om mee te geven. Een
     televisie in een vakantiehuis hoort geen ingelogd RTG-account te dragen. */
  const o = opstelling();
  const id = await seconden(o);
  const k = o.kern.projectieOpen('a', id);
  assert.equal(o.kern.projectieStand.length, 1, 'de functie neemt alleen een code aan');
  assert.equal(o.kern.projectieStand(k.code).status, 200);
});

/* ---------- de code ---------- */

test('alleen een speler van dit potje opent een kamer', async () => {
  const o = opstelling();
  const id = await seconden(o);
  assert.equal(o.kern.projectieOpen('vreemde', id).status, 404);
});

test('twee keer openen geeft dezelfde kamer', async () => {
  // anders brengt een gastheer die twee keer tikt twee codes in omloop
  const o = opstelling();
  const id = await seconden(o);
  assert.equal(o.kern.projectieOpen('a', id).code, o.kern.projectieOpen('b', id).code);
});

test('een verzonnen code doet niets', () => {
  const o = opstelling();
  assert.equal(o.kern.projectieStand('DEADBEEF').status, 404);
  assert.equal(o.kern.projectieStand('').status, 404);
});

test('een verlopen kamer doet niets meer', async () => {
  const o = opstelling();
  const id = await seconden(o);
  const k = o.kern.projectieOpen('a', id);
  o.db.data.spellen.projectie[k.code].tot = new Date(Date.now() - 1000).toISOString();
  assert.equal(o.kern.projectieStand(k.code).status, 404, 'een code die blijft werken is een tv die morgen meekijkt');
});

test('elke speler mag de kamer dichtdoen', async () => {
  // wie aan tafel zit en het beeld niet wil, hoeft niet eerst de gastheer te zoeken
  const o = opstelling();
  const id = await seconden(o);
  const k = o.kern.projectieOpen('a', id);
  assert.equal(o.kern.projectieSluit('c', id).status, 200);
  assert.equal(o.kern.projectieStand(k.code).status, 404);
});

test('verdwijnt het potje, dan verdwijnt de kamer', async () => {
  const o = opstelling();
  const id = await seconden(o);
  const k = o.kern.projectieOpen('a', id);
  delete o.db.data.spellen.potjes[id];
  assert.equal(o.kern.projectieStand(k.code).status, 404);
});

/* ---------- welke spellen er uberhaupt op een scherm mogen ---------- */

test('een spel zonder projectieweergave krijgt geen kamer', async () => {
  /* Dezelfde vraag als "heeft dit spel een zicht.publiek", en die wordt hier
     niet een tweede keer beantwoord maar bij de weergave opgehaald. */
  const o = opstelling();
  const r = await o.kern.spelNieuw('a', { soort: 'magnaat', grootte: 2, vrienden: ['b'], wereld: 'rtg' });
  o.kern.spelAntwoord('b', r.id, true);
  const k = o.kern.projectieOpen('a', r.id);
  assert.equal(k.status, 400);
  assert.match(k.error, /gedeeld scherm/);
});

test('Proost hoort NIET op een gedeeld scherm, en dat is een besluit', async () => {
  /* Die poort is 18+ en een projectie heeft geen leeftijd. Het staat als
     ontbrekende `zicht.publiek` in de descriptor, met de reden erbij -- dus
     deze weigering volgt uit het zicht en niet uit een tweede regel. */
  const o = opstelling();
  const r = await o.kern.spelNieuw('a', { soort: 'proost', grootte: 2, vrienden: ['b'], wereld: 'rtg' });
  o.kern.spelAntwoord('b', r.id, true);
  assert.equal(o.kern.projectieOpen('a', r.id).status, 400);
});

test('een klaar potje krijgt geen nieuwe kamer', async () => {
  const o = opstelling();
  const id = await seconden(o);
  o.kern.spelOpgeven('a', id);
  assert.equal(o.kern.projectieOpen('b', id).status, 409);
});

/* ---------- geen enkel scherm ziet iets wat een speler verborgen wordt ---------- */

test('elke projectie blijft binnen wat de spelers al zien', async () => {
  /* De generieke regel over alle spellen met een kamer, en niet alleen over 30
     Seconden. Een nieuw `zicht.publiek` valt hier vanzelf onder. */
  const o = opstelling();
  const id = await seconden(o);
  const k = o.kern.projectieOpen('a', id);
  const scherm = o.kern.projectieStand(k.code).staat;
  const p = o.db.data.spellen.potjes[id];
  const REG = require('../server/kern/spellen/register')({ save() {}, crypto: require('crypto'),
    schud: (x) => x, beurtDoor() {}, codenaamVan: (x) => x, nudge() {} });
  for (const veld of Object.keys(scherm)) {
    if (scherm[veld] === null || scherm[veld] === undefined) continue;
    const verborgen = p.spelers.some(sp => {
      const v = REG.ZICHT[p.soort].speler(p, p.staat, sp)[veld];
      return v === null || v === undefined;
    });
    assert.ok(!verborgen, 'het scherm toont `' + veld + '` terwijl een speler dat niet mag zien');
  }
});
