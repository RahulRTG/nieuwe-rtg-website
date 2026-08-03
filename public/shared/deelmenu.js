/* Het deelmenu: een app-pagina met veel delen wordt een menu met EEN deel
   tegelijk, zoals een echt werksysteem -- in plaats van een lange rol
   kaarten waar je doorheen moet scrollen.

   Werking. Het script leest de directe kinderen van <main> (of [role=main]).
   Een kind dat een eigen kop draagt (een .deel-kop, of een kaart met een
   .sec/.kop/h2 als eerste kop erin) begint een nieuw deel; wat erna komt
   zonder eigen kop hoort bij dat deel. Alles VOOR het eerste deel (een
   KPI-rij, een intro) blijft altijd staan, met de menubalk eronder. Bij
   minder dan drie delen doet het script niets: dan is een menu alleen maar
   drukte. Zonder JavaScript blijft de pagina gewoon de volledige rol.

   De keuze wordt per pagina onthouden, en #deel-<naam> in de URL opent dat
   deel direct (deep-link; andere hashes blijven met rust). Programmatisch:
   RTGDeel.open('naam') -- ook voor toetsen die als een gebruiker eerst
   navigeren en dan klikken. Bij elke wissel vuurt er een 'rtgdeel'-event
   op document, voor schermen die dan opnieuw willen meten.

   Een pagina doet mee door dit bestand te laden (defer); meer is het niet.
   De stijl gebruikt de variabelen van het huis waar hij staat: het leden-OS
   (--gold/--line) of de RTFoundation (--goud/--lijn). */
(function () {
  'use strict';
  if (window.RTGDeel) return;

  var css = '.rtgdeel-balk{display:flex;flex-wrap:wrap;gap:.15rem;margin:.6rem 0 1.1rem;padding:0 0 .1rem;' +
      'border-bottom:1px solid var(--line,var(--lijn,#2A2724));}' +
    '.rtgdeel-balk button{background:none;border:0;cursor:pointer;padding:.55rem .8rem .6rem;margin-bottom:-1px;' +
      'font-family:Inter,system-ui,sans-serif;font-size:.72rem;font-weight:600;letter-spacing:.12em;text-transform:uppercase;' +
      'color:var(--muted,var(--zacht,#8A8680));border-bottom:2px solid transparent;white-space:nowrap;}' +
    '.rtgdeel-balk button:hover{color:var(--txt,#F7F5F1);}' +
    '.rtgdeel-balk button[aria-current="true"]{color:var(--txt,#F7F5F1);' +
      'border-bottom-color:var(--gold,var(--goud,#857007));}' +
    '.rtgdeel-weg{display:none!important;}' +
    '@media print{.rtgdeel-balk{display:none;}}';

  function slug(t) {
    return String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'deel';
  }
  function zichtbaar(el) {
    return !el.hidden && (!el.style || el.style.display !== 'none');
  }

  function start() {
    var main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (!main) return;

    /* Heeft de pagina eigen .deel-markers, dan bepalen ALLEEN die de delen
       (de kaarten eronder splitsen niet verder). Zonder markers begint elke
       kaart met een eigen kop een deel. Een kaart die de pagina zelf
       verborgen houdt (een les die pas opengaat na een klik) begint nooit
       een eigen deel: die hoort bij het deel waar hij in staat. */
    var markers = main.querySelectorAll(':scope > .deel').length > 0;
    function kopVan(el) {
      if (!el.matches) return null;
      if (el.matches('.deel')) return el.textContent.trim();
      if (markers || !zichtbaar(el)) return null;
      if (el.matches('.kaart,section,.blok,.paneel')) {
        var k = el.querySelector('.sec,.kop,h2,h3,legend');
        if (k) {
          // alleen de koptekst zelf, niet wat er verder in het blok staat
          var eigen = k.querySelector('b,span');
          var t = (k.matches('.kop') && eigen ? eigen : k).textContent.trim();
          if (t) return t.slice(0, 48);
        }
      }
      return null;
    }

    var delen = [], huidig = null;
    for (var i = 0; i < main.children.length; i++) {
      var el = main.children[i];
      if (el.classList && el.classList.contains('rtgdeel-balk')) continue;
      /* rtgdeel-vast: hoort bij geen enkel deel en blijft altijd staan. Voor
         wat op elke stand zichtbaar MOET zijn -- de eerlijke grens van de
         veiligheidsapps ("dit is geen alarmcentrale") mag nooit achter een
         menuknop verdwijnen. De greep van het desktopframe idem. */
      if (el.classList && (el.classList.contains('rtgdeel-vast') || el.classList.contains('rtg-greep'))) continue;
      var kop = kopVan(el);
      if (kop) {
        huidig = { naam: kop, id: slug(kop), leden: [el], kopEl: el.matches('.deel') ? el : null };
        // twee delen met dezelfde naam: nummer erachter, anders botst de hash
        var n = 2, basis = huidig.id;
        for (var j = 0; j < delen.length; j++) if (delen[j].id === huidig.id) { huidig.id = basis + '-' + n++; j = -1; }
        delen.push(huidig);
      } else if (huidig) huidig.leden.push(el);
      // kinderen voor het eerste deel (KPI's, intro) blijven altijd staan
    }
    if (delen.length < 3) return;

    var balk = document.createElement('nav');
    balk.className = 'rtgdeel-balk';
    balk.setAttribute('aria-label', 'Delen van deze app');
    delen.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = d.naam;
      b.addEventListener('click', function () { open(d.id); });
      d.knop = b;
      balk.appendChild(b);
    });
    var st = document.createElement('style'); st.textContent = css;
    document.head.appendChild(st);
    // de balk komt na het vaste deel (KPI's, intro), voor het eerste deel
    main.insertBefore(balk, delen[0].leden[0]);

    var SLEUTEL = 'rtg_deel:' + location.pathname;
    function open(id, stil) {
      var doel = delen.some(function (d) { return d.id === id; }) ? id : delen[0].id;
      delen.forEach(function (d) {
        var aan = d.id === doel;
        d.knop.setAttribute('aria-current', aan ? 'true' : 'false');
        // een eigen klasse, geen hidden-attribuut: paginastijlen met een
        // eigen display (flex, grid) zouden van het attribuut winnen
        d.leden.forEach(function (el) { el.classList.toggle('rtgdeel-weg', !aan); });
        // de eigen kop van een .deel-marker is dubbelop naast de menuknop
        if (d.kopEl) d.kopEl.classList.add('rtgdeel-weg');
      });
      try { localStorage.setItem(SLEUTEL, doel); } catch (e) {}
      if (!stil) {
        try { history.replaceState(null, '', '#deel-' + doel); } catch (e) {}
        document.dispatchEvent(new CustomEvent('rtgdeel', { detail: { deel: doel } }));
      }
    }

    var uitHash = /^#deel-(.+)$/.exec(location.hash);
    var bewaard = null; try { bewaard = localStorage.getItem(SLEUTEL); } catch (e) {}
    open(uitHash ? uitHash[1] : (bewaard || delen[0].id), true);
    window.addEventListener('hashchange', function () {
      var m = /^#deel-(.+)$/.exec(location.hash);
      if (m) open(m[1]);
    });

    window.RTGDeel = { open: open, delen: function () { return delen.map(function (d) { return d.id; }); } };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
