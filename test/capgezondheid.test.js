/* ============================================================================
   CAPABILITY HEALTH -- hoe gaat het met DIT onderdeel?

   DE FOUT DIE DIT VERVANGT. Een gewone healthcheck kent een antwoord: het huis
   doet het, of het doet het niet. Valt de uitbetaalrail om, dan staat er rood --
   en dan is de vraag "kan de kassa nog draaien?" niet te beantwoorden, terwijl
   het antwoord gewoon ja is. Een restaurant op vrijdagavond wordt niet geholpen
   door een lampje dat over iets anders gaat.

   DE BEWERINGEN DIE ERTOE DOEN:

     toets 3   quarantaine raakt EEN capability en nooit het huis
     toets 1   GROEN is niet "geen nieuws" -- ongemeten is een eigen stand
     toets 5   een onderdeel komt automatisch in quarantaine en er NOOIT
               automatisch uit
     toets 6   vrijgeven wist de tellers, anders staat het meteen weer rood

   Draai los: node --experimental-sqlite --test test/capgezondheid.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakGezondheid, STAND, MIN_METINGEN, AMBER_DEEL, ROOD_DEEL,
  QUARANTAINE_NA_MS, VENSTER_MS } = require('../server/kern/commercie/capgezondheid');

let T0 = 1_700_000_000_000;
const nu = () => T0;

function opstelling() {
  const db = { data: {} };
  return { G: maakGezondheid({ db, save: () => {}, nu }), db };
}
function meldVeel(G, cap, goed, mis) {
  for (let i = 0; i < goed; i++) G.meld(cap, true);
  for (let i = 0; i < mis; i++) G.meld(cap, false, 'de rail is onbereikbaar');
}

/* DE BEWERING. Een bord dat na een stille nacht overal groen staat, is een bord
   dat niets zegt. */
test('1. groen is niet "geen nieuws": ongemeten is een eigen stand', () => {
  const { G } = opstelling();
  assert.equal(G.stand('money.payout').stand, STAND.ONGEMETEN);
  assert.equal(G.stand('money.payout').metingen, 0);

  meldVeel(G, 'money.payout', MIN_METINGEN - 1, 0);
  assert.equal(G.stand('money.payout').stand, STAND.ONGEMETEN,
    'onder de minimale telling is het ruis en geen stand');

  G.meld('money.payout', true);
  assert.equal(G.stand('money.payout').stand, STAND.GROEN);
  assert.deepEqual(G.zorgen().ongemeten, [], 'en dan staat hij niet meer bij de zorgen');
});

test('2. de standen volgen het deel dat misgaat, met de reden erbij', () => {
  const { G } = opstelling();
  meldVeel(G, 'a', 100, 0);
  assert.equal(G.stand('a').stand, STAND.GROEN);

  meldVeel(G, 'b', 100, Math.ceil(100 * AMBER_DEEL / (1 - AMBER_DEEL)) + 1);
  assert.equal(G.stand('b').stand, STAND.AMBER);
  assert.match(G.stand('b').laatsteFout, /onbereikbaar/, 'een teller zonder reden is een getal');

  meldVeel(G, 'c', 10, 20);
  assert.equal(G.stand('c').stand, STAND.ROOD);
  assert.ok(G.stand('c').deelMis >= ROOD_DEEL);
});

/* DE TWEEDE BEWERING, en zij is het hele punt van deze laag. */
test('3. quarantaine raakt een capability en nooit het huis', () => {
  const { G } = opstelling();
  G.quarantaine('money.payout', 'de uitbetaalrail weigert alles sinds 09:14', 'techniek');

  const dicht = G.mag('money.payout');
  assert.equal(dicht.door, false);
  assert.equal(dicht.stand, STAND.QUARANTAINE);
  assert.match(dicht.error, /09:14/, 'met de reden, zodat een mens weet wat er speelt');

  for (const anders of ['pos.sale', 'order.plaats', 'money.refund']) {
    assert.equal(G.mag(anders).door, true, anders + ' hoort gewoon door te lopen');
  }

  /* En er is geen enkele functie die alles dicht kan zetten. `mag` neemt een
     capability; wie het huis wil sluiten moet dat elders doen, en dat is precies
     de bedoeling. */
  const bron = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'server', 'kern', 'commercie', 'capgezondheid.js'), 'utf8');
  const code = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /function\s+quarantaineAlles/);
  assert.doesNotMatch(code, /\bnoodstop\b/);
});

test('4. dicht zetten vraagt een reden en een naam', () => {
  const { G } = opstelling();
  assert.match(G.quarantaine('a', 'stuk', 'ik').error, /vraagt een reden/,
    'een woord is geen reden');
  assert.match(G.quarantaine('a', 'de rail weigert alles', '').error, /Wie zet dit onderdeel dicht/);
  assert.equal(G.mag('a').door, true, 'en zolang het niet lukt, staat er niets dicht');

  assert.equal(G.quarantaine('a', 'de rail weigert alles sinds vanochtend', 'techniek').ok, true);
  assert.equal(G.mag('a').door, false);
});

/* DE DERDE BEWERING. Een systeem dat zichzelf dicht doet en zichzelf weer open
   doet, verbergt precies de storing die je had willen zien. */
test('5. automatisch erin, nooit automatisch eruit', () => {
  const { G } = opstelling();
  meldVeel(G, 'money.payout', 0, MIN_METINGEN);
  assert.equal(G.stand('money.payout').stand, STAND.ROOD);
  assert.equal(G.mag('money.payout').door, true, 'rood is nog geen quarantaine');

  const was = T0;
  T0 = was + QUARANTAINE_NA_MS + 1000;
  G.meld('money.payout', false, 'nog steeds onbereikbaar');
  const st = G.stand('money.payout');
  assert.equal(st.stand, STAND.QUARANTAINE);
  assert.equal(st.quarantaine.door, null, 'automatisch, dus zonder naam');
  assert.match(st.quarantaine.reden, /automatisch/);
  assert.deepEqual(G.zorgen().automatischDicht, ['money.payout'],
    'en dat is telbaar: luidruchtig, niet stil');

  /* Het gaat weer goed -- en toch blijft hij dicht. */
  for (let i = 0; i < 50; i++) G.meld('money.payout', true);
  assert.equal(G.mag('money.payout').door, false, 'eruit komen doet een mens');
  T0 = was;
});

/* DE VIERDE BEWERING. Zonder dit staat een net vrijgegeven onderdeel meteen weer
   rood op oude metingen -- en dan draait het rondje eeuwig. */
test('6. vrijgeven wist de tellers en vraagt een naam', () => {
  const { G } = opstelling();
  meldVeel(G, 'a', 0, MIN_METINGEN + 5);
  G.quarantaine('a', 'de rail weigert alles sinds vanochtend', 'techniek');

  assert.match(G.geefVrij('a', '').error, /Wie geeft dit onderdeel vrij/);
  assert.equal(G.mag('a').door, false);

  const r = G.geefVrij('a', 'techniek');
  assert.equal(r.ok, true);
  assert.equal(r.stand, STAND.ONGEMETEN, 'de vorige storing is geen bewijs over wat er hierna gebeurt');
  assert.equal(r.metingen, 0);
  assert.equal(G.mag('a').door, true);
  assert.equal(G.stand('a').verloop[0].wat, 'vrijgegeven');
  assert.equal(G.stand('a').verloop[0].door, 'techniek');

  assert.match(G.geefVrij('a', 'techniek').error, /staat niet in quarantaine/);
});

test('7. het venster rolt, zodat een storing van gisteren vandaag niet meer telt', () => {
  const { G } = opstelling();
  meldVeel(G, 'a', 0, MIN_METINGEN);
  assert.equal(G.stand('a').stand, STAND.ROOD);

  const was = T0;
  T0 = was + VENSTER_MS + 1000;
  G.meld('a', true);
  const st = G.stand('a');
  assert.equal(st.metingen, 1, 'de tellers beginnen opnieuw bij de eerste meting na het venster');
  assert.equal(st.stand, STAND.ONGEMETEN);
  T0 = was;
});

test('8. gezondheid opent geen deur en sluit er geen die bij de bevoegdheid hoort', () => {
  const bron = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'server', 'kern', 'commercie', 'capgezondheid.js'), 'utf8');
  const code = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  /* Deze laag zegt niet of iemand IETS MAG maar of het onderdeel het DOET. Zou
     zij de bevoegdheden kennen, dan is er een tweede autorisatiesysteem bij. */
  assert.doesNotMatch(code, /require\(.*capaciteiten/);
  assert.doesNotMatch(code, /require\(.*bevoegdheid/);
  assert.doesNotMatch(code, /require\(.*besluit/);
});
