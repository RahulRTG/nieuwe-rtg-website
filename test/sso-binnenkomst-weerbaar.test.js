/* VAN GECONTROLEERDE CLAIMS NAAR EEN SESSIE (server/sso/binnenkomst.js).

   Na een geldige handtekening beslist binnenkomst nog twee dingen: of de
   zakelijke groepen VEILIG zijn bijgewerkt (de brug naar Werk OS), en wat er
   naar de browser gaat. test/sso-werksync-failclosed.test.js toetst de
   storingen van een gebonden tenant; hier staan de ANDERE weigerpaden en het
   geslaagde pad zelf.

   Wat hier niet mag sneuvelen:
   1. persoonlijkGescheiden is dicht bij twijfel: geen opslagcontext, geen
      user-id, de platformeigenaar, of een ACTIEF Werk OS-lid buiten een
      tenant; alleen aantoonbaar zonder werktoegang is het open;
   2. de brug faalt dicht (503 SSO_WERKSYNC) zonder tenantregister, als het
      register gooit, zonder tenantbrug, of als de brug geen bevestiging geeft;
   3. de groepen zijn de UNIE van claim en SCIM, zonder dubbelen;
   4. een geslaagde binnenkomst stuurt alleen pas, bewijs en een eigen pad
      mee -- geen e-mailadres, geen naam; een betaalde pas blijft zichtbaar,
      alles anders wordt rtg;
   5. de foutmelding naar buiten verklapt niets, ook niet als de oorzaak een
      tekst of een reden-object is.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in persoonlijkGescheiden `l.status === 'actief'` vervangen door `true` ->
     "1." ZAKT (RAAK: een oud, inactief lid sloot de deur);
   - `[].concat(... , uitScim)` vervangen door alleen de claim -> "3." ZAKT
     (RAAK: de SCIM-groep ontbrak);
   - `const pas = user.tier === 'lifestyle' || ...` vervangen door `'rtg'` ->
     "4." ZAKT (RAAK).

   Draai: node --test test/sso-binnenkomst-weerbaar.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const sso = require('../server/sso');
const scimGroepen = require('../server/scim/groepen');
const eigenaar = require('../server/eigenaar');
const B = require('../server/sso/binnenkomst');

const LID = { id: 7, codename: 'Stille Havik', tier: 'rtg' };
const acc = (email) => ({ emailOf: () => email, issueActionToken: (id, doel, ms) => 'bewijs-' + id + '-' + doel + '-' + ms });
const kern = (extra) => Object.assign({ db: { data: { werkruimtes: {} } }, accounts: acc('piet@klant.test') }, extra || {});
const sync = (e) => e && e.code === 'SSO_WERKSYNC' && e.status === 503;

async function met(vervang, werk) {
  const oud = { aanmelden: sso.aanmelden, groepenVan: scimGroepen.groepenVan, syncKlaar: scimGroepen.syncKlaar };
  Object.assign(sso, { aanmelden: vervang.aanmelden || oud.aanmelden });
  scimGroepen.groepenVan = vervang.groepenVan || (() => []);
  scimGroepen.syncKlaar = vervang.syncKlaar || (() => {});
  try { return await werk(); } finally { sso.aanmelden = oud.aanmelden; scimGroepen.groepenVan = oud.groepenVan; scimGroepen.syncKlaar = oud.syncKlaar; }
}

test('1. persoonlijkGescheiden is dicht bij twijfel', () => {
  for (const [k, u] of [[null, LID], [{ db: {} }, LID], [kern(), null], [kern(), { id: null }]])
    assert.equal(B.persoonlijkGescheiden(k, u).ok, false);
  assert.match(B.persoonlijkGescheiden(kern({ accounts: acc(eigenaar.eigenaarEmail()) }), LID).reden, /platformeigenaar/);
  const ws = (leden) => kern({ db: { data: { werkruimtes: { W1: null, W2: { leden } } } } });
  assert.match(B.persoonlijkGescheiden(ws({ a: { rtgKey: 'user-7', status: 'actief' } }), LID).reden, /actieve Werk OS-koppeling/);
  assert.equal(B.persoonlijkGescheiden(ws({ a: { rtgKey: 'user-7', status: 'uit dienst' }, b: { rtgKey: 'user-8', status: 'actief' }, c: null }), LID).ok, true);
  assert.equal(B.persoonlijkGescheiden(ws(undefined), LID).ok, true);
  assert.equal(B.persoonlijkGescheiden(kern({ db: { data: {} } }), LID).ok, true);
});

test('2. de brug faalt dicht', async () => {
  await met({}, () => {
    assert.throws(() => B.brug(kern(), { org: 'o' }, LID, {}), sync, 'geen tenant');
    assert.throws(() => B.brug(kern({ tenant: { register: {} } }), null, LID, {}), sync, 'register zonder haal');
    assert.throws(() => B.brug(kern({ tenant: { register: { haal: () => { throw new Error('opslag'); } } } }), { org: 'o' }, LID, {}), sync);
    const zonderTenant = kern({ tenant: { register: { haal: () => null } } });
    assert.deepEqual(B.brug(zonderTenant, { org: 'o' }, LID, {}), { ok: true, werkruimtes: [], nietVanToepassing: 'persoonlijk-zonder-werktoegang' });
    zonderTenant.accounts = acc(eigenaar.eigenaarEmail());
    assert.throws(() => B.brug(zonderTenant, { org: 'o' }, LID, {}), sync, 'de eigenaar zonder tenant: dicht');
    const gebonden = (brug) => kern({ tenant: { register: { haal: () => ({ org: 'o' }) }, brug } });
    assert.throws(() => B.brug(gebonden(undefined), { org: 'o' }, LID, {}), sync, 'geen tenantbrug');
    assert.throws(() => B.brug(gebonden({ uitClaims: 'nee' }), { org: 'o' }, LID, {}), sync);
    assert.throws(() => B.brug(gebonden({ uitClaims: () => null }), { org: 'o' }, LID, {}), sync, 'geen bevestiging');
    assert.throws(() => B.brug(gebonden({ uitClaims: () => ({ ok: true }) }), { org: 'o' }, LID, {}), sync, 'zonder werkruimtelijst');
  });
});

test('3. de groepen zijn de unie van claim en SCIM, zonder dubbelen', async () => {
  let gezien, klaar = 0;
  await met({ groepenVan: () => ['Uitvoering', 'Directie'], syncKlaar: (org, id) => { klaar++; assert.deepEqual([org, id], ['o', 7]); } }, () => {
    const k = kern({ tenant: { register: { haal: () => ({}) }, brug: { uitClaims: (org, groepen, sleutel, naam) => { gezien = { groepen, sleutel, naam }; return { ok: true, werkruimtes: ['W1'] }; } } } });
    assert.deepEqual(B.brug(k, { org: 'o' }, LID, { groups: ['Directie', 'Sales'], name: 'Piet' }).werkruimtes, ['W1']);
    assert.deepEqual(gezien, { groepen: ['Directie', 'Sales', 'Uitvoering'], sleutel: 'user-7', naam: 'Piet' });
    B.brug(k, { org: 'o' }, LID, { groups: 'Directie' });
    assert.deepEqual(gezien.groepen, ['Uitvoering', 'Directie'], 'een claim die geen lijst is telt niet');
  });
  assert.equal(klaar, 2, 'een geslaagde sync rondt de herstelrij af');
});

test('4. een geslaagde binnenkomst: pas, bewijs en eigen pad, geen adres of naam', async () => {
  for (const [tier, pas] of [['business', 'business'], ['lifestyle', 'lifestyle'], ['guest', 'rtg']]) {
    const user = Object.assign({}, LID, { tier });
    await met({ aanmelden: async () => ({ user, nieuw: true, gekoppeld: false }) }, async () => {
      let adres, inlog;
      const k = kern({ tenant: { register: { haal: () => null } }, logInlog: (...a) => { inlog = a; } });
      const uit = await B.binnen(k, { org: 'o' }, { email: 'piet@klant.test', name: 'Piet Klant' }, { ip: 'x' }, { redirect: (s, a) => { adres = a; } });
      assert.equal(uit, user);
      const u = new URL(adres, 'https://rtg.test');
      assert.equal(u.pathname, '/apps/app.html');
      assert.equal(u.searchParams.get('pas'), pas);
      assert.equal(u.searchParams.get('terug'), '/');
      assert.equal(u.searchParams.get('sso'), 'bewijs-7-' + B.OVERDRACHT + '-' + B.OVERDRACHT_MS);
      assert.ok(!/piet|klant/i.test(adres), 'geen e-mailadres of naam in de omleiding');
      assert.deepEqual(inlog.slice(0, 3), ['sso', true, 'o']);
    });
  }
});

test('5. de foutmelding naar buiten verklapt niets', () => {
  for (const oorzaak of ['tekst', { reden: 'reden-object' }, undefined, new Error('intern')]) {
    const e = B.werkSyncFout('o', oorzaak);
    assert.equal(e.code, 'SSO_WERKSYNC');
    assert.ok(!/tekst|reden-object|intern/.test(e.message));
  }
  assert.deepEqual(B.foutAntwoord(new Error('geheime binnenkant')), { status: 401, retryAfter: null, bericht: 'Inloggen via uw organisatie is niet gelukt.' });
  assert.equal(B.foutAntwoord(null).status, 401);
  const dicht = B.foutAntwoord(Object.assign(new Error('x'), { code: 'REGISTRATIE_DICHT' }));
  assert.deepEqual([dicht.status, dicht.code, dicht.hoe], [503, 'REGISTRATIE_DICHT', null]);
});
