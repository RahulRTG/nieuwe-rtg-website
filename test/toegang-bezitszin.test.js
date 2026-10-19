/* DE ZIN BIJ EEN ONGEBONDEN SESSIE OP EEN ZWAAR PAD (eigenaarsbesluit 19 oktober
   2026: een passkey hoort bij elk account, ook een gratis account; gevonden door
   Geld). Sinds een gratis account een toestel kan binden (routes/member/
   toestellen.js, eisAccount), hoort het de zin te krijgen die zegt WAT het kan
   doen -- dit toestel bevestigen -- en niet "maak of gebruik een account". Een
   gastsessie zonder account houdt de accountzin. De 403 blijft voor allebei. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakBezitsbewijs } = require('../server/kern/identiteit/bezitsbewijs');

const b = maakBezitsbewijs({ db: { data: {} }, save() {}, toestellen: { publiekeSleutelVan: () => null } });
const zwaar = (sess) => b.controleer({ sess, methode: 'POST', pad: '/api/pay/tik', kop: null, stand: 'verplicht' });

test('een gratis account zonder gebonden toestel hoort dat het dit toestel kan bevestigen', async () => {
  const uit = await zwaar({ key: 'user-7', tier: 'guest', account: { id: 7, tier: 'guest' }, sessieContext: {} });
  assert.equal(uit.code, 403, 'de weigering blijft');
  assert.match(uit.reden, /Bevestig dit toestel in "Waar ben ik aanwezig"/, 'een gratis account kan binden: ' + uit.reden);
});

test('een gastsessie zonder account houdt de accountzin', async () => {
  const uit = await zwaar({ key: 'guest-1', tier: 'guest', account: null, sessieContext: {} });
  assert.equal(uit.code, 403);
  assert.match(uit.reden, /Maak of gebruik een account/, uit.reden);
});
