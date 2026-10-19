/* DE VIERDE DETECTOR: beweert een scherm meer dan de bron kan bewijzen?
   (scripts/lib/bewering.js, eigenaarsbesluit 19 oktober 2026)

   Puur, zonder browser, zodat de oordeelslogica ook op een kale CI wordt
   beproefd en de mutatiemotor eraan kan (zelfde reden als
   test/schermleugen.test.js). Per gedaante minstens een toets die zakt als de
   detector blind is, en een die laat zien dat een eerlijk scherm niet zakt.

   Draai los: node --test test/bewering.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../scripts/lib/bewering');
const { zekerheid, KLASSEN } = require('../server/kern/fiscaal/zekerheid');

const klachten = (antwoorden, tekst) => B.vindBeweringen({ antwoorden, tekst });
const een = (pad, body) => [{ pad, body }];

test('voorspelling: een vooruitblik zonder voorbehoud zakt, met "verwachting" niet', () => {
  const a = een('/api/geld/cockpit', { ok: true, vooruitblik: { d7: 12000 } });
  assert.match(klachten(a, 'Over 7 dagen € 120')[0], /^voorspelling: .*\/api\/geld\/cockpit/);
  for (const t of ['Over 7 dagen € 120 · verwachting', 'ongeveer € 340', 'Te betalen (indicatie)', 'Vraag een fiscalist', 'Bij dit tempo (extrapolatie)']) {
    assert.deepEqual(klachten(a, t), [], t);
  }
});

test('voorspelling: een zekerheidsblok advies/uitlegbaar telt op elk pad; bepaald niet', () => {
  assert.equal(klachten(een('/api/x', { ok: true, zekerheid: zekerheid('zzp.berekening') }), 'U betaalt € 5').length, 1);
  assert.equal(klachten(een('/api/x', { lijst: [{ z: zekerheid('btw.categorie') }] }), '€ 5').length, 1);
  assert.deepEqual(klachten(een('/api/x', { ok: true, zekerheid: zekerheid('btw.aangifte') }), 'Te betalen € 400'), []);
});

test('aanvraag: een aangevraagde reservering die als "Bevestigd" verschijnt zakt', () => {
  const a = een('/api/verblijf/mijn', { ok: true, verblijven: [{ id: 'v1', status: 'aangevraagd', aankomst: '2026-11-02' }] });
  assert.match(klachten(a, 'Villa Ibiza · Bevestigd · 2 nov')[0], /^aanvraag: /);
  assert.deepEqual(klachten(a, 'Villa Ibiza · Aangevraagd · 2 nov'), [], 'de zwakke stand staat erbij');
  // staat de bevestigde ergens in het antwoord, dan mag het scherm hem noemen
  const beide = een('/api/verblijf/mijn', { verblijven: [{ status: 'aangevraagd' }, { status: 'bevestigd' }] });
  assert.deepEqual(klachten(beide, 'Bevestigd'), []);
});

test('betaling: een betaling die nog wacht op de provider als "Betaald" zakt', () => {
  const a = een('/api/betaal/status', { ok: true, betaling: { status: 'IN_BEHANDELING', definitief: false, bedragCenten: 4500 } });
  assert.match(klachten(a, 'Uw bestelling · Betaald')[0], /^betaling: /);
  assert.deepEqual(klachten(a, 'Uw betaling is in behandeling'), []);
  const klaar = een('/api/betaal/status', { betaling: { status: 'BEVESTIGD', definitief: true, bedragCenten: 4500 } });
  assert.deepEqual(klachten(klaar, 'Betaald'), [], 'de provider bevestigde: dan is "Betaald" waar');
});

test('simulatie: een demo-antwoord zonder "demo" of "voorbeeld" op het scherm zakt', () => {
  const a = een('/api/rechterhand/vraag', { status: 200, ok: true, demo: true, antwoord: 'Tot uw dienst.' });
  assert.match(klachten(a, 'Tot uw dienst.')[0], /^simulatie: /);
  assert.deepEqual(klachten(a, 'Tot uw dienst. (demo-antwoord)'), []);
  const bank = een('/api/pay/start', { ok: true, betaling: { provider: 'simulatiebank', status: 'BEVESTIGD', definitief: true } });
  assert.match(klachten(bank, 'Betaald € 45')[0], /^simulatie: /, 'een betaling bij de simulatiebank is geen echte transactie');
  assert.deepEqual(klachten(bank, 'Betaald € 45 · simulatie'), []);
});

test('voorstel: een voorgestelde actie die als "Uitgevoerd" verschijnt zakt', () => {
  const a = een('/api/move/gevolg', { status: 'NIET_TE_BEPALEN', regels: [{ voorstel: { wat: 'diner later', uitgevoerd: false } }] });
  const k = klachten(a, 'Diner verplaatst naar 21:00 · verwachting');
  assert.ok(k.some((x) => /^voorstel: /.test(x)), k.join(' | '));
  assert.deepEqual(klachten(a, 'Voorstel: diner naar 21:00 · bevestig · verwachting'), []);
});

test('verouderd: een verouderde stand zonder tijdstip zakt, met "bijgewerkt 14:05" niet', () => {
  const a = een('/api/onderneming/stand', { ok: true, stand: { saldoCenten: 120000, verouderd: true } });
  assert.match(klachten(a, 'Saldo € 1.200')[0], /^verouderd: /);
  assert.deepEqual(klachten(a, 'Saldo € 1.200 · laatst bijgewerkt 14:05'), []);
});

test('een fout, een leeg antwoord en ok:false zijn geen bron', () => {
  assert.deepEqual(B.bronStand(een('/api/geld/cockpit', { ok: false, error: 'nee' })), {});
  assert.deepEqual(B.bronStand(een('/api/geld/cockpit', null)), {});
  assert.deepEqual(B.bronStand([]), {});
});

test('het oordeel per rij gebruikt de bestaande standen en noemt de gedaanten', () => {
  const a = een('/api/geld/cockpit', { ok: true });
  assert.equal(B.oordeelBewering({ antwoorden: a, tekst: '€ 120', pad: '/x' }).status, 'GEBLOKKEERD_DOOR_DEFECT');
  const goed = B.oordeelBewering({ antwoorden: a, tekst: '€ 120 verwacht', pad: '/x' });
  assert.equal(goed.status, 'BEWEZEN');
  assert.deepEqual(goed.gedaanten, ['voorspelling']);
  assert.match(goed.reden, /per scherm en niet per regel/);
  assert.equal(B.oordeelBewering({ antwoorden: [], tekst: '€', pad: '/x' }).status, 'NIET_GETEST');
  assert.equal(B.oordeelBewering({ antwoorden: a, tekst: '€', pad: '/x', landing: '/y' }).status, 'NIET_GETEST');
  assert.equal(B.oordeelBewering({ antwoorden: a, tekst: '€', pad: '/x', deur: '#poort' }).status, 'NIET_GETEST');
});

test('geen nieuwe schaal: de lijst bekende voorspellingen gebruikt de bestaande klassen', () => {
  for (const [pad, r] of Object.entries(B.ONZEKER)) {
    assert.ok(KLASSEN[r.klasse], pad + ' noemt de onbekende klasse ' + r.klasse);
    assert.ok(B.ONZEKERE_KLASSEN.has(r.klasse), pad);
  }
  assert.deepEqual(B.GEDAANTEN.map((g) => g.id), ['voorspelling', 'aanvraag', 'betaling', 'simulatie', 'voorstel', 'verouderd']);
});
