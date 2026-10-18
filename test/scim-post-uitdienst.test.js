/* SCIM POST /Users MET active:false VOOR EEN BESTAAND ACCOUNT -- dezelfde
   uitdienst als PATCH, PUT en DELETE.

   Een IdP die bij een eerste synchronisatie een vertrokken medewerker als
   `active:false` aanbiedt, raakt hier een account dat al bestaat. Die POST zette
   het RTG-account rechtstreeks uit (accounts.zetActief) en liep zo LANGS de
   gebruikersync (server/scim/user-sync.js): geen herstelopdracht in
   scim_user_deprovision, geen blokkade van het lid-token, geen Werk OS-cascade.
   De IdP kreeg 200 terwijl de werkplek openstond.

   Deze toets draait in het proces: echte accounts in een tijdelijke map, de
   echte route uit server/routes/scim.js, de echte gebruikersync en de echte
   cascade (maakCascade); alleen de tenantbrug is een stub, zodat de storing op
   de naad zelf kan worden geïnjecteerd.

   Wat hier niet mag sneuvelen:
   - een POST active:false van een bestaand account loopt door dezelfde
     gebruikersync als PATCH: account dicht, Werk OS-cascade aangeroepen met
     'user-<id>', en het lid-token geblokkeerd zolang die cascade loopt;
   - faalt de cascade, dan is het fail-closed: geen 2xx maar 503, het account
     blijft dicht, de herstelopdracht blijft staan en het lid-token blijft
     geblokkeerd tot een herstelronde de cascade bevestigt.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de oude code terug (accounts.zetActief(bestaand.id, false) in maak()):
     zakte op toets 1 (cascade niet aangeroepen) en toets 2 (200 in plaats van
     503, geen blokkade);
   - in maak() de uitdienst helemaal weg (geen zetActief): zakte op toets 1
     (account bleef actief) en toets 2;
   - in de route de gebruikersync niet doorgeven aan maak(): zakte op toets 1 en
     2 (maak weigert dan fail-closed met 500 in plaats van een stille omweg). */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scim-post-'));
process.env.RTG_DATA_DIR = TMP;

const accounts = require('../server/accounts');
accounts.init();
const S = require('../server/accounts/state');
const koppelingen = require('../server/sso/koppelingen');
const sso = require('../server/sso');
const scim = require('../server/scim');
const userSync = require('../server/scim/user-sync');
const hangScim = require('../server/routes/scim');
sso.zorgTabel();
scim.zorgTabel();

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

koppelingen.zet({ org: 'alfa', naam: 'Alfa BV', issuer: 'https://idp.alfa.test',
  clientId: 'c-alfa', clientSecret: 'g1', domeinen: 'alfa.test' });

function monteer(deprovisioneer) {
  const routes = {};
  const app = {};
  for (const m of ['get', 'post', 'patch', 'put', 'delete']) {
    app[m] = (pad, ...h) => { routes[m.toUpperCase() + ' ' + pad] = h; };
  }
  hangScim({ app, accounts, tenant: {
    register: { haal: org => ({ org, actief: true, werkruimtes: ['W1'] }) },
    brug: { deprovisioneer }
  } });
  const h = routes['POST /api/scim/v2/Users'];
  return h[h.length - 1];
}

function antwoord() {
  return { code: 200, body: null, headers: {},
    status(c) { this.code = c; return this; },
    set(n, w) { this.headers[String(n).toLowerCase()] = w; return this; },
    json(b) { this.body = b; return this; } };
}

const opdracht = id => S.huidigeDb()
  .prepare('SELECT last_error FROM scim_user_deprovision WHERE org = ? AND user_id = ?').get('alfa', String(id));

async function post(handler, userName) {
  const res = antwoord();
  await handler({ scimOrg: 'alfa', body: { userName, active: false }, get: () => '' }, res);
  return res;
}

test('1. POST active:false van een bestaand account loopt door de gebruikersync en de cascade', async () => {
  const { user } = await scim.maak(accounts, 'alfa', { userName: 'vertrekker@alfa.test' });
  const geroepen = [];
  const handler = monteer((org, sleutel) => {
    geroepen.push([org, sleutel, userSync.geblokkeerd(sleutel)]);
    return { ok: true, geraakt: ['W1'] };
  });
  const res = await post(handler, 'vertrekker@alfa.test');
  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.equal(accounts.getUserById(user.id).actief, 0, 'het account is dicht');
  assert.deepEqual(geroepen, [['alfa', 'user-' + user.id, true]],
    'de Werk OS-cascade is aangeroepen terwijl het lid-token al geblokkeerd stond');
  assert.equal(opdracht(user.id), undefined, 'na een bevestigde cascade is de opdracht afgehandeld');
  assert.equal(userSync.geblokkeerd('user-' + user.id), false);
});

test('2. faalt de cascade, dan geen 2xx: account dicht, opdracht en blokkade blijven staan', async () => {
  const { user } = await scim.maak(accounts, 'alfa', { userName: 'ontslag@alfa.test' });
  const handler = monteer(() => { throw new Error('Werk OS opslag uit'); });
  const res = await post(handler, 'ontslag@alfa.test');
  assert.equal(res.code, 503, 'de IdP mag geen bevestiging krijgen');
  assert.equal(accounts.getUserById(user.id).actief, 0, 'het account is toch dicht');
  const rij = opdracht(user.id);
  assert.ok(rij, 'de herstelopdracht blijft staan');
  assert.match(String(rij.last_error), /niet worden bevestigd/);
  assert.equal(userSync.geblokkeerd('user-' + user.id), true, 'het lid-token blijft geblokkeerd');
});
