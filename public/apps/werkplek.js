/* De werkplek: eerst kiezen tussen de twee huizen (RTG en RTF), daarna het
   gekozen huis van binnen. Alles komt van /api/werkplek; de server bepaalt
   welke huizen deze bezoeker mag zien, dus wat hier niet binnenkomt bestaat
   voor hem ook niet. Geen inline handlers: alles via addEventListener. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var glyf = function (naam) {
    return (window.RTGGlyf && RTGGlyf.svgHTML) ? RTGGlyf.svgHTML(String(naam || ''), {}) : '';
  };

  /* Welke sleutel hier hoort: de server (routes/werkplek.js) laat je binnen op
     een KANTOORsessie of op je eigen RTG-account -- juist omdat een medewerker
     van RTF vaak geen kantoorsessie heeft. Hier stond 'rtg_token', en die naam
     zet niemand in het hele systeem; dat viel niet op omdat er een tweede
     poging achter stond. Wie geen kantoorsessie had, kwam er dus nooit in. */
  var token = null;
  try { token = localStorage.getItem('rtg_office_token') || localStorage.getItem('rtg_member_token'); } catch (e) {}

  function api(pad, body) {
    return fetch('/api/werkplek/' + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || 'Er ging iets mis.');
        return d;
      });
    });
  }

  var HUIDIG = null;

  /* ---- de kiezer ---- */
  function toonKiezer() {
    $('#huis').hidden = true;
    $('#kiezer').hidden = false;
    api('mijn', {}).then(function (d) {
      var lijst = d.bedrijven || [];
      if (!lijst.length) {
        $('#kiezer').innerHTML = '<p class="melding">U hebt nog geen werkplek. Vraag de eigenaar om toegang tot RTG of de RTFoundation.</p>';
        return;
      }
      $('#kiezer').innerHTML = '<div class="huizen">' + lijst.map(function (b) {
        return '<button class="huis" type="button" data-code="' + esc(b.code) + '">' +
          '<div class="kop">' + glyf(b.icoon) + '<h2>' + esc(b.naam) + '</h2></div>' +
          '<div class="aard">' + esc(b.aard) + '</div>' +
          '<div class="voet">' +
            '<span><b>' + (b.kopcijfer ? esc(b.kopcijfer[1]) : '0') + '</b> ' + (b.kopcijfer ? esc(b.kopcijfer[0]).toLowerCase() : '') + '</span>' +
            '<span><b>' + b.mensen + '</b> in dienst</span>' +
            '<span><b>' + b.takenOpen + '</b> taken open</span>' +
          '</div></button>';
      }).join('') + '</div>';
      Array.prototype.forEach.call(document.querySelectorAll('.huis'), function (el) {
        el.addEventListener('click', function () { openHuis(el.dataset.code); });
      });
    }).catch(function (e) {
      $('#kiezer').innerHTML = '<p class="melding">' + esc(e.message) + '</p>';
    });
  }

  /* ---- een huis van binnen ---- */
  function openHuis(code) {
    api('overzicht', { bedrijf: code }).then(function (d) {
      HUIDIG = code;
      HUISNAAM = d.naam || code;
      $('#kiezer').hidden = true;
      $('#huis').hidden = false;
      $('#huis').innerHTML =
        '<div class="balk">' +
          '<div class="wie">' + glyf(d.icoon) + '<h2>' + esc(d.naam) + '</h2></div>' +
          '<div><button class="knop" type="button" id="anderHuis">Ander huis</button> ' +
          '<a class="knop" href="' + esc(d.kantoor) + '">Naar het kantoor</a> ' +
          '<a class="knop" href="/apps/office.html?werk=werkplek&amp;bedrijf=' + esc(d.code) + '">Documenten</a></div>' +
        '</div>' +
        '<div class="vak"><h3>Cijfers</h3><div class="cijfers">' +
          d.cijfers.map(function (c) {
            return '<div class="stat"><b>' + esc(c.waarde) + '</b><i>' + esc(c.label) + '</i></div>';
          }).join('') + '</div></div>' +
        '<div class="vak"><h3>Wat loopt er</h3><div class="loopt">' +
          d.loopt.map(function (l) {
            return '<div class="r"><span>' + esc(l.titel) + '</span><b>' + esc(l.aantal) + '</b></div>';
          }).join('') + '</div></div>' +
        '<div class="vak"><h3>Wie werkt hier</h3><div class="mensen" id="mensen"></div>' +
          '<div class="rij">' +
            '<input class="veld" id="mCodenaam" placeholder="Codenaam" maxlength="60" aria-label="Codenaam">' +
            '<input class="veld" id="mFunctie" placeholder="Functie" maxlength="60" aria-label="Functie">' +
            '<button class="knop" type="button" id="mErbij">Erbij</button>' +
          '</div>' +
          '<p class="leeg" style="margin-top:.6rem;">De bezetting draait op codenamen; de echte naam blijft in de kluis.</p>' +
        '</div>' +
        '<div class="vak"><h3>Taken van dit huis</h3><div id="taken"></div>' +
          '<div class="rij">' +
            '<input class="veld" id="tTekst" placeholder="Wat moet er gebeuren?" maxlength="200" aria-label="Nieuwe taak">' +
            '<button class="knop" type="button" id="tMaak">Toevoegen</button>' +
          '</div>' +
        '</div>' +
        '<div class="vak"><h3>De ontwerptak</h3>' +
          '<p class="leeg" style="margin-bottom:.9rem;">Zes bureaus, elk met het werk van dit huis. Wat hier gemaakt wordt, staat niet in het andere huis.</p>' +
          '<div id="bureaus"></div>' +
        '</div>';
      if (window.RTGWerkplekBureaus) RTGWerkplekBureaus.tegels($('#bureaus'), code);
      toonMensen(d.mensen);
      toonTaken(d.taken);
      $('#anderHuis').addEventListener('click', toonKiezer);
      $('#mErbij').addEventListener('click', function () {
        var c = $('#mCodenaam').value.trim();
        if (!c) return;
        api('mens', { bedrijf: HUIDIG, codenaam: c, functie: $('#mFunctie').value.trim() }).then(function (r) {
          $('#mCodenaam').value = ''; $('#mFunctie').value = '';
          toonMensen(r.mensen);
        }).catch(function (e) { alert(e.message); });
      });
      $('#tMaak').addEventListener('click', function () {
        var t = $('#tTekst').value.trim();
        if (!t) return;
        api('taak', { bedrijf: HUIDIG, tekst: t }).then(function (r) {
          $('#tTekst').value = '';
          toonTaken(r.taken);
        }).catch(function (e) { alert(e.message); });
      });
    }).catch(function (e) {
      $('#huis').hidden = true; $('#kiezer').hidden = false;
      $('#kiezer').innerHTML = '<p class="melding">' + esc(e.message) + '</p>';
    });
  }

  function toonMensen(mensen) {
    mensen = mensen || [];
    $('#mensen').innerHTML = mensen.length ? mensen.map(function (m) {
      return '<div class="mens"><span>' + esc(m.codenaam) + ' <span class="fn">' + esc(m.functie) + '</span></span>' +
        '<button class="knop" type="button" data-weg="' + esc(m.id) + '">Weg</button></div>';
    }).join('') : '<div class="leeg">Nog niemand toegevoegd.</div>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-weg]'), function (b) {
      b.addEventListener('click', function () {
        api('mens-weg', { bedrijf: HUIDIG, id: b.dataset.weg }).then(function (r) { toonMensen(r.mensen); });
      });
    });
  }

  /* Meenemen (shared/uitvoer.js): de takenlijst van het huis waar u binnen bent
     -- de tekst, of hij af is, en van wanneer hij is. TAKEN wordt bijgehouden in
     toonTaken(), dus wat u meeneemt is wat er op het scherm staat. De bezetting
     blijft erbuiten: dat zijn de codenamen van anderen. */
  var TAKEN = [], HUISNAAM = '';
  if (window.RTGUitvoer) RTGUitvoer.bron(function () {
    if (!TAKEN.length) return null;
    return {
      naam: 'taken-' + (HUISNAAM || 'werkplek').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      kolommen: ['datum', 'taak', 'status'],
      rijen: TAKEN.map(function (t) {
        return [String(t.at || '').slice(0, 10), t.tekst, t.af ? 'af' : 'open'];
      })
    };
  });

  function toonTaken(taken) {
    taken = taken || [];
    TAKEN = taken;
    $('#taken').innerHTML = taken.length ? taken.map(function (t) {
      return '<label class="taak' + (t.af ? ' af' : '') + '"><input type="checkbox" data-taak="' + esc(t.id) + '"' +
        (t.af ? ' checked' : '') + '><span>' + esc(t.tekst) + '</span></label>';
    }).join('') : '<div class="leeg">Nog geen taken.</div>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-taak]'), function (c) {
      c.addEventListener('change', function () {
        api('taak-zet', { bedrijf: HUIDIG, taakId: c.dataset.taak, af: c.checked }).then(function (r) { toonTaken(r.taken); });
      });
    });
  }

  toonKiezer();
})();
