/* Context en taalregels voor de universele Rahul-tab. */
(function () {
  'use strict';
  function tekst(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function context() {
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
    var n = d && d.staving && d.staving.nietGevonden;
    if (!n || !n.length) return '';
    return 'Niet teruggevonden in wat Rahul opzocht: ' + n.slice(0, 6).join(', ') + '. Lees dat als onbekend.';
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
