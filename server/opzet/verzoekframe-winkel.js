/* DE WINKEL VAN HET VERZOEKFRAME: de opslag, de vakken van een nieuw frame en
   de tellers. Afgesplitst van ./verzoekframe.js (keuringsregel 13) op de naad
   tussen staat en handelingen; wat een frame BETEKENT staat in de kop daar. */
'use strict';
const { AsyncLocalStorage } = require('async_hooks');
const correlatie = require('../lib/correlatie');

const winkel = new AsyncLocalStorage();
const SOORTEN = Object.freeze(['verzoek', 'dienst', 'webhook', 'overdracht']);
const GEEN_HOEDANIGHEID = Object.freeze({ naam: null, sinds: null,
  reden: 'de sessie draagt geen hoedanigheid; alleen een aan de sessiesleutel getoetste machtiging kan er een geven' });
const tellers = { geopend: 0, geidentificeerd: 0, herkend: 0, tweedeIdentiteit: 0, naSluiten: 0, overgedragen: 0,
  codenaamGeweigerd: 0 };

function nieuw({ soort, correlatie: c, extern, oorzaak } = {}) {
  tellers.geopend++;
  return { correlatie: c || correlatie.nieuw(), extern: extern || null, oorzaak: oorzaak || null,
    soort: SOORTEN.includes(soort) ? soort : 'verzoek', actor: null, hoedanigheid: GEEN_HOEDANIGHEID,
    drager: null, stand: 'open' };
}

module.exports = { winkel, SOORTEN, GEEN_HOEDANIGHEID, tellers, nieuw };
