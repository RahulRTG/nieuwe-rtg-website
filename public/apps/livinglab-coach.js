/* RTF Living Lab, scherm deel 13: de onderzoekscoach.

   Drie dingen, en het verschil ertussen is precies de grens die dit lab trekt:

   1. MEEDENKEN. Een vrije vraag; de coach antwoordt in gewone taal. Zonder
      AI-sleutel geeft hij het vaste advies dat bij de huidige stap hoort, en dus
      geen foutmelding -- een team zonder sleutel moet dit systeem gewoon kunnen
      gebruiken.
   2. METHODEADVIES. Welke methoden passen bij deze soort en deze ambitie. Dat is
      PUUR REKENWERK uit het kader (server/kern/livinglab/kader.js) en heeft
      helemaal geen AI nodig; het is dezelfde tabel waarmee de poort straks
      rekent. Vandaar dat dit altijd werkt en altijd klopt.
   3. EEN CONCLUSIE VOORSTELLEN. De coach mag formuleren wat er te concluderen
      valt -- en het komt binnen als VOORSTEL op de laagste graad. Het optillen
      naar een echte bewijsgraad blijft een handeling van een mens met een naam
      (./livinglab-bewijs.js). Het scherm zet dat er ook bij, want een voorstel
      dat er hetzelfde uitziet als een conclusie is precies hoe een AI-zin een
      feit wordt.

   Afgesplitst uit ./livinglab-studie.js, dat daarmee onder de 10 KB blijft. */
(function () {
  'use strict';
  var api, KADER, esc, meld;

  function init(o) { api = o.api; KADER = o.kader; esc = o.esc; meld = o.meld; }

  function blok(s) {
    return '<div class="kaart"><div class="sec">Onderzoekscoach</div>' +
      '<div class="rij"><input class="veld" data-cvraag placeholder="Vraag de coach mee te denken" maxlength="400">' +
        '<button class="knop stil" data-coach type="button">Vraag</button></div>' +
      '<div class="ai" data-cuit hidden></div>' +

      '<div class="sec" style="margin-top:.9rem;">Welke methode past hierbij?</div>' +
      '<div class="rij">' +
        '<select class="veld" data-cambitie aria-label="Hoe sterk wilt u het maken?">' +
          KADER.bewijs.map(function (b) {
            return '<option value="' + esc(b.graad) + '"' + (b.graad === 'indicatie' ? ' selected' : '') + '>' +
              esc(b.naam) + '</option>';
          }).join('') + '</select>' +
        '<button class="knop stil" data-cmethoden type="button">Toon passende methoden</button></div>' +
      '<div class="leeg" data-cmuit></div>' +

      (s.stap === 'resultaten' || s.stap === 'besluit'
        ? '<div class="sec" style="margin-top:.9rem;">Laat de coach een conclusie formuleren</div>' +
          '<div class="rij"><input class="veld" data-cctekst placeholder="Waar moet hij naar kijken?" maxlength="300">' +
            '<button class="knop stil" data-cconc type="button">Stel voor</button></div>' +
          '<div class="leeg">Het voorstel komt binnen als <b>aanname</b> en met het label "voorstel van de coach". ' +
            'Een bewijsgraad eraan hangen blijft mensenwerk.</div>'
        : '') +
      '</div>';
  }

  function bind(el, s, doe) {
    var q = function (x) { return el.querySelector(x); };

    q('[data-coach]').addEventListener('click', function () {
      var v = q('[data-cvraag]').value.trim(); if (!v) return;
      q('[data-cuit]').hidden = false;
      q('[data-cuit]').textContent = 'Rahul denkt mee...';
      api('coach', { id: s.id, vraag: v })
        .then(function (r) { q('[data-cuit]').textContent = r.antwoord + (r.demo ? ' (vast advies; er staat geen AI-sleutel)' : ''); })
        .catch(function (e) { q('[data-cuit]').textContent = e.message; });
    });

    q('[data-cmethoden]').addEventListener('click', function () {
      api('coach/methoden', { soort: s.soort, ambitie: q('[data-cambitie]').value })
        .then(function (r) {
          q('[data-cmuit]').innerHTML =
            '<b>Kan dit dragen:</b> ' + (r.passend.length
              ? r.passend.map(function (m) { return esc(m.naam) + ' (min. ' + m.minN + ')'; }).join(', ')
              : 'geen enkele methode') +
            (r.teLicht.length ? '<br><b>Te licht hiervoor:</b> ' +
              r.teLicht.map(function (m) { return esc(m.naam); }).join(', ') : '') +
            '<br>' + esc(r.let);
        }).catch(function (e) { q('[data-cmuit]').textContent = e.message; });
    });

    if (q('[data-cconc]')) q('[data-cconc]').addEventListener('click', function () {
      doe(api('coach/conclusie', { id: s.id, vraag: q('[data-cctekst]').value }));
    });
  }

  window.LivingLabCoach = { init: init, blok: blok, bind: bind };
})();
