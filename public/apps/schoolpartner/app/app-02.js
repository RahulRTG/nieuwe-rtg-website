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
