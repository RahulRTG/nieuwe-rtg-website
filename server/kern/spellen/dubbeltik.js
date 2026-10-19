/* Spellen (deelmodule): DE DUBBELE TIK OP "NODIG UIT EN START".

   Een tweede tik die op een trage verbinding binnenkomt terwijl de eerste nog
   loopt, maakte een TWEEDE potje: de vriend kreeg twee uitnodigingen voor
   hetzelfde spel, en wie op allebei ja zei zat in twee partijen tegelijk. De
   voltooiproef (scripts/lib/voltooi/spelen.js) liet het zien.

   Wat telt als dezelfde handeling: dezelfde starter, hetzelfde spel, dezelfde
   grootte en precies dezelfde genodigden, op een potje dat nog wacht en waar
   nog niemand bij kwam, binnen enkele seconden. Twee keer bewust dezelfde vriend
   voor hetzelfde spel uitnodigen in die tijd is geen bedoeling die bestaat; een
   ander spel, een andere vriend of later opnieuw is gewoon een nieuw potje.

   De vergelijking staat na het laatste `await` van spelNieuw, in hetzelfde
   synchrone stuk als het aanmaken: zo kan geen tweede verzoek ertussen glippen. */
'use strict';

const VENSTER_MS = 10000;

function dubbeltik(potjes, mij, { soort, grootte, uitgenodigd }, nuMs) {
  const wie = (uitgenodigd || []).slice().sort().join('|');
  const nu = nuMs === undefined ? Date.now() : nuMs;
  return Object.values(potjes || {}).find((p) => p && p.status === 'wacht' && p.soort === soort &&
    p.grootte === grootte && p.spelers.length === 1 && p.spelers[0] === mij &&
    (p.uitgenodigd || []).slice().sort().join('|') === wie &&
    nu - Date.parse(p.at) >= 0 && nu - Date.parse(p.at) < VENSTER_MS) || null;
}

module.exports = { dubbeltik, VENSTER_MS };
