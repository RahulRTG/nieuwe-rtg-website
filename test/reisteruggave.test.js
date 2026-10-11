'use strict';
/* EEN AFGEZEGDE BETAALDE REIS KRIJGT ZIJN GELD TERUG -- door een mens op naam.

   Twee defecten uit Fase 0 (4 oktober 2026). D9: wie een BETAALDE reis afzegde,
   kreeg "niet via RTG betaald" in het dossier en er ontstond geen recht. D8: een
   teruggaverecht stond klaar met "een mens voert hem uit langs kern/pay", en er
   was geen deur om dat te doen.

   Besluit van de eigenaar: altijd een passkey, onder duizend euro een mens,
   vanaf duizend euro een tweede mens via de bestaande tweede handtekening.

   Het vier-ogenpad draait op een echte server: alle reizen in de zaaiset kosten
   meer dan duizend euro. Het pad eronder draait met een nagemaakte context
   (onderaan), want de enige weg naar een kleiner recht -- een gedeeltelijke
   terugboeking -- vraagt rij-id's die geen route toont. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorKoppelBody, keurLidGoed, kantoorAlsPersoon } = require('./helper');
const { kantoorPasskey } = require('./kantoorpasskey');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisteruggave-'));
const CODE = 'REIS-TERUGGAVE-1';
let srv, base, pk;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const telefoon = () => '06' + String(10000000 + Math.floor(Math.random() * 8e7));

async function medewerker(merk) {
  const u = (Date.now() + merk * 7919).toString(36) + merk;
  const reg = await api('/api/auth/register', { name: 'Reisbalie ' + merk, email: 'rt' + u + '@voorbeeld.test',
    phone: telefoon(), password: 'Geheim123!', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, 'medewerker ' + merk + ' geregistreerd');
  const kop = await api('/api/account/koppel', await kantoorKoppelBody(base, reg.body.token), reg.body.token);
  assert.equal(kop.status, 200, 'kantoorrol: ' + JSON.stringify(kop.body).slice(0, 120));
  const start = await api('/api/account/start', { rol: 'kantoor' }, reg.body.token);
  assert.ok(start.body.token, 'medewerker ' + merk + ' op naam in de backoffice');
  return { lid: reg.body.token, kantoor: start.body.token };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  pk = kantoorPasskey(base);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. afzeggen na betalen zet een recht klaar; vanaf duizend euro tekent een tweede mens, en dan beweegt het geld', async () => {
  const reg = await api('/api/auth/register', { name: 'Reis Terug', email: 'reisterug' + Date.now() + '@voorbeeld.test',
    phone: telefoon(), password: 'Geheim123!', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  const lid = reg.body.token;
  assert.ok(lid, JSON.stringify(reg.body).slice(0, 200));
  await keurLidGoed(base, lid, reg.body.state.user.codename, '1990-01-01');
  assert.equal((await api('/api/pay/oplaad', { centen: 300000, idem: 'rt-op-' + Date.now() }, lid)).status, 200);

  const ref = (await api('/api/reisbureau/boek', { tripId: 'ibiza-jetset', personen: 1 }, lid)).body.aanvraag.ref;
  const eigenaar = await kantoorAlsPersoon(base, CODE);
  const bes = await api('/api/office/reisbureau/besluit', { ref, besluit: 'bevestigd', bericht: 'Bevestigd door een adviseur.' }, eigenaar);
  assert.equal(bes.status, 200, JSON.stringify(bes.body).slice(0, 200));
  assert.equal((await api('/api/reisbureau/betaal', { ref }, lid)).status, 200);
  const saldo = async () => (await api('/api/pay/overzicht', {}, lid)).body.saldo;
  const naBetalen = await saldo();

  // D9: de betaalde reis afzeggen laat een recht achter, en zegt niet "niet betaald"
  const af = await api('/api/office/reisbureau/afzeggen', { ref, reden: 'Het lid kan niet meer reizen.' }, eigenaar);
  assert.equal(af.status, 200, JSON.stringify(af.body).slice(0, 200));
  const geld = af.body.aanvraag.geld;
  assert.equal(geld.stand, 'teruggaveKlaargezet', JSON.stringify(geld));
  assert.equal(geld.centen, 220000);
  const id = geld.recht;
  assert.equal(await saldo(), naBetalen, 'afzeggen alleen verplaatst geen geld');

  // de gedeelde code komt niet binnen, en een naam in het lijf verandert dat niet
  const gedeeld = (await api('/api/office/login', { code: CODE })).body.token;
  for (const pad of ['/api/office/reisbureau/teruggaven', '/api/office/reisbureau/teruggave/opties', '/api/office/reisbureau/teruggave']) {
    const r = await api(pad, { id, besluit: 'uitvoeren', door: 'iemand' }, gedeeld);
    assert.equal(r.status, 403, pad + ': ' + JSON.stringify(r.body).slice(0, 120));
  }

  const a = await medewerker(1);
  const b = await medewerker(2);
  const sleutelA = await pk.zet(a.lid, 'Geheim123!');
  const sleutelB = await pk.zet(b.lid, 'Geheim123!');
  const lijst = await api('/api/office/reisbureau/teruggaven', {}, a.kantoor);
  assert.ok(lijst.body.open.some(r => r.id === id), 'het recht staat in de lijst');
  assert.equal(lijst.body.vierOgenVanafCenten, 100000);

  // uitvoeren zonder ceremonie: de deur vraagt er een
  const kaal = await api('/api/office/reisbureau/teruggave', { id, besluit: 'uitvoeren' }, a.kantoor);
  assert.equal(kaal.status, 401, JSON.stringify(kaal.body).slice(0, 160));
  assert.equal(kaal.body.bevestigingNodig, true);

  // met de ceremonie van A: een aanvraag voor een tweede mens, nog geen geld
  const cA = await pk.ceremonie(sleutelA, '/api/office/reisbureau/teruggave/opties', { id }, a.kantoor);
  const aanvraag = await api('/api/office/reisbureau/teruggave', { id, besluit: 'uitvoeren', ...cA }, a.kantoor);
  assert.equal(aanvraag.status, 200, JSON.stringify(aanvraag.body).slice(0, 200));
  assert.equal(aanvraag.body.needsAuth, true, 'boven duizend euro ging het zonder tweede mens');
  assert.equal(await saldo(), naBetalen, 'er bewoog geld voordat de tweede mens tekende');
  const th = aanvraag.body.aanvraag.id;

  // A tekent zijn eigen aanvraag niet af
  const zelf = await pk.ceremonie(sleutelA, '/api/office/bank/handtekening/opties', { id: th }, a.kantoor);
  assert.equal((await api('/api/office/bank/handtekening/bevestig', { id: th, ...zelf }, a.kantoor)).status, 403);

  const cB = await pk.ceremonie(sleutelB, '/api/office/bank/handtekening/opties', { id: th }, b.kantoor);
  const ok = await api('/api/office/bank/handtekening/bevestig', { id: th, ...cB }, b.kantoor);
  assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 200));
  assert.equal(await saldo() - naBetalen, 220000, 'het lid kreeg de reissom niet terug');

  // het besluit staat vast, met beide namen, en een tweede besluit kan niet
  const na = (await api('/api/office/reisbureau/teruggaven', {}, b.kantoor)).body.open;
  assert.ok(!na.some(r => r.id === id), 'een uitgevoerd recht staat nog open');
  const cA2 = await pk.ceremonie(sleutelA, '/api/office/reisbureau/teruggave/opties', { id }, a.kantoor);
  const nogEens = await api('/api/office/reisbureau/teruggave', { id, besluit: 'uitvoeren', ...cA2 }, a.kantoor);
  assert.equal(nogEens.status, 409, JSON.stringify(nogEens.body).slice(0, 160));
  assert.equal(await saldo() - naBetalen, 220000, 'er is twee keer terugbetaald');
  const afw = await api('/api/office/reisbureau/teruggave', { id, besluit: 'afgewezen', reden: 'Toch maar niet doen.' }, b.kantoor);
  assert.equal(afw.status, 409, JSON.stringify(afw.body).slice(0, 160));
});

/* ---------------------------------------- de route met een nagemaakte context */

function opstelling(centen) {
  const routes = {}, audit = [], uitgevoerd = [], vragen = [];
  const recht = { id: 'RTG1', ref: 'R1', centen };
  const ctx = {
    app: { post: (pad, ...h) => { routes[pad] = h[h.length - 1]; } },
    kluisAuth() {}, afdelingen: { audit: (w, t) => audit.push([w, t]) }, boardroomUser: () => ({ key: 'u' }),
    veilig: (res, f) => { const r = f(); return res.status(r.status || 200).json(r); },
    zwaar: { eis: async (u, actie, binding, req) => (req.body.ceremonie ? { ok: true } : { ok: false, status: 401 }),
      stuur: (res, zw) => res.status(zw.status).json({ bevestigingNodig: true }), opties: async () => ({}) },
    tweedeHand: { registreer() {}, vraag: (v) => { vragen.push(v); return { ok: true, needsAuth: true }; } },
    kern: { reisbetaling: {
      teruggaveVan: id => (id === 'RTG1' ? recht : null),
      teruggaveUitvoeren: async (v) => { uitgevoerd.push(v); return { ok: true, recht }; },
      teruggaveAfwijzen: (v) => ({ ok: true, v }) } }
  };
  require('../server/routes/kantoren/reisteruggave.js')(ctx);
  const roep = (body, officeKey = 'medewerker-a') => new Promise(klaar => {
    routes['/api/office/reisbureau/teruggave']({ body, officeKey },
      { status(c) { this.c = c; return this; }, json(b) { klaar({ status: this.c || 200, body: b }); } });
  });
  return { roep, audit, uitgevoerd, vragen };
}

test('2. onder duizend euro voert een mens op naam het zelf uit, met passkey en zonder tweede mens', async () => {
  const o = opstelling(99999);
  assert.equal((await o.roep({ id: 'RTG1', besluit: 'uitvoeren' })).status, 401, 'zonder passkey');
  assert.equal(o.uitgevoerd.length, 0);
  const r = await o.roep({ id: 'RTG1', besluit: 'uitvoeren', ceremonie: 'x', door: 'een ander' });
  assert.equal(r.status, 200);
  assert.deepEqual(o.uitgevoerd, [{ id: 'RTG1', door: 'medewerker-a' }], 'de naam komt uit de sessie, niet uit het lijf');
  assert.equal(o.vragen.length, 0);
  assert.equal(o.audit.length, 1);
});

test('3. precies duizend euro gaat al naar een tweede mens', async () => {
  const o = opstelling(100000);
  const r = await o.roep({ id: 'RTG1', besluit: 'uitvoeren', ceremonie: 'x' });
  assert.equal(r.body.needsAuth, true);
  assert.equal(o.uitgevoerd.length, 0);
  assert.deepEqual(o.vragen[0].lijf, { id: 'RTG1' });
  assert.equal(o.vragen[0].door, 'medewerker-a');
});

test('4. afwijzen vraagt geen passkey en geen tweede mens', async () => {
  const o = opstelling(500000);
  const r = await o.roep({ id: 'RTG1', besluit: 'afgewezen', reden: 'Het lid heeft het al buiten RTG terug.' });
  assert.equal(r.status, 200);
  assert.equal(o.vragen.length, 0);
  assert.equal((await o.roep({ id: 'RTG1', besluit: 'iets' })).status, 400);
  assert.equal((await o.roep({ id: 'X', besluit: 'uitvoeren' })).status, 404);
});
