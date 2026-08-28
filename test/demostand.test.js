/* De demo-stand hoort UIT te staan als niemand erom vraagt.

   WAT ER OPENSTOND, op de echte server, op het open internet:

   1. POST /api/login met {"tier":"business"} gaf ZONDER wachtwoord een volledige
      Business-sessie, op naam van de eigenaar.
   2. De backoffice ging open met de vaste code 'RTG-OFFICE', die letterlijk in
      deze repo staat. Achter die deur ligt de identiteitskluis: echte namen,
      e-mailadressen, paspoortscans.
   3. Bij ELKE serverstart zette de bootstrap het wachtwoord van het
      eigenaarsaccount terug op 'Imran', een waarde uit deze repo. De eigenaar
      kon daardoor niet meer inloggen met zijn eigen wachtwoord -- en iedereen
      die de code gelezen had, kon dat wel.

   Alle drie hingen aan hetzelfde: `NODE_ENV !== 'production'`. Het commentaar
   erboven beloofde dat dit "nooit per ongeluk open op productie" zou staan,
   maar de vlag was nooit gezet, dus stond alles open. Een belofte in een
   commentaar is geen slot.

   Nu staat het om: alleen RTG_DEMO=1 zet de demo-stand aan. Deze toetsen leggen
   de stand vast die een server heeft die NIETS weet -- want dat is de stand die
   op het internet stond. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startServer, stop } = require('./helper');
const testomgeving = require('../server/testomgeving');
const { demoAan } = require('../server/kern/demostand');

const post = (base) => async (pad, body) => {
  const r = await fetch(base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

/* Een server zonder RTG_DEMO: precies wat er draait als niemand iets instelt. */
async function kaleServer() {
  return startServer({ env: { SMTP_URL: '', RTG_DEMO: '', OFFICE_CODE: '' } });
}

test('de omgevingspoort is fail-closed en de echte seed is volledig leeg', () => {
  assert.equal(testomgeving.actief({ NODE_ENV: 'development', RTG_DEMO: '1' }), false,
    'de verouderde vlag mag buiten de testsuite niets openen');
  assert.equal(testomgeving.actief({ NODE_ENV: 'production', RTG_MAGNAAT_TEST: '1' }), false,
    'zelfs de nieuwe testvlag mag productie niet activeren');
  assert.equal(testomgeving.actief({ NODE_ENV: 'test', RTG_MAGNAAT_TEST: '1' }), true);

  const omgeving = { node: process.env.NODE_ENV, test: process.env.RTG_MAGNAAT_TEST, demo: process.env.RTG_DEMO };
  try {
    process.env.NODE_ENV = 'test';
    process.env.RTG_MAGNAAT_TEST = '1';
    delete process.env.RTG_DEMO;
    assert.equal(demoAan(), true, 'de luie wereldseeds volgen dezelfde Magnaat-testpoort als server.js');
    assert.ok(require('../server/seed')().partnerTrips.length > 0,
      'ook de centrale testseed volgt die poort; accounts zonder hun testwereld is een halve omgeving');
    process.env.NODE_ENV = 'production';
    assert.equal(demoAan(), false, 'ook de wereldseeds blijven in productie dicht');
  } finally {
    if (omgeving.node == null) delete process.env.NODE_ENV; else process.env.NODE_ENV = omgeving.node;
    if (omgeving.test == null) delete process.env.RTG_MAGNAAT_TEST; else process.env.RTG_MAGNAAT_TEST = omgeving.test;
    if (omgeving.demo == null) delete process.env.RTG_DEMO; else process.env.RTG_DEMO = omgeving.demo;
  }

  const oud = { node: process.env.NODE_ENV, test: process.env.RTG_MAGNAAT_TEST, demo: process.env.RTG_DEMO };
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.RTG_MAGNAAT_TEST;
    delete process.env.RTG_DEMO;
    const s = require('../server/seed')();
    for (const sleutel of ['suppliers', 'posts', 'partners', 'partnerTrips', 'invoices', 'contacts'])
      assert.deepEqual(s[sleutel], [], sleutel + ' moet echt leeg starten');
    assert.deepEqual(s.creatorCredit, {});
    assert.deepEqual(s.creatorLikes, {});
    assert.deepEqual(s.trip, { dest: '', dates: '', days: 0, items: [] });
    assert.deepEqual(s.livingLab, { labs: [], studies: [], themas: [], apparatuur: [], audit: [], paspoorten: [] });
    assert.deepEqual(s.muziekUitgaven, { lijst: [], reacties: {} });
  } finally {
    if (oud.node == null) delete process.env.NODE_ENV; else process.env.NODE_ENV = oud.node;
    if (oud.test == null) delete process.env.RTG_MAGNAAT_TEST; else process.env.RTG_MAGNAAT_TEST = oud.test;
    if (oud.demo == null) delete process.env.RTG_DEMO; else process.env.RTG_DEMO = oud.demo;
  }
});

test('zonder Magnaat Test geeft de oude snelle inlog geen sessie weg', async () => {
  const srv = await kaleServer();
  const p = post(srv.base);
  try {
    const h = await fetch(srv.base + '/api/health').then(r => r.json());
    assert.equal(h.omgeving, 'echt', 'de openbare omgevingsstatus zegt eerlijk dat dit de echte omgeving is');
    assert.equal(h.testomgeving, false);
    assert.equal(h.betalen, 'uit', 'zonder Stripe en zonder bewuste demo staat de betaalrail uit');
    for (const tier of ['business', 'lifestyle', 'rtg']) {
      const r = await p('/api/login', { tier });
      assert.notEqual(r.status, 200,
        'een pas-inlog zonder wachtwoord hoort te weigeren (' + tier + '): ' + JSON.stringify(r.body).slice(0, 140));
      assert.ok(!r.body.token, 'en zeker geen token af te geven');
    }
  } finally { stop(srv.child); }
});

test('zonder RTG_DEMO opent de vaste kantoorcode uit de repo niets', async () => {
  const srv = await kaleServer();
  const p = post(srv.base);
  try {
    const r = await p('/api/office/login', { code: 'RTG-OFFICE' });
    assert.notEqual(r.status, 200,
      'de code die in de broncode staat hoort de backoffice NIET te openen: ' + JSON.stringify(r.body).slice(0, 140));
    assert.ok(!r.body.token, 'en geen kantoorsessie af te geven');
  } finally { stop(srv.child); }
});

test('zonder RTG_DEMO blijft het wachtwoord van de eigenaar van de eigenaar', async () => {
  const srv = await kaleServer();
  const p = post(srv.base);
  try {
    /* Het eigenaarsadres uit server/eigenaar.js, met het demo-wachtwoord uit de
       repo. Lukt dit, dan heeft de opstart-bootstrap het wachtwoord van de
       eigenaar overschreven -- en kan iedereen die deze repo las naar binnen. */
    const r = await p('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'rtg' });
    assert.notEqual(r.status, 200,
      'het demo-wachtwoord uit de repo hoort nergens op te passen: ' + JSON.stringify(r.body).slice(0, 140));
  } finally { stop(srv.child); }
});

/* En de andere kant, want een slot dat altijd dichtzit is ook fout: met de vlag
   aan hoort de demo-stand gewoon te werken, anders kan niemand meer iets tonen. */
test('met RTG_MAGNAAT_TEST=1 werkt uitsluitend Magnaat Test', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_MAGNAAT_TEST: '1', RTG_DEMO: '' } });
  const p = post(srv.base);
  try {
    const h = await fetch(srv.base + '/api/health').then(r => r.json());
    assert.equal(h.omgeving, 'magnaat-test');
    assert.equal(h.testomgeving, true, 'de server benoemt de geïsoleerde testomgeving expliciet');
    assert.equal(h.betalen, 'magnaat-test',
      'de expliciete trainingsinstallatie gebruikt zichtbaar uitsluitend de Magnaat-testbetaalrail');
    const r = await p('/api/login', { tier: 'business' });
    assert.equal(r.status, 200, 'met de vlag aan hoort de demo-inlog te werken: ' + JSON.stringify(r.body).slice(0, 140));
    assert.ok(r.body.token, 'en een sessie te geven');
  } finally { stop(srv.child); }
});

test('alleen Magnaat kan de trainingskopie in de app activeren', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public', 'apps', 'app-main.js'), 'utf8');
  assert.match(bron, /magnaatProef = zoekParams\.get\('magnaat'\) === '1'/);
  assert.doesNotMatch(bron, /zoekParams\.get\('demo'\)|\?demo=1|const explicieteDemo/,
    'de echte app mag geen demo-query of generieke demostand meer kennen');
  assert.doesNotMatch(bron, /RTG-2026-0158|Villa Bahia Ibiza, Cala Jondal, 4 nachten/,
    'synthetische dossiers horen niet in de echte app-bundel');
});

test('de oude RTG_DEMO-vlag opent buiten de testsuite niets meer', async () => {
  const srv = await startServer({ env: { NODE_ENV: 'development', SMTP_URL: '', RTG_DEMO: '1', RTG_MAGNAAT_TEST: '' } });
  const p = post(srv.base);
  try {
    const h = await fetch(srv.base + '/api/health').then(r => r.json());
    assert.equal(h.omgeving, 'echt');
    assert.equal(h.testomgeving, false);
    const r = await p('/api/login', { tier: 'business' });
    assert.equal(r.status, 403, 'een oude demovlag mag geen echte snelle inlog meer openen');
  } finally { stop(srv.child); }
});
