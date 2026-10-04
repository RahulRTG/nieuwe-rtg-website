'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const maakBewijs = require('../server/kern/reservering/providerbewijs');
const maakTafels = require('../server/kern/ervaring/tafels');

const at = '2026-10-01T12:00:00.000Z';
const sha = waarde => crypto.createHash('sha256').update(String(waarde)).digest('hex');
function audit(reqId = 'REQ-1', actor = 'S-1') {
  return { version: 1, decisionRef: 'supplier-decision-v1:zaak:R-1:bevestigd',
    requestRefDigest: sha(['hospitality-request-v1', 'ZAAK', 'R-1', reqId].join(':')),
    actorRefDigest: sha(['hospitality-actor-v1', 'ZAAK', actor].join(':')),
    supplierCode: 'ZAAK', decidedAt: at };
}

test('supplierAuth-receipt is eenmalig en exact aan zaak, reservering en status gebonden', () => {
  const grens = maakBewijs(), req = { id: 'REQ-1' }, supplier = { code: 'ZAAK' }, actor = { staffId: 'S-1' };
  grens.authenticeer(req, supplier, actor);
  const receipt = grens.bevestiging(req, 'vonk:M-1:reservation', {
    id: 'R-1', supplierCode: 'ZAAK', status: 'bevestigd', beslotenAt: at,
    besluitAudit: audit()
  });
  assert.deepEqual(receipt.assertion, { provider: 'zaak', reservationRef: 'vonk:M-1:reservation',
    providerReservationRef: 'R-1', status: 'confirmed',
    decisionRef: 'supplier-decision-v1:zaak:R-1:bevestigd' });
  assert.throws(() => grens.verify(receipt.proof, { provider: 'zaak', purpose: 'external',
    assertion: { ...receipt.assertion, providerReservationRef: 'R-2' } }),
  e => e.code === 'INGRESS_PROOF_INVALID');
  assert.throws(() => grens.verify(receipt.proof, { provider: 'zaak', purpose: 'external',
    assertion: receipt.assertion }), e => e.code === 'INGRESS_PROOF_INVALID',
  'een mismatch brandt het receipt op');
  assert.throws(() => grens.bevestiging(req, 'vonk:M-1:reservation', {
    id: 'R-1', supplierCode: 'ZAAK', status: 'bevestigd', beslotenAt: at,
    besluitAudit: audit()
  }), e => e.code === 'HOSPITALITY_AUTHORITY_REQUIRED');
});

test('een geldige request kan geen besluit met verwisselde actor- of requestref attesteren', () => {
  const grens = maakBewijs(), req = { id: 'REQ-1' };
  grens.authenticeer(req, { code: 'ZAAK' }, { staffId: 'S-1' });
  assert.throws(() => grens.bevestiging(req, 'vonk:M-1:reservation', {
    id: 'R-1', supplierCode: 'ZAAK', status: 'bevestigd', beslotenAt: at,
    besluitAudit: audit('REQ-ANDERS', 'S-ANDERS')
  }), e => e.code === 'HOSPITALITY_AUDIT_MISMATCH');
});

test('zonder geauthenticeerde request of met alleen een aanvraag ontstaat geen providerbewijs', () => {
  const grens = maakBewijs();
  assert.throws(() => grens.bevestiging({}, 'vonk:M-1:reservation', {
    id: 'R-1', supplierCode: 'ZAAK', status: 'bevestigd'
  }), e => e.code === 'HOSPITALITY_AUTHORITY_REQUIRED');
  const req = { id: 'REQ-2' };
  grens.authenticeer(req, { code: 'ZAAK' }, { name: 'Beheer' });
  assert.throws(() => grens.bevestiging(req, 'vonk:M-1:reservation', {
    id: 'R-1', supplierCode: 'ZAAK', status: 'aangevraagd'
  }), e => e.code === 'HOSPITALITY_ASSERTION_INVALID');
});

function tafelKern({ save, bewijs, meld }) {
  const reservering = { id: 'R-1', supplierCode: 'ZAAK', supplierName: 'Zaak', customerKey: 'rtg',
    customerCodename: 'A & B', datum: '2026-10-02', tijd: '20:00', personen: 2,
    status: 'aangevraagd', at };
  const match = { id: 'M-1', a: 'A', b: 'B', status: 'reservering-aangevraagd', reserveringId: 'R-1',
    reservationTrust: { reservationRef: 'vonk:M-1:reservation', commitmentEvidenceId: 'ev-commit' },
    reservationEvidence: { state: 'PENDING', finality: 'SOURCE_ATTESTED',
      missing: ['provider-confirmation', 'operational-outcome'] } };
  const db = { data: { reserveringen: [reservering], vonk: { matches: [match] } } };
  const noop = () => {};
  const core = maakTafels({ db, save, findSupplier: () => ({ code: 'ZAAK' }), notify: meld || noop,
    notifySupplier: noop, sseToCustomer: noop, sseToSupplier: noop, sseToOffice: noop,
    crypto, id: () => 'x', nu: () => at, vandaag: () => '2026-10-01', rond: x => x,
    bewijsHospitalityBesluit: bewijs });
  return { core, reservering, match };
}

test('een mislukte domeinsave publiceert geen provider confirmation en rolt RAM terug', () => {
  let bewijsCalls = 0;
  const { core, reservering, match } = tafelKern({ save() { throw new Error('disk full'); },
    bewijs() { bewijsCalls++; } });
  assert.throws(() => core.beslisReservering({ code: 'ZAAK', name: 'Zaak' }, 'R-1', 'bevestig',
    { request: { id: 'REQ-1' }, actor: { staffId: 'S-1' } }), /disk full/);
  assert.equal(bewijsCalls, 0, 'bewijs volgt pas na een duurzame domeinbeslissing');
  assert.equal(reservering.status, 'aangevraagd');
  assert.equal(reservering.besluitAudit, undefined);
  assert.equal(match.status, 'reservering-aangevraagd');
  assert.equal(match.reservationEvidence.state, 'PENDING');
});

test('bewijsuitval na de domeincommit blijft zichtbaar als UNKNOWN debt', () => {
  let saves = 0; const meldingen = [];
  const { core, reservering, match } = tafelKern({ save() { saves++; }, bewijs() {
    throw Object.assign(new Error('evidence unavailable'), { code: 'EVIDENCE_WRITES_BLOCKED',
      incidentId: 'incident-1' });
  }, meld(key, note) { meldingen.push({ key, note }); } });
  const result = core.beslisReservering({ code: 'ZAAK', name: 'Zaak' }, 'R-1', 'bevestig',
    { request: { id: 'REQ-1' }, actor: { staffId: 'S-1' } });
  assert.equal(saves, 1);
  assert.equal(reservering.status, 'bevestigd', 'de duurzame supplierbeslissing blijft domeinwaarheid');
  assert.equal(match.status, 'reservering-onbekend', 'zonder bewijs ontstaat geen Date-surface');
  assert.equal(match.reservationEvidence.state, 'UNKNOWN');
  assert.equal(match.reservationEvidence.finality, 'UNKNOWN');
  assert.equal(reservering.besluitAudit.decisionRef, 'supplier-decision-v1:zaak:R-1:bevestigd');
  assert.equal(reservering.besluitAudit.actorRefDigest.length, 64);
  assert.equal(reservering.besluitAudit.requestRefDigest.length, 64);
  assert.doesNotMatch(JSON.stringify(reservering), /S-1|REQ-1|Bearer/i);
  assert.deepEqual(result.evidenceDebt, { state: 'UNKNOWN', code: 'EVIDENCE_WRITES_BLOCKED',
    incidentId: 'incident-1', decisionRef: 'supplier-decision-v1:zaak:R-1:bevestigd' });
  assert.equal(meldingen.length, 3);
  assert.ok(meldingen.every(x => !/tafel bevestigd|bevestigd voor/i.test(x.note.body)));
  assert.ok(meldingen.every(x => /controleert|controle/i.test(x.note.body)));
});

test('alleen geldig bewijs en de tweede duurzame save openen de bevestigde match', () => {
  let saves = 0, gezien; const meldingen = [];
  const { core, match } = tafelKern({ save() { saves++; }, bewijs(req, ref, reservation) {
    gezien = { req, ref, reservation };
    return { claim: { claimId: 'claim-1', finality: 'SOURCE_ATTESTED',
      completeness: { missing: [{ requirementId: 'operational-outcome' }] } } };
  }, meld(key, note) { meldingen.push({ key, note }); } });
  const result = core.beslisReservering({ code: 'ZAAK', name: 'Zaak' }, 'R-1', 'bevestig',
    { request: { id: 'REQ-1' }, actor: { staffId: 'S-1' } });
  assert.equal(saves, 2);
  assert.equal(match.status, 'bevestigd');
  assert.deepEqual(match.reservationEvidence, { state: 'CONFIRMED', finality: 'SOURCE_ATTESTED',
    missing: ['operational-outcome'] });
  assert.equal(gezien.req.id, 'REQ-1');
  assert.equal(gezien.ref, 'vonk:M-1:reservation');
  assert.equal(gezien.reservation.besluitAudit.actorRefDigest.length, 64);
  assert.equal(result.evidenceDebt, undefined);
  assert.ok(meldingen.every(x => /bevestigd/i.test(x.note.body)));
});

test('een mislukte projectiesave na geldig bewijs blijft fail-closed en meldt geen Date', () => {
  let saves = 0; const meldingen = [];
  const { core, reservering, match } = tafelKern({ save() {
    saves++;
    if (saves === 2) throw Object.assign(new Error('projection commit unknown'),
      { code: 'EVIDENCE_PROJECTION_PERSIST_FAILED', incidentId: 'incident-projection' });
  }, bewijs() {
    return { claim: { claimId: 'claim-projectie', finality: 'SOURCE_ATTESTED',
      completeness: { missing: [{ requirementId: 'operational-outcome' }] } } };
  }, meld(key, note) { meldingen.push({ key, note }); } });
  const result = core.beslisReservering({ code: 'ZAAK', name: 'Zaak' }, 'R-1', 'bevestig',
    { request: { id: 'REQ-1' }, actor: { staffId: 'S-1' } });
  assert.equal(reservering.status, 'bevestigd');
  assert.equal(match.status, 'reservering-onbekend');
  assert.equal(match.reservationEvidence.state, 'UNKNOWN');
  assert.deepEqual(result.evidenceDebt, { state: 'UNKNOWN',
    code: 'EVIDENCE_PROJECTION_PERSIST_FAILED', incidentId: 'incident-projection',
    decisionRef: 'supplier-decision-v1:zaak:R-1:bevestigd' });
  assert.ok(meldingen.every(x => !/tafel bevestigd|bevestigd voor/i.test(x.note.body)));
});

test('een interleaved dubbel zaakbesluit kan geen tweede providerconfirmation maken', () => {
  let core, nested, bewijsCalls = 0, saves = 0;
  const opstelling = tafelKern({ save() {
    saves++;
    if (saves === 1) nested = core.beslisReservering({ code: 'ZAAK', name: 'Zaak' },
      'R-1', 'bevestig', { request: { id: 'REQ-2' }, actor: { staffId: 'S-2' } });
  }, bewijs() {
    bewijsCalls++;
    return { claim: { claimId: 'claim-once', finality: 'SOURCE_ATTESTED',
      completeness: { missing: [{ requirementId: 'operational-outcome' }] } } };
  } });
  core = opstelling.core;
  const result = core.beslisReservering({ code: 'ZAAK', name: 'Zaak' }, 'R-1', 'bevestig',
    { request: { id: 'REQ-1' }, actor: { staffId: 'S-1' } });
  assert.equal(result.ok, true);
  assert.equal(nested.status, 409);
  assert.equal(bewijsCalls, 1);
  assert.equal(opstelling.match.status, 'bevestigd');
});

test('de actieve hospitality issuer blijft alleen in de composition root bereikbaar', () => {
  const root = path.resolve(__dirname, '..');
  const files = [];
  function loop(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) loop(full);
      else if (/\.js$/.test(item.name)) files.push(full);
    }
  }
  loop(path.join(root, 'server'));
  const gebruikers = files.filter(file => /hospitalityProviderBewijs\.(?:authenticeer|bevestiging|verify)/
    .test(fs.readFileSync(file, 'utf8'))).map(file => path.relative(root, file));
  // De composition root voor deze issuer is uit server/server.js naar opzet verhuisd.
  assert.deepEqual(gebruikers, ['server/opzet/vertrouwensvlak.js']);
});
