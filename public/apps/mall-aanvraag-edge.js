/* Edge voert dezelfde bronknop uit. Selectie verandert context, nooit rechten. */
(function (w) {
  'use strict';
  var huidig = null;
  w.RTGAanvraagEdge = function (kaart, aanvraag, uitvoer) {
    function selecteer() {
      var A = w.RTGAdaptief; if (!A || !kaart.isConnected || kaart.closest('[hidden]')) return;
      huidig = aanvraag.id;
      var ids = (aanvraag.acties || []).map(function (actie) {
        var id = 'mall.aanvraag.' + actie.id;
        A.declareer({ id: id, naam: actie.label, groep: 'Aanvraag', telefoon: ['balk', 'lade'],
          tablet: ['balk', 'lade'], bureau: ['werkbalk'],
          doe: function () { if (kaart.isConnected) uitvoer(actie.id); } });
        return id;
      });
      A.context({ bron: 'mall.aanvraag', titel: aanvraag.wat, acties: ids });
    }
    kaart.addEventListener('focusin', selecteer); kaart.addEventListener('click', selecteer);
    if (!huidig || huidig === aanvraag.id) selecteer();
  };
  w.RTGAanvraagEdgeWis = function () {
    huidig = null;
    if (w.RTGAdaptief) w.RTGAdaptief.wisContext('mall.aanvraag');
  };
  w.addEventListener('hashchange', w.RTGAanvraagEdgeWis);
}(window));
