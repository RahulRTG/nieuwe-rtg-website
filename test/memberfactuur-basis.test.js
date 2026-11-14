/* Echte HTTP/auth/account/factuur/betaalwaarheid-keten met lokale nep-Stripe.
   Historische accounts en facturen ontstaan voor serverstart via accounts-code
   in wegwerpdata, niet via registratie of een productbypass. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { startServer, stopNet } = require('./helper');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-factuur-basis-'));
const secret = 'whsec_factuur_basis_synthetisch';
const intents = new Map(), sleutels = new Map();
let srv, base, provider, providerUrl, gestart = 0, fixtures;

function zaaiBestaandeDossiers() {
  const code = `
    const assert = require('node:assert/strict');
    const accounts = require('./server/accounts');
    accounts.init();
    const uit = {};
    for (const [naam, tier] of [
      ['gratis', 'guest'], ['ander', 'rtg'], ['terug', 'rtg'], ['verlopen', 'rtg']
    ]) {
      const email = 'factuur-basis-' + naam + '@example.test';
      const user = accounts.createUserSync({
        email, tier, realName: 'Synthetische factuur ' + naam, password: 'proefwachtwoord123'
      });
      const invoice = { id: 'RTG-BASIS-' + naam.toUpperCase(),
        desc: 'Bestaande factuur dienstverlening', netto: 0, bijdrage: 12.10,
        status: 'open', date: 'Vervalt 1 december 2026' };
      accounts.saveMemberState(user.id, { geboren: '1990-01-01', invoices: [invoice],
        trip: null, creatorCredit: 0, creatorLikes: 0 });
      assert.equal(accounts.getMemberState(user.id).invoices[0].id, invoice.id);
      uit[naam] = { id: user.id, email, invoice };
    }
    const dbm = require('./server/db');
    dbm.load();
    const contracten = require('./server/kern/commercie/contract')
      .maakContracten({ db: dbm.db, save: dbm.save, nu: () => Date.now() });
    const aanvraagId = 'fixture-bestaand-contract';
    const c = contracten.open({ pas: 'rtg', aanmeldingId: aanvraagId,
      startAt: new Date().toISOString(), afgesprokenCenten: 1000, minimumMaanden: 12,
      door: 'synthetische historische fixture' });
    for (const r of [contracten.bied(c), contracten.accepteer(c, 1000),
      contracten.activeer(c), contracten.zegOp(c)]) assert.equal(r.ok, true);
    (dbm.db.data.aanmeldingen ||= []).push({ id: aanvraagId, accountId: uit.verlopen.id,
      pas: 'rtg', status: 'geaccepteerd', at: c.startAt,
      besluit: { at: c.startAt, door: 'synthetische historische fixture' } });
    (dbm.db.data.lidmaatschapBetalingen ||= []).push({ aanmeldingId: aanvraagId,
      contractId: c.id, pas: 'rtg', gestart: c.startAt, termijnen: [] });
    assert.equal(dbm.saveDuurzaam().duurzaam, true); accounts.checkpoint();
    process.stdout.write('FIXTURE=' + JSON.stringify(uit) + '\\n');
  `;
  const r = spawnSync(process.execPath, ['-e', code], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 30000,
    env: { ...process.env, NODE_ENV: 'test', RTG_DATA_DIR: dir, RTG_STORE: 'sqlite',
      DATABASE_URL: '', PG_URL: '', RTG_MAGNAAT_TEST: '1', RTG_KLOK: '' }
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const regel = r.stdout.split('\n').find(x => x.startsWith('FIXTURE='));
  assert.ok(regel, r.stdout);
  return JSON.parse(regel.slice('FIXTURE='.length));
}

async function api(pad, body, token) {
  return fetch(base + pad, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {})
  }, body: JSON.stringify(body || {}) });
}
async function json(pad, body, token) {
  const r = await api(pad, body, token);
  return { status: r.status, headers: r.headers, body: await r.json() };
}
async function start(extra = {}) {
  srv = await startServer({ env: {
    RTG_DATA_DIR: dir, RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', RTG_KLOK: '',
    SMTP_URL: '', RTF_IBAN: '', RTF_LOKAAL: '', RTG_BETALEN_UIT: '0',
    STRIPE_UITGAAND_UIT_BEWUST: '1', STRIPE_SECRET_KEY: 'sk_test_factuur_basis',
    STRIPE_WEBHOOK_SECRET: secret, STRIPE_BASE_URL: providerUrl,
    MOLLIE_API_KEY: '', ADYEN_API_KEY: '', ...extra
  } });
  base = srv.base;
}
async function bestaandLid(naam) {
  const fixture = fixtures[naam];
  const r = await json('/api/auth/login', {
    login: fixture.email, password: 'proefwachtwoord123', pasApp: 'rtg'
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.state.user.id, fixture.id);
  assert.ok(r.body.token);
  return { ...fixture, token: r.body.token };
}
async function pdf(pad, body, token) {
  const r = await api(pad, body, token);
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  const tekst = Buffer.from(await r.arrayBuffer()).toString('latin1');
  assert.ok(tekst.startsWith('%PDF-1.4'));
  return tekst;
}

async function betaalEigen(lid) {
  const voor = gestart;
  const document = () => pdf('/api/factuur', { invoiceId: lid.invoice.id }, lid.token);
  const eigenStaat = async () => {
    const r = await json('/api/state', { accountId: fixtures.ander.id }, lid.token);
    assert.equal(r.status, 200);
    assert.equal(r.body.state.user.id, lid.id);
    assert.equal(r.body.state.user.tier, 'guest');
    assert.deepEqual(r.body.state.invoices.map(x => x.id), [lid.invoice.id]);
    return r.body.state.invoices[0];
  };
  assert.equal((await eigenStaat()).status, 'open');
  assert.match(await document(), /Status: Openstaand/);
  const r = await json('/api/pay', { invoiceId: lid.invoice.id }, lid.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.pending, true, 'klantactie is nog geen betaalbewijs');
  const w = r.body.intents[0];
  const herhaald = await json('/api/pay', { invoiceId: lid.invoice.id }, lid.token);
  assert.equal(herhaald.status, 200, JSON.stringify(herhaald.body));
  assert.equal(herhaald.body.intents[0].betalingId, w.betalingId);
  assert.equal(gestart, voor + 1, 'geen tweede providerbetaling');
  assert.match(await document(), /Status: Openstaand/);
  assert.equal((await eigenStaat()).status, 'open');
  const p = [...intents.values()].find(x => x.metadata.referentie === w.betalingId);
  assert.ok(p);
  const evt = { id: 'evt_' + p.id, type: 'payment_intent.succeeded',
    data: { object: { ...p, status: 'succeeded', amount_received: p.amount } } };
  const body = JSON.stringify(evt), t = Math.floor(Date.now() / 1000);
  const melding = signature => fetch(base + '/api/betaal/webhook', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': signature }, body });
  assert.equal((await melding('t=' + t + ',v1=ongeldig')).status, 400);
  assert.match(await document(), /Status: Openstaand/, 'vervalste melding betaalt niets');
  assert.equal((await eigenStaat()).status, 'open');
  const sig = crypto.createHmac('sha256', secret).update(t + '.' + body).digest('hex');
  for (let i = 0; i < 2; i++) {
    const bericht = await melding('t=' + t + ',v1=' + sig);
    assert.equal(bericht.status, 200, await bericht.text());
  }
  assert.match(await document(), /Status: Betaald/);
  const betaald = await eigenStaat();
  assert.equal(betaald.status, 'paid');
  assert.equal(betaald.betaalBewijzen.length, 1, 'providerbevestiging telt eenmaal');
  assert.equal((await api('/api/pay', { invoiceId: lid.invoice.id }, lid.token)).status, 409);
  assert.equal(gestart, voor + 1, 'geen extra betaalstart na webhook-replay');
}

test.before(async () => {
  fixtures = zaaiBestaandeDossiers();
  provider = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    let p;
    if (req.method === 'POST' && req.url === '/v1/payment_intents') {
      const key = req.headers['idempotency-key']; p = sleutels.get(key);
      if (!p) {
        const b = new URLSearchParams(raw);
        p = { id: 'pi_basis_' + (++gestart), status: 'requires_action',
          client_secret: 'synthetisch', amount: Number(b.get('amount')),
          currency: b.get('currency'), metadata: { referentie: b.get('metadata[referentie]') } };
        intents.set(p.id, p); sleutels.set(key, p);
      }
    } else if (req.method === 'GET') p = intents.get(req.url.split('/').pop());
    res.writeHead(p ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(p || { error: { message: 'Geen synthetische betaalroute.' } }));
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  providerUrl = 'http://127.0.0.1:' + provider.address().port;
  await start();
});
test.after(async () => {
  if (srv) await stopNet(srv.child);
  if (provider) await new Promise(resolve => provider.close(resolve));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('gratis eigen account: eigen documenten en betaling, geen vreemde factuur', async () => {
  const gratis = await bestaandLid('gratis'), ander = await bestaandLid('ander');
  const tekst = await pdf('/api/facturen/overzicht', { accountId: ander.id }, gratis.token);
  assert.ok(tekst.includes(gratis.invoice.id)); assert.ok(!tekst.includes(ander.invoice.id));
  const voor = gestart;
  for (const pad of ['/api/pay', '/api/factuur']) {
    const r = await api(pad, { invoiceId: ander.invoice.id, accountId: ander.id,
      ref: ander.invoice.id, own: true }, gratis.token);
    assert.equal(r.status, 404, pad + ' zoekt uitsluitend in het eigen account');
  }
  assert.equal(gestart, voor);
  await betaalEigen(gratis);
  assert.equal((await api('/api/pay', { all: true, accountId: ander.id }, gratis.token)).status, 409);
  const vreemd = await json('/api/state', {}, ander.token);
  assert.equal(vreemd.body.state.invoices.find(x => x.id === ander.invoice.id).status, 'open');
});

test('na vrijwillige downgrade blijven eigen factuur en betaling bereikbaar', async () => {
  const lid = await bestaandLid('terug');
  const r = await json('/api/mijn/pas/gast', { wanneer: 'nu' }, lid.token);
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.naar, 'guest');
  const login = await json('/api/auth/login', {
    login: lid.email, password: 'proefwachtwoord123', pasApp: 'rtg'
  });
  assert.equal(login.status, 200, JSON.stringify(login.body)); lid.token = login.body.token;
  assert.equal(login.body.state.user.tier, 'guest');
  assert.ok((await pdf('/api/factuur', { invoiceId: lid.invoice.id }, lid.token)).includes(lid.invoice.id));
  assert.ok((await pdf('/api/facturen/overzicht', {}, lid.token)).includes(lid.invoice.id));
  await betaalEigen(lid);
});

test('anonieme en demo-gastsessies houden geen factuur- of betaaltoegang', async () => {
  const gast = (await json('/api/login', { tier: 'guest' })).body.token; assert.ok(gast);
  const state = await json('/api/state', {}, gast);
  assert.equal(state.status, 200); assert.deepEqual(state.body.state.invoices, []);
  const voor = gestart;
  for (const pad of ['/api/pay', '/api/factuur', '/api/facturen/overzicht']) {
    assert.equal((await api(pad, { all: true }, gast)).status, 403, pad);
    assert.equal((await api(pad, { all: true })).status, 401, pad);
  }
  assert.equal(gestart, voor);
});

test('contract verlopen: dezelfde bearer houdt eigen facturen, geen betaalde diensten', async () => {
  const lid = await bestaandLid('verlopen');
  const voor = await json('/api/state', {}, lid.token);
  assert.equal(voor.body.state.user.tier, 'rtg'); assert.equal(voor.headers.get('rtg-contract'), null);
  await stopNet(srv.child); srv = null;
  await start({ RTG_KLOK: '+400d' });
  const na = await json('/api/state', {}, lid.token);
  assert.equal(na.status, 200); assert.equal(na.headers.get('rtg-contract'), 'geeindigd');
  assert.equal(na.body.state.user.tier, 'guest', 'persona overschrijft effectieve tier niet');
  assert.deepEqual(na.body.state.invoices.map(x => x.id), [lid.invoice.id]);
  assert.equal(na.body.state.trip, undefined);
  assert.equal((await api('/api/vak/offerte/vraag', {}, lid.token)).status, 403);
  await betaalEigen(lid);
});
