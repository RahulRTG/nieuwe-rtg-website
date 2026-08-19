/* RTG School Partner: binnenkomen -- de vervanger en de nieuwe docent.

   Twee blokken voor mensen die hier voor het eerst staan.

   DE VERVANGING. Wie een klas waarneemt, krijgt de klas, wat er vandaag speelt,
   het materiaal met een tweede uitleg erbij, en wat eerdere lessen over die
   stof hebben opgeschreven. Het scherm toont ook met zoveel woorden WAT ER NIET
   IN STAAT -- zonder die zin denkt een vervanger dat hij alles ziet, en dus dat
   er niets speelt.

   DE EERSTE DAG. Hoogstens vijf dingen, afgeleid uit hoe het er nu voor staat.
   Wat af is valt weg. Er staat geen voortgangsbalk bij en geen "3 van de 5":
   dat zou een prestatiemeter op een mens zijn.

   Zelfde SPart-patroon; app.js roept SPart.instap() aan. */
window.SPart = window.SPart || {};
window.SPart.instap = function () {
  /* sk() stuurt schoolCode, klasCode en het personeel-token mee; de
     personeelsroute hieronder gebruikt alleen de eerste twee. */
  var P = window.SPart, kl = P.kl, sk = P.sk, esc = P.esc;
  var q = function (id) { return document.getElementById(id); };

  function eersteDag() {
    var vak = q('startVorm');
    if (!vak || !sk) return;
    sk('/school/personeel/start').then(function (r) {
      var d = r.body;
      if (d.error) { vak.innerHTML = '<p class="stil">' + esc(d.error) + '</p>'; return; }
      vak.innerHTML = d.stappen.map(function (s, i) {
        return '<div class="item" style="align-items:flex-start;"><span><b>' + (i + 1) + '. ' + esc(s.wat) + '</b>' +
          '<br><span class="stil">' + esc(s.waarom) + '</span></span></div>';
      }).join('') + '<p class="stil">' + esc(d.uitleg) + '</p>';
    });
  }

  function briefing() {
    var vak = q('vervangVorm');
    if (!vak) return;
    kl('/school/vervanging/briefing').then(function (r) {
      var d = r.body;
      if (d.error) { vak.innerHTML = '<p class="stil">' + esc(d.error) + '</p>'; return; }
      vak.innerHTML =
        '<div class="stil">' + esc(d.klas.naam) + ' &middot; ' + d.klas.leerlingen + ' leerlingen' +
        (d.waarnemer && d.waarnemer.tot ? ' &middot; waarneming tot ' + esc(d.waarnemer.tot.slice(0, 10)) : '') +
        ' &middot; ' + (d.vandaag.presentieGezet ? 'presentie staat' : 'presentie nog niet gezet') + '</div>' +
        (d.namen.length ? '<div class="stil">' + d.namen.map(esc).join(', ') + '</div>' : '') +
        (d.materiaal.length
          ? '<div class="kop" style="margin-top:.6rem;">Het materiaal van vandaag</div>' +
            d.materiaal.map(function (m) {
              return '<div class="item" style="align-items:flex-start;"><span><b>' + esc(m.naam) + '</b> <span class="stil">' + esc(m.vak) + '</span>' +
                '<br>' + esc(m.les) +
                m.uitleg.map(function (u) { return '<br><span class="stil"><i>' + esc(u.soort) + ':</i> ' + esc(u.tekst) + '</span>'; }).join('') +
                '</span></div>';
            }).join('')
          : '<p class="stil">Voor vandaag staat er geen leerdoel klaar in deze klas.</p>') +
        (d.eerder.length
          ? '<div class="kop" style="margin-top:.6rem;">Wat eerdere lessen opschreven</div>' +
            d.eerder.map(function (x) {
              return '<div class="item" style="align-items:flex-start;"><span>' +
                (x.werkte ? '<b>Werkte:</b> ' + esc(x.werkte) + '<br>' : '') +
                (x.liepVast ? '<b>Liep vast:</b> ' + esc(x.liepVast) + '<br>' : '') +
                '<span class="stil">' + esc(x.klas) + ' &middot; ' + esc(x.datum) + ' &middot; ' + esc(x.door) + '</span></span></div>';
            }).join('')
          : '') +
        '<p class="stil"><b>Wat hier bewust niet in staat:</b> ' + d.nietHierin.map(esc).join(', ') +
        '. ' + esc(d.uitleg) + '</p>';
    });
  }

  eersteDag();
  briefing();
};
