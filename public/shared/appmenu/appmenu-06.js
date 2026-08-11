  /* ---------------------------------------------------------- de knop */
  /* DE RTG-HEADERSTANDAARD: de hamburger staat LINKS, en verder niets.
     Hij stond rechtsboven in een afgerond vierkant met een eigen achtergrond,
     een rand en een blur -- een knopvlak dus, en daarmee het zwaarste element
     van elke kopbalk terwijl het het minst belangrijke is. Op ruim
     tweehonderd pagina's.
     Links, omdat dat de plek is waar het oog begint te lezen en waar je duim
     staat; zonder vlak, omdat een teken van drie streepjes geen doos nodig
     heeft om een knop te zijn.

     Drie plekken, in deze volgorde: de navigatiebalk die shared/ios.js van de
     kopbalk maakte, de eigen kopbalk van een pagina, en anders zwevend
     linksboven. Die laatste is de vangnet-stand voor de handvol pagina's
     zonder kopbalk -- zonder dat zou "op elke app" gewoon niet waar zijn. */
  function plaatsKnop() {
    knop = d.createElement('button');
    knop.type = 'button';
    knop.className = 'amn-knop';
    knop.id = 'osMenuBtn';
    knop.setAttribute('aria-label', T('menu.label', 'Menu'));
    knop.setAttribute('aria-haspopup', 'dialog');
    knop.setAttribute('aria-expanded', 'false');
    var svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    ['M4 7h16', 'M4 12h16', 'M4 17h16'].forEach(function (dd) {
      var p = d.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', dd); svg.appendChild(p);
    });
    knop.appendChild(svg);
    knop.addEventListener('click', wissel);

    hangOp();
  }

  /* De linkercel van de navigatiebalk. Die bestaat nog niet: het raster van
     .ios-nav-rij is [auto | titel | auto] en de eerste kolom wordt door de
     terugknop gevuld. We maken er een cel van die BEIDE draagt -- eerst de
     hamburger, dan de terugweg -- zodat ze niet om dezelfde kolom vechten. */
  function linkerCel(rij) {
    var cel = rij.querySelector(':scope > .ios-nav-links');
    if (cel) return cel;
    cel = d.createElement('div');
    cel.className = 'ios-nav-links';
    rij.insertBefore(cel, rij.firstChild);
    var terug = rij.querySelector(':scope > .ios-terug');
    if (terug) cel.appendChild(terug);
    return cel;
  }

  /* Staat het er ECHT? offsetParent is null zodra een voorouder display:none of
     hidden is. Twee keer heeft die vraag hier een gat opgeleverd, allebei van
     dezelfde soort: de knop was aanwezig, en onzichtbaar.
       - techniek.html en foundation/gevoel.html hebben een `header.kop` binnen
         een blok dat pas na inloggen verschijnt;
       - gemeentepda.html en leverancier-rtmail.html hebben wel een `.ios-nav`
         maar die staat er niet. Vroeger viel de knop daar door naar zwevend
         omdat ik op `.ios-nav-acties` zocht en dat element er niet was; sinds
         ik op `.ios-nav-rij` zoek bestaat hij wel, en verdween de knop in een
         verborgen balk.
     Een aanwezige knop die je niet ziet is erger dan geen knop: de toets die
     alleen op bestaan kijkt, kleurt groen. */
  function zichtbaar(e) { return !!(e && (e.offsetParent || e.getClientRects().length)); }

  function hangOp() {
    knop.classList.remove('amn-zweef');
    var rij = d.querySelector('.ios-nav .ios-nav-rij');
    if (rij && zichtbaar(rij)) { linkerCel(rij).insertBefore(knop, linkerCel(rij).firstChild); return; }

    /* Geen iOS-balk? Dan de eigen kopbalk van de pagina, vooraan.
       Een echte <header> heeft al een eigen rij, dus daar kan de knop zo in.
       Maar veel pagina's hebben helemaal geen header: die zetten alleen een
       losse terugweg als eerste kind van de body. Legde ik de zwevende knop
       daaroverheen, dan lag de hamburger LETTERLIJK op "naar de app" -- en dat
       is wat er gebeurde toen ik hem van rechts naar links verhuisde. Zwevend
       linksboven is alleen veilig als er links bovenin niets staat.
       Daarom krijgen die twee samen een rij. */
    var kop = null;
    var koppen = d.querySelectorAll('header.kop, header.merkkop, body > header');
    for (var i = 0; i < koppen.length; i++) { if (zichtbaar(koppen[i])) { kop = koppen[i]; break; } }
    if (kop) { kop.insertBefore(knop, kop.firstChild); return; }

    /* De terugweg staat lang niet altijd direct onder de body -- op
       boardroom.html zit hij binnen <main class="rtg-wrap">. Zoeken op de
       KLASSE en niet op de plek in de boom; wel eerst kijken of hij ook
       werkelijk bovenaan staat, want een terugweg onderaan de pagina is geen
       kopbalk. */
    var terug = d.querySelector('.rtg-terug');
    if (terug && (!zichtbaar(terug) || terug.getBoundingClientRect().top > 220)) terug = null;
    if (terug && terug.parentNode) {
      var rijtje = d.createElement('div');
      rijtje.className = 'amn-koprij';
      terug.parentNode.insertBefore(rijtje, terug);
      rijtje.appendChild(knop);
      rijtje.appendChild(terug);
      return;
    }
    knop.classList.add('amn-zweef');
    d.body.appendChild(knop);
  }

  /* WEGGEVEEGD WORDEN EN TERUGKOMEN. Een pagina mag zijn eigen body opnieuw
     schrijven, en sommige doen dat ook: shared/deur.js zet er een
     "hier kom je niet in"-scherm neer met innerHTML, en dat neemt alles mee wat
     erin stond -- de kopbalk van de app, en dus ook deze knop. Precies op zo'n
     scherm heb je het menu het hardst nodig, want het is de enige weg terug
     naar huis.

     De wacht kijkt alleen naar de directe kinderen van de body; dat is waar
     zo'n herschrijving zich afspeelt en het kost bijna niets. Zonder
     MutationObserver blijft de knop gewoon staan waar hij stond. */
  function bewaakKnop() {
    if (!w.MutationObserver) return;
    new w.MutationObserver(function () {
      if (!knop.isConnected) hangOp();
    }).observe(d.body, { childList: true });
  }

  /* --------------------------------------------------------- aanzetten */
  stijl();
  plaatsKnop();
  bewaakKnop();

  w.RTGAppMenu = {
    open: open, sluit: sluit, wissel: wissel,
    knop: function () { return knop; },
    /* Een app die zelf beter weet wat er in zijn menu hoort, zegt het hier.
       zet() vervangt de lijst, voegToe() vult hem aan; allebei worden ze pas
       gelezen als het menu opengaat, dus een app mag dit ook later nog doen. */
    zet: function (lijst) { GEZET = Array.isArray(lijst) ? lijst.slice(0, MAX) : []; },
    voegToe: function (item) { if (item && item.label) GEZET.push(item); }
  };
})(window, document);
