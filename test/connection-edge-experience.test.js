/* RONDE 4: CONNECTION EDGE EXPERIENCE

   De renderer krijgt geen eigen productwaarheid. Deze toetsen leggen vast dat
   DOM-acties uitsluitend uit de actuele serverprojectie komen, dat stale en
   geblokkeerde contexten verzoenen en dat presentatiegebaren geen capability
   kunnen toevoegen of een mutatie uitvoeren. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Client = require('../public/shared/connection-edge-core');
const ProductState = require('../server/kern/connection-product-state');
const Vonk = require('../server/kern/connection-state-vonk');
const Rendezvous = require('../server/kern/connection-state-rendezvous');

const root = path.resolve(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(root, bestand), 'utf8');
const member = { pass:'member', verified:true, adult:true, blocked:false };
const signature = { pass:'lifestyle', verified:true, adult:true, blocked:false };
const model = (product, productState, access) => Client.viewModel(product, ProductState.resolve({
  actor:'member', product, productState, access, subject:'a', context:{}
}));

test('de Connection Edge rendert uitsluitend acties uit availableCapabilities', () => {
  const p = { surface:'VONK_ROOT', state:'DISCOVERY', stateRevision:'r1',
    availableCapabilities:['connection.discover'], actions:[
      { id:'discover', capability:'connection.discover', labelKey:'connection.edge.discover' },
      { id:'voice', capability:'connection.voice', labelKey:'connection.edge.voice' }
    ] };
  assert.deepEqual(Client.viewModel('vonk', p).actions.map(x => x.id), ['discover']);
});

test('zonder call-consent en met implemented:false route verschijnen geen ongeldige Edge-acties', () => {
  const actief = Vonk.match({ key:'a', now:'2026-09-22T12:00:00.000Z', match:{ id:'m1', a:'a', b:'b',
    status:'bevestigd', tafel:{ datum:'2026-09-22' }, betaald:{}, halfweg:{ keuzes:{} },
    reservationEvidence:{ state:'CONFIRMED', finality:'SOURCE_ATTESTED', missing:['operational-outcome'] } } });
  const edge = model('vonk', actief, member);
  assert.deepEqual(edge.actions.map(x => x.id), ['date', 'safety']);
  assert.ok(!edge.actions.some(x => ['voice', 'route'].includes(x.id)));
});

test('Vonk en Rendez-vous kunnen nooit elkaars Edge-model krijgen', () => {
  const vonk = ProductState.resolve({ actor:'member', product:'vonk', productState:Vonk.root({ actief:true }),
    access:member, subject:'a', context:{} });
  assert.equal(Client.viewModel('rendezvous', vonk), null);
  const rv = ProductState.resolve({ actor:'member', product:'rendezvous', productState:Rendezvous.root({ aan:true }),
    access:signature, subject:'a', context:{} });
  assert.equal(Client.viewModel('vonk', rv), null);
});

test('een block op een open Vonk-context verwijdert Chat en Meet uit het clientmodel', () => {
  const match = Vonk.match({ key:'a', now:'2026-09-21T12:00:00.000Z', match:{ id:'m1', a:'a', b:'b',
    status:'wacht-op-betaling', tafel:{ datum:'2026-09-24' }, betaald:{}, halfweg:{ keuzes:{} } } });
  const voor = model('vonk', match, member);
  const na = model('vonk', match, { ...member, blocked:true });
  assert.ok(voor.actions.some(x => x.id === 'chat'));
  assert.ok(voor.actions.some(x => x.id === 'meet'));
  assert.ok(!na.actions.some(x => ['chat', 'meet'].includes(x.id)));
});

test('een gewijzigde consentprojectie vervangt de zichtbare Rendez-vous-acties', () => {
  const wacht = Rendezvous.match({ proposal:{ id:'a|b', setting:'diner', akkoord:{}, toestemming:{} },
    key:'a', targetKey:'b', now:'2026-09-22T12:00:00.000Z' });
  const goed = Rendezvous.match({ proposal:{ id:'a|b', setting:'diner', akkoord:{ a:true, b:true }, toestemming:{} },
    key:'a', targetKey:'b', now:'2026-09-22T12:00:00.000Z' });
  const a = model('rendezvous', wacht, signature), b = model('rendezvous', goed, signature);
  assert.ok(a.actions.some(x => x.id === 'approve'));
  assert.ok(!b.actions.some(x => x.id === 'approve'));
});

test('stale en verboden serverantwoorden veroorzaken reconcile', () => {
  for (const code of ['STALE_CONNECTION_STATE', 'CAPABILITY_NOT_AVAILABLE', 'CONNECTION_CONTEXT_NOT_FOUND', 'BLOCKED']) {
    assert.equal(Client.shouldReconcile({ code }), true, code);
  }
  assert.equal(Client.shouldReconcile({ code:'NETWORK_DOWN' }), false);
});

test('swipen wisselt alleen tussen een bewezen root- en kindlaag', () => {
  assert.equal(Client.layerAfterSwipe('root', 'left', false), 'root');
  assert.equal(Client.layerAfterSwipe('root', 'left', true), 'child');
  assert.equal(Client.layerAfterSwipe('child', 'right', true), 'root');
  assert.equal(Client.layerAfterSwipe('child', 'left', true), 'child');
});

test('de Edge heeft toetsenbord, screenreader, touch target, safe area, RTL en reduced motion', () => {
  const js = lees('public/shared/connection-edge.js') + lees('public/shared/connection-edge-input.js');
  const css = lees('public/shared/connection-edge.css');
  assert.match(js, /role', 'toolbar'/); assert.match(js, /aria-live/);
  assert.match(js, /data-rtg-safe-exit/); assert.match(js, /href = '\/apps\/app\.html'/);
  assert.match(js, /ArrowLeft/); assert.match(js, /Escape/); assert.match(js, /navigator\.vibrate/);
  assert.match(css, /safe-area-inset-bottom/); assert.match(css, /min-height:52px/);
  assert.match(css, /\[dir="rtl"\]/); assert.match(css, /prefers-reduced-motion:reduce/);
});

test('scroll verandert uitsluitend de presentatiemodus van de Edge', () => {
  const invoer = lees('public/shared/connection-edge-input.js');
  const fn = invoer.slice(invoer.indexOf('function scrollvorm'), invoer.indexOf('function haptic'));
  assert.match(fn, /classList\.toggle\('is-compact'/);
  assert.doesNotMatch(fn, /load\(|fetch\(|onAction|stateRevision/);
});

test('Vonk en Rendez-vous delen de engine maar niet hun presentatie', () => {
  const css = lees('public/shared/connection-edge.css');
  assert.match(css, /\.connection-edge--vonk\{/);
  assert.match(css, /\.connection-edge--rendezvous\{/);
  assert.match(css, /connection-edge--vonk[\s\S]*rgba\(72,19,36/);
  assert.match(css, /connection-edge--rendezvous[\s\S]*Bodoni Moda/);
  for (const app of ['vonk.html', 'rendezvous.html']) {
    const html = lees('public/apps/' + app);
    assert.match(html, /connection-edge-core\.js/); assert.match(html, /connection-edge-input\.js/);
    assert.match(html, /connection-edge\.js/); assert.match(html, /connection-edge\.css/);
    assert.match(html, /data-rtg-safe-exit/);
    assert.doesNotMatch(html, /const tabs =/);
  }
});
