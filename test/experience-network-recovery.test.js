/* Een bewaard netwerkplan blijft hetzelfde domeinobject na een fout voor
   action-evidence, ook na runtimeherstart. Geen boeking of betaling. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { fixture, request, choices } = require('./network-fixture');
const { maakMall } = require('../server/kern/mall');
const { maakExperience } = require('../server/kern/experience');
function preview(h) {
  return h.experience.preview('alice', { world: 'work', intent: 'network.plan.save',
    parameters: { title: 'Mijn netwerkplan', choices: choices(h.experience.network(request())) } }).preview;
}
const body = p => ({ previewId: p.id, idempotencyKey: 'network-recovery-001', confirmed: true });
function restart(h) {
  const db = { data: JSON.parse(JSON.stringify(h.db.data)) }, save = () => {};
  require('../server/kern/werkvormen').haakAan(db);
  const bijeen = async fn => fn();
  const mall = maakMall({ db, save, bijeen, crypto, isRetail: s => s.type === 'retail',
    haalThuis: () => null, haalLandVind: () => null }).mall;
  const kern = { ...h.kern, mall };
  const experience = maakExperience({ db, kern, save, bijeen, crypto }).experience;
  return { db, kern, experience: { ...experience,
    execute: (key, input) => experience.execute(key, input, () => null)
  } };
}
async function failAfterList(t, h, p) {
  const original = crypto.randomBytes;
  const stub = t.mock.method(crypto, 'randomBytes', function (...args) {
    if (h.kern.mall.mallLijsten.mijn('alice').lijsten.length)
      throw Error('gesimuleerde uitval voor action evidence');
    return original.apply(this, args);
  });
  try { await assert.rejects(h.experience.execute('alice', body(p)), /uitval voor action evidence/); }
  finally { stub.mock.restore(); }
  assert.equal(h.kern.mall.mallLijsten.mijn('alice').lijsten.length, 1);
  assert.equal(h.experience.evidence('alice').evidence.length, 0);
  return h.kern.mall.mallLijsten.mijn('alice').lijsten[0].id;
}
test('netwerkplan herstelt domeinsave zonder evidence na volledige runtimeherstart', async t => {
  const h = fixture(), p = preview(h), id = await failAfterList(t, h, p), fresh = restart(h);
  assert.equal((await fresh.experience.execute('bob', body(p))).code, 'PREVIEW_NOT_FOUND');
  const result = await fresh.experience.execute('alice', body(p));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.list.id, id, 'herstel moet het oorspronkelijke domeinobject teruggeven');
  assert.equal(result.bookingStatus, 'NOT_BOOKED');
  assert.equal(fresh.kern.mall.mallLijsten.mijn('alice').lijsten.length, 1);
  assert.equal(fresh.kern.mall.mallLijsten.mijn('bob').lijsten.length, 0);
  assert.equal(fresh.experience.evidence('alice').evidence.length, 1);
  const replay = await fresh.experience.execute('alice', body(p));
  assert.equal(replay.replay, true);
  assert.equal(replay.list.id, id);
  assert.equal(fresh.experience.evidence('alice').evidence.length, 1);
});
test('historisch lijstherstel blijft mogelijk na intrekking van aanbod', async t => {
  const h = fixture(), p = preview(h), id = await failAfterList(t, h, p);
  h.db.data.suppliers[0].mall = { verborgen: true };
  const fresh = restart(h), result = await fresh.experience.execute('alice', body(p));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.list.id, id);
  assert.equal(fresh.kern.mall.mallLijsten.mijn('alice').lijsten.length, 1);
  assert.equal(fresh.kern.mall.mallLijsten.toon('alice', id).vervallen, 1);
  assert.equal(fresh.experience.evidence('alice').evidence.length, 1);
});

function command(p) {
  return { data: { naam: p.parameters.title, ids: p.parameters.choices.map(c => c.id) },
    bron: { bron: 'experience:' + p.id, actor: p.policyDecision.actor,
      revisies: p.parameters.choices.map(c => c.revision) } };
}
test('Mall-herstel bindt actor en volledige invoer en lekt geen interne metadata', () => {
  const h = fixture(), p = preview(h), { data, bron } = command(p), lists = h.kern.mall.mallLijsten;
  const first = lists.samenstellen('alice', data, bron);
  assert.equal(first.ok, true);
  assert.equal(lists.samenstellen('bob', data, bron).code, 'LIST_RECOVERY_ACTOR');
  for (const [d, b] of [[{ ...data, naam: 'Ander plan' }, bron],
    [{ ...data, ids: ['anders'] }, bron], [data, { ...bron, revisies: ['0'.repeat(64)] }]]) {
    assert.equal(lists.samenstellen('alice', d, b).code, 'LIST_RECOVERY_CONFLICT');
  }
  const again = lists.samenstellen('alice', data, bron);
  assert.equal(again.lijst.id, first.lijst.id);
  assert.equal(again.hergebruikt, true);
  assert.equal(lists.mijn('alice').lijsten.length, 1);
  assert.equal(lists.mijn('bob').lijsten.length, 0);
  for (const result of [first, again, lists.mijn('alice'), lists.toon('alice', first.lijst.id),
    lists.zet('alice', first.lijst.id, { naam: 'Zelf gewijzigd' })]) {
    assert.doesNotMatch(JSON.stringify(result), /samenstellingBron|invoerHash|experience:xpv_/);
  }
});
test('herstel geeft oorspronkelijke ontvangst zonder latere lijstwijzigingen terug te draaien', async t => {
  const h = fixture(), p = preview(h), id = await failAfterList(t, h, p), lists = h.kern.mall.mallLijsten;
  lists.zet('alice', id, { naam: 'Mijn eigen nieuwe titel' });
  lists.haalWeg('alice', id, p.parameters.choices[0].id);
  const fresh = restart(h), result = await fresh.experience.execute('alice', body(p));
  assert.deepEqual(result.list, { id, title: 'Mijn netwerkplan', count: 1 });
  const actual = fresh.kern.mall.mallLijsten.toon('alice', id).lijst;
  assert.equal(actual.naam, 'Mijn eigen nieuwe titel');
  assert.equal(actual.regels.length, 0);
});
test('gewone Mall-lijsten krijgen geen herstelidentiteit en blijven onafhankelijk', () => {
  const h = fixture(), p = preview(h), { data, bron } = command(p), lists = h.kern.mall.mallLijsten;
  const a = lists.samenstellen('alice', data), b = lists.samenstellen('alice', data);
  assert.equal(a.ok, true); assert.equal(b.ok, true);
  assert.notEqual(a.lijst.id, b.lijst.id);
  const plain = lists.maak('alice', { naam: 'Handmatig', samenstellingBron: bron });
  assert.equal(plain.ok, true);
  assert.equal(lists.herstelSamenstelling('alice', data, bron), null);
  assert.equal(lists.zet('alice', plain.lijst.id, { naam: 'Gewijzigd' }).lijst.naam, 'Gewijzigd');
  assert.equal(lists.weg('alice', plain.lijst.id).ok, true);
  assert.equal(lists.mijn('alice').lijsten.length, 2);
});
test('bestaande ontvangst herstelt ook als de lijstenlimiet intussen is bereikt', async t => {
  const h = fixture(), p = preview(h), id = await failAfterList(t, h, p), lists = h.kern.mall.mallLijsten;
  for (let i = 1; i < lists.MAX_LIJSTEN; i++) assert.equal(lists.maak('alice', { naam: 'Lijst ' + i }).ok, true);
  const result = await h.experience.execute('alice', body(p));
  assert.equal(result.list.id, id);
  assert.equal(lists.mijn('alice').lijsten.length, lists.MAX_LIJSTEN);
});

test('een verwijderd netwerkplan wordt na uitval en herstart nooit opnieuw aangemaakt', async t => {
  const h = fixture(), p = preview(h), id = await failAfterList(t, h, p), lists = h.kern.mall.mallLijsten;
  assert.deepEqual(lists.weg('alice', id), { ok: true, aantal: 0 });
  const fresh = restart(h), result = await fresh.experience.execute('alice', body(p));
  assert.equal(result.code, 'LIST_RECOVERY_DELETED');
  assert.equal(fresh.kern.mall.mallLijsten.mijn('alice').lijsten.length, 0);
  assert.equal(fresh.experience.evidence('alice').evidence.length, 0);
  const tomb = fresh.db.data.mallLijsten.alice[0];
  assert.deepEqual(Object.keys(tomb).sort(), ['id', 'samenstellingBron', 'verwijderdAt']);
  assert.deepEqual(Object.keys(tomb.samenstellingBron).sort(), ['actor', 'bron', 'invoerHash']);
  assert.equal(tomb.id, id);
  assert.ok(Number.isFinite(Date.parse(tomb.verwijderdAt)));
});
test('verwijderd ontvangstbewijs blijft buiten lijst-API, capaciteit en Bewaard', async t => {
  const h = fixture(), p = preview(h), id = await failAfterList(t, h, p), lists = h.kern.mall.mallLijsten;
  lists.weg('alice', id);
  const tomb = h.db.data.mallLijsten.alice.find(l => l.id === id);
  assert.ok(tomb && tomb.verwijderdAt, 'ontvangst blijft bestaan zonder lijstinhoud');
  for (const out of [lists.toon('alice', id), lists.zet('alice', id, { naam: 'Terug' }),
    lists.voegToe('alice', id, p.parameters.choices[0].id),
    lists.haalWeg('alice', id, p.parameters.choices[0].id), lists.weg('alice', id)]) {
    assert.equal(out.status, 404);
  }
  assert.equal(lists.mallWijzigingen('alice').bekeken, 0);
  assert.equal(lists.bewaardeIds('alice').size, 0);
  assert.equal(lists.bewaarWissel('alice', p.parameters.choices[0].id).bewaard, true);
  assert.equal(lists.mallWijzigingen('alice').bekeken, 1);
  assert.equal(lists.bewaardeIds('alice').size, 1);
  for (let i = 1; i < lists.MAX_LIJSTEN; i++) assert.equal(lists.maak('alice', { naam: 'Lijst ' + i }).ok, true);
  assert.equal(lists.mijn('alice').lijsten.length, lists.MAX_LIJSTEN);
  assert.equal(lists.maak('alice', { naam: 'Te veel' }).status, 409);
  const removable = lists.mijn('alice').lijsten.find(l => l.soort === 'lijst');
  lists.weg('alice', removable.id);
  const { data } = command(p);
  assert.equal(lists.samenstellen('alice', data).ok, true);
  assert.equal(lists.mijn('alice').lijsten.length, lists.MAX_LIJSTEN);
  assert.equal(lists.bewaarWissel('alice', p.parameters.choices[0].id).bewaard, false);
  assert.equal(lists.mallWijzigingen('alice').bekeken, 1);
});
