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
  var GLYF_SOORT = { tekst: 'logboek', blad: 'grafiek', presentatie: 'podium', formulier: 'opties', schets: 'ontwerp' };
  var NAAM_SOORT = { tekst: 'Document', blad: 'Rekenblad', presentatie: 'Presentatie', formulier: 'Formulier', schets: 'Schets' };

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
  var blad = null, pres = null, presLoop = null, formulier = null, schets = null;

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

  /* ---------- openen ---------- */
  function openen(id) {
    api('open', { id: id }).then(function (r) {
      if (r.status !== 200) return zeg(r.body.error || 'Kon niet openen.');
      open = r.body; magBewerken = !!r.body.magBewerken; vuil = false;
      $('#titel').value = r.body.titel; $('#titel').disabled = !r.body.eigenaar;
      $('#staat').textContent = magBewerken ? (r.body.eigenaar ? '' : 'meeschrijven · van ' + r.body.door)
        : 'alleen lezen · van ' + r.body.door;
      $('#deelBtn').style.display = r.body.eigenaar ? '' : 'none';
      // Rahul leest tekst en dia's; op een formulier of schets heeft hij niets te zoeken
      $('#aiBtn').style.display = magBewerken && r.body.soort !== 'formulier' && r.body.soort !== 'schets' ? '' : 'none';
      $('#presBtn').style.display = r.body.soort === 'presentatie' ? '' : 'none';
      $('#formBalk').style.display = r.body.soort === 'blad' ? '' : 'none';
      $('#tekstTools').style.display = 'none'; $('#bladTools').style.display = 'none';
      $('#tekst').style.display = 'none'; $('#bladWrap').style.display = 'none'; $('#presWrap').style.display = 'none';
      $('#formWrap').style.display = 'none'; $('#schetsWrap').style.display = 'none';
      if (r.body.soort === 'blad') toonBlad(r.body.inhoud);
      else if (r.body.soort === 'presentatie') toonPres(r.body.inhoud);
      else if (r.body.soort === 'formulier') toonFormulier(r.body.inhoud);
      else if (r.body.soort === 'schets') toonSchets(r.body.inhoud);
      else toonTekst(r.body.inhoud);
      $('#lijst').style.display = 'none'; $('#editor').classList.add('aan');
      volgMee();
    });
  }
  function volgMee() {
    clearInterval(leesT);
    leesT = setInterval(function () {
      if (!open || vuil) return;
      api('open', { id: open.id }).then(function (v) {
        if (v.status !== 200 || v.body.gewijzigd === open.gewijzigd) return;
        // wie een formulier aan het invullen is raakt zijn half getypte
        // antwoorden niet kwijt aan een verversing; nieuwe vragen komen
        // vanzelf bij de volgende keer openen
        if (open.soort === 'formulier' && !magBewerken) return;
        open.gewijzigd = v.body.gewijzigd; open.inhoud = v.body.inhoud;
        if (document.activeElement && document.activeElement.id === 'tekst') return;
        if (open.soort === 'blad') blad.laad(v.body.inhoud, magBewerken);
        else if (open.soort === 'presentatie') pres.laad(v.body.inhoud, magBewerken);
        else if (open.soort === 'formulier') formulier.laad(v.body.inhoud, magBewerken, open.id);
        else if (open.soort === 'schets') schets.laad(v.body.inhoud, magBewerken);
        else $('#tekst').innerHTML = (v.body.inhoud && v.body.inhoud.tekst) || '';
        zeg('Bijgewerkt door ' + (v.body.door || 'een ander'));
      });
    }, 5000);
  }
  function sluitEditor() {
    clearInterval(leesT); $('#editor').classList.remove('aan'); $('#lijst').style.display = '';
    open = null; $('#voetbalk').textContent = ''; laadLijst();
  }
  $('#editTerug').addEventListener('click', function () { if (vuil) bewaarNu(); sluitEditor(); });

  /* ---------- tekstdocument ---------- */
  function toonTekst(inhoud) {
    $('#tekst').style.display = '';
    $('#tekst').innerHTML = (inhoud && inhoud.tekst) || '';
    $('#tekst').contentEditable = magBewerken ? 'true' : 'false';
    if (magBewerken) {
      $('#tekstTools').style.display = 'flex';
      RTGOfficeTekst.bouwBalk($('#tekstTools'), $('#tekst'), markeer);
    }
    telBij();
  }
  $('#tekst').addEventListener('input', function () { markeer(); telBij(); });
  function telBij() {
    if (!open || open.soort !== 'tekst') return;
    $('#voetbalk').textContent = RTGOfficeTekst.tel($('#tekst')).regel;
  }

  /* ---------- rekenblad ---------- */
  function toonBlad(inhoud) {
    $('#bladWrap').style.display = '';
    if (!blad) blad = RTGOfficeBlad.maak({ tabel: $('#blad'), refVak: $('#celRef'), invoer: $('#celInvoer'),
      voet: $('#voetbalk'), onWijzig: markeer });
    blad.laad(inhoud, magBewerken);
    if (magBewerken) { $('#bladTools').style.display = 'flex'; blad.bouwBalk($('#bladTools')); }
  }

  /* ---------- formulier en schets ---------- */
  function toonFormulier(inhoud) {
    $('#formWrap').style.display = '';
    if (!formulier) formulier = RTGOfficeFormulier.maak({ wrap: $('#formWrap'), api: api, onWijzig: markeer, meld: zeg });
    formulier.laad(inhoud, magBewerken, open.id);
    var n = ((inhoud && inhoud.vragen) || []).length;
    $('#voetbalk').textContent = n + (n === 1 ? ' vraag' : ' vragen');
  }
  function toonSchets(inhoud) {
    $('#schetsWrap').style.display = '';
    if (!schets) schets = RTGOfficeSchets.maak({ wrap: $('#schetsWrap'), onWijzig: markeer, meld: zeg, voet: $('#voetbalk') });
    schets.laad(inhoud, magBewerken);
  }

  /* ---------- presentatie ---------- */
  function toonPres(inhoud) {
    $('#presWrap').style.display = 'grid';
    if (!pres) pres = RTGOfficePres.maak({ rail: $('#diaRail'), vlak: $('#diaVlak'), onWijzig: markeer, meld: zeg });
    pres.laad(inhoud, magBewerken);
    $('#voetbalk').textContent = pres.dias().length + ' dia\'s';
  }
  $('#presBtn').addEventListener('click', function () {
    if (!pres) return;
    presLoop = RTGOfficePres.presenteer({ doos: $('#toonDia'), titel: $('#tdTitel'), tekst: $('#tdTekst'),
      notitie: $('#tdNotitie'), teller: $('#tdTeller'), dias: pres.dias() });
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  });
  $('#tdVorige').addEventListener('click', function () { presLoop && presLoop.stap(-1); });
  $('#tdVolgende').addEventListener('click', function () { presLoop && presLoop.stap(1); });
  $('#tdNotitieBtn').addEventListener('click', function () { presLoop && presLoop.notitie(); });
  $('#tdDicht').addEventListener('click', function () {
    $('#toonDia').className = ''; presLoop = null;
    if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
  });
  document.addEventListener('keydown', function (e) {
    if (!$('#toonDia').classList.contains('aan') || !presLoop) return;
    if (e.key === 'ArrowRight' || e.key === ' ') presLoop.stap(1);
    else if (e.key === 'ArrowLeft') presLoop.stap(-1);
    else if (e.key === 'n' || e.key === 'N') presLoop.notitie();
    else if (e.key === 'Escape') $('#tdDicht').click();
  });

  /* ---------- autosave ---------- */
  function markeer() {
    vuil = true; $('#staat').textContent = 'Opslaan…';
    clearTimeout(bewaarT); bewaarT = setTimeout(bewaarNu, 900);
  }
  function inhoudNu() {
    return open.soort === 'blad' ? blad.inhoud()
      : open.soort === 'presentatie' ? pres.inhoud()
      : open.soort === 'formulier' ? formulier.inhoud()
      : open.soort === 'schets' ? schets.inhoud()
      : { tekst: $('#tekst').innerHTML.slice(0, 500000) };
  }
  function bewaarNu() {
    if (!open || !magBewerken || !vuil) return Promise.resolve();
    // Het document vastpakken vóór de rondreis: wie tijdens het bewaren
    // teruggaat naar de lijst (open wordt dan null) of een ander document
    // opent, mag niet door het late antwoord worden ingehaald.
    var doc = open, inhoud = inhoudNu();
    return api('bewaar', { id: doc.id, titel: $('#titel').value, inhoud: inhoud }).then(function (r) {
      if (r.body.error) { $('#staat').textContent = ''; return zeg(r.body.error); }
      doc.gewijzigd = r.body.gewijzigd; doc.inhoud = inhoud;
      if (open === doc) {
        vuil = false;
        $('#staat').textContent = 'Bewaard ' + new Date().toLocaleTimeString('nl-NL').slice(0, 5);
      }
    });
  }
  $('#titel').addEventListener('input', markeer);
  setInterval(function () { if (vuil) bewaarNu(); }, 8000);
  window.addEventListener('beforeunload', function () { if (vuil) bewaarNu(); });

  /* ---------- delen ---------- */
  $('#deelBtn').addEventListener('click', function () { if (!open) return; toonDeel(); $('#deelScrim').classList.add('open'); });
  $('#deelDicht').addEventListener('click', function () { $('#deelScrim').classList.remove('open'); });
  if (WERK === 'rtf') {
    $('#deelForm').style.display = 'none'; $('#gezinBlok').style.display = '';
    $('#deelKop').textContent = 'Delen met je gezin';
    $('#deelUitleg').textContent = 'Een document blijft van jou; je kunt je gezin laten meelezen of er samen in schrijven. Buiten het gezin deelt RTF niets.';
  }
  function toonDeel() {
    api('open', { id: open.id }).then(function (r) {
      if (WERK === 'rtf') {
        var s = (r.body && r.body.kringDeel) || 'uit';
        $('#gezinRechten').value = s || 'uit';
        $('#deelLijst').textContent = s === 'bewerken' ? 'Jullie schrijven hier samen in.'
          : s === 'lezen' ? 'Je gezin leest mee.' : 'Alleen jij ziet dit document.';
        return;
      }
      var lees = (r.body && r.body.gedeeldMet) || [], schrijf = (r.body && r.body.bewerkers) || [];
      $('#deelLijst').innerHTML = (lees.length || schrijf.length)
        ? (schrijf.length ? 'Meeschrijvers: ' + schrijf.map(esc).join(', ') + '<br>' : '') +
          (lees.length ? 'Meelezers: ' + lees.map(esc).join(', ') : '')
        : 'Nog met niemand gedeeld.';
    });
  }
  $('#gezinZet').addEventListener('click', function () {
    api('gezin', { id: open.id, rechten: $('#gezinRechten').value }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      zeg('Bewaard.'); toonDeel();
    });
  });
  $('#deelForm').addEventListener('submit', function (e) {
    e.preventDefault();
    api('deel', { id: open.id, codenaam: $('#deelCode').value, aan: true, rechten: $('#deelRechten').value })
      .then(function (r) {
        if (r.body.error) return zeg(r.body.error);
        $('#deelCode').value = ''; zeg('Gedeeld.'); toonDeel();
      });
  });

  /* ---------- versiegeschiedenis ---------- */
  $('#versiesBtn').addEventListener('click', function () {
    if (!open) return;
    api('versies', { id: open.id }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      $('#versieLijst').innerHTML = (r.body.versies || []).length ? r.body.versies.map(function (v) {
        return '<div class="vitem"><span class="rek">' + new Date(v.om).toLocaleString('nl-NL') + ' · ' + esc(v.door || '') + '</span>' +
          (open.eigenaar ? '<button class="knop" data-terug="' + v.nr + '">Zet terug</button>' : '') + '</div>';
      }).join('') : '<p class="stil">Nog geen eerdere versies.</p>';
      $('#versieScrim').classList.add('open');
      Array.prototype.forEach.call($('#versieLijst').querySelectorAll('[data-terug]'), function (b) {
        b.addEventListener('click', function () {
          api('terug', { id: open.id, nr: b.dataset.terug }).then(function (t) {
            if (t.body.error) return zeg(t.body.error);
            open.gewijzigd = t.body.gewijzigd; open.inhoud = t.body.inhoud; vuil = false;
            if (open.soort === 'blad') blad.laad(t.body.inhoud, magBewerken);
            else if (open.soort === 'presentatie') pres.laad(t.body.inhoud, magBewerken);
            else if (open.soort === 'formulier') formulier.laad(t.body.inhoud, magBewerken, open.id);
            else if (open.soort === 'schets') schets.laad(t.body.inhoud, magBewerken);
            else { $('#tekst').innerHTML = (t.body.inhoud && t.body.inhoud.tekst) || ''; telBij(); }
            $('#versieScrim').classList.remove('open'); zeg('Versie teruggezet.');
          });
        });
      });
    });
  });
  $('#versieDicht').addEventListener('click', function () { $('#versieScrim').classList.remove('open'); });

  /* ---------- Rahul leest mee ---------- */
  $('#aiBtn').addEventListener('click', function () {
    if (!open) return;
    $('#aiUit').value = ''; $('#aiToepas').style.display = 'none';
    // in een rekenblad is de formule de enige zinnige opdracht
    $('#aiOpdracht').value = open.soort === 'blad' ? 'formule' : 'samenvatten';
    $('#aiScrim').classList.add('open');
  });
  $('#aiDicht').addEventListener('click', function () { $('#aiScrim').classList.remove('open'); });
  $('#aiVraagBtn').addEventListener('click', function () {
    Promise.resolve(vuil ? bewaarNu() : null).then(function () {
      $('#aiUit').value = 'Rahul leest…';
      return api('ai', { id: open.id, opdracht: $('#aiOpdracht').value, vraag: $('#aiVraag').value });
    }).then(function (r) {
      if (r.body.error) { $('#aiUit').value = ''; return zeg(r.body.error); }
      $('#aiUit').value = r.body.voorstel + (r.body.demo ? '\n\n(demostand: zet een AI-sleutel voor echte voorstellen)' : '');
      $('#aiToepas').style.display = '';
    });
  });
  $('#aiToepas').addEventListener('click', function () {
    var stuk = $('#aiUit').value.split('\n\n(demostand')[0];
    if (open.soort === 'presentatie') pres.erbij({ indeling: 'punten', titel: 'Voorstel van Rahul', tekst: stuk });
    else if (open.soort === 'blad') blad.zetFormule(stuk.trim().split('\n')[0]);
    else $('#tekst').innerHTML += '<p>' + esc(stuk).replace(/\n/g, '<br>') + '</p>';
    markeer(); telBij(); $('#aiScrim').classList.remove('open');
    zeg('Toegevoegd; u kunt het gewoon bewerken.');
  });

  /* ---------- export ---------- */
  function laadNeer(data, naam, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: type + ';charset=utf-8' }));
    a.download = naam; a.click(); URL.revokeObjectURL(a.href);
    zeg('Geëxporteerd: ' + naam);
  }
  $('#exportBtn').addEventListener('click', function () {
    if (!open) return;
    var data, naam, type, titel = $('#titel').value || 'document';
    if (open.soort === 'blad') { data = blad.naarCsv(); naam = titel + '.csv'; type = 'text/csv'; }
    else if (open.soort === 'presentatie') { data = pres.naarTekst(); naam = titel + '.txt'; type = 'text/plain'; }
    else if (open.soort === 'schets') { data = schets.naarSvg(); naam = titel + '.svg'; type = 'image/svg+xml'; }
    else if (open.soort === 'formulier') {
      // de beheerder krijgt de uitslag als CSV; wie alleen invult niets
      if (!magBewerken) return zeg('De uitslag is voor wie het formulier beheert.');
      return formulier.uitslagCsv().then(function (csv) {
        if (csv == null) return zeg('Kon de uitslag niet ophalen.');
        laadNeer(csv, titel + '.csv', 'text/csv');
      });
    }
    else {
      data = '<!doctype html><meta charset="utf-8"><title>' + esc(titel) + '</title>' +
        '<body style="font-family:Georgia,serif;max-width:42em;margin:3em auto;line-height:1.7;color:#1a1a19;">' +
        $('#tekst').innerHTML;
      naam = titel + '.html'; type = 'text/html';
    }
    laadNeer(data, naam, type);
  });

  if (!token) zeg(opzet.leeg); else laadLijst();
})();
