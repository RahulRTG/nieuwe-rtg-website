/* RTG School Partner, het scherm: een werkbank voor directie en lerarenteam
   op de bestaande school-API's. Directie ziet personeel en klassen; een
   leraar draait zijn klas: online les, team en overname, toetsen uit de
   leerlijn (verse opgaven per leerling, cijfervoorstel blijft advies),
   oefen-huiswerk en het cijferboek. De tijdelijke tabsessie verloopt na
   inactiviteit; tokens staan nooit in de URL of permanente browseropslag. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  function meld(t) { var m = $('#melding'); m.textContent = t; m.classList.add('zie'); clearTimeout(meld.t); meld.t = setTimeout(function () { m.classList.remove('zie'); }, 3200); }
  function api(pad, body) {
    return fetch('/api/foundation' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; }); });
  }

  var SLOT = 'rtg_schoolpartner';
  var Store = window.RTGSchoolSession;
  var S = Store ? Store.lees(SLOT) : null;
  function bewaar() { if (Store) Store.zet(SLOT, S); }
  function context(naam, rol) {
    var c = $('#schoolContext');
    c.hidden = !naam;
    if (naam) { $('#schoolContextNaam').textContent = naam; $('#schoolContextRol').textContent = rol || ''; }
  }
  function toon(v) {
    ['vPoort', 'vDirectie', 'vLeraar'].forEach(function (id) { $('#' + id).hidden = id !== v; });
    $('#uitlog').hidden = v === 'vPoort';
    document.body.dataset.schoolRol = v === 'vDirectie' ? 'directie' : v === 'vLeraar' ? 'leraar' : 'poort';
    if (v === 'vPoort') context('', '');
  }
  function uitloggen(bericht) {
    S = null; if (Store) Store.weg(SLOT);
    $('#inToken').value = ''; toon('vPoort');
    if (bericht) meld(bericht);
  }
  $('#uitlog').addEventListener('click', function () { uitloggen(); });
  if (Store) Store.bewaak([SLOT], function () { uitloggen('Je veilige schoolsessie is verlopen. Log opnieuw in.'); });

  /* ---- de poort: het token vertelt zelf of je directie of leraar bent ---- */
  $('#inGa').addEventListener('click', function () {
    var code = $('#inCode').value.trim().toUpperCase(), token = $('#inToken').value.trim();
    if (!code || !token) return meld('Vul de schoolcode en je token in.');
    api('/school/school/overzicht', { schoolCode: code, beheerToken: token }).then(function (r) {
      if (r.status === 200) { S = { code: code, token: token, rol: 'directie' }; bewaar(); $('#inToken').value = ''; return directie(); }
      return api('/school/leraar/overzicht', { schoolCode: code, personeelToken: token }).then(function (r2) {
        if (r2.status === 200) { S = { code: code, token: token, rol: 'leraar' }; bewaar(); $('#inToken').value = ''; return leraar(); }
        meld(r2.body.error || 'Onbekende school of verkeerd token.');
      });
    });
  });
  ['inCode', 'inToken'].forEach(function (id) { $('#' + id).addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#inGa').click(); }); });

  /* ---------- directie ---------- */
  function directie() {
    toon('vDirectie');
    api('/school/school/overzicht', { schoolCode: S.code, beheerToken: S.token }).then(function (r) {
      if (r.body.error) { if (r.status === 403) uitloggen('Deze schoolsessie is niet meer geldig.'); return meld(r.body.error); }
      var d = r.body, wacht = d.personeel.filter(function (p) { return p.status === 'wacht'; });
      context(d.naam, 'Directie');
      $('#dWelkom').textContent = d.naam + ' in één bestuurlijk beeld.';
      /* Meenemen (shared/uitvoer.js): voor de directie is het personeelsregister
         de lijst die deze werkbank echt bezit -- naam, rol, id en status los,
         in plaats van de regel "Naam · leraar · id 3" die op het scherm staat. */
      if (window.RTGUitvoer) RTGUitvoer.bron(function () {
        if (!d.personeel.length) return null;
        return { naam: 'personeel', kolommen: ['naam', 'rol', 'id', 'status'],
          rijen: d.personeel.map(function (p) { return [p.naam, p.rol, p.id, p.status]; }) };
      });
      var leerlingen = d.klassen.reduce(function (n, k) { return n + (k.leerlingen || 0); }, 0);
      $('#dKpis').innerHTML = [['Klassen', d.klassen.length], ['Leerlingen', leerlingen],
        ['Personeel actief', d.personeel.length - wacht.length], ['Wacht op akkoord', wacht.length]]
        .map(function (x) { return '<div class="kpi"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('');
      $('#dPersoneel').innerHTML = d.personeel.map(function (p) {
        return '<div class="item"><span>' + esc(p.naam) + ' <span class="stil">· ' + esc(p.rol) + ' · id ' + esc(p.id) + '</span></span>' +
          (p.status === 'wacht'
            ? '<span class="rij"><button class="knop p" data-besluit="ja" data-id="' + esc(p.id) + '">Toelaten</button>' +
              '<button class="knop" data-besluit="nee" data-id="' + esc(p.id) + '">Afwijzen</button></span>'
            : '<span class="tag' + (p.status === 'actief' ? ' aan' : '') + '">' + esc(p.status) + '</span>') + '</div>';
      }).join('') || '<p class="stil">Nog geen personeel aangemeld.</p>';
      $('#dKlassen').innerHTML = d.klassen.map(function (k) {
        return '<div class="item"><span>' + esc(k.naam) + ' <span class="stil">· code ' + esc(k.code) + '</span></span>' +
          '<span class="stil">' + (k.leerlingen || 0) + ' leerlingen</span></div>';
      }).join('') || '<p class="stil">Nog geen klassen.</p>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-besluit]'), function (b) {
        b.addEventListener('click', function () {
          api('/school/personeel/besluit', { schoolCode: S.code, beheerToken: S.token, personeelId: b.dataset.id, akkoord: b.dataset.besluit === 'ja' })
            .then(function (r2) { meld(r2.body.error || 'Besluit vastgelegd.'); directie(); });
        });
      });
      if (window.RTGSchoolDirectie) RTGSchoolDirectie.bind(api, S, esc, meld);
      if (window.RTGSchoolEnterprise) RTGSchoolEnterprise.bind(api, S, esc, meld);
    });
  }
