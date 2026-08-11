/* VARIANTEN: wat er aan een spel te kiezen valt zonder dat de regels veranderen.

   Een variant parametriseert; hij vervangt niet. Quizduel met schoolvragen is
   hetzelfde spel met dezelfde motor, dezelfde beurten en dezelfde poorten --
   alleen een andere vragenbron. Deze toets bewaakt de drie beweringen waarop
   dat rust, want ze zijn alle drie stil terug te draaien:

   1. DE LIJST KOMT UIT DE DESCRIPTOR EN NIET UIT HET VERZOEK. Dat is de reden
      dat een variant wel uit het verzoek mag komen en `context` niet: er valt
      alleen uit te kiezen wat het spel zelf heeft opgeschreven.
   2. EEN VERKEERDE WAARDE IS EEN 400 EN GEEN STILLE TERUGVAL. Wie 'taal groep
      3' kiest en algemene kennis krijgt, merkt dat pas als de klas de eerste
      vraag ziet.
   3. DE VRAAG OVER DE VELDEN HEEN IS VAN HET SPEL. Het platform weet niet dat
      leerstof bij de schoolbron hoort; de descriptor zegt dat met
      `variantFout`.

   Draai los: node --experimental-sqlite --test test/spelvariant.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { keurVarianten, kiesVariant } = require('../server/kern/spellen/variant');
const maakRegister = require('../server/kern/spellen/register');
const stubCtx = { save() {}, crypto: require('crypto'), schud: (a) => a, beurtDoor() {}, codenaamVan: (h) => h, nudge() {} };

// dezelfde vorm als de keuring hem gebruikt: gooit met het bestand erin
const fout = (naam, tekst) => { throw new Error(`spellen/register: ${naam} ${tekst}`); };
const keur = (s) => keurVarianten('proef.js', s, fout);

/* ================= de descriptorkant ================= */

test('een spel zonder varianten heeft er ook geen, en dat is geen fout', () => {
  assert.equal(keur({}), null);
});

test('een variantveld heeft een niet-lege keuze en een standaard', () => {
  assert.throws(() => keur({ varianten: {} }), /geen niet-leeg object/);
  assert.throws(() => keur({ varianten: { bron: { standaard: null } } }), /zonder een niet-lege `keuze`/);
  assert.throws(() => keur({ varianten: { bron: { keuze: [], standaard: null } } }), /zonder een niet-lege `keuze`/);
  assert.throws(() => keur({ varianten: { bron: { keuze: ['a'] } } }), /zonder `standaard`/);
  assert.throws(() => keur({ varianten: { bron: { keuze: [1, 2], standaard: null } } }), /keuze die geen tekst is/);
});

test('een standaard die niet in zijn eigen keuze staat wordt geweigerd', () => {
  /* Anders staat er een waarde op het potje die de speler nooit had kunnen
     kiezen, en die het spel dus ook nooit heeft uitgeprobeerd. */
  assert.throws(() => keur({ varianten: { bron: { keuze: ['a', 'b'], standaard: 'c' } } }),
    /standaard die niet in zijn eigen keuze staat/);
  assert.ok(keur({ varianten: { bron: { keuze: ['a', 'b'], standaard: null } } }), 'leeg mag wel');
});

test('een veldnaam is kort en van kleine letters', () => {
  assert.throws(() => keur({ varianten: { Bron: { keuze: ['a'], standaard: 'a' } } }), /variantveld 'Bron'/);
  assert.throws(() => keur({ varianten: { b: { keuze: ['a'], standaard: 'a' } } }), /variantveld 'b'/);
});

test('een variantFout zonder varianten wordt geweigerd', () => {
  // een keuring zonder iets om te keuren is dode code die er als beleid uitziet
  assert.throws(() => keur({ variantFout: () => null }), /`variantFout` zonder `varianten`/);
  assert.throws(() => keur({ varianten: { bron: { keuze: ['a'], standaard: 'a' } }, variantFout: 'nee' }),
    /`variantFout` die geen functie is/);
});

/* ================= de verzoekkant ================= */

const DEF = keur({
  varianten: {
    bron: { keuze: ['algemeen', 'school'], standaard: 'algemeen' },
    stof: { keuze: ['taal groep 3', 'rekenen groep 6'], standaard: null }
  },
  variantFout: (v) => (v.bron === 'school') === !!v.stof ? null : 'bron en stof horen bij elkaar'
});

test('wie niets kiest krijgt de standaard, en die staat voluit op het potje', () => {
  /* Niet "geen variant": een potje waarvan het veld leeg is, is een potje
     waarvan je niet kunt zien welke regels eraan hingen. */
  assert.deepEqual(kiesVariant(DEF, undefined), { variant: { bron: 'algemeen', stof: null } });
  assert.deepEqual(kiesVariant(DEF, {}), { variant: { bron: 'algemeen', stof: null } });
  assert.deepEqual(kiesVariant(DEF, { bron: '' }), { variant: { bron: 'algemeen', stof: null } });
});

test('een waarde die niet in de lijst staat wordt geweigerd, niet gecorrigeerd', () => {
  const r = kiesVariant(DEF, { bron: 'eigenbank' });
  assert.equal(r.status, 400);
  assert.match(r.error, /'bron' kan hier niet op 'eigenbank' staan/);
  assert.equal(r.variant, undefined, 'er komt geen stilzwijgend gecorrigeerde variant terug');
});

test('een veld dat niet bestaat wordt geweigerd', () => {
  // stil laten vallen zou betekenen dat een client denkt iets te hebben gekozen
  const r = kiesVariant(DEF, { tijdslimiet: '30' });
  assert.equal(r.status, 400);
  assert.match(r.error, /Onbekende keuze: tijdslimiet/);
});

test('de vraag over de velden heen komt van het spel', () => {
  assert.equal(kiesVariant(DEF, { bron: 'school' }).error, 'bron en stof horen bij elkaar');
  assert.equal(kiesVariant(DEF, { bron: 'algemeen', stof: 'taal groep 3' }).error, 'bron en stof horen bij elkaar');
  assert.deepEqual(kiesVariant(DEF, { bron: 'school', stof: 'taal groep 3' }),
    { variant: { bron: 'school', stof: 'taal groep 3' } });
});

test('bij een spel zonder varianten valt er niets te kiezen', () => {
  assert.deepEqual(kiesVariant(null, undefined), { variant: null });
  assert.deepEqual(kiesVariant(null, {}), { variant: null });
  const r = kiesVariant(null, { bron: 'school' });
  assert.equal(r.status, 400);
  assert.match(r.error, /niets te kiezen/);
});

test('een variant die geen object is telt als geen keuze', () => {
  // een string of een lijst is geen keuzeblok; hem als leeg lezen is veiliger
  // dan er iets uit proberen te halen
  for (const raar of ['school', ['school'], 3, true])
    assert.deepEqual(kiesVariant(DEF, raar), { variant: { bron: 'algemeen', stof: null } });
});

/* ================= en zo staat het in het echte register ================= */

test('het register zet de lijsten in SPEL en de keurfunctie apart', () => {
  const { SPEL, VARIANT } = maakRegister(stubCtx);
  assert.deepEqual(Object.keys(VARIANT).sort(), ['magnaat', 'quiz'], 'wie er varianten heeft is een besluit, geen toeval');
  assert.deepEqual(SPEL.quiz.varianten.bron, ['algemeen', 'school']);
  assert.ok(SPEL.quiz.varianten.stof.length > 5, 'er staat echte leerstof in');
  assert.equal(typeof VARIANT.quiz.fout, 'function', 'de keurfunctie hoort niet in SPEL');
  const platteSpel = JSON.parse(JSON.stringify(SPEL.quiz));
  assert.deepEqual(platteSpel.varianten, SPEL.quiz.varianten, 'SPEL blijft data die je kunt versturen');
});

test('een spel dat zijn varianten verkeerd invult laat de server niet opstarten', () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-variant-'));
  try {
    fs.writeFileSync(path.join(TMP, 'proefspel.js'), "module.exports = () => ({ spel: { sleutel: 'proefspel', " +
      "naam: 'Proefspel', max: 2, wereld: 'rtg', init(){}, zet(){}, zicht: { speler: () => ({}) }, " +
      "varianten: { bron: { keuze: ['a','b'] } } } });");
    assert.throws(() => maakRegister(stubCtx, TMP), /proefspel\.js heeft variantveld 'bron' zonder `standaard`/);
  } finally { fs.rmSync(TMP, { recursive: true, force: true }); }
});

/* ================= en in de wachtrij, want daar telt hij ook =================
   Een rij die niet op de variant splitst koppelt iemand die schoolvragen zocht
   aan iemand die algemene kennis zocht. Dat is geen tegenstander maar een ander
   spel, en het valt pas op bij de eerste vraag. */

function kernMet() {
  const db = { data: {} };
  const kern = require('../server/kern/spellen')({
    db, save() {}, crypto: require('crypto'), zijnVrienden: () => true, codenaamVan: (h) => 'CN-' + h,
    sseToCustomer() {}, isGeblokkeerd: () => false, socialZoek: () => [], sociaalRate: () => true,
    volwassen: () => true, anthropic: null, sseClients: [], lidBoardUit: () => false
  });
  return { db, kern };
}

test('de wachtrij koppelt niemand aan een andere variant dan hij zocht', () => {
  const { db, kern } = kernMet();
  const stof = kern._spelregels.SPEL.quiz.varianten.stof[0];
  const rij = (mij, variant) => kern.spelRandom(mij, 'quiz', 2, 'nl', 'rtf', null, variant);

  assert.equal(rij('anna', { bron: 'algemeen' }).wachten, true);
  assert.equal(rij('boris', { bron: 'school', stof }).wachten, true,
    'twee verschillende wensen horen niet aan elkaar gekoppeld te worden');
  assert.equal(rij('cirrus', { bron: 'school', stof }).wachten, undefined, 'dezelfde wens koppelt wel');

  const potje = Object.values(db.data.spellen.potjes)[0];
  assert.deepEqual(potje.spelers.sort(), ['boris', 'cirrus'], 'en aan de goede persoon');
  assert.deepEqual(potje.variant, { bron: 'school', stof }, 'de variant staat voluit op het potje');
  assert.ok(potje.staat.vragen.length === 10, 'en het potje is er gewoon mee gestart');
});

test('een verkeerde variant komt ook in de wachtrij niet langs', () => {
  const { kern } = kernMet();
  const r = kern.spelRandom('anna', 'quiz', 2, 'nl', 'rtf', null, { bron: 'school' });
  assert.equal(r.status, 400);
  assert.match(r.error, /vak en een groep/i);
});

test('een potje op uitnodiging draagt de variant die de starter koos', async () => {
  const { db, kern } = kernMet();
  const stof = kern._spelregels.SPEL.quiz.varianten.stof[0];
  const r = await kern.spelNieuw('anna', { soort: 'quiz', grootte: 2, wereld: 'rtf',
    codenamen: [], vrienden: ['boris'], variant: { bron: 'school', stof } });
  assert.ok(r.id, JSON.stringify(r));
  assert.deepEqual(db.data.spellen.potjes[r.id].variant, { bron: 'school', stof });
  const fout = await kern.spelNieuw('anna', { soort: 'quiz', grootte: 2, wereld: 'rtf',
    vrienden: ['boris'], variant: { bron: 'bestaatniet' } });
  assert.equal(fout.status, 400);
});
