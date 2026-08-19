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

test('5. het luik toont ook de interne AI en het aandeel extern', () => {
  /* De keten is lokaal-eerst, dus zonder deze velden staat het luik op nul
     terwijl de eigen modelserver al het werk doet -- en zie je niet dat hij
     afhaakt en het verkeer naar de betaalde uitwijk glijdt. */
  meter.nulstel();
  for (let i = 0; i < 9; i++) meter.boekLokaal('mijn-model', { input_tokens: 100, output_tokens: 50 });
  meter.boek('claude-sonnet-5', { input_tokens: 100, output_tokens: 50 });
  const app = neppApp();
  route({ app, techAuth: () => {}, eigenaarAlleen: () => {} });
  const uit = roep(app.gemount[0].fn);
  assert.equal(uit.lokaal.aanroepen, 9, 'de interne aanroepen staan erin');
  assert.equal(uit.aandeelExtern, 10, 'en het aandeel dat naar buiten ging');
  meter.nulstel();
});

test('6. het luik toont ook hoe de eigen modelserver ervoor staat', () => {
  /* aandeelExtern zegt DAT de eigen server afhaakt; dit zegt waarom. */
  meter.nulstel();
  const app = neppApp();
  const nepAi = { lokaleStaat: () => ({ bezig: 2, wachtend: 5, gelijktijdig: 2, storingen: 0, onderbroken: false }) };
  route({ app, techAuth: () => {}, eigenaarAlleen: () => {}, anthropic: nepAi });
  const uit = roep(app.gemount[0].fn);
  assert.equal(uit.lokaleServer.wachtend, 5, 'de wachtrij is zichtbaar');
  assert.equal(uit.lokaleServer.onderbroken, false);
  // en zonder lokale server hoort er gewoon null te staan, geen verzinsel
  const app2 = neppApp();
  route({ app: app2, techAuth: () => {}, eigenaarAlleen: () => {}, anthropic: {} });
  assert.equal(roep(app2.gemount[0].fn).lokaleServer, null);
});

test('7. het luik toont het budget per pas, maar nooit WIE eraan zit', () => {
  /* Een kostenoverzicht dat per persoon laat zien hoeveel iemand de AI
     gebruikt, is geen kostenoverzicht meer maar een gedragsrapport -- en het
     zou codenamen naast verbruik zetten. Het aantal zegt genoeg om te merken
     dat een grens te krap staat. */
  meter.nulstel();
  const budget = require('../server/ai-budget');
  budget.zetOpslag(() => ({ data: {
    'lid:user-1': { venster: '2026-08', cent: 1500, aanroepen: 40, pas: 'rtg' },
    'lid:user-2': { venster: '2026-08', cent: 10, aanroepen: 2, pas: 'rtg' },
    'lid:user-3': { venster: '2026-08-19', cent: 8, aanroepen: 3, pas: 'gratis', vrijCent: 8 }
  }, bewaar() {} }));

  const app = neppApp();
  route({ app, techAuth: () => {}, eigenaarAlleen: () => {} });
  const uit = roep(app.gemount[0].fn);

  assert.ok(uit.budget, 'het budget staat op het luik');
  assert.equal(uit.budget.perPas.gratis.euro, 0.5, 'de bedragen staan erbij');
  assert.equal(uit.budget.perPas.gratis.venster, 'dag');
  assert.equal(uit.budget.perPas.rtg.venster, 'maand');
  assert.equal(uit.budget.mensenMetVerbruik, 3);
  assert.equal(uit.budget.mensenOpDeGrens, 1, 'een van de drie zit aan zijn grens');
  assert.equal(uit.budget.vrijgesteldEuro, 0.08, 'en wat de Foundation kostte');

  /* En nu de grens die ertoe doet: geen enkele sleutel komt mee naar buiten. */
  const alles = JSON.stringify(uit);
  for (const sleutel of ['user-1', 'user-2', 'user-3', 'lid:']) {
    assert.equal(alles.includes(sleutel), false, 'het luik hoort ' + sleutel + ' niet te noemen');
  }
});
