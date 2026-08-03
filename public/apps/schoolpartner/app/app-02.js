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
