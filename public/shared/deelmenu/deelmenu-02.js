  /* Het menu van DEZE ronde: de balk op het scherm plus de API die
     window.RTGDeel uitdeelt. Op een plek, want de wacht moet kunnen zien of de
     balk die er staat van ons is, en herscan() moet de vorige ronde kunnen
     loslaten. null betekent: er staat geen menu. */
  var menu = null;

  function bouw(main) {

    /* Heeft de pagina eigen .deel-markers, dan bepalen ALLEEN die de delen
       (de kaarten eronder splitsen niet verder). Zonder markers begint elke
       kaart met een eigen kop een deel. Een kaart die de pagina zelf
       verborgen houdt (een les die pas opengaat na een klik) begint nooit
       een eigen deel: die hoort bij het deel waar hij in staat. */
    /* Een losse kop als BROER van de kaarten (<h3 class="sec">Kop</h3> gevolgd
       door een of meer kaarten) is net zo goed een deelmarkering als een
       .deel. Dat is de vorm die de meeste apps hier gebruiken; zonder deze
       regel zag het menu op zo'n pagina niets, want het zocht de kop alleen
       BINNEN een kaart. Een kop is bewust kaal: alleen tekst, geen kinderen. */
    function losseKop(el) {
      return el.matches && el.matches('.deel,.sec,h2,h3,h4') && !el.querySelector('*') &&
        el.textContent.trim().length > 0;
    }
    var markers = false;
    for (var m = 0; m < main.children.length; m++) if (losseKop(main.children[m])) { markers = true; break; }
    function kopVan(el) {
      if (!el.matches) return null;
      if (losseKop(el)) return el.textContent.trim().slice(0, 48);
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
      /* rtgdeel-vast: hoort bij geen enkel deel en blijft altijd staan. Voor
         wat op elke stand zichtbaar MOET zijn -- de eerlijke grens van de
         veiligheidsapps ("dit is geen alarmcentrale") mag nooit achter een
         menuknop verdwijnen. De greep van het desktopframe idem. */
      if (eigenLaag(el)) continue;
      var kop = kopVan(el);
      if (kop) {
        // de eigen koppen zijn dubbelop naast de menuknop; een deel kan er
        // meer dan een hebben (zie de samenvoeging hieronder)
        huidig = { naam: kop, id: slug(kop), leden: [el], koppen: losseKop(el) ? [el] : [] };
        // twee delen met dezelfde naam: nummer erachter, anders botst de hash
        var n = 2, basis = huidig.id;
        for (var j = 0; j < delen.length; j++) if (delen[j].id === huidig.id) { huidig.id = basis + '-' + n++; j = -1; }
        delen.push(huidig);
      } else if (huidig) huidig.leden.push(el);
      // kinderen voor het eerste deel (KPI's, intro) blijven altijd staan
    }

    /* Een deel dat niets anders draagt dan zijn eigen kop(pen) is geen deel.
       Zijn knop zou een leeg scherm openen, want open() verbergt die koppen
       hoe dan ook -- dat is de oorzaak van elke dode tab, ongeacht hoe zo'n
       deel ontstaat: een pagina die haar marker en haar eigen kop onder
       elkaar zet (<div class="deel">Toegang</div><h2>Actieve toegang</h2>),
       een slotkop zonder inhoud eronder, of een kop die alleen door vaste
       laag wordt gevolgd. Daarom hier, op de plek waar de knoppen ontstaan,
       en niet bij een van die vormen.
       Is er een deel NA hem, dan hoort de kop bij wat volgt: samenvoegen, en
       de naam van de eerste wint -- die staat er als opschrift van het geheel
       en is meestal de korte marker die de pagina zelf koos. Is er alleen een
       deel VOOR hem, dan draagt geen enkele knop zijn tekst; dan is het geen
       kop maar gewone inhoud, en die blijft dus in beeld bij het deel erboven.
       Staat hij helemaal alleen, dan blijft hij vaste inhoud. */
    var echte = [];
    for (var d = 0; d < delen.length; d++) {
      var deel = delen[d];
      if (deel.leden.length > deel.koppen.length) { echte.push(deel); continue; }
      var na = delen[d + 1];
      if (na) {
        na.leden = deel.leden.concat(na.leden);
        na.koppen = deel.koppen.concat(na.koppen);
        na.naam = deel.naam; na.id = deel.id;
      } else if (echte.length) {
        echte[echte.length - 1].leden = echte[echte.length - 1].leden.concat(deel.leden);
      }
    }
    delen = echte;
    /* Normaal doet het menu niets onder de drie delen -- dan is het alleen maar
       drukte. Wie in zijn toegankelijkheidsprofiel "een ding tegelijk" heeft
       aangezet, wil het juist ook bij twee: dan is de drempel twee. De klasse
       wordt door shared/basis.js op <html> gezet, dus dit script hoeft niets van
       het profiel te weten. */
    var drempel = document.documentElement.classList.contains('rtg-eending') ? 2 : 3;
    if (delen.length < drempel) return;

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
    if (!document.getElementById('rtgdeel-stijl')) {
      var st = document.createElement('style');
      st.id = 'rtgdeel-stijl'; st.textContent = css;
      document.head.appendChild(st);
    }
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
        // de eigen koppen van een deel zijn dubbelop naast de menuknop; ook
        // de tweede, anders staat het label van de knop er nog eens onder
        d.koppen.forEach(function (el) { el.classList.add('rtgdeel-weg'); });
      });
      try { localStorage.setItem(SLEUTEL, doel); } catch (e) {}
      if (!stil) {
        try { history.replaceState(null, '', '#deel-' + doel); } catch (e) {}
        document.dispatchEvent(new CustomEvent('rtgdeel', { detail: { deel: doel } }));
      }
      // welk deel er open ging; de stand zonder menu (deel 3) geeft null
      // terug, zodat een aanroeper ziet dat er niets te openen viel
      return doel;
    }

    var uitHash = /^#deel-(.+)$/.exec(location.hash);
    var bewaard = null; try { bewaard = localStorage.getItem(SLEUTEL); } catch (e) {}
    open(uitHash ? uitHash[1] : (bewaard || delen[0].id), true);

    menu = { balk: balk, api: { open: open, herscan: herscan,
      delen: function () { return delen.map(function (d) { return d.id; }); } } };
    deelUit(menu.api);
    return true;
  }

  /* De enige plek die window.RTGDeel zet. Er zijn drie momenten waarop de
     buitenwereld een andere stand hoort te krijgen (een nieuw menu, een
     mislukte hertekening, en het laden zonder menu); dat vanaf drie plekken
     doen is precies hoe de ene stand de andere kan overleven. */
  function deelUit(api) { window.RTGDeel = api; }
