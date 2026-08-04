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
  // opnieuw laden mag; de herscan hieronder hergebruikt deze module

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

  // wat nooit meetelt als inhoud: onze eigen balk, wat vast staat, de greep
  function eigenLaag(el) {
    return el.classList && (el.classList.contains('rtgdeel-balk') ||
      el.classList.contains('rtgdeel-vast') || el.classList.contains('rtg-greep'));
  }
  /* De mogelijke gastheren van de delen, van buiten naar binnen. Veel apps
     zetten hun kaarten niet los in <main> maar in een opmaaklaag ernaast
     (main > div.wrap > kaarten), of tonen na het inloggen nog maar een van
     hun schermen (het inlogscherm ernaast staat verborgen). Zo'n laag is
     geen inhoud. We geven daarom elke laag terug waar precies EEN zichtbare
     laag overblijft, en laat start() de eerste kiezen die echt delen
     oplevert -- zo hoeft dit niet te raden. */
  function gastheren(main) {
    var uit = [main], host = main;
    for (var stap = 0; stap < 3; stap++) {
      var kids = [];
      for (var i = 0; i < host.children.length; i++) {
        var k = host.children[i];
        if (!eigenLaag(k) && zichtbaar(k)) kids.push(k);
      }
      if (kids.length !== 1 || !kids[0].children.length) break;
      if (kids[0].matches && kids[0].matches('ul,ol,table,form,canvas,svg')) break;
      host = kids[0];
      uit.push(host);
    }
    return uit;
  }

  function start() {
    var wortel = document.querySelector('main') || document.querySelector('[role="main"]');
    if (!wortel) return;
    var lagen = gastheren(wortel);
    for (var L = 0; L < lagen.length; L++) if (bouw(lagen[L])) return true;
    return false;
  }

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

  /* DEEL 3: het menu in leven houden. Deel 2 bouwt een menu uit wat er NU
     staat; hieronder staat het tweede onderwerp: opnieuw indelen als de app
     zijn scherm hertekent, en de wacht die dat opmerkt. Dat scheelt niet
     alleen bytes (deel 2 raakte de 10 KB), het zijn ook twee verhalen. */

  /* De stand zonder menu: herscan blijft met de hand beschikbaar, de rest heeft
     niets te openen. Op een plek, zodat er nooit twee "geen menu"-standen naast
     elkaar rondgaan. open() geeft hier null terug en niet stilzwijgend niets:
     wie een deel opvraagt hoort te merken dat er geen menu staat. */
  var geenMenu = { herscan: herscan, open: function () { return null; },
    delen: function () { return []; } };

  /* Opnieuw indelen. Veel apps bouwen hun scherm pas na een fetch, en
     sommige hertekenen main bij elke verversing (een bank die een
     saldo-melding krijgt). Een menu dat maar EEN keer scant, ziet daar
     niets -- of wordt weggevaagd. Daarom: eerst schoonvegen wat we vorige
     keer achterlieten, dan opnieuw indelen. */
  function herscan() {
    var main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (!main) return false;
    /* Vanaf hier is de vorige ronde dood: zijn indeling wijst zo meteen naar
       losgekoppelde kaarten. Eerst loslaten, dan pas opruimen -- anders bleef
       window.RTGDeel na een MISLUKTE hertekening antwoorden alsof er een menu
       stond, en verborg open() kaarten die zonder balk niemand terughaalt. */
    menu = null;
    deelUit(geenMenu);
    /* ALLE balken weg, niet alleen de eerste (dezelfde vorm als de regel
       hieronder voor .rtgdeel-weg). De balk kan in een diepere gastheer staan,
       en een app die zijn scherm uit een momentopname terugzet plakt er zelf
       een kopie bij. Ruimde herscan() er maar EEN op, dan bleef de andere
       staan en zette bouw() er weer een bij: twee balken, waarvan de voorste
       nooit de onze is, dus herbouwde de wacht elke 120 ms opnieuw. */
    var oud = main.querySelectorAll('.rtgdeel-balk');
    for (var b = 0; b < oud.length; b++) oud[b].remove();
    var weg = main.querySelectorAll('.rtgdeel-weg');
    for (var i = 0; i < weg.length; i++) weg[i].classList.remove('rtgdeel-weg');
    return start();
  }

  /* De wacht. Zolang er nog geen menu staat, kijkt hij of de app zijn
     schermen alsnog neerzet; staat het menu er en veegt de app het weg met
     een eigen hertekening, dan bouwt hij het opnieuw. Hij kijkt naar heel de
     boom onder main (zie de observe onderaan deze functie), en negeert wat
     hijzelf verandert (de verbergklasse is een attribuut-wijziging, geen
     childList). */
  function wacht() {
    var main = document.querySelector('main') || document.querySelector('[role="main"]');
    if (!main || !window.MutationObserver) return;
    var bezig = false, vergeefs = 0;
    var obs = new MutationObserver(function () {
      if (bezig) return;
      bezig = true;
      // na de eerstvolgende rust opnieuw kijken, niet bij elke losse rij
      setTimeout(function () {
        bezig = false;
        /* Staat de balk er nog, en is het ONZE balk van deze ronde? Een app
           die zijn scherm uit een momentopname terugzet, zet ook een kopie van
           onze balk terug: die staat er wel, maar zijn knoppen doen niets. De
           vorige toets hierop (window.RTGDeel) kon dat nooit zien: de regel
           onderaan deze functie zet hem zelf en hij is daarna altijd waar. */
        if (menu && main.querySelector('.rtgdeel-balk') === menu.balk) { vergeefs = 0; return; }
        if (herscan()) { vergeefs = 0; return; }
        /* Een pagina die blijft muteren maar nooit drie delen krijgt (een
           chat die berichten aanvult) hoort geen menu te krijgen EN geen
           eeuwige wacht te betalen. Na veertig vergeefse pogingen is het
           antwoord duidelijk; RTGDeel.herscan() blijft met de hand
           beschikbaar voor wie het later alsnog nodig heeft. (Hier stond
           "twintig": het commit-bericht dat deze wacht invoerde legt veertig
           vast, dus het woord was verouderd en niet het getal.) */
        if (++vergeefs >= 40) obs.disconnect();
      }, 120);
    });
    /* subtree, en niet alleen de directe kinderen: de meeste apps renderen
       niet in main zelf maar in een scherm daarbinnen (main > wrap > vPay).
       Op alleen childList van main werd deze wacht daar nooit wakker. */
    obs.observe(main, { childList: true, subtree: true });
    if (!window.RTGDeel) deelUit(geenMenu);
  }

  /* De hash-luisteraar hoort bij de MODULE, niet bij een ronde. Hij stond in
     bouw() en herscan() kon hem niet opruimen: elke hertekening liet er een
     achter die met de indeling van ZIJN ronde de hash bleef overschrijven, en
     dan kwam een deep-link op het verkeerde deel uit. Nu een luisteraar voor
     de module, die telkens het menu van nu vraagt. */
  function volgHash() {
    var m = /^#deel-(.+)$/.exec(location.hash);
    if (m && menu) menu.api.open(m[1]);
  }

  function begin() { window.addEventListener('hashchange', volgHash); start(); wacht(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
  else begin();
})();
