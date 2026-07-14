/* End-to-end tests voor het content-creator-genre (kern/creator.js): het
   carriere-profiel, platforms met bereik, tarieven, de content-kalender en de AI
   content/script-helper (zonder Claude-sleutel via de sjablonen). De demo-creator
   is LUMINA. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

let srv, base, creator;

test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-creator-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, DEMO_SUPPLIER: 'LUMINA' } });
  base = srv.base;
  const login = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  creator = { token: login.body.token, code: login.body.state.supplier.code };
  assert.equal(creator.code, 'LUMINA', 'de demo-leverancier is de creator LUMINA');
});
test.after(() => stop(srv && srv.child));

function overzicht() { return api(base, '/api/supplier/creator/overzicht', {}, creator.token).then(r => r.body); }

test('1. de geseede creator heeft een profiel, platforms met bereik en tarieven', async () => {
  const o = await overzicht();
  assert.ok(o.niche && o.platforms.length >= 3, 'profiel + platforms geseeded');
  assert.ok(o.stats.bereik > 100000, 'totaal bereik is de som van de volgers');
  assert.ok(o.tarieven.length >= 3 && o.soortkeuze.includes('reel'), 'tarieven + keuzes');
});

test('2. profiel, platform en tarief bewerken', async () => {
  let o = (await api(base, '/api/supplier/creator/profiel', { niche: 'Food & drinks', bio: 'Culinaire content.' }, creator.token)).body;
  assert.equal(o.niche, 'Food & drinks');
  o = (await api(base, '/api/supplier/creator/platform', { platform: 'x', handle: '@lumina', volgers: 5000 }, creator.token)).body;
  assert.ok(o.platforms.some(p => p.platform === 'x' && p.volgers === 5000), 'platform toegevoegd');
  o = (await api(base, '/api/supplier/creator/tarief', { soort: 'livestream', prijs: 1200 }, creator.token)).body;
  assert.ok(o.tarieven.some(t => t.soort === 'livestream' && t.prijs === 1200), 'tarief toegevoegd');
});

test('3. content-kalender: idee toevoegen en de status doorschuiven', async () => {
  let o = (await api(base, '/api/supplier/creator/idee', { tekst: 'Beste tapas van Ibiza', voor: '2026-08-01' }, creator.token)).body;
  const idee = o.ideeen.find(i => i.tekst === 'Beste tapas van Ibiza');
  assert.ok(idee && idee.status === 'idee', 'idee staat op de kalender');
  o = (await api(base, '/api/supplier/creator/idee', { id: idee.id, status: 'productie' }, creator.token)).body;
  assert.equal(o.ideeen.find(i => i.id === idee.id).status, 'productie', 'status doorgeschoven');
});

test('4. de AI content-helper geeft een script en voegt ideeen toe zonder Claude', async () => {
  const script = await api(base, '/api/supplier/creator/ai', { opdracht: 'Schrijf een script voor een reel over een strandclub' }, creator.token);
  assert.equal(script.status, 200);
  assert.ok(/HOOK|script|CALL-TO-ACTION/i.test(script.body.antwoord), 'er komt een script terug');
  const ideeen = await api(base, '/api/supplier/creator/ai', { opdracht: 'geef me 5 ideeen' }, creator.token);
  assert.ok(/ideeen|idee/i.test(ideeen.body.antwoord), 'ideeen worden gegeven');
  // opdracht die iets DOET: idee op de kalender zetten
  const doe = await api(base, '/api/supplier/creator/ai', { opdracht: 'voeg idee Zonsopgang yoga op het strand toe' }, creator.token);
  assert.equal(doe.body.gedaan, true, 'de AI voerde de opdracht uit');
  assert.ok(doe.body.overzicht.ideeen.some(i => /yoga/i.test(i.tekst)), 'het idee staat echt op de kalender');
});

test('5. een niet-creator krijgt 409 op de creator-endpoints', async () => {
  // een boer-account mag hier niet in
  const boerSrv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cr2-')), DEMO_SUPPLIER: 'CANFERRER' } });
  const blog = await api(boerSrv.base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  const r = await api(boerSrv.base, '/api/supplier/creator/overzicht', {}, blog.body.token);
  assert.equal(r.status, 409, 'geen creator-account = 409');
  stop(boerSrv.child);
});
