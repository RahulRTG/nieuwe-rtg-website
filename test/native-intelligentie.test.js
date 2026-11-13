/* RTG NATIVE INTELLIGENCE -- de gesloten verticale doorsnede:
   waarborgcontract -> Plan Twin -> effectbon -> invariantcontrole.

   Deze toets bewijst niet dat alle capabilities een contract hebben. Hij
   bewijst wel dat ontbrekende kennis zichtbaar blijft, een Plan Twin niets kan
   uitvoeren en een werkelijk waargenomen verboden klasse de invariant laat
   zakken. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const waarborg = require('../server/kern/stuur/waarborgcontract');
const { CONTRACTEN } = require('../server/kern/stuur/gevolgcontract/register');
const { compileer } = require('../server/kern/stuur/plan');
const plantweeling = require('../server/kern/stuur/plantweeling');
const effectbon = require('../server/effectbon');

test('1. elk bestaand gevolgcontract projecteert pre-, postcondities en invarianten zonder tweede register', () => {
  for (const pad of Object.keys(CONTRACTEN)) {
    const p = waarborg.projecteer(pad);
    assert.equal(p.stand, 'VOLLEDIG', pad + ': ' + p.open.join(', '));
    assert.ok(p.precondities.length, pad + ': geen precondities');
    assert.ok(p.postcondities.length, pad + ': geen postconditie');
    assert.ok(Array.isArray(p.invarianten), pad + ': geen expliciete invariantlijst');
    assert.ok(p.precondities.every(v => v.getoetst === false),
      pad + ': een verklaring is ten onrechte als live toets gepresenteerd');
  }
  const onbekend = waarborg.projecteer('/api/nergens');
  assert.equal(onbekend.stand, 'ONBEKEND');
  assert.match(onbekend.grens, /geen toestemming/i);
});

test('2. een verboden waargenomen effect schendt de invariant; een blinde zone heet niet behouden', () => {
  const geschonden = waarborg.controleerInvarianten('/api/office/bank/incasso', {
    klassen: ['GELD_BEWEGEN'], dekking: { schreefOpslag: true, diep: true }
  });
  assert.equal(geschonden.stand, 'GESCHONDEN');
  assert.ok(geschonden.rijen.some(r => r.klasse === 'GELD_BEWEGEN' && r.uitkomst === 'GESCHONDEN'));

  const blind = waarborg.controleerInvarianten('/api/office/bank/incasso', {
    klassen: [], dekking: { schreefOpslag: false, diep: true }
  });
  assert.equal(blind.stand, 'NIET_VOLLEDIG_MEETBAAR');
  assert.ok(blind.rijen.some(r => r.klasse === 'UITGAANDE_AANROEP' && r.uitkomst === 'NIET_MEETBAAR'));

  const oningedeeld = waarborg.controleerInvarianten('/api/office/bank/incasso', {
    klassen: [], dekking: { schreefOpslag: true, diep: true,
      collectiesZonderIndeling: ['nieuweOnbekendeCollectie'] }
  });
  assert.equal(oningedeeld.stand, 'NIET_VOLLEDIG_MEETBAAR');
  assert.ok(oningedeeld.rijen.some(r => r.meetweg === 'opslag' && r.uitkomst === 'NIET_MEETBAAR'),
    'een diepe maar oningedeelde opslagwijziging mag geen behouden invariant opleveren');
});

test('3. de effectbon controleert invarianten werkelijk na de handeling', () => {
  const bon = effectbon.maak({
    envelop: { correlatie: 'native-intelligentie-proef', capability: 'POST /api/office/bank/incasso' },
    teller: { mail: 1, opslag: false, collecties: new Set(), collectieDekking: 'proxy-v1' }
  });
  assert.ok(bon.klassen.includes('EXTERN_BEREIKEN'), 'voorwaarde: de bon zag het uitgaande bericht');
  assert.equal(bon.waarborg.stand, 'GESCHONDEN');
  assert.ok(bon.waarborg.rijen.some(r => r.klasse === 'EXTERN_BEREIKEN' && r.uitkomst === 'GESCHONDEN'));
});

test('4. de Plan Twin is tijdelijk, geisoleerd, eerlijk over onbekenden en wijzigt zijn invoer niet', () => {
  const plan = compileer({ doel: 'weeg twee stappen', stappen: [
    { id: 'geld', capability: '/api/bank/sepa' },
    { id: 'agenda', capability: '/api/agenda/bewaar', afhankelijkVan: ['geld'] }
  ] }, 'member');
  const voor = JSON.stringify(plan);
  const twin = plantweeling.bouw(plan);
  assert.equal(JSON.stringify(plan), voor, 'de Twin heeft het plan gewijzigd');
  assert.equal(twin.tijdelijk, true);
  assert.equal(twin.geisoleerd, true);
  assert.equal(twin.verandertWerkelijkheid, false);
  assert.equal(twin.telling.benaderend, 1);
  assert.equal(twin.telling['niet-beschikbaar'], 1);
  assert.equal(twin.uitvoerbaar, false, 'een niet-simuleerbare stap mag niet als simuleerbaar plan lezen');
  assert.ok(twin.scenarios.find(s => s.id === 'agenda').onbekenden.length);
});

test('5. de Rahul-planstap levert dezelfde Plan Twin aan Edge terug', () => {
  const planStap = require('../server/kern/stuur/lusstap-plan');
  const acties = [];
  const uit = planStap({ input: { doel: 'betaal gecontroleerd', stappen: [
    { id: 'a', capability: '/api/bank/sepa' }
  ] } }, { wereld: 'member', acties, spoor: null });
  assert.equal(uit.tweeling.soort, 'plan-twin');
  assert.equal(acties[0].plan.tweeling.verandertWerkelijkheid, false);
  assert.deepEqual(acties[0].plan.tweeling, uit.tweeling);
});

test('6. Plan Twin en waarborgcontract hebben structureel geen uitvoeringsweg', () => {
  for (const bestand of ['server/kern/stuur/plantweeling.js', 'server/kern/stuur/waarborgcontract.js']) {
    const ruw = fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');
    const bron = ruw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    for (const verboden of [/\bfetch\s*\(/, /stuurRoep/, /https?\.request/, /child_process/, /\.schrijf\s*\(/])
      assert.ok(!verboden.test(bron), bestand + ' heeft een uitvoeringsweg: ' + verboden);
  }
});
