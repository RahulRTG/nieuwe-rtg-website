/* Slot van de gebarenlaag, deel twee: WAT EEN SCHERM ERVAN ZIET. De uitleg die
   aan elke regel hangt, de vier kant-en-klare acties die overal hetzelfde
   betekenen, en de publieke deur. Hierboven staat de actielade zelf.
   (Geknipt op de maat van check.js regel 13; de naad zat hier al.) */
  /* ---------------------------------------------------------- de uitleg --
     EEN zin, EEN keer in het document, waar elke gebarenregel naar wijst. Zo
     hoort een schermlezer bij de regel zelf dat er acties aan hangen en hoe je
     erbij komt -- in plaats van dat het gebaar alleen bestaat voor wie het
     toevallig probeert. */
  var UITLEG = 'gbUitleg';
  function uitlegElement() {
    var el = d.getElementById(UITLEG);
    if (el) return el;
    el = d.createElement('p');
    el.id = UITLEG;
    el.textContent = T('gebaar.uitleg',
      'Deze regel draagt acties. Veeg naar links of rechts, of open ze met de menutoets of de pijltoetsen.',
      'This row carries actions. Swipe left or right, or open them with the menu key or the arrow keys.');
    el.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;' +
      'overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;';
    (d.body || d.documentElement).appendChild(el);
    return el;
  }
  /* Gehesen naar deel 1: merk() roept dit aan. */
  function merkEen(rij) {
    rij.classList.add('gb-rij');
    uitlegElement();
    var b = rij.getAttribute('aria-describedby') || '';
    if (b.split(/\s+/).indexOf(UITLEG) < 0) {
      rij.setAttribute('aria-describedby', (b ? b + ' ' : '') + UITLEG);
    }
    rij.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight');
  }

  /* ------------------------------------------------------- kant-en-klaar --
     Vier acties die op bijna elke regel hetzelfde betekenen. Ze staan HIER en
     niet drie keer in drie schermen: anders staat "kenmerk kopieren" straks op
     drie plekken met drie meldingen en twee bugs (LAT.md regel 4).

     Alle vier geven iets TERUG, en dat is wat de melding oproept. Alleen
     'openen' niet: die navigeert weg, en een bevestiging achterlaten op een
     scherm dat je net verliet is een melding voor niemand. */
  function kopieer(tekst, gedaan) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tekst);
    } catch (e) {}
    return gedaan;
  }
  function alsTekst(rij) { return (rij.textContent || '').trim().replace(/\s+/g, ' '); }

  var KLAAR = {
    openen: function (href, naam) {
      return { naam: naam || T('gebaar.openen', 'Openen', 'Open'), teken: 'openen',
        doe: function () { if (href) location.href = href; } };
    },
    delen: function (o) {
      return { naam: T('gebaar.delen', 'Delen', 'Share'), teken: 'delen',
        doe: function (rij) {
          var data = {
            title: (o && o.titel) || d.title,
            text: (o && o.tekst) || '',
            url: (o && o.url) || location.href
          };
          if (navigator.share) { try { navigator.share(data).catch(function () {}); } catch (e) {} return; }
          return kopieer((data.title ? data.title + ' - ' : '') + data.url,
            T('gebaar.gekopieerd', 'Gekopieerd; klaar om te plakken.', 'Copied; ready to paste.'));
        } };
    },
    kenmerk: function (code) {
      if (!code) return null;
      return { naam: T('gebaar.kenmerk', 'Kenmerk', 'Reference'), teken: 'kenmerk',
        doe: function () { return kopieer(code, code + ' - ' + T('gebaar.gekopieerd2', 'gekopieerd', 'copied')); } };
    },
    overnemen: function (tekst) {
      return { naam: T('gebaar.overnemen', 'Overnemen', 'Copy'), teken: 'archief',
        doe: function (rij) {
          var t = typeof tekst === 'function' ? tekst(rij) : (tekst || alsTekst(rij));
          return kopieer(t, T('gebaar.overgenomen', 'De regel staat op uw klembord.', 'The row is on your clipboard.'));
        } };
    },
    /* De regel heeft zelf al een knop; de veeg drukt hem in. Zo blijft er EEN
       waarheid over wat die knop doet, en niet een tweede kopie ernaast. */
    eigenKnop: function (naam, teken, kiezer) {
      return { naam: naam, teken: teken || 'openen',
        doe: function (rij) { var b = rij.querySelector(kiezer); if (b) b.click(); } };
    }
  };

  /* ------------------------------------------------------------- de deur -- */
  window.RTGGebaar = {
    /* Een regel met eigen acties. Geeft false terug als er niets bruikbaars in
       zat -- een lege lade opent niet, en dat hoort de aanroeper te weten. */
    zet: function (rij, acties) {
      var a = normaliseer(acties);
      if (!rij || !a) return false;
      boek.set(rij, a);
      merkEen(rij);
      return true;
    },
    /* Een LIJST die zichzelf opnieuw tekent. De acties worden pas gemaakt als
       een hand of een toets erom vraagt, dus een regel die net vervangen is
       heeft meteen de goede. De waarnemer is er alleen voor de KLASSE: die moet
       op de regel staan voordat de vinger neerkomt, want touch-action wordt
       door de browser gelezen op het moment van aanraken en niet daarna. */
    lijst: function (wortel, kiezer, bouwer) {
      if (!wortel || !kiezer || typeof bouwer !== 'function') return false;
      /* EERST OPRUIMEN. Een scherm met panelen (reizen-veilig) meldt zijn
         lijst per paneel aan, en die panelen komen en gaan. Zonder deze stap
         groeit de aanmeldlijst met elk paneel en houdt hij de weggehaalde DOM
         vast -- een lek dat je pas ziet na een uur werken. */
      for (var i = lijsten.length - 1; i >= 0; i--) {
        if (lijsten[i].wortel.isConnected) continue;
        if (lijsten[i].oog) try { lijsten[i].oog.disconnect(); } catch (e) {}
        lijsten.splice(i, 1);
      }
      var post = { wortel: wortel, kiezer: kiezer, bouwer: bouwer, oog: null };
      lijsten.push(post);
      merk(wortel, kiezer);
      try {
        post.oog = new MutationObserver(function () { merk(wortel, kiezer); });
        post.oog.observe(wortel, { childList: true, subtree: true });
      } catch (e) {}
      return true;
    },
    weg: function (rij) {
      if (!rij) return;
      boek.delete(rij);
      rij.classList.remove('gb-rij');
      rij.removeAttribute('aria-keyshortcuts');
      sluit(rij, true);
    },
    open: opendActielade,
    melding: melding,
    klaar: KLAAR,
    sluit: function () { sluitAlles(true); sluitBlad(); }
  };

  /* De laag laadt zonder haast (shared/basis.js zet hem op async), dus een
     scherm dat zijn regels wil ophangen kan er niet vanuit gaan dat hij er al
     is. Dit sein zegt: nu wel. Wie eerder klaar is dan de laag, luistert;
     wie later komt, ziet window.RTGGebaar gewoon staan. */
  try { d.dispatchEvent(new CustomEvent('rtg-gebaar')); } catch (e) {}

  d.addEventListener('pointerdown', opNeer);
  d.addEventListener('pointermove', opBeweeg);
  d.addEventListener('pointerup', opLos);
  d.addEventListener('pointercancel', opLos);
})();
