/* WORK heeft drie voordeuren voor drie verschillende situaties. Dit zijn geen
   nieuwe rollen en ze verlenen geen rechten: iedere kaart opent de bestaande
   specialist, die zijn eigen personeels-, bedrijfs- of Business Pass-poort
   blijft handhaven. De schil kiest alleen welke routes logisch bij elkaar
   worden getoond. */
(function (wortel, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (wortel) {
    wortel.RTGWorkDoelgroepen = api;
    if (wortel.document) api.start(wortel, wortel.document);
  }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';

  var VOLGORDE = ['personeel', 'ondernemers', 'aanmelden'];
  var TEKST = {
    personeel: {
      naam: 'Personeel',
      kop: 'Uw werkdag, op uw eigen naam.',
      uitleg: 'Open uw dienst, taken, team, loon en persoonlijke werkplek. Uw werkgever ziet alleen wat voor het werk nodig is; uw vertrouwenslijn blijft privé.'
    },
    ondernemers: {
      naam: 'Ondernemers en bedrijven',
      kop: 'Van eerste idee tot draaiende organisatie.',
      uitleg: 'Bouw een onderneming op, beheer een bestaand bedrijf of verbind meerdere bedrijven in één concern. Operationele rechten blijven aan uw echte bedrijfsrol gekoppeld.'
    },
    aanmelden: {
      naam: 'Bedrijf aanmelden',
      kop: 'Breng uw bedrijf gecontroleerd naar RTG.',
      uitleg: 'Bereid uw onderneming voor en dien daarna de partneraanvraag in. Een bedrijf gaat pas live na een actieve Business Pass, menselijke beoordeling en volledige inrichting.'
    }
  };

  function geldig(id) { return Object.prototype.hasOwnProperty.call(TEKST, id); }
  function normaliseer(id) { return geldig(id) ? id : 'personeel'; }

  function start(w, d) {
    var keuzes = Array.prototype.slice.call(d.querySelectorAll('[data-work-kies]'));
    if (!keuzes.length) return;
    var kop = d.getElementById('workDoelgroepKop');
    var uitleg = d.getElementById('workDoelgroepUitleg');
    var query = new URLSearchParams(w.location.search).get('doelgroep');
    var hash = String(w.location.hash || '').replace(/^#/, '');
    var actief = normaliseer(geldig(query) ? query : hash);

    function teken() {
      d.body.dataset.workDoelgroep = actief;
      keuzes.forEach(function (keuze) {
        var gekozen = keuze.dataset.workKies === actief;
        keuze.classList.toggle('actief', gekozen);
        if (gekozen) keuze.setAttribute('aria-current', 'page');
        else keuze.removeAttribute('aria-current');
      });
      d.querySelectorAll('[data-work-paneel]').forEach(function (paneel) {
        paneel.hidden = paneel.dataset.workPaneel !== actief;
      });
      if (kop) kop.textContent = TEKST[actief].kop;
      if (uitleg) uitleg.textContent = TEKST[actief].uitleg;
    }
    function kies(id, adres) {
      actief = normaliseer(id);
      teken();
      if (adres !== false && w.history && w.history.replaceState)
        w.history.replaceState(null, '', w.location.pathname + w.location.search + '#' + actief);
      return actief;
    }

    keuzes.forEach(function (keuze) {
      keuze.addEventListener('click', function (e) {
        e.preventDefault();
        kies(keuze.dataset.workKies);
      });
    });
    teken();
    return { kies: kies, actief: function () { return actief; } };
  }

  return { VOLGORDE: VOLGORDE, TEKST: TEKST, normaliseer: normaliseer, start: start };
});
