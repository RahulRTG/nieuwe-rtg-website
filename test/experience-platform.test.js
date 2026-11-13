const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { WORLD_CONTRACT } = require('../server/kern/experience/contract');
const manifesten = require('../server/kern/experience/manifesten');
const { maakExperience } = require('../server/kern/experience');

test('de browser bewaart alleen een herstelpunt uit een volledige Experience-context', () => {
  const bron = fs.readFileSync(path.join(__dirname, '../public/shared/experience-kernel.js'), 'utf8');
  assert.match(bron, /if \(!state\.bootstrap \|\| !state\.bootstrap\.currentContext\) return;/);
});

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

test('gewijzigde vluchttijd maakt oud akkoord ongeldig en vraagt een nieuw akkoord', async () => {
  const h = huis(), key = 'member-key', bron = h.kern.mijnReizen();
  h.kern.mijnReizen = () => bron;
  const vlucht = bron.reizen[0].onderdelen[0];
  const lees = () => h.experience.projection({ key, world: 'travel' }).attention[0];
  const bereid = () => h.experience.preview(key, { intent: 'attention.acknowledge', version: 1,
    parameters: { world: 'travel', attentionId: lees().id } }).preview;
  const bevestig = (p, idempotencyKey) => h.experience.execute(key,
    { previewId: p.id, idempotencyKey, confirmed: true });
  const oud = bereid();
  vlucht.tijd = '17:00'; // Titel en status blijven gelijk; de broninhoud niet.
  const stale = await bevestig(oud, 'flight-before-change');
  assert.equal(stale.status, 409);
  assert.equal(stale.code, 'STALE_ATTENTION');
  assert.equal(lees().lifecycle, 'PRESENTED');
  assert.equal(h.experience.evidence(key).evidence.length, 0);
  const vers = bereid(), eerste = await bevestig(vers, 'flight-after-change');
  assert.equal(eerste.ok, true);
  assert.equal(lees().lifecycle, 'ACKNOWLEDGED');
  assert.equal(lees().revision, eerste.attention.revision);
  assert.notEqual(vers.fingerprint, oud.fingerprint);
  vlucht.tijd = '16:00';
  assert.equal(lees().lifecycle, 'PRESENTED');
  assert.equal(lees().acknowledgedAt, null);
  const replay = await bevestig(vers, 'flight-after-change');
  assert.equal(replay.replay, true);
  assert.equal(replay.evidence.id, eerste.evidence.id);
  assert.equal(lees().lifecycle, 'PRESENTED', 'historische replay bevestigt geen nieuwe inhoud');
  assert.equal((await bevestig(bereid(), 'flight-after-change')).code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(h.experience.evidence(key).evidence.length, 1);
});

test('aandachtrevisie bindt betekenisvolle bronvelden maar geen presentatietijd', async t => {
  for (const [veld, waarde] of Object.entries({ titel: 'Nieuwe titel', uitleg: 'Gate gewijzigd',
    status: 'geannuleerd', van: '2026-08-30', tot: '2026-08-31', wanneer: '2026-08-30',
    tijd: '18:00', bestemming: 'Rome', gate: 'C42', expiresAt: '2026-08-30T00:00:00Z' })) {
    await t.test(veld, async () => {
      const h = huis(), bron = h.kern.mijnReizen();
      h.kern.mijnReizen = () => bron;
      const lees = () => h.experience.projection({ key: 'k', world: 'travel' }).attention[0];
      const item = lees();
      const preview = h.experience.preview('k', { intent: 'attention.acknowledge', version: 1,
        parameters: { world: 'travel', attentionId: item.id, attentionRevision: 'client-keuze' } });
      bron.reizen[0].onderdelen[0][veld] = waarde;
      assert.equal(lees().id, item.id);
      const result = await h.experience.execute('k', { previewId: preview.preview.id,
        idempotencyKey: 'changed-field-' + veld, confirmed: true });
      assert.equal(result.code, 'STALE_ATTENTION');
      assert.equal(h.experience.evidence('k').evidence.length, 0);
    });
  }
  const h = huis(), bron = h.kern.mijnReizen();
  h.kern.mijnReizen = () => bron;
  const lees = () => h.experience.projection({ key: 'k', world: 'travel' }).attention[0];
  const eerst = lees();
  assert.match(eerst.revision, /^[a-f0-9]{64}$/);
  const preview = h.experience.preview('k', { intent: 'attention.acknowledge', version: 1,
    parameters: { world: 'travel', attentionId: eerst.id } }).preview;
  bron.reizen[0].onderdelen[0].generatedAt = '2026-08-29T10:01:00Z';
  assert.equal(lees().revision, eerst.revision);
  assert.equal((await h.experience.execute('k', { previewId: preview.id,
    idempotencyKey: 'same-source-revision', confirmed: true })).ok, true);
  bron.reizen[0].onderdelen[0].generatedAt = '2026-08-29T10:02:00Z';
  assert.equal(lees().lifecycle, 'ACKNOWLEDGED');
});

test('twee voorbereidingen van dezelfde aandacht schrijven niet tweemaal bewijs', async () => {
  const h = huis(), key = 'member-key';
  const item = h.experience.projection({ key, world: 'travel' }).attention[0];
  const bereid = () => h.experience.preview(key, { intent: 'attention.acknowledge', version: 1,
    parameters: { world: 'travel', attentionId: item.id } }).preview;
  const a = bereid(), b = bereid();
  const eerste = await h.experience.execute(key, { previewId: a.id,
    idempotencyKey: 'attention-first-preview', confirmed: true });
  assert.equal(eerste.ok, true);
  const tweede = await h.experience.execute(key, { previewId: b.id,
    idempotencyKey: 'attention-second-preview', confirmed: true });
  assert.equal(tweede.code, 'ATTENTION_ALREADY_ACKNOWLEDGED');
  assert.equal(h.experience.evidence(key).evidence.length, 1);
});

test('attention-finalizationfout laat geen gezien zonder bewijs achter en is herhaalbaar', async () => {
  let willekeur = 0;
  const h = huis({ crypto: { ...crypto, randomBytes(n) {
    if (++willekeur === 2) throw new Error('evidencevoorbereiding mislukt');
    return crypto.randomBytes(n);
  } } }), key = 'member-key';
  const lees = () => h.experience.projection({ key, world: 'travel' }).attention[0];
  const preview = h.experience.preview(key, { intent: 'attention.acknowledge', version: 1,
    parameters: { world: 'travel', attentionId: lees().id } }).preview;
  const invoer = { previewId: preview.id, idempotencyKey: 'attention-finalization-retry', confirmed: true };
  await assert.rejects(h.experience.execute(key, invoer), /evidencevoorbereiding mislukt/);
  assert.equal(lees().lifecycle, 'PRESENTED');
  assert.equal(h.experience.evidence(key).evidence.length, 0);
  const hersteld = await h.experience.execute(key, invoer);
  assert.equal(hersteld.ok, true);
  assert.equal(lees().lifecycle, 'ACKNOWLEDGED');
  assert.equal(h.experience.evidence(key).evidence.length, 1);
  assert.equal((await h.experience.execute(key, invoer)).evidence.id, hersteld.evidence.id);
});

test('gelijktijdige aandachtbevestigingen finaliseren dezelfde revisie maximaal eenmaal', async () => {
  for (const zelfdeSleutel of [false, true]) {
    const h = huis(), key = 'member-key';
    const item = h.experience.projection({ key, world: 'travel' }).attention[0];
    const bereid = () => h.experience.preview(key, { intent: 'attention.acknowledge', version: 1,
      parameters: { world: 'travel', attentionId: item.id } }).preview;
    const a = bereid(), b = bereid();
    const resultaten = await Promise.all([a, b].map((p, i) => h.experience.execute(key, {
      previewId: p.id, idempotencyKey: 'attention-concurrent-' + (zelfdeSleutel ? 0 : i), confirmed: true
    })));
    assert.equal(h.experience.evidence(key).evidence.length, 1);
    assert.equal(resultaten[0].ok, true);
    if (zelfdeSleutel) {
      assert.equal(resultaten[1].replay, true);
      assert.equal(resultaten[1].evidence.id, resultaten[0].evidence.id);
    } else assert.equal(resultaten[1].code, 'ATTENTION_ALREADY_ACKNOWLEDGED');
  }
});

test('oude aandachtstaat en previews zonder revisie geven geen stil akkoord', async () => {
  const h = huis(), key = 'member-key';
  const item = h.experience.projection({ key, world: 'travel' }).attention[0];
  const preview = h.experience.preview(key, { intent: 'attention.acknowledge', version: 1,
    parameters: { world: 'travel', attentionId: item.id } }).preview;
  const opslag = require('../server/kern/experience/opslag')({ db: h.db, save() {}, crypto });
  opslag.attentionZet(key, item.id, { lifecycle: 'ACKNOWLEDGED', acknowledgedAt: '2026-08-29T10:00:00Z' });
  assert.equal(h.experience.projection({ key, world: 'travel' }).attention[0].lifecycle, 'PRESENTED');
  delete preview.parameters.attentionRevision;
  opslag.previewZet(key, preview);
  const oud = await h.experience.execute(key, { previewId: preview.id,
    idempotencyKey: 'legacy-attention', confirmed: true });
  assert.equal(oud.code, 'STALE_ATTENTION');
  assert.equal(h.experience.evidence(key).evidence.length, 0);
  const vreemd = await h.experience.execute('ander-account', { previewId: preview.id,
    idempotencyKey: 'foreign-attention', confirmed: true });
  assert.equal(vreemd.code, 'PREVIEW_NOT_FOUND');
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

test('de wereldwachter kent alleen echte werelden, en geen sleutels van Object', () => {
  /* `haal` las met MANIFESTS[w], en dat leest ook wat op Object.prototype staat:
     'constructor' gaf een functie terug en '__proto__' een object. Allebei kwamen
     ze door de wachter `if (!manifest)` in kern/experience/projections.js, en die
     wachter is het bewijs waarop `BOUWERS[w](...)` daarna wordt aangeroepen. De
     wereld komt uit het lijf van een verzoek, dus dit is invoer.

     DE MUTATIE: zet in kern/experience/manifesten.js `haal` terug op
     MANIFESTS[w] || null -- dan is 'constructor' weer een wereld. */
  for (const sleutel of ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty']) {
    assert.equal(manifesten.haal(sleutel), null,
      'de wachter zag "' + sleutel + '" aan voor een wereld');
  }
  /* En de vier echte werelden blijven werken, ook met een hoofdletter -- anders
     is de reparatie een storing in plaats van een grens. */
  for (const w of ['living', 'travel', 'work', 'foundation'])
    assert.equal(manifesten.haal(w.toUpperCase()).id, w);
});
