/* RTG Command, deel 13: master data.

   DIT SCHERM TOONT EEN VOORSTEL EN GEEN BESLUIT, en dat moet te zien zijn. Bij
   elke groep staat waarom de meter denkt dat het dezelfde partij is EN dat twee
   bedrijven met dezelfde naam in dezelfde stad twee bedrijven kunnen zijn. Dat
   verschil zit niet in de gegevens, dus het hoort ook niet als zekerheid op het
   scherm te staan. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  C.TEKENAARS.mdm = function (el) {
    el.innerHTML = '<h2 class="ckop">Master data</h2>' +
      '<p class="lead">Eén gezaghebbend record per bedrijf en per locatie. De kandidaten zijn gemeten ' +
      'uit de gegevens; welk veld de naam en de plaats draagt komt uit een tabel. Er wordt hier nooit ' +
      'vanzelf samengevoegd.</p><div id="mdUit"><div class="leeg">Meten…</div></div>';
    teken();

    function teken() {
      api('mdm').then(function (d) {
        var u = '<div class="rooster">' +
          tegel('Groepen', d.tel.groepen, d.tel.groepen ? 'gold' : 'groen', d.tel.rijen + ' rijen erin') +
          tegel('Plaatsen', d.tel.plaatsen, '', d.tel.schrijfwijzen + ' met meer dan één schrijfwijze') +
          tegel('Samengevoegd', d.samengevoegd, '', 'rijen met een verwijzing naar een gouden record') +
          '</div><div class="kaart"><h3>De grens van deze meting</h3><p>' + esc(d.let) + '</p>' +
          '<p class="meta">Bronnen: ' + esc(d.bronnen.map(function (b) {
            return b.collectie + ' (' + b.naamVeld + ')'; }).join(', ')) + '</p></div>';

        if (!d.bedrijven.length) u += '<div class="kaart"><p>Geen enkele groep die op elkaar lijkt.</p></div>';
        for (var i = 0; i < d.bedrijven.length; i++) {
          var g = d.bedrijven[i];
          u += '<div class="kaart"><h3>' + esc(g.leden[0].naam) + ' <span class="meta">' + g.aantal + ' rijen · ' +
            esc(g.zekerheid) + '</span></h3><p class="meta">' + esc(g.waarom) + '</p>' +
            '<div class="schuif"><table class="ctab"><thead><tr><th>Soort</th><th>Id</th><th>Naam</th><th>Plaats</th></tr></thead><tbody>' +
            g.leden.map(function (l) {
              return '<tr><td>' + esc(l.soort) + '</td><td>' + esc(l.id) + '</td><td>' + esc(l.naam) +
                '</td><td class="meta">' + esc(l.plaats || '') + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            '<div class="crij"><button class="knop" data-goud="' + esc(g.sleutel) + '">Gouden record bekijken</button>' +
            '<span class="meta">' + esc(g.let) + '</span></div><div id="mg-' + esc(g.sleutel).replace(/[^a-z0-9]/g, '') + '"></div></div>';
        }

        if (d.locaties.dichtbij.length) {
          u += '<div class="kaart"><h3>Plaatsen die dicht bij elkaar liggen</h3>' +
            d.locaties.dichtbij.map(function (x) {
              return '<div class="lijn"><b>' + esc(x.a) + '</b> en <b>' + esc(x.b) + '</b> ' +
                '<span class="meta">' + x.afstandM + ' m</span><div class="meta">' + esc(x.let) + '</div></div>';
            }).join('') + '</div>';
        }
        document.querySelector('#mdUit').innerHTML = u;

        Array.prototype.forEach.call(document.querySelectorAll('[data-goud]'), function (b) {
          b.onclick = function () {
            var sl = b.getAttribute('data-goud');
            api('mdm/gouden', { sleutel: sl }).then(function (r) {
              document.querySelector('#mg-' + sl.replace(/[^a-z0-9]/g, '')).innerHTML =
                '<p class="meta" class="mt">' + esc(r.uitleg) + '</p>' +
                '<div class="schuif"><table class="ctab"><thead><tr><th>Veld</th><th>Wint</th><th>Van</th><th>Alternatieven</th></tr></thead><tbody>' +
                Object.keys(r.velden).slice(0, 20).map(function (k) {
                  var v = r.velden[k];
                  return '<tr><td>' + esc(k) + '</td><td>' + esc(String(v.waarde).slice(0, 40)) + '</td>' +
                    '<td class="meta">' + esc(v.van) + '</td><td class="meta">' +
                    esc(v.alternatieven.map(function (a) { return String(a.waarde).slice(0, 20); }).join(' · ')) +
                    '</td></tr>';
                }).join('') + '</tbody></table></div>' +
                '<p class="meta">Strijdig: ' + esc(r.strijdig.join(', ') || 'niets') + '. Samenvoegen is ' +
                'mensenwerk en gaat via de API (mdm/samen), zodat het altijd een reden en een journaalregel draagt.</p>';
            }).catch(function (e) { if (!e.stil) C.meld(e.message); });
          };
        });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#mdUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }
  };

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  var i = C.WERKPLEKKEN.findIndex(function (w) { return w.id === 'herkomst'; });
  C.WERKPLEKKEN.splice(i + 1, 0, { id: 'mdm', naam: 'Master data', sec: 'Zien' });
  void S;
})();
