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
    ? { basis: '/api/supplier/kantoorpakket/', tokenKey: ['rtg_sup_token', 'rtg_pda_token'], chip: 'Team-drive van de zaak',
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

