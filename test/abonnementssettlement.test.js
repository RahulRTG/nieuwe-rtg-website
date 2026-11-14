/* Nieuwe abonnementstak: echte versleutelde account-SQLite, echte fondsrekenkern.
   De BW-rijen zijn synthetische bevestigde bronfixtures, geen providerbewijs.
   Geen HTTP/provider, PG- of stroomuitvalclaim. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-abonnement-settlement-'));
Object.assign(process.env, { NODE_ENV: 'test', RTG_DATA_DIR: dir, DATABASE_URL: '', PG_URL: '',
  RTG_STORE: 'sqlite', RTG_SECRET_KEY: '11'.repeat(32), RTG_VAULT_KEY: '22'.repeat(32), RTG_VAULT_RING: '' });
const accounts = require('../server/accounts');
const S = require('../server/accounts/state');
const gebonden = require('../server/accounts/gebonden');
const { maakSettlement } = require('../server/kern/settlement');
const { maakFonds } = require('../server/kern/fonds');
const btw = require('../server/kern/commercie/btw');
accounts.init();
test.after(() => { S.db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
let volg = 0;
const kopie = x => JSON.parse(JSON.stringify(x));

function fixture(profiel = 'nl-21') {
  const n = ++volg, user = accounts.createUserSync({ email: 'settlement-' + n + '@example.test',
    realName: 'Synthetische eigenaar', password: 'alleen-een-lokale-proef', tier: 'guest' });
  const opbouw = btw.overNetto(10000, profiel);
  const inv = { id: 'ABO-PROEF-' + n, desc: 'Maandbijdrage lidmaatschap rtg', status: 'open',
    bijdrage: opbouw.brutoCenten / 100, btwProfiel: profiel, btwOpbouw: opbouw,
    abonnement: { accountId: user.id, contractId: 'C-' + n, termijn: 1, brutoCenten: opbouw.brutoCenten,
      valuta: 'eur', van: '2026-11-13T00:00:00.000Z', tot: '2026-12-13T00:00:00.000Z' } };
  const ctx = { soort: 'factuur', own: true, accountId: user.id, invoiceId: inv.id,
    contractId: inv.abonnement.contractId, termijn: 1, wie: 'acc:' + user.id };
  const betaling = { id: 'BW-PROEF-' + n, centen: opbouw.brutoCenten, hoe: 'Zojuist betaald' };
  const w = { id: betaling.id, soort: 'factuur', actor: ctx.wie, bronRef: inv.id, context: kopie(ctx),
    centen: betaling.centen, valuta: 'eur', status: 'BEVESTIGD', provider: 'stripe',
    providerId: 'pi_proef_' + n, terugbetaaldCenten: 0 };
  const db = { data: { betaalWaarheid: { [w.id]: w }, fondsAfdrachten: [] } };
  accounts.saveMemberState(user.id, { invoices: [inv], eigenNotitie: 'bewaren' });
  const fonds = maakFonds({ db, save() {}, env: {} });
  const stand = { activaties: 0, fondsCalls: 0 };
  const deps = { db, accounts, fonds: { ...fonds, async boekAfdracht(o) {
    stand.fondsCalls++; assert.equal(S.db.isTransaction, false, 'geen fonds-I/O in accounttransactie');
    if (stand.fondsFout) throw Error('Fondsopslag geweigerd');
    return fonds.boekAfdracht(o);
  } }, save() {}, log: { warn() {}, error() {} },
  async naAbonnementsbetaling(c, b) {
    assert.equal(S.db.isTransaction, false, 'geen activatie-I/O in accounttransactie');
    assert.deepEqual(c, ctx); assert.deepEqual(b, betaling);
    assert.equal(accounts.getMemberState(user.id).invoices[0].status, 'paid');
    stand.activaties++;
    if (stand.activatieFout) throw Error('Activatieopslag geweigerd');
    if (stand.activatieWeigering) return { ok: false, status: 503, error: 'Activatie geweigerd' };
    return { ok: true };
  } };
  const lees = () => accounts.getMemberState(user.id);
  const wijzig = fn => accounts.wijzigMemberState(user.id, md => { fn(md.invoices[0], md); return { bewaar: true }; });
  return { user, inv, ctx, betaling, w, db, fonds, stand, deps, lees, wijzig,
    settle: maakSettlement(deps) };
}
async function geweigerd(f, ctx = f.ctx, betaling = f.betaling) {
  let r; try { r = await f.settle(ctx, betaling); } catch (e) { r = { error: e.message }; }
  assert.ok(r && r.error && r.ok !== true, 'geen stil succes voor ongeldig bewijs');
  assert.equal(f.lees().invoices[0]?.status || 'open', 'open');
  assert.equal(f.stand.activaties, 0); assert.equal(f.db.data.fondsAfdrachten.length, 0);
}

test('eigen factuur + BW committen eenmaal; activatie wordt op betaalde retry hernomen', async () => {
  const f = fixture();
  assert.equal((await f.settle(f.ctx, f.betaling)).ok, true);
  const inv = f.lees().invoices[0];
  assert.equal(inv.status, 'paid'); assert.equal(inv.deelbetaald, f.betaling.centen);
  assert.deepEqual(inv.betaalBewijzen, [{ id: f.betaling.id, centen: f.betaling.centen }]);
  assert.equal((await f.settle(f.ctx, f.betaling)).ok, true);
  assert.equal(f.stand.activaties, 2); assert.deepEqual(f.lees().invoices[0], inv);
  assert.equal(f.db.data.fondsAfdrachten.length, 1);
  assert.equal(f.db.data.fondsAfdrachten[0].centen, 3000);
  assert.equal(f.db.data.fondsAfdrachten[0].wie, f.ctx.wie);
});

test('canonieke 30% over originele netto-opbouw, ook bij nul-btw', async () => {
  const f = fixture('eu-b2b-verlegd');
  assert.equal((await f.settle(f.ctx, f.betaling)).ok, true);
  assert.equal(f.db.data.fondsAfdrachten[0].nettoCenten, 10000);
  assert.equal(f.db.data.fondsAfdrachten[0].centen, 3000);
  assert.equal(f.stand.activaties, 1);
});

test('eigenaar, contract, termijn, bedrag en echte BW-bron zijn verplicht', async () => {
  const mutanten = [
    f => { f.ctx.own = false; }, f => { f.ctx.accountId = 0; },
    f => { f.ctx.wie = 'acc:999'; }, f => { f.ctx.contractId = 'C-vreemd'; },
    f => { f.ctx.termijn = 2; }, f => { f.betaling.id = 'BW-ONTBREEKT'; },
    f => { f.betaling.centen -= 1; }, f => { f.w.actor = 'acc:999'; },
    f => { f.w.context.accountId += 1; }, f => { f.w.context.own = false; },
    f => { f.w.context.invoiceId = 'VREEMD'; }, f => { f.w.context.contractId = 'C-vreemd'; },
    f => { f.w.context.termijn = 2; }, f => { f.w.bronRef = 'VREEMD'; },
    f => { f.w.soort = 'direct'; }, f => { f.w.id = 'BW-anders'; },
    f => { f.w.valuta = 'usd'; }, f => { f.w.centen -= 1; },
    f => { delete f.w.providerId; }, f => { f.w.status = 'IN_BEHANDELING'; },
    f => { f.w.terugbetaaldCenten = 1; },
    f => { f.w.terugbetaalOpdrachten = [{ status: 'VASTGELEGD', centen: 1 }]; },
    f => { f.w.terugbetalingen = [{ centen: 1 }]; },
    f => f.wijzig(i => { i.abonnement.accountId += 1; }),
    f => f.wijzig(i => { i.abonnement.valuta = 'usd'; }),
    f => f.wijzig(i => { i.bijdrage += 1; }),
    f => f.wijzig(i => { i.btwOpbouw.nettoCenten += 1; }),
    f => f.wijzig(i => { i.btwProfiel = 'onbekend'; }),
    f => f.wijzig((i, md) => { md.invoices = []; }),
    f => f.wijzig((i, md) => { md.invoices.push(kopie(i)); })
  ];
  for (const wijzig of mutanten) { const f = fixture(); wijzig(f); await geweigerd(f); }
});

test('nul verschuldigd kan nooit via een gefingeerde BW-cent worden voldaan', async () => {
  const f = fixture();
  f.wijzig(i => { i.bijdrage = 0; i.abonnement.brutoCenten = 0; i.btwOpbouw = btw.overBruto(0); });
  f.betaling.centen = 0; f.w.centen = 0;
  await geweigerd(f);
});

test('activeringsfout na betaalde factuur blijft fout; retry herhaalt geen geld of afdracht', async () => {
  const f = fixture(); f.stand.activatieFout = true;
  await assert.rejects(() => f.settle(f.ctx, f.betaling), /Activatieopslag/);
  const voor = f.lees().invoices[0]; assert.equal(voor.status, 'paid');
  f.stand.activatieFout = false; f.stand.activatieWeigering = true;
  const r = await f.settle(f.ctx, f.betaling); assert.equal(r.ok, false);
  f.stand.activatieWeigering = false;
  assert.equal((await f.settle(f.ctx, f.betaling)).ok, true);
  assert.equal(f.stand.activaties, 3); assert.deepEqual(f.lees().invoices[0], voor);
  assert.equal(f.db.data.fondsAfdrachten.length, 1);
});

test('fondsfout wordt niet ingeslikt en betaalde retry maakt de afdracht alsnog', async () => {
  const f = fixture(); f.stand.fondsFout = true;
  await assert.rejects(() => f.settle(f.ctx, f.betaling), /Fondsopslag/);
  assert.equal(f.lees().invoices[0].status, 'paid'); assert.equal(f.stand.activaties, 0);
  f.stand.fondsFout = false;
  assert.equal((await f.settle(f.ctx, f.betaling)).ok, true);
  assert.equal(f.stand.activaties, 1); assert.equal(f.db.data.fondsAfdrachten.length, 1);
});

test('ontbrekende activatiehaak is geen afgehandelde abonnementsbetaling', async () => {
  const f = fixture(); delete f.deps.naAbonnementsbetaling;
  f.settle = maakSettlement(f.deps); await geweigerd(f);
});

test('verse mutatie onder accountslot bewaart parallel vooraf opgeslagen dossierwerk', async () => {
  const f = fixture(); const basis = accounts.wijzigMemberState;
  f.deps.accounts = { ...accounts, wijzigMemberState(id, fn) {
    basis(id, md => { md.eigenNotitie = 'nieuw en bevestigd'; return { bewaar: true }; });
    return basis(id, fn);
  } };
  f.settle = maakSettlement(f.deps);
  assert.equal((await f.settle(f.ctx, f.betaling)).ok, true);
  assert.equal(f.lees().eigenNotitie, 'nieuw en bevestigd');
});

test('echte SQLite COMMIT met verloren bevestiging, heropen en nogmaals falende retry tellen eenmaal', async () => {
  const f = fixture(); let getuige = null, keren = 2;
  const voer = S.db.exec.bind(S.db);
  S.db.exec = function (sql) {
    const uit = voer(sql);
    if (sql === 'COMMIT' && keren-- > 0) {
      const tweede = new DatabaseSync(path.join(dir, 'rtg.db'), { readOnly: true });
      try {
        const row = tweede.prepare('SELECT id,member_state FROM users WHERE id=?').get(f.user.id);
        getuige = JSON.parse(gebonden.lees('member_state', row));
      } finally { tweede.close(); }
      throw Error('Bevestiging na echte COMMIT verloren');
    }
    return uit;
  };
  try {
    await assert.rejects(() => f.settle(f.ctx, f.betaling), /COMMIT verloren/);
    assert.equal(getuige.invoices[0].status, 'paid'); assert.equal(getuige.invoices[0].betaalBewijzen.length, 1);
    await assert.rejects(() => f.settle(f.ctx, f.betaling), /COMMIT verloren/);
    assert.equal(f.stand.activaties, 0);
  } finally { S.db.exec = voer; }
  S.db.close(); accounts.init();
  assert.equal((await f.settle(f.ctx, f.betaling)).ok, true);
  const inv = f.lees().invoices[0];
  assert.equal(inv.deelbetaald, f.betaling.centen); assert.equal(inv.betaalBewijzen.length, 1);
  assert.equal(f.stand.activaties, 1); assert.equal(f.db.data.fondsAfdrachten.length, 1);
});

test('een fout vóór SQLite COMMIT publiceert geen betaald bewijs; retry kan wel afronden', async () => {
  const f = fixture(), voer = S.db.exec.bind(S.db); let faal = true;
  S.db.exec = function (sql) { if (sql === 'COMMIT' && faal) { faal = false; throw Error('Commit geweigerd'); } return voer(sql); };
  try { await assert.rejects(() => f.settle(f.ctx, f.betaling), /Commit geweigerd/); }
  finally { S.db.exec = voer; }
  assert.equal(f.lees().invoices[0].status, 'open'); assert.equal(f.lees().invoices[0].betaalBewijzen, undefined);
  assert.equal((await f.settle(f.ctx, f.betaling)).ok, true);
});

test('ander betaal-id op al betaalde factuur, of betaald zonder bewijs, geeft geen activatie', async () => {
  const f = fixture(); await f.settle(f.ctx, f.betaling);
  const id = f.betaling.id + '-ANDER'; f.db.data.betaalWaarheid[id] = { ...kopie(f.w), id };
  const r = await f.settle(f.ctx, { ...f.betaling, id });
  assert.ok(r.error); assert.equal(f.stand.activaties, 1);
  const g = fixture(); g.wijzig(i => { i.status = 'paid'; });
  const uit = await g.settle(g.ctx, g.betaling); assert.ok(uit.error); assert.equal(g.stand.activaties, 0);
});

test('gelijktijdige identieke bevestigingen delen de lopende afronding zonder dossierverlies', async () => {
  const f = fixture(); let vrij, bereikt;
  const wachten = new Promise(resolve => { vrij = resolve; });
  const begonnen = new Promise(resolve => { bereikt = resolve; });
  const origineel = f.deps.naAbonnementsbetaling;
  f.deps.naAbonnementsbetaling = async (c, b) => { bereikt(); await wachten; return origineel(c, b); };
  f.settle = maakSettlement(f.deps);
  const a = f.settle(f.ctx, f.betaling), b = f.settle(f.ctx, f.betaling);
  await begonnen;
  f.wijzig((i, md) => { md.eigenNotitie = 'werk tijdens activatie'; });
  vrij();
  assert.deepEqual((await Promise.all([a, b])).map(r => r.ok), [true, true]);
  assert.equal(f.stand.activaties, 1); assert.equal(f.stand.fondsCalls, 1);
  assert.equal(f.lees().eigenNotitie, 'werk tijdens activatie');
  assert.equal(f.lees().invoices[0].betaalBewijzen.length, 1);
});
