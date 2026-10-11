'use strict';
/* De sleutelbepaling van de idempotentiepoort (server/lib/idem-sleutelbepaling.js).

   Drie regels uit de kop van die module, elk met het geval dat hem ooit brak:
   de afzender is een hash en nooit het token zelf, een route die als `leest`
   is verklaard krijgt net zo min een sleutel als een `nietIdempotent`, en een
   eigen sleutel van de aanroeper in het lijf wint van de verklaring. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { wieVan, sleutelVan, verklaardeSleutel, MAX_SLEUTEL } = require('../server/lib/idem-sleutelbepaling');

const verzoek = (koppen, rest) => Object.assign({ get: (naam) => (koppen || {})[naam.toLowerCase()] }, rest || {});

test('1. de afzender is een hash van het token of de cookie, nooit het token zelf', () => {
  const metToken = wieVan(verzoek({ authorization: 'Bearer geheim-token' }));
  assert.match(metToken, /^[0-9a-f]{32}$/);
  assert.ok(!metToken.includes('geheim'));
  assert.notEqual(metToken, wieVan(verzoek({ authorization: 'Bearer ander-token' })));
  // het token gaat voor de cookie
  assert.equal(wieVan(verzoek({ authorization: 'Bearer geheim-token', cookie: 'sid=1' })), metToken);
  const metCookie = wieVan(verzoek({ cookie: 'sid=1' }));
  assert.match(metCookie, /^[0-9a-f]{32}$/);
  assert.notEqual(metCookie, metToken);
  assert.equal(wieVan(verzoek({}, { ip: '10.0.0.1' })), 'anon:10.0.0.1');
  assert.equal(wieVan({}), 'anon:');
});

test('2. een eigen sleutel in de kop is begrensd en wordt getrimd', () => {
  assert.equal(sleutelVan(verzoek({ 'idempotency-key': '  abc-123 ' })), 'abc-123');
  assert.equal(sleutelVan(verzoek({ 'idempotency-key': '   ' })), null);
  assert.equal(sleutelVan(verzoek({})), null);
  assert.equal(sleutelVan({}), null);
  assert.equal(sleutelVan(verzoek({ 'idempotency-key': 'k'.repeat(MAX_SLEUTEL) })), 'k'.repeat(MAX_SLEUTEL));
  assert.equal(sleutelVan(verzoek({ 'idempotency-key': 'k'.repeat(MAX_SLEUTEL + 1) })), null);
  assert.equal(sleutelVan(verzoek({ 'idempotency-key': ['a', 'b'] })), null);
});

test('3. geen verklaring, leest of nietIdempotent: dan geen verklaarde sleutel', () => {
  assert.equal(verklaardeSleutel({ method: 'POST', path: '/api/bestaat/niet', body: {} }), null);
  assert.equal(verklaardeSleutel({ method: 'POST', path: '/api/living-world/view', body: { a: 1 } }), null);
  assert.equal(verklaardeSleutel({ method: 'POST', path: '/api/foundation/gezin/beelden/upload', body: { a: 1 } }), null);
});

test('4. de verklaring is een vangnet: een eigen sleutel in het lijf wint', () => {
  const pad = '/api/werk-gast/besluit';
  assert.equal(verklaardeSleutel({ method: 'POST', path: pad, body: { besluit: 'ja', idem: 'mijn-sleutel' } }), null);
  assert.equal(verklaardeSleutel({ method: 'POST', path: pad, body: { besluit: 'ja', idempotentieSleutel: 'x' } }), null);
  // een lege eigen sleutel telt niet als gesproken
  const leeg = verklaardeSleutel({ method: 'POST', path: pad, body: { besluit: 'ja', idem: '   ' } });
  assert.match(leeg, /^verklaard:/);
});

test('5. zelfde verzoek, zelfde sleutel; ander verzoek, andere sleutel', () => {
  const pad = '/api/werk-gast/besluit';
  const a = verklaardeSleutel({ method: 'POST', path: pad, body: { besluit: 'ja', wie: 1 } });
  const b = verklaardeSleutel({ method: 'POST', path: pad, body: { besluit: 'ja', wie: 1 } });
  const c = verklaardeSleutel({ method: 'POST', path: pad, body: { besluit: 'nee', wie: 1 } });
  assert.equal(a, b);
  assert.notEqual(a, c);
  // zonder lijf of met een lijf dat geen object is, is er nog steeds een afdruk
  assert.match(verklaardeSleutel({ method: 'POST', url: pad }), /^verklaard:/);
  assert.equal(verklaardeSleutel({ method: 'POST', path: pad, body: 'tekst' }), verklaardeSleutel({ method: 'POST', path: pad }));
});

test('6. met verklaarde velden telt alleen wat in die velden staat', () => {
  const pad = '/api/bestanden/wis';
  const a = verklaardeSleutel({ method: 'POST', path: pad, body: { id: 'B1', toelichting: 'eerste' } });
  const b = verklaardeSleutel({ method: 'POST', path: pad, body: { id: 'B1', toelichting: 'tweede' } });
  const c = verklaardeSleutel({ method: 'POST', path: pad, body: { id: 'B2' } });
  assert.match(a, /^verklaard:[0-9a-f]{32}$/);
  assert.equal(a, b);
  assert.notEqual(a, c);
});
