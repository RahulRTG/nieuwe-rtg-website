/* RTG Horeca (schermen): de gedeelde bedrading van alle horecaschermen --
   de zaak-sessie, de API-aanroep, de meldbalk, en de deur voor wie uitgelogd
   komt.

   Hij staat hier een keer en niet zeven keer. Dat is geen netheid maar
   LAT-regel 4: zeven kopieen van dezelfde fetch-wrapper lopen gegarandeerd
   uiteen, en dan werkt de ene helft van de schermen na een wijziging nog en de
   andere niet.

   De sessie is de gewone zaak-inlog (`rtg_sup_token`, dezelfde als de kassa).
   Wie uitgelogd komt, krijgt de gedeelde deur OP de pagina zelf -- geen
   omleiding, want die raakt kwijt waar iemand heen wilde (TAKEN 5.5). */
(function () {
  'use strict';
  if (window.RTGHoreca) return;
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_sup_token'); } catch (e) {}

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  window.RTGHoreca = {
    token: TOKEN,
    esc: esc,
    euro: function (c) { return '€ ' + ((c || 0) / 100).toFixed(2); },
    minuten: function (n) { return n + ' min'; },
    meld: function (t) {
      var m = document.getElementById('melding');
      if (!m) return;
      m.textContent = t; m.classList.add('zie');
      clearTimeout(window.RTGHoreca._t);
      window.RTGHoreca._t = setTimeout(function () { m.classList.remove('zie'); }, 3000);
    },
    /* Een volledig pad. De bezorgersschermen praten met de bestaande ritlaag
       (/api/supplier/bezorg/...) en niet met /horeca; die twee lagen zijn
       expres niet samengevoegd, dus de bedrading moet allebei kunnen. */
    apiVol: function (pad, body) {
      return fetch(pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
        body: JSON.stringify(body || {}) })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; });
        });
    },
    api: function (pad, body) { return window.RTGHoreca.apiVol('/api/supplier/horeca' + pad, body); },
    /* De deur, met de weg terug erin. Geeft false als er geen sessie is, zodat
       een scherm zijn eigen opbouw kan overslaan in plaats van te crashen op
       een lege lijst. */
    poort: function () {
      if (TOKEN) return true;
      var naar = '/apps/personeel.html?terug=' + encodeURIComponent(location.pathname);
      if (!window.RTGDeur) { location.replace(naar); return false; }
      // een pagina met twee deelscripts vraagt het twee keer; een deur is genoeg
      if (window.RTGHoreca._deur) return false;
      window.RTGHoreca._deur = true;
      setTimeout(function () {
        var el = document.getElementById('main') || document.body;
        RTGDeur.toon(el, { soort: 'personeel', naar: naar });
      }, 0);
      return false;
    },
    // een rij zoals alle horecaschermen hem tekenen
    /* Een rij met links de inhoud en rechts een stille kolom. Die rechterkant
       is OPTIONEEL: zonder de standaardwaarde plakte een aanroep met een
       argument het woord "undefined" achter de tekst, en dat stond in een echt
       scherm (de pols). Een helper hoort niet te lekken wat hij niet kreeg. */
    rij: function (links, rechts) {
      return '<div class="item"><span>' + links + '</span><span class="stil">' + (rechts == null ? '' : rechts) + '</span></div>';
    },
    // een knop met gegevens eraan; het binden gebeurt per scherm
    knop: function (tekst, data, primair) {
      var attr = Object.keys(data || {}).map(function (k) { return ' data-' + k + '="' + esc(data[k]) + '"'; }).join('');
      return '<button class="knop' + (primair ? ' p' : '') + '" type="button"' + attr + '>' + esc(tekst) + '</button>';
    },
    // alle knoppen met een bepaald data-attribuut binden
    bind: function (wortel, attr, doen) {
      Array.prototype.forEach.call(wortel.querySelectorAll('[data-' + attr + ']'), function (b) {
        b.addEventListener('click', function () { doen(b); });
      });
    }
  };
})();
