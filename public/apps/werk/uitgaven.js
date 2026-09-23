/* RTG Werk OS (scherm): de module Uitgaven.

   Een eigen bestand en geen extra tak in ./modules.js en ./acties.js, want die
   zitten allebei tegen de bestandsgrens. Hij haakt in op DEZELFDE twee lijsten
   (RTGWerkModules.MODULES en RTGWerkActies.HANDELINGEN), zodat de keuzelijst,
   de meldingen en de knoppen precies zo werken als bij contracten en besluiten
   -- geen tweede manier om een handeling te doen.

   Wat de server weigert, staat hier gewoon als melding: de indiener die zelf
   wil goedkeuren, een bedrag boven de tekengrens, een betaling via RTG Bank
   met een opdracht van iemand anders. Die zinnen zijn het halve product.

   De betaalwijze staat bovenaan de tweede lijst, MET de reden als RTG de weg
   via RTG Bank heeft uitgezet: een werkruimte die "rtgbank" koos en toch buiten
   RTG moet betalen, hoort dat te lezen voordat ze een opdrachtnummer zoekt. */
(function () {
  'use strict';
  var K = window.RTGWerk;
  var M = window.RTGWerkModules;
  var A = window.RTGWerkActies;
  if (!K || !M || !A) return;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;

  function laad() {
    K.api('/uitgaven', {}).then(function (r) {
      if (r.body.error) { K.meld(r.body.error); return K.lijst($('mLijst'), [], 'Geen toegang tot uitgaven.'); }
      K.lijst($('mLijst'), (r.body.uitgaven || []).map(function (u) {
        var tag = u.stand === 'betaald' ? ' aan' : u.stand === 'goedgekeurd' ? '' : ' laat';
        return K.rij('<b>' + esc(u.omschrijving) + '</b> <span class="stil">' + esc(u.begunstigde) + '</span> ' +
          '<span class="tag' + tag + '">' + esc(u.stand) + '</span>',
          '&euro; ' + esc(u.bedrag) + ' · id ' + esc(u.id) + ' · ingediend door ' + esc(u.door) +
          (u.ontbreekt && u.ontbreekt.length && u.stand !== 'betaald' ? ' · nodig: ' + u.ontbreekt.map(esc).join(', ') : '') +
          (u.betaald ? ' · betaald (' + esc(u.betaald.via || 'extern') + ', ' + esc(u.betaald.kenmerk) + ')' : ''));
      }), 'Nog geen uitgaven.');
      var bw = r.body.betaalwijze || {};
      K.lijst($('mExtra'), [K.rij('<b>Betaalwijze</b> <span class="tag">' + esc(bw.wijze || 'extern') + '</span>',
        bw.wijze === 'rtgbank'
          ? 'Een ander dan de indiener maakt de SEPA-overboeking vanaf zijn eigen RTG-rekening en geeft het opdrachtnummer op.'
          : (bw.reden ? esc(bw.reden) : 'Buiten RTG betalen, en een ander dan de indiener noteert het kenmerk.'))], '');
      $('mLet').textContent = r.body.let || '';
    });
  }

  M.MODULES.uitgaven = { titel: 'Uitgaven', laad: laad };
  A.HANDELINGEN.uitgaven = [
    ['Uitgave indienen', '/uitgave/maak', [['omschrijving', 'Omschrijving', 'tekst'], ['begunstigde', 'Begunstigde', 'tekst', '10rem'],
      ['bedrag', 'Bedrag in euro', 'getal', '8rem'], ['iban', 'IBAN begunstigde', 'tekst', '12rem'], ['factuur', 'Factuurnummer', 'tekst', '8rem']]],
    ['Goedkeuren', '/keur', [['soort', 'soort', 'vast:uitgave'], ['id', 'Uitgave-id', 'tekst', '9rem'],
      ['recht', 'Namens', 'keuze:geld.goedkeuren,recht,besluit', '10rem']]],
    ['Betaald noteren', '/uitgave/betaald', [['id', 'Uitgave-id', 'tekst', '9rem'], ['kenmerk', 'Kenmerk (buiten RTG)', 'tekst', '10rem'],
      ['opdrachtId', 'SEPA-opdracht (via RTG Bank)', 'tekst', '11rem']]],
    ['Betaalwijze kiezen', '/werkruimte/betaalwijze', [['wijze', 'Betaalwijze', 'keuze:extern,rtgbank', '9rem']]],
    ['Koppel aan entiteit', '/werkruimte/entiteit', [['entiteitId', 'Entiteit-id (leeg = loskoppelen)', 'tekst', '14rem']]],
    ['Tekengrens van een lid', '/lid/tekengrens', [['lidId', 'Lid-id', 'tekst', '9rem'], ['bedrag', 'Grens in euro (leeg = geen)', 'getal', '11rem']]]
  ];
})();
