/* Echte HTTP-grens: gratis persoon -> uitnodiging -> huidige werkrelatie ->
   werkgeversrit -> menselijk akkoord. Geen betaalfixture voor de werknemer.
   De bestaande MKKX-werkgever houdt zijn centrale zaakabonnement; contracteinde
   en betaalherstel zijn apart met echte contractlogica zuiver beproefd. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stopHard } = require('./helper');

test('gratis werknemer mag alleen namens de actuele werkgever aanvragen; eigen nazorg blijft bereikbaar', async t => {
  const datamap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mob-werkrecht-'));
  let srv;
  t.after(async () => { await stopHard(srv && srv.child); fs.rmSync(datamap, { recursive: true, force: true }); });
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: datamap, RTG_AI_UIT: '1' } });
  async function api(pad, body = {}, token) {
    const r = await fetch(srv.base + pad, { method: 'POST', headers: {
      'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  }
  async function goed(pad, body, token) {
    const r = await api(pad, body, token);
    assert.equal(r.status, 200, pad + ': ' + JSON.stringify(r.body));
    return r.body;
  }
  async function gratis(n) {
    const email = 'werkgrens' + n + '@example.test';
    const r = await goed('/api/auth/register', { name: 'Werkgrens ' + n, email,
      phone: '061234560' + n, password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v' });
    assert.equal(r.state.user.tier, 'guest', 'werken maakt geen betaald lid');
    return { token: r.token, email };
  }
  const werknemer = await gratis(1), vreemde = await gratis(2);
  const roster = await goed('/api/supplier/roster', { code: 'MKKX' });
  const manager = roster.staff.find(s => s.role === 'manager');
  assert.ok(manager, 'bestaande manager van de werkgever');
  const baas = (await goed('/api/supplier/login', { code: 'MKKX', staffId: manager.id, pin: '1234' })).token;
  const inv = await goed('/api/supplier/staff/invite', { name: 'Nora Werkgrens', role: 'staff' }, baas);
  const plek = await goed('/api/supplier/staff/join', { bedrijf: 'Ibiza Executive Cars',
    kassacode: inv.invite.kassacode, login: werknemer.email, password: 'geheim123', pin: '4321' });
  const medewerker = (await goed('/api/supplier/login', { code: 'MKKX', staffId: plek.staffId, pin: '4321' })).token;
  const aanvraag = extra => ({ ritsoort: 'direct', categorie: 'taxi', stad: 'Ibiza',
    van: { lat: 38.908, lng: 1.432, label: 'Werk' }, naar: { lat: 38.978, lng: 1.536, label: 'Luchthaven' },
    namensOrganisatie: 'MKKX', betaler: 'organisatie', ...extra });

  assert.equal((await api('/api/mob/vraag', aanvraag({ betaler: 'reiziger' }), werknemer.token)).status, 403);
  assert.equal((await api('/api/mob/vraag', aanvraag({ namensOrganisatie: 'HOSHI' }), werknemer.token)).status, 403);
  assert.equal((await api('/api/mob/vraag', aanvraag({ key: 'user-1', account: { id: 1 },
    staffId: plek.staffId, tier: 'business', manager: true }), vreemde.token)).status, 403);
  for (const org of ['', {}, 'MKKX'.padEnd(21, 'X')])
    assert.equal((await api('/api/mob/vraag', aanvraag({ namensOrganisatie: org }), werknemer.token)).status, 400);
  assert.deepEqual((await goed('/api/mob/mijn', {}, werknemer.token)).ritten, []);

  await goed('/api/supplier/mob/beleid', { zet: true, maxPrijs: 1 }, baas);
  const duur = await api('/api/mob/vraag', aanvraag(), werknemer.token);
  assert.equal(duur.status, 403); assert.match(duur.body.error, /maximum per rit/);
  await goed('/api/supplier/mob/beleid', { zet: true, maxPrijs: 0, goedkeuringVanaf: 500 }, baas);
  const rit = (await goed('/api/mob/vraag', aanvraag({ namensOrganisatie: ' mkkx ' }), werknemer.token)).opdracht;
  assert.equal(rit.organisatie, 'MKKX'); assert.equal(rit.betaler.soort, 'organisatie');
  assert.equal(rit.goedkeuring.status, 'wacht');
  const ref = rit.ref;
  assert.equal((await api('/api/supplier/mob/akkoord', { ref, akkoord: true, manager: true }, medewerker)).status, 403);
  assert.equal((await goed('/api/mob/mijn', {}, werknemer.token)).lopend.goedkeuring.status, 'wacht');
  await goed('/api/supplier/mob/akkoord', { ref, akkoord: true }, baas);
  assert.equal((await goed('/api/mob/mijn', {}, werknemer.token)).lopend.goedkeuring.status, 'akkoord');

  for (const [pad, body] of [['/api/mob/volg', { ref }], ['/api/mob/annuleer', { ref }],
    ['/api/mob/ontvangst', { ref, wat: 'aankomst' }],
    ['/api/mob/ontvangst/probleem', { ref, soort: 'andere-chauffeur' }]]) {
    const r = await api(pad, { ...body, key: 'user-1', namensOrganisatie: 'MKKX', staffId: plek.staffId }, vreemde.token);
    assert.equal(r.status, 403, pad + ' bewaakt de eigenaar');
  }
  assert.equal((await api('/api/mob/volg', { ref: 'ONBEKEND' }, vreemde.token)).status, 404);
  assert.deepEqual((await goed('/api/mob/mijn', {}, vreemde.token)).ritten, []);
  assert.equal((await api('/api/mob/aanbod', {}, werknemer.token)).status, 403);
  assert.equal((await api('/api/mob/favoriet', { lijst: true }, werknemer.token)).status, 403);

  await goed('/api/supplier/staff/remove', { staffId: plek.staffId }, baas);
  assert.equal((await api('/api/mob/vraag', aanvraag(), werknemer.token)).status, 403, 'intrekking werkt direct');
  const eigen = await goed('/api/mob/mijn', {}, werknemer.token);
  assert.equal(eigen.ritten.length, 1); assert.equal(eigen.lopend.ref, ref); assert.deepEqual(eigen.favorieten, []);
  assert.equal((await goed('/api/mob/volg', { ref }, werknemer.token)).opdracht.ref, ref);
  const vroeg = await api('/api/mob/ontvangst', { ref, wat: 'aankomst' }, werknemer.token);
  assert.equal(vroeg.status, 409, 'eigen toegang behoudt de echte aankomstvoorwaarde');
  assert.match(vroeg.body.error, /nog geen aankomst/);
  assert.equal((await goed('/api/mob/ontvangst/probleem', { ref, soort: 'andere-chauffeur' }, werknemer.token)).gewijzigd, true);
  await goed('/api/mob/annuleer', { ref, reden: 'Werkrelatie beëindigd' }, werknemer.token);
  assert.equal((await goed('/api/mob/volg', { ref }, werknemer.token)).opdracht.status, 'geannuleerd');
  assert.equal((await api('/api/mob/vraag', aanvraag({ betaler: 'reiziger' }), werknemer.token)).status, 403);
});
