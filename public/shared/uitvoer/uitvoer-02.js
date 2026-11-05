  function herzie() {
    if (!document.body) return;
    // Standalone pages share one visible content frame. A former workspace
    // drawer must not keep the real export control inside a permanently closed host.
    var frame = document.querySelector('.wd-page');
    if (frame) {
      var output = frame.querySelector(':scope > .wd-output');
      if (!output) { output = document.createElement('div'); output.className = 'wd-output'; frame.prepend(output); }
      var bank = document.querySelector('.rtg-interface-second-screen:not(.rtg-ss-peek) .cmd-bank');
      if (bank) { gekozenLaag = bank; gekozenKnop = bank.querySelector('.rtg-ss-header'); }
      var openHost = gekozenLaag && gekozenLaag.isConnected && gekozenLaag.getClientRects().length &&
        getComputedStyle(gekozenLaag).visibility !== 'hidden' && !gekozenLaag.closest('[hidden],[aria-hidden="true"]');
      gastKnop = openHost ? gekozenKnop : output; gastLaag = openHost ? gekozenLaag : document.body;
      if (laag && laag.parentNode !== gastLaag) gastLaag.appendChild(laag);
    }
    /* hidden alleen is niet genoeg: sommige gastschermen laten #gate bestaan
       maar nemen hem via de indeling uit beeld. Alleen een werkelijk zichtbare
       poort onderdrukt de uitvoerknop. */
    if (poort && !poort.hidden && poort.getClientRects().length) {
      if (knop) { knop.remove(); knop = null; }
      return;
    }
    if (!verzamel()) { if (knop) { knop.remove(); knop = null; } return; }   // niets te halen, geen knop
    if (knop && knop.isConnected) {
      if (gastKnop && gastKnop.isConnected) { if(knop.parentNode!==gastKnop)gastKnop.appendChild(knop); return; }
      if (knop.offsetParent !== null || ++pogingen > 5) return;
    }
    if (!knop) {
      knop = document.createElement('button');
      knop.type = 'button';
      knop.className = 'rtguitvoer rtguitvoer-knop rtgdeel-vast' + knopStijl + (ds ? ' ds-uitvoer-knop' : '');
      knop.setAttribute('aria-haspopup', 'dialog');
      /* Deze knop bestaat alleen zolang het scherm werkelijk uitvoerbare
         gegevens heeft. Bedien hem daarom als kortlevende hoofdactie voordat
         een andere schermhandeling de bron opnieuw tekent. Dit is ook voor
         toetsenbord- en Edge-regie de expliciete betekenis van de knop. */
      knop.setAttribute('data-hoofdactie', '');
      knop.textContent = 'Meenemen';
      knop.addEventListener('click', toon);
    }
    plaats(knop);
  }

  function start() {
    // Ook oudere hosts krijgen dezelfde canonieke component; alleen het laden
    // verschilt zolang zij nog geen expliciete data-ds-markering dragen.
    laadUitvoerPresentatie('/ds/rtg-ds.css');
    herzie();
    if (!window.MutationObserver) return;
    var kijker = new MutationObserver(function () { clearTimeout(tik); tik = setTimeout(herzie, 300); });
    kijker.observe(wortel(), { childList: true, subtree: true });
    if (poort) kijker.observe(poort, { attributes: true,
      attributeFilter: ['hidden', 'class', 'style'] });
  }

  window.RTGUitvoer = {
    bron: function (f) { eigenBron = typeof f === 'function' ? f : null; herzie(); },
    beschikbaar: function () { return !!verzamel(); },
    gegevens: verzamel,
    neemMee: neemMee,
    herzie: herzie,
    zichtbaar: function () { return !!(laag && !laag.hidden); },
    /* Knop én dialoog horen bij dezelfde dominante laag. */
    mount: function (knopHost, laagHost) {
      gekozenKnop = gastKnop = knopHost || null; gekozenLaag = gastLaag = laagHost || null;
      if (laag && gastLaag && gastLaag.isConnected) gastLaag.appendChild(laag);
      herzie();
    },
    unmount: function () {
      if (laag && !laag.hidden) sluit();
      if (laag && laag.isConnected) document.body.appendChild(laag);
      gekozenKnop = gastKnop = null; gekozenLaag = gastLaag = null; setTimeout(herzie, 0);
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
