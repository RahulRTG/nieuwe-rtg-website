/* RTG Handel: het scherm van de handelsketen (server/kern/handelsketen.js).

   Eén pagina voor BEIDE kanten, en dat is het punt: wie maandag linnen inkoopt,
   is donderdag de leverancier van een cateraar.

   Welke knoppen een zaak ziet, verzint dit bestand niet. De server stuurt per
   handel een `mag`-lijst mee; hier worden alleen die knoppen getekend. Zou het
   scherm de levensloop naspelen, dan weten twee plekken hem en lopen ze uiteen
   (LAT-regel 4). */
(function () {
  'use strict';
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_sup_token'); } catch (e) {}

  var data = null;

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function euro(n) { return '€ ' + Number(n || 0).toFixed(2); }
  function meld(t) {
    var m = document.getElementById('melding');
    if (!m) return;
    m.textContent = t; m.classList.add('zie');
    clearTimeout(meld._t);
    meld._t = setTimeout(function () { m.classList.remove('zie'); }, 3200);
  }
  function api(pad, body) {
    return fetch('/api/supplier/handel' + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (!r.ok) throw new Error(b.error || 'Dat lukte niet.');
        return b;
      });
    });
  }
  // de deur voor wie uitgelogd komt, op de pagina zelf (TAKEN 5.5)
  function poort() {
    if (TOKEN) return true;
    var naar = '/apps/personeel.html?terug=' + encodeURIComponent(location.pathname);
    if (!window.RTGDeur) { location.replace(naar); return false; }
    setTimeout(function () {
      RTGDeur.toon(document.getElementById('main') || document.body, { soort: 'personeel', naar: naar });
    }, 0);
    return false;
  }

  var STAND = {
    aanvraag: 'staat open', gegund: 'gegund', gepland: 'ingepland', geleverd: 'geleverd',
    gefactureerd: 'gefactureerd', betaald: 'voldaan', ingetrokken: 'ingetrokken'
  };
  /* De knoppen per stap. De server zegt WELKE stappen mogen; hier staat alleen
     hoe ze heten en wat ze vragen. */
  var KNOP = {
    offreren:   { tekst: 'Offerte uitbrengen', vraagt: ['prijs', 'opmerking'] },
    gunnen:     { tekst: 'Gunnen', vraagt: [] },
    intrekken:  { tekst: 'Intrekken', vraagt: [] },
    plannen:    { tekst: 'Inplannen', vraagt: ['ophaalMoment', 'retourMoment'] },
    leveren:    { tekst: 'Geleverd melden', vraagt: ['bewijs'] },
    factureren: { tekst: 'Factureren', vraagt: ['bedrag'] },
    betalen:    { tekst: 'Voldaan melden', vraagt: [] }
  };
  var LABEL = {
    prijs: 'Prijs in euro', opmerking: 'Opmerking (mag leeg)', ophaalMoment: 'Ophalen wanneer',
    retourMoment: 'Retour wanneer', bewijs: 'Wie nam het aan', bedrag: 'Bedrag in euro'
  };

  function regelTekst(r) { return esc(r.aantal + ' ' + r.eenheid + ' ' + r.wat); }

  function kaartHtml(h) {
    var uit = '<div class="item" style="display:block;">';
    uit += '<div><b>' + esc(h.titel) + '</b> <span class="stil">· ' + esc(h.ref) + ' · ' +
      esc(STAND[h.status] || h.status) + '</span></div>';
    uit += '<div class="stil">' + (h.rol === 'koper'
      ? 'aan ' + esc(h.genreLabel || h.genre)
      : 'van ' + esc(h.koper.naam)) + ' · ' + h.regels.map(regelTekst).join(', ') + '</div>';
    if (h.ophalen || h.retour)
      uit += '<div class="stil">' + esc([h.ophalen && ('ophalen: ' + h.ophalen), h.retour && ('retour: ' + h.retour)].filter(Boolean).join(' · ')) + '</div>';
    if (h.gegundAan)
      uit += '<div class="stil">gegund aan ' + esc(h.gegundAan.naam) + ' voor ' + euro(h.gegundAan.prijs) + '</div>';
    if (h.planning)
      uit += '<div class="stil">ingepland: ' + esc([h.planning.ophaalMoment, h.planning.retourMoment].filter(Boolean).join(' → ')) + '</div>';
    if (h.levering)
      uit += '<div class="stil">geleverd, aangenomen door ' + esc(h.levering.bewijs) + '</div>';
    if (h.factuur)
      uit += '<div class="stil">factuur ' + esc(h.factuur.nummer) + ': ' + euro(h.factuur.bedrag) +
        (h.betaaldAt ? ' -- voldaan' : '') + '</div>';

    // de offertes: de koper ziet ze allemaal, een leverancier alleen zijn eigen
    if (h.offertes && h.offertes.length) {
      uit += '<div style="margin-top:.4rem;">';
      h.offertes.forEach(function (o) {
        var gegund = h.gegundAan && h.gegundAan.offerteId === o.id;
        uit += '<div class="stil">' + esc(o.naam) + ': <b>' + euro(o.prijs) + '</b>' +
          (o.opmerking ? ' -- ' + esc(o.opmerking) : '') + (gegund ? ' ✓' : '') +
          (h.rol === 'koper' && h.mag.indexOf('gunnen') >= 0
            ? ' <button class="knop" type="button" data-gun="' + esc(h.id) + '" data-off="' + esc(o.id) + '">Gunnen</button>'
            : '') + '</div>';
      });
      uit += '</div>';
    }

    // de stappen die DEZE zaak nu mag zetten, precies zoals de server ze noemt
    var stappen = (h.mag || []).filter(function (m) { return m !== 'gunnen' && KNOP[m]; });
    if (stappen.length) {
      uit += '<div class="rij" style="margin-top:.5rem;">';
      stappen.forEach(function (m) {
        KNOP[m].vraagt.forEach(function (v) {
          uit += '<input class="veld" data-in="' + esc(h.id + ':' + v) + '" ' +
            (v === 'prijs' || v === 'bedrag' ? 'type="number" step="0.01" min="0" ' : 'maxlength="120" ') +
            'placeholder="' + esc(LABEL[v]) + '" aria-label="' + esc(LABEL[v]) + '" style="flex:0 1 11rem;">';
        });
        uit += '<button class="knop p" type="button" data-stap="' + esc(m) + '" data-id="' + esc(h.id) + '">' +
          esc(KNOP[m].tekst) + '</button>';
      });
      uit += '</div>';
    }
    return uit + '</div>';
  }

  function vulLijst(elId, leegId, lijst) {
    var el = document.getElementById(elId), leeg = document.getElementById(leegId);
    if (!el) return;
    el.innerHTML = lijst.map(kaartHtml).join('');
    if (leeg) leeg.style.display = lijst.length ? 'none' : '';
  }

  function teken() {
    if (!data) return;
    var g = document.getElementById('hGenre');
    if (g && !g.options.length) {
      // per sector een kopje: 72 losse regels is geen keuze, 26 kopjes wel
      var perSector = {};
      data.genres.forEach(function (x) {
        var k = x.industry || 'overig';
        (perSector[k] = perSector[k] || []).push(x);
      });
      g.innerHTML = Object.keys(perSector).sort(function (a, b) {
        return String((data.sectoren || {})[a] || a).localeCompare(String((data.sectoren || {})[b] || b));
      }).map(function (k) {
        return '<optgroup label="' + esc((data.sectoren || {})[k] || k) + '">' +
          perSector[k].map(function (x) {
            return '<option value="' + esc(x.id) + '">' + esc(x.label) + '</option>';
          }).join('') + '</optgroup>';
      }).join('');
    }
    var e = document.getElementById('hEenheid');
    if (e && !e.options.length)
      e.innerHTML = data.eenheden.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('');

    vulLijst('hOpen', 'hOpenLeeg', data.open);
    vulLijst('hKoper', 'hKoperLeeg', data.alsKoper);
    vulLijst('hLev', 'hLevLeeg', data.alsLeverancier);
    bindStappen();
  }

  function bindStappen() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-gun]'), function (b) {
      b.addEventListener('click', function () {
        api('/gunnen', { id: b.dataset.gun, offerteId: b.dataset.off })
          .then(function () { meld('Gegund.'); laden(); })
          .catch(function (err) { meld(err.message); });
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-stap]'), function (b) {
      b.addEventListener('click', function () {
        var stap = b.dataset.stap, id = b.dataset.id, body = { id: id };
        KNOP[stap].vraagt.forEach(function (v) {
          var inp = document.querySelector('[data-in="' + id + ':' + v + '"]');
          if (inp) body[v] = inp.value;
        });
        api('/' + stap, body)
          .then(function () { meld(KNOP[stap].tekst + ': gelukt.'); laden(); })
          .catch(function (err) { meld(err.message); });
      });
    });
  }

  function laden() {
    return api('/mijn').then(function (d) { data = d; teken(); })
      .catch(function (err) { meld(err.message); });
  }

  function start() {
    if (!poort()) return;
    laden();
    // het aanvraagformulier draait in handel-aanvraag.js op deze zelfde schil
    if (window.RTGHandel.formulier) window.RTGHandel.formulier();
  }

  /* De schil die het deelscript gebruikt. Eén api, één meldbalk, één laadronde:
     twee kopieen van dezelfde fetch-wrapper lopen gegarandeerd uiteen. */
  window.RTGHandel = { api: api, meld: meld, esc: esc, laden: laden, regelTekst: regelTekst };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
