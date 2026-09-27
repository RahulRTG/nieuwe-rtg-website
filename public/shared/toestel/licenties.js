/* DE LICENTIEGRENDEL -- een licentie is een grendel en geen veld.
   TOESTEL.md par. 3.4 en besluit 3 (25 september 2026: "zo breed mogelijk").

   Zo breed mogelijk betekent: alles wat commercieel gebruik toestaat en
   waarvan de voorwaarden bekend zijn. Twee soorten blijven dicht, en niet uit
   voorzichtigheid maar omdat ze niet te verenigen zijn met wat RTG is:

     - een onbekende of ontbrekende licentie: dan weet niemand wat er mag;
     - een niet-commerciele licentie (CC-BY-NC): RTG is een commerciele dienst.

   Een licentie met EISEN (naamsvermelding, een gebruiksbeleid, een
   gebruikersplafond) mag, en de eisen reizen mee met de uitslag. Wie een model
   toont, toont de naamsvermelding; de cel laadt niets waarvan de licentie hier
   niet staat (KAARTEN.md par. 5a: zonder vermelding geen pakket).

   Puur. In de browser window.RTGToestelLicenties, in Node via require. */
(function (root, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RTGToestelLicenties = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERMELDING = 'naamsvermelding';
  var TOEGESTAAN = Object.freeze({
    'Apache-2.0': Object.freeze([VERMELDING]),
    'MIT': Object.freeze([VERMELDING]),
    'BSD-2-Clause': Object.freeze([VERMELDING]),
    'BSD-3-Clause': Object.freeze([VERMELDING]),
    'ISC': Object.freeze([VERMELDING]),
    'CC-BY-4.0': Object.freeze([VERMELDING]),
    'CC-BY-SA-4.0': Object.freeze([VERMELDING, 'gelijk delen van afgeleide modellen']),
    'CC0-1.0': Object.freeze([]),
    'OpenRAIL-M': Object.freeze([VERMELDING, 'gebruiksbeperkingen uit de licentie gelden ook voor RTG']),
    'Gemma': Object.freeze([VERMELDING, 'het verboden-gebruikbeleid van Gemma geldt ook voor RTG']),
    'Llama-3': Object.freeze([VERMELDING, '"Built with Llama"', 'plafond van 700 miljoen maandgebruikers',
      'het acceptable-use-beleid van Meta geldt ook voor RTG'])
  });

  var GEWEIGERD = Object.freeze({
    'CC-BY-NC-4.0': 'niet-commercieel: RTG is een commerciele dienst',
    'CC-BY-NC-SA-4.0': 'niet-commercieel: RTG is een commerciele dienst',
    'CC-BY-NC-ND-4.0': 'niet-commercieel: RTG is een commerciele dienst'
  });

  function keur(licentie) {
    var id = String(licentie || '').trim();
    if (!id) return { mag: false, reden: 'geen licentie opgegeven; dan weet niemand wat er mag' };
    if (Object.prototype.hasOwnProperty.call(GEWEIGERD, id)) return { mag: false, reden: GEWEIGERD[id] };
    if (!Object.prototype.hasOwnProperty.call(TOEGESTAAN, id))
      return { mag: false, reden: 'onbekende licentie (' + id + '); eerst beoordelen, dan toevoegen' };
    return { mag: true, eisen: TOEGESTAAN[id].slice() };
  }

  return Object.freeze({ TOEGESTAAN: TOEGESTAAN, GEWEIGERD: GEWEIGERD, keur: keur });
}));
