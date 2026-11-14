'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { fixture } = require('./abonnementsdiensten-fixture.cjs');
const noop = () => {};
function kassa(f) {
  const routes = new Map(), supplier = { code: 'ZAAK', name: 'Testzaak', tables: [{ name: '1' }] };
  f.db.data.posSales = { ZAAK: [] };
  const kern = { db: f.db, crypto, app: { post: (pad, ...fn) => routes.set(pad, fn.at(-1)) },
    supplierAuth: noop, zaakAbonnement: f.zaakAbonnement, POS_METHODS: ['contant', 'tafel'],
    logActivity: noop, sseToSupplier: noop, save: noop, pickupCode: () => 'BON', keuken: { boekVerkoopAf: noop } };
  const herhaling = require('../server/kern/kassa/herhaling')({ db: f.db, save: noop });
  require('../server/routes/supplier/kassa/verkoop')(kern, herhaling);
  require('../server/routes/supplier/kassa/afrekenen')(kern, herhaling);
  async function post(pad, body) {
    const res = { code: 200, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    await routes.get('/api/supplier/pos/' + pad)({ supplier, actor: { name: 'Eigenaar' }, body }, res);
    return res;
  }
  return { post };
}
test('echte kassacaller: nieuw geweigerd na 31 dagen; replay, afrekening en betaalherstel werken', async () => {
  const f = await fixture(), k = kassa(f);
  const body = { total: 12, method: 'tafel', room: '1', idem: 'eerste-bon' };
  const eerst = await k.post('sale', body); assert.equal(eerst.body.ok, true);
  f.beperk();
  assert.equal((await k.post('sale', { ...body, idem: 'nieuwe-bon' })).code, 402);
  const replay = await k.post('sale', body);
  assert.equal(replay.body.sale.id, eerst.body.sale.id); assert.equal(replay.body.herhaald, true);
  assert.equal(f.db.data.posSales.ZAAK.length, 1);
  const afrekening = await k.post('checkout', { room: '1', method: 'contant', idem: 'bestaande-rekening' });
  assert.equal(afrekening.body.ok, true); assert.equal(eerst.body.sale.settled, true);
  f.betaal(); assert.equal((await k.post('sale', { ...body, idem: 'na-herstel' })).body.ok, true);
});
test('zelfde kassacaller stopt nieuwe verkoop na contracteinde; bestaande rekening blijft betaalbaar', async () => {
  const f = await fixture(), k = kassa(f); f.betaal();
  await k.post('sale', { total: 10, method: 'tafel', room: '1', idem: 'voor-einde' });
  f.contract.eindigtOp = f.stand.at; f.contract.status = 'OPZEGGEND';
  assert.equal((await k.post('sale', { total: 3, method: 'contant', idem: 'na-einde' })).code, 402);
  assert.equal((await k.post('checkout', { room: '1', idem: 'afhandeling' })).body.ok, true);
});
test('echte uitnodigingseigenaar: alleen nieuwe uitgifte beperkt, replay/lijst/rotatie/intrekking intact', async () => {
  const f = await fixture(), kern = { db: f.db, crypto, accounts: {}, save: noop,
    zaakAbonnement: f.zaakAbonnement, logActivity: noop, notifySupplier: noop };
  const u = require('../server/routes/supplier/werving/uitnodiging')({ kern });
  const supplier = { code: 'ZAAK' }, actor = { name: 'Eigenaar' }, body = { naam: 'Collega', idem: 'invite-1' };
  const eerste = await u.maakInvite(supplier, actor, body); assert.equal(eerste.ok, true);
  f.beperk();
  assert.equal((await u.maakInvite(supplier, actor, { ...body, idem: 'invite-2' })).status, 402);
  assert.equal((await u.maakInvite(supplier, actor, body)).herhaald, true);
  assert.equal((await u.lijstInvites('ZAAK')).invites.length, 1);
  assert.equal((await u.roteerInvite('ZAAK', eerste.id, actor.name, 'rotate-1')).ok, true);
  assert.equal((await u.trekInviteIn('ZAAK', eerste.id, actor.name, 'Veilig intrekken')).ok, true);
  f.betaal(); assert.equal((await u.maakInvite(supplier, actor, { ...body, idem: 'invite-3' })).ok, true);
});
test('echte lifestyle-eigenaar gebruikt persoonlijke contractpoort; lezen, replay, intrekken en nazorg blijven', async () => {
  const f = await fixture('lifestyle'), cases = [], calls = { saves: 0, intake: 0 };
  const automatisch = require('../server/kern/aanmeldingen/abonnementen')({ db: f.db, accounts: {}, nu: () => f.stand.at });
  const save = () => calls.saves++;
  const lus = require('../server/kern/bureau/lus-wens')({ save,
    schoon: (s, n) => String(s || '').trim().slice(0, n), caseLijst: () => cases,
    caseOpen: (_key, b) => { const c = { ...b, id: 'case-' + cases.length, status: 'nieuw', tijdlijn: [], at: f.stand.at };
      cases.push(c); return { ok: true, zaak: c }; } });
  const kern = { aanmeldingen: { automatisch }, bureauBalie: {}, bureau: {
    cases: () => ({ zaken: cases }),
    lusIntake: (key, b) => { calls.intake++; return lus.lusIntake(key, b); },
    caseIntrek: (_key, id) => { cases.find(c => c.id === id).status = 'ingetrokken'; return { ok: true }; }
  } };
  const l = require('../server/kern/lifestyle')({ db: f.db, save, crypto, kern });
  const body = { titel: 'Een tafel', sleutel: 'persoonlijk-verzoek-1' };
  const eerste = l.conciergeVraag('user-1', body); assert.equal(eerste.ok, true);
  f.beperk();
  assert.equal(l.conciergeVraag('user-1', { ...body, sleutel: 'persoonlijk-verzoek-2' }).status, 402);
  const snapshot = JSON.stringify(cases), voor = { ...calls };
  assert.equal(l.conciergeVraag('user-1', body).verzoek.id, eerste.verzoek.id);
  for (const verschil of [{ titel: 'Een nieuw diner' }, { details: 'Nieuw werk' }, { categorie: 'restaurant' }])
    assert.equal(l.conciergeVraag('user-1', { ...body, ...verschil }).status, 409);
  cases[0].bron = 'andere-bureau-ingang';
  assert.equal(l.conciergeVraag('user-1', body).status, 409);
  assert.equal(cases[0].bron, 'andere-bureau-ingang'); cases[0].bron = 'verzoek';
  assert.deepEqual(calls, voor, 'replay/conflict maakt geen nieuw werk en slaat niets op');
  assert.equal(JSON.stringify(cases), snapshot, 'een oude sleutel herschrijft nooit de opdracht');
  assert.equal(l.conciergeVerzoeken('user-1').verzoeken.length, 1);
  assert.equal(l.conciergeIntrek('user-1', eerste.verzoek.id).ok, true);
  assert.equal(l.gzDossier('user-1', { titel: 'Nazorg', tekst: 'Afspraak blijft bereikbaar' }).ok, true);
  f.betaal(); assert.equal(l.conciergeVraag('user-1', { ...body, sleutel: 'persoonlijk-verzoek-3' }).ok, true);
});
