'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const regie = require('../server/kern/zaakregiebeeld');

test('het concierge-regiebeeld projecteert bron, fasen en relaties zonder domeininhoud te bezitten', () => {
  const source = { id: 'c-1', titel: 'Privé diner', wat: 'Geheime wensen', bedragCenten: 90000,
    status: 'wacht op uw akkoord', eigenaar: { rol: 'Lead Rechterhand', naam: 'Verborgen Naam' },
    team: [{ rol: 'Hospitality & events' }], beslissing: { nodig: true },
    deelopdrachten: [{ id: 'c-1:vervoer', wat: 'Vervoer', magZelf: false, reden: 'privé' }],
    tijdlijn: [{ op: '2026-10-16T10:00:00.000Z', notitie: 'Geheime notitie' }] };
  const before = JSON.stringify(source), view = regie.bureau(source), text = JSON.stringify(view);
  assert.equal(view.phase.id, 'agreement');
  assert.equal(view.source.id, 'c-1');
  assert.equal(view.relations[0].source.type, 'work-item');
  assert.equal(view.actions.every(action => action.executable === false), true);
  assert.match(text, /bureau\.case\.decide/);
  assert.doesNotMatch(text, /Geheime wensen|90000|Verborgen Naam|Geheime notitie|privé/);
  assert.equal(JSON.stringify(source), before, 'de read projection wijzigde zijn bron');
});

test('het service-regiebeeld laat de melder en tijdlijninhoud buiten de universele vorm', () => {
  const source = { id: 'SUP-ABC123', titel: 'Betaling blijft staan', melder: 'user-geheim',
    stand: 'inBehandeling', team: 'betalingen', eigenaar: 'medewerker-geheim',
    betrokken: { soort: 'betaling', code: 'PAY-1' },
    koppelingen: [{ soort: 'incident', code: 'INC-9', extra: 'niet meenemen' }],
    tijdlijn: [{ at: '2026-10-16T10:00:00.000Z', tekst: 'Mijn rekeningnummer is geheim' }] };
  const view = regie.service(source), text = JSON.stringify(view);
  assert.equal(view.phase.id, 'execute');
  assert.equal(view.responsibilities[0].actor.id, 'self');
  assert.deepEqual(view.relations.map(item => item.source.type), ['betaling', 'incident']);
  assert.doesNotMatch(text, /user-geheim|medewerker-geheim|rekeningnummer|niet meenemen/);
  assert.equal(view.ownsSourceData, false);
  assert.equal(view.readOnly, true);
});
