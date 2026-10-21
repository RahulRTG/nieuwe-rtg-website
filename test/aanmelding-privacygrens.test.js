'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
function fixture() {
  const db = { data: {}, writable: true };
  const accounts = { sleutelVoor: () => Buffer.alloc(32, 1), getUserById: id => ({ id }),
    emailOf: () => 'amber@fixture.test', verifyToken: token => token === 'geldig' ? { id: 1 } : null };
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'memory', db, save() {} });
  const motor = require('../server/kern/aanmeldingen')({ db, accounts, bewerkCollectie, save() {}, crypto,
    schoon: (s, n) => String(s ?? '').trim().slice(0, n) }).aanmeldingen;
  return { db, accounts, motor, b: { idem: crypto.randomUUID(), pas: 'rtg', naam: 'Amber', contact: 'amber@fixture.test' } };
}
const privacy = f => ({ controleerAanmeldingOntvangsten: f.motor.controleerOntvangstRedactie,
  redigeerAanmeldingOntvangsten: f.motor.redigeerOntvangsten });

test('corrupte ontvangst weigert voordat zelfstandige anonimiseer iets wijzigt', async () => {
  for (const corrupt of ['sleutel', 'bewijs']) {
    const f = fixture(); await f.motor.aanvraagBedoeling(f.b, 1);
    f.db.data.posts = [{ comments: [{ key: 'user-1', who: 'Amber' }] }];
    if (corrupt === 'sleutel') f.db.data.aanmeldingOntvangsten.keyId = 'verkeerd';
    else Object.values(f.db.data.aanmeldingOntvangsten.ontvangsten)[0].ontvangst.at = null;
    const voor = JSON.stringify(f.db.data);
    const a = require('../server/kern/vergeten/anoniem')({ ...f, ...privacy(f) });
    assert.throws(() => a.anonimiseer('user-1', 'Amber', { account: { id: 1 } }), /herstel/);
    assert.equal(JSON.stringify(f.db.data), voor);
  }
});

test('hele wisLid doet preflight vóór eerste domeinwisser en krijgt alleen twee callbacks', async () => {
  const f = fixture(); await f.motor.aanvraagBedoeling(f.b, 1);
  f.db.data.aanmeldingOntvangsten.keyId = 'verkeerd';
  const voor = JSON.stringify(f.db.data); let posities = 0;
  const k = new Proxy({ ...f, mobVergeetLid() { posities++; f.db.data.fout = true; } }, {
    get(o, naam) { if (naam === 'aanmeldingen') throw Error('verboden brede domeintoegang'); return o[naam]; }
  });
  const vergeten = require('../server/kern/vergeten')(k, privacy(f));
  await assert.rejects(vergeten.wisLid({ key: 'user-1', account: { id: 1 } }), /herstel/);
  assert.equal(posities, 0); assert.equal(JSON.stringify(f.db.data), voor);
});

test('ontbrekende redactiepoort faalt vóór reacties of dossier verdwijnen', () => {
  const db = { data: { aanmeldingOntvangsten: {}, posts: [{ comments: [{ key: 'user-1' }] }] } };
  const voor = JSON.stringify(db.data);
  const a = require('../server/kern/vergeten/anoniem')({ db, accounts: {} });
  assert.throws(() => a.anonimiseer('user-1', null, {}), /redactiepoort/);
  assert.equal(JSON.stringify(db.data), voor);
});

test('opgeslagen extra receiptvelden komen nooit in een publiek antwoord', async () => {
  const f = fixture(); await f.motor.aanvraagBedoeling(f.b, null);
  Object.values(f.db.data.aanmeldingOntvangsten.ontvangsten)[0].ontvangst.notitie = 'PRIVATE_TEST_NOTE';
  const voor = JSON.stringify(f.db.data), r = await f.motor.aanvraagBedoeling(f.b, null);
  assert.equal(r.status, 503); assert.doesNotMatch(JSON.stringify(r), /PRIVATE_TEST_NOTE/);
  assert.equal(JSON.stringify(f.db.data), voor);
});

test('hash- en UUID-arrays zijn corrupt; preflight weigert vóór actorredactie', async () => {
  for (const veld of ['actor', 'afdruk', 'id', 'aanvraagId']) {
    const f = fixture(); await f.motor.aanvraagBedoeling(f.b, 1);
    const r = Object.values(f.db.data.aanmeldingOntvangsten.ontvangsten)[0];
    const obj = ['actor', 'afdruk'].includes(veld) ? r : r.ontvangst;
    obj[veld] = [obj[veld]]; f.db.data.aanmeldingen = [];
    const voor = JSON.stringify(f.db.data);
    assert.throws(() => f.motor.controleerOntvangstRedactie(), /herstel/);
    assert.throws(() => f.motor.redigeerOntvangsten({ accountId: 1 }), /herstel/);
    assert.equal(JSON.stringify(f.db.data), voor);
  }
});

test('na redactie zijn dezelfde en gewijzigde inhoud expliciet410, zonder nieuw effect', async () => {
  const f = fixture(); await f.motor.aanvraagBedoeling(f.b, null);
  f.db.data.aanmeldingen = [];
  for (const naam of [f.b.naam, 'Ander verzoek']) {
    const r = await f.motor.aanvraagBedoeling({ ...f.b, naam }, null);
    assert.equal(r.status, 410); assert.equal(r.ok, undefined);
    assert.equal(r.code, 'AANVRAAG_INTENTIE_VERBRUIKT');
    assert.deepEqual(r.ontvangst, { status: 'alVerwerkt' });
    assert.equal(f.db.data.aanmeldingen.length, 0);
  }
});

test('ongeldig meegestuurd token weigert; headerloze publieke aanvraag blijft beschikbaar', async () => {
  const f = fixture(), routes = new Map();
  require('../server/routes/aanmeldingen')({ app: { post(p, ...fn) { routes.set(p, fn.at(-1)); } },
    aanmeldingen: f.motor, accounts: f.accounts });
  async function roep(header, body = f.b) {
    let status = 200, data;
    await routes.get('/api/aanmelding/aanvraag')({ body, get: () => header, ip: 'fixture' },
      { status(n) { status = n; return this; }, json(r) { data = r; } });
    return { status, data };
  }
  const a = await roep('Bearer geldig'); assert.equal(a.status, 200);
  for (const header of ['Bearer verlopen', 'Basic xxx', 'Bearer '])
    assert.equal((await roep(header)).status, 401);
  assert.equal(f.db.data.aanmeldingen.length, 1);
  assert.deepEqual(await roep('Bearer geldig'), a);
  assert.equal((await roep(undefined, { ...f.b, idem: crypto.randomUUID() })).status, 200);
  assert.equal(f.db.data.aanmeldingen.length, 2);
});
