/* DE VRIJGAVEPOORT EN STRIPE CONNECT OP EEN ECHTE SERVER.

   Een nagemaakte app bewijst het gedrag van een handler en niet de montage of
   de deur (LAT.md regel 17). Hier gaan de zes nieuwe routes door de echte
   boardroompoort, de echte passkeyceremonie (softwareauthenticator met echte
   P-256-handtekeningen, test/kantoorpasskey.js) en de echte webhookketen.

   Wat er wordt nagetrokken:
   - een lid kan een servercapability niet omzetten; er bestaat geen ledenroute;
   - aanzetten van geld vraagt de passkey, uitzetten niet;
   - wie er schakelt komt uit de sessie, niet uit het lichaam;
   - een ANDER proces op dezelfde datamap ziet de noodstop;
   - zonder release-gebonden bewijs is in deze omgeving niets beschikbaar, ook
     niet wat op `enabled` staat;
   - de Connect-webhook weigert zonder geldige handtekening, en een herhaalde
     melding wordt niet twee keer verwerkt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { startServer, stop } = require('./helper');
const { kantoorPasskey } = require('./kantoorpasskey');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vrijgave-routes-'));
const GEHEIM = 'whsec_proef_' + crypto.randomBytes(8).toString('hex');
let srv, base, baas, lid, pk, baasId;
const api = (pad, body, token) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const ceremonie = actie => pk.ceremonie(pk.sleutel, '/api/office/boardroom/bevestig/opties', { actie }, baas);
const standbestand = () => JSON.parse(fs.readFileSync(path.join(TMP, 'vrijgave-stand.json'), 'utf8'));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, STRIPE_CONNECT_WEBHOOK_SECRET: GEHEIM } });
  base = srv.base;
  baas = (await api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(baas, 'de eigenaar is ingelogd');
  baasId = (await api('/api/auth/me', {}, baas)).body.user.id;
  const k = kantoorPasskey(base);
  pk = Object.assign(k, { sleutel: await k.zet(baas) });
  const u = (Date.now() % 1e8).toString().padStart(8, '0');
  const r = await api('/api/auth/register', { name: 'Lid Vrijgave', email: 'vg' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  lid = r.body.token;
  assert.ok(lid, 'een gewoon lid');
});
test.after(() => { stop(srv && srv.child); fs.rmSync(TMP, { recursive: true, force: true }); });

test('een lid kan een servercapability niet omzetten, en er is geen ledenroute voor', async () => {
  for (const pad of ['/api/office/vrijgave/stand', '/api/office/vrijgave/besluit', '/api/office/vrijgave'])
    assert.ok([401, 403].includes((await api(pad, { id: 'geld.inkomend', stand: 'enabled', reden: 'een lid probeert het' }, lid)).status), pad);
  assert.ok([401, 403].includes((await api('/api/office/vrijgave/stand', { id: 'geld.inkomend', stand: 'enabled', reden: 'anoniem probeert het' })).status));
  const r = await api('/api/vrijgave/stand', { id: 'geld.inkomend', stand: 'enabled' }, lid);
  assert.ok(r.status === 404 || r.status === 401, 'een ledenroute om te schakelen bestaat: ' + r.status);
  assert.equal(fs.existsSync(path.join(TMP, 'vrijgave-stand.json')), false, 'er is toch iets geschreven');
});

test('aanzetten vraagt de passkey; de naam komt uit de sessie; uitzetten vraagt hem niet', async () => {
  const zonder = await api('/api/office/vrijgave/stand', { id: 'geld.partnerafrekening', stand: 'enabled', reden: 'aanzetten zonder vinger' }, baas);
  assert.equal(zonder.status, 401); assert.equal(zonder.body.bevestigingNodig, true);
  const met = await api('/api/office/vrijgave/stand', { id: 'geld.partnerafrekening', stand: 'enabled',
    reden: 'aanzetten met een vinger', wie: 'user-999', ...(await ceremonie('eigenaar-vrijgave')) }, baas);
  assert.equal(met.status, 200, JSON.stringify(met.body));
  assert.equal(met.body.oordeel.ingeschakeld, true);
  assert.equal(met.body.oordeel.beschikbaar, false, 'zonder release-gebonden bewijs is aan nog geen beschikbaar');
  assert.equal(met.body.oordeel.geverifieerd, false);
  assert.equal(standbestand().standen['geld.partnerafrekening'].wie, 'user-' + baasId, 'de naam kwam uit het lichaam');
  const nood = await api('/api/office/vrijgave/stand', { id: 'geld.partnerafrekening', stand: 'emergency_disabled', reden: 'noodstop zonder vinger' }, baas);
  assert.equal(nood.status, 200, JSON.stringify(nood.body));
  assert.equal(standbestand().standen['geld.partnerafrekening'].stand, 'emergency_disabled');
});

test('een ander proces op dezelfde datamap ziet de noodstop', () => {
  const code = `const v=require('./server/kern/vrijgave').maakVrijgave({openbaar:()=>false});
    const o=v.beoordeel('geld.partnerafrekening',{recht:true});process.stdout.write(JSON.stringify({stand:o.stand,b:o.beschikbaar}));`;
  const r = spawnSync(process.execPath, ['-e', code], { cwd: path.join(__dirname, '..'), encoding: 'utf8',
    env: Object.assign({}, process.env, { RTG_DATA_DIR: TMP }) });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { stand: 'emergency_disabled', b: false });
});

test('een besluit vastleggen vraagt de passkey, intrekken niet; het overzicht toont het', async () => {
  const lijf = { besluit: 'provider.stripe_connect', bron: 'contract-stripe-connect-2026', sha256: 'b'.repeat(64), reden: 'Connect-overeenkomst getekend' };
  assert.equal((await api('/api/office/vrijgave/besluit', lijf, baas)).status, 401);
  const r = await api('/api/office/vrijgave/besluit', { ...lijf, ...(await ceremonie('eigenaar-vrijgave')) }, baas);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  let o = (await api('/api/office/vrijgave', {}, baas)).body;
  assert.equal(o.besluiten.find(b => b.besluit === 'provider.stripe_connect').vastgelegd, true);
  assert.equal(o.capabilities.some(c => c.beschikbaar), false, 'in deze omgeving zonder releasebewijs is niets beschikbaar');
  const weg = await api('/api/office/vrijgave/besluit', { besluit: 'provider.stripe_connect', intrekken: true, reden: 'contract opgezegd in de proef' }, baas);
  assert.equal(weg.status, 200);
  o = (await api('/api/office/vrijgave', {}, baas)).body;
  assert.equal(o.besluiten.find(b => b.besluit === 'provider.stripe_connect').vastgelegd, false);
});

test('een partnerafrekening via de echte deur: passkey, en dan dicht door de vrijgavepoort zonder iets te versturen', async () => {
  const lijf = { id: 'afr-route-0001', partner: 'zaak-1', account: 'acct_proef123', centen: 1000 };
  assert.equal((await api('/api/office/connect/afrekening', lijf, baas)).status, 401, 'zonder passkey');
  const r = await api('/api/office/connect/afrekening', { ...lijf, ...(await ceremonie('connect.afrekening')) }, baas);
  assert.equal(r.status, 503, JSON.stringify(r.body));
  assert.equal(r.body.code, 'tijdelijk-uit');
  const l = await api('/api/office/connect/afrekeningen', {}, baas);
  assert.equal(l.status, 200);
  assert.deepEqual(l.body.afrekeningen, [], 'een geweigerde aanvraag liet een record achter');
  const v = await api('/api/office/connect/veeg', {}, baas);
  assert.equal(v.status, 200); assert.equal(v.body.reconciliatie.sluit, true);
  assert.ok([401, 403].includes((await api('/api/office/connect/afrekeningen', {}, lid)).status), 'een lid ziet de afrekeningen niet');
});

test('de Connect-webhook: zonder geldige handtekening geweigerd, een herhaling niet twee keer verwerkt', async () => {
  const evt = { id: 'evt_proef_' + crypto.randomBytes(4).toString('hex'), type: 'payout.paid', account: 'acct_vreemd1',
    data: { object: { id: 'po_vreemd', object: 'payout', amount: 500, status: 'paid', metadata: {} } } };
  const body = JSON.stringify(evt);
  const stuur = (handtekening) => fetch(base + '/api/betaal/webhook/connect', { method: 'POST',
    headers: { 'content-type': 'application/json', ...(handtekening ? { 'stripe-signature': handtekening } : {}) }, body });
  assert.equal((await stuur(null)).status, 400);
  assert.equal((await stuur('t=1,v1=' + 'a'.repeat(64))).status, 400);
  const t = Math.floor(Date.now() / 1000);
  const goed = 't=' + t + ',v1=' + crypto.createHmac('sha256', GEHEIM).update(t + '.' + body).digest('hex');
  assert.equal((await stuur(goed)).status, 200);
  assert.equal((await stuur(goed)).status, 200);
  const l = (await api('/api/office/connect/afrekeningen', {}, baas)).body;
  assert.equal(l.bevindingen.filter(b => b.eventId === evt.id).length, 1, 'de herhaalde melding is twee keer verwerkt');
  assert.equal(l.bevindingen.find(b => b.eventId === evt.id).soort, 'onbekende-melding');
  const oud = 't=' + (t - 3600) + ',v1=' + crypto.createHmac('sha256', GEHEIM).update((t - 3600) + '.' + body).digest('hex');
  assert.equal((await stuur(oud)).status, 400, 'een oude, opnieuw afgespeelde melding');
});
