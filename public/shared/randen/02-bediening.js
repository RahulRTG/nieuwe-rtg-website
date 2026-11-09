  /* ---- wat er te openen valt ----
     Niets hiervan bouwen we zelf; we wijzen alleen aan wat er al is. */
  function openBoven() {
    if (w.RTGBediening && w.RTGBediening.aanwezig && w.RTGBediening.open) { w.RTGBediening.open(); return true; }
    var cc = d.getElementById('osCcBtn');           // het leden-OS heeft zijn eigen paneel
    if (cc) { cc.click(); return true; }
    return false;
  }
  function kanBoven() {
    return !!((w.RTGBediening && w.RTGBediening.aanwezig) || d.getElementById('osCcBtn'));
  }


  function hint(waar) {
    var el = d.createElement('div');
    el.className = 'rnd-hint ' + waar + ' ds-randen-hint';
    el.setAttribute('aria-hidden', 'true');
    d.body.appendChild(el);
    return el;
  }

  function toetsknop(tekst, doe) {
    /* Een eigen systeemelement voorkomt dat brede legacyregels als
       `button { color: inherit }` de centrale componentpresentatie overnemen.
       Rol en toetsenbordcontract blijven expliciet gelijk aan een knop. */
    var b = d.createElement('rtg-randen-toets');
    b.className = 'rnd-toets ds-randen-toets';
    b.setAttribute('role', 'button'); b.setAttribute('tabindex', '0');
    b.textContent = tekst;
    b.addEventListener('click', doe);
    b.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault(); doe();
    });
    return b;
  }

  /* ---- het gebaar ---- */
  function start() {
    if (!d.body) return;
    // De shell kan DS activeren terwijl deze bestaande ingang op DOM-ready
    // wacht. Gebruik bij opbouw dezelfde actuele keuze als de stijlguard.
    isDs = d.documentElement.hasAttribute('data-ds');
    var boven = kanBoven();
    if (!boven) return;
    var hBoven = hint('boven');
    d.body.appendChild(toetsknop(T('rnd.bov', 'Instellingen openen'), openBoven));

    var bezig = null, y0 = 0, gedaan = false;

    /* Een geslaagde haal moet de klik eronder slikken. De buitenste 24 px is op
       veel schermen ook de onderbalk of de statusbalk; zonder dit opent het
       paneel en volgt daarna alsnog de knop waar je toevallig op begon (op
       Kantoren sprong het scherm zo naar een heel andere app). We luisteren
       eenmalig in de vangfase -- een gewone tik op die balk blijft dus werken,
       alleen de klik die bij het slepen hoort niet. */
    function slikKlik() {
      var eenmalig = function (e) {
        d.removeEventListener('click', eenmalig, true);
        e.preventDefault(); e.stopPropagation();
      };
      d.addEventListener('click', eenmalig, true);
      setTimeout(function () { d.removeEventListener('click', eenmalig, true); }, 700);
    }


    d.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      gedaan = false;
      if (e.clientY <= RAND) {
        bezig = 'boven'; y0 = e.clientY;
        /* Edge draagt echte links in de bovenrand. Pointer capture houdt de
           haal bij ons wanneer de aanwijzer zo'n link verlaat. */
        try { e.target.setPointerCapture(e.pointerId); } catch (fout) {}
      }
      else bezig = null;
    }, { capture: true, passive: true });

    d.addEventListener('dragstart', function (e) {
      if (bezig === 'boven') e.preventDefault();
    }, true);

    var stop = function () {
      hBoven.classList.remove('aan'); hBoven.style.width = '44px';
      bezig = null;
    };

    d.addEventListener('pointermove', function (e) {
      if (!bezig || gedaan) return;
      var dy = e.clientY - y0;
      hBoven.classList.toggle('aan', dy > 6);
      hBoven.style.width = Math.min(120, 44 + Math.max(0, dy)) + 'px';
      if (dy < HAAL) return;
      gedaan = true; stop();
      // eerst openen, dan pas de slik aanzetten: sommige panelen worden met een
      // eigen klik geopend, en die mag de slik natuurlijk niet opeten
      openBoven();
      slikKlik();
    }, { passive: true });

    d.addEventListener('pointerup', stop, { passive: true });
    d.addEventListener('pointercancel', stop, { passive: true });

    w.RTGRanden = { boven: openBoven };
  }

  // achteraan in de rij: de panelen die we openen moeten er eerst zijn
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { setTimeout(start, 60); });
  else setTimeout(start, 60);
})(window, document);
