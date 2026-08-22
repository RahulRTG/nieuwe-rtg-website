/* LIFE heeft drie paslagen. De volgorde op het scherm is een productkeuze;
   toegang blijft dezelfde cumulatieve pastrap die de server afdwingt:
   RTG is de basis, Lifestyle voegt de private suite toe en Business erft die
   suite plus de zakelijke vermogens. Een URL-parameter is alleen een
   presentatiestand voor een scherm zonder sessie. Zodra er een geldig account
   is, wint altijd de tier uit /api/auth/me. */
(function (wortel, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (wortel) {
    wortel.RTGLifeLagen = api;
    if (wortel.document) api.start(wortel, wortel.document);
  }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';

  var VOLGORDE = ['rtg', 'business', 'lifestyle'];
  var TOEGANG = {
    rtg: ['rtg'],
    lifestyle: ['rtg', 'lifestyle'],
    business: ['rtg', 'business', 'lifestyle']
  };
  var TEKST = {
    rtg: {
      naam: 'RTG',
      kop: 'Uw dagelijkse basis.',
      uitleg: 'Reizen, mensen, thuis, veiligheid, geld en media. De volledige basis van LIFE, zonder dat de instap als een uitgeklede versie voelt.'
    },
    business: {
      naam: 'Business',
      kop: 'Uw leven rond het ondernemerschap.',
      uitleg: 'Zakelijke reizen, professionele relaties en financiële regie komen samen met de RTG-basis. Werksoftware zelf blijft overzichtelijk in WORK.'
    },
    lifestyle: {
      naam: 'Lifestyle',
      kop: 'Uw private leefwereld.',
      uitleg: 'De RTG-basis met Het Privékantoor, De Rechterhand en de private suite voor reizen, huis, tafel, kring en nalatenschap.'
    }
  };

  function geldig(laag) { return Object.prototype.hasOwnProperty.call(TOEGANG, laag); }
  function normaliseer(laag) { return geldig(laag) ? laag : 'rtg'; }
  function magOpenen(pas, laag) {
    pas = normaliseer(pas); laag = normaliseer(laag);
    return TOEGANG[pas].indexOf(laag) !== -1;
  }
  function heeftVereiste(pas, vereiste) {
    if (!vereiste || vereiste === 'rtg') return true;
    return magOpenen(pas, vereiste);
  }

  function start(w, d) {
    var knoppen = Array.prototype.slice.call(d.querySelectorAll('[data-life-laag]'));
    if (!knoppen.length) return;
    var kop = d.getElementById('lifeLaagKop');
    var uitleg = d.getElementById('lifeLaagUitleg');
    var melding = d.getElementById('lifeLaagMelding');
    var status = d.getElementById('lifePasStatus');
    var token = null;
    try { token = w.localStorage.getItem('rtg_member_token'); } catch (e) { token = null; }
    /* Met een sessietoken vertrouwen we geen zelfgekozen ?pas=. Tot /auth/me
       antwoordt blijft het scherm daarom op de RTG-basis; de servertier zet hem
       daarna pas hoger. Zonder sessie mag ?pas= alleen de presentatie tonen. */
    var gevraagd = new URLSearchParams(w.location.search).get('pas');
    var pas = token ? 'rtg' : normaliseer(gevraagd);
    var actief = pas;

    function toonMelding(tekst) {
      if (!melding) return;
      melding.textContent = tekst || '';
      melding.hidden = !tekst;
    }
    function teken() {
      d.body.dataset.lifePas = pas;
      d.body.dataset.lifeLaag = actief;
      knoppen.forEach(function (knop) {
        var laag = knop.dataset.lifeLaag;
        var open = magOpenen(pas, laag);
        var gekozen = laag === actief;
        knop.classList.toggle('actief', gekozen);
        knop.classList.toggle('vergrendeld', !open);
        knop.setAttribute('aria-pressed', String(gekozen));
        knop.setAttribute('aria-disabled', String(!open));
      });
      d.querySelectorAll('[data-life-laagpaneel]').forEach(function (paneel) {
        paneel.hidden = paneel.dataset.lifeLaagpaneel !== actief;
      });
      d.querySelectorAll('[data-life-eist]').forEach(function (onderdeel) {
        onderdeel.hidden = !heeftVereiste(pas, onderdeel.dataset.lifeEist);
      });
      if (kop) kop.textContent = TEKST[actief].kop;
      if (uitleg) uitleg.textContent = TEKST[actief].uitleg;
      if (status) status.textContent = TEKST[pas].naam + ' Pass · LIFE';
    }
    function kies(laag) {
      laag = normaliseer(laag);
      if (!magOpenen(pas, laag)) {
        toonMelding('De ' + TEKST[laag].naam + ' Pass ontstaat alleen na menselijke goedkeuring of op uitnodiging. LIFE verleent hier zelf geen toegang.');
        return false;
      }
      actief = laag;
      toonMelding('');
      teken();
      return true;
    }
    function zetPas(nieuwePas) {
      pas = normaliseer(nieuwePas);
      actief = pas;
      toonMelding('');
      teken();
    }

    knoppen.forEach(function (knop) {
      knop.addEventListener('click', function () { kies(knop.dataset.lifeLaag); });
    });
    teken();

    if (token) {
      w.fetch('/api/auth/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: '{}'
      }).then(function (antwoord) { return antwoord.ok ? antwoord.json() : null; })
        .then(function (data) {
          if (data && data.user && geldig(data.user.tier)) zetPas(data.user.tier);
        }).catch(function () { /* zonder antwoord blijft de veilige lokale stand staan */ });
    }

    return { kies: kies, zetPas: zetPas, pas: function () { return pas; }, actief: function () { return actief; } };
  }

  return {
    VOLGORDE: VOLGORDE,
    TOEGANG: TOEGANG,
    TEKST: TEKST,
    normaliseer: normaliseer,
    magOpenen: magOpenen,
    heeftVereiste: heeftVereiste,
    start: start
  };
});
