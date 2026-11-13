'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { maakExperience } = require('../server/kern/experience');

function huis() {
  const db = { data: {} };
  const reizen = [{ id: 'reis-1', bestemming: 'Rome', onderdelen: [] }];
  const taken = [{ soort: 'taak', kenmerk: 'taak-1', titel: 'Mijn taak' }];
  const kern = {
    mijnReizen: key => ({ reizen: key === 'a' ? reizen : [], los: [], bronnen: [], stil: [] }),
    kantoorwereld: { werkdag: key => ({ regels: key === 'a' ? taken : [], bronnen: [], stil: [] }) },
    socialewereld: { kring: () => ({ regels: [], bronnen: [], stil: [] }) },
    geldwereld: { stand: () => ({ regels: [], bronnen: [], stil: [] }) }
  };
  const maak = () => maakExperience({ kern, db, crypto, save() {} }).experience;
  return { db, reizen, taken, maak, experience: maak() };
}

test('hervatten bewaart alleen navigatie, geen querygegevens of extra objectvelden', () => {
  const h = huis(), e = h.experience, b = e.bootstrap({ key: 'a', world: 'work' });
  const r = e.resumeZet('a', { world: 'work', contextId: b.currentContext.id,
    surface: '/apps/kantoor.html?token=geheim#persoon',
    objectRef: { ...b.projection.objects[0].ref, naam: 'Niet bewaren' },
    navigationState: ['home', 'attention'] });
  assert.equal(r.ok, true);
  assert.equal(r.resume.surface, '/apps/kantoor.html');
  assert.deepEqual(r.resume.objectRef, b.projection.objects[0].ref);
  assert.doesNotMatch(JSON.stringify(h.db), /geheim|persoon|Niet bewaren/);
  const terug = h.maak().bootstrap({ key: 'a', world: 'work' });
  assert.equal(terug.resume.reconciled, false);
  assert.deepEqual(terug.resume.navigationState, ['home', 'attention']);
  assert.equal(e.bootstrap({ key: 'b', world: 'work' }).resume, null);
});

test('wereldwisseling neemt geen oude surface, object of navigatiestap mee', () => {
  const e = huis().experience, b = e.bootstrap({ key: 'a', world: 'work' });
  e.resumeZet('a', { world: 'work', contextId: b.currentContext.id,
    surface: '/apps/kantoor.html', objectRef: b.projection.objects[0].ref,
    navigationState: ['attention'] });
  const ander = e.bootstrap({ key: 'a', world: 'living' });
  assert.equal(ander.resume.reconciled, true);
  assert.equal(ander.resume.surface, null);
  assert.equal(ander.resume.objectRef, null);
  assert.deepEqual(ander.resume.navigationState, []);
  assert.equal(e.bootstrap({ key: 'a', world: 'work' }).resume.surface, '/apps/kantoor.html',
    'lezen van een andere wereld overschrijft het opgeslagen herstelpunt niet');
});

test('verdwenen opgeslagen reis valt veilig terug, expliciet verboden context blijft geweigerd', () => {
  const h = huis(), e = h.experience, b = e.bootstrap({ key: 'a', world: 'travel' });
  const reis = b.contexts[1];
  e.resumeZet('a', { world: 'travel', contextId: reis.id,
    surface: '/apps/reizen.html', navigationState: ['reis-1'] });
  h.reizen.splice(0);
  const terug = e.bootstrap({ key: 'a' });
  assert.equal(terug.ok, true);
  assert.equal(terug.currentContext.id, b.contexts[0].id);
  assert.equal(terug.resume.reconciled, true);
  assert.equal(terug.resume.surface, null);
  assert.deepEqual(terug.resume.navigationState, []);
  assert.equal(e.bootstrap({ key: 'a', world: 'travel', contextId: reis.id }).status, 403);
  assert.equal(e.resumeZet('b', { world: 'travel', contextId: reis.id }).status, 403);
});

test('hervatten accepteert uitsluitend een bestaand object uit de eigen projectie', () => {
  const h = huis(), e = h.experience, b = e.bootstrap({ key: 'a', world: 'work' });
  const objectRef = b.projection.objects[0].ref;
  assert.equal(e.resumeZet('b', { world: 'work', objectRef }).status, 403);
  assert.equal(e.resumeZet('a', { world: 'travel', objectRef }).status, 403);
  assert.equal(e.resumeZet('a', { world: 'work', objectRef: { ...objectRef, id: 'vreemd' } }).status, 403);
  assert.equal(e.resumeZet('a', { world: 'work', objectRef,
    surface: '/apps/notities.html', navigationState: ['detail'] }).ok, true);
  h.taken.splice(0);
  const terug = e.bootstrap({ key: 'a', world: 'work' });
  assert.equal(terug.resume.reconciled, true);
  assert.equal(terug.resume.objectRef, null);
  assert.equal(terug.resume.surface, null);
  assert.deepEqual(terug.resume.navigationState, []);
});

test('onveilige of niet-canonieke surfaces en vrije tekst worden niet opgeslagen', () => {
  const h = huis(), e = h.experience;
  for (const surface of ['/apps/../secret.html', '/apps/%2e%2e/secret.html',
    '/apps/a//b.html', '/apps/./app.html', '/apps/a\\b.html', '//evil.test/apps/app.html',
    'https://evil.test/apps/app.html', '/apps/app.html/extra', '/apps/api?x=1',
    '/apps/' + 'a'.repeat(180) + '.html']) {
    assert.equal(e.resumeZet('a', { world: 'work', surface }).status, 400, surface);
  }
  for (const navigationState of [['Mijn persoonlijke tekst'], ['x'.repeat(65)],
    ['ok', {}], Array(9).fill('home'), 'home']) {
    assert.equal(e.resumeZet('a', { world: 'work', navigationState }).status, 400);
  }
  assert.equal(e.bootstrap({ key: 'a', world: 'work' }).resume, null);
});

test('echte HTTP-herstelketen behoudt contextisolatie en slaat geen URL-geheim op', async t => {
  const { startServer, stop } = require('./helper');
  const server = await startServer({ env: { SMTP_URL: '' } });
  t.after(() => stop(server.child));
  const post = async (pad, body, token) => {
    const r = await fetch(server.base + pad, { method: 'POST', headers: {
      'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {})
    }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  const geregistreerd = await post('/api/auth/register', { name: 'Continuity Lid',
    email: 'continuity@rtg.test', phone: '0612345678', password: 'geheim123',
    geboortedatum: '1990-01-01', tier: 'rtg' });
  const token = geregistreerd.body.token;
  assert.ok(token);
  const boot = await post('/api/experience/bootstrap', { world: 'work' }, token);
  assert.equal(boot.status, 200);
  const opgeslagen = await post('/api/experience/resume', { world: 'work',
    contextId: boot.body.currentContext.id, surface: '/apps/kantoor.html?token=geheim#privé',
    navigationState: ['attention'] }, token);
  assert.equal(opgeslagen.status, 200);
  assert.equal(opgeslagen.body.resume.surface, '/apps/kantoor.html');
  const terug = await post('/api/experience/bootstrap', {}, token);
  assert.equal(terug.body.currentWorld, 'work');
  assert.equal(terug.body.resume.reconciled, false);
  const ander = await post('/api/experience/bootstrap', { world: 'living' }, token);
  assert.equal(ander.body.resume.surface, null);
  assert.deepEqual(ander.body.resume.navigationState, []);
  assert.equal((await post('/api/experience/bootstrap', { world: 'work',
    contextId: 'ctx_vreemd' }, token)).status, 403);
  assert.equal((await post('/api/experience/resume', { world: 'work',
    surface: '/apps/../secret.html' }, token)).status, 400);
  assert.equal((await post('/api/experience/resume', { world: 'work' })).status, 401);
});
