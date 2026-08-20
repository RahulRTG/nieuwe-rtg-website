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
      if (window.RTGSchoolDossier) RTGSchoolDossier.bind(api, S, esc, meld);
      if (window.RTGSchoolVeiligheid) RTGSchoolVeiligheid.bind(api, S, esc, meld);
      if (window.RTGSchoolHR) RTGSchoolHR.bind(api, S, esc, meld);
      if (window.RTGSchoolGeld) RTGSchoolGeld.bind(api, S, esc, meld);
      if (window.RTGSchoolOrganisatie) RTGSchoolOrganisatie.bind(api, S, esc, meld);
      if (window.RTGSchoolOmroep) RTGSchoolOmroep.bind(api, S, esc, meld);
    });
  }
  /* ---------- leraar ---------- */
  var KLAS = null, BIEB = null;
  function leraar() {
    toon('vLeraar');
    api('/school/leraar/overzicht', { schoolCode: S.code, personeelToken: S.token }).then(function (r) {
      if (r.body.error) { if (r.status === 403) uitloggen('Deze schoolsessie is niet meer geldig.'); return meld(r.body.error); }
      var schoolNaam = typeof r.body.school === 'string' ? r.body.school : (r.body.school && r.body.school.naam) || S.code;
      context(schoolNaam, 'Leraar');
      $('#lWelkom').textContent = 'Welkom, ' + r.body.naam + '.';
      $('#lKlassen').innerHTML = (r.body.klassen || []).map(function (k) {
        return '<div class="item"><span>' + esc(k.naam) + ' <span class="stil">· code ' + esc(k.code) + '</span></span>' +
          '<button class="knop p" data-klas="' + esc(k.code) + '">Open</button></div>';
      }).join('') || '<p class="stil">Nog geen klas. Maak er een in de school-app, of laat een collega je vast op zijn klas zetten.</p>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-klas]'), function (b) {
        b.addEventListener('click', function () { KLAS = b.dataset.klas; $('#lWerk').hidden = false; context(schoolNaam, 'Leraar · ' + b.parentNode.querySelector('span').textContent.split(' · ')[0]); werkbank(); });
      });
    });
  }
  function kl(pad, body) { return api(pad, Object.assign({ klasCode: KLAS, personeelToken: S.token }, body || {})); }
  /* Twee sleutelbossen, want er zijn twee poorten. kl() gaat naar de klaslaag
     (klascode + token van de leraar); sk() gaat naar de rollenpoort, en die
     wil de SCHOOLcode erbij -- presentie, rapporten en dossier hangen aan een
     recht van de school en niet aan het bezit van een klascode. */
  function sk(pad, body) {
    return api(pad, Object.assign({ schoolCode: S.code, klasCode: KLAS, personeelToken: S.token }, body || {}));
  }

  function werkbank() {
    kl('/school/klas').then(function (r) {
      if (r.body.error) return meld(r.body.error);
      var k = r.body;
      /* Meenemen (shared/uitvoer.js): het cijferboek van de klas, met de velden
         los in plaats van de regel "Toets 3 (SO) 7.5 weging 2" op het scherm.
         Datum als YYYY-MM-DD; de leerlingnaam blijft hier weg, net als in het
         boek zelf -- wat de werkbank niet toont, gaat ook niet mee. */
      if (window.RTGUitvoer) RTGUitvoer.bron(function () {
        var cs = k.cijfers || [];
        if (!cs.length) return null;
        return { naam: 'cijferboek', kolommen: ['datum', 'vak', 'omschrijving', 'cijfer', 'weging'],
          rijen: cs.map(function (c) { return [String(c.at || '').slice(0, 10), c.vak || '', c.omschrijving || '', c.cijfer, c.weging]; }) };
      });
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
    if (window.SPart.presentie) window.SPart.presentie();
    if (window.SPart.rapport) window.SPart.rapport();
    if (window.SPart.mijnhr) window.SPart.mijnhr();
    if (window.SPart.verlof) window.SPart.verlof();
    if (window.SPart.bewijs) window.SPart.bewijs();
    if (window.SPart.denkfout) window.SPart.denkfout();
    if (window.SPart.aandacht) window.SPart.aandacht();
    if (window.SPart.instap) window.SPart.instap();
    if (window.SPart.taal) window.SPart.taal();
    if (window.SPart.taalcheck) window.SPart.taalcheck();
    if (window.SPart.opvolging) window.SPart.opvolging();
    if (window.SPart.toetskeuring) window.SPart.toetskeuring();
    if (window.SPart.belasting) window.SPart.belasting();
    if (window.SPart.overdracht) window.SPart.overdracht();
    if (window.SPart.overstap) window.SPart.overstap();
    if (window.SPart.hulplijn) window.SPart.hulplijn();
    if (window.SPart.excursie) window.SPart.excursie(KLAS);
    if (!BIEB) kl('/school/toets/bibliotheek').then(function (r) {
      /* De bibliotheek komt nu in twee lijsten: basisschoolgroepen en fasen
         van de ladder. Hier stond een platte lijst op groep-nummer, en de
         vo/mbo/hbo/wo-doelen (zonder groep) vielen samen in een "Groep null".
         De kiezer is per schoolsoort geordend; kent de klas zijn niveau, dan
         stuurt de server alleen het eigen deel. */
      BIEB = { groepen: r.body.groepen || [], fasen: r.body.fasen || [] };
      var po = BIEB.groepen.length
        ? '<optgroup label="Basisschool">' + BIEB.groepen.map(function (g) {
            return '<option value="' + g.groep + '">Groep ' + g.groep + '</option>';
          }).join('') + '</optgroup>' : '';
      var perTrap = {};
      BIEB.fasen.forEach(function (f) { (perTrap[f.trapNaam] = perTrap[f.trapNaam] || []).push(f); });
      var rest = Object.keys(perTrap).map(function (t) {
        return '<optgroup label="' + esc(t) + '">' + perTrap[t].map(function (f) {
          return '<option value="' + esc(f.fase) + '">' + esc(f.naam) + '</option>';
        }).join('') + '</optgroup>';
      }).join('');
      $('#tGroep').innerHTML = po + rest;
      $('#tGroep').value = BIEB.groepen.length ? '3' : (BIEB.fasen[0] ? BIEB.fasen[0].fase : '');
      doelkies();
    });
  }
  function doelkies() {
    var v = $('#tGroep').value;
    var bak = /^\d+$/.test(v)
      ? (BIEB.groepen || []).find(function (x) { return String(x.groep) === v; })
      : (BIEB.fasen || []).find(function (x) { return x.fase === v; });
    $('#tDoelen').innerHTML = ((bak && bak.doelen) || []).map(function (d) {
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
  $('#teamKnop').addEventListener('click', function () {
    $('#teamBlok').hidden = !$('#teamBlok').hidden;
    if (!$('#teamBlok').hidden) teamLijst();
  });
  /* Het team van de klas: wie staat er vast op, wie neemt waar. De lijst kwam
     tot nu toe uit de klasweergave als een zin; nu staat hij hier met de
     handeling erbij, want "Wim en Sanne" is geen knop om iemand van de klas te
     halen. Een klas houdt altijd minstens een vaste leraar -- dat weigert de
     server, en de melding zegt waarom. */
  function teamLijst() {
    kl('/school/klas/team').then(function (r) {
      if (r.body.error) { $('#teamLijst').textContent = r.body.error; return; }
      $('#teamLijst').innerHTML = (r.body.leraren || []).map(function (x) {
        return '<div class="item"><span>' + esc(x.naam) + ' <span class="stil">· id ' + esc(x.id) + '</span></span>' +
          '<button class="knop" data-teamweg="' + esc(x.id) + '">Haal van de klas</button></div>';
      }).join('') + (r.body.waarnemer
        ? '<div class="item"><span>' + esc(r.body.waarnemer.naam) + ' <span class="stil">· waarnemer</span></span></div>' : '') +
        '<p class="stil">Maximaal ' + r.body.max + ' vaste leraren; een klas houdt er altijd minstens een.</p>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-teamweg]'), function (b) {
        b.addEventListener('click', function () {
          kl('/school/klas/leraar-weg', { personeelId: b.dataset.teamweg })
            .then(function (r2) { meld(r2.body.error || 'Van de klas gehaald.'); teamLijst(); werkbank(); });
        });
      });
    });
  }
  $('#overneem').addEventListener('click', function () {
    var code = $('#overneemCode').value.trim().toUpperCase();
    if (!code) return meld('Welke klas neemt u waar? Vul de klascode in.');
    api('/school/klas/overname', { schoolCode: S.code, personeelToken: S.token, klasCode: code })
      .then(function (r) { meld(r.body.error || ('U staat als waarnemer op ' + code + '.')); });
  });
  $('#teamErbij').addEventListener('click', function () {
    kl('/school/klas/leraar-koppel', { personeelId: $('#teamId').value.trim() })
      .then(function (r) { meld(r.body.error || 'Collega staat vast op de klas.'); werkbank(); });
  });
  $('#overnameStop').addEventListener('click', function () {
    kl('/school/klas/overname-stop').then(function (r) { meld(r.body.error || 'Overname gestopt.'); werkbank(); });
  });

  window.SPart = window.SPart || {};
  window.SPart.kl = kl; window.SPart.sk = sk; window.SPart.esc = esc; window.SPart.meld = meld; window.SPart.werkbank = werkbank;
  $('#rapMaak').addEventListener('click', function () { if (window.SPart.rapportMaken) window.SPart.rapportMaken(); });

  if (S && S.rol === 'directie') directie();
  else if (S && S.rol === 'leraar') leraar();
  else toon('vPoort');
})();
