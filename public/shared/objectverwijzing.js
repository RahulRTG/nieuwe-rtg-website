/* DE OBJECTPOORT: wat een object is als het van een scherm naar de Edge of naar
   een ander scherm gaat.

   Een object is een VERWIJZING en geen inhoud: soort, id, label en hooguit acht
   velden. Wie een dossier in een context propt, krijgt het afgekapt en niet
   doorgegeven -- de Edge bezit de werkelijkheid niet, hij krijgt er een blikveld
   op (EDGE.md par. 1), en een blikveld dat naam en adres meedraagt is een kopie
   van het dossier.

   DIT IS DE ENIGE PLEK DIE DE VORM BESLIST. Er waren er twee: de schil kapte af
   (rtg-schil/06b-objecten.js, schoneVerwijzing) en het register nam elk object
   over zoals het binnenkwam (adaptief/register.js). Beide lezen nu hier. De
   brug hoeft niets te doen: wat hij omhoog stuurt komt uit het register, en wat
   boven aankomt gaat daar opnieuw door het register.

   HET GEDRAG IS AFKAPPEN EN NIET WEIGEREN, want dat deed de werkruimte al: soort
   tot 32 tekens, id tot 64, label tot 120, hooguit 8 velden (naam tot 24, waarde
   tot 120), en alles buiten o.velden valt weg. Zonder id is er geen verwijzing:
   dan komt er null, en reden() zegt waarom.

   Laadt VOOR wie het leest: register.js op de vijf schermen met het register,
   rtg-schil.js in werkruimte.html. Beide pakken de poort bij het laden, en
   zonder poort komt er geen object door (test/objectverwijzing.test.js).

   Levert window.RTGObjectverwijzing, en in node module.exports. */
(function (root) {
  'use strict';
  var GRENS = { soort: 32, id: 64, label: 120, velden: 8, veldnaam: 24, veldwaarde: 120 };

  function reden(o) {
    if (!o || typeof o !== 'object') return 'er is geen object';
    return o.id ? '' : 'een object zonder id is geen verwijzing';
  }
  function verwijzing(o) {
    if (reden(o)) return null;
    var velden = {};
    var bron = o.velden && typeof o.velden === 'object' ? o.velden : {};
    Object.keys(bron).slice(0, GRENS.velden).forEach(function (n) {
      velden[String(n).slice(0, GRENS.veldnaam)] = String(bron[n] == null ? '' : bron[n]).slice(0, GRENS.veldwaarde);
    });
    return {
      soort: String(o.soort || '').slice(0, GRENS.soort),
      id: String(o.id).slice(0, GRENS.id),
      label: String(o.label || '').slice(0, GRENS.label),
      velden: velden
    };
  }

  var api = { verwijzing: verwijzing, reden: reden, GRENS: GRENS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RTGObjectverwijzing = api;
})(typeof window !== 'undefined' ? window : this);
