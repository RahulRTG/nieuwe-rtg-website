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
  var FASE_NAAM = { concept: 'Concept', beoordeling: 'Ter beoordeling', goedgekeurd: 'Goedgekeurd', archief: 'Archief' };
  var AUDIT_NAAM = { aangemaakt: 'Aangemaakt', bewerkt: 'Bewerkt', 'beoordeling-gevraagd': 'Beoordeling gevraagd',
    goedgekeurd: 'Goedgekeurd', gearchiveerd: 'Gearchiveerd', 'concept-heropend': 'Heropend als concept',
    'status-teruggezet': 'Terug naar concept na wijziging', 'versie-teruggezet': 'Eerdere versie teruggezet',
    gedeeld: 'Gedeeld', 'deling-ingetrokken': 'Deling ingetrokken',
    'opmerking-toegevoegd': 'Opmerking toegevoegd', 'opmerking-opgelost': 'Actie opgelost',
    'opmerking-heropend': 'Actie heropend', 'opmerking-verwijderd': 'Opmerking verwijderd',
    'documentbeheer-gewijzigd': 'Documentbeleid gewijzigd' };

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
  var tabs = [], conflict = null, openVolgorde = 0;
  var blad = null, pres = null, presLoop = null, formulier = null, schets = null, bord = null;

  /* ---------- de drive ---------- */
  function laadLijst() {
    return api('mijn').then(function (r) {
      if (r.status !== 200) { zeg(r.body.error || opzet.leeg); return; }
      stand = r.body;
      tekenSjablonen(r.body.sjablonen || []);
      tekenOverzicht();
      tekenLijst();
    });
  }
  /* Meenemen: de drive kent zijn eigen model, dus geeft hij dat door in plaats
     van de gedeelde laag de documentregels te laten lezen -- daar staat
     "Rekenblad · 3 versies" als een stuk tekst, hier staan de velden. Eigen en
     gedeelde documenten samen, met de kolom "van" erbij. */
  if (window.RTGUitvoer) RTGUitvoer.bron(function () {
    if (!stand) return null;
    var dag = function (s) { var m = /^\d{4}-\d{2}-\d{2}/.exec(String(s || '')); return m ? m[0] : ''; };
    var rij = function (d, eigen) {
      return [d.titel || '', NAAM_SOORT[d.soort] || 'Document', dag(d.gemaakt), dag(d.gewijzigd),
        d.omvang || '', d.versies || 0, eigen ? 'van mij' : (d.door || 'gedeeld')];
    };
    return { naam: 'documenten',
      kolommen: ['titel', 'soort', 'gemaakt', 'gewijzigd', 'omvang', 'versies', 'van'],
      rijen: (stand.docs || []).map(function (d) { return rij(d, true); })
        .concat((stand.gedeeld || []).map(function (d) { return rij(d, false); })) };
  });
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
    var fase = $('#filterFase').value;
    var op = $('#sorteer').value;
    var zeef = function (rij) {
      return rij.filter(function (d) {
        var vindbaar = String(d.titel || '') + ' ' + (d.tags || []).join(' ');
        return (!soort || d.soort === soort) && (!fase || (d.fase || 'concept') === fase) &&
          (!zoek || vindbaar.toLowerCase().indexOf(zoek) >= 0);
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
      b.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openen(b.dataset.open); }
      });
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
  function tekenOverzicht() {
    if (!stand) return;
    var alles = (stand.docs || []).concat(stand.gedeeld || []);
    var actief = alles.filter(function (d) { return (d.fase || 'concept') !== 'archief'; }).length;
    var beoordeling = alles.filter(function (d) { return (d.fase || 'concept') === 'beoordeling'; }).length;
    var gedeeld = (stand.gedeeld || []).length + (stand.docs || []).filter(function (d) { return Number(d.gedeeld) > 0; }).length;
    var acties = alles.reduce(function (n, d) { return n + Number(d.openActies || 0); }, 0);
    var vandaag = new Date().toISOString().slice(0, 10);
    var verlopen = alles.filter(function (d) { return d.herzienOp && d.herzienOp < vandaag; }).length;
    $('#officeActief').textContent = actief;
    $('#officeBeoordeling').textContent = beoordeling;
    $('#officeGedeeld').textContent = gedeeld;
    $('#officeActies').textContent = acties;
    $('#officeSamenvatting').textContent = verlopen
      ? verlopen + (verlopen === 1 ? ' document vraagt' : ' documenten vragen') + ' vandaag om herziening.'
      : beoordeling
      ? beoordeling + (beoordeling === 1 ? ' stuk wacht' : ' stukken wachten') + ' op een menselijke beslissing. De rest kan door.'
      : acties ? acties + (acties === 1 ? ' open actie staat' : ' open acties staan') + ' klaar voor opvolging.'
      : actief ? actief + (actief === 1 ? ' actief document' : ' actieve documenten') + '; niets wacht op goedkeuring.'
      : 'Uw rustige werkruimte staat klaar voor het eerste document.';
  }
  function teken(rij, eigen, zoek) {
    if (!rij.length) return '<p class="stil">' + (zoek ? 'Niets gevonden.' : 'Nog niets hier.') + '</p>';
    return rij.map(function (d) {
      return '<div class="doc" data-open="' + d.id + '" role="button" tabindex="0">' +
        '<span class="ic">' + glyf(GLYF_SOORT[d.soort] || 'logboek') + '</span>' +
        '<span class="naam"><b>' + esc(d.titel) + '<span class="office-docmeta">' +
          ((d.classificatie && d.classificatie !== 'intern') ? '<i data-klasse="' + esc(d.classificatie) + '">' + esc(d.classificatie) + '</i>' : '') +
          (d.openActies ? '<i data-actie-open="1">' + d.openActies + ' actie' + (d.openActies === 1 ? '' : 's') + '</i>' : '') +
          '</span></b>' +
          '<small>' + esc(NAAM_SOORT[d.soort] || 'Document') +
          (d.gedeeld ? ' · gedeeld met ' + d.gedeeld : '') +
          (d.versies ? ' · ' + d.versies + ' versies' : '') +
          (d.laatstDoor && d.laatstDoor !== d.door ? ' · laatst door ' + esc(d.laatstDoor) : '') + '</small></span>' +
        '<span class="kol office-omvang">' + esc(d.omvang || '') + '</span>' +
        '<span class="office-status" data-fase="' + esc(d.fase || 'concept') + '">' + esc(FASE_NAAM[d.fase || 'concept']) + '</span>' +
        '<span class="kol van office-wie">' + (eigen ? datum(d.gewijzigd) : esc(d.door)) + '</span>' +
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
  ['#zoek', '#filterSoort', '#filterFase', '#sorteer'].forEach(function (s) {
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

  /* ---------- openen ---------- */
  function zetTab(doc) {
    var tab = tabs.find(function (t) { return t.id === doc.id; });
    if (!tab) {
      if (tabs.length >= 6) {
        var weg = tabs.findIndex(function (t) { return !open || t.id !== open.id; });
        tabs.splice(weg < 0 ? 0 : weg, 1);
      }
      tab = { id: doc.id }; tabs.push(tab);
    }
    tab.titel = doc.titel; tab.soort = doc.soort;
    tab.fase = (doc.werkstroom && doc.werkstroom.fase) || tab.fase || 'concept';
    tekenTabs();
  }
  function tekenTabs() {
    // Rahul gebruikt dezelfde tabstrip. Bewaar zijn levende knop (met eigen
    // click-handler) wanneer Office de documenttabs opnieuw tekent.
    var rahulTab = $('#docTabs').querySelector('.rtg-rahul-tab');
    if (rahulTab) rahulTab.remove();
    $('#docTabs').innerHTML = tabs.map(function (t) {
      var actief = open && open.id === t.id;
      return '<button class="office-tab" type="button" role="tab" aria-selected="' + (actief ? 'true' : 'false') +
        '" data-tab="' + esc(t.id) + '" data-actief="' + (actief ? '1' : '0') + '">' +
        '<i>' + glyf(GLYF_SOORT[t.soort] || 'logboek') + '</i><span>' + esc(t.titel || 'Document') +
        '</span><b data-tab-dicht="' + esc(t.id) + '" aria-label="Sluit tab">×</b></button>';
    }).join('');
    if (rahulTab) $('#docTabs').appendChild(rahulTab);
    Array.prototype.forEach.call($('#docTabs').querySelectorAll('[data-tab]'), function (b) {
      b.addEventListener('click', function (e) {
        if (e.target && e.target.closest('[data-tab-dicht]')) return;
        openen(b.dataset.tab);
      });
    });
    Array.prototype.forEach.call($('#docTabs').querySelectorAll('[data-tab-dicht]'), function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); sluitTab(b.dataset.tabDicht); });
    });
  }
  function sluitTab(id) {
    var wasActief = open && open.id === id;
    Promise.resolve(wasActief && vuil ? bewaarNu() : true).then(function (veilig) {
      if (veilig === false) return;
      var plek = tabs.findIndex(function (t) { return t.id === id; });
      if (plek >= 0) tabs.splice(plek, 1);
      if (!wasActief) return tekenTabs();
      clearInterval(leesT); open = null; vuil = false;
      var volgende = tabs[Math.min(plek, tabs.length - 1)];
      if (volgende) openLaden(volgende.id); else sluitEditor();
    });
  }
  function openen(id, geforceerd) {
    if (!id) return Promise.resolve(false);
    if (!geforceerd && open && open.id === id) return Promise.resolve(true);
    return Promise.resolve(open && vuil ? bewaarNu() : true).then(function (veilig) {
      if (veilig === false) return false;
      return openLaden(id);
    });
  }
  function openLaden(id) {
    var volgorde = ++openVolgorde;
    return api('open', { id: id }).then(function (r) {
      if (volgorde !== openVolgorde) return false;
      if (r.status !== 200) return zeg(r.body.error || 'Kon niet openen.');
      open = r.body; magBewerken = !!r.body.magBewerken; vuil = false;
      zetTab(open);
      $('#titel').value = r.body.titel; $('#titel').disabled = !r.body.eigenaar;
      $('#staat').textContent = magBewerken ? (r.body.eigenaar ? '' : 'meeschrijven · van ' + r.body.door)
        : 'alleen lezen · van ' + r.body.door;
      $('#deelBtn').style.display = r.body.eigenaar ? '' : 'none';
      // Rahul leest tekst en dia's; op een formulier of schets heeft hij niets te zoeken
      $('#aiBtn').style.display = magBewerken && r.body.soort !== 'formulier' && r.body.soort !== 'schets' && r.body.soort !== 'bord' ? '' : 'none';
      $('#presBtn').style.display = r.body.soort === 'presentatie' ? '' : 'none';
      $('#formBalk').style.display = r.body.soort === 'blad' ? '' : 'none';
      $('#tekstTools').style.display = 'none'; $('#bladTools').style.display = 'none';
      $('#tekst').style.display = 'none'; $('#bladWrap').style.display = 'none'; $('#presWrap').style.display = 'none';
      $('#formWrap').style.display = 'none'; $('#schetsWrap').style.display = 'none';
      $('#bordWrap').style.display = 'none';
      if (r.body.soort === 'blad') toonBlad(r.body.inhoud);
      else if (r.body.soort === 'presentatie') toonPres(r.body.inhoud);
      else if (r.body.soort === 'formulier') toonFormulier(r.body.inhoud);
      else if (r.body.soort === 'schets') toonSchets(r.body.inhoud);
      else if (r.body.soort === 'bord') toonBord(r.body.inhoud);
      else toonTekst(r.body.inhoud);
      $('#lijst').style.display = 'none'; $('#editor').classList.add('aan');
      tekenFase();
      startSamen();
      volgMee();
      return true;
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
        // Houd bij actieve tekstinvoer ook de oude versiecode vast. Als de
        // gebruiker daarna schrijft, ziet bewaren het conflict; de nieuwere
        // serverstand wordt nooit stil door de zichtbare oude tekst vervangen.
        if (document.activeElement && document.activeElement.id === 'tekst') return;
        open.gewijzigd = v.body.gewijzigd; open.inhoud = v.body.inhoud; open.werkstroom = v.body.werkstroom;
        if (open.soort === 'blad') blad.laad(v.body.inhoud, magBewerken);
        else if (open.soort === 'presentatie') pres.laad(v.body.inhoud, magBewerken);
        else if (open.soort === 'formulier') formulier.laad(v.body.inhoud, magBewerken, open.id);
        else if (open.soort === 'schets') schets.laad(v.body.inhoud, magBewerken);
        else if (open.soort === 'bord') bord.laad(v.body.inhoud, magBewerken);
        else $('#tekst').innerHTML = (v.body.inhoud && v.body.inhoud.tekst) || '';
        zetTab(open); tekenFase();
        zeg('Bijgewerkt door ' + (v.body.door || 'een ander'));
      });
    }, 5000);
  }
  function sluitEditor() {
    clearInterval(leesT); stopSamen(); $('#editor').classList.remove('aan'); $('#lijst').style.display = '';
    open = null; vuil = false; $('#voetbalk').textContent = ''; tekenTabs(); laadLijst();
  }
  $('#editTerug').addEventListener('click', function () {
    Promise.resolve(vuil ? bewaarNu() : true).then(function (veilig) { if (veilig !== false) sluitEditor(); });
  });

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
  function toonBord(inhoud) {
    $('#bordWrap').style.display = '';
    if (!bord) bord = RTGOfficeBord.maak({ wortel: $('#bordWrap'), onWijzig: markeer, meld: zeg });
    bord.laad(inhoud, magBewerken);
    var n = ((inhoud && inhoud.lijsten) || []).reduce(function (a, l) { return a + ((l.kaarten || []).length); }, 0);
    $('#voetbalk').textContent = n + (n === 1 ? ' kaart' : ' kaarten');
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
    meldAanwezig('presenteert');
    presLoop = RTGOfficePres.presenteer({ doos: $('#toonDia'), titel: $('#tdTitel'), tekst: $('#tdTekst'),
      notitie: $('#tdNotitie'), teller: $('#tdTeller'), dias: pres.dias() });
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
  });
  $('#tdVorige').addEventListener('click', function () { presLoop && presLoop.stap(-1); });
  $('#tdVolgende').addEventListener('click', function () { presLoop && presLoop.stap(1); });
  $('#tdNotitieBtn').addEventListener('click', function () { presLoop && presLoop.notitie(); });
  $('#tdDicht').addEventListener('click', function () {
    $('#toonDia').className = ''; presLoop = null;
    meldAanwezig(magBewerken ? 'bewerkt' : 'bekijkt');
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
    meldTypen();
    clearTimeout(bewaarT); bewaarT = setTimeout(bewaarNu, 900);
  }
  function inhoudNu() {
    return open.soort === 'blad' ? blad.inhoud()
      : open.soort === 'presentatie' ? pres.inhoud()
      : open.soort === 'formulier' ? formulier.inhoud()
      : open.soort === 'schets' ? schets.inhoud()
      : open.soort === 'bord' ? bord.inhoud()
      : { tekst: $('#tekst').innerHTML.slice(0, 500000) };
  }
  function bewaarNu() {
    if (!open || !magBewerken || !vuil) return Promise.resolve(true);
    // Het document vastpakken vóór de rondreis: wie tijdens het bewaren
    // teruggaat naar de lijst (open wordt dan null) of een ander document
    // opent, mag niet door het late antwoord worden ingehaald.
    var doc = open, inhoud = inhoudNu();
    return api('bewaar', { id: doc.id, titel: $('#titel').value, inhoud: inhoud,
      verwachtGewijzigd: doc.gewijzigd }).then(function (r) {
      if (r.status === 409 && r.body.code === 'VERSIECONFLICT') {
        conflict = { id: doc.id, soort: doc.soort, titel: $('#titel').value,
          inhoud: JSON.parse(JSON.stringify(inhoud)), laatstDoor: r.body.laatstDoor };
        $('#staat').textContent = 'Nieuwere versie gevonden';
        $('#conflictUitleg').textContent = 'Uw wijzigingen zijn niet overschreven. ' +
          (r.body.laatstDoor ? r.body.laatstDoor + ' bewerkte intussen de nieuwste versie. ' : '') +
          'Bewaar uw werk als aparte kopie of open bewust de nieuwste versie.';
        $('#conflictScrim').classList.add('open');
        return false;
      }
      if (r.body.error) { $('#staat').textContent = ''; zeg(r.body.error); return false; }
      doc.gewijzigd = r.body.gewijzigd; doc.inhoud = inhoud;
      if (doc.werkstroom) doc.werkstroom.fase = r.body.fase || 'concept';
      if (open === doc) {
        vuil = false;
        open.titel = $('#titel').value;
        zetTab(open); tekenFase();
        meldAanwezig('bewerkt');
        $('#staat').textContent = 'Bewaard ' + new Date().toLocaleTimeString('nl-NL').slice(0, 5);
      }
      return true;
    });
  }
  $('#titel').addEventListener('input', markeer);
  setInterval(function () { if (vuil) bewaarNu(); }, 8000);
  window.addEventListener('beforeunload', function () { if (vuil) bewaarNu(); });

  $('#conflictKopie').addEventListener('click', function () {
    if (!conflict) return;
    var lokaal = conflict;
    var kopieTitel = String(lokaal.titel || 'Document').slice(0, 102) + ' (kopie)';
    api('maak', { soort: lokaal.soort, titel: kopieTitel }).then(function (m) {
      if (m.status !== 200) throw new Error(m.body.error || 'Kon geen kopie maken.');
      return api('bewaar', { id: m.body.id, titel: kopieTitel, inhoud: lokaal.inhoud }).then(function (b) {
        if (b.status !== 200) throw new Error(b.body.error || 'Kon de kopie niet bewaren.');
        return m.body.id;
      });
    }).then(function (id) {
      conflict = null; vuil = false; $('#conflictScrim').classList.remove('open');
      zeg('Uw werk staat veilig in een aparte kopie.'); openen(id, true); laadLijst();
    }).catch(function (e) { zeg(e.message || 'Kon de kopie niet bewaren.'); });
  });
  $('#conflictNieuwste').addEventListener('click', function () {
    if (!conflict) return;
    var id = conflict.id; conflict = null; vuil = false;
    $('#conflictScrim').classList.remove('open'); openen(id, true);
  });

  /* ---------- menselijke documentwerkstroom ---------- */
  function faseNu() {
    return open && open.werkstroom && FASE_NAAM[open.werkstroom.fase] ? open.werkstroom.fase : 'concept';
  }
  function tekenFase() {
    if (!open) return;
    var fase = faseNu(), hoofd = $('#faseHoofd');
    $('#faseBadge').textContent = FASE_NAAM[fase];
    $('#faseBadge').dataset.fase = fase;
    hoofd.style.display = 'none';
    if (!magBewerken) return;
    if (fase === 'concept') { hoofd.textContent = 'Vraag beoordeling'; hoofd.dataset.naar = 'beoordeling'; hoofd.style.display = ''; }
    else if (fase === 'beoordeling' && open.eigenaar) { hoofd.textContent = 'Keur goed'; hoofd.dataset.naar = 'goedgekeurd'; hoofd.style.display = ''; }
    else if (fase === 'goedgekeurd' && open.eigenaar) { hoofd.textContent = 'Archiveer'; hoofd.dataset.naar = 'archief'; hoofd.style.display = ''; }
    else if (fase === 'archief' && open.eigenaar) { hoofd.textContent = 'Heropen'; hoofd.dataset.naar = 'concept'; hoofd.style.display = ''; }
  }
  function faseUitleg(fase) {
    return fase === 'beoordeling' ? 'Het stuk wacht op een menselijke controle. Alleen de eigenaar kan het formeel goedkeuren.'
      : fase === 'goedgekeurd' ? 'De eigenaar heeft dit stuk goedgekeurd. Een inhoudelijke wijziging zet het automatisch terug naar concept.'
      : fase === 'archief' ? 'Het stuk is afgesloten en blijft terugvindbaar. De eigenaar kan het weer openen.'
      : 'Dit is werk in uitvoering. Een schrijver kan het ter beoordeling aanbieden.';
  }
  function tekenAudit() {
    var audit = (open && open.werkstroom && open.werkstroom.audit) || [];
    $('#faseAudit').innerHTML = audit.length ? audit.map(function (a) {
      var details = a.van && a.naar ? ' · ' + (FASE_NAAM[a.van] || a.van) + ' → ' + (FASE_NAAM[a.naar] || a.naar) : '';
      return '<article><time>' + esc(datum(a.om)) + '</time><p><b>' + esc(AUDIT_NAAM[a.actie] || a.actie) +
        '</b>' + esc(details) + '<br>' + esc(a.door || '') + '</p></article>';
    }).join('') : '<p class="stil">Het beslisspoor is alleen zichtbaar voor de eigenaar.</p>';
  }
  function tekenFaseModal() {
    if (!open) return;
    var fase = faseNu(), acties = [];
    $('#faseKop').textContent = FASE_NAAM[fase];
    $('#faseUitleg').textContent = faseUitleg(fase);
    if (magBewerken && fase === 'concept') acties.push(['beoordeling', 'Vraag beoordeling', 'vol']);
    if (magBewerken && fase === 'beoordeling') acties.push(['concept', 'Terug naar concept', '']);
    if (open.eigenaar && fase === 'beoordeling') acties.push(['goedgekeurd', 'Keur als mens goed', 'vol']);
    if (open.eigenaar && fase === 'goedgekeurd') {
      acties.push(['concept', 'Heropen als concept', '']); acties.push(['archief', 'Archiveer', 'vol']);
    }
    if (open.eigenaar && fase === 'archief') acties.push(['concept', 'Heropen als concept', 'vol']);
    $('#faseActies').innerHTML = acties.map(function (a) {
      return '<button class="knop ' + a[2] + '" type="button" data-fase-naar="' + a[0] + '">' + a[1] + '</button>';
    }).join('');
    Array.prototype.forEach.call($('#faseActies').querySelectorAll('[data-fase-naar]'), function (b) {
      b.addEventListener('click', function () { zetFase(b.dataset.faseNaar); });
    });
    tekenAudit();
  }
  function zetFase(naar) {
    if (!open) return Promise.resolve(false);
    var mens = naar === 'goedgekeurd' || naar === 'archief';
    if (mens && !confirm(naar === 'goedgekeurd'
      ? 'Keurt u dit document zelf goed? Rahul kan deze beslissing niet nemen.'
      : 'Wilt u dit document zelf archiveren?')) return Promise.resolve(false);
    var doc = open;
    return Promise.resolve(vuil ? bewaarNu() : true).then(function (veilig) {
      if (veilig === false || open !== doc) return false;
      return api('fase', { id: doc.id, naar: naar, mens: mens }).then(function (r) {
        if (r.status !== 200) { zeg(r.body.error || 'Kon de werkstatus niet wijzigen.'); return false; }
        doc.gewijzigd = r.body.gewijzigd;
        doc.werkstroom = doc.werkstroom || { audit: [] };
        doc.werkstroom.fase = r.body.fase; doc.werkstroom.laatstDoor = r.body.laatstDoor;
        if (r.body.actie && Array.isArray(doc.werkstroom.audit)) doc.werkstroom.audit.unshift(r.body.actie);
        zetTab(doc); tekenFase(); tekenFaseModal(); laadLijst();
        zeg('Werkstatus: ' + FASE_NAAM[r.body.fase] + '.');
        return true;
      });
    });
  }
  $('#faseBadge').addEventListener('click', function () {
    if (!open) return;
    Promise.resolve(vuil ? bewaarNu() : true).then(function (veilig) {
      if (veilig === false) return;
      return api('open', { id: open.id }).then(function (r) {
        if (r.status === 200) {
          open.gewijzigd = r.body.gewijzigd; open.werkstroom = r.body.werkstroom;
          tekenFase(); tekenFaseModal(); $('#faseScrim').classList.add('open');
        }
      });
    });
  });
  $('#faseHoofd').addEventListener('click', function () { zetFase(this.dataset.naar); });
  $('#faseDicht').addEventListener('click', function () { $('#faseScrim').classList.remove('open'); });

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
      var delingen = (r.body && r.body.delingen) || [];
      $('#deelLijst').innerHTML = delingen.length ? delingen.map(function (d) {
        return '<div class="vitem"><span class="rek"><b>' + esc(d.naam) + '</b><br><small>' +
          (d.rechten === 'bewerken' ? 'Meeschrijven' : 'Alleen lezen') + '</small></span>' +
          '<button class="mini weg" type="button" data-intrek="' + esc(d.codenaam) + '">Trek in</button></div>';
      }).join('') : 'Nog met niemand gedeeld.';
      Array.prototype.forEach.call($('#deelLijst').querySelectorAll('[data-intrek]'), function (b) {
        b.addEventListener('click', function () {
          api('deel', { id: open.id, codenaam: b.dataset.intrek, aan: false }).then(function (x) {
            if (x.body.error) return zeg(x.body.error);
            if (x.body.gewijzigd) open.gewijzigd = x.body.gewijzigd;
            zeg('Toegang ingetrokken.'); toonDeel();
          });
        });
      });
    });
  }
  $('#gezinZet').addEventListener('click', function () {
    api('gezin', { id: open.id, rechten: $('#gezinRechten').value }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      if (r.body.gewijzigd) open.gewijzigd = r.body.gewijzigd;
      zeg('Bewaard.'); toonDeel();
    });
  });
  $('#deelForm').addEventListener('submit', function (e) {
    e.preventDefault();
    api('deel', { id: open.id, codenaam: $('#deelCode').value, aan: true, rechten: $('#deelRechten').value })
      .then(function (r) {
        if (r.body.error) return zeg(r.body.error);
        if (r.body.gewijzigd) open.gewijzigd = r.body.gewijzigd;
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
            open.werkstroom = open.werkstroom || {};
            open.werkstroom.fase = 'concept';
            if (open.soort === 'blad') blad.laad(t.body.inhoud, magBewerken);
            else if (open.soort === 'presentatie') pres.laad(t.body.inhoud, magBewerken);
            else if (open.soort === 'formulier') formulier.laad(t.body.inhoud, magBewerken, open.id);
            else if (open.soort === 'schets') schets.laad(t.body.inhoud, magBewerken);
            else if (open.soort === 'bord') bord.laad(t.body.inhoud, magBewerken);
            else { $('#tekst').innerHTML = (t.body.inhoud && t.body.inhoud.tekst) || ''; telBij(); }
            zetTab(open); tekenFase();
            $('#versieScrim').classList.remove('open'); zeg('Versie teruggezet.');
          });
        });
      });
    });
  });
  $('#versieDicht').addEventListener('click', function () { $('#versieScrim').classList.remove('open'); });

  /* ---------- live samenwerking en documentbeleid ---------- */
  var samenT = null, typenT = null, samenStand = null, laatsteTypMelding = 0;
  var samenClient = (function () {
    var sleutel = '';
    try { sleutel = sessionStorage.getItem('rtg_office_venster') || ''; } catch (e) {}
    if (!sleutel) {
      sleutel = window.RTGId ? RTGId('office') : String(Date.now()) + Math.random().toString(36).slice(2);
      try { sessionStorage.setItem('rtg_office_venster', sleutel); } catch (e) {}
    }
    return sleutel;
  })();

  function samenAnkerNu() {
    if (!open) return 'Geheel document';
    if (open.soort === 'blad' && blad) return 'Cel ' + blad.actief();
    if (open.soort === 'presentatie' && pres) {
      var nr = pres.actief() + 1, d = pres.dias()[pres.actief()] || {};
      return 'Dia ' + nr + (d.titel ? ' · ' + d.titel.slice(0, 72) : '');
    }
    if (open.soort === 'tekst') {
      var sel = window.getSelection && window.getSelection();
      var tekst = sel ? String(sel.toString() || '').replace(/\s+/g, ' ').trim() : '';
      var knoop = sel && sel.anchorNode;
      if (tekst && knoop && $('#tekst').contains(knoop)) return 'Tekst · “' + tekst.slice(0, 78) + (tekst.length > 78 ? '…' : '') + '”';
      return 'Geheel document';
    }
    return NAAM_SOORT[open.soort] || 'Geheel document';
  }

  function meldAanwezig(standNu) {
    if (!open) return Promise.resolve(null);
    var did = open.id;
    return api('aanwezig', { id: did, client: samenClient, stand: standNu || 'bekijkt' }).then(function (r) {
      if (!open || open.id !== did || r.status !== 200) return null;
      samenStand = r.body; tekenSamenKop();
      if ($('#samenScrim').classList.contains('open')) tekenSamen();
      return r.body;
    });
  }
  function meldTypen() {
    if (!open || !magBewerken) return;
    var nuMs = Date.now();
    if (nuMs - laatsteTypMelding > 1800) { laatsteTypMelding = nuMs; meldAanwezig('typt'); }
    clearTimeout(typenT);
    typenT = setTimeout(function () { meldAanwezig('bewerkt'); }, 2600);
  }
  function startSamen() {
    clearInterval(samenT); clearTimeout(typenT); samenStand = null;
    $('#samenLabel').textContent = 'Verbinden…';
    meldAanwezig(magBewerken ? 'bewerkt' : 'bekijkt');
    samenT = setInterval(function () { meldAanwezig(presLoop ? 'presenteert' : (magBewerken ? 'bewerkt' : 'bekijkt')); }, 15000);
  }
  function stopSamen() {
    clearInterval(samenT); clearTimeout(typenT); samenT = null; typenT = null; samenStand = null;
    $('#samenLabel').textContent = 'Alleen u'; $('#samenBtn').dataset.typt = '0';
    $('#samenScrim').classList.remove('open');
  }
  function samenVervers() {
    if (!open) return Promise.resolve(null);
    var did = open.id;
    return api('samen', { id: did }).then(function (r) {
      if (!open || open.id !== did || r.status !== 200) return null;
      samenStand = r.body; tekenSamenKop(); tekenSamen(); return r.body;
    });
  }
  function tekenSamenKop() {
    var rij = (samenStand && samenStand.aanwezig) || [];
    var typt = rij.find(function (p) { return p.stand === 'typt'; });
    $('#samenBtn').dataset.typt = typt ? '1' : '0';
    $('#samenLabel').textContent = typt ? typt.naam + ' typt'
      : rij.length > 1 ? rij.length + ' aanwezig'
      : (samenStand && samenStand.openActies) ? samenStand.openActies + ' open actie' + (samenStand.openActies === 1 ? '' : 's')
      : 'Alleen u';
  }
  function samenDatum(s) {
    if (!s) return '';
    try { return new Date(s).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
  }
  function tekenSamen() {
    if (!samenStand) return;
    var beheer = samenStand.beheer || {};
    var mensen = samenStand.aanwezig || [];
    $('#samenAanwezig').innerHTML = mensen.length ? mensen.map(function (p) {
      return '<span class="office-persoon" data-stand="' + esc(p.stand) + '"><b>' + esc(p.naam) + '</b> · ' + esc(p.stand) + '</span>';
    }).join('') : '<span>Niemand anders in dit document.</span>';
    $('#samenBeleid').innerHTML = '<span class="office-policychip">' + esc(beheer.classificatie || 'intern') + '</span>' +
      '<span class="office-policychip">bewaren: ' + esc(beheer.bewaartermijn || '7jaar') + '</span>' +
      (beheer.herzienOp ? '<span class="office-policychip">herzien: ' + esc(beheer.herzienOp) + '</span>' : '') +
      (beheer.tags || []).map(function (t) { return '<span class="office-policychip">#' + esc(t) + '</span>'; }).join('');
    $('#samenAantal').textContent = samenStand.openActies + ' open';
    $('#opmerkingLijst').innerHTML = (samenStand.opmerkingen || []).length
      ? samenStand.opmerkingen.map(function (o) {
        var meta = [o.actiehouder ? 'voor ' + o.actiehouder : '', o.voor ? 'deadline ' + o.voor : ''].filter(Boolean).join(' · ');
        return '<article class="office-opmerking" data-opgelost="' + (o.opgelost ? '1' : '0') + '"><div>' +
          '<div class="office-opmerkingkop"><b>' + esc(o.door) + '</b><span>' + esc(samenDatum(o.gemaakt)) + '</span>' +
          (meta ? '<span>' + esc(meta) + '</span>' : '') + (o.opgelost ? '<span>opgelost door ' + esc(o.opgelostDoor) + '</span>' : '') + '</div>' +
          '<p>' + esc(o.tekst) + '</p>' + (o.anker ? '<p class="office-opmerkinganker">' + esc(o.anker) + '</p>' : '') + '</div>' +
          (o.magBeheren ? '<div class="office-opmerkingactie"><button class="mini" type="button" data-opmerking="' + esc(o.id) + '" data-actie="' +
            (o.opgelost ? 'heropen">Heropen' : 'oplos">Oplossen') + '</button></div>' : '') + '</article>';
      }).join('') : '<p class="stil">Nog geen opmerkingen. Dit document kan zonder open eindjes door.</p>';
    Array.prototype.forEach.call($('#opmerkingLijst').querySelectorAll('[data-opmerking]'), function (b) {
      b.addEventListener('click', function () { wijzigOpmerking(b.dataset.opmerking, b.dataset.actie); });
    });
    $('#beheerBlok').style.display = samenStand.eigenaar ? '' : 'none';
    if (samenStand.eigenaar) {
      $('#beheerClassificatie').value = beheer.classificatie || 'intern';
      $('#beheerTermijn').value = beheer.bewaartermijn || '7jaar';
      $('#beheerHerzien').value = beheer.herzienOp || '';
      $('#beheerTags').value = (beheer.tags || []).join(', ');
    }
  }

  $('#samenBtn').addEventListener('click', function () {
    if (!open) return;
    $('#samenAnker').textContent = samenAnkerNu();
    $('#samenScrim').classList.add('open');
    var paneel = $('#samenScrim').querySelector('.office-samen'); if (paneel) paneel.scrollTop = 0;
    samenVervers();
  });
  $('#samenDicht').addEventListener('click', function () { $('#samenScrim').classList.remove('open'); });
  $('#opmerkingForm').addEventListener('submit', function (e) {
    e.preventDefault(); if (!open) return;
    var tekst = $('#opmerkingTekst').value.trim();
    if (!tekst) return zeg('Schrijf eerst een opmerking.');
    api('opmerking', { id: open.id, actie: 'nieuw', tekst: tekst, anker: $('#samenAnker').textContent,
      actiehouder: $('#opmerkingWie').value, voor: $('#opmerkingVoor').value }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      $('#opmerkingTekst').value = ''; $('#opmerkingWie').value = ''; $('#opmerkingVoor').value = '';
      zeg('Opmerking geplaatst.'); samenVervers(); laadLijst();
    });
  });
  function wijzigOpmerking(id, actie) {
    api('opmerking', { id: open.id, opmerking: id, actie: actie }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      zeg(actie === 'oplos' ? 'Actie opgelost.' : 'Actie heropend.'); samenVervers(); laadLijst();
    });
  }
  $('#beheerBewaar').addEventListener('click', function () {
    if (!open) return;
    api('beheer', { id: open.id, classificatie: $('#beheerClassificatie').value,
      bewaartermijn: $('#beheerTermijn').value, herzienOp: $('#beheerHerzien').value,
      tags: $('#beheerTags').value.split(',') }).then(function (r) {
      if (r.body.error) return zeg(r.body.error);
      zeg('Documentbeleid bewaard.'); samenVervers(); laadLijst();
    });
  });

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
    Promise.resolve(vuil ? bewaarNu() : true).then(function (veilig) {
      if (veilig === false) return null;
      $('#aiUit').value = 'Rahul leest…';
      return api('ai', { id: open.id, opdracht: $('#aiOpdracht').value, vraag: $('#aiVraag').value });
    }).then(function (r) {
      if (!r) return;
      if (r.body.error) { $('#aiUit').value = ''; return zeg(r.body.error); }
      $('#aiUit').value = r.body.voorstel;
      $('#aiToepas').style.display = '';
    });
  });
  $('#aiToepas').addEventListener('click', function () {
    var stuk = $('#aiUit').value;
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
