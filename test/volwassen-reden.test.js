'use strict';
/* VOLWASSEN ZEGT WAAROM NIET (X2, integrator 19 oktober 2026).

   Was de kluis niet te lezen, dan viel maakLidstand terug op een leeg dossier
   (`md = {}`), dus leeftijd null, dus volwassen() false -- stil. Het lid kreeg
   in de Arena "scores bestaan alleen voor geverifieerde 18+-leden" terwijl hij
   dat al was en alleen de kluis haperde. Nu:
     - volwassen() blijft ja of nee (geen enkele aanroeper verandert);
     - volwassen.reden(handle) zegt ja, geen-account, niveau, leeftijd-onbekend,
       te-jong of storing;
     - de spellen zeggen bij een storing "even niet te controleren" en niet de
       zin voor wie de keuring mist. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakVolwassen } = require('../server/kern/volwassen');
const grens = require('../server/kern/spellen/grens');

const lid = (u, md) => ({ getUserById: (id) => (u && u.id === id ? u : null),
  getMemberState: () => { if (md instanceof Error) throw md; return md; } });
const VOLW = { id: 1, verified: 'verified' };

test('volwassen.reden onderscheidt een storing van een echte nee', () => {
  const v = maakVolwassen({ accounts: lid(VOLW, { geboren: '1980-01-01' }) });
  assert.equal(v('user-1'), true); assert.equal(v.reden('user-1'), 'ja');
  assert.equal(maakVolwassen({ accounts: lid(VOLW, { geboren: '2015-01-01' }) }).reden('user-1'), 'te-jong');
  assert.equal(maakVolwassen({ accounts: lid({ id: 1, verified: 'pending' }, { geboren: '1980-01-01' }) }).reden('user-1'), 'niveau');
  assert.equal(maakVolwassen({ accounts: lid(VOLW, {}) }).reden('user-1'), 'leeftijd-onbekend');
  assert.equal(maakVolwassen({ accounts: lid(null, {}) }).reden('user-1'), 'geen-account');

  const kapot = maakVolwassen({ accounts: lid(VOLW, new Error('kluis onleesbaar')) });
  assert.equal(kapot('user-1'), false, 'fail-closed blijft');
  assert.equal(kapot.reden('user-1'), 'storing', 'maar het zegt dat het een storing is');
});

test('de spellen zeggen bij een storing iets anders dan bij een ontbrekende keuring', () => {
  const kapot = maakVolwassen({ accounts: lid(VOLW, new Error('kluis onleesbaar')) });
  const g = grens({ volwassen: kapot });
  assert.equal(g.progressieMag('user-1'), false);
  assert.notEqual(g.waaromNiet('user-1'), g.GEEN_PROGRESSIE, 'een storing krijgt een eigen zin');
  assert.match(g.waaromNiet('user-1'), /even niet/);
  const jong = grens({ volwassen: maakVolwassen({ accounts: lid(VOLW, { geboren: '2015-01-01' }) }) });
  assert.equal(jong.waaromNiet('user-1'), jong.GEEN_PROGRESSIE);
});
