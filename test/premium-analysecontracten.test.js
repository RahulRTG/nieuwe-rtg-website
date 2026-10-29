/* Productbesluit 21 oktober: opnieuw analyseren, geen nieuw geldbesluit.
   Dit zijn kernproeven; HTTP-autorisatie en workerherstel blijven afzonderlijk. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('Labfonds herberekent actuele dekking zonder toekenning of dubbele toezegging', () => {
  const db = { data: {} };
  const { labfonds: fonds } = require('../server/kern/labfonds')({ db, save() {}, crypto });
  const voorstel = fonds.voorstelMaak('lid-a', 'Amber', 'ibiza', 'Bomen voor de buurt',
    'Bomen planten en verzorgen langs het gezamenlijke plein voor alle buurtbewoners.', 40);
  assert.equal(voorstel.ok, true);
  assert.equal(fonds.scheidsrechter(voorstel.voorstel.id).scheids.oordeel, 'afraden');
  assert.equal(fonds.doneer('lid-a', 'Amber', 'ibiza', 100, 'bewuste-bijdrage').ok, true);
  const voor = structuredClone(db.data);
  for (let i = 0; i < 3; i++) {
    const r = fonds.scheidsrechter(voorstel.voorstel.id);
    assert.equal(r.ok, true);
    assert.equal(r.scheids.oordeel, 'steun', 'nieuw advies gebruikt de actuele pot');
  }
  const na = structuredClone(db.data);
  // Alleen het advies mag veranderen; niet stemmen, boekingen of besluit.
  for (const data of [voor, na]) for (const v of data.labFonds.voorstellen) delete v.scheids;
  assert.deepEqual(na, voor);
  assert.equal(fonds.fonds('lid-a').voorstellen[0].status, 'open');
});

test('zeven besluiten gebruiken bestaande contractkeuring en dragen uitvoerbaar kwalificatiebewijs', () => {
  const { CONTRACTEN } = require('../server/lib/mutatiecontracten-premium-opdrachten');
  const { keur } = require('../server/kern/mutatiecontract');
  assert.equal(Object.keys(CONTRACTEN).length, 7);
  for (const [route, c] of Object.entries(CONTRACTEN)) {
    assert.deepEqual(keur({ ...c, route }), [], route);
    assert.notEqual(c.stand, 'LEGACY_PENDING_CLASSIFICATION', 'een afgesloten contract blijft niet in de wachtkamer');
    assert.ok(c.bewijs && c.bewijs.gemeten && c.bewijs.op, 'de eindstand noemt zijn uitvoerbare bewijs');
  }
});

test('Labfonds HTTP-analyse bevestigt het bewaarde advies pas na duurzame vastlegging', async () => {
  const routes = new Map();
  let bevestig, bundels = 0;
  const opgeslagen = new Promise(r => { bevestig = r; });
  require('../server/routes/labfonds')({
    app: { post(pad, ...handlers) { routes.set(pad, handlers); } },
    auth() {}, officeAuth() {}, rtf: {},
    labfonds: {
      async vast(werk) { bundels++; const r = werk(); await opgeslagen; return r; },
      scheidsrechter() { return { ok: true, scheids: { oordeel: 'steun' } }; }
    }
  });
  let antwoord;
  const res = { status() { return this; }, json(r) { antwoord = r; } };
  routes.get('/api/labfonds/scheidsrechter').at(-1)({ body: { id: 'voorstel' }, session: { key: 'lid' } }, res);
  await new Promise(r => setImmediate(r));
  assert.equal(bundels, 1, 'ook een advies schrijft en moet duurzaam vastleggen');
  assert.equal(antwoord, undefined, 'geen succes vóór commit');
  bevestig();
  await new Promise(r => setImmediate(r));
  assert.equal(antwoord.ok, true);
});
