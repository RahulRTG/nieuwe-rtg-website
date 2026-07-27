/* RTG School Partner, het scherm: een werkbank voor directie en lerarenteam
   op de bestaande school-API's. Directie ziet personeel en klassen; een
   leraar draait zijn klas: online les, team en overname, toetsen uit de
   leerlijn (verse opgaven per leerling, cijfervoorstel blijft advies),
   oefen-huiswerk en het cijferboek. Sessie lokaal, tokens nooit in de URL. */
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

  var S = null;
  try { S = JSON.parse(localStorage.getItem('rtg_schoolpartner') || 'null'); } catch (e) {}
  function bewaar() { try { localStorage.setItem('rtg_schoolpartner', JSON.stringify(S)); } catch (e) {} }
  function toon(v) {
    ['vPoort', 'vDirectie', 'vLeraar'].forEach(function (id) { $('#' + id).hidden = id !== v; });
    $('#uitlog').hidden = v === 'vPoort';
  }
  $('#uitlog').addEventListener('click', function () { S = null; try { localStorage.removeItem('rtg_schoolpartner'); } catch (e) {} toon('vPoort'); });

  /* ---- de poort: het token vertelt zelf of je directie of leraar bent ---- */
  $('#inGa').addEventListener('click', function () {
    var code = $('#inCode').value.trim().toUpperCase(), token = $('#inToken').value.trim();
    if (!code || !token) return meld('Vul de schoolcode en je token in.');
    api('/school/school/overzicht', { schoolCode: code, beheerToken: token }).then(function (r) {
      if (r.status === 200) { S = { code: code, token: token, rol: 'directie' }; bewaar(); return directie(); }
      return api('/school/leraar/overzicht', { schoolCode: code, personeelToken: token }).then(function (r2) {
        if (r2.status === 200) { S = { code: code, token: token, rol: 'leraar' }; bewaar(); return leraar(); }
        meld(r2.body.error || 'Onbekende school of verkeerd token.');
      });
    });
  });

  /* ---------- directie ---------- */
  function directie() {
    toon('vDirectie');
    api('/school/school/overzicht', { schoolCode: S.code, beheerToken: S.token }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      var d = r.body, wacht = d.personeel.filter(function (p) { return p.status === 'wacht'; });
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
    });
  }

  /* ---------- leraar ---------- */
  var KLAS = null, BIEB = null;
  function leraar() {
    toon('vLeraar');
    api('/school/leraar/overzicht', { schoolCode: S.code, personeelToken: S.token }).then(function (r) {
      if (r.body.error) return meld(r.body.error);
      $('#lKlassen').innerHTML = (r.body.klassen || []).map(function (k) {
        return '<div class="item"><span>' + esc(k.naam) + ' <span class="stil">· code ' + esc(k.code) + '</span></span>' +
          '<button class="knop p" data-klas="' + esc(k.code) + '">Open</button></div>';
      }).join('') || '<p class="stil">Nog geen klas. Maak er een in de school-app, of laat een collega je vast op zijn klas zetten.</p>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-klas]'), function (b) {
        b.addEventListener('click', function () { KLAS = b.dataset.klas; $('#lWerk').hidden = false; werkbank(); });
      });
    });
  }
  function kl(pad, body) { return api(pad, Object.assign({ klasCode: KLAS, personeelToken: S.token }, body || {})); }

  function werkbank() {
    kl('/school/klas').then(function (r) {
      if (r.body.error) return meld(r.body.error);
      var k = r.body;
      var open = (k.huiswerk || []).filter(function (h) { return (h.afNamen || []).length < (k.leerlingen || []).length; }).length;
      $('#lKpis').innerHTML = [['Leerlingen', (k.leerlingen || []).length], ['Klasgemiddelde', k.klasGemiddelde || '-'],
        ['Huiswerk open', open], ['Toetsen', (k.toetsen || []).length || 0]]
        .map(function (x) { return '<div class="kpi"><b>' + x[1] + '</b><span>' + x[0] + '</span></div>'; }).join('');
      var les = k.onlineLes;
      $('#lesKnop').textContent = les && les.aan ? 'Online les stoppen' : 'Online les starten';
      $('#lesTag').hidden = !(les && les.aan);
      if (les && les.aan) $('#lesTag').textContent = 'Live · ' + les.kamercode;
      $('#lesTag').className = 'tag aan';
      $('#teamLijst').textContent = 'Vast: ' + (k.leraren || []).map(function (x) { return x.naam; }).join(', ') +
        (k.waarnemer ? ' · Waarnemer: ' + k.waarnemer.naam : '');
      $('#cBoek').innerHTML = (k.cijfers || []).slice(0, 15).map(function (c) {
        return '<div class="item"><span>' + esc(c.omschrijving || c.vak) + '</span><span><b>' + c.cijfer + '</b> <span class="stil">weging ' + c.weging + '</span></span></div>';
      }).join('') || 'Nog geen cijfers.';
    });
    window.SPart.toetslijst();
    if (window.SPart.hulplijn) window.SPart.hulplijn();
    if (window.SPart.excursie) window.SPart.excursie(KLAS);
    if (!BIEB) kl('/school/toets/bibliotheek').then(function (r) {
      BIEB = r.body.groepen || [];
      $('#tGroep').innerHTML = BIEB.map(function (g) { return '<option value="' + g.groep + '">Groep ' + g.groep + '</option>'; }).join('');
      $('#tGroep').value = '3';
      doelkies();
    });
  }
  function doelkies() {
    var g = (BIEB || []).find(function (x) { return String(x.groep) === $('#tGroep').value; });
    $('#tDoelen').innerHTML = ((g && g.doelen) || []).map(function (d) {
      return '<label><input type="checkbox" value="' + esc(d.id) + '"> ' + esc(d.naam) + ' <span class="stil">' + esc(d.vak) + '</span></label>';
    }).join('');
  }
  $('#tGroep').addEventListener('change', doelkies);
  function gekozen() {
    return Array.prototype.map.call(document.querySelectorAll('#tDoelen input:checked'), function (i) { return i.value; });
  }
  $('#tMaak').addEventListener('click', function () {
    var doelen = gekozen();
    if (!doelen.length) return meld('Vink minstens een leerdoel aan.');
    kl('/school/toets/maak', { soort: $('#tSoort').value, naam: $('#tNaam').value, doelen: doelen })
      .then(function (r) { meld(r.body.error || 'Toets staat klaar: ' + r.body.toets.vragen + ' vragen.'); werkbank(); });
  });
  $('#hwMaak').addEventListener('click', function () {
    var doelen = gekozen();
    if (doelen.length !== 1) return meld('Kies precies een leerdoel voor oefen-huiswerk.');
    kl('/school/huiswerk/maak', { titel: 'Oefenen: ' + doelen[0], vak: doelen[0].split('.')[0], doel: doelen[0] })
      .then(function (r) { meld(r.body.error || 'Huiswerk staat klaar; het vinkt zichzelf af bij goed oefenen.'); werkbank(); });
  });
  $('#lesKnop').addEventListener('click', function () {
    var stoppen = $('#lesKnop').textContent.indexOf('stoppen') >= 0;
    kl(stoppen ? '/school/les/stop' : '/school/les/start').then(function (r) {
      meld(r.body.error || (stoppen ? 'Online les gestopt.' : 'Online les live: ' + r.body.onlineLes.kamercode)); werkbank();
    });
  });
  $('#teamKnop').addEventListener('click', function () { $('#teamBlok').hidden = !$('#teamBlok').hidden; });
  $('#teamErbij').addEventListener('click', function () {
    kl('/school/klas/leraar-koppel', { personeelId: $('#teamId').value.trim() })
      .then(function (r) { meld(r.body.error || 'Collega staat vast op de klas.'); werkbank(); });
  });
  $('#overnameStop').addEventListener('click', function () {
    kl('/school/klas/overname-stop').then(function (r) { meld(r.body.error || 'Overname gestopt.'); werkbank(); });
  });

  window.SPart = window.SPart || {};
  window.SPart.kl = kl; window.SPart.esc = esc; window.SPart.meld = meld; window.SPart.werkbank = werkbank;

  if (S && S.rol === 'directie') directie();
  else if (S && S.rol === 'leraar') leraar();
  else toon('vPoort');
})();
