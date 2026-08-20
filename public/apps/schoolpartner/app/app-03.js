/* de doelgroepkiezer: welke groep of klas een bericht of taak krijgt */
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
