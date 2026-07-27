/* RTG Office, de app zelf: de drive en de schil om de drie editors heen.

   Vijf ingangen op hetzelfde pakket: het lid (eigen account), de zaak
   (?werk=zaak, de team-drive), de RTG-kantoren (?werk=kantoor), RTF-leden
   (?werk=rtf, per gezinsprofiel) en de werkplek (?werk=werkplek&bedrijf=rtg|rtf,
   de kantoordrive van dat huis). Alleen de sleutel verschilt; alles daarachter
   is voor alle vijf hetzelfde.

   De drie editors wonen in ./tekst.js, ./blad.js en ./pres.js; dit bestand
   houdt de drive bij, opent en bewaart, en regelt delen, versies, Rahul en
   export. */
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
  var GLYF_SOORT = { tekst: 'logboek', blad: 'grafiek', presentatie: 'podium', formulier: 'opties', schets: 'ontwerp', bord: 'agenda' };
  var NAAM_SOORT = { tekst: 'Document', blad: 'Rekenblad', presentatie: 'Presentatie', formulier: 'Formulier', schets: 'Schets', bord: 'Bord' };

  var PAR = new URLSearchParams(location.search);
  var WERK = PAR.get('werk') || '';
  var BEDRIJF = (PAR.get('bedrijf') || '').toLowerCase();
  var opzet = WERK === 'werkplek'
    /* Twee sleutels, in deze volgorde: de werkplek gaat open op een
       kantoorsessie OF op het eigen RTG-account (zo komt een RTF-medewerker
       zonder kantoorsessie ook binnen; zie routes/werkplek.js). Hier stond een
       sleutel die nergens gezet wordt, en dan bleef de drive van dit huis leeg
       zonder dat er iets misging in beeld. */
    ? { basis: '/api/werkplek/kantoorpakket/', tokenKey: ['rtg_office_token', 'rtg_member_token'],
        chip: BEDRIJF === 'rtf' ? 'RTFoundation-kantoor' : 'RTG-kantoor',
        terug: '/apps/werkplek.html', mijnKop: 'Documenten van dit huis',
        leeg: 'Log eerst in en kies een werkplek.' }
    : WERK === 'zaak'
    ? { basis: '/api/supplier/kantoorpakket/', tokenKey: 'rtg_sup_token', chip: 'Team-drive van de zaak',
        terug: '/apps/leverancier.html', mijnKop: 'Documenten van de zaak', leeg: 'Log eerst in op de zaak-app.' }
    : WERK === 'kantoor'
    ? { basis: '/api/office/kantoorpakket/', tokenKey: 'rtg_office_token', chip: 'RTG Kantoor-drive',
        terug: '/apps/kantoren.html', mijnKop: 'Documenten van het kantoor', leeg: 'Log eerst in op de backoffice.' }
    : WERK === 'rtf'
    ? { basis: '/api/rtf/kantoorpakket/', tokenKey: 'rtf_sessie', chip: 'RTFoundation',
        terug: '/apps/foundation/index.html', mijnKop: 'Mijn documenten', leeg: 'Log eerst in bij je gezin.' }
    : { basis: '/api/kantoorpakket/', tokenKey: 'rtg_member_token', chip: '',
        terug: '/apps/app.html', mijnKop: 'Mijn documenten', leeg: 'Log eerst in op de leden-app.' };

  var rtfSess = (function () { if (WERK !== 'rtf') return null;
    try { return JSON.parse(localStorage.getItem('rtf_sessie') || 'null'); } catch (e) { return null; } })();
  var token = WERK === 'rtf' ? (rtfSess && rtfSess.token)
    : (function () {
        var namen = [].concat(opzet.tokenKey);
        for (var i = 0; i < namen.length; i++) {
          try { var t = localStorage.getItem(namen[i]); if (t) return t; } catch (e) { return null; }
        }
        return null;
      })();

  $('#terug').href = opzet.terug;
  $('#kopMijn').textContent = opzet.mijnKop;
  if (opzet.chip) { $('#werkChip').textContent = opzet.chip; $('#werkChip').style.display = ''; }
  Array.prototype.forEach.call(document.querySelectorAll('[data-glyf]'), function (el) {
    el.innerHTML = glyf(el.dataset.glyf);
  });

  var api = function (pad, body) {
    return fetch(opzet.basis + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' },
        WERK === 'rtf' ? {} : { Authorization: 'Bearer ' + token }),
      body: JSON.stringify(Object.assign(
        WERK === 'rtf' ? { code: rtfSess && rtfSess.code, token: rtfSess && rtfSess.token } : {},
        WERK === 'werkplek' ? { bedrijf: BEDRIJF } : {},
        body || {}))
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; });
    });
  };
  var meldT; var zeg = function (t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zien');
    clearTimeout(meldT); meldT = setTimeout(function () { m.classList.remove('zien'); }, 3000);
  };

  var open = null, magBewerken = false, bewaarT = null, vuil = false, leesT = null, stand = null;
  var blad = null, pres = null, presLoop = null, formulier = null, schets = null, bord = null;

  /* ---------- de drive ---------- */
  function laadLijst() {
    return api('mijn').then(function (r) {
      if (r.status !== 200) { zeg(r.body.error || opzet.leeg); return; }
      stand = r.body;
      tekenSjablonen(r.body.sjablonen || []);
      tekenLijst();
    });
  }
  function tekenSjablonen(lijst) {
    var groepen = {};
    lijst.forEach(function (s) { (groepen[s.groep || 'Algemeen'] = groepen[s.groep || 'Algemeen'] || []).push(s); });
    $('#sjablonen').innerHTML = Object.keys(groepen).sort().map(function (g) {
      return '<div class="sec" style="margin-top:.8rem;">' + esc(g) + '</div>' +
        groepen[g].map(function (s) {
          return '<button class="sjab" type="button" data-sjab="' + esc(s.id) + '">' + esc(s.titel) + '</button>';
        }).join('');
    }).join('');
    Array.prototype.forEach.call($('#sjablonen').querySelectorAll('[data-sjab]'), function (b) {
      b.addEventListener('click', function () { nieuw(null, b.dataset.sjab); });
    });
  }
  function tekenLijst() {
    if (!stand) return;
    var zoek = $('#zoek').value.trim().toLowerCase();
    var soort = $('#filterSoort').value;
    var op = $('#sorteer').value;
    var zeef = function (rij) {
      return rij.filter(function (d) {
        return (!soort || d.soort === soort) && (!zoek || String(d.titel).toLowerCase().indexOf(zoek) >= 0);
      }).sort(function (a, b) {
        // gemarkeerde documenten staan altijd bovenaan; daarna de gekozen orde
        if (!!a.ster !== !!b.ster) return a.ster ? -1 : 1;
        if (op === 'titel') return String(a.titel).localeCompare(String(b.titel), 'nl');
        if (op === 'soort') return String(a.soort).localeCompare(String(b.soort)) ||
          String(a.titel).localeCompare(String(b.titel), 'nl');
        if (op === 'gemaakt') return String(b.gemaakt).localeCompare(String(a.gemaakt));
        return String(b.gewijzigd).localeCompare(String(a.gewijzigd));
      });
    };
    $('#mijnDocs').innerHTML = teken(zeef(stand.docs || []), true, zoek);
    $('#gedeeldDocs').innerHTML = teken(zeef(stand.gedeeld || []), false, zoek);
    Array.prototype.forEach.call(document.querySelectorAll('[data-open]'), function (b) {
      b.addEventListener('click', function () { openen(b.dataset.open); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-ster]'), function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        api('ster', { id: b.dataset.ster, aan: b.dataset.aan !== '1' }).then(function () { laadLijst(); });
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-weg]'), function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!confirm('Dit document verwijderen?')) return;
        api('weg', { id: b.dataset.weg }).then(function (w) {
          if (w.body.error) return zeg(w.body.error);
          zeg('Verwijderd.'); laadLijst();
        });
      });
    });
  }
  function teken(rij, eigen, zoek) {
    if (!rij.length) return '<p class="stil">' + (zoek ? 'Niets gevonden.' : 'Nog niets hier.') + '</p>';
    return rij.map(function (d) {
      return '<div class="doc" data-open="' + d.id + '" role="button" tabindex="0">' +
        '<span class="ic">' + glyf(GLYF_SOORT[d.soort] || 'logboek') + '</span>' +
        '<span class="naam"><b>' + esc(d.titel) + '</b>' +
          '<small>' + esc(NAAM_SOORT[d.soort] || 'Document') +
          (d.gedeeld ? ' · gedeeld met ' + d.gedeeld : '') +
          (d.versies ? ' · ' + d.versies + ' versies' : '') + '</small></span>' +
        '<span class="kol">' + esc(d.omvang || '') + '</span>' +
        '<span class="kol van">' + (eigen ? datum(d.gewijzigd) : esc(d.door)) + '</span>' +
        '<span class="acties">' + (eigen
          ? '<button class="mini ster' + (d.ster ? ' aan' : '') + '" data-ster="' + d.id + '" data-aan="' + (d.ster ? '1' : '0') +
            '" title="Markeren" aria-label="Markeren">' + (d.ster ? '★' : '☆') + '</button>' +
            '<button class="mini weg" data-weg="' + d.id + '">weg</button>'
          : '') + '</span></div>';
    }).join('');
  }
  function datum(s) {
    try {
      var d = new Date(s), nu = new Date();
      var zelfde = d.toDateString() === nu.toDateString();
      return zelfde ? 'vandaag ' + d.toLocaleTimeString('nl-NL').slice(0, 5) : d.toLocaleDateString('nl-NL');
    } catch (e) { return ''; }
  }
  ['#zoek', '#filterSoort', '#sorteer'].forEach(function (s) {
    $(s).addEventListener('input', tekenLijst); $(s).addEventListener('change', tekenLijst);
  });

  function nieuw(soort, sjabloon) {
    api('maak', sjabloon ? { sjabloon: sjabloon } : { soort: soort }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      openen(r.body.id);
    });
  }
  $('#nieuwTekst').addEventListener('click', function () { nieuw('tekst'); });
  $('#nieuwBlad').addEventListener('click', function () { nieuw('blad'); });
  $('#nieuwPres').addEventListener('click', function () { nieuw('presentatie'); });
  $('#nieuwFormulier').addEventListener('click', function () { nieuw('formulier'); });
  $('#nieuwSchets').addEventListener('click', function () { nieuw('schets'); });
  $('#nieuwBord').addEventListener('click', function () { nieuw('bord'); });

