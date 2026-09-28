/* De regels van server/kern/kantoor/productiedeur.js (besluit B10), los van een
   server. De e2e-proef staat in test/kantoordeur-productie.test.js; hier de
   randen die daar niet te bereiken zijn: de eigenaar met een kaal lid-token,
   een ontbrekende passkeylaag, en een bewijs dat er alleen op LIJKT. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const pd = require('../server/kern/kantoor/productiedeur');
const { ZWARE_ACTIES } = require('../server/kern/webauthn-acties');

const PROD = { NODE_ENV: 'production', APP_URL: 'https://rtg.voorbeeld.test/' };
const TEST = { NODE_ENV: 'test' };
const bewijs = { type: 'passkey', methode: 'cryptografisch', graad: 'bewezen', actie: pd.ACTIE, op: '2026-09-27T00:00:00Z' };

test('buiten productie verandert er niets', async () => {
  assert.equal(pd.codeDicht(TEST), null);
  assert.equal(pd.sessieMag({ role: 'office' }, TEST).ok, true, 'de gedeelde codesessie werkt nog');
  assert.equal(pd.eigenaarDirect(TEST).ok, true);
  assert.deepEqual(await pd.startBewijs({ zwaarVan: () => null, key: 'user-1', env: TEST }), { ok: true, bewijs: null });
});

test('in productie: de code dicht, en alleen een sessie op naam met een passkeybewijs', () => {
  const d = pd.codeDicht(PROD);
  assert.equal(d.status, 403);
  assert.equal(d.code, pd.CODE_DICHT);
  assert.ok(d.weg.length > 40, 'de weg erheen staat erbij');
  assert.equal(pd.sessieMag({ role: 'office' }, PROD).ok, false, 'geen naam');
  assert.equal(pd.sessieMag({ role: 'office', lidKey: 'user-4' }, PROD).ok, false, 'naam zonder passkey');
  assert.equal(pd.sessieMag({ role: 'office', lidKey: 'user-4', kantoorBewijs: bewijs }, PROD).ok, true);
  for (const nep of [true, { ...bewijs, type: 'wachtwoord' }, { ...bewijs, methode: 'opgegeven' },
    { ...bewijs, actie: 'passkey-weg' }, { ...bewijs, op: null }])
    assert.equal(pd.sessieMag({ role: 'office', lidKey: 'user-4', kantoorBewijs: nep }, PROD).ok, false,
      'een bewijs dat er alleen op lijkt: ' + JSON.stringify(nep));
  assert.equal(pd.eigenaarDirect(PROD).ok, false, 'ook de eigenaar niet met een kaal lid-token');
});

test('in productie: ontbrekende passkeylaag of APP_URL is dicht, nooit een terugval', async () => {
  for (const [zwaarVan, env] of [[() => null, PROD], [() => { throw new Error('x'); }, PROD],
    [() => ({ eis() {}, opties() {} }), { NODE_ENV: 'production' }]]) {
    const r = await pd.startBewijs({ zwaarVan, accounts: { getUserById: () => ({ id: 1 }) }, key: 'user-1', env });
    assert.equal(r.status, 503);
    assert.equal(r.code, 'KANTOOR_PASSKEY_NIET_INGERICHT');
    assert.equal(r.ok, undefined);
  }
});

test('in productie: de passkey wordt ZONDER terugval gevraagd, en alleen bewezen telt', async () => {
  const gezien = [];
  const zwaar = (uitslag) => ({ sessieSleutel: () => 'sl',
    opties: async () => ({ status: 200, ceremonie: 'c1', opties: { challenge: 'x' } }),
    eis: async (user, actie, sleutel, req, oms, o) => { gezien.push({ actie, o }); return uitslag; } });
  const accounts = { getUserById: () => ({ id: 7 }) };
  const ok = await pd.startBewijs({ zwaarVan: () => zwaar({ ok: true, bewezen: true }), accounts, key: 'user-7', env: PROD });
  assert.equal(ok.ok, true);
  assert.equal(pd.bewijsGeldig(ok.bewijs), true);
  assert.deepEqual(gezien[0], { actie: 'kantoor-binnen', o: { zonderTerugval: true } });
  const terugval = await pd.startBewijs({ zwaarVan: () => zwaar({ ok: true, bewezen: false }), accounts, key: 'user-7', env: PROD });
  assert.notEqual(terugval.ok, true, 'een terugval zonder bewijs opent niets');
  const vraag = await pd.startBewijs({ zwaarVan: () => zwaar({ status: 401, bevestigingNodig: true, error: 'b' }), accounts, key: 'user-7', env: PROD });
  assert.equal(vraag.status, 401);
  assert.deepEqual(vraag.bevestiging, { ceremonie: 'c1', opties: { challenge: 'x' } });
  const geenLid = await pd.startBewijs({ zwaarVan: () => zwaar({ ok: true, bewezen: true }), accounts, key: 'kantoor', env: PROD });
  assert.equal(geenLid.status, 403);
  assert.ok(ZWARE_ACTIES.includes(pd.ACTIE), 'de ceremonie kent de naam');
});
