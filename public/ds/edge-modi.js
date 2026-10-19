/* RTG Design System: wat er in een Edge-modus staat.

   Alleen modi die op een bestaande backend aansluiten. Bellen, de
   appcarrousel en e-mail opstellen staan in de Edge-mockup, maar bestaan
   hier pas als ze aan de bestaande gesprek- en postlaag hangen; een knop die
   niets doet is erger dan een knop die er niet is (AFBOUWPROGRAMMA.md par. 2). */
(function (w, d) {
  'use strict';
  var R = w.RTGDs;
  if (!R || !R.edge) return;
  var h = R.hulp, el = h.el, svg = h.svg, I = h.ICONEN, E = R.edge, D = E.delen;

  /* De handelingen van DIT scherm: elk element met data-ds-actie. Het scherm
     bezit ze, met zijn eigen listeners en rechten; de Edge toont en klikt. */
  function schermActies() {
    return Array.prototype.slice.call(d.querySelectorAll('[data-ds-actie]')).filter(function (x) {
      return !x.closest('.ds-edge') && !x.disabled && x.getAttribute('aria-disabled') !== 'true' && !x.closest('[hidden]') &&
        !x.closest('dialog:not([open])');
    }).map(function (x) {
      return { label: x.getAttribute('data-ds-actie') || x.textContent.trim(), doe: function () { x.click(); } };
    });
  }

  E.registreer('navigatie', function () {
    var balk = D.balk();
    balk.appendChild(D.linkKnop('/apps/app.html', 'Home', svg(I.home)));
    balk.appendChild(D.linkKnop('/apps/wereld.html', 'Werelden', svg(I.werelden)));
    balk.appendChild(D.rahulKnop());
    balk.appendChild(D.bladKnop('acties', 'Acties', svg(I.acties), 'Acties', function () {
      var a = schermActies();
      if (a.length) return D.lijst(a);
      var p = el('p', 'ds-edge__bladtekst');
      p.textContent = 'Op dit scherm zijn geen handelingen.';
      return p;
    }));
    /* Dezelfde bestemmingen als de bestaande Edge-diensten
       (shared/rtg-adaptive-edge-services.js): geen eigen register. */
    balk.appendChild(D.bladKnop('menu', 'Menu', svg(I.menu), 'Menu', function () {
      return D.lijst([
        { label: 'Berichten', href: '/apps/comm.html', icoon: I.bericht },
        { label: 'RTG Media', href: '/apps/media.html' },
        { label: 'Uw account', href: '/apps/ik.html' },
        { label: 'Privacy en veiligheid', href: '/apps/veilig.html' }
      ]);
    }));
  });

  /* Rahul: dezelfde vraagweg als de metgezel (shared/metgezel.js: POST
     /api/fluister met het ledentoken). Rahul bereidt voor; uitvoeren doet
     het lid, op het scherm dat erover gaat. */
  function vraagRahul(q, bron) {
    var t = R.token();
    var uit = el('p', 'ds-edge__bladtekst', { 'aria-live': 'polite' });
    if (!t) {
      uit.textContent = 'Log in om Rahul te spreken.';
      var f = d.createDocumentFragment();
      f.appendChild(uit);
      f.appendChild(D.lijst([{ label: 'Inloggen', href: '/apps/app.html' }]));
      return D.openBlad('Rahul', bron, f);
    }
    uit.textContent = 'Rahul denkt mee...';
    D.openBlad('Rahul', bron, uit);
    fetch('/api/fluister', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      /* Wat het scherm aanwijst (EDGE.md par. 14.4): alleen als het scherm het
         blikveld laadt, en dan alleen soort en id; de server zoekt zelf op. */
      body: JSON.stringify(w.RTGEdgeBlikveld ? { q: q, context: w.RTGEdgeBlikveld.voorRahul() } : { q: q })
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (data) { uit.textContent = (data && (data.antwoord || data.reply || data.error)) || 'Ik kwam er niet uit.'; })
      .catch(function () { uit.textContent = 'Even geen verbinding; probeer het zo weer.'; });
  }
  function veldMetStuur(balk, label, max, bij) {
    var veld = el('input', 'ds-edge__veld', { type: 'text', maxlength: String(max), autocomplete: 'off', 'aria-label': label, placeholder: label });
    var stuur = el('button', 'ds-edge__knop', { type: 'button', 'aria-label': 'Verstuur' });
    stuur.innerHTML = svg(I.stuur);
    stuur.addEventListener('click', function () {
      var t = veld.value.trim();
      if (!t) return veld.focus();
      bij(t, stuur, veld);
    });
    veld.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); stuur.click(); } });
    balk.appendChild(veld);
    balk.appendChild(stuur);
    return veld;
  }

  E.registreer('rahul', function (opties) {
    var balk = D.balk();
    var sluit = D.knop('sluit', '', svg(I.sluit));
    sluit.setAttribute('aria-label', 'Sluit Rahul');
    sluit.addEventListener('click', function () { E.terug(); });
    balk.appendChild(sluit);
    var mond = el('span', 'ds-edge__knop ds-edge__knop--rahul', { 'aria-hidden': 'true' });
    mond.innerHTML = h.lippen();
    balk.appendChild(mond);
    var veld = veldMetStuur(balk, 'Vraag Rahul', 300, function (q, stuur) { vraagRahul(q, stuur); });
    if (opties && opties.vraag) veld.value = opties.vraag;
    setTimeout(function () { veld.focus(); }, 0);
  });

  /* Objectacties: een scherm geeft het object en zijn handelingen mee. */
  E.registreer('object', function (opties) {
    opties = opties || {};
    var balk = D.balk();
    if (opties.beeld) balk.appendChild(el('img', 'ds-edge__object', { src: opties.beeld, alt: opties.titel || '' }));
    (opties.acties || []).forEach(function (a) {
      var b = D.knop('object', a.label, a.icoon ? svg(a.icoon) : '');
      b.addEventListener('click', function () { a.doe(); });
      balk.appendChild(b);
    });
    balk.appendChild(D.rahulKnop());
    var terug = D.knop('terug', 'Terug', svg(I.sluit));
    terug.addEventListener('click', function () { E.terug(); });
    balk.appendChild(terug);
  });

  /* Bericht: antwoorden in een gesprek dat het scherm al voert. Het scherm
     verstuurt; de Edge levert alleen het veld. */
  E.registreer('bericht', function (opties) {
    opties = opties || {};
    var balk = D.balk();
    var icoon = el('span', 'ds-edge__knop', { 'aria-hidden': 'true' });
    icoon.innerHTML = svg(I.bericht);
    balk.appendChild(icoon);
    veldMetStuur(balk, opties.label || 'Bericht', opties.max || 2000, function (t, stuur, veld) {
      if (typeof opties.verstuur !== 'function') return;
      stuur.disabled = true;
      Promise.resolve(opties.verstuur(t)).then(function () { veld.value = ''; })
        .catch(function () {}).then(function () { stuur.disabled = false; veld.focus(); });
    });
  });
}(window, document));
