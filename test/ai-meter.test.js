/* ============================================================================
   DE METER OP DE MODELKRAAN.

   Honderd aanroepplekken sturen werk naar een extern model en niemand telde wat
   het kostte -- `usage.output_tokens` kwam binnen en werd weggegooid. De rem aan
   de deur laat 300 verzoeken per minuut per IP toe en ziet geen verschil tussen
   een endpoint van een tiende cent en een Opus-aanroep van $0,0136.

   Vijf dingen moeten kloppen, anders is de meter erger dan geen meter:

     1. DE VIER TOKENSOORTEN HEBBEN VIER PRIJZEN. Vooral de cache-leesbeurt
        (een tiende) -- reken je die vol, dan lijkt caching duurder dan het is
        en zet iemand hem uit.
     2. EEN ONBEKEND MODEL TELT DUUR. Liever te vroeg dicht dan te laat.
     3. HET PLAFOND SLUIT, EN ALLEEN VOOR WIE GELD KOST.
     4. GEEN PLAFOND INGESTELD = NIETS VERANDERT. Dat is de stand van vandaag.
     5. DE REM TELT AANROEPEN EN GEEN ROUTES, zodat route nummer 101 er
        automatisch onder valt -- en hij remt niets zonder context, want
        achtergrondwerk hoort niet stil te vallen omdat een bezoeker druk was.

   Draai los: node --test test/ai-meter.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const meter = require('../server/ai-meter');

const schoon = () => { delete process.env.RTG_AI_DAGPLAFOND; delete process.env.RTG_AI_PRIJZEN;
  delete process.env.RTG_AI_BEURTEN_PER_MINUUT; meter.nulstel(); };

test('1. elke tokensoort tegen zijn eigen prijs', () => {
  schoon();
  // Opus 4.8: $5 in, $25 uit per miljoen
  assert.equal(meter.kostenVan('claude-opus-4-8', { input_tokens: 1e6 }), 5);
  assert.equal(meter.kostenVan('claude-opus-4-8', { output_tokens: 1e6 }), 25);
  // een cache-leesbeurt is een tiende van de invoerprijs
  assert.equal(meter.kostenVan('claude-opus-4-8', { cache_read_input_tokens: 1e6 }), 0.5);
  // en een cache-schrijf 1,25x
  assert.equal(meter.kostenVan('claude-opus-4-8', { cache_creation_input_tokens: 1e6 }), 6.25);
  // Sonnet 5 is goedkoper dan Opus, Haiku goedkoper dan Sonnet
  const u = { input_tokens: 1e6, output_tokens: 1e6 };
  assert.ok(meter.kostenVan('claude-haiku-4-5', u) < meter.kostenVan('claude-sonnet-5', u));
  assert.ok(meter.kostenVan('claude-sonnet-5', u) < meter.kostenVan('claude-opus-4-8', u));
});

test('2. een onbekend model telt tegen het duurste tarief dat we kennen', () => {
  schoon();
  const u = { input_tokens: 1e6, output_tokens: 1e6 };
  const onbekend = meter.kostenVan('een-model-van-volgend-jaar', u);
  for (const m of Object.keys(meter.PRIJZEN)) {
    assert.ok(onbekend >= meter.kostenVan(m, u), m + ' hoort niet duurder te zijn dan het onbekend-tarief');
  }
});

test('3. de dagstand telt op, per model apart', () => {
  schoon();
  meter.boek('claude-opus-4-8', { input_tokens: 1000, output_tokens: 500 });
  meter.boek('claude-sonnet-5', { input_tokens: 1000, output_tokens: 500 });
  const s = meter.stand();
  assert.equal(s.aanroepen, 2);
  assert.equal(s.tokensIn, 2000);
  assert.equal(s.tokensUit, 1000);
  assert.equal(s.perModel['claude-opus-4-8'].aanroepen, 1);
  assert.ok(s.perModel['claude-opus-4-8'].kosten > s.perModel['claude-sonnet-5'].kosten, 'Opus kost meer dan Sonnet');
  assert.ok(s.kostenUsd > 0);
});

test('4. zonder plafond verandert er niets -- dat is de stand van vandaag', () => {
  schoon();
  assert.equal(meter.plafond(), 0);
  assert.equal(meter.stand().plafondUsd, null);
  for (let i = 0; i < 50; i++) meter.boek('claude-opus-4-8', { input_tokens: 1e6, output_tokens: 1e6 });
  assert.equal(meter.magNog(), true, 'zonder plafond gaat de kraan nooit dicht');
  assert.equal(meter.stand().dicht, false);
});

test('5. met een plafond gaat de kraan dicht zodra het bereikt is', () => {
  schoon();
  process.env.RTG_AI_DAGPLAFOND = '1';
  assert.equal(meter.magNog(), true, 'bij een lege dag mag het nog');
  // $1 vol maken: 1M invoer-tokens Opus is $5, dus ruim voorbij
  meter.boek('claude-opus-4-8', { input_tokens: 1e6 });
  assert.equal(meter.magNog(), false, 'over het plafond gaat hij dicht');
  const s = meter.stand();
  assert.equal(s.dicht, true);
  assert.equal(s.ruimte, 0);
  schoon();
});

test('6. een nieuwe dag begint met een lege stand', () => {
  schoon();
  const dag1 = Date.parse('2026-08-19T10:00:00Z');
  const dag2 = Date.parse('2026-08-20T10:00:00Z');
  meter.boek('claude-opus-4-8', { input_tokens: 1e6 }, dag1);
  assert.ok(meter.stand(dag1).kostenUsd > 0);
  assert.equal(meter.stand(dag2).kostenUsd, 0, 'de volgende dag telt opnieuw');
  assert.equal(meter.stand(dag2).aanroepen, 0);
});

test('7. de prijstabel is te overschrijven zonder codewijziging', () => {
  schoon();
  process.env.RTG_AI_PRIJZEN = JSON.stringify({ 'claude-opus-4-8': { in: 1, uit: 1 } });
  assert.equal(meter.kostenVan('claude-opus-4-8', { input_tokens: 1e6 }), 1);
  // en onzin in die env mag de meter niet omgooien
  process.env.RTG_AI_PRIJZEN = 'geen json';
  assert.equal(meter.kostenVan('claude-opus-4-8', { input_tokens: 1e6 }), 5, 'terug naar de ingebouwde tabel');
  schoon();
});

test('8. een antwoord zonder usage telt als aanroep, niet als kosten', () => {
  schoon();
  meter.boek('claude-opus-4-8', undefined);
  meter.boek('claude-opus-4-8', {});
  const s = meter.stand();
  assert.equal(s.aanroepen, 2);
  assert.equal(s.kostenUsd, 0);
});

/* ---- DE REM PER AANROEPER ---- */

test('9. de rem telt modelaanroepen per aanroeper, niet routes', () => {
  schoon();
  process.env.RTG_AI_BEURTEN_PER_MINUUT = '3';
  const t = Date.parse('2026-08-19T10:00:00Z');
  assert.equal(meter.magNogVoor('1.2.3.4', t), true);
  assert.equal(meter.magNogVoor('1.2.3.4', t), true);
  assert.equal(meter.magNogVoor('1.2.3.4', t), true);
  assert.equal(meter.magNogVoor('1.2.3.4', t), false, 'de vierde valt buiten');
  // een ANDERE aanroeper heeft zijn eigen bak
  assert.equal(meter.magNogVoor('5.6.7.8', t), true, 'de buurman wordt niet meegeremd');
  // en een minuut later mag het weer
  assert.equal(meter.magNogVoor('1.2.3.4', t + 61000), true, 'nieuw venster');
  schoon();
});

test('10. zonder context geen rem -- achtergrondwerk hoort niet stil te vallen', () => {
  schoon();
  process.env.RTG_AI_BEURTEN_PER_MINUUT = '1';
  // buiten een context: meter.wie() is null, dus de rem laat door
  assert.equal(meter.wie(), null);
  for (let i = 0; i < 20; i++) assert.equal(meter.magNogVoor(), true);
  // binnen een context telt hij wel
  meter.inContext('9.9.9.9', () => {
    assert.equal(meter.wie(), '9.9.9.9');
    assert.equal(meter.magNogVoor(), true);
    assert.equal(meter.magNogVoor(), false, 'binnen de context remt hij wel');
  });
  schoon();
});

test('11. op nul staat de rem uit', () => {
  schoon();
  process.env.RTG_AI_BEURTEN_PER_MINUUT = '0';
  assert.equal(meter.beurtGrens(), 0);
  for (let i = 0; i < 200; i++) assert.equal(meter.magNogVoor('1.2.3.4'), true);
  schoon();
});

/* ---- DE INTERNE AI: EIGEN EMMER, GEEN BEDRAG ---- */

test('12. de interne AI telt mee, maar kost geen geld', () => {
  /* Zonder dit staat de meter op nul terwijl de eigen modelserver al het werk
     doet -- de keten is lokaal-eerst, dus dat is juist de normale stand. */
  schoon();
  meter.boekLokaal('mijn-model', { input_tokens: 5000, output_tokens: 2000 });
  meter.boekLokaal('mijn-model', { input_tokens: 5000, output_tokens: 2000 });
  const s = meter.stand();
  assert.equal(s.lokaal.aanroepen, 2, 'de interne aanroepen zijn geteld');
  assert.equal(s.lokaal.tokensIn, 10000);
  assert.equal(s.lokaal.tokensUit, 4000);
  assert.equal(s.kostenUsd, 0, 'maar er hangt geen bedrag aan eigen ijzer');
  assert.equal(s.aanroepen, 0, 'en ze vullen de externe emmer niet');
  assert.equal(s.lokaal.perModel['mijn-model'], 2, 'per lokaal model uitgesplitst');
});

test('13. de interne AI raakt het dagplafond niet', () => {
  /* De kraan is voor de rekening. Zou intern meetellen, dan zou een druk eigen
     model de externe uitwijk dichtzetten -- precies verkeerd om. */
  schoon();
  process.env.RTG_AI_DAGPLAFOND = '1';
  for (let i = 0; i < 100; i++) meter.boekLokaal('mijn-model', { input_tokens: 1e6, output_tokens: 1e6 });
  assert.equal(meter.magNog(), true, 'honderd interne aanroepen sluiten de kraan niet');
  assert.equal(meter.stand().dicht, false);
  schoon();
});

test('14. het aandeel extern is het signaal dat de eigen server afhaakt', () => {
  schoon();
  assert.equal(meter.stand().aandeelExtern, null, 'zonder verkeer zegt een percentage niets');
  for (let i = 0; i < 9; i++) meter.boekLokaal('mijn-model', {});
  meter.boek('claude-sonnet-5', {});
  assert.equal(meter.stand().aandeelExtern, 10, 'een op de tien ging naar buiten');
  for (let i = 0; i < 90; i++) meter.boek('claude-sonnet-5', {});
  assert.ok(meter.stand().aandeelExtern > 80, 'valt lokaal weg, dan loopt het aandeel op');
  schoon();
});

test('15. een mislukte interne aanroep telt apart', () => {
  schoon();
  meter.boekLokaalFout();
  meter.boekFout();
  const s = meter.stand();
  assert.equal(s.lokaal.gefaald, 1);
  assert.equal(s.gefaald, 1, 'en loopt niet door elkaar');
});
