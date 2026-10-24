'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const schoon = (x, n) => String(x ?? '').replace(/[<>]/g, '').trim().slice(0, n);
const kopie = x => JSON.parse(JSON.stringify(x));
function fixture(data = {}, opties = {}) {
  const db = { data, writable: true }, key = Buffer.alloc(32, opties.keyByte || 1);
  const accounts = { getUserById: id => [1, 2].includes(id) ? { id } : null,
    sleutelVoor: () => key, emailOf: () => 'amber@fixture.test' };
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'memory', db,
    save: () => { if (opties.fout) throw Error('commit faalt'); } });
  const motor = require('../server/kern/aanmeldingen')({ db, save() {}, crypto, schoon,
    accounts, bewerkCollectie }).aanmeldingen;
  return { db, accounts, motor };
}
const body = () => ({ idem: crypto.randomUUID(), pas: 'rtg', naam: 'Amber', contact: 'amber@fixture.test' });
const verbruikt = { status: 410, code: 'AANVRAAG_INTENTIE_VERBRUIKT', ontvangst: { status: 'alVerwerkt' } };

test('UUID-intentie verplicht; interne core blijft synchroon zonder idem', async () => {
  const f = fixture(), b = body();
  for (const idem of [undefined, null, '', 'oude-vrije-sleutel', {}, 1, '00000000-0000-0000-0000-000000000000'])
    assert.equal((await f.motor.aanvraagBedoeling({ ...b, idem }, null)).status, 400);
  assert.deepEqual(f.db.data, {});
  const intern = f.motor.aanvraag({ pas: 'rtg', naam: 'Interne aanvraag' });
  assert.equal(intern.ok, true); assert.equal(intern.then, undefined); assert.ok(intern.aanmelding.id);
});

test('same intent replayt compact eerste bewijs; gewijzigd 409, nieuwe intentie nieuw', async () => {
  const f = fixture(), b = body(), a = await f.motor.aanvraagBedoeling(b, 1);
  assert.equal(a.ok, true); assert.equal(a.ontvangst.status, 'ontvangen');
  assert.deepEqual(Object.keys(a.ontvangst).sort(), ['aanvraagId', 'at', 'id', 'status']);
  assert.deepEqual(await f.motor.aanvraagBedoeling({ ...b, naam: ' Amber ' }, 1), a);
  assert.equal((await f.motor.aanvraagBedoeling({ ...b, contact: 'anders' }, 1)).status, 409);
  const n = await f.motor.aanvraagBedoeling({ ...b, idem: crypto.randomUUID() }, 1);
  assert.notEqual(n.ontvangst.aanvraagId, a.ontvangst.aanvraagId);
  assert.equal(f.db.data.aanmeldingen.length, 2);
  assert.doesNotMatch(JSON.stringify(f.db.data.aanmeldingOntvangsten), /Amber|amber@fixture|naam|contact|bedrijfsbehoefte/);
  const db = kopie(f.db.data), restart = fixture(db);
  assert.deepEqual(await restart.motor.aanvraagBedoeling(b, 1), a);
});

test('bedrijf wordt eenmaal genormaliseerd; wijzigingen blijven conflict', async () => {
  const f = fixture(), b = { ...body(), bedrijf: { naam: '  Zaak  ', type: 'vakwerk', plaats: '  Utrecht ', behoeften: [' Offerte '] } };
  const a = await f.motor.aanvraagBedoeling(b, 1); assert.equal(a.ok, true);
  assert.deepEqual(await f.motor.aanvraagBedoeling({ ...b, bedrijf: { ...b.bedrijf, naam: 'Zaak' } }, 1), a);
  assert.equal((await f.motor.aanvraagBedoeling({ ...b, bedrijf: { ...b.bedrijf, behoeften: ['Anders'] } }, 1)).status, 409);
  assert.equal(f.motor.een(a.ontvangst.aanvraagId).aanmelding.bedrijf.plaats, 'Utrecht');
});

test('actor komt uitsluitend van server; anonieme replay lekt geen besluit of persoonsinhoud', async () => {
  const f = fixture(), b = body();
  const a = await f.motor.aanvraagBedoeling(b, 1), andere = await f.motor.aanvraagBedoeling(b, 2);
  const anon = await f.motor.aanvraagBedoeling({ ...b, accountId: 1 }, null);
  assert.notEqual(a.ontvangst.aanvraagId, andere.ontvangst.aanvraagId);
  assert.notEqual(a.ontvangst.aanvraagId, anon.ontvangst.aanvraagId);
  const dossier = f.db.data.aanmeldingen.find(x => x.id === anon.ontvangst.aanvraagId);
  assert.equal(dossier.accountId, null);
  dossier.besluit = { door: 'Kantoor', notitie: 'PRIVE_NOTITIE' }; dossier.gezaakt = { code: 'PRIVE_ZAAK', staffId: 7 };
  const opnieuw = await f.motor.aanvraagBedoeling(b, null);
  assert.deepEqual(opnieuw, anon); assert.doesNotMatch(JSON.stringify(opnieuw), /PRIVE|Amber|amber@/);
  assert.equal((await f.motor.aanvraagBedoeling(b, 999)).status, 401);
});

test('ontvangst na 5000-venster en JSON-herstart voorkomt hercreatie met minimale status', async () => {
  const f = fixture(), b = body(), a = await f.motor.aanvraagBedoeling(b, null);
  const rij = f.db.data.aanmeldingen[0];
  f.db.data.aanmeldingen = [...Array.from({ length: 4999 }, (_, i) => ({ id: 'oud-' + i })), rij];
  await f.motor.aanvraagBedoeling({ ...b, idem: crypto.randomUUID() }, null);
  const g = fixture(kopie(f.db.data));
  const r = await g.motor.aanvraagBedoeling(b, null);
  assert.deepEqual(r, verbruikt);
  assert.equal(g.db.data.aanmeldingen.length, 5000);
  assert.equal(g.db.data.aanmeldingen.some(x => x.id === a.ontvangst.aanvraagId), false);
  assert.deepEqual(await g.motor.aanvraagBedoeling({ ...b, naam: 'gewijzigd' }, null), r);
});

test('commitfout, corrupt ontvangstschema en sleutelwissel maken geen nieuwe aanvraag', async () => {
  const b = body(), f = fixture({}, { fout: true });
  await assert.rejects(f.motor.aanvraagBedoeling(b, null), /commit faalt/); assert.deepEqual(f.db.data, {});
  const g = fixture(); await g.motor.aanvraagBedoeling(b, null);
  const voor = kopie(g.db.data), andereKey = fixture(kopie(voor), { keyByte: 2 });
  assert.equal((await andereKey.motor.aanvraagBedoeling(b, null)).status, 503);
  assert.deepEqual(andereKey.db.data, voor);
  const corrupt = fixture({ aanmeldingen: [], aanmeldingOntvangsten: { schema: 999 } });
  assert.equal((await corrupt.motor.aanvraagBedoeling(b, null)).status, 503);
  assert.equal(corrupt.db.data.aanmeldingen.length, 0);
  const leegMaarBestaand = fixture({ aanmeldingen: [], aanmeldingOntvangsten: {} });
  assert.equal((await leegMaarBestaand.motor.aanvraagBedoeling(b, null)).status, 503);
  assert.equal(leegMaarBestaand.db.data.aanmeldingen.length, 0);
});

test('redactie raakt uitsluitend eigen actor; andere ontvangst behoudt eerste resultaat', async () => {
  const f = fixture(), b = body(); await f.motor.aanvraagBedoeling(b, 1);
  const b2 = { ...b, contact: 'andere-eigenaar@fixture.test' };
  const ander = await f.motor.aanvraagBedoeling(b2, 2);
  const eigenRij = f.db.data.aanmeldingen.find(a => a.accountId === 1);
  eigenRij.contact = '';
  require('../server/kern/vergeten/anoniem')({ db: f.db, accounts: f.accounts,
    controleerAanmeldingOntvangsten: f.motor.controleerOntvangstRedactie,
    redigeerAanmeldingOntvangsten: f.motor.redigeerOntvangsten }).anonimiseer('user-1', null, { account: { id: 1 } });
  assert.equal(eigenRij.accountId, null); assert.equal(eigenRij.naam, '(op verzoek verwijderd)');
  assert.deepEqual(await f.motor.aanvraagBedoeling(b, 1), verbruikt);
  assert.deepEqual(await f.motor.aanvraagBedoeling(b2, 2), ander);
});

test('bestaande vergeetpad redigeert receipts, inclusief buiten het aanvraagvenster', async () => {
  const f = fixture(), b = body(); await f.motor.aanvraagBedoeling(b, 1);
  f.db.data.aanmeldingen = [];
  require('../server/kern/vergeten/anoniem')({ db: f.db, accounts: f.accounts,
    controleerAanmeldingOntvangsten: f.motor.controleerOntvangstRedactie,
    redigeerAanmeldingOntvangsten: f.motor.redigeerOntvangsten }).anonimiseer('user-1', null, { account: { id: 1 } });
  const r = await f.motor.aanvraagBedoeling(b, 1);
  assert.deepEqual(r, verbruikt);
  const receipt = Object.values(f.db.data.aanmeldingOntvangsten.ontvangsten)[0];
  assert.deepEqual(receipt, { geredigeerd: true });
});
