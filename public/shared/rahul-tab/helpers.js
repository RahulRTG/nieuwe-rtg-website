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
  window.RTGRahulTabHelpers = { tekst: tekst, context: context, suggesties: suggesties };
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
