/* RTG Command, deel 15: koppelingen en landen.

   TWEE SCHERMEN DIE ALLEBEI IETS TONEN WAT ER NOG NIET IS, en dat is hier geen
   tekortkoming maar de inhoud: de API-poort staat er en er zit niets achter
   (de toelating begint leeg), en een landpakket richt in maar dekt geen
   naleving, dus de mensenwerk-lijst blijft staan na het activeren.

   Op allebei had een groen vinkje gekund. Dat vinkje is precies wat later
   iemand laat denken dat het klaar is. De steden staan in ./command-16.js. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  C.TEKENAARS.apipoort = function (el) {
    el.innerHTML = '<h2 class="ckop">Koppelingen</h2>' +
      '<p class="lead">Sleutels, scopes, quota en uitfasering voor machines, op /api/extern/. Het geheim ' +
      'van een sleutel is één keer te zien en wordt nergens bewaard.</p>' +
      '<div id="apUit"><div class="leeg">Ophalen…</div></div>';
    teken();

    function teken() {
      api('apipoort').then(function (d) {
        var u = '';
        if (d.let) u += '<div class="kaart"><h3>Er staat niets achter deze poort</h3><p>' + esc(d.let) + '</p></div>';
        u += '<div class="rooster">' +
          tegel('Sleutels', d.tel.sleutels, '', d.tel.actief + ' actief van maximaal ' + d.max) +
          tegel('Toegelaten paden', d.tel.paden, d.tel.paden ? '' : 'gold', 'wat een sleutel ooit mag raken') +
          '</div>';

        u += '<div class="kaart"><h3>Een pad toelaten</h3><div class="crij">' +
          '<input class="veld breed" id="apPad" placeholder="/api/extern/...">' +
          '<input class="veld kort" id="apVer" value="v1" aria-label="versie">' +
          '<input class="veld mid" id="apUit2" placeholder="uitfasering (ISO-datum, optioneel)">' +
          '<button class="knop vol" id="apGa">Toelaten</button></div></div>';

        if (d.toelating.length) {
          u += '<div class="kaart"><h3>De toelating</h3><div class="schuif"><table class="ctab"><thead><tr>' +
            '<th>Pad</th><th>Versie</th><th>Uitfasering</th><th></th></tr></thead><tbody>' +
            d.toelating.map(function (t) {
              return '<tr><td>' + esc(t.pad) + '</td><td class="meta">' + esc(t.versie) + '</td><td class="meta">' +
                esc(t.uitfasering || '-') + '</td><td><button class="knop" data-apweg="' + esc(t.pad) +
                '">Eraf</button></td></tr>';
            }).join('') + '</tbody></table></div></div>';
        }

        u += '<div class="kaart"><h3>Een sleutel maken</h3><div class="crij">' +
          '<input class="veld mid" id="apN" placeholder="naam van de koppeling">' +
          '<input class="veld mid" id="apS" placeholder="scope-pad">' +
          '<input class="veld kort" id="apQ" value="1000" aria-label="quotum per uur">' +
          '<button class="knop vol" id="apMaak">Maken</button></div>' +
          '<p class="meta">Een scope buiten de toelating wordt geweigerd en niet stil ingeperkt.</p>' +
          '<div id="apGeheim"></div></div>';

        for (var i = 0; i < d.sleutels.length; i++) {
          var s2 = d.sleutels[i];
          u += '<div class="lijn"><b>' + esc(s2.naam) + '</b> <span class="meta">' + esc(s2.id) +
            (s2.ingetrokken ? ' · ingetrokken' : '') + '</span>' +
            '<div class="meta">' + esc(s2.scopes.map(function (sc) {
              return sc.pad + ' (' + sc.methoden.join('/') + ')'; }).join(' · ')) +
            ' · ' + s2.gebruiktDitUur + '/' + s2.quotaPerUur + ' dit uur · ' + s2.geweigerd + ' geweigerd</div>' +
            (s2.ingetrokken ? '' : '<div class="crij"><button class="knop" data-apin="' + esc(s2.id) +
              '">Intrekken</button></div>') + '</div>';
        }
        document.querySelector('#apUit').innerHTML = u;

        document.querySelector('#apGa').onclick = function () {
          api('apipoort/toelaten', { pad: document.querySelector('#apPad').value,
            versie: document.querySelector('#apVer').value,
            uitfasering: document.querySelector('#apUit2').value || null })
            .then(teken).catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
        document.querySelector('#apMaak').onclick = function () {
          api('apipoort/sleutel', { naam: document.querySelector('#apN').value,
            scopes: [{ pad: document.querySelector('#apS').value }],
            quotaPerUur: Number(document.querySelector('#apQ').value || 1000) })
            .then(function (r) {
              document.querySelector('#apGeheim').innerHTML = '<p class="meta" class="mt">' +
                '<b>' + esc(r.geheim) + '</b><br>' + esc(r.let) + '</p>';
            }).catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
        hang('data-apweg', function (p) { return api('apipoort/toelating-weg', { pad: p }).then(teken); });
        hang('data-apin', function (id) { return api('apipoort/intrekken', { id: id, reden: 'via het scherm' }).then(teken); });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#apUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }
  };

  C.TEKENAARS.land = function (el) {
    el.innerHTML = '<h2 class="ckop">Landen</h2>' +
      '<p class="lead">Een land aanzetten als configuratiebundel. Een pakket dekt de inrichting en nooit ' +
      'de naleving: btw-registratie, loonaangifte en een toezichthouder blijven mensenwerk.</p>' +
      '<div id="laUit"><div class="leeg">Ophalen…</div></div>';
    teken();

    function teken(land) {
      api('land', land ? { land: land } : {}).then(function (d) {
        var u = '';
        if (d.pakketten) {
          u += '<div class="kaart"><h3>De pakketten</h3><div class="schuif"><table class="ctab"><thead><tr>' +
            '<th>Land</th><th>Munt</th><th>Taal</th><th>Aan</th><th>Mensenwerk</th><th></th></tr></thead><tbody>' +
            d.pakketten.map(function (p) {
              return '<tr><td>' + esc(p.naam) + '</td><td class="meta">' + esc(p.valuta) + '</td>' +
                '<td class="meta">' + esc(p.taal) + '</td><td>' + (p.actief ? 'ja' : 'nee') + '</td>' +
                '<td class="meta">' + p.mensenwerk + ' punten</td>' +
                '<td><button class="knop" data-lakijk="' + esc(p.land) + '">Bekijken</button></td></tr>';
            }).join('') + '</tbody></table></div><p class="meta">' + esc(d.let) + '</p></div>';
        } else {
          u += '<div class="kaart"><h3>' + esc(d.naam) + '</h3>' +
            d.onderdelen.map(function (o) {
              return '<div class="lijn"><b>' + esc(o.wat) + '</b> <span class="cniveau ' +
                (o.ligt ? 'ok' : 'mis') + '">' + (o.ligt ? 'ligt er' : 'ontbreekt') + '</span>' +
                '<div class="meta">' + esc(o.uitleg) + ' <i>(' + esc(o.bron) + ')</i></div></div>';
            }).join('') +
            '<div class="crij" class="mt">' +
            '<button class="knop vol" data-laaan="' + esc(d.land) + '">Activeren</button>' +
            '<button class="knop" data-lauit="' + esc(d.land) + '">Terugdraaien</button>' +
            '<button class="knop" data-lakijk="">Terug naar de lijst</button></div></div>' +
            '<div class="kaart"><h3>Blijft mensenwerk</h3><ul>' +
            d.mensenwerk.map(function (m) { return '<li class="meta">' + esc(m) + '</li>'; }).join('') +
            '</ul><p class="meta">' + esc(d.waarschuwing) + '</p></div>';
        }
        document.querySelector('#laUit').innerHTML = u;
        hang('data-lakijk', function (l) { teken(l || null); return Promise.resolve(); });
        hang('data-laaan', function (l) { return api('land/activeer', { land: l }).then(function () { teken(l); }); });
        hang('data-lauit', function (l) { return api('land/terug', { land: l }).then(function () { teken(l); }); });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#laUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }
  };

  function hang(attr, doe) {
    Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (b) {
      b.onclick = function () { doe(b.getAttribute(attr)).catch(function (e) { if (!e.stil) C.meld(e.message); }); };
    });
  }
  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  C.WERKPLEKKEN.push(
    { id: 'apipoort', naam: 'Koppelingen', sec: 'Besturen' },
    { id: 'land', naam: 'Landen', sec: 'Besturen' });
  void S;
})();
