/* De RTF-kant van het gezin: wie klopt er aan, per deelgebied.

   Derde variant van hetzelfde: een veldnaam die per deelgebied iets anders
   betekent. Bij het livinglab was dat `id`; hier is het `token` -- de
   gezinsfamilie levert de BEHEERDER, en een deel van dit domein hoort bij het
   kind. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { KIND_SPREEKT, KIND_ALS_ONDERWERP, rtfHandle, lijfVoor } = require('../scripts/lib/wereld-rtf');

const wereld = { code: 'G123', token: 'OUDER', kindToken: 'KIND', profielId: 'p1' };

test('elk deelgebied draagt een meting en een reden', () => {
  for (const x of [...KIND_SPREEKT, ...KIND_ALS_ONDERWERP]) {
    assert.ok(x.pad.startsWith('/api/rtf/'), x.pad);
    assert.ok(Number.isInteger(x.gemeten) && x.gemeten > 0, x.pad);
    assert.ok((x.waarom || '').length >= 25, 'de reden bij ' + x.pad + ' is te kort');
  }
});

/* Een deelgebied kan niet tegelijk het kind als AFZENDER en als ONDERWERP
   hebben -- dan is niet meer te zeggen welke regel iets opende. */
test('geen deelgebied staat in beide lijsten', () => {
  const a = new Set(KIND_SPREEKT.map(x => x.pad));
  for (const x of KIND_ALS_ONDERWERP) assert.ok(!a.has(x.pad), x.pad + ' staat in beide');
});

test('waar het kind spreekt, gaat zijn token mee', () => {
  const uit = lijfVoor(wereld, '/api/rtf/leerling/advies');
  assert.equal(uit.token, 'KIND');
  assert.equal(uit.kindHandle, undefined, 'bij een afzender hoort geen onderwerp');
});

/* Toezicht is de OUDER die kijkt. Het kind is daar het onderwerp, en het token
   moet dus juist NIET wisselen -- anders kijkt het kind naar zichzelf en meet
   de proef iets anders dan de route doet. */
test('bij toezicht blijft de ouder de afzender en is het kind het onderwerp', () => {
  const uit = lijfVoor(wereld, '/api/rtf/social/gezin/contacten');
  assert.equal(uit.token, undefined, 'het beheerderstoken hoort te blijven staan');
  assert.equal(uit.kindHandle, rtfHandle('G123', 'p1'));
});

test('een deelgebied dat er niet in staat krijgt niets extras', () => {
  const uit = lijfVoor(wereld, '/api/rtf/overzicht');
  assert.equal(uit.token, undefined);
  assert.equal(uit.kindHandle, undefined);
});

/* Zonder kind wordt er niets verzonnen: dan blijft de beheerder de afzender en
   meet de proef minder, in plaats van iets anders. */
test('zonder kindToken wisselt er niets', () => {
  const uit = lijfVoor({ code: 'G123', token: 'OUDER', profielId: 'p1' }, '/api/rtf/leerling/advies');
  assert.equal(uit.token, undefined);
});

test('de handle heeft de vorm die het huis gebruikt', () => {
  assert.equal(rtfHandle('g123', 'p1'), 'rtf:G123:p1');
});
