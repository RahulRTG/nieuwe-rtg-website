/* het blad dat van onderen opkomt */
  var scrim = null, blad = null, knop = null, laatstFocus = null;

  /* De titel zegt WAAR JE BENT: de naam van deze app, uit de navigatiebalk of
     de grote titel. Nooit een woordmerk -- dat is precies wat shared/ios.js
     overal uit de chrome veegt. */
  function titel() {
    var nav = d.querySelector('.ios-nav-titel');
    if (nav && nav.textContent.trim()) return nav.textContent.trim();
    var groot = d.querySelector('.ios-groot');
    if (groot && groot.textContent.trim()) return groot.textContent.trim();
    var h1 = d.querySelector('main h1, h1');
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();
    return (d.title || '').split(/[,·|-]/)[0].trim() || T('menu.app', 'Deze app');
  }

  function maakTegel(item) {
    var b = d.createElement('button');
    b.type = 'button'; b.className = menuKlasse('amn-tegel', 'ds-appmenu__tegel');
    /* Alleen een teken als er een teken IS. De functies die hier gevonden
       worden ("Feed", "Ontdekken", "Alle", "Hotels") hebben er geen, en er dan
       maar een neutrale stip bij zetten geeft zes identieke stipjes onder
       elkaar -- ruis die niets toevoegt. De vaste rijen hieronder hebben elk
       hun eigen teken en dragen het wel. */
    if (item.icoon) b.appendChild(teken(item.icoon));
    var s = d.createElement('span'); s.textContent = item.label;
    b.appendChild(s);
    b.addEventListener('click', function () { voerUit(item); });
    return b;
  }

  function maakRij(item) {
    var b = d.createElement('button');
    b.type = 'button'; b.className = menuKlasse('amn-rij', 'ds-appmenu__rij');
    b.appendChild(teken(item.icoon || 'stip'));
    var s = d.createElement('span'); s.textContent = item.label;
    b.appendChild(s);
    var tel = item.tel && item.tel();
    if (tel) { var e = d.createElement('em'); e.textContent = tel; b.appendChild(e); }
    b.addEventListener('click', function () { voerUit(item); });
    return b;
  }

  /* Een menukeuze sluit het menu EERST en doet daarna pas iets. Andersom
     lag het blad over het paneel dat er net was opengegaan, en dan lijkt het
     alsof de knop niets deed. */
  function voerUit(item) {
    sluit();
    setTimeout(function () {
      if (typeof item.doe === 'function') return item.doe();
      if (item.knop) return item.knop.click();
      if (item.spring) {
        item.spring.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  }

  function bouw() {
    scrim = d.createElement('div'); scrim.className = menuKlasse('amn-scrim', 'ds-appmenu');
    blad = d.createElement('div'); blad.className = menuKlasse('amn-blad', 'ds-dialoog ds-appmenu__blad');
    blad.setAttribute('role', 'dialog');
    blad.setAttribute('aria-modal', 'true');
    blad.setAttribute('aria-label', T('menu.label', 'Menu'));
    blad.setAttribute('tabindex', '-1');
    scrim.appendChild(blad);
    scrim.addEventListener('click', function (e) { if (e.target === scrim) sluit(); });
    d.body.appendChild(scrim);
  }

  function vul() {
    blad.textContent = '';
    blad.appendChild(Object.assign(d.createElement('div'), { className: menuKlasse('amn-greep', 'ds-appmenu__greep') }));

    var kop = d.createElement('div'); kop.className = menuKlasse('amn-kop', 'ds-appmenu__kop');
    var naam = d.createElement('b'); naam.textContent = titel();
    var x = d.createElement('button');
    x.type = 'button'; x.className = menuKlasse('amn-x', 'ds-appmenu__sluit'); x.textContent = '✕';
    x.setAttribute('aria-label', T('menu.sluit', 'Menu sluiten'));
    x.addEventListener('click', sluit);
    kop.appendChild(naam); kop.appendChild(x);
    blad.appendChild(kop);

    var eigen = eigenFuncties();
    if (eigen.length) {
      blad.appendChild(sectie(T('menu.deze', 'Deze app')));
      var rooster = d.createElement('div'); rooster.className = menuKlasse('amn-rooster', 'ds-appmenu__rooster');
      for (var i = 0; i < eigen.length; i++) rooster.appendChild(maakTegel(eigen[i]));
      blad.appendChild(rooster);
    }

    var vast = vasteFuncties();
    if (vast.length) {
      blad.appendChild(sectie(T('menu.overal', 'Overal')));
      var lijst = d.createElement('div'); lijst.className = menuKlasse('amn-lijst', 'ds-appmenu__lijst');
      for (var j = 0; j < vast.length; j++) lijst.appendChild(maakRij(vast[j]));
      blad.appendChild(lijst);
    }

    if (!eigen.length && !vast.length) {
      var p = d.createElement('p'); p.className = menuKlasse('amn-leeg', 'ds-appmenu__leeg');
      p.textContent = T('menu.niets', 'Op dit scherm valt niets extra\'s te doen.');
      blad.appendChild(p);
    }
  }

  function sectie(tekst) {
    var s = d.createElement('div'); s.className = menuKlasse('amn-sectie', 'ds-appmenu__sectie'); s.textContent = tekst;
    return s;
  }

  function open() {
    /* Ook het blad kan met de body zijn meegeveegd (zie bewaakKnop). Het staat
       dan nog wel in deze variabele maar niet meer in het document, en dan gaat
       er bij een tik niets open zonder dat er iets misgaat -- de stilste storing
       die er is. */
    var wasOpen = scrim && scrim.isConnected && scrim.classList.contains('amn-open');
    if (scrim && !scrim.isConnected) scrim = null;
    if (!scrim) bouw();
    if (!wasOpen) laatstFocus = d.activeElement;
    vul();
    scrim.classList.add('amn-open');
    if (knop) knop.setAttribute('aria-expanded', 'true');
    d.addEventListener('keydown', opEsc);
    var eerste = blad.querySelector('.amn-tegel, .amn-rij, .amn-x');
    if (eerste) eerste.focus();
  }

  function sluit() {
    if (!scrim) return;
    scrim.classList.remove('amn-open');
    if (knop) knop.setAttribute('aria-expanded', 'false');
    d.removeEventListener('keydown', opEsc);
    var terug = laatstFocus && laatstFocus.isConnected ? laatstFocus : knop;
    if (terug && terug.isConnected && terug.focus) { try { terug.focus({ preventScroll: true }); } catch (e) {} }
    laatstFocus = null;
  }

  function opEsc(e) {
    if (!scrim || !scrim.isConnected || !scrim.classList.contains('amn-open') || blad.closest('[inert]')) return;
    if (e.key === 'Escape') { e.stopPropagation(); sluit(); return; }
    if (e.key !== 'Tab') return;
    /* De bestaande basislaag sluit de achtergrond met inert. Ook zonder die
       laag blijft de toetsenbordvolgorde in dit menu: geen tweede controller. */
    var kan = [].filter.call(blad.querySelectorAll('button'), function (b) {
      return !b.disabled && b.tabIndex >= 0 && zichtbaar(b) && !b.closest('[inert]');
    });
    var eerste = kan[0], laatste = kan[kan.length - 1];
    if (!eerste) { e.preventDefault(); blad.focus(); return; }
    if (!blad.contains(d.activeElement) || (e.shiftKey && d.activeElement === eerste) || (!e.shiftKey && d.activeElement === laatste)) {
      e.preventDefault(); (e.shiftKey ? laatste : eerste).focus();
    }
  }
  function wissel() { (scrim && scrim.isConnected && scrim.classList.contains('amn-open')) ? sluit() : open(); }
