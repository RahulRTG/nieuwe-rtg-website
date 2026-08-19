/* ============================================================================
   HET LUIK OP DE MODELKRAAN.

   server/ai-meter.js telt wat er aan externe modellen omgaat. Een meter die
   niemand kan aflezen is geen meter: dan blijft de factuur het eerste moment
   waarop je iets merkt, en was het tellen voor niets.

   Drie dingen moeten kloppen:

     1. HET LUIK ZIT ACHTER TWEE SLOTEN. Techniek-inlog EN eigenaar. Dit is een
        bedrijfscijfer, geen ledengegeven, maar het hoort niet open te staan.
     2. HET ANTWOORD DRAAGT DE UITSPLITSING PER MODEL. Een totaalbedrag zegt dat
        het duur is; de uitsplitsing zegt waardoor.
     3. HET ANTWOORD ZEGT ERBIJ DAT HET EEN SCHATTING IS. Zonder dat veld gaat
        een scherm dit tonen alsof het een boekhouding is.

   Draai los: node --test test/aikosten-route.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const meter = require('../server/ai-meter');
const route = require('../server/routes/techniek/aikosten');

/* Een minimale app die alleen onthoudt wat er gemount wordt, zodat dit zonder
   server en zonder netwerk te toetsen is. */
function neppApp() {
  const gemount = [];
  return {
    gemount,
    get(pad, ...rest) { gemount.push({ pad, wachters: rest.slice(0, -1), fn: rest[rest.length - 1] }); }
  };
}
const roep = (fn) => { let uit = null; fn({}, { json: (d) => { uit = d; } }); return uit; };

test('1. het luik hangt achter techniek-inlog EN eigenaar', () => {
  const app = neppApp();
  const techAuth = () => {}, eigenaarAlleen = () => {};
  route({ app, techAuth, eigenaarAlleen });
  assert.equal(app.gemount.length, 1, 'precies een route');
  const r = app.gemount[0];
  assert.equal(r.pad, '/api/techniek/ai/kosten');
  assert.ok(r.wachters.includes(techAuth), 'techniek-inlog hangt ervoor');
  assert.ok(r.wachters.includes(eigenaarAlleen), 'en de eigenaarscontrole ook');
});

test('2. het antwoord draagt de uitsplitsing per model', () => {
  meter.nulstel();
  meter.boek('claude-opus-4-8', { input_tokens: 1000, output_tokens: 500 });
  meter.boek('claude-sonnet-5', { input_tokens: 1000, output_tokens: 500 });
  const app = neppApp();
  route({ app, techAuth: () => {}, eigenaarAlleen: () => {} });
  const uit = roep(app.gemount[0].fn);
  assert.equal(uit.aanroepen, 2);
  assert.ok(uit.perModel && uit.perModel['claude-opus-4-8'], 'per model uitgesplitst');
  assert.ok(uit.perModel['claude-opus-4-8'].kosten > uit.perModel['claude-sonnet-5'].kosten);
  meter.nulstel();
});

test('3. het antwoord zegt erbij dat het een schatting is', () => {
  const app = neppApp();
  route({ app, techAuth: () => {}, eigenaarAlleen: () => {} });
  const uit = roep(app.gemount[0].fn);
  assert.match(String(uit.let || ''), /schatting/i, 'anders leest een scherm dit als boekhouding');
  assert.ok(uit.peildatum, 'en de peildatum van de prijstabel hoort erbij');
});

test('4. de rem staat erbij, niet alleen het dagplafond', () => {
  /* Zonder dit lijkt "geen plafond" op "geen bescherming", terwijl de rem per
     aanroeper er wel is. */
  meter.nulstel();
  delete process.env.RTG_AI_DAGPLAFOND;
  const app = neppApp();
  route({ app, techAuth: () => {}, eigenaarAlleen: () => {} });
  const uit = roep(app.gemount[0].fn);
  assert.equal(uit.plafondUsd, null, 'geen dagplafond ingesteld');
  assert.equal(uit.beurtenPerMinuut, 60, 'maar de rem staat er wel');
});
