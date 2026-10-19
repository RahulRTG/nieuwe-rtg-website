/* Krant: de redactie-assistent gebruikt de AI-keten van het huis.

   DE FOUT (domeinkaart LivingOS-A, 19 oktober 2026). kern/journalistiek.js
   verwachtte een `claude` met beschikbaar() en vraag(), maar server.js gaf hem
   niets mee. assist() viel daardoor altijd terug op de regels, ook als er een
   lokaal model of een sleutel was. Nu krijgt hij de lokaal-eerst-keten
   (`anthropic`, server/ai.js) en vraagt hij via ai-kort.tekst; zonder model
   blijft de regelgestuurde chapo, en een fout van het model wordt nooit een
   verzonnen antwoord.

   Draai los: node --test test/journalistiek-assist.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function kern(anthropic) {
  const db = { data: {} };
  return require('../server/kern/journalistiek')({ db, save: () => {}, crypto, schoon: (s, n) => String(s || '').slice(0, n), findSupplier: () => null, anthropic });
}
const STUK = { titel: 'Haven open', inhoud: 'De nieuwe haven gaat zaterdag open. Er komen veertig ligplaatsen bij.' };

test('met een model in de keten geeft assist ook een AI-voorstel', async () => {
  let gevraagd = null;
  const anthropic = { messages: { create: async (x) => { gevraagd = x; return { content: [{ text: 'Chapo: De haven opent.' }] }; } } };
  const r = await kern(anthropic).assist('KRANT', STUK);
  assert.equal(r.ai, 'Chapo: De haven opent.');
  assert.ok(gevraagd && /eindredacteur/.test(gevraagd.system), 'de vraag ging via de keten met de rol van eindredacteur');
  assert.equal(r.chapo, 'De nieuwe haven gaat zaterdag open.', 'de regelgestuurde chapo blijft er ook');
});

test('zonder model, of als het model faalt, blijft alleen de regel over', async () => {
  const geen = await kern(null).assist('KRANT', STUK);
  assert.equal(geen.ai, undefined);
  assert.equal(geen.chapo, 'De nieuwe haven gaat zaterdag open.');
  const stuk = { messages: { create: async () => { throw new Error('geen aanbieder'); } } };
  const faalt = await kern(stuk).assist('KRANT', STUK);
  assert.equal(faalt.ai, undefined, 'een falend model geeft geen verzonnen antwoord');
});
