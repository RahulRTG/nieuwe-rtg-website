/* Logeren bij leden: de teksten beloven geen betaling die er niet is.

   DE FOUT (domeinkaart LivingOS-A, 19 oktober 2026). Een boeking zei "De
   betaling loopt via RTG Pay bij bevestiging", na het uitchecken stond de
   uitbetaling op 'gepland', het hostbord zei "Uitbetalingen staan gepland" en
   annuleren meldde "X% terug". Maar kern/thuis verplaatst geen cent: beslissen
   zet alleen een status, terugPct wordt alleen vastgelegd en de uitbetaling
   wordt nooit uitgevoerd. Tot het betalen er is (toezegging van de eigenaar),
   zegt de app dat het niet via RTG loopt.

   Draai los: node --test test/thuis-betaaltekst.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const lees = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('geen belofte van betalen, terugbetalen of uitbetalen via RTG', () => {
  const kern = lees('server/kern/thuis/boeken.js') + lees('server/kern/thuis/extra.js');
  const scherm = lees('public/apps/thuis.html');
  assert.doesNotMatch(kern, /loopt via RTG Pay bij bevestiging/, 'de boeking belooft RTG Pay');
  assert.doesNotMatch(kern, /status:\s*'gepland'/, 'de uitbetaling heet gepland');
  assert.doesNotMatch(kern, /staan gepland/, 'het hostbord belooft geplande uitbetalingen');
  assert.doesNotMatch(scherm, /uitbetaling staat gepland/, 'het hostformulier belooft een uitbetaling');
  assert.doesNotMatch(scherm, /% terug volgens het beleid\./, 'annuleren meldt geld terug zonder te zeggen dat er via RTG niets betaald is');
});
