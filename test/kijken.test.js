/* Rahul kijkt mee: een foto van iets, en hij zegt wat het is.

   Het gaat hier vooral om de poort ervoor. Een route die een foto doorgeeft
   aan een model is een route waar van alles in gestopt kan worden; daarom
   toetsen we wat er NIET doorheen komt, en wat hij zegt als hij niet kan
   kijken (want dan hoort hij niet te gokken).

   Draai los: node --experimental-sqlite --test test/kijken.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakKijken, leesFoto, MAX, OPDRACHT } = require('../server/kern/kijken');

// een geldige, piepkleine dataURL (1x1 png)
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('de foto-poort', async (t) => {
  await t.test('een gewone foto komt erdoor', () => {
    const f = leesFoto(PNG);
    assert.ok(f);
    assert.equal(f.soort, 'image/png');
    assert.ok(f.data.length > 10);
  });

  await t.test('alles wat geen foto is, komt er niet door', () => {
    for (const rommel of [null, '', 'hallo', 'http://ergens/foto.png',
      'data:text/html;base64,PHNjcmlwdD4=',
      'data:image/svg+xml;base64,PHN2Zz4=',        // svg kan script bevatten
      'data:image/png;base64,####']) {
      assert.equal(leesFoto(rommel), null, 'kwam erdoor: ' + String(rommel).slice(0, 40));
    }
  });

  await t.test('een te grote foto wordt geweigerd in plaats van doorgestuurd', () => {
    const groot = 'data:image/jpeg;base64,' + 'A'.repeat(MAX + 10);
    assert.equal(leesFoto(groot), null);
  });
});

test('kijken zelf', async (t) => {
  await t.test('zonder AI-sleutel gokt hij NIET, hij zegt het gewoon', async () => {
    const { kijk } = maakKijken({ anthropic: null });
    const r = await kijk(PNG, 'Wat is dit?');
    assert.equal(r.status, 503);
    assert.match(r.error, /niet raden|niet kijken/i);
    assert.ok(!r.tekst);
  });

  await t.test('zonder foto komt er een nette fout, geen aanroep', async () => {
    let geroepen = false;
    const { kijk } = maakKijken({ anthropic: { messages: { create: async () => { geroepen = true; return {}; } } } });
    const r = await kijk('geen foto', 'Wat is dit?');
    assert.equal(r.status, 400);
    assert.equal(geroepen, false, 'er ging alsnog iets naar het model');
  });

  await t.test('met een sleutel gaat de foto mee als beeldblok, en het antwoord komt terug', async () => {
    let gezien = null;
    const { kijk } = maakKijken({ anthropic: { messages: { create: async (p) => { gezien = p; return { content: [{ type: 'text', text: 'Natuurlijk! Een espressokopje.' }] }; } } } });
    const r = await kijk(PNG, 'Wat is dit?');
    assert.equal(r.ok, true);
    // de schrobber haalt "Natuurlijk!" eraf; dat hoort ook hier te gebeuren
    assert.equal(r.tekst, 'Een espressokopje.');
    const blokken = gezien.messages[0].content;
    assert.equal(blokken[0].type, 'image');
    assert.equal(blokken[0].source.media_type, 'image/png');
    assert.equal(blokken[1].type, 'text');
  });

  await t.test('een lege uitkomst wordt niet als antwoord verkocht', async () => {
    const { kijk } = maakKijken({ anthropic: { messages: { create: async () => ({ content: [{ type: 'text', text: '   ' }] }) } } });
    const r = await kijk(PNG, '');
    assert.equal(r.status, 502);
  });

  await t.test('een fout van het model komt eerlijk terug', async () => {
    const { kijk } = maakKijken({ anthropic: { messages: { create: async () => { throw new Error('boem'); } } } });
    const r = await kijk(PNG, '');
    assert.equal(r.status, 502);
    assert.match(r.error, /boem/);
  });

  await t.test('DE GRENS staat in de opdracht: geen mensen beschrijven, geen diagnose', () => {
    assert.match(OPDRACHT, /beschrijf je die niet/i);
    assert.match(OPDRACHT, /herkennen/i);
    assert.match(OPDRACHT, /geen diagnose/i);
    assert.match(OPDRACHT, /Verzin nooit een merk/i);
  });
});
