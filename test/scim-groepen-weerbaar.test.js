/* SCIM /Groups -- wie uit een groep gaat, verliest zijn rol in HETZELFDE verzoek.

   server/scim/groepen.js bewaart naam + leden; server/routes/scim-groepen.js laat
   elke ledenwijziging door de tenantbrug meebewegen. Echte routes in het proces
   (./scim-proef.js), echte accounts-database, een brug die we laten falen.

   Wat hier niet mag sneuvelen:
   1. Elke PATCH-vorm van IdP's (replace, add, remove met filter, met waarde,
      zonder iets) komt aan, en wie ERUIT gaat wordt meteen zonder groep herrekend.
   2. De sleutel van B leest, wijzigt noch verwijdert een groep van A.
   3. Nesting, lege/dubbele naam, te veel leden, een onherkende PATCH: geweigerd
      met reden en zonder bijwerking; groep + markering zijn EEN commit.
   4. Bevestigt de brug niet: 503 + retry-after, de mensen blijven wachtend, en
      een herhaling (POST of DELETE) maakt het af.

   MUTATIES (LAT.md regel 2), gedraaid en gezakt:
   - uitPatch(): `leden.filter(x => x !== m[1])` -> `leden` -> toets 1 zakt.
   - schoonLeden(): de nesting-weigering weg -> toets 3 zakt.
   - hernoem(): `botst && botst.id !== g.id` -> `false` -> toets 3 zakt.

   Draai los: node --test test/scim-groepen-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scimgroep-w-'));
process.env.RTG_DATA_DIR = TMP;
const accounts = require('../server/accounts');
accounts.init();
const scim = require('../server/scim');
const koppelingen = require('../server/sso/koppelingen');
const groepen = require('../server/scim/groepen');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

let brugFaalt = false;
const claims = [];
const tenant = {
  register: { haal: (org) => (org === 'org-ga' ? { org } : null) },
  brug: { uitClaims(org, groepenNu, sleutel) {
    claims.push({ org, groepen: groepenNu.slice().sort(), sleutel });
    return brugFaalt ? { ok: false, reden: 'brug dicht' } : { ok: true, werkruimtes: [] };
  } }
};
const roep = require('./scim-proef')({ accounts, tenant });
const patch = (sleutel, id, Operations) => roep('PATCH', '/Groups/:id', { sleutel, id, body: { Operations } });
const laatsteVoor = (uid) => claims.filter(c => c.sleutel === 'user-' + uid).pop();

let A, B, ids;
test.before(async () => {
  koppelingen.zet({ org: 'org-ga', issuer: 'https://idp.ga.test', clientId: 'c', domeinen: 'ga.test' });
  koppelingen.zet({ org: 'org-gb', issuer: 'https://idp.gb.test', clientId: 'c', domeinen: 'gb.test' });
  A = 'Bearer ' + scim.sleutels.draai('org-ga').sleutel;
  B = 'Bearer ' + scim.sleutels.draai('org-gb').sleutel;
  ids = [];
  for (const n of ['a', 'b', 'c']) ids.push(String((await scim.maak(accounts, 'org-ga', { userName: n + '@ga.test' })).user.id));
});

test('1. elke PATCH-vorm komt aan, en wie eruit gaat verliest zijn rol meteen', async () => {
  const g = await roep('POST', '/Groups', { sleutel: A, body: { displayName: 'Managers', externalId: 'ext-1',
    members: [{ value: ids[0] }, ids[1], { value: ids[1] }, { value: '' }] } });
  assert.equal(g.code, 201);
  assert.deepEqual(g.body.members.map(m => m.value), [ids[0], ids[1]], 'dubbel en leeg vallen weg');
  assert.equal(g.body.externalId, 'ext-1');
  assert.deepEqual(laatsteVoor(ids[0]).groepen, ['Managers']);

  const stappen = [
    [[{ op: 'add', path: 'members', value: [{ value: ids[2] }] }], [ids[0], ids[1], ids[2]]],
    [[{ op: 'remove', path: `members[value eq "${ids[1]}"]` }], [ids[0], ids[2]]],
    [[{ op: 'remove', path: 'members', value: [{ value: ids[2] }] }], [ids[0]]],
    [[{ op: 'replace', value: { members: [{ value: ids[1] }] } }], [ids[1]]],
    [[{ op: 'remove', path: 'members' }], []],
    [[{ op: 'replace', path: 'members', value: [ids[0]] }, { op: 'replace', path: 'displayName', value: 'Leiding' }], [ids[0]]]
  ];
  for (const [ops, verwacht] of stappen) {
    const r = await patch(A, g.body.id, ops);
    assert.equal(r.code, 200, JSON.stringify(ops));
    assert.deepEqual(r.body.members.map(m => m.value), verwacht, JSON.stringify(ops));
  }
  assert.deepEqual(laatsteVoor(ids[1]).groepen, [], 'ids[1] is eruit en de brug rekende hem zonder groep');
  const hernoemd = await patch(A, g.body.id, [{ op: 'replace', value: { displayName: 'Directie' } }]);
  assert.equal(hernoemd.body.displayName, 'Directie');
  assert.deepEqual(laatsteVoor(ids[0]).groepen, ['Directie'], 'de brug ziet de nieuwe naam');
  const put = await roep('PUT', '/Groups/:id', { sleutel: A, id: g.body.id, body: { displayName: 'Directie' } });
  assert.equal(groepen.vind('org-ga', g.body.id).leden.includes(ids[0]), false, 'PUT zonder members haalt ook ids[0] eruit');
  assert.deepEqual(laatsteVoor(ids[0]).groepen, []);
});

test('2. de sleutel van B leest, wijzigt noch verwijdert een groep van A', async () => {
  const g = (await roep('POST', '/Groups', { sleutel: A, body: { displayName: 'Geheim', members: [ids[2]] } })).body;
  for (const [m, body] of [['GET'], ['PUT', { members: [] }], ['DELETE'],
    ['PATCH', { Operations: [{ op: 'remove', path: 'members' }] }]]) {
    const r = await roep(m, '/Groups/:id', { sleutel: B, id: g.id, body });
    assert.equal(r.code, 404, m);
  }
  assert.deepEqual(groepen.vind('org-ga', g.id).leden, [ids[2]], 'onaangeroerd');
  assert.deepEqual((await roep('GET', '/Groups', { sleutel: B })).body.Resources, []);
  assert.equal((await roep('GET', '/Groups/:id', { sleutel: A, id: g.id })).body.displayName, 'Geheim');
});

test('3. nesting, lege of dubbele naam, te veel leden en onherkende PATCH: geweigerd zonder bijwerking', async () => {
  const voor = claims.length;
  const fouten = [
    [{ displayName: 'N1', members: [{ value: '9', type: 'Group' }] }, 400, /groep in een groep/],
    [{ displayName: 'N2', members: [{ value: '9', $ref: 'https://x/Groups/9' }] }, 400, /groep in een groep/],
    [{ displayName: '  ' }, 400, /displayName/],
    [{ displayName: 'Geheim' }, 409, /bestaat al/]
  ];
  for (const [body, code, tekst] of fouten) {
    const r = await roep('POST', '/Groups', { sleutel: A, body });
    assert.equal(r.code, code, JSON.stringify(body));
    assert.match(r.body.detail, tekst);
  }
  assert.equal(groepen.opNaam('org-ga', 'N1'), null);
  assert.equal(claims.length, voor, 'een weigering raakt niemands rol');
  const veel = Array.from({ length: groepen.MAX_LEDEN + 1 }, (_, i) => String(i + 1));
  assert.throws(() => groepen.schoonLeden(veel), (e) => e.status === 400 && e.scimType === 'tooLarge');
  assert.deepEqual(groepen.schoonLeden('geen lijst'), []);

  const g = (await roep('POST', '/Groups', { sleutel: A, body: { displayName: 'Tweede' } })).body;
  const botst = await patch(A, g.id, [{ op: 'replace', path: 'displayName', value: 'Geheim' }]);
  assert.equal(botst.code, 409);
  assert.equal(botst.body.scimType, 'uniqueness');
  const niets = await patch(A, g.id, [null, { op: 'replace', path: 'externalId', value: 'x' }]);
  assert.equal(niets.code, 400);
  assert.equal((await roep('PATCH', '/Groups/:id', { sleutel: A, id: g.id, body: {} })).code, 400);
  assert.equal(groepen.vind('org-ga', g.id).naam, 'Tweede');

  const S = require('../server/accounts/state');
  S.db.exec(`CREATE TRIGGER scim_retry_kapot BEFORE INSERT ON scim_groep_create_retry
    BEGIN SELECT RAISE(ABORT, 'retry kapot'); END`);
  try {
    const r = await roep('POST', '/Groups', { sleutel: A, body: { displayName: 'Half', members: [ids[2]] } });
    assert.equal(r.code, 400);
  } finally { S.db.exec('DROP TRIGGER scim_retry_kapot'); }
  assert.equal(groepen.opNaam('org-ga', 'Half'), null, 'geen halve groep');
  assert.deepEqual(groepen.wachtendeSync('org-ga'), [], 'en geen losse markering');
  assert.equal(S.db.isTransaction, false);

  assert.throws(() => groepen.maak('org-ga', ''), (e) => e.status === 400);
  assert.throws(() => groepen.maak('org-ga', 'Tweede'), (e) => e.status === 409);
  assert.equal(groepen.maak('org-ga', 'Intern', [ids[0]], 'ext-9').externeId, 'ext-9');
  assert.equal(groepen.maak('org-ga', 'Intern2').externeId, null);
  assert.equal(groepen.isCreateRetry('org-ga', null, 'x', []), false);
  assert.equal(groepen.hernoem('org-ga', g.id, '  ').naam, 'Tweede', 'een lege naam hernoemt niet');
  for (const f of [() => groepen.zetLeden('org-gb', g.id, []), () => groepen.hernoem('org-gb', g.id, 'x'),
    () => groepen.haalWeg('org-gb', g.id)]) assert.throws(f, (e) => e.status === 404);
});

test('4. bevestigt de brug niet, dan 503 en blijven de mensen wachtend tot een herhaling', async () => {
  brugFaalt = true;
  const eerst = await roep('POST', '/Groups', { sleutel: A, body: { displayName: 'Ploeg', members: [ids[1]] } });
  assert.equal(eerst.code, 503);
  assert.equal(eerst.kop['retry-after'], '30');
  assert.deepEqual(groepen.wachtendeSync('org-ga'), [ids[1]]);
  brugFaalt = false;
  const weer = await roep('POST', '/Groups', { sleutel: A, body: { displayName: 'Ploeg', members: [ids[1]] } });
  assert.equal(weer.code, 200, 'de herkende herhaling hervat i.p.v. 409');
  assert.deepEqual(groepen.wachtendeSync('org-ga'), []);
  assert.equal((await roep('POST', '/Groups', { sleutel: A, body: { displayName: 'Ploeg', members: [ids[1]] } })).code, 409,
    'na afronding is een herhaling weer een gewone dubbele');

  brugFaalt = true;
  const del = await roep('DELETE', '/Groups/:id', { sleutel: A, id: weer.body.id });
  assert.equal(del.code, 503);
  assert.equal(groepen.vind('org-ga', weer.body.id), null, 'de groep is weg');
  assert.deepEqual(groepen.wachtendeSync('org-ga'), [ids[1]], 'maar het lid wacht nog op intrekking');
  brugFaalt = false;
  assert.equal((await roep('DELETE', '/Groups/:id', { sleutel: A, id: weer.body.id })).code, 204);
  assert.deepEqual(laatsteVoor(ids[1]).groepen, []);
  assert.equal((await roep('DELETE', '/Groups/:id', { sleutel: A, id: weer.body.id })).code, 404);
});
