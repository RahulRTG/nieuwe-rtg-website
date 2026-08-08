  /* ---------------------------------------------------------- de knop */
  /* Drie plekken, in deze volgorde: de statusbalk van het beginscherm, de
     navigatiebalk die shared/ios.js van de kopbalk maakte, en anders zwevend
     rechtsboven. Die laatste is de vangnet-stand voor de handvol pagina's
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

  function hangOp() {
    var acties = d.querySelector('.ios-nav .ios-nav-acties');
    if (acties) { knop.classList.remove('amn-zweef'); acties.appendChild(knop); return; }
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
