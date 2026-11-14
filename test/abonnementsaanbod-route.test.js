'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture, body, tekenen } = require('./abonnementsaanbod-fixture.cjs');
const { keten } = require('./abonnementen-keten-fixture.cjs');
const PADEN = Object.freeze({
  stand: '/api/mijn/abonnement/automatisch/stand',
  aanbod: '/api/mijn/abonnement/automatisch/aanbod',
  teken: '/api/mijn/abonnement/automatisch/teken',
  betalen: '/api/mijn/abonnement/automatisch/betalen',
  herstel: '/api/mijn/abonnement/automatisch/herstel',
  intrekken: '/api/mijn/abonnement/automatisch/intrekken'
});
function deur(env = {}, bron) {
  const f = bron || fixture(), handlers = new Map(), calls = [];
  const automatisch = f.service || { ...f.motor,
    async betaal(id, input) { calls.push({ id, input }); return { ok: true }; },
    async herstel(id, input) { calls.push({ id, input }); return { ok: true }; } };
  const auth = (req, res, next) => req.tokenAccount == null ? res.status(401).json({ error: 'Geen sessie' }) : next();
  const beleid = require('../server/middleware/functiebeleid')({ db: f.db,
    accounts: { ...f.accounts, verifyToken: token => f.users.get(Number(token)) },
    sessionFor: token => ({ tier: f.users.get(Number(token))?.tier || 'guest' }),
    functies: require('../server/functies') });
  require('../server/routes/aanmeldingen/automatisch')({ env, auth,
    aanvragerVan: req => req.tokenAccount, aanmeldingen: { automatisch },
    app: { post(pad, ...rij) { handlers.set(pad, rij); } } });
  async function api(pad, input, accountId) {
    const rij = handlers.get(PADEN[pad]);
    const req = { tokenAccount: accountId, body: input, path: PADEN[pad], method: 'POST',
      get: k => k === 'authorization' && accountId != null ? 'Bearer ' + accountId : '' };
    req.routeBeleid = path => beleid({ ...req, path });
    const uit = { status: 200, headers: {} };
    const res = { set(k, v) { uit.headers[k] = v; return this; }, status(s) { uit.status = s; return this; },
      json(data) { uit.body = data; return this; } };
    let n = 0; const next = async () => { if (rij[n]) return rij[n++](req, res, next); };
    const dicht = beleid(req);
    if (dicht) res.status(dicht.status).json(dicht.antwoord); else await next();
    return uit;
  }
  return { ...f, api, calls, automatisch };
}

test('gesloten instroom weigert aanbod en tekenen, maar lezen blijft mutatievrij', async () => {
  const f = deur(), voor = JSON.stringify(f.db.data);
  const stand = await f.api('stand', {}, 1);
  assert.equal(stand.body.beschikbaar, true);
  assert.equal(stand.body.instroomBeschikbaar, false);
  assert.equal(stand.body.intake, undefined);
  for (const pad of ['aanbod', 'teken'])
    assert.equal((await f.api(pad, body(), 1)).status, 409);
  assert.equal(JSON.stringify(f.db.data), voor); assert.deepEqual(f.calls, []);
  assert.equal((await f.api('stand', {}, null)).status, 401);
});

test('async aanbod/teken gebruiken sessieaccount en bewaren concrete ondertekening, niet bodyaccount', async () => {
  const f = deur({ RTG_ABONNEMENTEN_ZELFSERVICE: '1' });
  const r = await f.api('aanbod', { ...body(), accountId: 2, prijs: 1, door: 'Kantoor' }, 1);
  assert.equal(r.status, 200); assert.equal(r.body.contract.aanbod.accountId, 1);
  assert.equal(r.body.contract.aanbod.prijs.maand.brutoCenten, 25000);
  const vreemd = await f.api('teken', { ...tekenen(r.body), accountId: 1 }, 2);
  assert.equal(vreemd.status, 404);
  const eigen = await f.api('teken', { ...tekenen(r.body), accountId: 2 }, 1);
  assert.equal(eigen.status, 200); assert.equal(eigen.body.contract.status, 'GEACCEPTEERD');
  assert.equal(eigen.headers['Cache-Control'], 'no-store');
  const stand = await f.api('stand', {}, 1);
  assert.equal(stand.body.beschikbaar, true); assert.equal(stand.body.contracten.length, 1);
  assert.deepEqual((await f.api('stand', { accountId: 1 }, 2)).body.contracten, []);
});

test('betalings- en herstelbody zijn beperkt tot contractId, met actor uit geverifieerd token', async () => {
  const f = deur({ RTG_ABONNEMENTEN_ZELFSERVICE: '1' });
  for (const pad of ['betalen', 'herstel']) {
    assert.equal((await f.api(pad, { contractId: 'c-1', accountId: 2, centen: 1, providerId: 'fake', status: 'paid' }, 1)).status, 200);
    assert.deepEqual(f.calls.at(-1), { id: 1, input: { contractId: 'c-1' } });
  }
});

test('async fout of opslagrollback kan over route geen succes worden; dezelfde UUID kan herstellen', async () => {
  const f = deur({ RTG_ABONNEMENTEN_ZELFSERVICE: '1' }), b = body();
  f.stand.saveFout = true;
  assert.equal((await f.api('aanbod', b, 1)).status, 503); assert.deepEqual(f.db.data, {});
  f.stand.saveFout = false; assert.equal((await f.api('aanbod', b, 1)).status, 200);
  f.automatisch.mijn = async () => { throw Error('Interne details niet uitsturen'); };
  const fout = await f.api('stand', {}, 1);
  assert.equal(fout.status, 503); assert.doesNotMatch(JSON.stringify(fout.body), /Interne details/);
  f.automatisch.mijn = () => ({ ok: true, beschikbaar: false, contracten: [] });
  assert.equal((await f.api('stand', {}, 1)).body.beschikbaar, false, 'routeflag kan een gesloten runtimepoort niet openen');
});

// Werkelijke routehandler, functiebeleid, contract-, ontvangst- en betaalowners.
// Alleen accountopslag/provider zijn synthetisch; geen HTTP- of duurzaamheidclaim.
function herbouw(f, extra = {}) {
  // De echte hoofdeigenaar gebruikt de huisklok, dus de providerfixture ook.
  Object.defineProperty(f.stand, 'at', { configurable: true,
    get: () => new Date(require('../server/lib/klok').nu()).toISOString() });
  const automatisch = require('../server/kern/aanmeldingen')({ ...f.opties,
    crypto: require('node:crypto'), schoon: s => s, save() {},
    betaal: f.betaal, betaalWaarheid: f.bw,
    abonnementenBeschikbaar: false, abonnementenBedieningBeschikbaar: true,
    abonnementReturnUrl: 'https://rtg.example/apps/geld.html#lidmaatschap', ...extra }).aanmeldingen.automatisch;
  return deur({}, { ...f, service: automatisch });
}
function opname(f) {
  return JSON.stringify({ db: f.db.data, users: [...f.users], dossiers: [...f.dossiers],
    providerCalls: f.stand.providerCalls, saves: f.stand.saves });
}

test('2+4: alleen aanbod en teken hangen aan tg-aanmeld; gesloten schakelaar bewaart contractbediening', async () => {
  const f = keten(), contractId = await f.getekend();
  f.db.data.techniek = { functies: { 'tg-aanmeld': { aan: false } } };
  const d = deur({ RTG_ABONNEMENTEN_ZELFSERVICE: '1' }, f), functies = require('../server/functies');
  for (const pad of ['aanbod', 'teken']) {
    assert.equal(functies.functieVoorPad(PADEN[pad])?.id, 'tg-aanmeld');
    assert.equal((await d.api(pad, body(), 1)).status, 503);
  }
  for (const pad of ['betalen', 'herstel', 'intrekken', 'stand'])
    assert.equal(functies.functieVoorPad(PADEN[pad]), null, pad + ' is eigen contractbediening');
  const voor = opname(f), stand = await d.api('stand', {}, 1);
  assert.equal(stand.body.instroomBeschikbaar, false);
  assert.equal(stand.body.intake, undefined);
  assert.equal(stand.body.contracten[0].id, contractId);
  assert.equal(opname(f), voor, 'lezen maakt geen factuur, afschrijving of recht');
  assert.equal((await d.api('betalen', { contractId }, 1)).status, 200);
  assert.equal(f.stand.providerCalls, 1);
});

test('vlag uit na herstart: bestaande getekende betaling en herstel blijven exact eigen, stand int niets', async () => {
  const f = keten(), contractId = await f.getekend(), d = herbouw(f);
  const voor = opname(f), stand = await d.api('stand', {}, 1);
  assert.equal(stand.body.beschikbaar, true); assert.equal(stand.body.instroomBeschikbaar, false);
  assert.equal(stand.body.contracten[0].status, 'GEACCEPTEERD');
  assert.equal(opname(f), voor);
  assert.equal((await d.automatisch.aanbod(1, body())).status, 503);
  assert.equal((await d.automatisch.teken(1, tekenen({ contract: stand.body.contracten[0] }))).status, 503);
  for (const pad of ['betalen', 'herstel', 'intrekken']) {
    const input = { contractId, aanbodHash: stand.body.contracten[0].aanbod.hash, accountId: 1 };
    assert.equal((await d.api(pad, input, 2)).status, 404, pad + ': bodyaccount is geen bevoegdheid');
    assert.equal((await d.api(pad, input, null)).status, 401);
  }
  assert.deepEqual((await d.api('stand', { accountId: 1 }, 2)).body.contracten, []);
  assert.equal(opname(f), voor, 'vreemde verzoeken veranderen niets');
  assert.equal((await d.api('betalen', { contractId, centen: 1 }, 1)).status, 200);
  assert.equal(f.stand.providerCalls, 1); assert.equal(f.users.get(1).tier, 'guest');
  const naStart = opname(f);
  await d.api('stand', {}, 1); assert.equal(opname(f), naStart);
  f.bevestig();
  assert.equal((await d.api('herstel', { contractId }, 1)).status, 200);
  assert.equal(f.users.get(1).tier, 'rtg'); assert.equal(f.stand.providerCalls, 1);
  assert.equal(f.dossiers.get(1).invoices.length, 1);
});

test('vlag uit: eigen onbetaald voorstel intrekken kan, gestart betaalbewijs blijft beschermd', async () => {
  const f = keten(), r = await f.service.aanbod(1, body()), d = herbouw(f);
  const input = { contractId: r.contract.id, aanbodHash: r.contract.aanbod.hash };
  assert.equal((await d.api('intrekken', input, 1)).body.contract.status, 'GEEINDIGD');
  assert.equal((await d.api('intrekken', input, 1)).body.herhaald, true);
  assert.equal(f.stand.providerCalls, 0);
  const ander = keten(), contractId = await ander.getekend();
  await ander.service.betaal(1, { contractId });
  const d2 = herbouw(ander), c = ander.db.data.contracten.find(c => c.id === contractId), voor = opname(ander);
  assert.equal((await d2.api('intrekken', { contractId, aanbodHash: c.aanbod.hash }, 1)).status, 409);
  assert.equal(opname(ander), voor);
});

test('geen opslagvrijgave, betaaladapter, betaalwaarheid of HTTPS-retour: bediening blijft fail-closed', async () => {
  for (const extra of [{ abonnementenBedieningBeschikbaar: false }, { betaal: null },
    { betaalWaarheid: null }, { abonnementReturnUrl: null }, { abonnementReturnUrl: 'http://rtg.example/' }]) {
    const f = keten(), contractId = await f.getekend(), d = herbouw(f, extra), voor = opname(f);
    assert.equal((await d.api('stand', {}, 1)).body.beschikbaar, false);
    for (const pad of ['betalen', 'herstel', 'intrekken'])
      assert.equal((await d.api(pad, { contractId }, 1)).status, 503);
    assert.deepEqual(await d.automatisch.ronde(), { bekeken: 0 });
    assert.equal(opname(f), voor);
  }
});

test('vlag uit: achtergrondronde factureert geen slechts getekend voorstel', async () => {
  const f = keten(); await f.getekend();
  const d = herbouw(f), voor = opname(f);
  assert.deepEqual((await d.automatisch.ronde()).fouten, []);
  assert.equal(opname(f), voor, 'zonder expliciete betaalstart geen factuur, incasso of activering');
});

test('beide registers benoemen exact zeven contractrechten; instroom en toekomstige routes erven geen uitzondering', () => {
  const { redenVoor } = require('../server/kern/bestuursroutes');
  const { verdeelRoutes } = require('../server/kern/platformregister/samenstellen');
  const functies = require('../server/functies').FUNCTIES;
  const rechten = ['/api/mijn/abonnement', '/api/mijn/abonnement/opzegvoorbeeld',
    '/api/mijn/abonnement/opzeggen', ...['betalen', 'herstel', 'intrekken', 'stand'].map(p => PADEN[p])];
  const onbekend = ['/api/mijn/abonnement/nieuw', '/api/mijn/abonnement/automatisch/nieuw', PADEN.herstel + '/nieuw'];
  const rijen = [...rechten, ...onbekend, PADEN.aanbod, PADEN.teken, '/api/privacy/export']
    .map(pad => ({ methode: 'POST', pad }));
  const r = verdeelRoutes(rijen, functies);
  for (const pad of rechten) {
    assert.ok(redenVoor(pad), pad + ': alleen het benoemde recht');
    assert.deepEqual(r.perDing.get('bediening:' + pad)?.map(r => r.pad), [pad]);
  }
  for (const pad of [...onbekend, PADEN.aanbod, PADEN.teken]) assert.equal(redenVoor(pad), null, pad);
  assert.deepEqual(r.onbenoemd, onbekend.map(p => 'POST ' + p));
  assert.deepEqual(r.perDing.get('functie:tg-aanmeld').map(r => r.pad), [PADEN.aanbod, PADEN.teken]);
  assert.ok(redenVoor('/api/privacy/export'), 'andere bestaande prefixverklaringen blijven werken');
  assert.deepEqual(r.perDing.get('bediening:/api/privacy').map(r => r.pad), ['/api/privacy/export']);
  const meting = require('../scripts/schakelbaar').meet();
  for (const pad of [PADEN.aanbod, PADEN.teken]) {
    assert.ok(meting.gedekt.includes(pad)); assert.ok(!meting.bestuur.includes(pad));
  }
  for (const pad of rechten) assert.ok(meting.bestuur.includes(pad));
});
