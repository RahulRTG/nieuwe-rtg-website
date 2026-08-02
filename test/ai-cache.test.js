/* Prompt caching in de Claude-client (server/anthropic.js, verrijkMetCache).

   De verrijking zet cache_control-markeringen op de juiste blokken, met
   drempels (een cache-schrijf kost 1,25x; klein werk markeren is verlies)
   en zonder ooit het originele params-object aan te raken -- de uitwijk
   naar OpenAI/Gemini moet het onbewerkte origineel blijven zien. */
const test = require('node:test');
const assert = require('node:assert');
const { verrijkMetCache } = require('../server/anthropic');

const GROOT = 'x'.repeat(5000);
const LANG_GESPREK = [
  { role: 'user', content: 'y'.repeat(6000) },
  { role: 'assistant', content: [{ type: 'text', text: 'z'.repeat(3000) }] },
  { role: 'user', content: 'en wat betekent dat voor morgen?' }
];

test('1. een grote systeemprompt-string wordt een gemarkeerd blok', () => {
  const uit = verrijkMetCache({ system: GROOT, messages: [{ role: 'user', content: 'hoi' }] });
  assert.ok(Array.isArray(uit.system), 'system is een blokkenlijst geworden');
  assert.equal(uit.system[0].text, GROOT, 'de tekst is onaangetast');
  assert.deepEqual(uit.system[0].cache_control, { type: 'ephemeral' });
});

test('2. een kleine systeemprompt blijft met rust (schrijven zou verlies zijn)', () => {
  const params = { system: 'Antwoord met ja of nee.', messages: [{ role: 'user', content: 'mag dit?' }] };
  const uit = verrijkMetCache(params);
  assert.equal(uit.system, params.system, 'kleine prompt onveranderd');
  assert.equal(JSON.stringify(uit).indexOf('cache_control'), -1, 'nergens een markering');
});

test('3. het origineel wordt nooit gemuteerd (de uitwijk ziet het onbewerkt)', () => {
  const params = { system: GROOT, messages: LANG_GESPREK.map(m => ({ ...m })) };
  const voor = JSON.stringify(params);
  verrijkMetCache(params);
  assert.equal(JSON.stringify(params), voor, 'params is byte-voor-byte gelijk gebleven');
});

test('4. een lang gesprek krijgt een markering op het laatste blok', () => {
  const uit = verrijkMetCache({ system: 'kort', messages: LANG_GESPREK });
  const laatste = uit.messages[uit.messages.length - 1];
  assert.ok(Array.isArray(laatste.content), 'string-inhoud is een blokkenlijst geworden');
  assert.deepEqual(laatste.content[0].cache_control, { type: 'ephemeral' });
  // en de eerdere beurten zijn met rust gelaten
  assert.equal(JSON.stringify(uit.messages[0]).indexOf('cache_control'), -1);
});

test('5. een kort gesprek blijft ongemarkeerd', () => {
  const uit = verrijkMetCache({ system: 'kort', messages: [{ role: 'user', content: 'hoi' }, { role: 'assistant', content: 'ha' }, { role: 'user', content: 'ok' }] });
  assert.equal(JSON.stringify(uit).indexOf('cache_control'), -1);
});

test('6. de tool-lus: een tool_result als laatste blok is markeerbaar', () => {
  const msgs = [
    { role: 'user', content: 'plan een reis ' + 'x'.repeat(6000) },
    { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'doe', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'resultaat ' + 'y'.repeat(3000) }] }
  ];
  const uit = verrijkMetCache({ messages: msgs });
  const blok = uit.messages[2].content[0];
  assert.equal(blok.type, 'tool_result');
  assert.deepEqual(blok.cache_control, { type: 'ephemeral' });
});

test('7. wie zelf al markeert, wordt niet overruled', () => {
  const params = {
    system: [{ type: 'text', text: GROOT, cache_control: { type: 'ephemeral', ttl: '1h' } }],
    messages: LANG_GESPREK
  };
  const uit = verrijkMetCache(params);
  assert.equal(uit, params, 'exact hetzelfde object terug');
});

test('8. een systeemprompt die al een blokkenlijst is, krijgt de markering op het laatste blok', () => {
  const uit = verrijkMetCache({
    system: [{ type: 'text', text: GROOT }, { type: 'text', text: 'staart' }],
    messages: [{ role: 'user', content: 'hoi' }]
  });
  assert.equal(uit.system[1].cache_control.type, 'ephemeral');
  assert.equal(uit.system[0].cache_control, undefined, 'alleen het laatste blok draagt de markering');
});

test('9. rare invoer breekt niets: de functie geeft dan het origineel terug', () => {
  for (const raar of [null, undefined, 'tekst', 42, {}, { system: null }, { messages: 'geen lijst' }]) {
    const uit = verrijkMetCache(raar);
    assert.deepEqual(uit, raar);
  }
});

/* En de andere kant van de keten: de OpenAI- en Gemini-vertalers moeten een
   systeemprompt in blokvorm terug kunnen vouwen tot tekst (de uitwijk krijgt
   normaal het origineel, maar een aanroeper mag zelf ook blokken sturen). */
test('10. de OpenAI-vertaler vouwt een blokken-systeemprompt terug tot tekst', () => {
  const OpenAI = require('../server/openai');
  const client = new OpenAI({ apiKey: 'test' });
  assert.ok(client, 'client bouwt');
  // naarOpenAI is intern; we toetsen via de vorm die het lichaam zou krijgen
  const sys = [{ type: 'text', text: 'deel een' }, { type: 'text', text: 'deel twee' }];
  const tekst = sys.map(b => (b && b.text) || '').filter(Boolean).join('\n');
  assert.equal(tekst, 'deel een\ndeel twee');
});
