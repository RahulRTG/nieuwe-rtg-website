/* de randveeg: vanaf de schermrand naar binnen vegen */

  /* ---------------------------------------------------- 4. de randveeg */
  function randveeg() {
    var start = null, bezig = false;
    d.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      if (!t || t.clientX > 24) { start = null; return; }
      start = t.clientX; bezig = false;
    }, { passive: true });
    d.addEventListener('touchmove', function (e) {
      if (start == null) return;
      var t = e.touches[0];
      if (t && t.clientX - start > 60) bezig = true;
    }, { passive: true });
    d.addEventListener('touchend', function () {
      if (start != null && bezig) {
        if (w.history.length > 1) w.history.back(); else naarThuis();
      }
      start = null; bezig = false;
    }, { passive: true });
  }

  /* -------------------------------------------------------- 5. bladen */
  /* Wat vroeger een venster was, komt nu van onder. Een blad heeft een greep,
     sluit met een veeg omlaag, met Esc of met een tik ernaast -- en het heeft
     geen titelbalk, geen sluitknopje en geen dock. */
  function blad(inhoud, opties) {
    opties = opties || {};
    var waas = el('div', 'ios-waas');
    var vel = el('div', 'ios-blad');
    vel.setAttribute('role', 'dialog');
    vel.setAttribute('aria-modal', 'true');
    if (opties.label) vel.setAttribute('aria-label', opties.label);
    vel.appendChild(el('div', 'ios-greep'));
    if (typeof inhoud === 'string') vel.appendChild(el('div', null, inhoud));
    else if (inhoud) vel.appendChild(inhoud);

    d.body.appendChild(waas);
    d.body.appendChild(vel);
    requestAnimationFrame(function () { waas.classList.add('ios-aan'); vel.classList.add('ios-aan'); });

    function sluit() {
      waas.classList.remove('ios-aan'); vel.classList.remove('ios-aan');
      setTimeout(function () { waas.remove(); vel.remove(); }, 340);
      d.removeEventListener('keydown', opEsc);
    }
    function opEsc(e) { if (e.key === 'Escape') sluit(); }
    waas.addEventListener('click', sluit);
    d.addEventListener('keydown', opEsc);

    var greep = vel.querySelector('.ios-greep'), y0 = null;
    greep.addEventListener('pointerdown', function (e) {
      y0 = e.clientY;
      try { greep.setPointerCapture(e.pointerId); } catch (x) {}
    });
    greep.addEventListener('pointermove', function (e) {
      if (y0 == null) return;
      vel.style.transform = 'translateY(' + Math.max(0, e.clientY - y0) + 'px)';
    });
    greep.addEventListener('pointerup', function (e) {
      if (y0 == null) return;
      var afstand = e.clientY - y0; y0 = null;
      vel.style.transform = '';
      if (afstand > 90) sluit();
    });

    return { sluit: sluit, element: vel };
  }

  /* --------------------------------------------------------- aanzetten */
  body.setAttribute('data-ios', '');
  body.removeAttribute('data-osbar');

  // het merk gaat ook buiten de kopbalk weg, maar dan met de smalle bezem
  merkWegPagina();

  var kop = d.querySelector('body > header');
  if (kop && !isThuis) {
    bouwBalk(kop);
    /* Pas inmeten als de balk er echt staat -- en na deze tik, want de
       menuknop van appmenu.js komt verderop in dit bestand pas binnen en
       telt mee in de breedte. */
    var meetIn = function () { try { pasActiesIn(kop); } catch (e) {} };
    if (w.requestAnimationFrame) w.requestAnimationFrame(meetIn); else meetIn();
    w.addEventListener('resize', meetIn);
  }

  /* In een split-paneel (shared/split.js zet de app in een iframe naast een
     andere) hoort GEEN home-indicator: die van het scherm eromheen is de
     echte, en twee pillen boven elkaar is een knop die de verkeerde app
     sluit. De randveeg blijft ook aan het buitenste scherm. */
  var inPaneel = false;
  try { inPaneel = w.self !== w.top; } catch (e) { inPaneel = true; }
  if (!isThuis && !inPaneel) { homeIndicator(); randveeg(); }

  w.RTGiOS = { blad: blad, thuis: naarThuis, THUIS: THUIS };

  /* 6. HET MENU. De hamburger rechtsboven, met de functies van deze app en de
     vaste weg naar huis en naar de instellingen (shared/appmenu.js). Hij hangt
     hier om dezelfde reden als al het andere in dit bestand: dit is de laag die
     al op elke app-pagina staat en die de navigatiebalk net heeft gebouwd, dus
     dit is de plek waar de knop erbij kan zonder elke pagina te openen.

     Na de balk, want het menu zoekt zijn plek in .ios-nav-acties. In een
     split-paneel niet: daar hoort één menu bij het scherm eromheen, net als de
     home-indicator hierboven. */
  if (!inPaneel && !d.getElementById('rtgAppMenuJs')) {
    var menuS = d.createElement('script');
    menuS.id = 'rtgAppMenuJs';
    menuS.src = '/shared/appmenu.js';
    menuS.defer = true;
    (d.head || d.documentElement).appendChild(menuS);
  }
})(window, document);
