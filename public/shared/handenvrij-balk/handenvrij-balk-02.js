  /* Alles wat geen navigatie is, gaat hiernaartoe: onveranderd naar Rahul, met
     de eigen inlog. Daar zitten de geld-drempel en de bevestiging, en die willen
     we niet dubbel (en dus niet half) in de browser nabouwen. */
  function vraagRahul(vraag, hardop) {
    /* De geldpoort staat VOOR het versturen. Kwam dit van de mond en gaat het
       over geld of een boeking, dan houdt hij het tegen (typen) of zet hij er
       eerst een bevestiging voor. Getypte tekst gaat gewoon door: dat is de
       weg die we juist willen. */
    if (kamer.geldPoort && kamer.geldPoort(vraag, !!hardop, function (z) { stuurRahul(z, hardop); })) return;
    stuurRahul(vraag, hardop);
  }
  function stuurRahul(vraag, hardop) {
    if (kamer.tikt) kamer.tikt(true);              // drie puntjes: hij is bezig
    fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ q: vraag, lang: taal() }) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (kamer.tikt) kamer.tikt(false);
        zeg((d && (d.antwoord || d.reply || d.error)) || 'Ik kwam er niet uit.', hardop);
      })
      .catch(function () {
        if (kamer.tikt) kamer.tikt(false);
        zeg('Even geen verbinding; probeer het zo weer.', hardop);
      });
  }
  function taal() { try { return localStorage.getItem('rtg_lang') || document.documentElement.lang || 'nl'; } catch (e) { return 'nl'; } }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var q = inp.value.trim(); if (!q) return;
    inp.value = ''; mijnBeurt(q); doe(q, false);
  });

  /* Wat JIJ zegt hoort meteen in het gesprek te staan, ook als het navigatie
     blijkt. Anders zie je je eigen woorden pas terug als er een antwoord komt,
     en dat voelt niet als chatten maar als een formulier. */
  function mijnBeurt(tekst) { if (kamer.beurt) kamer.beurt('member', tekst); }
  /* Dichtdoen loopt via de standen-laag (handenvrij-scherm.js) als die er is;
     die haalt dan ook de pin eraf, zodat hij daarna weer vanzelf meebeweegt. */
  function dicht() { if (root.RTGChatScherm) root.RTGChatScherm.zet('min'); else chat.hidden = true; }
  knStem.addEventListener('click', function () { stelStem(!stemAan); });

  /* ---------- beginnen met typen, waar je ook bent ----------
     Een losse letter hoort in de balk te belanden, niet in het niets. We blijven
     van echte velden en van sneltoetsen (ctrl/cmd/alt) af, en van Escape binnen
     de balk maken we "laat maar". */
  document.addEventListener('keydown', function (ev) {
    if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    var t = ev.target;
    if (t === inp) { if (ev.key === 'Escape') { inp.value = ''; inp.blur(); dicht(); } return; }
    var tag = (t && t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (t && t.isContentEditable)) return;
    if (ev.key === '/' || (ev.key && ev.key.length === 1 && /[\wÀ-ɏ]/.test(ev.key))) {
      ev.preventDefault(); inp.focus();
      if (ev.key !== '/') inp.value += ev.key;
    }
  });

  /* ---------- de mond erbij ----------
     Een gedeelde, muteerbare kamer: handenvrij-mond.js vult spreek/zwijg in en
     leest doe/zeg/knop. Zo kennen de twee delen elkaar zonder laadvolgorde-gedoe;
     hetzelfde late-binding-patroon als in de kern op de server. */
  var kamer = {
    doe: doe, zeg: zeg, knop: knMond, vak: chat, tok: tok, taal: taal,
    zetVeld: function (t) { inp.value = String(t || '').slice(0, 300); try { inp.focus(); } catch (e) {} },
    geldDoorgaan: function (z) { stuurRahul(z, true); },
    spreek: null, zwijg: null,          // vult handenvrij-mond.js in
    beurt: null, tikt: null, laadGesprek: null,  // vult handenvrij-chat.js in
    geldPoort: null, geldAntwoord: null, geldAan: null, // vult handenvrij-geld.js in
    naStand: null, camera: null         // vult handenvrij-scherm.js / -oog.js in
  };
  root.__handenvrijKamer = kamer;
  ['/shared/handenvrij-chat.js', '/shared/handenvrij-geld.js', '/shared/handenvrij-mond.js',
    '/shared/handenvrij-scherm.js', '/shared/handenvrij-oog.js',
    '/shared/handenvrij-bureau.js'].forEach(function (src) {
    var el = document.createElement('script');
    el.src = src; el.defer = true;
    document.head.appendChild(el);
  });

  // wat een pagina zelf aanmeldt, gaat voor op wat we uit de DOM oprapen
  api.plek = function (naam, doen) { if (naam && typeof doen === 'function') eigen.push({ naam: String(naam), doen: doen }); };
  api.zeg = function (t) { doe(String(t || ''), false); };
  api.balk = function () { inp.focus(); };
  api.plekken = plekken;
})(typeof self !== 'undefined' ? self : this);
