/* RTF Living Lab, scherm deel 2: het dossier van één onderzoek, als blad.

   DE OPZET IS "WAT NU", NIET "ALLE VELDEN". Bovenaan staat wat de volgende stap
   vraagt en wat daarvoor nog ontbreekt -- rechtstreeks uit /api/lab2/studie/watnu,
   dus uit DEZELFDE functie die de stap straks toelaat of weigert. Een scherm dat
   zijn eigen lijstje bijhoudt van wat er nog moet, loopt uit de pas met de poort
   en stuurt mensen dan naar werk dat niet helpt (regel 4 van de lat).

   Daaronder staan de onderdelen die bij de HUIDIGE stap horen. Alles tegelijk
   tonen maakt van een onderzoekscyclus een invulformulier van dertig velden, en
   dan wordt de volgorde -- die hier het hele punt is -- meteen betekenisloos. */
(function () {
  'use strict';
  var api, KADER, esc, meld, route, herlaad, S = null;
  var V = null, E = null, M = null, B = null, U = null, W = null, A = null;   // vormen, ethiek, mensen, bewijs, uitgang, werkplaats, apparatuur
  var APPARATUUR = [];   // het register van dit lab, voor de reserveringsknop

  function init(o) {
    api = o.api; KADER = o.kader; esc = o.esc; meld = o.meld; route = o.route; herlaad = o.herlaad;
    V = window.LivingLabVormen;
    V.init({ kader: KADER, esc: esc });
    /* De ethiek- en bewijsblokken staan in eigen bestanden omdat ze samen ruim
       over de 10 KB gaan, maar ze horen bij dit dossier: ze krijgen hetzelfde
       gereedschap en dezelfde doe()-helper, zodat er één manier is waarop een
       handeling het blad sluit, herlaadt en weer opent. */
    E = window.LivingLabEthiek;
    E.init({ api: api, kader: KADER, esc: esc, meld: meld, huidigLab: o.huidigLab });
    M = window.LivingLabMensen;
    M.init({ api: api, kader: KADER, esc: esc, meld: meld });
    B = window.LivingLabBewijs;
    B.init({ api: api, kader: KADER, esc: esc, meld: meld, huidigLab: o.huidigLab });
    U = window.LivingLabUitgang;
    U.init({ api: api, kader: KADER, esc: esc, meld: meld });
    W = window.LivingLabWerkplaats;
    W.init({ api: api, esc: esc, meld: meld });
    A = window.LivingLabApparatuur;
  }

  function open(id) {
    Promise.all([api('studie', { id: id }), api('studie/watnu', { id: id })]).then(function (r) {
      S = r[0].studie;
      /* Het apparatuurregister hoort bij het LAB en niet bij de studie, dus het
         komt als eigen verzoek mee. Faalt dat, dan valt alleen de
         reserveringsknop weg -- het dossier zelf hoort daar niet op te wachten. */
      return api('app/lijst', { id: S.labId })
        .then(function (a) { APPARATUUR = a.apparatuur || []; }, function () { APPARATUUR = []; })
        .then(function () { teken(S, r[1]); });
    }).catch(function (e) { meld(e.message); });
  }

  /* Het blad, in ÉÉN vorm: { element, sluit }.

     TWEE DINGEN DIE HIER MIS GINGEN, en allebei stil:

     1. RTGiOS.blad() geeft `{ sluit, element }` terug en geen DOM-knoop. De
        eerste versie gaf die uitkomst rechtstreeks aan bind(), die er
        querySelector() op deed -- dat bestaat op dat object niet, dus het
        dossier ging niet open en de fout werd door de .catch van open() een
        toast in plaats van een console-fout.
     2. Krijgt RTGiOS.blad() een STRING, dan zet hij die met textContent neer
        (zie el() in shared/ios.js). Het hele dossier kwam daardoor als platte
        tekst met &lt;div&gt; in beeld -- zichtbaar fout, maar zonder één
        foutmelding. Hij wil een ELEMENT, en dat krijgt hij nu.

     Vandaar dat beide wegen hier naar dezelfde vorm worden gebracht. */
  function blad(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    if (window.RTGiOS && RTGiOS.blad) {
      var b = RTGiOS.blad(d);
      return { element: d, sluit: b.sluit };
    }
    d.className = 'kaart';
    d.style.cssText = 'position:fixed;inset:auto 0 0 0;max-height:88vh;overflow:auto;z-index:40;border-radius:16px 16px 0 0;';
    document.body.appendChild(d);
    return { element: d, sluit: function () { d.remove(); } };
  }

  // hoort dit blok bij de stap waar de studie nu staat?
  var hoort = function (s, stappen) { return stappen.indexOf(s.stap) >= 0; };

  function teken(s, nu) {
    var el = blad(
      '<div style="padding:1rem;display:flex;flex-direction:column;gap:.7rem;">' +
        '<div class="rij" style="justify-content:space-between;align-items:start;">' +
          '<h2 style="font-size:1.2rem;">' + esc(s.titel) + '</h2>' +
          '<button class="knop stil" data-dicht type="button">Sluiten</button></div>' +
        (s.vraagstuk ? '<div class="uitdaging"><div class="sec">De uitdaging</div>' +
          '<div class="vraag">' + esc(s.vraagstuk) + '</div></div>' : '') +
        route(s.stap) +
        V.watNuBlok(nu) +
        V.stapBlok(s) +
        /* De blokken die bij de HUIDIGE stap horen, en alleen die. De ethiek
           verschijnt zodra het plan er is (want dat is wat de deelnemersstap
           blokkeert), de deelnemers zodra de ethiek rond mag zijn, het bewijs
           bij de resultaten en de uitgangen bij het besluit. Alles altijd tonen
           maakt er weer een formulier van dertig velden van. */
        (hoort(s, ['plan', 'deelnemers']) ? E.ethiekBlok(s) : '') +
        (hoort(s, ['deelnemers', 'experiment', 'observaties']) ? M.mensenBlok(s) : '') +
        (hoort(s, ['observaties', 'reflectie', 'resultaten', 'besluit']) ? B.materiaalBlok(s) : '') +
        (hoort(s, ['resultaten', 'besluit', 'vervolg']) ? B.conclusieBlok(s) : V.conclusieBlok(s)) +
        U.uitgangBlok(s) +
        (hoort(s, ['experiment', 'observaties']) ? A.reserveerBlok(s, APPARATUUR) : '') +
        W.blok(s) +
        '<div class="sec">Onderzoekscoach</div>' +
        '<div class="rij"><input class="veld" data-cvraag placeholder="Vraag de coach mee te denken" maxlength="400">' +
          '<button class="knop stil" data-coach type="button">Vraag</button></div>' +
        '<div class="ai" data-cuit hidden></div>' +
      '</div>');
    bind(el, s, nu);
  }

  function bind(vel, s, nu) {
    var el = vel.element;
    var q = function (sel) { return el.querySelector(sel); };
    var doe = function (belofte) {
      return belofte.then(function () {
        vel.sluit();
        return herlaad();
      }).then(function () { open(s.id); }).catch(function (e) { meld(e.message); });
    };
    q('[data-dicht]').addEventListener('click', vel.sluit);
    // de ethiek- en bewijsblokken bedraden zichzelf, met dezelfde doe()
    E.bind(el, s, doe);
    M.bind(el, s, doe);
    B.bind(el, s, doe);
    U.bind(el, s, doe);
    W.bind(el, s, doe);
    A.bindReservering(el, s, doe);

    if (q('[data-stap]')) q('[data-stap]').addEventListener('click', function () {
      doe(api('studie/stap', { id: s.id, stap: nu.volgende }));
    });
    if (q('[data-hypzet]')) q('[data-hypzet]').addEventListener('click', function () {
      doe(api('plan/hypothese', { id: s.id, tekst: q('[data-hyp]').value, tegendeel: q('[data-hypteg]').value }));
    });
    if (q('[data-planzet]')) {
      var gekozen = function () {
        return Array.prototype.filter.call(el.querySelectorAll('[data-m]'), function (c) { return c.checked; })
          .map(function (c) { return c.value; });
      };
      /* Het advies verschijnt terwijl je vinkjes zet, en komt uit dezelfde
         rekenregel als de poort. Zo staat het er VOOR het plan in plaats van
         als afkeuring erna. */
      Array.prototype.forEach.call(el.querySelectorAll('[data-m]'), function (c) {
        c.addEventListener('change', function () {
          var m = gekozen();
          if (!m.length) { q('[data-advies]').textContent = 'Kies minstens één methode.'; return; }
          api('plan/advies', { methoden: m }).then(function (a) {
            q('[data-advies]').textContent = 'Minstens ' + a.minSteekproef + ' deelnemers en ' +
              a.minMeetmomenten + ' meetmoment(en). Hiermee kan een conclusie hoogstens "' + a.hoogstBewijsNaam + '" dragen.';
            if (!q('[data-steek]').value) q('[data-steek]').value = a.minSteekproef;
            if (!q('[data-meet]').value) q('[data-meet]').value = a.minMeetmomenten;
          }).catch(function (e) { q('[data-advies]').textContent = e.message; });
        });
      });
      q('[data-planzet]').addEventListener('click', function () {
        doe(api('plan/zet', { id: s.id, methoden: gekozen(), steekproef: q('[data-steek]').value,
          meetmomenten: q('[data-meet]').value, doel: q('[data-doel]').value }));
      });
    }
    if (q('[data-obszet]')) q('[data-obszet]').addEventListener('click', function () {
      doe(api('bewijs/observatie', { id: s.id, wat: q('[data-obs]').value, methode: q('[data-obsm]').value }));
    });
    if (q('[data-rzet]')) q('[data-rzet]').addEventListener('click', function () {
      doe(api('bewijs/reflectie', { id: s.id, soort: q('[data-rs]').value, tekst: q('[data-rt]').value }));
    });
    if (q('[data-conczet]')) q('[data-conczet]').addEventListener('click', function () {
      doe(api('bewijs/conclusie', { id: s.id, tekst: q('[data-conc]').value }));
    });
    if (q('[data-bzet]')) q('[data-bzet]').addEventListener('click', function () {
      doe(api('studie/besluit', { id: s.id, soort: q('[data-bs]').value, door: q('[data-bd]').value, reden: q('[data-br]').value }));
    });
    q('[data-coach]').addEventListener('click', function () {
      var v = q('[data-cvraag]').value.trim(); if (!v) return;
      q('[data-cuit]').hidden = false; q('[data-cuit]').textContent = 'Rahul denkt mee...';
      api('coach', { id: s.id, vraag: v })
        .then(function (r) { q('[data-cuit]').textContent = r.antwoord; })
        .catch(function (e) { q('[data-cuit]').textContent = e.message; });
    });
  }

  window.LivingLabStudie = { init: init, open: open };
})();
