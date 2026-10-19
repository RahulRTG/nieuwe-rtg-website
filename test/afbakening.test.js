/* DE AFBAKENING, NAGETROKKEN: de vierde gang van de IDOR-proef. Een route
   zonder id telt pas als afgebakend als A iets van zichzelf terugkreeg en B met
   hetzelfde verzoek niets daarvan. Puur oordeel (LAT.md regel 10).

   Draai los: node --test test/afbakening.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { merkbaar, waarden, merktekens, oordeelAfbakening } = require('../scripts/lib/afbakening');

test('datums, tijden en korte waarden zijn geen merkteken', () => {
  for (const s of ['2026-10-19', '2026-10-19T05:00:00.000Z', '09:00', '05:28:13', '1760850000000', 'abc', 'Proefwaarde', 'Er staan nog 5 dingen open.']) {
    assert.equal(merkbaar(s), false, s);
  }
  for (const s of ['NL12RTGB0001234567', 'idor1-x@voorbeeld.test', 'pot_ab12cd34']) assert.equal(merkbaar(s), true, s);
});

test('wat de controle zag of wat in het verzoek stond, is geen merkteken van A', () => {
  const antwoordA = { rekening: 'NL12RTGB0001234567', seed: 'standaard-01', echo: 'proef-abc123' };
  const m = merktekens({ antwoordA, vanA: waarden(antwoordA), controle: new Set(['standaard-01']), lijf: { id: 'proef-abc123' } });
  assert.deepEqual(m, ['NL12RTGB0001234567']);
});

test('zonder merkteken bewijst B niets: onbereikbaar, nooit afgebakend', () => {
  const o = oordeelAfbakening({ a: { status: 200 }, b: { status: 200, tekst: '{}' }, merken: [] });
  assert.equal(o.staat, 'onbereikbaar');
});

test('A zelf geweigerd: onbereikbaar, ook als B ook geweigerd wordt', () => {
  assert.equal(oordeelAfbakening({ a: { status: 400 }, b: { status: 403, tekst: '' }, merken: ['x1234567'] }).staat, 'onbereikbaar');
});

test('B 2xx zonder A\'s merkteken: afgebakend; met merkteken: doorbraak', () => {
  const merken = ['NL12RTGB0001234567'];
  assert.equal(oordeelAfbakening({ a: { status: 200 }, b: { status: 200, tekst: '{"rekening":"NL99RTGB0007654321"}' }, merken }).staat, 'afgebakend');
  const d = oordeelAfbakening({ a: { status: 200 }, b: { status: 200, tekst: '{"r":"NL12RTGB0001234567"}' }, merken });
  assert.equal(d.staat, 'doorbraak');
  assert.match(d.reden, /NAKIJKEN/);
});

test('B geweigerd: gescheiden, en de toesteldeur blijft onbereikbaar', () => {
  const merken = ['NL12RTGB0001234567'];
  assert.equal(oordeelAfbakening({ a: { status: 200 }, b: { status: 404, tekst: '{}' }, merken }).staat, 'gescheiden');
  assert.equal(oordeelAfbakening({ a: { status: 200 }, b: { status: 403, tekst: '{"bezitsbewijs":"vereist"}' }, merken }).staat, 'onbereikbaar');
});

test('wie A is (codenaam met spatie) telt als merkteken; zonder in het antwoord niet', () => {
  const m = merktekens({ antwoordA: { mens: 'Poolvos 18BB' }, vanA: new Set(), controle: new Set(), lijf: {}, wie: ['Poolvos 18BB', 'idor1@voorbeeld.test'] });
  assert.deepEqual(m, ['Poolvos 18BB']);
  assert.deepEqual(merktekens({ antwoordA: { mens: 'Poolvos 18BB' }, vanA: new Set(), controle: new Set(['Poolvos 18BB']), lijf: {}, wie: ['Poolvos 18BB'] }), [],
    'wat de controle ook zag, telt niet');
});
