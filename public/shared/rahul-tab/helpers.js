/* Context en taalregels voor de universele Rahul-tab. */
(function () {
  'use strict';
  function tekst(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  /* DE CONTEXT VOOR RAHUL. Met een Edge Blikveld komt hij daaruit (EDGE.md
     par. 14.4): schermtitel, wereld, leesmoment en een verwijzing naar het
     aangewezen object, die de server zelf opzoekt. De tekst van een gekozen
     optie wordt dan NIET meer uit de DOM geschraapt: dat kon alles zijn, ook
     een naam. Zonder blikveld blijft alles zoals het was. `app` blijft de
     documenttitel, want de tab toont die en de suggesties lezen hem. */
  function context() {
    var B = window.RTGEdgeBlikveld;
    if (B && typeof B.voorRahul === 'function') {
      try {
        var b = B.voorRahul();
        return { app: document.title.replace(/^RTG\s*/i, '') || 'RTG', deel: b.deel || 'Actieve pagina',
          selectie: '', wereld: b.wereld, verwijzingen: b.verwijzingen, op: b.op };
      } catch (e) { /* val terug op de oude bron */ }
    }
    var actief = document.querySelector('[data-wk].actief,.rv-bank .actief,.lo-rail .actief,.pn-rail .actief,.po-rail .actief,nav .actief');
    var keuze = document.querySelector('select:focus,select option:checked,[aria-selected="true"]');
    var titel = document.title.replace(/^RTG\s*/i, '');
    return {
      app: titel || 'RTG',
      deel: actief ? actief.textContent.trim() : 'Actieve pagina',
      selectie: keuze ? keuze.textContent.trim() : ''
    };
  }
  function suggesties(c) {
    var bron = c.app + c.deel;
    if (/werk|employee|personeel/i.test(bron)) return ['Bundel mijn beslissingen', 'Bereid onboarding voor', 'Wat blokkeert het team?'];
    if (/reis|living|veilig/i.test(bron)) return ['Bescherm mijn reis', 'Simuleer een verstoring', 'Wat vraagt mijn akkoord?'];
    if (/geld|bank|finance/i.test(bron)) return ['Geef mijn financiële aandacht', 'Simuleer een keuze', 'Controleer risico’s'];
    return ['Wat vraagt nu aandacht?', 'Open het juiste onderdeel', 'Bereid de volgende stap voor'];
  }
  /* DE STAVING ONDER EEN ANTWOORD (server/kern/stuur/staving.js). Alleen wat
     NIET is teruggevonden in wat Rahul in deze beurt opzocht, en dan in een
     regel; wat wel klopt krijgt geen vinkje, want een gevonden getal bewijst
     niet dat het in de juiste betekenis is gebruikt. Geen staving: geen regel. */
  function noot(d) {
    var n = d && d.staving && d.staving.nietGevonden, uit = [];
    if (n && n.length) uit.push('Niet teruggevonden in wat Rahul opzocht: ' + n.slice(0, 6).join(', ') + '. Lees dat als onbekend.');
    /* Het taakbeeld van de server (shared/edge/taakbeeld.js, EDGE.md par. 14.4):
       wat Rahul begreep, voorstelt en wat er werkelijk gebeurde. Als tekst. */
    var T = window.RTGEdgeTaakbeeld;
    if (d && d.taak && T && T.regels) T.regels(d.taak).forEach(function (r) { uit.push(r.tekst); });
    return uit.join('\n');
  }
  /* Een bericht in het gesprek, met de noot eronder als die er is. Alles gaat
     door tekst(): wat uit een antwoord komt, is nooit opmaak. */
  function bericht(m) {
    var mens = m.rol === 'user';
    return '<div class="rtg-command-msg ' + (mens ? 'user' : '') + '"><b>' + (mens ? 'U' : 'RAHUL') + '</b>' + tekst(m.tekst) +
      (m.noot ? '<small class="rtg-command-noot">' + tekst(m.noot) + '</small>' : '') + '</div>';
  }
  window.RTGRahulTabHelpers = { tekst: tekst, context: context, suggesties: suggesties, noot: noot, bericht: bericht };
  /* Escape sluit het Rahul-paneel, zoals elke andere laag in deze schil
     (GRAMMATICA.md: ik kan bijna altijd terug). Het paneel ligt vast over het
     werkblad; zonder dit was de sluitknop de enige weg terug. Dezelfde knop,
     dus dezelfde weg dicht. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var paneel = document.querySelector('.rtg-rahul-page');
    var dicht = paneel && !paneel.hidden && paneel.querySelector('.rtg-command-close');
    if (dicht) { e.stopPropagation(); dicht.click(); }
  }, true);
})();
