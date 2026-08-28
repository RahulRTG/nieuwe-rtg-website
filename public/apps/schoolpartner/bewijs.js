/* RTG School Partner: bewijs van beheersing -- de kant van de leraar.

   Een toets die u becijfert, landt vanzelf als bewijs in het leerpaspoort van
   de leerling; daar hoeft u niets voor te doen. Wat u hier doet is het andere
   soort bewijs: wat u ZIET. Dat een leerling het uitlegt aan een ander, het
   voordoet aan het bord, of bij een opdracht liet zien dat hij het snapt --
   dat kan geen oefensessie meten, en het is juist het sterkste bewijs dat er
   is: iemand anders heeft het gezien.

   Twee dingen die het scherm zichtbaar houdt:
   - u ziet alleen de leerdoelen die in UW klas aan de orde zijn, en alleen
     hoe stevig ze staan. Wat een kind thuis of elders deed, staat er niet;
   - er komt geen cijfer uit. De beheersing is een woord met de reden erbij.

   Zelfde SPart-patroon als presentie.js; app.js roept SPart.bewijs() aan. */
window.SPart = window.SPart || {};
window.SPart.bewijs = function () {
  var P = window.SPart, kl = P.kl, esc = P.esc, meld = P.meld;
  var $ = function (s) { return document.querySelector(s); };

  kl('/school/klas').then(function (r) {
    if (r.body.error) return;
    var lln = r.body.leerlingen || [];
    var doelen = [].concat.apply([], (r.body.toetsen || []).map(function (t) { return t.doelen || []; }))
      .concat((r.body.huiswerk || []).map(function (h) { return h.doel; }).filter(Boolean));
    doelen = doelen.filter(function (d, i, l) { return l.indexOf(d) === i; });

    $('#bewijsVorm').innerHTML = !lln.length
      ? '<p class="stil">Nog geen leerlingen in deze klas.</p>'
      : '<div class="rij">' +
        '<select class="veld" id="bwLeerling" aria-label="Welke leerling">' +
        lln.map(function (l) { return '<option value="' + esc(l.sleutel) + '">' + esc(l.naam) + '</option>'; }).join('') +
        '</select>' +
        (doelen.length
          ? '<select class="veld" id="bwDoel" aria-label="Welk leerdoel">' +
            doelen.map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + '</option>'; }).join('') + '</select>'
          : '<input class="veld" id="bwDoel" placeholder="Leerdoel-id" aria-label="Leerdoel">') +
        '<input class="veld" id="bwNotitie" maxlength="120" placeholder="Wat zag u?" aria-label="Wat zag u">' +
        '<button class="knop p" id="bwZet" type="button">Leg vast</button>' +
        '<button class="knop" id="bwToon" type="button">Toon beheersing</button></div>' +
        '<div id="bewijsUit" class="stil h-mt50"></div>' +
        '<p class="stil">Een becijferde toets gaat vanzelf; dit is wat u ziet. De leerling krijgt het te zien bij "waarom denkt RTG dat ik dit kan?".</p>';
    if (!lln.length) return;

    $('#bwZet').addEventListener('click', function () {
      var notitie = $('#bwNotitie').value.trim();
      if (!notitie) return meld('Noteer kort wat u hebt gezien; zonder waarneming is het een vinkje.');
      kl('/school/bewijs/observatie', { leerling: $('#bwLeerling').value, doel: $('#bwDoel').value, notitie: notitie })
        .then(function (r2) {
          if (r2.body.error) return meld(r2.body.error);
          $('#bwNotitie').value = '';
          meld('Vastgelegd. Beheersing nu: ' + r2.body.beheersing.woord + '.');
        });
    });
    $('#bwToon').addEventListener('click', function () {
      kl('/school/bewijs/leerling', { leerling: $('#bwLeerling').value }).then(function (r2) {
        if (r2.body.error) return meld(r2.body.error);
        $('#bewijsUit').innerHTML = (r2.body.doelen || []).map(function (d) {
          return '<div class="item"><span>' + esc(d.doel) + '</span><span class="stil">' +
            esc(d.beheersing) + ' · ' + d.stukken + ' stuk(ken) bewijs</span></div>';
        }).join('') || '<p class="stil">Voor deze leerling staat er nog geen bewijs bij de doelen van deze klas.</p>';
      });
    });
  });
};
