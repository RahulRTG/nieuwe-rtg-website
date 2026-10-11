'use strict';
/* De beleidstoets van RTG Value (server/kern/waarde/policy.js) laag voor laag.

   De module belooft drie dingen die elk een eigen toets verdienen: de lagen
   staan van hard naar zacht en een strengere laag gaat altijd voor, een
   onbekend genre is fail-closed, en alleen de grens van de HOUDER is
   opheffbaar. Elk geval hieronder zet precies een laag op scherp en kijkt welke
   reden er terugkomt -- een toets die alleen `mag` leest, ziet niet op welke
   laag iets zakte. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { toets, binnenVenster, zinnen } = require('../server/kern/waarde/policy');

const om = (u, m) => new Date(2026, 9, 11, u, m || 0);
const MIDDAG = om(12);

test('1. het tijdvenster werkt ook over middernacht, en een onleesbaar venster sluit niets af', () => {
  assert.equal(binnenVenster('09:00-17:00', om(12)), true);
  assert.equal(binnenVenster('09:00-17:00', om(17)), true);
  assert.equal(binnenVenster('09:00-17:00', om(17, 1)), false);
  assert.equal(binnenVenster('09:00-17:00', om(8, 59)), false);
  assert.equal(binnenVenster('22:00-02:00', om(23)), true);
  assert.equal(binnenVenster('22:00-02:00', om(1, 30)), true);
  assert.equal(binnenVenster('22:00-02:00', om(12)), false);
  assert.equal(binnenVenster('altijd', om(3)), true);
  assert.equal(binnenVenster(undefined, om(3)), true);
});

test('2. laag 1, de klasse: verval, uitbetalen, overdragen en het bestedingsgebied', () => {
  const verlopen = toets({ vervaltOp: MIDDAG.getTime() - 1 }, { soort: 'besteden', nu: MIDDAG });
  assert.equal(verlopen.reden, 'verlopen');
  assert.equal(verlopen.uitleg, zinnen.verlopen);
  assert.equal(toets({ vervaltOp: MIDDAG.getTime() + 1 }, { soort: 'besteden', nu: MIDDAG }).mag, true);

  assert.equal(toets({ klasse: 'LOYALTY' }, { soort: 'uitbetalen', nu: MIDDAG }).reden, 'klasse');
  assert.equal(toets({ klasse: 'PERSONAL_FUNDED' }, { soort: 'uitbetalen', nu: MIDDAG }).mag, true);
  assert.equal(toets({ klasse: 'EMPLOYER_BUDGET' }, { soort: 'overdragen', nu: MIDDAG }).reden, 'overdracht');
  assert.equal(toets({ klasse: 'GIFT' }, { soort: 'overdragen', nu: MIDDAG }).mag, true);

  const elders = toets({ klasse: 'GIFT', uitgever: 'Z1' }, { soort: 'besteden', ontvanger: 'Z2', nu: MIDDAG });
  assert.equal(elders.reden, 'gebied');
  assert.equal(elders.alleenBij, 'Z1');
  assert.equal(toets({ klasse: 'GIFT', uitgever: 'Z1' }, { soort: 'besteden', ontvanger: 'Z1', nu: MIDDAG }).mag, true);
});

test('3. een onbekende klasse valt terug op de standaard en geen positie is geen fout', () => {
  const r = toets(null, null);
  assert.equal(r.mag, true);
  assert.equal(r.klasse, 'PERSONAL_FUNDED');
  assert.equal(toets({ klasse: 'BESTAAT_NIET' }, { soort: 'uitbetalen', nu: MIDDAG }).mag, true);
});

test('4. laag 2, de uitgever: genre is fail-closed, venster en dagmaximum', () => {
  const budget = { klasse: 'EMPLOYER_BUDGET', beleid: { genres: ['horeca'] } };
  assert.equal(toets(budget, { soort: 'besteden', genre: 'horeca', nu: MIDDAG }).mag, true);
  const ander = toets(budget, { soort: 'besteden', genre: 'slijterij', nu: MIDDAG });
  assert.equal(ander.reden, 'genre');
  assert.deepEqual(ander.toegestaan, ['horeca']);
  const onbekend = toets(budget, { soort: 'besteden', nu: MIDDAG });
  assert.equal(onbekend.reden, 'genre');
  assert.equal(onbekend.gevraagd, null);
  assert.equal(toets({ beleid: { genres: [] } }, { soort: 'besteden', nu: MIDDAG }).mag, true);

  const nacht = toets({ beleid: { venster: '08:00-20:00' } }, { soort: 'besteden', nu: om(2, 30) });
  assert.equal(nacht.reden, 'tijd');
  assert.equal(toets({ beleid: { venster: '08:00-20:00' } }, { soort: 'besteden', nu: MIDDAG }).mag, true);

  const max = { beleid: { dagMaxCenten: 1000 } };
  assert.equal(toets(max, { centen: 400, dagBesteed: 600, nu: MIDDAG }).mag, true);
  const over = toets(max, { centen: 401, dagBesteed: 600, nu: MIDDAG });
  assert.equal(over.reden, 'dagmax');
  assert.equal(over.dagBesteed, 600);
});

test('5. laag 3, de houder: alleen zijn eigen grens is opheffbaar en telt over alles', () => {
  const eigen = { dagMaxCenten: 5000, maandMaxCenten: 20000, venster: '07:00-23:00' };
  assert.equal(toets({}, { centen: 100, dagBestedTotaal: 4900, maandBestedTotaal: 0, nu: MIDDAG }, eigen).mag, true);

  const dag = toets({}, { centen: 101, dagBestedTotaal: 4900, nu: MIDDAG }, eigen);
  assert.equal(dag.reden, 'eigen');
  assert.equal(dag.eigenGrens, 'dagmaximum');
  assert.equal(dag.opheffbaar, true);
  assert.equal(dag.besteed, 4900);

  const maand = toets({}, { centen: 100, maandBestedTotaal: 19950, nu: MIDDAG }, eigen);
  assert.equal(maand.eigenGrens, 'maandmaximum');

  const laat = toets({}, { centen: 1, nu: om(23, 30) }, eigen);
  assert.equal(laat.eigenGrens, 'tijdvenster');

  // de grens van de positie (dagBesteed) is een andere dan die van de persoon
  assert.equal(toets({}, { centen: 100, dagBesteed: 4950, nu: MIDDAG }, eigen).mag, true);
});

test('6. de volgorde: een strengere laag wint altijd van een ruimere', () => {
  // verlopen en buiten het genre en boven de eigen grens: de klasse zegt het
  const alles = toets({ klasse: 'EMPLOYER_BUDGET', vervaltOp: MIDDAG.getTime() - 1, beleid: { genres: ['horeca'] } },
    { soort: 'besteden', genre: 'slijterij', centen: 999999, nu: MIDDAG }, { dagMaxCenten: 1 });
  assert.equal(alles.reden, 'verlopen');
  // geldig maar buiten het genre en boven de eigen grens: de uitgever zegt het, niet de houder
  const uitgever = toets({ klasse: 'EMPLOYER_BUDGET', beleid: { genres: ['horeca'] } },
    { soort: 'besteden', genre: 'slijterij', centen: 999999, nu: MIDDAG }, { dagMaxCenten: 1 });
  assert.equal(uitgever.reden, 'genre');
  assert.equal(uitgever.opheffbaar, undefined);
});

test('7. de tijd mag als getal of als datum komen, en centen worden afgerond', () => {
  const venster = { beleid: { venster: '08:00-20:00' } };
  assert.equal(toets(venster, { nu: om(2).getTime() }).reden, 'tijd');
  assert.equal(toets({ beleid: { dagMaxCenten: 100 } }, { centen: '100.4', nu: MIDDAG }).mag, true);
  assert.equal(toets({ beleid: { dagMaxCenten: 100 } }, { centen: 'onzin', dagBesteed: 'ook', nu: MIDDAG }).mag, true);
});
