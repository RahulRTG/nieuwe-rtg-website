/* SCIM-ORGANISATIEGRENS -- een sleutel ziet alleen zijn eigen organisatie.

   De SCIM-deur (server/routes/scim.js + server/scim/index.js) is de enige plek
   waar een BUITENSTAANDS systeem accounts aanmaakt en uitzet, met een sleutel
   die bij de klant ligt. Deze toets monteert de echte routes in het proces,
   op een echte accounts-database in een tijdelijke map, en duwt op de grens.

   Wat hier niet mag sneuvelen:
   1. Zonder geldige sleutel geen enkel antwoord over gebruikers (401 met
      www-authenticate); een ingetrokken sleutel is meteen dood.
   2. De sleutel van organisatie B leest, zoekt noch zet een account van A uit:
      404, en het account van A blijft aan.
   3. Een filter dat we niet begrijpen (ook externalId) is een NETTE FOUT en geen
      lege lijst -- anders maakt de IdP een tweede account aan.
   4. Aanmaken buiten de eigen domeinen of zonder adres wordt geweigerd; een
      nieuw account krijgt nooit een betaalde pas, ook niet als de IdP erom vraagt.
   5. Het bijhouden van "laatst gebruikt" mag falen zonder dat de sleutel stopt.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - scim/index.js binnenOrg(): `return !!domein && k.domeinen.includes(domein)`
     -> `return true` -> toets 2 zakt (B zet het account van A uit).
   - scim/filter.js: de externalId-weigering weg -> toets 3 zakt.
   - scim/index.js maak(): `tier: 'rtg'` -> `tier: gegevens.tier || 'rtg'` -> toets 4 zakt.

   Draai los: node --test test/scim-orggrens-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scimgrens-'));
process.env.RTG_DATA_DIR = TMP;
const accounts = require('../server/accounts');
accounts.init();
const S = require('../server/accounts/state');
const scim = require('../server/scim');
const sso = require('../server/sso');
const koppelingen = require('../server/sso/koppelingen');
const vorm = require('../server/scim/vorm');

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const roep = require('./scim-proef')({ accounts, tenant: { register: { haal: () => null } } });

let A, B, ZONDER, piet, joke;
test.before(async () => {
  koppelingen.zet({ org: 'org-a', issuer: 'https://idp.a.test', clientId: 'c', domeinen: 'klant-a.test' });
  koppelingen.zet({ org: 'org-b', issuer: 'https://idp.b.test', clientId: 'c', domeinen: 'klant-b.test' });
  A = 'Bearer ' + scim.sleutels.draai('org-a').sleutel;
  B = 'Bearer ' + scim.sleutels.draai('org-b').sleutel;
  ZONDER = 'Bearer ' + scim.sleutels.draai('org-zonder-koppeling').sleutel;
  piet = (await roep('POST', '/Users', { sleutel: A, body: { emails: [{ value: 'Piet@Klant-A.test' }],
    name: { givenName: 'Piet', familyName: 'Plank' }, tier: 'business' } })).body;
  joke = (await roep('POST', '/Users', { sleutel: A, body: { userName: 'joke@klant-a.test', displayName: 'Joke' } })).body;
});

test('1. zonder geldige sleutel geen antwoord; een ingetrokken sleutel is meteen dood', async () => {
  for (const s of [undefined, 'Basic abc', 'Bearer rtgscim_kort', 'Bearer rtgscim_' + 'x'.repeat(43)]) {
    const r = await roep('GET', '/Users', { sleutel: s });
    assert.equal(r.code, 401, String(s));
    assert.match(r.kop['www-authenticate'], /RTG SCIM/);
    assert.equal(r.body.schemas[0], vorm.SCHEMA_FOUT);
  }
  const tijdelijk = scim.sleutels.draai('org-weg');
  assert.equal((await roep('GET', '/Schemas', { sleutel: 'Bearer ' + tijdelijk.sleutel })).code, 200);
  assert.equal(scim.sleutels.weg('ORG-WEG '), true, 'intrekken normaliseert de org zoals draaien');
  assert.equal(scim.sleutels.weg('org-weg'), false, 'een tweede intrekking meldt dat er niets meer was');
  assert.equal((await roep('GET', '/Schemas', { sleutel: 'Bearer ' + tijdelijk.sleutel })).code, 401);
  assert.equal(scim.sleutels.stand('org-weg'), null);
  assert.throws(() => scim.sleutels.draai('   '), /organisatie/);
});

test('2. de sleutel van B leest, zoekt noch zet een account van A uit', async () => {
  assert.equal(piet.userName, 'piet@klant-a.test');
  for (const [m, extra] of [['GET', {}], ['PUT', { body: { active: false } }], ['DELETE', {}],
    ['PATCH', { body: { Operations: [{ op: 'replace', path: 'active', value: false }] } }]]) {
    const r = await roep(m, '/Users/:id', { sleutel: B, id: piet.id, ...extra });
    assert.equal(r.code, 404, m);
    assert.match(r.body.detail, /binnen deze organisatie/);
  }
  assert.equal(accounts.getUserById(Number(piet.id)).actief, 1, 'A is nog aan');
  const zoek = await roep('GET', '/Users', { sleutel: B, query: { filter: 'userName eq "piet@klant-a.test"' } });
  assert.equal(zoek.body.totalResults, 0, 'B weet niet eens dat piet bestaat');
  const lijstB = await roep('GET', '/Users', { sleutel: B });
  assert.equal(lijstB.body.totalResults, 0, 'de lijst van B kent niemand van A');
  /* Een tweede SSO-subject voor dezelfde persoon telt niet dubbel. */
  sso.legVast('org-a', 'sub-piet-2', Number(piet.id));
  const lijstA = await roep('GET', '/Users', { sleutel: A, query: { startIndex: '1', count: '1' } });
  assert.equal(lijstA.body.totalResults, 2);
  assert.equal(lijstA.body.itemsPerPage, 1);
  assert.equal(scim.binnenOrg(accounts, 'org-a', null), false);
  assert.equal(scim.binnenOrg(accounts, 'org-onbekend', accounts.getUserById(Number(joke.id))), false);
});

test('3. een filter dat we niet begrijpen is een nette fout, geen lege lijst', async () => {
  for (const f of ['externalId eq "123"', 'userName co "piet"', 'displayName eq "x"']) {
    const r = await roep('GET', '/Users', { sleutel: A, query: { filter: f } });
    assert.equal(r.code, 400, f);
    assert.equal(r.body.scimType, 'invalidFilter');
  }
  assert.match((await roep('GET', '/Users', { sleutel: A, query: { filter: "externalId eq 'x'" } })).body.detail, /externalId/);
  const viaMail = await roep('GET', '/Users', { sleutel: A, query: { filter: 'emails.value eq "JOKE@klant-a.test"' } });
  assert.equal(viaMail.body.totalResults, 1);
  assert.equal(viaMail.body.Resources[0].id, joke.id);
});

test('4. aanmaken buiten de eigen domeinen of zonder adres wordt geweigerd, en nooit een betaalde pas', async () => {
  const cases = [
    [A, { userName: 'iemand@klant-b.test' }, 400, /buiten de domeinen/],
    [A, { name: { formatted: 'x' } }, 400, /userName is verplicht/],
    [A, { emails: [] }, 400, /userName is verplicht/],
    [ZONDER, { userName: 'x@klant-a.test' }, 404, /Onbekende organisatie/]
  ];
  for (const [s, body, code, tekst] of cases) {
    const r = await roep('POST', '/Users', { sleutel: s, body });
    assert.equal(r.code, code, JSON.stringify(body));
    assert.match(r.body.detail, tekst);
  }
  assert.equal(accounts.findByLogin('iemand@klant-b.test'), null, 'de weigering liet niets achter');
  const u = accounts.getUserById(Number(piet.id));
  assert.equal(u.tier, 'rtg', 'tier uit het SCIM-lichaam wordt genegeerd');
  const nogmaals = await roep('POST', '/Users', { sleutel: A, body: { userName: 'piet@klant-a.test' } });
  assert.equal(nogmaals.code, 200, 'bestaand binnen de eigen org: het bestaande account terug');
  assert.equal(nogmaals.body.id, piet.id);
  const zonderOps = await roep('PATCH', '/Users/:id', { sleutel: A, id: joke.id, body: {} });
  assert.equal(zonderOps.code, 400, 'een PATCH zonder herkende bewerking doet niet alsof');
  const vreemd = await roep('PATCH', '/Users/:id', { sleutel: A, id: joke.id,
    body: { Operations: [null, { op: 'remove', path: 'active' }, { op: 'replace', path: 'name', value: 'x' }] } });
  assert.equal(vreemd.code, 400);
  assert.equal(accounts.getUserById(Number(joke.id)).actief, 1);
  const tekst = await roep('PATCH', '/Users/:id', { sleutel: A, id: joke.id,
    body: { Operations: [{ op: 'Replace', value: { active: 'False' } }] } });
  assert.equal(tekst.code, 200, 'zonder tenant is de cascade een bewezen lege scope');
  assert.equal(tekst.body.active, false, "de string 'False' zet uit");
  const uit = await roep('POST', '/Users', { sleutel: A, body: { userName: 'nieuw@klant-a.test', active: false } });
  assert.equal(uit.code, 201);
  assert.equal(uit.body.active, false, 'een nieuw account dat de IdP uit wil, staat uit');
});

test('5. laatst-gebruikt mag falen zonder dat de sleutel stopt', async () => {
  S.db.exec(`CREATE TRIGGER scim_geen_stempel BEFORE UPDATE ON scim_sleutels
    BEGIN SELECT RAISE(ABORT, 'stempel kapot'); END`);
  try {
    const r = await roep('GET', '/ServiceProviderConfig', { sleutel: A });
    assert.equal(r.code, 200);
    assert.equal(r.body.bulk.supported, false, 'de config belooft geen bulk die we niet hebben');
    assert.equal(r.kop['content-type'], 'application/scim+json; charset=utf-8');
  } finally { S.db.exec('DROP TRIGGER scim_geen_stempel'); }
  const rt = await roep('GET', '/ResourceTypes', { sleutel: A });
  assert.deepEqual(rt.body.Resources.map(x => x.endpoint), ['/Users', '/Groups']);
  const sch = await roep('GET', '/Schemas', { sleutel: A });
  assert.deepEqual(sch.body.Resources[0].attributes.map(a => a.name), ['userName', 'active', 'emails'],
    'geen telefoon, geen codenaam, geen pas');
  const g = vorm.gebruiker({ id: 9, actief: 0 }, null);
  assert.equal(g.userName, '9');
  assert.deepEqual(g.emails, []);
  assert.equal(g.meta.location, '/Users/9');
  assert.equal(vorm.providerConfig().documentationUri, '/docs');
});
