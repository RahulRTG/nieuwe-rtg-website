'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

test.describe('PersonalOS verticale keten', () => {
  let srv, base, tokenA, tokenA2, tokenB, laatsteDoelenA = ['ondernemen'];
  const post = async (pad, body, token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const registreer = async naam => {
    const n = Math.random().toString(36).slice(2, 10);
    const email = 'personalos-' + n + '@toets.example', password = 'geheim123';
    const r = await post('/api/auth/register', { name: naam, email,
      phone: '06' + String(Date.now()).slice(-8), password, geboortedatum: '1990-01-01',
      tier: 'rtg', pasApp: 'rtg' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return { token: r.body.token, email, password };
  };

  test.before(async () => {
    srv = await startServer({ env: { SMTP_URL: '' } }); base = srv.base;
    const a = await registreer('PersonalOS A'), b = await registreer('PersonalOS B');
    tokenA = a.token; tokenB = b.token;
    const opnieuw = await post('/api/auth/login', { login: a.email, password: a.password, pasApp: 'rtg' });
    assert.equal(opnieuw.status, 200, JSON.stringify(opnieuw.body));
    tokenA2 = opnieuw.body.token;
  });
  test.after(() => stop(srv && srv.child));

  test('openbare preview geeft compositie maar geen bevoegdheidsclaim', async () => {
    const input = { goals: ['ondernemen', 'reizen'], layout: 'simple' };
    const a = await post('/api/personalos/preview', input);
    const b = await post('/api/personalos/preview', input);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(a.body.authorizationClaim, false);
    assert.equal(a.body.composition.authorityRevision, 'not_evaluated');
    assert.equal(a.body.composition.compositionVersion, b.body.composition.compositionVersion);
  });

  test('voorkeuren worden idempotent opgeslagen en gevoelige extra velden niet', async () => {
    const input = { goals: ['ondernemen'], layout: 'balanced', pinnedCapabilities: ['onderneming'],
      medicalDiagnosis: 'niet opslaan', contextRef: 'zaak-van-een-ander' };
    const een = await post('/api/personalos/complete', input, tokenA);
    const twee = await post('/api/personalos/complete', input, tokenA);
    assert.equal(een.status, 200, JSON.stringify(een.body));
    assert.equal(een.body.changed, true);
    assert.equal(twee.body.changed, false);
    assert.equal(twee.body.preferences.revision, een.body.preferences.revision);
    assert.equal(twee.body.preferences.medicalDiagnosis, undefined);
    assert.equal(twee.body.preferences.contextRef, undefined);
  });

  test('twee apparaten gebruiken preferenceVersion en een verouderde respons overschrijft niets', async () => {
    const gelezen = await post('/api/personalos/preferences', {}, tokenA2);
    assert.equal(gelezen.status, 200, JSON.stringify(gelezen.body));
    const versie = gelezen.body.preferences.revision;
    const nieuw = await post('/api/personalos/complete', { goals: ['ondernemen'], layout: 'advanced',
      pinnedCapabilities: ['onderneming'], preferenceVersion: versie }, tokenA);
    assert.equal(nieuw.status, 200, JSON.stringify(nieuw.body));
    assert.equal(nieuw.body.preferences.revision, versie + 1);
    const oud = await post('/api/personalos/complete', { goals: ['reizen'], layout: 'simple',
      preferenceVersion: versie }, tokenA2);
    assert.equal(oud.status, 409, JSON.stringify(oud.body));
    assert.equal(oud.body.conflict, true);
    assert.equal(oud.body.currentPreferences.revision, versie + 1);
    const na = await post('/api/personalos/preferences', {}, tokenA2);
    assert.deepEqual(na.body.preferences.goals, ['ondernemen']);
    assert.equal(na.body.preferences.layout, 'advanced');

    const raceVersie = na.body.preferences.revision;
    const race = await Promise.all([
      post('/api/personalos/complete', { goals: ['reizen'], layout: 'simple', preferenceVersion: raceVersie }, tokenA),
      post('/api/personalos/complete', { goals: ['bijdragen'], layout: 'balanced', preferenceVersion: raceVersie }, tokenA2)
    ]);
    assert.deepEqual(race.map(x => x.status).sort(), [200, 409], 'precies één gelijktijdige schrijver wint');
    const winnaar = race.find(x => x.status === 200).body.preferences;
    laatsteDoelenA = winnaar.goals;
    const raceNa = await post('/api/personalos/preferences', {}, tokenA);
    assert.equal(raceNa.body.preferences.revision, raceVersie + 1);
    assert.deepEqual(raceNa.body.preferences.goals, winnaar.goals);
  });

  test('compositie komt uit de accountsessie en blijft tussen accounts gescheiden', async () => {
    await post('/api/personalos/complete', { goals: ['talent_ontwikkelen'], pinnedCapabilities: ['podium'] }, tokenB);
    const a = await post('/api/personalos/composition', { contextRef: 'gespoofd' }, tokenA);
    const b = await post('/api/personalos/composition', {}, tokenB);
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.notEqual(a.body.composition.subjectRef, b.body.composition.subjectRef);
    assert.notEqual(a.body.composition.contextRef, 'gespoofd');
    assert.deepEqual(a.body.composition.goals, laatsteDoelenA);
    assert.deepEqual(b.body.composition.goals, ['talent_ontwikkelen']);
    assert.equal(a.body.composition.catalogComplete, false);
    assert.ok(a.body.composition.accessibility);
  });

  test('ongeldige of onbevoegde invoer faalt en auth blijft verplicht', async () => {
    assert.equal((await post('/api/personalos/complete', { goals: ['kwetsbaar'] }, tokenA)).status, 400);
    const pref = await post('/api/personalos/preferences', {}, tokenA);
    assert.equal((await post('/api/personalos/complete', { pinnedCapabilities: ['werkos'],
      preferenceVersion: pref.body.preferences.revision }, tokenA)).status, 200,
      'opslaan is een voorkeur; de Authority Adapter beslist pas wat toonbaar is');
    const c = await post('/api/personalos/composition', {}, tokenA);
    assert.ok(!c.body.composition.worlds.flatMap(w => w.capabilities).some(x => x.id === 'werkos'));
    assert.equal((await post('/api/personalos/composition', {})).status, 401);
  });
});
