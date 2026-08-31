const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { WORLD_CONTRACT } = require('../server/kern/experience/contract');
const manifesten = require('../server/kern/experience/manifesten');
const { maakExperience } = require('../server/kern/experience');

function huis(opties) {
  opties = opties || {};
  const db = { data: {} };
  let saves = 0;
  const agendaItems = [];
  const kern = {
    codenaamVan: () => 'Lid Een',
    socialewereld: { kring: () => ({
      regels: [{ soort: 'bijeenkomst', titel: 'Diner vanavond', wanneer: '2026-08-29',
        status: 'vandaag', sig: 'aandacht', kenmerk: 'meet-1', app: 'Genootschap', link: '/apps/genootschap.html' }],
      bronnen: ['bijeenkomsten'], stil: []
    }) },
    geldwereld: { stand: () => ({
      regels: [{ soort: 'saldo', titel: 'RTG-wallet', status: 'rustig', sig: 'gezond',
        kenmerk: 'wallet', app: 'Betalen', link: '/apps/geld.html' }],
      bronnen: ['wallet'], stil: []
    }) },
    mijnReizen: () => ({
      reizen: [{ id: 'journey-1', bestemming: 'Dubai', onderdelen: [{ soort: 'vlucht',
        titel: 'EK 148', bestemming: 'Dubai', van: '2026-08-29', tijd: '19:30', status: 'vertraagd',
        sig: 'aandacht', kenmerk: 'flight-1', app: 'Vluchten', link: '/apps/vluchten.html' }] }],
      los: [], bronnen: ['vluchten'], stil: [], telling: { aandacht: 1 }
    }),
    kantoorwereld: { werkdag: () => ({
      regels: [{ soort: 'taak', titel: 'Factuur controleren', status: 'verlopen', sig: 'incident',
        kenmerk: 'task-1', app: 'Notities', link: '/apps/notities.html' }],
      bronnen: ['taken'], stil: []
    }) },
    onderwijs: { mijn: () => ({ fase: { id: 'havo', naam: 'Havo', trap: 'vo' }, jaar: 4,
      verder: { volgende: 'havo-5', doorstroom: [], via: null }, doelen: {} }) },
    leren: {
      lijstenVan: () => ({ status: 200, lijsten: [{ id: 'lijst-1', naam: 'Frans', aantal: 20,
        beste: { goed: 18, totaal: 20 }, at: '2026-08-29T10:00:00Z' }] }),
      projectenVan: () => ({ status: 200, projecten: [], uitnodigingen: [] })
    },
    agenda: { voegToe: async (owner, item) => {
      const bestaand = item.bron && agendaItems.find(x => x.bron === item.bron);
      if (bestaand) return { ok: true, item: bestaand, hergebruikt: true };
      const gemaakt = { id: 'ag' + String(agendaItems.length + 1), titel: item.titel,
        datum: item.datum, tijd: item.tijd || null, notitie: item.notitie || null,
        gedaan: false, bron: item.bron || null, owner };
      agendaItems.push(gemaakt); return { ok: true, item: gemaakt };
    } }
  };
  const experience = maakExperience({ kern, db, save: () => { saves++; },
    crypto: opties.crypto || crypto,
    nu: opties.nu }).experience;
  return { db, kern, experience, agendaItems, saves: () => saves };
}

test('vier manifests voldoen aan hetzelfde harde World Contract', () => {
  assert.equal(WORLD_CONTRACT.projection.ownsSourceData, false);
  assert.equal(WORLD_CONTRACT.actions.brokered, true);
  assert.deepEqual(manifesten.ids(), ['living', 'travel', 'work', 'foundation']);
  for (const m of Object.values(manifesten.publiek())) {
    assert.equal(m.rahul.directExecution, false);
    assert.ok(m.home.projection.endsWith('.v1'));
    assert.ok(m.navigation.defaults.length <= m.navigation.slots);
  }
  assert.ok(manifesten.haal('foundation').governance.prohibit.includes('human_worth_scoring'));
});

test('alle werelden leveren context, provenance, freshness, object refs en echte projections', () => {
  const { experience } = huis();
  for (const world of manifesten.ids()) {
    const b = experience.bootstrap({ key: 'member-key', world });
    assert.equal(b.ok, true, world);
    assert.equal(b.currentWorld, world);
    assert.equal(b.projection.world, world);
    assert.equal(b.projection.provenance.ownsSourceData, false);
    assert.equal(b.projection.freshness.status, 'FRESH');
    assert.match(b.projection.snapshotHash, /^[a-f0-9]{64}$/);
    assert.ok(b.projection.objects.length, world + ' projecteert geen objecten');
    assert.ok(b.projection.objects.every(o => o.ref.domain && o.ref.type && o.ref.id));
  }
});

test('een stille bron maakt de projection PARTIAL en nooit stilletjes compleet', () => {
  const h = huis();
  h.kern.kantoorwereld.werkdag = () => ({ regels: [], bronnen: ['agenda', 'taken'], stil: ['agenda'] });
  const p = h.experience.projection({ key: 'k', world: 'work' });
  assert.equal(p.completeness.status, 'PARTIAL');
  assert.deepEqual(p.completeness.missingSources, ['agenda']);
});

test('Foundation projecteert alleen ontwikkelbronnen en neemt geen score mee', () => {
  const { experience } = huis();
  const p = experience.projection({ key: 'k', world: 'foundation' });
  assert.deepEqual(p.provenance.sources, ['onderwijs', 'leren.lijsten', 'leren.projecten']);
  assert.equal(p.objects.some(o => o.ref.domain === 'agenda'), false);
  assert.equal(Object.hasOwn(p.view.learning.lists[0], 'beste'), false);
  assert.equal(p.view.safeguards.humanWorthScoring, false);
});

test('attention loopt via preview, bevestiging, idempotency en append-only evidence', async () => {
  const { experience } = huis();
  const b = experience.bootstrap({ key: 'member-key', world: 'travel' });
  const aandacht = b.projection.attention[0];
  assert.equal(aandacht.lifecycle, 'PRESENTED');
  assert.equal(aandacht.primaryWorld, 'travel');

  const preview = experience.preview('member-key', {
    intent: 'attention.acknowledge', version: 1, contextId: b.currentContext.id,
    parameters: { world: 'travel', attentionId: aandacht.id }
  });
  assert.equal(preview.ok, true);
  assert.equal(preview.preview.policyDecision.decision, 'ALLOW_WITH_CONFIRMATION');

  const zonderMens = await experience.execute('member-key', {
    previewId: preview.preview.id, idempotencyKey: 'travel-att-001', confirmed: false
  });
  assert.equal(zonderMens.code, 'CONFIRMATION_REQUIRED');

  const eerste = await experience.execute('member-key', {
    previewId: preview.preview.id, idempotencyKey: 'travel-att-001', confirmed: true
  });
  assert.equal(eerste.ok, true);
  assert.equal(eerste.attention.lifecycle, 'ACKNOWLEDGED');
  assert.match(eerste.evidence.hash, /^[a-f0-9]{64}$/);

  const herhaling = await experience.execute('member-key', {
    previewId: preview.preview.id, idempotencyKey: 'travel-att-001', confirmed: true
  });
  assert.equal(herhaling.ok, true);
  assert.equal(herhaling.replay, true);
  assert.equal(herhaling.evidence.id, eerste.evidence.id);

  const opnieuw = experience.preview('member-key', {
    intent: 'attention.acknowledge', version: 1,
    parameters: { world: 'travel', attentionId: aandacht.id }
  });
  assert.equal(opnieuw.code, 'ATTENTION_ALREADY_ACKNOWLEDGED');
  assert.equal(experience.evidence('member-key').evidence.length, 1);
});

test('resume accepteert alleen server-afgeleide context en veilige surfaces', () => {
  const { experience } = huis();
  const b = experience.bootstrap({ key: 'member-key', world: 'work' });
  const goed = experience.resumeZet('member-key', { world: 'work', contextId: b.currentContext.id,
    surface: '/apps/kantoor.html', objectRef: b.projection.objects[0].ref,
    navigationState: ['home', 'attention'] });
  assert.equal(goed.ok, true);
  assert.equal(experience.bootstrap({ key: 'member-key' }).currentWorld, 'work');
  assert.equal(experience.resumeZet('member-key', { world: 'work', contextId: 'ctx_verzonnen' }).status, 403);
  assert.equal(experience.resumeZet('member-key', { world: 'work', surface: 'javascript:alert(1)' }).status, 400);
});

test('context-identiteit blijft stabiel bij een nieuwe codenaam en bevat geen naam', () => {
  const h = huis();
  h.kern.codenaamVan = () => 'Oude Codenaam';
  const voor = h.experience.bootstrap({ key: 'stabiele-account-key', world: 'living' });
  h.kern.codenaamVan = () => 'Nieuwe Codenaam';
  const na = h.experience.bootstrap({ key: 'stabiele-account-key', world: 'living' });
  assert.equal(na.currentContext.id, voor.currentContext.id);
  assert.equal(JSON.stringify(na.currentContext).includes('Oude Codenaam'), false);
  assert.equal(JSON.stringify(na.currentContext).includes('Nieuwe Codenaam'), false);
});

test('schedule gebruikt hetzelfde registry, context, policy, bevestiging en evidence-pad', async () => {
  const h = huis();
  const boot = h.experience.bootstrap({ key: 'member-key', world: 'work' });
  const definition = boot.intents.find(i => i.id === 'schedule.item.create');
  assert.equal(definition.runtime, 'agenda');
  assert.equal(definition.consequence, 'DOMAIN_TRUTH');

  const vals = { title: 'Premium review', date: '2026-09-04', time: '09:30', note: 'Golden path' };
  const vreemd = h.experience.preview('member-key', { intent: definition.id, version: 1,
    world: 'work', contextId: 'ctx_verzonnen', parameters: vals });
  assert.equal(vreemd.code, 'CONTEXT_NOT_ALLOWED');
  const onmogelijkeDatum = h.experience.preview('member-key', { intent: definition.id, version: 1,
    world: 'work', contextId: boot.currentContext.id,
    parameters: { ...vals, date: '2026-02-31' } });
  assert.equal(onmogelijkeDatum.code, 'INVALID_DATE');

  const preview = h.experience.preview('member-key', { intent: definition.id, version: 1,
    world: 'work', contextId: boot.currentContext.id, parameters: vals });
  assert.equal(preview.ok, true);
  assert.equal(preview.preview.policyDecision.policyId, 'policy:own-schedule');
  assert.match(preview.preview.policyDecision.inputHash, /^[a-f0-9]{64}$/);
  assert.equal(preview.preview.consequence.changesDomainTruth, true);

  const zonderMens = await h.experience.execute('member-key', { previewId: preview.preview.id,
    idempotencyKey: 'schedule-premium-001', confirmed: false });
  assert.equal(zonderMens.code, 'CONFIRMATION_REQUIRED');
  const eerste = await h.experience.execute('member-key', { previewId: preview.preview.id,
    idempotencyKey: 'schedule-premium-001', confirmed: true });
  assert.equal(eerste.ok, true);
  assert.equal(eerste.item.titel, 'Premium review');
  assert.deepEqual(eerste.objectRef, { domain: 'agenda', type: 'afspraak', id: 'ag1' });
  assert.equal(h.agendaItems.length, 1);

  const zelfdePreview = h.experience.preview('member-key', { intent: definition.id, version: 1,
    world: 'work', contextId: boot.currentContext.id, parameters: vals });
  const replay = await h.experience.execute('member-key', { previewId: zelfdePreview.preview.id,
    idempotencyKey: 'schedule-premium-001', confirmed: true });
  assert.equal(replay.replay, true);
  assert.equal(replay.evidence.id, eerste.evidence.id);
  assert.equal(h.agendaItems.length, 1);

  const anders = h.experience.preview('member-key', { intent: definition.id, version: 1,
    world: 'work', contextId: boot.currentContext.id,
    parameters: { ...vals, title: 'Andere afspraak' } });
  const conflict = await h.experience.execute('member-key', { previewId: anders.preview.id,
    idempotencyKey: 'schedule-premium-001', confirmed: true });
  assert.equal(conflict.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(h.experience.evidence('member-key').evidence.length, 1);
});

test('evidence vormt per actor een zelfstandig verifieerbare keten en detecteert manipulatie', async () => {
  const h = huis();
  async function plan(key, title, idem) {
    const boot = h.experience.bootstrap({ key, world: 'living' });
    const preview = h.experience.preview(key, { intent: 'schedule.item.create', version: 1,
      world: 'living', contextId: boot.currentContext.id,
      parameters: { title, date: '2026-09-07', time: '12:00' } });
    return h.experience.execute(key, { previewId: preview.preview.id,
      idempotencyKey: idem, confirmed: true });
  }
  await plan('actor-a-key', 'A eerste', 'actor-a-action-001');
  await plan('actor-b-key', 'B eerste', 'actor-b-action-001');
  await plan('actor-a-key', 'A tweede', 'actor-a-action-002');

  const a = h.experience.evidence('actor-a-key');
  const b = h.experience.evidence('actor-b-key');
  assert.equal(a.integrity.status, 'VERIFIED');
  assert.equal(a.integrity.valid, true);
  assert.equal(a.integrity.count, 2);
  assert.equal(a.evidence[0].previousHash, null);
  assert.equal(a.evidence[1].previousHash, a.evidence[0].hash);
  assert.equal(b.integrity.status, 'VERIFIED');
  assert.equal(b.evidence.length, 1);
  assert.equal(b.evidence[0].previousHash, null,
    'de eerste actor-B-entry mag niet naar verborgen actor-A-evidence wijzen');

  const stuk = h.db.data.experiencePlatform.evidence.find(e => e.actor === a.integrity.actor);
  stuk.result.item.titel = 'gemanipuleerd';
  const kapot = h.experience.evidence('actor-a-key');
  assert.equal(kapot.integrity.valid, false);
  assert.equal(kapot.integrity.status, 'INVALID');
  assert.equal(kapot.integrity.reason, 'HASH_MISMATCH');
  assert.equal(h.experience.evidence('actor-b-key').integrity.valid, true,
    'manipulatie in actor A mag actor B niet onbewijsbaar maken');

  await plan('actor-c-key', 'C eerste', 'actor-c-action-001');
  await plan('actor-c-key', 'C tweede', 'actor-c-action-002');
  const cActor = h.experience.evidence('actor-c-key').integrity.actor;
  const cEerste = h.db.data.experiencePlatform.evidence.findIndex(e => e.actor === cActor);
  h.db.data.experiencePlatform.evidence.splice(cEerste, 1);
  const gat = h.experience.evidence('actor-c-key');
  assert.equal(gat.integrity.valid, false);
  assert.equal(gat.integrity.reason, 'CHAIN_MISMATCH');
});

test('preview-eigendom, verloop en runtimefouten laten geen half bewijs of dubbele actie achter', async () => {
  const h = huis();
  const boot = h.experience.bootstrap({ key: 'eigenaar-key', world: 'work' });
  const invoer = { intent: 'schedule.item.create', version: 1, world: 'work',
    contextId: boot.currentContext.id,
    parameters: { title: 'Herstelbare actie', date: '2026-09-08', time: '13:00' } };
  const preview = h.experience.preview('eigenaar-key', invoer);
  const gestolen = await h.experience.execute('andere-actor-key', { previewId: preview.preview.id,
    idempotencyKey: 'stolen-action-001', confirmed: true });
  assert.equal(gestolen.code, 'PREVIEW_NOT_FOUND');

  const echt = h.kern.agenda.voegToe;
  let faalt = true;
  h.kern.agenda.voegToe = async function () {
    if (faalt) { faalt = false; return { error: 'Tijdelijke opslagstoring.', status: 503,
      code: 'TEMPORARY_WRITE_FAILURE' }; }
    return echt.apply(this, arguments);
  };
  const mislukt = await h.experience.execute('eigenaar-key', { previewId: preview.preview.id,
    idempotencyKey: 'recoverable-action-001', confirmed: true });
  assert.equal(mislukt.code, 'TEMPORARY_WRITE_FAILURE');
  assert.equal(h.agendaItems.length, 0);
  assert.equal(h.experience.evidence('eigenaar-key').evidence.length, 0);

  const hersteld = await h.experience.execute('eigenaar-key', { previewId: preview.preview.id,
    idempotencyKey: 'recoverable-action-001', confirmed: true });
  assert.equal(hersteld.ok, true);
  assert.equal(h.agendaItems.length, 1);
  assert.equal(h.experience.evidence('eigenaar-key').evidence.length, 1);

  let klok = '2026-08-29T12:00:00.000Z';
  const oud = huis({ nu: () => klok });
  const oudBoot = oud.experience.bootstrap({ key: 'oud-key', world: 'living' });
  const verlopen = oud.experience.preview('oud-key', { ...invoer, world: 'living',
    contextId: oudBoot.currentContext.id });
  klok = '2026-08-29T12:06:00.000Z';
  const teLaat = await oud.experience.execute('oud-key', { previewId: verlopen.preview.id,
    idempotencyKey: 'expired-action-001', confirmed: true });
  assert.equal(teLaat.code, 'PREVIEW_EXPIRED');
  assert.equal(oud.agendaItems.length, 0);
  assert.equal(oud.experience.evidence('oud-key').evidence.length, 0);
});

test('een crash tussen domeinschrijving en finalization herstelt zonder dubbele afspraak', async () => {
  let randomCalls = 0;
  const cryptoMetEenCrash = Object.create(crypto);
  cryptoMetEenCrash.randomBytes = function (n) {
    randomCalls++;
    if (randomCalls === 2) throw new Error('geïnjecteerde crash voor evidence');
    return crypto.randomBytes(n);
  };
  const h = huis({ crypto: cryptoMetEenCrash });
  const boot = h.experience.bootstrap({ key: 'crash-key', world: 'living' });
  const preview = h.experience.preview('crash-key', { intent: 'schedule.item.create', version: 1,
    world: 'living', contextId: boot.currentContext.id,
    parameters: { title: 'Crashbestendig', date: '2026-09-10', time: '09:00' } });
  const opdracht = { previewId: preview.preview.id,
    idempotencyKey: 'crash-recovery-001', confirmed: true };
  await assert.rejects(() => h.experience.execute('crash-key', opdracht), /geïnjecteerde crash/);
  assert.equal(h.agendaItems.length, 1, 'de domeinschrijving was al gebeurd');
  assert.equal(h.experience.evidence('crash-key').evidence.length, 0,
    'zonder finalization bestaat nog geen vals bewijs');

  const hersteld = await h.experience.execute('crash-key', opdracht);
  assert.equal(hersteld.ok, true);
  assert.equal(h.agendaItems.length, 1, 'retry gebruikt dezelfde bron en dupliceert niet');
  assert.equal(h.experience.evidence('crash-key').evidence.length, 1);
  assert.equal(h.experience.evidence('crash-key').integrity.valid, true);
});
