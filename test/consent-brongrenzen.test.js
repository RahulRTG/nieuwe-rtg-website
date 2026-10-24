/* De bronpaden in consent-dekking mogen na een splitsing veranderen, de
   betekenis niet: intake intrekken raakt de bron; Arrival blijft expliciet
   niet gedekt. Pure ketens, geen server of vervangende autorisatieregels. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const consent = require('../server/kern/consent');

test('de afgesplitste intake blijft zichtbaar en alleen door de eigenaar intrekbaar via Consent Center', () => {
  const rows = [];
  const leden = require('../server/kern/care/leden')({
    opslag: { bak: n => n === 'careIntake' ? rows : [] },
    save() {}, crypto, schoon: (s, n) => String(s || '').slice(0, n), notify() {},
    nu: () => '2026-10-20T00:00:00Z', vandaag: () => '2026-10-20',
    INTAKE_DAGEN: 90, lijsten() {},
    aanbiederVan: id => id === 'a1' ? { id, naam: 'Kliniek' } : null,
    intakeActief: (key, id) => rows.find(r => r.key === key && r.aanbiederId === id && r.status === 'actief'),
    intakesleutel: require('../server/kern/care/intakesleutel')({ haalSleutel: () => Buffer.alloc(32, 7) })
  });
  const centrum = consent({ kern: leden });
  const deel = leden.careIntakeDeel('eigenaar', 'a1', 'vertrouwelijke intake 7af91');
  assert.equal(deel.ok, true);
  const eigen = centrum.consentVan('eigenaar').toestemmingen;
  assert.equal(eigen.length, 1);
  assert.equal(eigen[0].laag, 'care-intake');
  assert.equal(eigen[0].id, deel.intake.id);
  assert.equal(JSON.stringify(eigen).includes('vertrouwelijke intake 7af91'), false, 'geen medische inhoud in het overzicht');
  assert.deepEqual(centrum.consentVan('ander').toestemmingen, []);
  const actie = { laag: 'care-intake', id: deel.intake.id };
  assert.equal(centrum.consentIntrek('ander', actie).status, 404);
  assert.equal(rows[0].status, 'actief');
  assert.equal(centrum.consentIntrek('eigenaar', actie).ok, true);
  assert.equal(rows[0].status, 'gestopt');
  assert.deepEqual(centrum.consentVan('eigenaar').toestemmingen, []);
  assert.equal(centrum.consentIntrek('eigenaar', actie).status, 404);
});

test('Arrival vermeldt de ontbrekende centrale dekking en belooft geen werkende centrale intrekknop', () => {
  const centrum = consent({ kern: {} });
  const overzicht = centrum.consentVan('lid');
  const grens = overzicht.nietGedekt.find(x => x.naam === 'Uw aankomststatus bij Invisible Arrival');
  assert.ok(grens);
  assert.match(grens.reden, /nog niet in dit overzicht/);
  assert.match(grens.reden, /dat trekt de Arrival Pass niet in/);
  assert.match(grens.reden, /reservering blijft staan/);
  for (const gegeven of ['reserveringsgegevens', 'allergie', 'toegankelijkheid', 'gelegenheid', 'voorkeurszone']) {
    assert.ok(grens.reden.includes(gegeven), 'ook aanvraaggegevens horen in de zichtbare grens: ' + gegeven);
  }
  assert.equal(overzicht.lagen.some(x => x.id === 'arrival'), false);
  assert.equal(centrum.consentIntrek('lid', { laag: 'arrival', id: 'pass' }).status, 404);
});

test('Arrival stop-puls is geen intrekking; de bestaande houderintrekking sluit toegang en pulsen af', () => {
  const db = { data: {}, writable: true };
  const bewerkCollectie = require('../server/db/collectie-bewerken')({ store: 'json', db, save() {} });
  const pas = require('../server/kern/arrivalpas')({ db, bewerkCollectie, crypto, nu: () => '2026-09-27T12:00:00Z' });
  const reservering = { id: 'r1', supplierCode: 'ZAAK', status: 'aangevraagd' };
  const reserveringVan = id => id === reservering.id ? reservering : null;
  const uit = pas.aanvraag({ lid: 'eigenaar', requestToken: 'aanvraagabcdefghijklmnopqrstuvwx1234',
    supplierCode: 'ZAAK', reserveringId: 'r1', datum: '2026-09-28', tijd: '20:00' });
  assert.equal(uit.status, 200);
  assert.equal(pas.puls(uit.code, 'stop', reserveringVan, 'eigenaar').status, 200);
  assert.equal(pas.lees(uit.code, reserveringVan, 'eigenaar').status, 200);
  assert.notEqual(pas.intrek(uit.code, 'ander').status, 200);
  assert.equal(pas.lees(uit.code, reserveringVan, 'eigenaar').status, 200);
  assert.equal(pas.intrek(uit.code, 'eigenaar').status, 200);
  assert.notEqual(pas.lees(uit.code, reserveringVan, 'eigenaar').status, 200);
  assert.notEqual(pas.puls(uit.code, 'onderweg', reserveringVan, 'eigenaar').status, 200);
  assert.equal(reservering.status, 'aangevraagd', 'intrekken annuleert de reservering niet');
});
