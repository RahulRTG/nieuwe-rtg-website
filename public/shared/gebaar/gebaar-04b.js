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

  /* ------------------------------------------------- het wereldregister --
     DRIE SCHERMEN, EEN BOUWER. Kantoor, Sociaal en Reizen tekenen alledrie
     dezelfde regel: .reis met een stip, een datumkolom, een titel, een status,
     een kenmerk en een bron. Die vorm woont in shared/rtg-wereld.css en niet in
     een van de drie schermen -- dus hoort ook de vraag "welke acties draagt zo'n
     regel" op EEN plek te staan. De eerste versie hiervan stond in kantoor.html;
     dat was na twee schermen al twee kopieen (LAT.md regel 4).

     .reis is met naam GELEEND, net als .knop in het blad. Deze laag mag geen
     klassen van schermen gaan raden; wat hij leent, leent hij zichtbaar.

     De acties komen uit de REGEL zelf en niet uit een tweede kopie van de data:
     het register wordt opnieuw getekend zodra er iets binnenkomt, en een tweede
     lijst die dan niet meeloopt is precies de dubbele waarheid waar dit tegen
     beschermt. Staat er geen kenmerk, dan valt die actie vanzelf weg. */
  function tekstVan(el) { return el ? el.textContent.trim().replace(/\s+/g, ' ') : ''; }

  function wereldregister(wortel) {
    if (!wortel) return false;
    return window.RTGGebaar.lijst(wortel, '.reis[href]', function (rij) {
      var h = rij.querySelector('h3');
      /* De bestemming staat IN de h3 als eigen span (Reizen). textContent plakt
         die aan de titel vast -- "Ibiza-weekIbiza" -- dus hij wordt er hier
         afgehaald en als eigen deel behandeld. */
      var plaatsEl = h && h.querySelector('.rtg-plaats');
      var plaats = tekstVan(plaatsEl);
      var titel = tekstVan(h);
      if (plaats && titel.slice(-plaats.length) === plaats) titel = titel.slice(0, -plaats.length).trim();
      var refEl = rij.querySelector('.rtg-ref');
      var ref = refEl ? refEl.getAttribute('data-ref') : '';
      var href = rij.getAttribute('href');
      return {
        titel: titel + (plaats ? ' \u00b7 ' + plaats : ''),
        rechts: [KLAAR.openen(href), KLAAR.delen({ titel: titel, url: location.origin + href })],
        links: [
          KLAAR.kenmerk(ref),
          KLAAR.overnemen([titel, plaats, tekstVan(rij.querySelector('.dag')), ref,
            tekstVan(rij.querySelector('.bron'))].filter(Boolean).join(' \u00b7 '))
        ]
      };
    });
  }

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
    wereldregister: wereldregister,
    sluit: function () { sluitAlles(true); sluitBlad(); }
  };

