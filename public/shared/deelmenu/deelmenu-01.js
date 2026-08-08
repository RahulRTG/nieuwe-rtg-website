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

  /* Wat nooit meetelt als inhoud: onze eigen balk, wat vast staat, de greep --
     en de GROTE TITEL VAN DE IOS-LAAG.

     Die laatste kostte twee toetsen en was van buiten niet te zien. De iOS-laag
     (shared/ios.js) verhuist de kop van een pagina naar binnen main, als eerste
     kind, met klasse ios-groot: dat is de titel die bij het scrollen terugzakt
     in de navigatiebalk. Chrome dus, geen inhoud -- maar gastheren() hieronder
     telde hem gewoon mee. Een app als klankwerk.html heeft dan twee zichtbare
     kinderen (de titel en het werkvlak) in plaats van een, de afdaling stopt op
     main, en daar staan geen deelmarkeringen. Uitkomst: geen menu, geen balk,
     en RTGDeel.delen() dat leeg blijft op een pagina met zeven delen.

     Geen foutmelding, geen kapotte regel. De app werkte, hij was alleen zijn
     inhoudsopgave kwijt -- op elke pagina waar de iOS-laag een titel neerzet
     naast een enkel scherm. */
  function eigenLaag(el) {
    return el.classList && (el.classList.contains('rtgdeel-balk') ||
      el.classList.contains('rtgdeel-vast') || el.classList.contains('rtg-greep') ||
      el.classList.contains('ios-groot') ||
      el.classList.contains('ios-boven') || el.classList.contains('ios-onder'));
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

