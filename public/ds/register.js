/* Het wereldregister op het RTG Design System: de vier handelingen van een
   reisregel (.reis[href]) op EEN plek. Openen, Delen, Kenmerk en Overnemen.

   Op de oude schermen doet shared/gebaar.js dit met RTGGebaar.wereldregister
   (een veeg met een lade); die laag zet haar eigen stijl en staat achter de
   ds-poort. Een ds-scherm kreeg daardoor de handelingen niet meer. Dit is de
   ds-vorm ervan, met dezelfde betekenis en dezelfde teksten als KLAAR in
   gebaar.js: delen gaat via het deelvenster van het toestel en anders naar
   het klembord ("titel - adres"), kenmerk en overnemen zetten iets op het
   klembord en zeggen dat. Openen navigeert weg en meldt dus niets.

   De regel blijft de bron: de acties worden uit de regel zelf gelezen
   (data-reg-titel, data-reg-plaats, data-reg-dag, data-ref, data-reg-bron),
   en na elke nieuwe tekening van het register opnieuw gezet. Een scherm
   schrijft dus geen eigen actielijst (LAT.md regel 4). De handelingen staan
   als rustige knoppen in een .ds-handelingen-rij onder de regel: zichtbaar
   en bereikbaar zonder veeg. Dit script zet geen stijl. */
(function (w, d) {
  'use strict';
  function en() { return /^en\b/i.test(d.documentElement.lang || ''); }
  function T(sleutel, nl, eng) {
    if (w.RTGi18n && w.RTGi18n.t) return w.RTGi18n.t(sleutel, nl);
    return en() ? eng : nl;
  }
  function kopieer(tekst, gedaan) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tekst).catch(function () {}); } catch (e) {}
    return gedaan;
  }
  var KLAAR = {
    openen: function (href) {
      return { naam: T('gebaar.openen', 'Openen', 'Open'), doe: function () { if (href) location.href = href; } };
    },
    delen: function (o) {
      return { naam: T('gebaar.delen', 'Delen', 'Share'), doe: function () {
        var data = { title: o.titel || d.title, text: '', url: o.url || location.href };
        if (navigator.share) { try { navigator.share(data).catch(function () {}); } catch (e) {} return; }
        return kopieer((data.title ? data.title + ' - ' : '') + data.url,
          T('gebaar.gekopieerd', 'Gekopieerd; klaar om te plakken.', 'Copied; ready to paste.'));
      } };
    },
    kenmerk: function (code) {
      if (!code) return null;
      return { naam: T('gebaar.kenmerk', 'Kenmerk', 'Reference'), doe: function () {
        return kopieer(code, code + ' - ' + T('gebaar.gekopieerd2', 'gekopieerd', 'copied'));
      } };
    },
    overnemen: function (tekst) {
      return { naam: T('gebaar.overnemen', 'Overnemen', 'Copy'), doe: function () {
        return kopieer(tekst, T('gebaar.overgenomen', 'De regel staat op uw klembord.', 'The row is on your clipboard.'));
      } };
    }
  };
  function tekstVan(el) { return el ? (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ') : ''; }

  /* De acties van een regel, uit de regel zelf. */
  function acties(rij) {
    var titel = tekstVan(rij.querySelector('[data-reg-titel]')), plaats = tekstVan(rij.querySelector('[data-reg-plaats]'));
    var refEl = rij.querySelector('[data-ref]'), ref = refEl ? refEl.getAttribute('data-ref') : '', href = rij.getAttribute('href');
    return { titel: titel + (plaats ? ' · ' + plaats : ''), acties: [
      KLAAR.openen(href), KLAAR.delen({ titel: titel, url: location.origin + href }), KLAAR.kenmerk(ref),
      KLAAR.overnemen([titel, plaats, tekstVan(rij.querySelector('[data-reg-dag]')), ref,
        tekstVan(rij.querySelector('[data-reg-bron]'))].filter(Boolean).join(' · '))
    ].filter(Boolean) };
  }
  function versier(wortel, meld) {
    wortel.querySelectorAll('.reis[href]').forEach(function (rij) {
      var na = rij.nextElementSibling;
      if (na && na.hasAttribute('data-ds-register')) return;
      var a = acties(rij), rijKnoppen = d.createElement('div');
      rijKnoppen.className = 'ds-handelingen'; rijKnoppen.setAttribute('data-ds-register', '');
      rijKnoppen.setAttribute('role', 'group'); rijKnoppen.setAttribute('aria-label', a.titel);
      a.acties.forEach(function (x) {
        var b = d.createElement('button'); b.type = 'button'; b.className = 'ds-knop ds-knop--stil ds-knop--klein'; b.textContent = x.naam;
        b.addEventListener('click', function () { var m = x.doe(); if (m) meld(m); });
        rijKnoppen.appendChild(b);
      });
      rij.after(rijKnoppen);
    });
  }
  function standaardMelding(tekst) {
    var el = d.querySelector('.ds-melding[role="status"]'); if (!el) return;
    el.textContent = tekst; el.classList.add('toon');
    clearTimeout(standaardMelding.t); standaardMelding.t = setTimeout(function () { el.classList.remove('toon'); }, 3200);
  }
  /* Hang het register aan EEN bouwer; hij volgt elke nieuwe tekening. */
  function wereldregister(wortel, opties) {
    if (!wortel) return false;
    var meld = (opties && opties.melding) || standaardMelding, gepland = false;
    versier(wortel, meld);
    new MutationObserver(function () {
      if (gepland) return; gepland = true;
      Promise.resolve().then(function () { gepland = false; versier(wortel, meld); });
    }).observe(wortel, { childList: true, subtree: true });
    return true;
  }
  w.RTGDsRegister = { klaar: KLAAR, wereldregister: wereldregister };
})(window, document);
