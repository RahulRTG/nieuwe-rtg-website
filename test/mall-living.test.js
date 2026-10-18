/* De Living Mall is één leesprojectie over echte RTG-bronnen. Deze toetsen
   bewijzen dat zij geen tweede productcatalogus of uitvoeringspad wordt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');
const projectie = require('../server/kern/mall/levende-etalage');

function api(base, route, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  return fetch(base + route, { method: 'POST', headers, body: JSON.stringify(body || {}) })
    .then(async response => ({ status: response.status, body: await response.json().catch(() => ({})) }));
}

test('de projectie houdt bron, uitvoeringsactie en commerciële grens intact', () => {
  const data = projectie.projecteerLivingMall({
    apps: [{ id: 'a', naam: 'Agenda', uitleg: 'Plan uw dag.', wereld: 'rtg', categorieLabel: 'Werk', ledenprijsCenten: 0, url: '/apps/agenda.html' }],
    installedApps: [],
    ownProducts: [{ slug: 'dock', naam: 'RTG Dock', beschrijving: 'Een vaste plek.', eenmalig: 500, perMaand: 0, eenheid: 'per stuk', discipline: 'Work' }],
    aanbod: [{ id: 'reis:1', type: 'reis', verdieping: 'reizen', titel: 'Ibiza', uitleg: 'Een reis.', aanbieder: { soort: 'rtg', naam: 'RTG Travel' }, beschikbaar: { uit: false, tekst: 'Beschikbaar' }, prijs: { bedrag: 900, valuta: 'EUR' }, cta: 'Reis aanvragen', pagina: '/apps/reizen.html', bron: 'reisbureau' }],
    supplierGroups: [{ type: 'hotel', label: 'Hotels', aantal: 1, pagina: '/apps/thuis.html', leveranciers: [{ code: 'H1', naam: 'Maison Un', stad: 'Amsterdam' }] }]
  });
  assert.equal(data.projection, 'rtg.mall.living');
  assert.equal(data.version, 1);
  assert.equal(data.items.length, 3);
  assert.deepEqual(data.items.map(item => item.source.kind), ['app-library', 'rtg-own-catalog', 'reisbureau']);
  assert.deepEqual(data.items.map(item => item.action.type), ['INSTALL', 'ORDER', 'NAVIGATE']);
  assert.deepEqual(data.items[0].worlds, ['work'], 'software wordt aan haar inhoudelijke wereld gekoppeld');
  assert.equal(data.supplierGroups[0].suppliers[0].code, 'H1');
  assert.deepEqual(data.rules, {
    readOnlyProjection: true,
    domainOwnsExecution: true,
    commercialRightsAreNotAuthorization: true,
    partnerStatusIsNotQualityJudgement: true
  });
});

let server, base, member;
test.before(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mall-living-'));
  server = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: tmp } });
  base = server.base;
  const registration = await api(base, '/api/auth/register', {
    name: 'Living Mall Lid', email: 'living-mall@x.nl', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  member = registration.body.token;
  assert.ok(member);
});
test.after(() => stop(server && server.child));

test('de Living Mall vereist een sessie en projecteert alle drie bestaande bronsoorten', async () => {
  assert.equal((await api(base, '/api/mall/living', {})).status, 401);
  const response = await api(base, '/api/mall/living', {}, member);
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.projection, 'rtg.mall.living');
  assert.ok(response.body.sources.software > 0, 'software uit de App-Bibliotheek');
  assert.ok(response.body.sources.hardware > 0, 'hardware uit de eigen catalogus');
  assert.ok(response.body.sources.offers > 0, 'actueel aanbod uit de Mall');
  assert.ok(response.body.supplierGroups.length > 0, 'de dynamische leveranciersgids is aangesloten');
  assert.ok(response.body.items.some(item => item.source.kind === 'app-library'));
  assert.ok(response.body.items.some(item => item.source.kind === 'rtg-own-catalog'));
  assert.ok(response.body.items.some(item => item.provider && item.provider.code), 'partneraanbod behoudt de broncode voor reviews');
});

test('installeren via de bestaande App-Bibliotheek verandert dezelfde projectie', async () => {
  const before = await api(base, '/api/mall/living', {}, member);
  const app = before.body.items.find(item => item.action && item.action.type === 'INSTALL');
  assert.ok(app, 'er is een echte installeerbare app');
  const installed = await api(base, '/api/mall/apps/installeer', { id: app.action.appId }, member);
  assert.equal(installed.status, 200);
  const after = await api(base, '/api/mall/living', {}, member);
  const same = after.body.items.find(item => item.id === app.id);
  assert.equal(same.state, 'ACTIVE');
  assert.equal(same.action.type, 'OPEN');
  assert.equal(same.action.href, installed.body.app.url);
});

test('de voorzijde gebruikt de standaard Edge en houdt de volledige bestaande Mall bereikbaar', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'mall.html'), 'utf8');
  const experience = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'mall-experience.js'), 'utf8');
  const front = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'winkel-voorzijde.js'), 'utf8');
  assert.match(html, /id="mallEdgeControls"/);
  assert.match(html, /id="mallCompleteTrigger"/);
  assert.doesNotMatch(experience, /RTGAdaptiveEdge\.mountSurface/);
  assert.match(experience, /els\.edge\.hidden = true/);
  assert.match(experience, /\/api\/mall\/apps\/installeer/);
  assert.match(experience, /\/api\/mall\/bewaar/);
  const view = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'mall-experience-view.js'), 'utf8');
  assert.match(view, /\/api\/reviews/);
  assert.match(front, /!d\.body\.classList\.contains\('rtg-mall-living'\)/,
    'de oude winkelbalk wordt niet naast de standaard Edge geplaatst');
});
