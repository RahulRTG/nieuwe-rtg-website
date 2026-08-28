/* De enterprise-campus; werkplek.js bezit de sessie en API. */
(function () {
  'use strict';
  var MODEL = null, ACT = null, ACTIEF = '';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); };
  var glyf = function (naam) {
    return window.RTGGlyf && RTGGlyf.svgHTML ? RTGGlyf.svgHTML(naam, {}) : '';
  };
  var kantoor = function (id) {
    return (MODEL.kantoren || []).find(function (k) { return k.id === id; });
  };
  var aantal = function (n, enkel, meer) { return n + ' ' + (n === 1 ? enkel : meer); };

  function nav() {
    return '<aside class="campus-side"><div class="campus-brand"><span class="campus-seal">' + esc(MODEL.kort) +
      '</span><div><b>' + esc(MODEL.naam) + '</b><small>Enterprise Campus</small></div></div>' +
      '<nav class="campus-nav" aria-label="Afdelingskantoren"><span>Campus</span>' +
      '<button type="button" data-kantoor="" class="' + (!ACTIEF ? 'aan' : '') + '">' + glyf('gebouw') + '<b>Campusoverzicht</b><i>16</i></button>' +
      '<span>Kantoren</span>' + (MODEL.kantoren || []).map(function (k) {
        return '<button type="button" data-kantoor="' + esc(k.id) + '" class="' + (ACTIEF === k.id ? 'aan' : '') + '">' +
          glyf(k.glyf) + '<b>' + esc(k.naam) + '</b><i>' + esc(k.verdieping) + '</i></button>';
      }).join('') + '</nav><div class="campus-exit"><button type="button" data-anderhuis>Huizen</button>' +
      '<a href="/apps/app.html">Apps</a></div></aside>';
  }

  function shell() {
    $('#kiezer').hidden = true;
    $('#huis').hidden = false;
    $('#huis').innerHTML = '<div class="campus-shell">' + nav() + '<div class="campus-main">' +
      '<header class="campus-top"><span class="live">Beveiligde verbinding</span><span class="crumb">' +
      esc(MODEL.kort) + ' / <b id="campusCrumb">' + esc(ACTIEF ? (kantoor(ACTIEF) || {}).naam : 'Campus') +
      '</b></span><a href="/apps/office.html?werk=werkplek&amp;bedrijf=' + esc(MODEL.code) + '">Office Drive &rarr;</a></header>' +
      '<main class="campus-content" id="campusView"></main></div></div>';
    bindNav();
    view();
  }

  function hero() {
    return '<section class="campus-hero"><div><span class="campus-eyebrow">' + esc(MODEL.kort) + ' Headquarters</span>' +
      '<h1>' + esc(MODEL.naam) + '</h1></div><p>' + esc(MODEL.aard) +
      ' Zestien kantoren brengen mensen, rollen, werk en specialistische systemen samen.</p></section>' +
      '<div class="campus-stats">' + (MODEL.cijfers || []).slice(0, 4).map(function (c) {
        return '<div class="campus-stat"><b>' + esc(c.waarde) + '</b><span>' + esc(c.label) + '</span></div>';
      }).join('') + '</div>';
  }

  function overzicht() {
    $('#campusView').innerHTML = hero() + '<div class="campus-sectionkop"><div><span class="campus-eyebrow">Organisatie</span>' +
      '<h2>De kantoorwereld</h2></div><p>Elke afdeling heeft een eigen opdracht, rollen en werktafel.</p></div>' +
      '<div class="office-grid">' + (MODEL.kantoren || []).map(function (k) {
        return '<button class="office-card" type="button" data-open-kantoor="' + esc(k.id) + '">' +
          '<span class="level"><span>Verdieping ' + esc(k.verdieping) + '</span><span>' + esc(MODEL.kort) + '</span></span>' +
          '<span class="ico">' + glyf(k.glyf) + '</span><h3>' + esc(k.naam) + '</h3><p>' + esc(k.doel) + '</p>' +
          '<footer><span><b>' + esc(k.mensen) + '</b> bezet</span><span><b>' + esc(k.takenOpen) + '</b> open</span>' +
          '<span>' + esc((k.tools || []).length) + ' systemen</span></footer></button>';
      }).join('') + '</div>';
    Array.prototype.forEach.call(document.querySelectorAll('[data-open-kantoor]'), function (b) {
      b.addEventListener('click', function () { kies(b.dataset.openKantoor); });
    });
  }

  function hulpmiddelen(k) {
    return '<div class="tool-grid">' + (k.tools || []).map(function (t) {
      var attr = t.href === '#ontwerptak' ? ' href="#ontwerptak" data-ontwerptak' : ' href="' + esc(t.href) + '"';
      return '<a class="tool-card"' + attr + '>' + glyf(t.glyf) + '<b>' + esc(t.naam) + '</b><span>' + esc(t.uitleg) + '</span></a>';
    }).join('') + '</div>';
  }

  function mensen(k) {
    var r = (MODEL.mensen || []).filter(function (m) { return (m.afdeling || 'operations') === k.id; });
    return '<div class="work-list" id="campusMensen">' + (r.length ? r.map(function (m) {
      return '<div class="work-row"><span><b>' + esc(m.codenaam) + '</b><br><small>' + esc(m.functie) + '</small></span>' +
        '<button type="button" data-mens-weg="' + esc(m.id) + '">Verwijder</button></div>';
    }).join('') : '<p class="office-empty">Dit kantoor is nog niet bezet.</p>') + '</div>' +
      '<form class="campus-form" id="campusMensForm"><input id="campusCodenaam" maxlength="60" placeholder="Codenaam" aria-label="Codenaam" required>' +
      '<input id="campusFunctie" maxlength="60" placeholder="Functie" aria-label="Functie"><button type="submit">Plaats in kantoor</button></form>';
  }

  function taken(k) {
    var r = (MODEL.taken || []).filter(function (t) { return (t.afdeling || 'operations') === k.id; });
    return '<div class="work-list" id="campusTaken">' + (r.length ? r.map(function (t) {
      return '<label class="work-row"><input type="checkbox" data-taak="' + esc(t.id) + '"' + (t.af ? ' checked' : '') +
        '><span' + (t.af ? ' style="color:var(--rtg-soft);text-decoration:line-through"' : '') + '>' + esc(t.tekst) + '</span></label>';
    }).join('') : '<p class="office-empty">Geen open werk op deze tafel.</p>') + '</div>' +
      '<form class="campus-form taakform" id="campusTaakForm"><input id="campusTaak" maxlength="200" placeholder="Nieuw werkpunt" aria-label="Nieuw werkpunt" required>' +
      '<button type="submit">Zet op tafel</button></form>';
  }

  function detail(k) {
    $('#campusView').innerHTML = '<section class="office-detail"><header class="office-head"><span class="ico">' + glyf(k.glyf) +
      '</span><div><span class="campus-eyebrow">Verdieping ' + esc(k.verdieping) + ' · ' + esc(MODEL.kort) + '</span><h1>' + esc(k.naam) +
      '</h1><p>' + esc(k.doel) + '</p></div><button class="close" type="button" data-campusoverzicht>Campusoverzicht</button></header>' +
      '<div class="office-body"><section class="office-col"><h2>Specialistische systemen</h2>' + hulpmiddelen(k) +
      '<div class="campus-sectionkop"><h2>Werkvoorraad</h2><p>' + aantal(k.takenOpen, 'punt open', 'punten open') + '</p></div>' + taken(k) +
      '</section><aside class="office-col"><h2>Functies in dit kantoor</h2><div class="role-list">' +
      (k.functies || []).map(function (f) { return '<span>' + esc(f) + '</span>'; }).join('') + '</div>' +
      '<div class="campus-sectionkop"><h2>Bezetting</h2><p>' + aantal(k.mensen, 'persoon', 'personen') + '</p></div>' + mensen(k) + '</aside></div></section>';
    bindDetail(k);
  }

  function ontwerp() {
    $('#campusView').innerHTML = '<section class="design-floor" id="ontwerptak"><div class="kop"><div><span class="campus-eyebrow">Product, Design & Innovation</span>' +
      '<h1>De ontwerpverdieping</h1><p>Zes zelfstandige bureaus voor mode, mobiliteit, hardware, architectuur, redactie en nieuwe ideeen. Alles wat hier ontstaat blijft in ' +
      esc(MODEL.naam) + '.</p></div><button class="knop" type="button" data-campusoverzicht>Terug</button></div><div id="campusBureaus"></div></section>';
    if (window.RTGWerkplekBureaus) RTGWerkplekBureaus.tegels($('#campusBureaus'), MODEL.code);
    $('[data-campusoverzicht]').addEventListener('click', function () { kies('product'); });
  }

  function bindDetail(k) {
    $('[data-campusoverzicht]').addEventListener('click', function () { kies(''); });
    var o = $('[data-ontwerptak]'); if (o) o.addEventListener('click', function (e) { e.preventDefault(); ontwerp(); });
    $('#campusMensForm').addEventListener('submit', function (e) {
      e.preventDefault(); var c = $('#campusCodenaam').value.trim(); if (!c) return;
      verander('mens', { bedrijf: MODEL.code, codenaam: c, functie: $('#campusFunctie').value.trim(), afdeling: k.id });
    });
    $('#campusTaakForm').addEventListener('submit', function (e) {
      e.preventDefault(); var t = $('#campusTaak').value.trim(); if (!t) return;
      verander('taak', { bedrijf: MODEL.code, tekst: t, afdeling: k.id });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-mens-weg]'), function (b) {
      b.addEventListener('click', function () { verander('mens-weg', { bedrijf: MODEL.code, id: b.dataset.mensWeg }); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-taak]'), function (c) {
      c.addEventListener('change', function () { verander('taak-zet', { bedrijf: MODEL.code, taakId: c.dataset.taak, af: c.checked }); });
    });
  }

  function verander(pad, body) {
    ACT.api(pad, body).then(function (d) {
      if (d.mensen) MODEL.mensen = d.mensen;
      if (d.taken) MODEL.taken = d.taken;
      if (d.kantoren) MODEL.kantoren = d.kantoren;
      shell();
      if (ACT.veranderd) ACT.veranderd(MODEL);
    }).catch(function (e) { alert(e.message); });
  }

  function bindNav() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-kantoor]'), function (b) {
      b.addEventListener('click', function () { kies(b.dataset.kantoor); });
    });
    $('[data-anderhuis]').addEventListener('click', ACT.anderHuis);
  }
  function url() {
    try {
      var u = new URL(location.href); u.searchParams.set('bedrijf', MODEL.code);
      if (ACTIEF) u.searchParams.set('kantoor', ACTIEF); else u.searchParams.delete('kantoor');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) {}
  }
  function kies(id) {
    ACTIEF = kantoor(id) ? id : '';
    url(); shell();
  }
  function view() {
    var k = kantoor(ACTIEF);
    if (k) detail(k); else overzicht();
  }
  function open(model, acties, begin) {
    MODEL = model; ACT = acties; ACTIEF = kantoor(begin) ? begin : '';
    shell();
  }

  window.RTGWerkplekCampus = { open: open };
})();
