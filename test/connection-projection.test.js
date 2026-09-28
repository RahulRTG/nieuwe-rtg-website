'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Consent = require('../server/kern/connection-consent');
const Projection = require('../server/kern/connection-projection');

const { NAMES } = Projection;
const basis = {
  actor: 'alice', counterpart: 'bob', purpose: 'rendezvous.arrange',
  capability: 'connection.meet.accept', scope: 'voorstel-1:diner', version: 1
};

test('consent is specifiek: capability, purpose, scope en versie delen geen toestemming', () => {
  const ledger = {};
  Consent.grant(ledger, basis, { at: '2026-09-22T10:00:00.000Z' });
  assert.equal(Consent.toestand(ledger, basis, '2026-09-22T10:01:00.000Z'), 'ACTIVE');
  assert.equal(Consent.toestand(ledger, { ...basis, capability: 'connection.video' }), 'ABSENT');
  assert.equal(Consent.toestand(ledger, { ...basis, purpose: 'rahul.answer' }), 'ABSENT');
  assert.equal(Consent.toestand(ledger, { ...basis, scope: 'voorstel-2:diner' }), 'ABSENT');
  assert.equal(Consent.toestand(ledger, { ...basis, version: 2 }), 'ABSENT');
});

test('revoke is een gebeurtenis en sluit direct iedere volgende controle', () => {
  const ledger = {};
  Consent.grant(ledger, basis, { at: '2026-09-22T10:00:00.000Z' });
  Consent.revoke(ledger, basis, { at: '2026-09-22T10:02:00.000Z' });
  assert.equal(Consent.toestand(ledger, basis, '2026-09-22T10:03:00.000Z'), 'REVOKED');
  assert.equal(Consent.actief(ledger, basis, '2026-09-22T10:03:00.000Z'), false);
  assert.deepEqual(Consent.record(ledger, basis).events.map(e => e.state), ['ACTIVE', 'REVOKED']);
});

test('een actieve toestemming vervalt op haar eigen expiry', () => {
  const ledger = {};
  Consent.grant(ledger, basis, { at: '2026-09-22T10:00:00.000Z', expiresAt: '2026-09-22T11:00:00.000Z' });
  assert.equal(Consent.toestand(ledger, basis, '2026-09-22T10:59:59.000Z'), 'ACTIVE');
  assert.equal(Consent.toestand(ledger, basis, '2026-09-22T11:00:00.000Z'), 'EXPIRED');
});

test('wederzijdse toestemming onderscheidt geen, een, beide en ingetrokken', () => {
  const ledger = {};
  const terug = { ...basis, actor: 'bob', counterpart: 'alice' };
  assert.equal(Consent.wederzijds(ledger, basis, terug), 'NONE');
  Consent.grant(ledger, basis, { at: '2026-09-22T10:00:00.000Z' });
  assert.equal(Consent.wederzijds(ledger, basis, terug), 'A_GRANTED');
  Consent.grant(ledger, terug, { at: '2026-09-22T10:01:00.000Z' });
  assert.equal(Consent.wederzijds(ledger, basis, terug), 'MUTUAL');
  Consent.revoke(ledger, basis, { at: '2026-09-22T10:02:00.000Z' });
  assert.equal(Consent.wederzijds(ledger, basis, terug), 'REVOKED');
});

test('Vonk discovery bevat alleen zijn contract en geen verborgen identiteit of enginevelden', () => {
  const raw = {
    codenaam: 'Maan', over: 'Reist graag', leeftijd: 34, stad: 'Utrecht', interesses: ['kunst'],
    kenmerken: { geloof: 'zichtbaar' }, legalName: 'Geheime Naam', birthDate: '1992-01-01',
    address: 'Singel 1', lat: 52.1, lng: 5.1, religion: 'verborgen', wensen: { geloof: 'verplicht' },
    beschikbaar: [{ dag: 1, deel: 'avond' }], debugReason: 'religie botst'
  };
  const uit = Projection.project(NAMES.VONK_DISCOVERY, raw);
  assert.deepEqual(uit, { codenaam: 'Maan', over: 'Reist graag', leeftijd: 34, stad: 'Utrecht',
    interesses: ['kunst'], kenmerken: { geloof: 'zichtbaar' } });
  for (const k of ['legalName', 'birthDate', 'address', 'lat', 'lng', 'religion', 'wensen', 'beschikbaar', 'debugReason']) {
    assert.equal(Object.hasOwn(uit, k), false, k + ' moet afwezig zijn');
  }
});

test('Vonk-profielmedia projecteert nooit eigenaar, opslagref of lifecycle', () => {
  const media = [{ id:'cpm1', purpose:'PROFILE_PHOTO', visibility:'DISCOVERY', processingState:'READY',
    publicationState:'PUBLISHED', verificationState:'UNVERIFIED', moderationState:'NOT_REVIEWED',
    width:1200, height:1600, mime:'image/jpeg', position:0, version:2, alt:'Portret',
    src:'/api/vonk/profile-photo/delivery/ticket', expiresAt:'2026-09-22T12:00:00Z',
    owner:'user-2', ref:'prive-geheim.jpg', lifecycle:[{ state:'UPLOADED' }], idempotencyKey:'geheim' }];
  const uit = Projection.project(NAMES.VONK_DISCOVERY, { codenaam:'Ster', media });
  assert.equal(uit.media.length, 1);
  assert.equal(uit.media[0].src, '/api/vonk/profile-photo/delivery/ticket');
  for (const veld of ['owner', 'ref', 'lifecycle', 'idempotencyKey'])
    assert.equal(Object.hasOwn(uit.media[0], veld), false, veld + ' mag de media-projectie niet verlaten');
});

test('verborgen geloof verandert een onbevoegde projectie niet', () => {
  const a = { codenaam: 'Ster', over: 'Hallo', leeftijd: 31, stad: 'Gent', religion: 'joods',
    religionImportance: 'belangrijk', debugReason: 'religie' };
  const b = { ...a, religion: 'moslim', religionImportance: 'niet belangrijk', debugReason: 'ander geloof' };
  assert.deepEqual(Projection.project(NAMES.VONK_DISCOVERY, a), Projection.project(NAMES.VONK_DISCOVERY, b));
});

test('Presence projecteert uitsluitend gedeelde stad en periode', () => {
  const raw = [{ stad: 'Parijs', van: '2026-10-01', tot: '2026-10-03', thuis: true,
    exactLocation: '48.8566,2.3522', address: 'Rue privée', bron: 'TravelOS' }];
  const uit = Projection.project(NAMES.RENDEZVOUS_MATCH, { id: 'b', codenaam: 'B', samen: raw });
  assert.deepEqual(uit.samen, [{ stad: 'Parijs', van: '2026-10-01', tot: '2026-10-03' }]);
});

test('de memberprojectie van The Table kan nooit een gastenlijst bevatten', () => {
  const uit = Projection.project(NAMES.RENDEZVOUS_TABLE_MEMBER, {
    id: 't1', naam: 'Salon', stad: 'Rome', plaatsen: 8,
    genodigden: [{ codenaam: 'A' }], guestList: ['A'], mijnStatus: 'open'
  });
  assert.equal(Object.hasOwn(uit, 'genodigden'), false);
  assert.equal(Object.hasOwn(uit, 'guestList'), false);
  assert.equal(uit.plaatsen, 8);
});

test('Rahul krijgt een minimale inputprojectie en geen ruwe profielvelden', () => {
  const uit = Projection.project(NAMES.RAHUL_CONNECTION, {
    matchCodenaam: 'B', gedeeldeLocaties: ['Rome'], openLocaties: ['Rome', 'Parijs'],
    watIkZoek: 'een relatie', presence: [{ stad: 'Rome', van: '2026-10-01', tot: '2026-10-03', thuis: true }],
    gedeeldDagdeel: 'vrijdagavond', voorkeursStad: 'Rome', legalName: 'Verborgen', religion: 'verborgen',
    beschikbaar: [{ dag: 5, deel: 'avond' }]
  });
  assert.equal(Object.hasOwn(uit, 'legalName'), false);
  assert.equal(Object.hasOwn(uit, 'religion'), false);
  assert.equal(Object.hasOwn(uit, 'beschikbaar'), false);
  assert.deepEqual(uit.presence, [{ stad: 'Rome', van: '2026-10-01', tot: '2026-10-03' }]);
});

test('Rahuls outputgrens blokkeert indirecte onthulling uit een privébron', () => {
  const toegestaan = Projection.project(NAMES.RAHUL_CONNECTION, { matchCodenaam: 'B', voorkeursStad: 'Rome' });
  const prive = { legalName: 'Saskia Geheim', religion: 'boeddhistisch', thuis: 'Antwerpen' };
  assert.deepEqual(Projection.rahulOutputGuard('Een diner in Rome.', toegestaan, [prive]),
    { ok: true, tekst: 'Een diner in Rome.' });
  const lek = Projection.rahulOutputGuard('Vraag Saskia Geheim naar Antwerpen.', toegestaan, [prive]);
  assert.equal(lek.ok, false);
  assert.equal(lek.tekst.includes('Saskia Geheim'), false);
  assert.equal(lek.tekst.includes('Antwerpen'), false);
});

test('onbekende projecties zijn default-deny', () => {
  assert.throws(() => Projection.project('TOEKOMSTIGE_PROJECTIE', { legalName: 'X' }), /Onbekende/);
});
